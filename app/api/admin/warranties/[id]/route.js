import { getSession } from '../../../../../lib/auth';
import { updateWarranty } from '../../../../../lib/admin/warranties';
import { logAction, AUDIT_ACTIONS } from '../../../../../lib/audit';
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
 * Tier 1.4 (Audit): після успішного UPDATE логує дії у action_log.
 * Якщо у одному PATCH міняються одночасно status і service_center_id —
 * пишеться 2 окремих записи (чистіше для audit UI).
 *
 * URL: /api/admin/warranties/42
 * Body: { status?: 'Нова'|'В роботі'|'Ремонт завершено'|'Видана',
 *         service_center_id?: number|null }
 *
 * Response 200: { success: true, before, after, updated }
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

    // ─── Tier 1.4: audit logging ──────────────────────────────────
    // Fire-and-forget — будь-яка помилка logAction поглинається всередині.
    // Розрізняємо status_change vs assign_sc/unassign_sc на основі того,
    // які саме поля змінились (result.after містить лише змінені).
    const userName = session.user_name || 'unknown';
    const before = result.before || {};
    const after = result.after || {};

    // Status change
    if ('status' in after) {
      await logAction({
        userName,
        actionType: AUDIT_ACTIONS.WARRANTY_STATUS_CHANGE,
        warrantyId: id,
        oldValue: { status: before.status ?? null },
        newValue: { status: after.status },
        request,
      });
    }

    // Service center assign / unassign — окремий запис
    if ('service_center_id' in after) {
      const newCenterId = after.service_center_id;
      const actionType =
        newCenterId === null || newCenterId === undefined
          ? AUDIT_ACTIONS.WARRANTY_UNASSIGN_SC
          : AUDIT_ACTIONS.WARRANTY_ASSIGN_SC;

      await logAction({
        userName,
        actionType,
        warrantyId: id,
        oldValue: { service_center_id: before.service_center_id ?? null },
        newValue: { service_center_id: newCenterId },
        request,
      });
    }

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
