import { getSession } from '../../../../../lib/auth';
import { updateWarranty } from '../../../../../lib/admin/warranties';

export const runtime = 'nodejs';

/**
 * PATCH /api/admin/warranties/[id]
 *
 * Оновлює поля конкретної гарантії. Приймає ТІЛЬКИ whitelisted поля
 * (status, service_center_id) — захист реалізований у lib/admin/warranties.js
 * на рівні helper-а.
 *
 * Замінює прямі supabase UPDATE виклики з app/admin/page.js:
 *   - updateStatus(id, status) → PATCH { status }
 *   - assignCenter(id, centerId) → PATCH { service_center_id }
 *
 * Auth: JWT cookie hecht_admin_session з role='admin'.
 *
 * URL: /api/admin/warranties/42
 * Body: { status?: 'Нова'|'В роботі'|'Ремонт завершено'|'Видана',
 *         service_center_id?: number|null }
 *
 * Response 200: { success: true, updated: {...} }
 * Response 400: { error } — нема валідних полів або неправильний status
 * Response 401: { error: 'Unauthorized' }
 * Response 500: { error }
 */
export async function PATCH(request, { params }) {
  // Session guard
  const session = await getSession(request);
  if (!session || session.role !== 'admin') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return Response.json({ error: 'Missing warranty id' }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const result = await updateWarranty(id, body);
    return Response.json(result);
  } catch (err) {
    console.error('[api/admin/warranties PATCH] error:', err);

    // Розрізняємо validation errors від server errors
    const msg = err?.message || '';
    if (
      msg.includes('no valid fields') ||
      msg.includes('invalid status')
    ) {
      return Response.json({ error: msg }, { status: 400 });
    }

    return Response.json(
      { error: 'Помилка оновлення гарантії' },
      { status: 500 }
    );
  }
}
