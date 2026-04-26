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
 * Безпека:
 *   - Service Role bypass RLS, але WHERE service_center_id робить ту саму ізоляцію вручну
 *   - Жодне поле з password_hash не повертається (warranties table його і так не має)
 *   - GET, не logAction (читання не аудитується для SC)
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
  let query = db
    .from('warranty_registrations')
    .select(
      'id, first_name, last_name, phone, email, model, serial_number, ' +
        'purchase_date, status, service_center_id, created_at, updated_at',
      { count: 'exact' }
    )
    .eq('service_center_id', session.service_center_id);

  // Опціональний фільтр по status
  if (status) {
    query = query.eq('status', status);
  }

  // Опціональний search по серійнику АБО прізвищу
  if (search) {
    // PostgREST or() syntax: умови через коми, кожна — окремий filter
    query = query.or(
      `serial_number.ilike.%${search}%,last_name.ilike.%${search}%`
    );
  }

  // Сортуємо: найновіші зверху
  query = query.order('created_at', { ascending: false });

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

  return NextResponse.json({
    warranties: data || [],
    total: count || 0,
    limit,
    offset,
  });
}
