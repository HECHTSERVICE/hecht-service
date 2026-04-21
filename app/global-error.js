'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="uk">
      <body style={{
        fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif",
        padding: '40px 20px',
        maxWidth: '560px',
        margin: '80px auto',
        textAlign: 'center',
        backgroundColor: '#FAF7F0',
        color: '#1A1A1A',
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 14px',
          background: 'rgba(227, 6, 19, 0.08)',
          color: '#E30613',
          borderRadius: '100px',
          fontSize: '13px',
          fontWeight: 500,
          marginBottom: '24px',
        }}>
          Критична помилка
        </div>
        <h1 style={{
          fontSize: '36px',
          fontWeight: 700,
          color: '#1A1A1A',
          marginBottom: '16px',
          letterSpacing: '-0.02em',
          lineHeight: 1.2,
        }}>
          Щось пішло не так
        </h1>
        <p style={{
          fontSize: '16px',
          color: '#4A4A4A',
          marginBottom: '32px',
          lineHeight: 1.6,
        }}>
          Вибачте за незручність — ми вже отримали сповіщення про помилку і працюємо над її виправленням.
        </p>
        <button
          onClick={() => reset()}
          style={{
            background: '#E30613',
            color: '#FFFFFF',
            border: 'none',
            padding: '14px 32px',
            borderRadius: '12px',
            fontSize: '15px',
            fontWeight: 500,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(227, 6, 19, 0.2)',
          }}
        >
          Спробувати ще раз
        </button>
        <p style={{
          marginTop: '32px',
          fontSize: '14px',
          color: '#888780',
        }}>
          Якщо проблема повторюється, зателефонуйте:{' '}
          
            href="tel:+380997005581"
            style={{ color: '#E30613', textDecoration: 'none', fontWeight: 500 }}
          >
            +380 99 700 55 81
          </a>
        </p>
      </body>
    </html>
  );
}
