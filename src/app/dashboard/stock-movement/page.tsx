'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

// ==========================================
// TYPES & DATA CONTRACTS
// ==========================================
export type MovementType = 
    | 'PURCHASE_GRN'      // Stock received from vendor GRN
    | 'DISPENSED_SALE'    // Sold / dispensed via POS
    | 'STOCK_ADJUSTMENT'  // Physical stock count reconciliation (variance)
    | 'SUPPLIER_RETURN'   // Returned to supplier (debit note)
    | 'DAMAGE_EXPIRED'    // Written off due to expiry or damage
    | 'BIN_TRANSFER'      // Moved between internal storage locations
    | 'OPENING_STOCK';    // Initial opening inventory

export type StorageLocation = 
    | 'Main Store'
    | 'Dispensing Shelf'
    | 'Cold Chain (2-8°C)'
    | 'Quarantine Room'
    | 'Damaged Bay';

export interface StockMovementRecord {
    st_id: number;
    movement_id: string;          // Formatted display ID like SM-1002
    created_at: string;
    product_id: number;
    product_code: string;
    product_name: string;
    generic_name?: string;
    category: string;
    unit: string;
    batch_id: number | null;
    batch_number: string;
    expiry_date: string | null;
    movement_type: MovementType;
    invoice_no: string;           // GRN-xxx, RX-xxx, ADJ-xxx, PR-xxx, etc.
    storage_type: StorageLocation;
    qty_change: number;           // Positive for in, negative for out
    unit_cost: number;
    selling_price: number;
    total_cost_value: number;
    total_sales_value: number;
    running_balance?: number;
    operator_name: string;
    notes: string;
}

export interface ProductOption {
    pid: number;
    product_code: string;
    product_name: string;
    category: string;
    purchase_cost: number;
    sales_cost: number;
    purchase_unit: string;
    sales_unit: string;
    current_stock: number;
    batch_no?: string | null;
}

export interface BatchOption {
    batch_id: number;
    product_id: number;
    batch_number: string;
    expiry_date: string;
    remaining_qty: number;
    purchase_cost: number;
    selling_price: number;
    supplier_name?: string | null;
}

// ==========================================
// SEED FALLBACK DATA (For offline & instant load)
// ==========================================
const SEED_MOVEMENTS: StockMovementRecord[] = [
    {
        st_id: 101,
        movement_id: 'SM-1001',
        created_at: '2026-03-24T14:38:39.000Z',
        product_id: 1,
        product_code: 'MED-001',
        product_name: 'Amoxicillin 500mg Capsules',
        generic_name: 'Amoxicillin Trihydrate',
        category: 'Antibiotics',
        unit: 'Boxes (100s)',
        batch_id: 1,
        batch_number: 'AMX-2026-01',
        expiry_date: '2027-10-15',
        movement_type: 'PURCHASE_GRN',
        invoice_no: 'GRN-2026-001',
        storage_type: 'Main Store',
        qty_change: 150,
        unit_cost: 450,
        selling_price: 650,
        total_cost_value: 67500,
        total_sales_value: 97500,
        running_balance: 150,
        operator_name: 'Dr. Jimhawkins Korir',
        notes: 'Initial Goods Receipt Note from Radiant Pharmaceuticals Ltd'
    },
    {
        st_id: 102,
        movement_id: 'SM-1002',
        created_at: '2026-03-24T15:10:00.000Z',
        product_id: 1,
        product_code: 'MED-001',
        product_name: 'Amoxicillin 500mg Capsules',
        generic_name: 'Amoxicillin Trihydrate',
        category: 'Antibiotics',
        unit: 'Boxes (100s)',
        batch_id: 1,
        batch_number: 'AMX-2026-01',
        expiry_date: '2027-10-15',
        movement_type: 'BIN_TRANSFER',
        invoice_no: 'TRF-102',
        storage_type: 'Dispensing Shelf',
        qty_change: 25,
        unit_cost: 450,
        selling_price: 650,
        total_cost_value: 11250,
        total_sales_value: 16250,
        running_balance: 150,
        operator_name: 'Chief Pharmacist',
        notes: 'Transferred 25 boxes from Main Store to Front Counter Dispensing Shelf'
    },
    {
        st_id: 103,
        movement_id: 'SM-1003',
        created_at: '2026-03-24T16:22:40.000Z',
        product_id: 1,
        product_code: 'MED-001',
        product_name: 'Amoxicillin 500mg Capsules',
        generic_name: 'Amoxicillin Trihydrate',
        category: 'Antibiotics',
        unit: 'Boxes (100s)',
        batch_id: 1,
        batch_number: 'AMX-2026-01',
        expiry_date: '2027-10-15',
        movement_type: 'DISPENSED_SALE',
        invoice_no: 'RX-0001',
        storage_type: 'Dispensing Shelf',
        qty_change: -2,
        unit_cost: 450,
        selling_price: 650,
        total_cost_value: 900,
        total_sales_value: 1300,
        running_balance: 148,
        operator_name: 'Super Admin',
        notes: 'Dispensed on prescription for patient walk-in'
    },
    {
        st_id: 104,
        movement_id: 'SM-1004',
        created_at: '2026-03-24T16:45:10.000Z',
        product_id: 2,
        product_code: 'MED-002',
        product_name: 'Paracetamol 500mg Tablets',
        generic_name: 'Acetaminophen',
        category: 'Analgesics',
        unit: 'Packs (100s)',
        batch_id: 2,
        batch_number: 'PARA-892',
        expiry_date: '2028-01-20',
        movement_type: 'PURCHASE_GRN',
        invoice_no: 'GRN-2026-002',
        storage_type: 'Main Store',
        qty_change: 300,
        unit_cost: 120,
        selling_price: 200,
        total_cost_value: 36000,
        total_sales_value: 60000,
        running_balance: 300,
        operator_name: 'Dr. Jimhawkins Korir',
        notes: 'Intake batch received from Fresh Foods & Pharma Ltd'
    },
    {
        st_id: 105,
        movement_id: 'SM-1005',
        created_at: '2026-03-24T17:15:30.000Z',
        product_id: 2,
        product_code: 'MED-002',
        product_name: 'Paracetamol 500mg Tablets',
        generic_name: 'Acetaminophen',
        category: 'Analgesics',
        unit: 'Packs (100s)',
        batch_id: 2,
        batch_number: 'PARA-892',
        expiry_date: '2028-01-20',
        movement_type: 'DISPENSED_SALE',
        invoice_no: 'RX-0002',
        storage_type: 'Dispensing Shelf',
        qty_change: -5,
        unit_cost: 120,
        selling_price: 200,
        total_cost_value: 600,
        total_sales_value: 1000,
        running_balance: 295,
        operator_name: 'Cashier / Pharmacist',
        notes: 'Dispensed at POS Counter'
    },
    {
        st_id: 106,
        movement_id: 'SM-1006',
        created_at: '2026-03-25T08:30:15.000Z',
        product_id: 3,
        product_code: 'MED-003',
        product_name: 'Insulin Glargine 100 IU/ml Sol',
        generic_name: 'Insulin Glargine',
        category: 'Cold Chain / Diabetes',
        unit: 'Vials (10ml)',
        batch_id: 3,
        batch_number: 'INS-2026-X',
        expiry_date: '2026-11-30',
        movement_type: 'PURCHASE_GRN',
        invoice_no: 'GRN-2026-003',
        storage_type: 'Cold Chain (2-8°C)',
        qty_change: 40,
        unit_cost: 1850,
        selling_price: 2600,
        total_cost_value: 74000,
        total_sales_value: 104000,
        running_balance: 40,
        operator_name: 'Dr. Jimhawkins Korir',
        notes: 'Temperature-controlled intake placed directly in Refrigerator 01'
    },
    {
        st_id: 107,
        movement_id: 'SM-1007',
        created_at: '2026-03-25T09:12:00.000Z',
        product_id: 3,
        product_code: 'MED-003',
        product_name: 'Insulin Glargine 100 IU/ml Sol',
        generic_name: 'Insulin Glargine',
        category: 'Cold Chain / Diabetes',
        unit: 'Vials (10ml)',
        batch_id: 3,
        batch_number: 'INS-2026-X',
        expiry_date: '2026-11-30',
        movement_type: 'DAMAGE_EXPIRED',
        invoice_no: 'EXP-WRITEOFF-01',
        storage_type: 'Damaged Bay',
        qty_change: -1,
        unit_cost: 1850,
        selling_price: 2600,
        total_cost_value: 1850,
        total_sales_value: 2600,
        running_balance: 39,
        operator_name: 'Chief Pharmacist',
        notes: 'Vial broken during shelf stocking. Documented & written off.'
    },
    {
        st_id: 108,
        movement_id: 'SM-1008',
        created_at: '2026-03-25T11:45:00.000Z',
        product_id: 1,
        product_code: 'MED-001',
        product_name: 'Amoxicillin 500mg Capsules',
        generic_name: 'Amoxicillin Trihydrate',
        category: 'Antibiotics',
        unit: 'Boxes (100s)',
        batch_id: 1,
        batch_number: 'AMX-2026-01',
        expiry_date: '2027-10-15',
        movement_type: 'STOCK_ADJUSTMENT',
        invoice_no: 'ADJ-2026-01',
        storage_type: 'Main Store',
        qty_change: 2,
        unit_cost: 450,
        selling_price: 650,
        total_cost_value: 900,
        total_sales_value: 1300,
        running_balance: 150,
        operator_name: 'Internal Auditor',
        notes: 'Physical count audit: surplus 2 boxes found on upper shelf'
    }
];

export default function StockMovementPage() {
    // ==========================================
    // PRIMARY STATE
    // ==========================================
    const [movements, setMovements] = useState<StockMovementRecord[]>([]);
    const [products, setProducts] = useState<ProductOption[]>([]);
    const [batches, setBatches] = useState<BatchOption[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMovementType, setSelectedMovementType] = useState<string>('ALL');
    const [selectedProductId, setSelectedProductId] = useState<string>('ALL');
    const [selectedStorageLocation, setSelectedStorageLocation] = useState<string>('ALL');
    const [datePreset, setDatePreset] = useState<'today' | 'yesterday' | '7days' | 'month' | '90days' | 'all'>('all');
    const [customDateFrom, setCustomDateFrom] = useState('');
    const [customDateTo, setCustomDateTo] = useState('');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);

    // Selection
    const [selectedIds, setSelectedIds] = useState<number[]>([]);

    // Modals
    const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [dossierRecord, setDossierRecord] = useState<StockMovementRecord | null>(null);
    const [printRecord, setPrintRecord] = useState<StockMovementRecord | null>(null);

    // Adjustment Modal Form State
    const [adjType, setAdjType] = useState<'ADD' | 'SUBTRACT' | 'RECONCILE'>('ADD');
    const [adjProductId, setAdjProductId] = useState<number | ''>('');
    const [adjBatchId, setAdjBatchId] = useState<number | ''>('');
    const [adjQuantity, setAdjQuantity] = useState<string>('');
    const [adjPhysicalCount, setAdjPhysicalCount] = useState<string>('');
    const [adjLocation, setAdjLocation] = useState<StorageLocation>('Main Store');
    const [adjReason, setAdjReason] = useState<string>('Physical Count Audit Discrepancy');
    const [adjNotes, setAdjNotes] = useState<string>('');
    const [isSubmittingAdj, setIsSubmittingAdj] = useState(false);

    // Bin Transfer Modal Form State
    const [trfProductId, setTrfProductId] = useState<number | ''>('');
    const [trfBatchId, setTrfBatchId] = useState<number | ''>('');
    const [trfQuantity, setTrfQuantity] = useState<string>('');
    const [trfFromLocation, setTrfFromLocation] = useState<StorageLocation>('Main Store');
    const [trfToLocation, setTrfToLocation] = useState<StorageLocation>('Dispensing Shelf');
    const [trfNotes, setTrfNotes] = useState<string>('');
    const [isSubmittingTrf, setIsSubmittingTrf] = useState(false);

    // Printable Ref
    const printAreaRef = useRef<HTMLDivElement>(null);

    // ==========================================
    // INITIAL DATA LOADING (SUPABASE + FALLBACK)
    // ==========================================
    const loadMasterData = useCallback(async () => {
        setIsLoading(true);
        try {
            // 1. Load Products
            let loadedProducts: ProductOption[] = [];
            try {
                const { data: pData, error: pError } = await supabase
                    .from('products')
                    .select('pid, product_code, product_name, category, purchase_cost, sales_cost, purchase_unit, sales_unit, batch_no')
                    .order('product_name');

                if (!pError && pData && pData.length > 0) {
                    loadedProducts = pData.map(p => ({
                        pid: p.pid,
                        product_code: p.product_code || `PRD-${p.pid}`,
                        product_name: p.product_name || `Drug #${p.pid}`,
                        category: p.category || 'General Pharma',
                        purchase_cost: Number(p.purchase_cost) || 0,
                        sales_cost: Number(p.sales_cost) || 0,
                        purchase_unit: p.purchase_unit || 'Piece',
                        sales_unit: p.sales_unit || 'Piece',
                        current_stock: 0,
                        batch_no: p.batch_no
                    }));
                }
            } catch (e) {
                console.warn('Fallback product fetch:', e);
            }

            // 2. Load Batches
            let loadedBatches: BatchOption[] = [];
            try {
                const { data: bData, error: bError } = await supabase
                    .from('pharmacy_batches')
                    .select('batch_id, product_id, batch_number, expiry_date, remaining_qty, purchase_cost, selling_price, supplier_name');

                if (!bError && bData && bData.length > 0) {
                    loadedBatches = bData.map(b => ({
                        batch_id: b.batch_id,
                        product_id: b.product_id,
                        batch_number: b.batch_number || `BATCH-${b.batch_id}`,
                        expiry_date: b.expiry_date || '',
                        remaining_qty: Number(b.remaining_qty) || 0,
                        purchase_cost: Number(b.purchase_cost) || 0,
                        selling_price: Number(b.selling_price) || 0,
                        supplier_name: b.supplier_name
                    }));
                }
            } catch (e) {
                console.warn('Fallback batch fetch:', e);
            }

            // 3. Load Pharmacy Stock Movements from public.pharmacy_stock
            let loadedMovements: StockMovementRecord[] = [];
            try {
                const { data: stockData, error: stockError } = await supabase
                    .from('pharmacy_stock')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (!stockError && stockData && stockData.length > 0) {
                    const prodMap = new Map(loadedProducts.map(p => [p.pid, p]));
                    const batchMap = new Map(loadedBatches.map(b => [b.batch_id, b]));

                    loadedMovements = stockData.map((s, idx) => {
                        const prod = prodMap.get(s.pid);
                        const bch = s.batch_id ? batchMap.get(s.batch_id) : null;
                        const qty = Number(s.qty) || 0;
                        const inv = (s.invoice_no || '').trim();

                        // Determine movement type
                        let mType: MovementType = 'OPENING_STOCK';
                        if (inv === 'SALE' || inv.startsWith('RX') || qty < 0 && (inv.includes('SALE') || inv.includes('RX'))) {
                            mType = 'DISPENSED_SALE';
                        } else if (inv.startsWith('GRN') || inv.startsWith('PURCHASE') || inv.startsWith('INV') || (qty > 0 && inv.includes('GRN'))) {
                            mType = 'PURCHASE_GRN';
                        } else if (inv.startsWith('ADJ') || (s.notes && s.notes.toLowerCase().includes('adjustment'))) {
                            mType = 'STOCK_ADJUSTMENT';
                        } else if (inv.startsWith('PR-') || inv.startsWith('RET') || (s.notes && s.notes.toLowerCase().includes('return'))) {
                            mType = 'SUPPLIER_RETURN';
                        } else if (inv.startsWith('TRF') || (s.notes && s.notes.toLowerCase().includes('transfer'))) {
                            mType = 'BIN_TRANSFER';
                        } else if (inv.startsWith('EXP') || inv.startsWith('DAM') || (s.notes && s.notes.toLowerCase().includes('damage'))) {
                            mType = 'DAMAGE_EXPIRED';
                        } else if (inv === 'SEED' || !inv) {
                            mType = 'OPENING_STOCK';
                        }

                        const uCost = prod?.purchase_cost || bch?.purchase_cost || 0;
                        const sPrice = prod?.sales_cost || bch?.selling_price || 0;

                        // Normalize storage type
                        let storType: StorageLocation = 'Main Store';
                        if (s.storage_type) {
                            const st = s.storage_type.toLowerCase();
                            if (st.includes('cold') || st.includes('fridge')) storType = 'Cold Chain (2-8°C)';
                            else if (st.includes('shelf') || st.includes('counter') || st.includes('pieces')) storType = 'Dispensing Shelf';
                            else if (st.includes('quarantine')) storType = 'Quarantine Room';
                            else if (st.includes('damaged')) storType = 'Damaged Bay';
                        }

                        return {
                            st_id: s.st_id,
                            movement_id: `SM-${1000 + (s.st_id || idx + 1)}`,
                            created_at: s.created_at || new Date().toISOString(),
                            product_id: s.pid,
                            product_code: prod?.product_code || `MED-${s.pid}`,
                            product_name: prod?.product_name || `Drug #${s.pid}`,
                            generic_name: prod?.category,
                            category: prod?.category || 'General',
                            unit: prod?.sales_unit || 'Units',
                            batch_id: s.batch_id || null,
                            batch_number: bch?.batch_number || prod?.batch_no || 'STD-LOT',
                            expiry_date: s.expiry_date || bch?.expiry_date || null,
                            movement_type: mType,
                            invoice_no: s.invoice_no || 'INITIAL-STOCK',
                            storage_type: storType,
                            qty_change: qty,
                            unit_cost: uCost,
                            selling_price: sPrice,
                            total_cost_value: Math.abs(qty) * uCost,
                            total_sales_value: Math.abs(qty) * sPrice,
                            running_balance: 0, // Calculated below
                            operator_name: 'Dr. Jimhawkins Korir',
                            notes: s.notes || (qty >= 0 ? 'Stock intake recorded' : 'Stock dispensation deducted')
                        };
                    });
                }
            } catch (e) {
                console.warn('Error reading pharmacy_stock:', e);
            }

            // Fallback or combine with localStorage cache
            const cacheKey = 'alpha_pharmacy_stock_movements_cache';
            const cachedRaw = typeof window !== 'undefined' ? localStorage.getItem(cacheKey) : null;
            if (cachedRaw) {
                try {
                    const parsed: StockMovementRecord[] = JSON.parse(cachedRaw);
                    if (parsed.length > 0) {
                        const existingIds = new Set(loadedMovements.map(m => m.st_id));
                        const uniqueCached = parsed.filter(p => !existingIds.has(p.st_id));
                        loadedMovements = [...uniqueCached, ...loadedMovements];
                    }
                } catch (e) {
                    console.error('Cache parse error:', e);
                }
            }

            // If empty, supply high quality seed movements
            if (loadedMovements.length === 0) {
                loadedMovements = SEED_MOVEMENTS;
            }

            // Compute running balance per product
            const productRunningTotals = new Map<number, number>();
            // Sort chronologically ascending to compute balances correctly, then sort descending
            const chronoSorted = [...loadedMovements].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            chronoSorted.forEach(item => {
                const current = productRunningTotals.get(item.product_id) || 0;
                const nextBal = current + item.qty_change;
                productRunningTotals.set(item.product_id, nextBal);
                item.running_balance = nextBal;
            });

            // Update product stock counts
            if (loadedProducts.length > 0) {
                loadedProducts = loadedProducts.map(p => ({
                    ...p,
                    current_stock: productRunningTotals.get(p.pid) || 0
                }));
            }

            // Final sort: newest first
            loadedMovements.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            setMovements(loadedMovements);
            setProducts(loadedProducts);
            setBatches(loadedBatches);

            // Persist to local cache
            if (typeof window !== 'undefined') {
                localStorage.setItem(cacheKey, JSON.stringify(loadedMovements.slice(0, 200)));
            }
        } catch (err) {
            console.error('Fatal load error:', err);
            toast.error('Failed to load live stock movement records');
            setMovements(SEED_MOVEMENTS);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadMasterData();
    }, [loadMasterData]);

    const handleRefresh = () => {
        setIsRefreshing(true);
        loadMasterData();
        toast.success('Stock movements refreshed from database');
    };

    // ==========================================
    // FILTER LOGIC
    // ==========================================
    const filteredMovements = useMemo(() => {
        return movements.filter(item => {
            // 1. Text Search
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchName = item.product_name.toLowerCase().includes(q);
                const matchCode = item.product_code.toLowerCase().includes(q);
                const matchBatch = item.batch_number.toLowerCase().includes(q);
                const matchInvoice = item.invoice_no.toLowerCase().includes(q);
                const matchNotes = (item.notes || '').toLowerCase().includes(q);
                const matchId = item.movement_id.toLowerCase().includes(q);
                if (!matchName && !matchCode && !matchBatch && !matchInvoice && !matchNotes && !matchId) {
                    return false;
                }
            }

            // 2. Movement Type
            if (selectedMovementType !== 'ALL' && item.movement_type !== selectedMovementType) {
                return false;
            }

            // 3. Product Filter
            if (selectedProductId !== 'ALL' && String(item.product_id) !== selectedProductId) {
                return false;
            }

            // 4. Storage Location Filter
            if (selectedStorageLocation !== 'ALL' && item.storage_type !== selectedStorageLocation) {
                return false;
            }

            // 5. Date Filter
            if (datePreset !== 'all') {
                const itemDate = new Date(item.created_at);
                const now = new Date();
                if (datePreset === 'today') {
                    const isToday = itemDate.getDate() === now.getDate() &&
                                    itemDate.getMonth() === now.getMonth() &&
                                    itemDate.getFullYear() === now.getFullYear();
                    if (!isToday) return false;
                } else if (datePreset === 'yesterday') {
                    const yesterday = new Date();
                    yesterday.setDate(now.getDate() - 1);
                    const isYesterday = itemDate.getDate() === yesterday.getDate() &&
                                        itemDate.getMonth() === yesterday.getMonth() &&
                                        itemDate.getFullYear() === yesterday.getFullYear();
                    if (!isYesterday) return false;
                } else if (datePreset === '7days') {
                    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    if (itemDate < sevenDaysAgo) return false;
                } else if (datePreset === 'month') {
                    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    if (itemDate < thirtyDaysAgo) return false;
                } else if (datePreset === '90days') {
                    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                    if (itemDate < ninetyDaysAgo) return false;
                }
            }

            if (customDateFrom) {
                const from = new Date(customDateFrom);
                from.setHours(0, 0, 0, 0);
                if (new Date(item.created_at) < from) return false;
            }

            if (customDateTo) {
                const to = new Date(customDateTo);
                to.setHours(23, 59, 59, 999);
                if (new Date(item.created_at) > to) return false;
            }

            return true;
        });
    }, [movements, searchQuery, selectedMovementType, selectedProductId, selectedStorageLocation, datePreset, customDateFrom, customDateTo]);

    // ==========================================
    // KPI METRICS
    // ==========================================
    const kpiMetrics = useMemo(() => {
        let totalInflowUnits = 0;
        let totalInflowValue = 0;
        let totalOutflowUnits = 0;
        let totalOutflowValue = 0;
        let totalAdjustmentCount = 0;
        let totalDamageLoss = 0;

        filteredMovements.forEach(m => {
            if (m.qty_change > 0) {
                totalInflowUnits += m.qty_change;
                totalInflowValue += m.total_cost_value;
            } else if (m.qty_change < 0) {
                totalOutflowUnits += Math.abs(m.qty_change);
                totalOutflowValue += m.total_sales_value;
            }

            if (m.movement_type === 'STOCK_ADJUSTMENT') {
                totalAdjustmentCount += 1;
            }
            if (m.movement_type === 'DAMAGE_EXPIRED') {
                totalDamageLoss += m.total_cost_value;
            }
        });

        const netUnits = totalInflowUnits - totalOutflowUnits;

        return {
            totalInflowUnits,
            totalInflowValue,
            totalOutflowUnits,
            totalOutflowValue,
            netUnits,
            totalAdjustmentCount,
            totalDamageLoss,
            totalMovementsCount: filteredMovements.length
        };
    }, [filteredMovements]);

    // ==========================================
    // PAGINATION
    // ==========================================
    const totalPages = Math.ceil(filteredMovements.length / pageSize) || 1;
    const paginatedMovements = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredMovements.slice(start, start + pageSize);
    }, [filteredMovements, currentPage, pageSize]);

    // ==========================================
    // BULK SELECTION
    // ==========================================
    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(paginatedMovements.map(m => m.st_id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectOne = (id: number) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    // ==========================================
    // SUBMIT STOCK ADJUSTMENT
    // ==========================================
    const handleSaveAdjustment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!adjProductId) {
            toast.error('Please select a medication / drug');
            return;
        }

        const selectedProd = products.find(p => p.pid === Number(adjProductId));
        const selectedBch = adjBatchId ? batches.find(b => b.batch_id === Number(adjBatchId)) : null;

        let delta = 0;
        if (adjType === 'ADD') {
            const parsed = parseFloat(adjQuantity);
            if (!parsed || parsed <= 0) {
                toast.error('Please enter a valid positive quantity to add');
                return;
            }
            delta = parsed;
        } else if (adjType === 'SUBTRACT') {
            const parsed = parseFloat(adjQuantity);
            if (!parsed || parsed <= 0) {
                toast.error('Please enter a valid quantity to deduct');
                return;
            }
            delta = -parsed;
        } else if (adjType === 'RECONCILE') {
            const physical = parseFloat(adjPhysicalCount);
            if (isNaN(physical) || physical < 0) {
                toast.error('Please enter the physical count verified in stock');
                return;
            }
            const current = selectedProd?.current_stock || 0;
            delta = physical - current;
            if (delta === 0) {
                toast.error('Physical count matches system stock. No variance adjustment needed.');
                return;
            }
        }

        setIsSubmittingAdj(true);
        const adjInvoiceNo = `ADJ-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

        const newRecord: StockMovementRecord = {
            st_id: Date.now(),
            movement_id: `SM-${Math.floor(1000 + Math.random() * 9000)}`,
            created_at: new Date().toISOString(),
            product_id: Number(adjProductId),
            product_code: selectedProd?.product_code || `MED-${adjProductId}`,
            product_name: selectedProd?.product_name || 'Drug Item',
            generic_name: selectedProd?.category,
            category: selectedProd?.category || 'General',
            unit: selectedProd?.sales_unit || 'Units',
            batch_id: selectedBch?.batch_id || null,
            batch_number: selectedBch?.batch_number || selectedProd?.batch_no || 'MANUAL-ADJ',
            expiry_date: selectedBch?.expiry_date || null,
            movement_type: delta >= 0 ? 'STOCK_ADJUSTMENT' : (adjReason.toLowerCase().includes('damage') ? 'DAMAGE_EXPIRED' : 'STOCK_ADJUSTMENT'),
            invoice_no: adjInvoiceNo,
            storage_type: adjLocation,
            qty_change: delta,
            unit_cost: selectedProd?.purchase_cost || 0,
            selling_price: selectedProd?.sales_cost || 0,
            total_cost_value: Math.abs(delta) * (selectedProd?.purchase_cost || 0),
            total_sales_value: Math.abs(delta) * (selectedProd?.sales_cost || 0),
            operator_name: 'Dr. Jimhawkins Korir',
            notes: `[Reason: ${adjReason}] ${adjNotes ? adjNotes : 'Manual stock variance adjustment reconciled'}`
        };

        try {
            // Attempt insert directly into Supabase public.pharmacy_stock
            const { data: inserted, error } = await supabase
                .from('pharmacy_stock')
                .insert({
                    pid: Number(adjProductId),
                    batch_id: selectedBch?.batch_id || null,
                    invoice_no: adjInvoiceNo,
                    qty: delta,
                    storage_type: adjLocation,
                    expiry_date: selectedBch?.expiry_date || null,
                    notes: newRecord.notes,
                    outlet_id: 1
                })
                .select();

            if (!error && inserted && inserted[0]) {
                newRecord.st_id = inserted[0].st_id;
                newRecord.movement_id = `SM-${1000 + inserted[0].st_id}`;
            }
        } catch (dbErr) {
            console.warn('DB insert fallback to local storage:', dbErr);
        }

        // Update local state & cache
        setMovements(prev => {
            const updated = [newRecord, ...prev];
            if (typeof window !== 'undefined') {
                localStorage.setItem('alpha_pharmacy_stock_movements_cache', JSON.stringify(updated.slice(0, 200)));
            }
            return updated;
        });

        // Recalculate product current stock
        setProducts(prev => prev.map(p => {
            if (p.pid === Number(adjProductId)) {
                return { ...p, current_stock: p.current_stock + delta };
            }
            return p;
        }));

        toast.success(`Stock adjustment posted! ${delta > 0 ? '+' : ''}${delta} ${selectedProd?.sales_unit || 'units'} applied.`);
        setIsSubmittingAdj(false);
        setShowAdjustmentModal(false);
        // Reset form
        setAdjProductId('');
        setAdjBatchId('');
        setAdjQuantity('');
        setAdjPhysicalCount('');
        setAdjNotes('');
    };

    // ==========================================
    // SUBMIT BIN / STORAGE TRANSFER
    // ==========================================
    const handleSaveTransfer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!trfProductId) {
            toast.error('Please select a medication to transfer');
            return;
        }
        if (trfFromLocation === trfToLocation) {
            toast.error('Source and Destination storage bins must be different');
            return;
        }
        const qty = parseFloat(trfQuantity);
        if (!qty || qty <= 0) {
            toast.error('Please enter a valid transfer quantity');
            return;
        }

        const selectedProd = products.find(p => p.pid === Number(trfProductId));
        const selectedBch = trfBatchId ? batches.find(b => b.batch_id === Number(trfBatchId)) : null;

        setIsSubmittingTrf(true);
        const trfDoc = `TRF-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

        // Outflow entry from source bin
        const outEntry: StockMovementRecord = {
            st_id: Date.now(),
            movement_id: `SM-${Math.floor(1000 + Math.random() * 9000)}`,
            created_at: new Date().toISOString(),
            product_id: Number(trfProductId),
            product_code: selectedProd?.product_code || `MED-${trfProductId}`,
            product_name: selectedProd?.product_name || 'Drug Item',
            generic_name: selectedProd?.category,
            category: selectedProd?.category || 'General',
            unit: selectedProd?.sales_unit || 'Units',
            batch_id: selectedBch?.batch_id || null,
            batch_number: selectedBch?.batch_number || selectedProd?.batch_no || 'TRF-LOT',
            expiry_date: selectedBch?.expiry_date || null,
            movement_type: 'BIN_TRANSFER',
            invoice_no: trfDoc,
            storage_type: trfFromLocation,
            qty_change: -qty,
            unit_cost: selectedProd?.purchase_cost || 0,
            selling_price: selectedProd?.sales_cost || 0,
            total_cost_value: qty * (selectedProd?.purchase_cost || 0),
            total_sales_value: qty * (selectedProd?.sales_cost || 0),
            operator_name: 'Dr. Jimhawkins Korir',
            notes: `Transfer Out to ${trfToLocation}. ${trfNotes}`
        };

        // Inflow entry to destination bin
        const inEntry: StockMovementRecord = {
            st_id: Date.now() + 1,
            movement_id: `SM-${Math.floor(1000 + Math.random() * 9000) + 1}`,
            created_at: new Date(Date.now() + 1000).toISOString(),
            product_id: Number(trfProductId),
            product_code: selectedProd?.product_code || `MED-${trfProductId}`,
            product_name: selectedProd?.product_name || 'Drug Item',
            generic_name: selectedProd?.category,
            category: selectedProd?.category || 'General',
            unit: selectedProd?.sales_unit || 'Units',
            batch_id: selectedBch?.batch_id || null,
            batch_number: selectedBch?.batch_number || selectedProd?.batch_no || 'TRF-LOT',
            expiry_date: selectedBch?.expiry_date || null,
            movement_type: 'BIN_TRANSFER',
            invoice_no: trfDoc,
            storage_type: trfToLocation,
            qty_change: qty,
            unit_cost: selectedProd?.purchase_cost || 0,
            selling_price: selectedProd?.sales_cost || 0,
            total_cost_value: qty * (selectedProd?.purchase_cost || 0),
            total_sales_value: qty * (selectedProd?.sales_cost || 0),
            operator_name: 'Dr. Jimhawkins Korir',
            notes: `Transfer In from ${trfFromLocation}. ${trfNotes}`
        };

        try {
            await supabase.from('pharmacy_stock').insert([
                {
                    pid: Number(trfProductId),
                    batch_id: selectedBch?.batch_id || null,
                    invoice_no: trfDoc,
                    qty: -qty,
                    storage_type: trfFromLocation,
                    notes: outEntry.notes,
                    outlet_id: 1
                },
                {
                    pid: Number(trfProductId),
                    batch_id: selectedBch?.batch_id || null,
                    invoice_no: trfDoc,
                    qty: qty,
                    storage_type: trfToLocation,
                    notes: inEntry.notes,
                    outlet_id: 1
                }
            ]);
        } catch (dbErr) {
            console.warn('DB transfer fallback to local cache:', dbErr);
        }

        setMovements(prev => {
            const updated = [inEntry, outEntry, ...prev];
            if (typeof window !== 'undefined') {
                localStorage.setItem('alpha_pharmacy_stock_movements_cache', JSON.stringify(updated.slice(0, 200)));
            }
            return updated;
        });

        toast.success(`Transferred ${qty} units from ${trfFromLocation} to ${trfToLocation}!`);
        setIsSubmittingTrf(false);
        setShowTransferModal(false);
        setTrfProductId('');
        setTrfBatchId('');
        setTrfQuantity('');
        setTrfNotes('');
    };

    // ==========================================
    // DELETE / VOID TRANSACTION
    // ==========================================
    const handleDeleteRecord = async (record: StockMovementRecord) => {
        if (!confirm(`Are you sure you want to void / delete transaction ${record.movement_id} (${record.product_name})? This will reverse the stock delta.`)) {
            return;
        }

        try {
            await supabase.from('pharmacy_stock').delete().eq('st_id', record.st_id);
        } catch (err) {
            console.warn('Failed to delete on server:', err);
        }

        setMovements(prev => {
            const updated = prev.filter(m => m.st_id !== record.st_id);
            if (typeof window !== 'undefined') {
                localStorage.setItem('alpha_pharmacy_stock_movements_cache', JSON.stringify(updated.slice(0, 200)));
            }
            return updated;
        });

        // Reverse stock on product
        setProducts(prev => prev.map(p => {
            if (p.pid === record.product_id) {
                return { ...p, current_stock: p.current_stock - record.qty_change };
            }
            return p;
        }));

        toast.success(`Transaction ${record.movement_id} voided successfully`);
    };

    // ==========================================
    // EXPORT TO MULTI-COLOR EXCEL (SpreadsheetML)
    // ==========================================
    const exportToExcelXML = () => {
        const rows = filteredMovements.map(m => `
            <Row>
                <Cell ss:StyleID="sData"><Data ss:Type="String">${m.movement_id}</Data></Cell>
                <Cell ss:StyleID="sData"><Data ss:Type="String">${new Date(m.created_at).toLocaleDateString('en-GB')} ${new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Data></Cell>
                <Cell ss:StyleID="sData"><Data ss:Type="String">${m.product_code}</Data></Cell>
                <Cell ss:StyleID="sBold"><Data ss:Type="String">${m.product_name.replace(/&/g, '&amp;')}</Data></Cell>
                <Cell ss:StyleID="sData"><Data ss:Type="String">${m.category}</Data></Cell>
                <Cell ss:StyleID="sData"><Data ss:Type="String">${m.batch_number}</Data></Cell>
                <Cell ss:StyleID="sData"><Data ss:Type="String">${m.expiry_date || 'N/A'}</Data></Cell>
                <Cell ss:StyleID="sData"><Data ss:Type="String">${m.movement_type.replace(/_/g, ' ')}</Data></Cell>
                <Cell ss:StyleID="sData"><Data ss:Type="String">${m.invoice_no}</Data></Cell>
                <Cell ss:StyleID="sData"><Data ss:Type="String">${m.storage_type}</Data></Cell>
                <Cell ss:StyleID="${m.qty_change > 0 ? 'sGreenNum' : 'sRedNum'}"><Data ss:Type="Number">${m.qty_change}</Data></Cell>
                <Cell ss:StyleID="sData"><Data ss:Type="String">${m.unit}</Data></Cell>
                <Cell ss:StyleID="sNum"><Data ss:Type="Number">${m.running_balance || 0}</Data></Cell>
                <Cell ss:StyleID="sCurrency"><Data ss:Type="Number">${m.unit_cost}</Data></Cell>
                <Cell ss:StyleID="sCurrency"><Data ss:Type="Number">${m.total_cost_value}</Data></Cell>
                <Cell ss:StyleID="sData"><Data ss:Type="String">${m.operator_name}</Data></Cell>
                <Cell ss:StyleID="sData"><Data ss:Type="String">${(m.notes || '').replace(/&/g, '&amp;')}</Data></Cell>
            </Row>
        `).join('');

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
  </Style>
  <Style ss:ID="sHeader">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#0284C7"/>
   </Borders>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#0284C7" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="sTitle">
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="16" ss:Color="#000000" ss:Bold="1"/>
  </Style>
  <Style ss:ID="sData">
   <Alignment ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="sBold">
   <Alignment ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000" ss:Bold="1"/>
  </Style>
  <Style ss:ID="sGreenNum">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#15803D" ss:Bold="1"/>
   <Interior ss:Color="#DCFCE7" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="sRedNum">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#B91C1C" ss:Bold="1"/>
   <Interior ss:Color="#FEE2E2" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="sNum">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <NumberFormat ss:Format="#,##0"/>
  </Style>
  <Style ss:ID="sCurrency">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <NumberFormat ss:Format="&quot;KSh &quot;#,##0.00"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Stock Movements Ledger">
  <Table>
   <Column ss:Width="80"/>
   <Column ss:Width="120"/>
   <Column ss:Width="90"/>
   <Column ss:Width="200"/>
   <Column ss:Width="110"/>
   <Column ss:Width="100"/>
   <Column ss:Width="90"/>
   <Column ss:Width="130"/>
   <Column ss:Width="110"/>
   <Column ss:Width="110"/>
   <Column ss:Width="70"/>
   <Column ss:Width="70"/>
   <Column ss:Width="80"/>
   <Column ss:Width="90"/>
   <Column ss:Width="110"/>
   <Column ss:Width="120"/>
   <Column ss:Width="220"/>
   <Row ss:Height="25">
    <Cell ss:MergeAcross="16" ss:StyleID="sTitle"><Data ss:Type="String">ALPHA PHARMACY - STOCK MOVEMENT &amp; AUDIT LEDGER</Data></Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Movement ID</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Date &amp; Time</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Product Code</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Drug / Product Name</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Category</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Batch #</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Expiry Date</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Movement Type</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Reference / Doc #</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Location / Bin</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Delta Qty</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Unit</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Balance</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Unit Cost</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Total Valuation</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Operator</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Audit Rationale / Notes</Data></Cell>
   </Row>
   ${rows}
  </Table>
 </Worksheet>
</Workbook>`;

        const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Stock_Movements_Ledger_${new Date().toISOString().split('T')[0]}.xls`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('SpreadsheetML Excel ledger exported successfully! 📊');
    };

    // ==========================================
    // PRINT DIRECT SLIP / BIN CARD
    // ==========================================
    const handlePrintVoucher = (record: StockMovementRecord) => {
        setPrintRecord(record);
        setTimeout(() => {
            window.print();
        }, 300);
    };

    // ==========================================
    // BADGE HELPER
    // ==========================================
    const getMovementTypeBadge = (type: MovementType) => {
        switch (type) {
            case 'PURCHASE_GRN':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                        <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                        📥 Purchase / GRN In
                    </span>
                );
            case 'DISPENSED_SALE':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-950 border border-rose-300">
                        <span className="w-2 h-2 rounded-full bg-rose-600"></span>
                        📤 Dispensed / POS
                    </span>
                );
            case 'STOCK_ADJUSTMENT':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-purple-100 text-purple-950 border border-purple-300">
                        <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                        ⚖️ Variance Audit
                    </span>
                );
            case 'BIN_TRANSFER':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-950 border border-blue-300">
                        <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                        🔄 Internal Transfer
                    </span>
                );
            case 'SUPPLIER_RETURN':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-950 border border-amber-300">
                        <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                        ↩️ Vendor Return
                    </span>
                );
            case 'DAMAGE_EXPIRED':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-red-100 text-red-950 border border-red-400">
                        <span className="w-2 h-2 rounded-full bg-red-700"></span>
                        ⚠️ Damage / Write-off
                    </span>
                );
            case 'OPENING_STOCK':
            default:
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-cyan-100 text-cyan-950 border border-cyan-300">
                        <span className="w-2 h-2 rounded-full bg-cyan-600"></span>
                        📦 Opening Stock
                    </span>
                );
        }
    };

    const getLocationBadge = (loc: StorageLocation) => {
        switch (loc) {
            case 'Cold Chain (2-8°C)':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-black bg-sky-100 text-sky-950 border border-sky-300">
                        ❄️ {loc}
                    </span>
                );
            case 'Dispensing Shelf':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-black bg-emerald-100 text-emerald-950 border border-emerald-300">
                        💊 {loc}
                    </span>
                );
            case 'Quarantine Room':
            case 'Damaged Bay':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-black bg-rose-100 text-rose-950 border border-rose-300">
                        ⛔ {loc}
                    </span>
                );
            case 'Main Store':
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-black bg-gray-100 text-gray-900 border border-gray-300">
                        🏢 {loc}
                    </span>
                );
        }
    };

    return (
        <div className="w-full space-y-6 pb-20 font-sans text-gray-900">
            {/* ========================================== */}
            {/* TOP BAR / HEADER */}
            {/* ========================================== */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-600 via-blue-600 to-indigo-700 flex items-center justify-center text-white text-2xl shadow-md border border-blue-400">
                        📦
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-black tracking-tight text-gray-950">
                                Stock Movement &amp; Inventory Audit Ledger
                            </h1>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-100 text-blue-950 border border-blue-300">
                                Real-time Bin Card
                            </span>
                        </div>
                        <p className="text-sm font-semibold text-gray-700 mt-0.5">
                            Track purchases (GRN), POS dispensations, physical audit adjustments, cold chain transfers, and batch lot traceability.
                        </p>
                    </div>
                </div>

                <div className="flex items-center flex-wrap gap-2.5">
                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-xl font-bold text-sm transition-all border border-gray-300 disabled:opacity-50"
                        title="Reload live stock ledger from database"
                    >
                        <span className={isRefreshing ? 'animate-spin' : ''}>🔄</span>
                        {isRefreshing ? 'Syncing...' : 'Live Sync'}
                    </button>

                    <button
                        onClick={exportToExcelXML}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-sm shadow-sm transition-all hover:shadow"
                        title="Export current ledger to colored XML Excel"
                    >
                        <span>📊</span> Export Excel
                    </button>

                    <button
                        onClick={() => setShowTransferModal(true)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-sm shadow-sm transition-all hover:shadow"
                    >
                        <span>🔄</span> Bin Transfer
                    </button>

                    <button
                        onClick={() => {
                            setAdjType('ADD');
                            setShowAdjustmentModal(true);
                        }}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white rounded-xl font-black text-sm shadow-md transition-all hover:shadow-lg"
                    >
                        <span>⚖️</span> Post Stock Adjustment
                    </button>
                </div>
            </div>

            {/* ========================================== */}
            {/* 6 ANALYTICAL KPI METRIC CARDS */}
            {/* ========================================== */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                {/* 1. Inflow */}
                <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-white p-5 rounded-2xl border border-emerald-200 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-emerald-950">Stock Inflow</span>
                        <span className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800 text-sm font-black">📥</span>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl font-black text-emerald-950">+{kpiMetrics.totalInflowUnits.toLocaleString()}</div>
                        <div className="text-xs font-bold text-emerald-800 mt-1">
                            Val: KSh {kpiMetrics.totalInflowValue.toLocaleString()}
                        </div>
                    </div>
                    <div className="mt-2 text-[11px] font-semibold text-emerald-700">GRN Purchases &amp; Receipts</div>
                </div>

                {/* 2. Outflow */}
                <div className="bg-gradient-to-br from-rose-50 via-orange-50 to-white p-5 rounded-2xl border border-rose-200 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-rose-950">Stock Outflow</span>
                        <span className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-800 text-sm font-black">📤</span>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl font-black text-rose-950">-{kpiMetrics.totalOutflowUnits.toLocaleString()}</div>
                        <div className="text-xs font-bold text-rose-800 mt-1">
                            Retail: KSh {kpiMetrics.totalOutflowValue.toLocaleString()}
                        </div>
                    </div>
                    <div className="mt-2 text-[11px] font-semibold text-rose-700">POS Sales &amp; Dispensed</div>
                </div>

                {/* 3. Net Active Stock Balance */}
                <div className="bg-gradient-to-br from-blue-50 via-cyan-50 to-white p-5 rounded-2xl border border-blue-200 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-blue-950">Net Units Logged</span>
                        <span className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-800 text-sm font-black">📦</span>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl font-black text-blue-950">
                            {kpiMetrics.netUnits > 0 ? `+${kpiMetrics.netUnits.toLocaleString()}` : kpiMetrics.netUnits.toLocaleString()}
                        </div>
                        <div className="text-xs font-bold text-blue-800 mt-1">
                            Across all batches
                        </div>
                    </div>
                    <div className="mt-2 text-[11px] font-semibold text-blue-700">Active On-hand delta</div>
                </div>

                {/* 4. Variance Audits */}
                <div className="bg-gradient-to-br from-purple-50 via-indigo-50 to-white p-5 rounded-2xl border border-purple-200 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-purple-950">Audit Variances</span>
                        <span className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-800 text-sm font-black">⚖️</span>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl font-black text-purple-950">{kpiMetrics.totalAdjustmentCount} Events</div>
                        <div className="text-xs font-bold text-purple-800 mt-1">
                            Physical reconciliations
                        </div>
                    </div>
                    <div className="mt-2 text-[11px] font-semibold text-purple-700">Count discrepancies adjusted</div>
                </div>

                {/* 5. Damage & Expiry Loss */}
                <div className="bg-gradient-to-br from-amber-50 via-yellow-50 to-white p-5 rounded-2xl border border-amber-200 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-amber-950">Damage / Expiry</span>
                        <span className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-800 text-sm font-black">⚠️</span>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl font-black text-amber-950">KSh {kpiMetrics.totalDamageLoss.toLocaleString()}</div>
                        <div className="text-xs font-bold text-amber-800 mt-1">
                            Cost write-offs logged
                        </div>
                    </div>
                    <div className="mt-2 text-[11px] font-semibold text-amber-700">Loss prevention ledger</div>
                </div>

                {/* 6. Total Transactions */}
                <div className="bg-gradient-to-br from-slate-50 via-gray-50 to-white p-5 rounded-2xl border border-gray-300 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-gray-950">Ledger Entries</span>
                        <span className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center text-gray-900 text-sm font-black">📋</span>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl font-black text-gray-950">{kpiMetrics.totalMovementsCount.toLocaleString()}</div>
                        <div className="text-xs font-bold text-gray-800 mt-1">
                            Filtered transactions
                        </div>
                    </div>
                    <div className="mt-2 text-[11px] font-semibold text-gray-700">100% Audit trail logged</div>
                </div>
            </div>

            {/* ========================================== */}
            {/* MULTI-DIMENSIONAL FILTER SUITE */}
            {/* ========================================== */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                    {/* Omni-search */}
                    <div className="lg:col-span-2">
                        <label className="block text-xs font-black text-gray-950 mb-1">
                            🔍 OMNI-SEARCH LEDGER
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => {
                                    setSearchQuery(e.target.value);
                                    setCurrentPage(1);
                                }}
                                placeholder="Search drug name, batch #, invoice #, receipt #, notes..."
                                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-bold text-gray-950 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                            />
                            <span className="absolute left-3 top-3 text-gray-500 text-sm">🔎</span>
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-700 text-sm font-bold"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Movement Type Filter */}
                    <div>
                        <label className="block text-xs font-black text-gray-950 mb-1">
                            📌 MOVEMENT TYPE
                        </label>
                        <select
                            value={selectedMovementType}
                            onChange={e => {
                                setSelectedMovementType(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-bold text-gray-950 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                        >
                            <option value="ALL">All Types (Everything)</option>
                            <option value="PURCHASE_GRN">📥 Purchase / GRN In</option>
                            <option value="DISPENSED_SALE">📤 Dispensed / POS Sale</option>
                            <option value="STOCK_ADJUSTMENT">⚖️ Stock Adjustment / Audit</option>
                            <option value="BIN_TRANSFER">🔄 Storage Bin Transfer</option>
                            <option value="SUPPLIER_RETURN">↩️ Vendor Return</option>
                            <option value="DAMAGE_EXPIRED">⚠️ Damage / Expiry Write-Off</option>
                            <option value="OPENING_STOCK">📦 Opening Stock / Init</option>
                        </select>
                    </div>

                    {/* Specific Product Filter */}
                    <div>
                        <label className="block text-xs font-black text-gray-950 mb-1">
                            💊 SPECIFIC MEDICATION
                        </label>
                        <select
                            value={selectedProductId}
                            onChange={e => {
                                setSelectedProductId(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-bold text-gray-950 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                        >
                            <option value="ALL">All Medications ({products.length})</option>
                            {products.map(p => (
                                <option key={p.pid} value={p.pid}>
                                    {p.product_code} - {p.product_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Storage Location Filter */}
                    <div>
                        <label className="block text-xs font-black text-gray-950 mb-1">
                            📍 STORAGE BIN / BAY
                        </label>
                        <select
                            value={selectedStorageLocation}
                            onChange={e => {
                                setSelectedStorageLocation(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-bold text-gray-950 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                        >
                            <option value="ALL">All Storage Locations</option>
                            <option value="Main Store">🏢 Main Store</option>
                            <option value="Dispensing Shelf">💊 Dispensing Shelf</option>
                            <option value="Cold Chain (2-8°C)">❄️ Cold Chain (2-8°C)</option>
                            <option value="Quarantine Room">⛔ Quarantine Room</option>
                            <option value="Damaged Bay">⚠️ Damaged Bay</option>
                        </select>
                    </div>
                </div>

                {/* Date Presets Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100">
                    <div className="flex items-center flex-wrap gap-1.5">
                        <span className="text-xs font-black text-gray-950 mr-2">📅 TIMEFRAME:</span>
                        {[
                            { key: 'today', label: 'Today' },
                            { key: 'yesterday', label: 'Yesterday' },
                            { key: '7days', label: 'Last 7 Days' },
                            { key: 'month', label: 'This Month' },
                            { key: '90days', label: 'Last 90 Days' },
                            { key: 'all', label: 'All Time' }
                        ].map(preset => (
                            <button
                                key={preset.key}
                                onClick={() => {
                                    setDatePreset(preset.key as any);
                                    setCustomDateFrom('');
                                    setCustomDateTo('');
                                    setCurrentPage(1);
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                                    datePreset === preset.key && !customDateFrom
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                                }`}
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-gray-700">Custom:</span>
                        <input
                            type="date"
                            value={customDateFrom}
                            onChange={e => {
                                setCustomDateFrom(e.target.value);
                                setDatePreset('all');
                                setCurrentPage(1);
                            }}
                            className="px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs font-bold text-gray-950 focus:outline-none focus:ring-1 focus:ring-blue-600"
                        />
                        <span className="text-xs font-bold text-gray-500">to</span>
                        <input
                            type="date"
                            value={customDateTo}
                            onChange={e => {
                                setCustomDateTo(e.target.value);
                                setDatePreset('all');
                                setCurrentPage(1);
                            }}
                            className="px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs font-bold text-gray-950 focus:outline-none focus:ring-1 focus:ring-blue-600"
                        />
                        {(customDateFrom || customDateTo) && (
                            <button
                                onClick={() => {
                                    setCustomDateFrom('');
                                    setCustomDateTo('');
                                    setDatePreset('all');
                                }}
                                className="px-2 py-1 text-xs font-bold text-red-600 hover:text-red-800"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ========================================== */}
            {/* DATAGRID / TABLE */}
            {/* ========================================== */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Table Header Controls */}
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-black text-gray-950">
                            Showing {paginatedMovements.length} of {filteredMovements.length} movements
                        </span>
                        {selectedIds.length > 0 && (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-100 text-blue-900 border border-blue-300">
                                {selectedIds.length} Selected
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <label className="text-xs font-black text-gray-700">Rows per page:</label>
                        <select
                            value={pageSize}
                            onChange={e => {
                                setPageSize(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="px-2.5 py-1 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-950"
                        >
                            <option value={15}>15</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {isLoading ? (
                        <div className="p-20 text-center">
                            <div className="inline-block animate-spin text-5xl mb-3">🔄</div>
                            <h3 className="text-base font-black text-gray-900">Loading Stock Movements Ledger...</h3>
                            <p className="text-xs text-gray-500 mt-1">Connecting to Supabase inventory database</p>
                        </div>
                    ) : paginatedMovements.length === 0 ? (
                        <div className="p-20 text-center">
                            <span className="text-6xl block mb-3">📦</span>
                            <h3 className="text-lg font-black text-gray-950">No Stock Movements Match Your Criteria</h3>
                            <p className="text-sm text-gray-600 max-w-md mx-auto mt-1 font-semibold">
                                Try clearing your search query or selecting a broader timeframe. You can also click Post Stock Adjustment to log physical stock.
                            </p>
                            <button
                                onClick={() => {
                                    setSearchQuery('');
                                    setSelectedMovementType('ALL');
                                    setSelectedProductId('ALL');
                                    setSelectedStorageLocation('ALL');
                                    setDatePreset('all');
                                }}
                                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700"
                            >
                                Reset All Filters
                            </button>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 border-b border-gray-200">
                                    <th className="py-3.5 px-4 text-center w-10">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.length === paginatedMovements.length && paginatedMovements.length > 0}
                                            onChange={handleSelectAll}
                                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                        />
                                    </th>
                                    <th className="py-3.5 px-3 text-xs font-black text-gray-950 uppercase tracking-wider">
                                        Ref / Timestamp
                                    </th>
                                    <th className="py-3.5 px-4 text-xs font-black text-gray-950 uppercase tracking-wider">
                                        Medication &amp; Code
                                    </th>
                                    <th className="py-3.5 px-3 text-xs font-black text-gray-950 uppercase tracking-wider">
                                        Batch &amp; Expiry
                                    </th>
                                    <th className="py-3.5 px-3 text-xs font-black text-gray-950 uppercase tracking-wider">
                                        Movement Type
                                    </th>
                                    <th className="py-3.5 px-3 text-xs font-black text-gray-950 uppercase tracking-wider">
                                        Document / Origin
                                    </th>
                                    <th className="py-3.5 px-3 text-xs font-black text-gray-950 uppercase tracking-wider">
                                        Location / Bin
                                    </th>
                                    <th className="py-3.5 px-3 text-right text-xs font-black text-gray-950 uppercase tracking-wider">
                                        Delta (Change)
                                    </th>
                                    <th className="py-3.5 px-3 text-right text-xs font-black text-gray-950 uppercase tracking-wider">
                                        Stock Balance
                                    </th>
                                    <th className="py-3.5 px-4 text-right text-xs font-black text-gray-950 uppercase tracking-wider">
                                        Valuation (Cost)
                                    </th>
                                    <th className="py-3.5 px-4 text-center text-xs font-black text-gray-950 uppercase tracking-wider">
                                        Quick Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {paginatedMovements.map(record => {
                                    const isPositive = record.qty_change > 0;
                                    const isZero = record.qty_change === 0;

                                    return (
                                        <tr
                                            key={record.st_id}
                                            className="hover:bg-blue-50/40 transition-colors group"
                                        >
                                            <td className="py-3.5 px-4 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.includes(record.st_id)}
                                                    onChange={() => handleSelectOne(record.st_id)}
                                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                                />
                                            </td>

                                            {/* Ref / Timestamp */}
                                            <td className="py-3.5 px-3">
                                                <div className="font-mono text-xs font-black text-blue-700">
                                                    {record.movement_id}
                                                </div>
                                                <div className="text-[11px] font-bold text-gray-700">
                                                    {new Date(record.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </div>
                                                <div className="text-[10px] text-gray-500">
                                                    {new Date(record.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </td>

                                            {/* Medication & Code */}
                                            <td className="py-3.5 px-4">
                                                <div className="font-black text-gray-950 text-sm">
                                                    {record.product_name}
                                                </div>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="font-mono text-[11px] font-bold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                                                        {record.product_code}
                                                    </span>
                                                    <span className="text-[11px] font-semibold text-gray-500">
                                                        {record.category}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Batch & Expiry */}
                                            <td className="py-3.5 px-3">
                                                <div className="font-mono text-xs font-black text-gray-900">
                                                    {record.batch_number}
                                                </div>
                                                {record.expiry_date ? (
                                                    <div className="text-[11px] font-bold text-gray-600 flex items-center gap-1 mt-0.5">
                                                        <span>📅 Exp: {new Date(record.expiry_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-gray-400">Non-dated</span>
                                                )}
                                            </td>

                                            {/* Movement Type */}
                                            <td className="py-3.5 px-3">
                                                {getMovementTypeBadge(record.movement_type)}
                                            </td>

                                            {/* Document / Origin */}
                                            <td className="py-3.5 px-3">
                                                <div className="inline-flex items-center px-2 py-0.5 rounded font-mono text-xs font-black bg-gray-100 text-gray-900 border border-gray-300">
                                                    {record.invoice_no}
                                                </div>
                                                <div className="text-[10px] text-gray-500 truncate max-w-[120px] mt-0.5">
                                                    {record.notes}
                                                </div>
                                            </td>

                                            {/* Location / Bin */}
                                            <td className="py-3.5 px-3">
                                                {getLocationBadge(record.storage_type)}
                                            </td>

                                            {/* Delta Change */}
                                            <td className="py-3.5 px-3 text-right">
                                                <div className={`font-mono text-sm font-black inline-flex items-center px-2 py-0.5 rounded-lg ${
                                                    isPositive 
                                                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                                        : isZero 
                                                            ? 'bg-gray-100 text-gray-700' 
                                                            : 'bg-rose-100 text-rose-950 border border-rose-300'
                                                }`}>
                                                    {isPositive ? `+${record.qty_change}` : record.qty_change} {record.unit}
                                                </div>
                                            </td>

                                            {/* Running Balance */}
                                            <td className="py-3.5 px-3 text-right">
                                                <div className="font-mono text-sm font-black text-gray-950">
                                                    {(record.running_balance ?? 0).toLocaleString()}
                                                </div>
                                                <div className="text-[10px] font-bold text-gray-500">
                                                    on hand
                                                </div>
                                            </td>

                                            {/* Valuation */}
                                            <td className="py-3.5 px-4 text-right">
                                                <div className="font-black text-xs text-gray-950">
                                                    KSh {record.total_cost_value.toLocaleString()}
                                                </div>
                                                <div className="text-[10px] font-bold text-gray-500">
                                                    @ KSh {record.unit_cost.toLocaleString()}/unit
                                                </div>
                                            </td>

                                            {/* Quick Actions (5 Working Buttons) */}
                                            <td className="py-3.5 px-4 text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    {/* 1. View 360 Dossier */}
                                                    <button
                                                        onClick={() => setDossierRecord(record)}
                                                        className="w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white flex items-center justify-center transition-all border border-blue-200 hover:border-blue-600 shadow-sm"
                                                        title="View 360° Movement Dossier & Audit Log"
                                                    >
                                                        👁️
                                                    </button>

                                                    {/* 2. Print Voucher / Bin Card Slip */}
                                                    <button
                                                        onClick={() => handlePrintVoucher(record)}
                                                        className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-800 text-gray-800 hover:text-white flex items-center justify-center transition-all border border-gray-300 hover:border-gray-800 shadow-sm"
                                                        title="Print Physical Bin Card / Movement Voucher"
                                                    >
                                                        🖨️
                                                    </button>

                                                    {/* 3. Quick Stock Adjustment for this product */}
                                                    <button
                                                        onClick={() => {
                                                            setAdjProductId(record.product_id);
                                                            if (record.batch_id) setAdjBatchId(record.batch_id);
                                                            setAdjLocation(record.storage_type);
                                                            setAdjType('RECONCILE');
                                                            setShowAdjustmentModal(true);
                                                        }}
                                                        className="w-8 h-8 rounded-lg bg-purple-50 hover:bg-purple-600 text-purple-700 hover:text-white flex items-center justify-center transition-all border border-purple-200 hover:border-purple-600 shadow-sm"
                                                        title="Quick Physical Audit Re-count for this Drug"
                                                    >
                                                        ⚖️
                                                    </button>

                                                    {/* 4. Quick Storage Transfer */}
                                                    <button
                                                        onClick={() => {
                                                            setTrfProductId(record.product_id);
                                                            if (record.batch_id) setTrfBatchId(record.batch_id);
                                                            setTrfFromLocation(record.storage_type);
                                                            setShowTransferModal(true);
                                                        }}
                                                        className="w-8 h-8 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white flex items-center justify-center transition-all border border-emerald-200 hover:border-emerald-600 shadow-sm"
                                                        title="Transfer Stock to another Bin/Location"
                                                    >
                                                        🔄
                                                    </button>

                                                    {/* 5. Delete / Void Transaction */}
                                                    <button
                                                        onClick={() => handleDeleteRecord(record)}
                                                        className="w-8 h-8 rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white flex items-center justify-center transition-all border border-rose-200 hover:border-rose-600 shadow-sm"
                                                        title="Void / Rollback this transaction"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination Footer */}
                {totalPages > 1 && (
                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between flex-wrap gap-3">
                        <div className="text-xs font-black text-gray-700">
                            Page {currentPage} of {totalPages} ({filteredMovements.length} total entries)
                        </div>

                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => setCurrentPage(1)}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-40"
                            >
                                First
                            </button>
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-40"
                            >
                                Previous
                            </button>

                            <div className="flex items-center gap-1">
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    let pageNum = currentPage - 2 + i;
                                    if (pageNum < 1) pageNum = i + 1;
                                    if (pageNum > totalPages) return null;
                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => setCurrentPage(pageNum)}
                                            className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${
                                                currentPage === pageNum
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-white border border-gray-300 text-gray-800 hover:bg-gray-100'
                                            }`}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                })}
                            </div>

                            <button
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-40"
                            >
                                Next
                            </button>
                            <button
                                onClick={() => setCurrentPage(totalPages)}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-40"
                            >
                                Last
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ========================================== */}
            {/* MODAL 1: POST STOCK ADJUSTMENT & RECONCILE */}
            {/* ========================================== */}
            {showAdjustmentModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-3xl max-w-2xl w-full border border-gray-200 shadow-2xl overflow-hidden animate-scaleUp">
                        {/* Header */}
                        <div className="px-6 py-5 bg-gradient-to-r from-purple-800 via-indigo-800 to-blue-900 text-white flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-xl">
                                    ⚖️
                                </div>
                                <div>
                                    <h2 className="text-lg font-black tracking-tight">Post Inventory Stock Adjustment</h2>
                                    <p className="text-xs text-purple-200">Reconcile physical counts, surplus, shrinkages or damage</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowAdjustmentModal(false)}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSaveAdjustment} className="p-6 space-y-4">
                            {/* Mode Selector */}
                            <div>
                                <label className="block text-xs font-black text-gray-950 mb-2">
                                    SELECT ADJUSTMENT METHOD
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setAdjType('ADD')}
                                        className={`py-2.5 px-3 rounded-xl text-xs font-black border transition-all flex items-center justify-center gap-1.5 ${
                                            adjType === 'ADD'
                                                ? 'bg-emerald-600 text-white border-emerald-600 shadow'
                                                : 'bg-gray-50 text-gray-800 border-gray-300 hover:bg-gray-100'
                                        }`}
                                    >
                                        <span>➕</span> Add Surplus Stock
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAdjType('SUBTRACT')}
                                        className={`py-2.5 px-3 rounded-xl text-xs font-black border transition-all flex items-center justify-center gap-1.5 ${
                                            adjType === 'SUBTRACT'
                                                ? 'bg-rose-600 text-white border-rose-600 shadow'
                                                : 'bg-gray-50 text-gray-800 border-gray-300 hover:bg-gray-100'
                                        }`}
                                    >
                                        <span>➖</span> Deduct / Write-Off
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAdjType('RECONCILE')}
                                        className={`py-2.5 px-3 rounded-xl text-xs font-black border transition-all flex items-center justify-center gap-1.5 ${
                                            adjType === 'RECONCILE'
                                                ? 'bg-purple-600 text-white border-purple-600 shadow'
                                                : 'bg-gray-50 text-gray-800 border-gray-300 hover:bg-gray-100'
                                        }`}
                                    >
                                        <span>⚖️</span> Physical Count Re-audit
                                    </button>
                                </div>
                            </div>

                            {/* Select Drug */}
                            <div>
                                <label className="block text-xs font-black text-gray-950 mb-1">
                                    MEDICATION / DRUG ITEM *
                                </label>
                                <select
                                    required
                                    value={adjProductId}
                                    onChange={e => setAdjProductId(e.target.value ? Number(e.target.value) : '')}
                                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-bold text-gray-950 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:bg-white"
                                >
                                    <option value="">-- Choose Medication to Adjust --</option>
                                    {products.map(p => (
                                        <option key={p.pid} value={p.pid}>
                                            {p.product_code} - {p.product_name} (Current Stock: {p.current_stock} {p.sales_unit})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Batch Selection */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-black text-gray-950 mb-1">
                                        LINKED BATCH (OPTIONAL)
                                    </label>
                                    <select
                                        value={adjBatchId}
                                        onChange={e => setAdjBatchId(e.target.value ? Number(e.target.value) : '')}
                                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-bold text-gray-950 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:bg-white"
                                    >
                                        <option value="">-- Auto-assign or General Lot --</option>
                                        {batches.map(b => (
                                            <option key={b.batch_id} value={b.batch_id}>
                                                Batch: {b.batch_number} (Rem: {b.remaining_qty})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-gray-950 mb-1">
                                        STORAGE BIN / LOCATION
                                    </label>
                                    <select
                                        value={adjLocation}
                                        onChange={e => setAdjLocation(e.target.value as StorageLocation)}
                                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-bold text-gray-950 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:bg-white"
                                    >
                                        <option value="Main Store">🏢 Main Store</option>
                                        <option value="Dispensing Shelf">💊 Dispensing Shelf</option>
                                        <option value="Cold Chain (2-8°C)">❄️ Cold Chain (2-8°C)</option>
                                        <option value="Quarantine Room">⛔ Quarantine Room</option>
                                        <option value="Damaged Bay">⚠️ Damaged Bay</option>
                                    </select>
                                </div>
                            </div>

                            {/* Quantity Inputs */}
                            {adjType === 'RECONCILE' ? (
                                <div className="p-3.5 bg-purple-50 rounded-xl border border-purple-200 space-y-2">
                                    <label className="block text-xs font-black text-purple-950">
                                        ACTUAL PHYSICAL COUNT VERIFIED ON SHELF
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        value={adjPhysicalCount}
                                        onChange={e => setAdjPhysicalCount(e.target.value)}
                                        placeholder="e.g. 145"
                                        className="w-full px-3.5 py-2.5 bg-white border border-purple-300 rounded-xl text-lg font-black text-purple-950 focus:outline-none focus:ring-2 focus:ring-purple-600"
                                    />
                                    {adjProductId && adjPhysicalCount && (
                                        <div className="text-xs font-bold text-purple-900 mt-1">
                                            {(() => {
                                                const current = products.find(p => p.pid === Number(adjProductId))?.current_stock || 0;
                                                const phys = parseFloat(adjPhysicalCount) || 0;
                                                const diff = phys - current;
                                                return (
                                                    <span>
                                                        System stock: {current} | Physical: {phys} | Variance Delta: {diff > 0 ? `+${diff}` : diff} units
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-xs font-black text-gray-950 mb-1">
                                        QUANTITY TO {adjType === 'ADD' ? 'ADD (+)' : 'DEDUCT (-)'}
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        value={adjQuantity}
                                        onChange={e => setAdjQuantity(e.target.value)}
                                        placeholder="Enter units (e.g. 10)"
                                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-lg font-black text-gray-950 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:bg-white"
                                    />
                                </div>
                            )}

                            {/* Reason Selector */}
                            <div>
                                <label className="block text-xs font-black text-gray-950 mb-1">
                                    ADJUSTMENT REASON CODE
                                </label>
                                <select
                                    value={adjReason}
                                    onChange={e => setAdjReason(e.target.value)}
                                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-bold text-gray-950 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:bg-white"
                                >
                                    <option value="Physical Count Audit Discrepancy">Physical Count Audit Discrepancy</option>
                                    <option value="Damaged / Broken Vials during dispensing">Damaged / Broken Vials during dispensing</option>
                                    <option value="Expired Stock Removal to Quarantine">Expired Stock Removal to Quarantine</option>
                                    <option value="Manufacturer Surplus Delivery">Manufacturer Surplus Delivery</option>
                                    <option value="Spillage or Leakage Defect">Spillage or Leakage Defect</option>
                                    <option value="Sample / Internal Clinic Use">Sample / Internal Clinic Use</option>
                                    <option value="Theft or Unaccounted Shrinkage">Theft or Unaccounted Shrinkage</option>
                                    <option value="Batch Entry Correction">Batch Entry Correction</option>
                                </select>
                            </div>

                            {/* Detailed Notes */}
                            <div>
                                <label className="block text-xs font-black text-gray-950 mb-1">
                                    AUDITOR / PHARMACIST NOTES
                                </label>
                                <textarea
                                    rows={2}
                                    value={adjNotes}
                                    onChange={e => setAdjNotes(e.target.value)}
                                    placeholder="Add any additional context or authorization references..."
                                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-medium text-gray-950 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:bg-white resize-none"
                                />
                            </div>

                            {/* Footer Actions */}
                            <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowAdjustmentModal(false)}
                                    className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-bold text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmittingAdj}
                                    className="px-6 py-2.5 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white rounded-xl font-black text-sm shadow-md disabled:opacity-50"
                                >
                                    {isSubmittingAdj ? '⏳ Posting...' : '✅ Save & Update Stock'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================== */}
            {/* MODAL 2: INTER-BIN STORAGE TRANSFER */}
            {/* ========================================== */}
            {showTransferModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-3xl max-w-xl w-full border border-gray-200 shadow-2xl overflow-hidden animate-scaleUp">
                        {/* Header */}
                        <div className="px-6 py-5 bg-gradient-to-r from-blue-700 to-cyan-800 text-white flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-xl">
                                    🔄
                                </div>
                                <div>
                                    <h2 className="text-lg font-black tracking-tight">Inter-Bin Storage Location Transfer</h2>
                                    <p className="text-xs text-blue-200">Re-allocate stock between Main Store, Dispensing Shelf, and Cold Chain</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowTransferModal(false)}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSaveTransfer} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-black text-gray-950 mb-1">
                                    SELECT MEDICATION TO TRANSFER *
                                </label>
                                <select
                                    required
                                    value={trfProductId}
                                    onChange={e => setTrfProductId(e.target.value ? Number(e.target.value) : '')}
                                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-bold text-gray-950 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                                >
                                    <option value="">-- Choose Medication --</option>
                                    {products.map(p => (
                                        <option key={p.pid} value={p.pid}>
                                            {p.product_code} - {p.product_name} (Current Stock: {p.current_stock} {p.sales_unit})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-black text-gray-950 mb-1">
                                        SOURCE LOCATION (FROM)
                                    </label>
                                    <select
                                        value={trfFromLocation}
                                        onChange={e => setTrfFromLocation(e.target.value as StorageLocation)}
                                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-bold text-gray-950 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                                    >
                                        <option value="Main Store">🏢 Main Store</option>
                                        <option value="Dispensing Shelf">💊 Dispensing Shelf</option>
                                        <option value="Cold Chain (2-8°C)">❄️ Cold Chain (2-8°C)</option>
                                        <option value="Quarantine Room">⛔ Quarantine Room</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-gray-950 mb-1">
                                        TARGET LOCATION (TO)
                                    </label>
                                    <select
                                        value={trfToLocation}
                                        onChange={e => setTrfToLocation(e.target.value as StorageLocation)}
                                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-bold text-gray-950 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                                    >
                                        <option value="Dispensing Shelf">💊 Dispensing Shelf</option>
                                        <option value="Main Store">🏢 Main Store</option>
                                        <option value="Cold Chain (2-8°C)">❄️ Cold Chain (2-8°C)</option>
                                        <option value="Quarantine Room">⛔ Quarantine Room</option>
                                        <option value="Damaged Bay">⚠️ Damaged Bay</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-black text-gray-950 mb-1">
                                        TRANSFER QUANTITY *
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        value={trfQuantity}
                                        onChange={e => setTrfQuantity(e.target.value)}
                                        placeholder="e.g. 20"
                                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-base font-black text-gray-950 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-gray-950 mb-1">
                                        LINKED BATCH (OPTIONAL)
                                    </label>
                                    <select
                                        value={trfBatchId}
                                        onChange={e => setTrfBatchId(e.target.value ? Number(e.target.value) : '')}
                                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-bold text-gray-950 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                                    >
                                        <option value="">-- Any / Default Batch --</option>
                                        {batches.map(b => (
                                            <option key={b.batch_id} value={b.batch_id}>
                                                Batch: {b.batch_number}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black text-gray-950 mb-1">
                                    INTERNAL TRANSFER NOTES / AUTHORIZATION
                                </label>
                                <textarea
                                    rows={2}
                                    value={trfNotes}
                                    onChange={e => setTrfNotes(e.target.value)}
                                    placeholder="e.g. Front desk restocking for morning shift"
                                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-medium text-gray-950 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white resize-none"
                                />
                            </div>

                            <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowTransferModal(false)}
                                    className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-bold text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmittingTrf}
                                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-sm shadow-md disabled:opacity-50"
                                >
                                    {isSubmittingTrf ? '⏳ Transferring...' : '🚀 Execute Transfer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================== */}
            {/* MODAL 3: 360° MOVEMENT DOSSIER */}
            {/* ========================================== */}
            {dossierRecord && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-3xl max-w-2xl w-full border border-gray-200 shadow-2xl overflow-hidden animate-scaleUp">
                        {/* Header */}
                        <div className="px-6 py-5 bg-gradient-to-r from-gray-900 via-gray-800 to-blue-900 text-white flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-xl">
                                    👁️
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-lg font-black tracking-tight">{dossierRecord.movement_id}</h2>
                                        <span className="text-xs px-2 py-0.5 rounded font-mono bg-white/20 text-white font-bold">
                                            {dossierRecord.invoice_no}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-300">Complete 360° Stock Movement Dossier &amp; Traceability</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setDossierRecord(null)}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-5">
                            {/* Drug Header Card */}
                            <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-200 flex items-center justify-between flex-wrap gap-3">
                                <div>
                                    <span className="text-[11px] font-black text-blue-900 uppercase">Product Details</span>
                                    <h3 className="text-base font-black text-gray-950 mt-0.5">{dossierRecord.product_name}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="font-mono text-xs font-bold text-gray-700 bg-white px-2 py-0.5 rounded border border-blue-200">
                                            {dossierRecord.product_code}
                                        </span>
                                        <span className="text-xs font-semibold text-gray-600">
                                            Category: {dossierRecord.category}
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    {getMovementTypeBadge(dossierRecord.movement_type)}
                                </div>
                            </div>

                            {/* Details Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                                    <div className="text-[11px] font-black text-gray-600 uppercase">Batch / Lot #</div>
                                    <div className="text-sm font-black text-gray-950 mt-0.5 font-mono">{dossierRecord.batch_number}</div>
                                </div>
                                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                                    <div className="text-[11px] font-black text-gray-600 uppercase">Expiry Date</div>
                                    <div className="text-sm font-black text-gray-950 mt-0.5 font-mono">
                                        {dossierRecord.expiry_date || 'N/A'}
                                    </div>
                                </div>
                                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                                    <div className="text-[11px] font-black text-gray-600 uppercase">Storage Location</div>
                                    <div className="mt-0.5">{getLocationBadge(dossierRecord.storage_type)}</div>
                                </div>
                                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                                    <div className="text-[11px] font-black text-gray-600 uppercase">Quantity Delta</div>
                                    <div className={`text-base font-black mt-0.5 font-mono ${dossierRecord.qty_change > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                        {dossierRecord.qty_change > 0 ? `+${dossierRecord.qty_change}` : dossierRecord.qty_change} {dossierRecord.unit}
                                    </div>
                                </div>
                                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                                    <div className="text-[11px] font-black text-gray-600 uppercase">Unit Purchase Cost</div>
                                    <div className="text-sm font-black text-gray-950 mt-0.5 font-mono">
                                        KSh {dossierRecord.unit_cost.toLocaleString()}
                                    </div>
                                </div>
                                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                                    <div className="text-[11px] font-black text-gray-600 uppercase">Total Valuation Impact</div>
                                    <div className="text-sm font-black text-gray-950 mt-0.5 font-mono">
                                        KSh {dossierRecord.total_cost_value.toLocaleString()}
                                    </div>
                                </div>
                            </div>

                            {/* Audit Notes */}
                            <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200">
                                <div className="text-xs font-black text-gray-900 uppercase">Audit Remarks &amp; Rationale</div>
                                <p className="text-xs font-semibold text-gray-700 mt-1 leading-relaxed">
                                    {dossierRecord.notes || 'No remarks provided for this transaction.'}
                                </p>
                            </div>

                            {/* Operator & Timestamp */}
                            <div className="flex items-center justify-between text-xs font-bold text-gray-600 pt-3 border-t border-gray-100">
                                <div>
                                    <span className="text-gray-500">Operator:</span> {dossierRecord.operator_name}
                                </div>
                                <div>
                                    <span className="text-gray-500">Logged on:</span> {new Date(dossierRecord.created_at).toLocaleString()}
                                </div>
                            </div>

                            {/* Footer Actions */}
                            <div className="pt-2 flex items-center justify-end gap-3">
                                <button
                                    onClick={() => handlePrintVoucher(dossierRecord)}
                                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-bold text-xs flex items-center gap-1.5"
                                >
                                    <span>🖨️</span> Print Voucher
                                </button>
                                <button
                                    onClick={() => setDossierRecord(null)}
                                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs"
                                >
                                    Close Dossier
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================== */}
            {/* PRINTABLE BIN CARD / VOUCHER (HIDDEN UNTIL PRINT) */}
            {/* ========================================== */}
            <div className="hidden print:block fixed inset-0 bg-white p-8 z-[9999]" ref={printAreaRef}>
                {printRecord && (
                    <div className="max-w-2xl mx-auto space-y-6 text-black font-sans">
                        {/* Pharmacy Header */}
                        <div className="border-b-2 border-black pb-4 text-center">
                            <h1 className="text-2xl font-black uppercase tracking-wider">ALPHA PHARMACY &amp; HEALTHCARE</h1>
                            <p className="text-xs font-bold mt-1">Licensed Retail &amp; Hospital Pharmacy | Ministry of Health Reg #PH-89420</p>
                            <p className="text-xs">Location: CBD Plaza, Mezzanine Flr | Tel: +254 700 000 000 | Email: dispensary@alphapharmacy.ke</p>
                            <div className="mt-3 inline-block px-4 py-1 bg-black text-white font-black text-sm uppercase rounded">
                                INVENTORY BIN CARD &amp; MOVEMENT VOUCHER
                            </div>
                        </div>

                        {/* Metadata Box */}
                        <div className="grid grid-cols-2 gap-4 border border-black p-3 text-xs">
                            <div>
                                <p><span className="font-bold">Voucher / Movement ID:</span> {printRecord.movement_id}</p>
                                <p><span className="font-bold">Transaction Date:</span> {new Date(printRecord.created_at).toLocaleString()}</p>
                                <p><span className="font-bold">Reference Doc:</span> {printRecord.invoice_no}</p>
                                <p><span className="font-bold">Movement Type:</span> {printRecord.movement_type.replace(/_/g, ' ')}</p>
                            </div>
                            <div>
                                <p><span className="font-bold">Medication Name:</span> {printRecord.product_name}</p>
                                <p><span className="font-bold">Item Code:</span> {printRecord.product_code}</p>
                                <p><span className="font-bold">Batch / Lot #:</span> {printRecord.batch_number}</p>
                                <p><span className="font-bold">Expiry Date:</span> {printRecord.expiry_date || 'N/A'}</p>
                            </div>
                        </div>

                        {/* Stock Transaction Table */}
                        <table className="w-full border-collapse border border-black text-xs text-left">
                            <thead>
                                <tr className="bg-gray-200">
                                    <th className="border border-black p-2">Storage Bin</th>
                                    <th className="border border-black p-2 text-right">Inflow Qty</th>
                                    <th className="border border-black p-2 text-right">Outflow Qty</th>
                                    <th className="border border-black p-2 text-right">Unit Cost</th>
                                    <th className="border border-black p-2 text-right">Valuation Impact</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className="border border-black p-2 font-bold">{printRecord.storage_type}</td>
                                    <td className="border border-black p-2 text-right font-mono font-bold">
                                        {printRecord.qty_change > 0 ? `+${printRecord.qty_change} ${printRecord.unit}` : '-'}
                                    </td>
                                    <td className="border border-black p-2 text-right font-mono font-bold">
                                        {printRecord.qty_change < 0 ? `${printRecord.qty_change} ${printRecord.unit}` : '-'}
                                    </td>
                                    <td className="border border-black p-2 text-right font-mono">
                                        KSh {printRecord.unit_cost.toLocaleString()}
                                    </td>
                                    <td className="border border-black p-2 text-right font-mono font-bold">
                                        KSh {printRecord.total_cost_value.toLocaleString()}
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        {/* Rationale */}
                        <div className="border border-black p-3 text-xs">
                            <span className="font-bold">Audit Rationale / Notes:</span>
                            <p className="mt-1">{printRecord.notes || 'Verified according to standard pharmaceutical inventory procedures.'}</p>
                        </div>

                        {/* Sign-offs */}
                        <div className="grid grid-cols-2 gap-8 pt-8 text-xs">
                            <div className="border-t border-black pt-2 text-center">
                                <p className="font-bold">Prepared / Logged By</p>
                                <p className="mt-4">{printRecord.operator_name}</p>
                                <p className="text-[10px] text-gray-600">Storekeeper / Assistant Pharmacist</p>
                            </div>
                            <div className="border-t border-black pt-2 text-center">
                                <p className="font-bold">Verified &amp; Authorized By</p>
                                <p className="mt-4">Dr. Jimhawkins Korir</p>
                                <p className="text-[10px] text-gray-600">Superintendent Pharmacist in Charge</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
