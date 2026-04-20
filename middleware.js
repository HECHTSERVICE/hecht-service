/**
 * Hecht Service — Next.js Edge Middleware
 * Rate limiting на рівні Edge (Vercel) через Upstash Redis
 */

const { NextResponse } = require('next/server');
const { Ratelimit } = require('@upstash/ratelimit');
const { Redis } = require('@upstash/redis');

// Публічні API: 30 запитів / 10 секунд з одного IP
const publicRatelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(30, '10 s'),
  analytics: true,
  prefix: 'hecht:ratelimit:public',
});

// Форма реєстрації гарантії: 5 спроб / хвилина
const formRatelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '60 s'),
  analytics: true,
  prefix: 'hecht:ratelimit:form',
});

// Адмінка / логін: 5 спроб / 5 хвилин
const authRatelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '300 s'),
  analytics: true,
  prefix: 'hecht:ratelimit:auth',
});

function getIp(request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
  return '127.0.0.1';
}

async function middleware(request) {
  const ip = getIp(request);
  const pathname = request.nextUrl.pathname;

  let ratelimit;

  if (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/admin/login') ||
    pathname.startsWith('/api/login')
  ) {
    ratelimit = authRatelimit;
  } else if (
    pathname.startsWith('/api/warranty') ||
    pathname.startsWith('/api/register') ||
    pathname.startsWith('/api/comments') ||
    pathname.startsWith('/api/certificate')
  ) {
    ratelimit = formRatelimit;
  } else {
    ratelimit = publicRatelimit;
  }

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
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': reset.toString(),
          'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString(),
        },
      }
    );
  }

  const response = NextResponse.next();
  response.headers.set('X-RateLimit-Limit', limit.toString());
  response.headers.set('X-RateLimit-Remaining', remaining.toString());
  response.headers.set('X-RateLimit-Reset', reset.toString());

  return response;
}

const config = {
  matcher: [
    '/api/:path*',
    '/admin/:path*',
    '/service-panel/:path*',
  ],
};

module.exports = { middleware, config };
