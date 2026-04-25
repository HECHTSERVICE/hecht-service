/**
 * TEMPORARY smoke-test endpoint для Tier 2.1 setup.
 *
 * Перевіряє:
 *   1. Admin залогінений (через JWT cookie)
 *   2. Усі 4 TOTP env vars присутні
 *   3. lib/totp.js імпортується без помилок
 *   4. generateOtpAuthUrl() працює з реальним secret
 *
 * Безпека:
 *   - Захищений admin auth (401 для всіх крім залогіненого admin)
 *   - НЕ повертає значення secrets
 *   - Повертає тільки boolean флаги + довжину secrets для sanity check
 *
 * Видалити цей файл після успішного тесту (крок 4 → крок 5).
 */

import { getSession } from '../../../../lib/auth';
import {
  checkTotpConfiguration,
  getTotpSecretForUser,
  getRecoveryKeyForUser,
  generateOtpAuthUrl,
} from '../../../../lib/totp';

export async function GET(request) {
  // ─── Auth guard ─────────────────────────────────────────────
  const session = await getSession(request);
  if (!session || session.role !== 'admin') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ─── Перевірка env vars ─────────────────────────────────────
  const config = checkTotpConfiguration();

  // ─── Sanity check: довжина secrets ──────────────────────────
  // НЕ повертаємо значення, тільки довжину — щоб переконатись
  // що скопійовано без зайвих пробілів
  const ihorSecret = getTotpSecretForUser('ihor');
  const directorSecret = getTotpSecretForUser('director');
  const ihorRecovery = getRecoveryKeyForUser('ihor');
  const directorRecovery = getRecoveryKeyForUser('director');

  const lengths = {
    ihor_secret_length: ihorSecret?.length || 0,
    director_secret_length: directorSecret?.length || 0,
    ihor_recovery_length: ihorRecovery?.length || 0,
    director_recovery_length: directorRecovery?.length || 0,
  };

  // Очікувані: secrets = 32, recovery = 64
  const validations = {
    ihor_secret_valid: lengths.ihor_secret_length === 32,
    director_secret_valid: lengths.director_secret_length === 32,
    ihor_recovery_valid: lengths.ihor_recovery_length === 64,
    director_recovery_valid: lengths.director_recovery_length === 64,
  };

  // ─── Test: lib/totp.js працює ───────────────────────────────
  let otpauthTestOk = false;
  let otpauthError = null;
  try {
    if (ihorSecret) {
      const testUrl = generateOtpAuthUrl('ihor', ihorSecret);
      otpauthTestOk = testUrl.startsWith('otpauth://totp/');
    }
  } catch (err) {
    otpauthError = err.message;
  }

  // ─── Підсумок ───────────────────────────────────────────────
  const allOk =
    config.ihor &&
    config.director &&
    validations.ihor_secret_valid &&
    validations.director_secret_valid &&
    validations.ihor_recovery_valid &&
    validations.director_recovery_valid &&
    otpauthTestOk;

  return Response.json({
    overall_status: allOk ? '✅ ALL OK — ready for crок 5' : '❌ ISSUES — see details',
    env_vars_present: config,
    length_validations: validations,
    lengths_actual: lengths,
    lib_totp_works: otpauthTestOk,
    lib_totp_error: otpauthError,
    expected_lengths: {
      secrets: 32,
      recovery: 64,
    },
  });
}
