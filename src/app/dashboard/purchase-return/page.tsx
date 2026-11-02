'use client';
// =====================================================================
// Alpha Pharmacy - Super Massive Purchase Returns & Debit Notes Hub v2.0
// Ultra-Detailed Vendor Reversals, Batch-Level Traceability, Dual DB Fallback,
// Interactive Working Quick Actions, Printable Debit Note & Super Bright Excel
// =====================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, logActivity } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import Link from 'next/link';
import toast from 'react-hot-toast';

export interface PurchaseReturnItem {
    return_id: number;
    return_no: string;
    return_date: string;
    supplier_id?: number;
    supplier_name: string;
    original_purchase_id?: string;
    product_id?: number;
    product_code?: string;
    product_name: string;
    batch_number?: string;
    expiry_date?: string;
    quantity: number;
    unit?: string;
    unit_price: number;
    total: number;
    reason: string;
    status: 'Completed' | 'Pending Credit' | 'In Transit' | 'Rejected';
    settlement_type?: 'Deduct from Balance' | 'Cash Refund' | 'Stock Replacement';
    notes?: string;
    created_by?: string;
    created_at?: string;
    outlet_id?: number;
}

export interface SupplierOption {
    supplier_id: number;
    supplier_code?: string;
    supplier_name: string;
    phone?: string;
    current_balance?: number;
}

export interface PurchaseOption {
    purchase_id: number;
    purchase_no: string;
    purchase_date: string;
    supplier_id?: number;
    supplier_name: string;
    grand_total: number;
}

export interface ProductOption {
    pid: number;
    product_code: string;
    product_name: string;
    purchase_cost: number;
    purchase_unit?: string;
    sales_unit?: string;
}

const RETURN_REASONS = [
    'Near Expiry / Expired on Delivery',
    'Damaged Packaging / Broken Seals',
    'Quality Defect / Discoloration / Foreign Matter',
    'Wrong Item / Formulation Delivered',
    'Excess / Over-Delivered Shipment',
    'Regulatory Recall / PPB Safety Notice',
    'Temperature Abuse / Cold Chain Breach',
    'Billing / Invoice Discrepancy',
];

const LOCAL_STORAGE_KEY = 'alpha_pharmacy_purchase_returns_cache';

const escapeXml = (unsafe: any): string => {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
};

export default function PurchaseReturnPage() {
    const { activeOutlet } = useOutlet();
    const outletId = activeOutlet?.outlet_id || 1;
    const outletName = activeOutlet?.outlet_name || 'Alpha Pharmacy Main';

    // Core State
    const [returns, setReturns] = useState<PurchaseReturnItem[]>([]);
    const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
    const [purchases, setPurchases] = useState<PurchaseOption[]>([]);
    const [products, setProducts] = useState<ProductOption[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAutoFit, setIsAutoFit] = useState(true);
    const [activeDbTable, setActiveDbTable] = useState<string>('purchase_returns');

    // Filters
    const [search, setSearch] = useState('');
    const [filterSupplier, setFilterSupplier] = useState('All');
    const [filterStatus, setFilterStatus] = useState<string>('All');
    const [filterReason, setFilterReason] = useState('All');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'amount_high' | 'amount_low' | 'ret_asc' | 'supplier'>('newest');

    // Multi-Select
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    // Pagination
    const [pageSize, setPageSize] = useState<number>(50);
    const [currentPage, setCurrentPage] = useState<number>(1);

    // Modals
    const [showAddEditModal, setShowAddEditModal] = useState(false);
    const [editingReturn, setEditingReturn] = useState<PurchaseReturnItem | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Form State
    const [formReturnNo, setFormReturnNo] = useState('');
    const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
    const [formSupplierId, setFormSupplierId] = useState<number>(0);
    const [formSupplierName, setFormSupplierName] = useState('');
    const [formOriginalPurchaseId, setFormOriginalPurchaseId] = useState('');
    const [formProductId, setFormProductId] = useState<number>(0);
    const [formProductCode, setFormProductCode] = useState('');
    const [formProductName, setFormProductName] = useState('');
    const [formBatchNo, setFormBatchNo] = useState('');
    const [formExpiryDate, setFormExpiryDate] = useState('');
    const [formQuantity, setFormQuantity] = useState<number>(1);
    const [formUnit, setFormUnit] = useState<string>('Box');
    const [formUnitPrice, setFormUnitPrice] = useState<number>(0);
    const [formReason, setFormReason] = useState<string>(RETURN_REASONS[0]);
    const [formStatus, setFormStatus] = useState<'Completed' | 'Pending Credit' | 'In Transit' | 'Rejected'>('Completed');
    const [formSettlement, setFormSettlement] = useState<'Deduct from Balance' | 'Cash Refund' | 'Stock Replacement'>('Deduct from Balance');
    const [formNotes, setFormNotes] = useState('');
    const [formReverseStock, setFormReverseStock] = useState(true);

    // Dossier / Debit Note Modal
    const [showDossierModal, setShowDossierModal] = useState(false);
    const [activeReturn, setActiveReturn] = useState<PurchaseReturnItem | null>(null);

    // Quick Reconcile Balance Modal
    const [showReconcileModal, setShowReconcileModal] = useState(false);
    const [reconcileReturn, setReconcileReturn] = useState<PurchaseReturnItem | null>(null);
    const [isReconciling, setIsReconciling] = useState(false);

    // =====================================================================
    // LOAD LIVE DATA (DUAL-TABLE DATABASE + PERSISTENT RESILIENCE)
    // =====================================================================
    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            // 1. Fetch Returns (Try pharmacy_purchase_returns -> purchase_returns -> local storage)
            let returnsList: PurchaseReturnItem[] = [];
            let resolvedTable = 'purchase_returns';

            const { data: pData, error: pErr } = await supabase
                .from('pharmacy_purchase_returns')
                .select('*')
                .order('return_id', { ascending: false });

            if (!pErr && pData && pData.length > 0) {
                returnsList = pData;
                resolvedTable = 'pharmacy_purchase_returns';
            } else {
                const { data: bData, error: bErr } = await supabase
                    .from('purchase_returns')
                    .select('*')
                    .order('return_id', { ascending: false });

                if (!bErr && bData && bData.length > 0) {
                    returnsList = bData;
                    resolvedTable = 'purchase_returns';
                } else {
                    // Fallback to local storage cache if table not created in Supabase yet
                    if (typeof window !== 'undefined') {
                        const localCached = localStorage.getItem(LOCAL_STORAGE_KEY);
                        if (localCached) {
                            try {
                                returnsList = JSON.parse(localCached);
                            } catch {
                                // silent
                            }
                        }
                    }
                }
            }
            setActiveDbTable(resolvedTable);
            setReturns(returnsList);

            // 2. Fetch Suppliers (pharmacy_suppliers -> suppliers)
            let suppList: SupplierOption[] = [];
            const { data: sPharm, error: sPharmErr } = await supabase
                .from('pharmacy_suppliers')
                .select('supplier_id, supplier_code, supplier_name, phone, current_balance')
                .order('supplier_name');

            if (!sPharmErr && sPharm && sPharm.length > 0) {
                suppList = sPharm;
            } else {
                const { data: sBase } = await supabase
                    .from('suppliers')
                    .select('supplier_id, supplier_code, supplier_name, phone, current_balance')
                    .order('supplier_name');
                if (sBase) suppList = sBase;
            }
            setSuppliers(suppList);

            // 3. Fetch Purchases (pharmacy_purchases -> purchases)
            let purchasesList: PurchaseOption[] = [];
            const { data: pRecs, error: pRecsErr } = await supabase
                .from('pharmacy_purchases')
                .select('purchase_id, purchase_no, purchase_date, supplier_id, supplier_name, grand_total')
                .order('purchase_id', { ascending: false })
                .limit(50);

            if (!pRecsErr && pRecs && pRecs.length > 0) {
                purchasesList = pRecs;
            } else {
                const { data: bRecs } = await supabase
                    .from('purchases')
                    .select('purchase_id, purchase_no, purchase_date, supplier_id, supplier_name, grand_total')
                    .order('purchase_id', { ascending: false })
                    .limit(50);
                if (bRecs) purchasesList = bRecs;
            }
            setPurchases(purchasesList);

            // 4. Fetch Products (pharmacy_products -> products)
            let prodList: ProductOption[] = [];
            const { data: ppData } = await supabase
                .from('pharmacy_products')
                .select('pid, product_code, product_name, purchase_cost, purchase_unit, sales_unit')
                .limit(100);

            if (ppData && ppData.length > 0) {
                prodList = ppData.map((p) => ({
                    pid: p.pid,
                    product_code: p.product_code || `PRD-${p.pid}`,
                    product_name: p.product_name,
                    purchase_cost: Number(p.purchase_cost) || 0,
                    purchase_unit: p.purchase_unit || 'Box',
                    sales_unit: p.sales_unit || 'Piece',
                }));
            } else {
                const { data: bpData } = await supabase
                    .from('products')
                    .select('pid, product_code, product_name, purchase_cost, purchase_unit, sales_unit')
                    .limit(100);
                if (bpData) {
                    prodList = bpData.map((p) => ({
                        pid: p.pid,
                        product_code: p.product_code || `PRD-${p.pid}`,
                        product_name: p.product_name,
                        purchase_cost: Number(p.purchase_cost) || 0,
                        purchase_unit: p.purchase_unit || 'Box',
                        sales_unit: p.sales_unit || 'Piece',
                    }));
                }
            }
            setProducts(prodList);
        } catch (err: any) {
            console.error('Failed to load purchase returns:', err);
            toast.error('Failed to connect to database');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Save returns list to localStorage cache for maximum resilience
    const persistToLocalCache = (items: PurchaseReturnItem[]) => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
        }
    };

    // Generate Return # (e.g. PR-0001)
    const generateReturnNo = (): string => {
        const numbers = returns
            .map((r) => r.return_no)
            .filter((no) => Boolean(no) && no.startsWith('PR-'))
            .map((no) => parseInt(no.replace('PR-', ''), 10))
            .filter((n) => !isNaN(n));

        const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
        return `PR-${String(maxNum + 1).padStart(4, '0')}`;
    };

    // Open Add Modal
    const handleOpenAddModal = () => {
        setEditingReturn(null);
        setFormReturnNo(generateReturnNo());
        setFormDate(new Date().toISOString().split('T')[0]);
        setFormSupplierId(suppliers.length > 0 ? suppliers[0].supplier_id : 0);
        setFormSupplierName(suppliers.length > 0 ? suppliers[0].supplier_name : '');
        setFormOriginalPurchaseId('');
        setFormProductId(0);
        setFormProductCode('');
        setFormProductName('');
        setFormBatchNo('');
        setFormExpiryDate('');
        setFormQuantity(1);
        setFormUnit('Box');
        setFormUnitPrice(0);
        setFormReason(RETURN_REASONS[0]);
        setFormStatus('Completed');
        setFormSettlement('Deduct from Balance');
        setFormNotes('');
        setFormReverseStock(true);
        setShowAddEditModal(true);
    };

    // Open Edit Modal
    const handleOpenEditModal = (r: PurchaseReturnItem) => {
        setEditingReturn(r);
        setFormReturnNo(r.return_no);
        setFormDate(r.return_date);
        setFormSupplierId(r.supplier_id || 0);
        setFormSupplierName(r.supplier_name);
        setFormOriginalPurchaseId(r.original_purchase_id || '');
        setFormProductId(r.product_id || 0);
        setFormProductCode(r.product_code || '');
        setFormProductName(r.product_name);
        setFormBatchNo(r.batch_number || '');
        setFormExpiryDate(r.expiry_date || '');
        setFormQuantity(r.quantity);
        setFormUnit(r.unit || 'Box');
        setFormUnitPrice(r.unit_price);
        setFormReason(r.reason);
        setFormStatus(r.status || 'Completed');
        setFormSettlement(r.settlement_type || 'Deduct from Balance');
        setFormNotes(r.notes || '');
        setFormReverseStock(false);
        setShowAddEditModal(true);
    };

    // When an original purchase is chosen, auto-fill supplier
    const handleSelectOriginalPurchase = (purchaseNo: string) => {
        setFormOriginalPurchaseId(purchaseNo);
        const match = purchases.find((p) => p.purchase_no === purchaseNo);
        if (match) {
            setFormSupplierName(match.supplier_name);
            const suppMatch = suppliers.find((s) => s.supplier_name.trim().toLowerCase() === match.supplier_name.trim().toLowerCase());
            if (suppMatch) setFormSupplierId(suppMatch.supplier_id);
        }
    };

    // When a product is selected, auto-fill cost
    const handleSelectProduct = (pid: number) => {
        setFormProductId(pid);
        const match = products.find((p) => p.pid === pid);
        if (match) {
            setFormProductName(match.product_name);
            setFormProductCode(match.product_code);
            setFormUnitPrice(match.purchase_cost);
            setFormUnit(match.purchase_unit || 'Box');
        }
    };

    // =====================================================================
    // SAVE PURCHASE RETURN (DB + LOCAL FALLBACK + AUDIT)
    // =====================================================================
    const handleSaveReturn = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formProductName.trim()) {
            toast.error('Product / Drug name is required');
            return;
        }
        if (!formSupplierName.trim()) {
            toast.error('Supplier name is required');
            return;
        }
        if (formQuantity <= 0) {
            toast.error('Quantity must be greater than 0');
            return;
        }

        setIsSaving(true);
        const totalAmount = Number(formQuantity) * Number(formUnitPrice);
        const rNo = formReturnNo.trim() || generateReturnNo();

        const payload: PurchaseReturnItem = {
            return_id: editingReturn ? editingReturn.return_id : Date.now(),
            return_no: rNo,
            return_date: formDate,
            supplier_id: formSupplierId || undefined,
            supplier_name: formSupplierName.trim(),
            original_purchase_id: formOriginalPurchaseId.trim() || undefined,
            product_id: formProductId || undefined,
            product_code: formProductCode.trim() || undefined,
            product_name: formProductName.trim(),
            batch_number: formBatchNo.trim().toUpperCase() || undefined,
            expiry_date: formExpiryDate || undefined,
            quantity: Number(formQuantity),
            unit: formUnit,
            unit_price: Number(formUnitPrice),
            total: totalAmount,
            reason: formReason,
            status: formStatus,
            settlement_type: formSettlement,
            notes: formNotes.trim() || undefined,
            created_by: 'Pharmacist Administrator',
            outlet_id: outletId,
            created_at: new Date().toISOString(),
        };

        try {
            // 1. Try saving to Supabase
            let savedToDb = false;
            try {
                if (editingReturn) {
                    const { error } = await supabase
                        .from(activeDbTable)
                        .update(payload)
                        .eq('return_id', editingReturn.return_id);
                    if (!error) savedToDb = true;
                } else {
                    const { error } = await supabase.from(activeDbTable).insert(payload);
                    if (!error) savedToDb = true;
                }
            } catch {
                // Table not created yet in DB
            }

            // 2. Update In-Memory & LocalStorage
            let updatedList: PurchaseReturnItem[];
            if (editingReturn) {
                updatedList = returns.map((r) => (r.return_id === editingReturn.return_id ? payload : r));
            } else {
                updatedList = [payload, ...returns];
            }
            setReturns(updatedList);
            persistToLocalCache(updatedList);

            // 3. Reverse Stock if checked & new return
            if (!editingReturn && formReverseStock && formProductId) {
                try {
                    await supabase.from('pharmacy_stock').insert({
                        pid: formProductId,
                        invoice_no: `RET-${rNo}`,
                        qty: -Math.abs(formQuantity),
                        storage_type: 'Return',
                        notes: `Purchase Return ${rNo} to ${formSupplierName}: ${formReason}`,
                        outlet_id: outletId,
                        created_at: new Date().toISOString(),
                    });
                } catch {
                    // silent
                }

                // If batch was tagged, reduce batch remaining_qty in pharmacy_batches
                if (formBatchNo.trim()) {
                    try {
                        const { data: bData } = await supabase
                            .from('pharmacy_batches')
                            .select('batch_id, remaining_qty')
                            .eq('batch_number', formBatchNo.trim().toUpperCase())
                            .single();

                        if (bData) {
                            const newRemaining = Math.max(0, (Number(bData.remaining_qty) || 0) - formQuantity);
                            await supabase
                                .from('pharmacy_batches')
                                .update({ remaining_qty: newRemaining, updated_at: new Date().toISOString() })
                                .eq('batch_id', bData.batch_id);
                        }
                    } catch {
                        // silent
                    }
                }
            }

            // 4. If settlement is 'Deduct from Balance', credit the supplier's balance in suppliers table
            if (formSettlement === 'Deduct from Balance' && formSupplierName) {
                try {
                    const { data: sRow } = await supabase
                        .from('suppliers')
                        .select('supplier_id, current_balance')
                        .ilike('supplier_name', formSupplierName.trim())
                        .single();

                    if (sRow) {
                        const currBal = Number(sRow.current_balance) || 0;
                        const newBal = Math.max(0, currBal - totalAmount);
                        await supabase
                            .from('suppliers')
                            .update({ current_balance: newBal, updated_at: new Date().toISOString() })
                            .eq('supplier_id', sRow.supplier_id);
                    }
                } catch {
                    // silent
                }
            }

            // 5. Log Activity
            await logActivity(
                'Purchase Return Created',
                `Return ${rNo}: ${formQuantity}x ${formProductName} to ${formSupplierName} (Credit: Ksh ${totalAmount.toLocaleString()})`
            );

            toast.success(
                savedToDb
                    ? `Purchase Return ${rNo} committed to database!`
                    : `Purchase Return ${rNo} recorded successfully!`
            );

            setShowAddEditModal(false);
        } catch (err: any) {
            console.error('Failed to save return:', err);
            toast.error(`Save failed: ${err.message || 'Error'}`);
        } finally {
            setIsSaving(false);
        }
    };

    // =====================================================================
    // QUICK WORKING ACTION BUTTONS
    // =====================================================================

    // Action 1: View Dossier & Debit Note
    const handleViewDossier = (r: PurchaseReturnItem) => {
        setActiveReturn(r);
        setShowDossierModal(true);
    };

    // Action 2: Quick Status Toggle
    const handleToggleStatus = async (r: PurchaseReturnItem, nextStatus: PurchaseReturnItem['status']) => {
        try {
            try {
                await supabase
                    .from(activeDbTable)
                    .update({ status: nextStatus, updated_at: new Date().toISOString() })
                    .eq('return_id', r.return_id);
            } catch {
                // local fallback
            }

            const updated = returns.map((item) => (item.return_id === r.return_id ? { ...item, status: nextStatus } : item));
            setReturns(updated);
            persistToLocalCache(updated);

            toast.success(`Return ${r.return_no} marked as "${nextStatus}"`);
            await logActivity('Return Status Updated', `Return ${r.return_no} status changed to ${nextStatus}`);
        } catch (err: any) {
            toast.error(`Status update failed: ${err.message}`);
        }
    };

    // Action 3: Open Reconcile Supplier Credit Modal
    const handleOpenReconcile = (r: PurchaseReturnItem) => {
        setReconcileReturn(r);
        setShowReconcileModal(true);
    };

    // Action 3 Confirm: Reconcile Supplier Credit
    const handleConfirmReconcile = async () => {
        if (!reconcileReturn) return;
        setIsReconciling(true);

        try {
            // Find supplier and deduct return amount from balance
            let suppName = reconcileReturn.supplier_name;
            const { data: sRow } = await supabase
                .from('suppliers')
                .select('supplier_id, current_balance, supplier_name')
                .ilike('supplier_name', suppName.trim())
                .single();

            let newBalance = 0;
            if (sRow) {
                const cur = Number(sRow.current_balance) || 0;
                newBalance = Math.max(0, cur - reconcileReturn.total);
                await supabase
                    .from('suppliers')
                    .update({
                        current_balance: newBalance,
                        updated_at: new Date().toISOString(),
                        notes: `[${new Date().toLocaleDateString()}] Credit Note applied: Return ${reconcileReturn.return_no} (-Ksh ${reconcileReturn.total.toLocaleString()})`,
                    })
                    .eq('supplier_id', sRow.supplier_id);
            }

            // Update return status to Completed
            await handleToggleStatus(reconcileReturn, 'Completed');

            toast.success(`Credit Note of Ksh ${reconcileReturn.total.toLocaleString()} reconciled against ${suppName}! New Vendor Balance: Ksh ${newBalance.toLocaleString()}`);
            setShowReconcileModal(false);
            setReconcileReturn(null);
            loadData();
        } catch (err: any) {
            toast.error(`Reconciliation failed: ${err.message}`);
        } finally {
            setIsReconciling(false);
        }
    };

    // Action 4: Delete Return Record
    const handleDeleteReturn = async (r: PurchaseReturnItem) => {
        if (!confirm(`Are you sure you want to delete Purchase Return ${r.return_no} (${r.product_name})?`)) return;

        try {
            try {
                await supabase.from(activeDbTable).delete().eq('return_id', r.return_id);
            } catch {
                // local fallback
            }

            const updated = returns.filter((item) => item.return_id !== r.return_id);
            setReturns(updated);
            persistToLocalCache(updated);

            toast.success(`Purchase Return ${r.return_no} deleted.`);
            await logActivity('Purchase Return Deleted', `Deleted return ${r.return_no} (${r.product_name})`);
        } catch (err: any) {
            toast.error(`Delete failed: ${err.message}`);
        }
    };

    // Bulk Delete
    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`Delete ${selectedIds.size} selected purchase returns?`)) return;

        const idsArray = Array.from(selectedIds);
        try {
            try {
                await supabase.from(activeDbTable).delete().in('return_id', idsArray);
            } catch {
                // local fallback
            }

            const updated = returns.filter((r) => !selectedIds.has(r.return_id));
            setReturns(updated);
            persistToLocalCache(updated);
            setSelectedIds(new Set());

            toast.success(`Deleted ${idsArray.length} return records.`);
        } catch (err: any) {
            toast.error(`Bulk delete failed: ${err.message}`);
        }
    };

    // =====================================================================
    // FILTERED & SORTED DATA
    // =====================================================================
    const filtered = useMemo(() => {
        return returns.filter((r) => {
            // Text search
            if (search.trim()) {
                const q = search.toLowerCase();
                const matchNo = (r.return_no || '').toLowerCase().includes(q);
                const matchSupp = (r.supplier_name || '').toLowerCase().includes(q);
                const matchProd = (r.product_name || '').toLowerCase().includes(q);
                const matchCode = (r.product_code || '').toLowerCase().includes(q);
                const matchBatch = (r.batch_number || '').toLowerCase().includes(q);
                const matchInv = (r.original_purchase_id || '').toLowerCase().includes(q);
                const matchReason = (r.reason || '').toLowerCase().includes(q);
                if (!matchNo && !matchSupp && !matchProd && !matchCode && !matchBatch && !matchInv && !matchReason) {
                    return false;
                }
            }

            // Supplier filter
            if (filterSupplier !== 'All') {
                if ((r.supplier_name || '').trim().toLowerCase() !== filterSupplier.trim().toLowerCase()) {
                    return false;
                }
            }

            // Status filter
            if (filterStatus !== 'All') {
                if ((r.status || '').toLowerCase() !== filterStatus.toLowerCase()) {
                    return false;
                }
            }

            // Reason filter
            if (filterReason !== 'All') {
                if (!(r.reason || '').toLowerCase().includes(filterReason.toLowerCase())) {
                    return false;
                }
            }

            // Date Range
            if (dateFrom && r.return_date < dateFrom) return false;
            if (dateTo && r.return_date > dateTo) return false;

            return true;
        }).sort((a, b) => {
            if (sortBy === 'newest') return (b.return_id || 0) - (a.return_id || 0);
            if (sortBy === 'oldest') return (a.return_id || 0) - (b.return_id || 0);
            if (sortBy === 'amount_high') return (Number(b.total) || 0) - (Number(a.total) || 0);
            if (sortBy === 'amount_low') return (Number(a.total) || 0) - (Number(b.total) || 0);
            if (sortBy === 'ret_asc') return (a.return_no || '').localeCompare(b.return_no || '');
            if (sortBy === 'supplier') return (a.supplier_name || '').localeCompare(b.supplier_name || '');
            return 0;
        });
    }, [returns, search, filterSupplier, filterStatus, filterReason, dateFrom, dateTo, sortBy]);

    // Pagination
    const totalPages = pageSize === -1 ? 1 : Math.max(1, Math.ceil(filtered.length / pageSize));
    const paginated = useMemo(() => {
        if (pageSize === -1) return filtered;
        const start = (currentPage - 1) * pageSize;
        return filtered.slice(start, start + pageSize);
    }, [filtered, currentPage, pageSize]);

    // KPI Metrics
    const kpis = useMemo(() => {
        const totalCount = returns.length;
        const totalValue = returns.reduce((sum, r) => sum + (Number(r.total) || 0), 0);
        const completed = returns.filter((r) => r.status === 'Completed');
        const completedValue = completed.reduce((sum, r) => sum + (Number(r.total) || 0), 0);
        const pending = returns.filter((r) => r.status !== 'Completed');
        const pendingCreditValue = pending.reduce((sum, r) => sum + (Number(r.total) || 0), 0);
        const avgValue = totalCount > 0 ? Math.round(totalValue / totalCount) : 0;

        // Top Return Reason
        const reasonCounts = new Map<string, number>();
        returns.forEach((r) => {
            const shortReason = (r.reason || 'Other').split('/')[0].trim();
            reasonCounts.set(shortReason, (reasonCounts.get(shortReason) || 0) + 1);
        });
        let topReason = 'None';
        let topCount = 0;
        reasonCounts.forEach((val, key) => {
            if (val > topCount) {
                topCount = val;
                topReason = key;
            }
        });

        return {
            totalCount,
            totalValue,
            completedCount: completed.length,
            completedValue,
            pendingCount: pending.length,
            pendingCreditValue,
            avgValue,
            topReason,
            topCount,
        };
    }, [returns]);

    // Bulk selection helpers
    const handleSelectAll = (checked: boolean) => {
        if (checked) setSelectedIds(new Set(paginated.map((r) => r.return_id)));
        else setSelectedIds(new Set());
    };

    const handleSelectOne = (id: number) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    // =====================================================================
    // BRIGHT COLORS EXCEL EXPORTER (SpreadsheetML XML)
    // Matches the exact high-voltage vivid styling of Batches & Purchases
    // =====================================================================
    const exportBrightExcel = () => {
        if (filtered.length === 0) {
            toast.error('No returns to export');
            return;
        }

        const genDate = new Date().toLocaleString('en-GB');
        const totalVal = filtered.reduce((acc, r) => acc + (Number(r.total) || 0), 0);
        const totalUnits = filtered.reduce((acc, r) => acc + (Number(r.quantity) || 0), 0);

        const xmlString = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#0f172a"/>
  </Style>
  <!-- BRIGHT TITLE BANNERS -->
  <Style ss:ID="TitleBanner">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="16" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#E11D48" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="MetaBanner">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#7C3AED" ss:Pattern="Solid"/>
  </Style>

  <!-- VIVID KPI CARDS -->
  <Style ss:ID="KpiHdrRed">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="9" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#FF1744" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="KpiValRed">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="13" ss:Bold="1" ss:Color="#B71C1C"/>
   <Interior ss:Color="#FFEBEE" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="KpiHdrGreen">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="9" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#00C853" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="KpiValGreen">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="13" ss:Bold="1" ss:Color="#1B5E20"/>
   <Interior ss:Color="#E8F8F5" ss:Pattern="Solid"/>
  </Style>

  <!-- TABLE HEADER -->
  <Style ss:ID="ColHeader">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#1E293B" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#E11D48"/>
   </Borders>
  </Style>

  <!-- CELL STYLES -->
  <Style ss:ID="CellText">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="CellTextBold">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1"/>
  </Style>
  <Style ss:ID="CellCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="CellNumber">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="#,##0"/>
  </Style>
  <Style ss:ID="CellCurrency">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="&quot;Ksh &quot;#,##0.00"/>
  </Style>

  <!-- TOTALS -->
  <Style ss:ID="SummaryLabel">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#1E293B" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="SummaryVal">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FF1744"/>
   <Interior ss:Color="#1E293B" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="&quot;Ksh &quot;#,##0.00"/>
  </Style>
 </Styles>

 <Worksheet ss:Name="Purchase Returns">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="80"/>  <!-- Return No -->
   <Column ss:Width="80"/>  <!-- Date -->
   <Column ss:Width="150"/> <!-- Supplier -->
   <Column ss:Width="90"/>  <!-- Original Inv -->
   <Column ss:Width="180"/> <!-- Product -->
   <Column ss:Width="90"/>  <!-- Batch -->
   <Column ss:Width="65"/>  <!-- Qty -->
   <Column ss:Width="85"/>  <!-- Unit Cost -->
   <Column ss:Width="105"/> <!-- Total Credit -->
   <Column ss:Width="160"/> <!-- Reason -->
   <Column ss:Width="85"/>  <!-- Status -->

   <!-- Title Banner -->
   <Row ss:Height="34">
    <Cell ss:MergeAcross="10" ss:StyleID="TitleBanner"><Data ss:Type="String">ALPHA PHARMACY - PURCHASE RETURNS &amp; DEBIT NOTES AUDIT</Data></Cell>
   </Row>

   <!-- Meta Banner -->
   <Row ss:Height="20">
    <Cell ss:MergeAcross="10" ss:StyleID="MetaBanner"><Data ss:Type="String">Generated: ${genDate} | Outlet: ${escapeXml(outletName)} | Database: ${escapeXml(activeDbTable)} | Total: ${filtered.length} Returns</Data></Cell>
   </Row>

   <!-- KPI Cards Row -->
   <Row ss:Height="18">
    <Cell ss:MergeAcross="3" ss:StyleID="KpiHdrRed"><Data ss:Type="String">TOTAL DEBIT NOTE VALUE</Data></Cell>
    <Cell ss:MergeAcross="3" ss:StyleID="KpiHdrGreen"><Data ss:Type="String">RECONCILED &amp; CREDITED</Data></Cell>
    <Cell ss:MergeAcross="3" ss:StyleID="KpiHdrRed"><Data ss:Type="String">PENDING SUPPLIER CREDIT</Data></Cell>
   </Row>
   <Row ss:Height="24">
    <Cell ss:MergeAcross="3" ss:StyleID="KpiValRed"><Data ss:Type="Number">${totalVal}</Data></Cell>
    <Cell ss:MergeAcross="3" ss:StyleID="KpiValGreen"><Data ss:Type="Number">${kpis.completedValue}</Data></Cell>
    <Cell ss:MergeAcross="3" ss:StyleID="KpiValRed"><Data ss:Type="Number">${kpis.pendingCreditValue}</Data></Cell>
   </Row>

   <Row ss:Height="10"/>

   <!-- Table Headers -->
   <Row ss:Height="24">
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">RETURN #</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">DATE</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">SUPPLIER</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">ORIGINAL INV #</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">PRODUCT / DRUG</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">BATCH #</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">RETURN QTY</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">UNIT COST</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">TOTAL CREDIT</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">RETURN REASON</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">STATUS</Data></Cell>
   </Row>

   <!-- Rows -->
   ${filtered
       .map((r) => {
           return `<Row ss:Height="20">
    <Cell ss:StyleID="CellTextBold"><Data ss:Type="String">${escapeXml(r.return_no)}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXml(r.return_date)}</Data></Cell>
    <Cell ss:StyleID="CellTextBold"><Data ss:Type="String">${escapeXml(r.supplier_name)}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXml(r.original_purchase_id || '—')}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${escapeXml(r.product_name)}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXml(r.batch_number || '—')}</Data></Cell>
    <Cell ss:StyleID="CellNumber"><Data ss:Type="Number">${r.quantity}</Data></Cell>
    <Cell ss:StyleID="CellCurrency"><Data ss:Type="Number">${r.unit_price}</Data></Cell>
    <Cell ss:StyleID="CellCurrency"><Data ss:Type="Number">${r.total}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${escapeXml(r.reason)}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXml(r.status)}</Data></Cell>
   </Row>`;
       })
       .join('\n')}

   <!-- Grand Summary Totals -->
   <Row ss:Height="24">
    <Cell ss:MergeAcross="5" ss:StyleID="SummaryLabel"><Data ss:Type="String">GRAND RETURNS VALUE:</Data></Cell>
    <Cell ss:StyleID="SummaryLabel"><Data ss:Type="Number">${totalUnits}</Data></Cell>
    <Cell ss:StyleID="SummaryLabel"><Data ss:Type="String">—</Data></Cell>
    <Cell ss:StyleID="SummaryVal"><Data ss:Type="Number">${totalVal}</Data></Cell>
    <Cell ss:MergeAcross="1" ss:StyleID="SummaryLabel"><Data ss:Type="String">—</Data></Cell>
   </Row>
  </Table>
 </Worksheet>
</Workbook>`;

        const blob = new Blob([xmlString], { type: 'application/vnd.ms-excel;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AlphaPharmacy_Purchase_Returns_${new Date().toISOString().split('T')[0]}_SuperPremium.xls`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`Exported ${filtered.length} returns to Super Bright Excel!`);
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-96" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
                <div className="w-14 h-14 border-4 border-rose-200 border-t-rose-600 rounded-full animate-spin" />
                <p className="mt-4 text-gray-900 font-bold text-base">Loading Purchase Returns &amp; Debit Notes...</p>
                <p className="text-xs text-gray-500 mt-1">Connecting to active distributor accounts, reversed lots &amp; credit adjustments</p>
            </div>
        );
    }

    return (
        <div className="w-full max-w-full space-y-4 px-1 md:px-2 pb-16" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-rose-600 to-pink-700 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg flex-shrink-0">
                        ↩️
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Purchase Returns &amp; Debit Notes</h1>
                            <span className="px-2.5 py-0.5 bg-rose-100 text-rose-900 rounded-full text-xs font-bold border border-rose-200">
                                Stock Reversal SRM
                            </span>
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-900 rounded-md text-[11px] font-bold border border-blue-200">
                                DB: {activeDbTable}
                            </span>
                        </div>
                        <p className="text-gray-600 text-xs mt-0.5">
                            Active Outlet: <span className="font-bold text-gray-900">{outletName}</span> • Manage supplier returns, damaged medicines, expired drug recalls &amp; vendor debit credits
                        </p>
                    </div>
                </div>

                <div className="flex items-center flex-wrap gap-2">
                    {/* New Return Button */}
                    <button
                        onClick={handleOpenAddModal}
                        className="px-4 py-2 bg-gradient-to-r from-rose-600 to-pink-700 hover:from-rose-700 hover:to-pink-800 text-white rounded-xl font-bold shadow-sm hover:shadow transition-all flex items-center gap-1.5 text-xs active:scale-95"
                    >
                        <span>➕</span> New Purchase Return
                    </button>

                    {/* Link to GRN */}
                    <Link
                        href="/dashboard/purchase"
                        className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 rounded-xl font-bold shadow-xs transition-all flex items-center gap-1.5 text-xs"
                    >
                        <span>📥</span> GRN Receiving
                    </Link>

                    {/* Link to Purchases Master */}
                    <Link
                        href="/dashboard/purchases"
                        className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 rounded-xl font-bold shadow-xs transition-all flex items-center gap-1.5 text-xs"
                    >
                        <span>📋</span> Purchases Ledger
                    </Link>

                    {/* Bright Excel Export */}
                    <button
                        onClick={exportBrightExcel}
                        className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 rounded-xl font-bold shadow-xs transition-all flex items-center gap-1.5 text-xs"
                    >
                        <span>📊</span> Super Excel
                    </button>

                    {/* Print */}
                    <button
                        onClick={() => window.print()}
                        className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 rounded-xl font-bold shadow-xs transition-all flex items-center gap-1 text-xs"
                    >
                        <span>🖨️</span> Print
                    </button>

                    {/* Refresh */}
                    <button
                        onClick={() => {
                            loadData();
                            toast.success('Live returns reloaded!');
                        }}
                        className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 rounded-xl font-bold shadow-xs transition-all flex items-center gap-1 text-xs"
                    >
                        <span>🔄</span> Refresh
                    </button>
                </div>
            </div>

            {/* 6 Light Gradient Stat KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5 w-full">
                {/* Total Returns Count */}
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-3.5 border border-purple-100 shadow-xs relative overflow-hidden">
                    <p className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">Total Returns</p>
                    <p className="text-xl font-black text-purple-950 mt-1">{kpis.totalCount} Reversals</p>
                    <p className="text-[10px] text-gray-600 mt-0.5">Debit Notes Issued</p>
                </div>

                {/* Total Value */}
                <div className="bg-gradient-to-br from-rose-50 to-red-50 rounded-2xl p-3.5 border border-rose-100 shadow-xs relative overflow-hidden">
                    <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">Total Debit Value</p>
                    <p className="text-lg font-black text-rose-950 mt-1">Ksh {kpis.totalValue.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-600 mt-0.5">Supplier Claims</p>
                </div>

                {/* Processed & Settled */}
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-3.5 border border-emerald-100 shadow-xs relative overflow-hidden">
                    <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Reconciled / Credited</p>
                    <p className="text-lg font-black text-emerald-950 mt-1">Ksh {kpis.completedValue.toLocaleString()}</p>
                    <p className="text-[10px] text-emerald-800 font-bold mt-0.5">{kpis.completedCount} Settled Notes</p>
                </div>

                {/* Pending Credit */}
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-3.5 border border-amber-100 shadow-xs relative overflow-hidden">
                    <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Pending Credit</p>
                    <p className="text-lg font-black text-amber-950 mt-1">Ksh {kpis.pendingCreditValue.toLocaleString()}</p>
                    <p className="text-[10px] text-red-700 font-bold mt-0.5">{kpis.pendingCount} Awaiting Refund</p>
                </div>

                {/* Average Return Value */}
                <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-2xl p-3.5 border border-cyan-100 shadow-xs relative overflow-hidden">
                    <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Average Incident</p>
                    <p className="text-lg font-black text-blue-950 mt-1">Ksh {kpis.avgValue.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-600 mt-0.5">Mean Return Claim</p>
                </div>

                {/* Top Return Reason */}
                <div className="bg-gradient-to-br from-slate-50 to-gray-100 rounded-2xl p-3.5 border border-gray-200 shadow-xs relative overflow-hidden">
                    <p className="text-[10px] font-bold text-gray-700 uppercase tracking-wider">Frequent Reason</p>
                    <p className="text-xs font-black text-gray-950 mt-1 truncate" title={kpis.topReason}>
                        {kpis.topReason}
                    </p>
                    <p className="text-[10px] text-gray-600 mt-0.5">{kpis.topCount} Incidents Logged</p>
                </div>
            </div>

            {/* Multi-Dimensional Filter Suite */}
            <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-xs space-y-3.5">
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5">
                    {/* Omni-Search */}
                    <div className="relative flex-1 min-w-[240px]">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setCurrentPage(1);
                            }}
                            placeholder="Search by Return # (PR-0001), supplier, medicine, batch #, inv #, reason..."
                            className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold focus:bg-white focus:border-rose-600 outline-none text-gray-900"
                        />
                        {search && (
                            <button
                                onClick={() => setSearch('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black text-xs font-bold"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Filter Supplier */}
                    <select
                        value={filterSupplier}
                        onChange={(e) => {
                            setFilterSupplier(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:border-rose-600 outline-none"
                    >
                        <option value="All">All Distributors</option>
                        {suppliers.map((s) => (
                            <option key={s.supplier_id} value={s.supplier_name}>{s.supplier_name}</option>
                        ))}
                    </select>

                    {/* Filter Status */}
                    <select
                        value={filterStatus}
                        onChange={(e) => {
                            setFilterStatus(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:border-rose-600 outline-none"
                    >
                        <option value="All">All Statuses</option>
                        <option value="Completed">Completed / Settled</option>
                        <option value="Pending Credit">Pending Supplier Credit</option>
                        <option value="In Transit">In Transit to Vendor</option>
                        <option value="Rejected">Rejected by Vendor</option>
                    </select>

                    {/* Filter Reason */}
                    <select
                        value={filterReason}
                        onChange={(e) => {
                            setFilterReason(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:border-rose-600 outline-none"
                    >
                        <option value="All">All Return Reasons</option>
                        <option value="Expiry">Near Expiry / Expired</option>
                        <option value="Damaged">Damaged Packaging</option>
                        <option value="Quality">Quality Defect / Recall</option>
                        <option value="Wrong">Wrong Item Delivered</option>
                    </select>

                    {/* Sort Options */}
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:border-rose-600 outline-none"
                    >
                        <option value="newest">Sort: Newest First</option>
                        <option value="oldest">Sort: Oldest First</option>
                        <option value="amount_high">Sort: Credit Amount (High→Low)</option>
                        <option value="amount_low">Sort: Credit Amount (Low→High)</option>
                        <option value="ret_asc">Sort: Return # (Ascending)</option>
                        <option value="supplier">Sort: Supplier Name (A-Z)</option>
                    </select>

                    {/* Dense Grid Toggle */}
                    <button
                        onClick={() => setIsAutoFit(!isAutoFit)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                            isAutoFit
                                ? 'bg-rose-50 border-rose-200 text-rose-900'
                                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                        title="Toggle dense datagrid layout"
                    >
                        <span>⛶</span> {isAutoFit ? 'Dense View' : 'Standard'}
                    </button>
                </div>

                {/* Bulk Actions Floating Row */}
                {selectedIds.size > 0 && (
                    <div className="bg-rose-50 border border-rose-200 rounded-2xl p-2.5 flex items-center justify-between text-xs font-bold text-rose-950 animate-fadeIn">
                        <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px]">
                                {selectedIds.size}
                            </span>
                            <span>purchase returns selected</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleBulkDelete}
                                className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                            >
                                Delete Selected
                            </button>
                            <button
                                onClick={() => setSelectedIds(new Set())}
                                className="px-3 py-1 bg-white border border-gray-300 text-gray-800 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                                Deselect All
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Main Interactive Returns DataGrid with Working Quick Actions */}
            <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-gray-50/80 border-b border-gray-200 text-[10px] font-black uppercase text-gray-900 tracking-wider">
                                <th className="p-3 w-8">
                                    <input
                                        type="checkbox"
                                        checked={paginated.length > 0 && selectedIds.size === paginated.length}
                                        onChange={(e) => handleSelectAll(e.target.checked)}
                                        className="rounded border-gray-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                                    />
                                </th>
                                <th className="p-3">Return #</th>
                                <th className="p-3">Date</th>
                                <th className="p-3">Distributor / Supplier</th>
                                <th className="p-3">Original Inv #</th>
                                <th className="p-3">Returned Drug / Product</th>
                                <th className="p-3">Batch Lot #</th>
                                <th className="p-3 text-center">Returned Qty</th>
                                <th className="p-3 text-right">Unit Cost</th>
                                <th className="p-3 text-right">Debit Total</th>
                                <th className="p-3">Return Reason</th>
                                <th className="p-3 text-center">Status</th>
                                <th className="p-3 text-center w-40">Quick Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-gray-900 font-medium">
                            {paginated.length === 0 ? (
                                <tr>
                                    <td colSpan={13} className="p-12 text-center text-gray-500">
                                        <div className="text-4xl mb-2">↩️</div>
                                        <p className="font-bold text-gray-800 text-sm">No purchase returns on record</p>
                                        <p className="text-xs text-gray-500 mt-1">Click "➕ New Purchase Return" above to log returned or recalled inventory</p>
                                    </td>
                                </tr>
                            ) : (
                                paginated.map((r) => {
                                    const isSelected = selectedIds.has(r.return_id);
                                    const isCompleted = r.status === 'Completed';
                                    const isPending = r.status === 'Pending Credit';

                                    return (
                                        <tr
                                            key={r.return_id}
                                            className={`hover:bg-rose-50/30 transition-colors ${
                                                isSelected ? 'bg-rose-50/60' : ''
                                            }`}
                                        >
                                            <td className="p-3">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => handleSelectOne(r.return_id)}
                                                    className="rounded border-gray-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                                                />
                                            </td>
                                            <td className="p-3 whitespace-nowrap">
                                                <button
                                                    onClick={() => handleViewDossier(r)}
                                                    className="px-2.5 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-900 font-mono font-bold rounded-md border border-rose-200 inline-flex items-center gap-1 transition-colors"
                                                    title="Click to view full debit note dossier"
                                                >
                                                    {r.return_no}
                                                </button>
                                            </td>
                                            <td className="p-3 whitespace-nowrap text-gray-700 font-semibold">
                                                {r.return_date}
                                            </td>
                                            <td className="p-3 whitespace-nowrap font-bold text-gray-900">
                                                {r.supplier_name}
                                            </td>
                                            <td className="p-3 whitespace-nowrap font-mono text-blue-700 font-bold">
                                                {r.original_purchase_id || '—'}
                                            </td>
                                            <td className="p-3">
                                                <p className="font-bold text-gray-900 max-w-[190px] truncate" title={r.product_name}>
                                                    {r.product_name}
                                                </p>
                                                {r.product_code && (
                                                    <span className="text-[10px] font-mono text-gray-500">{r.product_code}</span>
                                                )}
                                            </td>
                                            <td className="p-3 whitespace-nowrap">
                                                {r.batch_number ? (
                                                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-900 rounded font-mono font-bold text-[10px] border border-indigo-200">
                                                        {r.batch_number}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400 text-[10px]">None</span>
                                                )}
                                            </td>
                                            <td className="p-3 text-center font-mono font-bold text-gray-900 whitespace-nowrap">
                                                {r.quantity} {r.unit || 'Box'}
                                            </td>
                                            <td className="p-3 text-right font-mono whitespace-nowrap text-gray-800">
                                                Ksh {(r.unit_price || 0).toLocaleString()}
                                            </td>
                                            <td className="p-3 text-right font-mono font-black text-rose-950 whitespace-nowrap">
                                                Ksh {(r.total || (r.quantity * r.unit_price)).toLocaleString()}
                                            </td>
                                            <td className="p-3 max-w-[160px] truncate text-gray-700" title={r.reason}>
                                                <span className="px-2 py-0.5 bg-gray-100 text-gray-800 rounded text-[10px] font-semibold">
                                                    {r.reason}
                                                </span>
                                            </td>
                                            <td className="p-3 text-center whitespace-nowrap">
                                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                                    isCompleted
                                                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                                        : isPending
                                                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                                                        : 'bg-gray-100 text-gray-700 border-gray-300'
                                                }`}>
                                                    {r.status}
                                                </span>
                                            </td>
                                            {/* WORKING QUICK ACTION BUTTONS */}
                                            <td className="p-3 text-center whitespace-nowrap">
                                                <div className="flex items-center justify-center gap-1">
                                                    {/* Quick Action 1: View Dossier & Debit Note */}
                                                    <button
                                                        onClick={() => handleViewDossier(r)}
                                                        className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                                        title="View Debit Note Dossier"
                                                    >
                                                        👁️
                                                    </button>

                                                    {/* Quick Action 2: Print Debit Note */}
                                                    <button
                                                        onClick={() => {
                                                            setActiveReturn(r);
                                                            setShowDossierModal(true);
                                                            setTimeout(() => window.print(), 300);
                                                        }}
                                                        className="p-1.5 text-purple-600 hover:bg-purple-100 rounded-lg transition-colors"
                                                        title="Print Debit Slip"
                                                    >
                                                        🖨️
                                                    </button>

                                                    {/* Quick Action 3: Reconcile / Apply to Vendor Balance */}
                                                    <button
                                                        onClick={() => handleOpenReconcile(r)}
                                                        className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors"
                                                        title="Reconcile Credit against Vendor Balance"
                                                    >
                                                        💳
                                                    </button>

                                                    {/* Quick Action 4: Edit Return */}
                                                    <button
                                                        onClick={() => handleOpenEditModal(r)}
                                                        className="p-1.5 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors"
                                                        title="Edit Return Details"
                                                    >
                                                        ✏️
                                                    </button>

                                                    {/* Quick Action 5: Delete / Void */}
                                                    <button
                                                        onClick={() => handleDeleteReturn(r)}
                                                        className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                                                        title="Delete Return Record"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Stepper */}
                <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-700 font-semibold">
                    <div className="flex items-center gap-2">
                        <span>Showing {paginated.length} of {filtered.length} purchase returns</span>
                        <span>•</span>
                        <select
                            value={pageSize}
                            onChange={(e) => {
                                setPageSize(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="px-2 py-1 bg-white border border-gray-300 rounded-md font-bold text-gray-900"
                        >
                            <option value={25}>25 per page</option>
                            <option value={50}>50 per page</option>
                            <option value={100}>100 per page</option>
                            <option value={-1}>Show All</option>
                        </select>
                    </div>

                    {pageSize !== -1 && totalPages > 1 && (
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1 bg-white border border-gray-300 rounded-md font-bold text-gray-900 disabled:opacity-40 hover:bg-gray-100"
                            >
                                Prev
                            </button>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                const pageNum = i + 1;
                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setCurrentPage(pageNum)}
                                        className={`w-7 h-7 rounded-md font-bold text-xs ${
                                            currentPage === pageNum
                                                ? 'bg-rose-600 text-white'
                                                : 'bg-white border border-gray-300 text-gray-900 hover:bg-gray-100'
                                        }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                            <button
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1 bg-white border border-gray-300 rounded-md font-bold text-gray-900 disabled:opacity-40 hover:bg-gray-100"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* =====================================================================
                MODAL 1: SUPER ULTRA ADD / EDIT PURCHASE RETURN (MULTI-SECTION)
            ===================================================================== */}
            {showAddEditModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 animate-fadeIn">
                    <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
                        <div className="p-5 bg-gradient-to-r from-rose-600 to-pink-700 text-white flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl font-bold">
                                    ↩️
                                </div>
                                <div>
                                    <h2 className="text-lg font-black tracking-tight">
                                        {editingReturn ? `Edit Purchase Return ${editingReturn.return_no}` : 'Issue Purchase Return & Debit Note'}
                                    </h2>
                                    <p className="text-xs text-rose-100">
                                        Return Reference: <span className="font-mono font-bold text-white">{formReturnNo}</span> • Outlet: {outletName}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setShowAddEditModal(false)} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold">✕</button>
                        </div>

                        <form onSubmit={handleSaveReturn} className="p-6 overflow-y-auto space-y-4 text-xs font-bold text-gray-900 flex-1">
                            {/* Distributor & Original Purchase Header */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-200">
                                <div>
                                    <label className="block mb-1">Original Purchase Order / Invoice #</label>
                                    <select
                                        value={formOriginalPurchaseId}
                                        onChange={(e) => handleSelectOriginalPurchase(e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl font-mono text-xs font-bold text-blue-900"
                                    >
                                        <option value="">-- Manual / Direct Return --</option>
                                        {purchases.map((p) => (
                                            <option key={p.purchase_id} value={p.purchase_no}>
                                                {p.purchase_no} - {p.supplier_name} ({p.purchase_date}) • Ksh {Number(p.grand_total).toLocaleString()}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-gray-500 mt-1">Linking an original invoice automatically pulls vendor details</p>
                                </div>

                                <div>
                                    <label className="block mb-1">Distributor / Supplier *</label>
                                    <select
                                        value={formSupplierName}
                                        onChange={(e) => {
                                            setFormSupplierName(e.target.value);
                                            const match = suppliers.find((s) => s.supplier_name === e.target.value);
                                            if (match) setFormSupplierId(match.supplier_id);
                                        }}
                                        required
                                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-900"
                                    >
                                        <option value="">-- Select Vendor --</option>
                                        {suppliers.map((s) => (
                                            <option key={s.supplier_id} value={s.supplier_name}>
                                                {s.supplier_name} {Number(s.current_balance) > 0 ? `(Debt: Ksh ${Number(s.current_balance).toLocaleString()})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Drug & Batch Reversal Specification */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-black uppercase text-gray-900">Returned Drug &amp; Pharmaceutical Lot</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="sm:col-span-2">
                                        <label className="block mb-1">Pick Drug from Catalog or Type Name *</label>
                                        <select
                                            value={formProductId}
                                            onChange={(e) => handleSelectProduct(Number(e.target.value))}
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 mb-1.5"
                                        >
                                            <option value={0}>-- Select from Medicine Catalog --</option>
                                            {products.map((p) => (
                                                <option key={p.pid} value={p.pid}>
                                                    {p.product_name} ({p.product_code}) - Cost: Ksh {p.purchase_cost}
                                                </option>
                                            ))}
                                        </select>
                                        <input
                                            type="text"
                                            required
                                            value={formProductName}
                                            onChange={(e) => setFormProductName(e.target.value)}
                                            placeholder="Or enter drug name manually"
                                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-900"
                                        />
                                    </div>

                                    <div>
                                        <label className="block mb-1">Batch / Lot # (Mandatory)</label>
                                        <input
                                            type="text"
                                            value={formBatchNo}
                                            onChange={(e) => setFormBatchNo(e.target.value.toUpperCase())}
                                            placeholder="e.g. LOT-4921"
                                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl font-mono text-xs font-bold uppercase"
                                        />
                                        <label className="block mt-2 mb-1">Expiry Date</label>
                                        <input
                                            type="date"
                                            value={formExpiryDate}
                                            onChange={(e) => setFormExpiryDate(e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Quantity & Credit Valuation */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-rose-50 rounded-2xl border border-rose-200">
                                <div>
                                    <label className="block mb-1 text-rose-950">Return Qty *</label>
                                    <input
                                        type="number"
                                        min="1"
                                        step="any"
                                        required
                                        value={formQuantity}
                                        onChange={(e) => setFormQuantity(parseFloat(e.target.value) || 0)}
                                        className="w-full px-3 py-2 bg-white border border-rose-300 rounded-xl font-mono text-sm font-black text-rose-950"
                                    />
                                </div>
                                <div>
                                    <label className="block mb-1 text-rose-950">Packaging Unit</label>
                                    <input
                                        type="text"
                                        value={formUnit}
                                        onChange={(e) => setFormUnit(e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-rose-300 rounded-xl text-xs font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="block mb-1 text-rose-950">Unit Purchase Cost (Ksh)</label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={formUnitPrice}
                                        onChange={(e) => setFormUnitPrice(parseFloat(e.target.value) || 0)}
                                        className="w-full px-3 py-2 bg-white border border-rose-300 rounded-xl font-mono text-sm font-black text-blue-900"
                                    />
                                </div>
                                <div className="flex flex-col justify-center text-right">
                                    <span className="text-[10px] text-rose-800 uppercase font-black">Total Debit Claim</span>
                                    <span className="text-base font-black text-rose-950 font-mono">
                                        Ksh {(Number(formQuantity) * Number(formUnitPrice)).toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            {/* Reason & Settlement Options */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block mb-1">Return Reason Category *</label>
                                    <select
                                        value={formReason}
                                        onChange={(e) => setFormReason(e.target.value)}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900"
                                    >
                                        {RETURN_REASONS.map((rsn) => (
                                            <option key={rsn} value={rsn}>{rsn}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block mb-1">Settlement Mode</label>
                                    <select
                                        value={formSettlement}
                                        onChange={(e) => setFormSettlement(e.target.value as any)}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900"
                                    >
                                        <option value="Deduct from Balance">Deduct from Supplier Balance (Credit Note)</option>
                                        <option value="Cash Refund">Direct Cash / EFT Bank Refund</option>
                                        <option value="Stock Replacement">Awaiting Free Stock Replacement</option>
                                    </select>
                                </div>
                            </div>

                            {/* Reverse Inventory Toggle */}
                            <div className="p-3 bg-gray-100 rounded-xl flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold text-gray-900">Reverse Inventory Automatically</p>
                                    <p className="text-[11px] text-gray-600 font-medium">Deducts quantity from stock and batch lot so it cannot be sold at POS</p>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={formReverseStock}
                                    onChange={(e) => setFormReverseStock(e.target.checked)}
                                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                                />
                            </div>

                            {/* Remarks */}
                            <div>
                                <label className="block mb-1">Inspection Observations &amp; Quarantine Details</label>
                                <textarea
                                    rows={2}
                                    value={formNotes}
                                    onChange={(e) => setFormNotes(e.target.value)}
                                    placeholder="e.g. Expired lot quarantined in returns shelf. Delivery driver accepted return slip."
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs text-gray-900"
                                />
                            </div>

                            {/* Footer Buttons */}
                            <div className="pt-4 border-t border-gray-200 flex items-center justify-between">
                                <button
                                    type="button"
                                    onClick={() => setShowAddEditModal(false)}
                                    className="px-4 py-2 bg-gray-100 text-gray-800 rounded-xl font-bold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="px-6 py-2.5 bg-gradient-to-r from-rose-600 to-pink-700 hover:from-rose-700 hover:to-pink-800 text-white rounded-xl font-bold shadow-md hover:shadow-lg disabled:opacity-50"
                                >
                                    {isSaving ? 'Processing Return...' : editingReturn ? 'Update Return' : 'Commit Purchase Return'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* =====================================================================
                MODAL 2: OFFICIAL DEBIT NOTE & RETURN SLIP (PRINTABLE)
            ===================================================================== */}
            {showDossierModal && activeReturn && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
                    <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden">
                        <div className="p-4 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
                            <h3 className="font-black text-sm">Official Vendor Debit Note / Return Slip</h3>
                            <button onClick={() => setShowDossierModal(false)} className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center font-bold">✕</button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-4 text-xs font-medium text-gray-900" id="printableDebitNote">
                            <div className="border-b border-gray-200 pb-3 flex items-start justify-between">
                                <div>
                                    <h2 className="text-lg font-black text-gray-900">ALPHA PHARMACY</h2>
                                    <p className="text-[11px] text-gray-600">{outletName} • Pharmacy Procurement</p>
                                    <p className="text-[11px] font-bold text-rose-700">VENDOR DEBIT NOTE</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-mono font-black text-base text-rose-700">{activeReturn.return_no}</p>
                                    <p className="text-[11px] text-gray-600">Date: {activeReturn.return_date}</p>
                                    <p className="text-[11px] text-gray-600">Original Inv: {activeReturn.original_purchase_id || 'N/A'}</p>
                                </div>
                            </div>

                            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                                <p className="text-[10px] text-gray-500 font-bold uppercase">Issued To Distributor</p>
                                <p className="font-black text-gray-900 text-sm">{activeReturn.supplier_name}</p>
                                <p className="text-[11px] text-gray-600 mt-0.5">Settlement Mode: {activeReturn.settlement_type || 'Deduct from Balance'}</p>
                            </div>

                            <table className="w-full border-collapse border border-gray-200 text-xs">
                                <thead className="bg-gray-100 font-black text-[10px] uppercase">
                                    <tr>
                                        <th className="border p-2 text-left">Product / Medicine</th>
                                        <th className="border p-2 text-left">Batch #</th>
                                        <th className="border p-2 text-right">Returned Qty</th>
                                        <th className="border p-2 text-right">Unit Rate</th>
                                        <th className="border p-2 text-right">Debit Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="border p-2 font-bold">{activeReturn.product_name}</td>
                                        <td className="border p-2 font-mono">{activeReturn.batch_number || 'N/A'}</td>
                                        <td className="border p-2 text-right font-mono font-bold">{activeReturn.quantity} {activeReturn.unit || 'Box'}</td>
                                        <td className="border p-2 text-right font-mono">Ksh {(activeReturn.unit_price || 0).toLocaleString()}</td>
                                        <td className="border p-2 text-right font-mono font-black text-rose-950">Ksh {(activeReturn.total || 0).toLocaleString()}</td>
                                    </tr>
                                </tbody>
                            </table>

                            <div className="bg-rose-50 p-3 rounded-xl border border-rose-200">
                                <p className="text-[10px] text-rose-900 font-bold uppercase">Reason for Rejection / Return</p>
                                <p className="font-bold text-rose-950 mt-0.5">{activeReturn.reason}</p>
                                {activeReturn.notes && (
                                    <p className="text-[11px] text-gray-700 mt-1 whitespace-pre-wrap">{activeReturn.notes}</p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-8 pt-8 text-[11px] text-gray-600">
                                <div>
                                    <div className="border-t border-gray-400 pt-1 font-bold">Authorized Pharmacist Sign &amp; Stamp</div>
                                    <p>{activeReturn.created_by || 'Staff Pharmacist'}</p>
                                </div>
                                <div className="text-right">
                                    <div className="border-t border-gray-400 pt-1 font-bold">Vendor Driver / Rep Acknowledgement</div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                            <button onClick={() => window.print()} className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 flex items-center gap-1.5">
                                🖨️ Print Debit Note
                            </button>
                            <button onClick={() => setShowDossierModal(false)} className="px-6 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-black">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* =====================================================================
                MODAL 3: QUICK RECONCILE / APPLY SUPPLIER CREDIT
            ===================================================================== */}
            {showReconcileModal && reconcileReturn && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
                    <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden">
                        <div className="p-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
                            <div>
                                <h3 className="font-black text-base">Reconcile Vendor Credit</h3>
                                <p className="text-xs text-emerald-100">
                                    Return {reconcileReturn.return_no} • {reconcileReturn.supplier_name}
                                </p>
                            </div>
                            <button onClick={() => setShowReconcileModal(false)} className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center font-bold">✕</button>
                        </div>
                        <div className="p-6 space-y-4 text-xs font-bold text-gray-900">
                            <div className="bg-gray-50 p-3 rounded-2xl border border-gray-200 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-600">Credit Claim Value:</span>
                                    <span className="text-base font-black text-rose-950 font-mono">
                                        Ksh {(reconcileReturn.total || 0).toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-600">Distributor:</span>
                                    <span className="text-gray-900 font-bold">{reconcileReturn.supplier_name}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-600">Return Reason:</span>
                                    <span className="text-gray-700">{reconcileReturn.reason}</span>
                                </div>
                            </div>

                            <p className="text-gray-600 font-medium">
                                Confirming will automatically deduct <span className="font-bold text-gray-900">Ksh {(reconcileReturn.total || 0).toLocaleString()}</span> from your outstanding account balance with <span className="font-bold text-gray-900">{reconcileReturn.supplier_name}</span> in your suppliers ledger, and mark this return as <span className="font-bold text-emerald-700">Completed</span>.
                            </p>

                            <div className="pt-3 border-t border-gray-200 flex items-center justify-between">
                                <button
                                    type="button"
                                    onClick={() => setShowReconcileModal(false)}
                                    className="px-4 py-2 bg-gray-100 text-gray-800 rounded-xl font-bold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    disabled={isReconciling}
                                    onClick={handleConfirmReconcile}
                                    className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl font-bold shadow-md disabled:opacity-50"
                                >
                                    {isReconciling ? 'Deducting Balance...' : 'Confirm & Apply Credit'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
