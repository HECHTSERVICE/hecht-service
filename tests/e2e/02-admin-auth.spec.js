import { test, expect } from '@playwright/test';
import { URLS } from './_helpers/test-data';
import { loginAsAdmin, logoutAdmin, generateTotpCode } from './_helpers/auth';

test.describe('Admin authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test('admin login page показує форму', async ({ page }) => {
    await page.goto(URLS.adminLogin);
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Ігор', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Директор', exact: true })).toBeVisible();
  });

  test('login успішний: пароль + TOTP code → /admin', async ({ page }) => {
    await loginAsAdmin(page);

    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name === 'hecht_admin_session');
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie?.httpOnly).toBe(true);
  });

  test('login fail: неправильний пароль', async ({ page }) => {
    await page.goto(URLS.adminLogin);
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'Ігор', exact: true }).click();
    await page.locator('input[type="password"]').fill('wrong-password-12345');
    await page.getByRole('button', { name: 'Далі', exact: true }).click();

    await expect(page.getByRole('button', { name: /Authenticator/i })).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Продовжити', exact: true }).click();

    await expect(page.getByText(/Невірний пароль/i)).toBeVisible({ timeout: 10000 });

    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name === 'hecht_admin_session');
    expect(sessionCookie).toBeUndefined();
  });

  test('login fail: правильний пароль + неправильний TOTP', async ({ page }) => {
    const password = process.env.ADMIN_PASSWORD;
    test.skip(!password, 'ADMIN_PASSWORD not set');

    await page.goto(URLS.adminLogin);
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'Ігор', exact: true }).click();
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole('button', { name: 'Далі', exact: true }).click();

    await expect(page.getByRole('button', { name: /Authenticator/i })).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Продовжити', exact: true }).click();

    const codeInput = page.locator('input[inputmode="numeric"]');
    await expect(codeInput).toBeVisible({ timeout: 10000 });
    await codeInput.fill('000000');
    await page.getByRole('button', { name: 'Увійти', exact: true }).click();

    await expect(page.getByText(/Невірний код/i)).toBeVisible({ timeout: 10000 });

    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name === 'hecht_admin_session');
    expect(sessionCookie).toBeUndefined();
  });

  test('logout очищає session cookie', async ({ page }) => {
    await loginAsAdmin(page);

    let cookies = await page.context().cookies();
    expect(cookies.find(c => c.name === 'hecht_admin_session')).toBeDefined();

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
