-- ============================================
-- PHARMACY USERS TABLE & SUPERUSER SETUP
-- Uses pharmacy_ prefix to avoid conflicts
-- ============================================

-- Create pharmacy_users table
CREATE TABLE IF NOT EXISTS public.pharmacy_users (
  user_id SERIAL PRIMARY KEY,
  user_code VARCHAR UNIQUE,
  user_name VARCHAR NOT NULL UNIQUE,
  password_hash VARCHAR NOT NULL,
  name VARCHAR NOT NULL,
  user_type VARCHAR NOT NULL DEFAULT 'Cashier',
  email VARCHAR,
  phone VARCHAR,
  national_id VARCHAR,
  pin VARCHAR,
  active BOOLEAN DEFAULT true,
  is_super_admin BOOLEAN DEFAULT false,
  outlet_id INTEGER DEFAULT 1,
  salary_type TEXT DEFAULT 'Monthly',
  salary_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create pharmacy_user_outlets table for multi-outlet support
CREATE TABLE IF NOT EXISTS public.pharmacy_user_outlets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  outlet_id INTEGER NOT NULL,
  is_default BOOLEAN DEFAULT false
);

-- Insert superuser (password stored as plain text to match existing pattern)
INSERT INTO public.pharmacy_users (
  user_code, user_name, password_hash, name, user_type, active, is_super_admin, outlet_id
) VALUES (
  'PHARM-SU001',
  'superuser',
  '@JIm47jhC_7%#Pharm',
  'Super Admin',
  'Admin',
  true,
  true,
  1
) ON CONFLICT (user_name) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  name = EXCLUDED.name,
  user_type = EXCLUDED.user_type,
  is_super_admin = EXCLUDED.is_super_admin,
  active = EXCLUDED.active;

-- Link superuser to all pharmacy outlets
INSERT INTO public.pharmacy_user_outlets (user_id, outlet_id, is_default)
SELECT pu.user_id, po.outlet_id, po.is_main
FROM public.pharmacy_users pu
CROSS JOIN public.pharmacy_outlets po
WHERE pu.user_name = 'superuser'
ON CONFLICT DO NOTHING;

-- Enable RLS with open policies (match existing pattern)
ALTER TABLE public.pharmacy_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to pharmacy_users" ON public.pharmacy_users;
CREATE POLICY "Allow all access to pharmacy_users" ON public.pharmacy_users FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.pharmacy_user_outlets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to pharmacy_user_outlets" ON public.pharmacy_user_outlets;
CREATE POLICY "Allow all access to pharmacy_user_outlets" ON public.pharmacy_user_outlets FOR ALL USING (true) WITH CHECK (true);
