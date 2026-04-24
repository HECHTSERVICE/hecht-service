import { createAdminClient } from '../supabase';

// Максимальна довжина коментаря — розумний ліміт щоб уникнути
// DOS через величезні записи у БД.
const MAX_MESSAGE_LENGTH = 2000;

/**
 * Повертає список коментарів по warranty_id у хронологічному порядку.
 * Використовується у адмінці (бачить усі) та пізніше у service-panel
 * (бачить тільки свої — перевірка буде у endpoint layer).
 *
 * @param {string|number} warrantyId
 * @returns {Promise<Array<object>>}
 */
export async function listComments(warrantyId) {
  if (!warrantyId) {
    throw new Error('[admin/comments] listComments: warrantyId is required');
  }

  const admin = createAdminClient();

  const { data, error } = await admin
    .from('comments')
    .select('*')
    .eq('warranty_id', warrantyId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[admin/comments] listComments error:', error);
    throw error;
  }

  return data || [];
}

/**
 * Створює новий коментар від імені адміна.
 *
 * ВАЖЛИВО: author_role завжди 'admin' — клієнт НЕ може передати
 * інше значення. Це захист від підробки коментарів під виглядом СЦ.
 *
 * author_name приймається як параметр — endpoint-layer витягує його
 * з JWT session cookie (getSession). Так готуємо ґрунт для майбутнього,
 * коли директор матиме свій акаунт з окремим імʼям.
 *
 * @param {string|number} warrantyId
 * @param {object} data
 * @param {string} data.message - текст коментаря
 * @param {string} data.authorName - імʼя адміна (з JWT session)
 * @returns {Promise<object>} створений коментар
 */
export async function createComment(warrantyId, data) {
  if (!warrantyId) {
    throw new Error('[admin/comments] createComment: warrantyId is required');
  }

  const message = typeof data?.message === 'string' ? data.message.trim() : '';
  if (!message) {
    throw new Error('[admin/comments] createComment: message is empty');
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    throw new Error(
      `[admin/comments] createComment: message too long (max ${MAX_MESSAGE_LENGTH})`
    );
  }

  const authorName = (data?.authorName || 'Hecht').trim().slice(0, 100);

  const payload = {
    warranty_id: warrantyId,
    author_name: authorName,
    author_role: 'admin', // жорстко — не приймається з клієнта
    message,
  };

  const admin = createAdminClient();

  const { data: created, error } = await admin
    .from('comments')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('[admin/comments] createComment insert error:', error);
    throw error;
  }

  return created;
}
