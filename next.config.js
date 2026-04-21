/**
 * Hecht Service — Next.js config
 * Обгорнутий у withSentryConfig() для автоматичного source maps upload.
 * Зберігає всі security headers з Етапу А.
 */

const { withSentryConfig } = require('@sentry/nextjs');

// ──────────────────────────────────────────────────────────────
// Content Security Policy (CSP) — дозволені зовнішні джерела
// Додано Sentry у script-src і connect-src
// ──────────────────────────────────────────────────────────────
const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval'
    https://challenges.cloudflare.com
    https://va.vercel-scripts.com
    https://vercel.live
    https://*.sentry.io
    https://*.ingest.de.sentry.io
    https://*.ingest.sentry.io;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' blob: data: https:;
  font-src 'self' data: https://fonts.gstatic.com;
  connect-src 'self'
    https://*.supabase.co
    wss://*.supabase.co
    https://vitals.vercel-insights.com
    https://challenges.cloudflare.com
    https://*.sentry.io
    https://*.ingest.de.sentry.io
    https://*.ingest.sentry.io;
  frame-src
    https://challenges.cloudflare.com
    https://vercel.live;
  worker-src 'self' blob:;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`;

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: ContentSecurityPolicy.replace(/\s{2,}/g, ' ').trim(),
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=()',
  },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
    ];
  },

  async redirects() {
    return [
      {
        source: '/security.txt',
        destination: '/.well-known/security.txt',
        permanent: true,
      },
    ];
  },
};

// ──────────────────────────────────────────────────────────────
// Sentry wrapper — обгортає конфіг для source maps upload
// ──────────────────────────────────────────────────────────────
const sentryWebpackPluginOptions = {
  // Не логувати попередження у build logs
  silent: true,

  // Автоматично tunneling — обходить ad-blockers, що блокують sentry.io
  tunnelRoute: '/monitoring',

  // Приховати source maps від публічного доступу (але Sentry їх бачить)
  hideSourceMaps: true,

  // Вимкнути telemetry у Sentry CLI
  disableServerWebpackPlugin: false,
  disableClientWebpackPlugin: false,

  // Автоматично інструментувати Vercel Cron Jobs, якщо будуть
  automaticVercelMonitors: true,
};

module.exports = withSentryConfig(nextConfig, sentryWebpackPluginOptions);
