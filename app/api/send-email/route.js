import nodemailer from 'nodemailer';

export async function POST(request) {
  try {
    const body = await request.json();
    const { certNumber, firstName, lastName, email, phone, model, serialNumber, purchaseDate } = body;

    if (!certNumber || !email) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    const formattedDate = purchaseDate ? new Date(purchaseDate).toLocaleDateString('uk-UA') : '—';
    const regDate = new Date().toLocaleDateString('uk-UA');

    // HTML email for customer
    const customerHtml = `
    <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;background:#F8F7F4;padding:0;">
      <div style="background:#E30613;padding:16px 24px;text-align:center;">
        <h1 style="margin:0;color:#fff;font-size:24px;letter-spacing:2px;">HECHT</h1>
        <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:11px;">made for garden</p>
      </div>
      <div style="padding:32px 24px;">
        <h2 style="color:#111;font-size:20px;margin:0 0 8px;">Гарантія зареєстрована!</h2>
        <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 24px;">
          ${firstName}, дякуємо за реєстрацію гарантії на техніку Hecht. Нижче — дані вашого гарантійного сертифіката.
        </p>
        <div style="background:#fff;border:1px solid rgba(0,0,0,0.08);border-radius:12px;padding:20px;margin-bottom:24px;">
          <div style="text-align:center;margin-bottom:16px;">
            <div style="font-size:11px;color:#E30613;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Номер сертифіката</div>
            <div style="font-size:22px;font-weight:700;color:#111;margin-top:4px;">${certNumber}</div>
          </div>
          <table style="width:100%;font-size:13px;border-collapse:collapse;">
            <tr><td style="padding:8px 0;color:#999;width:140px;">Покупець</td><td style="padding:8px 0;color:#111;font-weight:500;">${firstName} ${lastName}</td></tr>
            <tr style="border-top:1px solid #f0f0f0;"><td style="padding:8px 0;color:#999;">Телефон</td><td style="padding:8px 0;color:#111;">${phone}</td></tr>
            <tr style="border-top:1px solid #f0f0f0;"><td style="padding:8px 0;color:#999;">Email</td><td style="padding:8px 0;color:#111;">${email}</td></tr>
            <tr style="border-top:1px solid #f0f0f0;"><td style="padding:8px 0;color:#999;">Модель</td><td style="padding:8px 0;color:#111;font-weight:500;">${model}</td></tr>
            <tr style="border-top:1px solid #f0f0f0;"><td style="padding:8px 0;color:#999;">Серійний номер</td><td style="padding:8px 0;color:#111;font-family:monospace;">${serialNumber}</td></tr>
            <tr style="border-top:1px solid #f0f0f0;"><td style="padding:8px 0;color:#999;">Дата покупки</td><td style="padding:8px 0;color:#111;">${formattedDate}</td></tr>
            <tr style="border-top:1px solid #f0f0f0;"><td style="padding:8px 0;color:#999;">Дата реєстрації</td><td style="padding:8px 0;color:#111;">${regDate}</td></tr>
            <tr style="border-top:1px solid #f0f0f0;"><td style="padding:8px 0;color:#999;">Гарантія</td><td style="padding:8px 0;color:#00A86B;font-weight:600;">24 місяці</td></tr>
          </table>
        </div>
        <div style="background:#f0faf5;border:1px solid rgba(0,168,107,0.15);border-radius:10px;padding:16px;margin-bottom:24px;">
          <p style="margin:0;font-size:13px;color:#555;line-height:1.6;">
            <strong style="color:#00A86B;">Що далі?</strong><br/>
            Збережіть цей лист — він знадобиться при зверненні в сервіс. Ви також можете завантажити PDF-сертифікат на сайті.
          </p>
        </div>
        <div style="text-align:center;">
          <a href="https://hecht-service.com.ua" style="display:inline-block;padding:12px 28px;background:#E30613;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">Завантажити PDF-сертифікат</a>
        </div>
      </div>
      <div style="background:#111;padding:16px 24px;text-align:center;">
        <p style="margin:0;color:#666;font-size:11px;">
          ТОВ «ДЖІЕС КОМФОРТ СІСТЕМ» • <a href="https://hecht-service.com.ua" style="color:#888;text-decoration:none;">hecht-service.com.ua</a> • garantiya@hecht-service.com.ua
        </p>
      </div>
    </div>`;

    // Notification email for admin
    const adminHtml = `
    <div style="font-family:Arial,sans-serif;max-width:500px;">
      <h2 style="color:#E30613;margin:0 0 16px;">🔔 Нова реєстрація гарантії</h2>
      <table style="font-size:14px;border-collapse:collapse;width:100%;">
        <tr><td style="padding:6px 12px 6px 0;color:#999;">Сертифікат:</td><td style="padding:6px 0;font-weight:700;">${certNumber}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#999;">Покупець:</td><td style="padding:6px 0;">${firstName} ${lastName}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#999;">Телефон:</td><td style="padding:6px 0;">${phone}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#999;">Email:</td><td style="padding:6px 0;">${email}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#999;">Модель:</td><td style="padding:6px 0;font-weight:500;">${model}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#999;">S/N:</td><td style="padding:6px 0;font-family:monospace;">${serialNumber}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#999;">Дата покупки:</td><td style="padding:6px 0;">${formattedDate}</td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:12px;color:#999;">
        <a href="https://hecht-service.com.ua/admin" style="color:#E30613;">Відкрити адмін-панель →</a>
      </p>
    </div>`;

    // Send to customer
    await transporter.sendMail({
      from: '"Hecht Service" <garantiya@hecht-service.com.ua>',
      to: email,
      subject: `Гарантійний сертифікат ${certNumber} — Hecht Service`,
      html: customerHtml,
    });

    // Send notification to admin
    await transporter.sendMail({
      from: '"Hecht Service" <garantiya@hecht-service.com.ua>',
      to: 'garantiya@hecht-service.com.ua',
      subject: `🔔 Нова реєстрація: ${firstName} ${lastName} — ${model}`,
      html: adminHtml,
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Email error:', error);
    return Response.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
