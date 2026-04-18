'use client';
import Navbar from '../../components/Navbar';

export default function PrivacyPage() {
  const Section = ({ title, children }) => (
    <>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', marginTop: 36, marginBottom: 12 }}>{title}</h2>
      {children}
    </>
  );

  const p = { fontSize: 15, color: 'var(--text2)', marginBottom: 14, lineHeight: 1.7 };
  const li = { marginBottom: 6, fontSize: 15, color: 'var(--text2)' };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px 80px' }}>
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(26px,4vw,36px)', fontWeight: 700, color: 'var(--text)', marginBottom: 6, letterSpacing: '-0.02em' }}>
          Політика конфіденційності
        </h1>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 36 }}>Останнє оновлення: 12 квітня 2026</p>

        <Section title="1. Загальні положення">
          <p style={p}>ТОВ "ДЖІЕС КОМФОРТ СІСТЕМ" поважає Ваше право на конфіденційність і зобов'язується захищати Ваші персональні дані відповідно до Закону України «Про захист персональних даних».</p>
        </Section>

        <Section title="2. Які дані ми збираємо">
          <ul style={{ paddingLeft: 20, marginBottom: 14 }}>
            {['Прізвище, ім\'я', 'Email', 'Телефон', 'Серійний номер виробу', 'Модель техніки', 'Дата покупки', 'Фото чека (необов\'язково)'].map(i => <li key={i} style={li}>{i}</li>)}
          </ul>
        </Section>

        <Section title="3. Мета обробки">
          <ul style={{ paddingLeft: 20, marginBottom: 14 }}>
            {['Реєстрація гарантії на техніку Hecht', 'Надсилання гарантійного сертифіката', 'Зв\'язок у разі гарантійного випадку', 'Виконання вимог законодавства'].map(i => <li key={i} style={li}>{i}</li>)}
          </ul>
        </Section>

        <Section title="4. Правові підстави">
          <p style={p}>Обробка даних здійснюється на підставі Вашої згоди та для виконання договірних зобов'язань.</p>
        </Section>

        <Section title="5. Передача третім особам">
          <p style={p}>Ми не продаємо і не розголошуємо Ваші дані третім особам без Вашої згоди.</p>
        </Section>

        <Section title="6. Строк зберігання">
          <p style={p}>Дані зберігаються протягом строку дії гарантії.</p>
        </Section>

        <Section title="7. Ваші права">
          <ul style={{ paddingLeft: 20, marginBottom: 14 }}>
            {['Доступ до даних', 'Виправлення неточностей', 'Видалення даних', 'Обмеження обробки', 'Відкликання згоди'].map(i => <li key={i} style={li}>{i}</li>)}
          </ul>
          <p style={p}>Запити надсилайте на: <strong style={{ color: 'var(--text)' }}>garantiya@hecht-service.com.ua</strong></p>
        </Section>

        <Section title="8. Безпека">
          <p style={p}>Ми застосовуємо технічні та організаційні заходи для захисту даних від несанкціонованого доступу.</p>
        </Section>

        <Section title="9. Контакти">
          <p style={p}>ТОВ "ДЖІЕС КОМФОРТ СІСТЕМ"<br />Email: <a href="mailto:garantiya@hecht-service.com.ua" style={{ color: 'var(--red)', textDecoration: 'none' }}>garantiya@hecht-service.com.ua</a></p>
        </Section>
      </div>
      <footer style={{ borderTop: '1px solid var(--border)', padding: '28px 24px', textAlign: 'center', fontSize: 11, color: 'var(--text3)' }}>
        © 2026 hecht-service.com.ua
      </footer>
    </div>
  );
}
