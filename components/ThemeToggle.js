'use client';
import { useState, useEffect } from 'react';

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.getAttribute('data-theme') === 'dark');
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('hecht-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('hecht-theme', 'light');
    }
  };

  return (
    <button onClick={toggle} style={{
      width: 38, height: 38, borderRadius: 10,
      border: '1px solid var(--border)', background: 'var(--card)',
      cursor: 'pointer', fontSize: 16, color: 'var(--text2)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.3s'
    }}>
      {dark ? '☀️' : '🌙'}
    </button>
  );
}
