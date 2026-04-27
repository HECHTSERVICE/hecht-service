import { test, expect } from '@playwright/test';
import { URLS } from './_helpers/test-data';

/**
 * Smoke tests — перевіряють що production сайт UP і critical pages доступні.
 * НЕ роблять submit форм (Turnstile у production блокує — submit тест окремо
 * через preview deployment з Cloudflare test keys).
 */

test.describe('Public site smoke', () => {
  test('homepage завантажується з правильним title', async ({ page }) => {
    const response = await page.goto(URLS.home);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/Hecht Service.*Реєстрація гарантії/i);
  });

  test('homepage показує форму реєстрації гарантії', async ({ page }) => {
    await page.goto(URLS.home);

    // Heading
    await expect(page.getByRole('heading', { name: /Реєстрація гарантії/i })).toBeVisible();

    // Submit button
    await expect(page.getByRole('button', { name: /Зареєструвати гарантію/i })).toBeVisible();

    // Section labels
    await expect(page.getByText(/Дані покупця/i)).toBeVisible();
    await expect(page.getByText(/Інформація про техніку/i)).toBeVisible();
  });

  test('всі required поля форми присутні у DOM', async ({ page }) => {
    await page.goto(URLS.home);

    // Перевіряємо лейбли (input може бути будь-яким — main check що label рендериться)
    const requiredLabels = [
      /Ім.?я/i,
      /Прізвище/i,
      /Email/i,
      /Телефон/i,
      /Серійний номер/i,
      /Модель техніки/i,
      /Дата покупки/i,
    ];

    for (const labelPattern of requiredLabels) {
      await expect(page.getByText(labelPattern).first()).toBeVisible();
    }
  });

  test('footer links на info-сторінки видимі', async ({ page }) => {
    await page.goto(URLS.home);
    const footer = page.locator('footer, [role="contentinfo"]').first();

    await expect(page.getByRole('link', { name: /Політика конфіденційності/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Правова інформація/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Умови приймання/i }).first()).toBeVisible();
  });
});

test.describe('Info pages availability', () => {
  test('Privacy Policy доступна', async ({ page }) => {
    const response = await page.goto(URLS.privacy);
    expect(response?.status()).toBe(200);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('Terms (умови приймання) доступна', async ({ page }) => {
    const response = await page.goto(URLS.terms);
    expect(response?.status()).toBe(200);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('Legal info доступна', async ({ page }) => {
    const response = await page.goto(URLS.legal);
    expect(response?.status()).toBe(200);
    await expect(page.locator('body')).not.toBeEmpty();
  });
});

test.describe('Admin entry point', () => {
  test('admin login page доступна', async ({ page }) => {
    const response = await page.goto(URLS.adminLogin);
    expect(response?.status()).toBe(200);
    // Login UI має містити форму паролю
    await expect(page.locator('body')).toContainText(/Hecht|Admin|Вхід|Пароль/i);
  });

  test('SC portal page доступна (login form)', async ({ page }) => {
    const response = await page.goto(URLS.scPanel);
    expect(response?.status()).toBe(200);
    // SC portal має login UI до auth
    await expect(page.locator('body')).not.toBeEmpty();
  });
});
