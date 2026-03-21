-- =====================================================
-- OUTLET INDEPENDENCE MIGRATION (SAFE - re-runnable)
-- Adds outlet_id to all tables that need it
-- Run this on your Supabase SQL Editor
-- =====================================================

-- 1. Add outlet_id to retail_products (skip if exists)
DO $$ BEGIN
    ALTER TABLE retail_products ADD COLUMN outlet_id INTEGER DEFAULT 1;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 2. Add outlet_id to retail_categories (skip if exists)
DO $$ BEGIN
    ALTER TABLE retail_categories ADD COLUMN outlet_id INTEGER DEFAULT 1;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 3. Add outlet_id to retail_sales (skip if exists)
DO $$ BEGIN
    ALTER TABLE retail_sales ADD COLUMN outlet_id INTEGER DEFAULT 1;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 4. Add outlet_id to retail_purchases (skip if exists)
DO $$ BEGIN
    ALTER TABLE retail_purchases ADD COLUMN outlet_id INTEGER DEFAULT 1;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 5. Add outlet_id to retail_stock (skip if exists)
DO $$ BEGIN
    ALTER TABLE retail_stock ADD COLUMN outlet_id INTEGER DEFAULT 1;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 6. Set all existing data to main outlet (outlet_id = 1)
UPDATE retail_products SET outlet_id = 1 WHERE outlet_id IS NULL;
UPDATE retail_categories SET outlet_id = 1 WHERE outlet_id IS NULL;
UPDATE retail_sales SET outlet_id = 1 WHERE outlet_id IS NULL;
UPDATE retail_purchases SET outlet_id = 1 WHERE outlet_id IS NULL;
UPDATE retail_stock SET outlet_id = 1 WHERE outlet_id IS NULL;

-- 7. Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_products_outlet ON retail_products(outlet_id);
CREATE INDEX IF NOT EXISTS idx_categories_outlet ON retail_categories(outlet_id);
CREATE INDEX IF NOT EXISTS idx_sales_outlet ON retail_sales(outlet_id);
CREATE INDEX IF NOT EXISTS idx_purchases_outlet ON retail_purchases(outlet_id);
CREATE INDEX IF NOT EXISTS idx_stock_outlet ON retail_stock(outlet_id);

-- 8. FIX UNIQUE CONSTRAINTS: Allow same product_code in different outlets
-- Drop the old global unique constraint on product_code
ALTER TABLE retail_products DROP CONSTRAINT IF EXISTS retail_products_product_code_key;
ALTER TABLE retail_products DROP CONSTRAINT IF EXISTS retail_products_product_code_unique;
-- Create new composite unique: product_code must be unique PER OUTLET only
DO $$ BEGIN
    ALTER TABLE retail_products ADD CONSTRAINT retail_products_product_code_outlet_unique UNIQUE (product_code, outlet_id);
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

-- Same for barcode if it has a unique constraint
ALTER TABLE retail_products DROP CONSTRAINT IF EXISTS retail_products_barcode_key;
ALTER TABLE retail_products DROP CONSTRAINT IF EXISTS retail_products_barcode_unique;

-- Same for category_name
ALTER TABLE retail_categories DROP CONSTRAINT IF EXISTS retail_categories_category_name_key;
ALTER TABLE retail_categories DROP CONSTRAINT IF EXISTS retail_categories_category_name_unique;

-- Done! Each outlet now has fully independent data.
-- Product codes, barcodes, and category names can be reused across outlets.
-- This is SAFE to re-run — won't duplicate or break anything.
