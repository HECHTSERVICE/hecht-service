import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// ============================================================
// PUBLIC CLIENT (ANON key)
// ------------------------------------------------------------
// Використовується: client-side (браузер), публічна форма гарантії,
// будь-де де користувач анонімний.
// ОБМЕЖЕНИЙ RLS policies — бачить тільки те що policies дозволяють.
// ============================================================
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ============================================================
// ADMIN CLIENT (Service Role key)
// ------------------------------------------------------------
// ⚠️ SERVER-SIDE ONLY — ніколи не імпортувати у client components!
// Обходить RLS — використовувати ТІЛЬКИ в:
//   • app/api/**/*.js (API routes)
//   • Server Actions
//   • Server Components
//
// Функція (а не прямий експорт) — клієнт створюється тільки при
// виклику, що додатково захищає від випадкового виконання на клієнті.
// ============================================================
export function createAdminClient() {
  if (typeof window !== 'undefined') {
    throw new Error(
      'createAdminClient() не може виконуватись у браузері — тільки server-side'
    );
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY не знайдено у env. Перевір Vercel → Settings → Environment Variables'
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
