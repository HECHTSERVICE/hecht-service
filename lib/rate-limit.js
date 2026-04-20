/**
 * Hecht Service — Rate limit helper для API-роутів.
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
const limiters = new Map();

function getLimiter(key, tokens, window) {
  const id = `${key}:${tokens}:${window}`;
  if (!limiters.has(id)) {
    limiters.set(
      id,
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(tokens, window),
        analytics: true,
        prefix: `hecht:action:${key}`,
      })
    );
  }
  return limiters.get(id);
}

function getIp(request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
  return 'unknown';
}

export async function checkRateLimit(
  request,
  key,
  tokens = 5,
  window = '60 s'
) {
  const ip = getIp(request);
  const limiter = getLimiter(key, tokens, window);
  const { success, remaining, reset } = await limiter.limit(ip);

  if (!success) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000);
    const err = new Error(
      `Забагато запитів. Спробуйте за ${retryAfter} секунд.`
    );
    err.retryAfter = retryAfter;
    err.code = 'RATE_LIMIT_EXCEEDED';
    throw err;
  }

  return { remaining, reset };
}
