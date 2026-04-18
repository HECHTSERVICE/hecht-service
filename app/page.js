'use client';
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
export default function HomePage() {
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    serialNumber: '', model: '', purchaseDate: '', consent: false
  });
  const [submitted, setSubmitted] = useState(false);
  const [certNumber, setCertNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState(null);
  const [fileName, setFileName] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const generateCertNumber = () => {
    const now = new Date();
    return 'HS-' + now.getFullYear()
      + String(now.getMonth() + 1).padStart(2, '0')
      + String(now.getDate()).padStart(2, '0')
      + String(now.getHours()).padStart(2, '0')
      + String(now.getMinutes()).padStart(2, '0')
      + String(now.getSeconds()).padStart(2, '0');
  };
  const generatePDF = async (cert) => {
    setPdfLoading(true);
    try {
      const { jsPDF } = await import('jspdf');
      const QRCode = (await import('qrcode')).default;
      const doc = new jsPDF('p', 'mm', 'a4');
      const w = 210;
      // Try load Cyrillic font
      try {
        const res = await fetch('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.12/fonts/Roboto/Roboto-Regular.ttf');
        const buf = await res.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = ''; for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const b64 = btoa(binary);
        const res2 = await fetch('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.12/fonts/Roboto/Roboto-Medium.ttf');
        const buf2 = await res2.arrayBuffer();
        const bytes2 = new Uint8Array(buf2);
        let binary2 = ''; for (let i = 0; i < bytes2.length; i++) binary2 += String.fromCharCode(bytes2[i]);
        const b64b = btoa(binary2);
        doc.addFileToVFS('Roboto-Regular.ttf', b64);
        doc.addFileToVFS('Roboto-Bold.ttf', b64b);
        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
        doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
        doc.setFont('Roboto', 'normal');
      } catch (fontErr) {
        console.warn('Font load failed, using default', fontErr);
      }
      const setFontSafe = (style) => { try { doc.setFont('Roboto', style); } catch(e) { doc.setFont('helvetica', style); } };
      doc.setFillColor(248, 247, 244);
      doc.rect(0, 0, w, 297, 'F');
      doc.setFillColor(227, 6, 19);
      doc.rect(0, 0, w, 8, 'F');
      setFontSafe('bold');
      doc.setFontSize(28);
      doc.setTextColor(227, 6, 19);
      doc.text('HECHT', w / 2, 30, { align: 'center' });
      setFontSafe('normal');
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.text('made for garden', w / 2, 36, { align: 'center' });
      setFontSafe('bold');
      doc.setFontSize(20);
      doc.setTextColor(17, 17, 17);
      doc.text('\u0413\u0410\u0420\u0410\u041D\u0422\u0406\u0419\u041D\u0418\u0419 \u0421\u0415\u0420\u0422\u0418\u0424\u0406\u041A\u0410\u0422', w / 2, 52, { align: 'center' });
      doc.setFillColor(255, 235, 235);
      doc.roundedRect(55, 57, 100, 14, 4, 4, 'F');
      doc.setFontSize(14);
      doc.setTextColor(227, 6, 19);
      doc.text(cert, w / 2, 66, { align: 'center' });
      doc.setDrawColor(220, 220, 220);
      doc.line(30, 78, 180, 78);
      const startY = 88, labelX = 32, valueX = 85, lineH = 10;
      const fields = [
        { label: '\u041F\u043E\u043A\u0443\u043F\u0435\u0446\u044C:', value: formData.firstName + ' ' + formData.lastName },
        { label: '\u0422\u0435\u043B\u0435\u0444\u043E\u043D:', value: formData.phone },
        { label: 'Email:', value: formData.email },
        { label: '\u041C\u043E\u0434\u0435\u043B\u044C:', value: formData.model },
        { label: '\u0421\u0435\u0440\u0456\u0439\u043D\u0438\u0439 \u043D\u043E\u043C\u0435\u0440:', value: formData.serialNumber.toUpperCase() },
        { label: '\u0414\u0430\u0442\u0430 \u043F\u043E\u043A\u0443\u043F\u043A\u0438:', value: formData.purchaseDate ? new Date(formData.purchaseDate).toLocaleDateString('uk-UA') : '' },
        { label: '\u0414\u0430\u0442\u0430 \u0440\u0435\u0454\u0441\u0442\u0440\u0430\u0446\u0456\u0457:', value: new Date().toLocaleDateString('uk-UA') },
        { label: '\u0413\u0430\u0440\u0430\u043D\u0442\u0456\u044F:', value: '24 \u043C\u0456\u0441\u044F\u0446\u0456 \u0437 \u0434\u0430\u0442\u0438 \u043F\u043E\u043A\u0443\u043F\u043A\u0438' },
      ];
      fields.forEach((f, i) => {
        const y = startY + i * lineH;
        doc.setFontSize(10);
        doc.setTextColor(130, 130, 130);
        setFontSafe('normal');
        doc.text(f.label, labelX, y);
        doc.setTextColor(17, 17, 17);
        setFontSafe('bold');
        doc.text(f.value, valueX, y);
      });
      const afterInfoY = startY + fields.length * lineH + 5;
      doc.setDrawColor(220, 220, 220);
      doc.line(30, afterInfoY, 180, afterInfoY);
      const qrUrl = 'https://hecht-service.com.ua/verify?cert=' + cert;
      const qrDataUrl = await QRCode.toDataURL(qrUrl, { width: 200, margin: 1, color: { dark: '#111111', light: '#F8F7F4' } });
      const qrY = afterInfoY + 8;
      doc.addImage(qrDataUrl, 'PNG', w / 2 - 20, qrY, 40, 40);
      setFontSafe('normal');
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text('\u0421\u043A\u0430\u043D\u0443\u0439\u0442\u0435 \u0434\u043B\u044F \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u043A\u0438 \u0430\u0432\u0442\u0435\u043D\u0442\u0438\u0447\u043D\u043E\u0441\u0442\u0456', w / 2, qrY + 45, { align: 'center' });
      const termsY = qrY + 55;
      doc.setFillColor(240, 240, 238);
      doc.roundedRect(30, termsY, 150, 32, 3, 3, 'F');
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text('\u0413\u0430\u0440\u0430\u043D\u0442\u0456\u044F \u0434\u0456\u0454 \u0437\u0430 \u0443\u043C\u043E\u0432\u0438 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u0430\u043D\u043D\u044F \u0442\u0435\u0445\u043D\u0456\u043A\u0438 \u0437\u0430 \u043F\u0440\u0438\u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044F\u043C \u0442\u0430 \u0434\u043E\u0442\u0440\u0438\u043C\u0430\u043D\u043D\u044F', w / 2, termsY + 7, { align: 'center' });
      doc.text('\u0456\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0456\u0457 \u0437 \u0435\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0456\u0457. \u0413\u0430\u0440\u0430\u043D\u0442\u0456\u044F \u043D\u0435 \u043F\u043E\u0448\u0438\u0440\u044E\u0454\u0442\u044C\u0441\u044F \u043D\u0430 \u0432\u0438\u0442\u0440\u0430\u0442\u043D\u0456 \u043C\u0430\u0442\u0435\u0440\u0456\u0430\u043B\u0438,', w / 2, termsY + 11.5, { align: 'center' });
      doc.text('\u043F\u043E\u0448\u043A\u043E\u0434\u0436\u0435\u043D\u043D\u044F \u0432\u0456\u0434 \u043D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u043E\u0457 \u0435\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0456\u0457 \u0442\u0430 \u043D\u0435\u0441\u0430\u043D\u043A\u0446\u0456\u043E\u043D\u043E\u0432\u0430\u043D\u043E\u0433\u043E \u0440\u0435\u043C\u043E\u043D\u0442\u0443.', w / 2, termsY + 16, { align: 'center' });
      doc.text('\u041F\u043E\u0432\u043D\u0456 \u0443\u043C\u043E\u0432\u0438: hecht-service.com.ua/pravova-informatsiya', w / 2, termsY + 20.5, { align: 'center' });
      doc.setFillColor(227, 6, 19);
      doc.rect(0, 289, w, 8, 'F');
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      doc.text('\u0422\u041E\u0412 \u00AB\u0414\u0416\u0406\u0415\u0421 \u041A\u041E\u041C\u0424\u041E\u0420\u0422 \u0421\u0406\u0421\u0422\u0415\u041C\u00BB \u2022 hecht-service.com.ua \u2022 garantiya@hecht-service.com.ua', w / 2, 294, { align: 'center' });
      // Mobile-friendly download
      const pdfBlob = doc.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'Hecht-Sertifikat-' + cert + '.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    } catch (err) {
      console.error('PDF generation error:', err);
      alert('\u041F\u043E\u043C\u0438\u043B\u043A\u0430 \u0433\u0435\u043D\u0435\u0440\u0430\u0446\u0456\u0457 PDF. \u0421\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0449\u0435 \u0440\u0430\u0437.');
    } finally {
      setPdfLoading(false);
    }
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.consent) {
      setError('\u0411\u0443\u0434\u044C \u043B\u0430\u0441\u043A\u0430, \u0434\u0430\u0439\u0442\u0435 \u0437\u0433\u043E\u0434\u0443 \u043D\u0430 \u043E\u0431\u0440\u043E\u0431\u043A\u0443 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u044C\u043D\u0438\u0445 \u0434\u0430\u043D\u0438\u0445');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const cert = generateCertNumber();
      const { data: existing } = await supabase
        .from('warranty_registrations')
        .select('id')
        .eq('serial_number', formData.serialNumber.toUpperCase())
        .limit(1);
      if (existing && existing.length > 0) {
        setError('\u0426\u0435\u0439 \u0441\u0435\u0440\u0456\u0439\u043D\u0438\u0439 \u043D\u043E\u043C\u0435\u0440 \u0432\u0436\u0435 \u0437\u0430\u0440\u0435\u0454\u0441\u0442\u0440\u043E\u0432\u0430\u043D\u043E \u0440\u0430\u043D\u0456\u0448\u0435!');
        setLoading(false);
        return;
      }
      const { error: insertError } = await supabase
        .from('warranty_registrations')
        .insert({
          cert_number: cert,
          first_name: formData.firstName.trim(),
          last_name: formData.lastName.trim(),
          phone: formData.phone.trim(),
          email: formData.email.trim(),
          serial_number: formData.serialNumber.toUpperCase().trim(),
          model: formData.model.trim(),
          purchase_date: formData.purchaseDate,
          status: '\u041D\u043E\u0432\u0430'
        });
      if (insertError) throw insertError;
      setCertNumber(cert);
      setSubmitted(true);
      fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          certNumber: cert,
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          model: formData.model.trim(),
          serialNumber: formData.serialNumber.toUpperCase().trim(),
          purchaseDate: formData.purchaseDate
        })
      }).catch(err => console.error('Email send error:', err));
    } catch (err) {
      console.error(err);
      setError('\u041F\u043E\u043C\u0438\u043B\u043A\u0430 \u043F\u0440\u0438 \u0440\u0435\u0454\u0441\u0442\u0440\u0430\u0446\u0456\u0457. \u0421\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u043F\u0456\u0437\u043D\u0456\u0448\u0435.');
    } finally {
      setLoading(false);
    }
  };
  const inputStyle = (key) => ({
    width: '100%', padding: '14px 16px', fontSize: 15,
    fontFamily: key === 'serialNumber' ? "'Space Mono', monospace" : "'Inter', sans-serif",
    background: 'var(--input)', border: '1px solid ' + (focused === key ? 'var(--red)' : 'var(--border)'),
    borderRadius: 14, color: 'var(--text)', outline: 'none',
    transition: 'border-color 0.25s', boxSizing: 'border-box',
    letterSpacing: key === 'serialNumber' ? '0.03em' : 'normal'
  });
  const labelStyle = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text2)', marginBottom: 6 };
  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, transition: 'background 0.4s' }}>
        <div style={{
          maxWidth: 480, width: '100%', background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 24, padding: '48px 36px', textAlign: 'center',
          boxShadow: 'var(--shadow)', animation: 'fadeUp 0.5s ease both', transition: 'all 0.4s'
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%', background: 'var(--green-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px', fontSize: 32, color: 'var(--green)'
          }}>✓</div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 26, fontWeight: 700, color: 'var(--text)', marginBottom: 10, letterSpacing: '-0.02em' }}>
            Гарантія зареєстрована!
          </h1>
          <p style={{ fontSize: 15, color: 'var(--text2)', marginBottom: 24, lineHeight: 1.6 }}>
            Завантажте PDF-сертифікат з QR-кодом — він знадобиться при зверненні в сервіс.
          </p>
          <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)', borderRadius: 14, padding: 16, marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: 'var(--red)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Номер сертифіката</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '0.03em' }}>{certNumber}</div>
          </div>
          <button onClick={() => generatePDF(certNumber)} disabled={pdfLoading} style={{
            width: '100%', padding: '14px', background: 'var(--red)', color: '#fff', border: 'none',
            borderRadius: 12, fontWeight: 600, fontSize: 15, cursor: pdfLoading ? 'wait' : 'pointer',
            fontFamily: "'Inter', sans-serif", marginBottom: 12, opacity: pdfLoading ? 0.7 : 1
          }}>
            {pdfLoading ? 'Генерація...' : '📄 Завантажити PDF-сертифікат'}
          </button>
          <div style={{ background: 'var(--green-bg)', border: '1px solid var(--green-border)', borderRadius: 14, padding: 20, textAlign: 'left', marginBottom: 28 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--green)', marginBottom: 8 }}>Що далі?</div>
            <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, margin: 0 }}>
              Збережіть PDF-сертифікат — він знадобиться при зверненні в сервіс. Гарантія діє з дати покупки.
            </p>
          </div>
          <button onClick={() => { setSubmitted(false); setFormData({ firstName: '', lastName: '', email: '', phone: '', serialNumber: '', model: '', purchaseDate: '', consent: false }); setFileName(''); }} style={{
            padding: '13px 28px', background: 'transparent', color: 'var(--text2)', border: '1px solid var(--border)',
            borderRadius: 12, fontWeight: 500, fontSize: 14, cursor: 'pointer', fontFamily: "'Inter', sans-serif"
          }}>
            Зареєструвати ще одну техніку
          </button>
        </div>
        <p style={{ marginTop: 32, fontSize: 11, color: 'var(--text3)' }}>© 2026 hecht-service.com.ua</p>
      </div>
    );
  }
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', transition: 'background 0.4s' }}>
      <Navbar />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '56px 24px 0' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 100, padding: '7px 16px 7px 12px',
          marginBottom: 24, fontSize: 12, color: 'var(--text3)', fontWeight: 500,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#00A86B', display: 'inline-block' }} />
          Офіційний сервісний центр Hecht в Україні з 2013 року
        </div>
        <h1 style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 700,
          color: 'var(--text)', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 16
        }}>
          Реєстрація <span style={{ color: 'var(--red)' }}>гарантії</span>
        </h1>
        <p style={{ fontSize: 17, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 44, maxWidth: 540 }}>
          Гарантія до 24 місяців • Офіційний PDF-сертифікат з QR-кодом • Надсилається на пошту автоматично
        </p>
        <form onSubmit={handleSubmit} style={{
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 24, padding: '40px 32px',
          boxShadow: 'var(--shadow)', animation: 'fadeUp 0.6s ease both'
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 24 }}>
            Дані покупця
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            {[
              { key: 'firstName', label: "Ім'я", ph: 'Олександр' },
              { key: 'lastName', label: 'Прізвище', ph: 'Шевченко' },
              { key: 'email', label: 'Email', ph: 'you@email.com', type: 'email' },
              { key: 'phone', label: 'Телефон', ph: '+380...', type: 'tel' },
            ].map(f => (
              <div key={f.key}>
                <label style={labelStyle}>{f.label} <span style={{ color: 'var(--red)' }}>*</span></label>
                <input type={f.type || 'text'} required placeholder={f.ph}
                  value={formData[f.key]}
                  onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
                  onFocus={() => setFocused(f.key)} onBlur={() => setFocused(null)}
                  style={inputStyle(f.key)} />
              </div>
            ))}
          </div>
          <div style={{ height: 1, background: 'var(--border)', margin: '30px 0' }} />
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 24 }}>
            Інформація про техніку
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Серійний номер (S/N) <span style={{ color: 'var(--red)' }}>*</span></label>
              <input type="text" required placeholder="Вказаний на шильді виробу"
                value={formData.serialNumber}
                onChange={e => setFormData({ ...formData, serialNumber: e.target.value })}
                onFocus={() => setFocused('serialNumber')} onBlur={() => setFocused(null)}
                style={inputStyle('serialNumber')} />
            </div>
            <div>
              <label style={labelStyle}>Модель техніки <span style={{ color: 'var(--red)' }}>*</span></label>
              <input type="text" required placeholder="HECHT 587"
                value={formData.model}
                onChange={e => setFormData({ ...formData, model: e.target.value })}
                onFocus={() => setFocused('model')} onBlur={() => setFocused(null)}
                style={inputStyle('model')} />
            </div>
            <div>
              <label style={labelStyle}>Дата покупки <span style={{ color: 'var(--red)' }}>*</span></label>
              <input type="date" required
                value={formData.purchaseDate}
                onChange={e => setFormData({ ...formData, purchaseDate: e.target.value })}
                onFocus={() => setFocused('purchaseDate')} onBlur={() => setFocused(null)}
                style={inputStyle('purchaseDate')} />
            </div>
          </div>
          <div style={{ marginTop: 14, marginBottom: 14 }}>
            <label style={labelStyle}>Чек / накладна <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}>(необов'язково)</span></label>
            <label style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              border: '1.5px dashed var(--border)', borderRadius: 14, padding: '28px 20px',
              cursor: 'pointer', background: 'var(--input)', textAlign: 'center'
            }}>
              <input type="file" accept=".jpg,.jpeg,.png,.pdf" style={{ display: 'none' }}
                onChange={e => setFileName(e.target.files?.[0]?.name || '')} />
              {fileName ? (
                <span style={{ fontSize: 14, color: 'var(--green)', fontWeight: 500 }}>📎 {fileName}</span>
              ) : (
                <>
                  <span style={{ fontSize: 24, marginBottom: 6, opacity: 0.4 }}>📄</span>
                  <span style={{ fontSize: 14, color: 'var(--text2)' }}>Натисніть або перетягніть файл</span>
                  <span style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>JPG, PNG, PDF — до 5 МБ</span>
                </>
              )}
            </label>
          </div>
          <div style={{ height: 1, background: 'var(--border)', margin: '28px 0' }} />
          <div onClick={() => setFormData({ ...formData, consent: !formData.consent })}
            style={{ display: 'flex', gap: 12, cursor: 'pointer', marginBottom: 28, alignItems: 'flex-start' }}>
            <div style={{
              width: 22, height: 22, minWidth: 22, borderRadius: 7,
              border: '1.5px solid ' + (formData.consent ? 'var(--red)' : 'var(--border)'),
              background: formData.consent ? 'var(--red)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.25s', marginTop: 1
            }}>
              {formData.consent && <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>✓</span>}
            </div>
            <span style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.65 }}>
              Я даю згоду на обробку персональних даних відповідно до{' '}
              <a href="/privacy" style={{ color: 'var(--red)' }}>Політики конфіденційності</a>.
              Підтверджую, що інформація достовірна, техніка придбана у офіційного дилера Hecht.
            </span>
          </div>
          {error && (
            <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 14, color: 'var(--red)' }}>
              {error}
            </div>
          )}
          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '16px', background: loading ? 'var(--text3)' : 'var(--red)',
            color: '#fff', border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 600,
            cursor: loading ? 'wait' : 'pointer', fontFamily: "'Inter', sans-serif",
            transition: 'all 0.3s', opacity: loading ? 0.7 : 1
          }}>
            {loading ? 'Реєстрація...' : 'Зареєструвати гарантію'}
          </button>
          <p style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', marginTop: 16 }}>
            Рекомендуємо прикріпити чек — це прискорить обробку гарантії
          </p>
        </form>
        <footer style={{ padding: '36px 0 56px', textAlign: 'center', borderTop: '1px solid var(--border)', marginTop: 40 }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 14, flexWrap: 'wrap' }}>
            <a href="/privacy" style={{ fontSize: 12, color: 'var(--text3)', textDecoration: 'none' }}>Політика конфіденційності</a>
            <a href="/pravova-informatsiya" style={{ fontSize: 12, color: 'var(--text3)', textDecoration: 'none' }}>Правова інформація</a>
            <a href="/umovi-pryymky" style={{ fontSize: 12, color: 'var(--text3)', textDecoration: 'none' }}>Умови приймання в сервіс</a>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text3)' }}>© 2026 hecht-service.com.ua — Офіційний сервісний центр Hecht в Україні</p>
        </footer>
      </div>
    </div>
  );
}
