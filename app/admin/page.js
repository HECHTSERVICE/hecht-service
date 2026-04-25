'use client';
import { useState, useEffect, useRef } from 'react';
import Navbar from '../../components/Navbar';
export default function AdminPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [userName, setUserName] = useState('ihor'); // ⭐ Tier 1.4 — для audit log
  const [loginError, setLoginError] = useState('');
  const [tfaStep, setTfaStep] = useState('password'); // 'password' | 'method' | 'code' | 'recovery'
  const [tfaMethod, setTfaMethod] = useState('totp'); // 'totp' | 'email' | 'recovery' — Tier 2.1
  const [tfaCode, setTfaCode] = useState('');
  const [recoveryKey, setRecoveryKey] = useState(''); // Tier 2.1 emergency
  const [tfaSending, setTfaSending] = useState(false);
  const [registrations, setRegistrations] = useState([]);
  const [centers, setCenters] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedCard, setSelectedCard] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [metrics, setMetrics] = useState({ total: 0, nova: 0, work: 0, done: 0 });
  const chatRef = useRef(null);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/session');
        const data = await res.json();
        if (data.valid && data.role === 'admin') setLoggedIn(true);
      } catch (err) {
        console.error('Session check failed:', err);
      } finally {
        setSessionLoading(false);
      }
    })();
  }, []);
  useEffect(() => {
    if (loggedIn) { loadData(); loadCenters(); }
  }, [loggedIn]);

  // ═══════════════════════════════════════════════════════════════
  // Login flow — Tier 2.1: TOTP як default + Email fallback + Recovery
  // ═══════════════════════════════════════════════════════════════
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');

    // STEP 1: пароль → перейти у вибір методу
    if (tfaStep === 'password') {
      if (!password) { setLoginError('Введіть пароль'); return; }
      // Просто переходимо у method selection — пароль ще не валідуємо
      // Валідація буде разом з вибраним методом (login або login-totp)
      setTfaStep('method');
      return;
    }

    // STEP 2: метод вибрано → відправляємо пароль на правильний endpoint
    if (tfaStep === 'method') {
      setTfaSending(true);
      try {
        // TOTP path — login-totp (НЕ шле email)
        if (tfaMethod === 'totp') {
          const res = await fetch('/api/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'login-totp', password, user_name: userName })
          });
          const data = await res.json();
          if (data.success) {
            setTfaStep('code');
            setPassword('');
          } else {
            setLoginError(data.error || 'Невірний пароль');
          }
        }
        // Email path — старий flow (надсилає код на пошту)
        else if (tfaMethod === 'email') {
          const res = await fetch('/api/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'login', password, user_name: userName })
          });
          const data = await res.json();
          if (data.success) {
            setTfaStep('code');
            setPassword('');
          } else {
            setLoginError(data.error || 'Невірний пароль');
          }
        }
        // Recovery path — використовує login-totp + потім recovery_key
        else if (tfaMethod === 'recovery') {
          const res = await fetch('/api/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'login-totp', password, user_name: userName })
          });
          const data = await res.json();
          if (data.success) {
            setTfaStep('recovery');
            setPassword('');
          } else {
            setLoginError(data.error || 'Невірний пароль');
          }
        }
      } catch (err) {
        setLoginError('Помилка з\'єднання');
      } finally {
        setTfaSending(false);
      }
      return;
    }

    // STEP 3a: ввід TOTP/Email коду
    if (tfaStep === 'code') {
      if (!tfaCode.trim()) { setLoginError('Введіть код'); return; }
      setTfaSending(true);
      try {
        // TOTP code → verify-totp
        if (tfaMethod === 'totp') {
          const res = await fetch('/api/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'verify-totp', token: tfaCode.trim() })
          });
          const data = await res.json();
          if (data.valid) { setLoggedIn(true); }
          else { setLoginError(data.error || 'Невірний код'); }
        }
        // Email code → verify (старий flow)
        else {
          const res = await fetch('/api/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'verify', code: tfaCode.trim() })
          });
          const data = await res.json();
          if (data.valid) { setLoggedIn(true); }
          else { setLoginError(data.error || 'Невірний код'); }
        }
      } catch (err) { setLoginError('Помилка з\'єднання'); }
      finally { setTfaSending(false); }
      return;
    }

    // STEP 3b: ввід recovery key
    if (tfaStep === 'recovery') {
      if (!recoveryKey.trim()) { setLoginError('Введіть recovery key'); return; }
      setTfaSending(true);
      try {
        const res = await fetch('/api/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'verify-recovery', recovery_key: recoveryKey.trim() })
        });
        const data = await res.json();
        if (data.valid) { setLoggedIn(true); }
        else { setLoginError(data.error || 'Невірний recovery key'); }
      } catch (err) { setLoginError('Помилка з\'єднання'); }
      finally { setTfaSending(false); }
      return;
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) });
    } catch (err) {}
    window.location.href = '/admin';
  };

  // Reset до початку login flow (повертатись назад)
  const resetLoginFlow = () => {
    setTfaStep('password');
    setTfaCode('');
    setRecoveryKey('');
    setLoginError('');
    setTfaMethod('totp');
  };

  // ═══════════════════════════════════════════════════════════════
  // Data loading — через /api/admin/* замість прямого supabase.
  // Якщо сервер повертає 401 — сесія пропала, показуємо login screen.
  // ═══════════════════════════════════════════════════════════════
  const loadData = async () => {
    try {
      const res = await fetch('/api/admin/warranties');
      if (res.status === 401) { setLoggedIn(false); return; }
      if (!res.ok) throw new Error('Failed to load warranties');
      const data = await res.json();
      setRegistrations(data.warranties || []);
      setMetrics(data.metrics || { total: 0, nova: 0, work: 0, done: 0 });
    } catch (err) {
      console.error('[admin] loadData error:', err);
    }
  };

  const loadCenters = async () => {
    try {
      const res = await fetch('/api/admin/service-centers');
      if (res.status === 401) { setLoggedIn(false); return; }
      if (!res.ok) throw new Error('Failed to load centers');
      const data = await res.json();
      setCenters(data.centers || []);
    } catch (err) {
      console.error('[admin] loadCenters error:', err);
    }
  };

  const loadComments = async (warrantyId) => {
    try {
      const res = await fetch(`/api/admin/warranties/${warrantyId}/comments`);
      if (res.status === 401) { setLoggedIn(false); return; }
      if (!res.ok) throw new Error('Failed to load comments');
      const data = await res.json();
      setComments(data.comments || []);
    } catch (err) {
      console.error('[admin] loadComments error:', err);
    }
  };

  const openCard = async (reg) => {
    setSelectedCard(reg);
    await loadComments(reg.id);
    setTimeout(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, 100);
  };

  const sendComment = async () => {
    if (!newComment.trim() || !selectedCard) return;
    try {
      const res = await fetch(`/api/admin/warranties/${selectedCard.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newComment.trim() }),
      });
      if (res.status === 401) { setLoggedIn(false); return; }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to send comment');
      }
      setNewComment('');
      await loadComments(selectedCard.id);
      await loadData();
      setTimeout(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, 100);
    } catch (err) {
      console.error('[admin] sendComment error:', err);
      alert('Не вдалося надіслати коментар. Спробуйте ще раз.');
    }
  };

  const updateStatus = async (id, status) => {
    try {
      const res = await fetch(`/api/admin/warranties/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.status === 401) { setLoggedIn(false); return; }
      if (!res.ok) throw new Error('Failed to update status');
      if (selectedCard && selectedCard.id === id) setSelectedCard({ ...selectedCard, status });
      await loadData();
    } catch (err) {
      console.error('[admin] updateStatus error:', err);
      alert('Не вдалося оновити статус.');
    }
  };

  const assignCenter = async (id, centerId) => {
    try {
      const res = await fetch(`/api/admin/warranties/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_center_id: centerId }),
      });
      if (res.status === 401) { setLoggedIn(false); return; }
      if (!res.ok) throw new Error('Failed to assign center');
      await loadData();
    } catch (err) {
      console.error('[admin] assignCenter error:', err);
      alert('Не вдалося призначити сервісний центр.');
    }
  };

  const exportExcel = () => {
    const headers = ['Дата','Сертифікат','Ім\'я','Прізвище','Телефон','Email','Модель','Серійний номер','Статус','Сервісний центр'];
    const rows = registrations.map(r => [r.registration_date ? new Date(r.registration_date).toLocaleDateString('uk-UA') : '', r.cert_number, r.first_name, r.last_name, r.phone, r.email, r.model, r.serial_number, r.status, r.service_centers ? r.service_centers.city + ' — ' + r.service_centers.center_name : '']);
    const bom = '\uFEFF';
    const csv = bom + [headers, ...rows].map(r => r.map(c => '"' + String(c || '').replace(/"/g, '""') + '"').join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'hecht-export-' + new Date().toISOString().slice(0,10) + '.csv'; a.click();
  };
  const filtered = registrations.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q || r.first_name?.toLowerCase().includes(q) || r.last_name?.toLowerCase().includes(q) || r.serial_number?.toLowerCase().includes(q) || r.model?.toLowerCase().includes(q) || r.cert_number?.toLowerCase().includes(q);
    const matchStatus = !statusFilter || r.status === statusFilter;
    return matchSearch && matchStatus;
  });
  const statusClass = (s) => {
    if (s === 'Нова') return { background: 'var(--yellow-bg)', color: '#92400e', border: '1px solid var(--yellow-border)' };
    if (s === 'В роботі') return { background: 'var(--orange-bg)', color: 'var(--orange)', border: '1px solid var(--orange-border)' };
    if (s === 'Ремонт завершено') return { background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green-border)' };
    if (s === 'Видана') return { background: 'var(--blue-bg)', color: 'var(--blue)', border: '1px solid var(--blue-border)' };
    return {};
  };
  const formatDate = (d) => { if (!d) return '—'; const dt = new Date(d); return dt.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };
  const formatChatTime = (d) => { const dt = new Date(d); return dt.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' }) + ' ' + dt.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }); };
  if (sessionLoading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text3)', fontSize: 14 }}>Завантаження...</div>
      </div>
    );
  }
  if (!loggedIn) {
    // Subtitles для кожного step (Tier 2.1)
    const stepSubtitle = {
      password: 'Введіть пароль для входу',
      method: 'Як отримати код підтвердження?',
      code: tfaMethod === 'totp' ? '📱 Введіть код з Google Authenticator' : '📧 Код надіслано на пошту адміністратора',
      recovery: '🔑 Recovery key (32 символи з Apple Notes)',
    };

    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <form onSubmit={handleLogin} style={{ maxWidth: 420, width: '100%', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 24, padding: '48px 36px', textAlign: 'center', boxShadow: 'var(--shadow)', animation: 'fadeUp 0.5s ease both' }}>
          <div style={{ width: 48, height: 48, background: 'var(--red)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontFamily: "'Space Mono', monospace", color: '#fff', fontWeight: 700, fontSize: 22 }}>H</div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Адмін-панель</h1>
          <p style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 28 }}>{stepSubtitle[tfaStep]}</p>
          {loginError && (
            <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: 'var(--red)' }}>{loginError}</div>
          )}

          {/* STEP 1: Toggle + Password */}
          {tfaStep === 'password' && (
            <>
              <div style={{ marginBottom: 16, textAlign: 'left' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Хто заходить?</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    { value: 'ihor', label: 'Ігор' },
                    { value: 'director', label: 'Директор' },
                  ].map(opt => {
                    const active = userName === opt.value;
                    return (
                      <button key={opt.value} type="button" onClick={() => setUserName(opt.value)}
                        style={{ flex: 1, padding: '12px 16px', fontSize: 14, fontWeight: 600, fontFamily: "'Inter', sans-serif", borderRadius: 12, border: active ? '1px solid var(--red)' : '1px solid var(--border)', background: active ? 'var(--red)' : 'var(--input)', color: active ? '#fff' : 'var(--text2)', cursor: 'pointer', transition: 'all 0.15s' }}>
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Пароль" autoFocus
                style={{ width: '100%', padding: '14px 16px', fontSize: 16, background: 'var(--input)', border: '1px solid var(--border)', borderRadius: 14, color: 'var(--text)', outline: 'none', marginBottom: 16, boxSizing: 'border-box', fontFamily: "'Inter', sans-serif" }} />
            </>
          )}

          {/* STEP 2: Method selection (Tier 2.1) */}
          {tfaStep === 'method' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {[
                { value: 'totp', icon: '📱', title: 'Authenticator', subtitle: 'Швидко — код з телефону' },
                { value: 'email', icon: '📧', title: 'Email', subtitle: 'Код на пошту (повільніше)' },
                { value: 'recovery', icon: '🔑', title: 'Recovery key', subtitle: 'Загубив телефон' },
              ].map(opt => {
                const active = tfaMethod === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTfaMethod(opt.value)}
                    style={{
                      padding: '14px 18px',
                      fontSize: 14,
                      fontFamily: "'Inter', sans-serif",
                      borderRadius: 12,
                      border: active ? '2px solid var(--red)' : '1px solid var(--border)',
                      background: active ? 'var(--red-bg)' : 'var(--input)',
                      color: 'var(--text)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                    }}
                  >
                    <div style={{ fontSize: 22 }}>{opt.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>{opt.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)' }}>{opt.subtitle}</div>
                    </div>
                    {active && <div style={{ color: 'var(--red)', fontSize: 16, fontWeight: 700 }}>✓</div>}
                  </button>
                );
              })}
            </div>
          )}

          {/* STEP 3a: TOTP/Email code input */}
          {tfaStep === 'code' && (
            <input type="text" value={tfaCode} onChange={e => setTfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="______" autoFocus maxLength={6} inputMode="numeric"
              style={{ width: '100%', padding: '14px 16px', fontSize: 28, background: 'var(--input)', border: '1px solid var(--border)', borderRadius: 14, color: 'var(--text)', outline: 'none', marginBottom: 16, boxSizing: 'border-box', fontFamily: "'Space Mono', monospace", textAlign: 'center', letterSpacing: '0.5em' }} />
          )}

          {/* STEP 3b: Recovery key input */}
          {tfaStep === 'recovery' && (
            <>
              <input type="text" value={recoveryKey} onChange={e => setRecoveryKey(e.target.value.trim())} placeholder="Recovery key з Apple Notes..." autoFocus
                style={{ width: '100%', padding: '14px 16px', fontSize: 13, background: 'var(--input)', border: '1px solid var(--border)', borderRadius: 14, color: 'var(--text)', outline: 'none', marginBottom: 12, boxSizing: 'border-box', fontFamily: "'Space Mono', monospace" }} />
              <div style={{ background: 'var(--yellow-bg)', border: '1px solid var(--yellow-border)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#92400e', textAlign: 'left' }}>
                ⚠️ Після використання recovery key — обов&apos;язково згенерувати новий і оновити Vercel + Apple Notes.
              </div>
            </>
          )}

          <button type="submit" disabled={tfaSending} style={{ width: '100%', padding: 14, background: tfaSending ? 'var(--text3)' : 'var(--red)', color: '#fff', border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 600, cursor: tfaSending ? 'wait' : 'pointer', fontFamily: "'Inter', sans-serif", opacity: tfaSending ? 0.7 : 1 }}>
            {tfaSending ? 'Зачекайте...' :
             tfaStep === 'password' ? 'Далі' :
             tfaStep === 'method' ? 'Продовжити' :
             'Увійти'}
          </button>

          {/* Back button — для всіх step крім password */}
          {tfaStep !== 'password' && (
            <button type="button" onClick={resetLoginFlow} style={{ marginTop: 12, background: 'none', border: 'none', color: 'var(--text3)', fontSize: 13, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>← Почати спочатку</button>
          )}
        </form>
      </div>
    );
  }
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', transition: 'background 0.4s' }}>
      <Navbar title="Hecht Admin" showShop={false} rightContent={
        <>
          <a href="/admin/service-centers" style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 13, fontWeight: 500, color: 'var(--text2)', textDecoration: 'none', fontFamily: "'Inter', sans-serif" }}>Сервісні центри</a>
    <a href="/admin/audit" style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 13, fontWeight: 500, color: 'var(--text2)', textDecoration: 'none', fontFamily: "'Inter', sans-serif" }}>📊 Audit</a>
          <button onClick={exportExcel} style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 13, fontWeight: 500, color: 'var(--text2)', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>📊 Excel</button>
          <button onClick={handleLogout} style={{ padding: '8px 16px', borderRadius: 10, background: 'var(--red)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>Вийти</button>
        </>
      } />
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '28px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
          {[
            { label: 'Всього заявок', value: metrics.total, color: 'var(--text)' },
            { label: 'Нові', value: metrics.nova, color: 'var(--orange)', dot: '#eab308', sub: 'Очікують призначення' },
            { label: 'В роботі', value: metrics.work, color: 'var(--blue)', dot: 'var(--blue)', sub: 'У сервісних центрах' },
            { label: 'Завершено', value: metrics.done, color: 'var(--green)', dot: 'var(--green)', sub: 'Видано / ремонт завершено' },
          ].map((m, i) => (
            <div key={i} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>{m.label}</div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 36, fontWeight: 700, color: m.color, letterSpacing: '-0.02em' }}>{m.value}</div>
              {m.sub && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>{m.dot && <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: m.dot, marginRight: 6 }} />}{m.sub}</div>}
            </div>
          ))}
        </div>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 20px', marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Пошук по серійному номеру, прізвищу, моделі..." style={{ flex: 1, minWidth: 200, padding: '11px 16px', fontSize: 14, background: 'var(--input)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)', outline: 'none', fontFamily: "'Inter', sans-serif" }} />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '11px 16px', fontSize: 14, background: 'var(--input)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)', fontFamily: "'Inter', sans-serif", minWidth: 160 }}>
            <option value="">Всі статуси</option><option value="Нова">Нова</option><option value="В роботі">В роботі</option><option value="Ремонт завершено">Ремонт завершено</option><option value="Видана">Видана</option>
          </select>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 12, paddingLeft: 4 }}>Знайдено: {filtered.length}</div>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--shadow)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1200 }}>
            <thead>
              <tr style={{ background: 'var(--text)' }}>
                {['Дата', '№ Сертифіката', 'Покупець', 'Телефон', 'Модель', 'Серійний номер', 'Статус', '💬', 'Сервісний центр'].map(h => (
                  <th key={h} style={{ padding: '14px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--bg)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} onClick={() => openCard(r)} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--input)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '13px 14px', fontSize: 13, whiteSpace: 'nowrap' }}>{formatDate(r.registration_date)}</td>
                  <td style={{ padding: '13px 14px', fontFamily: "'Space Mono', monospace", fontSize: 12 }}>{r.cert_number}</td>
                  <td style={{ padding: '13px 14px', fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{r.first_name} {r.last_name}</td>
                  <td style={{ padding: '13px 14px', fontSize: 13, whiteSpace: 'nowrap' }}>{r.phone}</td>
                  <td style={{ padding: '13px 14px', fontSize: 13 }}>{r.model}</td>
                  <td style={{ padding: '13px 14px', fontFamily: "'Space Mono', monospace", fontSize: 12, color: 'var(--blue)', fontWeight: 500 }}>{r.serial_number}</td>
                  <td style={{ padding: '13px 14px' }}><span className={r.status === 'Нова' ? 'status-new' : ''} style={{ display: 'inline-block', padding: '5px 12px', borderRadius: 100, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', ...statusClass(r.status) }}>{r.status}</span></td>
                  <td style={{ padding: '13px 14px', textAlign: 'center', fontSize: 13, color: 'var(--blue)' }}>{r.comment_count > 0 ? '💬 ' + r.comment_count : '—'}</td>
                  <td style={{ padding: '13px 14px', fontSize: 12 }} onClick={e => e.stopPropagation()}>
                    <select value={r.service_center_id || ''} onChange={e => assignCenter(r.id, e.target.value ? parseInt(e.target.value) : null)} style={{ padding: '6px 8px', fontSize: 12, background: 'var(--input)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text2)', fontFamily: "'Inter', sans-serif", maxWidth: 170 }}>
                      <option value="">Не призначено</option>{centers.map(c => <option key={c.id} value={c.id}>{c.city} — {c.center_name}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (<tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Нічого не знайдено</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
      {selectedCard && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setSelectedCard(null); }} style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div className="modal-card" style={{ borderRadius: 24, maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '28px 28px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Картка — {selectedCard.cert_number}</h2>
              <button onClick={() => setSelectedCard(null)} style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', cursor: 'pointer', fontSize: 18, color: 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            <div style={{ padding: '20px 28px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[
                { label: 'Покупець', value: selectedCard.first_name + ' ' + selectedCard.last_name },
                { label: 'Телефон', value: selectedCard.phone },
                { label: 'Email', value: selectedCard.email || '—' },
                { label: 'Модель', value: selectedCard.model },
                { label: 'Серійний номер', value: selectedCard.serial_number, mono: true },
                { label: 'Дата реєстрації', value: formatDate(selectedCard.registration_date) },
              ].map((item, i) => (
                <div key={i}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{item.label}</div>
                  <div style={{ fontSize: item.mono ? 13 : 14, color: 'var(--text)', fontWeight: 500, fontFamily: item.mono ? "'Space Mono', monospace" : 'inherit' }}>{item.value}</div>
                </div>
              ))}
            </div>
            <div style={{ height: 1, background: 'var(--border)', margin: '0 28px' }} />
            <div style={{ padding: '20px 28px', display: 'flex', gap: 12, alignItems: 'center' }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text2)' }}>Статус:</label>
              <select value={selectedCard.status} onChange={e => updateStatus(selectedCard.id, e.target.value)} style={{ flex: 1, padding: '10px 14px', fontSize: 14, background: 'var(--input)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontFamily: "'Inter', sans-serif" }}>
                <option value="Нова">Нова</option><option value="В роботі">В роботі</option><option value="Ремонт завершено">Ремонт завершено</option><option value="Видана">Видана</option>
              </select>
            </div>
            <div style={{ height: 1, background: 'var(--border)', margin: '0 28px' }} />
            <div style={{ padding: '20px 28px 24px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Коментарі</div>
              <div ref={chatRef} style={{ maxHeight: 320, overflowY: 'auto', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {comments.length === 0 && (<div style={{ textAlign: 'center', padding: 24, color: 'var(--text3)', fontSize: 13 }}>Поки що немає коментарів</div>)}
                {comments.map(c => (
                  <div key={c.id} style={{ padding: '12px 16px', borderRadius: 14, maxWidth: '85%', background: c.author_role === 'admin' ? 'var(--chat-admin)' : 'var(--chat-service)', alignSelf: c.author_role === 'admin' ? 'flex-end' : 'flex-start', borderBottomRightRadius: c.author_role === 'admin' ? 4 : 14, borderBottomLeftRadius: c.author_role === 'admin' ? 14 : 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: c.author_role === 'admin' ? 'var(--red)' : 'var(--blue)' }}>{c.author_role === 'admin' ? '🔴 ' : '🔵 '}{c.author_name}</span>
                      <span style={{ fontSize: 10, color: 'var(--text3)' }}>{formatChatTime(c.created_at)}</span>
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{c.message}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <input value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') sendComment(); }} placeholder="Написати коментар..." style={{ flex: 1, padding: '12px 16px', fontSize: 14, background: 'var(--input)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)', outline: 'none', fontFamily: "'Inter', sans-serif" }} />
                <button onClick={sendComment} style={{ padding: '12px 20px', background: 'var(--red)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter', sans-serif", whiteSpace: 'nowrap' }}>Надіслати</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
