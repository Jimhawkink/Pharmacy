-- =====================================================================
-- Alpha Pharmacy: Pharmacy Roles & Permissions Table Migration
-- Run this in your Supabase SQL Editor:
-- Dashboard > SQL Editor > New query > Paste & Run
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.pharmacy_roles (
  role_id SERIAL PRIMARY KEY,
  role_name TEXT NOT NULL UNIQUE,
  description TEXT,
  cadre_type TEXT DEFAULT 'Clinical',
  can_dispense BOOLEAN DEFAULT false,
  can_controlled_drugs BOOLEAN DEFAULT false,
  can_pos_sales BOOLEAN DEFAULT true,
  can_returns BOOLEAN DEFAULT false,
  can_purchases BOOLEAN DEFAULT false,
  can_stocktake BOOLEAN DEFAULT false,
  can_expiry_writeoff BOOLEAN DEFAULT false,
  can_financial_reports BOOLEAN DEFAULT false,
  can_profit_analysis BOOLEAN DEFAULT false,
  can_manage_users BOOLEAN DEFAULT false,
  can_manage_pins BOOLEAN DEFAULT false,
  can_system_settings BOOLEAN DEFAULT false,
  is_super_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backward compatibility view
CREATE OR REPLACE VIEW public.user_roles AS
  SELECT * FROM public.pharmacy_roles;

-- Enable Row Level Security (RLS) & Allow access
ALTER TABLE public.pharmacy_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated and anon" ON public.pharmacy_roles;
CREATE POLICY "Allow all for authenticated and anon"
  ON public.pharmacy_roles FOR ALL
  USING (true)
  WITH CHECK (true);

-- Seed Authentic Pharmacy Roles
INSERT INTO public.pharmacy_roles (role_id, role_name, description, cadre_type, can_dispense, can_controlled_drugs, can_pos_sales, can_returns, can_purchases, can_stocktake, can_expiry_writeoff, can_financial_reports, can_profit_analysis, can_manage_users, can_manage_pins, can_system_settings, is_super_admin) VALUES
  (1, 'Super Admin', 'Root enterprise administrator with unrestricted database & security privileges', 'Administrative', true, true, true, true, true, true, true, true, true, true, true, true, true),
  (2, 'Pharmacist', 'Licensed Superintendent Pharmacist in charge of clinical dispensing & PPB compliance', 'Clinical', true, true, true, true, true, true, true, true, true, false, false, false, false),
  (3, 'Pharmacy Tech', 'Enrolled Pharmacy Technician assisting in dispensing, stock count & compounding', 'Clinical', true, false, true, false, true, true, false, false, false, false, false, false, false),
  (4, 'Cashier', 'Front-counter POS register cashier handling customer transactions & payments', 'Financial', false, false, true, false, false, false, false, false, false, false, false, false, false),
  (5, 'Storekeeper', 'Warehouse & store keeper handling supplier deliveries, stocktake & transfers', 'Inventory', false, false, false, true, true, true, true, false, false, false, false, false, false),
  (6, 'Manager', 'Branch manager responsible for daily shift closing, sales approval & operations', 'Administrative', false, false, true, true, true, true, true, true, true, false, true, false, false),
  (7, 'Admin', 'Executive administrator with system management, financials & staff controls', 'Administrative', true, true, true, true, true, true, true, true, true, true, true, false, false),
  (8, 'Auditor', 'Read-only financial auditor verifying tax ledgers, profit margins and inventory', 'Financial', false, false, false, false, false, true, false, true, true, false, false, false, false),
  (9, 'Clinical Prescriber', 'Licensed clinician authorized to prescribe medication and consult patients', 'Clinical', true, true, false, false, false, false, false, false, false, false, false, false, false),
  (10, 'Director', 'Board director & proprietor with full business, financial and auditing oversight', 'Administrative', false, false, true, true, true, true, false, true, true, true, false, false, false),
  (11, 'Supervisor', 'Operations shift supervisor assisting cashier floats and customer service', 'Administrative', false, false, true, true, false, true, false, true, false, false, false, false, false)
ON CONFLICT (role_name) DO UPDATE SET
  description = EXCLUDED.description,
  cadre_type = EXCLUDED.cadre_type,
  can_dispense = EXCLUDED.can_dispense,
  can_controlled_drugs = EXCLUDED.can_controlled_drugs;

-- CRITICAL: Grant permissions to anon and authenticated roles
GRANT ALL ON public.pharmacy_roles TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
