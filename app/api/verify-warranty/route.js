/**
 * Hecht Service — Turnstile verification endpoint
 *
 * Форма реєстрації гарантії відправляє сюди Turnstile токен ПЕРЕД
 * записом у Supabase. Якщо токен валідний → повертаємо { ok: true },
 * і тільки тоді форма робить insert.
 *
 * Rate limit на цей роут діє автоматично через middleware.js
 * (шлях починається на /api/warranty* — захоплюється formRatelimit: 5/60s).
 *
 * Env потрібна: TURNSTILE_SECRET_KEY (вже є у Vercel)
 */

export async function POST(request) {
  try {
    const body = await request.json();
    const token = body?.turnstileToken;

    if (!token || typeof token !== 'string') {
      return Response.json(
        { ok: false, error: 'Відсутній токен підтвердження' },
        { status: 400 }
      );
    }

    const secret = process.env.TURNSTILE_SECRET_KEY;
    if (!secret) {
      console.error('[verify-warranty] TURNSTILE_SECRET_KEY is not set');
      // Не блокуємо форму якщо серверна конфігурація зламана —
      // краще пропустити одну заявку ніж втратити клієнта.
      // Помилка піде в лог, ми побачимо.
      return Response.json({ ok: true, warning: 'captcha-skipped' });
    }

    // IP користувача (для додаткової перевірки Cloudflare-ом)
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      null;

    const formData = new FormData();
    formData.append('secret', secret);
    formData.append('response', token);
    if (ip) formData.append('remoteip', ip);

    const verifyRes = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      { method: 'POST', body: formData }
    );

    const verifyData = await verifyRes.json();

    if (!verifyData.success) {
      return Response.json(
        {
          ok: false,
          error: 'Перевірка "Я не робот" не пройдена. Оновіть сторінку і спробуйте ще раз.',
          codes: verifyData['error-codes'] || [],
        },
        { status: 403 }
      );
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error('[verify-warranty] error:', err);
    // Мережева помилка → не блокуємо клієнта
    return Response.json({ ok: true, warning: 'verify-error' });
  }
}
