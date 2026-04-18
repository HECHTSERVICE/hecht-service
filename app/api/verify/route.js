import nodemailer from 'nodemailer';

// In-memory store for codes (resets on deploy, which is fine for admin 2FA)
const codes = new Map();

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, code: userCode } = body;

    if (action === 'send') {
      // Generate 6-digit code
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const expires = Date.now() + 5 * 60 * 1000; // 5 minutes

      codes.set('admin', { code, expires });

      // Clean old codes
      for (const [key, val] of codes) {
        if (val.expires < Date.now()) codes.delete(key);
      }

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD,
        },
      });

      await transporter.sendMail({
        from: '"Hecht Service" <garantiya@hecht-service.com.ua>',
        to: 'garantiya@hecht-service.com.ua',
        subject: '\uD83D\uDD10 \u041A\u043E\u0434 \u0432\u0445\u043E\u0434\u0443: ' + code,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:400px;margin:0 auto;text-align:center;padding:32px;">
            <div style="background:#E30613;color:#fff;padding:12px;border-radius:12px 12px 0 0;">
              <h2 style="margin:0;font-size:18px;">HECHT Service</h2>
            </div>
            <div style="background:#fff;border:1px solid #eee;border-top:none;padding:32px;border-radius:0 0 12px 12px;">
              <p style="color:#555;font-size:14px;margin:0 0 20px;">\u041A\u043E\u0434 \u0434\u043B\u044F \u0432\u0445\u043E\u0434\u0443 \u0432 \u0430\u0434\u043C\u0456\u043D-\u043F\u0430\u043D\u0435\u043B\u044C:</p>
              <div style="font-size:36px;font-weight:700;letter-spacing:8px;color:#E30613;margin:0 0 20px;">${code}</div>
              <p style="color:#999;font-size:12px;margin:0;">\u0414\u0456\u0439\u0441\u043D\u0438\u0439 5 \u0445\u0432\u0438\u043B\u0438\u043D</p>
            </div>
          </div>
        `,
      });

      return Response.json({ success: true });
    }

    if (action === 'verify') {
      const stored = codes.get('admin');

      if (!stored) {
        return Response.json({ valid: false, error: '\u041A\u043E\u0434 \u043D\u0435 \u0437\u043D\u0430\u0439\u0434\u0435\u043D\u043E. \u0421\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u043E\u0442\u0440\u0438\u043C\u0430\u0442\u0438 \u043D\u043E\u0432\u0438\u0439.' });
      }

      if (stored.expires < Date.now()) {
        codes.delete('admin');
        return Response.json({ valid: false, error: '\u041A\u043E\u0434 \u043F\u0440\u043E\u0442\u0435\u0440\u043C\u0456\u043D\u043E\u0432\u0430\u043D\u0438\u0439. \u041E\u0442\u0440\u0438\u043C\u0430\u0439\u0442\u0435 \u043D\u043E\u0432\u0438\u0439.' });
      }

      if (stored.code === userCode) {
        codes.delete('admin');
        return Response.json({ valid: true });
      }

      return Response.json({ valid: false, error: '\u041D\u0435\u0432\u0456\u0440\u043D\u0438\u0439 \u043A\u043E\u0434' });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('2FA error:', error);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
