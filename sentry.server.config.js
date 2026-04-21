/**
 * Sentry Server Configuration
 * Ловить помилки у Next.js API роутах, Server Components, middleware.
 *
 * Це головна лінія оборони — тут ми побачимо падіння типу
 * middleware crash який у нас уже був.
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  environment: process.env.NODE_ENV,

  // 10% транзакцій для tracing (Performance Monitoring)
  tracesSampleRate: 0.1,

  // Не шлемо PII (особисті дані користувачів)
  sendDefaultPii: false,

  // Тільки у production
  enabled: process.env.NODE_ENV === 'production',

  // Фільтр шуму
  ignoreErrors: [
    'Rate limit exceeded',
    'Too Many Requests',
  ],
});
