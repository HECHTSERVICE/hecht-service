/**
 * Hecht Service — SC Portal Warranty Update (Tier 1.5, 27.04.2026)
 *
 * PATCH /api/sc/warranties/[id]
 *   Дозволяє СЦ-користувачу змінити status своєї гарантії.
 *
 * Auth guard:
 *   getSCSession() → role='service_center' з payload
 *   Якщо немає або інша роль → 401
 *
 * Ownership check (КРИТИЧНО):
 *   SELECT WHERE id=? AND service_center_id=session.service_center_id
 *   Якщо не знайдено → 404 (СЦ НЕ повинен дізнатись що така гарантія існує)
 *   Захист "тільки свої гарантії" на рівні API, не RLS.
 *
 * Whitelist полів:
 *   Тільки 'status' (НЕ service_center_id — переприсвоєння тільки admin)
 *   Все інше у body ігнорується.
 *
 * Reuse:
 *   Викликає той самий updateWarranty() helper що і admin PATCH —
 *   валідація статусу, before/after, нормалізація узгоджені.
 *
 * Audit:
 *   action_type = 'sc.status_change' (відрізняється від admin warranty.status_change)
 *   user_name з SC session (логін), warranty_id, before/after
 *
 * Body: { status: 'Нова'|'В роботі'|'Ремонт завершено'|'Видана' }
 *
 * Response 200: { success, before, after, updated }
 * Response 400: { error } — нема status або invalid status
 * Response 401: { error: 'Unauthorized' }
 * Response 404: { error: 'Not found' } — гарантія не існує АБО не належить СЦ
 * Response 500: { error }
 */

export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getSCSession } from '../../../../../lib/auth';
import { createAdminClient } from '../../../../../lib/supabase';
import { updateWarranty } from '../../../../../lib/admin/warranties';
import { logAction, AUDIT_ACTIONS } from '../../../../../lib/audit';

async function requireSC(request) {
  const session = await getSCSession(request);
  if (!session || session.role !== 'service_center') {
    return {
      unauthorized: NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      ),
    };
  }
  if (!session.service_center_id) {
    return {
      unauthorized: NextResponse.json(
        { error: 'Session is missing service_center_id' },
        { status: 401 }
      ),
    };
  }
  return { session };
}

export async function PATCH(request, { params }) {
  // ── Auth guard ────────────────────────────────────────────────
  const { unauthorized, session } = await requireSC(request);
  if (unauthorized) return unauthorized;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Missing warranty id' }, { status: 400 });
  }

  // ── Parse body ────────────────────────────────────────────────
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // ── SC may only change status (not service_center_id) ─────────
  // Будь-які інші поля у body — ігноруємо мовчки.
  if (!('status' in body)) {
    return NextResponse.json(
      { error: 'Поле status обовʼязкове' },
      { status: 400 }
    );
  }
  const safeBody = { status: body.status };

  // ── Ownership check: гарантія належить ЦЬОМУ СЦ? ──────────────
  // Робимо SELECT з фільтром по service_center_id. Якщо не знайдено —
  // повертаємо 404 (НЕ 403), щоб СЦ не дізнався що така гарантія існує
  // у іншого СЦ. Це security best practice (information disclosure).
  const db = createAdminClient();
  const { data: ownership, error: ownershipErr } = await db
    .from('warranty_registrations')
    .select('id')
    .eq('id', id)
    .eq('service_center_id', session.service_center_id)
    .maybeSingle();

  if (ownershipErr) {
    console.error('[sc/warranties PATCH] ownership check error:', ownershipErr);
    return NextResponse.json({ error: 'Помилка сервера' }, { status: 500 });
  }
  if (!ownership) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // ── Update через shared helper ────────────────────────────────
  // updateWarranty виконує: whitelist + status validation + before/after.
  // Reuse того самого helper що admin endpoint — узгодженість гарантована.
  let result;
  try {
    result = await updateWarranty(id, safeBody);
  } catch (err) {
    console.error('[sc/warranties PATCH] updateWarranty error:', err);
    const msg = err?.message || '';
    if (msg.includes('no valid fields') || msg.includes('invalid status')) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Помилка оновлення гарантії' },
      { status: 500 }
    );
  }

  // ── Audit (fire-and-forget) ───────────────────────────────────
  // SC_STATUS_CHANGE відрізняється від admin WARRANTY_STATUS_CHANGE,
  // щоб у audit log було видно хто змінив — admin чи СЦ.
  const before = result.before || {};
  const after = result.after || {};
  if ('status' in after) {
    await logAction({
      userName: session.user_name || 'unknown',
      actionType: AUDIT_ACTIONS.SC_STATUS_CHANGE,
      warrantyId: id,
      oldValue: { status: before.status ?? null },
      newValue: { status: after.status },
      request,
    });
  }

  return NextResponse.json(result);
}
