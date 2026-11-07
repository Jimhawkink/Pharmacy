-- =====================================================================
-- Alpha Pharmacy: Activity Log Table Migration
-- Run this in your Supabase SQL Editor:
-- Dashboard > SQL Editor > New query > Paste & Run
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.pharmacy_activity_log (
  log_id SERIAL PRIMARY KEY,
  action_type TEXT NOT NULL DEFAULT 'System',
  description TEXT NOT NULL,
  details TEXT,
  user_name TEXT DEFAULT 'System',
  user_type TEXT DEFAULT 'Staff',
  ip_address TEXT,
  outlet_id INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backward compatibility view
CREATE OR REPLACE VIEW public.activity_logs AS
  SELECT * FROM public.pharmacy_activity_log;

-- Enable Row Level Security (RLS) & Allow access
ALTER TABLE public.pharmacy_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated and anon" ON public.pharmacy_activity_log;
CREATE POLICY "Allow all for authenticated and anon"
  ON public.pharmacy_activity_log FOR ALL
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.pharmacy_activity_log TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
