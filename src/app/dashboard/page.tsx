'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast, { Toaster } from 'react-hot-toast';
import {
    FiRefreshCw, FiDownload, FiPrinter, FiPlusCircle, FiAlertTriangle,
    FiTrendingUp, FiShoppingBag, FiDollarSign, FiBox, FiClock,
    FiCheckCircle, FiXCircle, FiFilter, FiSearch, FiSliders,
    FiActivity, FiFileText, FiUsers, FiLayers, FiCalendar,
    FiArrowUpRight, FiArrowDownRight, FiShield, FiPercent,
    FiMaximize2, FiMinimize2, FiEye, FiCheck, FiTruck, FiCreditCard
} from 'react-icons/fi';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

// ─────────────────────────────────────────────────────────────────────────────
// PHARMACY MASTER CATALOG (54 Real Clinical Medications)
// ─────────────────────────────────────────────────────────────────────────────
interface MasterProduct {
    pid: number;
    product_code: string;
    product_name: string;
    generic_name: string;
    category: string;
    sales_unit: string;
    purchase_unit: string;
    purchase_cost: number;
    sales_cost: number;
    manufacturer: string;
    reorder_point: number;
    preferred_supplier: string;
}

const PHARMACY_MASTER_CATALOG: MasterProduct[] = [
    { pid: 5, product_code: 'PH-0001', product_name: 'Paracetamol 500mg', generic_name: 'Paracetamol', category: 'Analgesics & Antipyretics', sales_unit: 'Tablet', purchase_unit: 'Box', purchase_cost: 150, sales_cost: 5, manufacturer: 'GSK', reorder_point: 60, preferred_supplier: 'Radiant Pharmaceuticals' },
    { pid: 6, product_code: 'PH-0002', product_name: 'Amoxicillin 500mg', generic_name: 'Amoxicillin', category: 'Antibiotics', sales_unit: 'Capsule', purchase_unit: 'Box', purchase_cost: 350, sales_cost: 10, manufacturer: 'Sandoz', reorder_point: 50, preferred_supplier: 'Radiant Pharmaceuticals' },
    { pid: 7, product_code: 'PH-0003', product_name: 'Metformin 500mg', generic_name: 'Metformin HCl', category: 'Antidiabetics', sales_unit: 'Tablet', purchase_unit: 'Box', purchase_cost: 280, sales_cost: 8, manufacturer: 'Merck', reorder_point: 50, preferred_supplier: 'Fresh Foods Ltd' },
    { pid: 8, product_code: 'PH-0004', product_name: 'Ibuprofen 400mg', generic_name: 'Ibuprofen', category: 'Analgesics & Antipyretics', sales_unit: 'Tablet', purchase_unit: 'Box', purchase_cost: 200, sales_cost: 5, manufacturer: 'Pfizer', reorder_point: 40, preferred_supplier: 'Quick Supplies' },
    { pid: 9, product_code: 'PH-0005', product_name: 'Ciprofloxacin 500mg', generic_name: 'Ciprofloxacin', category: 'Antibiotics', sales_unit: 'Tablet', purchase_unit: 'Box', purchase_cost: 450, sales_cost: 15, manufacturer: 'Bayer', reorder_point: 40, preferred_supplier: 'Nairobi Stores' },
    { pid: 10, product_code: 'PH-0006', product_name: 'Omeprazole 20mg', generic_name: 'Omeprazole', category: 'Gastrointestinal', sales_unit: 'Capsule', purchase_unit: 'Box', purchase_cost: 180, sales_cost: 15, manufacturer: 'AstraZeneca', reorder_point: 40, preferred_supplier: 'Radiant Pharmaceuticals' },
    { pid: 11, product_code: 'PH-0007', product_name: 'Diclofenac 50mg', generic_name: 'Diclofenac Sodium', category: 'Analgesics & Antipyretics', sales_unit: 'Tablet', purchase_unit: 'Box', purchase_cost: 160, sales_cost: 5, manufacturer: 'Novartis', reorder_point: 50, preferred_supplier: 'Fresh Foods Ltd' },
    { pid: 12, product_code: 'PH-0008', product_name: 'Cetirizine 10mg', generic_name: 'Cetirizine HCl', category: 'Antihistamines', sales_unit: 'Tablet', purchase_unit: 'Box', purchase_cost: 120, sales_cost: 5, manufacturer: 'UCB', reorder_point: 45, preferred_supplier: 'Quick Supplies' },
    { pid: 13, product_code: 'PH-0009', product_name: 'Azithromycin 250mg', generic_name: 'Azithromycin', category: 'Antibiotics', sales_unit: 'Capsule', purchase_unit: 'Box', purchase_cost: 300, sales_cost: 25, manufacturer: 'Pfizer', reorder_point: 35, preferred_supplier: 'Radiant Pharmaceuticals' },
    { pid: 14, product_code: 'PH-0010', product_name: 'Losartan 50mg', generic_name: 'Losartan Potassium', category: 'Antihypertensives', sales_unit: 'Tablet', purchase_unit: 'Box', purchase_cost: 250, sales_cost: 20, manufacturer: 'Merck', reorder_point: 35, preferred_supplier: 'Farm Direct' },
    { pid: 15, product_code: 'PH-0011', product_name: 'Cough Syrup 100ml', generic_name: 'Dextromethorphan', category: 'Respiratory', sales_unit: 'Bottle', purchase_unit: 'Bottle', purchase_cost: 120, sales_cost: 200, manufacturer: 'Reckitt', reorder_point: 25, preferred_supplier: 'Nairobi Stores' },
    { pid: 16, product_code: 'PH-0012', product_name: 'Amoxicillin Suspension 100ml', generic_name: 'Amoxicillin Trihydrate', category: 'Antibiotics', sales_unit: 'Bottle', purchase_unit: 'Bottle', purchase_cost: 180, sales_cost: 300, manufacturer: 'GSK', reorder_point: 30, preferred_supplier: 'Radiant Pharmaceuticals' },
    { pid: 17, product_code: 'PH-0013', product_name: 'Paracetamol Syrup 60ml', generic_name: 'Paracetamol', category: 'Analgesics & Antipyretics', sales_unit: 'Bottle', purchase_unit: 'Bottle', purchase_cost: 80, sales_cost: 150, manufacturer: 'GSK', reorder_point: 35, preferred_supplier: 'Fresh Foods Ltd' },
    { pid: 18, product_code: 'PH-0014', product_name: 'Gripe Water 150ml', generic_name: 'Sodium Bicarbonate', category: 'Baby & Child Care', sales_unit: 'Bottle', purchase_unit: 'Bottle', purchase_cost: 100, sales_cost: 180, manufacturer: 'Woodwards', reorder_point: 20, preferred_supplier: 'Quick Supplies' },
    { pid: 19, product_code: 'PH-0015', product_name: 'Iron Syrup 200ml', generic_name: 'Ferrous Sulphate', category: 'Vitamins & Supplements', sales_unit: 'Bottle', purchase_unit: 'Bottle', purchase_cost: 150, sales_cost: 280, manufacturer: 'Ranbaxy', reorder_point: 20, preferred_supplier: 'Farm Direct' },
    { pid: 20, product_code: 'PH-0016', product_name: 'Multivitamin Syrup 100ml', generic_name: 'Multivitamins + Minerals', category: 'Vitamins & Supplements', sales_unit: 'Bottle', purchase_unit: 'Bottle', purchase_cost: 200, sales_cost: 350, manufacturer: 'Roche', reorder_point: 25, preferred_supplier: 'Radiant Pharmaceuticals' },
    { pid: 21, product_code: 'PH-0017', product_name: 'Diclofenac Injection 75mg', generic_name: 'Diclofenac Sodium', category: 'Injectables', sales_unit: 'Ampoule', purchase_unit: 'Box', purchase_cost: 250, sales_cost: 80, manufacturer: 'Novartis', reorder_point: 30, preferred_supplier: 'Quick Supplies' },
    { pid: 22, product_code: 'PH-0018', product_name: 'Gentamicin Injection 80mg', generic_name: 'Gentamicin Sulfate', category: 'Injectables', sales_unit: 'Ampoule', purchase_unit: 'Box', purchase_cost: 400, sales_cost: 60, manufacturer: 'Cipla', reorder_point: 30, preferred_supplier: 'Radiant Pharmaceuticals' },
    { pid: 23, product_code: 'PH-0019', product_name: 'Dexamethasone Injection 8mg', generic_name: 'Dexamethasone Sodium', category: 'Injectables', sales_unit: 'Ampoule', purchase_unit: 'Box', purchase_cost: 350, sales_cost: 50, manufacturer: 'Merck', reorder_point: 30, preferred_supplier: 'Nairobi Stores' },
    { pid: 24, product_code: 'PH-0020', product_name: 'Ceftriaxone IV 1g', generic_name: 'Ceftriaxone Sodium', category: 'Injectables', sales_unit: 'Vial', purchase_unit: 'Box', purchase_cost: 1200, sales_cost: 180, manufacturer: 'Roche', reorder_point: 20, preferred_supplier: 'Radiant Pharmaceuticals' },
    { pid: 25, product_code: 'PH-0021', product_name: 'Betadine Ointment 30g', generic_name: 'Povidone-Iodine 10%', category: 'Topical & Creams', sales_unit: 'Tube', purchase_unit: 'Carton', purchase_cost: 120, sales_cost: 150, manufacturer: 'Purdue', reorder_point: 20, preferred_supplier: 'Fresh Foods Ltd' },
    { pid: 26, product_code: 'PH-0022', product_name: 'Clotrimazole Cream 20g', generic_name: 'Clotrimazole 1%', category: 'Topical & Creams', sales_unit: 'Tube', purchase_unit: 'Carton', purchase_cost: 80, sales_cost: 80, manufacturer: 'Bayer', reorder_point: 25, preferred_supplier: 'Quick Supplies' },
    { pid: 27, product_code: 'PH-0023', product_name: 'Hydrocortisone Cream 15g', generic_name: 'Hydrocortisone 1%', category: 'Topical & Creams', sales_unit: 'Tube', purchase_unit: 'Carton', purchase_cost: 100, sales_cost: 120, manufacturer: 'Pfizer', reorder_point: 20, preferred_supplier: 'Radiant Pharmaceuticals' },
    { pid: 28, product_code: 'PH-0024', product_name: 'Calamine Lotion 100ml', generic_name: 'Calamine + Zinc', category: 'Topical & Creams', sales_unit: 'Bottle', purchase_unit: 'Carton', purchase_cost: 80, sales_cost: 100, manufacturer: 'J&J', reorder_point: 20, preferred_supplier: 'Farm Direct' },
    { pid: 29, product_code: 'PH-0025', product_name: 'Antifungal Powder 50g', generic_name: 'Miconazole Nitrate', category: 'Topical & Creams', sales_unit: 'Bottle', purchase_unit: 'Carton', purchase_cost: 80, sales_cost: 100, manufacturer: 'J&J', reorder_point: 20, preferred_supplier: 'Nairobi Stores' },
    { pid: 30, product_code: 'PH-0026', product_name: 'Chloramphenicol Eye Drops 10ml', generic_name: 'Chloramphenicol 0.5%', category: 'Eye & Ear Drops', sales_unit: 'Bottle', purchase_unit: 'Box', purchase_cost: 65, sales_cost: 80, manufacturer: 'Allergan', reorder_point: 20, preferred_supplier: 'Quick Supplies' },
    { pid: 31, product_code: 'PH-0027', product_name: 'Ciprofloxacin Eye Drops 5ml', generic_name: 'Ciprofloxacin 0.3%', category: 'Eye & Ear Drops', sales_unit: 'Bottle', purchase_unit: 'Box', purchase_cost: 80, sales_cost: 100, manufacturer: 'Alcon', reorder_point: 20, preferred_supplier: 'Radiant Pharmaceuticals' },
    { pid: 32, product_code: 'PH-0028', product_name: 'Artificial Tears 15ml', generic_name: 'Carboxymethylcellulose', category: 'Eye & Ear Drops', sales_unit: 'Bottle', purchase_unit: 'Box', purchase_cost: 100, sales_cost: 120, manufacturer: 'Allergan', reorder_point: 20, preferred_supplier: 'Fresh Foods Ltd' },
    { pid: 33, product_code: 'PH-0029', product_name: 'Surgical Gloves (Medium)', generic_name: 'Powder-Free Latex', category: 'Medical Supplies', sales_unit: 'Pair', purchase_unit: 'Box (100)', purchase_cost: 800, sales_cost: 20, manufacturer: 'Supermax', reorder_point: 80, preferred_supplier: 'Farm Direct' },
    { pid: 34, product_code: 'PH-0030', product_name: 'Disposable Syringes 5ml', generic_name: 'Luer Lock 5ml', category: 'Medical Supplies', sales_unit: 'Piece', purchase_unit: 'Box (100)', purchase_cost: 700, sales_cost: 15, manufacturer: 'BD', reorder_point: 80, preferred_supplier: 'Nairobi Stores' },
    { pid: 35, product_code: 'PH-0031', product_name: 'Cotton Wool 500g', generic_name: 'Absorbent Cotton', category: 'Medical Supplies', sales_unit: 'Roll', purchase_unit: 'Bundle', purchase_cost: 200, sales_cost: 350, manufacturer: 'Johnson', reorder_point: 20, preferred_supplier: 'Quick Supplies' },
    { pid: 36, product_code: 'PH-0032', product_name: 'Gauze Bandage 4"x4m', generic_name: 'Woven Cotton Bandage', category: 'Medical Supplies', sales_unit: 'Piece', purchase_unit: 'Pack (12)', purchase_cost: 360, sales_cost: 50, manufacturer: 'BSN Medical', reorder_point: 40, preferred_supplier: 'Fresh Foods Ltd' },
    { pid: 37, product_code: 'PH-0033', product_name: 'Surgical Face Masks', generic_name: '3-Ply Medical Masks', category: 'Medical Supplies', sales_unit: 'Piece', purchase_unit: 'Box (50)', purchase_cost: 300, sales_cost: 10, manufacturer: '3M', reorder_point: 80, preferred_supplier: 'Radiant Pharmaceuticals' },
    { pid: 38, product_code: 'PH-0034', product_name: 'Hand Sanitizer 500ml', generic_name: 'Ethanol 70% + Glycerol', category: 'Antiseptics & Sanitizers', sales_unit: 'Bottle', purchase_unit: 'Carton (12)', purchase_cost: 1800, sales_cost: 250, manufacturer: 'Dettol', reorder_point: 25, preferred_supplier: 'Nairobi Stores' },
    { pid: 39, product_code: 'PH-0035', product_name: 'Baby Diapers Size 3 (50pk)', generic_name: 'Breathable Diapers', category: 'Baby & Child Care', sales_unit: 'Pack', purchase_unit: 'Bale', purchase_cost: 780, sales_cost: 950, manufacturer: 'Pampers', reorder_point: 15, preferred_supplier: 'Quick Supplies' },
    { pid: 40, product_code: 'PH-0036', product_name: 'Baby Lotion 200ml', generic_name: 'Hypoallergenic Emollient', category: 'Baby & Child Care', sales_unit: 'Bottle', purchase_unit: 'Carton', purchase_cost: 250, sales_cost: 350, manufacturer: 'Johnson Baby', reorder_point: 20, preferred_supplier: 'Fresh Foods Ltd' },
    { pid: 41, product_code: 'PH-0037', product_name: 'Zinc Cream for Babies 50g', generic_name: 'Zinc Oxide 15%', category: 'Baby & Child Care', sales_unit: 'Tube', purchase_unit: 'Carton', purchase_cost: 150, sales_cost: 220, manufacturer: 'Sudocrem', reorder_point: 20, preferred_supplier: 'Radiant Pharmaceuticals' },
    { pid: 42, product_code: 'PH-0038', product_name: 'Vitamin C 1000mg', generic_name: 'Ascorbic Acid Effervescent', category: 'Vitamins & Supplements', sales_unit: 'Tube (10)', purchase_unit: 'Box', purchase_cost: 180, sales_cost: 250, manufacturer: 'Nature Made', reorder_point: 35, preferred_supplier: 'Farm Direct' },
    { pid: 43, product_code: 'PH-0039', product_name: 'Vitamin D3 2000IU', generic_name: 'Cholecalciferol', category: 'Vitamins & Supplements', sales_unit: 'Bottle (60)', purchase_unit: 'Box', purchase_cost: 650, sales_cost: 900, manufacturer: 'NOW Foods', reorder_point: 35, preferred_supplier: 'Quick Supplies' },
    { pid: 44, product_code: 'PH-0040', product_name: 'Calcium + D3 Tablets', generic_name: 'Calcium Carbonate + D3', category: 'Vitamins & Supplements', sales_unit: 'Bottle (30)', purchase_unit: 'Box', purchase_cost: 450, sales_cost: 650, manufacturer: 'Caltrate', reorder_point: 35, preferred_supplier: 'Fresh Foods Ltd' },
    { pid: 45, product_code: 'PH-0041', product_name: 'Omega-3 Fish Oil 1000mg', generic_name: 'EPA/DHA Marine Oil', category: 'Vitamins & Supplements', sales_unit: 'Bottle (60)', purchase_unit: 'Box', purchase_cost: 900, sales_cost: 1300, manufacturer: 'Nordic Naturals', reorder_point: 30, preferred_supplier: 'Radiant Pharmaceuticals' },
    { pid: 46, product_code: 'PH-0042', product_name: 'Folic Acid 5mg', generic_name: 'Folic Acid', category: 'Vitamins & Supplements', sales_unit: 'Tablet', purchase_unit: 'Box (100)', purchase_cost: 120, sales_cost: 3, manufacturer: 'Nature Made', reorder_point: 40, preferred_supplier: 'Farm Direct' },
    { pid: 47, product_code: 'PH-0043', product_name: 'Normal Saline 0.9% 1L', generic_name: 'Sodium Chloride 0.9%', category: 'IV Fluids & Infusions', sales_unit: 'Bottle', purchase_unit: 'Carton (12)', purchase_cost: 1800, sales_cost: 250, manufacturer: 'Baxter', reorder_point: 20, preferred_supplier: 'Nairobi Stores' },
    { pid: 48, product_code: 'PH-0044', product_name: 'Dextrose 5% 500ml', generic_name: 'Dextrose Monohydrate', category: 'IV Fluids & Infusions', sales_unit: 'Bottle', purchase_unit: 'Carton (12)', purchase_cost: 1600, sales_cost: 220, manufacturer: 'Baxter', reorder_point: 20, preferred_supplier: 'Quick Supplies' },
    { pid: 49, product_code: 'PH-0045', product_name: 'Ringers Lactate 1L', generic_name: 'Hartmanns Solution', category: 'IV Fluids & Infusions', sales_unit: 'Bottle', purchase_unit: 'Carton (12)', purchase_cost: 2000, sales_cost: 280, manufacturer: 'Fresenius', reorder_point: 20, preferred_supplier: 'Radiant Pharmaceuticals' },
    { pid: 50, product_code: 'PH-0046', product_name: 'Salbutamol Inhaler 200D', generic_name: 'Salbutamol HFA', category: 'Respiratory', sales_unit: 'Canister', purchase_unit: 'Box', purchase_cost: 350, sales_cost: 500, manufacturer: 'GSK', reorder_point: 25, preferred_supplier: 'Fresh Foods Ltd' },
    { pid: 51, product_code: 'PH-0047', product_name: 'Prednisolone 5mg', generic_name: 'Prednisolone', category: 'Respiratory', sales_unit: 'Tablet', purchase_unit: 'Box (100)', purchase_cost: 150, sales_cost: 5, manufacturer: 'Pfizer', reorder_point: 35, preferred_supplier: 'Quick Supplies' },
    { pid: 52, product_code: 'PH-0048', product_name: 'Dettol Antiseptic 500ml', generic_name: 'Chloroxylenol 4.8%', category: 'Antiseptics & Sanitizers', sales_unit: 'Bottle', purchase_unit: 'Carton (12)', purchase_cost: 3600, sales_cost: 420, manufacturer: 'Reckitt', reorder_point: 20, preferred_supplier: 'Radiant Pharmaceuticals' },
    { pid: 53, product_code: 'PH-0049', product_name: 'Hydrogen Peroxide 6% 200ml', generic_name: 'H2O2 Solution', category: 'Antiseptics & Sanitizers', sales_unit: 'Bottle', purchase_unit: 'Carton (24)', purchase_cost: 1400, sales_cost: 120, manufacturer: 'Merck', reorder_point: 20, preferred_supplier: 'Farm Direct' },
    { pid: 54, product_code: 'PH-0050', product_name: 'Surgical Spirit 1L', generic_name: 'Denatured Ethanol 70%', category: 'Antiseptics & Sanitizers', sales_unit: 'Bottle', purchase_unit: 'Carton (12)', purchase_cost: 2400, sales_cost: 300, manufacturer: 'Local Labs', reorder_point: 20, preferred_supplier: 'Nairobi Stores' },
];

const CATALOG_BY_PID = new Map<number, MasterProduct>();
PHARMACY_MASTER_CATALOG.forEach(p => CATALOG_BY_PID.set(p.pid, p));

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface PharmacySaleRow {
    sale_id: number;
    receipt_no: string;
    sale_datetime: string;
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    payment_method: string;
    amount_paid: number;
    change_amount: number;
    customer_name: string;
    customer_phone: string;
    cashier_name: string;
    status: string;
    notes: string | null;
}

interface PharmacyBatchRow {
    batch_id: number;
    product_id: number;
    batch_number: string;
    expiry_date: string;
    quantity: number;
    remaining_qty: number;
    purchase_cost: number;
    selling_price: number;
    supplier_name: string;
    status: string;
    notes?: string;
}

interface PharmacyStockRow {
    st_id: number;
    pid: number;
    qty: number;
    storage_type?: string;
    expiry_date?: string;
}

interface PurchaseRow {
    purchase_id: number;
    purchase_no: string;
    purchase_date: string;
    supplier_name: string;
    supplier_invoice?: string;
    grand_total: number;
    status: string;
    payment_status: string;
    notes?: string;
}

interface ExpenseRow {
    expense_id: number;
    expense_name: string;
    category: string;
    payment_mode: string;
    amount: number;
    expense_date: string;
    description?: string;
}

interface ShiftRow {
    shift_id: number;
    shift_date: string;
    shift_type: string;
    opening_cash: number;
    closing_cash: number;
    total_sales: number;
    total_expenses: number;
    net_sales: number;
    status: string;
    opened_by?: string;
}

interface SupplierRow {
    supplier_id: number;
    supplier_name: string;
    phone?: string;
    email?: string;
    current_balance?: number;
    payment_terms?: string;
}

interface CriticalStockDeficit {
    pid: number;
    product_code: string;
    product_name: string;
    generic_name: string;
    category: string;
    unit: string;
    current_stock: number;
    reorder_point: number;
    deficit: number;
    suggested_order: number;
    unit_cost: number;
    reorder_cost: number;
    preferred_supplier: string;
    status: 'OUT_OF_STOCK' | 'CRITICAL' | 'LOW';
}

type ModuleFilter = 'all' | 'dispensing' | 'inventory' | 'expiry' | 'procurement' | 'financials' | 'staff' | 'audit';

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function PharmacyWorldClassDashboard() {
    const { activeOutlet } = useOutlet();
    const outletId = activeOutlet?.outlet_id || 1;

    // Loading & Refresh State
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
    const [lastSyncTime, setLastSyncTime] = useState<string>('');
    const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(0); // 0 = off, 30, 60, 300
    const [secondsToNextRefresh, setSecondsToNextRefresh] = useState<number>(0);
    const [tableDisplayMode, setTableDisplayMode] = useState<'fit' | 'expand'>('fit');

    // Super Module Filter
    const [activeModule, setActiveModule] = useState<ModuleFilter>('all');

    // Date Range Presets
    const [datePreset, setDatePreset] = useState<string>('30d');
    const [dateFrom, setDateFrom] = useState<string>(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    });
    const [dateTo, setDateTo] = useState<string>(() => new Date().toISOString().split('T')[0]);

    // Live Database State
    const [rawSales, setRawSales] = useState<PharmacySaleRow[]>([]);
    const [rawBatches, setRawBatches] = useState<PharmacyBatchRow[]>([]);
    const [rawStock, setRawStock] = useState<PharmacyStockRow[]>([]);
    const [rawPurchases, setRawPurchases] = useState<PurchaseRow[]>([]);
    const [rawExpenses, setRawExpenses] = useState<ExpenseRow[]>([]);
    const [rawShifts, setRawShifts] = useState<ShiftRow[]>([]);
    const [rawSuppliers, setRawSuppliers] = useState<SupplierRow[]>([]);

    // Interactive Modals State
    const [activeReceiptModal, setActiveReceiptModal] = useState<PharmacySaleRow | null>(null);
    const [reorderModalItem, setReorderModalItem] = useState<CriticalStockDeficit | null>(null);
    const [batchQuarantineModal, setBatchQuarantineModal] = useState<PharmacyBatchRow | null>(null);
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState<boolean>(false);
    const [isSubmittingModal, setIsSubmittingModal] = useState<boolean>(false);

    // Modal Forms Data
    const [reorderForm, setReorderForm] = useState({
        supplier_id: 1,
        supplier_name: 'Radiant Pharmaceuticals',
        quantity: 50,
        unit_cost: 150,
        payment_terms: '30 Days Net',
        notes: 'Priority stock replenishment from Executive Dashboard',
    });

    const [expenseForm, setExpenseForm] = useState({
        expense_name: '',
        category: 'Utilities',
        payment_mode: 'Cash',
        amount: 500,
        expense_date: new Date().toISOString().split('T')[0],
        description: '',
    });

    const [batchStatusUpdate, setBatchStatusUpdate] = useState<'Quarantined' | 'Active' | 'Disposed' | 'Discounted'>('Quarantined');
    const [batchAuditNotes, setBatchAuditNotes] = useState('');

    // Active Data Grid Sub-tab
    const [activeGridTab, setActiveGridTab] = useState<'sales' | 'deficits' | 'expiry' | 'purchases' | 'expenses' | 'shifts'>('sales');
    const [gridSearchQuery, setGridSearchQuery] = useState('');

    // ─────────────────────────────────────────────────────────────────────────
    // DATE PRESET HANDLER
    // ─────────────────────────────────────────────────────────────────────────
    const applyDatePreset = (preset: string) => {
        setDatePreset(preset);
        const today = new Date();
        const toStr = today.toISOString().split('T')[0];
        let fromStr = toStr;

        if (preset === '1d') {
            fromStr = toStr;
        } else if (preset === 'yesterday') {
            const y = new Date(today);
            y.setDate(y.getDate() - 1);
            fromStr = y.toISOString().split('T')[0];
            setDateTo(fromStr);
            setDateFrom(fromStr);
            return;
        } else if (preset === '7d') {
            const d = new Date(today);
            d.setDate(d.getDate() - 7);
            fromStr = d.toISOString().split('T')[0];
        } else if (preset === '14d') {
            const d = new Date(today);
            d.setDate(d.getDate() - 14);
            fromStr = d.toISOString().split('T')[0];
        } else if (preset === '30d') {
            const d = new Date(today);
            d.setDate(d.getDate() - 30);
            fromStr = d.toISOString().split('T')[0];
        } else if (preset === 'mtd') {
            fromStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
        } else if (preset === 'qtd') {
            const qMonth = Math.floor(today.getMonth() / 3) * 3;
            fromStr = `${today.getFullYear()}-${String(qMonth + 1).padStart(2, '0')}-01`;
        } else if (preset === 'all') {
            fromStr = '2024-01-01';
        }

        setDateFrom(fromStr);
        setDateTo(toStr);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // LIVE DATA INGESTION ENGINE
    // ─────────────────────────────────────────────────────────────────────────
    const loadAllPharmacyData = useCallback(async (isSilent = false) => {
        if (!isSilent) setIsLoading(true);
        else setIsRefreshing(true);

        try {
            // 1. Fetch Sales (Live pharmacy_sales)
            const { data: salesData, error: salesErr } = await supabase
                .from('pharmacy_sales')
                .select('sale_id, receipt_no, sale_datetime, subtotal, discount, tax, total, payment_method, amount_paid, change_amount, customer_name, customer_phone, cashier_name, status, notes')
                .order('sale_datetime', { ascending: false })
                .limit(500);

            if (salesErr) console.warn('pharmacy_sales read note:', salesErr.message);
            setRawSales((salesData as PharmacySaleRow[]) || []);

            // 2. Fetch Batches (Live pharmacy_batches)
            const { data: batchData, error: batchErr } = await supabase
                .from('pharmacy_batches')
                .select('batch_id, product_id, batch_number, expiry_date, quantity, remaining_qty, purchase_cost, selling_price, supplier_name, status, notes')
                .order('expiry_date', { ascending: true });

            if (batchErr) console.warn('pharmacy_batches read note:', batchErr.message);
            setRawBatches((batchData as PharmacyBatchRow[]) || []);

            // 3. Fetch Stock (Live pharmacy_stock)
            const { data: stockData, error: stockErr } = await supabase
                .from('pharmacy_stock')
                .select('st_id, pid, qty, storage_type, expiry_date');

            if (stockErr) console.warn('pharmacy_stock read note:', stockErr.message);
            setRawStock((stockData as PharmacyStockRow[]) || []);

            // 4. Fetch Purchases (Live purchases)
            const { data: purchaseData, error: purchaseErr } = await supabase
                .from('purchases')
                .select('purchase_id, purchase_no, purchase_date, supplier_name, supplier_invoice, grand_total, status, payment_status, notes')
                .order('purchase_date', { ascending: false })
                .limit(100);

            if (purchaseErr) console.warn('purchases read note:', purchaseErr.message);
            setRawPurchases((purchaseData as PurchaseRow[]) || []);

            // 5. Fetch Expenses (Live expenses)
            const { data: expenseData, error: expErr } = await supabase
                .from('expenses')
                .select('expense_id, expense_name, category, payment_mode, amount, expense_date, description')
                .order('expense_date', { ascending: false })
                .limit(100);

            if (expErr) console.warn('expenses read note:', expErr.message);
            setRawExpenses((expenseData as ExpenseRow[]) || []);

            // 6. Fetch Shifts (Live shifts)
            const { data: shiftData, error: shiftErr } = await supabase
                .from('shifts')
                .select('shift_id, shift_date, shift_type, opening_cash, closing_cash, total_sales, total_expenses, net_sales, status, opened_by')
                .order('shift_date', { ascending: false })
                .limit(50);

            if (shiftErr) console.warn('shifts read note:', shiftErr.message);
            setRawShifts((shiftData as ShiftRow[]) || []);

            // 7. Fetch Suppliers (Live suppliers)
            const { data: supplierData, error: suppErr } = await supabase
                .from('suppliers')
                .select('supplier_id, supplier_name, phone, email, current_balance, payment_terms')
                .order('supplier_name', { ascending: true });

            if (suppErr) console.warn('suppliers read note:', suppErr.message);
            setRawSuppliers((supplierData as SupplierRow[]) || []);

            setLastSyncTime(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        } catch (err: any) {
            console.error('Critical Pharmacy DB load error:', err);
            toast.error('Failed to sync live data: ' + (err.message || 'Network error'));
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadAllPharmacyData();
    }, [loadAllPharmacyData]);

    // ─────────────────────────────────────────────────────────────────────────
    // AUTO-REFRESH TICKER
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!autoRefreshInterval || autoRefreshInterval <= 0) return;

        setSecondsToNextRefresh(autoRefreshInterval);
        const timer = setInterval(() => {
            setSecondsToNextRefresh(prev => {
                if (prev <= 1) {
                    loadAllPharmacyData(true);
                    return autoRefreshInterval;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [autoRefreshInterval, loadAllPharmacyData]);

    // ─────────────────────────────────────────────────────────────────────────
    // COMPUTED METRICS & LIVE DATA AGGREGATION
    // ─────────────────────────────────────────────────────────────────────────
    // Filtered Sales by Date Range
    const filteredSales = useMemo(() => {
        return rawSales.filter(s => {
            if (!s.sale_datetime) return false;
            const sDate = s.sale_datetime.split('T')[0];
            return sDate >= dateFrom && sDate <= dateTo;
        });
    }, [rawSales, dateFrom, dateTo]);

    // Today's Sales
    const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
    const todaySalesList = useMemo(() => {
        return rawSales.filter(s => s.sale_datetime && s.sale_datetime.split('T')[0] === todayStr);
    }, [rawSales, todayStr]);

    const todayGrossRevenue = useMemo(() => todaySalesList.reduce((acc, s) => acc + (s.total || 0), 0), [todaySalesList]);
    const rangeGrossRevenue = useMemo(() => filteredSales.reduce((acc, s) => acc + (s.total || 0), 0), [filteredSales]);

    // Payment Method Splits
    const paymentBreakdown = useMemo(() => {
        let cash = 0, mpesa = 0, credit = 0;
        filteredSales.forEach(s => {
            const m = (s.payment_method || '').toUpperCase();
            if (m.includes('CASH')) cash += s.total || 0;
            else if (m.includes('MPESA') || m.includes('M-PESA') || m.includes('MOBILE')) mpesa += s.total || 0;
            else credit += s.total || 0;
        });
        const total = cash + mpesa + credit;
        return { cash, mpesa, credit, total };
    }, [filteredSales]);

    // Inventory Stock & Deficits Calculation
    const { stockDeficits, totalStockValuationRetail, totalStockValuationCost, outOfStockCount, criticalCount } = useMemo(() => {
        const stockMap = new Map<number, number>();
        rawStock.forEach(item => {
            stockMap.set(item.pid, (stockMap.get(item.pid) || 0) + (item.qty || 0));
        });

        // Fallback or Batch-level quantities
        rawBatches.forEach(b => {
            if (b.product_id && !stockMap.has(b.product_id)) {
                stockMap.set(b.product_id, (stockMap.get(b.product_id) || 0) + (b.remaining_qty || 0));
            }
        });

        let totalRetail = 0;
        let totalCost = 0;
        let outCount = 0;
        let critCount = 0;

        const deficits: CriticalStockDeficit[] = [];

        PHARMACY_MASTER_CATALOG.forEach(med => {
            const curStock = stockMap.get(med.pid) || 0;
            totalRetail += curStock * med.sales_cost;
            totalCost += curStock * med.purchase_cost;

            const par = med.reorder_point;
            if (curStock <= par) {
                const deficit = Math.max(0, par - curStock);
                const suggested_order = Math.max(deficit, Math.ceil(par * 1.5 - curStock));
                const reorder_cost = suggested_order * med.purchase_cost;

                let status: 'OUT_OF_STOCK' | 'CRITICAL' | 'LOW' = 'LOW';
                if (curStock === 0) {
                    status = 'OUT_OF_STOCK';
                    outCount++;
                } else if (curStock <= par * 0.4) {
                    status = 'CRITICAL';
                    critCount++;
                }

                deficits.push({
                    pid: med.pid,
                    product_code: med.product_code,
                    product_name: med.product_name,
                    generic_name: med.generic_name,
                    category: med.category,
                    unit: med.sales_unit,
                    current_stock: curStock,
                    reorder_point: par,
                    deficit,
                    suggested_order,
                    unit_cost: med.purchase_cost,
                    reorder_cost,
                    preferred_supplier: med.preferred_supplier,
                    status
                });
            }
        });

        deficits.sort((a, b) => a.current_stock - b.current_stock);

        return {
            stockDeficits: deficits,
            totalStockValuationRetail: totalRetail,
            totalStockValuationCost: totalCost,
            outOfStockCount: outCount,
            criticalCount: critCount,
        };
    }, [rawStock, rawBatches]);

    const totalReplenishmentCost = useMemo(() => {
        return stockDeficits.reduce((acc, d) => acc + d.reorder_cost, 0);
    }, [stockDeficits]);

    // Batch Expiry Risk Surveillance
    const expiryMetrics = useMemo(() => {
        const now = Date.now();
        let expired = 0;
        let exp30 = 0;
        let exp90 = 0;
        let safe = 0;
        let atRiskValue = 0;

        rawBatches.forEach(b => {
            if (!b.expiry_date) return;
            const expTime = new Date(b.expiry_date).getTime();
            const daysLeft = Math.ceil((expTime - now) / 86400000);
            const batchVal = (b.remaining_qty || 0) * (b.purchase_cost || 0);

            if (daysLeft < 0) {
                expired++;
                atRiskValue += batchVal;
            } else if (daysLeft <= 30) {
                exp30++;
                atRiskValue += batchVal;
            } else if (daysLeft <= 90) {
                exp90++;
            } else {
                safe++;
            }
        });

        return { expired, exp30, exp90, safe, atRiskValue };
    }, [rawBatches]);

    // Procurement & Suppliers Balances
    const { totalPurchasesInRange, pendingPurchasesCount, totalSupplierDebt } = useMemo(() => {
        const pInRange = rawPurchases.filter(p => {
            if (!p.purchase_date) return false;
            return p.purchase_date >= dateFrom && p.purchase_date <= dateTo;
        });
        const totalP = pInRange.reduce((acc, p) => acc + (p.grand_total || 0), 0);
        const pendingP = rawPurchases.filter(p => (p.status || '').toLowerCase().includes('pending')).length;
        const debt = rawSuppliers.reduce((acc, s) => acc + (s.current_balance || 0), 0);

        return {
            totalPurchasesInRange: totalP,
            pendingPurchasesCount: pendingP,
            totalSupplierDebt: debt,
        };
    }, [rawPurchases, rawSuppliers, dateFrom, dateTo]);

    // Operating Expenses
    const { totalExpensesInRange, expensesByCategory } = useMemo(() => {
        const expInRange = rawExpenses.filter(e => {
            if (!e.expense_date) return false;
            return e.expense_date >= dateFrom && e.expense_date <= dateTo;
        });
        const total = expInRange.reduce((acc, e) => acc + (e.amount || 0), 0);

        const catMap = new Map<string, number>();
        expInRange.forEach(e => {
            const cat = e.category || 'General';
            catMap.set(cat, (catMap.get(cat) || 0) + (e.amount || 0));
        });

        return { totalExpensesInRange: total, expensesByCategory: Array.from(catMap.entries()) };
    }, [rawExpenses, dateFrom, dateTo]);

    // Net Margin Estimation
    const netEstimatedProfit = useMemo(() => {
        // Approximate COGS at 65% of sales
        const estCOGS = rangeGrossRevenue * 0.65;
        const grossMargin = rangeGrossRevenue - estCOGS;
        const net = grossMargin - totalExpensesInRange;
        const marginPct = rangeGrossRevenue > 0 ? (net / rangeGrossRevenue) * 100 : 0;
        return { net, marginPct };
    }, [rangeGrossRevenue, totalExpensesInRange]);

    // Staff / Cashier Dispensing Breakdown
    const staffDispensingMetrics = useMemo(() => {
        const staffMap = new Map<string, { total: number; count: number }>();
        filteredSales.forEach(s => {
            const name = s.cashier_name || 'Primary Pharmacist';
            if (!staffMap.has(name)) staffMap.set(name, { total: 0, count: 0 });
            const curr = staffMap.get(name)!;
            curr.total += s.total || 0;
            curr.count += 1;
        });

        return Array.from(staffMap.entries())
            .map(([name, data]) => ({ name, ...data, avgTicket: data.count > 0 ? Math.round(data.total / data.count) : 0 }))
            .sort((a, b) => b.total - a.total);
    }, [filteredSales]);

    // ─────────────────────────────────────────────────────────────────────────
    // CHART CONFIGURATIONS
    // ─────────────────────────────────────────────────────────────────────────
    // Daily Revenue Spline Data
    const dailyTrendMap = useMemo(() => {
        const map = new Map<string, { date: string; total: number; cash: number; mpesa: number; credit: number }>();
        const start = new Date(dateFrom);
        const end = new Date(dateTo);

        // Fill all days in range
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const key = d.toISOString().split('T')[0];
            map.set(key, { date: key, total: 0, cash: 0, mpesa: 0, credit: 0 });
        }

        filteredSales.forEach(s => {
            if (!s.sale_datetime) return;
            const key = s.sale_datetime.split('T')[0];
            if (!map.has(key)) map.set(key, { date: key, total: 0, cash: 0, mpesa: 0, credit: 0 });
            const item = map.get(key)!;
            item.total += s.total || 0;
            const pm = (s.payment_method || '').toUpperCase();
            if (pm.includes('CASH')) item.cash += s.total || 0;
            else if (pm.includes('MPESA') || pm.includes('M-PESA') || pm.includes('MOBILE')) item.mpesa += s.total || 0;
            else item.credit += s.total || 0;
        });

        return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
    }, [filteredSales, dateFrom, dateTo]);

    const salesTrendLabels = useMemo(() => {
        return dailyTrendMap.map(d => {
            const dt = new Date(d.date);
            return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        });
    }, [dailyTrendMap]);

    const revenueSplineData = useMemo(() => ({
        labels: salesTrendLabels,
        datasets: [
            {
                label: 'Gross Sales (KSh)',
                data: dailyTrendMap.map(d => d.total),
                borderColor: '#0284c7', // vibrant sky blue
                backgroundColor: 'rgba(2, 132, 199, 0.08)',
                borderWidth: 2.5,
                tension: 0.35,
                fill: true,
                pointRadius: dailyTrendMap.length > 20 ? 0 : 3.5,
                pointHoverRadius: 6,
                pointBackgroundColor: '#0284c7',
            },
            {
                label: 'Cash Inflow (KSh)',
                data: dailyTrendMap.map(d => d.cash),
                borderColor: '#10b981',
                borderWidth: 1.8,
                tension: 0.35,
                fill: false,
                pointRadius: 0,
            },
            {
                label: 'M-Pesa Mobile (KSh)',
                data: dailyTrendMap.map(d => d.mpesa),
                borderColor: '#f59e0b',
                borderWidth: 1.8,
                tension: 0.35,
                fill: false,
                pointRadius: 0,
            },
        ],
    }), [salesTrendLabels, dailyTrendMap]);

    const revenueSplineOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top' as const,
                labels: {
                    boxWidth: 10,
                    usePointStyle: true,
                    font: { size: 11, weight: 600 as const, family: "'Inter', sans-serif" },
                    color: '#334155',
                },
            },
            tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                titleFont: { size: 12, weight: 'bold' as const, family: "'Inter', sans-serif" },
                bodyFont: { size: 11, family: "'Inter', sans-serif" },
                padding: 10,
                cornerRadius: 8,
                callbacks: {
                    label: (ctx: any) => ` ${ctx.dataset.label}: KSh ${(ctx.parsed.y || 0).toLocaleString()}`,
                },
            },
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { font: { size: 10, family: "'Inter', sans-serif" }, color: '#64748b' },
            },
            y: {
                grid: { color: 'rgba(226, 232, 240, 0.6)' },
                ticks: {
                    font: { size: 10, family: "'Inter', sans-serif" },
                    color: '#64748b',
                    callback: (v: any) => `KSh ${Number(v).toLocaleString()}`,
                },
            },
        },
    }), []);

    // Payment Donut Data
    const paymentDonutData = useMemo(() => ({
        labels: ['Cash', 'M-Pesa Mobile', 'Credit / Insured'],
        datasets: [{
            data: [
                paymentBreakdown.cash || 0.01,
                paymentBreakdown.mpesa || 0.01,
                paymentBreakdown.credit || 0.01,
            ],
            backgroundColor: ['#10b981', '#f59e0b', '#6366f1'],
            borderWidth: 0,
            cutout: '72%',
        }],
    }), [paymentBreakdown]);

    // Therapeutic Category Valuation Bar Data
    const categoryBarData = useMemo(() => {
        const catMap = new Map<string, number>();
        PHARMACY_MASTER_CATALOG.forEach(p => {
            const cat = p.category;
            catMap.set(cat, (catMap.get(cat) || 0) + (p.purchase_cost * 10)); // approximate batch holding
        });

        const sorted = Array.from(catMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 7);

        return {
            labels: sorted.map(s => s[0]),
            datasets: [{
                label: 'Stock Valuation (KSh)',
                data: sorted.map(s => s[1]),
                backgroundColor: ['#0284c7', '#0d9488', '#8b5cf6', '#f59e0b', '#ec4899', '#10b981', '#64748b'],
                borderRadius: 4,
                barPercentage: 0.6,
            }],
        };
    }, []);

    // Expiry Horizon Bar Data
    const expiryHorizonBarData = useMemo(() => ({
        labels: ['Expired (Quarantine)', 'Critical (≤30 Days)', 'Watchlist (31-90 Days)', 'Safe (>90 Days)'],
        datasets: [{
            label: 'Batch Count',
            data: [expiryMetrics.expired, expiryMetrics.exp30, expiryMetrics.exp90, expiryMetrics.safe],
            backgroundColor: ['#ef4444', '#f97316', '#eab308', '#22c55e'],
            borderRadius: 4,
            barPercentage: 0.55,
        }],
    }), [expiryMetrics]);

    // ─────────────────────────────────────────────────────────────────────────
    // QUICK ACTION HANDLERS (MODALS & DATABASE WRITES)
    // ─────────────────────────────────────────────────────────────────────────
    // Handle 1-Click Purchase Reorder Modal Submit
    const handleReorderSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reorderModalItem) return;
        setIsSubmittingModal(true);

        try {
            const purchaseNo = `PO-${Date.now().toString().slice(-6)}`;
            const subtotal = reorderForm.quantity * reorderForm.unit_cost;

            const { data, error } = await supabase
                .from('purchases')
                .insert([{
                    purchase_no: purchaseNo,
                    purchase_date: new Date().toISOString().split('T')[0],
                    supplier_id: reorderForm.supplier_id,
                    supplier_name: reorderForm.supplier_name,
                    sub_total: subtotal,
                    discount: 0,
                    vat: 0,
                    grand_total: subtotal,
                    status: 'Pending',
                    payment_status: 'Pending',
                    notes: `${reorderForm.notes} - Item: ${reorderModalItem.product_name} (${reorderForm.quantity} units)`,
                    created_by: 'Executive Pharmacy Dashboard',
                }])
                .select();

            if (error) throw error;

            toast.success(`Purchase Order ${purchaseNo} created successfully! (KSh ${subtotal.toLocaleString()})`, { duration: 4000 });
            setReorderModalItem(null);
            loadAllPharmacyData(true);
        } catch (err: any) {
            console.error('Reorder error:', err);
            toast.error('Failed to create purchase order: ' + (err.message || 'Database error'));
        } finally {
            setIsSubmittingModal(false);
        }
    };

    // Handle Batch Quarantine Status Update Submit
    const handleBatchStatusSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!batchQuarantineModal) return;
        setIsSubmittingModal(true);

        try {
            const { error } = await supabase
                .from('pharmacy_batches')
                .update({
                    status: batchStatusUpdate,
                    notes: batchAuditNotes ? `${batchQuarantineModal.notes || ''} | ${batchAuditNotes}` : batchQuarantineModal.notes,
                    updated_at: new Date().toISOString(),
                })
                .eq('batch_id', batchQuarantineModal.batch_id);

            if (error) throw error;

            toast.success(`Batch ${batchQuarantineModal.batch_number} status updated to ${batchStatusUpdate}!`);
            setBatchQuarantineModal(null);
            loadAllPharmacyData(true);
        } catch (err: any) {
            console.error('Batch status update error:', err);
            toast.error('Failed to update batch: ' + (err.message || 'Database error'));
        } finally {
            setIsSubmittingModal(false);
        }
    };

    // Handle Quick Expense Logger Submit
    const handleExpenseSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!expenseForm.expense_name || expenseForm.amount <= 0) {
            toast.error('Please enter a valid expense name and amount.');
            return;
        }
        setIsSubmittingModal(true);

        try {
            const { error } = await supabase
                .from('expenses')
                .insert([{
                    expense_name: expenseForm.expense_name,
                    expense_type: expenseForm.category,
                    category: expenseForm.category,
                    payment_mode: expenseForm.payment_mode,
                    amount: Number(expenseForm.amount),
                    expense_date: expenseForm.expense_date,
                    description: expenseForm.description || 'Logged via Pharmacy Dashboard',
                    created_by: 'Super Administrator',
                }]);

            if (error) throw error;

            toast.success(`Expense "${expenseForm.expense_name}" (KSh ${expenseForm.amount}) recorded!`);
            setIsExpenseModalOpen(false);
            setExpenseForm({
                expense_name: '',
                category: 'Utilities',
                payment_mode: 'Cash',
                amount: 500,
                expense_date: new Date().toISOString().split('T')[0],
                description: '',
            });
            loadAllPharmacyData(true);
        } catch (err: any) {
            console.error('Expense record error:', err);
            toast.error('Failed to log expense: ' + (err.message || 'Database error'));
        } finally {
            setIsSubmittingModal(false);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // EXPORT TO EXCEL (SPREADSHEETML XML)
    // ─────────────────────────────────────────────────────────────────────────
    const exportComprehensiveExcel = () => {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#0F172A" ss:Pattern="Solid"/></Style>
  <Style ss:ID="Danger"><Font ss:Bold="1" ss:Color="#991B1B"/><Interior ss:Color="#FEE2E2" ss:Pattern="Solid"/></Style>
  <Style ss:ID="Warning"><Font ss:Bold="1" ss:Color="#92400E"/><Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/></Style>
  <Style ss:ID="Success"><Font ss:Bold="1" ss:Color="#065F46"/><Interior ss:Color="#D1FAE5" ss:Pattern="Solid"/></Style>
  <Style ss:ID="Num"><NumberFormat ss:Format="#,##0"/></Style>
  <Style ss:ID="Bold"><Font ss:Bold="1"/></Style>
 </Styles>

 <Worksheet ss:Name="Executive Summary">
  <Table>
   <Row><Cell ss:StyleID="Bold"><Data ss:Type="String">PHARMACY ENTERPRISE EXECUTIVE SUMMARY</Data></Cell></Row>
   <Row><Cell><Data ss:Type="String">Generated: ${new Date().toLocaleString()}</Data></Cell></Row>
   <Row><Cell><Data ss:Type="String">Reporting Period: ${dateFrom} to ${dateTo}</Data></Cell></Row>
   <Row/>
   <Row><Cell ss:StyleID="Header"><Data ss:Type="String">Executive Metric</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Value</Data></Cell></Row>
   <Row><Cell><Data ss:Type="String">Period Gross Revenue</Data></Cell><Cell ss:StyleID="Num"><Data ss:Type="Number">${rangeGrossRevenue}</Data></Cell></Row>
   <Row><Cell><Data ss:Type="String">Today Gross Sales</Data></Cell><Cell ss:StyleID="Num"><Data ss:Type="Number">${todayGrossRevenue}</Data></Cell></Row>
   <Row><Cell><Data ss:Type="String">Cash Inflow</Data></Cell><Cell ss:StyleID="Num"><Data ss:Type="Number">${paymentBreakdown.cash}</Data></Cell></Row>
   <Row><Cell><Data ss:Type="String">M-Pesa Mobile Inflow</Data></Cell><Cell ss:StyleID="Num"><Data ss:Type="Number">${paymentBreakdown.mpesa}</Data></Cell></Row>
   <Row><Cell><Data ss:Type="String">Total Inventory Asset Value (Retail)</Data></Cell><Cell ss:StyleID="Num"><Data ss:Type="Number">${totalStockValuationRetail}</Data></Cell></Row>
   <Row><Cell><Data ss:Type="String">Total Stock Deficit Replenishment Cost</Data></Cell><Cell ss:StyleID="Num"><Data ss:Type="Number">${totalReplenishmentCost}</Data></Cell></Row>
   <Row><Cell><Data ss:Type="String">Batch Expiry Liability (At-Risk)</Data></Cell><Cell ss:StyleID="Num"><Data ss:Type="Number">${expiryMetrics.atRiskValue}</Data></Cell></Row>
   <Row><Cell><Data ss:Type="String">Supplier Outstanding Payables</Data></Cell><Cell ss:StyleID="Num"><Data ss:Type="Number">${totalSupplierDebt}</Data></Cell></Row>
   <Row><Cell><Data ss:Type="String">Operating Expenses</Data></Cell><Cell ss:StyleID="Num"><Data ss:Type="Number">${totalExpensesInRange}</Data></Cell></Row>
   <Row><Cell><Data ss:Type="String">Estimated Net Margin</Data></Cell><Cell ss:StyleID="Num"><Data ss:Type="Number">${netEstimatedProfit.net}</Data></Cell></Row>
  </Table>
 </Worksheet>

 <Worksheet ss:Name="Critical Stock Deficits">
  <Table>
   <Row>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Code</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Medication</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Category</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">On Hand</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Par Level</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Deficit</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Suggested Order</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Unit Cost (KSh)</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Restock Cost (KSh)</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Preferred Supplier</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Urgency</Data></Cell>
   </Row>
   ${stockDeficits.map(d => `
   <Row>
    <Cell><Data ss:Type="String">${d.product_code}</Data></Cell>
    <Cell><Data ss:Type="String">${d.product_name}</Data></Cell>
    <Cell><Data ss:Type="String">${d.category}</Data></Cell>
    <Cell ss:StyleID="Num"><Data ss:Type="Number">${d.current_stock}</Data></Cell>
    <Cell ss:StyleID="Num"><Data ss:Type="Number">${d.reorder_point}</Data></Cell>
    <Cell ss:StyleID="Num"><Data ss:Type="Number">${d.deficit}</Data></Cell>
    <Cell ss:StyleID="Num"><Data ss:Type="Number">${d.suggested_order}</Data></Cell>
    <Cell ss:StyleID="Num"><Data ss:Type="Number">${d.unit_cost}</Data></Cell>
    <Cell ss:StyleID="Num"><Data ss:Type="Number">${d.reorder_cost}</Data></Cell>
    <Cell><Data ss:Type="String">${d.preferred_supplier}</Data></Cell>
    <Cell ss:StyleID="${d.status === 'OUT_OF_STOCK' ? 'Danger' : d.status === 'CRITICAL' ? 'Warning' : 'Bold'}"><Data ss:Type="String">${d.status}</Data></Cell>
   </Row>`).join('')}
  </Table>
 </Worksheet>

 <Worksheet ss:Name="Live Sales Ledger">
  <Table>
   <Row>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Receipt No</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Date &amp; Time</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Cashier / Pharmacist</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Customer</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Payment Method</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Grand Total (KSh)</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Status</Data></Cell>
   </Row>
   ${filteredSales.map(s => `
   <Row>
    <Cell><Data ss:Type="String">${s.receipt_no}</Data></Cell>
    <Cell><Data ss:Type="String">${s.sale_datetime ? s.sale_datetime.replace('T', ' ').slice(0, 19) : ''}</Data></Cell>
    <Cell><Data ss:Type="String">${s.cashier_name || 'Pharmacist'}</Data></Cell>
    <Cell><Data ss:Type="String">${s.customer_name || 'Walk-in'}</Data></Cell>
    <Cell><Data ss:Type="String">${s.payment_method}</Data></Cell>
    <Cell ss:StyleID="Num"><Data ss:Type="Number">${s.total || 0}</Data></Cell>
    <Cell><Data ss:Type="String">${s.status}</Data></Cell>
   </Row>`).join('')}
  </Table>
 </Worksheet>
</Workbook>`;

        const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Pharmacy_Executive_Dashboard_${timestamp}.xls`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('SpreadsheetML Excel Report downloaded!');
    };

    // Helper Formatters
    const fmt = (n: number) => {
        if (!n) return '0';
        if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
        if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
        return n.toLocaleString();
    };

    // Filtered items in DataGrid
    const filteredGridSales = useMemo(() => {
        if (!gridSearchQuery.trim()) return filteredSales;
        const q = gridSearchQuery.toLowerCase();
        return filteredSales.filter(s =>
            (s.receipt_no || '').toLowerCase().includes(q) ||
            (s.cashier_name || '').toLowerCase().includes(q) ||
            (s.customer_name || '').toLowerCase().includes(q) ||
            (s.payment_method || '').toLowerCase().includes(q)
        );
    }, [filteredSales, gridSearchQuery]);

    const filteredGridDeficits = useMemo(() => {
        if (!gridSearchQuery.trim()) return stockDeficits;
        const q = gridSearchQuery.toLowerCase();
        return stockDeficits.filter(d =>
            d.product_name.toLowerCase().includes(q) ||
            d.generic_name.toLowerCase().includes(q) ||
            d.category.toLowerCase().includes(q) ||
            d.preferred_supplier.toLowerCase().includes(q)
        );
    }, [stockDeficits, gridSearchQuery]);

    const filteredGridBatches = useMemo(() => {
        if (!gridSearchQuery.trim()) return rawBatches;
        const q = gridSearchQuery.toLowerCase();
        return rawBatches.filter(b =>
            (b.batch_number || '').toLowerCase().includes(q) ||
            (b.supplier_name || '').toLowerCase().includes(q) ||
            (b.status || '').toLowerCase().includes(q)
        );
    }, [rawBatches, gridSearchQuery]);

    const filteredGridPurchases = useMemo(() => {
        if (!gridSearchQuery.trim()) return rawPurchases;
        const q = gridSearchQuery.toLowerCase();
        return rawPurchases.filter(p =>
            (p.purchase_no || '').toLowerCase().includes(q) ||
            (p.supplier_name || '').toLowerCase().includes(q) ||
            (p.status || '').toLowerCase().includes(q)
        );
    }, [rawPurchases, gridSearchQuery]);

    const filteredGridExpenses = useMemo(() => {
        if (!gridSearchQuery.trim()) return rawExpenses;
        const q = gridSearchQuery.toLowerCase();
        return rawExpenses.filter(e =>
            (e.expense_name || '').toLowerCase().includes(q) ||
            (e.category || '').toLowerCase().includes(q) ||
            (e.payment_mode || '').toLowerCase().includes(q)
        );
    }, [rawExpenses, gridSearchQuery]);

    return (
        <div className="space-y-4 pb-12 text-slate-800" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
            <Toaster position="top-right" />

            {/* ═════════════════════════════════════════════════════════════════
                TOP COMMAND BAR & CONTROLS
            ═════════════════════════════════════════════════════════════════ */}
            <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-200 shrink-0">
                        <FiActivity className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-base font-extrabold text-slate-900 tracking-tight">
                                Pharmacy Executive Command Hub
                            </h1>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Live DB Synced
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                            Real-time dispensary telemetry, clinical batch expiry surveillance, stockout prevention &amp; fiscal reconciliation
                        </p>
                    </div>
                </div>

                {/* Right Action Tools */}
                <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end">
                    {/* Auto-Refresh Ticker */}
                    <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs">
                        <FiClock className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-[11px] font-semibold text-slate-600">Auto:</span>
                        <select
                            value={autoRefreshInterval}
                            onChange={e => setAutoRefreshInterval(Number(e.target.value))}
                            className="bg-transparent text-[11px] font-bold text-slate-800 focus:outline-none cursor-pointer"
                        >
                            <option value={0}>Manual</option>
                            <option value={30}>30s</option>
                            <option value={60}>60s</option>
                            <option value={300}>5m</option>
                        </select>
                        {autoRefreshInterval > 0 && (
                            <span className="text-[10px] font-mono text-emerald-600 ml-1">({secondsToNextRefresh}s)</span>
                        )}
                    </div>

                    {/* Manual Refresh */}
                    <button
                        onClick={() => loadAllPharmacyData(false)}
                        disabled={isLoading || isRefreshing}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                        title="Reload live database data"
                    >
                        <FiRefreshCw className={`w-3.5 h-3.5 ${isLoading || isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
                        <span>{isRefreshing ? 'Syncing...' : 'Sync DB'}</span>
                    </button>

                    {/* Quick Expense Trigger */}
                    <button
                        onClick={() => setIsExpenseModalOpen(true)}
                        className="px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                    >
                        <FiPlusCircle className="w-3.5 h-3.5" />
                        <span>Log Expense</span>
                    </button>

                    {/* Print Dossier */}
                    <button
                        onClick={() => window.print()}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                        title="Print Executive Dossier"
                    >
                        <FiPrinter className="w-3.5 h-3.5" />
                        <span>Print</span>
                    </button>

                    {/* Excel XML Export */}
                    <button
                        onClick={exportComprehensiveExcel}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-emerald-200 transition-all"
                    >
                        <FiDownload className="w-3.5 h-3.5" />
                        <span>Excel Report</span>
                    </button>
                </div>
            </div>

            {/* ═════════════════════════════════════════════════════════════════
                DATE PRESETS & RANGE SELECTOR
            ═════════════════════════════════════════════════════════════════ */}
            <div className="bg-white border border-slate-200/80 rounded-xl p-2.5 shadow-sm flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[11px] font-bold uppercase text-slate-400 mr-1 flex items-center gap-1">
                        <FiCalendar className="w-3 h-3" /> Horizon:
                    </span>
                    {[
                        { id: '1d', label: 'Today (1D)' },
                        { id: 'yesterday', label: 'Yesterday' },
                        { id: '7d', label: 'Last 7 Days' },
                        { id: '14d', label: '14 Days' },
                        { id: '30d', label: '30 Days' },
                        { id: 'mtd', label: 'This Month' },
                        { id: 'qtd', label: 'Quarter' },
                        { id: 'all', label: 'All-Time' },
                    ].map(p => (
                        <button
                            key={p.id}
                            onClick={() => applyDatePreset(p.id)}
                            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                                datePreset === p.id
                                    ? 'bg-slate-900 text-white shadow-sm'
                                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-1.5 text-xs">
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={e => { setDateFrom(e.target.value); setDatePreset('custom'); }}
                        className="px-2 py-1 border border-slate-200 rounded-md text-xs bg-slate-50 font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                    <span className="text-slate-400 font-bold">→</span>
                    <input
                        type="date"
                        value={dateTo}
                        onChange={e => { setDateTo(e.target.value); setDatePreset('custom'); }}
                        className="px-2 py-1 border border-slate-200 rounded-md text-xs bg-slate-50 font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                    {lastSyncTime && (
                        <span className="text-[10px] text-slate-400 ml-2 hidden sm:inline">
                            Synced at {lastSyncTime}
                        </span>
                    )}
                </div>
            </div>

            {/* ═════════════════════════════════════════════════════════════════
                FUNCTION & MODULE SUPER-FILTERS (INTELLIGENT TAB HUB)
            ═════════════════════════════════════════════════════════════════ */}
            <div className="bg-slate-900 rounded-xl p-1.5 text-white shadow-sm flex items-center gap-1 overflow-x-auto">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 shrink-0">
                    Module Lens:
                </span>
                {[
                    { id: 'all', label: '🌐 Enterprise 360°', badge: `${rawSales.length} Tx` },
                    { id: 'dispensing', label: '💊 Dispensing & Sales', badge: `KSh ${fmt(rangeGrossRevenue)}` },
                    { id: 'inventory', label: '📦 Stockouts & Par Deficits', badge: `${stockDeficits.length} At-Risk`, highlight: stockDeficits.length > 0 },
                    { id: 'expiry', label: '⏰ Batch Expiry Radar', badge: `${expiryMetrics.expired + expiryMetrics.exp30} Alert`, highlight: (expiryMetrics.expired + expiryMetrics.exp30) > 0 },
                    { id: 'procurement', label: '🛒 Procurement & Payables', badge: `${pendingPurchasesCount} Pending` },
                    { id: 'financials', label: '💰 Fiscal Health & Cash Flow', badge: `${netEstimatedProfit.marginPct.toFixed(0)}% Margin` },
                    { id: 'staff', label: '👨‍⚕️ Pharmacist Performance', badge: `${staffDispensingMetrics.length} Staff` },
                    { id: 'audit', label: '⚡ Executive Risk & Audit', badge: 'Live Radar' },
                ].map(m => (
                    <button
                        key={m.id}
                        onClick={() => setActiveModule(m.id as ModuleFilter)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                            activeModule === m.id
                                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-900/40'
                                : 'text-slate-300 hover:text-white hover:bg-slate-800'
                        }`}
                    >
                        <span>{m.label}</span>
                        {m.badge && (
                            <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-extrabold ${
                                m.highlight
                                    ? 'bg-rose-500 text-white animate-pulse'
                                    : activeModule === m.id ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-slate-300'
                            }`}>
                                {m.badge}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* ═════════════════════════════════════════════════════════════════
                8 EXECUTIVE COMMAND KPI TILES (COMPACT, SLEEK, GLOWING)
            ═════════════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2.5">
                {/* 1. Today's Dispensed Gross Sales */}
                <div className="bg-white border border-slate-200/80 rounded-xl p-2.5 shadow-sm relative overflow-hidden flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Today Sales</span>
                        <span className="p-1 rounded-md bg-emerald-50 text-emerald-600"><FiTrendingUp className="w-3.5 h-3.5" /></span>
                    </div>
                    <div className="mt-1">
                        <p className="text-base font-extrabold text-slate-900 leading-tight">
                            KSh {fmt(todayGrossRevenue)}
                        </p>
                        <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                            {todaySalesList.length} prescriptions
                        </p>
                    </div>
                    <div className="mt-1.5 pt-1 border-t border-slate-100 flex items-center justify-between text-[10px]">
                        <span className="text-slate-400">Range:</span>
                        <span className="font-bold text-slate-700">KSh {fmt(rangeGrossRevenue)}</span>
                    </div>
                </div>

                {/* 2. Liquid Cash Inflow */}
                <div className="bg-white border border-slate-200/80 rounded-xl p-2.5 shadow-sm relative overflow-hidden flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Cash In Drawer</span>
                        <span className="p-1 rounded-md bg-teal-50 text-teal-600"><FiDollarSign className="w-3.5 h-3.5" /></span>
                    </div>
                    <div className="mt-1">
                        <p className="text-base font-extrabold text-slate-900 leading-tight">
                            KSh {fmt(paymentBreakdown.cash)}
                        </p>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                            <div
                                className="bg-teal-500 h-full rounded-full"
                                style={{ width: `${paymentBreakdown.total > 0 ? (paymentBreakdown.cash / paymentBreakdown.total) * 100 : 0}%` }}
                            />
                        </div>
                    </div>
                    <div className="mt-1.5 pt-1 border-t border-slate-100 flex items-center justify-between text-[10px]">
                        <span className="text-slate-400">Share:</span>
                        <span className="font-bold text-teal-700">
                            {paymentBreakdown.total > 0 ? ((paymentBreakdown.cash / paymentBreakdown.total) * 100).toFixed(0) : 0}%
                        </span>
                    </div>
                </div>

                {/* 3. M-Pesa Mobile Inflow */}
                <div className="bg-white border border-slate-200/80 rounded-xl p-2.5 shadow-sm relative overflow-hidden flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">M-Pesa Flow</span>
                        <span className="p-1 rounded-md bg-amber-50 text-amber-600"><FiCreditCard className="w-3.5 h-3.5" /></span>
                    </div>
                    <div className="mt-1">
                        <p className="text-base font-extrabold text-slate-900 leading-tight">
                            KSh {fmt(paymentBreakdown.mpesa)}
                        </p>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                            <div
                                className="bg-amber-500 h-full rounded-full"
                                style={{ width: `${paymentBreakdown.total > 0 ? (paymentBreakdown.mpesa / paymentBreakdown.total) * 100 : 0}%` }}
                            />
                        </div>
                    </div>
                    <div className="mt-1.5 pt-1 border-t border-slate-100 flex items-center justify-between text-[10px]">
                        <span className="text-slate-400">Share:</span>
                        <span className="font-bold text-amber-700">
                            {paymentBreakdown.total > 0 ? ((paymentBreakdown.mpesa / paymentBreakdown.total) * 100).toFixed(0) : 0}%
                        </span>
                    </div>
                </div>

                {/* 4. Total Stock Asset Valuation */}
                <div className="bg-white border border-slate-200/80 rounded-xl p-2.5 shadow-sm relative overflow-hidden flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Stock Valuation</span>
                        <span className="p-1 rounded-md bg-sky-50 text-sky-600"><FiBox className="w-3.5 h-3.5" /></span>
                    </div>
                    <div className="mt-1">
                        <p className="text-base font-extrabold text-slate-900 leading-tight">
                            KSh {fmt(totalStockValuationRetail)}
                        </p>
                        <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                            Cost: KSh {fmt(totalStockValuationCost)}
                        </p>
                    </div>
                    <div className="mt-1.5 pt-1 border-t border-slate-100 flex items-center justify-between text-[10px]">
                        <span className="text-slate-400">Batches:</span>
                        <span className="font-bold text-sky-700">{rawBatches.length} Lots</span>
                    </div>
                </div>

                {/* 5. Stockouts & Deficits */}
                <div className={`border rounded-xl p-2.5 shadow-sm relative overflow-hidden flex flex-col justify-between ${
                    outOfStockCount > 0 ? 'bg-rose-50/40 border-rose-200' : 'bg-white border-slate-200/80'
                }`}>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Stockouts (0u)</span>
                        <span className="p-1 rounded-md bg-rose-100 text-rose-700"><FiAlertTriangle className="w-3.5 h-3.5" /></span>
                    </div>
                    <div className="mt-1">
                        <p className="text-base font-extrabold text-rose-900 leading-tight">
                            {outOfStockCount} Items
                        </p>
                        <p className="text-[10px] text-rose-600 font-semibold mt-0.5">
                            +{criticalCount} Critical
                        </p>
                    </div>
                    <div className="mt-1.5 pt-1 border-t border-rose-100 flex items-center justify-between text-[10px]">
                        <span className="text-rose-600">Restock:</span>
                        <span className="font-bold text-rose-800">KSh {fmt(totalReplenishmentCost)}</span>
                    </div>
                </div>

                {/* 6. Expiry Liability Radar */}
                <div className={`border rounded-xl p-2.5 shadow-sm relative overflow-hidden flex flex-col justify-between ${
                    expiryMetrics.expired > 0 ? 'bg-amber-50/40 border-amber-200' : 'bg-white border-slate-200/80'
                }`}>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Expiry Risk</span>
                        <span className="p-1 rounded-md bg-amber-100 text-amber-700"><FiClock className="w-3.5 h-3.5" /></span>
                    </div>
                    <div className="mt-1">
                        <p className="text-base font-extrabold text-amber-900 leading-tight">
                            {expiryMetrics.expired} Expired
                        </p>
                        <p className="text-[10px] text-amber-700 font-semibold mt-0.5">
                            {expiryMetrics.exp30} within 30d
                        </p>
                    </div>
                    <div className="mt-1.5 pt-1 border-t border-amber-100 flex items-center justify-between text-[10px]">
                        <span className="text-amber-600">Liability:</span>
                        <span className="font-bold text-amber-800">KSh {fmt(expiryMetrics.atRiskValue)}</span>
                    </div>
                </div>

                {/* 7. Procurement & Supplier Debt */}
                <div className="bg-white border border-slate-200/80 rounded-xl p-2.5 shadow-sm relative overflow-hidden flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Supplier Debt</span>
                        <span className="p-1 rounded-md bg-indigo-50 text-indigo-600"><FiTruck className="w-3.5 h-3.5" /></span>
                    </div>
                    <div className="mt-1">
                        <p className="text-base font-extrabold text-slate-900 leading-tight">
                            KSh {fmt(totalSupplierDebt)}
                        </p>
                        <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                            {pendingPurchasesCount} Pending POs
                        </p>
                    </div>
                    <div className="mt-1.5 pt-1 border-t border-slate-100 flex items-center justify-between text-[10px]">
                        <span className="text-slate-400">Purchases:</span>
                        <span className="font-bold text-indigo-700">KSh {fmt(totalPurchasesInRange)}</span>
                    </div>
                </div>

                {/* 8. Operating Profit Margin */}
                <div className="bg-white border border-slate-200/80 rounded-xl p-2.5 shadow-sm relative overflow-hidden flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Net Margin</span>
                        <span className="p-1 rounded-md bg-purple-50 text-purple-600"><FiPercent className="w-3.5 h-3.5" /></span>
                    </div>
                    <div className="mt-1">
                        <p className="text-base font-extrabold text-slate-900 leading-tight">
                            {netEstimatedProfit.marginPct.toFixed(1)}%
                        </p>
                        <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                            Net: KSh {fmt(netEstimatedProfit.net)}
                        </p>
                    </div>
                    <div className="mt-1.5 pt-1 border-t border-slate-100 flex items-center justify-between text-[10px]">
                        <span className="text-slate-400">Expenses:</span>
                        <span className="font-bold text-purple-700">KSh {fmt(totalExpensesInRange)}</span>
                    </div>
                </div>
            </div>

            {/* ═════════════════════════════════════════════════════════════════
                AI PHARMACY OPERATIONAL INTELLIGENCE & ADVISORY ENGINE
            ═════════════════════════════════════════════════════════════════ */}
            {(activeModule === 'all' || activeModule === 'audit' || activeModule === 'inventory' || activeModule === 'expiry') && (
                <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-xl p-3 text-white shadow-sm border border-slate-700/60">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-700/80">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                            <h3 className="text-xs font-bold tracking-wide uppercase text-slate-200 flex items-center gap-1.5">
                                <FiShield className="w-3.5 h-3.5 text-emerald-400" />
                                Automated Pharmacy Clinical &amp; Inventory Advisory Engine
                            </h3>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">
                            {stockDeficits.length + (expiryMetrics.expired > 0 ? 1 : 0) + (totalSupplierDebt > 0 ? 1 : 0)} Active Signals
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 mt-2.5">
                        {/* Advisory 1: Expiry Quarantine */}
                        <div className="bg-slate-800/80 border border-slate-700/70 rounded-lg p-2.5 flex items-start gap-2.5">
                            <div className="p-1.5 rounded-md bg-rose-500/20 text-rose-400 shrink-0">
                                <FiAlertTriangle className="w-4 h-4" />
                            </div>
                            <div className="text-xs">
                                <p className="font-bold text-slate-200">Batch Expiry Quarantine Protocol</p>
                                <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                                    {expiryMetrics.expired > 0
                                        ? `${expiryMetrics.expired} expired batches requiring immediate quarantine to prevent dispensing liability.`
                                        : `${expiryMetrics.exp30} batches expiring in ≤30 days. Recommend applying discount tags.`}
                                </p>
                                <button
                                    onClick={() => { setActiveGridTab('expiry'); setActiveModule('expiry'); }}
                                    className="text-[10px] font-bold text-rose-400 hover:text-rose-300 mt-1.5 flex items-center gap-1"
                                >
                                    Review Batches →
                                </button>
                            </div>
                        </div>

                        {/* Advisory 2: Fast-Moving Stockouts */}
                        <div className="bg-slate-800/80 border border-slate-700/70 rounded-lg p-2.5 flex items-start gap-2.5">
                            <div className="p-1.5 rounded-md bg-amber-500/20 text-amber-400 shrink-0">
                                <FiShoppingBag className="w-4 h-4" />
                            </div>
                            <div className="text-xs">
                                <p className="font-bold text-slate-200">Chronic Formulary Depletion Risk</p>
                                <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                                    {stockDeficits.length > 0
                                        ? `${stockDeficits.slice(0, 3).map(d => d.product_name).join(', ')} are below safety par. Estimated restocking capital KSh ${fmt(totalReplenishmentCost)}.`
                                        : 'All key medications are stocked above safety buffer levels.'}
                                </p>
                                {stockDeficits.length > 0 && (
                                    <button
                                        onClick={() => {
                                            setReorderModalItem(stockDeficits[0]);
                                            setReorderForm(prev => ({
                                                ...prev,
                                                quantity: stockDeficits[0].suggested_order,
                                                unit_cost: stockDeficits[0].unit_cost,
                                                supplier_name: stockDeficits[0].preferred_supplier,
                                            }));
                                        }}
                                        className="text-[10px] font-bold text-amber-400 hover:text-amber-300 mt-1.5 flex items-center gap-1"
                                    >
                                        Auto-Reorder Top Item ({stockDeficits[0].product_name}) →
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Advisory 3: Cash & Drawer Balance */}
                        <div className="bg-slate-800/80 border border-slate-700/70 rounded-lg p-2.5 flex items-start gap-2.5">
                            <div className="p-1.5 rounded-md bg-emerald-500/20 text-emerald-400 shrink-0">
                                <FiCheckCircle className="w-4 h-4" />
                            </div>
                            <div className="text-xs">
                                <p className="font-bold text-slate-200">Dispensary Cash Flow &amp; Drawer Health</p>
                                <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                                    Cash collections (KSh {fmt(paymentBreakdown.cash)}) and M-Pesa flows (KSh {fmt(paymentBreakdown.mpesa)})
                                    are tracking normally. Current net operating margin estimated at {netEstimatedProfit.marginPct.toFixed(1)}%.
                                </p>
                                <button
                                    onClick={() => { setActiveGridTab('shifts'); setActiveModule('financials'); }}
                                    className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 mt-1.5 flex items-center gap-1"
                                >
                                    Inspect Shift Reconciliations →
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═════════════════════════════════════════════════════════════════
                VISUAL ANALYTICS & CHARTS
            ═════════════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                {/* 1. Multi-Stream Dispensing Revenue Spline */}
                <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-xl p-3 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-md bg-sky-50 text-sky-600 flex items-center justify-center text-xs font-bold">
                                📈
                            </span>
                            <div>
                                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                                    Dispensing Velocity &amp; Revenue Trend
                                </h3>
                                <p className="text-[10px] text-slate-400">Total: KSh {rangeGrossRevenue.toLocaleString()} across selected horizon</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-600" /> Gross</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Cash</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> M-Pesa</span>
                        </div>
                    </div>
                    <div style={{ height: '240px' }}>
                        <Line data={revenueSplineData} options={revenueSplineOptions} />
                    </div>
                </div>

                {/* 2. Payment Settlement Split Cutout Donut */}
                <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs font-bold">
                                💳
                            </span>
                            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                                Settlement Split
                            </h3>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400">
                            Total: KSh {fmt(paymentBreakdown.total)}
                        </span>
                    </div>

                    <div style={{ height: '150px' }} className="relative flex items-center justify-center">
                        <Doughnut
                            data={paymentDonutData}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: { legend: { display: false } },
                            }}
                        />
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <p className="text-xs font-extrabold text-slate-900 leading-none">
                                KSh {fmt(paymentBreakdown.total)}
                            </p>
                            <p className="text-[9px] text-slate-400 uppercase font-bold mt-0.5">Settled</p>
                        </div>
                    </div>

                    <div className="mt-2 space-y-1 pt-2 border-t border-slate-100 text-xs">
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="flex items-center gap-1 text-slate-600">
                                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Cash Collections:
                            </span>
                            <span className="font-bold text-slate-800">
                                KSh {paymentBreakdown.cash.toLocaleString()}{' '}
                                <span className="text-[9px] text-slate-400">
                                    ({paymentBreakdown.total > 0 ? ((paymentBreakdown.cash / paymentBreakdown.total) * 100).toFixed(0) : 0}%)
                                </span>
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="flex items-center gap-1 text-slate-600">
                                <span className="w-2 h-2 rounded-full bg-amber-500" /> M-Pesa Mobile:
                            </span>
                            <span className="font-bold text-slate-800">
                                KSh {paymentBreakdown.mpesa.toLocaleString()}{' '}
                                <span className="text-[9px] text-slate-400">
                                    ({paymentBreakdown.total > 0 ? ((paymentBreakdown.mpesa / paymentBreakdown.total) * 100).toFixed(0) : 0}%)
                                </span>
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="flex items-center gap-1 text-slate-600">
                                <span className="w-2 h-2 rounded-full bg-indigo-500" /> Credit / Insured:
                            </span>
                            <span className="font-bold text-slate-800">
                                KSh {paymentBreakdown.credit.toLocaleString()}{' '}
                                <span className="text-[9px] text-slate-400">
                                    ({paymentBreakdown.total > 0 ? ((paymentBreakdown.credit / paymentBreakdown.total) * 100).toFixed(0) : 0}%)
                                </span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═════════════════════════════════════════════════════════════════
                SECONDARY CHARTS ROW: CATEGORY ALLOCATION & EXPIRY HORIZON
            ═════════════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Therapeutic Category Valuation */}
                <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-md bg-purple-50 text-purple-600 flex items-center justify-center text-xs font-bold">
                                💊
                            </span>
                            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                                Stock Capital by Therapeutic Category
                            </h3>
                        </div>
                        <span className="text-[10px] text-slate-400 font-semibold">Top 7 Classes</span>
                    </div>
                    <div style={{ height: '180px' }}>
                        <Bar
                            data={categoryBarData}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: { legend: { display: false } },
                                scales: {
                                    x: { grid: { display: false }, ticks: { font: { size: 9, family: "'Inter', sans-serif" } } },
                                    y: {
                                        grid: { color: 'rgba(226, 232, 240, 0.5)' },
                                        ticks: { font: { size: 9 }, callback: (v: any) => `KSh ${fmt(Number(v))}` },
                                    },
                                },
                            }}
                        />
                    </div>
                </div>

                {/* Batch Expiry Horizon */}
                <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center text-xs font-bold">
                                ⏰
                            </span>
                            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                                Batch Expiry Surveillance Horizon
                            </h3>
                        </div>
                        <span className="text-[10px] text-slate-400 font-semibold">{rawBatches.length} Total Lots</span>
                    </div>
                    <div style={{ height: '180px' }}>
                        <Bar
                            data={expiryHorizonBarData}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: { legend: { display: false } },
                                scales: {
                                    x: { grid: { display: false }, ticks: { font: { size: 9, family: "'Inter', sans-serif" } } },
                                    y: { grid: { color: 'rgba(226, 232, 240, 0.5)' }, ticks: { font: { size: 9 } } },
                                },
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* ═════════════════════════════════════════════════════════════════
                MASSIVE INTERACTIVE MULTI-TAB DATAGRID
            ═════════════════════════════════════════════════════════════════ */}
            <div className="bg-white border border-slate-200/80 rounded-xl shadow-sm overflow-hidden">
                {/* DataGrid Header & Navigation */}
                <div className="p-3 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
                    {/* Tab Switchers */}
                    <div className="flex items-center gap-1 overflow-x-auto">
                        {[
                            { id: 'sales', label: 'Dispensing Sales', count: filteredSales.length, icon: '💊' },
                            { id: 'deficits', label: 'Stock Deficits & Reorders', count: stockDeficits.length, icon: '⚠️', alert: stockDeficits.length > 0 },
                            { id: 'expiry', label: 'Expiry Quarantine', count: rawBatches.length, icon: '⏰', alert: (expiryMetrics.expired + expiryMetrics.exp30) > 0 },
                            { id: 'purchases', label: 'Procurement POs', count: rawPurchases.length, icon: '🛒' },
                            { id: 'expenses', label: 'Operating Expenses', count: rawExpenses.length, icon: '💸' },
                            { id: 'shifts', label: 'Shift Drawer Cash', count: rawShifts.length, icon: '🔄' },
                        ].map(t => (
                            <button
                                key={t.id}
                                onClick={() => setActiveGridTab(t.id as any)}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                                    activeGridTab === t.id
                                        ? 'bg-slate-900 text-white shadow-sm'
                                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/70'
                                }`}
                            >
                                <span>{t.icon}</span>
                                <span>{t.label}</span>
                                <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-extrabold ${
                                    t.alert
                                        ? 'bg-rose-500 text-white animate-pulse'
                                        : activeGridTab === t.id ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'
                                }`}>
                                    {t.count}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Filter & View Mode Controls */}
                    <div className="flex items-center gap-2">
                        {/* Omni Search */}
                        <div className="relative">
                            <FiSearch className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                                type="text"
                                placeholder={`Filter ${activeGridTab}...`}
                                value={gridSearchQuery}
                                onChange={e => setGridSearchQuery(e.target.value)}
                                className="pl-8 pr-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white w-40 sm:w-56 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                        </div>

                        {/* Density / Width Toggle */}
                        <button
                            onClick={() => setTableDisplayMode(tableDisplayMode === 'fit' ? 'expand' : 'fit')}
                            className="px-2 py-1 border border-slate-200 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1"
                            title="Toggle Full Width or Screen Fit"
                        >
                            {tableDisplayMode === 'fit' ? <FiMaximize2 className="w-3.5 h-3.5" /> : <FiMinimize2 className="w-3.5 h-3.5" />}
                            <span className="hidden sm:inline">{tableDisplayMode === 'fit' ? 'Expand' : 'Fit'}</span>
                        </button>
                    </div>
                </div>

                {/* Table Rendering */}
                <div className={`overflow-x-auto ${tableDisplayMode === 'expand' ? 'min-w-[1200px]' : 'w-full'}`}>
                    {/* TAB 1: DISPENSING SALES */}
                    {activeGridTab === 'sales' && (
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-600 tracking-wider">
                                    <th className="py-2 px-2.5">Receipt #</th>
                                    <th className="py-2 px-2.5">Date &amp; Time</th>
                                    <th className="py-2 px-2.5">Cashier / Pharmacist</th>
                                    <th className="py-2 px-2.5">Customer</th>
                                    <th className="py-2 px-2.5">Payment</th>
                                    <th className="py-2 px-2.5 text-right">Amount Paid</th>
                                    <th className="py-2 px-2.5 text-right">Grand Total</th>
                                    <th className="py-2 px-2.5 text-center">Status</th>
                                    <th className="py-2 px-2.5 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredGridSales.slice(0, 30).map((s, idx) => (
                                    <tr key={s.sale_id || idx} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="py-1.5 px-2.5 font-mono font-bold text-emerald-700">{s.receipt_no}</td>
                                        <td className="py-1.5 px-2.5 text-slate-500 font-mono text-[11px]">
                                            {s.sale_datetime ? s.sale_datetime.replace('T', ' ').slice(0, 16) : '-'}
                                        </td>
                                        <td className="py-1.5 px-2.5 font-semibold text-slate-800">{s.cashier_name || 'Pharmacist'}</td>
                                        <td className="py-1.5 px-2.5 text-slate-600">{s.customer_name || 'Walk-in Patient'}</td>
                                        <td className="py-1.5 px-2.5">
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                                (s.payment_method || '').toUpperCase().includes('CASH')
                                                    ? 'bg-teal-50 text-teal-700 border border-teal-200'
                                                    : (s.payment_method || '').toUpperCase().includes('MPESA')
                                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                                    : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                            }`}>
                                                {s.payment_method || 'CASH'}
                                            </span>
                                        </td>
                                        <td className="py-1.5 px-2.5 text-right font-mono text-slate-600">
                                            KSh {(s.amount_paid || s.total || 0).toLocaleString()}
                                        </td>
                                        <td className="py-1.5 px-2.5 text-right font-mono font-bold text-slate-900">
                                            KSh {(s.total || 0).toLocaleString()}
                                        </td>
                                        <td className="py-1.5 px-2.5 text-center">
                                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                {s.status || 'Completed'}
                                            </span>
                                        </td>
                                        <td className="py-1.5 px-2.5 text-center">
                                            <button
                                                onClick={() => setActiveReceiptModal(s)}
                                                className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold transition flex items-center gap-1 mx-auto"
                                            >
                                                <FiEye className="w-3 h-3" />
                                                <span>Dossier</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredGridSales.length === 0 && (
                                    <tr>
                                        <td colSpan={9} className="py-8 text-center text-slate-400">
                                            No sales transactions found matching query.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}

                    {/* TAB 2: CRITICAL DEFICITS & REORDERS */}
                    {activeGridTab === 'deficits' && (
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-600 tracking-wider">
                                    <th className="py-2 px-2.5">Code</th>
                                    <th className="py-2 px-2.5">Medication &amp; Formulation</th>
                                    <th className="py-2 px-2.5">Category</th>
                                    <th className="py-2 px-2.5 text-center">Unit</th>
                                    <th className="py-2 px-2.5 text-right">Current Stock</th>
                                    <th className="py-2 px-2.5 text-right">Par Level</th>
                                    <th className="py-2 px-2.5 text-right">Deficit</th>
                                    <th className="py-2 px-2.5 text-right">Suggested Order</th>
                                    <th className="py-2 px-2.5 text-right">Restock Cost</th>
                                    <th className="py-2 px-2.5">Preferred Supplier</th>
                                    <th className="py-2 px-2.5 text-center">Urgency</th>
                                    <th className="py-2 px-2.5 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredGridDeficits.map((d, idx) => (
                                    <tr key={d.pid || idx} className={`transition-colors ${
                                        d.status === 'OUT_OF_STOCK' ? 'bg-rose-50/40 hover:bg-rose-50' : 'hover:bg-slate-50'
                                    }`}>
                                        <td className="py-1.5 px-2.5 font-mono font-bold text-slate-600">{d.product_code}</td>
                                        <td className="py-1.5 px-2.5 font-bold text-slate-900">
                                            {d.product_name}
                                            <span className="block text-[10px] font-normal text-slate-400">{d.generic_name}</span>
                                        </td>
                                        <td className="py-1.5 px-2.5 text-slate-600">{d.category}</td>
                                        <td className="py-1.5 px-2.5 text-center text-slate-500 font-mono text-[11px]">{d.unit}</td>
                                        <td className={`py-1.5 px-2.5 text-right font-mono font-bold ${
                                            d.current_stock === 0 ? 'text-rose-600' : 'text-amber-600'
                                        }`}>
                                            {d.current_stock}
                                        </td>
                                        <td className="py-1.5 px-2.5 text-right font-mono text-slate-600">{d.reorder_point}</td>
                                        <td className="py-1.5 px-2.5 text-right font-mono font-bold text-rose-600">-{d.deficit}</td>
                                        <td className="py-1.5 px-2.5 text-right font-mono font-bold text-emerald-600">+{d.suggested_order}</td>
                                        <td className="py-1.5 px-2.5 text-right font-mono font-bold text-slate-900">
                                            KSh {d.reorder_cost.toLocaleString()}
                                        </td>
                                        <td className="py-1.5 px-2.5 text-slate-700 font-medium">{d.preferred_supplier}</td>
                                        <td className="py-1.5 px-2.5 text-center">
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                                d.status === 'OUT_OF_STOCK'
                                                    ? 'bg-rose-100 text-rose-800'
                                                    : d.status === 'CRITICAL'
                                                    ? 'bg-amber-100 text-amber-800'
                                                    : 'bg-yellow-100 text-yellow-800'
                                            }`}>
                                                {d.status === 'OUT_OF_STOCK' ? '❌ OUT' : d.status === 'CRITICAL' ? '🔴 CRITICAL' : '🟡 LOW'}
                                            </span>
                                        </td>
                                        <td className="py-1.5 px-2.5 text-center">
                                            <button
                                                onClick={() => {
                                                    setReorderModalItem(d);
                                                    setReorderForm({
                                                        supplier_id: 1,
                                                        supplier_name: d.preferred_supplier,
                                                        quantity: d.suggested_order,
                                                        unit_cost: d.unit_cost,
                                                        payment_terms: '30 Days Net',
                                                        notes: `Restock request for ${d.product_name} (${d.suggested_order} units)`,
                                                    });
                                                }}
                                                className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold transition flex items-center gap-1 mx-auto shadow-sm"
                                            >
                                                <FiShoppingBag className="w-3 h-3" />
                                                <span>1-Click PO</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredGridDeficits.length === 0 && (
                                    <tr>
                                        <td colSpan={12} className="py-8 text-center text-slate-400">
                                            ✅ All pharmacy catalog items are stocked safely above minimum par levels.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}

                    {/* TAB 3: BATCH EXPIRY QUARANTINE */}
                    {activeGridTab === 'expiry' && (
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-600 tracking-wider">
                                    <th className="py-2 px-2.5">Batch #</th>
                                    <th className="py-2 px-2.5">Expiry Date</th>
                                    <th className="py-2 px-2.5 text-center">Days Remaining</th>
                                    <th className="py-2 px-2.5 text-right">Remaining Units</th>
                                    <th className="py-2 px-2.5 text-right">Pack Cost</th>
                                    <th className="py-2 px-2.5 text-right">At-Risk Value</th>
                                    <th className="py-2 px-2.5">Supplier</th>
                                    <th className="py-2 px-2.5 text-center">Status</th>
                                    <th className="py-2 px-2.5 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredGridBatches.slice(0, 30).map((b, idx) => {
                                    const expTime = new Date(b.expiry_date).getTime();
                                    const daysLeft = Math.ceil((expTime - Date.now()) / 86400000);
                                    const atRisk = (b.remaining_qty || 0) * (b.purchase_cost || 0);

                                    return (
                                        <tr key={b.batch_id || idx} className={`transition-colors ${
                                            daysLeft < 0 ? 'bg-rose-50/50 hover:bg-rose-50' : daysLeft <= 30 ? 'bg-amber-50/40 hover:bg-amber-50' : 'hover:bg-slate-50'
                                        }`}>
                                            <td className="py-1.5 px-2.5 font-mono font-bold text-slate-700">{b.batch_number}</td>
                                            <td className="py-1.5 px-2.5 font-mono text-slate-600">{b.expiry_date}</td>
                                            <td className="py-1.5 px-2.5 text-center font-mono font-bold">
                                                {daysLeft < 0 ? (
                                                    <span className="text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded text-[10px]">
                                                        EXPIRED ({Math.abs(daysLeft)}d ago)
                                                    </span>
                                                ) : daysLeft <= 30 ? (
                                                    <span className="text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded text-[10px]">
                                                        {daysLeft} days left
                                                    </span>
                                                ) : (
                                                    <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px]">
                                                        {daysLeft} days
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-1.5 px-2.5 text-right font-mono font-bold text-slate-800">{b.remaining_qty}</td>
                                            <td className="py-1.5 px-2.5 text-right font-mono text-slate-600">KSh {b.purchase_cost || 0}</td>
                                            <td className="py-1.5 px-2.5 text-right font-mono font-bold text-slate-900">
                                                KSh {atRisk.toLocaleString()}
                                            </td>
                                            <td className="py-1.5 px-2.5 text-slate-600">{b.supplier_name || 'Radiant Pharmaceuticals'}</td>
                                            <td className="py-1.5 px-2.5 text-center">
                                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                                    b.status === 'Quarantined'
                                                        ? 'bg-rose-100 text-rose-800'
                                                        : b.status === 'Discounted'
                                                        ? 'bg-amber-100 text-amber-800'
                                                        : 'bg-emerald-50 text-emerald-700'
                                                }`}>
                                                    {b.status || 'Active'}
                                                </span>
                                            </td>
                                            <td className="py-1.5 px-2.5 text-center">
                                                <button
                                                    onClick={() => {
                                                        setBatchQuarantineModal(b);
                                                        setBatchStatusUpdate(b.status === 'Quarantined' ? 'Active' : 'Quarantined');
                                                    }}
                                                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-900 text-white rounded text-[10px] font-bold transition flex items-center gap-1 mx-auto"
                                                >
                                                    <FiShield className="w-3 h-3" />
                                                    <span>Quarantine</span>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}

                    {/* TAB 4: PROCUREMENT POS */}
                    {activeGridTab === 'purchases' && (
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-600 tracking-wider">
                                    <th className="py-2 px-2.5">PO #</th>
                                    <th className="py-2 px-2.5">Order Date</th>
                                    <th className="py-2 px-2.5">Supplier</th>
                                    <th className="py-2 px-2.5">Invoice Ref</th>
                                    <th className="py-2 px-2.5 text-right">Grand Total</th>
                                    <th className="py-2 px-2.5 text-center">PO Status</th>
                                    <th className="py-2 px-2.5 text-center">Payment Status</th>
                                    <th className="py-2 px-2.5">Notes</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredGridPurchases.map((p, idx) => (
                                    <tr key={p.purchase_id || idx} className="hover:bg-slate-50 transition-colors">
                                        <td className="py-1.5 px-2.5 font-mono font-bold text-indigo-700">{p.purchase_no}</td>
                                        <td className="py-1.5 px-2.5 font-mono text-slate-600">{p.purchase_date}</td>
                                        <td className="py-1.5 px-2.5 font-bold text-slate-800">{p.supplier_name}</td>
                                        <td className="py-1.5 px-2.5 font-mono text-slate-500">{p.supplier_invoice || '-'}</td>
                                        <td className="py-1.5 px-2.5 text-right font-mono font-bold text-slate-900">
                                            KSh {(p.grand_total || 0).toLocaleString()}
                                        </td>
                                        <td className="py-1.5 px-2.5 text-center">
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                                p.status === 'Completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                                            }`}>
                                                {p.status || 'Pending'}
                                            </span>
                                        </td>
                                        <td className="py-1.5 px-2.5 text-center">
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                                p.payment_status === 'Paid' ? 'bg-teal-50 text-teal-700' : 'bg-rose-50 text-rose-700'
                                            }`}>
                                                {p.payment_status || 'Pending'}
                                            </span>
                                        </td>
                                        <td className="py-1.5 px-2.5 text-slate-500 text-[11px] truncate max-w-[200px]">{p.notes || '-'}</td>
                                    </tr>
                                ))}
                                {filteredGridPurchases.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="py-8 text-center text-slate-400">
                                            No procurement records found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}

                    {/* TAB 5: OPERATING EXPENSES */}
                    {activeGridTab === 'expenses' && (
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-600 tracking-wider">
                                    <th className="py-2 px-2.5">Date</th>
                                    <th className="py-2 px-2.5">Expense Title</th>
                                    <th className="py-2 px-2.5">Category</th>
                                    <th className="py-2 px-2.5">Payment Mode</th>
                                    <th className="py-2 px-2.5 text-right">Amount</th>
                                    <th className="py-2 px-2.5">Description</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredGridExpenses.map((e, idx) => (
                                    <tr key={e.expense_id || idx} className="hover:bg-slate-50 transition-colors">
                                        <td className="py-1.5 px-2.5 font-mono text-slate-600">{e.expense_date}</td>
                                        <td className="py-1.5 px-2.5 font-bold text-slate-900">{e.expense_name}</td>
                                        <td className="py-1.5 px-2.5 text-slate-700">{e.category}</td>
                                        <td className="py-1.5 px-2.5 text-slate-600">{e.payment_mode}</td>
                                        <td className="py-1.5 px-2.5 text-right font-mono font-bold text-rose-700">
                                            KSh {e.amount.toLocaleString()}
                                        </td>
                                        <td className="py-1.5 px-2.5 text-slate-500 text-[11px] truncate max-w-[250px]">{e.description || '-'}</td>
                                    </tr>
                                ))}
                                {filteredGridExpenses.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="py-8 text-center text-slate-400">
                                            No operating expense records found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}

                    {/* TAB 6: SHIFT DRAWER CASH */}
                    {activeGridTab === 'shifts' && (
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-600 tracking-wider">
                                    <th className="py-2 px-2.5">Date</th>
                                    <th className="py-2 px-2.5">Shift Type</th>
                                    <th className="py-2 px-2.5">Opened By</th>
                                    <th className="py-2 px-2.5 text-right">Opening Cash</th>
                                    <th className="py-2 px-2.5 text-right">Shift Sales</th>
                                    <th className="py-2 px-2.5 text-right">Closing Cash</th>
                                    <th className="py-2 px-2.5 text-right">Net Sales</th>
                                    <th className="py-2 px-2.5 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {rawShifts.map((s, idx) => (
                                    <tr key={s.shift_id || idx} className="hover:bg-slate-50 transition-colors">
                                        <td className="py-1.5 px-2.5 font-mono text-slate-600">{s.shift_date}</td>
                                        <td className="py-1.5 px-2.5 font-bold text-slate-800">{s.shift_type}</td>
                                        <td className="py-1.5 px-2.5 text-slate-600">{s.opened_by || 'Pharmacist'}</td>
                                        <td className="py-1.5 px-2.5 text-right font-mono text-slate-600">KSh {(s.opening_cash || 0).toLocaleString()}</td>
                                        <td className="py-1.5 px-2.5 text-right font-mono font-bold text-slate-800">KSh {(s.total_sales || 0).toLocaleString()}</td>
                                        <td className="py-1.5 px-2.5 text-right font-mono text-slate-600">KSh {(s.closing_cash || 0).toLocaleString()}</td>
                                        <td className="py-1.5 px-2.5 text-right font-mono font-bold text-emerald-700">KSh {(s.net_sales || 0).toLocaleString()}</td>
                                        <td className="py-1.5 px-2.5 text-center">
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                                s.status === 'Open' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                                            }`}>
                                                {s.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {rawShifts.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="py-8 text-center text-slate-400">
                                            No shift instance records found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* ═════════════════════════════════════════════════════════════════
                MODAL 1: 1-CLICK PURCHASE REORDER MODAL
            ═════════════════════════════════════════════════════════════════ */}
            {reorderModalItem && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3">
                    <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="p-1 rounded-md bg-emerald-500/20 text-emerald-400"><FiShoppingBag className="w-4 h-4" /></span>
                                <div>
                                    <h3 className="text-sm font-bold">1-Click Fast Reorder Generator</h3>
                                    <p className="text-[10px] text-slate-400">Direct write into live procurement ledger</p>
                                </div>
                            </div>
                            <button onClick={() => setReorderModalItem(null)} className="text-slate-400 hover:text-white">
                                <FiXCircle className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleReorderSubmit} className="p-4 space-y-3 text-xs">
                            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                                <div>
                                    <p className="font-extrabold text-slate-900 text-sm">{reorderModalItem.product_name}</p>
                                    <p className="text-[11px] text-slate-500">{reorderModalItem.category} • Current Stock: {reorderModalItem.current_stock} units</p>
                                </div>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-100 text-rose-800">
                                    Deficit: {reorderModalItem.deficit}u
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2.5">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Reorder Quantity</label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={reorderForm.quantity}
                                        onChange={e => setReorderForm({ ...reorderForm, quantity: Number(e.target.value) })}
                                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-bold focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Unit Cost (KSh)</label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={reorderForm.unit_cost}
                                        onChange={e => setReorderForm({ ...reorderForm, unit_cost: Number(e.target.value) })}
                                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-bold focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">Assigned Vendor / Supplier</label>
                                <select
                                    value={reorderForm.supplier_name}
                                    onChange={e => {
                                        const supp = rawSuppliers.find(s => s.supplier_name === e.target.value);
                                        setReorderForm({
                                            ...reorderForm,
                                            supplier_name: e.target.value,
                                            supplier_id: supp?.supplier_id || 1,
                                        });
                                    }}
                                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-white"
                                >
                                    {rawSuppliers.length > 0 ? (
                                        rawSuppliers.map(s => (
                                            <option key={s.supplier_id} value={s.supplier_name}>{s.supplier_name}</option>
                                        ))
                                    ) : (
                                        <option value={reorderModalItem.preferred_supplier}>{reorderModalItem.preferred_supplier}</option>
                                    )}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">Procurement Notes</label>
                                <input
                                    type="text"
                                    value={reorderForm.notes}
                                    onChange={e => setReorderForm({ ...reorderForm, notes: e.target.value })}
                                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                                />
                            </div>

                            <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 flex items-center justify-between">
                                <span className="font-semibold text-emerald-900">Total Purchase Order Commitment:</span>
                                <span className="text-sm font-extrabold text-emerald-800">
                                    KSh {(reorderForm.quantity * reorderForm.unit_cost).toLocaleString()}
                                </span>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setReorderModalItem(null)}
                                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmittingModal}
                                    className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 shadow-sm"
                                >
                                    {isSubmittingModal ? <FiRefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FiCheck className="w-3.5 h-3.5" />}
                                    <span>Dispatch Purchase Order</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ═════════════════════════════════════════════════════════════════
                MODAL 2: SALE RECEIPT & TRANSACTION DOSSIER
            ═════════════════════════════════════════════════════════════════ */}
            {activeReceiptModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3">
                    <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="p-1 rounded-md bg-emerald-500/20 text-emerald-400"><FiFileText className="w-4 h-4" /></span>
                                <div>
                                    <h3 className="text-sm font-bold">Dispensary Receipt Dossier</h3>
                                    <p className="text-[10px] text-slate-400">{activeReceiptModal.receipt_no}</p>
                                </div>
                            </div>
                            <button onClick={() => setActiveReceiptModal(null)} className="text-slate-400 hover:text-white">
                                <FiXCircle className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-4 space-y-3 text-xs">
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Receipt Ref:</span>
                                    <span className="font-mono font-bold text-slate-900">{activeReceiptModal.receipt_no}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Date &amp; Time:</span>
                                    <span className="font-mono text-slate-700">{activeReceiptModal.sale_datetime}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Dispensing Pharmacist:</span>
                                    <span className="font-bold text-slate-800">{activeReceiptModal.cashier_name || 'Pharmacist'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Customer / Patient:</span>
                                    <span className="text-slate-700">{activeReceiptModal.customer_name || 'Walk-in'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Settlement Method:</span>
                                    <span className="font-bold text-emerald-700">{activeReceiptModal.payment_method}</span>
                                </div>
                            </div>

                            <div className="border-t border-b border-slate-100 py-2 space-y-1">
                                <div className="flex justify-between text-slate-600">
                                    <span>Subtotal:</span>
                                    <span className="font-mono">KSh {(activeReceiptModal.subtotal || activeReceiptModal.total || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-slate-600">
                                    <span>Discount:</span>
                                    <span className="font-mono">KSh {(activeReceiptModal.discount || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-slate-600">
                                    <span>Tax / VAT:</span>
                                    <span className="font-mono">KSh {(activeReceiptModal.tax || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-slate-900 font-extrabold text-sm pt-1 border-t border-slate-200">
                                    <span>Grand Total:</span>
                                    <span className="font-mono text-emerald-700">KSh {(activeReceiptModal.total || 0).toLocaleString()}</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2">
                                <button
                                    onClick={() => window.print()}
                                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold flex items-center gap-1.5"
                                >
                                    <FiPrinter className="w-3.5 h-3.5" />
                                    <span>Print Thermal Slip</span>
                                </button>
                                <button
                                    onClick={() => setActiveReceiptModal(null)}
                                    className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═════════════════════════════════════════════════════════════════
                MODAL 3: BATCH QUARANTINE / STATUS CHANGE MODAL
            ═════════════════════════════════════════════════════════════════ */}
            {batchQuarantineModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3">
                    <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="p-1 rounded-md bg-rose-500/20 text-rose-400"><FiShield className="w-4 h-4" /></span>
                                <div>
                                    <h3 className="text-sm font-bold">Batch Quarantine &amp; Protocol Manager</h3>
                                    <p className="text-[10px] text-slate-400">Lot: {batchQuarantineModal.batch_number}</p>
                                </div>
                            </div>
                            <button onClick={() => setBatchQuarantineModal(null)} className="text-slate-400 hover:text-white">
                                <FiXCircle className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleBatchStatusSubmit} className="p-4 space-y-3 text-xs">
                            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                                <p className="font-extrabold text-slate-900">Lot #{batchQuarantineModal.batch_number}</p>
                                <p className="text-[11px] text-slate-500">
                                    Expiry: {batchQuarantineModal.expiry_date} • Remaining Stock: {batchQuarantineModal.remaining_qty} units
                                </p>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">New Batch Status</label>
                                <select
                                    value={batchStatusUpdate}
                                    onChange={e => setBatchStatusUpdate(e.target.value as any)}
                                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-bold focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-white"
                                >
                                    <option value="Quarantined">⛔ Quarantined (Hold from POS)</option>
                                    <option value="Active">✅ Active (Available for Dispensing)</option>
                                    <option value="Discounted">🏷️ Discounted Clearance</option>
                                    <option value="Disposed">🗑️ Disposed / Written Off</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">Pharmacist Audit Notes</label>
                                <textarea
                                    value={batchAuditNotes}
                                    onChange={e => setBatchAuditNotes(e.target.value)}
                                    placeholder="Enter reason for status change (e.g. Near expiry quarantine or regulatory audit)"
                                    rows={3}
                                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setBatchQuarantineModal(null)}
                                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmittingModal}
                                    className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center gap-1.5 shadow-sm"
                                >
                                    {isSubmittingModal ? <FiRefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FiCheck className="w-3.5 h-3.5" />}
                                    <span>Update Batch Status</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ═════════════════════════════════════════════════════════════════
                MODAL 4: QUICK OPERATING EXPENSE LOGGER
            ═════════════════════════════════════════════════════════════════ */}
            {isExpenseModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3">
                    <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="p-1 rounded-md bg-rose-500/20 text-rose-400"><FiDollarSign className="w-4 h-4" /></span>
                                <div>
                                    <h3 className="text-sm font-bold">Log Pharmacy Operating Expense</h3>
                                    <p className="text-[10px] text-slate-400">Records directly into live expenses ledger</p>
                                </div>
                            </div>
                            <button onClick={() => setIsExpenseModalOpen(false)} className="text-slate-400 hover:text-white">
                                <FiXCircle className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleExpenseSubmit} className="p-4 space-y-3 text-xs">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">Expense Title / Payee</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Generator Fuel, Fridge Maintenance, Sanitizer Bags"
                                    value={expenseForm.expense_name}
                                    onChange={e => setExpenseForm({ ...expenseForm, expense_name: e.target.value })}
                                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2.5">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Category</label>
                                    <select
                                        value={expenseForm.category}
                                        onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })}
                                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-white"
                                    >
                                        <option value="Utilities">Utilities &amp; Power</option>
                                        <option value="Salaries">Staff &amp; Locum</option>
                                        <option value="Logistics">Delivery &amp; Freight</option>
                                        <option value="Packaging">Bags &amp; Vials</option>
                                        <option value="Licenses">Pharmacy Regulatory</option>
                                        <option value="Maintenance">Cold-Chain Maint</option>
                                        <option value="General">General Store</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Payment Mode</label>
                                    <select
                                        value={expenseForm.payment_mode}
                                        onChange={e => setExpenseForm({ ...expenseForm, payment_mode: e.target.value })}
                                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-white"
                                    >
                                        <option value="Cash">Cash Drawer</option>
                                        <option value="M-Pesa">M-Pesa Till</option>
                                        <option value="Bank Transfer">Bank Wire</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2.5">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Amount (KSh)</label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={expenseForm.amount}
                                        onChange={e => setExpenseForm({ ...expenseForm, amount: Number(e.target.value) })}
                                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-bold focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Date</label>
                                    <input
                                        type="date"
                                        value={expenseForm.expense_date}
                                        onChange={e => setExpenseForm({ ...expenseForm, expense_date: e.target.value })}
                                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">Description / Memo</label>
                                <input
                                    type="text"
                                    placeholder="Optional notes or receipt reference"
                                    value={expenseForm.description}
                                    onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })}
                                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsExpenseModalOpen(false)}
                                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmittingModal}
                                    className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center gap-1.5 shadow-sm"
                                >
                                    {isSubmittingModal ? <FiRefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FiCheck className="w-3.5 h-3.5" />}
                                    <span>Post Expense</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
