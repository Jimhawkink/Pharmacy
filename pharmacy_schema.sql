-- ============================================
-- ALPHA PHARMACY - DATABASE SCHEMA
-- ============================================
-- Run this in your Supabase SQL Editor
-- Uses pharmacy_ prefix for all tables
-- Same Supabase project as AlphaRetail
-- ============================================

-- ==================== PRODUCTS ====================
CREATE TABLE IF NOT EXISTS pharmacy_products (
    pid SERIAL PRIMARY KEY,
    product_code TEXT NOT NULL,
    product_name TEXT NOT NULL,
    alias TEXT,
    vat_commodity TEXT DEFAULT 'Standard',
    description TEXT,
    barcode TEXT,
    category TEXT,
    purchase_unit TEXT DEFAULT 'Piece',
    sales_unit TEXT DEFAULT 'Piece',
    purchase_cost NUMERIC DEFAULT 0,
    sales_cost NUMERIC DEFAULT 0,
    wholesale_price NUMERIC DEFAULT 0,
    reorder_point INTEGER DEFAULT 10,
    margin_per NUMERIC DEFAULT 0,
    show_in_pos BOOLEAN DEFAULT TRUE,
    button_ui_color TEXT DEFAULT 'from-teal-400 to-teal-600',
    photo TEXT,
    hscode TEXT,
    batch_no TEXT,
    supplier_name TEXT,
    active BOOLEAN DEFAULT TRUE,
    pieces_per_package INTEGER DEFAULT 1,
    -- Pharmacy-specific fields
    generic_name TEXT,
    manufacturer TEXT,
    drug_type TEXT DEFAULT 'Tablet',  -- Tablet, Syrup, Injection, Capsule, Cream, Drops, Inhaler, Suppository, Ointment, Powder, Suspension
    dosage TEXT,                       -- e.g. "500mg", "250ml"
    requires_prescription BOOLEAN DEFAULT FALSE,
    storage_conditions TEXT,           -- e.g. "Store below 25°C"
    controlled_substance BOOLEAN DEFAULT FALSE,
    shelf_location TEXT,
    -- Timestamps
    outlet_id INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== BATCHES ====================
CREATE TABLE IF NOT EXISTS pharmacy_batches (
    batch_id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES pharmacy_products(pid) ON DELETE CASCADE,
    batch_number TEXT NOT NULL,
    expiry_date DATE NOT NULL,
    manufacture_date DATE,
    quantity NUMERIC DEFAULT 0,
    remaining_qty NUMERIC DEFAULT 0,
    purchase_cost NUMERIC DEFAULT 0,
    selling_price NUMERIC DEFAULT 0,
    supplier_id INTEGER,
    supplier_name TEXT,
    purchase_invoice TEXT,
    status TEXT DEFAULT 'Active', -- Active, Expired, Disposed, Returned
    notes TEXT,
    outlet_id INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_batches_product ON pharmacy_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_batches_expiry ON pharmacy_batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_pharmacy_batches_status ON pharmacy_batches(status);

-- ==================== STOCK (Batch-Level) ====================
CREATE TABLE IF NOT EXISTS pharmacy_stock (
    st_id SERIAL PRIMARY KEY,
    pid INTEGER REFERENCES pharmacy_products(pid) ON DELETE CASCADE,
    batch_id INTEGER REFERENCES pharmacy_batches(batch_id) ON DELETE SET NULL,
    invoice_no TEXT,
    qty NUMERIC DEFAULT 0,
    storage_type TEXT DEFAULT 'Store',
    expiry_date DATE,
    notes TEXT,
    outlet_id INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_stock_pid ON pharmacy_stock(pid);
CREATE INDEX IF NOT EXISTS idx_pharmacy_stock_batch ON pharmacy_stock(batch_id);

-- ==================== CATEGORIES ====================
CREATE TABLE IF NOT EXISTS pharmacy_categories (
    category_id SERIAL PRIMARY KEY,
    category_name TEXT NOT NULL,
    icon TEXT DEFAULT '💊',
    color TEXT DEFAULT '#14B8A6',
    description TEXT,
    active BOOLEAN DEFAULT TRUE,
    outlet_id INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default pharmacy categories
INSERT INTO pharmacy_categories (category_name, icon, color) VALUES
    ('Tablets & Capsules', '💊', '#3B82F6'),
    ('Syrups & Suspensions', '🧴', '#10B981'),
    ('Injections', '💉', '#EF4444'),
    ('Creams & Ointments', '🧴', '#F59E0B'),
    ('Drops (Eye/Ear/Nose)', '💧', '#06B6D4'),
    ('Inhalers', '🫁', '#8B5CF6'),
    ('Surgical & Dressings', '🩹', '#EC4899'),
    ('Baby & Maternity', '👶', '#F97316'),
    ('Vitamins & Supplements', '💪', '#14B8A6'),
    ('OTC (Over the Counter)', '🏥', '#6366F1'),
    ('Personal Care', '🧼', '#84CC16'),
    ('Medical Devices', '🩺', '#64748B')
ON CONFLICT DO NOTHING;

-- ==================== SUPPLIERS ====================
CREATE TABLE IF NOT EXISTS pharmacy_suppliers (
    supplier_id SERIAL PRIMARY KEY,
    supplier_code TEXT NOT NULL,
    supplier_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    contact_person TEXT,
    tin_number TEXT,
    payment_terms TEXT DEFAULT 'Cash',
    active BOOLEAN DEFAULT TRUE,
    outlet_id INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== PURCHASES ====================
CREATE TABLE IF NOT EXISTS pharmacy_purchases (
    purchase_id SERIAL PRIMARY KEY,
    purchase_no TEXT NOT NULL,
    purchase_date DATE DEFAULT CURRENT_DATE,
    supplier_id INTEGER REFERENCES pharmacy_suppliers(supplier_id),
    supplier_name TEXT,
    supplier_invoice TEXT,
    sub_total NUMERIC DEFAULT 0,
    discount NUMERIC DEFAULT 0,
    vat NUMERIC DEFAULT 0,
    grand_total NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'Completed',
    payment_status TEXT DEFAULT 'Paid',
    created_by TEXT,
    notes TEXT,
    outlet_id INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== PURCHASE PRODUCTS ====================
CREATE TABLE IF NOT EXISTS pharmacy_purchase_products (
    pp_id SERIAL PRIMARY KEY,
    purchase_id INTEGER REFERENCES pharmacy_purchases(purchase_id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES pharmacy_products(pid),
    product_code TEXT,
    product_name TEXT,
    batch_number TEXT NOT NULL,
    expiry_date DATE NOT NULL,
    manufacture_date DATE,
    quantity NUMERIC DEFAULT 0,
    unit TEXT DEFAULT 'Piece',
    rate NUMERIC DEFAULT 0,
    total_amount NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== SALES ====================
CREATE TABLE IF NOT EXISTS pharmacy_sales (
    sale_id SERIAL PRIMARY KEY,
    receipt_no TEXT NOT NULL,
    sale_datetime TIMESTAMPTZ DEFAULT NOW(),
    subtotal NUMERIC DEFAULT 0,
    discount NUMERIC DEFAULT 0,
    tax NUMERIC DEFAULT 0,
    total NUMERIC DEFAULT 0,
    payment_method TEXT DEFAULT 'Cash',
    amount_paid NUMERIC DEFAULT 0,
    change_amount NUMERIC DEFAULT 0,
    customer_name TEXT,
    cashier_name TEXT,
    mpesa_receipt TEXT,
    shift_instance_id INTEGER,
    checkout_request_id TEXT,
    customer_phone TEXT,
    status TEXT DEFAULT 'Completed',
    outlet_id INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== SALES ITEMS ====================
CREATE TABLE IF NOT EXISTS pharmacy_sales_items (
    item_id SERIAL PRIMARY KEY,
    sale_id INTEGER REFERENCES pharmacy_sales(sale_id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES pharmacy_products(pid),
    product_name TEXT,
    batch_id INTEGER REFERENCES pharmacy_batches(batch_id),
    batch_number TEXT,
    expiry_date DATE,
    quantity NUMERIC DEFAULT 0,
    unit_price NUMERIC DEFAULT 0,
    discount NUMERIC DEFAULT 0,
    total NUMERIC DEFAULT 0,
    purchase_price NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== EXPIRY REGISTER ====================
CREATE TABLE IF NOT EXISTS pharmacy_expiry_register (
    expiry_id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES pharmacy_products(pid),
    batch_id INTEGER REFERENCES pharmacy_batches(batch_id),
    product_name TEXT,
    batch_number TEXT,
    expiry_date DATE NOT NULL,
    quantity NUMERIC DEFAULT 0,
    purchase_cost NUMERIC DEFAULT 0,
    selling_price NUMERIC DEFAULT 0,
    total_purchase_value NUMERIC DEFAULT 0,
    total_selling_value NUMERIC DEFAULT 0,
    action TEXT DEFAULT 'Pending', -- Pending, Disposed, Returned, Transferred
    action_date TIMESTAMPTZ,
    action_by TEXT,
    notes TEXT,
    outlet_id INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== CREDIT CUSTOMERS ====================
CREATE TABLE IF NOT EXISTS pharmacy_credit_customers (
    customer_id SERIAL PRIMARY KEY,
    customer_code TEXT,
    customer_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    current_balance NUMERIC DEFAULT 0,
    credit_limit NUMERIC DEFAULT 0,
    active BOOLEAN DEFAULT TRUE,
    outlet_id INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== CREDIT PAYMENTS ====================
CREATE TABLE IF NOT EXISTS pharmacy_credit_payments (
    payment_id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES pharmacy_credit_customers(customer_id),
    sale_id INTEGER,
    amount NUMERIC DEFAULT 0,
    payment_method TEXT DEFAULT 'Cash',
    receipt_no TEXT,
    notes TEXT,
    created_by TEXT,
    outlet_id INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== EXPENSES ====================
CREATE TABLE IF NOT EXISTS pharmacy_expenses (
    expense_id SERIAL PRIMARY KEY,
    voucher_no TEXT,
    expense_name TEXT NOT NULL,
    category TEXT,
    amount NUMERIC DEFAULT 0,
    payment_mode TEXT DEFAULT 'Cash',
    description TEXT,
    expense_date TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT,
    outlet_id INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== SHIFTS ====================
CREATE TABLE IF NOT EXISTS pharmacy_shift_instances (
    shift_instance_id SERIAL PRIMARY KEY,
    shift_date DATE DEFAULT CURRENT_DATE,
    actual_start_time TIMESTAMPTZ DEFAULT NOW(),
    actual_end_time TIMESTAMPTZ,
    shift_status TEXT DEFAULT 'Open',
    opening_cash NUMERIC DEFAULT 0,
    closing_cash NUMERIC DEFAULT 0,
    created_by TEXT,
    closed_by TEXT,
    closed_date TIMESTAMPTZ,
    outlet_id INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== OUTLETS ====================
CREATE TABLE IF NOT EXISTS pharmacy_outlets (
    outlet_id SERIAL PRIMARY KEY,
    outlet_name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    is_main BOOLEAN DEFAULT FALSE,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO pharmacy_outlets (outlet_name, is_main) VALUES ('Main Pharmacy', true) ON CONFLICT DO NOTHING;

-- ==================== USERS (shared registration table) ====================
-- Uses the same 'registration' table as AlphaRetail

-- ==================== ORGANISATION SETTINGS ====================
CREATE TABLE IF NOT EXISTS pharmacy_organisation_settings (
    setting_id SERIAL PRIMARY KEY,
    setting_key TEXT NOT NULL UNIQUE,
    setting_value TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO pharmacy_organisation_settings (setting_key, setting_value) VALUES
    ('company_name', 'Alpha Pharmacy'),
    ('company_address', ''),
    ('company_phone', ''),
    ('company_email', ''),
    ('currency', 'Ksh'),
    ('receipt_footer', 'Thank you for choosing Alpha Pharmacy!'),
    ('tax_rate', '16'),
    ('pharmacy_license_no', ''),
    ('pharmacist_name', '')
ON CONFLICT (setting_key) DO NOTHING;

-- ==================== ACTIVITY LOG ====================
CREATE TABLE IF NOT EXISTS pharmacy_activity_log (
    log_id SERIAL PRIMARY KEY,
    action_type TEXT,
    description TEXT,
    details TEXT,
    user_name TEXT,
    outlet_id INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== PRICE HISTORY ====================
CREATE TABLE IF NOT EXISTS pharmacy_price_history (
    id SERIAL PRIMARY KEY,
    pid INTEGER REFERENCES pharmacy_products(pid),
    product_name TEXT,
    old_buy NUMERIC,
    new_buy NUMERIC,
    old_sell NUMERIC,
    new_sell NUMERIC,
    old_purchase_cost NUMERIC,
    new_purchase_cost NUMERIC,
    old_sales_cost NUMERIC,
    new_sales_cost NUMERIC,
    changed_by TEXT,
    reason TEXT,
    changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== MPESA TRANSACTIONS ====================
CREATE TABLE IF NOT EXISTS pharmacy_mpesa_transactions (
    id SERIAL PRIMARY KEY,
    checkout_request_id TEXT,
    phone_number TEXT,
    amount NUMERIC,
    account_reference TEXT,
    status TEXT DEFAULT 'Pending',
    mpesa_receipt_number TEXT,
    result_desc TEXT,
    outlet_id INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== UNITS ====================
CREATE TABLE IF NOT EXISTS pharmacy_product_units (
    unit_id SERIAL PRIMARY KEY,
    unit_name TEXT NOT NULL,
    abbreviation TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO pharmacy_product_units (unit_name, abbreviation) VALUES
    ('Piece', 'Pc'), ('Tablet', 'Tab'), ('Capsule', 'Cap'),
    ('Bottle', 'Btl'), ('Strip', 'Str'), ('Box', 'Box'),
    ('Pack', 'Pk'), ('Tube', 'Tb'), ('Sachet', 'Sac'),
    ('Vial', 'Vl'), ('Ampoule', 'Amp'), ('Kilogram', 'Kg'),
    ('Gram', 'g'), ('Liter', 'L'), ('Milliliter', 'ml'),
    ('Dozen', 'Dz'), ('Carton', 'Ctn')
ON CONFLICT DO NOTHING;

-- ==================== DISABLE RLS FOR ALL PHARMACY TABLES ====================
ALTER TABLE pharmacy_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_purchase_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_sales_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_expiry_register ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_credit_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_credit_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_shift_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_organisation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_mpesa_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_product_units ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for all tables (allow all operations for authenticated users)
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT unnest(ARRAY[
            'pharmacy_products', 'pharmacy_batches', 'pharmacy_stock',
            'pharmacy_categories', 'pharmacy_suppliers', 'pharmacy_purchases',
            'pharmacy_purchase_products', 'pharmacy_sales', 'pharmacy_sales_items',
            'pharmacy_expiry_register', 'pharmacy_credit_customers', 'pharmacy_credit_payments',
            'pharmacy_expenses', 'pharmacy_shift_instances', 'pharmacy_outlets',
            'pharmacy_organisation_settings', 'pharmacy_activity_log', 'pharmacy_price_history',
            'pharmacy_mpesa_transactions', 'pharmacy_product_units'
        ])
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Allow all for %I" ON %I', tbl, tbl);
        EXECUTE format('CREATE POLICY "Allow all for %I" ON %I FOR ALL USING (true) WITH CHECK (true)', tbl, tbl);
    END LOOP;
END
$$;

-- Grant access to anon and authenticated roles
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT unnest(ARRAY[
            'pharmacy_products', 'pharmacy_batches', 'pharmacy_stock',
            'pharmacy_categories', 'pharmacy_suppliers', 'pharmacy_purchases',
            'pharmacy_purchase_products', 'pharmacy_sales', 'pharmacy_sales_items',
            'pharmacy_expiry_register', 'pharmacy_credit_customers', 'pharmacy_credit_payments',
            'pharmacy_expenses', 'pharmacy_shift_instances', 'pharmacy_outlets',
            'pharmacy_organisation_settings', 'pharmacy_activity_log', 'pharmacy_price_history',
            'pharmacy_mpesa_transactions', 'pharmacy_product_units'
        ])
    LOOP
        EXECUTE format('GRANT ALL ON %I TO anon, authenticated', tbl);
        EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated');
    END LOOP;
END
$$;

SELECT 'Alpha Pharmacy schema created successfully! 💊' AS result;
