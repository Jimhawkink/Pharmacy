-- ============================================
-- ALPHA RETAIL DATABASE SCHEMA
-- ============================================
-- All tables prefixed with 'retail_' to avoid
-- conflicts with existing hotel/restaurant tables
-- ============================================

-- ==================== RETAIL PRODUCTS ====================

CREATE TABLE IF NOT EXISTS retail_products (
    pid SERIAL PRIMARY KEY,
    product_code VARCHAR UNIQUE,
    product_name VARCHAR NOT NULL,
    alias VARCHAR,
    barcode VARCHAR,
    category VARCHAR,
    description TEXT,
    purchase_cost NUMERIC DEFAULT 0,
    sales_cost NUMERIC DEFAULT 0,
    margin_per NUMERIC DEFAULT 0,
    purchase_unit VARCHAR DEFAULT 'PCS',
    sales_unit VARCHAR DEFAULT 'PCS',
    vat NUMERIC DEFAULT 0,
    reorder_point INTEGER DEFAULT 5,
    supplier_name VARCHAR,
    batch_no VARCHAR,
    show_in_pos BOOLEAN DEFAULT true,
    photo TEXT,
    button_ui_color VARCHAR DEFAULT 'from-blue-400 to-blue-600',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== RETAIL CATEGORIES ====================

CREATE TABLE IF NOT EXISTS retail_categories (
    category_id SERIAL PRIMARY KEY,
    category_name VARCHAR NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR DEFAULT '📦',
    color VARCHAR DEFAULT '#3B82F6',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== RETAIL STOCK ====================

CREATE TABLE IF NOT EXISTS retail_stock (
    st_id SERIAL PRIMARY KEY,
    pid INTEGER REFERENCES retail_products(pid),
    invoice_no VARCHAR,
    qty NUMERIC DEFAULT 0,
    mfg_date DATE,
    expiry_date DATE,
    batch_no VARCHAR,
    storage_type VARCHAR DEFAULT 'Store',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== RETAIL SALES ====================

CREATE TABLE IF NOT EXISTS retail_sales (
    sale_id SERIAL PRIMARY KEY,
    receipt_no VARCHAR UNIQUE,
    sale_date DATE DEFAULT CURRENT_DATE,
    sale_time TIME DEFAULT CURRENT_TIME,
    sale_datetime TIMESTAMPTZ DEFAULT NOW(),
    shift_id INTEGER,
    shift_name VARCHAR,
    customer_name VARCHAR,
    customer_phone VARCHAR,
    subtotal NUMERIC DEFAULT 0,
    discount NUMERIC DEFAULT 0,
    discount_percent NUMERIC DEFAULT 0,
    tax_rate NUMERIC DEFAULT 0,
    tax_amount NUMERIC DEFAULT 0,
    total_amount NUMERIC DEFAULT 0,
    total_cost NUMERIC DEFAULT 0,
    profit NUMERIC DEFAULT 0,
    payment_method VARCHAR DEFAULT 'Cash',
    amount_paid NUMERIC DEFAULT 0,
    change_amount NUMERIC DEFAULT 0,
    mpesa_code VARCHAR,
    status VARCHAR DEFAULT 'Completed',
    notes TEXT,
    created_by VARCHAR,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== RETAIL SALES ITEMS ====================

CREATE TABLE IF NOT EXISTS retail_sales_items (
    item_id SERIAL PRIMARY KEY,
    sale_id INTEGER REFERENCES retail_sales(sale_id),
    product_id INTEGER REFERENCES retail_products(pid),
    product_name VARCHAR,
    barcode VARCHAR,
    quantity INTEGER DEFAULT 1,
    unit_price NUMERIC DEFAULT 0,
    cost_price NUMERIC DEFAULT 0,
    discount NUMERIC DEFAULT 0,
    subtotal NUMERIC DEFAULT 0,
    profit NUMERIC DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== RETAIL SUPPLIERS ====================

CREATE TABLE IF NOT EXISTS retail_suppliers (
    supplier_id SERIAL PRIMARY KEY,
    supplier_code VARCHAR UNIQUE,
    supplier_name VARCHAR NOT NULL,
    address TEXT,
    city VARCHAR,
    phone VARCHAR,
    phone2 VARCHAR,
    email VARCHAR,
    contact_person VARCHAR,
    kra_pin VARCHAR,
    opening_balance NUMERIC DEFAULT 0,
    current_balance NUMERIC DEFAULT 0,
    payment_terms VARCHAR,
    notes TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== RETAIL PURCHASES ====================

CREATE TABLE IF NOT EXISTS retail_purchases (
    purchase_id SERIAL PRIMARY KEY,
    purchase_no VARCHAR UNIQUE,
    purchase_date DATE DEFAULT CURRENT_DATE,
    supplier_id INTEGER REFERENCES retail_suppliers(supplier_id),
    supplier_name VARCHAR,
    supplier_invoice VARCHAR,
    sub_total NUMERIC DEFAULT 0,
    discount NUMERIC DEFAULT 0,
    vat NUMERIC DEFAULT 0,
    grand_total NUMERIC DEFAULT 0,
    status VARCHAR DEFAULT 'Pending',
    payment_status VARCHAR DEFAULT 'Unpaid',
    notes TEXT,
    created_by VARCHAR,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== RETAIL PURCHASE PRODUCTS ====================

CREATE TABLE IF NOT EXISTS retail_purchase_products (
    pp_id SERIAL PRIMARY KEY,
    purchase_id INTEGER REFERENCES retail_purchases(purchase_id),
    product_id INTEGER REFERENCES retail_products(pid),
    product_code VARCHAR,
    product_name VARCHAR,
    quantity NUMERIC DEFAULT 0,
    unit VARCHAR DEFAULT 'PCS',
    rate NUMERIC DEFAULT 0,
    total_amount NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== RETAIL EXPENSES ====================

CREATE TABLE IF NOT EXISTS retail_expenses (
    expense_id SERIAL PRIMARY KEY,
    expense_name VARCHAR NOT NULL,
    expense_type VARCHAR,
    amount NUMERIC,
    description TEXT,
    expense_date DATE DEFAULT CURRENT_DATE,
    category VARCHAR,
    payment_mode VARCHAR DEFAULT 'Cash',
    reference_no VARCHAR,
    created_by VARCHAR,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== RETAIL USERS ====================

CREATE TABLE IF NOT EXISTS retail_users (
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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== RETAIL SHIFTS ====================

CREATE TABLE IF NOT EXISTS retail_shifts (
    shift_id SERIAL PRIMARY KEY,
    shift_date DATE DEFAULT CURRENT_DATE,
    shift_type VARCHAR DEFAULT 'Day',
    start_time TIME,
    end_time TIME,
    opening_cash NUMERIC DEFAULT 0,
    closing_cash NUMERIC DEFAULT 0,
    total_sales NUMERIC DEFAULT 0,
    total_expenses NUMERIC DEFAULT 0,
    net_sales NUMERIC DEFAULT 0,
    status VARCHAR DEFAULT 'Open',
    opened_by VARCHAR,
    closed_by VARCHAR,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== RETAIL SETTINGS ====================

CREATE TABLE IF NOT EXISTS retail_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR NOT NULL UNIQUE,
    setting_value TEXT,
    setting_type VARCHAR DEFAULT 'text',
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== RETAIL TAX SETTINGS ====================

CREATE TABLE IF NOT EXISTS retail_tax_settings (
    tax_id SERIAL PRIMARY KEY,
    tax_code VARCHAR UNIQUE,
    tax_name VARCHAR NOT NULL,
    tax_rate NUMERIC DEFAULT 0,
    tax_type VARCHAR DEFAULT 'VAT',
    is_inclusive BOOLEAN DEFAULT false,
    is_default BOOLEAN DEFAULT false,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== RETAIL STOCK MOVEMENTS ====================

CREATE TABLE IF NOT EXISTS retail_stock_movements (
    movement_id SERIAL PRIMARY KEY,
    movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
    product_id INTEGER REFERENCES retail_products(pid),
    product_name VARCHAR,
    product_code VARCHAR,
    movement_type VARCHAR NOT NULL,
    quantity NUMERIC DEFAULT 0,
    unit VARCHAR DEFAULT 'PCS',
    unit_cost NUMERIC DEFAULT 0,
    total_cost NUMERIC DEFAULT 0,
    reference_no VARCHAR,
    reference_type VARCHAR,
    reason TEXT,
    created_by VARCHAR,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== RETAIL CREDIT CUSTOMERS ====================

CREATE TABLE IF NOT EXISTS retail_credit_customers (
    customer_id SERIAL PRIMARY KEY,
    customer_code VARCHAR UNIQUE,
    customer_name VARCHAR NOT NULL,
    phone VARCHAR,
    email VARCHAR,
    address TEXT,
    credit_limit NUMERIC DEFAULT 0,
    current_balance NUMERIC DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== FUNCTIONS ====================

-- Function to decrease retail stock
CREATE OR REPLACE FUNCTION retail_decrease_stock(p_product_id INTEGER, p_qty NUMERIC)
RETURNS VOID AS $$
BEGIN
    UPDATE retail_stock 
    SET qty = GREATEST(0, qty - p_qty),
        updated_at = NOW()
    WHERE pid = p_product_id;
END;
$$ LANGUAGE plpgsql;

-- ==================== INSERT DEFAULT DATA ====================

-- Default admin user (password: admin123)
INSERT INTO retail_users (user_code, user_name, password_hash, name, user_type, is_super_admin)
VALUES ('RUSR001', 'admin', 'admin123', 'Administrator', 'Admin', true)
ON CONFLICT (user_name) DO NOTHING;

-- Superuser account
INSERT INTO retail_users (user_code, user_name, password_hash, name, user_type, is_super_admin)
VALUES ('RUSR000', 'superuser', '@JIm47jhC_7%#', 'Super User', 'Super Admin', true)
ON CONFLICT (user_name) DO NOTHING;

-- Default retail settings
INSERT INTO retail_settings (setting_key, setting_value, description)
VALUES 
    ('company_name', 'Alpha Retail', 'Store Name'),
    ('company_address', 'Nairobi, Kenya', 'Store Address'),
    ('company_phone', '+254 700 000 000', 'Store Phone'),
    ('company_email', 'info@alpharetail.com', 'Store Email'),
    ('receipt_header', 'Thank you for shopping with us!', 'Receipt Header'),
    ('receipt_footer', 'Please come again!', 'Receipt Footer'),
    ('currency', 'KES', 'Currency Code'),
    ('tax_rate', '16', 'Default Tax Rate %')
ON CONFLICT (setting_key) DO NOTHING;

-- Default categories
INSERT INTO retail_categories (category_name, icon, color)
VALUES 
    ('Beverages', '🥤', '#3B82F6'),
    ('Snacks', '🍿', '#10B981'),
    ('Dairy', '🥛', '#F59E0B'),
    ('Groceries', '🛒', '#8B5CF6'),
    ('Personal Care', '🧴', '#EC4899'),
    ('Household', '🏠', '#6366F1'),
    ('Electronics', '📱', '#14B8A6'),
    ('Others', '📦', '#6B7280')
ON CONFLICT (category_name) DO NOTHING;

-- ==================== RLS POLICIES ====================

-- Enable RLS
ALTER TABLE retail_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE retail_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE retail_sales_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE retail_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE retail_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE retail_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE retail_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE retail_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE retail_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE retail_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE retail_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running)
DROP POLICY IF EXISTS "retail_products_policy" ON retail_products;
DROP POLICY IF EXISTS "retail_sales_policy" ON retail_sales;
DROP POLICY IF EXISTS "retail_sales_items_policy" ON retail_sales_items;
DROP POLICY IF EXISTS "retail_stock_policy" ON retail_stock;
DROP POLICY IF EXISTS "retail_users_policy" ON retail_users;
DROP POLICY IF EXISTS "retail_categories_policy" ON retail_categories;
DROP POLICY IF EXISTS "retail_suppliers_policy" ON retail_suppliers;
DROP POLICY IF EXISTS "retail_purchases_policy" ON retail_purchases;
DROP POLICY IF EXISTS "retail_expenses_policy" ON retail_expenses;
DROP POLICY IF EXISTS "retail_shifts_policy" ON retail_shifts;
DROP POLICY IF EXISTS "retail_settings_policy" ON retail_settings;

-- Policies for retail tables (allow all for now)
CREATE POLICY "retail_products_policy" ON retail_products FOR ALL USING (true);
CREATE POLICY "retail_sales_policy" ON retail_sales FOR ALL USING (true);
CREATE POLICY "retail_sales_items_policy" ON retail_sales_items FOR ALL USING (true);
CREATE POLICY "retail_stock_policy" ON retail_stock FOR ALL USING (true);
CREATE POLICY "retail_users_policy" ON retail_users FOR ALL USING (true);
CREATE POLICY "retail_categories_policy" ON retail_categories FOR ALL USING (true);
CREATE POLICY "retail_suppliers_policy" ON retail_suppliers FOR ALL USING (true);
CREATE POLICY "retail_purchases_policy" ON retail_purchases FOR ALL USING (true);
CREATE POLICY "retail_expenses_policy" ON retail_expenses FOR ALL USING (true);
CREATE POLICY "retail_shifts_policy" ON retail_shifts FOR ALL USING (true);
CREATE POLICY "retail_settings_policy" ON retail_settings FOR ALL USING (true);

-- ============================================
-- SETUP COMPLETE!
-- ============================================
-- Login: username = admin, password = admin123
-- All tables are prefixed with 'retail_' 
-- ============================================
