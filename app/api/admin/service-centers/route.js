import { getSession } from '../../../../lib/auth';
import { listCenters } from '../../../../lib/admin/service-centers';

export const runtime = 'nodejs';

/**
 * GET /api/admin/service-centers
 *
 * Повертає список усіх сервісних центрів, відсортований за містом.
 * Використовується у адмінці для dropdown призначення СЦ на гарантію.
 *
 * Замінює прямий supabase SELECT з app/admin/page.js (loadCenters).
 *
 * Повний CRUD (POST/PATCH/DELETE) буде доданий у Блоку B.2
 * коли будемо рефакторити /admin/service-centers сторінку.
 *
 * Auth: JWT cookie hecht_admin_session з role='admin'.
 *
 * Response 200: { centers: [...] }
 * Response 401: { error: 'Unauthorized' }
 * Response 500: { error }
 */
export async function GET(request) {
  const session = await getSession(request);
  if (!session || session.role !== 'admin') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const centers = await listCenters();
    return Response.json({ centers });
  } catch (err) {
    console.error('[api/admin/service-centers GET] error:', err);
    return Response.json(
      { error: 'Помилка завантаження сервісних центрів' },
      { status: 500 }
    );
  }
}
