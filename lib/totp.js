/**
 * Hecht Service — TOTP 2FA helpers
 *
 * Архітектура:
 *   - Secrets зберігаються у Vercel env vars (Sensitive):
 *       TOTP_SECRET_IHOR, TOTP_SECRET_DIRECTOR
 *   - Recovery keys у Vercel env vars (Sensitive):
 *       TOTP_RECOVERY_IHOR, TOTP_RECOVERY_DIRECTOR
 *   - Жодних записів у БД — все runtime з env
 *
 * Захист:
 *   - window: 1 = TOTP приймає коди ±30s від поточного часу (compensate clock drift)
 *   - timingSafeEqual для recovery keys — захист від timing attacks
 *   - Constant-time порівняння — атакер не може вгадати ключ через response time
 *
 * Залежності: otplib (^12.0.1), node:crypto (built-in)
 */

import { authenticator } from 'otplib';
import { randomBytes, timingSafeEqual } from 'node:crypto';

// ─── Налаштування otplib ────────────────────────────────────────
// window: 1 — приймаємо поточний код + один попередній + один наступний
//   (тобто 90 секунд window). Захищає від невеликого clock drift між
//   телефоном і нашим сервером.
authenticator.options = {
  window: 1,
  step: 30, // стандартний 30-секундний інтервал TOTP
};

// Whitelist user_name (синхронізовано з verify/route.js)
const ALLOWED_USER_NAMES = ['ihor', 'director'];

// ─── Генерація нових secrets (для setup) ────────────────────────

/**
 * Створює новий base32 TOTP secret.
 * Використовується ОДИН РАЗ при початковому setup через DevTools.
 *
 * Формат: 32-character base32 string (стандарт RFC 4648).
 * Приклад: "JBSWY3DPEHPK3PXPNRSXIIDFNRSWG2LD"
 */
export function generateNewSecret() {
  return authenticator.generateSecret();
}

/**
 * Створює recovery key — 32-char hex string.
 * Використовується ОДИН РАЗ при setup, зберігається у env + Apple Notes.
 *
 * Якщо телефон загублено — вводиться замість TOTP коду для аварійного входу.
 * Кожне використання → audit log entry "auth.recovery_used" + alert.
 *
 * Формат: 64 hex chars (256 біт ентропії).
 * Приклад: "a3f7b2c9d4e1f6a8b5c2d9e7f4a1b8c5d2e9f6a3b0c7d4e1f8a5b2c9d6e3f0a7"
 */
export function generateRecoveryKey() {
  return randomBytes(32).toString('hex');
}

// ─── Verification ────────────────────────────────────────────────

/**
 * Перевіряє 6-цифровий TOTP код проти secret.
 *
 * @param {string} token — 6 цифр що ввів user (без пробілів)
 * @param {string} secret — base32 secret з env
 * @returns {boolean} true якщо код валідний у window ±30s
 */
export function verifyToken(token, secret) {
  if (!token || !secret) return false;

  // Sanitize: тільки цифри, рівно 6 chars
  const cleanToken = String(token).replace(/\D/g, '').slice(0, 6);
  if (cleanToken.length !== 6) return false;

  try {
    return authenticator.verify({ token: cleanToken, secret });
  } catch (err) {
    console.error('[totp] verifyToken error:', err);
    return false;
  }
}

/**
 * Перевіряє recovery key через constant-time comparison.
 *
 * Чому timingSafeEqual:
 *   Якщо порівнювати рядки звичайним === — атакер може через response
 *   time відгадати recovery key символ за символом (timing attack).
 *   timingSafeEqual завжди працює однаковий час незалежно від збігу.
 *
 * @param {string} input — що ввів user
 * @param {string} expected — recovery key з env
 * @returns {boolean}
 */
export function verifyRecoveryKey(input, expected) {
  if (!input || !expected) return false;
  if (input.length !== expected.length) return false;

  try {
    const inputBuf = Buffer.from(input, 'utf8');
    const expectedBuf = Buffer.from(expected, 'utf8');
    if (inputBuf.length !== expectedBuf.length) return false;
    return timingSafeEqual(inputBuf, expectedBuf);
  } catch (err) {
    console.error('[totp] verifyRecoveryKey error:', err);
    return false;
  }
}

// ─── otpauth URL для QR коду ────────────────────────────────────

/**
 * Будує otpauth:// URL для генерації QR коду.
 *
 * Authenticator app (Google/Authy/1Password) сканує цей QR і додає
 * запис у свій список з секретом. Після цього кожні 30 секунд
 * генерує 6-цифровий код.
 *
 * Формат: otpauth://totp/{issuer}:{label}?secret={secret}&issuer={issuer}
 *
 * @param {string} userName — 'ihor' або 'director'
 * @param {string} secret — base32 secret
 * @returns {string} otpauth URL
 */
export function generateOtpAuthUrl(userName, secret) {
  const issuer = 'Hecht Service';
  const label = userName === 'ihor' ? 'Ігор' : 'Директор';
  return authenticator.keyuri(label, issuer, secret);
}

// ─── Env var resolvers ──────────────────────────────────────────

/**
 * Повертає TOTP secret для user з env vars.
 *
 * @param {string} userName — 'ihor' або 'director'
 * @returns {string|null} secret або null якщо env не налаштований
 */
export function getTotpSecretForUser(userName) {
  if (!ALLOWED_USER_NAMES.includes(userName)) return null;

  const envKey = `TOTP_SECRET_${userName.toUpperCase()}`;
  const secret = process.env[envKey];

  if (!secret) {
    console.error(`[totp] ${envKey} not set in env`);
    return null;
  }

  return secret;
}

/**
 * Повертає recovery key для user з env vars.
 *
 * @param {string} userName — 'ihor' або 'director'
 * @returns {string|null}
 */
export function getRecoveryKeyForUser(userName) {
  if (!ALLOWED_USER_NAMES.includes(userName)) return null;

  const envKey = `TOTP_RECOVERY_${userName.toUpperCase()}`;
  const key = process.env[envKey];

  if (!key) {
    console.error(`[totp] ${envKey} not set in env`);
    return null;
  }

  return key;
}

/**
 * Перевіряє чи всі TOTP env vars налаштовані для обох admin-ів.
 * Викликається у /admin/setup-2fa щоб показати warning якщо щось не так.
 *
 * @returns {{ihor: boolean, director: boolean}}
 */
export function checkTotpConfiguration() {
  return {
    ihor: !!(process.env.TOTP_SECRET_IHOR && process.env.TOTP_RECOVERY_IHOR),
    director: !!(process.env.TOTP_SECRET_DIRECTOR && process.env.TOTP_RECOVERY_DIRECTOR),
  };
}
