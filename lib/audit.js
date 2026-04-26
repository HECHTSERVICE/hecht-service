/**
 * Hecht Service — Audit Log helper
 *
 * Fire-and-forget логування admin/SC mutations у public.action_log.
 * НІКОЛИ не throw — якщо логування падає, основна операція має продовжитись.
 *
 * Запис іде через Service Role Key (bypass RLS).
 * Admin читає action_log через окремий endpoint /api/admin/audit (Tier 1.4 step 7).
 *
 * Usage:
 *   import { logAction, AUDIT_ACTIONS } from '../../../../lib/audit';
 *
 *   await logAction({
 *     userName: session.user_name,
 *     actionType: AUDIT_ACTIONS.WARRANTY_STATUS_CHANGE,
 *     warrantyId: 42,
 *     oldValue: { status: 'Нова' },
 *     newValue: { status: 'В роботі' },
 *     request,
 *   });
 */

import { createAdminClient } from './supabase';

/**
 * Централізований словник action types.
 * Префікс позначає область:
 *   warranty.* — операції з гарантіями
 *   sc.*       — сервіс-центри та їхні users
 *   auth.*     — auth events
 */
export const AUDIT_ACTIONS = {
  // Warranties
  WARRANTY_STATUS_CHANGE: 'warranty.status_change',
  WARRANTY_ASSIGN_SC: 'warranty.assign_sc',
  WARRANTY_UNASSIGN_SC: 'warranty.unassign_sc',
  WARRANTY_COMMENT_ADD: 'warranty.comment_add',

  // Service centers
  SC_CREATE: 'sc.create',
  SC_DELETE: 'sc.delete',
  SC_USER_CREATE: 'sc.user_create',
  SC_USER_DELETE: 'sc.user_delete',

  // Auth
  AUTH_LOGIN_SUCCESS: 'auth.login_success',
  AUTH_LOGIN_FAIL: 'auth.login_fail',
  AUTH_2FA_SUCCESS: 'auth.2fa_success',
  AUTH_2FA_FAIL: 'auth.2fa_fail',
  AUTH_LOGOUT: 'auth.logout',

  // Auth — TOTP (Tier 2.1, 25.04.2026)
  AUTH_TOTP_SUCCESS: 'auth.totp_success',
  AUTH_TOTP_FAIL: 'auth.totp_fail',
  AUTH_RECOVERY_USED: 'auth.recovery_used',

  // Service Center portal (Tier 1.5, 27.04.2026)
  SC_LOGIN_SUCCESS: 'sc.login_success',
  SC_LOGIN_FAIL: 'sc.login_fail',
  SC_LOGOUT: 'sc.logout',
  SC_STATUS_CHANGE: 'sc.status_change',
  SC_COMMENT_ADD: 'sc.comment_add',
};

/**
 * Витягує client IP з headers.
 * Vercel передає x-forwarded-for (може бути comma-separated list).
 * Беремо перший IP — це реальний клієнт.
 */
export function getClientIp(request) {
  if (!request || !request.headers) return null;

  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0].trim();
    return first || null;
  }

  const xri = request.headers.get('x-real-ip');
  if (xri) return xri.trim() || null;

  return null;
}

/**
 * Серіалізує value у text для old_value / new_value.
 * Об'єкти → JSON. Примітиви → String. null/undefined → null.
 */
function serializeValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

/**
 * Логує дію у action_log.
 *
 * Fire-and-forget: будь-яка помилка ловиться у try/catch і йде у console.error.
 * Основна операція (mutation) ніколи не падає через audit log.
 *
 * @param {object} params
 * @param {string} params.userName - хто зробив (session.user_name з JWT, fallback 'unknown')
 * @param {string} params.actionType - один з AUDIT_ACTIONS
 * @param {string|number|null} [params.warrantyId] - якщо стосується warranty
 * @param {*} [params.oldValue] - стан до (серіалізується)
 * @param {*} [params.newValue] - стан після (серіалізується)
 * @param {Request} [params.request] - для IP extraction
 * @param {string} [params.ipAddress] - explicit IP (override)
 */
export async function logAction({
  userName,
  actionType,
  warrantyId = null,
  oldValue = null,
  newValue = null,
  request = null,
  ipAddress = null,
}) {
  try {
    if (!actionType) {
      console.error('[audit] logAction: actionType is required');
      return;
    }

    const ip = ipAddress || getClientIp(request);

    const admin = createAdminClient();
    const { error } = await admin.from('action_log').insert({
      user_name: userName || 'unknown',
      action_type: actionType,
      warranty_id: warrantyId,
      old_value: serializeValue(oldValue),
      new_value: serializeValue(newValue),
      ip_address: ip,
    });

    if (error) {
      console.error('[audit] logAction insert error:', error);
    }
  } catch (err) {
    // Поглинаємо будь-яку помилку — логування НЕ повинно ламати UX
    console.error('[audit] logAction unexpected error:', err);
  }
}
