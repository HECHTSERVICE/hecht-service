'use client';
import Navbar from '../../components/Navbar';

export default function PravovaPage() {
  const p = { fontSize: 15, color: 'var(--text2)', marginBottom: 14, lineHeight: 1.7 };
  const li = { marginBottom: 6, fontSize: 15, color: 'var(--text2)' };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px 80px' }}>
        <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text3)', textDecoration: 'none', marginBottom: 24 }}>← На головну</a>
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(26px,4vw,36px)', fontWeight: 700, color: 'var(--text)', marginBottom: 6, letterSpacing: '-0.02em' }}>Правова інформація</h1>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 36 }}>Останнє оновлення: 12 квітня 2026</p>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', marginTop: 36, marginBottom: 12 }}>Гарантійні зобов'язання</h2>
        <p style={p}>ТОВ «ДЖІЕС КОМФОРТ СІСТЕМ» надає гарантію на техніку Hecht:</p>
        <ul style={{ paddingLeft: 20, marginBottom: 14 }}>
          <li style={li}><strong style={{color:'var(--text)'}}>Побутове використання:</strong> 24 місяці з дати покупки</li>
          <li style={li}><strong style={{color:'var(--text)'}}>Комерційне використання:</strong> 12 місяців з дати покупки</li>
        </ul>
        <p style={{fontSize:14,color:'var(--text3)',marginBottom:14}}>Гарантія діє за умови використання за призначенням, дотримання інструкції та відсутності механічних пошкоджень.</p>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', marginTop: 36, marginBottom: 12 }}>Нормативна база</h2>
        <ul style={{ paddingLeft: 20, marginBottom: 14 }}>
          <li style={li}><a href="https://zakon.rada.gov.ua/laws/show/3153-20" target="_blank" style={{color:'var(--red)',textDecoration:'none'}}>Закон «Про захист прав споживачів» № 3153-IX</a></li>
          <li style={li}><a href="https://zakon.rada.gov.ua/laws/show/435-15" target="_blank" style={{color:'var(--red)',textDecoration:'none'}}>Цивільний кодекс України № 435-IV</a></li>
          <li style={li}><a href="https://zakon.rada.gov.ua/laws/show/2297-17" target="_blank" style={{color:'var(--red)',textDecoration:'none'}}>Закон «Про захист персональних даних» № 2297-VI</a></li>
        </ul>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', marginTop: 36, marginBottom: 12 }}>Винятки</h2>
        <p style={p}>Гарантія не поширюється на витратні матеріали, пошкодження від неправильної експлуатації, перевантаження або несанкціонованого ремонту.</p>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', marginTop: 36, marginBottom: 12 }}>Контакти</h2>
        <p style={p}>ТОВ «ДЖІЕС КОМФОРТ СІСТЕМ»<br/>Email: <a href="mailto:garantiya@hecht-service.com.ua" style={{color:'var(--red)',textDecoration:'none'}}>garantiya@hecht-service.com.ua</a></p>
      </div>
      <footer style={{ borderTop: '1px solid var(--border)', padding: '28px 24px', textAlign: 'center', fontSize: 11, color: 'var(--text3)' }}>© 2026 hecht-service.com.ua</footer>
    </div>
  );
}
