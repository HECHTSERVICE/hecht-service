import nodemailer from 'nodemailer';
import bcrypt from 'bcryptjs';
import { signSession, buildSessionCookie, buildClearSessionCookie, getSession } from '../../../lib/auth';
import { logAction, AUDIT_ACTIONS } from '../../../lib/audit';

// In-memory store for codes (resets on deploy, which is fine for admin 2FA)
const codes = new Map();

// Whitelist для user_name — захист від injection у JWT
const ALLOWED_USER_NAMES = ['ihor', 'director'];

async function sendTfaCode() {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expires = Date.now() + 5 * 60 * 1000;

  // Зберігаємо тільки code+expires, user_name прийде окремо у login action
  const existing = codes.get('admin') || {};
  codes.set('admin', { ...existing, code, expires });

  for (const [key, val] of codes) {
    if (val.expires < Date.now()) codes.delete(key);
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: '"Hecht Service" <garantiya@hecht-service.com.ua>',
    to: 'garantiya@hecht-service.com.ua',
    subject: '\uD83D\uDD10 Код входу: ' + code,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:400px;margin:0 auto;text-align:center;padding:32px;">
        <div style="background:#E30613;color:#fff;padding:12px;border-radius:12px 12px 0 0;">
          <h2 style="margin:0;font-size:18px;">HECHT Service</h2>
        </div>
        <div style="background:#fff;border:1px solid #eee;border-top:none;padding:32px;border-radius:0 0 12px 12px;">
          <p style="color:#555;font-size:14px;margin:0 0 20px;">Код для входу в адмін-панель:</p>
          <div style="font-size:36px;font-weight:700;letter-spacing:8px;color:#E30613;margin:0 0 20px;">${code}</div>
          <p style="color:#999;font-size:12px;margin:0;">Дійсний 5 хвилин</p>
        </div>
      </div>
    `,
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, code: userCode, password, user_name } = body;

    // login — перевіряємо пароль через bcrypt, відправляємо 2FA
    if (action === 'login') {
      if (!password) {
        return Response.json({ success: false, error: 'Пароль не вказано' }, { status: 400 });
      }

      // Whitelist user_name — fallback 'ihor' якщо не надіслано (backward compat)
      const safeUserName = ALLOWED_USER_NAMES.includes(user_name) ? user_name : 'ihor';

      const hash = process.env.ADMIN_PASSWORD_HASH;
      if (!hash) {
        console.error('ADMIN_PASSWORD_HASH not set in env');
        return Response.json({ success: false, error: 'Конфігурація сервера не завершена' }, { status: 500 });
      }

      const isValid = await bcrypt.compare(password, hash);
      if (!isValid) {
        // ─── Audit: login_fail ──────────────────────────────────
        await logAction({
          userName: safeUserName,
          actionType: AUDIT_ACTIONS.AUTH_LOGIN_FAIL,
          warrantyId: null,
          oldValue: null,
          newValue: { user_name: safeUserName, reason: 'wrong_password' },
          request,
        });

        return Response.json({ success: false, error: 'Невірний пароль' });
      }

      await sendTfaCode();
      // Зберігаємо вибраного user_name разом з кодом — використається у verify
      const stored = codes.get('admin') || {};
      codes.set('admin', { ...stored, user_name: safeUserName });

      // ─── Audit: login_success (пароль правильний, 2FA код пішов) ──
      await logAction({
        userName: safeUserName,
        actionType: AUDIT_ACTIONS.AUTH_LOGIN_SUCCESS,
        warrantyId: null,
        oldValue: null,
        newValue: { user_name: safeUserName },
        request,
      });

      return Response.json({ success: true });
    }

    // verify — перевіряємо код + видаємо HTTP-only cookie
    if (action === 'verify') {
      const stored = codes.get('admin');

      if (!stored) {
        // ─── Audit: 2fa_fail (код не знайдено) ───────────────────
        await logAction({
          userName: 'unknown',
          actionType: AUDIT_ACTIONS.AUTH_2FA_FAIL,
          warrantyId: null,
          oldValue: null,
          newValue: { reason: 'no_active_code' },
          request,
        });
        return Response.json({ valid: false, error: 'Код не знайдено. Спробуйте отримати новий.' });
      }

      if (stored.expires < Date.now()) {
        const expiredUserName = stored.user_name || 'unknown';
        codes.delete('admin');

        // ─── Audit: 2fa_fail (протерміновано) ────────────────────
        await logAction({
          userName: expiredUserName,
          actionType: AUDIT_ACTIONS.AUTH_2FA_FAIL,
          warrantyId: null,
          oldValue: null,
          newValue: { reason: 'expired' },
          request,
        });
        return Response.json({ valid: false, error: 'Код протермінований. Отримайте новий.' });
      }

      if (stored.code === userCode) {
        const userName = stored.user_name || 'ihor';
        codes.delete('admin');

        // Видача HTTP-only cookie з JWT
        // role='admin' для guards
        // name='Hecht' — public alias для коментарів (бренд-голос)
        // user_name='ihor'|'director' — приватний identifier для audit log
        const token = await signSession({
          role: 'admin',
          name: 'Hecht',
          user_name: userName,
        });

        // ─── Audit: 2fa_success ──────────────────────────────────
        await logAction({
          userName,
          actionType: AUDIT_ACTIONS.AUTH_2FA_SUCCESS,
          warrantyId: null,
          oldValue: null,
          newValue: { user_name: userName },
          request,
        });

        return new Response(
          JSON.stringify({ valid: true }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Set-Cookie': buildSessionCookie(token),
            },
          }
        );
      }

      // ─── Audit: 2fa_fail (невірний код) ──────────────────────
      await logAction({
        userName: stored.user_name || 'unknown',
        actionType: AUDIT_ACTIONS.AUTH_2FA_FAIL,
        warrantyId: null,
        oldValue: null,
        newValue: { reason: 'wrong_code' },
        request,
      });

      return Response.json({ valid: false, error: 'Невірний код' });
    }

    // logout — очищуємо cookie
    if (action === 'logout') {
      // Беремо user_name з поточної session (якщо ще є)
      const session = await getSession(request);
      const userName = session?.user_name || 'unknown';

      // ─── Audit: logout ───────────────────────────────────────
      await logAction({
        userName,
        actionType: AUDIT_ACTIONS.AUTH_LOGOUT,
        warrantyId: null,
        oldValue: null,
        newValue: { user_name: userName },
        request,
      });

      return new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': buildClearSessionCookie(),
          },
        }
      );
    }

    // LEGACY: send action
    if (action === 'send') {
      await sendTfaCode();
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('2FA error:', error);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
