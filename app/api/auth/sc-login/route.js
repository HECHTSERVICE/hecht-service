/**
 * Hecht Service — SC Portal Login Endpoint (Tier 1.5, 27.04.2026)
 *
 * Окремий від admin login (/api/verify) flow для service center users.
 *
 * Flow:
 *   1. POST { username, password, turnstileToken }
 *   2. Turnstile CAPTCHA verify (server-side)
 *   3. Lookup user (case-insensitive ilike)
 *   4. bcrypt.compare password (always — навіть якщо user not found, для timing protection)
 *   5. Перевірити active=true і role='service_center'
 *   6. signSCSession({ role:'service_center', user_id, service_center_id, user_name })
 *   7. Set-Cookie hecht_sc_session (24h)
 *   8. Audit sc.login_success / sc.login_fail
 *   9. Response { success, service_center: { id, city, center_name } }
 *
 * Security:
 *   - Однакові error messages для wrong password / user not found / inactive (timing-safe)
 *   - bcrypt.compare виконується завжди (з dummy hash якщо user not found)
 *   - Rate limit: 5 спроб / 5 хв на IP (через middleware auth limiter)
 *   - Turnstile CAPTCHA блокує bots
 *   - password_hash НЕ повертається у response, НЕ логується у audit
 */

export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { signSCSession, buildSCSessionCookie } from '../../../../lib/auth';
import { createAdminClient } from '../../../../lib/supabase';
import { logAction, AUDIT_ACTIONS } from '../../../../lib/audit';

// Dummy bcrypt hash для timing-safe порівняння коли user не знайдений.
// Це НЕ робочий пароль — bcrypt.compare поверне false за тим самим часом ~80-100ms,
// як для реального hash, щоб не розкрити чи user існує у БД.
const DUMMY_HASH = '$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNO';

const GENERIC_AUTH_ERROR = 'Невірний логін або пароль';

/**
 * Перевірка Turnstile CAPTCHA на сервері.
 * Cloudflare verify endpoint: https://challenges.cloudflare.com/turnstile/v0/siteverify
 */
async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error('[sc-login] TURNSTILE_SECRET_KEY missing in env');
    return false;
  }
  if (!token) return false;

  try {
    const formData = new FormData();
    formData.append('secret', secret);
    formData.append('response', token);
    if (ip) formData.append('remoteip', ip);

    const res = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      { method: 'POST', body: formData }
    );

    if (!res.ok) {
      console.error('[sc-login] Turnstile API error:', res.status);
      return false;
    }
    const data = await res.json();
    return data.success === true;
  } catch (err) {
    console.error('[sc-login] Turnstile verify exception:', err);
    return false;
  }
}

/**
 * Helper: log fail attempt і повернути 401.
 * Не throw — fire-and-forget audit.
 */
async function failLogin({ request, attemptedUsername, reason }) {
  await logAction({
    userName: attemptedUsername || 'unknown',
    actionType: AUDIT_ACTIONS.SC_LOGIN_FAIL,
    warrantyId: null,
    oldValue: null,
    newValue: { reason },
    request,
  });
  return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
}

export async function POST(request) {
  // ── Parse body ───────────────────────────────────────────────
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const username = (body.username || '').trim();
  const password = body.password || '';
  const turnstileToken = body.turnstileToken || '';

  if (!username || !password) {
    return NextResponse.json(
      { error: 'Логін і пароль обовʼязкові' },
      { status: 400 }
    );
  }

  // ── Turnstile CAPTCHA ────────────────────────────────────────
  const xff = request.headers.get('x-forwarded-for');
  const clientIp = xff ? xff.split(',')[0].trim() : null;

  const captchaOk = await verifyTurnstile(turnstileToken, clientIp);
  if (!captchaOk) {
    return failLogin({
      request,
      attemptedUsername: username,
      reason: 'turnstile_failed',
    });
  }

  // ── Lookup user (case-insensitive) ───────────────────────────
  const db = createAdminClient();
  const { data: user, error: lookupErr } = await db
    .from('users')
    .select('id, username, password_hash, role, service_center_id, full_name, active')
    .ilike('username', username)
    .maybeSingle();

  if (lookupErr) {
    console.error('[sc-login] DB lookup error:', lookupErr);
    return NextResponse.json(
      { error: 'Помилка сервера' },
      { status: 500 }
    );
  }

  // ── Always run bcrypt.compare (timing protection) ────────────
  const hashToCompare = user?.password_hash || DUMMY_HASH;
  const passwordValid = await bcrypt.compare(password, hashToCompare);

  // ── Validation chain (single generic error для всіх failures) ─
  if (!user) {
    return failLogin({
      request,
      attemptedUsername: username,
      reason: 'user_not_found',
    });
  }
  if (user.role !== 'service_center') {
    return failLogin({
      request,
      attemptedUsername: user.username,
      reason: 'wrong_role',
    });
  }
  if (!user.active) {
    return failLogin({
      request,
      attemptedUsername: user.username,
      reason: 'user_inactive',
    });
  }
  if (!passwordValid) {
    return failLogin({
      request,
      attemptedUsername: user.username,
      reason: 'wrong_password',
    });
  }

  // ── Fetch service center info (для frontend UX) ──────────────
  const { data: sc } = await db
    .from('service_centers')
    .select('id, city, center_name')
    .eq('id', user.service_center_id)
    .maybeSingle();

  if (!sc) {
    // Edge case: user існує але SC видалений (race з delete-center)
    return failLogin({
      request,
      attemptedUsername: user.username,
      reason: 'service_center_missing',
    });
  }

  // ── Build JWT + Set-Cookie ───────────────────────────────────
  const sessionPayload = {
    role: 'service_center',
    user_id: user.id,
    service_center_id: user.service_center_id,
    user_name: user.username, // з БД, НЕ з input — захист від injection
  };

  const token = await signSCSession(sessionPayload);
  const cookie = buildSCSessionCookie(token);

  // ── Audit success ────────────────────────────────────────────
  await logAction({
    userName: user.username,
    actionType: AUDIT_ACTIONS.SC_LOGIN_SUCCESS,
    warrantyId: null,
    oldValue: null,
    newValue: {
      user_id: user.id,
      service_center_id: user.service_center_id,
      city: sc.city,
    },
    request,
  });

  // ── Response ─────────────────────────────────────────────────
  return new NextResponse(
    JSON.stringify({
      success: true,
      service_center: {
        id: sc.id,
        city: sc.city,
        center_name: sc.center_name,
      },
      user: {
        full_name: user.full_name,
        username: user.username,
      },
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': cookie,
      },
    }
  );
}
