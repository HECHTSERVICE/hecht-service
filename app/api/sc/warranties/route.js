/**
 * Hecht Service — SC Portal API: Warranties List (Tier 1.5, 27.04.2026)
 *
 * GET /api/sc/warranties
 *   Повертає список warranties прив'язаних до SC user сесії.
 *   Server-side фільтр: WHERE service_center_id = session.service_center_id
 *   SC бачить ТІЛЬКИ свої warranties — захист на рівні API, не RLS.
 *
 * Auth guard:
 *   getSCSession() → role='service_center' з payload
 *   Якщо немає або інша роль → 401
 *
 * Query params (опціонально):
 *   ?status=Нова       — фільтр по статусу
 *   ?search=...        — пошук по серійнику або прізвищу клієнта (ilike)
 *   ?limit=50          — pagination, default 100, max 200
 *   ?offset=0          — pagination
 *
 * Response:
 *   { warranties: [...], total: N }
 *
 * Кожна warranty містить:
 *   - id, cert_number — для UI display
 *   - first_name, last_name, phone, email — клієнт
 *   - model, serial_number, purchase_date — техніка
 *   - status — статус ремонту
 *   - registration_date — дата реєстрації (для сортування + UI)
 *   - service_center_id, last_updated — meta
 *   - comment_count — обчислюється з JOIN на comments
 *
 * Безпека:
 *   - Service Role bypass RLS, але WHERE service_center_id робить ту саму ізоляцію вручну
 *   - GET, не logAction (читання не аудитується для SC)
 *
 * History:
 *   27.04.2026 — fix: видалено created_at/updated_at з select
 *                (помилка 42703 — колонок не існує у warranty_registrations)
 */

export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getSCSession } from '../../../../lib/auth';
import { createAdminClient } from '../../../../lib/supabase';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

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

export async function GET(request) {
  const { unauthorized, session } = await requireSC(request);
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const status = (url.searchParams.get('status') || '').trim();
  const search = (url.searchParams.get('search') || '').trim();

  let limit = parseInt(url.searchParams.get('limit'), 10);
  if (!Number.isFinite(limit) || limit <= 0) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  let offset = parseInt(url.searchParams.get('offset'), 10);
  if (!Number.isFinite(offset) || offset < 0) offset = 0;

  const db = createAdminClient();

  // Базовий запит: WHERE service_center_id = session.service_center_id
  // JOIN на comments для comment_count (легка nested query)
  let query = db
    .from('warranty_registrations')
    .select(
      'id, cert_number, first_name, last_name, phone, email, ' +
        'model, serial_number, purchase_date, status, ' +
        'registration_date, service_center_id, last_updated, ' +
        'comment_list:comments(id)',
      { count: 'exact' }
    )
    .eq('service_center_id', session.service_center_id);

  // Опціональний фільтр по status
  if (status) {
    query = query.eq('status', status);
  }

  // Опціональний search по серійнику АБО прізвищу
  if (search) {
    query = query.or(
      `serial_number.ilike.%${search}%,last_name.ilike.%${search}%`
    );
  }

  // Сортуємо: найновіші зверху (registration_date — як у legacy UI)
  query = query.order('registration_date', { ascending: false });

  // Pagination через range (start, end inclusive)
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('[sc/warranties GET] DB error:', error);
    return NextResponse.json(
      { error: 'Помилка завантаження' },
      { status: 500 }
    );
  }

  // Розгортаємо comment_count з JOIN — UI отримує готове число замість масиву
  const warranties = (data || []).map((r) => ({
    ...r,
    comment_count: Array.isArray(r.comment_list) ? r.comment_list.length : 0,
    comment_list: undefined, // прибираємо raw join з response
  }));

  return NextResponse.json({
    warranties,
    total: count || 0,
    limit,
    offset,
  });
}
