/**
 * Sentry Client Configuration
 * Ловить помилки у браузері користувачів.
 *
 * Працює автоматично для всіх React-компонентів, window.onerror,
 * неперехоплених Promise rejections.
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Середовище (production / preview / development)
  environment: process.env.NODE_ENV,

  // Скільки % транзакцій сенсити для Performance Monitoring
  // 10% — економно, достатньо щоб бачити тренди
  tracesSampleRate: 0.1,

  // Session Replay — відеозапис сесій (тільки при помилках)
  // 0% для звичайних сесій, 100% коли сталася помилка
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,

  // Інтеграції
  integrations: [
    Sentry.replayIntegration({
      // Маскуємо всі тексти і input для приватності
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Фільтруємо шум — не надсилаємо у Sentry помилки від розширень браузера,
  // ботів, або типових "нешкідливих" помилок.
  ignoreErrors: [
    // Browser extensions
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed',
    'Non-Error promise rejection captured',
    // Network glitches (не баги у нас)
    'NetworkError',
    'Failed to fetch',
    'Load failed',
    // Cloudflare Turnstile (іноді сам щось логує)
    'turnstile',
  ],

  // Не шлемо personally identifiable information (PII)
  sendDefaultPii: false,

  // Вимикаємо Sentry у dev-середовищі щоб не засмічувати логи локально
  enabled: process.env.NODE_ENV === 'production',
});
