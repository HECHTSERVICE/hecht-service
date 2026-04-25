import { createAdminClient } from '../supabase';

// Сторінкові ліміти — захист від overload
const MAX_PER_PAGE = 100;
const DEFAULT_PER_PAGE = 50;

// Stats — за скільки днів максимум агрегуємо
const MAX_STATS_DAYS = 90;

/**
 * Повертає список записів action_log з фільтрами та pagination.
 *
 * Фільтри:
 *   - action_type:  exact match або prefix (warranty.* / sc.* / auth.*)
 *   - user_name:    'ihor' | 'director' | 'unknown' | null = всі
 *   - warranty_id:  number | null = всі
 *   - days:         за останні N днів (1, 7, 30, 90, 0=всі)
 *
 * @param {object} options
 * @param {object} [options.filters]
 * @param {number} [options.page=1]
 * @param {number} [options.perPage=50]
 * @returns {Promise<{ rows: object[], total: number, page: number, perPage: number }>}
 */
export async function listActions({ filters = {}, page = 1, perPage = DEFAULT_PER_PAGE } = {}) {
  const safePerPage = Math.min(Math.max(parseInt(perPage) || DEFAULT_PER_PAGE, 1), MAX_PER_PAGE);
  const safePage = Math.max(parseInt(page) || 1, 1);
  const from = (safePage - 1) * safePerPage;
  const to = from + safePerPage - 1;

  const admin = createAdminClient();
  let query = admin
    .from('action_log')
    .select('*', { count: 'exact' });

  // Filter: action_type (exact або prefix через wildcard)
  if (filters.action_type) {
    const at = String(filters.action_type);
    if (at.endsWith('.*')) {
      // Prefix match: 'warranty.*' → LIKE 'warranty.%'
      const prefix = at.slice(0, -1) + '%';
      query = query.like('action_type', prefix);
    } else {
      query = query.eq('action_type', at);
    }
  }

  // Filter: user_name
  if (filters.user_name) {
    query = query.eq('user_name', String(filters.user_name));
  }

  // Filter: warranty_id
  if (filters.warranty_id !== undefined && filters.warranty_id !== null && filters.warranty_id !== '') {
    const wid = parseInt(filters.warranty_id);
    if (!Number.isNaN(wid)) {
      query = query.eq('warranty_id', wid);
    }
  }

  // Filter: days back
  if (filters.days && parseInt(filters.days) > 0) {
    const since = new Date(Date.now() - parseInt(filters.days) * 24 * 60 * 60 * 1000);
    query = query.gte('created_at', since.toISOString());
  }

  // Ordering + pagination
  query = query.order('created_at', { ascending: false }).range(from, to);

  const { data, error, count } = await query;
  if (error) {
    console.error('[admin/audit] listActions error:', error);
    throw error;
  }

  return {
    rows: data || [],
    total: count || 0,
    page: safePage,
    perPage: safePerPage,
  };
}

/**
 * Повертає агреговані метрики для графіку та зведення.
 *
 * @param {object} options
 * @param {number} [options.days=7] - за скільки днів агрегувати (max 90)
 * @returns {Promise<{
 *   totalCount: number,
 *   byActionType: { action_type: string, count: number }[],
 *   byUser: { user_name: string, count: number }[],
 *   byDay: { day: string, count: number }[],   // YYYY-MM-DD
 *   byCategory: { warranty: number, sc: number, auth: number }
 * }>}
 */
export async function getActionStats({ days = 7 } = {}) {
  const safeDays = Math.min(Math.max(parseInt(days) || 7, 1), MAX_STATS_DAYS);
  const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);

  const admin = createAdminClient();

  // Підтягуємо тільки потрібні поля для агрегації — економія
  const { data, error } = await admin
    .from('action_log')
    .select('action_type, user_name, created_at')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[admin/audit] getActionStats error:', error);
    throw error;
  }

  const rows = data || [];

  // Підрахунки в JS — для нашого обсягу (тисячі рядків) це швидше за SQL aggregations
  const byActionTypeMap = new Map();
  const byUserMap = new Map();
  const byDayMap = new Map();
  const byCategory = { warranty: 0, sc: 0, auth: 0, other: 0 };

  for (const r of rows) {
    // by action_type
    byActionTypeMap.set(r.action_type, (byActionTypeMap.get(r.action_type) || 0) + 1);

    // by user
    const uname = r.user_name || 'unknown';
    byUserMap.set(uname, (byUserMap.get(uname) || 0) + 1);

    // by day (YYYY-MM-DD у UTC)
    const day = r.created_at ? r.created_at.slice(0, 10) : 'unknown';
    byDayMap.set(day, (byDayMap.get(day) || 0) + 1);

    // by category
    if (r.action_type?.startsWith('warranty.')) byCategory.warranty++;
    else if (r.action_type?.startsWith('sc.')) byCategory.sc++;
    else if (r.action_type?.startsWith('auth.')) byCategory.auth++;
    else byCategory.other++;
  }

  // Заповнюємо порожні дні нулями — щоб графік не мав пропусків
  const byDay = [];
  for (let i = safeDays - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    byDay.push({ day: key, count: byDayMap.get(key) || 0 });
  }

  return {
    totalCount: rows.length,
    byActionType: Array.from(byActionTypeMap.entries())
      .map(([action_type, count]) => ({ action_type, count }))
      .sort((a, b) => b.count - a.count),
    byUser: Array.from(byUserMap.entries())
      .map(([user_name, count]) => ({ user_name, count }))
      .sort((a, b) => b.count - a.count),
    byDay,
    byCategory,
  };
}

/**
 * Генерує CSV для експорту. Використовує ті ж фільтри що listActions,
 * але без pagination — повертає всі рядки що матчать (захист — max 5000).
 *
 * Формат CSV:
 *   id;created_at;user_name;action_type;warranty_id;old_value;new_value;ip_address
 *
 * @returns {Promise<string>} CSV контент з UTF-8 BOM (для Excel)
 */
export async function exportActionsCSV({ filters = {} } = {}) {
  const MAX_EXPORT_ROWS = 5000;

  const admin = createAdminClient();
  let query = admin
    .from('action_log')
    .select('id, created_at, user_name, action_type, warranty_id, old_value, new_value, ip_address');

  // Той самий filter logic що у listActions
  if (filters.action_type) {
    const at = String(filters.action_type);
    if (at.endsWith('.*')) {
      query = query.like('action_type', at.slice(0, -1) + '%');
    } else {
      query = query.eq('action_type', at);
    }
  }
  if (filters.user_name) query = query.eq('user_name', String(filters.user_name));
  if (filters.warranty_id !== undefined && filters.warranty_id !== null && filters.warranty_id !== '') {
    const wid = parseInt(filters.warranty_id);
    if (!Number.isNaN(wid)) query = query.eq('warranty_id', wid);
  }
  if (filters.days && parseInt(filters.days) > 0) {
    const since = new Date(Date.now() - parseInt(filters.days) * 24 * 60 * 60 * 1000);
    query = query.gte('created_at', since.toISOString());
  }

  query = query.order('created_at', { ascending: false }).limit(MAX_EXPORT_ROWS);

  const { data, error } = await query;
  if (error) {
    console.error('[admin/audit] exportActionsCSV error:', error);
    throw error;
  }

  const rows = data || [];

  // CSV escape: ", \n всередині значень
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return '"' + s.replace(/"/g, '""') + '"';
  };

  const headers = [
    'ID',
    'Час',
    'Користувач',
    'Дія',
    'Warranty ID',
    'Старе значення',
    'Нове значення',
    'IP адреса',
  ];

  const lines = [headers.map(esc).join(';')];
  for (const r of rows) {
    lines.push([
      esc(r.id),
      esc(r.created_at),
      esc(r.user_name),
      esc(r.action_type),
      esc(r.warranty_id),
      esc(r.old_value),
      esc(r.new_value),
      esc(r.ip_address),
    ].join(';'));
  }

  // BOM для Excel — щоб кирилиця не зламалась
  return '\uFEFF' + lines.join('\n');
}
