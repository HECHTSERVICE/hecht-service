'use client';

import { useState, useEffect } from 'react';
import Navbar from '../../../components/Navbar';

// ─── Стилі винесені у змінні (Next.js 15 JSX quirk) ─────────────

const containerStyle = {
  minHeight: '100vh',
  background: 'var(--bg)',
  color: 'var(--text)',
};

const innerStyle = {
  maxWidth: 600,
  margin: '0 auto',
  padding: '40px 20px',
};

const headerLabelStyle = {
  fontSize: 11,
  color: 'var(--text3)',
  letterSpacing: 1,
  textTransform: 'uppercase',
  marginBottom: 8,
  fontWeight: 500,
  fontFamily: "'Inter', sans-serif",
};

const titleStyle = {
  fontSize: 28,
  color: 'var(--red)',
  fontWeight: 600,
  margin: '0 0 12px',
  fontFamily: "'Space Grotesk', sans-serif",
};

const subtitleStyle = {
  fontSize: 14,
  color: 'var(--text2)',
  lineHeight: 1.6,
  margin: '0 0 24px',
  fontFamily: "'Inter', sans-serif",
};

const toggleRowStyle = {
  display: 'flex',
  gap: 8,
  marginBottom: 24,
};

const toggleBtnBase = {
  flex: 1,
  padding: 12,
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: "'Inter', sans-serif",
  transition: 'all 0.2s',
};

const cardStyle = {
  background: 'var(--modal-bg)',
  border: '1px solid var(--text3)',
  borderRadius: 12,
  padding: 24,
  marginBottom: 16,
};

const qrWrapStyle = {
  background: '#FFF',
  border: '0.5px solid #D3D1C7',
  borderRadius: 8,
  padding: 16,
  textAlign: 'center',
  marginBottom: 20,
};

const labelStyle = {
  fontSize: 11,
  color: 'var(--text3)',
  textTransform: 'uppercase',
  letterSpacing: 1,
  marginBottom: 8,
  fontWeight: 500,
  fontFamily: "'Inter', sans-serif",
};

const manualKeyStyle = {
  fontFamily: "'Space Mono', Menlo, monospace",
  fontSize: 13,
  background: '#FFF',
  border: '0.5px solid #D3D1C7',
  borderRadius: 6,
  padding: 12,
  color: '#1A1A1A',
  letterSpacing: 1,
  wordBreak: 'break-all',
};

const codeInputStyle = {
  flex: 1,
  fontFamily: "'Space Mono', Menlo, monospace",
  fontSize: 22,
  textAlign: 'center',
  letterSpacing: 6,
  padding: 12,
  border: '1px solid var(--text3)',
  borderRadius: 8,
  background: '#FFF',
  color: '#1A1A1A',
  outline: 'none',
};

const verifyBtnStyle = {
  padding: '12px 24px',
  background: '#1A1A1A',
  color: '#FFF',
  border: 0,
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: "'Inter', sans-serif",
};

const successMsgStyle = {
  marginTop: 14,
  padding: 12,
  background: '#EAF3DE',
  borderRadius: 6,
  fontSize: 13,
  color: '#27500A',
  fontFamily: "'Inter', sans-serif",
};

const errorMsgStyle = {
  marginTop: 14,
  padding: 12,
  background: '#FCEBEB',
  borderRadius: 6,
  fontSize: 13,
  color: '#A32D2D',
  fontFamily: "'Inter', sans-serif",
};

const helpBoxStyle = {
  marginTop: 24,
  padding: 16,
  background: 'var(--modal-bg)',
  border: '1px solid var(--text3)',
  borderRadius: 12,
  fontSize: 13,
  color: 'var(--text2)',
  lineHeight: 1.6,
  fontFamily: "'Inter', sans-serif",
};

// ────────────────────────────────────────────────────────────────

export default function SetupTwoFAPage() {
  const [sessionLoading, setSessionLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  const [user, setUser] = useState('ihor');
  const [qrLoading, setQrLoading] = useState(false);
  const [qrData, setQrData] = useState(null); // { qrDataUrl, manualKey }
  const [qrError, setQrError] = useState('');

  const [token, setToken] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null); // { valid, message }

  // ─── Перевірка сесії ──────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/session');
        const data = await res.json();
        if (data.valid && data.role === 'admin') {
          setAuthorized(true);
        } else {
          window.location.href = '/admin';
        }
      } catch {
        window.location.href = '/admin';
      } finally {
        setSessionLoading(false);
      }
    })();
  }, []);

  // ─── Завантаження QR коду при зміні user ──────────────────────
  useEffect(() => {
    if (!authorized) return;
    setQrLoading(true);
    setQrError('');
    setQrData(null);
    setVerifyResult(null);
    setToken('');

    fetch(`/api/admin/setup-2fa/qr?user=${user}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load QR');
        return r.json();
      })
      .then((d) => {
        setQrData({ qrDataUrl: d.qrDataUrl, manualKey: d.manualKey });
      })
      .catch((err) => {
        console.error('[setup-2fa] QR load error:', err);
        setQrError('Не вдалося завантажити QR. Перевір що Vercel deploy зелений.');
      })
      .finally(() => setQrLoading(false));
  }, [authorized, user]);

  // ─── Verify ───────────────────────────────────────────────────
  const handleVerify = async () => {
    const cleanToken = token.replace(/\D/g, '').slice(0, 6);
    if (cleanToken.length !== 6) {
      setVerifyResult({ valid: false, message: 'Введи 6 цифр' });
      return;
    }

    setVerifying(true);
    setVerifyResult(null);

    try {
      const res = await fetch('/api/admin/setup-2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, token: cleanToken }),
      });
      const data = await res.json();
      setVerifyResult({
        valid: !!data.valid,
        message: data.message || (data.valid ? '✓ Вірно' : '✗ Невірно'),
      });
    } catch (err) {
      console.error('[setup-2fa] verify error:', err);
      setVerifyResult({ valid: false, message: 'Помилка з\'єднання' });
    } finally {
      setVerifying(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────

  if (sessionLoading) {
    return (
      <div style={containerStyle}>
        <Navbar />
        <div style={{ ...innerStyle, textAlign: 'center', paddingTop: 80 }}>
          <p style={{ color: 'var(--text3)' }}>Перевірка сесії...</p>
        </div>
      </div>
    );
  }

  if (!authorized) return null;

  return (
    <div style={containerStyle}>
      <Navbar />

      <div style={innerStyle}>
        <div style={headerLabelStyle}>Admin · Security</div>
        <h1 style={titleStyle}>Налаштування TOTP 2FA</h1>
        <p style={subtitleStyle}>
          Скануй QR код у Google Authenticator на телефоні, потім введи 6-цифровий
          код для перевірки що все працює правильно.
        </p>

        {/* Toggle Ihor / Director */}
        <div style={toggleRowStyle}>
          <button
            onClick={() => setUser('ihor')}
            style={{
              ...toggleBtnBase,
              background: user === 'ihor' ? 'var(--red)' : 'transparent',
              color: user === 'ihor' ? '#FFF' : 'var(--text)',
              border: user === 'ihor' ? 'none' : '1px solid var(--text3)',
            }}
          >
            Ігор
          </button>
          <button
            onClick={() => setUser('director')}
            style={{
              ...toggleBtnBase,
              background: user === 'director' ? 'var(--red)' : 'transparent',
              color: user === 'director' ? '#FFF' : 'var(--text)',
              border: user === 'director' ? 'none' : '1px solid var(--text3)',
            }}
          >
            Директор
          </button>
        </div>

        {/* QR Card */}
        <div style={cardStyle}>
          {qrLoading && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
              Завантаження QR коду...
            </div>
          )}

          {qrError && (
            <div style={errorMsgStyle}>⚠️ {qrError}</div>
          )}

          {qrData && (
            <>
              <div style={qrWrapStyle}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrData.qrDataUrl}
                  alt={`TOTP QR for ${user}`}
                  style={{ width: 240, height: 240, display: 'block', margin: '0 auto' }}
                />
              </div>

              <div style={labelStyle}>Manual key (якщо камера не працює)</div>
              <div style={manualKeyStyle}>{qrData.manualKey}</div>
            </>
          )}
        </div>

        {/* Verify Card */}
        {qrData && (
          <div style={cardStyle}>
            <div style={{ ...labelStyle, marginBottom: 12 }}>
              Введи код з Authenticator
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={token}
                onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="______"
                style={codeInputStyle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !verifying) handleVerify();
                }}
              />
              <button
                onClick={handleVerify}
                disabled={verifying || token.length !== 6}
                style={{
                  ...verifyBtnStyle,
                  opacity: verifying || token.length !== 6 ? 0.5 : 1,
                  cursor: verifying || token.length !== 6 ? 'not-allowed' : 'pointer',
                }}
              >
                {verifying ? '...' : 'Перевірити'}
              </button>
            </div>

            {verifyResult && (
              <div style={verifyResult.valid ? successMsgStyle : errorMsgStyle}>
                {verifyResult.message}
              </div>
            )}
          </div>
        )}

        {/* Help */}
        <div style={helpBoxStyle}>
          <strong style={{ color: 'var(--text)' }}>Як налаштувати:</strong>
          <ol style={{ margin: '8px 0 0', paddingLeft: 20 }}>
            <li style={{ marginBottom: 6 }}>Відкрий Google Authenticator на телефоні</li>
            <li style={{ marginBottom: 6 }}>Натисни "+" → "Сканировать QR-код"</li>
            <li style={{ marginBottom: 6 }}>Наведи камеру на QR код вище</li>
            <li style={{ marginBottom: 6 }}>В Authenticator з'явиться запис "Hecht Service ({user})"</li>
            <li style={{ marginBottom: 6 }}>Скопіюй 6-цифровий код звідти у поле вище</li>
            <li>Якщо код прийме — все налаштовано ✓</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
