-- ============================================================
-- ALPHA RETAIL — MULTI-OUTLET MIGRATION
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. CREATE OUTLETS TABLE
CREATE TABLE IF NOT EXISTS retail_outlets (
    outlet_id SERIAL PRIMARY KEY,
    outlet_name TEXT NOT NULL,
    outlet_code TEXT NOT NULL UNIQUE,
    address TEXT DEFAULT '',
    city TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    is_main BOOLEAN DEFAULT FALSE,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default main outlet
INSERT INTO retail_outlets (outlet_name, outlet_code, is_main, active)
VALUES ('Main Outlet', 'MAIN', TRUE, TRUE)
ON CONFLICT (outlet_code) DO NOTHING;

-- 2. ADD outlet_id TO EXISTING TABLES (with default = 1 for main outlet)

-- retail_users
DO $$ BEGIN
    ALTER TABLE retail_users ADD COLUMN outlet_id INTEGER DEFAULT 1;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- retail_stock
DO $$ BEGIN
    ALTER TABLE retail_stock ADD COLUMN outlet_id INTEGER DEFAULT 1;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- sales
DO $$ BEGIN
    ALTER TABLE sales ADD COLUMN outlet_id INTEGER DEFAULT 1;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- retail_purchases
DO $$ BEGIN
    ALTER TABLE retail_purchases ADD COLUMN outlet_id INTEGER DEFAULT 1;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- retail_expenses (skip if table doesn't exist)
DO $$ BEGIN
    ALTER TABLE retail_expenses ADD COLUMN outlet_id INTEGER DEFAULT 1;
EXCEPTION WHEN duplicate_column THEN NULL;
WHEN undefined_table THEN NULL;
END $$;

-- retail_shift_instances (skip if table doesn't exist)
DO $$ BEGIN
    ALTER TABLE retail_shift_instances ADD COLUMN outlet_id INTEGER DEFAULT 1;
EXCEPTION WHEN duplicate_column THEN NULL;
WHEN undefined_table THEN NULL;
END $$;

-- retail_invoices (skip if table doesn't exist)
DO $$ BEGIN
    ALTER TABLE retail_invoices ADD COLUMN outlet_id INTEGER DEFAULT 1;
EXCEPTION WHEN duplicate_column THEN NULL;
WHEN undefined_table THEN NULL;
END $$;

-- 3. CREATE STOCK TRANSFERS TABLE
CREATE TABLE IF NOT EXISTS retail_stock_transfers (
    transfer_id SERIAL PRIMARY KEY,
    transfer_no TEXT NOT NULL,
    from_outlet_id INTEGER NOT NULL REFERENCES retail_outlets(outlet_id),
    to_outlet_id INTEGER NOT NULL REFERENCES retail_outlets(outlet_id),
    transfer_date DATE DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'Pending', -- Pending, In Transit, Received, Cancelled
    notes TEXT DEFAULT '',
    created_by TEXT DEFAULT '',
    received_by TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    received_at TIMESTAMPTZ
);

-- Stock transfer items
CREATE TABLE IF NOT EXISTS retail_stock_transfer_items (
    item_id SERIAL PRIMARY KEY,
    transfer_id INTEGER NOT NULL REFERENCES retail_stock_transfers(transfer_id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL,
    product_name TEXT DEFAULT '',
    product_code TEXT DEFAULT '',
    quantity NUMERIC DEFAULT 0,
    unit TEXT DEFAULT 'Piece',
    received_qty NUMERIC DEFAULT 0,
    notes TEXT DEFAULT ''
);

-- 4. CREATE USER-OUTLET MAPPING (for multi-outlet access)
CREATE TABLE IF NOT EXISTS retail_user_outlets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    outlet_id INTEGER NOT NULL REFERENCES retail_outlets(outlet_id),
    is_default BOOLEAN DEFAULT FALSE,
    UNIQUE(user_id, outlet_id)
);

-- Grant all existing users access to main outlet
INSERT INTO retail_user_outlets (user_id, outlet_id, is_default)
SELECT user_id, 1, TRUE FROM retail_users
ON CONFLICT (user_id, outlet_id) DO NOTHING;

-- 5. PRICE HISTORY TABLE (if not exists)
CREATE TABLE IF NOT EXISTS retail_price_history (
    id SERIAL PRIMARY KEY,
    pid INTEGER NOT NULL,
    old_purchase_cost NUMERIC DEFAULT 0,
    new_purchase_cost NUMERIC DEFAULT 0,
    old_sales_cost NUMERIC DEFAULT 0,
    new_sales_cost NUMERIC DEFAULT 0,
    changed_by TEXT DEFAULT '',
    reason TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. CREATE INDEXES
CREATE INDEX IF NOT EXISTS idx_stock_outlet ON retail_stock(outlet_id);
CREATE INDEX IF NOT EXISTS idx_sales_outlet ON sales(outlet_id);
CREATE INDEX IF NOT EXISTS idx_purchases_outlet ON retail_purchases(outlet_id);
CREATE INDEX IF NOT EXISTS idx_users_outlet ON retail_users(outlet_id);
CREATE INDEX IF NOT EXISTS idx_user_outlets ON retail_user_outlets(user_id, outlet_id);
CREATE INDEX IF NOT EXISTS idx_transfers_from ON retail_stock_transfers(from_outlet_id);
CREATE INDEX IF NOT EXISTS idx_transfers_to ON retail_stock_transfers(to_outlet_id);

-- ============================================================
-- DONE! Now you can create outlets and assign users to them.
-- Existing data defaults to outlet_id = 1 (Main Outlet).
-- ============================================================
