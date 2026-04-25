'use client';
import { useState, useEffect, useCallback } from 'react';
import Navbar from '../../../components/Navbar';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// ─── Маппінги для UI ──────────────────────────────────────────
const ACTION_LABELS = {
  'warranty.status_change': 'Зміна статусу',
  'warranty.assign_sc': 'Призначення СЦ',
  'warranty.unassign_sc': 'Зняття СЦ',
  'warranty.comment_add': 'Коментар',
  'sc.create': 'Створено СЦ',
  'sc.delete': 'Видалено СЦ',
  'sc.user_create': 'Створено user СЦ',
  'sc.user_delete': 'Видалено user СЦ',
  'auth.login_success': 'Вхід (пароль OK)',
  'auth.login_fail': 'Невдалий вхід',
  'auth.2fa_success': 'Вхід (2FA OK)',
  'auth.2fa_fail': 'Невірний 2FA',
  'auth.logout': 'Вихід',
};

const USER_LABELS = {
  ihor: 'Ігор',
  director: 'Директор',
  unknown: 'Невідомо',
};

const PERIOD_OPTIONS = [
  { value: '1', label: 'Останні 24 год' },
  { value: '7', label: 'Останні 7 днів' },
  { value: '30', label: 'Останні 30 днів' },
  { value: '90', label: 'Останні 90 днів' },
];

const TYPE_OPTIONS = [
  { value: '', label: 'Всі типи' },
  { value: 'warranty.*', label: '— Гарантії (всі)' },
  { value: 'warranty.status_change', label: 'Зміна статусу' },
  { value: 'warranty.assign_sc', label: 'Призначення СЦ' },
  { value: 'warranty.unassign_sc', label: 'Зняття СЦ' },
  { value: 'warranty.comment_add', label: 'Коментарі' },
  { value: 'sc.*', label: '— Сервісні центри (всі)' },
  { value: 'sc.create', label: 'Створення СЦ' },
  { value: 'sc.delete', label: 'Видалення СЦ' },
  { value: 'sc.user_create', label: 'Створення user' },
  { value: 'sc.user_delete', label: 'Видалення user' },
  { value: 'auth.*', label: '— Вхід (всі)' },
  { value: 'auth.login_success', label: 'Успішний вхід' },
  { value: 'auth.login_fail', label: 'Невдалий вхід' },
  { value: 'auth.2fa_success', label: '2FA успіх' },
  { value: 'auth.2fa_fail', label: '2FA помилка' },
  { value: 'auth.logout', label: 'Вихід' },
];

const USER_OPTIONS = [
  { value: '', label: 'Всі' },
  { value: 'ihor', label: 'Ігор' },
  { value: 'director', label: 'Директор' },
  { value: 'unknown', label: 'Невідомо' },
];

// ─── Color mapping для action types ───────────────────────────
const actionColor = (action_type) => {
  if (action_type?.startsWith('warranty.')) return 'var(--blue)';
  if (action_type?.startsWith('sc.')) return 'var(--orange)';
  if (action_type?.startsWith('auth.')) {
    if (action_type.includes('fail')) return 'var(--red)';
    return 'var(--green)';
  }
  return 'var(--text3)';
};

const actionBg = (action_type) => {
  if (action_type?.startsWith('warranty.')) return 'var(--blue-bg)';
  if (action_type?.startsWith('sc.')) return 'var(--orange-bg)';
  if (action_type?.startsWith('auth.')) {
    if (action_type.includes('fail')) return 'var(--red-bg)';
    return 'var(--green-bg)';
  }
  return 'var(--input)';
};

// ─── Pretty JSON parser для expand ────────────────────────────
const tryParseJson = (s) => {
  if (s === null || s === undefined || s === '') return null;
  try {
    return JSON.parse(s);
  } catch {
    return s; // якщо не JSON — повертаємо як string
  }
};

// ─── Компонент ────────────────────────────────────────────────
export default function AuditPage() {
  const [sessionLoading, setSessionLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  // Filters
  const [days, setDays] = useState('7');
  const [actionType, setActionType] = useState('');
  const [userName, setUserName] = useState('');
  const [warrantyId, setWarrantyId] = useState('');

  // Data
  const [stats, setStats] = useState(null);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage] = useState(50);
  const [loading, setLoading] = useState(false);

  // UI state
  const [expandedId, setExpandedId] = useState(null);

  // ─── Session check ───────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/session');
        const data = await res.json();
        if (data.valid && data.role === 'admin') setLoggedIn(true);
      } catch (err) {
        console.error('[audit] session check failed:', err);
      } finally {
        setSessionLoading(false);
      }
    })();
  }, []);

  // ─── Build query string for filters ──────────────────────────
  const buildQuery = useCallback((extra = {}) => {
    const params = new URLSearchParams();
    if (days) params.set('days', days);
    if (actionType) params.set('action_type', actionType);
    if (userName) params.set('user_name', userName);
    if (warrantyId.trim()) params.set('warranty_id', warrantyId.trim());
    for (const [k, v] of Object.entries(extra)) {
      if (v !== undefined && v !== null) params.set(k, String(v));
    }
    return params.toString();
  }, [days, actionType, userName, warrantyId]);

  // ─── Load stats (на зміну days) ──────────────────────────────
  const loadStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/audit?stats=1&days=${days}`);
      if (res.status === 401) { setLoggedIn(false); return; }
      if (!res.ok) throw new Error('Stats fetch failed');
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('[audit] loadStats error:', err);
    }
  }, [days]);

  // ─── Load list (на зміну будь-якого фільтра + page) ──────────
  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildQuery({ page, per_page: perPage });
      const res = await fetch(`/api/admin/audit?${qs}`);
      if (res.status === 401) { setLoggedIn(false); return; }
      if (!res.ok) throw new Error('List fetch failed');
      const data = await res.json();
      setRows(data.rows || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('[audit] loadList error:', err);
    } finally {
      setLoading(false);
    }
  }, [buildQuery, page, perPage]);

  // ─── Triggers ────────────────────────────────────────────────
  useEffect(() => {
    if (loggedIn) loadStats();
  }, [loggedIn, loadStats]);

  useEffect(() => {
    if (loggedIn) loadList();
  }, [loggedIn, loadList]);

  // Скидаємо page=1 при зміні фільтрів
  useEffect(() => {
    setPage(1);
  }, [days, actionType, userName, warrantyId]);

  // ─── CSV Export ──────────────────────────────────────────────
  const handleExport = () => {
    const qs = buildQuery({ export: 'csv' });
    window.location.href = `/api/admin/audit?${qs}`;
  };

  // ─── Loading screen ──────────────────────────────────────────
  if (sessionLoading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text3)', fontSize: 14 }}>Завантаження...</div>
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 32, textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 16 }}>Сесія недійсна. Увійдіть знову.</div>
          <a href="/admin" style={{ display: 'inline-block', padding: '10px 20px', background: 'var(--red)', color: '#fff', borderRadius: 10, textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>До адмінки</a>
        </div>
      </div>
    );
  }

  // ─── Helpers для render ──────────────────────────────────────
  const formatTime = (iso) => {
    const dt = new Date(iso);
    return dt.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' +
           dt.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  // ─── RENDER ──────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', transition: 'background 0.4s' }}>
      <Navbar title="Audit Log" showShop={false} rightContent={
        <>
          <a href="/admin" style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 13, fontWeight: 500, color: 'var(--text2)', textDecoration: 'none', fontFamily: "'Inter', sans-serif" }}>← До адмінки</a>
          <button onClick={handleExport} style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 13, fontWeight: 500, color: 'var(--text2)', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>📥 CSV</button>
        </>
      } />
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '28px 24px' }}>

        {/* ─── Stats cards ─── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
          {[
            { label: 'Всього подій', value: stats?.totalCount ?? '—', color: 'var(--text)' },
            { label: 'Гарантії', value: stats?.byCategory?.warranty ?? '—', color: 'var(--blue)' },
            { label: 'Сервісні центри', value: stats?.byCategory?.sc ?? '—', color: 'var(--orange)' },
            { label: 'Auth events', value: stats?.byCategory?.auth ?? '—', color: 'var(--green)' },
          ].map((m, i) => (
            <div key={i} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>{m.label}</div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 36, fontWeight: 700, color: m.color, letterSpacing: '-0.02em' }}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* ─── Chart + Top types ─── */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 20 }}>

          {/* LineChart */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 24px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>📈 Активність за період</div>
            {stats?.byDay?.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={stats.byDay} margin={{ top: 10, right: 16, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--text3)' }} tickFormatter={(d) => d?.slice(5)} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text3)' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: 'var(--modal-bg)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: 'var(--text)', fontWeight: 600 }}
                  />
                  <Line type="monotone" dataKey="count" stroke="var(--red)" strokeWidth={2} dot={{ r: 3, fill: 'var(--red)' }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13 }}>Немає даних</div>
            )}
          </div>

          {/* Top action types */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 24px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>🏆 Топ дії</div>
            {stats?.byActionType?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {stats.byActionType.slice(0, 6).map((a, i) => {
                  const pct = stats.byActionType[0].count > 0 ? Math.round((a.count / stats.byActionType[0].count) * 100) : 0;
                  return (
                    <div key={a.action_type} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span style={{ color: 'var(--text2)', fontWeight: 500 }}>{ACTION_LABELS[a.action_type] || a.action_type}</span>
                        <span style={{ color: 'var(--text)', fontWeight: 600, fontFamily: "'Space Mono', monospace" }}>{a.count}</span>
                      </div>
                      <div style={{ height: 6, background: 'var(--input)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: actionColor(a.action_type), borderRadius: 3, transition: 'width 0.3s' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ color: 'var(--text3)', fontSize: 13 }}>Немає даних</div>
            )}
          </div>
        </div>

        {/* ─── Filters bar ─── */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 20px', marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={days} onChange={(e) => setDays(e.target.value)} style={{ padding: '10px 14px', fontSize: 13, background: 'var(--input)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontFamily: "'Inter', sans-serif", minWidth: 160 }}>
            {PERIOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={actionType} onChange={(e) => setActionType(e.target.value)} style={{ padding: '10px 14px', fontSize: 13, background: 'var(--input)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontFamily: "'Inter', sans-serif", minWidth: 200 }}>
            {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={userName} onChange={(e) => setUserName(e.target.value)} style={{ padding: '10px 14px', fontSize: 13, background: 'var(--input)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontFamily: "'Inter', sans-serif", minWidth: 140 }}>
            {USER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <input type="text" value={warrantyId} onChange={(e) => setWarrantyId(e.target.value.replace(/\D/g, ''))} placeholder="Warranty ID" style={{ padding: '10px 14px', fontSize: 13, background: 'var(--input)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', outline: 'none', fontFamily: "'Inter', sans-serif", width: 140 }} />
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>Знайдено: <strong style={{ color: 'var(--text)' }}>{total}</strong></div>
        </div>

        {/* ─── Table ─── */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--text)' }}>
                {['Час', 'Хто', 'Дія', 'Warranty', 'IP', ''].map(h => (
                  <th key={h} style={{ padding: '14px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--bg)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Завантаження...</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Немає записів за обраними фільтрами</td></tr>
              )}
              {rows.flatMap(r => {
                const isExpanded = expandedId === r.id;
                const oldVal = tryParseJson(r.old_value);
                const newVal = tryParseJson(r.new_value);
                const result = [
                  <tr key={r.id} onClick={() => setExpandedId(isExpanded ? null : r.id)} style={{ borderBottom: isExpanded ? 'none' : '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s', background: isExpanded ? 'var(--input)' : 'transparent' }}
                      onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = 'var(--input)'; }}
                      onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'transparent'; }}>
                      <td style={{ padding: '13px 16px', fontSize: 12, fontFamily: "'Space Mono', monospace", color: 'var(--text2)', whiteSpace: 'nowrap' }}>{formatTime(r.created_at)}</td>
                      <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{USER_LABELS[r.user_name] || r.user_name}</td>
                      <td style={{ padding: '13px 16px' }}>
                        <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: actionBg(r.action_type), color: actionColor(r.action_type), border: `1px solid ${actionColor(r.action_type)}33` }}>
                          {ACTION_LABELS[r.action_type] || r.action_type}
                        </span>
                      </td>
                      <td style={{ padding: '13px 16px', fontSize: 12, fontFamily: "'Space Mono', monospace", color: r.warranty_id ? 'var(--blue)' : 'var(--text3)' }}>{r.warranty_id ? `#${r.warranty_id}` : '—'}</td>
                      <td style={{ padding: '13px 16px', fontSize: 11, fontFamily: "'Space Mono', monospace", color: 'var(--text3)' }}>{r.ip_address || '—'}</td>
                      <td style={{ padding: '13px 16px', textAlign: 'center', fontSize: 14, color: 'var(--text3)' }}>{isExpanded ? '▼' : '▶'}</td>
                    </tr>
                ];
                if (isExpanded) {
                  result.push(
                    <tr key={`${r.id}-expand`} style={{ borderBottom: '1px solid var(--border)', background: 'var(--input)' }}>
                      <td colSpan={6} style={{ padding: '4px 16px 18px', fontFamily: "'Space Mono', monospace", fontSize: 12 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Old value</div>
                            <pre style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, fontSize: 12, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--text)', margin: 0 }}>
                              {oldVal === null ? <span style={{ color: 'var(--text3)' }}>null</span> : (typeof oldVal === 'object' ? JSON.stringify(oldVal, null, 2) : String(oldVal))}
                            </pre>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>New value</div>
                            <pre style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, fontSize: 12, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--text)', margin: 0 }}>
                              {newVal === null ? <span style={{ color: 'var(--text3)' }}>null</span> : (typeof newVal === 'object' ? JSON.stringify(newVal, null, 2) : String(newVal))}
                            </pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                }
                return result;
              })}
            </tbody>
          </table>
        </div>

        {/* ─── Pagination ─── */}
        {total > perPage && (
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 13, fontWeight: 500, color: 'var(--text2)', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.4 : 1, fontFamily: "'Inter', sans-serif" }}>← Назад</button>
            <div style={{ padding: '8px 16px', fontSize: 13, color: 'var(--text2)', fontFamily: "'Space Mono', monospace" }}>
              Сторінка <strong style={{ color: 'var(--text)' }}>{page}</strong> з <strong style={{ color: 'var(--text)' }}>{totalPages}</strong>
            </div>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 13, fontWeight: 500, color: 'var(--text2)', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.4 : 1, fontFamily: "'Inter', sans-serif" }}>Далі →</button>
          </div>
        )}

      </div>
    </div>
  );
}
