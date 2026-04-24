import { createAdminClient } from '../supabase';

/**
 * Повертає список усіх сервісних центрів, відсортований за містом.
 * Використовується:
 *   - у admin/page.js для dropdown призначення СЦ на гарантію
 *   - у admin/service-centers/page.js для повного списку (через B.2)
 *
 * Повний CRUD (create, update, delete) буде доданий у Блоку B.2
 * коли будемо рефакторити /admin/service-centers сторінку.
 *
 * @returns {Promise<Array<object>>} список service_centers
 */
export async function listCenters() {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('service_centers')
    .select('*')
    .order('city');

  if (error) {
    console.error('[admin/service-centers] listCenters error:', error);
    throw error;
  }

  return data || [];
}
