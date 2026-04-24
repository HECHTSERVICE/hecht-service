import { createAdminClient } from './supabase';

/**
 * Генерує унікальний номер сертифікату.
 * Формат: HS-YYYYMMDDHHmmss (14 цифр часу)
 *
 * Викликається server-side у /api/warranty/register.
 * Раніше жив на клієнті в app/page.js — перенесено задля безпеки
 * (клієнт не має генерувати номера — це задача серверу).
 *
 * @returns {string} напр. "HS-20260424114201"
 */
export function generateCertNumber() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    'HS-' +
    now.getFullYear() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds())
  );
}

/**
 * Перевіряє чи вже зареєстрована гарантія з таким серійним номером.
 * Використовує Service Role → працює і після enable RLS.
 *
 * @param {string} serialNumber - серійник (приводиться до UPPERCASE.trim)
 * @returns {Promise<boolean>} true = вже існує
 */
export async function checkDuplicate(serialNumber) {
  const admin = createAdminClient();
  const sn = serialNumber.toUpperCase().trim();

  const { data, error } = await admin
    .from('warranty_registrations')
    .select('id')
    .eq('serial_number', sn)
    .limit(1);

  if (error) {
    console.error('[warranty] checkDuplicate error:', error);
    throw error;
  }

  return Array.isArray(data) && data.length > 0;
}

/**
 * Створює новий запис гарантії у БД.
 * Cert number генерується всередині функції (не приймається з клієнта).
 *
 * @param {object} data - поля форми
 * @param {string} data.firstName
 * @param {string} data.lastName
 * @param {string} data.phone
 * @param {string} data.email
 * @param {string} data.serialNumber
 * @param {string} data.model
 * @param {string} data.purchaseDate - ISO date string (YYYY-MM-DD)
 * @returns {Promise<{ certNumber: string }>}
 */
export async function createWarranty(data) {
  const admin = createAdminClient();
  const certNumber = generateCertNumber();

  const payload = {
    cert_number: certNumber,
    first_name: data.firstName.trim(),
    last_name: data.lastName.trim(),
    phone: data.phone.trim(),
    email: data.email.trim(),
    serial_number: data.serialNumber.toUpperCase().trim(),
    model: data.model.trim(),
    purchase_date: data.purchaseDate,
    status: 'Нова',
  };

  const { error } = await admin
    .from('warranty_registrations')
    .insert(payload);

  if (error) {
    console.error('[warranty] createWarranty insert error:', error);
    throw error;
  }

  return { certNumber };
}
