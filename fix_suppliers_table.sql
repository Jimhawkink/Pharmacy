-- =====================================================================
-- FIX: Add missing columns to pharmacy_suppliers
-- Run this in your Supabase SQL Editor
-- =====================================================================

-- Add columns that the Suppliers page expects but are missing
ALTER TABLE pharmacy_suppliers
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS phone2 TEXT,
  ADD COLUMN IF NOT EXISTS kra_pin TEXT,
  ADD COLUMN IF NOT EXISTS opening_balance NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_type TEXT DEFAULT 'Credit',
  ADD COLUMN IF NOT EXISTS current_balance NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS is_kitchen BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Rename tin_number to kra_pin if it was saved there (optional, run only if kra_pin stays NULL)
-- UPDATE pharmacy_suppliers SET kra_pin = tin_number WHERE kra_pin IS NULL AND tin_number IS NOT NULL;

-- Ensure supplier_code is not null (set a default for existing rows if needed)
UPDATE pharmacy_suppliers
  SET supplier_code = 'SUP-' || LPAD(supplier_id::TEXT, 2, '0')
  WHERE supplier_code IS NULL OR supplier_code = '';

-- =====================================================================
-- RLS: Make sure authenticated users can read & write pharmacy_suppliers
-- =====================================================================
-- Allow authenticated users to SELECT
DROP POLICY IF EXISTS "pharmacy_suppliers_select" ON pharmacy_suppliers;
CREATE POLICY "pharmacy_suppliers_select"
  ON pharmacy_suppliers FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to INSERT
DROP POLICY IF EXISTS "pharmacy_suppliers_insert" ON pharmacy_suppliers;
CREATE POLICY "pharmacy_suppliers_insert"
  ON pharmacy_suppliers FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to UPDATE
DROP POLICY IF EXISTS "pharmacy_suppliers_update" ON pharmacy_suppliers;
CREATE POLICY "pharmacy_suppliers_update"
  ON pharmacy_suppliers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to DELETE
DROP POLICY IF EXISTS "pharmacy_suppliers_delete" ON pharmacy_suppliers;
CREATE POLICY "pharmacy_suppliers_delete"
  ON pharmacy_suppliers FOR DELETE
  TO authenticated
  USING (true);
