/**
 * Hecht Service — Auth helpers (JWT + HTTP-only cookie)
 *
 * Дві окремі сесії:
 *   ┌─ ADMIN  → cookie 'hecht_admin_session', 8h,  payload.role='admin'
 *   └─ SC     → cookie 'hecht_sc_session',    24h, payload.role='service_center'
 *
 * Cookie attrs (обидві): HTTP-only + Secure + SameSite=Lax + Path=/
 * Secret: process.env.ADMIN_SESSION_SECRET (≥32 chars, set у Vercel)
 * Алгоритм: HS256 (jose).
 */

import { SignJWT, jwtVerify } from 'jose';

// ── Cookie names ────────────────────────────────────────────────
const ADMIN_COOKIE_NAME = 'hecht_admin_session';
const SC_COOKIE_NAME = 'hecht_sc_session';

// ── Session durations (в секундах) ──────────────────────────────
const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 8;       // 8 годин
const SC_COOKIE_MAX_AGE = 60 * 60 * 24;         // 24 години

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

// ════════════════════════════════════════════════════════════════
// ADMIN SESSION (existing, без змін у поведінці)
// ════════════════════════════════════════════════════════════════

export async function signSession(payload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_COOKIE_MAX_AGE}s`)
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
  const match = cookieHeader.match(new RegExp(`${ADMIN_COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  return await verifySession(match[1]);
}

export function buildSessionCookie(token) {
  return [
    `${ADMIN_COOKIE_NAME}=${token}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${ADMIN_COOKIE_MAX_AGE}`,
  ].join('; ');
}

export function buildClearSessionCookie() {
  return `${ADMIN_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

// ════════════════════════════════════════════════════════════════
// SERVICE CENTER SESSION (NEW — Tier 1.5, 27.04.2026)
//
// Окрема cookie щоб admin і SC sessions не конфліктували.
// 24h max-age бо СЦ працює весь робочий день.
// ════════════════════════════════════════════════════════════════

export async function signSCSession(payload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${SC_COOKIE_MAX_AGE}s`)
    .sign(getSecret());
}

export async function verifySCSession(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    // Додаткова перевірка: SC sessions мають role='service_center'
    if (payload.role !== 'service_center') return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getSCSession(request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`${SC_COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  return await verifySCSession(match[1]);
}

export function buildSCSessionCookie(token) {
  return [
    `${SC_COOKIE_NAME}=${token}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${SC_COOKIE_MAX_AGE}`,
  ].join('; ');
}

export function buildClearSCSessionCookie() {
  return `${SC_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

// ── Exports ─────────────────────────────────────────────────────
export { ADMIN_COOKIE_NAME, SC_COOKIE_NAME };
