/**
 * Hecht Service — SC Portal Logout Endpoint (Tier 1.5, 27.04.2026)
 *
 * POST /api/auth/sc-logout
 *   Очищує hecht_sc_session cookie + логує sc.logout у audit.
 *
 * Чому POST а не GET:
 *   - GET з audit має CSRF риск (можна викликати з image src)
 *   - POST вимагає JS fetch — захищає від accidental logout
 *
 * Поведінка:
 *   - Завжди повертає 200 (logout never fails з UX точки зору)
 *   - Якщо немає сесії — просто чистить cookie і повертає success
 *   - Audit пишемо ТІЛЬКИ якщо валідна сесія була (інакше 'unknown' user_name засмічує лог)
 */

export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getSCSession, buildClearSCSessionCookie } from '../../../../lib/auth';
import { logAction, AUDIT_ACTIONS } from '../../../../lib/audit';

export async function POST(request) {
  // Спробуємо отримати сесію — для аудиту хто вийшов
  const session = await getSCSession(request);

  // Audit тільки якщо була валідна сесія
  if (session && session.role === 'service_center') {
    await logAction({
      userName: session.user_name || 'unknown',
      actionType: AUDIT_ACTIONS.SC_LOGOUT,
      warrantyId: null,
      oldValue: null,
      newValue: {
        user_id: session.user_id,
        service_center_id: session.service_center_id,
      },
      request,
    });
  }

  // Очищуємо cookie у будь-якому випадку
  const clearCookie = buildClearSCSessionCookie();

  return new NextResponse(
    JSON.stringify({ success: true }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': clearCookie,
      },
    }
  );
}
