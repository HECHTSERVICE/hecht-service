'use client';
import Navbar from '../../components/Navbar';

export default function UmoviPage() {
  const p = { fontSize: 15, color: 'var(--text2)', marginBottom: 14, lineHeight: 1.7 };
  const li = { marginBottom: 6, fontSize: 15, color: 'var(--text2)' };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px 80px' }}>
        <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text3)', textDecoration: 'none', marginBottom: 24 }}>← На головну</a>
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(26px,4vw,36px)', fontWeight: 700, color: 'var(--text)', marginBottom: 6, letterSpacing: '-0.02em' }}>Умови приймання в сервіс</h1>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 36 }}>Останнє оновлення: 12 квітня 2026</p>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', marginTop: 36, marginBottom: 12 }}>1. Загальні положення</h2>
        <p style={p}>ТОВ «ДЖІЕС КОМФОРТ СІСТЕМ» приймає техніку Hecht для діагностики та ремонту відповідно до Закону «Про захист прав споживачів».</p>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', marginTop: 36, marginBottom: 12 }}>2. Умови приймання</h2>
        <ul style={{ paddingLeft: 20, marginBottom: 14 }}>{['Товар чистий, сухий, без забруднень','Максимально можлива заводська комплектація','Без механічних пошкоджень від неправильної експлуатації','Наявний документ про придбання (чек, накладна, сертифікат)','Чіткий опис проблеми'].map(i=><li key={i} style={li}>{i}</li>)}</ul>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', marginTop: 36, marginBottom: 12 }}>3. Відмова у прийманні</h2>
        <ul style={{ paddingLeft: 20, marginBottom: 14 }}>{['Сильне забруднення або неприємний запах','Сліди самостійного ремонту','Пошкоджений або нечитабельний серійний номер','Ознаки використання не за призначенням','Відсутність документів'].map(i=><li key={i} style={li}>{i}</li>)}</ul>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', marginTop: 36, marginBottom: 12 }}>4. Діагностика</h2>
        <p style={p}>Проводиться протягом 3 робочих днів. Клієнт отримує висновок про причину та вартість ремонту.</p>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', marginTop: 36, marginBottom: 12 }}>5. Відповідальність</h2>
        <p style={p}>Клієнт відповідає за достовірність інформації. Сервісний центр відповідає за збереження товару під час ремонту.</p>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', marginTop: 36, marginBottom: 12 }}>Контакти</h2>
        <p style={p}>ТОВ «ДЖІЕС КОМФОРТ СІСТЕМ»<br/>Email: <a href="mailto:garantiya@hecht-service.com.ua" style={{color:'var(--red)',textDecoration:'none'}}>garantiya@hecht-service.com.ua</a></p>
      </div>
      <footer style={{ borderTop: '1px solid var(--border)', padding: '28px 24px', textAlign: 'center', fontSize: 11, color: 'var(--text3)' }}>© 2026 hecht-service.com.ua</footer>
    </div>
  );
}
