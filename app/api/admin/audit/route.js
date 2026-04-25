import { getSession } from '../../../../lib/auth';
import { listActions, getActionStats, exportActionsCSV } from '../../../../lib/admin/audit';

// Node.js runtime — потрібен для Supabase Service Role
export const runtime = 'nodejs';

/**
 * GET /api/admin/audit
 *
 * Універсальний endpoint з трьома режимами через query params:
 *
 * 1. LIST (default):
 *    GET /api/admin/audit?action_type=warranty.status_change&user_name=ihor&days=7&warranty_id=35&page=1&per_page=50
 *    → { rows: [...], total: number, page, perPage }
 *
 *    Параметри (всі optional):
 *      action_type — exact match або prefix 'warranty.*' / 'sc.*' / 'auth.*'
 *      user_name   — 'ihor' | 'director' | 'unknown'
 *      warranty_id — number
 *      days        — 1 | 7 | 30 | 90 | 0 (=всі)
 *      page        — 1+
 *      per_page    — max 100
 *
 * 2. STATS:
 *    GET /api/admin/audit?stats=1&days=30
 *    → { totalCount, byActionType, byUser, byDay, byCategory }
 *
 * 3. EXPORT:
 *    GET /api/admin/audit?export=csv&action_type=warranty.*&days=30
 *    → CSV file download (з тими ж фільтрами що list, без pagination, max 5000 рядків)
 *
 * Auth: JWT cookie hecht_admin_session з role='admin'.
 *
 * Response:
 *   200 — JSON або CSV (залежно від режиму)
 *   401 — Unauthorized
 *   500 — Server error
 */
export async function GET(request) {
  // Session guard
  const session = await getSession(request);
  if (!session || session.role !== 'admin') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const sp = url.searchParams;

  // Збір фільтрів з query params
  const filters = {
    action_type: sp.get('action_type') || undefined,
    user_name: sp.get('user_name') || undefined,
    warranty_id: sp.get('warranty_id') || undefined,
    days: sp.get('days') || undefined,
  };

  try {
    // ── MODE: EXPORT CSV ─────────────────────────────────────────
    if (sp.get('export') === 'csv') {
      const csv = await exportActionsCSV({ filters });
      const filename = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      return new Response(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    // ── MODE: STATS ──────────────────────────────────────────────
    if (sp.get('stats') === '1') {
      const days = parseInt(sp.get('days')) || 7;
      const stats = await getActionStats({ days });
      return Response.json(stats);
    }

    // ── MODE: LIST (default) ─────────────────────────────────────
    const page = parseInt(sp.get('page')) || 1;
    const perPage = parseInt(sp.get('per_page')) || 50;
    const result = await listActions({ filters, page, perPage });
    return Response.json(result);
  } catch (err) {
    console.error('[api/admin/audit GET] error:', err);
    return Response.json(
      { error: 'Помилка завантаження audit log' },
      { status: 500 }
    );
  }
}
