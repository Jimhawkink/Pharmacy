-- =====================================================================
-- Alpha Pharmacy: Sales Returns Table Migration
-- Run this in your Supabase SQL Editor:
-- Dashboard > SQL Editor > New query > Paste & Run
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.pharmacy_sales_returns (
  return_id SERIAL PRIMARY KEY,
  return_no TEXT NOT NULL UNIQUE,
  return_date DATE DEFAULT CURRENT_DATE,
  original_sale_id TEXT,
  product_name TEXT NOT NULL,
  quantity NUMERIC DEFAULT 1,
  unit_price NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  reason TEXT DEFAULT 'Customer Request',
  refund_method TEXT DEFAULT 'Cash from Register',
  status TEXT DEFAULT 'Completed',
  processed_by TEXT DEFAULT 'Pharmacist',
  outlet_id INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alias view for backward compatibility
CREATE OR REPLACE VIEW public.sales_returns AS
  SELECT * FROM public.pharmacy_sales_returns;

-- Enable Row Level Security (RLS) & Allow access
ALTER TABLE public.pharmacy_sales_returns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated and anon" ON public.pharmacy_sales_returns;
CREATE POLICY "Allow all for authenticated and anon"
  ON public.pharmacy_sales_returns FOR ALL
  USING (true)
  WITH CHECK (true);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
