/**
 * Setup 2FA — QR endpoint
 *
 * GET /api/admin/setup-2fa/qr?user=ihor (or director)
 *
 * Повертає:
 *   - otpauthUrl: повний URL для otpauth:// (можна вставити вручну)
 *   - qrDataUrl: PNG data URL для <img src="..."> (сканувати у Authenticator)
 *   - manualKey: відформатований secret для ручного вводу (групами по 4)
 *
 * Безпека:
 *   - Захищений admin auth (401 якщо не залогінений)
 *   - Whitelist user param (тільки 'ihor' або 'director')
 *   - НЕ повертає raw secret напряму — тільки через otpauth URL і manualKey
 *   - Cache-Control: no-store — браузер не зберігає у cache
 */

import QRCode from 'qrcode';
import { getSession } from '../../../../../lib/auth';
import {
  getTotpSecretForUser,
  generateOtpAuthUrl,
} from '../../../../../lib/totp';

const ALLOWED_USERS = ['ihor', 'director'];

export async function GET(request) {
  // ─── Auth guard ─────────────────────────────────────────────
  const session = await getSession(request);
  if (!session || session.role !== 'admin') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ─── Parse + validate user param ────────────────────────────
  const { searchParams } = new URL(request.url);
  const user = searchParams.get('user');

  if (!ALLOWED_USERS.includes(user)) {
    return Response.json(
      { error: 'Invalid user. Must be "ihor" or "director"' },
      { status: 400 }
    );
  }

  // ─── Get secret з env ───────────────────────────────────────
  const secret = getTotpSecretForUser(user);
  if (!secret) {
    return Response.json(
      { error: `TOTP secret not configured for ${user}` },
      { status: 500 }
    );
  }

  // ─── Generate otpauth URL ───────────────────────────────────
  const otpauthUrl = generateOtpAuthUrl(user, secret);

  // ─── Generate QR PNG data URL ───────────────────────────────
  let qrDataUrl;
  try {
    qrDataUrl = await QRCode.toDataURL(otpauthUrl, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 280,
      margin: 2,
      color: {
        dark: '#1A1A1A',
        light: '#FAF7F0',
      },
    });
  } catch (err) {
    console.error('[setup-2fa/qr] QR generation failed:', err);
    return Response.json(
      { error: 'QR generation failed' },
      { status: 500 }
    );
  }

  // ─── Format manual key (групами по 4 для зручності) ─────────
  // "JBSWY3DPEHPK3PXPNRSXIIDFNRSWG2LD" → "JBSW Y3DP EHPK 3PXP NRSX IIDF NRSW G2LD"
  const manualKey = secret.match(/.{1,4}/g)?.join(' ') || secret;

  return new Response(
    JSON.stringify({
      user,
      otpauthUrl,
      qrDataUrl,
      manualKey,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}
