/**
 * Hecht Service — SC Portal Comments (Tier 1.5, 27.04.2026)
 *
 * GET  /api/sc/warranties/[id]/comments → list comments
 * POST /api/sc/warranties/[id]/comments → create comment from SC
 *
 * Auth guard:
 *   getSCSession() → role='service_center' з payload
 *   Якщо немає або інша роль → 401
 *
 * Ownership check (КРИТИЧНО):
 *   SELECT WHERE id=? AND service_center_id=session.service_center_id
 *   Якщо не знайдено → 404 (СЦ НЕ повинен бачити коментарі чужих гарантій)
 *   Захист "тільки свої гарантії" на рівні API.
 *
 * GET reuse:
 *   listComments() з lib/admin/comments — та сама логіка читання.
 *
 * POST architecture:
 *   createComment() з lib/admin/comments хардкодить author_role='admin' —
 *   тому для SC INSERT робимо напряму з createAdminClient().
 *   author_role='service_center' → UI малює коментар у блакитному стилі.
 *   author_name='Сервіс — {center_name}' — сумісність з legacy UI.
 *
 * Audit (POST):
 *   action_type = 'sc.comment_add' (відрізняється від admin warranty.comment_add)
 *   user_name з SC session, warranty_id, message+comment_id у new_value
 */

export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getSCSession } from '../../../../../../lib/auth';
import { createAdminClient } from '../../../../../../lib/supabase';
import { listComments } from '../../../../../../lib/admin/comments';
import { logAction, AUDIT_ACTIONS } from '../../../../../../lib/audit';

const MAX_MESSAGE_LENGTH = 2000;

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

/**
 * Перевіряє чи warranty належить SC з сесії.
 * Повертає { ok: true, sc: {...} } або { notFound: NextResponse }.
 * Підвантажуємо service_center_name для author_name у POST.
 */
async function verifyOwnership(warrantyId, session, db) {
  const { data, error } = await db
    .from('warranty_registrations')
    .select('id, service_centers(center_name, city)')
    .eq('id', warrantyId)
    .eq('service_center_id', session.service_center_id)
    .maybeSingle();

  if (error) {
    console.error('[sc/warranties/comments] ownership check error:', error);
    return {
      notFound: NextResponse.json({ error: 'Помилка сервера' }, { status: 500 }),
    };
  }
  if (!data) {
    return { notFound: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }
  return { ok: true, sc: data.service_centers };
}

// ─── GET ─────────────────────────────────────────────────────────
export async function GET(request, { params }) {
  const { unauthorized, session } = await requireSC(request);
  if (unauthorized) return unauthorized;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Missing warranty id' }, { status: 400 });
  }

  const db = createAdminClient();
  const { notFound } = await verifyOwnership(id, session, db);
  if (notFound) return notFound;

  try {
    const comments = await listComments(id);
    return NextResponse.json({ comments });
  } catch (err) {
    console.error('[sc/warranties/comments GET] error:', err);
    return NextResponse.json(
      { error: 'Помилка завантаження коментарів' },
      { status: 500 }
    );
  }
}

// ─── POST ────────────────────────────────────────────────────────
export async function POST(request, { params }) {
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

  const message =
    typeof body?.message === 'string' ? body.message.trim() : '';
  if (!message) {
    return NextResponse.json(
      { error: 'Повідомлення не може бути порожнім' },
      { status: 400 }
    );
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Повідомлення занадто довге (макс ${MAX_MESSAGE_LENGTH} символів)` },
      { status: 400 }
    );
  }

  // ── Ownership check + fetch SC name для author_name ──────────
  const db = createAdminClient();
  const ownershipResult = await verifyOwnership(id, session, db);
  if (ownershipResult.notFound) return ownershipResult.notFound;

  const centerName = ownershipResult.sc?.center_name || 'СЦ';
  const authorName = ('Сервіс — ' + centerName).slice(0, 100);

  // ── INSERT comment напряму ───────────────────────────────────
  // НЕ використовуємо createComment() helper бо він хардкодить
  // author_role='admin'. Для SC коментарів треба 'service_center'
  // щоб UI малював у блакитному стилі.
  const { data: created, error } = await db
    .from('comments')
    .insert({
      warranty_id: id,
      author_name: authorName,
      author_role: 'service_center',
      message,
    })
    .select()
    .single();

  if (error) {
    console.error('[sc/warranties/comments POST] insert error:', error);
    return NextResponse.json(
      { error: 'Помилка створення коментаря' },
      { status: 500 }
    );
  }

  // ── Audit (fire-and-forget) ──────────────────────────────────
  await logAction({
    userName: session.user_name || 'unknown',
    actionType: AUDIT_ACTIONS.SC_COMMENT_ADD,
    warrantyId: id,
    oldValue: null,
    newValue: { message: created.message, comment_id: created.id },
    request,
  });

  return NextResponse.json({ comment: created });
}
