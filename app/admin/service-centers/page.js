'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import Navbar from '../../../components/Navbar';

export default function ServiceCentersPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [centers, setCenters] = useState([]);
  const [showAddCenter, setShowAddCenter] = useState(false);
  const [showAddUser, setShowAddUser] = useState(null);
  const [centerForm, setCenterForm] = useState({ city: '', center_name: '', contact_person: '', phone: '', email: '' });
  const [userForm, setUserForm] = useState({ username: '', password: '', full_name: '' });
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const s = sessionStorage.getItem('hecht_admin');
    if (s === 'true') {
      setLoggedIn(true);
    } else {
      window.location.href = '/admin';
    }
  }, []);

  useEffect(() => {
    if (loggedIn) loadCenters();
  }, [loggedIn]);

  const loadCenters = async () => {
    const { data } = await supabase
      .from('service_centers')
      .select('*, users(id, username, full_name, active)')
      .order('city');
    if (data) setCenters(data);
  };

  const addCenter = async (e) => {
    e.preventDefault();
    setError('');
    const { error: err } = await supabase.from('service_centers').insert({
      city: centerForm.city.trim(),
      center_name: centerForm.center_name.trim(),
      contact_person: centerForm.contact_person.trim(),
      phone: centerForm.phone.trim(),
      email: centerForm.email.trim(),
    });
    if (err) { setError('Помилка додавання'); return; }
    setCenterForm({ city: '', center_name: '', contact_person: '', phone: '', email: '' });
    setShowAddCenter(false);
    setSuccess('Сервісний центр додано!');
    setTimeout(() => setSuccess(''), 3000);
    await loadCenters();
  };

  const deleteCenter = async (id, name) => {
    if (!confirm('Видалити сервісний центр "' + name + '"? Акаунти працівників також будуть видалені.')) return;
    await supabase.from('users').delete().eq('service_center_id', id);
    const { error: err } = await supabase.from('service_centers').delete().eq('id', id);
    if (err) { setError('Неможливо видалити — до центру прив\'язані заявки'); setTimeout(() => setError(''), 4000); return; }
    setSuccess('Сервісний центр видалено');
    setTimeout(() => setSuccess(''), 3000);
    await loadCenters();
  };

  const addUser = async (e) => {
    e.preventDefault();
    setError('');
    const { error: err } = await supabase.from('users').insert({
      username: userForm.username.trim(),
      password_hash: userForm.password,
      role: 'service_center',
      service_center_id: showAddUser,
      full_name: userForm.full_name.trim(),
      active: true,
    });
    if (err) {
      setError(err.message.includes('unique') ? 'Такий логін вже існує' : 'Помилка створення акаунту');
      return;
    }
    setUserForm({ username: '', password: '', full_name: '' });
    setShowAddUser(null);
    setSuccess('Акаунт створено!');
    setTimeout(() => setSuccess(''), 3000);
    await loadCenters();
  };

  const deleteUser = async (userId, username) => {
    if (!confirm('Видалити акаунт "' + username + '"?')) return;
    await supabase.from('users').delete().eq('id', userId);
    setSuccess('Акаунт видалено');
    setTimeout(() => setSuccess(''), 3000);
    await loadCenters();
  };

  const inputStyle = {
    width: '100%', padding: '12px 16px', fontSize: 14,
    background: 'var(--input)', border: '1px solid var(--border)',
    borderRadius: 12, color: 'var(--text)', outline: 'none',
    fontFamily: "'Inter', sans-serif", boxSizing: 'border-box',
    transition: 'border-color 0.2s'
  };

  const labelStyle = { display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 5 };

  if (!loggedIn) return null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', transition: 'background 0.4s' }}>
      <Navbar title="Hecht Admin" showShop={false} rightContent={
        <>
          <a href="/admin" style={{
            padding: '8px 16px', borderRadius: 10, border: '1px solid var(--border)',
            background: 'var(--card)', fontSize: 13, fontWeight: 500, color: 'var(--text2)',
            textDecoration: 'none', fontFamily: "'Inter', sans-serif"
          }}>← Адмін-панель</a>
          <button onClick={() => { sessionStorage.removeItem('hecht_admin'); window.location.href = '/admin'; }} style={{
            padding: '8px 16px', borderRadius: 10, background: 'var(--red)', color: '#fff',
            border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: "'Inter', sans-serif"
          }}>Вийти</button>
        </>
      } />

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
            Сервісні центри
          </h1>
          <button onClick={() => setShowAddCenter(!showAddCenter)} style={{
            padding: '10px 20px', borderRadius: 12, background: 'var(--red)', color: '#fff',
            border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter', sans-serif"
          }}>
            + Додати центр
          </button>
        </div>

        {success && (
          <div style={{ background: 'var(--green-bg)', border: '1px solid var(--green-border)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 14, color: 'var(--green)', animation: 'fadeUp 0.3s ease' }}>
            ✓ {success}
          </div>
        )}
        {error && (
          <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 14, color: 'var(--red)' }}>
            {error}
          </div>
        )}

        {/* ADD CENTER FORM */}
        {showAddCenter && (
          <form onSubmit={addCenter} style={{
            background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20,
            padding: '28px', marginBottom: 24, animation: 'fadeUp 0.3s ease'
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 20 }}>
              Новий сервісний центр
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>Місто <span style={{ color: 'var(--red)' }}>*</span></label>
                <input required value={centerForm.city} onChange={e => setCenterForm({ ...centerForm, city: e.target.value })}
                  placeholder="Київ" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Назва центру <span style={{ color: 'var(--red)' }}>*</span></label>
                <input required value={centerForm.center_name} onChange={e => setCenterForm({ ...centerForm, center_name: e.target.value })}
                  placeholder="ТехноСервіс" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Контактна особа</label>
                <input value={centerForm.contact_person} onChange={e => setCenterForm({ ...centerForm, contact_person: e.target.value })}
                  placeholder="Іван Петренко" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Телефон</label>
                <input value={centerForm.phone} onChange={e => setCenterForm({ ...centerForm, phone: e.target.value })}
                  placeholder="+380..." style={inputStyle} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Email</label>
                <input type="email" value={centerForm.email} onChange={e => setCenterForm({ ...centerForm, email: e.target.value })}
                  placeholder="service@example.com" style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowAddCenter(false)} style={{
                padding: '10px 20px', borderRadius: 10, border: '1px solid var(--border)',
                background: 'var(--card)', fontSize: 14, color: 'var(--text2)', cursor: 'pointer', fontFamily: "'Inter', sans-serif"
              }}>Скасувати</button>
              <button type="submit" style={{
                padding: '10px 20px', borderRadius: 10, background: 'var(--red)', color: '#fff',
                border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter', sans-serif"
              }}>Додати</button>
            </div>
          </form>
        )}

        {/* ADD USER MODAL */}
        {showAddUser && (
          <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowAddUser(null); }}
            style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <form onSubmit={addUser} className="modal-card" style={{
              borderRadius: 24, padding: '32px', maxWidth: 420, width: '100%'
            }}>
              <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 20 }}>
                Новий акаунт
              </h3>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Логін <span style={{ color: 'var(--red)' }}>*</span></label>
                <input required value={userForm.username} onChange={e => setUserForm({ ...userForm, username: e.target.value })}
                  placeholder="service_kyiv" style={inputStyle} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Пароль <span style={{ color: 'var(--red)' }}>*</span></label>
                <input required value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                  placeholder="Мінімум 6 символів" style={inputStyle} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Повне ім'я</label>
                <input value={userForm.full_name} onChange={e => setUserForm({ ...userForm, full_name: e.target.value })}
                  placeholder="Іван Петренко" style={inputStyle} />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowAddUser(null)} style={{
                  padding: '10px 20px', borderRadius: 10, border: '1px solid var(--border)',
                  background: 'var(--card)', fontSize: 14, color: 'var(--text2)', cursor: 'pointer', fontFamily: "'Inter', sans-serif"
                }}>Скасувати</button>
                <button type="submit" style={{
                  padding: '10px 20px', borderRadius: 10, background: 'var(--blue)', color: '#fff',
                  border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter', sans-serif"
                }}>Створити</button>
              </div>
            </form>
          </div>
        )}

        {/* CENTERS LIST */}
        {centers.map(c => (
          <div key={c.id} style={{
            background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20,
            padding: '24px 28px', marginBottom: 16, transition: 'all 0.3s'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                  {c.city} — {c.center_name}
                </h3>
                <div style={{ fontSize: 13, color: 'var(--text3)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {c.contact_person && <span>👤 {c.contact_person}</span>}
                  {c.phone && <span>📞 {c.phone}</span>}
                  {c.email && <span>✉️ {c.email}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowAddUser(c.id)} style={{
                  padding: '7px 14px', borderRadius: 8, border: '1px solid var(--blue-border)',
                  background: 'var(--blue-bg)', fontSize: 12, fontWeight: 600, color: 'var(--blue)',
                  cursor: 'pointer', fontFamily: "'Inter', sans-serif", whiteSpace: 'nowrap'
                }}>+ Акаунт</button>
                <button onClick={() => deleteCenter(c.id, c.center_name)} style={{
                  padding: '7px 14px', borderRadius: 8, border: '1px solid var(--red-border)',
                  background: 'var(--red-bg)', fontSize: 12, fontWeight: 600, color: 'var(--red)',
                  cursor: 'pointer', fontFamily: "'Inter', sans-serif"
                }}>Видалити</button>
              </div>
            </div>

            {/* Users */}
            {c.users && c.users.length > 0 && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                  Акаунти для входу
                </div>
                {c.users.map(u => (
                  <div key={u.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 12px', background: 'var(--input)', borderRadius: 10, marginBottom: 6
                  }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: 'var(--blue)', fontWeight: 500 }}>{u.username}</span>
                      {u.full_name && <span style={{ fontSize: 12, color: 'var(--text3)' }}>({u.full_name})</span>}
                      <span style={{
                        fontSize: 10, padding: '2px 8px', borderRadius: 100, fontWeight: 600,
                        background: u.active ? 'var(--green-bg)' : 'var(--red-bg)',
                        color: u.active ? 'var(--green)' : 'var(--red)',
                        border: `1px solid ${u.active ? 'var(--green-border)' : 'var(--red-border)'}`
                      }}>{u.active ? 'Активний' : 'Неактивний'}</span>
                    </div>
                    <button onClick={() => deleteUser(u.id, u.username)} style={{
                      fontSize: 11, color: 'var(--red)', background: 'none', border: 'none',
                      cursor: 'pointer', fontWeight: 600, fontFamily: "'Inter', sans-serif"
                    }}>Видалити</button>
                  </div>
                ))}
              </div>
            )}
            {(!c.users || c.users.length === 0) && (
              <div style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic', marginTop: 8 }}>
                Немає акаунтів — натисніть "+ Акаунт" щоб створити
              </div>
            )}
          </div>
        ))}

        {centers.length === 0 && (
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
            Поки що немає сервісних центрів
          </div>
        )}
      </div>
    </div>
  );
}
