/**
 * Sentry Edge Configuration
 * Ловить помилки у Edge Runtime — це наш middleware.js
 *
 * Критично для нас: якщо middleware знову впаде (як вчора з MIDDLEWARE_INVOCATION_FAILED),
 * ми дізнаємось про це через 30 секунд замість 8 годин.
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  environment: process.env.NODE_ENV,

  tracesSampleRate: 0.1,

  sendDefaultPii: false,

  enabled: process.env.NODE_ENV === 'production',
});
