/**
 * Hecht Service — SC Portal Session Probe (Tier 1.5, 27.04.2026)
 *
 * GET /api/sc/session
 *   Повертає інфо про залогіненого SC user якщо hecht_sc_session cookie валідна.
 *   Використовується frontend-ом при mount /admin/service-panel —
 *   щоб відновити state після reload (HttpOnly cookie не доступна з JS).
 *
 * Auth guard:
 *   getSCSession() → role='service_center' з payload
 *   Якщо немає або інша роль → 401
 *
 * Response 200:
 *   {
 *     user: { username, user_id },
 *     service_center: { id, city, center_name }
 *   }
 *
 * Response 401:
 *   { error: 'Unauthorized' } — frontend показує login form
 *
 * Безпека:
 *   - НІЧОГО з password_hash не повертається
 *   - service_center fetch робимо щоб дати UI відобразити city/center_name у Navbar
 *   - Read-only — НЕ логується у audit (читання сесії не критична подія)
 */

export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getSCSession } from '../../../../lib/auth';
import { createAdminClient } from '../../../../lib/supabase';

export async function GET(request) {
  const session = await getSCSession(request);
  if (!session || session.role !== 'service_center') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!session.service_center_id) {
    return NextResponse.json(
      { error: 'Session is missing service_center_id' },
      { status: 401 }
    );
  }

  // Підвантажуємо актуальну інфу про SC (раптом адмін перейменував)
  const db = createAdminClient();
  const { data: sc, error } = await db
    .from('service_centers')
    .select('id, city, center_name')
    .eq('id', session.service_center_id)
    .maybeSingle();

  if (error) {
    console.error('[sc/session GET] DB error:', error);
    return NextResponse.json({ error: 'Помилка сервера' }, { status: 500 });
  }
  if (!sc) {
    // Edge case: SC видалений admin-ом поки користувач був залогінений
    return NextResponse.json({ error: 'Service center not found' }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      username: session.user_name,
      user_id: session.user_id,
    },
    service_center: {
      id: sc.id,
      city: sc.city,
      center_name: sc.center_name,
    },
  });
}
