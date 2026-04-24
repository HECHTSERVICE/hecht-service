/**
 * Server-side Cloudflare Turnstile verification.
 *
 * Викликається у API routes для перевірки токена отриманого
 * з клієнтського віджета Turnstile.
 *
 * @param {string} token - токен з window.turnstile callback
 * @param {string|null} [ip] - IP клієнта (опціонально, для додаткової перевірки)
 * @returns {Promise<{ success: boolean, errorCodes: string[] }>}
 */
export async function verifyTurnstile(token, ip = null) {
  if (!token) {
    return { success: false, errorCodes: ['missing-input-response'] };
  }

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error('[turnstile] TURNSTILE_SECRET_KEY not set in env');
    return { success: false, errorCodes: ['missing-secret'] };
  }

  const formData = new URLSearchParams();
  formData.append('secret', secret);
  formData.append('response', token);
  if (ip) formData.append('remoteip', ip);

  try {
    const res = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      }
    );

    if (!res.ok) {
      return { success: false, errorCodes: [`http-${res.status}`] };
    }

    const data = await res.json();
    return {
      success: data.success === true,
      errorCodes: data['error-codes'] || [],
    };
  } catch (err) {
    console.error('[turnstile] verify failed:', err);
    return { success: false, errorCodes: ['network-error'] };
  }
}
