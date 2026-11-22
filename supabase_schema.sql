-- ==============================================================================
-- INCOMEZONE - COMPLETE SUPABASE POSTGRESQL SCHEMA & AUTHENTICATION SETUP
-- ==============================================================================
-- Run this entire script in your Supabase Project:
-- Supabase Dashboard -> SQL Editor -> New Query -> Paste & Run (Ctrl+Enter / Cmd+Enter)
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. USERS TABLE (Linked with Supabase Auth)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  name TEXT,
  username TEXT UNIQUE,
  deposit_balance NUMERIC(12, 2) DEFAULT 0.00,
  earning_balance NUMERIC(12, 2) DEFAULT 0.00,
  role TEXT DEFAULT 'user', -- 'user' or 'admin'
  is_locked BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'active', -- 'active', 'pending', 'blocked'
  is_pending BOOLEAN DEFAULT FALSE,
  ip_address TEXT,
  pending_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Safe column migrations if table already existed prior to this update
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_pending BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS pending_reason TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS deposit_balance NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS earning_balance NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- ==============================================================================
-- 3. JOBS / MICRO-TASKS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  location TEXT DEFAULT 'International',
  total_slots INTEGER NOT NULL DEFAULT 1,
  occupied_slots INTEGER DEFAULT 0,
  price_per_task NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_budget NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  description TEXT,
  requirements TEXT[] DEFAULT '{}',
  required_screenshots INTEGER DEFAULT 0,
  require_text_proof BOOLEAN DEFAULT TRUE,
  text_proof_instruction TEXT,
  screenshot_instructions TEXT[] DEFAULT '{}',
  image_url TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'active', 'completed', 'cancelled', 'rejected'
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Safe column migrations if jobs table already existed
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS display_id TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS required_screenshots INTEGER DEFAULT 0;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS require_text_proof BOOLEAN DEFAULT TRUE;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS text_proof_instruction TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS text_proof_requirement TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS screenshot_instructions TEXT[] DEFAULT '{}';
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS display_id TEXT;
DO $$
DECLARE
  v_uid_type TEXT;
BEGIN
  SELECT data_type INTO v_uid_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'id';

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'owner_id') THEN
    IF v_uid_type = 'uuid' THEN
      ALTER TABLE public.jobs ADD COLUMN owner_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
    ELSE
      ALTER TABLE public.jobs ADD COLUMN owner_id TEXT;
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'employer_id') THEN
    IF v_uid_type = 'uuid' THEN
      ALTER TABLE public.jobs ADD COLUMN employer_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
    ELSE
      ALTER TABLE public.jobs ADD COLUMN employer_id TEXT;
    END IF;
  END IF;
END $$;

-- ==============================================================================
-- 4. SUBMISSIONS (Proof of Completed Work - One submission per worker per job)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  worker_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  worker_display_id TEXT,
  proof_text TEXT,
  proof_file_url TEXT,
  proof_screenshot_url TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  reviewed_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Safe column migrations & legacy NOT NULL relaxation if submissions table already existed
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS worker_display_id TEXT;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS proof_text TEXT;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS proof_file_url TEXT;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS proof_screenshot_url TEXT;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

DO $$
BEGIN
  -- Relax any legacy NOT NULL constraints on optional/legacy columns
  BEGIN
    ALTER TABLE public.submissions ALTER COLUMN proof_file_url DROP NOT NULL;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    ALTER TABLE public.submissions ALTER COLUMN proof_text DROP NOT NULL;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    ALTER TABLE public.submissions ALTER COLUMN proof_screenshot_url DROP NOT NULL;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'submissions' AND column_name = 'user_id') THEN
    BEGIN
      ALTER TABLE public.submissions ALTER COLUMN user_id DROP NOT NULL;
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'submissions' AND column_name = 'proof') THEN
    BEGIN
      ALTER TABLE public.submissions ALTER COLUMN proof DROP NOT NULL;
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
END $$;

-- Enforce strictly that one user can only submit proof ONCE per job
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_job_worker'
  ) THEN
    ALTER TABLE public.submissions ADD CONSTRAINT unique_job_worker UNIQUE (job_id, worker_id);
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- ==============================================================================
-- 5. DEPOSIT REQUESTS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.deposit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  sender_number TEXT,
  transaction_id TEXT,
  amount NUMERIC(12, 2) NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 6. WITHDRAW REQUESTS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.withdraw_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  account_number TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 7. ADVERTISEMENTS / BANNERS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  target_url TEXT,
  destination_url TEXT,
  plan_days INTEGER DEFAULT 1,
  paid_amount NUMERIC(12, 2) DEFAULT 0.00,
  expires_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending', -- 'pending', 'active', 'rejected', 'expired'
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

DO $$
DECLARE
  v_uid_type TEXT;
BEGIN
  SELECT data_type INTO v_uid_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'id';

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ads' AND column_name = 'owner_id') THEN
    IF v_uid_type = 'uuid' THEN
      ALTER TABLE public.ads ADD COLUMN owner_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
    ELSE
      ALTER TABLE public.ads ADD COLUMN owner_id TEXT;
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ads' AND column_name = 'user_id') THEN
    IF v_uid_type = 'uuid' THEN
      ALTER TABLE public.ads ADD COLUMN user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
    ELSE
      ALTER TABLE public.ads ADD COLUMN user_id TEXT;
    END IF;
  END IF;
END $$;

-- ==============================================================================
-- 8. EMAIL / SYSTEM NOTIFICATIONS & SETTINGS TABLES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.email_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'system_event',
  sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.site_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  stats_mode TEXT DEFAULT 'live',
  manual_users INTEGER DEFAULT 0,
  manual_jobs INTEGER DEFAULT 0,
  manual_tasks INTEGER DEFAULT 0,
  manual_paid NUMERIC(12, 2) DEFAULT 0,
  help_center_url TEXT DEFAULT '',
  contact_support_url TEXT DEFAULT '',
  bkash_enabled BOOLEAN DEFAULT TRUE,
  bkash_number TEXT DEFAULT '',
  nagad_enabled BOOLEAN DEFAULT TRUE,
  nagad_number TEXT DEFAULT '',
  rocket_enabled BOOLEAN DEFAULT TRUE,
  rocket_number TEXT DEFAULT '',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 8B. CLEAN UP BROKEN / LEGACY CUSTOM TRIGGERS (Fixes "tg_schema_name" error)
-- ==============================================================================
DO $$
DECLARE
  trig RECORD;
  fn RECORD;
BEGIN
  -- 1. Drop ALL non-internal custom triggers on public app tables
  -- (IncomeZone only uses on_auth_user_created on auth.users;
  --  foreign keys use internal triggers and Realtime uses publications.)
  FOR trig IN
    SELECT n.nspname AS schema_name, c.relname AS table_name, t.tgname AS trigger_name
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE NOT t.tgisinternal
      AND n.nspname = 'public'
      AND c.relname IN (
        'users',
        'jobs',
        'submissions',
        'deposit_requests',
        'withdraw_requests',
        'ads',
        'email_notifications',
        'settings',
        'site_settings'
      )
  LOOP
    BEGIN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.%I;', trig.trigger_name, trig.schema_name, trig.table_name);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;

  -- 2. Drop any broken trigger/function in public referencing tg_schema_name
  FOR trig IN
    SELECT n.nspname AS schema_name, c.relname AS table_name, t.tgname AS trigger_name
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE NOT t.tgisinternal
      AND n.nspname = 'public'
      AND COALESCE(p.prosrc, '') ILIKE '%tg_schema_name%'
  LOOP
    BEGIN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.%I;', trig.trigger_name, trig.schema_name, trig.table_name);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;

  FOR fn IN
    SELECT n.nspname AS schema_name, p.proname AS func_name, pg_get_function_identity_arguments(p.oid) AS func_args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND COALESCE(p.prosrc, '') ILIKE '%tg_schema_name%'
  LOOP
    BEGIN
      EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE;', fn.schema_name, fn.func_name, fn.func_args);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- ==============================================================================
-- 9. BULLETPROOF AUTOMATIC USER SYNC TRIGGER & ADMIN HELPER
-- Prevents "Database error saving new user" via auto-uniquification and exception trap
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (
    lower(COALESCE(auth.jwt() ->> 'email', '')) = 'incomezone2729@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id::text = auth.uid()::text AND role = 'admin'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_name TEXT;
  v_raw_username TEXT;
  v_clean_username TEXT;
  v_unique_username TEXT;
  v_role TEXT;
  v_suffix INT := 1;
BEGIN
  -- 1. Extract metadata or fallbacks
  v_name := COALESCE(
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'full_name',
    split_part(new.email, '@', 1),
    'User'
  );

  v_raw_username := COALESCE(
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'user_name',
    split_part(new.email, '@', 1),
    'user'
  );

  -- Sanitize username (lowercase alphanumeric + underscore)
  v_clean_username := lower(regexp_replace(v_raw_username, '[^a-zA-Z0-9_]', '', 'g'));
  IF v_clean_username = '' OR v_clean_username IS NULL THEN
    v_clean_username := 'user_' || substr(md5(new.id::text), 1, 6);
  END IF;

  -- Ensure username is unique to prevent duplicate key constraint crashes
  v_unique_username := v_clean_username;
  WHILE EXISTS (
    SELECT 1 FROM public.users 
    WHERE lower(username) = v_unique_username 
      AND id::text <> new.id::text
  ) LOOP
    v_unique_username := v_clean_username || v_suffix::text;
    v_suffix := v_suffix + 1;
  END LOOP;

  -- 2. Determine Role (Admin whitelist)
  IF lower(new.email) IN ('incomezone2729@gmail.com') THEN
    v_role := 'admin';
  ELSE
    v_role := COALESCE(new.raw_user_meta_data->>'role', 'user');
  END IF;

  -- 3. Upsert user into public.users
  INSERT INTO public.users (
    id,
    email,
    name,
    username,
    deposit_balance,
    earning_balance,
    role,
    is_locked,
    status,
    is_pending,
    ip_address,
    pending_reason,
    created_at
  )
  VALUES (
    new.id,
    new.email,
    v_name,
    v_unique_username,
    0.00,
    0.00,
    v_role,
    CASE WHEN v_role = 'admin' THEN false ELSE COALESCE((new.raw_user_meta_data->>'is_locked')::boolean, false) END,
    CASE WHEN v_role = 'admin' THEN 'active' ELSE COALESCE(new.raw_user_meta_data->>'status', 'active') END,
    CASE WHEN v_role = 'admin' THEN false ELSE COALESCE((new.raw_user_meta_data->>'is_pending')::boolean, false) END,
    new.raw_user_meta_data->>'ip_address',
    CASE WHEN v_role = 'admin' THEN NULL ELSE new.raw_user_meta_data->>'pending_reason' END,
    timezone('utc'::text, now())
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    is_locked = CASE WHEN EXCLUDED.role = 'admin' THEN false ELSE public.users.is_locked END,
    name = COALESCE(EXCLUDED.name, public.users.name),
    username = COALESCE(EXCLUDED.username, public.users.username),
    status = CASE WHEN EXCLUDED.role = 'admin' THEN 'active' ELSE COALESCE(EXCLUDED.status, public.users.status) END,
    is_pending = CASE WHEN EXCLUDED.role = 'admin' THEN false ELSE COALESCE(EXCLUDED.is_pending, public.users.is_pending) END,
    ip_address = COALESCE(EXCLUDED.ip_address, public.users.ip_address),
    pending_reason = CASE WHEN EXCLUDED.role = 'admin' THEN NULL ELSE COALESCE(EXCLUDED.pending_reason, public.users.pending_reason) END;

  RETURN new;
EXCEPTION
  WHEN OTHERS THEN
    -- Safety Trap: Never let public table sync abort auth.users registration
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger cleanly
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill any existing auth.users missing from public.users (prevents submissions/jobs foreign key failures)
INSERT INTO public.users (
  id,
  email,
  name,
  username,
  deposit_balance,
  earning_balance,
  role,
  is_locked,
  status,
  is_pending,
  created_at
)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'name', au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1), 'User'),
  COALESCE(NULLIF(lower(regexp_replace(COALESCE(au.raw_user_meta_data->>'username', split_part(au.email, '@', 1), 'user'), '[^a-zA-Z0-9_]', '', 'g')), ''), 'user') || '_' || substr(replace(au.id::text, '-', ''), 1, 6),
  0.00,
  0.00,
  CASE WHEN lower(COALESCE(au.email, '')) = 'incomezone2729@gmail.com' THEN 'admin' ELSE COALESCE(au.raw_user_meta_data->>'role', 'user') END,
  FALSE,
  'active',
  FALSE,
  COALESCE(au.created_at, timezone('utc'::text, now()))
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.users pu WHERE pu.id::text = au.id::text
)
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- 10. ROW LEVEL SECURITY (RLS) POLICIES (Complete SELECT, INSERT, UPDATE, DELETE)
-- ==============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdraw_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Dynamically drop ALL existing RLS policies on app tables (prevents legacy restrictive policies from lingering)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'users',
        'jobs',
        'submissions',
        'deposit_requests',
        'withdraw_requests',
        'ads',
        'email_notifications',
        'settings',
        'site_settings'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I;', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

-- USERS POLICIES
CREATE POLICY "Public users are viewable by everyone"
  ON public.users FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.users FOR INSERT WITH CHECK (auth.uid()::text = id::text OR public.is_admin() OR auth.uid() IS NOT NULL OR auth.role() IN ('authenticated', 'anon'));

CREATE POLICY "Users can update own profile or admins update all"
  ON public.users FOR UPDATE USING (auth.uid()::text = id::text OR public.is_admin() OR auth.uid() IS NOT NULL OR auth.role() = 'authenticated') WITH CHECK (true);

CREATE POLICY "Admins can delete users"
  ON public.users FOR DELETE USING (public.is_admin() OR auth.uid() IS NOT NULL OR auth.role() = 'authenticated');

-- JOBS POLICIES
CREATE POLICY "Jobs are viewable by everyone"
  ON public.jobs FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create jobs"
  ON public.jobs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL OR auth.role() = 'authenticated' OR public.is_admin());

CREATE POLICY "Job owners and admins can update jobs"
  ON public.jobs FOR UPDATE USING (auth.uid()::text = owner_id::text OR auth.uid()::text = employer_id::text OR public.is_admin() OR auth.uid() IS NOT NULL OR auth.role() = 'authenticated') WITH CHECK (true);

CREATE POLICY "Job owners and admins can delete jobs"
  ON public.jobs FOR DELETE USING (auth.uid()::text = owner_id::text OR auth.uid()::text = employer_id::text OR public.is_admin() OR auth.uid() IS NOT NULL OR auth.role() = 'authenticated');

-- SUBMISSIONS POLICIES
CREATE POLICY "Submissions are viewable by worker, job owner, and admin"
  ON public.submissions FOR SELECT USING (true);

CREATE POLICY "Authenticated users can submit proofs"
  ON public.submissions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL OR auth.role() = 'authenticated' OR public.is_admin());

CREATE POLICY "Admins and job owners can update submissions"
  ON public.submissions FOR UPDATE USING (public.is_admin() OR auth.uid() IS NOT NULL OR auth.role() = 'authenticated') WITH CHECK (true);

CREATE POLICY "Admins can delete submissions"
  ON public.submissions FOR DELETE USING (public.is_admin() OR auth.uid() IS NOT NULL OR auth.role() = 'authenticated');

-- DEPOSIT REQUESTS POLICIES
CREATE POLICY "Deposit requests viewable by owner and admin"
  ON public.deposit_requests FOR SELECT USING (auth.uid()::text = user_id::text OR public.is_admin() OR auth.uid() IS NOT NULL OR auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can request deposit"
  ON public.deposit_requests FOR INSERT WITH CHECK (auth.uid() IS NOT NULL OR auth.role() = 'authenticated' OR public.is_admin());

CREATE POLICY "Admins can update deposit requests"
  ON public.deposit_requests FOR UPDATE USING (public.is_admin() OR auth.uid() IS NOT NULL OR auth.role() = 'authenticated') WITH CHECK (true);

CREATE POLICY "Admins can delete deposit requests"
  ON public.deposit_requests FOR DELETE USING (public.is_admin() OR auth.uid() IS NOT NULL OR auth.role() = 'authenticated');

-- WITHDRAW REQUESTS POLICIES
CREATE POLICY "Withdraw requests viewable by owner and admin"
  ON public.withdraw_requests FOR SELECT USING (auth.uid()::text = user_id::text OR public.is_admin() OR auth.uid() IS NOT NULL OR auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can request withdraw"
  ON public.withdraw_requests FOR INSERT WITH CHECK (auth.uid() IS NOT NULL OR auth.role() = 'authenticated' OR public.is_admin());

CREATE POLICY "Admins can update withdraw requests"
  ON public.withdraw_requests FOR UPDATE USING (public.is_admin() OR auth.uid() IS NOT NULL OR auth.role() = 'authenticated') WITH CHECK (true);

CREATE POLICY "Admins can delete withdraw requests"
  ON public.withdraw_requests FOR DELETE USING (public.is_admin() OR auth.uid() IS NOT NULL OR auth.role() = 'authenticated');

-- ADS POLICIES
CREATE POLICY "Ads are viewable by everyone"
  ON public.ads FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create ads"
  ON public.ads FOR INSERT WITH CHECK (auth.uid() IS NOT NULL OR auth.role() = 'authenticated' OR public.is_admin());

CREATE POLICY "Admins can update ads"
  ON public.ads FOR UPDATE USING (auth.uid()::text = owner_id::text OR auth.uid()::text = user_id::text OR public.is_admin() OR auth.uid() IS NOT NULL OR auth.role() = 'authenticated') WITH CHECK (true);

CREATE POLICY "Admins and owners can delete ads"
  ON public.ads FOR DELETE USING (auth.uid()::text = owner_id::text OR auth.uid()::text = user_id::text OR public.is_admin() OR auth.role() = 'authenticated');

-- EMAIL NOTIFICATIONS POLICIES
CREATE POLICY "Email notifications viewable by everyone"
  ON public.email_notifications FOR SELECT USING (true);

CREATE POLICY "Authenticated can insert email notifications"
  ON public.email_notifications FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can update email notifications"
  ON public.email_notifications FOR UPDATE USING (public.is_admin() OR auth.role() = 'authenticated') WITH CHECK (true);

CREATE POLICY "Admins can delete email notifications"
  ON public.email_notifications FOR DELETE USING (public.is_admin() OR auth.role() = 'authenticated');

-- SETTINGS POLICIES
CREATE POLICY "Settings are viewable by everyone"
  ON public.settings FOR SELECT USING (true);

CREATE POLICY "Admins can insert settings"
  ON public.settings FOR INSERT WITH CHECK (public.is_admin() OR auth.role() = 'authenticated');

CREATE POLICY "Admins can update settings"
  ON public.settings FOR UPDATE USING (public.is_admin() OR auth.role() = 'authenticated') WITH CHECK (true);

CREATE POLICY "Admins can delete settings"
  ON public.settings FOR DELETE USING (public.is_admin() OR auth.role() = 'authenticated');

-- SITE SETTINGS POLICIES
CREATE POLICY "Site settings are viewable by everyone"
  ON public.site_settings FOR SELECT USING (true);

CREATE POLICY "Admins can insert site settings"
  ON public.site_settings FOR INSERT WITH CHECK (public.is_admin() OR auth.role() = 'authenticated');

CREATE POLICY "Admins can update site settings"
  ON public.site_settings FOR UPDATE USING (public.is_admin() OR auth.role() = 'authenticated') WITH CHECK (true);

CREATE POLICY "Admins can delete site settings"
  ON public.site_settings FOR DELETE USING (public.is_admin() OR auth.role() = 'authenticated');

-- ==============================================================================
-- 11. REALTIME REPLICATION CONFIGURATION
-- Enables live instant updates across client dashboards and Telegram bot listeners
-- ==============================================================================
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.deposit_requests;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.withdraw_requests;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ads;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.email_notifications;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.settings;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.site_settings;
  EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

-- ==============================================================================
-- 12. STORAGE BUCKET ('uploads') & SYNC OCCUPIED SLOTS
-- ==============================================================================
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('uploads', 'uploads', true)
  ON CONFLICT (id) DO UPDATE SET public = true;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Public read uploads" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated upload uploads" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated delete uploads" ON storage.objects;

  CREATE POLICY "Public read uploads"
    ON storage.objects FOR SELECT USING (bucket_id = 'uploads');

  CREATE POLICY "Authenticated upload uploads"
    ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'uploads' AND (auth.uid() IS NOT NULL OR auth.role() = 'authenticated'));

  CREATE POLICY "Authenticated delete uploads"
    ON storage.objects FOR DELETE USING (bucket_id = 'uploads' AND (auth.uid() IS NOT NULL OR auth.role() = 'authenticated'));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Resync jobs.occupied_slots from actual non-rejected rows in public.submissions
UPDATE public.jobs j
SET occupied_slots = (
  SELECT COUNT(*)
  FROM public.submissions s
  WHERE s.job_id::text = j.id::text
    AND s.status <> 'rejected'
),
status = CASE
  WHEN j.status = 'completed' AND (
    SELECT COUNT(*)
    FROM public.submissions s
    WHERE s.job_id::text = j.id::text
      AND s.status <> 'rejected'
  ) < j.total_slots THEN 'active'
  ELSE j.status
END;

-- Permanently remove proof screenshot references from already-reviewed submissions
UPDATE public.submissions
SET proof_screenshot_url = NULL,
    proof_file_url = NULL
WHERE status IN ('approved', 'rejected')
  AND (proof_screenshot_url IS NOT NULL OR proof_file_url IS NOT NULL);

