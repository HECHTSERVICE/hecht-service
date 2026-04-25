/**
 * Hecht Service — Admin API: Service Centers & Users
 *
 * Server-side DB operations через createAdminClient() (Service Role Key).
 * Auth guard: HttpOnly cookie JWT → getSession() → role='admin'.
 *
 * Tier 1.4 (Audit): кожна mutation логує дію у action_log.
 *   - create-center → sc.create
 *   - delete-center → sc.delete
 *   - add-user      → sc.user_create
 *   - delete-user   → sc.user_delete
 *
 * Actions:
 *   GET                                → список СЦ з nested users
 *   POST { action: 'create-center' }   → створити СЦ
 *   POST { action: 'delete-center' }   → видалити СЦ (+ каскадно users)
 *   POST { action: 'add-user' }        → створити SC user з bcrypt
 *   POST { action: 'delete-user' }     → видалити user
 */

export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSession } from '../../../../lib/auth';
import { createAdminClient } from '../../../../lib/supabase';
import { logAction, AUDIT_ACTIONS } from '../../../../lib/audit';

async function requireAdmin(request) {
  const session = await getSession(request);
  if (!session || session.role !== 'admin') {
    return { unauthorized: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { session };
}

// ─── GET: список СЦ з користувачами ────────────────────────────
export async function GET(request) {
  const { unauthorized } = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const db = createAdminClient();
  const { data, error } = await db
    .from('service_centers')
    .select('*, users(id, username, full_name, active)')
    .order('city');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ centers: data || [] });
}

// ─── POST: dispatch по action ──────────────────────────────────
export async function POST(request) {
  const { unauthorized, session } = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const userName = session.user_name || 'unknown';

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { action } = body || {};
  const db = createAdminClient();

  // ── create-center ────────────────────────────────────────────
  if (action === 'create-center') {
    const city = (body.city || '').trim();
    const center_name = (body.center_name || '').trim();
    const contact_person = (body.contact_person || '').trim();
    const phone = (body.phone || '').trim();
    const email = (body.email || '').trim();

    if (!city || !center_name) {
      return NextResponse.json(
        { error: 'Місто і назва обовʼязкові' },
        { status: 400 }
      );
    }

    // .select().single() — щоб отримати id новоствореного СЦ для audit
    const { data: created, error } = await db
      .from('service_centers')
      .insert({
        city,
        center_name,
        contact_person: contact_person || null,
        phone: phone || null,
        email: email || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Помилка додавання центру' },
        { status: 500 }
      );
    }

    // ─── Audit ─────────────────────────────────────────────────
    await logAction({
      userName,
      actionType: AUDIT_ACTIONS.SC_CREATE,
      warrantyId: null,
      oldValue: null,
      newValue: {
        id: created.id,
        city: created.city,
        center_name: created.center_name,
      },
      request,
    });

    return NextResponse.json({ success: true });
  }

  // ── delete-center ────────────────────────────────────────────
  if (action === 'delete-center') {
    const { id } = body;
    if (!id) {
      return NextResponse.json({ error: 'Не вказано id' }, { status: 400 });
    }

    // SELECT перед DELETE — щоб логувати що саме видалили
    const { data: existing } = await db
      .from('service_centers')
      .select('id, city, center_name')
      .eq('id', id)
      .single();

    // Каскадне видалення users (може бути 0 — це норма)
    await db.from('users').delete().eq('service_center_id', id);

    // Видалення центру (може впасти через FK від warranty_registrations)
    const { error } = await db.from('service_centers').delete().eq('id', id);
    if (error) {
      return NextResponse.json(
        { error: 'Неможливо видалити — до центру прив\'язані заявки' },
        { status: 400 }
      );
    }

    // ─── Audit ─────────────────────────────────────────────────
    await logAction({
      userName,
      actionType: AUDIT_ACTIONS.SC_DELETE,
      warrantyId: null,
      oldValue: existing
        ? { id: existing.id, city: existing.city, center_name: existing.center_name }
        : { id },
      newValue: null,
      request,
    });

    return NextResponse.json({ success: true });
  }

  // ── add-user (з bcrypt!) ─────────────────────────────────────
  if (action === 'add-user') {
    const username = (body.username || '').trim();
    const password = body.password || '';
    const full_name = (body.full_name || '').trim();
    const service_center_id = body.service_center_id;

    if (!username || !password || !service_center_id) {
      return NextResponse.json(
        { error: 'Обовʼязкові поля відсутні' },
        { status: 400 }
      );
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Пароль мінімум 6 символів' },
        { status: 400 }
      );
    }

    // 🔐 Bcrypt на сервері (раніше зберігалось plain text!)
    const password_hash = await bcrypt.hash(password, 10);

    const { data: created, error } = await db
      .from('users')
      .insert({
        username,
        password_hash,
        role: 'service_center',
        service_center_id,
        full_name: full_name || null,
        active: true,
      })
      .select('id, username, service_center_id, full_name')
      .single();

    if (error) {
      const isUnique = (error.message || '').toLowerCase().includes('unique');
      return NextResponse.json(
        { error: isUnique ? 'Такий логін вже існує' : 'Помилка створення акаунту' },
        { status: 400 }
      );
    }

    // ─── Audit ─────────────────────────────────────────────────
    // ⚠️ password_hash НЕ логуємо — security
    await logAction({
      userName,
      actionType: AUDIT_ACTIONS.SC_USER_CREATE,
      warrantyId: null,
      oldValue: null,
      newValue: {
        id: created.id,
        username: created.username,
        service_center_id: created.service_center_id,
      },
      request,
    });

    return NextResponse.json({ success: true });
  }

  // ── delete-user ──────────────────────────────────────────────
  if (action === 'delete-user') {
    const { user_id } = body;
    if (!user_id) {
      return NextResponse.json({ error: 'Не вказано user_id' }, { status: 400 });
    }

    // SELECT перед DELETE — щоб логувати кого видалили (без hash!)
    const { data: existing } = await db
      .from('users')
      .select('id, username, service_center_id')
      .eq('id', user_id)
      .single();

    const { error } = await db.from('users').delete().eq('id', user_id);
    if (error) {
      return NextResponse.json(
        { error: 'Помилка видалення акаунту' },
        { status: 500 }
      );
    }

    // ─── Audit ─────────────────────────────────────────────────
    await logAction({
      userName,
      actionType: AUDIT_ACTIONS.SC_USER_DELETE,
      warrantyId: null,
      oldValue: existing
        ? { id: existing.id, username: existing.username, service_center_id: existing.service_center_id }
        : { id: user_id },
      newValue: null,
      request,
    });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Невідома дія' }, { status: 400 });
}
