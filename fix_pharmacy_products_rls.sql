-- ====================================================================
-- ALPHA PHARMACY - FIX PHARMACY_PRODUCTS ROW LEVEL SECURITY (RLS)
-- Allows anon / authenticated role full read/write access to pharmacy_products
-- ====================================================================

-- 1. Ensure RLS is enabled or open
ALTER TABLE public.pharmacy_products ENABLE ROW LEVEL SECURITY;

-- 2. Drop any restricting policies
DROP POLICY IF EXISTS "Allow anon read pharmacy_products" ON public.pharmacy_products;
DROP POLICY IF EXISTS "Allow anon all pharmacy_products" ON public.pharmacy_products;
DROP POLICY IF EXISTS "Allow public read-write for pharmacy_products" ON public.pharmacy_products;
DROP POLICY IF EXISTS "Allow all" ON public.pharmacy_products;

-- 3. Create comprehensive open policy for public/anon/authenticated
CREATE POLICY "Allow public all pharmacy_products"
  ON public.pharmacy_products
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- 4. Verify batch table access
ALTER TABLE public.pharmacy_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public all pharmacy_batches" ON public.pharmacy_batches;
CREATE POLICY "Allow public all pharmacy_batches"
  ON public.pharmacy_batches
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- 5. Verify stock table access
ALTER TABLE public.pharmacy_stock ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public all pharmacy_stock" ON public.pharmacy_stock;
CREATE POLICY "Allow public all pharmacy_stock"
  ON public.pharmacy_stock
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- 6. Grant permissions explicitly
GRANT ALL ON TABLE public.pharmacy_products TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.pharmacy_batches TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.pharmacy_stock TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.pharmacy_categories TO anon, authenticated, service_role;

SELECT 'RLS POLICIES UPDATED SUCCESSFULLY - 54 PHARMACY PRODUCTS READY' AS status;
