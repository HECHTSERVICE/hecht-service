import { createAdminClient } from '../supabase';

// Whitelist — які поля клієнт може оновлювати через PATCH.
// Будь-які інші поля у body ігноруються (injection захист).
const ALLOWED_UPDATE_FIELDS = ['status', 'service_center_id'];

// Валідні статуси гарантії (має співпадати з option value у admin UI).
const VALID_STATUSES = ['Нова', 'В роботі', 'Ремонт завершено', 'Видана'];

/**
 * Повертає список всіх гарантій з JOIN на service_centers,
 * кількістю коментарів, та pre-calculated metrics.
 *
 * Викликається з GET /api/admin/warranties.
 *
 * @returns {Promise<{
 *   warranties: Array<object>,
 *   metrics: { total: number, nova: number, work: number, done: number }
 * }>}
 */
export async function listWarranties() {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('warranty_registrations')
    .select('*, service_centers(city, center_name), comment_list:comments(id)')
    .order('registration_date', { ascending: false });

  if (error) {
    console.error('[admin/warranties] listWarranties error:', error);
    throw error;
  }

  // Додаємо comment_count як окреме поле — клієнту так простіше
  const warranties = (data || []).map((r) => ({
    ...r,
    comment_count: Array.isArray(r.comment_list) ? r.comment_list.length : 0,
  }));

  // Рахуємо метрики один раз на сервері замість 4 filter() на клієнті
  const metrics = {
    total: warranties.length,
    nova: warranties.filter((r) => r.status === 'Нова').length,
    work: warranties.filter((r) => r.status === 'В роботі').length,
    done: warranties.filter(
      (r) => r.status === 'Видана' || r.status === 'Ремонт завершено'
    ).length,
  };

  return { warranties, metrics };
}

/**
 * Оновлює поля гарантії. Приймає ТІЛЬКИ whitelisted поля
 * (status, service_center_id). Інші поля з body ігноруються.
 *
 * Викликається з PATCH /api/admin/warranties/[id].
 *
 * Tier 1.4 (Audit Log): робить SELECT перед UPDATE щоб повернути before-стан.
 * Це дозволяє API route логувати "що було → що стало" у action_log.
 *
 * @param {string|number} id - warranty id
 * @param {object} patch - { status?, service_center_id? }
 * @returns {Promise<{
 *   success: true,
 *   before: { status, service_center_id },  // тільки змінені поля
 *   after:  { status, service_center_id },  // тільки змінені поля
 *   updated: object                          // повний об'єкт після UPDATE (backward compat)
 * }>}
 */
export async function updateWarranty(id, patch) {
  if (!id) {
    throw new Error('[admin/warranties] updateWarranty: id is required');
  }

  // Фільтруємо body — тільки whitelisted поля
  const safePatch = {};
  for (const field of ALLOWED_UPDATE_FIELDS) {
    if (field in patch) {
      safePatch[field] = patch[field];
    }
  }

  if (Object.keys(safePatch).length === 0) {
    throw new Error('[admin/warranties] updateWarranty: no valid fields to update');
  }

  // Валідація status
  if ('status' in safePatch && !VALID_STATUSES.includes(safePatch.status)) {
    throw new Error(
      `[admin/warranties] updateWarranty: invalid status "${safePatch.status}"`
    );
  }

  // Нормалізація service_center_id — пустий рядок → null
  if ('service_center_id' in safePatch) {
    const v = safePatch.service_center_id;
    safePatch.service_center_id = v === '' || v === undefined ? null : v;
  }

  const admin = createAdminClient();

  // ─── Tier 1.4: SELECT before-стан для audit log ─────────────────
  // Беремо тільки ті поля які зараз змінюються — economy.
  const fieldsForBefore = Object.keys(safePatch).join(', ');
  const { data: beforeRow, error: beforeError } = await admin
    .from('warranty_registrations')
    .select(fieldsForBefore)
    .eq('id', id)
    .single();

  if (beforeError) {
    console.error('[admin/warranties] updateWarranty before-select error:', beforeError);
    throw beforeError;
  }

  // Сервер виставляє timestamp автоматично — додаємо ПІСЛЯ before-select
  // (last_updated не потрапляє у before/after, це службове поле)
  safePatch.last_updated = new Date().toISOString();

  // ─── Власне UPDATE ──────────────────────────────────────────────
  const { data, error } = await admin
    .from('warranty_registrations')
    .update(safePatch)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[admin/warranties] updateWarranty error:', error);
    throw error;
  }

  // ─── Формуємо before/after для audit log ────────────────────────
  // before — стан з SELECT (без last_updated)
  // after  — тільки ті поля що змінились (без last_updated)
  const after = {};
  for (const field of Object.keys(safePatch)) {
    if (field === 'last_updated') continue;
    after[field] = safePatch[field];
  }

  return {
    success: true,
    before: beforeRow,
    after,
    updated: data, // backward compat — повний об'єкт
  };
}
