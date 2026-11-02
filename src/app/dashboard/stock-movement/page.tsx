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
// SEED FALLBACK DATA
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
    const [isAutoFit, setIsAutoFit] = useState(false);

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
                            running_balance: 0,
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

            // If empty, supply seed movements
            if (loadedMovements.length === 0) {
                loadedMovements = SEED_MOVEMENTS;
            }

            // Compute running balance per product
            const productRunningTotals = new Map<number, number>();
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

            if (selectedMovementType !== 'ALL' && item.movement_type !== selectedMovementType) {
                return false;
            }

            if (selectedProductId !== 'ALL' && String(item.product_id) !== selectedProductId) {
                return false;
            }

            if (selectedStorageLocation !== 'ALL' && item.storage_type !== selectedStorageLocation) {
                return false;
            }

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

        setMovements(prev => {
            const updated = [newRecord, ...prev];
            if (typeof window !== 'undefined') {
                localStorage.setItem('alpha_pharmacy_stock_movements_cache', JSON.stringify(updated.slice(0, 200)));
            }
            return updated;
        });

        setProducts(prev => prev.map(p => {
            if (p.pid === Number(adjProductId)) {
                return { ...p, current_stock: p.current_stock + delta };
            }
            return p;
        }));

        toast.success(`Stock adjustment posted! ${delta > 0 ? '+' : ''}${delta} ${selectedProd?.sales_unit || 'units'} applied.`);
        setIsSubmittingAdj(false);
        setShowAdjustmentModal(false);
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
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="14" ss:Color="#000000" ss:Bold="1"/>
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
   <Column ss:Width="70"/>
   <Column ss:Width="110"/>
   <Column ss:Width="80"/>
   <Column ss:Width="190"/>
   <Column ss:Width="100"/>
   <Column ss:Width="90"/>
   <Column ss:Width="80"/>
   <Column ss:Width="120"/>
   <Column ss:Width="100"/>
   <Column ss:Width="100"/>
   <Column ss:Width="65"/>
   <Column ss:Width="65"/>
   <Column ss:Width="75"/>
   <Column ss:Width="85"/>
   <Column ss:Width="100"/>
   <Column ss:Width="110"/>
   <Column ss:Width="200"/>
   <Row ss:Height="22">
    <Cell ss:MergeAcross="16" ss:StyleID="sTitle"><Data ss:Type="String">ALPHA PHARMACY - STOCK MOVEMENT &amp; AUDIT LEDGER</Data></Cell>
   </Row>
   <Row ss:Height="20">
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
    // COMPACT BADGE HELPERS (EXACT MATCH TO BATCHES PAGE)
    // ==========================================
    const getMovementTypeBadge = (type: MovementType) => {
        switch (type) {
            case 'PURCHASE_GRN':
                return (
                    <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[9.5px] font-bold border border-emerald-200 inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                        📥 Purchase / GRN
                    </span>
                );
            case 'DISPENSED_SALE':
                return (
                    <span className="px-1.5 py-0.5 bg-rose-100 text-rose-800 rounded-full text-[9.5px] font-bold border border-rose-200 inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                        📤 Dispensed / Sale
                    </span>
                );
            case 'STOCK_ADJUSTMENT':
                return (
                    <span className="px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded-full text-[9.5px] font-bold border border-purple-200 inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-600"></span>
                        ⚖️ Variance Audit
                    </span>
                );
            case 'BIN_TRANSFER':
                return (
                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded-full text-[9.5px] font-bold border border-blue-200 inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                        🔄 Bin Transfer
                    </span>
                );
            case 'SUPPLIER_RETURN':
                return (
                    <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[9.5px] font-bold border border-amber-200 inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                        ↩️ Vendor Return
                    </span>
                );
            case 'DAMAGE_EXPIRED':
                return (
                    <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full text-[9.5px] font-bold border border-red-200 inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
                        ⚠️ Write-off
                    </span>
                );
            case 'OPENING_STOCK':
            default:
                return (
                    <span className="px-1.5 py-0.5 bg-cyan-100 text-cyan-800 rounded-full text-[9.5px] font-bold border border-cyan-200 inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-600"></span>
                        📦 Opening Stock
                    </span>
                );
        }
    };

    const getLocationBadge = (loc: StorageLocation) => {
        switch (loc) {
            case 'Cold Chain (2-8°C)':
                return (
                    <span className="px-1.5 py-0.5 bg-sky-50 text-sky-800 rounded text-[9.5px] font-bold border border-sky-200 inline-flex items-center gap-0.5">
                        ❄️ {loc}
                    </span>
                );
            case 'Dispensing Shelf':
                return (
                    <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-800 rounded text-[9.5px] font-bold border border-emerald-200 inline-flex items-center gap-0.5">
                        💊 Shelf
                    </span>
                );
            case 'Quarantine Room':
            case 'Damaged Bay':
                return (
                    <span className="px-1.5 py-0.5 bg-rose-50 text-rose-800 rounded text-[9.5px] font-bold border border-rose-200 inline-flex items-center gap-0.5">
                        ⛔ {loc}
                    </span>
                );
            case 'Main Store':
            default:
                return (
                    <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded text-[9.5px] font-medium border border-gray-200 inline-flex items-center gap-0.5">
                        🏢 Store
                    </span>
                );
        }
    };

    return (
        <div className="w-full max-w-full space-y-3.5 px-1 md:px-2 text-gray-900" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
            {/* ========================================== */}
            {/* TOP BAR / HEADER (SLEEK COMPACT SIZING) */}
            {/* ========================================== */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-600 to-blue-700 flex items-center justify-center text-white text-xl shadow-md flex-shrink-0">
                        📦
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                                Stock Movement &amp; Bin Card Ledger
                            </h1>
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-[10px] font-bold border border-blue-200">
                                Live Audit
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Track Goods Receipts (GRN), POS dispensations, physical audit adjustments, cold chain transfers, and batch lot traceability.
                        </p>
                    </div>
                </div>

                <div className="flex items-center flex-wrap gap-2">
                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-bold shadow-xs transition-all flex items-center gap-1 text-xs disabled:opacity-50"
                        title="Reload live stock ledger from database"
                    >
                        <span className={isRefreshing ? 'animate-spin' : ''}>🔄</span>
                        {isRefreshing ? 'Syncing...' : 'Live Sync'}
                    </button>

                    <button
                        onClick={exportToExcelXML}
                        className="px-3 py-1.5 bg-white hover:bg-gray-50 text-emerald-700 border border-emerald-200 rounded-lg font-bold shadow-xs transition-all flex items-center gap-1 text-xs"
                        title="Export current ledger to colored XML Excel"
                    >
                        <span>📊</span> Excel XML
                    </button>

                    <button
                        onClick={() => setShowTransferModal(true)}
                        className="px-3 py-1.5 bg-white hover:bg-gray-50 text-blue-700 border border-blue-200 rounded-lg font-bold shadow-xs transition-all flex items-center gap-1 text-xs"
                    >
                        <span>🔄</span> Bin Transfer
                    </button>

                    <button
                        onClick={() => {
                            setAdjType('ADD');
                            setShowAdjustmentModal(true);
                        }}
                        className="px-3.5 py-1.5 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white rounded-lg font-bold shadow-xs transition-all flex items-center gap-1 text-xs active:scale-95"
                    >
                        <span>⚖️</span> Post Adjustment
                    </button>
                </div>
            </div>

            {/* ========================================== */}
            {/* 6 ANALYTICAL KPI METRIC CARDS (COMPACT EXACT FIT) */}
            {/* ========================================== */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                {/* 1. Inflow */}
                <div className="bg-gradient-to-br from-emerald-50/80 via-teal-50/50 to-white p-3 rounded-xl border border-emerald-200/80 shadow-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Inflow</span>
                        <span className="text-sm">📥</span>
                    </div>
                    <div className="mt-1.5">
                        <div className="text-lg font-black text-emerald-950 tracking-tight">+{kpiMetrics.totalInflowUnits.toLocaleString()}</div>
                        <div className="text-[10px] font-bold text-emerald-700 mt-0.5">
                            Val: KSh {kpiMetrics.totalInflowValue.toLocaleString()}
                        </div>
                    </div>
                    <div className="mt-1 text-[9px] text-gray-500">GRN Purchases</div>
                </div>

                {/* 2. Outflow */}
                <div className="bg-gradient-to-br from-rose-50/80 via-orange-50/50 to-white p-3 rounded-xl border border-rose-200/80 shadow-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider">Outflow</span>
                        <span className="text-sm">📤</span>
                    </div>
                    <div className="mt-1.5">
                        <div className="text-lg font-black text-rose-950 tracking-tight">-{kpiMetrics.totalOutflowUnits.toLocaleString()}</div>
                        <div className="text-[10px] font-bold text-rose-700 mt-0.5">
                            Retail: KSh {kpiMetrics.totalOutflowValue.toLocaleString()}
                        </div>
                    </div>
                    <div className="mt-1 text-[9px] text-gray-500">POS Sales</div>
                </div>

                {/* 3. Net Active Stock Balance */}
                <div className="bg-gradient-to-br from-blue-50/80 via-cyan-50/50 to-white p-3 rounded-xl border border-blue-200/80 shadow-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">Net Units</span>
                        <span className="text-sm">📦</span>
                    </div>
                    <div className="mt-1.5">
                        <div className="text-lg font-black text-blue-950 tracking-tight">
                            {kpiMetrics.netUnits > 0 ? `+${kpiMetrics.netUnits.toLocaleString()}` : kpiMetrics.netUnits.toLocaleString()}
                        </div>
                        <div className="text-[10px] font-bold text-blue-700 mt-0.5">
                            All active lots
                        </div>
                    </div>
                    <div className="mt-1 text-[9px] text-gray-500">Active On-hand delta</div>
                </div>

                {/* 4. Variance Audits */}
                <div className="bg-gradient-to-br from-purple-50/80 via-indigo-50/50 to-white p-3 rounded-xl border border-purple-200/80 shadow-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wider">Variances</span>
                        <span className="text-sm">⚖️</span>
                    </div>
                    <div className="mt-1.5">
                        <div className="text-lg font-black text-purple-950 tracking-tight">{kpiMetrics.totalAdjustmentCount} Events</div>
                        <div className="text-[10px] font-bold text-purple-700 mt-0.5">
                            Count reconciliations
                        </div>
                    </div>
                    <div className="mt-1 text-[9px] text-gray-500">Physical audit logs</div>
                </div>

                {/* 5. Damage & Expiry Loss */}
                <div className="bg-gradient-to-br from-amber-50/80 via-yellow-50/50 to-white p-3 rounded-xl border border-amber-200/80 shadow-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Write-offs</span>
                        <span className="text-sm">⚠️</span>
                    </div>
                    <div className="mt-1.5">
                        <div className="text-lg font-black text-amber-950 tracking-tight">KSh {kpiMetrics.totalDamageLoss.toLocaleString()}</div>
                        <div className="text-[10px] font-bold text-amber-700 mt-0.5">
                            Cost loss logged
                        </div>
                    </div>
                    <div className="mt-1 text-[9px] text-gray-500">Damage &amp; Expiry</div>
                </div>

                {/* 6. Total Transactions */}
                <div className="bg-gradient-to-br from-gray-50 via-slate-50 to-white p-3 rounded-xl border border-gray-200 shadow-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-gray-700 uppercase tracking-wider">Total Rows</span>
                        <span className="text-sm">📋</span>
                    </div>
                    <div className="mt-1.5">
                        <div className="text-lg font-black text-gray-900 tracking-tight">{kpiMetrics.totalMovementsCount.toLocaleString()}</div>
                        <div className="text-[10px] font-bold text-gray-600 mt-0.5">
                            Filtered entries
                        </div>
                    </div>
                    <div className="mt-1 text-[9px] text-gray-500">100% Audit compliant</div>
                </div>
            </div>

            {/* ========================================== */}
            {/* MULTI-DIMENSIONAL FILTER SUITE (COMPACT) */}
            {/* ========================================== */}
            <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs space-y-2.5">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
                    {/* Omni-search */}
                    <div className="lg:col-span-2">
                        <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5">
                            🔍 Search Ledger
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => {
                                    setSearchQuery(e.target.value);
                                    setCurrentPage(1);
                                }}
                                placeholder="Search drug name, batch #, invoice #, receipt #..."
                                className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:bg-white"
                            />
                            <span className="absolute left-2.5 top-2 text-gray-400 text-xs">🔎</span>
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2.5 top-1.5 text-gray-400 hover:text-gray-600 text-xs font-bold"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Movement Type Filter */}
                    <div>
                        <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5">
                            📌 Movement Type
                        </label>
                        <select
                            value={selectedMovementType}
                            onChange={e => {
                                setSelectedMovementType(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 cursor-pointer outline-none focus:border-blue-500"
                        >
                            <option value="ALL">All Types</option>
                            <option value="PURCHASE_GRN">📥 Purchase / GRN In</option>
                            <option value="DISPENSED_SALE">📤 Dispensed / Sale</option>
                            <option value="STOCK_ADJUSTMENT">⚖️ Stock Adjustment</option>
                            <option value="BIN_TRANSFER">🔄 Storage Bin Transfer</option>
                            <option value="SUPPLIER_RETURN">↩️ Vendor Return</option>
                            <option value="DAMAGE_EXPIRED">⚠️ Damage / Expiry</option>
                            <option value="OPENING_STOCK">📦 Opening Stock</option>
                        </select>
                    </div>

                    {/* Specific Product Filter */}
                    <div>
                        <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5">
                            💊 Specific Drug
                        </label>
                        <select
                            value={selectedProductId}
                            onChange={e => {
                                setSelectedProductId(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 cursor-pointer outline-none focus:border-blue-500 truncate"
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
                        <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5">
                            📍 Storage Location
                        </label>
                        <select
                            value={selectedStorageLocation}
                            onChange={e => {
                                setSelectedStorageLocation(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 cursor-pointer outline-none focus:border-blue-500"
                        >
                            <option value="ALL">All Storage Bins</option>
                            <option value="Main Store">🏢 Main Store</option>
                            <option value="Dispensing Shelf">💊 Dispensing Shelf</option>
                            <option value="Cold Chain (2-8°C)">❄️ Cold Chain (2-8°C)</option>
                            <option value="Quarantine Room">⛔ Quarantine Room</option>
                            <option value="Damaged Bay">⚠️ Damaged Bay</option>
                        </select>
                    </div>
                </div>

                {/* Date Presets Row */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 text-xs">
                    <div className="flex items-center flex-wrap gap-1">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mr-1">Timeframe:</span>
                        {[
                            { key: 'today', label: 'Today' },
                            { key: 'yesterday', label: 'Yesterday' },
                            { key: '7days', label: '7 Days' },
                            { key: 'month', label: 'Month' },
                            { key: '90days', label: '90 Days' },
                            { key: 'all', label: 'All' }
                        ].map(preset => (
                            <button
                                key={preset.key}
                                onClick={() => {
                                    setDatePreset(preset.key as any);
                                    setCustomDateFrom('');
                                    setCustomDateTo('');
                                    setCurrentPage(1);
                                }}
                                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                                    datePreset === preset.key && !customDateFrom
                                        ? 'bg-blue-600 text-white shadow-xs'
                                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                }`}
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-[10px] font-bold text-gray-400">Custom:</span>
                        <input
                            type="date"
                            value={customDateFrom}
                            onChange={e => {
                                setCustomDateFrom(e.target.value);
                                setDatePreset('all');
                                setCurrentPage(1);
                            }}
                            className="px-2 py-0.5 bg-gray-50 border border-gray-200 rounded text-[11px] font-semibold text-gray-800 focus:outline-none focus:border-blue-500"
                        />
                        <span className="text-gray-400">-</span>
                        <input
                            type="date"
                            value={customDateTo}
                            onChange={e => {
                                setCustomDateTo(e.target.value);
                                setDatePreset('all');
                                setCurrentPage(1);
                            }}
                            className="px-2 py-0.5 bg-gray-50 border border-gray-200 rounded text-[11px] font-semibold text-gray-800 focus:outline-none focus:border-blue-500"
                        />
                        {(customDateFrom || customDateTo) && (
                            <button
                                onClick={() => {
                                    setCustomDateFrom('');
                                    setCustomDateTo('');
                                    setDatePreset('all');
                                }}
                                className="text-[10px] font-bold text-red-600 hover:text-red-700 underline ml-1"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ========================================== */}
            {/* DATAGRID / TABLE (EXACT MATCH TO BATCHES PAGE DENSITY) */}
            {/* ========================================== */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
                {/* Table Header Bar with Auto-Fit Toggle */}
                <div className="px-4 py-2.5 bg-gradient-to-r from-cyan-700 via-blue-700 to-indigo-800 text-white flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                        <span className="text-sm">📦</span>
                        <h2 className="text-xs font-bold tracking-wide">
                            Stock Movement &amp; Inventory Audit Ledger
                        </h2>
                        <span className="px-2 py-0.2 bg-white/20 rounded-full text-[10px] font-bold backdrop-blur-xs">
                            {filteredMovements.length} Records
                        </span>
                        {selectedIds.length > 0 && (
                            <span className="px-2 py-0.2 bg-emerald-400/30 text-emerald-100 rounded-full text-[10px] font-bold">
                                {selectedIds.length} Selected
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-1.5">
                            <label className="text-[10px] text-white/80 font-bold">Per page:</label>
                            <select
                                value={pageSize}
                                onChange={e => {
                                    setPageSize(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                                className="px-1.5 py-0.5 bg-white/10 border border-white/20 rounded text-xs font-bold text-white cursor-pointer"
                            >
                                <option value={15} className="text-gray-900">15</option>
                                <option value={25} className="text-gray-900">25</option>
                                <option value={50} className="text-gray-900">50</option>
                                <option value={100} className="text-gray-900">100</option>
                            </select>
                        </div>

                        <button
                            onClick={() => setIsAutoFit(!isAutoFit)}
                            className="px-2 py-0.5 bg-white/20 hover:bg-white/30 text-white rounded text-[11px] font-bold transition-all flex items-center gap-1 shadow-xs"
                            title="Toggle Auto-Fit view (fits 100% on screen) or Expanded table"
                        >
                            <span>{isAutoFit ? '🖥️ Auto-Fit (Active)' : '↔️ Expanded'}</span>
                        </button>
                    </div>
                </div>

                <div className={isAutoFit ? 'w-full overflow-hidden' : 'overflow-x-auto'}>
                    {isLoading ? (
                        <div className="p-12 text-center">
                            <div className="inline-block animate-spin text-3xl mb-2">🔄</div>
                            <h3 className="text-xs font-bold text-gray-700">Loading Stock Movements Ledger...</h3>
                            <p className="text-[10px] text-gray-400 mt-0.5">Connecting to Supabase inventory database</p>
                        </div>
                    ) : paginatedMovements.length === 0 ? (
                        <div className="p-12 text-center">
                            <span className="text-4xl block mb-2">📦</span>
                            <h3 className="text-xs font-bold text-gray-800">No Stock Movements Match Your Criteria</h3>
                            <p className="text-[11px] text-gray-500 max-w-sm mx-auto mt-0.5">
                                Try clearing your search query or selecting a broader timeframe.
                            </p>
                            <button
                                onClick={() => {
                                    setSearchQuery('');
                                    setSelectedMovementType('ALL');
                                    setSelectedProductId('ALL');
                                    setSelectedStorageLocation('ALL');
                                    setDatePreset('all');
                                }}
                                className="mt-2.5 px-3 py-1 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700"
                            >
                                Reset Filters
                            </button>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                    <th className="px-2.5 py-2 text-center w-8">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.length === paginatedMovements.length && paginatedMovements.length > 0}
                                            onChange={handleSelectAll}
                                            className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                        />
                                    </th>
                                    <th className="px-2 py-2">Ref / Date</th>
                                    <th className="px-2 py-2">Medication &amp; Formulation</th>
                                    <th className="px-2 py-2">Batch / Lot</th>
                                    <th className="px-2 py-2">Type</th>
                                    <th className="px-2 py-2">Document #</th>
                                    <th className="px-2 py-2">Storage Bin</th>
                                    <th className="px-2 py-2 text-right">Delta Qty</th>
                                    <th className="px-2 py-2 text-right">Balance</th>
                                    <th className="px-2 py-2 text-right">Valuation</th>
                                    <th className="px-2 py-2 text-center w-28">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-xs">
                                {paginatedMovements.map(record => {
                                    const isPositive = record.qty_change > 0;
                                    const isZero = record.qty_change === 0;

                                    return (
                                        <tr
                                            key={record.st_id}
                                            className="hover:bg-blue-50/50 transition-colors"
                                        >
                                            <td className="px-2.5 py-1.5 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.includes(record.st_id)}
                                                    onChange={() => handleSelectOne(record.st_id)}
                                                    className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                />
                                            </td>

                                            {/* Ref / Timestamp */}
                                            <td className="px-2 py-1.5 whitespace-nowrap min-w-0">
                                                <span className="font-mono text-[10.5px] font-bold text-blue-700 bg-blue-50 px-1 py-0.2 rounded border border-blue-100">
                                                    {record.movement_id}
                                                </span>
                                                <p className="text-[9.5px] text-gray-500 mt-0.5">
                                                    {new Date(record.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} • {new Date(record.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </td>

                                            {/* Medication & Code */}
                                            <td className="px-2 py-1.5 min-w-0">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span
                                                        onClick={() => setDossierRecord(record)}
                                                        className="font-bold text-gray-900 hover:text-blue-700 cursor-pointer truncate max-w-[190px] text-xs"
                                                        title="Click to view dossier"
                                                    >
                                                        {record.product_name}
                                                    </span>
                                                    <span className="font-mono text-[9px] text-gray-500 bg-gray-100 px-1 py-0.2 rounded">
                                                        {record.product_code}
                                                    </span>
                                                </div>
                                                <p className="text-[9.5px] text-gray-500 truncate max-w-[180px] mt-0.5">
                                                    {record.category}
                                                </p>
                                            </td>

                                            {/* Batch & Expiry */}
                                            <td className="px-2 py-1.5 whitespace-nowrap min-w-0">
                                                <span className="font-mono font-bold text-purple-800 bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded text-[10px] block truncate max-w-[110px]">
                                                    {record.batch_number}
                                                </span>
                                                {record.expiry_date ? (
                                                    <p className="text-[9.5px] text-gray-500 mt-0.5">
                                                        Exp: {new Date(record.expiry_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                                                    </p>
                                                ) : (
                                                    <p className="text-[9px] text-gray-400 mt-0.5">Non-dated</p>
                                                )}
                                            </td>

                                            {/* Movement Type */}
                                            <td className="px-2 py-1.5 whitespace-nowrap">
                                                {getMovementTypeBadge(record.movement_type)}
                                            </td>

                                            {/* Document / Origin */}
                                            <td className="px-2 py-1.5 whitespace-nowrap min-w-0">
                                                <span className="font-mono text-[10px] font-bold text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                                                    {record.invoice_no}
                                                </span>
                                                <p className="text-[9px] text-gray-400 truncate max-w-[110px] mt-0.5" title={record.notes}>
                                                    {record.notes}
                                                </p>
                                            </td>

                                            {/* Location / Bin */}
                                            <td className="px-2 py-1.5 whitespace-nowrap">
                                                {getLocationBadge(record.storage_type)}
                                            </td>

                                            {/* Delta Change */}
                                            <td className="px-2 py-1.5 text-right whitespace-nowrap">
                                                <span className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded ${
                                                    isPositive 
                                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                                        : isZero 
                                                            ? 'bg-gray-100 text-gray-600' 
                                                            : 'bg-rose-100 text-rose-800 border border-rose-200'
                                                }`}>
                                                    {isPositive ? `+${record.qty_change}` : record.qty_change} {record.unit}
                                                </span>
                                            </td>

                                            {/* Running Balance */}
                                            <td className="px-2 py-1.5 text-right whitespace-nowrap">
                                                <span className="font-mono text-[11px] font-bold text-gray-900">
                                                    {(record.running_balance ?? 0).toLocaleString()}
                                                </span>
                                                <p className="text-[9px] text-gray-400">on hand</p>
                                            </td>

                                            {/* Valuation */}
                                            <td className="px-2 py-1.5 text-right whitespace-nowrap">
                                                <span className="font-mono text-[11px] font-bold text-gray-900">
                                                    KSh {record.total_cost_value.toLocaleString()}
                                                </span>
                                                <p className="text-[9px] text-gray-400">
                                                    @ KSh {record.unit_cost.toLocaleString()}
                                                </p>
                                            </td>

                                            {/* Quick Actions (5 Compact Buttons) */}
                                            <td className="px-2 py-1.5 text-center whitespace-nowrap">
                                                <div className="flex items-center justify-center gap-1">
                                                    {/* 1. View 360 Dossier */}
                                                    <button
                                                        onClick={() => setDossierRecord(record)}
                                                        className="w-6 h-6 rounded bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white flex items-center justify-center transition-all border border-blue-200 text-[11px]"
                                                        title="View 360° Movement Dossier"
                                                    >
                                                        👁️
                                                    </button>

                                                    {/* 2. Print Voucher */}
                                                    <button
                                                        onClick={() => handlePrintVoucher(record)}
                                                        className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-800 text-gray-700 hover:text-white flex items-center justify-center transition-all border border-gray-200 text-[11px]"
                                                        title="Print Bin Card Voucher"
                                                    >
                                                        🖨️
                                                    </button>

                                                    {/* 3. Quick Stock Adjustment */}
                                                    <button
                                                        onClick={() => {
                                                            setAdjProductId(record.product_id);
                                                            if (record.batch_id) setAdjBatchId(record.batch_id);
                                                            setAdjLocation(record.storage_type);
                                                            setAdjType('RECONCILE');
                                                            setShowAdjustmentModal(true);
                                                        }}
                                                        className="w-6 h-6 rounded bg-purple-50 hover:bg-purple-600 text-purple-700 hover:text-white flex items-center justify-center transition-all border border-purple-200 text-[11px]"
                                                        title="Quick Physical Count Re-audit"
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
                                                        className="w-6 h-6 rounded bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white flex items-center justify-center transition-all border border-emerald-200 text-[11px]"
                                                        title="Transfer Storage Bin"
                                                    >
                                                        🔄
                                                    </button>

                                                    {/* 5. Delete / Void Transaction */}
                                                    <button
                                                        onClick={() => handleDeleteRecord(record)}
                                                        className="w-6 h-6 rounded bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white flex items-center justify-center transition-all border border-rose-200 text-[11px]"
                                                        title="Void Transaction"
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

                {/* Pagination Footer (Compact) */}
                {totalPages > 1 && (
                    <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 flex items-center justify-between flex-wrap gap-2 text-xs">
                        <div className="text-[11px] font-bold text-gray-600">
                            Page {currentPage} of {totalPages} ({filteredMovements.length} total entries)
                        </div>

                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setCurrentPage(1)}
                                disabled={currentPage === 1}
                                className="px-2 py-0.5 bg-white border border-gray-200 rounded text-[11px] font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                            >
                                First
                            </button>
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="px-2 py-0.5 bg-white border border-gray-200 rounded text-[11px] font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                            >
                                Prev
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
                                            className={`w-6 h-6 rounded text-[11px] font-bold transition-all ${
                                                currentPage === pageNum
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
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
                                className="px-2 py-0.5 bg-white border border-gray-200 rounded text-[11px] font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                            >
                                Next
                            </button>
                            <button
                                onClick={() => setCurrentPage(totalPages)}
                                disabled={currentPage === totalPages}
                                className="px-2 py-0.5 bg-white border border-gray-200 rounded text-[11px] font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                            >
                                Last
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ========================================== */}
            {/* MODAL 1: POST STOCK ADJUSTMENT & RECONCILE (SLEEK COMPACT) */}
            {/* ========================================== */}
            {showAdjustmentModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50 backdrop-blur-xs">
                    <div className="bg-white rounded-2xl max-w-lg w-full border border-gray-200 shadow-xl overflow-hidden">
                        <div className="px-4 py-3 bg-gradient-to-r from-purple-800 to-indigo-800 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-base">⚖️</span>
                                <div>
                                    <h2 className="text-sm font-bold">Post Inventory Stock Adjustment</h2>
                                    <p className="text-[10px] text-purple-200">Reconcile physical counts, surplus or damage</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowAdjustmentModal(false)}
                                className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xs font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveAdjustment} className="p-4 space-y-3 text-xs">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
                                    Method
                                </label>
                                <div className="grid grid-cols-3 gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => setAdjType('ADD')}
                                        className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all ${
                                            adjType === 'ADD'
                                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                                : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                                        }`}
                                    >
                                        ➕ Add Stock
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAdjType('SUBTRACT')}
                                        className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all ${
                                            adjType === 'SUBTRACT'
                                                ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                                                : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                                        }`}
                                    >
                                        ➖ Deduct
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAdjType('RECONCILE')}
                                        className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all ${
                                            adjType === 'RECONCILE'
                                                ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                                                : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                                        }`}
                                    >
                                        ⚖️ Re-audit
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-gray-600 uppercase mb-0.5">
                                    Medication Item *
                                </label>
                                <select
                                    required
                                    value={adjProductId}
                                    onChange={e => setAdjProductId(e.target.value ? Number(e.target.value) : '')}
                                    className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-800 focus:outline-none focus:border-purple-600"
                                >
                                    <option value="">-- Choose Medication --</option>
                                    {products.map(p => (
                                        <option key={p.pid} value={p.pid}>
                                            {p.product_code} - {p.product_name} (Stock: {p.current_stock} {p.sales_unit})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-0.5">
                                        Batch (Optional)
                                    </label>
                                    <select
                                        value={adjBatchId}
                                        onChange={e => setAdjBatchId(e.target.value ? Number(e.target.value) : '')}
                                        className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-800 focus:outline-none focus:border-purple-600"
                                    >
                                        <option value="">-- Default Lot --</option>
                                        {batches.map(b => (
                                            <option key={b.batch_id} value={b.batch_id}>
                                                {b.batch_number} (Rem: {b.remaining_qty})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-0.5">
                                        Storage Bin
                                    </label>
                                    <select
                                        value={adjLocation}
                                        onChange={e => setAdjLocation(e.target.value as StorageLocation)}
                                        className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-800 focus:outline-none focus:border-purple-600"
                                    >
                                        <option value="Main Store">🏢 Main Store</option>
                                        <option value="Dispensing Shelf">💊 Dispensing Shelf</option>
                                        <option value="Cold Chain (2-8°C)">❄️ Cold Chain (2-8°C)</option>
                                        <option value="Quarantine Room">⛔ Quarantine Room</option>
                                        <option value="Damaged Bay">⚠️ Damaged Bay</option>
                                    </select>
                                </div>
                            </div>

                            {adjType === 'RECONCILE' ? (
                                <div className="p-2.5 bg-purple-50 rounded-lg border border-purple-200 space-y-1">
                                    <label className="block text-[10px] font-bold text-purple-900 uppercase">
                                        Actual Physical Count Verified
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        value={adjPhysicalCount}
                                        onChange={e => setAdjPhysicalCount(e.target.value)}
                                        placeholder="e.g. 145"
                                        className="w-full px-2.5 py-1.5 bg-white border border-purple-300 rounded-lg text-sm font-bold text-purple-950 focus:outline-none focus:border-purple-600"
                                    />
                                    {adjProductId && adjPhysicalCount && (
                                        <div className="text-[10px] font-bold text-purple-800">
                                            {(() => {
                                                const current = products.find(p => p.pid === Number(adjProductId))?.current_stock || 0;
                                                const phys = parseFloat(adjPhysicalCount) || 0;
                                                const diff = phys - current;
                                                return <span>System: {current} | Physical: {phys} | Variance: {diff > 0 ? `+${diff}` : diff} units</span>;
                                            })()}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-0.5">
                                        Quantity to {adjType === 'ADD' ? 'Add (+)' : 'Deduct (-)'}
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        value={adjQuantity}
                                        onChange={e => setAdjQuantity(e.target.value)}
                                        placeholder="e.g. 10"
                                        className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold text-gray-900 focus:outline-none focus:border-purple-600"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-[10px] font-bold text-gray-600 uppercase mb-0.5">
                                    Reason Code
                                </label>
                                <select
                                    value={adjReason}
                                    onChange={e => setAdjReason(e.target.value)}
                                    className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-800 focus:outline-none focus:border-purple-600"
                                >
                                    <option value="Physical Count Audit Discrepancy">Physical Count Audit Discrepancy</option>
                                    <option value="Damaged / Broken Vials during dispensing">Damaged / Broken Vials during dispensing</option>
                                    <option value="Expired Stock Removal to Quarantine">Expired Stock Removal to Quarantine</option>
                                    <option value="Manufacturer Surplus Delivery">Manufacturer Surplus Delivery</option>
                                    <option value="Spillage or Leakage Defect">Spillage or Leakage Defect</option>
                                    <option value="Sample / Internal Clinic Use">Sample / Internal Clinic Use</option>
                                    <option value="Batch Entry Correction">Batch Entry Correction</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-gray-600 uppercase mb-0.5">
                                    Audit Remarks
                                </label>
                                <textarea
                                    rows={2}
                                    value={adjNotes}
                                    onChange={e => setAdjNotes(e.target.value)}
                                    placeholder="Add authorization context..."
                                    className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-800 focus:outline-none focus:border-purple-600 resize-none"
                                />
                            </div>

                            <div className="pt-2 border-t border-gray-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowAdjustmentModal(false)}
                                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-bold text-xs"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmittingAdj}
                                    className="px-4 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg font-bold text-xs shadow-xs disabled:opacity-50"
                                >
                                    {isSubmittingAdj ? 'Posting...' : 'Save Adjustment'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================== */}
            {/* MODAL 2: INTER-BIN STORAGE TRANSFER (COMPACT) */}
            {/* ========================================== */}
            {showTransferModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50 backdrop-blur-xs">
                    <div className="bg-white rounded-2xl max-w-md w-full border border-gray-200 shadow-xl overflow-hidden">
                        <div className="px-4 py-3 bg-gradient-to-r from-blue-700 to-cyan-800 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-base">🔄</span>
                                <div>
                                    <h2 className="text-sm font-bold">Inter-Bin Storage Transfer</h2>
                                    <p className="text-[10px] text-blue-200">Re-allocate stock between bins</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowTransferModal(false)}
                                className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xs font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveTransfer} className="p-4 space-y-3 text-xs">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-600 uppercase mb-0.5">
                                    Medication *
                                </label>
                                <select
                                    required
                                    value={trfProductId}
                                    onChange={e => setTrfProductId(e.target.value ? Number(e.target.value) : '')}
                                    className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-800 focus:outline-none focus:border-blue-600"
                                >
                                    <option value="">-- Choose Medication --</option>
                                    {products.map(p => (
                                        <option key={p.pid} value={p.pid}>
                                            {p.product_code} - {p.product_name} (Stock: {p.current_stock})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-0.5">
                                        Source (From)
                                    </label>
                                    <select
                                        value={trfFromLocation}
                                        onChange={e => setTrfFromLocation(e.target.value as StorageLocation)}
                                        className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-800 focus:outline-none focus:border-blue-600"
                                    >
                                        <option value="Main Store">🏢 Main Store</option>
                                        <option value="Dispensing Shelf">💊 Dispensing Shelf</option>
                                        <option value="Cold Chain (2-8°C)">❄️ Cold Chain</option>
                                        <option value="Quarantine Room">⛔ Quarantine</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-0.5">
                                        Target (To)
                                    </label>
                                    <select
                                        value={trfToLocation}
                                        onChange={e => setTrfToLocation(e.target.value as StorageLocation)}
                                        className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-800 focus:outline-none focus:border-blue-600"
                                    >
                                        <option value="Dispensing Shelf">💊 Dispensing Shelf</option>
                                        <option value="Main Store">🏢 Main Store</option>
                                        <option value="Cold Chain (2-8°C)">❄️ Cold Chain</option>
                                        <option value="Quarantine Room">⛔ Quarantine</option>
                                        <option value="Damaged Bay">⚠️ Damaged Bay</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-0.5">
                                        Quantity *
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        value={trfQuantity}
                                        onChange={e => setTrfQuantity(e.target.value)}
                                        placeholder="e.g. 20"
                                        className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-900 focus:outline-none focus:border-blue-600"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-0.5">
                                        Batch (Optional)
                                    </label>
                                    <select
                                        value={trfBatchId}
                                        onChange={e => setTrfBatchId(e.target.value ? Number(e.target.value) : '')}
                                        className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-800 focus:outline-none focus:border-blue-600"
                                    >
                                        <option value="">-- Default Lot --</option>
                                        {batches.map(b => (
                                            <option key={b.batch_id} value={b.batch_id}>
                                                {b.batch_number}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-gray-600 uppercase mb-0.5">
                                    Notes
                                </label>
                                <textarea
                                    rows={2}
                                    value={trfNotes}
                                    onChange={e => setTrfNotes(e.target.value)}
                                    placeholder="Restocking notes..."
                                    className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-800 focus:outline-none focus:border-blue-600 resize-none"
                                />
                            </div>

                            <div className="pt-2 border-t border-gray-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowTransferModal(false)}
                                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-bold text-xs"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmittingTrf}
                                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-xs disabled:opacity-50"
                                >
                                    {isSubmittingTrf ? 'Transferring...' : 'Execute Transfer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================== */}
            {/* MODAL 3: 360° MOVEMENT DOSSIER (COMPACT) */}
            {/* ========================================== */}
            {dossierRecord && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50 backdrop-blur-xs">
                    <div className="bg-white rounded-2xl max-w-lg w-full border border-gray-200 shadow-xl overflow-hidden">
                        <div className="px-4 py-3 bg-gradient-to-r from-gray-900 to-blue-900 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-base">👁️</span>
                                <div>
                                    <div className="flex items-center gap-1.5">
                                        <h2 className="text-xs font-bold font-mono">{dossierRecord.movement_id}</h2>
                                        <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-white/20 text-white font-bold">
                                            {dossierRecord.invoice_no}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-gray-300">Stock Movement Dossier</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setDossierRecord(null)}
                                className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xs font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-4 space-y-3 text-xs">
                            <div className="p-2.5 bg-blue-50/60 rounded-xl border border-blue-200 flex items-center justify-between flex-wrap gap-2">
                                <div>
                                    <span className="text-[9px] font-bold text-blue-800 uppercase">Product</span>
                                    <h3 className="text-xs font-bold text-gray-950">{dossierRecord.product_name}</h3>
                                    <p className="font-mono text-[10px] text-gray-500 mt-0.5">{dossierRecord.product_code} • {dossierRecord.category}</p>
                                </div>
                                <div>
                                    {getMovementTypeBadge(dossierRecord.movement_type)}
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                <div className="p-2 bg-gray-50 rounded-lg border border-gray-200">
                                    <div className="text-[9px] font-bold text-gray-500 uppercase">Batch #</div>
                                    <div className="text-xs font-bold font-mono text-gray-900 mt-0.5">{dossierRecord.batch_number}</div>
                                </div>
                                <div className="p-2 bg-gray-50 rounded-lg border border-gray-200">
                                    <div className="text-[9px] font-bold text-gray-500 uppercase">Expiry</div>
                                    <div className="text-xs font-bold font-mono text-gray-900 mt-0.5">{dossierRecord.expiry_date || 'N/A'}</div>
                                </div>
                                <div className="p-2 bg-gray-50 rounded-lg border border-gray-200">
                                    <div className="text-[9px] font-bold text-gray-500 uppercase">Storage</div>
                                    <div className="mt-0.5">{getLocationBadge(dossierRecord.storage_type)}</div>
                                </div>
                                <div className="p-2 bg-gray-50 rounded-lg border border-gray-200">
                                    <div className="text-[9px] font-bold text-gray-500 uppercase">Delta</div>
                                    <div className={`text-xs font-bold font-mono mt-0.5 ${dossierRecord.qty_change > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                        {dossierRecord.qty_change > 0 ? `+${dossierRecord.qty_change}` : dossierRecord.qty_change} {dossierRecord.unit}
                                    </div>
                                </div>
                                <div className="p-2 bg-gray-50 rounded-lg border border-gray-200">
                                    <div className="text-[9px] font-bold text-gray-500 uppercase">Unit Cost</div>
                                    <div className="text-xs font-bold font-mono text-gray-900 mt-0.5">KSh {dossierRecord.unit_cost.toLocaleString()}</div>
                                </div>
                                <div className="p-2 bg-gray-50 rounded-lg border border-gray-200">
                                    <div className="text-[9px] font-bold text-gray-500 uppercase">Valuation</div>
                                    <div className="text-xs font-bold font-mono text-gray-900 mt-0.5">KSh {dossierRecord.total_cost_value.toLocaleString()}</div>
                                </div>
                            </div>

                            <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                                <div className="text-[10px] font-bold text-gray-700 uppercase">Remarks</div>
                                <p className="text-[11px] text-gray-600 mt-0.5 leading-relaxed">
                                    {dossierRecord.notes || 'No remarks provided.'}
                                </p>
                            </div>

                            <div className="flex items-center justify-between text-[10px] font-semibold text-gray-500 pt-2 border-t border-gray-100">
                                <div>Operator: {dossierRecord.operator_name}</div>
                                <div>Date: {new Date(dossierRecord.created_at).toLocaleString()}</div>
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-2">
                                <button
                                    onClick={() => handlePrintVoucher(dossierRecord)}
                                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-bold text-xs flex items-center gap-1"
                                >
                                    <span>🖨️</span> Print Voucher
                                </button>
                                <button
                                    onClick={() => setDossierRecord(null)}
                                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================== */}
            {/* PRINTABLE BIN CARD / VOUCHER */}
            {/* ========================================== */}
            <div className="hidden print:block fixed inset-0 bg-white p-8 z-[9999]" ref={printAreaRef}>
                {printRecord && (
                    <div className="max-w-xl mx-auto space-y-4 text-black font-sans text-xs">
                        <div className="border-b-2 border-black pb-3 text-center">
                            <h1 className="text-xl font-bold uppercase tracking-wider">ALPHA PHARMACY &amp; HEALTHCARE</h1>
                            <p className="text-[10px] font-bold mt-0.5">Licensed Retail &amp; Hospital Pharmacy | Reg #PH-89420</p>
                            <p className="text-[10px]">Location: CBD Plaza | Tel: +254 700 000 000 | dispensary@alphapharmacy.ke</p>
                            <div className="mt-2 inline-block px-3 py-0.5 bg-black text-white font-bold text-xs uppercase rounded">
                                INVENTORY BIN CARD &amp; MOVEMENT VOUCHER
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 border border-black p-2.5 text-[11px]">
                            <div>
                                <p><span className="font-bold">Voucher ID:</span> {printRecord.movement_id}</p>
                                <p><span className="font-bold">Date:</span> {new Date(printRecord.created_at).toLocaleString()}</p>
                                <p><span className="font-bold">Doc Ref:</span> {printRecord.invoice_no}</p>
                                <p><span className="font-bold">Type:</span> {printRecord.movement_type.replace(/_/g, ' ')}</p>
                            </div>
                            <div>
                                <p><span className="font-bold">Medication:</span> {printRecord.product_name}</p>
                                <p><span className="font-bold">Item Code:</span> {printRecord.product_code}</p>
                                <p><span className="font-bold">Batch / Lot:</span> {printRecord.batch_number}</p>
                                <p><span className="font-bold">Expiry Date:</span> {printRecord.expiry_date || 'N/A'}</p>
                            </div>
                        </div>

                        <table className="w-full border-collapse border border-black text-[11px] text-left">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="border border-black p-1.5">Storage Bin</th>
                                    <th className="border border-black p-1.5 text-right">Inflow</th>
                                    <th className="border border-black p-1.5 text-right">Outflow</th>
                                    <th className="border border-black p-1.5 text-right">Unit Cost</th>
                                    <th className="border border-black p-1.5 text-right">Valuation</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className="border border-black p-1.5 font-bold">{printRecord.storage_type}</td>
                                    <td className="border border-black p-1.5 text-right font-mono font-bold">
                                        {printRecord.qty_change > 0 ? `+${printRecord.qty_change} ${printRecord.unit}` : '-'}
                                    </td>
                                    <td className="border border-black p-1.5 text-right font-mono font-bold">
                                        {printRecord.qty_change < 0 ? `${printRecord.qty_change} ${printRecord.unit}` : '-'}
                                    </td>
                                    <td className="border border-black p-1.5 text-right font-mono">
                                        KSh {printRecord.unit_cost.toLocaleString()}
                                    </td>
                                    <td className="border border-black p-1.5 text-right font-mono font-bold">
                                        KSh {printRecord.total_cost_value.toLocaleString()}
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        <div className="border border-black p-2 text-[10px]">
                            <span className="font-bold">Audit Rationale / Remarks:</span>
                            <p className="mt-0.5">{printRecord.notes || 'Verified according to standard pharmaceutical procedures.'}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-6 pt-6 text-[10px]">
                            <div className="border-t border-black pt-1 text-center">
                                <p className="font-bold">Prepared / Logged By</p>
                                <p className="mt-3">{printRecord.operator_name}</p>
                                <p className="text-[9px] text-gray-500">Storekeeper</p>
                            </div>
                            <div className="border-t border-black pt-1 text-center">
                                <p className="font-bold">Authorized By</p>
                                <p className="mt-3">Dr. Jimhawkins Korir</p>
                                <p className="text-[9px] text-gray-500">Superintendent Pharmacist</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
