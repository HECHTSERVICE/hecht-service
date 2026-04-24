/**
 * Hecht Service — Next.js Edge Middleware
 *
 * 1. Rate limiting через Upstash Redis (lazy init, graceful degrade)
 * 2. Admin route protection — /admin/* (крім root /admin login page)
 *    вимагає валідний HTTP-only cookie
 *
 * Принцип: краще живий сайт без rate limit, ніж мертвий сайт з rate limit.
 */

import { NextResponse } from 'next/server';
import { getSession } from './lib/auth';

let cachedLimiters = null;
let initFailed = false;

async function getLimiters() {
  if (cachedLimiters) return cachedLimiters;
  if (initFailed) return null;

  try {
    const { Ratelimit } = await import('@upstash/ratelimit');
    const { Redis } = await import('@upstash/redis');

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
  // Auth limiter — всі auth endpoints
  if (
    pathname.startsWith('/api/verify') ||
    pathname.startsWith('/api/session') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/admin/login') ||
    pathname.startsWith('/api/login')
  ) {
    return limiters.auth;
  }
  // Form limiter — публічні submission endpoints
  if (
    pathname.startsWith('/api/warranty') ||
    pathname.startsWith('/api/register') ||
    pathname.startsWith('/api/comments') ||
    pathname.startsWith('/api/certificate') ||
    pathname.startsWith('/api/send-email')
  ) {
    return limiters.form;
  }
  return limiters.public;
}

// Чи потрібен admin cookie для цього шляху
function needsAdminAuth(pathname) {
  // /admin — це login page, не захищаємо
  if (pathname === '/admin' || pathname === '/admin/') return false;
  // /admin/* — захищаємо
  return pathname.startsWith('/admin/');
}

export async function middleware(request) {
  try {
    const pathname = request.nextUrl.pathname;

    // ── 1. Admin route guard (до rate limit)
    if (needsAdminAuth(pathname)) {
      const session = await getSession(request);
      if (!session || session.role !== 'admin') {
        const loginUrl = new URL('/admin', request.url);
        return NextResponse.redirect(loginUrl);
      }
    }

    // ── 2. Rate limiting
    const limiters = await getLimiters();
    if (!limiters) {
      return NextResponse.next();
    }

    const ip = getIp(request);
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
