-- ============================================================
-- STEP 1: Drop partially-created tables from failed runs
-- Safe to run — these tables have no real data yet
-- ============================================================

DROP TABLE IF EXISTS pharmacy_grn_items             CASCADE;
DROP TABLE IF EXISTS pharmacy_grn                   CASCADE;
DROP TABLE IF EXISTS pharmacy_bank_statements       CASCADE;
DROP TABLE IF EXISTS pharmacy_bank_reconciliations  CASCADE;
DROP TABLE IF EXISTS pharmacy_petty_cash            CASCADE;
DROP TABLE IF EXISTS pharmacy_petty_cash_fund       CASCADE;
DROP TABLE IF EXISTS pharmacy_mpesa_transactions    CASCADE;
DROP TABLE IF EXISTS pharmacy_collection_activities CASCADE;
DROP TABLE IF EXISTS pharmacy_temp_logs             CASCADE;
DROP TABLE IF EXISTS pharmacy_cold_chain_items      CASCADE;
DROP TABLE IF EXISTS pharmacy_payable_bills         CASCADE;
DROP TABLE IF EXISTS pharmacy_consent_records       CASCADE;
DROP TABLE IF EXISTS pharmacy_data_requests         CASCADE;
DROP TABLE IF EXISTS pharmacy_breach_logs           CASCADE;
DROP VIEW  IF EXISTS pharmacy_grn_with_count        CASCADE;

-- ============================================================
-- STEP 2: Recreate all tables cleanly
-- ============================================================

-- ─── 1. GRN ──────────────────────────────────────────────────

CREATE TABLE pharmacy_grn (
    grn_id         SERIAL PRIMARY KEY,
    grn_number     VARCHAR(50) UNIQUE NOT NULL,
    po_number      VARCHAR(50),
    supplier_id    INTEGER,
    supplier_name  VARCHAR(200),
    invoice_number VARCHAR(100),
    invoice_date   DATE,
    delivery_date  DATE,
    received_by    VARCHAR(100),
    verified_by    VARCHAR(100),
    grn_status     VARCHAR(30) DEFAULT 'Draft',
    notes          TEXT,
    total_value    DECIMAL(15,2) DEFAULT 0,
    outlet_id      INTEGER NOT NULL DEFAULT 1,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pharmacy_grn_items (
    item_id           SERIAL PRIMARY KEY,
    grn_id            INTEGER NOT NULL REFERENCES pharmacy_grn(grn_id) ON DELETE CASCADE,
    product_id        INTEGER,
    product_name      VARCHAR(300),
    barcode           VARCHAR(100),
    batch_number      VARCHAR(100),
    manufacture_date  DATE,
    expiry_date       DATE,
    quantity_ordered  INTEGER DEFAULT 0,
    quantity_received INTEGER DEFAULT 0,
    quantity_rejected INTEGER DEFAULT 0,
    unit_cost         DECIMAL(12,2) DEFAULT 0,
    total_cost        DECIMAL(12,2) DEFAULT 0,
    selling_price     DECIMAL(12,2) DEFAULT 0,
    vat_applicable    BOOLEAN DEFAULT FALSE,
    rejection_reason  TEXT,
    storage_condition VARCHAR(100) DEFAULT 'Ambient (15-25°C)',
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE VIEW pharmacy_grn_with_count AS
    SELECT g.*, COUNT(i.item_id) AS item_count
    FROM pharmacy_grn g
    LEFT JOIN pharmacy_grn_items i ON i.grn_id = g.grn_id
    GROUP BY g.grn_id;

CREATE INDEX idx_grn_outlet     ON pharmacy_grn(outlet_id);
CREATE INDEX idx_grn_items_grn  ON pharmacy_grn_items(grn_id);

-- ─── 2. BANK STATEMENTS ──────────────────────────────────────

CREATE TABLE pharmacy_bank_statements (
    id           SERIAL PRIMARY KEY,
    stmt_date    DATE NOT NULL,
    description  TEXT,
    reference    VARCHAR(200),
    debit        DECIMAL(15,2) DEFAULT 0,
    credit       DECIMAL(15,2) DEFAULT 0,
    stmt_balance DECIMAL(15,2) DEFAULT 0,
    matched      BOOLEAN DEFAULT FALSE,
    matched_to   VARCHAR(100),
    bank_account VARCHAR(200),
    outlet_id    INTEGER NOT NULL DEFAULT 1,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bank_stmt_outlet ON pharmacy_bank_statements(outlet_id);
CREATE INDEX idx_bank_stmt_date   ON pharmacy_bank_statements(stmt_date);

-- ─── 3. BANK RECONCILIATIONS ─────────────────────────────────

CREATE TABLE pharmacy_bank_reconciliations (
    id               SERIAL PRIMARY KEY,
    period_start     DATE NOT NULL,
    period_end       DATE NOT NULL,
    bank_account     VARCHAR(200),
    opening_balance  DECIMAL(15,2) DEFAULT 0,
    closing_balance  DECIMAL(15,2) DEFAULT 0,
    total_credits    DECIMAL(15,2) DEFAULT 0,
    total_debits     DECIMAL(15,2) DEFAULT 0,
    unmatched_bank   INTEGER DEFAULT 0,
    unmatched_system INTEGER DEFAULT 0,
    recon_status     VARCHAR(30) DEFAULT 'Draft',
    prepared_by      VARCHAR(100),
    approved_by      VARCHAR(100),
    outlet_id        INTEGER NOT NULL DEFAULT 1,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bank_recon_outlet ON pharmacy_bank_reconciliations(outlet_id);

-- ─── 4. PETTY CASH ───────────────────────────────────────────

CREATE TABLE pharmacy_petty_cash_fund (
    id               SERIAL PRIMARY KEY,
    fund_name        VARCHAR(200) NOT NULL,
    float_amount     DECIMAL(12,2) DEFAULT 10000,
    current_balance  DECIMAL(12,2) DEFAULT 0,
    custodian        VARCHAR(100),
    last_replenished DATE,
    outlet_id        INTEGER NOT NULL DEFAULT 1,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pharmacy_petty_cash (
    id             SERIAL PRIMARY KEY,
    entry_date     DATE NOT NULL,
    entry_type     VARCHAR(20) NOT NULL,
    category       VARCHAR(100),
    description    TEXT NOT NULL,
    reference      VARCHAR(100),
    amount         DECIMAL(12,2) NOT NULL,
    voucher_number VARCHAR(50),
    approved_by    VARCHAR(100),
    received_by    VARCHAR(100),
    outlet_id      INTEGER NOT NULL DEFAULT 1,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_petty_cash_outlet ON pharmacy_petty_cash(outlet_id);
CREATE INDEX idx_petty_cash_date   ON pharmacy_petty_cash(entry_date);
CREATE INDEX idx_petty_fund_outlet ON pharmacy_petty_cash_fund(outlet_id);

-- ─── 5. M-PESA TRANSACTIONS ──────────────────────────────────

CREATE TABLE pharmacy_mpesa_transactions (
    id              SERIAL PRIMARY KEY,
    mpesa_receipt   VARCHAR(50) NOT NULL,
    phone           VARCHAR(20),
    amount          DECIMAL(12,2) NOT NULL,
    txn_date        DATE NOT NULL,
    txn_time        TIME,
    txn_type        VARCHAR(50) DEFAULT 'Pay Bill',
    account_ref     VARCHAR(100),
    transaction_id  VARCHAR(100),
    matched         BOOLEAN DEFAULT FALSE,
    matched_sale_id INTEGER,
    matched_receipt VARCHAR(100),
    outlet_id       INTEGER NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mpesa_outlet  ON pharmacy_mpesa_transactions(outlet_id);
CREATE INDEX idx_mpesa_date    ON pharmacy_mpesa_transactions(txn_date);
CREATE INDEX idx_mpesa_receipt ON pharmacy_mpesa_transactions(mpesa_receipt);

-- ─── 6. COLLECTION ACTIVITIES ────────────────────────────────

CREATE TABLE pharmacy_collection_activities (
    id                 SERIAL PRIMARY KEY,
    customer_id        INTEGER,
    customer_name      VARCHAR(200),
    action_type        VARCHAR(50) DEFAULT 'phone_call',
    notes              TEXT,
    action_date        DATE NOT NULL,
    outstanding_amount DECIMAL(12,2),
    follow_up_date     DATE,
    activity_status    VARCHAR(30) DEFAULT 'Open',
    outlet_id          INTEGER NOT NULL DEFAULT 1,
    created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_collection_outlet ON pharmacy_collection_activities(outlet_id);

-- ─── 7. SPLIT PAYMENT COLUMNS (add to existing sales table) ──

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
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pharmacy_sales' AND column_name='split_airtel') THEN
        ALTER TABLE pharmacy_sales ADD COLUMN split_airtel DECIMAL(12,2);
    END IF;
END $$;

-- ─── 8. COLD CHAIN ───────────────────────────────────────────

CREATE TABLE pharmacy_temp_logs (
    id          SERIAL PRIMARY KEY,
    location    VARCHAR(200) NOT NULL,
    temperature DECIMAL(5,1) NOT NULL,
    humidity    DECIMAL(5,1),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    recorded_by VARCHAR(100),
    log_status  VARCHAR(30) DEFAULT 'NORMAL',
    notes       TEXT,
    device_id   VARCHAR(100),
    outlet_id   INTEGER NOT NULL DEFAULT 1,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pharmacy_cold_chain_items (
    id               SERIAL PRIMARY KEY,
    product_id       INTEGER,
    product_name     VARCHAR(300) NOT NULL,
    batch_number     VARCHAR(100),
    storage_location VARCHAR(200),
    min_temp         DECIMAL(5,1) DEFAULT 2,
    max_temp         DECIMAL(5,1) DEFAULT 8,
    current_temp     DECIMAL(5,1),
    item_status      VARCHAR(30) DEFAULT 'Active',
    last_checked     TIMESTAMPTZ,
    outlet_id        INTEGER NOT NULL DEFAULT 1,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_temp_logs_outlet   ON pharmacy_temp_logs(outlet_id);
CREATE INDEX idx_temp_logs_location ON pharmacy_temp_logs(location);
CREATE INDEX idx_cold_items_outlet  ON pharmacy_cold_chain_items(outlet_id);

-- ─── 9. ACCOUNTS PAYABLE ─────────────────────────────────────

CREATE TABLE pharmacy_payable_bills (
    id             SERIAL PRIMARY KEY,
    supplier_id    INTEGER,
    supplier_name  VARCHAR(200),
    invoice_number VARCHAR(100) NOT NULL,
    invoice_date   DATE,
    due_date       DATE,
    amount         DECIMAL(15,2) NOT NULL DEFAULT 0,
    amount_paid    DECIMAL(15,2) DEFAULT 0,
    bill_balance   DECIMAL(15,2) DEFAULT 0,
    payment_terms  VARCHAR(50) DEFAULT 'Net 30',
    category       VARCHAR(100) DEFAULT 'Drug Supplies',
    description    TEXT,
    bill_status    VARCHAR(30) DEFAULT 'Unpaid',
    reference      VARCHAR(100),
    payment_date   DATE,
    payment_method VARCHAR(50),
    payment_ref    VARCHAR(100),
    outlet_id      INTEGER NOT NULL DEFAULT 1,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payable_outlet ON pharmacy_payable_bills(outlet_id);
CREATE INDEX idx_payable_due    ON pharmacy_payable_bills(due_date);
CREATE INDEX idx_payable_status ON pharmacy_payable_bills(bill_status);

-- ─── 10. DPA 2019 COMPLIANCE ─────────────────────────────────

CREATE TABLE pharmacy_consent_records (
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

CREATE TABLE pharmacy_data_requests (
    request_id    SERIAL PRIMARY KEY,
    patient_name  VARCHAR(200) NOT NULL,
    patient_email VARCHAR(200),
    patient_phone VARCHAR(20),
    request_type  VARCHAR(20) NOT NULL,
    req_status    VARCHAR(20) DEFAULT 'Pending',
    requested_at  TIMESTAMPTZ DEFAULT NOW(),
    completed_at  TIMESTAMPTZ,
    handled_by    VARCHAR(100),
    notes         TEXT,
    outlet_id     INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE pharmacy_breach_logs (
    breach_id        SERIAL PRIMARY KEY,
    breach_date      DATE NOT NULL,
    description      TEXT NOT NULL,
    affected_records INTEGER DEFAULT 0,
    severity         VARCHAR(20) DEFAULT 'Medium',
    reported_to_odpc BOOLEAN DEFAULT FALSE,
    reported_at      TIMESTAMPTZ,
    remediation      TEXT,
    reported_by      VARCHAR(100),
    outlet_id        INTEGER NOT NULL DEFAULT 1,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_consent_outlet  ON pharmacy_consent_records(outlet_id);
CREATE INDEX idx_requests_outlet ON pharmacy_data_requests(outlet_id);
CREATE INDEX idx_breach_outlet   ON pharmacy_breach_logs(outlet_id);

-- ─── 11. PATIENT ENHANCEMENTS ────────────────────────────────

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pharmacy_patients' AND column_name='known_allergies') THEN
        ALTER TABLE pharmacy_patients ADD COLUMN known_allergies JSONB DEFAULT '[]';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pharmacy_patients' AND column_name='chronic_conditions') THEN
        ALTER TABLE pharmacy_patients ADD COLUMN chronic_conditions JSONB DEFAULT '[]';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pharmacy_patients' AND column_name='consent_given') THEN
        ALTER TABLE pharmacy_patients ADD COLUMN consent_given BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pharmacy_patients' AND column_name='consent_date') THEN
        ALTER TABLE pharmacy_patients ADD COLUMN consent_date TIMESTAMPTZ;
    END IF;
END $$;

-- ─── 12. ROW LEVEL SECURITY ───────────────────────────────────

ALTER TABLE pharmacy_grn                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_grn_items             ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_bank_statements       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_bank_reconciliations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_petty_cash_fund       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_petty_cash            ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_mpesa_transactions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_collection_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_temp_logs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_cold_chain_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_payable_bills         ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_consent_records       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_data_requests         ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_breach_logs           ENABLE ROW LEVEL SECURITY;

-- ─── 13. RLS POLICIES (safe — checks before creating) ─────────

DO $$
DECLARE
    tbl TEXT;
    pol TEXT;
    tbls TEXT[] := ARRAY[
        'pharmacy_grn','pharmacy_grn_items','pharmacy_bank_statements',
        'pharmacy_bank_reconciliations','pharmacy_petty_cash_fund','pharmacy_petty_cash',
        'pharmacy_mpesa_transactions','pharmacy_collection_activities',
        'pharmacy_temp_logs','pharmacy_cold_chain_items','pharmacy_payable_bills',
        'pharmacy_consent_records','pharmacy_data_requests','pharmacy_breach_logs'
    ];
BEGIN
    FOREACH tbl IN ARRAY tbls LOOP
        pol := 'allow_all_' || tbl;
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE tablename = tbl AND policyname = pol
        ) THEN
            EXECUTE format(
                'CREATE POLICY %I ON %I FOR ALL USING (true) WITH CHECK (true)',
                pol, tbl
            );
        END IF;
    END LOOP;
END $$;

-- ─── ALL DONE ─────────────────────────────────────────────────
-- 14 tables created. Run this file once only.
-- ──────────────────────────────────────────────────────────────
