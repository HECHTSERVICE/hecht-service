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

  const generateCertNumber = () => {
    const now = new Date();
    return 'HS-' + now.getFullYear() + String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0') + String(now.getHours()).padStart(2,'0') + String(now.getMinutes()).padStart(2,'0') + String(now.getSeconds()).padStart(2,'0');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.consent) { setError('Будь ласка, дайте згоду на обробку персональних даних'); return; }
    setLoading(true); setError('');
    try {
      const cert = generateCertNumber();
      const { data: existing } = await supabase.from('warranty_registrations').select('id').eq('serial_number', formData.serialNumber.toUpperCase()).limit(1);
      if (existing && existing.length > 0) { setError('Цей серійний номер вже зареєстровано раніше!'); setLoading(false); return; }
      const { error: insertError } = await supabase.from('warranty_registrations').insert({
        cert_number: cert, first_name: formData.firstName.trim(), last_name: formData.lastName.trim(),
        phone: formData.phone.trim(), email: formData.email.trim(), serial_number: formData.serialNumber.toUpperCase().trim(),
        model: formData.model.trim(), purchase_date: formData.purchaseDate, status: 'Нова'
      });
      if (insertError) throw insertError;
      setCertNumber(cert); setSubmitted(true);
    } catch (err) { console.error(err); setError('Помилка при реєстрації. Спробуйте пізніше.'); }
    finally { setLoading(false); }
  };

  const inputStyle = (key) => ({
    width: '100%', padding: '14px 16px', fontSize: 15,
    fontFamily: key === 'serialNumber' ? "'Space Mono', monospace" : "'Inter', sans-serif",
    background: 'var(--input)', border: '1px solid ' + (focused === key ? 'var(--red)' : 'var(--border)'),
    borderRadius: 14, color: 'var(--text)', outline: 'none', transition: 'border-color 0.25s', boxSizing: 'border-box'
  });
  const labelStyle = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text2)', marginBottom: 6 };

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 480, width: '100%', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 24, padding: '48px 36px', textAlign: 'center', boxShadow: 'var(--shadow)', animation: 'fadeUp 0.5s ease both' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--green-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: 32, color: 'var(--green)' }}>✓</div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 26, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>Гарантія зареєстрована!</h1>
          <p style={{ fontSize: 15, color: 'var(--text2)', marginBottom: 24, lineHeight: 1.6 }}>Офіційний PDF-сертифікат надіслано на вашу пошту.</p>
          <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)', borderRadius: 14, padding: 16, marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: 'var(--red)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Номер сертифіката</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{certNumber}</div>
          </div>
          <div style={{ background: 'var(--green-bg)', border: '1px solid var(--green-border)', borderRadius: 14, padding: 20, textAlign: 'left', marginBottom: 28 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--green)', marginBottom: 8 }}>Що далі?</div>
            <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, margin: 0 }}>Збережіть лист із сертифікатом — він знадобиться при зверненні в сервіс.</p>
          </div>
          <button onClick={() => { setSubmitted(false); setFormData({ firstName:'',lastName:'',email:'',phone:'',serialNumber:'',model:'',purchaseDate:'',consent:false }); setFileName(''); }} style={{ padding: '13px 28px', background: 'var(--red)', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Зареєструвати ще одну техніку</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '56px 24px 0' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 100, padding: '7px 16px 7px 12px', marginBottom: 24, fontSize: 12, color: 'var(--text3)', fontWeight: 500 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#00A86B', display: 'inline-block' }} />
          Офіційний сервісний центр Hecht в Україні з 2013 року
        </div>
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 16 }}>
          Реєстрація <span style={{ color: 'var(--red)' }}>гарантії</span>
        </h1>
        <p style={{ fontSize: 17, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 44, maxWidth: 540 }}>Гарантія до 24 місяців • Офіційний PDF-сертифікат з QR-кодом • Надсилається на пошту автоматично</p>

        <form onSubmit={handleSubmit} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 24, padding: '40px 32px', boxShadow: 'var(--shadow)', animation: 'fadeUp 0.6s ease both' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 24 }}>Дані покупця</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            {[{key:'firstName',label:"Ім'я",ph:'Олександр'},{key:'lastName',label:'Прізвище',ph:'Шевченко'},{key:'email',label:'Email',ph:'you@email.com',type:'email'},{key:'phone',label:'Телефон',ph:'+380...',type:'tel'}].map(f=>(
              <div key={f.key}><label style={labelStyle}>{f.label} <span style={{color:'var(--red)'}}>*</span></label>
              <input type={f.type||'text'} required placeholder={f.ph} value={formData[f.key]} onChange={e=>setFormData({...formData,[f.key]:e.target.value})} onFocus={()=>setFocused(f.key)} onBlur={()=>setFocused(null)} style={inputStyle(f.key)} /></div>
            ))}
          </div>
          <div style={{ height: 1, background: 'var(--border)', margin: '30px 0' }} />
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 24 }}>Інформація про техніку</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div><label style={labelStyle}>Серійний номер (S/N) <span style={{color:'var(--red)'}}>*</span></label><input type="text" required placeholder="Вказаний на шильді виробу" value={formData.serialNumber} onChange={e=>setFormData({...formData,serialNumber:e.target.value})} onFocus={()=>setFocused('serialNumber')} onBlur={()=>setFocused(null)} style={inputStyle('serialNumber')} /></div>
            <div><label style={labelStyle}>Модель техніки <span style={{color:'var(--red)'}}>*</span></label><input type="text" required placeholder="HECHT 587" value={formData.model} onChange={e=>setFormData({...formData,model:e.target.value})} onFocus={()=>setFocused('model')} onBlur={()=>setFocused(null)} style={inputStyle('model')} /></div>
            <div><label style={labelStyle}>Дата покупки <span style={{color:'var(--red)'}}>*</span></label><input type="date" required value={formData.purchaseDate} onChange={e=>setFormData({...formData,purchaseDate:e.target.value})} onFocus={()=>setFocused('purchaseDate')} onBlur={()=>setFocused(null)} style={inputStyle('purchaseDate')} /></div>
          </div>
          <div style={{ marginTop: 14, marginBottom: 14 }}>
            <label style={labelStyle}>Чек / накладна <span style={{fontSize:11,color:'var(--text3)',fontWeight:400}}>(необов'язково)</span></label>
            <label style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',border:'1.5px dashed var(--border)',borderRadius:14,padding:'28px 20px',cursor:'pointer',background:'var(--input)',textAlign:'center' }}>
              <input type="file" accept=".jpg,.jpeg,.png,.pdf" style={{display:'none'}} onChange={e=>setFileName(e.target.files?.[0]?.name||'')} />
              {fileName ? <span style={{fontSize:14,color:'var(--green)',fontWeight:500}}>📎 {fileName}</span> : <><span style={{fontSize:24,marginBottom:6,opacity:0.4}}>📄</span><span style={{fontSize:14,color:'var(--text2)'}}>Натисніть або перетягніть файл</span><span style={{fontSize:11,color:'var(--text3)',marginTop:4}}>JPG, PNG, PDF — до 5 МБ</span></>}
            </label>
          </div>
          <div style={{ height: 1, background: 'var(--border)', margin: '28px 0' }} />
          <div onClick={()=>setFormData({...formData,consent:!formData.consent})} style={{display:'flex',gap:12,cursor:'pointer',marginBottom:28,alignItems:'flex-start'}}>
            <div style={{ width:22,height:22,minWidth:22,borderRadius:7,border:'1.5px solid '+(formData.consent?'var(--red)':'var(--border)'),background:formData.consent?'var(--red)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.25s',marginTop:1 }}>{formData.consent&&<span style={{color:'#fff',fontSize:13,fontWeight:700}}>✓</span>}</div>
            <span style={{fontSize:13,color:'var(--text2)',lineHeight:1.65}}>Я даю згоду на обробку персональних даних відповідно до <a href="/privacy" style={{color:'var(--red)'}}>Політики конфіденційності</a>. Підтверджую, що інформація достовірна, техніка придбана у офіційного дилера Hecht.</span>
          </div>
          {error && <div style={{background:'var(--red-bg)',border:'1px solid var(--red-border)',borderRadius:12,padding:'12px 16px',marginBottom:16,fontSize:14,color:'var(--red)'}}>{error}</div>}
          <button type="submit" disabled={loading} style={{ width:'100%',padding:'16px',background:loading?'var(--text3)':'var(--red)',color:'#fff',border:'none',borderRadius:14,fontSize:16,fontWeight:600,cursor:loading?'wait':'pointer',opacity:loading?0.7:1 }}>{loading?'Реєстрація...':'Зареєструвати гарантію'}</button>
          <p style={{fontSize:12,color:'var(--text3)',textAlign:'center',marginTop:16}}>Рекомендуємо прикріпити чек — це прискорить обробку гарантії</p>
        </form>

        <footer style={{ padding:'36px 0 56px',textAlign:'center',borderTop:'1px solid var(--border)',marginTop:40 }}>
          <div style={{display:'flex',justifyContent:'center',gap:24,marginBottom:14,flexWrap:'wrap'}}>
            <a href="/privacy" style={{fontSize:12,color:'var(--text3)',textDecoration:'none'}}>Політика конфіденційності</a>
            <a href="/pravova-informatsiya" style={{fontSize:12,color:'var(--text3)',textDecoration:'none'}}>Правова інформація</a>
            <a href="/umovi-pryymky" style={{fontSize:12,color:'var(--text3)',textDecoration:'none'}}>Умови приймання в сервіс</a>
          </div>
          <p style={{fontSize:11,color:'var(--text3)'}}>© 2026 hecht-service.com.ua — Офіційний сервісний центр Hecht в Україні</p>
        </footer>
      </div>
    </div>
  );
}
