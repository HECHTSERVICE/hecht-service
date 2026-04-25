/**
 * Setup 2FA — Verify endpoint
 *
 * POST /api/admin/setup-2fa/verify
 * Body: { user: 'ihor' | 'director', token: '123456' }
 *
 * Перевіряє чи введений 6-цифровий код співпадає з TOTP secret для user.
 * Використовується на setup сторінці для перевірки що Authenticator
 * правильно налаштований ПЕРЕД production login flow (крок 6).
 *
 * Безпека:
 *   - Admin auth (401 якщо не залогінений)
 *   - Whitelist user param
 *   - Sanitize token (тільки 6 цифр)
 *   - Audit log на success/fail (action_type: 'auth.totp_setup_test')
 *   - Не блокує — це просто тест валідності, не login
 */

import { getSession } from '../../../../../lib/auth';
import {
  getTotpSecretForUser,
  verifyToken,
} from '../../../../../lib/totp';
import { logAction } from '../../../../../lib/audit';

const ALLOWED_USERS = ['ihor', 'director'];

export async function POST(request) {
  // ─── Auth guard ─────────────────────────────────────────────
  const session = await getSession(request);
  if (!session || session.role !== 'admin') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ─── Parse body ─────────────────────────────────────────────
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { user, token } = body || {};

  // ─── Validate user ──────────────────────────────────────────
  if (!ALLOWED_USERS.includes(user)) {
    return Response.json(
      { error: 'Invalid user. Must be "ihor" or "director"' },
      { status: 400 }
    );
  }

  // ─── Validate token format ──────────────────────────────────
  if (!token || typeof token !== 'string') {
    return Response.json(
      { error: 'Token is required' },
      { status: 400 }
    );
  }

  const cleanToken = token.replace(/\D/g, '').slice(0, 6);
  if (cleanToken.length !== 6) {
    return Response.json(
      { valid: false, error: 'Token має бути 6 цифр' },
      { status: 200 }
    );
  }

  // ─── Get secret + verify ────────────────────────────────────
  const secret = getTotpSecretForUser(user);
  if (!secret) {
    return Response.json(
      { error: `TOTP secret not configured for ${user}` },
      { status: 500 }
    );
  }

  const isValid = verifyToken(cleanToken, secret);

  // ─── Audit log (fire-and-forget) ────────────────────────────
  // Логуємо тестові спроби щоб бачити setup activity у audit
  // Action type — спеціальний для setup, не плутати з login flow
  try {
    await logAction({
      userName: session.user_name || 'unknown',
      actionType: isValid ? 'auth.totp_setup_test_ok' : 'auth.totp_setup_test_fail',
      warrantyId: null,
      oldValue: null,
      newValue: { tested_user: user, valid: isValid },
      request,
    });
  } catch (err) {
    // logAction вже має внутрішній try/catch, але про всяк випадок
    console.error('[setup-2fa/verify] audit log failed:', err);
  }

  return Response.json({
    valid: isValid,
    message: isValid
      ? `✅ Код вірний — TOTP правильно налаштовано для ${user}`
      : '❌ Код невірний. Перевір що Authenticator налаштований на правильний акаунт + час на телефоні синхронізований.',
  });
}
