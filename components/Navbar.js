'use client';
import ThemeToggle from './ThemeToggle';

export default function Navbar({ title = 'Hecht Service', showShop = true, rightContent }) {
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 100,
      padding: '12px 24px',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      background: 'var(--glass)',
      borderBottom: '1px solid var(--glass-b)',
      transition: 'background 0.4s'
    }}>
      <div style={{
        maxWidth: rightContent ? 1400 : 720,
        margin: '0 auto', display: 'flex',
        justifyContent: 'space-between', alignItems: 'center'
      }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <img src="/hecht-logo.svg" alt="Hecht" style={{ height: 32, objectFit: 'contain' }} />
          {title !== 'Hecht Service' && (
            <span style={{
              fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600,
              fontSize: 15, color: 'var(--text)', opacity: 0.7
            }}>{title}</span>
          )}
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {showShop && (
            <a href="https://hecht.ua" target="_blank" rel="noopener" style={{
              fontSize: 13, color: 'var(--text3)', textDecoration: 'none', fontWeight: 500
            }}>Магазин ↗</a>
          )}
          {rightContent}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
