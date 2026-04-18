import nodemailer from 'nodemailer';

async function generatePDFBuffer(data) {
  const { jsPDF } = await import('jspdf');
  const QRCode = (await import('qrcode')).default;

  const doc = new jsPDF('p', 'mm', 'a4');
  const w = 210;

  // Load Cyrillic font
  try {
    const res = await fetch('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.12/fonts/Roboto/Roboto-Regular.ttf');
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = ''; for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    doc.addFileToVFS('Roboto-Regular.ttf', btoa(binary));
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');

    const res2 = await fetch('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.12/fonts/Roboto/Roboto-Medium.ttf');
    const buf2 = await res2.arrayBuffer();
    const bytes2 = new Uint8Array(buf2);
    let binary2 = ''; for (let i = 0; i < bytes2.length; i++) binary2 += String.fromCharCode(bytes2[i]);
    doc.addFileToVFS('Roboto-Bold.ttf', btoa(binary2));
    doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
    doc.setFont('Roboto', 'normal');
  } catch (e) {
    console.warn('Font load failed', e);
  }

  const setF = (s) => { try { doc.setFont('Roboto', s); } catch(e) { doc.setFont('helvetica', s); } };

  const { certNumber, firstName, lastName, phone, email, model, serialNumber, purchaseDate } = data;
  const formattedDate = purchaseDate ? new Date(purchaseDate).toLocaleDateString('uk-UA') : '';
  const regDate = new Date().toLocaleDateString('uk-UA');

  // Background
  doc.setFillColor(248, 247, 244);
  doc.rect(0, 0, w, 297, 'F');

  // Red header
  doc.setFillColor(227, 6, 19);
  doc.rect(0, 0, w, 8, 'F');

  // Logo
  setF('bold');
  doc.setFontSize(28);
  doc.setTextColor(227, 6, 19);
  doc.text('HECHT', w / 2, 30, { align: 'center' });
  setF('normal');
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text('made for garden', w / 2, 36, { align: 'center' });

  // Title
  setF('bold');
  doc.setFontSize(20);
  doc.setTextColor(17, 17, 17);
  doc.text('\u0413\u0410\u0420\u0410\u041D\u0422\u0406\u0419\u041D\u0418\u0419 \u0421\u0415\u0420\u0422\u0418\u0424\u0406\u041A\u0410\u0422', w / 2, 52, { align: 'center' });

  // Cert number
  doc.setFillColor(255, 235, 235);
  doc.roundedRect(55, 57, 100, 14, 4, 4, 'F');
  doc.setFontSize(14);
  doc.setTextColor(227, 6, 19);
  doc.text(certNumber, w / 2, 66, { align: 'center' });

  doc.setDrawColor(220, 220, 220);
  doc.line(30, 78, 180, 78);

  // Info
  const startY = 88, labelX = 32, valueX = 85, lineH = 10;
  const fields = [
    { label: '\u041F\u043E\u043A\u0443\u043F\u0435\u0446\u044C:', value: firstName + ' ' + lastName },
    { label: '\u0422\u0435\u043B\u0435\u0444\u043E\u043D:', value: phone },
    { label: 'Email:', value: email },
    { label: '\u041C\u043E\u0434\u0435\u043B\u044C:', value: model },
    { label: '\u0421\u0435\u0440\u0456\u0439\u043D\u0438\u0439 \u043D\u043E\u043C\u0435\u0440:', value: serialNumber },
    { label: '\u0414\u0430\u0442\u0430 \u043F\u043E\u043A\u0443\u043F\u043A\u0438:', value: formattedDate },
    { label: '\u0414\u0430\u0442\u0430 \u0440\u0435\u0454\u0441\u0442\u0440\u0430\u0446\u0456\u0457:', value: regDate },
    { label: '\u0413\u0430\u0440\u0430\u043D\u0442\u0456\u044F:', value: '24 \u043C\u0456\u0441\u044F\u0446\u0456 \u0437 \u0434\u0430\u0442\u0438 \u043F\u043E\u043A\u0443\u043F\u043A\u0438' },
  ];

  fields.forEach((f, i) => {
    const y = startY + i * lineH;
    doc.setFontSize(10);
    doc.setTextColor(130, 130, 130);
    setF('normal');
    doc.text(f.label, labelX, y);
    doc.setTextColor(17, 17, 17);
    setF('bold');
    doc.text(f.value, valueX, y);
  });

  const afterInfoY = startY + fields.length * lineH + 5;
  doc.setDrawColor(220, 220, 220);
  doc.line(30, afterInfoY, 180, afterInfoY);

  // QR
  const qrUrl = 'https://hecht-service.com.ua/verify?cert=' + certNumber;
  const qrDataUrl = await QRCode.toDataURL(qrUrl, { width: 200, margin: 1, color: { dark: '#111111', light: '#F8F7F4' } });
  const qrY = afterInfoY + 8;
  doc.addImage(qrDataUrl, 'PNG', w / 2 - 20, qrY, 40, 40);

  setF('normal');
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('\u0421\u043A\u0430\u043D\u0443\u0439\u0442\u0435 \u0434\u043B\u044F \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0438 \u0430\u0432\u0442\u0435\u043D\u0442\u0438\u0447\u043D\u043E\u0441\u0442\u0456', w / 2, qrY + 45, { align: 'center' });

  // Terms
  const termsY = qrY + 55;
  doc.setFillColor(240, 240, 238);
  doc.roundedRect(30, termsY, 150, 32, 3, 3, 'F');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('\u0413\u0430\u0440\u0430\u043D\u0442\u0456\u044F \u0434\u0456\u0454 \u0437\u0430 \u0443\u043C\u043E\u0432\u0438 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u0430\u043D\u043D\u044F \u0442\u0435\u0445\u043D\u0456\u043A\u0438 \u0437\u0430 \u043F\u0440\u0438\u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044F\u043C \u0442\u0430 \u0434\u043E\u0442\u0440\u0438\u043C\u0430\u043D\u043D\u044F', w / 2, termsY + 7, { align: 'center' });
  doc.text('\u0456\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0456\u0457 \u0437 \u0435\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0456\u0457. \u0413\u0430\u0440\u0430\u043D\u0442\u0456\u044F \u043D\u0435 \u043F\u043E\u0448\u0438\u0440\u044E\u0454\u0442\u044C\u0441\u044F \u043D\u0430 \u0432\u0438\u0442\u0440\u0430\u0442\u043D\u0456 \u043C\u0430\u0442\u0435\u0440\u0456\u0430\u043B\u0438,', w / 2, termsY + 11.5, { align: 'center' });
  doc.text('\u043F\u043E\u0448\u043A\u043E\u0434\u0436\u0435\u043D\u043D\u044F \u0432\u0456\u0434 \u043D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u043E\u0457 \u0435\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0456\u0457 \u0442\u0430 \u043D\u0435\u0441\u0430\u043D\u043A\u0446\u0456\u043E\u043D\u043E\u0432\u0430\u043D\u043E\u0433\u043E \u0440\u0435\u043C\u043E\u043D\u0442\u0443.', w / 2, termsY + 16, { align: 'center' });
  doc.text('\u041F\u043E\u0432\u043D\u0456 \u0443\u043C\u043E\u0432\u0438: hecht-service.com.ua/pravova-informatsiya', w / 2, termsY + 20.5, { align: 'center' });

  // Footer
  doc.setFillColor(227, 6, 19);
  doc.rect(0, 289, w, 8, 'F');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text('\u0422\u041E\u0412 \u00AB\u0414\u0416\u0406\u0415\u0421 \u041A\u041E\u041C\u0424\u041E\u0420\u0422 \u0421\u0406\u0421\u0422\u0415\u041C\u00BB \u2022 hecht-service.com.ua \u2022 garantiya@hecht-service.com.ua', w / 2, 294, { align: 'center' });

  // Return as Buffer
  const arrayBuf = doc.output('arraybuffer');
  return Buffer.from(arrayBuf);
}

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

    const formattedDate = purchaseDate ? new Date(purchaseDate).toLocaleDateString('uk-UA') : '';
    const regDate = new Date().toLocaleDateString('uk-UA');

    // Generate PDF on server
    let pdfBuffer = null;
    try {
      pdfBuffer = await generatePDFBuffer({ certNumber, firstName, lastName, phone, email, model, serialNumber, purchaseDate });
    } catch (pdfErr) {
      console.error('PDF generation error:', pdfErr);
    }

    // HTML email for customer
    const customerHtml = `
    <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;background:#F8F7F4;padding:0;">
      <div style="background:#E30613;padding:16px 24px;text-align:center;">
        <h1 style="margin:0;color:#fff;font-size:24px;letter-spacing:2px;">HECHT</h1>
        <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:11px;">made for garden</p>
      </div>
      <div style="padding:32px 24px;">
        <h2 style="color:#111;font-size:20px;margin:0 0 8px;">\u0413\u0430\u0440\u0430\u043D\u0442\u0456\u044F \u0437\u0430\u0440\u0435\u0454\u0441\u0442\u0440\u043E\u0432\u0430\u043D\u0430!</h2>
        <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 24px;">
          ${firstName}, \u0434\u044F\u043A\u0443\u0454\u043C\u043E \u0437\u0430 \u0440\u0435\u0454\u0441\u0442\u0440\u0430\u0446\u0456\u044E \u0433\u0430\u0440\u0430\u043D\u0442\u0456\u0457 \u043D\u0430 \u0442\u0435\u0445\u043D\u0456\u043A\u0443 Hecht. \u0412\u0430\u0448 PDF-\u0441\u0435\u0440\u0442\u0438\u0444\u0456\u043A\u0430\u0442 \u0434\u043E\u0434\u0430\u043D\u043E \u0434\u043E \u0446\u044C\u043E\u0433\u043E \u043B\u0438\u0441\u0442\u0430.
        </p>
        <div style="background:#fff;border:1px solid rgba(0,0,0,0.08);border-radius:12px;padding:20px;margin-bottom:24px;">
          <div style="text-align:center;margin-bottom:16px;">
            <div style="font-size:11px;color:#E30613;font-weight:600;text-transform:uppercase;letter-spacing:1px;">\u041D\u043E\u043C\u0435\u0440 \u0441\u0435\u0440\u0442\u0438\u0444\u0456\u043A\u0430\u0442\u0430</div>
            <div style="font-size:22px;font-weight:700;color:#111;margin-top:4px;">${certNumber}</div>
          </div>
          <table style="width:100%;font-size:13px;border-collapse:collapse;">
            <tr><td style="padding:8px 0;color:#999;width:140px;">\u041F\u043E\u043A\u0443\u043F\u0435\u0446\u044C</td><td style="padding:8px 0;color:#111;font-weight:500;">${firstName} ${lastName}</td></tr>
            <tr style="border-top:1px solid #f0f0f0;"><td style="padding:8px 0;color:#999;">\u0422\u0435\u043B\u0435\u0444\u043E\u043D</td><td style="padding:8px 0;color:#111;">${phone}</td></tr>
            <tr style="border-top:1px solid #f0f0f0;"><td style="padding:8px 0;color:#999;">Email</td><td style="padding:8px 0;color:#111;">${email}</td></tr>
            <tr style="border-top:1px solid #f0f0f0;"><td style="padding:8px 0;color:#999;">\u041C\u043E\u0434\u0435\u043B\u044C</td><td style="padding:8px 0;color:#111;font-weight:500;">${model}</td></tr>
            <tr style="border-top:1px solid #f0f0f0;"><td style="padding:8px 0;color:#999;">\u0421\u0435\u0440\u0456\u0439\u043D\u0438\u0439 \u043D\u043E\u043C\u0435\u0440</td><td style="padding:8px 0;color:#111;font-family:monospace;">${serialNumber}</td></tr>
            <tr style="border-top:1px solid #f0f0f0;"><td style="padding:8px 0;color:#999;">\u0414\u0430\u0442\u0430 \u043F\u043E\u043A\u0443\u043F\u043A\u0438</td><td style="padding:8px 0;color:#111;">${formattedDate}</td></tr>
            <tr style="border-top:1px solid #f0f0f0;"><td style="padding:8px 0;color:#999;">\u0414\u0430\u0442\u0430 \u0440\u0435\u0454\u0441\u0442\u0440\u0430\u0446\u0456\u0457</td><td style="padding:8px 0;color:#111;">${regDate}</td></tr>
            <tr style="border-top:1px solid #f0f0f0;"><td style="padding:8px 0;color:#999;">\u0413\u0430\u0440\u0430\u043D\u0442\u0456\u044F</td><td style="padding:8px 0;color:#00A86B;font-weight:600;">24 \u043C\u0456\u0441\u044F\u0446\u0456</td></tr>
          </table>
        </div>
        <div style="background:#f0faf5;border:1px solid rgba(0,168,107,0.15);border-radius:10px;padding:16px;margin-bottom:24px;">
          <p style="margin:0;font-size:13px;color:#555;line-height:1.6;">
            <strong style="color:#00A86B;">\u0429\u043E \u0434\u0430\u043B\u0456?</strong><br/>
            \u0417\u0431\u0435\u0440\u0435\u0436\u0456\u0442\u044C PDF-\u0441\u0435\u0440\u0442\u0438\u0444\u0456\u043A\u0430\u0442 \u0437 \u0446\u044C\u043E\u0433\u043E \u043B\u0438\u0441\u0442\u0430 \u2014 \u0432\u0456\u043D \u0437\u043D\u0430\u0434\u043E\u0431\u0438\u0442\u044C\u0441\u044F \u043F\u0440\u0438 \u0437\u0432\u0435\u0440\u043D\u0435\u043D\u043D\u0456 \u0432 \u0441\u0435\u0440\u0432\u0456\u0441.
          </p>
        </div>
      </div>
      <div style="background:#111;padding:16px 24px;text-align:center;">
        <p style="margin:0;color:#666;font-size:11px;">
          \u0422\u041E\u0412 \u00AB\u0414\u0416\u0406\u0415\u0421 \u041A\u041E\u041C\u0424\u041E\u0420\u0422 \u0421\u0406\u0421\u0422\u0415\u041C\u00BB &bull; <a href="https://hecht-service.com.ua" style="color:#888;text-decoration:none;">hecht-service.com.ua</a> &bull; garantiya@hecht-service.com.ua
        </p>
      </div>
    </div>`;

    // Admin notification
    const adminHtml = `
    <div style="font-family:Arial,sans-serif;max-width:500px;">
      <h2 style="color:#E30613;margin:0 0 16px;">\uD83D\uDD14 \u041D\u043E\u0432\u0430 \u0440\u0435\u0454\u0441\u0442\u0440\u0430\u0446\u0456\u044F \u0433\u0430\u0440\u0430\u043D\u0442\u0456\u0457</h2>
      <table style="font-size:14px;border-collapse:collapse;width:100%;">
        <tr><td style="padding:6px 12px 6px 0;color:#999;">\u0421\u0435\u0440\u0442\u0438\u0444\u0456\u043A\u0430\u0442:</td><td style="padding:6px 0;font-weight:700;">${certNumber}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#999;">\u041F\u043E\u043A\u0443\u043F\u0435\u0446\u044C:</td><td style="padding:6px 0;">${firstName} ${lastName}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#999;">\u0422\u0435\u043B\u0435\u0444\u043E\u043D:</td><td style="padding:6px 0;">${phone}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#999;">Email:</td><td style="padding:6px 0;">${email}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#999;">\u041C\u043E\u0434\u0435\u043B\u044C:</td><td style="padding:6px 0;font-weight:500;">${model}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#999;">S/N:</td><td style="padding:6px 0;font-family:monospace;">${serialNumber}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#999;">\u0414\u0430\u0442\u0430 \u043F\u043E\u043A\u0443\u043F\u043A\u0438:</td><td style="padding:6px 0;">${formattedDate}</td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:12px;color:#999;">
        <a href="https://hecht-service.com.ua/admin" style="color:#E30613;">\u0412\u0456\u0434\u043A\u0440\u0438\u0442\u0438 \u0430\u0434\u043C\u0456\u043D-\u043F\u0430\u043D\u0435\u043B\u044C \u2192</a>
      </p>
    </div>`;

    // Email attachments
    const attachments = [];
    if (pdfBuffer) {
      attachments.push({
        filename: 'Hecht-Sertifikat-' + certNumber + '.pdf',
        content: pdfBuffer,
        contentType: 'application/pdf'
      });
    }

    // Send to customer with PDF attached
    await transporter.sendMail({
      from: '"Hecht Service" <garantiya@hecht-service.com.ua>',
      to: email,
      subject: '\u0413\u0430\u0440\u0430\u043D\u0442\u0456\u0439\u043D\u0438\u0439 \u0441\u0435\u0440\u0442\u0438\u0444\u0456\u043A\u0430\u0442 ' + certNumber + ' \u2014 Hecht Service',
      html: customerHtml,
      attachments: attachments,
    });

    // Send notification to admin (also with PDF)
    await transporter.sendMail({
      from: '"Hecht Service" <garantiya@hecht-service.com.ua>',
      to: 'garantiya@hecht-service.com.ua',
      subject: '\uD83D\uDD14 \u041D\u043E\u0432\u0430 \u0440\u0435\u0454\u0441\u0442\u0440\u0430\u0446\u0456\u044F: ' + firstName + ' ' + lastName + ' \u2014 ' + model,
      html: adminHtml,
      attachments: attachments,
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Email error:', error);
    return Response.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
