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
 * @param {string|number} id - warranty id
 * @param {object} patch - { status?, service_center_id? }
 * @returns {Promise<{ success: true, updated: object }>}
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

  // Сервер виставляє timestamp автоматично
  safePatch.last_updated = new Date().toISOString();

  const admin = createAdminClient();

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

  return { success: true, updated: data };
}
