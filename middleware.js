/**
 * Hecht Service — Next.js Edge Middleware
 * Rate limiting через Upstash Redis з LAZY INITIALIZATION.
 *
 * ЧОМУ LAZY INIT:
 *  - Redis-клієнт НЕ створюється на рівні модуля (це падало на Edge).
 *  - Створюється при першому запиті, у try/catch.
 *  - Якщо ініціалізація провалилася — запит пропускається без блокування.
 *
 * Принцип: краще живий сайт без rate limit, ніж мертвий сайт з rate limit.
 */

import { NextResponse } from 'next/server';

// Кеш для лімітерів — щоб не створювати їх на кожному запиті
let cachedLimiters = null;
let initFailed = false;

/**
 * Lazy init: створюємо лімітери тільки при першому запиті.
 * Якщо щось зламається — запам'ятовуємо це і більше не пробуємо.
 */
async function getLimiters() {
  if (cachedLimiters) return cachedLimiters;
  if (initFailed) return null;

  try {
    // Динамічний імпорт — модулі завантажуються тільки коли треба
    const { Ratelimit } = await import('@upstash/ratelimit');
    const { Redis } = await import('@upstash/redis');

    // Перевірка наявності env-змінних
    if (
      !process.env.UPSTASH_REDIS_REST_URL ||
      !process.env.UPSTASH_REDIS_REST_TOKEN
    ) {
      console.warn('[middleware] Upstash env vars missing, skipping rate limit');
      initFailed = true;
      return null;
    }

    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    cachedLimiters = {
      public: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(30, '10 s'),
        analytics: true,
        prefix: 'hecht:ratelimit:public',
      }),
      form: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, '60 s'),
        analytics: true,
        prefix: 'hecht:ratelimit:form',
      }),
      auth: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, '300 s'),
        analytics: true,
        prefix: 'hecht:ratelimit:auth',
      }),
    };

    return cachedLimiters;
  } catch (err) {
    console.error('[middleware] init failed:', err);
    initFailed = true;
    return null;
  }
}

function getIp(request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
  return '127.0.0.1';
}

function pickLimiter(limiters, pathname) {
  if (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/admin/login') ||
    pathname.startsWith('/api/login')
  ) {
    return limiters.auth;
  }
  if (
    pathname.startsWith('/api/warranty') ||
    pathname.startsWith('/api/register') ||
    pathname.startsWith('/api/comments') ||
    pathname.startsWith('/api/certificate')
  ) {
    return limiters.form;
  }
  return limiters.public;
}

export async function middleware(request) {
  try {
    const limiters = await getLimiters();

    // Якщо лімітери не створилися — пропускаємо запит, сайт працює
    if (!limiters) {
      return NextResponse.next();
    }

    const ip = getIp(request);
    const pathname = request.nextUrl.pathname;
    const ratelimit = pickLimiter(limiters, pathname);

    const { success, limit, remaining, reset } = await ratelimit.limit(ip);

    if (!success) {
      return new NextResponse(
        JSON.stringify({
          error: 'Too Many Requests',
          message: 'Забагато запитів. Спробуйте за хвилину.',
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': String(limit),
            'X-RateLimit-Remaining': String(remaining),
            'X-RateLimit-Reset': String(reset),
            'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)),
          },
        }
      );
    }

    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', String(limit));
    response.headers.set('X-RateLimit-Remaining', String(remaining));
    response.headers.set('X-RateLimit-Reset', String(reset));
    return response;
  } catch (err) {
    // Остання лінія оборони — якщо що завгодно пішло не так, просто пропускаємо
    console.error('[middleware] runtime error:', err);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    '/api/:path*',
    '/admin/:path*',
    '/service-panel/:path*',
  ],
};
