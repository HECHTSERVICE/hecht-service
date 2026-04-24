import { getSession } from '../../../../lib/auth';
import { listWarranties } from '../../../../lib/admin/warranties';

// Node.js runtime — потрібен для Supabase Service Role (sdk через @supabase/supabase-js)
export const runtime = 'nodejs';

/**
 * GET /api/admin/warranties
 *
 * Повертає список усіх гарантій з JOIN на service_centers,
 * кількістю коментарів, та pre-calculated metrics.
 *
 * Замінює прямий supabase.from() виклик з app/admin/page.js (loadData).
 *
 * Auth: потребує JWT cookie hecht_admin_session з role='admin'.
 *
 * Response 200:
 * {
 *   warranties: [
 *     {
 *       id, cert_number, first_name, last_name, phone, email,
 *       model, serial_number, status, service_center_id,
 *       registration_date, last_updated,
 *       service_centers: { city, center_name } | null,
 *       comment_list: [...],
 *       comment_count: number
 *     }
 *   ],
 *   metrics: { total, nova, work, done }
 * }
 *
 * Response 401: { error: 'Unauthorized' } — немає session або не admin
 * Response 500: { error: '...' } — DB error
 */
export async function GET(request) {
  // Session guard — defense in depth поверх middleware
  const session = await getSession(request);
  if (!session || session.role !== 'admin') {
    return Response.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const result = await listWarranties();
    return Response.json(result);
  } catch (err) {
    console.error('[api/admin/warranties GET] error:', err);
    return Response.json(
      { error: 'Помилка завантаження гарантій' },
      { status: 500 }
    );
  }
}
