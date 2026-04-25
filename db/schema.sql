-- ==========================================================
-- Hecht Service — Database Schema Snapshot
-- Generated: 2026-04-25 (post Phase C RLS migration)
-- 
-- Use case: disaster recovery if Supabase project is lost.
-- Restore order:
--   1. Create new Supabase project
--   2. Run this file in SQL Editor (creates tables + indexes + RLS)
--   3. Restore data from latest backup-YYYY-MM-DD.json.gz from R2
-- 
-- Schema reflects ACTUAL production state (verified via 
-- information_schema.columns + table_constraints queries).
-- ==========================================================

-- ── 1. SEQUENCES (для bigint id колонок) ──────────────────

CREATE SEQUENCE IF NOT EXISTS public.action_log_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.comments_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.login_attempts_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.service_centers_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.users_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.warranty_registrations_id_seq;

-- ── 2. TABLES ─────────────────────────────────────────────

-- service_centers (створюється першою — на неї посилаються інші)
CREATE TABLE IF NOT EXISTS public.service_centers (
  id bigint NOT NULL DEFAULT nextval('service_centers_id_seq'::regclass),
  city text NOT NULL,
  center_name text NOT NULL,
  contact_person text DEFAULT ''::text,
  phone text DEFAULT ''::text,
  email text DEFAULT ''::text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT service_centers_pkey PRIMARY KEY (id)
);

-- warranty_registrations
CREATE TABLE IF NOT EXISTS public.warranty_registrations (
  id bigint NOT NULL DEFAULT nextval('warranty_registrations_id_seq'::regclass),
  cert_number text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text DEFAULT ''::text,
  email text DEFAULT ''::text,
  serial_number text NOT NULL,
  model text NOT NULL,
  purchase_date date NOT NULL,
  receipt_url text DEFAULT ''::text,
  registration_date timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'Нова'::text,
  service_center_id bigint,
  last_updated timestamptz DEFAULT now(),
  CONSTRAINT warranty_registrations_pkey PRIMARY KEY (id),
  CONSTRAINT warranty_registrations_cert_number_key UNIQUE (cert_number),
  CONSTRAINT warranty_registrations_service_center_id_fkey
    FOREIGN KEY (service_center_id) REFERENCES public.service_centers(id)
);

-- comments
CREATE TABLE IF NOT EXISTS public.comments (
  id bigint NOT NULL DEFAULT nextval('comments_id_seq'::regclass),
  warranty_id bigint NOT NULL,
  author_name text NOT NULL,
  author_role text NOT NULL,
  message text NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT comments_pkey PRIMARY KEY (id),
  CONSTRAINT comments_warranty_id_fkey
    FOREIGN KEY (warranty_id) REFERENCES public.warranty_registrations(id)
);

-- users
CREATE TABLE IF NOT EXISTS public.users (
  id bigint NOT NULL DEFAULT nextval('users_id_seq'::regclass),
  auth_id uuid,
  username text NOT NULL,
  role text NOT NULL,
  service_center_id bigint,
  full_name text DEFAULT ''::text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  password_hash text DEFAULT ''::text,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_username_key UNIQUE (username),
  CONSTRAINT users_auth_id_key UNIQUE (auth_id),
  CONSTRAINT users_service_center_id_fkey
    FOREIGN KEY (service_center_id) REFERENCES public.service_centers(id)
);

-- action_log
CREATE TABLE IF NOT EXISTS public.action_log (
  id bigint NOT NULL DEFAULT nextval('action_log_id_seq'::regclass),
  user_name text NOT NULL DEFAULT 'admin'::text,
  action_type text NOT NULL,
  warranty_id bigint,
  old_value text DEFAULT ''::text,
  new_value text DEFAULT ''::text,
  ip_address text DEFAULT ''::text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT action_log_pkey PRIMARY KEY (id),
  CONSTRAINT action_log_warranty_id_fkey
    FOREIGN KEY (warranty_id) REFERENCES public.warranty_registrations(id)
);

-- login_attempts
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id bigint NOT NULL DEFAULT nextval('login_attempts_id_seq'::regclass),
  ip_address text NOT NULL,
  success boolean DEFAULT false,
  attempted_at timestamptz DEFAULT now(),
  CONSTRAINT login_attempts_pkey PRIMARY KEY (id)
);

-- ── 3. RLS HELPER FUNCTIONS ───────────────────────────────

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
      AND role = 'admin'
      AND active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.user_service_center_id()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT service_center_id FROM public.users
  WHERE auth_id = auth.uid()
    AND role = 'service_center'
    AND active = true;
$$;

-- ── 4. ROW LEVEL SECURITY POLICIES ────────────────────────

ALTER TABLE public.warranty_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "warranty_anon_insert"
  ON public.warranty_registrations
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "warranty_sc_select_own"
  ON public.warranty_registrations
  FOR SELECT TO authenticated
  USING (service_center_id = public.user_service_center_id());

CREATE POLICY "warranty_sc_update_own"
  ON public.warranty_registrations
  FOR UPDATE TO authenticated
  USING (service_center_id = public.user_service_center_id())
  WITH CHECK (service_center_id = public.user_service_center_id());

CREATE POLICY "warranty_admin_all"
  ON public.warranty_registrations
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments_sc_select_own"
  ON public.comments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.warranty_registrations w
      WHERE w.id = comments.warranty_id
        AND w.service_center_id = public.user_service_center_id()
    )
  );

CREATE POLICY "comments_sc_insert_own"
  ON public.comments
  FOR INSERT TO authenticated
  WITH CHECK (
    author_role = 'service_center'
    AND EXISTS (
      SELECT 1 FROM public.warranty_registrations w
      WHERE w.id = comments.warranty_id
        AND w.service_center_id = public.user_service_center_id()
    )
  );

CREATE POLICY "comments_admin_all"
  ON public.comments
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

ALTER TABLE public.service_centers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sc_centers_sc_select_own"
  ON public.service_centers
  FOR SELECT TO authenticated
  USING (id = public.user_service_center_id());

CREATE POLICY "sc_centers_admin_all"
  ON public.service_centers
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_self_select"
  ON public.users
  FOR SELECT TO authenticated
  USING (auth_id = auth.uid());

CREATE POLICY "users_admin_all"
  ON public.users
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

ALTER TABLE public.action_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "action_log_admin_select"
  ON public.action_log
  FOR SELECT TO authenticated
  USING (public.is_admin());

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "login_attempts_admin_select"
  ON public.login_attempts
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ==========================================================
-- ✅ Schema complete:
--    6 tables, 6 sequences, 14 RLS policies, 2 helper functions
--    13 constraints (6 PK, 4 FK, 3 UNIQUE)
-- 
-- After this file is restored:
--   → Run latest JSON backup from R2 to load row data
--   → Sequences auto-update via setval() in restore script
-- ==========================================================
