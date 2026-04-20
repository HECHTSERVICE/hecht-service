/**
 * Hecht Service — Next.js config
 * JavaScript (CommonJS) версія — адаптована під твій поточний проєкт.
 * Замінює існуючий next.config.js повністю.
 *
 * Після деплою перевірити оцінку на https://securityheaders.com
 * Ціль: A або A+
 */

// ──────────────────────────────────────────────────────────────
// Content Security Policy (CSP) — дозволені зовнішні джерела
// ──────────────────────────────────────────────────────────────
const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval'
    https://challenges.cloudflare.com
    https://va.vercel-scripts.com
    https://vercel.live;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' blob: data: https:;
  font-src 'self' data: https://fonts.gstatic.com;
  connect-src 'self'
    https://*.supabase.co
    wss://*.supabase.co
    https://vitals.vercel-insights.com
    https://challenges.cloudflare.com;
  frame-src
    https://challenges.cloudflare.com
    https://vercel.live;
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
    // HSTS — змушує браузер завжди ходити по HTTPS
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    // Захист від clickjacking (вбудовування сайту в iframe)
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    // Забороняємо браузеру "вгадувати" MIME-тип
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    // При переходах назовні — надсилаємо тільки origin
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    // Вимикаємо API-фічі, які нам не потрібні
    key: 'Permissions-Policy',
    value:
      'camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=()',
  },
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Прибираємо "X-Powered-By: Next.js" — менше інформації зловмиснику
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
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

module.exports = nextConfig;
