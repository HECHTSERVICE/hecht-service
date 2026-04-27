/**
 * Auth helpers для E2E тестів.
 *
 * loginAsAdmin() — логіниться як Ігор через TOTP path:
 *   1) toggle Ігор/Директор → Ігор
 *   2) password
 *   3) method: TOTP
 *   4) generated 6-digit code
 *   → /admin
 *
 * Залежить від GitHub Secrets:
 *   ADMIN_PASSWORD — plain password Ігоря (той що bcrypt-нутий у ADMIN_PASSWORD_HASH)
 *   TOTP_SECRET_IHOR — base32 secret (той самий що у Vercel)
 */

import { authenticator } from 'otplib';
import { expect } from '@playwright/test';

authenticator.options = { window: 1, step: 30 };

/**
 * Генерує валідний 6-цифровий TOTP код на основі secret.
 * Той самий algorithm що у lib/totp.js → server прийме код як валідний.
 */
export function generateTotpCode(secret) {
  if (!secret) throw new Error('TOTP_SECRET_IHOR not set in env');
  return authenticator.generate(secret);
}

/**
 * Логіниться у адмінку як Ігор через TOTP path.
 *
 * Кроки:
 *   1) goto /admin
 *   2) обрати toggle "Ігор"
 *   3) ввести password
 *   4) Continue
 *   5) обрати method "Authenticator"
 *   6) ввести 6-цифровий TOTP код
 *   7) перевірити що ми у /admin (signed in)
 *
 * @param {import('@playwright/test').Page} page
 */
export async function loginAsAdmin(page) {
  const password = process.env.ADMIN_PASSWORD;
  const totpSecret = process.env.TOTP_SECRET_IHOR;

  if (!password) throw new Error('ADMIN_PASSWORD env var not set');
  if (!totpSecret) throw new Error('TOTP_SECRET_IHOR env var not set');

  await page.goto('/admin');

  // Step 1: toggle "Ігор" (default selected, але клік для впевненості)
  const ihorToggle = page.getByRole('button', { name: /Ігор/i }).first();
  if (await ihorToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
    await ihorToggle.click();
  }

  // Step 2: password input
  const passwordInput = page.getByLabel(/пароль/i).or(page.locator('input[type="password"]')).first();
  await passwordInput.fill(password);

  // Step 3: Continue / submit password
  await page.getByRole('button', { name: /(Увійти|Далі|Продовжити|Continue)/i }).first().click();

  // Step 4: method selector → TOTP / Authenticator
  await page.getByRole('button', { name: /(Authenticator|TOTP|Аутентифікатор)/i }).first().click();

  // Step 5: TOTP code input
  const code = generateTotpCode(totpSecret);
  const codeInput = page.getByLabel(/(код|code)/i).or(page.locator('input[inputmode="numeric"]')).first();
  await codeInput.fill(code);

  // Step 6: submit code
  await page.getByRole('button', { name: /(Підтвердити|Увійти|Verify|Continue)/i }).first().click();

  // Step 7: assert ми у admin dashboard
  await expect(page).toHaveURL(/\/admin($|\?|#|\/)/, { timeout: 10000 });
  await expect(page.locator('body')).not.toContainText(/невірний|invalid|помилка/i);
}

/**
 * Logout — очищає JWT cookie і повертається на public сайт.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function logoutAdmin(page) {
  // Викликаємо logout endpoint напряму (швидше ніж клікати UI)
  await page.request.post('/api/verify', {
    data: { action: 'logout' },
  });
  // Очищаємо cookies на всякий випадок
  await page.context().clearCookies();
}
