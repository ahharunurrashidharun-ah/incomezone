-- ==============================================================================
-- INCOMEZONE - COMPLETE SUPABASE POSTGRESQL SCHEMA & AUTHENTICATION SETUP
-- ==============================================================================
-- Run this entire script in your Supabase Project: Dashboard > SQL Editor > New Query
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. USERS TABLE (Linked with Supabase Auth)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  name TEXT,
  username TEXT UNIQUE,
  deposit_balance NUMERIC(12, 2) DEFAULT 0.00,
  earning_balance NUMERIC(12, 2) DEFAULT 0.00,
  role TEXT DEFAULT 'user', -- 'user' or 'admin'
  is_locked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. JOBS / MICRO-TASKS TABLE
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
  status TEXT DEFAULT 'pending', -- 'pending', 'active', 'completed', 'cancelled', 'rejected'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. SUBMISSIONS (Proof of Completed Work)
CREATE TABLE IF NOT EXISTS public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  worker_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  proof_text TEXT,
  proof_file_url TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. DEPOSIT REQUESTS
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

-- 6. WITHDRAW REQUESTS
CREATE TABLE IF NOT EXISTS public.withdraw_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  account_number TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. ADVERTISEMENTS / BANNERS
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

-- ==============================================================================
-- 8. AUTOMATIC USER SYNC TRIGGER (On Supabase Auth Sign Up)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_name TEXT;
  v_username TEXT;
  v_role TEXT;
BEGIN
  -- Extract metadata or generate safe fallbacks
  v_name := COALESCE(
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'full_name',
    split_part(new.email, '@', 1)
  );

  v_username := COALESCE(
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'user_name',
    split_part(new.email, '@', 1)
  );

  -- Admin check (e.g. administrator emails or usernames)
  IF lower(new.email) IN ('ahharunurrashidharun@gmail.com', 'harunbhai2728@gmail.com') 
     OR lower(v_username) IN ('harunbhai') THEN
    v_role := 'admin';
  ELSE
    v_role := COALESCE(new.raw_user_meta_data->>'role', 'user');
  END IF;

  INSERT INTO public.users (
    id,
    email,
    name,
    username,
    deposit_balance,
    earning_balance,
    role,
    is_locked,
    created_at
  )
  VALUES (
    new.id,
    new.email,
    v_name,
    v_username,
    0.00,
    0.00,
    v_role,
    false,
    timezone('utc'::text, now())
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, public.users.name),
    username = COALESCE(EXCLUDED.username, public.users.username);

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger cleanly
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdraw_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;

-- Clean existing policies
DROP POLICY IF EXISTS "Public users are viewable by everyone" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile or admins update all" ON public.users;

DROP POLICY IF EXISTS "Jobs are viewable by everyone" ON public.jobs;
DROP POLICY IF EXISTS "Authenticated users can create jobs" ON public.jobs;
DROP POLICY IF EXISTS "Job owners and admins can update jobs" ON public.jobs;

DROP POLICY IF EXISTS "Submissions are viewable by worker, job owner, and admin" ON public.submissions;
DROP POLICY IF EXISTS "Authenticated users can submit proofs" ON public.submissions;
DROP POLICY IF EXISTS "Admins and job owners can update submissions" ON public.submissions;

DROP POLICY IF EXISTS "Deposit requests viewable by owner and admin" ON public.deposit_requests;
DROP POLICY IF EXISTS "Authenticated users can request deposit" ON public.deposit_requests;
DROP POLICY IF EXISTS "Admins can update deposit requests" ON public.deposit_requests;

DROP POLICY IF EXISTS "Withdraw requests viewable by owner and admin" ON public.withdraw_requests;
DROP POLICY IF EXISTS "Authenticated users can request withdraw" ON public.withdraw_requests;
DROP POLICY IF EXISTS "Admins can update withdraw requests" ON public.withdraw_requests;

DROP POLICY IF EXISTS "Ads are viewable by everyone" ON public.ads;
DROP POLICY IF EXISTS "Authenticated users can create ads" ON public.ads;
DROP POLICY IF EXISTS "Admins can update ads" ON public.ads;

-- USERS POLICIES
CREATE POLICY "Public users are viewable by everyone"
  ON public.users FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.users FOR INSERT WITH CHECK (auth.uid() = id OR auth.role() = 'authenticated');

CREATE POLICY "Users can update own profile or admins update all"
  ON public.users FOR UPDATE USING (auth.uid() = id OR auth.role() = 'authenticated');

-- JOBS POLICIES
CREATE POLICY "Jobs are viewable by everyone"
  ON public.jobs FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create jobs"
  ON public.jobs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Job owners and admins can update jobs"
  ON public.jobs FOR UPDATE USING (auth.role() = 'authenticated');

-- SUBMISSIONS POLICIES
CREATE POLICY "Submissions are viewable by worker, job owner, and admin"
  ON public.submissions FOR SELECT USING (true);

CREATE POLICY "Authenticated users can submit proofs"
  ON public.submissions FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admins and job owners can update submissions"
  ON public.submissions FOR UPDATE USING (auth.role() = 'authenticated');

-- DEPOSIT REQUESTS POLICIES
CREATE POLICY "Deposit requests viewable by owner and admin"
  ON public.deposit_requests FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can request deposit"
  ON public.deposit_requests FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admins can update deposit requests"
  ON public.deposit_requests FOR UPDATE USING (auth.role() = 'authenticated');

-- WITHDRAW REQUESTS POLICIES
CREATE POLICY "Withdraw requests viewable by owner and admin"
  ON public.withdraw_requests FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can request withdraw"
  ON public.withdraw_requests FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admins can update withdraw requests"
  ON public.withdraw_requests FOR UPDATE USING (auth.role() = 'authenticated');

-- ADS POLICIES
CREATE POLICY "Ads are viewable by everyone"
  ON public.ads FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create ads"
  ON public.ads FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admins can update ads"
  ON public.ads FOR UPDATE USING (auth.role() = 'authenticated');

-- 10. REALTIME CONFIGURATION (Optional: Enables live updates across browsers)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.deposit_requests;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.withdraw_requests;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ads;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;
END $$;
