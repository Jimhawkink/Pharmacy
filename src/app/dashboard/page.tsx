'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
    BarElement, ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

// ══════════════════════════════════════════════════════════════════
// PHARMACY MASTER CATALOG (50 Authentic Medications PID 5–54)
// ══════════════════════════════════════════════════════════════════
const DRUG_CATALOG: Record<number, { name: string; generic: string; category: string; unit: string; cost: number; price: number; par: number; supplier: string }> = {
    5:  { name: 'Paracetamol 500mg', generic: 'Paracetamol', category: 'Analgesics', unit: 'Tablet', cost: 150, price: 5, par: 60, supplier: 'Radiant Pharmaceuticals' },
    6:  { name: 'Amoxicillin 500mg', generic: 'Amoxicillin', category: 'Antibiotics', unit: 'Capsule', cost: 350, price: 10, par: 50, supplier: 'Radiant Pharmaceuticals' },
    7:  { name: 'Metformin 500mg', generic: 'Metformin HCl', category: 'Antidiabetics', unit: 'Tablet', cost: 280, price: 8, par: 50, supplier: 'Fresh Foods Ltd' },
    8:  { name: 'Ibuprofen 400mg', generic: 'Ibuprofen', category: 'Analgesics', unit: 'Tablet', cost: 200, price: 5, par: 40, supplier: 'Quick Supplies' },
    9:  { name: 'Ciprofloxacin 500mg', generic: 'Ciprofloxacin', category: 'Antibiotics', unit: 'Tablet', cost: 450, price: 15, par: 40, supplier: 'Nairobi Stores' },
    10: { name: 'Omeprazole 20mg', generic: 'Omeprazole', category: 'Gastrointestinal', unit: 'Capsule', cost: 180, price: 15, par: 40, supplier: 'Radiant Pharmaceuticals' },
    11: { name: 'Diclofenac 50mg', generic: 'Diclofenac Sodium', category: 'Analgesics', unit: 'Tablet', cost: 160, price: 5, par: 50, supplier: 'Fresh Foods Ltd' },
    12: { name: 'Cetirizine 10mg', generic: 'Cetirizine HCl', category: 'Antihistamines', unit: 'Tablet', cost: 120, price: 5, par: 45, supplier: 'Quick Supplies' },
    13: { name: 'Azithromycin 250mg', generic: 'Azithromycin', category: 'Antibiotics', unit: 'Capsule', cost: 300, price: 25, par: 35, supplier: 'Radiant Pharmaceuticals' },
    14: { name: 'Losartan 50mg', generic: 'Losartan Potassium', category: 'Antihypertensives', unit: 'Tablet', cost: 250, price: 20, par: 35, supplier: 'Farm Direct' },
    15: { name: 'Cough Syrup 100ml', generic: 'Dextromethorphan', category: 'Respiratory', unit: 'Bottle', cost: 120, price: 200, par: 25, supplier: 'Nairobi Stores' },
    16: { name: 'Amoxicillin Susp 100ml', generic: 'Amoxicillin', category: 'Antibiotics', unit: 'Bottle', cost: 180, price: 300, par: 30, supplier: 'Radiant Pharmaceuticals' },
    17: { name: 'Paracetamol Syrup 60ml', generic: 'Paracetamol', category: 'Analgesics', unit: 'Bottle', cost: 80, price: 150, par: 35, supplier: 'Fresh Foods Ltd' },
    18: { name: 'Gripe Water 150ml', generic: 'Sodium Bicarbonate', category: 'Baby & Child', unit: 'Bottle', cost: 100, price: 180, par: 20, supplier: 'Quick Supplies' },
    19: { name: 'Iron Syrup 200ml', generic: 'Ferrous Sulphate', category: 'Vitamins', unit: 'Bottle', cost: 150, price: 280, par: 20, supplier: 'Farm Direct' },
    20: { name: 'Multivitamin Syrup 100ml', generic: 'Multivitamins', category: 'Vitamins', unit: 'Bottle', cost: 200, price: 350, par: 25, supplier: 'Radiant Pharmaceuticals' },
    21: { name: 'Diclofenac Inj 75mg', generic: 'Diclofenac', category: 'Injectables', unit: 'Ampoule', cost: 250, price: 80, par: 30, supplier: 'Quick Supplies' },
    22: { name: 'Gentamicin Inj 80mg', generic: 'Gentamicin', category: 'Injectables', unit: 'Ampoule', cost: 400, price: 60, par: 30, supplier: 'Radiant Pharmaceuticals' },
    23: { name: 'Dexamethasone Inj 8mg', generic: 'Dexamethasone', category: 'Injectables', unit: 'Ampoule', cost: 350, price: 50, par: 30, supplier: 'Nairobi Stores' },
    24: { name: 'Ceftriaxone IV 1g', generic: 'Ceftriaxone', category: 'Injectables', unit: 'Vial', cost: 1200, price: 180, par: 20, supplier: 'Radiant Pharmaceuticals' },
    25: { name: 'Betadine Ointment 30g', generic: 'Povidone-Iodine', category: 'Topicals', unit: 'Tube', cost: 120, price: 150, par: 20, supplier: 'Fresh Foods Ltd' },
    26: { name: 'Clotrimazole Cream 20g', generic: 'Clotrimazole', category: 'Topicals', unit: 'Tube', cost: 80, price: 80, par: 25, supplier: 'Quick Supplies' },
    27: { name: 'Hydrocortisone Cream 15g', generic: 'Hydrocortisone', category: 'Topicals', unit: 'Tube', cost: 100, price: 120, par: 20, supplier: 'Radiant Pharmaceuticals' },
    28: { name: 'Calamine Lotion 100ml', generic: 'Calamine', category: 'Topicals', unit: 'Bottle', cost: 80, price: 100, par: 20, supplier: 'Farm Direct' },
    29: { name: 'Antifungal Powder 50g', generic: 'Miconazole', category: 'Topicals', unit: 'Bottle', cost: 80, price: 100, par: 20, supplier: 'Nairobi Stores' },
    30: { name: 'Chloramphenicol Eye Drops', generic: 'Chloramphenicol', category: 'Eye & Ear', unit: 'Bottle', cost: 65, price: 80, par: 20, supplier: 'Quick Supplies' },
    31: { name: 'Ciprofloxacin Eye Drops', generic: 'Ciprofloxacin', category: 'Eye & Ear', unit: 'Bottle', cost: 80, price: 100, par: 20, supplier: 'Radiant Pharmaceuticals' },
    32: { name: 'Artificial Tears 15ml', generic: 'CMC', category: 'Eye & Ear', unit: 'Bottle', cost: 100, price: 120, par: 20, supplier: 'Fresh Foods Ltd' },
    33: { name: 'Surgical Gloves (M)', generic: 'Latex Gloves', category: 'Medical Supplies', unit: 'Pair', cost: 800, price: 20, par: 80, supplier: 'Farm Direct' },
    34: { name: 'Disposable Syringes 5ml', generic: 'Syringes', category: 'Medical Supplies', unit: 'Piece', cost: 700, price: 15, par: 80, supplier: 'Nairobi Stores' },
    35: { name: 'Cotton Wool 500g', generic: 'Absorbent Cotton', category: 'Medical Supplies', unit: 'Roll', cost: 200, price: 350, par: 20, supplier: 'Quick Supplies' },
    36: { name: 'Gauze Bandage 4"x4m', generic: 'Bandage', category: 'Medical Supplies', unit: 'Piece', cost: 360, price: 50, par: 40, supplier: 'Fresh Foods Ltd' },
    37: { name: 'Surgical Face Masks', generic: 'Face Masks', category: 'Medical Supplies', unit: 'Piece', cost: 300, price: 10, par: 80, supplier: 'Radiant Pharmaceuticals' },
    38: { name: 'Hand Sanitizer 500ml', generic: 'Ethanol 70%', category: 'Antiseptics', unit: 'Bottle', cost: 1800, price: 250, par: 25, supplier: 'Nairobi Stores' },
    39: { name: 'Baby Diapers Size 3', generic: 'Diapers', category: 'Baby & Child', unit: 'Pack', cost: 780, price: 950, par: 15, supplier: 'Quick Supplies' },
    40: { name: 'Baby Lotion 200ml', generic: 'Emollient', category: 'Baby & Child', unit: 'Bottle', cost: 250, price: 350, par: 20, supplier: 'Fresh Foods Ltd' },
    41: { name: 'Zinc Cream for Babies', generic: 'Zinc Oxide', category: 'Baby & Child', unit: 'Tube', cost: 150, price: 220, par: 20, supplier: 'Radiant Pharmaceuticals' },
    42: { name: 'Vitamin C 1000mg', generic: 'Ascorbic Acid', category: 'Vitamins', unit: 'Tube(10)', cost: 180, price: 250, par: 35, supplier: 'Farm Direct' },
    43: { name: 'Vitamin D3 2000IU', generic: 'Cholecalciferol', category: 'Vitamins', unit: 'Bottle', cost: 650, price: 900, par: 35, supplier: 'Quick Supplies' },
    44: { name: 'Calcium + D3 Tablets', generic: 'Calcium Carbonate', category: 'Vitamins', unit: 'Bottle', cost: 450, price: 650, par: 35, supplier: 'Fresh Foods Ltd' },
    45: { name: 'Omega-3 Fish Oil', generic: 'EPA/DHA', category: 'Vitamins', unit: 'Bottle', cost: 900, price: 1300, par: 30, supplier: 'Radiant Pharmaceuticals' },
    46: { name: 'Folic Acid 5mg', generic: 'Folic Acid', category: 'Vitamins', unit: 'Tablet', cost: 120, price: 3, par: 40, supplier: 'Farm Direct' },
    47: { name: 'Normal Saline 0.9% 1L', generic: 'NaCl 0.9%', category: 'IV Fluids', unit: 'Bottle', cost: 1800, price: 250, par: 20, supplier: 'Nairobi Stores' },
    48: { name: 'Dextrose 5% 500ml', generic: 'Dextrose', category: 'IV Fluids', unit: 'Bottle', cost: 1600, price: 220, par: 20, supplier: 'Quick Supplies' },
    49: { name: 'Ringers Lactate 1L', generic: 'Hartmanns', category: 'IV Fluids', unit: 'Bottle', cost: 2000, price: 280, par: 20, supplier: 'Radiant Pharmaceuticals' },
    50: { name: 'Salbutamol Inhaler', generic: 'Salbutamol', category: 'Respiratory', unit: 'Canister', cost: 350, price: 500, par: 25, supplier: 'Fresh Foods Ltd' },
    51: { name: 'Prednisolone 5mg', generic: 'Prednisolone', category: 'Respiratory', unit: 'Tablet', cost: 150, price: 5, par: 35, supplier: 'Quick Supplies' },
    52: { name: 'Dettol Antiseptic 500ml', generic: 'Chloroxylenol', category: 'Antiseptics', unit: 'Bottle', cost: 3600, price: 420, par: 20, supplier: 'Radiant Pharmaceuticals' },
    53: { name: 'Hydrogen Peroxide 200ml', generic: 'H2O2', category: 'Antiseptics', unit: 'Bottle', cost: 1400, price: 120, par: 20, supplier: 'Farm Direct' },
    54: { name: 'Surgical Spirit 1L', generic: 'Denatured Ethanol', category: 'Antiseptics', unit: 'Bottle', cost: 2400, price: 300, par: 20, supplier: 'Nairobi Stores' },
};

// ══════════════════════════════════════════════════════════════════
// DASHBOARD COMPONENT
// ══════════════════════════════════════════════════════════════════
export default function DashboardPage() {
    const { activeOutlet } = useOutlet();
    const outletId = activeOutlet?.outlet_id || 1;

    // Loading & Dates
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [datePreset, setDatePreset] = useState('30d');
    const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; });
    const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);

    // Live Raw Data
    const [sales, setSales] = useState<any[]>([]);
    const [batches, setBatches] = useState<any[]>([]);
    const [stock, setStock] = useState<any[]>([]);
    const [purchases, setPurchases] = useState<any[]>([]);
    const [expenses, setExpenses] = useState<any[]>([]);
    const [shifts, setShifts] = useState<any[]>([]);
    const [suppliers, setSuppliers] = useState<any[]>([]);

    // Module Filter
    const [activeModule, setActiveModule] = useState('overview');

    // Grid Tab
    const [gridTab, setGridTab] = useState<'bestSellers' | 'stockAlerts' | 'purchases' | 'expiry' | 'expenses' | 'shifts'>('bestSellers');
    const [gridSearch, setGridSearch] = useState('');

    // Date Presets
    const applyPreset = (p: string) => {
        setDatePreset(p);
        const now = new Date();
        const to = now.toISOString().split('T')[0];
        let from = to;
        if (p === '1d') from = to;
        else if (p === '7d') { const d = new Date(); d.setDate(d.getDate() - 7); from = d.toISOString().split('T')[0]; }
        else if (p === '14d') { const d = new Date(); d.setDate(d.getDate() - 14); from = d.toISOString().split('T')[0]; }
        else if (p === '30d') { const d = new Date(); d.setDate(d.getDate() - 30); from = d.toISOString().split('T')[0]; }
        else if (p === 'mtd') from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        else if (p === 'qtd') { const qm = Math.floor(now.getMonth() / 3) * 3; from = `${now.getFullYear()}-${String(qm + 1).padStart(2, '0')}-01`; }
        else if (p === 'ytd') from = `${now.getFullYear()}-01-01`;
        setDateFrom(from); setDateTo(to);
    };

    // ══════════════════════════════════════════════════════════════════
    // LIVE DATABASE LOADER
    // ══════════════════════════════════════════════════════════════════
    const loadData = useCallback(async (silent = false) => {
        if (!silent) setIsLoading(true); else setIsRefreshing(true);
        try {
            const [s1, s2, s3, s4, s5, s6, s7] = await Promise.all([
                supabase.from('pharmacy_sales').select('*').order('sale_datetime', { ascending: false }).limit(500),
                supabase.from('pharmacy_batches').select('*').order('expiry_date', { ascending: true }),
                supabase.from('pharmacy_stock').select('*'),
                supabase.from('purchases').select('*').order('purchase_date', { ascending: false }).limit(100),
                supabase.from('expenses').select('*').order('expense_date', { ascending: false }).limit(100),
                supabase.from('shifts').select('*').order('shift_date', { ascending: false }).limit(50),
                supabase.from('suppliers').select('*').order('supplier_name'),
            ]);
            setSales(s1.data || []); setBatches(s2.data || []); setStock(s3.data || []);
            setPurchases(s4.data || []); setExpenses(s5.data || []);
            setShifts(s6.data || []); setSuppliers(s7.data || []);
        } catch (e) { console.error('DB load error:', e); }
        setIsLoading(false); setIsRefreshing(false);
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    // ══════════════════════════════════════════════════════════════════
    // ALL COMPUTED METRICS (MASSIVE ANALYTICS)
    // ══════════════════════════════════════════════════════════════════
    const today = useMemo(() => new Date().toISOString().split('T')[0], []);
    const yesterday = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0]; }, []);

    const todaySales = useMemo(() => sales.filter(s => s.sale_datetime && s.sale_datetime.split('T')[0] === today), [sales, today]);
    const yesterdaySales = useMemo(() => sales.filter(s => s.sale_datetime && s.sale_datetime.split('T')[0] === yesterday), [sales, yesterday]);
    const rangeSales = useMemo(() => sales.filter(s => { const d = (s.sale_datetime || '').split('T')[0]; return d >= dateFrom && d <= dateTo; }), [sales, dateFrom, dateTo]);

    const todayRevenue = useMemo(() => todaySales.reduce((a: number, s: any) => a + (s.total || 0), 0), [todaySales]);
    const yesterdayRevenue = useMemo(() => yesterdaySales.reduce((a: number, s: any) => a + (s.total || 0), 0), [yesterdaySales]);
    const rangeRevenue = useMemo(() => rangeSales.reduce((a: number, s: any) => a + (s.total || 0), 0), [rangeSales]);
    const salesGrowth = useMemo(() => yesterdayRevenue > 0 ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue * 100) : 0, [todayRevenue, yesterdayRevenue]);

    // Payment splits
    const payments = useMemo(() => {
        let cash = 0, mpesa = 0, credit = 0;
        rangeSales.forEach((s: any) => {
            const m = (s.payment_method || '').toUpperCase();
            if (m.includes('MPESA') || m.includes('M-PESA')) mpesa += s.total || 0;
            else if (m.includes('CREDIT') || m.includes('INSUR')) credit += s.total || 0;
            else cash += s.total || 0;
        });
        return { cash, mpesa, credit, total: cash + mpesa + credit };
    }, [rangeSales]);

    const todayPayments = useMemo(() => {
        let cash = 0, mpesa = 0, credit = 0;
        todaySales.forEach((s: any) => {
            const m = (s.payment_method || '').toUpperCase();
            if (m.includes('MPESA') || m.includes('M-PESA')) mpesa += s.total || 0;
            else if (m.includes('CREDIT') || m.includes('INSUR')) credit += s.total || 0;
            else cash += s.total || 0;
        });
        return { cash, mpesa, credit, total: cash + mpesa + credit };
    }, [todaySales]);

    // Stock & Inventory
    const inventory = useMemo(() => {
        const stockMap = new Map<number, number>();
        stock.forEach((s: any) => stockMap.set(s.pid, (stockMap.get(s.pid) || 0) + (s.qty || 0)));
        let retailVal = 0, costVal = 0, outOfStock = 0, critical = 0, lowStock = 0, healthy = 0, totalItems = 0;
        const deficits: { pid: number; name: string; category: string; stock: number; par: number; deficit: number; cost: number; supplier: string; status: string }[] = [];

        Object.entries(DRUG_CATALOG).forEach(([pidStr, drug]) => {
            const pid = Number(pidStr);
            const qty = stockMap.get(pid) || 0;
            retailVal += qty * drug.price;
            costVal += qty * drug.cost;
            totalItems++;
            if (qty === 0) { outOfStock++; }
            else if (qty <= drug.par * 0.3) { critical++; }
            else if (qty <= drug.par) { lowStock++; }
            else { healthy++; }
            if (qty <= drug.par) {
                const deficit = Math.max(0, drug.par - qty);
                deficits.push({ pid, name: drug.name, category: drug.category, stock: qty, par: drug.par, deficit, cost: deficit * drug.cost, supplier: drug.supplier, status: qty === 0 ? 'OUT' : qty <= drug.par * 0.3 ? 'CRITICAL' : 'LOW' });
            }
        });
        deficits.sort((a, b) => a.stock - b.stock);
        const restockCost = deficits.reduce((a, d) => a + d.cost, 0);
        return { retailVal, costVal, outOfStock, critical, lowStock, healthy, totalItems, deficits, restockCost };
    }, [stock]);

    // Expiry
    const expiry = useMemo(() => {
        const now = Date.now();
        let expired = 0, exp7 = 0, exp30 = 0, exp90 = 0, safe = 0, riskVal = 0;
        batches.forEach((b: any) => {
            if (!b.expiry_date) return;
            const days = Math.ceil((new Date(b.expiry_date).getTime() - now) / 86400000);
            const val = (b.remaining_qty || 0) * (b.selling_price || b.purchase_cost || 0);
            if (days < 0) { expired++; riskVal += val; }
            else if (days <= 7) { exp7++; riskVal += val; }
            else if (days <= 30) { exp30++; riskVal += val * 0.7; }
            else if (days <= 90) { exp90++; }
            else { safe++; }
        });
        return { expired, exp7, exp30, exp90, safe, riskVal, total: batches.length };
    }, [batches]);

    // Procurement
    const procurement = useMemo(() => {
        const inRange = purchases.filter((p: any) => p.purchase_date && p.purchase_date >= dateFrom && p.purchase_date <= dateTo);
        const total = inRange.reduce((a: number, p: any) => a + (p.grand_total || 0), 0);
        const pending = purchases.filter((p: any) => (p.status || '').toLowerCase().includes('pending')).length;
        const supplierDebt = suppliers.reduce((a: number, s: any) => a + (s.current_balance || 0), 0);
        return { total, pending, supplierDebt, count: inRange.length };
    }, [purchases, suppliers, dateFrom, dateTo]);

    // Expenses
    const expenseMetrics = useMemo(() => {
        const inRange = expenses.filter((e: any) => e.expense_date && e.expense_date >= dateFrom && e.expense_date <= dateTo);
        const total = inRange.reduce((a: number, e: any) => a + (e.amount || 0), 0);
        const catMap = new Map<string, number>();
        inRange.forEach((e: any) => { const c = e.category || 'General'; catMap.set(c, (catMap.get(c) || 0) + (e.amount || 0)); });
        return { total, byCategory: Array.from(catMap.entries()).sort((a, b) => b[1] - a[1]) };
    }, [expenses, dateFrom, dateTo]);

    // Shifts
    const shiftMetrics = useMemo(() => {
        const active = shifts.filter((s: any) => s.status === 'Open').length;
        const closed = shifts.filter((s: any) => s.status === 'Closed').length;
        const totalShiftSales = shifts.reduce((a: number, s: any) => a + (s.total_sales || 0), 0);
        return { active, closed, totalShiftSales };
    }, [shifts]);

    // Net margin
    const netMargin = useMemo(() => {
        const estCOGS = rangeRevenue * 0.62;
        const gross = rangeRevenue - estCOGS;
        const net = gross - expenseMetrics.total;
        const pct = rangeRevenue > 0 ? (net / rangeRevenue) * 100 : 0;
        return { net, pct, gross };
    }, [rangeRevenue, expenseMetrics.total]);

    // Staff / Cashier performance
    const staffPerf = useMemo(() => {
        const map = new Map<string, { total: number; count: number }>();
        rangeSales.forEach((s: any) => {
            const n = s.cashier_name || 'Pharmacist';
            if (!map.has(n)) map.set(n, { total: 0, count: 0 });
            const e = map.get(n)!; e.total += s.total || 0; e.count++;
        });
        return Array.from(map.entries()).map(([name, d]) => ({ name, ...d, avg: d.count > 0 ? Math.round(d.total / d.count) : 0 })).sort((a, b) => b.total - a.total);
    }, [rangeSales]);

    // Best sellers
    const avgOrderValue = useMemo(() => rangeSales.length > 0 ? Math.round(rangeRevenue / rangeSales.length) : 0, [rangeRevenue, rangeSales]);

    // Daily trend
    const dailyTrend = useMemo(() => {
        const map = new Map<string, { date: string; total: number; cash: number; mpesa: number; credit: number; orders: number }>();
        const start = new Date(dateFrom); const end = new Date(dateTo);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const k = d.toISOString().split('T')[0];
            map.set(k, { date: k, total: 0, cash: 0, mpesa: 0, credit: 0, orders: 0 });
        }
        rangeSales.forEach((s: any) => {
            const k = (s.sale_datetime || '').split('T')[0]; if (!k) return;
            if (!map.has(k)) map.set(k, { date: k, total: 0, cash: 0, mpesa: 0, credit: 0, orders: 0 });
            const e = map.get(k)!; e.total += s.total || 0; e.orders++;
            const m = (s.payment_method || '').toUpperCase();
            if (m.includes('MPESA') || m.includes('M-PESA')) e.mpesa += s.total || 0;
            else if (m.includes('CREDIT')) e.credit += s.total || 0;
            else e.cash += s.total || 0;
        });
        return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
    }, [rangeSales, dateFrom, dateTo]);

    // ══════════════════════════════════════════════════════════════════
    // CHART CONFIGS (Premium Fine Charts)
    // ══════════════════════════════════════════════════════════════════
    const chartLabels = dailyTrend.map(d => { const dt = new Date(d.date); return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }); });

    const revenueLineData = {
        labels: chartLabels,
        datasets: [
            { label: 'Total Sales', data: dailyTrend.map(d => d.total), borderColor: '#0284c7', backgroundColor: 'rgba(2,132,199,0.06)', fill: true, tension: 0.4, borderWidth: 2.5, pointRadius: dailyTrend.length > 14 ? 0 : 3.5, pointHoverRadius: 5, pointBackgroundColor: '#0284c7' },
            { label: 'Cash', data: dailyTrend.map(d => d.cash), borderColor: '#10b981', fill: false, tension: 0.4, borderWidth: 1.8, pointRadius: 0 },
            { label: 'M-Pesa', data: dailyTrend.map(d => d.mpesa), borderColor: '#f59e0b', fill: false, tension: 0.4, borderWidth: 1.8, pointRadius: 0 },
            { label: 'Credit', data: dailyTrend.map(d => d.credit), borderColor: '#8b5cf6', fill: false, tension: 0.4, borderWidth: 1.8, pointRadius: 0, borderDash: [4, 4] },
        ],
    };

    const lineOpts: any = {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: { position: 'top', labels: { boxWidth: 8, usePointStyle: true, font: { size: 10, weight: 600, family: "'Inter', sans-serif" }, color: '#334155', padding: 12 } },
            tooltip: { backgroundColor: 'rgba(15,23,42,0.95)', padding: 10, cornerRadius: 8, titleFont: { size: 11, weight: 'bold' }, bodyFont: { size: 10 }, callbacks: { label: (c: any) => ` ${c.dataset.label}: KSh ${(c.parsed.y || 0).toLocaleString()}` } },
        },
        scales: { x: { grid: { display: false }, ticks: { font: { size: 9 }, color: '#94a3b8' } }, y: { grid: { color: 'rgba(226,232,240,0.5)' }, ticks: { font: { size: 9 }, color: '#94a3b8', callback: (v: any) => `KSh ${Number(v).toLocaleString()}` } } },
    };

    const paymentBarData = {
        labels: chartLabels,
        datasets: [
            { label: 'Cash', data: dailyTrend.map(d => d.cash), backgroundColor: 'rgba(16,185,129,0.75)', borderRadius: 4, barPercentage: 0.65 },
            { label: 'M-Pesa', data: dailyTrend.map(d => d.mpesa), backgroundColor: 'rgba(245,158,11,0.75)', borderRadius: 4, barPercentage: 0.65 },
            { label: 'Credit', data: dailyTrend.map(d => d.credit), backgroundColor: 'rgba(139,92,246,0.7)', borderRadius: 4, barPercentage: 0.65 },
        ],
    };

    const barOpts: any = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { boxWidth: 8, usePointStyle: true, font: { size: 10, weight: 600 }, color: '#334155', padding: 12 } }, tooltip: { backgroundColor: 'rgba(15,23,42,0.95)', padding: 10, cornerRadius: 8, callbacks: { label: (c: any) => ` ${c.dataset.label}: KSh ${(c.parsed.y || 0).toLocaleString()}` } } },
        scales: { x: { grid: { display: false }, ticks: { font: { size: 9 }, color: '#94a3b8', maxRotation: 45 }, stacked: true }, y: { grid: { color: 'rgba(226,232,240,0.5)' }, ticks: { font: { size: 9 }, color: '#94a3b8', callback: (v: any) => `KSh ${Number(v).toLocaleString()}` }, stacked: true } },
    };

    const donutData = {
        labels: ['Cash', 'M-Pesa', 'Credit'],
        datasets: [{ data: [todayPayments.cash || 0.01, todayPayments.mpesa || 0.01, todayPayments.credit || 0.01], backgroundColor: ['#10b981', '#f59e0b', '#8b5cf6'], borderWidth: 0, cutout: '72%' }],
    };

    const staffBarData = {
        labels: staffPerf.map(s => s.name),
        datasets: [{ label: 'Revenue (KSh)', data: staffPerf.map(s => s.total), backgroundColor: staffPerf.map((_, i) => ['#0284c7', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6', '#e11d48'][i % 10]), borderRadius: 6, barPercentage: 0.55 }],
    };

    const staffBarOpts: any = {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(15,23,42,0.95)', padding: 10, cornerRadius: 8, callbacks: { label: (c: any) => `Revenue: KSh ${(c.parsed.x || 0).toLocaleString()}` } } },
        scales: { x: { grid: { color: 'rgba(226,232,240,0.5)' }, ticks: { font: { size: 9 }, color: '#94a3b8', callback: (v: any) => `KSh ${Number(v).toLocaleString()}` } }, y: { grid: { display: false }, ticks: { font: { size: 10, weight: 600 }, color: '#334155' } } },
    };

    // Helpers
    const fmt = (n: number) => { if (!n) return '0'; if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`; if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`; return n.toLocaleString(); };
    const pct = (v: number) => v >= 0 ? `+${v.toFixed(1)}%` : `${v.toFixed(1)}%`;

    // ══════════════════════════════════════════════════════════════════
    // EXCEL XML EXPORT
    // ══════════════════════════════════════════════════════════════════
    const exportExcel = () => {
        const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const xml = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="H"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1e3a5f" ss:Pattern="Solid"/></Style><Style ss:ID="N"><NumberFormat ss:Format="#,##0"/></Style><Style ss:ID="B"><Font ss:Bold="1"/></Style></Styles><Worksheet ss:Name="Executive Summary"><Table><Row><Cell ss:StyleID="B"><Data ss:Type="String">PHARMACY EXECUTIVE DASHBOARD REPORT</Data></Cell></Row><Row><Cell><Data ss:Type="String">Period: ${dateFrom} to ${dateTo}</Data></Cell></Row><Row/><Row><Cell ss:StyleID="H"><Data ss:Type="String">Metric</Data></Cell><Cell ss:StyleID="H"><Data ss:Type="String">Value (KSh)</Data></Cell></Row><Row><Cell><Data ss:Type="String">Period Revenue</Data></Cell><Cell ss:StyleID="N"><Data ss:Type="Number">${rangeRevenue}</Data></Cell></Row><Row><Cell><Data ss:Type="String">Today Revenue</Data></Cell><Cell ss:StyleID="N"><Data ss:Type="Number">${todayRevenue}</Data></Cell></Row><Row><Cell><Data ss:Type="String">Cash Collections</Data></Cell><Cell ss:StyleID="N"><Data ss:Type="Number">${payments.cash}</Data></Cell></Row><Row><Cell><Data ss:Type="String">M-Pesa Collections</Data></Cell><Cell ss:StyleID="N"><Data ss:Type="Number">${payments.mpesa}</Data></Cell></Row><Row><Cell><Data ss:Type="String">Stock Valuation (Retail)</Data></Cell><Cell ss:StyleID="N"><Data ss:Type="Number">${inventory.retailVal}</Data></Cell></Row><Row><Cell><Data ss:Type="String">Expiry Risk Value</Data></Cell><Cell ss:StyleID="N"><Data ss:Type="Number">${expiry.riskVal}</Data></Cell></Row><Row><Cell><Data ss:Type="String">Operating Expenses</Data></Cell><Cell ss:StyleID="N"><Data ss:Type="Number">${expenseMetrics.total}</Data></Cell></Row><Row><Cell><Data ss:Type="String">Net Estimated Profit</Data></Cell><Cell ss:StyleID="N"><Data ss:Type="Number">${netMargin.net}</Data></Cell></Row></Table></Worksheet></Workbook>`;
        const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `Pharmacy_Dashboard_${ts}.xls`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    };

    // ══════════════════════════════════════════════════════════════════
    // RENDER — EXACT stock-movement TYPOGRAPHY
    // ══════════════════════════════════════════════════════════════════
    return (
        <div className="w-full max-w-full space-y-3.5 px-1 md:px-2 text-gray-900" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

            {/* ═══ HEADER BAR ═══ */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white text-xl shadow-md flex-shrink-0">💊</div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Pharmacy Executive Dashboard</h1>
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold border border-emerald-200 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live DB
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 font-medium">Real-time dispensing analytics, batch expiry surveillance, inventory intelligence &amp; fiscal reconciliation</p>
                    </div>
                </div>
                <div className="flex items-center flex-wrap gap-2">
                    <button onClick={() => loadData(true)} disabled={isRefreshing} className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-bold shadow-xs transition-all flex items-center gap-1 text-xs disabled:opacity-50">
                        <span className={isRefreshing ? 'animate-spin' : ''}>🔄</span> {isRefreshing ? 'Syncing...' : 'Live Sync'}
                    </button>
                    <button onClick={exportExcel} className="px-3 py-1.5 bg-white hover:bg-gray-50 text-emerald-700 border border-emerald-200 rounded-lg font-bold shadow-xs transition-all flex items-center gap-1 text-xs">📊 Excel Export</button>
                    <button onClick={() => window.print()} className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-bold shadow-xs transition-all flex items-center gap-1 text-xs">🖨️ Print</button>
                </div>
            </div>

            {/* ═══ ALERT BANNER ═══ */}
            {(expiry.expired > 0 || expiry.exp7 > 0 || inventory.outOfStock > 0) && (
                <div className="bg-gradient-to-r from-red-500 via-orange-500 to-amber-500 rounded-xl px-4 py-2.5 text-white flex items-center justify-between shadow-md">
                    <div className="flex items-center gap-2.5">
                        <span className="text-xl animate-pulse">🚨</span>
                        <div>
                            <p className="text-xs font-bold">Pharmacy Priority Alerts</p>
                            <p className="text-[10px] opacity-90">
                                {expiry.expired > 0 && `${expiry.expired} EXPIRED batches • `}
                                {expiry.exp7 > 0 && `${expiry.exp7} expiring ≤7 days • `}
                                {inventory.outOfStock > 0 && `${inventory.outOfStock} items OUT OF STOCK`}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-1.5">
                        <a href="/dashboard/expiry-register" className="px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-[10px] font-bold transition">Expiry Register →</a>
                        <a href="/dashboard/low-stock" className="px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-[10px] font-bold transition">Stock Alerts →</a>
                    </div>
                </div>
            )}

            {/* ═══ DATE PRESETS ═══ */}
            <div className="bg-white p-2.5 rounded-xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mr-1">📅 Horizon:</span>
                    {[{ id: '1d', l: 'Today' }, { id: '7d', l: '7 Days' }, { id: '14d', l: '14 Days' }, { id: '30d', l: '30 Days' }, { id: 'mtd', l: 'This Month' }, { id: 'qtd', l: 'Quarter' }, { id: 'ytd', l: 'Year' }].map(p => (
                        <button key={p.id} onClick={() => applyPreset(p.id)} className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${datePreset === p.id ? 'bg-emerald-600 text-white shadow-sm' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'}`}>{p.l}</button>
                    ))}
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                    <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setDatePreset('custom'); }} className="px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:outline-none focus:border-emerald-500" />
                    <span className="text-gray-400 font-bold">→</span>
                    <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setDatePreset('custom'); }} className="px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:outline-none focus:border-emerald-500" />
                </div>
            </div>

            {/* ═══ MODULE FILTER PILLS ═══ */}
            <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-xs flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider px-1">🔬 Module:</span>
                {[
                    { id: 'overview', l: '🌐 Enterprise 360°' },
                    { id: 'dispensing', l: '💊 Dispensing & Sales' },
                    { id: 'inventory', l: '📦 Inventory & Stockouts' },
                    { id: 'expiry', l: '⏰ Batch Expiry' },
                    { id: 'procurement', l: '🛒 Procurement' },
                    { id: 'financials', l: '💰 Financials' },
                    { id: 'staff', l: '👨‍⚕️ Staff Performance' },
                ].map(m => (
                    <button key={m.id} onClick={() => setActiveModule(m.id)} className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${activeModule === m.id ? 'bg-emerald-600 text-white shadow-sm' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'}`}>{m.l}</button>
                ))}
            </div>

            {/* ═══ 12 KPI METRIC CARDS — ROW 1 (SALES & DISPENSING) ═══ */}
            {(activeModule === 'overview' || activeModule === 'dispensing' || activeModule === 'financials') && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                    {/* 1. Today Sales */}
                    <div className="bg-gradient-to-br from-emerald-50/80 via-teal-50/40 to-white p-3 rounded-xl border border-emerald-200/80 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Today&apos;s Sales</span>
                            <span className="text-sm">💊</span>
                        </div>
                        <div className="mt-1.5">
                            <div className="text-lg font-black text-emerald-950 tracking-tight">KSh {fmt(todayRevenue)}</div>
                            <div className="text-[10px] font-bold text-emerald-700 mt-0.5">{todaySales.length} Prescriptions</div>
                        </div>
                        <div className="mt-1 flex items-center gap-1">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${salesGrowth >= 0 ? 'bg-emerald-200 text-emerald-900' : 'bg-red-200 text-red-900'}`}>{pct(salesGrowth)}</span>
                            <span className="text-[9px] text-gray-500">vs yesterday</span>
                        </div>
                    </div>

                    {/* 2. Period Revenue */}
                    <div className="bg-gradient-to-br from-sky-50/80 via-blue-50/40 to-white p-3 rounded-xl border border-sky-200/80 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-sky-800 uppercase tracking-wider">Period Revenue</span>
                            <span className="text-sm">📈</span>
                        </div>
                        <div className="mt-1.5">
                            <div className="text-lg font-black text-sky-950 tracking-tight">KSh {fmt(rangeRevenue)}</div>
                            <div className="text-[10px] font-bold text-sky-700 mt-0.5">{rangeSales.length} Total Orders</div>
                        </div>
                        <div className="mt-1 text-[9px] text-gray-500">Avg Ticket: KSh {avgOrderValue.toLocaleString()}</div>
                    </div>

                    {/* 3. Cash Collections */}
                    <div className="bg-gradient-to-br from-teal-50/80 via-emerald-50/40 to-white p-3 rounded-xl border border-teal-200/80 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-teal-800 uppercase tracking-wider">Cash Drawer</span>
                            <span className="text-sm">💵</span>
                        </div>
                        <div className="mt-1.5">
                            <div className="text-lg font-black text-teal-950 tracking-tight">KSh {fmt(payments.cash)}</div>
                            <div className="text-[10px] font-bold text-teal-700 mt-0.5">{payments.total > 0 ? ((payments.cash / payments.total) * 100).toFixed(0) : 0}% of total</div>
                        </div>
                        <div className="mt-1 text-[9px] text-gray-500">Today: KSh {todayPayments.cash.toLocaleString()}</div>
                    </div>

                    {/* 4. M-Pesa */}
                    <div className="bg-gradient-to-br from-amber-50/80 via-yellow-50/40 to-white p-3 rounded-xl border border-amber-200/80 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">M-Pesa Mobile</span>
                            <span className="text-sm">📱</span>
                        </div>
                        <div className="mt-1.5">
                            <div className="text-lg font-black text-amber-950 tracking-tight">KSh {fmt(payments.mpesa)}</div>
                            <div className="text-[10px] font-bold text-amber-700 mt-0.5">{payments.total > 0 ? ((payments.mpesa / payments.total) * 100).toFixed(0) : 0}% of total</div>
                        </div>
                        <div className="mt-1 text-[9px] text-gray-500">Today: KSh {todayPayments.mpesa.toLocaleString()}</div>
                    </div>

                    {/* 5. Credit / Insured */}
                    <div className="bg-gradient-to-br from-violet-50/80 via-purple-50/40 to-white p-3 rounded-xl border border-violet-200/80 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-violet-800 uppercase tracking-wider">Credit / Insured</span>
                            <span className="text-sm">🏦</span>
                        </div>
                        <div className="mt-1.5">
                            <div className="text-lg font-black text-violet-950 tracking-tight">KSh {fmt(payments.credit)}</div>
                            <div className="text-[10px] font-bold text-violet-700 mt-0.5">{payments.total > 0 ? ((payments.credit / payments.total) * 100).toFixed(0) : 0}% of total</div>
                        </div>
                        <div className="mt-1 text-[9px] text-gray-500">Today: KSh {todayPayments.credit.toLocaleString()}</div>
                    </div>

                    {/* 6. Net Operating Margin */}
                    <div className="bg-gradient-to-br from-indigo-50/80 via-blue-50/40 to-white p-3 rounded-xl border border-indigo-200/80 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider">Net Margin</span>
                            <span className="text-sm">📊</span>
                        </div>
                        <div className="mt-1.5">
                            <div className="text-lg font-black text-indigo-950 tracking-tight">{netMargin.pct.toFixed(1)}%</div>
                            <div className="text-[10px] font-bold text-indigo-700 mt-0.5">KSh {fmt(netMargin.net)} net</div>
                        </div>
                        <div className="mt-1 text-[9px] text-gray-500">Gross: KSh {fmt(netMargin.gross)}</div>
                    </div>
                </div>
            )}

            {/* ═══ 12 KPI METRIC CARDS — ROW 2 (INVENTORY & OPERATIONS) ═══ */}
            {(activeModule === 'overview' || activeModule === 'inventory' || activeModule === 'expiry' || activeModule === 'procurement') && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                    {/* 7. Stock Valuation */}
                    <div className="bg-gradient-to-br from-cyan-50/80 via-blue-50/40 to-white p-3 rounded-xl border border-cyan-200/80 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-cyan-800 uppercase tracking-wider">Stock Value</span>
                            <span className="text-sm">📦</span>
                        </div>
                        <div className="mt-1.5">
                            <div className="text-lg font-black text-cyan-950 tracking-tight">KSh {fmt(inventory.retailVal)}</div>
                            <div className="text-[10px] font-bold text-cyan-700 mt-0.5">Cost: KSh {fmt(inventory.costVal)}</div>
                        </div>
                        <div className="mt-1 text-[9px] text-gray-500">{batches.length} Active Lots</div>
                    </div>

                    {/* 8. Out of Stock */}
                    <div className="bg-gradient-to-br from-rose-50/80 via-red-50/40 to-white p-3 rounded-xl border border-rose-200/80 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider">Out of Stock</span>
                            <span className="text-sm">❌</span>
                        </div>
                        <div className="mt-1.5">
                            <div className="text-lg font-black text-rose-950 tracking-tight">{inventory.outOfStock} Items</div>
                            <div className="text-[10px] font-bold text-rose-700 mt-0.5">+{inventory.critical} Critical</div>
                        </div>
                        <div className="mt-1 text-[9px] text-gray-500">Restock: KSh {fmt(inventory.restockCost)}</div>
                    </div>

                    {/* 9. Expired Batches */}
                    <div className="bg-gradient-to-br from-red-50/80 via-orange-50/40 to-white p-3 rounded-xl border border-red-200/80 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-red-800 uppercase tracking-wider">Expired</span>
                            <span className="text-sm">🔴</span>
                        </div>
                        <div className="mt-1.5">
                            <div className="text-lg font-black text-red-950 tracking-tight">{expiry.expired} Batches</div>
                            <div className="text-[10px] font-bold text-red-700 mt-0.5">{expiry.exp7} exp ≤7d • {expiry.exp30} ≤30d</div>
                        </div>
                        <div className="mt-1 text-[9px] text-gray-500">Risk: KSh {fmt(expiry.riskVal)}</div>
                    </div>

                    {/* 10. Expenses */}
                    <div className="bg-gradient-to-br from-pink-50/80 via-rose-50/40 to-white p-3 rounded-xl border border-pink-200/80 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-pink-800 uppercase tracking-wider">Expenses</span>
                            <span className="text-sm">💸</span>
                        </div>
                        <div className="mt-1.5">
                            <div className="text-lg font-black text-pink-950 tracking-tight">KSh {fmt(expenseMetrics.total)}</div>
                            <div className="text-[10px] font-bold text-pink-700 mt-0.5">{expenseMetrics.byCategory.length} Categories</div>
                        </div>
                        <div className="mt-1 text-[9px] text-gray-500">{expenses.length} Records</div>
                    </div>

                    {/* 11. Supplier Debt */}
                    <div className="bg-gradient-to-br from-orange-50/80 via-amber-50/40 to-white p-3 rounded-xl border border-orange-200/80 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-orange-800 uppercase tracking-wider">Supplier Debt</span>
                            <span className="text-sm">🛒</span>
                        </div>
                        <div className="mt-1.5">
                            <div className="text-lg font-black text-orange-950 tracking-tight">KSh {fmt(procurement.supplierDebt)}</div>
                            <div className="text-[10px] font-bold text-orange-700 mt-0.5">{procurement.pending} Pending POs</div>
                        </div>
                        <div className="mt-1 text-[9px] text-gray-500">Purchases: KSh {fmt(procurement.total)}</div>
                    </div>

                    {/* 12. Shifts */}
                    <div className="bg-gradient-to-br from-blue-50/80 via-indigo-50/40 to-white p-3 rounded-xl border border-blue-200/80 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">Shift Drawer</span>
                            <span className="text-sm">🔄</span>
                        </div>
                        <div className="mt-1.5">
                            <div className="text-lg font-black text-blue-950 tracking-tight">{shiftMetrics.active} Active</div>
                            <div className="text-[10px] font-bold text-blue-700 mt-0.5">{shiftMetrics.closed} Closed</div>
                        </div>
                        <div className="mt-1 text-[9px] text-gray-500">Shift Sales: KSh {fmt(shiftMetrics.totalShiftSales)}</div>
                    </div>
                </div>
            )}

            {/* ═══ INTELLIGENT INSIGHTS ADVISORY PANEL ═══ */}
            {(activeModule === 'overview' || activeModule === 'inventory' || activeModule === 'expiry') && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    <div className="bg-white p-3 rounded-xl border-l-4 border-l-rose-500 border border-gray-200 shadow-xs">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm">🔬</span>
                            <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider">Expiry Quarantine Protocol</span>
                        </div>
                        <p className="text-[11px] text-gray-600 leading-snug">
                            {expiry.expired > 0
                                ? `${expiry.expired} expired batches require immediate quarantine. At-risk inventory value KSh ${fmt(expiry.riskVal)}.`
                                : expiry.exp30 > 0
                                ? `${expiry.exp30} batches expiring within 30 days. Consider clearance discounts.`
                                : 'All batches within safe expiry horizons. No quarantine action needed.'}
                        </p>
                        <a href="/dashboard/expiry-register" className="text-[10px] font-bold text-rose-600 hover:text-rose-800 mt-1.5 inline-block">Review Batches →</a>
                    </div>
                    <div className="bg-white p-3 rounded-xl border-l-4 border-l-amber-500 border border-gray-200 shadow-xs">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm">📦</span>
                            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Formulary Depletion Risk</span>
                        </div>
                        <p className="text-[11px] text-gray-600 leading-snug">
                            {inventory.deficits.length > 0
                                ? `${inventory.deficits.slice(0, 3).map(d => d.name).join(', ')} are below safety par. Estimated restocking capital KSh ${fmt(inventory.restockCost)}.`
                                : 'All medications are stocked above safety buffer levels.'}
                        </p>
                        <a href="/dashboard/low-stock" className="text-[10px] font-bold text-amber-600 hover:text-amber-800 mt-1.5 inline-block">View Deficits →</a>
                    </div>
                    <div className="bg-white p-3 rounded-xl border-l-4 border-l-emerald-500 border border-gray-200 shadow-xs">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm">💰</span>
                            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Cash Flow Health</span>
                        </div>
                        <p className="text-[11px] text-gray-600 leading-snug">
                            Cash collections KSh {fmt(payments.cash)}, M-Pesa inflows KSh {fmt(payments.mpesa)}. Net operating margin estimated at {netMargin.pct.toFixed(1)}% for the reporting period.
                        </p>
                        <a href="/dashboard/shift-reports" className="text-[10px] font-bold text-emerald-600 hover:text-emerald-800 mt-1.5 inline-block">Shift Reports →</a>
                    </div>
                </div>
            )}

            {/* ═══ CHARTS ROW 1: Revenue Trend + Payment Donut ═══ */}
            {(activeModule === 'overview' || activeModule === 'dispensing') && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    <div className="lg:col-span-2 bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs">
                        <div className="flex items-center justify-between mb-2.5">
                            <div className="flex items-center gap-2">
                                <span className="w-7 h-7 rounded-lg bg-sky-100 flex items-center justify-center text-xs">📈</span>
                                <div>
                                    <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Dispensing Revenue Velocity</h3>
                                    <p className="text-[10px] text-gray-500 font-medium">Total: KSh {rangeRevenue.toLocaleString()} across selected horizon</p>
                                </div>
                            </div>
                        </div>
                        <div style={{ height: '260px' }}>{dailyTrend.length > 0 ? <Line data={revenueLineData} options={lineOpts} /> : <div className="h-full flex items-center justify-center text-gray-400 text-sm">📊 No sales data</div>}</div>
                    </div>
                    <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center text-xs">💳</span>
                            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Today&apos;s Payment Split</h3>
                        </div>
                        <div style={{ height: '170px' }} className="relative flex items-center justify-center">
                            <Doughnut data={donutData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <p className="text-sm font-black text-gray-900">KSh {fmt(todayPayments.total)}</p>
                                <p className="text-[9px] text-gray-500 uppercase font-bold">Total</p>
                            </div>
                        </div>
                        <div className="mt-3 space-y-1.5 pt-2 border-t border-gray-100">
                            {[{ l: 'Cash', v: todayPayments.cash, c: '#10b981' }, { l: 'M-Pesa', v: todayPayments.mpesa, c: '#f59e0b' }, { l: 'Credit', v: todayPayments.credit, c: '#8b5cf6' }].map(m => (
                                <div key={m.l} className="flex items-center justify-between text-[11px]">
                                    <span className="flex items-center gap-1.5 text-gray-600"><span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: m.c }} /> {m.l}</span>
                                    <span className="font-bold text-gray-800">KSh {m.v.toLocaleString()} <span className="text-[9px] text-gray-400 ml-0.5">{todayPayments.total > 0 ? ((m.v / todayPayments.total) * 100).toFixed(0) : 0}%</span></span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ CHARTS ROW 2: Stacked Payment Bars + Staff Performance ═══ */}
            {(activeModule === 'overview' || activeModule === 'dispensing' || activeModule === 'financials' || activeModule === 'staff') && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs">
                        <div className="flex items-center gap-2 mb-2.5">
                            <span className="w-7 h-7 rounded-lg bg-teal-100 flex items-center justify-center text-xs">📊</span>
                            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Payment Method Comparison (Stacked)</h3>
                        </div>
                        <div style={{ height: '250px' }}>{dailyTrend.length > 0 ? <Bar data={paymentBarData} options={barOpts} /> : <div className="h-full flex items-center justify-center text-gray-400 text-sm">No data</div>}</div>
                    </div>
                    <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs">
                        <div className="flex items-center gap-2 mb-2.5">
                            <span className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center text-xs">👨‍⚕️</span>
                            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Pharmacist Dispensing Leaderboard</h3>
                        </div>
                        <div style={{ height: '250px' }}>{staffPerf.length > 0 ? <Bar data={staffBarData} options={staffBarOpts} /> : <div className="h-full flex items-center justify-center text-gray-400 text-sm">No staff data</div>}</div>
                    </div>
                </div>
            )}

            {/* ═══ MASSIVE MULTI-TAB DATA GRID ═══ */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
                {/* Tab Buttons */}
                <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1 flex-wrap">
                        {[
                            { id: 'bestSellers', l: '🔥 Best Sellers', c: rangeSales.length },
                            { id: 'stockAlerts', l: '⚠️ Stock Alerts', c: inventory.deficits.length, alert: inventory.deficits.length > 0 },
                            { id: 'expiry', l: '⏰ Expiry Watch', c: batches.length, alert: expiry.expired > 0 },
                            { id: 'purchases', l: '🛒 Purchases', c: purchases.length },
                            { id: 'expenses', l: '💸 Expenses', c: expenses.length },
                            { id: 'shifts', l: '🔄 Shifts', c: shifts.length },
                        ].map(t => (
                            <button key={t.id} onClick={() => { setGridTab(t.id as any); setGridSearch(''); }} className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${gridTab === t.id ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}>
                                {t.l}
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-extrabold ${t.alert ? 'bg-rose-500 text-white animate-pulse' : gridTab === t.id ? 'bg-emerald-800 text-white' : 'bg-gray-100 text-gray-600'}`}>{t.c}</span>
                            </button>
                        ))}
                    </div>
                    <div className="relative">
                        <span className="absolute left-2.5 top-1.5 text-gray-400 text-xs">🔎</span>
                        <input type="text" placeholder="Filter..." value={gridSearch} onChange={e => setGridSearch(e.target.value)} className="pl-8 pr-3 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-800 placeholder-gray-400 focus:outline-none focus:border-emerald-500 w-40 sm:w-52" />
                    </div>
                </div>

                {/* Grid Content */}
                <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                    {/* Best Sellers */}
                    {gridTab === 'bestSellers' && (() => {
                        const prodMap = new Map<string, { qty: number; revenue: number }>();
                        rangeSales.forEach((s: any) => {
                            const name = s.customer_name ? `Sale ${s.receipt_no}` : `RX ${s.receipt_no}`;
                            // Use receipt as proxy since we don't have sales_items table
                        });
                        // Show sales as rows
                        const q = gridSearch.toLowerCase();
                        const filtered = rangeSales.filter((s: any) => !q || (s.receipt_no || '').toLowerCase().includes(q) || (s.cashier_name || '').toLowerCase().includes(q) || (s.customer_name || '').toLowerCase().includes(q) || (s.payment_method || '').toLowerCase().includes(q));
                        return (
                            <table className="w-full text-left text-xs border-collapse">
                                <thead className="sticky top-0 z-10"><tr className="bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-700 text-white text-[10px] uppercase font-bold tracking-wider">
                                    <th className="py-2 px-2.5">#</th><th className="py-2 px-2.5">Receipt</th><th className="py-2 px-2.5">Date &amp; Time</th><th className="py-2 px-2.5">Pharmacist</th><th className="py-2 px-2.5">Customer</th><th className="py-2 px-2.5">Payment</th><th className="py-2 px-2.5 text-right">Total (KSh)</th><th className="py-2 px-2.5 text-center">Status</th>
                                </tr></thead>
                                <tbody className="divide-y divide-gray-50">
                                    {filtered.slice(0, 30).map((s: any, i: number) => (
                                        <tr key={s.sale_id || i} className="hover:bg-emerald-50/40 transition-colors">
                                            <td className="py-1.5 px-2.5"><span className={`w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold text-white ${i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-amber-700' : 'bg-gray-300'}`}>{i + 1}</span></td>
                                            <td className="py-1.5 px-2.5 font-mono font-bold text-emerald-700">{s.receipt_no}</td>
                                            <td className="py-1.5 px-2.5 font-mono text-gray-500 text-[11px]">{s.sale_datetime ? s.sale_datetime.replace('T', ' ').slice(0, 16) : '-'}</td>
                                            <td className="py-1.5 px-2.5 font-semibold text-gray-800">{s.cashier_name || 'Pharmacist'}</td>
                                            <td className="py-1.5 px-2.5 text-gray-600">{s.customer_name || 'Walk-in'}</td>
                                            <td className="py-1.5 px-2.5"><span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${(s.payment_method || '').toUpperCase().includes('CASH') ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : (s.payment_method || '').toUpperCase().includes('MPESA') ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-violet-100 text-violet-800 border border-violet-200'}`}>{s.payment_method || 'CASH'}</span></td>
                                            <td className="py-1.5 px-2.5 text-right font-mono font-bold text-gray-900">KSh {(s.total || 0).toLocaleString()}</td>
                                            <td className="py-1.5 px-2.5 text-center"><span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold border border-emerald-200">{s.status || 'Completed'}</span></td>
                                        </tr>
                                    ))}
                                    {filtered.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-gray-400">No sales data found</td></tr>}
                                </tbody>
                            </table>
                        );
                    })()}

                    {/* Stock Alerts */}
                    {gridTab === 'stockAlerts' && (() => {
                        const q = gridSearch.toLowerCase();
                        const filtered = inventory.deficits.filter(d => !q || d.name.toLowerCase().includes(q) || d.category.toLowerCase().includes(q));
                        return (
                            <table className="w-full text-left text-xs border-collapse">
                                <thead className="sticky top-0 z-10"><tr className="bg-gradient-to-r from-rose-700 via-red-700 to-orange-700 text-white text-[10px] uppercase font-bold tracking-wider">
                                    <th className="py-2 px-2.5">Medication</th><th className="py-2 px-2.5">Category</th><th className="py-2 px-2.5 text-right">Current</th><th className="py-2 px-2.5 text-right">Par Level</th><th className="py-2 px-2.5 text-right">Deficit</th><th className="py-2 px-2.5 text-right">Restock Cost</th><th className="py-2 px-2.5">Supplier</th><th className="py-2 px-2.5 text-center">Urgency</th>
                                </tr></thead>
                                <tbody className="divide-y divide-gray-50">
                                    {filtered.map((d, i) => (
                                        <tr key={i} className={`transition-colors ${d.status === 'OUT' ? 'bg-rose-50/60 hover:bg-rose-50' : 'hover:bg-gray-50'}`}>
                                            <td className="py-1.5 px-2.5 font-bold text-gray-900">{d.name}</td>
                                            <td className="py-1.5 px-2.5 text-gray-600">{d.category}</td>
                                            <td className={`py-1.5 px-2.5 text-right font-mono font-bold ${d.stock === 0 ? 'text-rose-700' : 'text-amber-700'}`}>{d.stock}</td>
                                            <td className="py-1.5 px-2.5 text-right font-mono text-gray-600">{d.par}</td>
                                            <td className="py-1.5 px-2.5 text-right font-mono font-bold text-rose-700">-{d.deficit}</td>
                                            <td className="py-1.5 px-2.5 text-right font-mono font-bold text-gray-900">KSh {d.cost.toLocaleString()}</td>
                                            <td className="py-1.5 px-2.5 text-gray-700">{d.supplier}</td>
                                            <td className="py-1.5 px-2.5 text-center"><span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${d.status === 'OUT' ? 'bg-rose-200 text-rose-900' : d.status === 'CRITICAL' ? 'bg-orange-200 text-orange-900' : 'bg-yellow-200 text-yellow-900'}`}>{d.status === 'OUT' ? '❌ OUT' : d.status === 'CRITICAL' ? '🔴 CRITICAL' : '🟡 LOW'}</span></td>
                                        </tr>
                                    ))}
                                    {filtered.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-gray-400">✅ All items above safety par</td></tr>}
                                </tbody>
                            </table>
                        );
                    })()}

                    {/* Expiry Watch */}
                    {gridTab === 'expiry' && (() => {
                        const q = gridSearch.toLowerCase();
                        const filtered = batches.filter((b: any) => !q || (b.batch_number || '').toLowerCase().includes(q) || (b.supplier_name || '').toLowerCase().includes(q));
                        return (
                            <table className="w-full text-left text-xs border-collapse">
                                <thead className="sticky top-0 z-10"><tr className="bg-gradient-to-r from-amber-700 via-orange-700 to-red-700 text-white text-[10px] uppercase font-bold tracking-wider">
                                    <th className="py-2 px-2.5">Batch #</th><th className="py-2 px-2.5">Expiry Date</th><th className="py-2 px-2.5 text-center">Days Left</th><th className="py-2 px-2.5 text-right">Remaining</th><th className="py-2 px-2.5 text-right">Cost/Unit</th><th className="py-2 px-2.5 text-right">At-Risk Value</th><th className="py-2 px-2.5">Supplier</th><th className="py-2 px-2.5 text-center">Status</th>
                                </tr></thead>
                                <tbody className="divide-y divide-gray-50">
                                    {filtered.slice(0, 30).map((b: any, i: number) => {
                                        const days = Math.ceil((new Date(b.expiry_date).getTime() - Date.now()) / 86400000);
                                        return (
                                            <tr key={b.batch_id || i} className={`transition-colors ${days < 0 ? 'bg-rose-50/50' : days <= 30 ? 'bg-amber-50/40' : 'hover:bg-gray-50'}`}>
                                                <td className="py-1.5 px-2.5 font-mono font-bold text-gray-700">{b.batch_number}</td>
                                                <td className="py-1.5 px-2.5 font-mono text-gray-600">{b.expiry_date}</td>
                                                <td className="py-1.5 px-2.5 text-center">{days < 0 ? <span className="text-rose-800 bg-rose-200 px-1.5 py-0.5 rounded text-[10px] font-bold">EXPIRED ({Math.abs(days)}d)</span> : days <= 30 ? <span className="text-amber-800 bg-amber-200 px-1.5 py-0.5 rounded text-[10px] font-bold">{days}d left</span> : <span className="text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded text-[10px] font-bold">{days}d</span>}</td>
                                                <td className="py-1.5 px-2.5 text-right font-mono font-bold text-gray-800">{b.remaining_qty}</td>
                                                <td className="py-1.5 px-2.5 text-right font-mono text-gray-600">KSh {b.purchase_cost || 0}</td>
                                                <td className="py-1.5 px-2.5 text-right font-mono font-bold text-gray-900">KSh {((b.remaining_qty || 0) * (b.purchase_cost || 0)).toLocaleString()}</td>
                                                <td className="py-1.5 px-2.5 text-gray-600">{b.supplier_name || '-'}</td>
                                                <td className="py-1.5 px-2.5 text-center"><span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${b.status === 'Quarantined' ? 'bg-rose-200 text-rose-900' : 'bg-emerald-100 text-emerald-800'}`}>{b.status || 'Active'}</span></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        );
                    })()}

                    {/* Purchases */}
                    {gridTab === 'purchases' && (() => {
                        const q = gridSearch.toLowerCase();
                        const filtered = purchases.filter((p: any) => !q || (p.purchase_no || '').toLowerCase().includes(q) || (p.supplier_name || '').toLowerCase().includes(q));
                        return (
                            <table className="w-full text-left text-xs border-collapse">
                                <thead className="sticky top-0 z-10"><tr className="bg-gradient-to-r from-cyan-700 via-blue-700 to-indigo-800 text-white text-[10px] uppercase font-bold tracking-wider">
                                    <th className="py-2 px-2.5">PO #</th><th className="py-2 px-2.5">Date</th><th className="py-2 px-2.5">Supplier</th><th className="py-2 px-2.5 text-right">Grand Total</th><th className="py-2 px-2.5 text-center">Status</th><th className="py-2 px-2.5 text-center">Payment</th>
                                </tr></thead>
                                <tbody className="divide-y divide-gray-50">
                                    {filtered.map((p: any, i: number) => (
                                        <tr key={p.purchase_id || i} className="hover:bg-gray-50 transition-colors">
                                            <td className="py-1.5 px-2.5 font-mono font-bold text-indigo-700">{p.purchase_no}</td>
                                            <td className="py-1.5 px-2.5 font-mono text-gray-600">{p.purchase_date}</td>
                                            <td className="py-1.5 px-2.5 font-bold text-gray-800">{p.supplier_name}</td>
                                            <td className="py-1.5 px-2.5 text-right font-mono font-bold text-gray-900">KSh {(p.grand_total || 0).toLocaleString()}</td>
                                            <td className="py-1.5 px-2.5 text-center"><span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${p.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{p.status || 'Pending'}</span></td>
                                            <td className="py-1.5 px-2.5 text-center"><span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${p.payment_status === 'Paid' ? 'bg-teal-100 text-teal-800' : 'bg-rose-100 text-rose-800'}`}>{p.payment_status || 'Pending'}</span></td>
                                        </tr>
                                    ))}
                                    {filtered.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-gray-400">No purchase records</td></tr>}
                                </tbody>
                            </table>
                        );
                    })()}

                    {/* Expenses */}
                    {gridTab === 'expenses' && (() => {
                        const q = gridSearch.toLowerCase();
                        const filtered = expenses.filter((e: any) => !q || (e.expense_name || '').toLowerCase().includes(q) || (e.category || '').toLowerCase().includes(q));
                        return (
                            <table className="w-full text-left text-xs border-collapse">
                                <thead className="sticky top-0 z-10"><tr className="bg-gradient-to-r from-pink-700 via-rose-700 to-red-700 text-white text-[10px] uppercase font-bold tracking-wider">
                                    <th className="py-2 px-2.5">Date</th><th className="py-2 px-2.5">Expense Title</th><th className="py-2 px-2.5">Category</th><th className="py-2 px-2.5">Payment</th><th className="py-2 px-2.5 text-right">Amount</th><th className="py-2 px-2.5">Description</th>
                                </tr></thead>
                                <tbody className="divide-y divide-gray-50">
                                    {filtered.map((e: any, i: number) => (
                                        <tr key={e.expense_id || i} className="hover:bg-gray-50 transition-colors">
                                            <td className="py-1.5 px-2.5 font-mono text-gray-600">{e.expense_date}</td>
                                            <td className="py-1.5 px-2.5 font-bold text-gray-900">{e.expense_name}</td>
                                            <td className="py-1.5 px-2.5 text-gray-700">{e.category}</td>
                                            <td className="py-1.5 px-2.5 text-gray-600">{e.payment_mode}</td>
                                            <td className="py-1.5 px-2.5 text-right font-mono font-bold text-rose-700">KSh {(e.amount || 0).toLocaleString()}</td>
                                            <td className="py-1.5 px-2.5 text-gray-500 text-[11px] truncate max-w-[200px]">{e.description || '-'}</td>
                                        </tr>
                                    ))}
                                    {filtered.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-gray-400">No expense records</td></tr>}
                                </tbody>
                            </table>
                        );
                    })()}

                    {/* Shifts */}
                    {gridTab === 'shifts' && (
                        <table className="w-full text-left text-xs border-collapse">
                            <thead className="sticky top-0 z-10"><tr className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-700 text-white text-[10px] uppercase font-bold tracking-wider">
                                <th className="py-2 px-2.5">Date</th><th className="py-2 px-2.5">Shift</th><th className="py-2 px-2.5">Opened By</th><th className="py-2 px-2.5 text-right">Opening Cash</th><th className="py-2 px-2.5 text-right">Shift Sales</th><th className="py-2 px-2.5 text-right">Closing Cash</th><th className="py-2 px-2.5 text-right">Net Sales</th><th className="py-2 px-2.5 text-center">Status</th>
                            </tr></thead>
                            <tbody className="divide-y divide-gray-50">
                                {shifts.map((s: any, i: number) => (
                                    <tr key={s.shift_id || i} className="hover:bg-gray-50 transition-colors">
                                        <td className="py-1.5 px-2.5 font-mono text-gray-600">{s.shift_date}</td>
                                        <td className="py-1.5 px-2.5 font-bold text-gray-800">{s.shift_type}</td>
                                        <td className="py-1.5 px-2.5 text-gray-600">{s.opened_by || 'Pharmacist'}</td>
                                        <td className="py-1.5 px-2.5 text-right font-mono text-gray-600">KSh {(s.opening_cash || 0).toLocaleString()}</td>
                                        <td className="py-1.5 px-2.5 text-right font-mono font-bold text-gray-800">KSh {(s.total_sales || 0).toLocaleString()}</td>
                                        <td className="py-1.5 px-2.5 text-right font-mono text-gray-600">KSh {(s.closing_cash || 0).toLocaleString()}</td>
                                        <td className="py-1.5 px-2.5 text-right font-mono font-bold text-emerald-700">KSh {(s.net_sales || 0).toLocaleString()}</td>
                                        <td className="py-1.5 px-2.5 text-center"><span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${s.status === 'Open' ? 'bg-emerald-200 text-emerald-900' : 'bg-gray-200 text-gray-700'}`}>{s.status}</span></td>
                                    </tr>
                                ))}
                                {shifts.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-gray-400">No shift records</td></tr>}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* ═══ QUICK ACTIONS NAVIGATION ═══ */}
            <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 rounded-xl p-4 text-white shadow-md">
                <h3 className="text-xs font-bold mb-2.5 flex items-center gap-2 uppercase tracking-wider">⚡ Quick Actions &amp; Pharmacy Modules</h3>
                <div className="grid grid-cols-4 md:grid-cols-8 lg:grid-cols-12 gap-2">
                    {[
                        { icon: '💊', label: 'POS', href: '/dashboard/pos' },
                        { icon: '📦', label: 'Products', href: '/dashboard/products' },
                        { icon: '📁', label: 'Categories', href: '/dashboard/categories' },
                        { icon: '🏷️', label: 'Batches', href: '/dashboard/batches' },
                        { icon: '📊', label: 'Stock Move', href: '/dashboard/stock-movement' },
                        { icon: '⚠️', label: 'Low Stock', href: '/dashboard/low-stock' },
                        { icon: '⏰', label: 'Expiry', href: '/dashboard/expiry-register' },
                        { icon: '📥', label: 'Purchase', href: '/dashboard/purchase' },
                        { icon: '📋', label: 'Purchases', href: '/dashboard/purchases' },
                        { icon: '↩️', label: 'Returns', href: '/dashboard/purchase-return' },
                        { icon: '👥', label: 'Suppliers', href: '/dashboard/suppliers' },
                        { icon: '💸', label: 'Expenses', href: '/dashboard/expenses' },
                        { icon: '📈', label: 'Sales', href: '/dashboard/sales' },
                        { icon: '🔄', label: 'Shifts', href: '/dashboard/shifts' },
                        { icon: '📑', label: 'Reports', href: '/dashboard/shift-reports' },
                        { icon: '👤', label: 'Users', href: '/dashboard/users' },
                        { icon: '🏦', label: 'Credit', href: '/dashboard/credit-customers' },
                        { icon: '💳', label: 'Payments', href: '/dashboard/credit-payments' },
                        { icon: '🎫', label: 'Vouchers', href: '/dashboard/vouchers' },
                        { icon: '💵', label: 'Advances', href: '/dashboard/advances' },
                        { icon: '🧾', label: 'Payroll', href: '/dashboard/payroll' },
                        { icon: '🏢', label: 'Company', href: '/dashboard/company' },
                        { icon: '🏪', label: 'Outlets', href: '/dashboard/outlets' },
                        { icon: '📊', label: 'Activity', href: '/dashboard/activity-log' },
                    ].map(a => (
                        <a key={a.label} href={a.href} className="flex flex-col items-center gap-1 p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all hover:scale-105 text-center">
                            <span className="text-lg">{a.icon}</span>
                            <span className="text-[9px] font-bold leading-tight">{a.label}</span>
                        </a>
                    ))}
                </div>
            </div>
        </div>
    );
}
