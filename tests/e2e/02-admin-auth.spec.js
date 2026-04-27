import { test, expect } from '@playwright/test';
import { URLS } from './_helpers/test-data';
import { loginAsAdmin, logoutAdmin, generateTotpCode } from './_helpers/auth';

/**
 * Admin authentication E2E tests.
 *
 * Тестує:
 *   - Login flow з TOTP кодом (happy path)
 *   - Login fail з неправильним паролем
 *   - Login fail з неправильним TOTP кодом
 *   - Logout очищає session
 *
 * Не тестує (відкладено):
 *   - Email 2FA path (потребує перехоплення SMTP)
 *   - Recovery key path (одноразовий, ротується після кожного use)
 */

test.describe('Admin authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Чистимо cookies перед кожним тестом — ізоляція
    await page.context().clearCookies();
  });

  test('admin login page показує форму', async ({ page }) => {
    await page.goto(URLS.adminLogin);
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('login успішний: пароль + TOTP code → /admin', async ({ page }) => {
    await loginAsAdmin(page);

    // Після успішного login ми на /admin і сесійна cookie встановлена
    await expect(page).toHaveURL(/\/admin($|\?|#|\/)/);

    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name === 'hecht_admin_session');
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie?.httpOnly).toBe(true);
  });

  test('login fail: неправильний пароль', async ({ page }) => {
    await page.goto(URLS.adminLogin);

    // Toggle Ігор (якщо видимий)
    const ihorToggle = page.getByRole('button', { name: /Ігор/i }).first();
    if (await ihorToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
      await ihorToggle.click();
    }

    // Wrong password
    await page.locator('input[type="password"]').fill('wrong-password-12345');
    await page.getByRole('button', { name: /(Увійти|Далі|Продовжити|Continue)/i }).first().click();

    // Має залишатись на login page (не редірект на /admin dashboard)
    await page.waitForTimeout(2000);
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name === 'hecht_admin_session');
    expect(sessionCookie).toBeUndefined();
  });

  test('login fail: правильний пароль + неправильний TOTP', async ({ page }) => {
    const password = process.env.ADMIN_PASSWORD;
    test.skip(!password, 'ADMIN_PASSWORD not set');

    await page.goto(URLS.adminLogin);

    // Toggle Ігор
    const ihorToggle = page.getByRole('button', { name: /Ігор/i }).first();
    if (await ihorToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
      await ihorToggle.click();
    }

    // Right password
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole('button', { name: /(Увійти|Далі|Продовжити|Continue)/i }).first().click();

    // Method TOTP
    await page.getByRole('button', { name: /(Authenticator|TOTP|Аутентифікатор)/i }).first().click();

    // Wrong TOTP code (всі нулі — гарантовано не співпаде з реальним за 30 сек)
    const codeInput = page.getByLabel(/(код|code)/i).or(page.locator('input[inputmode="numeric"]')).first();
    await codeInput.fill('000000');
    await page.getByRole('button', { name: /(Підтвердити|Увійти|Verify|Continue)/i }).first().click();

    // Cookie не встановлена
    await page.waitForTimeout(2000);
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name === 'hecht_admin_session');
    expect(sessionCookie).toBeUndefined();
  });

  test('logout очищає session cookie', async ({ page }) => {
    await loginAsAdmin(page);

    // Verify login successful
    let cookies = await page.context().cookies();
    expect(cookies.find(c => c.name === 'hecht_admin_session')).toBeDefined();

    // Logout
    await logoutAdmin(page);

    cookies = await page.context().cookies();
    expect(cookies.find(c => c.name === 'hecht_admin_session')).toBeUndefined();
  });

  test('generateTotpCode повертає 6 цифр', async () => {
    const secret = process.env.TOTP_SECRET_IHOR;
    test.skip(!secret, 'TOTP_SECRET_IHOR not set');

    const code = generateTotpCode(secret);
    expect(code).toMatch(/^\d{6}$/);
  });
});
