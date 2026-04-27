/**
 * Auth helpers для E2E тестів.
 *
 * loginAsAdmin() — логіниться як Ігор через TOTP path.
 *
 * UI flow (з app/admin/page.js):
 *   STEP 1 (password): toggle Ігор/Директор → password input → "Далі"
 *   STEP 2 (method):    обрати Authenticator/Email/Recovery → "Продовжити"
 *   STEP 3 (code):      6-цифровий код → "Увійти"
 *   → /admin dashboard (loggedIn=true, але URL не змінюється)
 *
 * Залежить від GitHub Secrets:
 *   ADMIN_PASSWORD — plain пароль Ігоря
 *   TOTP_SECRET_IHOR — base32 secret (той самий що у Vercel)
 */

import { authenticator } from 'otplib';
import { expect } from '@playwright/test';

authenticator.options = { window: 1, step: 30 };

/**
 * Генерує валідний 6-цифровий TOTP код на основі secret.
 */
export function generateTotpCode(secret) {
  if (!secret) throw new Error('TOTP_SECRET_IHOR not set in env');
  return authenticator.generate(secret);
}

/**
 * Логіниться у адмінку як Ігор через TOTP path.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function loginAsAdmin(page) {
  const password = process.env.ADMIN_PASSWORD;
  const totpSecret = process.env.TOTP_SECRET_IHOR;

  if (!password) throw new Error('ADMIN_PASSWORD env var not set');
  if (!totpSecret) throw new Error('TOTP_SECRET_IHOR env var not set');

  await page.goto('/admin');

  // Wait for login form to render (sessionLoading → false)
  await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 10000 });

  // STEP 1: toggle Ігор (default selected, але клікаємо для впевненості)
  await page.getByRole('button', { name: 'Ігор', exact: true }).click();

  // STEP 1: password input
  await page.locator('input[type="password"]').fill(password);

  // STEP 1 → STEP 2: button "Далі"
  await page.getByRole('button', { name: 'Далі', exact: true }).click();

  // STEP 2: method buttons видимі — Authenticator (default selected)
  await expect(page.getByRole('button', { name: /Authenticator/i })).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: /Authenticator/i }).click();

  // STEP 2 → STEP 3: button "Продовжити"
  await page.getByRole('button', { name: 'Продовжити', exact: true }).click();

  // STEP 3: numeric code input з'являється
  const codeInput = page.locator('input[inputmode="numeric"]');
  await expect(codeInput).toBeVisible({ timeout: 10000 });

  // Generate fresh TOTP code
  const code = generateTotpCode(totpSecret);
  await codeInput.fill(code);

  // STEP 3: button "Увійти"
  await page.getByRole('button', { name: 'Увійти', exact: true }).click();

  // Verify success: login form зникає, з'являється Navbar з "Hecht Admin"
  // (URL не змінюється — це SPA, тільки state loggedIn)
  await expect(page.locator('input[type="password"]')).toBeHidden({ timeout: 10000 });
  await expect(page.getByText(/Всього заявок/i).first()).toBeVisible({ timeout: 10000 });
}

/**
 * Logout — викликає API напряму (швидко) і очищає cookies.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function logoutAdmin(page) {
  await page.request.post('/api/verify', {
    data: { action: 'logout' },
  });
  await page.context().clearCookies();
}
