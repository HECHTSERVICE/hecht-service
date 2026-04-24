/**
 * Hecht Service — Auth helpers (JWT + HTTP-only cookie)
 *
 * Cookie: HTTP-only + Secure + SameSite=Lax, Max-Age 8 годин
 * Secret: process.env.ADMIN_SESSION_SECRET (≥32 chars, set у Vercel)
 */

import { SignJWT, jwtVerify } from 'jose';

const COOKIE_NAME = 'hecht_admin_session';
const COOKIE_MAX_AGE = 60 * 60 * 8; // 8 годин
const ALG = 'HS256';

function getSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'ADMIN_SESSION_SECRET не знайдено у env або занадто короткий (мінімум 32 chars). ' +
      'Перевір Vercel → Settings → Environment Variables.'
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${COOKIE_MAX_AGE}s`)
    .sign(getSecret());
}

export async function verifySession(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload;
  } catch {
    return null;
  }
}

export async function getSession(request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  return await verifySession(match[1]);
}

export function buildSessionCookie(token) {
  return [
    `${COOKIE_NAME}=${token}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${COOKIE_MAX_AGE}`,
  ].join('; ');
}

export function buildClearSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export { COOKIE_NAME };
