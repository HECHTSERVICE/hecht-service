import { verifyTurnstile } from '../../../../lib/turnstile';
import { checkDuplicate, createWarranty } from '../../../../lib/warranty';
import { sendWarrantyEmail } from '../../../../lib/email';

// Node.js runtime — потрібен для nodemailer + jspdf
export const runtime = 'nodejs';

// До 30 сек на запит (PDF generation + 2 SMTP sends можуть бути повільними)
export const maxDuration = 30;

/**
 * POST /api/warranty/register
 *
 * Єдина точка входу для публічної форми реєстрації гарантії.
 * Замінює колишню схему з 2 supabase-викликами з браузера
 * + fetch /api/verify-warranty + fetch /api/send-email.
 *
 * Body: {
 *   firstName, lastName, phone, email,
 *   serialNumber, model, purchaseDate,
 *   turnstileToken
 * }
 *
 * Responses:
 *   200 { success: true, certNumber, emailSent }
 *   400 { success: false, error }   — validation
 *   403 { success: false, error }   — Turnstile fail
 *   409 { success: false, error }   — duplicate serial
 *   500 { success: false, error }   — server error
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      firstName,
      lastName,
      phone,
      email,
      serialNumber,
      model,
      purchaseDate,
      turnstileToken,
    } = body;

    // ─── 1. Validation ─────────────────────────────────
    if (!firstName || !lastName || !phone || !email ||
        !serialNumber || !model || !purchaseDate) {
      return Response.json(
        { success: false, error: 'Не заповнені обов\'язкові поля' },
        { status: 400 }
      );
    }

    // Простий email sanity check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return Response.json(
        { success: false, error: 'Невірний формат email' },
        { status: 400 }
      );
    }

    // ─── 2. Turnstile verify ───────────────────────────
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null;

    const turnstile = await verifyTurnstile(turnstileToken, ip);
    if (!turnstile.success) {
      console.warn('[register] Turnstile failed:', turnstile.errorCodes);
      return Response.json(
        {
          success: false,
          error: 'Перевірка "Я не робот" не пройдена. Оновіть сторінку.',
        },
        { status: 403 }
      );
    }

    // ─── 3. Duplicate check ────────────────────────────
    const isDuplicate = await checkDuplicate(serialNumber);
    if (isDuplicate) {
      return Response.json(
        {
          success: false,
          error: 'Цей серійний номер вже зареєстровано раніше!',
        },
        { status: 409 }
      );
    }

    // ─── 4. Create warranty (INSERT через Service Role) ─
    const { certNumber } = await createWarranty({
      firstName,
      lastName,
      phone,
      email,
      serialNumber,
      model,
      purchaseDate,
    });

    console.log('[register] Warranty created:', certNumber);

    // ─── 5. Send email (non-critical — degrade gracefully) ─
    let emailSent = true;
    try {
      await sendWarrantyEmail({
        certNumber,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        model: model.trim(),
        serialNumber: serialNumber.toUpperCase().trim(),
        purchaseDate,
      });
    } catch (emailErr) {
      // ⚠️ КРИТИЧНО: гарантію НЕ видаляємо, якщо email впав.
      // Клієнт заплатив за техніку — гарантія має бути збережена.
      // Email можна надіслати вручну пізніше.
      console.error('[register] Email failed (warranty saved):', emailErr);
      emailSent = false;
    }

    // ─── 6. Success response ───────────────────────────
    return Response.json({
      success: true,
      certNumber,
      emailSent,
    });
  } catch (err) {
    console.error('[register] Unexpected error:', err);
    return Response.json(
      { success: false, error: 'Помилка при реєстрації. Спробуйте пізніше.' },
      { status: 500 }
    );
  }
}
