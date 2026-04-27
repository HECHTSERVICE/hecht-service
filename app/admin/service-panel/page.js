'use client';
import { useState, useEffect, useRef } from 'react';
import Script from 'next/script';
import Navbar from '../../../components/Navbar';

/**
 * Hecht Service — SC Portal UI (Tier 1.5, 27.04.2026)
 *
 * Refactored з:
 *   - Direct supabase ANON queries → fetch('/api/sc/*')
 *   - sessionStorage сесії → HttpOnly cookie через /api/sc/session
 *   - Plain text password compare → /api/auth/sc-login (bcrypt server-side)
 *   - Без CAPTCHA → Cloudflare Turnstile widget
 *
 * Login flow:
 *   1. Render Turnstile widget (auto-loads Cloudflare script)
 *   2. User вводить username + password
 *   3. Turnstile token авто-генерується після успішного challenge
 *   4. POST /api/auth/sc-login → 200 + Set-Cookie hecht_sc_session 24h
 *   5. UI підставляє service_center info з response → redirect to dashboard
 *
 * Session restore on mount:
 *   GET /api/sc/session → 200 (logged in) | 401 (show login form)
 */

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export default function ServicePanelPage() {
  // ── Auth state ──────────────────────────────────────────────
  const [authReady, setAuthReady] = useState(false); // session check completed
  const [loggedIn, setLoggedIn] = useState(false);
  const [user, setUser] = useState(null); // { username }
  const [serviceCenter, setServiceCenter] = useState(null); // { id, city, center_name }

  // ── Login form state ────────────────────────────────────────
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileWidgetRef = useRef(null);

  // ── Dashboard state ─────────────────────────────────────────
  const [registrations, setRegistrations] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCard, setSelectedCard] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [commentSending, setCommentSending] = useState(false);
  const chatRef = useRef(null);

  // ════════════════════════════════════════════════════════════
  // SESSION RESTORE on mount
  // ════════════════════════════════════════════════════════════
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/sc/session', { credentials: 'include' });
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          setServiceCenter(data.service_center);
          setLoggedIn(true);
        }
      } catch (e) {
        // network error — show login form
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ════════════════════════════════════════════════════════════
  // TURNSTILE WIDGET (рендериться коли login form видна)
  // ════════════════════════════════════════════════════════════
  useEffect(() => {
    if (loggedIn || !authReady) return;
    if (!TURNSTILE_SITE_KEY) return;

    // Чекаємо поки Cloudflare script завантажиться
    const tryRender = () => {
      if (typeof window === 'undefined' || !window.turnstile) {
        return false;
      }
      const container = document.getElementById('sc-turnstile-container');
      if (!container) return false;
      // Уникаємо дублювання widget (StrictMode викликає useEffect двічі)
      if (turnstileWidgetRef.current) {
        try { window.turnstile.remove(turnstileWidgetRef.current); } catch {}
      }
      turnstileWidgetRef.current = window.turnstile.render(container, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token) => setTurnstileToken(token),
        'expired-callback': () => setTurnstileToken(''),
        'error-callback': () => setTurnstileToken(''),
        theme: 'auto',
      });
      return true;
    };

    if (!tryRender()) {
      const interval = setInterval(() => {
        if (tryRender()) clearInterval(interval);
      }, 200);
      return () => clearInterval(interval);
    }
  }, [loggedIn, authReady]);

  // ════════════════════════════════════════════════════════════
  // LOAD WARRANTIES (after login або mount with session)
  // ════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!loggedIn) return;
    loadWarranties();
  }, [loggedIn]);

  const loadWarranties = async () => {
    try {
      const res = await fetch('/api/sc/warranties', { credentials: 'include' });
      if (res.status === 401) {
        // Cookie expired
        setLoggedIn(false);
        setUser(null);
        setServiceCenter(null);
        return;
      }
      if (!res.ok) {
        console.error('[loadWarranties] HTTP', res.status);
        return;
      }
      const data = await res.json();
      setRegistrations(data.warranties || []);
    } catch (e) {
      console.error('[loadWarranties] error:', e);
    }
  };

  // ════════════════════════════════════════════════════════════
  // LOGIN
  // ════════════════════════════════════════════════════════════
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');

    if (!username.trim() || !password) {
      setLoginError('Введіть логін та пароль');
      return;
    }
    if (!turnstileToken) {
      setLoginError('Зачекайте, поки завершиться перевірка безпеки');
      return;
    }

    setLoginLoading(true);
    try {
      const res = await fetch('/api/auth/sc-login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
          turnstileToken,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setLoginError(data.error || 'Невірний логін або пароль');
        // Reset Turnstile щоб згенерувати новий токен
        if (window.turnstile && turnstileWidgetRef.current) {
          try { window.turnstile.reset(turnstileWidgetRef.current); } catch {}
        }
        setTurnstileToken('');
        setPassword('');
        return;
      }

      // Login OK
      setUser(data.user);
      setServiceCenter(data.service_center);
      setLoggedIn(true);
      setUsername('');
      setPassword('');
      setTurnstileToken('');
    } catch (err) {
      console.error('[handleLogin] error:', err);
      setLoginError('Помилка з\'єднання. Спробуйте ще раз.');
    } finally {
      setLoginLoading(false);
    }
  };

  // ════════════════════════════════════════════════════════════
  // LOGOUT
  // ════════════════════════════════════════════════════════════
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/sc-logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (e) {
      // Ignore network errors — UI logout відбудеться у будь-якому випадку
    }
    setLoggedIn(false);
    setUser(null);
    setServiceCenter(null);
    setRegistrations([]);
    setSelectedCard(null);
    setComments([]);
  };

  // ════════════════════════════════════════════════════════════
  // COMMENTS
  // ════════════════════════════════════════════════════════════
  const loadComments = async (warrantyId) => {
    try {
      const res = await fetch(
        `/api/sc/warranties/${warrantyId}/comments`,
        { credentials: 'include' }
      );
      if (!res.ok) {
        console.error('[loadComments] HTTP', res.status);
        setComments([]);
        return;
      }
      const data = await res.json();
      setComments(data.comments || []);
    } catch (e) {
      console.error('[loadComments] error:', e);
      setComments([]);
    }
  };

  const openCard = async (reg) => {
    setSelectedCard(reg);
    await loadComments(reg.id);
    setTimeout(() => {
      if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }, 100);
  };

  const sendComment = async () => {
    if (!newComment.trim() || !selectedCard || commentSending) return;
    setCommentSending(true);
    try {
      const res = await fetch(
        `/api/sc/warranties/${selectedCard.id}/comments`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: newComment.trim() }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Помилка надсилання коментаря');
        return;
      }
      setNewComment('');
      await loadComments(selectedCard.id);
      await loadWarranties(); // оновити comment_count у списку
      setTimeout(() => {
        if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
      }, 100);
    } catch (e) {
      console.error('[sendComment] error:', e);
      alert('Помилка з\'єднання');
    } finally {
      setCommentSending(false);
    }
  };

  // ════════════════════════════════════════════════════════════
  // STATUS UPDATE
  // ════════════════════════════════════════════════════════════
  const updateStatus = async (id, status) => {
    try {
      const res = await fetch(`/api/sc/warranties/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Помилка оновлення статусу');
        return;
      }
      // Локальне оновлення state — щоб не чекати reload
      if (selectedCard && selectedCard.id === id) {
        setSelectedCard({ ...selectedCard, status });
      }
      await loadWarranties();
    } catch (e) {
      console.error('[updateStatus] error:', e);
      alert('Помилка з\'єднання');
    }
  };

  // ════════════════════════════════════════════════════════════
  // FILTERS / FORMATTERS
  // ════════════════════════════════════════════════════════════
  const filtered = registrations.filter((r) => {
    const q = search.toLowerCase();
    return (
      !q ||
      r.serial_number?.toLowerCase().includes(q) ||
      r.model?.toLowerCase().includes(q) ||
      r.first_name?.toLowerCase().includes(q) ||
      r.last_name?.toLowerCase().includes(q)
    );
  });

  const statusClass = (s) => {
    if (s === 'Нова') return { background: 'var(--yellow-bg)', color: '#92400e', border: '1px solid var(--yellow-border)' };
    if (s === 'В роботі') return { background: 'var(--orange-bg)', color: 'var(--orange)', border: '1px solid var(--orange-border)' };
    if (s === 'Ремонт завершено') return { background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green-border)' };
    if (s === 'Видана') return { background: 'var(--blue-bg)', color: 'var(--blue)', border: '1px solid var(--blue-border)' };
    return {};
  };

  const formatDate = (d) => {
    if (!d) return '—';
    const dt = new Date(d);
    return dt.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatChatTime = (d) => {
    const dt = new Date(d);
    return (
      dt.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' }) +
      ' ' +
      dt.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
    );
  };

  // ════════════════════════════════════════════════════════════
  // RENDER — wait for session check
  // ════════════════════════════════════════════════════════════
  if (!authReady) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 14, color: 'var(--text3)' }}>Завантаження...</div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  // RENDER — LOGIN
  // ════════════════════════════════════════════════════════════
  if (!loggedIn) {
    return (
      <>
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          strategy="afterInteractive"
        />
        <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <form
            onSubmit={handleLogin}
            style={{
              maxWidth: 420,
              width: '100%',
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 24,
              padding: '48px 36px',
              textAlign: 'center',
              boxShadow: 'var(--shadow)',
              animation: 'fadeUp 0.5s ease both',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                background: 'var(--blue)',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px',
                fontFamily: "'Space Mono', monospace",
                color: '#fff',
                fontWeight: 700,
                fontSize: 22,
              }}
            >
              S
            </div>
            <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
              Панель сервісного центру
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 28 }}>Введіть логін та пароль</p>

            {loginError && (
              <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: 'var(--red)' }}>
                {loginError}
              </div>
            )}

            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Логін"
              autoFocus
              autoComplete="username"
              disabled={loginLoading}
              style={{
                width: '100%',
                padding: '14px 16px',
                fontSize: 16,
                background: 'var(--input)',
                border: '1px solid var(--border)',
                borderRadius: 14,
                color: 'var(--text)',
                outline: 'none',
                marginBottom: 12,
                boxSizing: 'border-box',
                fontFamily: "'Inter', sans-serif",
              }}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Пароль"
              autoComplete="current-password"
              disabled={loginLoading}
              style={{
                width: '100%',
                padding: '14px 16px',
                fontSize: 16,
                background: 'var(--input)',
                border: '1px solid var(--border)',
                borderRadius: 14,
                color: 'var(--text)',
                outline: 'none',
                marginBottom: 16,
                boxSizing: 'border-box',
                fontFamily: "'Inter', sans-serif",
              }}
            />

            <div
              id="sc-turnstile-container"
              style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}
            />

            <button
              type="submit"
              disabled={loginLoading || !turnstileToken}
              style={{
                width: '100%',
                padding: 14,
                background: loginLoading || !turnstileToken ? 'var(--text3)' : 'var(--blue)',
                color: '#fff',
                border: 'none',
                borderRadius: 14,
                fontSize: 16,
                fontWeight: 600,
                cursor: loginLoading || !turnstileToken ? 'not-allowed' : 'pointer',
                fontFamily: "'Inter', sans-serif",
                opacity: loginLoading ? 0.7 : 1,
              }}
            >
              {loginLoading ? 'Вхід...' : 'Увійти'}
            </button>

            <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 24 }}>
              Адміністратор:{' '}
              <a href="/admin" style={{ color: 'var(--red)', textDecoration: 'none' }}>
                Вхід в адмін-панель
              </a>
            </p>
          </form>
        </div>
      </>
    );
  }

  // ════════════════════════════════════════════════════════════
  // RENDER — DASHBOARD
  // ════════════════════════════════════════════════════════════
  const navbarTitle = serviceCenter
    ? (serviceCenter.city || '') + (serviceCenter.city ? ' — ' : '') + (serviceCenter.center_name || '')
    : 'Сервісний центр';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', transition: 'background 0.4s' }}>
      <Navbar
        title={navbarTitle}
        showShop={false}
        rightContent={
          <button
            onClick={handleLogout}
            style={{
              padding: '8px 16px',
              borderRadius: 10,
              background: 'var(--red)',
              color: '#fff',
              border: 'none',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Вийти
          </button>
        }
      />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
          {[
            { label: 'Всього заявок', value: registrations.length, color: 'var(--text)' },
            {
              label: 'В роботі',
              value: registrations.filter((r) => r.status === 'В роботі' || r.status === 'Нова').length,
              color: 'var(--orange)',
            },
            {
              label: 'Завершено',
              value: registrations.filter((r) => r.status === 'Видана' || r.status === 'Ремонт завершено').length,
              color: 'var(--green)',
            },
          ].map((m, i) => (
            <div key={i} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                {m.label}
              </div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 36, fontWeight: 700, color: m.color, letterSpacing: '-0.02em' }}>
                {m.value}
              </div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 20px', marginBottom: 16 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Пошук по серійному номеру або прізвищу..."
            style={{
              width: '100%',
              padding: '11px 16px',
              fontSize: 14,
              background: 'var(--input)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              color: 'var(--text)',
              outline: 'none',
              fontFamily: "'Inter', sans-serif",
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 12, paddingLeft: 4 }}>Заявок: {filtered.length}</div>

        {/* Table */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--shadow)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr style={{ background: 'var(--text)' }}>
                {['Дата', '№ Сертифіката', 'Покупець', 'Телефон', 'Модель', 'Серійний номер', 'Статус', '💬'].map((h) => (
                  <th key={h} style={{ padding: '14px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--bg)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => openCard(r)}
                  style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--input)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '13px 14px', fontSize: 13, whiteSpace: 'nowrap' }}>{formatDate(r.registration_date)}</td>
                  <td style={{ padding: '13px 14px', fontFamily: "'Space Mono', monospace", fontSize: 12 }}>{r.cert_number}</td>
                  <td style={{ padding: '13px 14px', fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{r.first_name} {r.last_name}</td>
                  <td style={{ padding: '13px 14px', fontSize: 13, whiteSpace: 'nowrap' }}>{r.phone}</td>
                  <td style={{ padding: '13px 14px', fontSize: 13 }}>{r.model}</td>
                  <td style={{ padding: '13px 14px', fontFamily: "'Space Mono', monospace", fontSize: 12, color: 'var(--blue)', fontWeight: 500 }}>{r.serial_number}</td>
                  <td style={{ padding: '13px 14px' }}>
                    <span
                      className={r.status === 'Нова' ? 'status-new' : ''}
                      style={{ display: 'inline-block', padding: '5px 12px', borderRadius: 100, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', ...statusClass(r.status) }}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td style={{ padding: '13px 14px', textAlign: 'center', fontSize: 13, color: 'var(--blue)' }}>
                    {r.comment_count > 0 ? '💬 ' + r.comment_count : '—'}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
                    Поки що немає заявок
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL */}
      {selectedCard && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedCard(null);
          }}
          style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div className="modal-card" style={{ borderRadius: 24, maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '28px 28px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
                {selectedCard.cert_number}
              </h2>
              <button
                onClick={() => setSelectedCard(null)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'var(--card)',
                  cursor: 'pointer',
                  fontSize: 18,
                  color: 'var(--text3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '20px 28px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[
                { label: 'Покупець', value: selectedCard.first_name + ' ' + selectedCard.last_name },
                { label: 'Телефон', value: selectedCard.phone },
                { label: 'Email', value: selectedCard.email || '—' },
                { label: 'Модель', value: selectedCard.model },
                { label: 'Серійний номер', value: selectedCard.serial_number, mono: true },
                { label: 'Дата покупки', value: selectedCard.purchase_date || '—' },
              ].map((item, i) => (
                <div key={i}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: item.mono ? 13 : 14, color: 'var(--text)', fontWeight: 500, fontFamily: item.mono ? "'Space Mono', monospace" : 'inherit' }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ height: 1, background: 'var(--border)', margin: '0 28px' }} />

            <div style={{ padding: '20px 28px', display: 'flex', gap: 12, alignItems: 'center' }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text2)' }}>Статус:</label>
              <select
                value={selectedCard.status}
                onChange={(e) => updateStatus(selectedCard.id, e.target.value)}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  fontSize: 14,
                  background: 'var(--input)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  color: 'var(--text)',
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                <option value="Нова">Нова</option>
                <option value="В роботі">В роботі</option>
                <option value="Ремонт завершено">Ремонт завершено</option>
                <option value="Видана">Видана</option>
              </select>
            </div>

            <div style={{ height: 1, background: 'var(--border)', margin: '0 28px' }} />

            <div style={{ padding: '20px 28px 24px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
                Коментарі
              </div>

              <div ref={chatRef} style={{ maxHeight: 320, overflowY: 'auto', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {comments.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 24, color: 'var(--text3)', fontSize: 13 }}>
                    Поки що немає коментарів
                  </div>
                )}
                {comments.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      padding: '12px 16px',
                      borderRadius: 14,
                      maxWidth: '85%',
                      background: c.author_role === 'admin' ? 'var(--chat-admin)' : 'var(--chat-service)',
                      alignSelf: c.author_role === 'admin' ? 'flex-end' : 'flex-start',
                      borderBottomRightRadius: c.author_role === 'admin' ? 4 : 14,
                      borderBottomLeftRadius: c.author_role === 'admin' ? 14 : 4,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          color: c.author_role === 'admin' ? 'var(--red)' : 'var(--blue)',
                        }}
                      >
                        {c.author_role === 'admin' ? '🔴 ' : '🔵 '}
                        {c.author_name}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--text3)' }}>{formatChatTime(c.created_at)}</span>
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{c.message}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') sendComment();
                  }}
                  placeholder="Написати коментар..."
                  disabled={commentSending}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    fontSize: 14,
                    background: 'var(--input)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    color: 'var(--text)',
                    outline: 'none',
                    fontFamily: "'Inter', sans-serif",
                  }}
                />
                <button
                  onClick={sendComment}
                  disabled={commentSending || !newComment.trim()}
                  style={{
                    padding: '12px 20px',
                    background: commentSending || !newComment.trim() ? 'var(--text3)' : 'var(--blue)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 12,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: commentSending || !newComment.trim() ? 'not-allowed' : 'pointer',
                    fontFamily: "'Inter', sans-serif",
                    whiteSpace: 'nowrap',
                  }}
                >
                  {commentSending ? '...' : 'Надіслати'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
