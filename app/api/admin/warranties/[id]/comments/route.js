import { getSession } from '../../../../../../lib/auth';
import { listComments, createComment } from '../../../../../../lib/admin/comments';

export const runtime = 'nodejs';

/**
 * GET /api/admin/warranties/[id]/comments
 *
 * Повертає список коментарів по warranty_id у хронологічному порядку.
 * Замінює прямий supabase SELECT з app/admin/page.js (loadComments).
 *
 * Response 200: { comments: [...] }
 */
export async function GET(request, { params }) {
  const session = await getSession(request);
  if (!session || session.role !== 'admin') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return Response.json({ error: 'Missing warranty id' }, { status: 400 });
  }

  try {
    const comments = await listComments(id);
    return Response.json({ comments });
  } catch (err) {
    console.error('[api/admin/warranties/[id]/comments GET] error:', err);
    return Response.json(
      { error: 'Помилка завантаження коментарів' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/warranties/[id]/comments
 *
 * Створює новий коментар від імені адміна.
 * Замінює прямий supabase INSERT з app/admin/page.js (sendComment).
 *
 * ВАЖЛИВО: author_name береться з JWT session (session.name),
 * а author_role жорстко 'admin' у helper-і. Клієнт не може підробити.
 *
 * Body: { message: string }
 * Response 200: { comment: {...} } — створений коментар з id та created_at
 * Response 400: { error } — порожнє / занадто довге повідомлення
 */
export async function POST(request, { params }) {
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

  const message = body?.message;
  if (!message || typeof message !== 'string' || !message.trim()) {
    return Response.json({ error: 'Повідомлення не може бути порожнім' }, { status: 400 });
  }

  try {
    const comment = await createComment(id, {
      message,
      authorName: session.name || 'Hecht', // імʼя з JWT, fallback на 'Hecht'
    });

    return Response.json({ comment });
  } catch (err) {
    console.error('[api/admin/warranties/[id]/comments POST] error:', err);

    const msg = err?.message || '';
    if (msg.includes('too long') || msg.includes('is empty')) {
      return Response.json({ error: msg }, { status: 400 });
    }

    return Response.json(
      { error: 'Помилка створення коментаря' },
      { status: 500 }
    );
  }
}
