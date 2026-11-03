-- ============================================================
-- ALPHA PHARMACY — PREMIUM MODULES MIGRATION
-- Run this in Supabase SQL Editor
-- Created: 2026-11-03
-- ============================================================

-- 1. PATIENTS
CREATE TABLE IF NOT EXISTS pharmacy_patients (
  patient_id SERIAL PRIMARY KEY,
  outlet_id INT DEFAULT 1,
  full_name TEXT NOT NULL,
  id_number TEXT,
  phone TEXT,
  email TEXT,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('Male','Female','Other')),
  address TEXT,
  county TEXT,
  allergies TEXT[] DEFAULT '{}',
  chronic_conditions TEXT[] DEFAULT '{}',
  blood_type TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  insurance_provider TEXT,
  insurance_member_no TEXT,
  consent_given BOOLEAN DEFAULT FALSE,
  consent_date TIMESTAMPTZ,
  privacy_accepted BOOLEAN DEFAULT FALSE,
  notes TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PRESCRIPTIONS
CREATE TABLE IF NOT EXISTS pharmacy_prescriptions (
  prescription_id SERIAL PRIMARY KEY,
  outlet_id INT DEFAULT 1,
  patient_id INT REFERENCES pharmacy_patients(patient_id),
  prescription_no TEXT UNIQUE NOT NULL,
  prescriber_name TEXT NOT NULL,
  prescriber_reg_no TEXT,
  prescriber_facility TEXT,
  prescriber_phone TEXT,
  diagnosis TEXT,
  prescription_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date DATE,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending','Partially Dispensed','Fully Dispensed','Expired','Cancelled')),
  is_controlled BOOLEAN DEFAULT FALSE,
  image_url TEXT,
  notes TEXT,
  dispensed_by TEXT,
  verified_by TEXT,
  verification_date TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. PRESCRIPTION ITEMS
CREATE TABLE IF NOT EXISTS pharmacy_prescription_items (
  item_id SERIAL PRIMARY KEY,
  prescription_id INT REFERENCES pharmacy_prescriptions(prescription_id) ON DELETE CASCADE,
  product_id INT,
  drug_name TEXT NOT NULL,
  dosage TEXT,
  frequency TEXT,
  duration TEXT,
  quantity_prescribed INT DEFAULT 0,
  quantity_dispensed INT DEFAULT 0,
  instructions TEXT,
  substitution_allowed BOOLEAN DEFAULT TRUE,
  status TEXT DEFAULT 'Pending'
);

-- 4. DDR REGISTER (Controlled Substances Master)
CREATE TABLE IF NOT EXISTS pharmacy_ddr_register (
  ddr_id SERIAL PRIMARY KEY,
  outlet_id INT DEFAULT 1,
  product_id INT,
  drug_name TEXT NOT NULL,
  drug_schedule TEXT NOT NULL CHECK (drug_schedule IN ('S1','S2','S3','S4','S5','S6','S7')),
  generic_name TEXT,
  strength TEXT,
  dosage_form TEXT,
  opening_balance DECIMAL(12,2) DEFAULT 0,
  current_balance DECIMAL(12,2) DEFAULT 0,
  unit TEXT DEFAULT 'Tablet',
  storage_location TEXT DEFAULT 'Controlled Cabinet',
  last_reconciliation_date DATE,
  active BOOLEAN DEFAULT TRUE,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. DDR TRANSACTIONS
CREATE TABLE IF NOT EXISTS pharmacy_ddr_transactions (
  transaction_id SERIAL PRIMARY KEY,
  ddr_id INT REFERENCES pharmacy_ddr_register(ddr_id) ON DELETE CASCADE,
  outlet_id INT DEFAULT 1,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('Receipt','Dispensing','Disposal','Adjustment','Loss','Transfer')),
  transaction_date TIMESTAMPTZ DEFAULT NOW(),
  quantity DECIMAL(12,2) NOT NULL,
  balance_after DECIMAL(12,2) NOT NULL,
  batch_number TEXT,
  expiry_date DATE,
  supplier_name TEXT,
  supplier_address TEXT,
  invoice_number TEXT,
  patient_name TEXT,
  patient_id_number TEXT,
  patient_address TEXT,
  patient_phone TEXT,
  prescriber_name TEXT,
  prescriber_reg_no TEXT,
  prescriber_facility TEXT,
  prescription_date DATE,
  prescription_no TEXT,
  pharmacist_name TEXT,
  pharmacist_reg_no TEXT,
  counter_signatory TEXT,
  counter_sign_reg_no TEXT,
  disposal_method TEXT,
  disposal_witness TEXT,
  ppb_reference TEXT,
  loss_type TEXT CHECK (loss_type IN ('Loss','Theft','Spillage','Breakage',NULL)),
  police_report_no TEXT,
  ppb_notification_date DATE,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. INSURANCE PROVIDERS
CREATE TABLE IF NOT EXISTS pharmacy_insurance_providers (
  provider_id SERIAL PRIMARY KEY,
  provider_name TEXT NOT NULL,
  provider_type TEXT NOT NULL CHECK (provider_type IN ('SHA','Private','Corporate')),
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  api_endpoint TEXT,
  contract_start DATE,
  contract_end DATE,
  copay_percentage DECIMAL(5,2) DEFAULT 0,
  credit_limit DECIMAL(12,2) DEFAULT 0,
  outstanding_balance DECIMAL(12,2) DEFAULT 0,
  payment_terms_days INT DEFAULT 30,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. INSURANCE CLAIMS
CREATE TABLE IF NOT EXISTS pharmacy_insurance_claims (
  claim_id SERIAL PRIMARY KEY,
  outlet_id INT DEFAULT 1,
  claim_no TEXT UNIQUE NOT NULL,
  provider_id INT REFERENCES pharmacy_insurance_providers(provider_id),
  patient_id INT REFERENCES pharmacy_patients(patient_id),
  member_no TEXT,
  sale_id INT,
  claim_date TIMESTAMPTZ DEFAULT NOW(),
  claim_amount DECIMAL(12,2) NOT NULL,
  copay_amount DECIMAL(12,2) DEFAULT 0,
  approved_amount DECIMAL(12,2),
  status TEXT DEFAULT 'Submitted' CHECK (status IN ('Submitted','Under Review','Approved','Rejected','Paid','Disputed')),
  rejection_reason TEXT,
  payment_date DATE,
  payment_reference TEXT,
  items JSONB DEFAULT '[]',
  notes TEXT,
  submitted_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. ADR REPORTS (Pharmacovigilance)
CREATE TABLE IF NOT EXISTS pharmacy_adr_reports (
  report_id SERIAL PRIMARY KEY,
  outlet_id INT DEFAULT 1,
  report_no TEXT UNIQUE NOT NULL,
  patient_id INT REFERENCES pharmacy_patients(patient_id),
  patient_name TEXT,
  patient_age INT,
  patient_gender TEXT,
  patient_weight DECIMAL(6,2),
  reaction_date DATE NOT NULL,
  report_date DATE DEFAULT CURRENT_DATE,
  suspected_drug TEXT NOT NULL,
  batch_number TEXT,
  manufacturer TEXT,
  indication TEXT,
  reaction_description TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('Mild','Moderate','Severe','Fatal')),
  outcome TEXT CHECK (outcome IN ('Recovered','Recovering','Not Recovered','Fatal','Unknown')),
  action_taken TEXT,
  rechallenge TEXT CHECK (rechallenge IN ('Yes','No','N/A')),
  concomitant_drugs TEXT,
  reporter_name TEXT,
  reporter_designation TEXT,
  ppb_submitted BOOLEAN DEFAULT FALSE,
  ppb_submission_date DATE,
  ppb_reference TEXT,
  status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft','Submitted','Acknowledged')),
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. DRUG RECALLS
CREATE TABLE IF NOT EXISTS pharmacy_drug_recalls (
  recall_id SERIAL PRIMARY KEY,
  outlet_id INT DEFAULT 1,
  drug_name TEXT NOT NULL,
  batch_numbers TEXT[] DEFAULT '{}',
  manufacturer TEXT,
  recall_class TEXT CHECK (recall_class IN ('Class I','Class II','Class III')),
  recall_reason TEXT NOT NULL,
  recall_date DATE NOT NULL,
  ppb_notice_no TEXT,
  quantity_in_stock DECIMAL(12,2) DEFAULT 0,
  quantity_quarantined DECIMAL(12,2) DEFAULT 0,
  quantity_returned DECIMAL(12,2) DEFAULT 0,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active','Quarantined','Returned','Resolved')),
  action_taken TEXT,
  resolved_date DATE,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. LOYALTY PROGRAM
CREATE TABLE IF NOT EXISTS pharmacy_loyalty (
  loyalty_id SERIAL PRIMARY KEY,
  patient_id INT REFERENCES pharmacy_patients(patient_id),
  outlet_id INT DEFAULT 1,
  membership_no TEXT UNIQUE NOT NULL,
  tier TEXT DEFAULT 'Bronze' CHECK (tier IN ('Bronze','Silver','Gold','Platinum')),
  total_points INT DEFAULT 0,
  redeemed_points INT DEFAULT 0,
  available_points INT DEFAULT 0,
  total_spent DECIMAL(12,2) DEFAULT 0,
  visit_count INT DEFAULT 0,
  last_visit DATE,
  join_date DATE DEFAULT CURRENT_DATE,
  sms_consent BOOLEAN DEFAULT FALSE,
  whatsapp_consent BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. LOYALTY TRANSACTIONS
CREATE TABLE IF NOT EXISTS pharmacy_loyalty_transactions (
  transaction_id SERIAL PRIMARY KEY,
  loyalty_id INT REFERENCES pharmacy_loyalty(loyalty_id) ON DELETE CASCADE,
  transaction_type TEXT CHECK (transaction_type IN ('Earn','Redeem','Bonus','Expire')),
  points INT NOT NULL,
  sale_id INT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. STOCK TAKES
CREATE TABLE IF NOT EXISTS pharmacy_stock_takes (
  stock_take_id SERIAL PRIMARY KEY,
  outlet_id INT DEFAULT 1,
  reference_no TEXT UNIQUE NOT NULL,
  stock_take_date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'In Progress' CHECK (status IN ('In Progress','Completed','Approved','Cancelled')),
  total_items INT DEFAULT 0,
  matched_items INT DEFAULT 0,
  variance_items INT DEFAULT 0,
  total_system_value DECIMAL(12,2) DEFAULT 0,
  total_physical_value DECIMAL(12,2) DEFAULT 0,
  variance_value DECIMAL(12,2) DEFAULT 0,
  conducted_by TEXT,
  approved_by TEXT,
  approved_date TIMESTAMPTZ,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. STOCK TAKE ITEMS
CREATE TABLE IF NOT EXISTS pharmacy_stock_take_items (
  item_id SERIAL PRIMARY KEY,
  stock_take_id INT REFERENCES pharmacy_stock_takes(stock_take_id) ON DELETE CASCADE,
  product_id INT,
  product_name TEXT,
  batch_number TEXT,
  expiry_date DATE,
  system_qty DECIMAL(12,2) DEFAULT 0,
  physical_qty DECIMAL(12,2) DEFAULT 0,
  variance_qty DECIMAL(12,2) DEFAULT 0,
  unit_cost DECIMAL(12,2) DEFAULT 0,
  variance_value DECIMAL(12,2) DEFAULT 0,
  reason TEXT,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending','Verified','Adjusted'))
);

-- 14. DRUG INTERACTIONS DATABASE
CREATE TABLE IF NOT EXISTS pharmacy_drug_interactions (
  interaction_id SERIAL PRIMARY KEY,
  drug_a TEXT NOT NULL,
  drug_b TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('Minor','Moderate','Major','Contraindicated')),
  description TEXT NOT NULL,
  mechanism TEXT,
  clinical_effect TEXT,
  management TEXT,
  reference_source TEXT
);

-- 15. PATIENT CONSENT RECORDS
CREATE TABLE IF NOT EXISTS pharmacy_consent_records (
  consent_id SERIAL PRIMARY KEY,
  patient_id INT REFERENCES pharmacy_patients(patient_id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('Data Processing','Marketing','SMS','WhatsApp','Research','Insurance Sharing')),
  granted BOOLEAN NOT NULL,
  granted_date TIMESTAMPTZ DEFAULT NOW(),
  revoked_date TIMESTAMPTZ,
  ip_address TEXT,
  consent_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. DISPENSING LOG
CREATE TABLE IF NOT EXISTS pharmacy_dispensing_log (
  dispensing_id SERIAL PRIMARY KEY,
  outlet_id INT DEFAULT 1,
  prescription_id INT REFERENCES pharmacy_prescriptions(prescription_id),
  patient_id INT REFERENCES pharmacy_patients(patient_id),
  product_id INT,
  drug_name TEXT NOT NULL,
  batch_number TEXT,
  expiry_date DATE,
  quantity_dispensed INT NOT NULL,
  unit TEXT,
  dosage_instructions TEXT,
  dispensed_by TEXT NOT NULL,
  verified_by TEXT,
  verification_status TEXT DEFAULT 'Pending' CHECK (verification_status IN ('Pending','Verified','Rejected')),
  is_controlled BOOLEAN DEFAULT FALSE,
  is_substituted BOOLEAN DEFAULT FALSE,
  original_drug TEXT,
  substitution_reason TEXT,
  label_printed BOOLEAN DEFAULT FALSE,
  sale_id INT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SEED: Drug Interactions (Common Pharmacy Interactions)
-- ============================================================
INSERT INTO pharmacy_drug_interactions (drug_a, drug_b, severity, description, mechanism, clinical_effect, management, reference_source) VALUES
('Warfarin', 'Aspirin', 'Major', 'Increased bleeding risk', 'Additive anticoagulant/antiplatelet effects', 'Serious or life-threatening bleeding', 'Avoid combination unless specifically indicated. Monitor INR closely.', 'BNF 2024'),
('Metformin', 'Alcohol', 'Major', 'Risk of lactic acidosis', 'Alcohol potentiates effect of metformin on lactate metabolism', 'Potentially fatal lactic acidosis', 'Advise patients to limit alcohol intake. Monitor lactate levels.', 'MIMS Kenya'),
('ACE Inhibitors', 'Potassium Supplements', 'Major', 'Hyperkalemia risk', 'ACE inhibitors reduce aldosterone, retaining potassium', 'Dangerous hyperkalemia, cardiac arrhythmias', 'Monitor serum potassium regularly. Avoid combination if possible.', 'BNF 2024'),
('Ciprofloxacin', 'Antacids', 'Moderate', 'Reduced ciprofloxacin absorption', 'Chelation with metal cations in antacids', 'Treatment failure due to subtherapeutic levels', 'Give ciprofloxacin 2 hours before or 6 hours after antacids.', 'MIMS Kenya'),
('Methotrexate', 'NSAIDs', 'Major', 'Methotrexate toxicity', 'NSAIDs reduce renal clearance of methotrexate', 'Bone marrow suppression, hepatotoxicity, nephrotoxicity', 'Avoid combination. If necessary, monitor methotrexate levels.', 'BNF 2024'),
('Simvastatin', 'Erythromycin', 'Major', 'Rhabdomyolysis risk', 'CYP3A4 inhibition increases statin levels', 'Muscle breakdown, kidney damage', 'Use alternative antibiotic or switch to pravastatin/rosuvastatin.', 'FDA Safety'),
('Amoxicillin', 'Oral Contraceptives', 'Minor', 'Possible reduced contraceptive efficacy', 'Gut flora disruption may reduce enterohepatic recirculation', 'Unintended pregnancy (rare)', 'Use additional contraception during antibiotic course.', 'WHO Guidelines'),
('Losartan', 'Potassium Supplements', 'Major', 'Hyperkalemia risk', 'ARBs reduce aldosterone secretion', 'Dangerous hyperkalemia', 'Monitor potassium levels. Avoid unless K+ is confirmed low.', 'BNF 2024'),
('Digoxin', 'Amiodarone', 'Major', 'Digoxin toxicity', 'Amiodarone inhibits P-glycoprotein and renal clearance', 'Nausea, visual disturbances, fatal arrhythmias', 'Reduce digoxin dose by 50%. Monitor digoxin levels.', 'BNF 2024'),
('Clopidogrel', 'Omeprazole', 'Moderate', 'Reduced antiplatelet effect', 'Omeprazole inhibits CYP2C19 activation of clopidogrel', 'Increased cardiovascular event risk', 'Use pantoprazole instead of omeprazole.', 'FDA Safety'),
('Fluconazole', 'Warfarin', 'Major', 'Increased bleeding risk', 'CYP2C9 inhibition increases warfarin levels', 'Serious hemorrhage', 'Monitor INR closely. Reduce warfarin dose.', 'BNF 2024'),
('Diclofenac', 'Lithium', 'Moderate', 'Lithium toxicity', 'NSAIDs reduce renal lithium clearance', 'Tremor, confusion, seizures', 'Monitor lithium levels. Consider paracetamol instead.', 'MIMS Kenya'),
('Metronidazole', 'Alcohol', 'Major', 'Disulfiram-like reaction', 'Inhibition of aldehyde dehydrogenase', 'Severe nausea, vomiting, flushing, tachycardia', 'Avoid alcohol during and 48 hours after treatment.', 'BNF 2024'),
('Carbamazepine', 'Oral Contraceptives', 'Major', 'Contraceptive failure', 'CYP3A4 induction increases hormone metabolism', 'Unintended pregnancy', 'Use non-hormonal or high-dose contraception.', 'WHO Guidelines'),
('Amlodipine', 'Simvastatin', 'Moderate', 'Increased statin levels', 'Amlodipine inhibits CYP3A4 metabolism of simvastatin', 'Myopathy risk', 'Limit simvastatin to 20mg daily with amlodipine.', 'FDA Safety')
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED: Insurance Providers (Kenya)
-- ============================================================
INSERT INTO pharmacy_insurance_providers (provider_name, provider_type, contact_person, phone, email, copay_percentage, credit_limit, payment_terms_days) VALUES
('Social Health Authority (SHA)', 'SHA', 'SHA Claims Dept', '0800 720 601', 'claims@sha.go.ke', 0, 500000, 30),
('Jubilee Insurance', 'Private', 'Claims Manager', '0709 949 000', 'medclaims@jubileekenya.com', 10, 200000, 45),
('AAR Insurance', 'Private', 'Provider Relations', '0720 284 000', 'providers@aar.co.ke', 10, 150000, 30),
('Madison Insurance', 'Private', 'Medical Claims', '0722 209 468', 'medclaims@madison.co.ke', 15, 100000, 30),
('Britam Insurance', 'Private', 'Health Claims', '0705 100 100', 'healthclaims@britam.com', 10, 200000, 45),
('CIC Insurance', 'Private', 'Medical Dept', '0703 099 120', 'medical@cic.co.ke', 20, 80000, 30),
('UAP Old Mutual', 'Private', 'Claims Processing', '0711 065 000', 'claims@uap-group.com', 15, 120000, 30),
('Resolution Insurance', 'Private', 'Provider Support', '0709 891 000', 'provider@resolution.co.ke', 10, 100000, 30)
ON CONFLICT DO NOTHING;

-- ============================================================
-- DISABLE RLS ON NEW TABLES (for development)
-- ============================================================
ALTER TABLE pharmacy_patients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for pharmacy_patients" ON pharmacy_patients FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE pharmacy_prescriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for pharmacy_prescriptions" ON pharmacy_prescriptions FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE pharmacy_prescription_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for pharmacy_prescription_items" ON pharmacy_prescription_items FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE pharmacy_ddr_register ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for pharmacy_ddr_register" ON pharmacy_ddr_register FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE pharmacy_ddr_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for pharmacy_ddr_transactions" ON pharmacy_ddr_transactions FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE pharmacy_insurance_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for pharmacy_insurance_providers" ON pharmacy_insurance_providers FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE pharmacy_insurance_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for pharmacy_insurance_claims" ON pharmacy_insurance_claims FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE pharmacy_adr_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for pharmacy_adr_reports" ON pharmacy_adr_reports FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE pharmacy_drug_recalls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for pharmacy_drug_recalls" ON pharmacy_drug_recalls FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE pharmacy_loyalty ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for pharmacy_loyalty" ON pharmacy_loyalty FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE pharmacy_loyalty_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for pharmacy_loyalty_transactions" ON pharmacy_loyalty_transactions FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE pharmacy_stock_takes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for pharmacy_stock_takes" ON pharmacy_stock_takes FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE pharmacy_stock_take_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for pharmacy_stock_take_items" ON pharmacy_stock_take_items FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE pharmacy_drug_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for pharmacy_drug_interactions" ON pharmacy_drug_interactions FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE pharmacy_consent_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for pharmacy_consent_records" ON pharmacy_consent_records FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE pharmacy_dispensing_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for pharmacy_dispensing_log" ON pharmacy_dispensing_log FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_patients_outlet ON pharmacy_patients(outlet_id);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON pharmacy_patients(phone);
CREATE INDEX IF NOT EXISTS idx_patients_id_number ON pharmacy_patients(id_number);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON pharmacy_prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_outlet ON pharmacy_prescriptions(outlet_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON pharmacy_prescriptions(status);
CREATE INDEX IF NOT EXISTS idx_ddr_register_outlet ON pharmacy_ddr_register(outlet_id);
CREATE INDEX IF NOT EXISTS idx_ddr_transactions_ddr ON pharmacy_ddr_transactions(ddr_id);
CREATE INDEX IF NOT EXISTS idx_ddr_transactions_date ON pharmacy_ddr_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_claims_provider ON pharmacy_insurance_claims(provider_id);
CREATE INDEX IF NOT EXISTS idx_claims_patient ON pharmacy_insurance_claims(patient_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON pharmacy_insurance_claims(status);
CREATE INDEX IF NOT EXISTS idx_adr_outlet ON pharmacy_adr_reports(outlet_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_patient ON pharmacy_loyalty(patient_id);
CREATE INDEX IF NOT EXISTS idx_stock_takes_outlet ON pharmacy_stock_takes(outlet_id);
CREATE INDEX IF NOT EXISTS idx_dispensing_patient ON pharmacy_dispensing_log(patient_id);
CREATE INDEX IF NOT EXISTS idx_dispensing_prescription ON pharmacy_dispensing_log(prescription_id);
CREATE INDEX IF NOT EXISTS idx_drug_interactions_a ON pharmacy_drug_interactions(drug_a);
CREATE INDEX IF NOT EXISTS idx_drug_interactions_b ON pharmacy_drug_interactions(drug_b);
