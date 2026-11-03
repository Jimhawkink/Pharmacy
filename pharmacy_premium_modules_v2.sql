-- ============================================================
-- Alpha Pharmacy Premium Modules — Database Migration v2
-- Run this in Supabase SQL Editor AFTER pharmacy_premium_modules.sql
-- New tables: GRN, Bank Reconciliation, Petty Cash, M-Pesa Recon,
--             Bank Statements, Collection Activities
-- ============================================================

-- ─── 1. GOODS RECEIVED NOTE (GRN) ───────────────────────────

CREATE TABLE IF NOT EXISTS pharmacy_grn (
    grn_id          SERIAL PRIMARY KEY,
    grn_number      VARCHAR(50) UNIQUE NOT NULL,
    po_number       VARCHAR(50),
    supplier_id     INTEGER REFERENCES pharmacy_suppliers(supplier_id),
    supplier_name   VARCHAR(200),
    invoice_number  VARCHAR(100),
    invoice_date    DATE,
    delivery_date   DATE,
    received_by     VARCHAR(100),
    verified_by     VARCHAR(100),
    status          VARCHAR(30) DEFAULT 'Draft' CHECK (status IN ('Draft','Verified','Posted','Rejected')),
    notes           TEXT,
    total_value     DECIMAL(15,2) DEFAULT 0,
    outlet_id       INTEGER NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pharmacy_grn_items (
    item_id             SERIAL PRIMARY KEY,
    grn_id              INTEGER NOT NULL REFERENCES pharmacy_grn(grn_id) ON DELETE CASCADE,
    product_id          INTEGER REFERENCES pharmacy_products(id),
    product_name        VARCHAR(300),
    barcode             VARCHAR(100),
    batch_number        VARCHAR(100),
    manufacture_date    DATE,
    expiry_date         DATE,
    quantity_ordered    INTEGER DEFAULT 0,
    quantity_received   INTEGER DEFAULT 0,
    quantity_rejected   INTEGER DEFAULT 0,
    unit_cost           DECIMAL(12,2) DEFAULT 0,
    total_cost          DECIMAL(12,2) DEFAULT 0,
    selling_price       DECIMAL(12,2) DEFAULT 0,
    vat_applicable      BOOLEAN DEFAULT FALSE,
    rejection_reason    TEXT,
    storage_condition   VARCHAR(100) DEFAULT 'Ambient (15-25°C)',
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Add item_count column derived for display
CREATE OR REPLACE VIEW pharmacy_grn_with_count AS
    SELECT g.*, COUNT(i.item_id) AS item_count
    FROM pharmacy_grn g
    LEFT JOIN pharmacy_grn_items i ON i.grn_id = g.grn_id
    GROUP BY g.grn_id;

CREATE INDEX IF NOT EXISTS idx_grn_outlet ON pharmacy_grn(outlet_id);
CREATE INDEX IF NOT EXISTS idx_grn_supplier ON pharmacy_grn(supplier_id);
CREATE INDEX IF NOT EXISTS idx_grn_items_grn ON pharmacy_grn_items(grn_id);
CREATE INDEX IF NOT EXISTS idx_grn_items_product ON pharmacy_grn_items(product_id);

-- ─── 2. BANK STATEMENTS ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS pharmacy_bank_statements (
    id              SERIAL PRIMARY KEY,
    date            DATE NOT NULL,
    description     TEXT,
    reference       VARCHAR(200),
    debit           DECIMAL(15,2) DEFAULT 0,
    credit          DECIMAL(15,2) DEFAULT 0,
    balance         DECIMAL(15,2) DEFAULT 0,
    matched         BOOLEAN DEFAULT FALSE,
    matched_to      VARCHAR(100),
    bank_account    VARCHAR(200),
    outlet_id       INTEGER NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_stmt_outlet ON pharmacy_bank_statements(outlet_id);
CREATE INDEX IF NOT EXISTS idx_bank_stmt_date ON pharmacy_bank_statements(date);

-- ─── 3. BANK RECONCILIATIONS ─────────────────────────────────

CREATE TABLE IF NOT EXISTS pharmacy_bank_reconciliations (
    id                  SERIAL PRIMARY KEY,
    period_start        DATE NOT NULL,
    period_end          DATE NOT NULL,
    bank_account        VARCHAR(200),
    opening_balance     DECIMAL(15,2) DEFAULT 0,
    closing_balance     DECIMAL(15,2) DEFAULT 0,
    total_credits       DECIMAL(15,2) DEFAULT 0,
    total_debits        DECIMAL(15,2) DEFAULT 0,
    unmatched_bank      INTEGER DEFAULT 0,
    unmatched_system    INTEGER DEFAULT 0,
    status              VARCHAR(30) DEFAULT 'Draft' CHECK (status IN ('Draft','Final')),
    prepared_by         VARCHAR(100),
    approved_by         VARCHAR(100),
    outlet_id           INTEGER NOT NULL DEFAULT 1,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_recon_outlet ON pharmacy_bank_reconciliations(outlet_id);

-- ─── 4. PETTY CASH FUND ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS pharmacy_petty_cash_fund (
    id              SERIAL PRIMARY KEY,
    fund_name       VARCHAR(200) NOT NULL,
    float_amount    DECIMAL(12,2) DEFAULT 10000,
    current_balance DECIMAL(12,2) DEFAULT 0,
    custodian       VARCHAR(100),
    last_replenished DATE,
    outlet_id       INTEGER NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pharmacy_petty_cash (
    id              SERIAL PRIMARY KEY,
    date            DATE NOT NULL,
    type            VARCHAR(20) NOT NULL CHECK (type IN ('receipt','payment')),
    category        VARCHAR(100),
    description     TEXT NOT NULL,
    reference       VARCHAR(100),
    amount          DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    voucher_number  VARCHAR(50),
    approved_by     VARCHAR(100),
    received_by     VARCHAR(100),
    outlet_id       INTEGER NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_petty_cash_outlet ON pharmacy_petty_cash(outlet_id);
CREATE INDEX IF NOT EXISTS idx_petty_cash_date ON pharmacy_petty_cash(date);
CREATE INDEX IF NOT EXISTS idx_petty_cash_fund_outlet ON pharmacy_petty_cash_fund(outlet_id);

-- ─── 5. M-PESA TRANSACTIONS ──────────────────────────────────

CREATE TABLE IF NOT EXISTS pharmacy_mpesa_transactions (
    id              SERIAL PRIMARY KEY,
    mpesa_receipt   VARCHAR(50) NOT NULL,
    phone           VARCHAR(20),
    amount          DECIMAL(12,2) NOT NULL,
    date            DATE NOT NULL,
    time            TIME,
    type            VARCHAR(50) DEFAULT 'Pay Bill',
    account_ref     VARCHAR(100),
    transaction_id  VARCHAR(100),
    matched         BOOLEAN DEFAULT FALSE,
    matched_sale_id INTEGER REFERENCES pharmacy_sales(sale_id),
    matched_receipt VARCHAR(100),
    outlet_id       INTEGER NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mpesa_tx_outlet ON pharmacy_mpesa_transactions(outlet_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_tx_date ON pharmacy_mpesa_transactions(date);
CREATE INDEX IF NOT EXISTS idx_mpesa_tx_receipt ON pharmacy_mpesa_transactions(mpesa_receipt);
CREATE INDEX IF NOT EXISTS idx_mpesa_tx_matched ON pharmacy_mpesa_transactions(matched);

-- ─── 6. COLLECTION ACTIVITIES ────────────────────────────────

CREATE TABLE IF NOT EXISTS pharmacy_collection_activities (
    id                  SERIAL PRIMARY KEY,
    customer_id         INTEGER REFERENCES pharmacy_credit_customers(customer_id),
    customer_name       VARCHAR(200),
    action_type         VARCHAR(50) DEFAULT 'phone_call',
    notes               TEXT,
    action_date         DATE NOT NULL,
    outstanding_amount  DECIMAL(12,2),
    follow_up_date      DATE,
    status              VARCHAR(30) DEFAULT 'Open' CHECK (status IN ('Open','Resolved','Escalated')),
    outlet_id           INTEGER NOT NULL DEFAULT 1,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collection_outlet ON pharmacy_collection_activities(outlet_id);
CREATE INDEX IF NOT EXISTS idx_collection_customer ON pharmacy_collection_activities(customer_id);

-- ─── 7. ADD SPLIT PAYMENT COLUMNS TO PHARMACY_SALES ──────────
-- (Only run if columns don't exist)

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pharmacy_sales' AND column_name='split_cash') THEN
        ALTER TABLE pharmacy_sales ADD COLUMN split_cash DECIMAL(12,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pharmacy_sales' AND column_name='split_mpesa') THEN
        ALTER TABLE pharmacy_sales ADD COLUMN split_mpesa DECIMAL(12,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pharmacy_sales' AND column_name='split_insurance') THEN
        ALTER TABLE pharmacy_sales ADD COLUMN split_insurance DECIMAL(12,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pharmacy_sales' AND column_name='split_insurance_name') THEN
        ALTER TABLE pharmacy_sales ADD COLUMN split_insurance_name VARCHAR(200);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pharmacy_sales' AND column_name='insurance_ref') THEN
        ALTER TABLE pharmacy_sales ADD COLUMN insurance_ref VARCHAR(100);
    END IF;
END $$;

-- ─── 8. ROW LEVEL SECURITY ───────────────────────────────────

ALTER TABLE pharmacy_grn ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_grn_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_bank_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_bank_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_petty_cash_fund ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_petty_cash ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_mpesa_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_collection_activities ENABLE ROW LEVEL SECURITY;

-- Open policies (for single-tenant use — tighten if multi-tenant)
CREATE POLICY "allow_all_grn" ON pharmacy_grn FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_grn_items" ON pharmacy_grn_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_bank_stmt" ON pharmacy_bank_statements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_bank_recon" ON pharmacy_bank_reconciliations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_petty_fund" ON pharmacy_petty_cash_fund FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_petty_cash" ON pharmacy_petty_cash FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_mpesa_tx" ON pharmacy_mpesa_transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_collection" ON pharmacy_collection_activities FOR ALL USING (true) WITH CHECK (true);

-- ─── 9. ADD BATCHES UPSERT SUPPORT ───────────────────────────
-- For GRN stock posting via upsert on batch_number + product + outlet
CREATE UNIQUE INDEX IF NOT EXISTS idx_batches_product_batch_outlet
    ON pharmacy_batches(product_id, batch_number, outlet_id);

-- ─── DONE ─────────────────────────────────────────────────────
-- Tables created:
--   pharmacy_grn, pharmacy_grn_items
--   pharmacy_bank_statements, pharmacy_bank_reconciliations
--   pharmacy_petty_cash_fund, pharmacy_petty_cash
--   pharmacy_mpesa_transactions
--   pharmacy_collection_activities
-- Columns added to pharmacy_sales:
--   split_cash, split_mpesa, split_insurance, split_insurance_name, insurance_ref
-- ──────────────────────────────────────────────────────────────

-- ─── CONTINUATION: Cold Chain & Accounts Payable ─────────────
-- Append this to pharmacy_premium_modules_v2.sql or run separately

-- ─── 10. TEMPERATURE LOGS (Cold Chain) ───────────────────────

CREATE TABLE IF NOT EXISTS pharmacy_temp_logs (
    id              SERIAL PRIMARY KEY,
    location        VARCHAR(200) NOT NULL,
    temperature     DECIMAL(5,1) NOT NULL,
    humidity        DECIMAL(5,1),
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    recorded_by     VARCHAR(100),
    status          VARCHAR(30) DEFAULT 'NORMAL',
    notes           TEXT,
    device_id       VARCHAR(100),
    outlet_id       INTEGER NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pharmacy_cold_chain_items (
    id                  SERIAL PRIMARY KEY,
    product_id          INTEGER REFERENCES pharmacy_products(id),
    product_name        VARCHAR(300) NOT NULL,
    batch_number        VARCHAR(100),
    storage_location    VARCHAR(200),
    min_temp            DECIMAL(5,1) DEFAULT 2,
    max_temp            DECIMAL(5,1) DEFAULT 8,
    current_temp        DECIMAL(5,1),
    status              VARCHAR(30) DEFAULT 'Active',
    last_checked        TIMESTAMPTZ,
    outlet_id           INTEGER NOT NULL DEFAULT 1,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_temp_logs_outlet ON pharmacy_temp_logs(outlet_id);
CREATE INDEX IF NOT EXISTS idx_temp_logs_location ON pharmacy_temp_logs(location);
CREATE INDEX IF NOT EXISTS idx_temp_logs_date ON pharmacy_temp_logs(recorded_at);
CREATE INDEX IF NOT EXISTS idx_cold_items_outlet ON pharmacy_cold_chain_items(outlet_id);

ALTER TABLE pharmacy_temp_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_cold_chain_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_temp_logs" ON pharmacy_temp_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_cold_items" ON pharmacy_cold_chain_items FOR ALL USING (true) WITH CHECK (true);

-- ─── 11. ACCOUNTS PAYABLE ────────────────────────────────────

CREATE TABLE IF NOT EXISTS pharmacy_payable_bills (
    id              SERIAL PRIMARY KEY,
    supplier_id     INTEGER REFERENCES pharmacy_suppliers(supplier_id),
    supplier_name   VARCHAR(200),
    invoice_number  VARCHAR(100) NOT NULL,
    invoice_date    DATE,
    due_date        DATE,
    amount          DECIMAL(15,2) NOT NULL DEFAULT 0,
    amount_paid     DECIMAL(15,2) DEFAULT 0,
    balance         DECIMAL(15,2) DEFAULT 0,
    payment_terms   VARCHAR(50) DEFAULT 'Net 30',
    category        VARCHAR(100) DEFAULT 'Drug Supplies',
    description     TEXT,
    status          VARCHAR(30) DEFAULT 'Unpaid' CHECK (status IN ('Unpaid','Partial','Paid','Disputed')),
    reference       VARCHAR(100),
    payment_date    DATE,
    payment_method  VARCHAR(50),
    payment_ref     VARCHAR(100),
    outlet_id       INTEGER NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payable_outlet ON pharmacy_payable_bills(outlet_id);
CREATE INDEX IF NOT EXISTS idx_payable_supplier ON pharmacy_payable_bills(supplier_id);
CREATE INDEX IF NOT EXISTS idx_payable_due ON pharmacy_payable_bills(due_date);
CREATE INDEX IF NOT EXISTS idx_payable_status ON pharmacy_payable_bills(status);

ALTER TABLE pharmacy_payable_bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_payable" ON pharmacy_payable_bills FOR ALL USING (true) WITH CHECK (true);

-- ─── ALL DONE ─────────────────────────────────────────────────
-- New tables: pharmacy_temp_logs, pharmacy_cold_chain_items, pharmacy_payable_bills


-- ─── DPA 2019 COMPLIANCE TABLES ─────────────────────────────────

-- Consent Records (DPA 2019 s.30 — explicit consent for health data)
CREATE TABLE IF NOT EXISTS pharmacy_consent_records (
    consent_id      SERIAL PRIMARY KEY,
    patient_id      INTEGER,
    patient_name    VARCHAR(200) NOT NULL,
    consent_type    VARCHAR(100) NOT NULL,
    granted         BOOLEAN DEFAULT TRUE,
    granted_at      TIMESTAMPTZ DEFAULT NOW(),
    revoked_at      TIMESTAMPTZ,
    ip_address      VARCHAR(100) DEFAULT 'In-pharmacy',
    consent_version VARCHAR(10) DEFAULT '1.0',
    collector_name  VARCHAR(100),
    outlet_id       INTEGER NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Data Subject Rights Requests (DPA 2019 s.26, s.35, s.36, s.38)
CREATE TABLE IF NOT EXISTS pharmacy_data_requests (
    request_id      SERIAL PRIMARY KEY,
    patient_name    VARCHAR(200) NOT NULL,
    patient_email   VARCHAR(200),
    patient_phone   VARCHAR(20),
    request_type    VARCHAR(20) NOT NULL CHECK (request_type IN ('export','delete','rectify','restrict')),
    status          VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending','Processing','Completed','Rejected')),
    requested_at    TIMESTAMPTZ DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    handled_by      VARCHAR(100),
    notes           TEXT,
    outlet_id       INTEGER NOT NULL DEFAULT 1
);

-- Data Breach Incident Log (DPA 2019 s.43 — 72hr ODPC notification)
CREATE TABLE IF NOT EXISTS pharmacy_breach_logs (
    breach_id           SERIAL PRIMARY KEY,
    breach_date         DATE NOT NULL,
    description         TEXT NOT NULL,
    affected_records    INTEGER DEFAULT 0,
    severity            VARCHAR(20) DEFAULT 'Medium' CHECK (severity IN ('Low','Medium','High','Critical')),
    reported_to_odpc    BOOLEAN DEFAULT FALSE,
    reported_at         TIMESTAMPTZ,
    remediation         TEXT,
    reported_by         VARCHAR(100),
    outlet_id           INTEGER NOT NULL DEFAULT 1,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all sensitive tables
ALTER TABLE pharmacy_consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_data_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_breach_logs ENABLE ROW LEVEL SECURITY;

-- Add known_allergies column to patients if missing
ALTER TABLE pharmacy_patients ADD COLUMN IF NOT EXISTS known_allergies JSONB DEFAULT '[]';
ALTER TABLE pharmacy_patients ADD COLUMN IF NOT EXISTS chronic_conditions JSONB DEFAULT '[]';
ALTER TABLE pharmacy_patients ADD COLUMN IF NOT EXISTS consent_given BOOLEAN DEFAULT FALSE;
ALTER TABLE pharmacy_patients ADD COLUMN IF NOT EXISTS consent_date TIMESTAMPTZ;
ALTER TABLE pharmacy_patients ADD COLUMN IF NOT EXISTS privacy_policy_accepted BOOLEAN DEFAULT FALSE;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_consent_outlet ON pharmacy_consent_records(outlet_id);
CREATE INDEX IF NOT EXISTS idx_consent_patient ON pharmacy_consent_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_requests_outlet ON pharmacy_data_requests(outlet_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON pharmacy_data_requests(status);
CREATE INDEX IF NOT EXISTS idx_breach_outlet ON pharmacy_breach_logs(outlet_id);
