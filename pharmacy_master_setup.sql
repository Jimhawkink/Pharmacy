-- =====================================================================
-- ALPHA PHARMACY - MASTER DATABASE SETUP & DATA RESTORE
-- Target Project: qqjlpwqtzfprvbsopycd
-- =====================================================================

-- ==================== 1. CORE TABLES ====================

CREATE TABLE IF NOT EXISTS public.pharmacy_products (
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
    generic_name TEXT,
    manufacturer TEXT,
    drug_type TEXT DEFAULT 'Tablet',
    dosage TEXT,
    requires_prescription BOOLEAN DEFAULT FALSE,
    storage_conditions TEXT,
    controlled_substance BOOLEAN DEFAULT FALSE,
    shelf_location TEXT,
    outlet_id INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pharmacy_batches (
    batch_id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES public.pharmacy_products(pid) ON DELETE CASCADE,
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
    status TEXT DEFAULT 'Active',
    notes TEXT,
    outlet_id INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_batches_product ON public.pharmacy_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_batches_expiry ON public.pharmacy_batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_pharmacy_batches_status ON public.pharmacy_batches(status);

CREATE TABLE IF NOT EXISTS public.pharmacy_stock (
    st_id SERIAL PRIMARY KEY,
    pid INTEGER REFERENCES public.pharmacy_products(pid) ON DELETE CASCADE,
    batch_id INTEGER REFERENCES public.pharmacy_batches(batch_id) ON DELETE SET NULL,
    invoice_no TEXT,
    qty NUMERIC DEFAULT 0,
    storage_type TEXT DEFAULT 'Store',
    expiry_date DATE,
    notes TEXT,
    outlet_id INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_stock_pid ON public.pharmacy_stock(pid);
CREATE INDEX IF NOT EXISTS idx_pharmacy_stock_batch ON public.pharmacy_stock(batch_id);

CREATE TABLE IF NOT EXISTS public.pharmacy_categories (
    category_id SERIAL PRIMARY KEY,
    category_name TEXT NOT NULL,
    icon TEXT DEFAULT '💊',
    color TEXT DEFAULT '#14B8A6',
    description TEXT,
    active BOOLEAN DEFAULT TRUE,
    outlet_id INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pharmacy_suppliers (
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

CREATE TABLE IF NOT EXISTS public.pharmacy_purchases (
    purchase_id SERIAL PRIMARY KEY,
    purchase_no TEXT NOT NULL,
    purchase_date DATE DEFAULT CURRENT_DATE,
    supplier_id INTEGER REFERENCES public.pharmacy_suppliers(supplier_id),
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

CREATE TABLE IF NOT EXISTS public.pharmacy_purchase_products (
    pp_id SERIAL PRIMARY KEY,
    purchase_id INTEGER REFERENCES public.pharmacy_purchases(purchase_id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES public.pharmacy_products(pid),
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

CREATE TABLE IF NOT EXISTS public.pharmacy_sales (
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
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pharmacy_sales_items (
    item_id SERIAL PRIMARY KEY,
    sale_id INTEGER REFERENCES public.pharmacy_sales(sale_id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES public.pharmacy_products(pid),
    product_name TEXT,
    batch_id INTEGER REFERENCES public.pharmacy_batches(batch_id),
    batch_number TEXT,
    expiry_date DATE,
    quantity NUMERIC DEFAULT 0,
    unit_price NUMERIC DEFAULT 0,
    discount NUMERIC DEFAULT 0,
    total NUMERIC DEFAULT 0,
    purchase_price NUMERIC DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pharmacy_expiry_register (
    expiry_id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES public.pharmacy_products(pid),
    batch_id INTEGER REFERENCES public.pharmacy_batches(batch_id),
    product_name TEXT,
    batch_number TEXT,
    expiry_date DATE NOT NULL,
    quantity NUMERIC DEFAULT 0,
    purchase_cost NUMERIC DEFAULT 0,
    selling_price NUMERIC DEFAULT 0,
    total_purchase_value NUMERIC DEFAULT 0,
    total_selling_value NUMERIC DEFAULT 0,
    action TEXT DEFAULT 'Pending',
    action_date TIMESTAMPTZ,
    action_by TEXT,
    notes TEXT,
    outlet_id INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pharmacy_credit_customers (
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

CREATE TABLE IF NOT EXISTS public.pharmacy_credit_payments (
    payment_id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES public.pharmacy_credit_customers(customer_id),
    sale_id INTEGER,
    amount NUMERIC DEFAULT 0,
    payment_method TEXT DEFAULT 'Cash',
    receipt_no TEXT,
    notes TEXT,
    created_by TEXT,
    outlet_id INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pharmacy_expenses (
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

CREATE TABLE IF NOT EXISTS public.pharmacy_shift_instances (
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
    opened_by TEXT,
    outlet_id INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pharmacy_outlets (
    outlet_id SERIAL PRIMARY KEY,
    outlet_name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    is_main BOOLEAN DEFAULT FALSE,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pharmacy_organisation_settings (
    setting_id SERIAL PRIMARY KEY,
    setting_key TEXT NOT NULL UNIQUE,
    setting_value TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.pharmacy_organisation_settings (setting_key, setting_value) VALUES
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

CREATE TABLE IF NOT EXISTS public.pharmacy_activity_log (
    log_id SERIAL PRIMARY KEY,
    action_type TEXT,
    description TEXT,
    details TEXT,
    user_name TEXT,
    outlet_id INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pharmacy_price_history (
    id SERIAL PRIMARY KEY,
    pid INTEGER REFERENCES public.pharmacy_products(pid),
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

CREATE TABLE IF NOT EXISTS public.pharmacy_mpesa_transactions (
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

CREATE TABLE IF NOT EXISTS public.pharmacy_product_units (
    unit_id SERIAL PRIMARY KEY,
    unit_name TEXT NOT NULL,
    abbreviation TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== 2. USERS & OUTLETS ====================

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

CREATE TABLE IF NOT EXISTS public.pharmacy_user_outlets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  outlet_id INTEGER NOT NULL,
  is_default BOOLEAN DEFAULT false
);

-- ==================== 3. COLUMN REPAIR (FOR ALREADY CREATED TABLES) ====================
-- In case tables were created without these columns, alter them now:
ALTER TABLE IF EXISTS public.pharmacy_sales ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE IF EXISTS public.pharmacy_sales_items ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE IF EXISTS public.pharmacy_shift_instances ADD COLUMN IF NOT EXISTS opened_by TEXT;

-- ==================== 4. ROW LEVEL SECURITY & PERMISSIONS ====================

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
            'pharmacy_mpesa_transactions', 'pharmacy_product_units', 'pharmacy_users',
            'pharmacy_user_outlets'
        ])
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Allow all for %I" ON public.%I;', tbl, tbl);
        EXECUTE format('CREATE POLICY "Allow all for %I" ON public.%I FOR ALL USING (true) WITH CHECK (true);', tbl, tbl);
        EXECUTE format('GRANT ALL ON public.%I TO anon, authenticated;', tbl);
    END LOOP;
    EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;';
END
$$;

-- ==================== 5. RESTORE EXPORTED DATA ====================
-- ============================================
-- ALPHA PHARMACY - FULL DATABASE EXPORT
-- ============================================

-- ==================== PHARMACY_PRODUCTS ====================
INSERT INTO public.pharmacy_products ("pid", "product_code", "product_name", "alias", "vat_commodity", "description", "barcode", "category", "purchase_unit", "sales_unit", "purchase_cost", "sales_cost", "wholesale_price", "reorder_point", "margin_per", "show_in_pos", "button_ui_color", "photo", "hscode", "batch_no", "supplier_name", "active", "pieces_per_package", "generic_name", "manufacturer", "drug_type", "dosage", "requires_prescription", "storage_conditions", "controlled_substance", "shelf_location", "outlet_id", "created_at", "updated_at") VALUES
  (31, 'PH-0027', 'Ciprofloxacin Eye Drops 5ml', NULL, 'Standard', NULL, '10126314750', 'Eye & Ear Drops', 'Box', 'Piece', 600, 100, 80, 10, 40, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 10, 'Ciprofloxacin', 'Alcon', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:13:23.765+00:00', '2026-03-25T04:13:22.988102+00:00'),
  (1, 'DRG-0001', 'PANADOL EXTRA ', NULL, 'Standard', NULL, '4556', 'Tablets & Capsules', 'Box', 'Piece', 500, 7, 6, 10, 28.57, TRUE, 'from-teal-400 to-teal-600', '', NULL, NULL, NULL, TRUE, 100, 'PARACETAMOL', 'KD', 'Tablet', '500MG', TRUE, NULL, FALSE, NULL, 1, '2026-03-23T12:03:04.380796+00:00', '2026-03-24T15:38:42.546+00:00'),
  (2, 'DRG-0002', 'PARACETAMOL 20', NULL, 'Standard', NULL, '101', 'Tablets & Capsules', 'Box', 'Piece', 100, 2, 1, 10, 50, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 100, 'PANADOL', NULL, 'Capsule', '52', TRUE, NULL, FALSE, NULL, 1, '2026-03-24T15:03:16.409+00:00', '2026-03-25T03:56:24.969+00:00'),
  (3, 'DRG-0003', 'PANADOL SYRUP', NULL, 'Standard', NULL, '102', NULL, 'Box', 'Piece', 1200, 130, 124.98, 10, 7.69, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 10, 'SYRUP', 'PIVI', 'Syrup', '100ML', FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:00:30.395+00:00', '2026-03-25T04:00:29.680881+00:00'),
  (4, 'DRG-0004', 'BACTIFIX TABS USP 400MG', NULL, 'Standard', NULL, '103', 'Tablets & Capsules', 'Box', 'Piece', 1500, 100, 0, 10, 25, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 20, 'CEFIXIME', NULL, 'Tablet', '400 MG', FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:04:14.752+00:00', '2026-03-25T04:04:14.077178+00:00'),
  (5, 'PH-0001', 'Paracetamol 500mg', NULL, 'Standard', NULL, '10100634330', 'Tablets & Capsules', 'Box', 'Piece', 150, 5, 4, 10, 70, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 100, 'Paracetamol', 'GSK', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:12:56.884+00:00', '2026-03-25T04:12:56.734386+00:00'),
  (6, 'PH-0002', 'Amoxicillin 500mg', NULL, 'Standard', NULL, '10101187700', 'Tablets & Capsules', 'Box', 'Piece', 350, 10, 8, 10, 65, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 100, 'Amoxicillin', 'Sandoz', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:12:59.045+00:00', '2026-03-25T04:12:58.317498+00:00'),
  (7, 'PH-0003', 'Metformin 500mg', NULL, 'Standard', NULL, '10102931330', 'Tablets & Capsules', 'Box', 'Piece', 280, 8, 6, 10, 65, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 100, 'Metformin', 'Merck', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:13:00.079+00:00', '2026-03-25T04:12:59.303646+00:00'),
  (8, 'PH-0004', 'Ibuprofen 400mg', NULL, 'Standard', NULL, '10103048950', 'Tablets & Capsules', 'Box', 'Piece', 200, 5, 4, 10, 60, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 100, 'Ibuprofen', 'Pfizer', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:13:01.111+00:00', '2026-03-25T04:13:00.352663+00:00'),
  (9, 'PH-0005', 'Ciprofloxacin 500mg', NULL, 'Standard', NULL, '10104673490', 'Tablets & Capsules', 'Box', 'Piece', 450, 15, 12, 10, 70, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 100, 'Ciprofloxacin', 'Bayer', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:13:02.247+00:00', '2026-03-25T04:13:01.480659+00:00'),
  (10, 'PH-0006', 'Omeprazole 20mg', NULL, 'Standard', NULL, '10105150650', 'Tablets & Capsules', 'Box', 'Piece', 180, 15, 12, 10, 60, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 30, 'Omeprazole', 'AstraZeneca', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:13:03.283+00:00', '2026-03-25T04:13:02.493495+00:00'),
  (11, 'PH-0007', 'Diclofenac 50mg', NULL, 'Standard', NULL, '10106907560', 'Tablets & Capsules', 'Box', 'Piece', 160, 5, 4, 10, 68, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 100, 'Diclofenac', 'Novartis', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:13:04.27+00:00', '2026-03-25T04:13:03.4867+00:00'),
  (12, 'PH-0008', 'Cetirizine 10mg', NULL, 'Standard', NULL, '10107875650', 'Tablets & Capsules', 'Box', 'Piece', 120, 5, 3, 10, 76, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 100, 'Cetirizine', 'UCB', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:13:05.374+00:00', '2026-03-25T04:13:04.586198+00:00'),
  (13, 'PH-0009', 'Azithromycin 250mg', NULL, 'Standard', NULL, '10108448890', 'Tablets & Capsules', 'Box', 'Piece', 300, 25, 20, 10, 60, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 30, 'Azithromycin', 'Pfizer', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:13:06.326+00:00', '2026-03-25T04:13:05.543142+00:00'),
  (14, 'PH-0010', 'Losartan 50mg', NULL, 'Standard', NULL, '10109515530', 'Tablets & Capsules', 'Box', 'Piece', 250, 20, 15, 10, 58.33, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 30, 'Losartan', 'Merck', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:13:07.249+00:00', '2026-03-25T04:13:06.461137+00:00'),
  (15, 'PH-0011', 'Cough Syrup 100ml', NULL, 'Standard', NULL, '10110062370', 'Syrups & Suspensions', 'Bottle', 'Bottle', 120, 200, 180, 10, 40, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 1, 'Dextromethorphan', 'Reckitt', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:13:08.245+00:00', '2026-03-25T04:13:07.448424+00:00'),
  (16, 'PH-0012', 'Amoxicillin Suspension 100ml', NULL, 'Standard', NULL, '10111811260', 'Syrups & Suspensions', 'Bottle', 'Bottle', 180, 300, 250, 10, 40, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 1, 'Amoxicillin', 'GSK', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:13:09.204+00:00', '2026-03-25T04:13:08.419744+00:00'),
  (17, 'PH-0013', 'Paracetamol Syrup 60ml', NULL, 'Standard', NULL, '10112289820', 'Syrups & Suspensions', 'Bottle', 'Bottle', 80, 150, 120, 10, 46.67, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 1, 'Paracetamol', 'GSK', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:13:10.166+00:00', '2026-03-25T04:13:09.371086+00:00'),
  (18, 'PH-0014', 'Gripe Water 150ml', NULL, 'Standard', NULL, '10113752180', 'Syrups & Suspensions', 'Bottle', 'Bottle', 100, 180, 150, 10, 44.44, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 1, 'Sodium Bicarbonate', 'Woodwards', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:13:11.364+00:00', '2026-03-25T04:13:10.584735+00:00'),
  (19, 'PH-0015', 'Iron Syrup 200ml', NULL, 'Standard', NULL, '10114845280', 'Syrups & Suspensions', 'Bottle', 'Bottle', 150, 280, 240, 10, 46.43, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 1, 'Ferrous Sulphate', 'Ranbaxy', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:13:12.31+00:00', '2026-03-25T04:13:11.528285+00:00'),
  (20, 'PH-0016', 'Multivitamin Syrup 100ml', NULL, 'Standard', NULL, '10115852880', 'Syrups & Suspensions', 'Bottle', 'Bottle', 200, 350, 300, 10, 42.86, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 1, 'Multivitamins', 'Roche', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:13:13.287+00:00', '2026-03-25T04:13:12.501195+00:00'),
  (21, 'PH-0017', 'Diclofenac Injection 75mg', NULL, 'Standard', NULL, '10116027130', 'Injectables', 'Box', 'Piece', 250, 80, 65, 10, 37.5, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 5, 'Diclofenac', 'Novartis', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:13:14.19+00:00', '2026-03-25T04:13:13.40834+00:00'),
  (22, 'PH-0018', 'Gentamicin Injection 80mg', NULL, 'Standard', NULL, '10117373000', 'Injectables', 'Box', 'Piece', 400, 60, 50, 10, 33.33, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 10, 'Gentamicin', 'Cipla', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:13:15.207+00:00', '2026-03-25T04:13:14.41817+00:00'),
  (23, 'PH-0019', 'Dexamethasone Injection 8mg', NULL, 'Standard', NULL, '10118139260', 'Injectables', 'Box', 'Piece', 350, 50, 40, 10, 30, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 10, 'Dexamethasone', 'Merck', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:13:16.323+00:00', '2026-03-25T04:13:15.536638+00:00'),
  (24, 'PH-0020', 'Ceftriaxone IV 1g', NULL, 'Standard', NULL, '10119533550', 'Injectables', 'Box', 'Piece', 1200, 180, 150, 10, 33.33, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 10, 'Ceftriaxone', 'Roche', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:13:17.269+00:00', '2026-03-25T04:13:16.468892+00:00'),
  (25, 'PH-0021', 'Betadine Ointment 30g', NULL, 'Standard', NULL, '10120249520', 'Topical & Creams', 'Carton', 'Piece', 1200, 150, 120, 10, 33.33, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 12, 'Povidone-Iodine', 'Purdue', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:13:18.244+00:00', '2026-03-25T04:13:17.468658+00:00'),
  (26, 'PH-0022', 'Clotrimazole Cream 20g', NULL, 'Standard', NULL, '10121391000', 'Topical & Creams', 'Carton', 'Piece', 600, 80, 65, 10, 37.5, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 12, 'Clotrimazole', 'Bayer', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:13:19.127+00:00', '2026-03-25T04:13:18.330896+00:00'),
  (27, 'PH-0023', 'Hydrocortisone Cream 15g', NULL, 'Standard', NULL, '10122361830', 'Topical & Creams', 'Carton', 'Piece', 960, 120, 100, 10, 33.33, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 12, 'Hydrocortisone', 'Pfizer', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:13:20.086+00:00', '2026-03-25T04:13:19.308282+00:00'),
  (28, 'PH-0024', 'Calamine Lotion 100ml', NULL, 'Standard', NULL, '10123555750', 'Topical & Creams', 'Carton', 'Piece', 720, 100, 80, 10, 40, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 12, 'Calamine', 'J&J', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:13:20.999+00:00', '2026-03-25T04:13:20.219151+00:00'),
  (29, 'PH-0025', 'Antifungal Powder 50g', NULL, 'Standard', NULL, '10124058840', 'Topical & Creams', 'Carton', 'Piece', 1440, 100, 80, 10, 40, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 24, 'Miconazole', 'J&J', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:13:21.919+00:00', '2026-03-25T04:13:21.122403+00:00'),
  (30, 'PH-0026', 'Chloramphenicol Eye Drops 10ml', NULL, 'Standard', NULL, '10125403100', 'Eye & Ear Drops', 'Box', 'Piece', 500, 80, 65, 10, 37.5, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 10, 'Chloramphenicol', 'Allergan', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:13:22.815+00:00', '2026-03-25T04:13:22.050003+00:00'),
  (32, 'PH-0028', 'Artificial Tears 15ml', NULL, 'Standard', NULL, '10127292200', 'Eye & Ear Drops', 'Box', 'Piece', 800, 120, 100, 10, 33.33, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 10, 'Carboxymethylcellulose', 'Allergan', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:13:24.726+00:00', '2026-03-25T04:13:23.937182+00:00'),
  (33, 'PH-0029', 'Surgical Gloves (Medium)', NULL, 'Standard', NULL, '10128493510', 'Medical Supplies', 'Bag', 'Piece', 500, 10, 8, 10, 50, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 100, NULL, 'Supermax', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:13:25.68+00:00', '2026-03-25T04:13:24.884883+00:00'),
  (34, 'PH-0030', 'Disposable Syringes 5ml', NULL, 'Standard', NULL, '10129288960', 'Medical Supplies', 'Bag', 'Piece', 600, 12, 10, 10, 50, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 100, NULL, 'BD', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:13:26.645+00:00', '2026-03-25T04:13:25.854531+00:00'),
  (35, 'PH-0031', 'Cotton Wool 500g', NULL, 'Standard', NULL, '10130774670', 'Medical Supplies', 'Bag', 'Bag', 200, 350, 300, 10, 42.86, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 1, NULL, 'Johnson', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:13:27.606+00:00', '2026-03-25T04:13:26.825859+00:00'),
  (36, 'PH-0032', 'Gauze Bandage 4"x4m', NULL, 'Standard', NULL, '10131945280', 'Medical Supplies', 'Carton', 'Piece', 1500, 50, 40, 10, 40, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 50, NULL, 'BSN Medical', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:13:28.567+00:00', '2026-03-25T04:13:27.801741+00:00'),
  (39, 'PH-0035', 'Baby Diapers Size 3 (50pk)', NULL, 'Standard', NULL, '10134231640', 'Baby & Child Care', 'Carton', 'Piece', 2800, 850, 780, 10, 17.65, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 4, NULL, 'Pampers', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:13:31.429+00:00', '2026-03-25T04:13:30.635035+00:00'),
  (42, 'PH-0038', 'Vitamin C 1000mg', NULL, 'Standard', NULL, '10137001250', 'Vitamins & Supplements', 'Box', 'Piece', 350, 20, 15, 10, 41.67, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 30, 'Ascorbic Acid', 'Nature Made', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:13:34.325+00:00', '2026-03-25T04:13:33.540647+00:00'),
  (45, 'PH-0041', 'Omega-3 Fish Oil 1000mg', NULL, 'Standard', NULL, '10140547570', 'Vitamins & Supplements', 'Box', 'Piece', 500, 30, 25, 10, 44.44, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 30, 'EPA/DHA', 'Nordic Naturals', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:13:37.172+00:00', '2026-03-25T04:13:36.385659+00:00'),
  (48, 'PH-0044', 'Dextrose 5% 500ml', NULL, 'Standard', NULL, '10143810980', 'IV Fluids', 'Carton', 'Piece', 1800, 220, 180, 10, 31.82, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 12, 'Dextrose', 'Baxter', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:13:40.094+00:00', '2026-03-25T04:13:39.305994+00:00'),
  (51, 'PH-0047', 'Prednisolone 5mg', NULL, 'Standard', NULL, '10146990710', 'Respiratory', 'Box', 'Piece', 200, 5, 4, 10, 60, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 100, 'Prednisolone', 'Pfizer', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:13:42.902+00:00', '2026-03-25T04:13:42.103866+00:00'),
  (54, 'PH-0050', 'Methylated Spirit 1L', NULL, 'Standard', NULL, '10149645760', 'Antiseptics', 'Carton', 'Piece', 1800, 400, 350, 10, 25, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 6, 'Denatured Ethanol', 'Local', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:13:45.841+00:00', '2026-03-25T04:13:45.047976+00:00'),
  (37, 'PH-0033', 'Surgical Face Masks', NULL, 'Standard', NULL, '10132657990', 'Medical Supplies', 'Bag', 'Piece', 250, 10, 8, 10, 50, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 50, NULL, '3M', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:13:29.529+00:00', '2026-03-25T04:13:28.729567+00:00'),
  (40, 'PH-0036', 'Baby Lotion 200ml', NULL, 'Standard', NULL, '10135864560', 'Baby & Child Care', 'Carton', 'Piece', 2400, 280, 250, 10, 28.57, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 12, NULL, 'Johnson Baby', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:13:32.381+00:00', '2026-03-25T04:13:31.597155+00:00'),
  (43, 'PH-0039', 'Vitamin D3 2000IU', NULL, 'Standard', NULL, '10138833030', 'Vitamins & Supplements', 'Box', 'Piece', 600, 18, 15, 10, 44.44, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 60, 'Cholecalciferol', 'NOW Foods', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:13:35.286+00:00', '2026-03-25T04:13:34.498312+00:00'),
  (46, 'PH-0042', 'Folic Acid 5mg', NULL, 'Standard', NULL, '10141009730', 'Vitamins & Supplements', 'Box', 'Piece', 180, 5, 4, 10, 64, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 100, 'Folic Acid', 'Nature Made', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:13:38.165+00:00', '2026-03-25T04:13:37.378407+00:00'),
  (49, 'PH-0045', 'Ringers Lactate 1L', NULL, 'Standard', NULL, '10144776780', 'IV Fluids', 'Carton', 'Piece', 2640, 320, 280, 10, 31.25, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 12, 'Ringer Lactate', 'Fresenius', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:13:41.044+00:00', '2026-03-25T04:13:40.27421+00:00'),
  (52, 'PH-0048', 'Dettol Liquid 500ml', NULL, 'Standard', NULL, '10147130270', 'Antiseptics', 'Carton', 'Piece', 3600, 400, 350, 10, 25, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 12, 'Chloroxylenol', 'Reckitt', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:13:43.847+00:00', '2026-03-25T04:13:43.069212+00:00'),
  (38, 'PH-0034', 'Hand Sanitizer 500ml', NULL, 'Standard', NULL, '10133303440', 'Medical Supplies', 'Carton', 'Piece', 1800, 200, 180, 10, 25, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 12, 'Ethanol 70%', 'Dettol', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:13:30.484+00:00', '2026-03-25T04:13:29.709852+00:00'),
  (41, 'PH-0037', 'Zinc Cream for Babies 50g', NULL, 'Standard', NULL, '10136610080', 'Baby & Child Care', 'Carton', 'Piece', 1440, 180, 150, 10, 33.33, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 12, 'Zinc Oxide', 'Sudocrem', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:13:33.333+00:00', '2026-03-25T04:13:32.534469+00:00'),
  (44, 'PH-0040', 'Calcium + D3 Tablets', NULL, 'Standard', NULL, '10139864250', 'Vitamins & Supplements', 'Box', 'Piece', 450, 15, 12, 10, 50, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 60, 'Calcium Carbonate', 'Caltrate', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:13:36.231+00:00', '2026-03-25T04:13:35.420164+00:00'),
  (47, 'PH-0043', 'Normal Saline 1L', NULL, 'Standard', NULL, '10142682400', 'IV Fluids', 'Carton', 'Piece', 2400, 300, 250, 10, 33.33, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 12, 'NaCl 0.9%', 'Baxter', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:13:39.124+00:00', '2026-03-25T04:13:38.336881+00:00'),
  (50, 'PH-0046', 'Salbutamol Inhaler 200D', NULL, 'Standard', NULL, '10145696470', 'Respiratory', 'Box', 'Piece', 350, 500, 450, 10, 30, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 1, 'Salbutamol', 'GSK', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:13:41.991+00:00', '2026-03-25T04:13:41.192373+00:00'),
  (53, 'PH-0049', 'Hydrogen Peroxide 500ml', NULL, 'Standard', NULL, '10148489390', 'Antiseptics', 'Carton', 'Piece', 1200, 150, 120, 10, 33.33, TRUE, 'from-teal-400 to-teal-600', NULL, NULL, NULL, NULL, TRUE, 12, 'H2O2 3%', 'Merck', 'Tablet', NULL, FALSE, NULL, FALSE, NULL, 1, '2026-03-25T04:13:44.885+00:00', '2026-03-25T04:13:44.128459+00:00')
ON CONFLICT DO NOTHING;

-- ==================== PHARMACY_BATCHES ====================
INSERT INTO public.pharmacy_batches ("batch_id", "product_id", "batch_number", "expiry_date", "manufacture_date", "quantity", "remaining_qty", "purchase_cost", "selling_price", "supplier_id", "supplier_name", "purchase_invoice", "status", "notes", "outlet_id", "created_at", "updated_at") VALUES
  (3, 2, 'KFJ896', '2026-03-28', '2024-12-30', 10, 10, 100, 10, NULL, NULL, NULL, 'Deleted', NULL, 1, '2026-03-24T15:03:16.499068+00:00', '2026-03-24T15:03:16.499068+00:00'),
  (4, 2, 'IRJ5896', '2027-12-24', '2026-03-01', 10, 10, 100, 2, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-24T15:37:07.466483+00:00', '2026-03-24T15:37:07.466483+00:00'),
  (1, 1, 'JMM4656', '2026-03-25', '2025-09-23', 100, 89, 500, 10, NULL, NULL, NULL, 'Deleted', NULL, 1, '2026-03-23T12:03:05.366079+00:00', '2026-03-24T06:19:24.786+00:00'),
  (2, 1, 'OKK456', '2027-01-01', '2026-03-02', 20, 12, 500, 10, NULL, NULL, NULL, 'Deleted', NULL, 1, '2026-03-23T12:03:06.498335+00:00', '2026-03-23T15:30:28.364+00:00'),
  (5, 1, 'V785J', '2027-07-24', '2026-03-24', 10, 10, 500, 7, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-24T15:38:42.065515+00:00', '2026-03-24T15:38:42.065515+00:00'),
  (6, 2, 'D568L', '2026-09-26', '2026-03-25', 10, 10, 100, 2, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T03:56:24.980301+00:00', '2026-03-25T03:56:24.980301+00:00'),
  (7, 3, 'C45PO', '2027-01-01', '2025-01-25', 10, 10, 1200, 130, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:00:30.311649+00:00', '2026-03-25T04:00:30.311649+00:00'),
  (8, 4, '589M', '2027-05-25', '2026-03-25', 10, 10, 1500, 100, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:04:14.797165+00:00', '2026-03-25T04:04:14.797165+00:00'),
  (9, 5, 'BN0001', '2026-12-25', '2024-12-25', 37, 37, 150, 5, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:12:57.321995+00:00', '2026-03-25T04:12:57.321995+00:00'),
  (10, 5, 'BN0002', '2027-08-14', '2026-01-25', 14, 14, 150, 5, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:12:57.697898+00:00', '2026-03-25T04:12:57.697898+00:00'),
  (11, 6, 'BN0003', '2026-08-01', '2025-05-25', 60, 60, 350, 10, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:12:58.605387+00:00', '2026-03-25T04:12:58.605387+00:00'),
  (12, 6, 'BN0004', '2027-07-20', '2025-11-25', 49, 49, 350, 10, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:12:58.824715+00:00', '2026-03-25T04:12:58.824715+00:00'),
  (13, 7, 'BN0005', '2026-09-26', '2025-04-25', 64, 64, 280, 8, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:12:59.538826+00:00', '2026-03-25T04:12:59.538826+00:00'),
  (14, 7, 'BN0006', '2027-12-23', '2025-11-25', 47, 47, 280, 8, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:12:59.793892+00:00', '2026-03-25T04:12:59.793892+00:00'),
  (15, 8, 'BN0007', '2026-12-02', '2025-04-25', 51, 51, 200, 5, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:00.660384+00:00', '2026-03-25T04:13:00.660384+00:00'),
  (16, 8, 'BN0008', '2027-07-02', '2025-09-25', 11, 11, 200, 5, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:00.91973+00:00', '2026-03-25T04:13:00.91973+00:00'),
  (17, 9, 'BN0009', '2027-06-03', '2025-03-25', 22, 22, 450, 15, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:01.725215+00:00', '2026-03-25T04:13:01.725215+00:00'),
  (18, 9, 'BN0010', '2027-10-25', '2025-10-25', 15, 15, 450, 15, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:01.948566+00:00', '2026-03-25T04:13:01.948566+00:00'),
  (19, 10, 'BN0011', '2027-04-29', '2025-01-25', 45, 45, 180, 15, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:02.743072+00:00', '2026-03-25T04:13:02.743072+00:00'),
  (20, 10, 'BN0012', '2027-01-28', '2026-01-25', 32, 32, 180, 15, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:02.979394+00:00', '2026-03-25T04:13:02.979394+00:00'),
  (21, 11, 'BN0013', '2026-07-25', '2025-02-25', 65, 65, 160, 5, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:03.790236+00:00', '2026-03-25T04:13:03.790236+00:00'),
  (22, 11, 'BN0014', '2028-03-22', '2025-11-25', 25, 25, 160, 5, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:04.102808+00:00', '2026-03-25T04:13:04.102808+00:00'),
  (23, 12, 'BN0015', '2026-10-16', '2024-12-25', 42, 42, 120, 5, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:04.85809+00:00', '2026-03-25T04:13:04.85809+00:00'),
  (24, 12, 'BN0016', '2027-04-27', '2025-09-25', 20, 20, 120, 5, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:05.070655+00:00', '2026-03-25T04:13:05.070655+00:00'),
  (25, 13, 'BN0017', '2027-01-19', '2025-09-25', 60, 60, 300, 25, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:05.761351+00:00', '2026-03-25T04:13:05.761351+00:00'),
  (26, 13, 'BN0018', '2028-02-08', '2025-09-25', 30, 30, 300, 25, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:06.024597+00:00', '2026-03-25T04:13:06.024597+00:00'),
  (27, 14, 'BN0019', '2027-05-27', '2024-11-25', 52, 52, 250, 20, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:06.682401+00:00', '2026-03-25T04:13:06.682401+00:00'),
  (28, 14, 'BN0020', '2026-10-31', '2026-01-25', 46, 46, 250, 20, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:06.95149+00:00', '2026-03-25T04:13:06.95149+00:00'),
  (29, 15, 'BN0021', '2026-10-08', '2025-06-25', 33, 33, 120, 200, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:07.672304+00:00', '2026-03-25T04:13:07.672304+00:00'),
  (30, 15, 'BN0022', '2027-06-27', '2025-12-25', 33, 33, 120, 200, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:07.936707+00:00', '2026-03-25T04:13:07.936707+00:00'),
  (31, 16, 'BN0023', '2027-02-25', '2024-11-25', 27, 27, 180, 300, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:08.646662+00:00', '2026-03-25T04:13:08.646662+00:00'),
  (32, 16, 'BN0024', '2027-10-26', '2025-11-25', 21, 21, 180, 300, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:08.886642+00:00', '2026-03-25T04:13:08.886642+00:00'),
  (33, 17, 'BN0025', '2026-08-30', '2025-08-25', 28, 28, 80, 150, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:09.606541+00:00', '2026-03-25T04:13:09.606541+00:00'),
  (34, 17, 'BN0026', '2027-03-21', '2026-02-25', 26, 26, 80, 150, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:09.838432+00:00', '2026-03-25T04:13:09.838432+00:00'),
  (35, 18, 'BN0027', '2026-10-09', '2025-09-25', 68, 68, 100, 180, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:10.821309+00:00', '2026-03-25T04:13:10.821309+00:00'),
  (36, 18, 'BN0028', '2027-05-13', '2026-01-25', 40, 40, 100, 180, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:11.03425+00:00', '2026-03-25T04:13:11.03425+00:00'),
  (37, 19, 'BN0029', '2026-10-03', '2024-12-25', 33, 33, 150, 280, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:11.772558+00:00', '2026-03-25T04:13:11.772558+00:00'),
  (38, 19, 'BN0030', '2027-12-05', '2025-12-25', 16, 16, 150, 280, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:11.987568+00:00', '2026-03-25T04:13:11.987568+00:00'),
  (39, 20, 'BN0031', '2027-09-08', '2025-07-25', 27, 27, 200, 350, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:12.714821+00:00', '2026-03-25T04:13:12.714821+00:00'),
  (40, 20, 'BN0032', '2026-11-04', '2025-11-25', 42, 42, 200, 350, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:12.948153+00:00', '2026-03-25T04:13:12.948153+00:00'),
  (41, 21, 'BN0033', '2027-05-23', '2024-11-25', 33, 33, 250, 80, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:13.635315+00:00', '2026-03-25T04:13:13.635315+00:00'),
  (42, 21, 'BN0034', '2027-11-29', '2025-12-25', 14, 14, 250, 80, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:13.940115+00:00', '2026-03-25T04:13:13.940115+00:00'),
  (43, 22, 'BN0035', '2026-10-03', '2025-06-25', 45, 45, 400, 60, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:14.669985+00:00', '2026-03-25T04:13:14.669985+00:00'),
  (44, 22, 'BN0036', '2028-01-05', '2025-11-25', 19, 19, 400, 60, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:14.901246+00:00', '2026-03-25T04:13:14.901246+00:00'),
  (45, 23, 'BN0037', '2026-10-23', '2025-06-25', 58, 58, 350, 50, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:15.771173+00:00', '2026-03-25T04:13:15.771173+00:00'),
  (46, 23, 'BN0038', '2027-09-09', '2026-02-25', 25, 25, 350, 50, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:16.025871+00:00', '2026-03-25T04:13:16.025871+00:00'),
  (47, 24, 'BN0039', '2027-06-08', '2024-12-25', 27, 27, 1200, 180, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:16.67715+00:00', '2026-03-25T04:13:16.67715+00:00'),
  (48, 24, 'BN0040', '2027-10-17', '2026-01-25', 48, 48, 1200, 180, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:16.951153+00:00', '2026-03-25T04:13:16.951153+00:00'),
  (49, 25, 'BN0041', '2027-02-28', '2025-04-25', 58, 58, 1200, 150, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:17.67702+00:00', '2026-03-25T04:13:17.67702+00:00'),
  (50, 25, 'BN0042', '2027-01-17', '2025-12-25', 40, 40, 1200, 150, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:17.890478+00:00', '2026-03-25T04:13:17.890478+00:00'),
  (51, 26, 'BN0043', '2027-04-18', '2025-09-25', 56, 56, 600, 80, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:18.570389+00:00', '2026-03-25T04:13:18.570389+00:00'),
  (52, 26, 'BN0044', '2027-08-22', '2025-12-25', 11, 11, 600, 80, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:18.823947+00:00', '2026-03-25T04:13:18.823947+00:00'),
  (53, 27, 'BN0045', '2026-08-27', '2025-04-25', 24, 24, 960, 120, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:19.53096+00:00', '2026-03-25T04:13:19.53096+00:00'),
  (54, 27, 'BN0046', '2026-11-27', '2025-09-25', 15, 15, 960, 120, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:19.769906+00:00', '2026-03-25T04:13:19.769906+00:00'),
  (55, 28, 'BN0047', '2027-06-06', '2025-04-25', 38, 38, 720, 100, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:20.428616+00:00', '2026-03-25T04:13:20.428616+00:00'),
  (56, 28, 'BN0048', '2028-03-04', '2026-02-25', 13, 13, 720, 100, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:20.64047+00:00', '2026-03-25T04:13:20.64047+00:00'),
  (62, 31, 'BN0054', '2028-01-08', '2026-02-25', 42, 42, 600, 100, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:23.412814+00:00', '2026-03-25T04:13:23.412814+00:00'),
  (68, 34, 'BN0060', '2026-12-27', '2025-12-25', 27, 27, 600, 12, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:26.338487+00:00', '2026-03-25T04:13:26.338487+00:00'),
  (74, 37, 'BN0066', '2026-12-05', '2025-12-25', 37, 37, 250, 10, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:29.22776+00:00', '2026-03-25T04:13:29.22776+00:00'),
  (80, 40, 'BN0072', '2028-01-28', '2025-10-25', 47, 47, 2400, 280, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:32.101381+00:00', '2026-03-25T04:13:32.101381+00:00'),
  (86, 43, 'BN0078', '2027-05-25', '2026-01-25', 46, 46, 600, 18, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:34.976368+00:00', '2026-03-25T04:13:34.976368+00:00'),
  (92, 46, 'BN0084', '2027-11-08', '2025-11-25', 26, 26, 180, 5, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:37.8516+00:00', '2026-03-25T04:13:37.8516+00:00'),
  (98, 49, 'BN0090', '2027-01-27', '2026-01-25', 18, 18, 2640, 320, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:40.735242+00:00', '2026-03-25T04:13:40.735242+00:00'),
  (104, 52, 'BN0096', '2027-08-26', '2025-10-25', 42, 42, 3600, 400, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:43.627828+00:00', '2026-03-25T04:13:43.627828+00:00'),
  (57, 29, 'BN0049', '2027-04-02', '2024-10-25', 51, 51, 1440, 100, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:21.364122+00:00', '2026-03-25T04:13:21.364122+00:00'),
  (63, 32, 'BN0055', '2027-03-13', '2025-03-25', 52, 52, 800, 120, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:24.176708+00:00', '2026-03-25T04:13:24.176708+00:00'),
  (69, 35, 'BN0061', '2026-12-26', '2024-10-25', 37, 37, 200, 350, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:27.047588+00:00', '2026-03-25T04:13:27.047588+00:00'),
  (75, 38, 'BN0067', '2027-08-26', '2024-10-25', 62, 62, 1800, 200, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:29.937747+00:00', '2026-03-25T04:13:29.937747+00:00'),
  (81, 41, 'BN0073', '2026-08-27', '2025-06-25', 32, 32, 1440, 180, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:32.757126+00:00', '2026-03-25T04:13:32.757126+00:00'),
  (87, 44, 'BN0079', '2026-08-09', '2025-06-25', 41, 41, 450, 15, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:35.647304+00:00', '2026-03-25T04:13:35.647304+00:00'),
  (93, 47, 'BN0085', '2026-11-24', '2024-11-25', 25, 25, 2400, 300, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:38.554172+00:00', '2026-03-25T04:13:38.554172+00:00'),
  (99, 50, 'BN0091', '2027-05-19', '2025-03-25', 57, 57, 350, 500, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:41.449913+00:00', '2026-03-25T04:13:41.449913+00:00'),
  (105, 53, 'BN0097', '2027-02-20', '2025-04-25', 40, 40, 1200, 150, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:44.352762+00:00', '2026-03-25T04:13:44.352762+00:00'),
  (58, 29, 'BN0050', '2026-12-26', '2025-12-25', 39, 39, 1440, 100, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:21.573697+00:00', '2026-03-25T04:13:21.573697+00:00'),
  (64, 32, 'BN0056', '2028-01-06', '2025-10-25', 45, 45, 800, 120, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:24.391533+00:00', '2026-03-25T04:13:24.391533+00:00'),
  (70, 35, 'BN0062', '2027-09-11', '2025-10-25', 36, 36, 200, 350, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:27.298235+00:00', '2026-03-25T04:13:27.298235+00:00'),
  (76, 38, 'BN0068', '2026-11-23', '2026-02-25', 32, 32, 1800, 200, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:30.168881+00:00', '2026-03-25T04:13:30.168881+00:00'),
  (82, 41, 'BN0074', '2027-06-16', '2025-10-25', 31, 31, 1440, 180, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:33.060105+00:00', '2026-03-25T04:13:33.060105+00:00'),
  (88, 44, 'BN0080', '2027-02-17', '2025-12-25', 47, 47, 450, 15, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:35.886604+00:00', '2026-03-25T04:13:35.886604+00:00'),
  (94, 47, 'BN0086', '2027-05-13', '2025-11-25', 15, 15, 2400, 300, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:38.821213+00:00', '2026-03-25T04:13:38.821213+00:00'),
  (100, 50, 'BN0092', '2026-12-07', '2025-12-25', 11, 11, 350, 500, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:41.6656+00:00', '2026-03-25T04:13:41.6656+00:00'),
  (106, 53, 'BN0098', '2027-08-26', '2026-02-25', 17, 17, 1200, 150, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:44.591398+00:00', '2026-03-25T04:13:44.591398+00:00'),
  (59, 30, 'BN0051', '2026-09-12', '2024-11-25', 22, 22, 500, 80, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:22.275319+00:00', '2026-03-25T04:13:22.275319+00:00'),
  (65, 33, 'BN0057', '2026-07-26', '2025-02-25', 55, 55, 500, 10, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:25.118068+00:00', '2026-03-25T04:13:25.118068+00:00'),
  (71, 36, 'BN0063', '2027-08-28', '2025-01-25', 45, 45, 1500, 50, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:28.031694+00:00', '2026-03-25T04:13:28.031694+00:00'),
  (77, 39, 'BN0069', '2027-05-23', '2025-01-25', 35, 35, 2800, 850, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:30.897908+00:00', '2026-03-25T04:13:30.897908+00:00'),
  (83, 42, 'BN0075', '2027-06-21', '2025-03-25', 68, 68, 350, 20, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:33.778074+00:00', '2026-03-25T04:13:33.778074+00:00'),
  (89, 45, 'BN0081', '2026-06-29', '2025-04-25', 46, 46, 500, 30, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:36.609045+00:00', '2026-03-25T04:13:36.609045+00:00'),
  (95, 48, 'BN0087', '2027-02-23', '2025-08-25', 22, 22, 1800, 220, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:39.535598+00:00', '2026-03-25T04:13:39.535598+00:00'),
  (101, 51, 'BN0093', '2027-03-06', '2025-09-25', 28, 28, 200, 5, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:42.3168+00:00', '2026-03-25T04:13:42.3168+00:00'),
  (107, 54, 'BN0099', '2027-07-29', '2025-05-25', 30, 30, 1800, 400, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:45.304011+00:00', '2026-03-25T04:13:45.304011+00:00'),
  (60, 30, 'BN0052', '2027-04-28', '2025-10-25', 33, 33, 500, 80, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:22.487219+00:00', '2026-03-25T04:13:22.487219+00:00'),
  (66, 33, 'BN0058', '2027-01-23', '2025-09-25', 24, 24, 500, 10, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:25.384+00:00', '2026-03-25T04:13:25.384+00:00'),
  (72, 36, 'BN0064', '2027-03-18', '2025-10-25', 37, 37, 1500, 50, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:28.262492+00:00', '2026-03-25T04:13:28.262492+00:00'),
  (78, 39, 'BN0070', '2027-12-29', '2025-12-25', 32, 32, 2800, 850, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:31.146162+00:00', '2026-03-25T04:13:31.146162+00:00'),
  (84, 42, 'BN0076', '2027-09-16', '2026-02-25', 31, 31, 350, 20, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:33.996577+00:00', '2026-03-25T04:13:33.996577+00:00'),
  (90, 45, 'BN0082', '2027-01-31', '2026-01-25', 42, 42, 500, 30, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:36.837821+00:00', '2026-03-25T04:13:36.837821+00:00'),
  (96, 48, 'BN0088', '2027-04-29', '2025-12-25', 48, 48, 1800, 220, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:39.777769+00:00', '2026-03-25T04:13:39.777769+00:00'),
  (102, 51, 'BN0094', '2027-05-08', '2025-10-25', 15, 15, 200, 5, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:42.584822+00:00', '2026-03-25T04:13:42.584822+00:00'),
  (108, 54, 'BN0100', '2027-08-20', '2025-11-25', 32, 32, 1800, 400, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:45.530982+00:00', '2026-03-25T04:13:45.530982+00:00'),
  (61, 31, 'BN0053', '2027-09-15', '2025-05-25', 34, 34, 600, 100, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:23.200692+00:00', '2026-03-25T04:13:23.200692+00:00'),
  (67, 34, 'BN0059', '2026-10-24', '2024-11-25', 40, 40, 600, 12, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:26.09418+00:00', '2026-03-25T04:13:26.09418+00:00'),
  (73, 37, 'BN0065', '2027-05-17', '2024-10-25', 23, 23, 250, 10, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:28.978379+00:00', '2026-03-25T04:13:28.978379+00:00'),
  (79, 40, 'BN0071', '2026-10-15', '2025-06-25', 55, 55, 2400, 280, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:31.858676+00:00', '2026-03-25T04:13:31.858676+00:00'),
  (85, 43, 'BN0077', '2027-06-11', '2025-06-25', 63, 63, 600, 18, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:34.72605+00:00', '2026-03-25T04:13:34.72605+00:00'),
  (91, 46, 'BN0083', '2027-01-18', '2025-07-25', 56, 56, 180, 5, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:37.61635+00:00', '2026-03-25T04:13:37.61635+00:00'),
  (97, 49, 'BN0089', '2027-05-18', '2025-03-25', 65, 65, 2640, 320, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:40.51323+00:00', '2026-03-25T04:13:40.51323+00:00'),
  (103, 52, 'BN0095', '2026-12-01', '2024-10-25', 33, 33, 3600, 400, NULL, NULL, NULL, 'Active', NULL, 1, '2026-03-25T04:13:43.384216+00:00', '2026-03-25T04:13:43.384216+00:00')
ON CONFLICT DO NOTHING;

-- ==================== PHARMACY_STOCK ====================
INSERT INTO public.pharmacy_stock ("st_id", "pid", "batch_id", "invoice_no", "qty", "storage_type", "expiry_date", "notes", "outlet_id", "created_at", "updated_at") VALUES
  (2, 1, NULL, 'SALE', -1, 'Pieces', NULL, NULL, 1, '2026-03-24T14:38:39.145283+00:00', '2026-03-24T14:38:39.145283+00:00'),
  (3, 1, NULL, 'SALE', -1, 'Pieces', NULL, NULL, 1, '2026-03-24T14:38:41.796708+00:00', '2026-03-24T14:38:41.796708+00:00'),
  (4, 1, NULL, 'SALE', -1, 'Pieces', NULL, NULL, 1, '2026-03-24T14:38:54.938718+00:00', '2026-03-24T14:38:54.938718+00:00'),
  (5, 1, NULL, 'SALE', -1, 'Pieces', NULL, NULL, 1, '2026-03-24T14:39:39.244466+00:00', '2026-03-24T14:39:39.244466+00:00'),
  (1, 1, NULL, NULL, 115, 'Store', NULL, NULL, 1, '2026-03-23T12:03:04.873019+00:00', '2026-03-23T12:03:04.873019+00:00'),
  (6, 2, NULL, NULL, 30, 'Store', NULL, NULL, 1, '2026-03-24T15:03:16.177718+00:00', '2026-03-24T15:03:16.177718+00:00'),
  (7, 3, NULL, NULL, 10, 'Store', NULL, NULL, 1, '2026-03-25T04:00:30.023523+00:00', '2026-03-25T04:00:30.023523+00:00'),
  (8, 4, NULL, NULL, 10, 'Store', NULL, NULL, 1, '2026-03-25T04:04:14.481592+00:00', '2026-03-25T04:04:14.481592+00:00'),
  (9, 5, NULL, 'SEED', 51, 'Store', NULL, NULL, 1, '2026-03-25T04:12:58.005646+00:00', '2026-03-25T04:12:58.005646+00:00'),
  (10, 6, NULL, 'SEED', 109, 'Store', NULL, NULL, 1, '2026-03-25T04:12:59.057798+00:00', '2026-03-25T04:12:59.057798+00:00'),
  (11, 7, NULL, 'SEED', 111, 'Store', NULL, NULL, 1, '2026-03-25T04:13:00.030209+00:00', '2026-03-25T04:13:00.030209+00:00'),
  (12, 8, NULL, 'SEED', 62, 'Store', NULL, NULL, 1, '2026-03-25T04:13:01.222093+00:00', '2026-03-25T04:13:01.222093+00:00'),
  (13, 9, NULL, 'SEED', 37, 'Store', NULL, NULL, 1, '2026-03-25T04:13:02.184175+00:00', '2026-03-25T04:13:02.184175+00:00'),
  (14, 10, NULL, 'SEED', 77, 'Store', NULL, NULL, 1, '2026-03-25T04:13:03.224648+00:00', '2026-03-25T04:13:03.224648+00:00'),
  (15, 11, NULL, 'SEED', 90, 'Store', NULL, NULL, 1, '2026-03-25T04:13:04.344655+00:00', '2026-03-25T04:13:04.344655+00:00'),
  (16, 12, NULL, 'SEED', 62, 'Store', NULL, NULL, 1, '2026-03-25T04:13:05.296107+00:00', '2026-03-25T04:13:05.296107+00:00'),
  (17, 13, NULL, 'SEED', 90, 'Store', NULL, NULL, 1, '2026-03-25T04:13:06.235089+00:00', '2026-03-25T04:13:06.235089+00:00'),
  (18, 14, NULL, 'SEED', 98, 'Store', NULL, NULL, 1, '2026-03-25T04:13:07.219898+00:00', '2026-03-25T04:13:07.219898+00:00'),
  (19, 15, NULL, 'SEED', 66, 'Store', NULL, NULL, 1, '2026-03-25T04:13:08.176476+00:00', '2026-03-25T04:13:08.176476+00:00'),
  (20, 16, NULL, 'SEED', 48, 'Store', NULL, NULL, 1, '2026-03-25T04:13:09.129976+00:00', '2026-03-25T04:13:09.129976+00:00'),
  (21, 17, NULL, 'SEED', 54, 'Store', NULL, NULL, 1, '2026-03-25T04:13:10.34572+00:00', '2026-03-25T04:13:10.34572+00:00'),
  (22, 18, NULL, 'SEED', 108, 'Store', NULL, NULL, 1, '2026-03-25T04:13:11.280099+00:00', '2026-03-25T04:13:11.280099+00:00'),
  (23, 19, NULL, 'SEED', 49, 'Store', NULL, NULL, 1, '2026-03-25T04:13:12.203335+00:00', '2026-03-25T04:13:12.203335+00:00'),
  (24, 20, NULL, 'SEED', 69, 'Store', NULL, NULL, 1, '2026-03-25T04:13:13.175997+00:00', '2026-03-25T04:13:13.175997+00:00'),
  (25, 21, NULL, 'SEED', 47, 'Store', NULL, NULL, 1, '2026-03-25T04:13:14.177051+00:00', '2026-03-25T04:13:14.177051+00:00'),
  (26, 22, NULL, 'SEED', 64, 'Store', NULL, NULL, 1, '2026-03-25T04:13:15.290376+00:00', '2026-03-25T04:13:15.290376+00:00'),
  (27, 23, NULL, 'SEED', 83, 'Store', NULL, NULL, 1, '2026-03-25T04:13:16.238082+00:00', '2026-03-25T04:13:16.238082+00:00'),
  (28, 24, NULL, 'SEED', 75, 'Store', NULL, NULL, 1, '2026-03-25T04:13:17.197082+00:00', '2026-03-25T04:13:17.197082+00:00'),
  (29, 25, NULL, 'SEED', 98, 'Store', NULL, NULL, 1, '2026-03-25T04:13:18.105332+00:00', '2026-03-25T04:13:18.105332+00:00'),
  (30, 26, NULL, 'SEED', 67, 'Store', NULL, NULL, 1, '2026-03-25T04:13:19.06571+00:00', '2026-03-25T04:13:19.06571+00:00'),
  (31, 27, NULL, 'SEED', 39, 'Store', NULL, NULL, 1, '2026-03-25T04:13:19.982412+00:00', '2026-03-25T04:13:19.982412+00:00'),
  (32, 28, NULL, 'SEED', 51, 'Store', NULL, NULL, 1, '2026-03-25T04:13:20.904994+00:00', '2026-03-25T04:13:20.904994+00:00'),
  (33, 29, NULL, 'SEED', 90, 'Store', NULL, NULL, 1, '2026-03-25T04:13:21.801556+00:00', '2026-03-25T04:13:21.801556+00:00'),
  (34, 30, NULL, 'SEED', 55, 'Store', NULL, NULL, 1, '2026-03-25T04:13:22.730304+00:00', '2026-03-25T04:13:22.730304+00:00'),
  (35, 31, NULL, 'SEED', 76, 'Store', NULL, NULL, 1, '2026-03-25T04:13:23.666117+00:00', '2026-03-25T04:13:23.666117+00:00'),
  (36, 32, NULL, 'SEED', 97, 'Store', NULL, NULL, 1, '2026-03-25T04:13:24.614663+00:00', '2026-03-25T04:13:24.614663+00:00'),
  (37, 33, NULL, 'SEED', 79, 'Store', NULL, NULL, 1, '2026-03-25T04:13:25.617586+00:00', '2026-03-25T04:13:25.617586+00:00'),
  (38, 34, NULL, 'SEED', 67, 'Store', NULL, NULL, 1, '2026-03-25T04:13:26.580311+00:00', '2026-03-25T04:13:26.580311+00:00'),
  (39, 35, NULL, 'SEED', 73, 'Store', NULL, NULL, 1, '2026-03-25T04:13:27.551145+00:00', '2026-03-25T04:13:27.551145+00:00'),
  (40, 36, NULL, 'SEED', 82, 'Store', NULL, NULL, 1, '2026-03-25T04:13:28.477692+00:00', '2026-03-25T04:13:28.477692+00:00'),
  (41, 37, NULL, 'SEED', 60, 'Store', NULL, NULL, 1, '2026-03-25T04:13:29.460437+00:00', '2026-03-25T04:13:29.460437+00:00'),
  (42, 38, NULL, 'SEED', 94, 'Store', NULL, NULL, 1, '2026-03-25T04:13:30.40518+00:00', '2026-03-25T04:13:30.40518+00:00'),
  (43, 39, NULL, 'SEED', 67, 'Store', NULL, NULL, 1, '2026-03-25T04:13:31.363005+00:00', '2026-03-25T04:13:31.363005+00:00'),
  (44, 40, NULL, 'SEED', 102, 'Store', NULL, NULL, 1, '2026-03-25T04:13:32.31342+00:00', '2026-03-25T04:13:32.31342+00:00'),
  (45, 41, NULL, 'SEED', 63, 'Store', NULL, NULL, 1, '2026-03-25T04:13:33.285607+00:00', '2026-03-25T04:13:33.285607+00:00'),
  (46, 42, NULL, 'SEED', 99, 'Store', NULL, NULL, 1, '2026-03-25T04:13:34.259823+00:00', '2026-03-25T04:13:34.259823+00:00'),
  (47, 43, NULL, 'SEED', 109, 'Store', NULL, NULL, 1, '2026-03-25T04:13:35.218862+00:00', '2026-03-25T04:13:35.218862+00:00'),
  (48, 44, NULL, 'SEED', 88, 'Store', NULL, NULL, 1, '2026-03-25T04:13:36.15086+00:00', '2026-03-25T04:13:36.15086+00:00'),
  (49, 45, NULL, 'SEED', 88, 'Store', NULL, NULL, 1, '2026-03-25T04:13:37.129825+00:00', '2026-03-25T04:13:37.129825+00:00'),
  (50, 46, NULL, 'SEED', 82, 'Store', NULL, NULL, 1, '2026-03-25T04:13:38.058676+00:00', '2026-03-25T04:13:38.058676+00:00'),
  (51, 47, NULL, 'SEED', 40, 'Store', NULL, NULL, 1, '2026-03-25T04:13:39.054302+00:00', '2026-03-25T04:13:39.054302+00:00'),
  (52, 48, NULL, 'SEED', 70, 'Store', NULL, NULL, 1, '2026-03-25T04:13:40.010229+00:00', '2026-03-25T04:13:40.010229+00:00'),
  (53, 49, NULL, 'SEED', 83, 'Store', NULL, NULL, 1, '2026-03-25T04:13:40.967819+00:00', '2026-03-25T04:13:40.967819+00:00'),
  (54, 50, NULL, 'SEED', 68, 'Store', NULL, NULL, 1, '2026-03-25T04:13:41.885269+00:00', '2026-03-25T04:13:41.885269+00:00'),
  (55, 51, NULL, 'SEED', 43, 'Store', NULL, NULL, 1, '2026-03-25T04:13:42.814757+00:00', '2026-03-25T04:13:42.814757+00:00'),
  (56, 52, NULL, 'SEED', 75, 'Store', NULL, NULL, 1, '2026-03-25T04:13:43.858839+00:00', '2026-03-25T04:13:43.858839+00:00'),
  (57, 53, NULL, 'SEED', 57, 'Store', NULL, NULL, 1, '2026-03-25T04:13:44.828528+00:00', '2026-03-25T04:13:44.828528+00:00'),
  (58, 54, NULL, 'SEED', 62, 'Store', NULL, NULL, 1, '2026-03-25T04:13:45.786385+00:00', '2026-03-25T04:13:45.786385+00:00')
ON CONFLICT DO NOTHING;

-- ==================== PHARMACY_SALES ====================
INSERT INTO public.pharmacy_sales ("sale_id", "receipt_no", "sale_datetime", "subtotal", "discount", "tax", "total", "payment_method", "amount_paid", "change_amount", "customer_name", "cashier_name", "mpesa_receipt", "shift_instance_id", "checkout_request_id", "customer_phone", "status", "outlet_id", "created_at", "notes") VALUES
  (1, 'RX-0001', '2026-03-23T15:30:24.932+00:00', 20, 0, 0, 20, 'CASH', 20, 0, '', 'Super Admin', '', NULL, '', '', 'Completed', 1, '2026-03-23T15:30:25.725162+00:00', NULL),
  (2, 'RX-0002', '2026-03-24T04:47:46.837+00:00', 10, 0, 0, 10, 'CASH', 500, 490, '', 'Super Admin', '', 1, '', '', 'Completed', 1, '2026-03-24T04:47:46.89055+00:00', NULL),
  (3, 'RX-0003', '2026-03-24T05:11:15.227+00:00', 10, 0, 0, 10, 'CASH', 10, 0, '', 'Super Admin', '', 1, '', '', 'Completed', 1, '2026-03-24T05:11:15.113633+00:00', NULL),
  (4, 'RX-0004', '2026-03-24T05:32:58.577+00:00', 10, 0, 0, 10, 'CASH', 10, 0, '', 'Super Admin', '', 1, '', '', 'Completed', 1, '2026-03-24T05:32:58.459386+00:00', NULL),
  (5, 'RX-0005', '2026-03-24T05:49:00.768+00:00', 10, 0, 0, 10, 'CASH', 10, 0, '', 'Super Admin', '', 1, '', '', 'Completed', 1, '2026-03-24T05:49:00.67411+00:00', NULL),
  (6, 'RX-0006', '2026-03-24T06:10:28.542+00:00', 10, 0, 0, 10, 'CASH', 10, 0, NULL, 'Super Admin', NULL, 1, NULL, NULL, 'Completed', 1, '2026-03-24T06:10:28.393233+00:00', NULL),
  (7, 'RX-0007', '2026-03-24T06:19:22.961+00:00', 10, 0, 0, 10, 'CASH', 10, 0, NULL, 'Super Admin', NULL, 1, NULL, NULL, 'Completed', 1, '2026-03-24T06:19:23.184868+00:00', NULL),
  (8, 'RX-0008', '2026-03-24T06:44:02.639+00:00', 10, 0, 0, 10, 'CASH', 10, 0, NULL, 'Super Admin', NULL, 1, NULL, NULL, 'Completed', 1, '2026-03-24T06:44:02.619351+00:00', NULL),
  (9, 'RX-0009', '2026-03-24T06:45:50.412+00:00', 10, 0, 0, 10, 'CASH', 10, 0, NULL, 'Super Admin', NULL, 1, NULL, NULL, 'Completed', 1, '2026-03-24T06:45:50.381906+00:00', NULL),
  (10, 'TEST-RLS-CHECK', '2026-03-24T06:55:26.926427+00:00', 100, 0, 0, 100, 'Cash', 100, 0, NULL, NULL, NULL, NULL, NULL, NULL, 'Completed', 1, '2026-03-24T06:55:26.926427+00:00', NULL),
  (11, 'RX-0009', '2026-03-24T06:59:57.604+00:00', 10, 0, 0, 10, 'CASH', 10, 0, NULL, 'Super Admin', NULL, 1, NULL, NULL, 'Completed', 1, '2026-03-24T06:59:57.412804+00:00', NULL),
  (12, 'RX-0010', '2026-03-24T07:45:59.943+00:00', 10, 0, 0, 10, 'CASH', 10, 0, NULL, 'Super Admin', NULL, 1, NULL, NULL, 'Completed', 1, '2026-03-24T07:46:00.032437+00:00', NULL),
  (13, 'RX-0011', '2026-03-24T08:35:52.717+00:00', 30, 0, 0, 30, 'CASH', 100, 70, NULL, 'Super Admin', NULL, 1, NULL, NULL, 'Completed', 1, '2026-03-24T08:35:52.438608+00:00', NULL),
  (14, 'MAIN-RCP01', '2026-03-24T14:38:37.2+00:00', 10, 0, 0, 10, 'Cash', 10, 0, 'Jane', 'Super Admin', NULL, NULL, NULL, NULL, 'Completed', 1, '2026-03-24T14:38:38.001699+00:00', NULL),
  (15, 'MAIN-RCP01', '2026-03-24T14:38:40.458+00:00', 10, 0, 0, 10, 'Cash', 10, 0, 'Walk-in Customer', 'Super Admin', NULL, NULL, NULL, NULL, 'Completed', 1, '2026-03-24T14:38:40.872666+00:00', NULL),
  (16, 'MAIN-RCP02', '2026-03-24T14:38:52.737+00:00', 10, 0, 0, 10, 'Cash', 10, 0, 'Walk-in Customer', 'Super Admin', NULL, 1, NULL, NULL, 'Completed', 1, '2026-03-24T14:38:53.646655+00:00', NULL),
  (17, 'MAIN-RCP03', '2026-03-24T14:39:37.269+00:00', 10, 0, 0, 10, 'Cash', 10, 0, 'Walk-in Customer', 'Super Admin', NULL, 1, NULL, NULL, 'Completed', 1, '2026-03-24T14:39:38.152771+00:00', NULL)
ON CONFLICT DO NOTHING;

-- ==================== PHARMACY_SALES_ITEMS ====================
INSERT INTO public.pharmacy_sales_items ("item_id", "sale_id", "product_id", "product_name", "batch_id", "batch_number", "expiry_date", "quantity", "unit_price", "discount", "total", "purchase_price", "created_at", "notes") VALUES
  (1, 1, 1, 'PANADOL EXTRA ', 1, 'JMM4656', '2026-03-25', 1, 10, 0, 10, 500, '2026-03-23T15:30:26.168379+00:00', NULL),
  (2, 1, 1, 'PANADOL EXTRA ', 2, 'OKK456', '2027-01-01', 1, 10, 0, 10, 500, '2026-03-23T15:30:26.168379+00:00', NULL),
  (3, 2, 1, 'PANADOL EXTRA ', 1, 'JMM4656', '2026-03-25', 1, 10, 0, 10, 500, '2026-03-24T04:47:47.313218+00:00', NULL),
  (4, 3, 1, 'PANADOL EXTRA ', 1, 'JMM4656', '2026-03-25', 1, 10, 0, 10, 500, '2026-03-24T05:11:15.414709+00:00', NULL),
  (5, 4, 1, 'PANADOL EXTRA ', 1, 'JMM4656', '2026-03-25', 1, 10, 0, 10, 500, '2026-03-24T05:32:58.769371+00:00', NULL),
  (6, 5, 1, 'PANADOL EXTRA ', 1, 'JMM4656', '2026-03-25', 1, 10, 0, 10, 500, '2026-03-24T05:49:01.086213+00:00', NULL),
  (7, 6, 1, 'PANADOL EXTRA ', 1, 'JMM4656', '2026-03-25', 1, 10, 0, 10, 500, '2026-03-24T06:10:28.70728+00:00', 'MORNIG ONLY DAILY'),
  (8, 7, 1, 'PANADOL EXTRA ', 1, 'JMM4656', '2026-03-25', 1, 10, 0, 10, 500, '2026-03-24T06:19:23.650009+00:00', NULL),
  (9, 8, 1, 'PANADOL EXTRA ', 1, 'JMM4656', '2026-03-25', 1, 10, 0, 10, 500, '2026-03-24T06:44:03.246523+00:00', NULL),
  (10, 9, 1, 'PANADOL EXTRA ', 1, 'JMM4656', '2026-03-25', 1, 10, 0, 10, 500, '2026-03-24T06:45:50.64294+00:00', NULL),
  (11, 11, 1, 'PANADOL EXTRA ', 1, 'JMM4656', '2026-03-25', 1, 10, 0, 10, 500, '2026-03-24T06:59:57.659604+00:00', NULL),
  (12, 12, 1, 'PANADOL EXTRA ', 1, 'JMM4656', '2026-03-25', 1, 10, 0, 10, 500, '2026-03-24T07:46:00.667766+00:00', NULL),
  (13, 13, 1, 'PANADOL EXTRA ', 2, 'OKK456', '2027-01-01', 3, 10, 0, 30, 500, '2026-03-24T08:35:52.776356+00:00', NULL),
  (14, 14, 1, 'PANADOL EXTRA ', 2, 'OKK456', '2027-01-01', 1, 10, 0, 10, 0, '2026-03-24T14:38:38.3918+00:00', NULL),
  (15, 15, 1, 'PANADOL EXTRA ', 2, 'OKK456', '2027-01-01', 1, 10, 0, 10, 0, '2026-03-24T14:38:41.193017+00:00', NULL),
  (16, 16, 1, 'PANADOL EXTRA ', 2, 'OKK456', '2027-01-01', 1, 10, 0, 10, 0, '2026-03-24T14:38:54.169972+00:00', NULL),
  (17, 17, 1, 'PANADOL EXTRA ', 2, 'OKK456', '2027-01-01', 1, 10, 0, 10, 0, '2026-03-24T14:39:38.648694+00:00', NULL)
ON CONFLICT DO NOTHING;

-- ==================== PHARMACY_CREDIT_CUSTOMERS ====================
-- (no data)

-- ==================== PHARMACY_ACTIVITY_LOG ====================
INSERT INTO public.pharmacy_activity_log ("log_id", "action_type", "description", "details", "user_name", "outlet_id", "created_at") VALUES
  (1, 'Login', 'Super Admin logged in', 'User: superuser, Role: Admin, Outlet: Main Pharmacy', 'Super Admin', 1, '2026-03-23T11:59:07.768629+00:00'),
  (2, 'Login', 'Super Admin logged in', 'User: superuser, Role: Admin, Outlet: Main Pharmacy', 'Super Admin', 1, '2026-03-24T06:17:54.233681+00:00'),
  (3, 'Logout', 'Super Admin logged out', NULL, 'Super Admin', 1, '2026-03-27T04:48:41.681962+00:00'),
  (4, 'Login', 'Super Admin logged in', 'User: superuser, Role: Admin, Outlet: Main Pharmacy', 'Super Admin', 1, '2026-04-11T06:33:59.071073+00:00')
ON CONFLICT DO NOTHING;

-- ==================== PHARMACY_SUPPLIERS ====================
-- (no data)

-- ==================== PHARMACY_PURCHASES ====================
-- (no data)

-- ==================== PHARMACY_PURCHASE_PRODUCTS ====================
-- (no data)

-- ==================== PHARMACY_EXPENSES ====================
-- (no data)

-- ==================== PHARMACY_SHIFT_INSTANCES ====================
INSERT INTO public.pharmacy_shift_instances ("shift_instance_id", "shift_date", "actual_start_time", "actual_end_time", "shift_status", "opening_cash", "closing_cash", "created_by", "closed_by", "closed_date", "outlet_id", "created_at", "opened_by") VALUES
  (1, '2026-03-23', '2026-03-23T16:17:39.492142+00:00', NULL, 'Open', 2000, 0, 'Super Admin', NULL, NULL, 1, '2026-03-23T16:17:39.492142+00:00', 'Super Admin')
ON CONFLICT DO NOTHING;

-- ==================== PHARMACY_USERS ====================
INSERT INTO public.pharmacy_users ("user_id", "user_code", "user_name", "password_hash", "name", "user_type", "email", "phone", "national_id", "pin", "active", "is_super_admin", "outlet_id", "salary_type", "salary_amount", "created_at", "updated_at") VALUES
  (1, 'PHARM-SU001', 'superuser', '@JIm47jhC_7%#Pharm', 'Super Admin', 'Admin', NULL, NULL, NULL, NULL, TRUE, TRUE, 1, 'Monthly', 0, '2026-03-23T11:13:16.200355+00:00', '2026-03-23T11:13:16.200355+00:00')
ON CONFLICT DO NOTHING;

-- ==================== PHARMACY_OUTLETS ====================
INSERT INTO public.pharmacy_outlets ("outlet_id", "outlet_name", "address", "phone", "is_main", "active", "created_at") VALUES
  (1, 'Main Pharmacy', NULL, NULL, TRUE, TRUE, '2026-03-21T05:18:12.040823+00:00')
ON CONFLICT DO NOTHING;

-- ==================== PHARMACY_CATEGORIES ====================
INSERT INTO public.pharmacy_categories ("category_id", "category_name", "icon", "color", "description", "active", "outlet_id", "created_at") VALUES
  (1, 'Tablets & Capsules', '💊', '#3B82F6', NULL, TRUE, 1, '2026-03-21T05:18:12.040823+00:00'),
  (2, 'Syrups & Suspensions', '🧴', '#10B981', NULL, TRUE, 1, '2026-03-21T05:18:12.040823+00:00'),
  (3, 'Injections', '💉', '#EF4444', NULL, TRUE, 1, '2026-03-21T05:18:12.040823+00:00'),
  (4, 'Creams & Ointments', '🧴', '#F59E0B', NULL, TRUE, 1, '2026-03-21T05:18:12.040823+00:00'),
  (5, 'Drops (Eye/Ear/Nose)', '💧', '#06B6D4', NULL, TRUE, 1, '2026-03-21T05:18:12.040823+00:00'),
  (6, 'Inhalers', '🫁', '#8B5CF6', NULL, TRUE, 1, '2026-03-21T05:18:12.040823+00:00'),
  (7, 'Surgical & Dressings', '🩹', '#EC4899', NULL, TRUE, 1, '2026-03-21T05:18:12.040823+00:00'),
  (8, 'Baby & Maternity', '👶', '#F97316', NULL, TRUE, 1, '2026-03-21T05:18:12.040823+00:00'),
  (9, 'Vitamins & Supplements', '💪', '#14B8A6', NULL, TRUE, 1, '2026-03-21T05:18:12.040823+00:00'),
  (10, 'OTC (Over the Counter)', '🏥', '#6366F1', NULL, TRUE, 1, '2026-03-21T05:18:12.040823+00:00'),
  (11, 'Personal Care', '🧼', '#84CC16', NULL, TRUE, 1, '2026-03-21T05:18:12.040823+00:00'),
  (12, 'Medical Devices', '🩺', '#64748B', NULL, TRUE, 1, '2026-03-21T05:18:12.040823+00:00')
ON CONFLICT DO NOTHING;

-- ==================== PHARMACY_MPESA_TRANSACTIONS ====================
-- (no data)



-- ==================== 6. SYNCHRONIZE AUTO-INCREMENT SEQUENCES ====================
SELECT setval('public.pharmacy_products_pid_seq', COALESCE((SELECT MAX(pid) FROM public.pharmacy_products), 1), true);
SELECT setval('public.pharmacy_batches_batch_id_seq', COALESCE((SELECT MAX(batch_id) FROM public.pharmacy_batches), 1), true);
SELECT setval('public.pharmacy_stock_st_id_seq', COALESCE((SELECT MAX(st_id) FROM public.pharmacy_stock), 1), true);
SELECT setval('public.pharmacy_categories_category_id_seq', COALESCE((SELECT MAX(category_id) FROM public.pharmacy_categories), 1), true);
SELECT setval('public.pharmacy_sales_sale_id_seq', COALESCE((SELECT MAX(sale_id) FROM public.pharmacy_sales), 1), true);
SELECT setval('public.pharmacy_sales_items_item_id_seq', COALESCE((SELECT MAX(item_id) FROM public.pharmacy_sales_items), 1), true);
SELECT setval('public.pharmacy_shift_instances_shift_instance_id_seq', COALESCE((SELECT MAX(shift_instance_id) FROM public.pharmacy_shift_instances), 1), true);
SELECT setval('public.pharmacy_activity_log_log_id_seq', COALESCE((SELECT MAX(log_id) FROM public.pharmacy_activity_log), 1), true);
SELECT setval('public.pharmacy_users_user_id_seq', COALESCE((SELECT MAX(user_id) FROM public.pharmacy_users), 1), true);
SELECT setval('public.pharmacy_outlets_outlet_id_seq', COALESCE((SELECT MAX(outlet_id) FROM public.pharmacy_outlets), 1), true);

-- Link superuser to outlets
INSERT INTO public.pharmacy_user_outlets (user_id, outlet_id, is_default)
SELECT pu.user_id, po.outlet_id, po.is_main
FROM public.pharmacy_users pu
CROSS JOIN public.pharmacy_outlets po
WHERE pu.user_name = 'superuser'
ON CONFLICT DO NOTHING;

-- Verification
SELECT 'SUCCESS! All tables and data restored.' AS result,
  (SELECT COUNT(*) FROM public.pharmacy_products) AS products_count,
  (SELECT COUNT(*) FROM public.pharmacy_batches) AS batches_count,
  (SELECT COUNT(*) FROM public.pharmacy_stock) AS stock_count,
  (SELECT COUNT(*) FROM public.pharmacy_sales) AS sales_count,
  (SELECT COUNT(*) FROM public.pharmacy_sales_items) AS sales_items_count,
  (SELECT COUNT(*) FROM public.pharmacy_users) AS users_count;
