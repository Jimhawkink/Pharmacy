'use client';
// =====================================================================
// Alpha Pharmacy - Super Premium Batch & Procurement Management v2.0
// Ultra-Detailed Inventory Valuation, FEFO Tracking, Stock Reconcile,
// Ultra Modal with Live Margin/Markup Engine & Bright Colors Excel Export
// =====================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';
import { calculateStockBreakdown } from '@/lib/stockBreakdown';

export interface BatchItem {
    batch_id: number;
    batch_number: string;
    product_id: number;
    product_name: string;
    generic_name: string;
    category: string;
    dosage?: string;
    drug_type?: string;
    sales_unit?: string;
    purchase_unit?: string;
    pieces_per_package?: number;
    barcode?: string;
    manufacturer?: string;
    manufacture_date: string;
    expiry_date: string;
    quantity: number;
    remaining_qty: number;
    purchase_cost: number;
    selling_price: number;
    supplier_id?: number;
    supplier_name: string;
    purchase_invoice?: string;
    status: string;
    notes?: string;
    outlet_id: number;
    created_at: string;
}

export interface ProductItem {
    pid: number;
    product_code: string;
    product_name: string;
    generic_name?: string;
    category?: string;
    dosage?: string;
    drug_type?: string;
    sales_unit?: string;
    purchase_unit?: string;
    pieces_per_package?: number;
    purchase_cost: number;
    sales_cost: number;
    barcode?: string;
    supplier_name?: string;
    manufacturer?: string;
}

export interface SupplierItem {
    supplier_id: number;
    supplier_name: string;
    supplier_code?: string;
    phone?: string;
}

const getDaysUntil = (dateStr: string) => {
    if (!dateStr) return 0;
    const target = new Date(dateStr).getTime();
    const now = new Date().setHours(0, 0, 0, 0);
    return Math.ceil((target - now) / 86400000);
};

const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
        return dateStr;
    }
};

const escapeXml = (unsafe: any): string => {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
};

export default function BatchesPage() {
    const { activeOutlet } = useOutlet();
    const outletId = activeOutlet?.outlet_id || 1;
    const outletName = activeOutlet?.outlet_name || 'Alpha Pharmacy Main';

    // Core Data
    const [batches, setBatches] = useState<BatchItem[]>([]);
    const [products, setProducts] = useState<ProductItem[]>([]);
    const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAutoFit, setIsAutoFit] = useState(true);

    // Filters
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('All');
    const [filterCategory, setFilterCategory] = useState('All');
    const [filterExpiry, setFilterExpiry] = useState('All');
    const [filterSupplier, setFilterSupplier] = useState('All');
    const [sortBy, setSortBy] = useState<
        'newest' | 'fefo' | 'furthest_expiry' | 'stock_high' | 'stock_low' | 'value_high' | 'margin_high' | 'name'
    >('newest');

    // Pagination
    const [pageSize, setPageSize] = useState<number>(50);
    const [currentPage, setCurrentPage] = useState<number>(1);

    // Ultra New Batch Modal
    const [showNewModal, setShowNewModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [productSearch, setProductSearch] = useState('');
    const [isProductDropOpen, setIsProductDropOpen] = useState(false);
    const [newBatch, setNewBatch] = useState({
        product_id: 0,
        batch_number: '',
        manufacture_date: new Date().toISOString().split('T')[0],
        expiry_date: '',
        quantity: 100,
        purchase_cost: 0,
        selling_price: 0,
        supplier_id: 0,
        supplier_name: '',
        purchase_invoice: '',
        notes: '',
    });

    // Edit Batch Modal
    const [editBatch, setEditBatch] = useState<BatchItem | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);

    // Reconcile / Stock Adjust Modal
    const [adjustBatch, setAdjustBatch] = useState<BatchItem | null>(null);
    const [adjustNewQty, setAdjustNewQty] = useState<string>('');
    const [adjustReason, setAdjustReason] = useState<string>('Physical Count Audit');
    const [showAdjustModal, setShowAdjustModal] = useState(false);

    // Batch Audit Profile Drawer
    const [detailBatch, setDetailBatch] = useState<BatchItem | null>(null);

    // Auto-generate Batch Number
    const generateBatchNo = () => {
        const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '').slice(2);
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let rand = '';
        for (let i = 0; i < 4; i++) {
            rand += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return `BAT-${dateStr}-${rand}`;
    };

    // Load Live Pharmacy Batches, Products & Suppliers
    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            // 1. Fetch Batches with Product Details via Supabase Relation
            const { data: batchData, error: batchError } = await supabase
                .from('pharmacy_batches')
                .select(`
                    *,
                    pharmacy_products!inner(
                        product_name,
                        generic_name,
                        category,
                        dosage,
                        drug_type,
                        sales_unit,
                        barcode,
                        manufacturer,
                        purchase_cost,
                        sales_cost
                    )
                `)
                .eq('outlet_id', outletId)
                .order('batch_id', { ascending: false });

            if (batchError) {
                console.error('Error fetching pharmacy_batches:', batchError);
                toast.error(`Error loading batches: ${batchError.message}`);
            }

            const mappedBatches: BatchItem[] = (batchData || []).map((b: any) => {
                const p = b.pharmacy_products || {};
                return {
                    batch_id: b.batch_id,
                    batch_number: b.batch_number || 'N/A',
                    product_id: b.product_id,
                    product_name: p.product_name || 'Unknown Product',
                    generic_name: p.generic_name || '',
                    category: p.category || 'General',
                    dosage: p.dosage || '',
                    drug_type: p.drug_type || 'Medicine',
                    sales_unit: p.sales_unit || 'Unit',
                    purchase_unit: p.purchase_unit || 'Box',
                    pieces_per_package: Number(p.pieces_per_package) || 1,
                    barcode: p.barcode || '',
                    manufacturer: p.manufacturer || '',
                    manufacture_date: b.manufacture_date || '',
                    expiry_date: b.expiry_date || '',
                    quantity: Number(b.quantity || b.remaining_qty || 0),
                    remaining_qty: Number(b.remaining_qty || 0),
                    purchase_cost: Number(b.purchase_cost ?? p.purchase_cost ?? 0),
                    selling_price: Number(b.selling_price ?? p.sales_cost ?? 0),
                    supplier_id: b.supplier_id,
                    supplier_name: b.supplier_name || 'Direct Procurement',
                    purchase_invoice: b.purchase_invoice || '',
                    status: b.status || 'Active',
                    notes: b.notes || '',
                    outlet_id: b.outlet_id || outletId,
                    created_at: b.created_at || '',
                };
            });
            setBatches(mappedBatches);

            // 2. Fetch Active Products for New Batch Selector
            const { data: prodData, error: prodError } = await supabase
                .from('pharmacy_products')
                .select('pid, product_code, product_name, generic_name, category, dosage, drug_type, sales_unit, purchase_cost, sales_cost, barcode, supplier_name, manufacturer')
                .eq('active', true)
                .order('product_name', { ascending: true });

            if (prodError) {
                console.error('Error fetching pharmacy_products:', prodError);
            }
            setProducts(
                (prodData || []).map((p: any) => ({
                    pid: p.pid,
                    product_code: p.product_code || `P-${p.pid}`,
                    product_name: p.product_name,
                    generic_name: p.generic_name || '',
                    category: p.category || 'General',
                    dosage: p.dosage || '',
                    drug_type: p.drug_type || 'Medicine',
                    sales_unit: p.sales_unit || 'Piece',
                    purchase_cost: Number(p.purchase_cost || 0),
                    sales_cost: Number(p.sales_cost || 0),
                    barcode: p.barcode || '',
                    supplier_name: p.supplier_name || '',
                    manufacturer: p.manufacturer || '',
                }))
            );

            // 3. Fetch Registered Suppliers
            const { data: supData } = await supabase
                .from('pharmacy_suppliers')
                .select('supplier_id, supplier_name, supplier_code, phone')
                .eq('active', true)
                .order('supplier_name', { ascending: true });
            setSuppliers(supData || []);
        } catch (err: any) {
            toast.error(`Database connection issue: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    }, [outletId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Categories list for filtering
    const categories = useMemo(() => {
        return Array.from(new Set(batches.map((b) => b.category).filter(Boolean))).sort();
    }, [batches]);

    // Suppliers list for filtering
    const supplierList = useMemo(() => {
        return Array.from(new Set(batches.map((b) => b.supplier_name).filter(Boolean))).sort();
    }, [batches]);

    // Selected product in New Batch Modal
    const selectedProduct = useMemo(() => {
        return products.find((p) => p.pid === newBatch.product_id) || null;
    }, [products, newBatch.product_id]);

    // Filtered Products in Modal Dropdown
    const modalFilteredProducts = useMemo(() => {
        if (!productSearch.trim()) return products.slice(0, 50);
        const q = productSearch.toLowerCase();
        return products.filter(
            (p) =>
                p.product_name.toLowerCase().includes(q) ||
                p.product_code.toLowerCase().includes(q) ||
                (p.generic_name || '').toLowerCase().includes(q) ||
                (p.barcode || '').toLowerCase().includes(q)
        ).slice(0, 50);
    }, [products, productSearch]);

    // Live Margin & Markup Calculations for New Batch
    const batchFinancials = useMemo(() => {
        const cost = Number(newBatch.purchase_cost || 0);
        const sell = Number(newBatch.selling_price || 0);
        const qty = Number(newBatch.quantity || 0);
        const profitPerPiece = sell - cost;
        const marginPct = sell > 0 ? (profitPerPiece / sell) * 100 : 0;
        const markupPct = cost > 0 ? (profitPerPiece / cost) * 100 : 0;
        const totalBatchCost = cost * qty;
        const totalBatchRetail = sell * qty;
        const projectedProfit = profitPerPiece * qty;

        return {
            profitPerPiece,
            marginPct,
            markupPct,
            totalBatchCost,
            totalBatchRetail,
            projectedProfit,
        };
    }, [newBatch.purchase_cost, newBatch.selling_price, newBatch.quantity]);

    // Multi-Dimensional Filtering & Sorting
    const filtered = useMemo(() => {
        return batches
            .filter((b) => {
                const days = getDaysUntil(b.expiry_date);

                // Status
                if (filterStatus === 'Active' && (b.status !== 'Active' || b.remaining_qty <= 0)) return false;
                if (filterStatus === 'LowStock' && (b.remaining_qty <= 0 || b.remaining_qty > 10)) return false;
                if (filterStatus === 'Out' && b.remaining_qty > 0) return false;
                if (filterStatus === 'Quarantine' && b.status !== 'Quarantine') return false;
                if (filterStatus === 'Disposed' && b.status !== 'Disposed') return false;

                // Category
                if (filterCategory !== 'All' && b.category !== filterCategory) return false;

                // Supplier
                if (filterSupplier !== 'All' && b.supplier_name !== filterSupplier) return false;

                // Expiry
                if (filterExpiry === 'Expired' && days >= 0) return false;
                if (filterExpiry === 'Critical' && (days < 0 || days > 30)) return false;
                if (filterExpiry === 'Warning' && (days <= 30 || days > 90)) return false;
                if (filterExpiry === 'Safe' && days <= 90) return false;

                // Omni-Search
                if (search.trim()) {
                    const q = search.toLowerCase();
                    const match =
                        b.batch_number.toLowerCase().includes(q) ||
                        b.product_name.toLowerCase().includes(q) ||
                        (b.generic_name || '').toLowerCase().includes(q) ||
                        (b.supplier_name || '').toLowerCase().includes(q) ||
                        (b.barcode || '').toLowerCase().includes(q) ||
                        (b.purchase_invoice || '').toLowerCase().includes(q);
                    if (!match) return false;
                }

                return true;
            })
            .sort((a, b) => {
                const daysA = getDaysUntil(a.expiry_date);
                const daysB = getDaysUntil(b.expiry_date);
                const valA = a.remaining_qty * a.selling_price;
                const valB = b.remaining_qty * b.selling_price;
                const marginA = a.selling_price > 0 ? (a.selling_price - a.purchase_cost) / a.selling_price : 0;
                const marginB = b.selling_price > 0 ? (b.selling_price - b.purchase_cost) / b.selling_price : 0;

                if (sortBy === 'newest') return b.batch_id - a.batch_id;
                if (sortBy === 'fefo') return daysA - daysB;
                if (sortBy === 'furthest_expiry') return daysB - daysA;
                if (sortBy === 'stock_high') return b.remaining_qty - a.remaining_qty;
                if (sortBy === 'stock_low') return a.remaining_qty - b.remaining_qty;
                if (sortBy === 'value_high') return valB - valA;
                if (sortBy === 'margin_high') return marginB - marginA;
                if (sortBy === 'name') return a.product_name.localeCompare(b.product_name);
                return 0;
            });
    }, [batches, search, filterStatus, filterCategory, filterSupplier, filterExpiry, sortBy]);

    // Active Filter Count
    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (search.trim()) count++;
        if (filterStatus !== 'All') count++;
        if (filterCategory !== 'All') count++;
        if (filterSupplier !== 'All') count++;
        if (filterExpiry !== 'All') count++;
        if (sortBy !== 'newest') count++;
        return count;
    }, [search, filterStatus, filterCategory, filterSupplier, filterExpiry, sortBy]);

    const resetFilters = () => {
        setSearch('');
        setFilterStatus('All');
        setFilterCategory('All');
        setFilterSupplier('All');
        setFilterExpiry('All');
        setSortBy('newest');
        setCurrentPage(1);
    };

    // Summary KPI Aggregations
    const kpis = useMemo(() => {
        const totalBatches = batches.length;
        const totalReceived = batches.reduce((sum, b) => sum + (b.quantity || 0), 0);
        const totalRemaining = batches.reduce((sum, b) => sum + (b.remaining_qty || 0), 0);
        const totalRetailValue = batches.reduce((sum, b) => sum + ((b.remaining_qty || 0) * (b.selling_price || 0)), 0);
        const totalCostValue = batches.reduce((sum, b) => sum + ((b.remaining_qty || 0) * (b.purchase_cost || 0)), 0);
        const totalProjectedProfit = totalRetailValue - totalCostValue;
        const expiringSoonCount = batches.filter((b) => {
            const d = getDaysUntil(b.expiry_date);
            return b.remaining_qty > 0 && d >= 0 && d <= 90;
        }).length;
        const expiredCount = batches.filter((b) => {
            const d = getDaysUntil(b.expiry_date);
            return b.remaining_qty > 0 && d < 0;
        }).length;

        return {
            totalBatches,
            totalReceived,
            totalRemaining,
            totalRetailValue,
            totalCostValue,
            totalProjectedProfit,
            expiringSoonCount,
            expiredCount,
        };
    }, [batches]);

    // Pagination
    const totalPages = Math.ceil(filtered.length / (pageSize || 50)) || 1;
    const paginatedItems = useMemo(() => {
        if (pageSize === 0) return filtered;
        const start = (currentPage - 1) * pageSize;
        return filtered.slice(start, start + pageSize);
    }, [filtered, currentPage, pageSize]);

    // Status Badges
    const getBatchBadge = (days: number, remaining: number, status: string) => {
        if (status === 'Quarantine') {
            return (
                <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full text-[10px] font-bold border border-purple-200 inline-flex items-center gap-1">
                    🔒 Quarantined
                </span>
            );
        }
        if (status === 'Disposed') {
            return (
                <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-[10px] font-bold border border-gray-300 inline-flex items-center gap-1">
                    🗑️ Disposed
                </span>
            );
        }
        if (remaining <= 0) {
            return (
                <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-[10px] font-bold border border-gray-200 inline-flex items-center gap-1">
                    0 Out of Stock
                </span>
            );
        }
        if (days < 0) {
            return (
                <span className="px-2 py-0.5 bg-red-600 text-white rounded-full text-[10px] font-bold shadow-xs inline-flex items-center gap-1 animate-pulse">
                    ⚠️ Expired
                </span>
            );
        }
        if (days <= 30) {
            return (
                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[10px] font-bold border border-red-200 inline-flex items-center gap-1">
                    🚨 {days}d left
                </span>
            );
        }
        if (days <= 90) {
            return (
                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[10px] font-bold border border-amber-200 inline-flex items-center gap-1">
                    ⚠️ {days}d left
                </span>
            );
        }
        return (
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold border border-emerald-200 inline-flex items-center gap-1">
                ✓ Active ({days}d)
            </span>
        );
    };

    // Open New Batch Modal
    const handleOpenNewModal = () => {
        setNewBatch({
            product_id: products[0]?.pid || 0,
            batch_number: generateBatchNo(),
            manufacture_date: new Date().toISOString().split('T')[0],
            expiry_date: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
            quantity: 100,
            purchase_cost: products[0]?.purchase_cost || 0,
            selling_price: products[0]?.sales_cost || 0,
            supplier_id: 0,
            supplier_name: products[0]?.supplier_name || 'Direct Procurement',
            purchase_invoice: '',
            notes: '',
        });
        setProductSearch('');
        setIsProductDropOpen(false);
        setShowNewModal(true);
    };

    // Product Select handler in New Batch
    const handleSelectProduct = (p: ProductItem) => {
        setNewBatch((prev) => ({
            ...prev,
            product_id: p.pid,
            purchase_cost: p.purchase_cost || prev.purchase_cost,
            selling_price: p.sales_cost || prev.selling_price,
            supplier_name: p.supplier_name || prev.supplier_name,
        }));
        setProductSearch(p.product_name);
        setIsProductDropOpen(false);
    };

    // Quick Expiry Date setter (e.g. +6m, +1y, +2y, +3y)
    const setQuickExpiry = (months: number) => {
        const d = new Date();
        d.setMonth(d.getMonth() + months);
        setNewBatch((prev) => ({ ...prev, expiry_date: d.toISOString().split('T')[0] }));
    };

    // Save New Batch directly to pharmacy_batches & sync pharmacy_stock
    const handleSaveNewBatch = async () => {
        if (!newBatch.product_id) {
            toast.error('Please select a medicine/product');
            return;
        }
        if (!newBatch.batch_number.trim()) {
            toast.error('Please enter or generate a batch number');
            return;
        }
        if (!newBatch.expiry_date) {
            toast.error('Please set an expiry date');
            return;
        }
        if (newBatch.quantity <= 0) {
            toast.error('Batch quantity received must be greater than 0');
            return;
        }

        setIsSaving(true);
        try {
            // 1. Insert into pharmacy_batches
            const { data: insertedBatch, error: batchErr } = await supabase
                .from('pharmacy_batches')
                .insert({
                    product_id: newBatch.product_id,
                    batch_number: newBatch.batch_number.trim(),
                    manufacture_date: newBatch.manufacture_date || null,
                    expiry_date: newBatch.expiry_date,
                    quantity: Number(newBatch.quantity),
                    remaining_qty: Number(newBatch.quantity),
                    purchase_cost: Number(newBatch.purchase_cost || 0),
                    selling_price: Number(newBatch.selling_price || 0),
                    supplier_id: newBatch.supplier_id || null,
                    supplier_name: newBatch.supplier_name.trim() || 'Direct Procurement',
                    purchase_invoice: newBatch.purchase_invoice.trim() || null,
                    status: 'Active',
                    notes: newBatch.notes.trim() || null,
                    outlet_id: outletId,
                })
                .select()
                .single();

            if (batchErr) throw batchErr;

            // 2. Sync to pharmacy_stock
            if (insertedBatch?.batch_id) {
                await supabase.from('pharmacy_stock').insert({
                    pid: newBatch.product_id,
                    batch_id: insertedBatch.batch_id,
                    invoice_no: newBatch.purchase_invoice.trim() || null,
                    qty: Number(newBatch.quantity),
                    storage_type: 'Store',
                    expiry_date: newBatch.expiry_date,
                    notes: `Batch ${newBatch.batch_number} received`,
                    outlet_id: outletId,
                });
            }

            // 3. Update product selling price if higher
            if (newBatch.selling_price > 0) {
                await supabase
                    .from('pharmacy_products')
                    .update({
                        sales_cost: newBatch.selling_price,
                        purchase_cost: newBatch.purchase_cost || undefined,
                    })
                    .eq('pid', newBatch.product_id);
            }

            toast.success(`Batch ${newBatch.batch_number} successfully registered!`);
            setShowNewModal(false);
            loadData();
        } catch (err: any) {
            toast.error(`Failed to register batch: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    // Save Edit Batch
    const handleSaveEditBatch = async () => {
        if (!editBatch) return;
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('pharmacy_batches')
                .update({
                    batch_number: editBatch.batch_number.trim(),
                    manufacture_date: editBatch.manufacture_date || null,
                    expiry_date: editBatch.expiry_date,
                    purchase_cost: editBatch.purchase_cost,
                    selling_price: editBatch.selling_price,
                    supplier_name: editBatch.supplier_name,
                    purchase_invoice: editBatch.purchase_invoice,
                    status: editBatch.status,
                    notes: editBatch.notes,
                })
                .eq('batch_id', editBatch.batch_id);

            if (error) throw error;
            toast.success(`Batch ${editBatch.batch_number} updated`);
            setShowEditModal(false);
            setEditBatch(null);
            loadData();
        } catch (err: any) {
            toast.error(`Update failed: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    // Reconcile / Stock Adjustment
    const handleExecuteAdjustment = async () => {
        if (!adjustBatch) return;
        const newQtyNum = parseFloat(adjustNewQty);
        if (isNaN(newQtyNum) || newQtyNum < 0) {
            toast.error('Please enter a valid stock quantity');
            return;
        }

        const diff = newQtyNum - adjustBatch.remaining_qty;
        try {
            const { error } = await supabase
                .from('pharmacy_batches')
                .update({
                    remaining_qty: newQtyNum,
                    notes: `Stock adjusted by ${diff > 0 ? '+' : ''}${diff} on ${new Date().toLocaleDateString()}; Reason: ${adjustReason}. Prior notes: ${adjustBatch.notes || 'None'}`,
                })
                .eq('batch_id', adjustBatch.batch_id);

            if (error) throw error;
            toast.success(`Batch ${adjustBatch.batch_number} stock reconciled to ${newQtyNum} ${adjustBatch.sales_unit}`);
            setShowAdjustModal(false);
            setAdjustBatch(null);
            setAdjustNewQty('');
            loadData();
        } catch (err: any) {
            toast.error(`Adjustment failed: ${err.message}`);
        }
    };

    // Toggle Quarantine status
    const toggleQuarantine = async (b: BatchItem) => {
        const nextStatus = b.status === 'Quarantine' ? 'Active' : 'Quarantine';
        try {
            const { error } = await supabase
                .from('pharmacy_batches')
                .update({ status: nextStatus })
                .eq('batch_id', b.batch_id);

            if (error) throw error;
            toast.success(`Batch ${b.batch_number} set to ${nextStatus}`);
            loadData();
        } catch (err: any) {
            toast.error(`Failed: ${err.message}`);
        }
    };

    // =====================================================================
    // BRIGHT COLORS EXCEL EXPORTER (SpreadsheetML XML)
    // =====================================================================
    const exportBrightExcel = () => {
        if (filtered.length === 0) {
            toast.error('No batches to export');
            return;
        }

        const genDate = new Date().toLocaleString('en-GB');
        const totalCost = filtered.reduce((s, b) => s + (b.remaining_qty * b.purchase_cost), 0);
        const totalRetail = filtered.reduce((s, b) => s + (b.remaining_qty * b.selling_price), 0);
        const totalUnits = filtered.reduce((s, b) => s + b.remaining_qty, 0);

        const xmlString = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>Alpha Pharmacy Batch Inventory Register</Title>
  <Subject>Pharmacy Batch Inventory Valuation &amp; FEFO Audit</Subject>
  <Author>Alpha Pharmacy System</Author>
  <Created>${new Date().toISOString()}</Created>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#1e293b"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <!-- Main Banner Header - BRIGHT VIBRANT EMERALD & ELECTRIC CYAN -->
  <Style ss:ID="TitleBanner">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="16" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#00C853" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="MetaBanner">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10.5" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#0091EA" ss:Pattern="Solid"/>
  </Style>

  <!-- BRIGHT VIVID KPI DASHBOARD CARD HEADERS & VALUES -->
  <Style ss:ID="KpiHdrBlue">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="9.5" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#2979FF" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="KpiValBlue">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="13" ss:Bold="1" ss:Color="#0D47A1"/>
   <Interior ss:Color="#E3F2FD" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="KpiHdrRed">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="9.5" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#FF1744" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="KpiValRed">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="13" ss:Bold="1" ss:Color="#B71C1C"/>
   <Interior ss:Color="#FFEBEE" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="KpiHdrPurple">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="9.5" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#8E24AA" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="KpiValPurple">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="13" ss:Bold="1" ss:Color="#4A148C"/>
   <Interior ss:Color="#F3E5F5" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="KpiHdrGreen">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="9.5" ss:Bold="1" ss:Color="#003314"/>
   <Interior ss:Color="#00E676" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="KpiValGreen">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="13" ss:Bold="1" ss:Color="#1B5E20"/>
   <Interior ss:Color="#E8F5E9" ss:Pattern="Solid"/>
  </Style>

  <!-- TABLE COLUMN HEADERS -->
  <Style ss:ID="ColHeader">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Calibri" ss:Size="10.5" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#00897B" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#004D40"/>
   </Borders>
  </Style>

  <!-- Cells -->
  <Style ss:ID="CellText">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/></Borders>
  </Style>
  <Style ss:ID="CellTextBold">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#0F172A"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/></Borders>
  </Style>
  <Style ss:ID="CellCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/></Borders>
  </Style>
  <Style ss:ID="CellBatchMono">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Consolas" ss:Size="10" ss:Bold="1" ss:Color="#7E22CE"/>
   <Interior ss:Color="#FAF5FF" ss:Pattern="Solid"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E9D5FF"/></Borders>
  </Style>
  <Style ss:ID="CellNumber">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="#,##0"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/></Borders>
  </Style>
  <Style ss:ID="CellCurrency">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="&quot;Ksh &quot;#,##0.00"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/></Borders>
  </Style>
  <Style ss:ID="CellCostRisk">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#D50000"/>
   <Interior ss:Color="#FFEBEE" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="&quot;Ksh &quot;#,##0.00"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FFCDD2"/></Borders>
  </Style>
  <Style ss:ID="CellRetailRisk">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#1B5E20"/>
   <Interior ss:Color="#E8F5E9" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="&quot;Ksh &quot;#,##0.00"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#C8E6C9"/></Borders>
  </Style>
  <Style ss:ID="CellPercent">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="0.0%"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/></Borders>
  </Style>

  <!-- BRIGHT RISK BADGES -->
  <Style ss:ID="BadgeExpired">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#FF1744" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="BadgeCritical">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#FF6D00" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="BadgeWarning">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#3E2723"/>
   <Interior ss:Color="#FFD600" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="BadgeSafe">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#003B15"/>
   <Interior ss:Color="#00E676" ss:Pattern="Solid"/>
  </Style>

  <!-- GRAND SUMMARY TOTALS -->
  <Style ss:ID="SummaryTotalLabel">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11.5" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#FF9100" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="SummaryTotalCurrency">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11.5" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#FF9100" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="&quot;Ksh &quot;#,##0.00"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Batch Inventory Register">
  <Table>
   <Column ss:Width="35"/>   <!-- # -->
   <Column ss:Width="105"/>  <!-- Batch # -->
   <Column ss:Width="200"/>  <!-- Product Name -->
   <Column ss:Width="150"/>  <!-- Generic Name -->
   <Column ss:Width="100"/>  <!-- Category -->
   <Column ss:Width="85"/>   <!-- Mfg Date -->
   <Column ss:Width="90"/>   <!-- Expiry Date -->
   <Column ss:Width="80"/>   <!-- Days Left -->
   <Column ss:Width="110"/>  <!-- Status -->
   <Column ss:Width="85"/>   <!-- Initial Qty -->
   <Column ss:Width="85"/>   <!-- Remaining Qty -->
   <Column ss:Width="75"/>   <!-- Unit -->
   <Column ss:Width="105"/>  <!-- Unit Cost -->
   <Column ss:Width="105"/>  <!-- Unit Selling -->
   <Column ss:Width="125"/>  <!-- Total Cost Value -->
   <Column ss:Width="125"/>  <!-- Total Retail Value -->
   <Column ss:Width="115"/>  <!-- Projected Profit -->
   <Column ss:Width="80"/>   <!-- Margin % -->
   <Column ss:Width="130"/>  <!-- Supplier -->
   <Column ss:Width="100"/>  <!-- Invoice # -->

   <!-- Row 1: Title -->
   <Row ss:Height="30">
    <Cell ss:MergeAcross="19" ss:StyleID="TitleBanner">
     <Data ss:Type="String">ALPHA PHARMACY SYSTEM — MASTER BATCH INVENTORY &amp; FEFO AUDIT</Data>
    </Cell>
   </Row>

   <!-- Row 2: Sub-Metadata -->
   <Row ss:Height="18">
    <Cell ss:MergeAcross="19" ss:StyleID="MetaBanner">
     <Data ss:Type="String">Outlet: ${escapeXml(outletName)}  |  Exported: ${escapeXml(genDate)}  |  Records: ${filtered.length}</Data>
    </Cell>
   </Row>

   <Row ss:Height="8" />

   <!-- Row 4: KPI Dashboard Header -->
   <Row ss:Height="20">
    <Cell ss:MergeAcross="1" ss:StyleID="KpiHdrBlue"><Data ss:Type="String">TOTAL BATCHES</Data></Cell>
    <Cell ss:MergeAcross="2" ss:StyleID="KpiHdrPurple"><Data ss:Type="String">TOTAL UNITS IN STOCK</Data></Cell>
    <Cell ss:MergeAcross="4" ss:StyleID="KpiHdrRed"><Data ss:Type="String">TOTAL INVENTORY COST (PURCHASE)</Data></Cell>
    <Cell ss:MergeAcross="4" ss:StyleID="KpiHdrGreen"><Data ss:Type="String">TOTAL INVENTORY VALUE (RETAIL)</Data></Cell>
    <Cell ss:MergeAcross="5" ss:StyleID="KpiHdrBlue"><Data ss:Type="String">PROJECTED GROSS PROFIT</Data></Cell>
   </Row>

   <!-- Row 5: KPI Dashboard Values -->
   <Row ss:Height="24">
    <Cell ss:MergeAcross="1" ss:StyleID="KpiValBlue"><Data ss:Type="Number">${filtered.length}</Data></Cell>
    <Cell ss:MergeAcross="2" ss:StyleID="KpiValPurple"><Data ss:Type="Number">${totalUnits}</Data></Cell>
    <Cell ss:MergeAcross="4" ss:StyleID="KpiValRed"><Data ss:Type="Number">${totalCost}</Data></Cell>
    <Cell ss:MergeAcross="4" ss:StyleID="KpiValGreen"><Data ss:Type="Number">${totalRetail}</Data></Cell>
    <Cell ss:MergeAcross="5" ss:StyleID="KpiValBlue"><Data ss:Type="Number">${totalRetail - totalCost}</Data></Cell>
   </Row>

   <Row ss:Height="10" />

   <!-- Table Headers -->
   <Row ss:Height="26">
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">#</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Batch #</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Product Name</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Generic / Formulation</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Category</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Mfg Date</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Expiry Date</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Days Left</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Status</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Qty Received</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Current Stock</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Unit</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Unit Cost</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Unit Retail</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Total Cost (KES)</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Total Retail (KES)</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Profit (KES)</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Margin %</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Supplier</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Invoice #</Data></Cell>
   </Row>

   <!-- Data Rows -->
   ${filtered
       .map((b, idx) => {
           const days = getDaysUntil(b.expiry_date);
           const totalC = b.remaining_qty * b.purchase_cost;
           const totalR = b.remaining_qty * b.selling_price;
           const profit = totalR - totalC;
           const marginPct = totalR > 0 ? profit / totalR : 0;

           let badgeStyle = 'BadgeSafe';
           let statusText = 'Safe';
           if (b.status === 'Quarantine') {
               badgeStyle = 'BadgeCritical';
               statusText = 'QUARANTINE';
           } else if (days < 0) {
               badgeStyle = 'BadgeExpired';
               statusText = `EXPIRED (${Math.abs(days)}d ago)`;
           } else if (days <= 30) {
               badgeStyle = 'BadgeCritical';
               statusText = `CRITICAL (${days}d left)`;
           } else if (days <= 90) {
               badgeStyle = 'BadgeWarning';
               statusText = `WARNING (${days}d left)`;
           }

           return `<Row ss:Height="20">
    <Cell ss:StyleID="CellCenter"><Data ss:Type="Number">${idx + 1}</Data></Cell>
    <Cell ss:StyleID="CellBatchMono"><Data ss:Type="String">${escapeXml(b.batch_number)}</Data></Cell>
    <Cell ss:StyleID="CellTextBold"><Data ss:Type="String">${escapeXml(b.product_name)}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${escapeXml(b.generic_name || '—')}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${escapeXml(b.category)}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXml(b.manufacture_date || '—')}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXml(b.expiry_date)}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="Number">${days}</Data></Cell>
    <Cell ss:StyleID="${badgeStyle}"><Data ss:Type="String">${escapeXml(statusText)}</Data></Cell>
    <Cell ss:StyleID="CellNumber"><Data ss:Type="Number">${b.quantity}</Data></Cell>
    <Cell ss:StyleID="CellNumber"><Data ss:Type="Number">${b.remaining_qty}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXml(b.sales_unit)}</Data></Cell>
    <Cell ss:StyleID="CellCurrency"><Data ss:Type="Number">${b.purchase_cost}</Data></Cell>
    <Cell ss:StyleID="CellCurrency"><Data ss:Type="Number">${b.selling_price}</Data></Cell>
    <Cell ss:StyleID="CellCostRisk"><Data ss:Type="Number">${totalC}</Data></Cell>
    <Cell ss:StyleID="CellRetailRisk"><Data ss:Type="Number">${totalR}</Data></Cell>
    <Cell ss:StyleID="CellCurrency"><Data ss:Type="Number">${profit}</Data></Cell>
    <Cell ss:StyleID="CellPercent"><Data ss:Type="Number">${marginPct.toFixed(3)}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${escapeXml(b.supplier_name)}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${escapeXml(b.purchase_invoice || '—')}</Data></Cell>
   </Row>`;
       })
       .join('\n')}

   <!-- Grand Summary Totals -->
   <Row ss:Height="24">
    <Cell ss:MergeAcross="9" ss:StyleID="SummaryTotalLabel"><Data ss:Type="String">GRAND INVENTORY TOTALS:</Data></Cell>
    <Cell ss:StyleID="SummaryTotalLabel"><Data ss:Type="Number">${totalUnits}</Data></Cell>
    <Cell ss:StyleID="SummaryTotalLabel"><Data ss:Type="String">—</Data></Cell>
    <Cell ss:StyleID="SummaryTotalLabel"><Data ss:Type="String">—</Data></Cell>
    <Cell ss:StyleID="SummaryTotalLabel"><Data ss:Type="String">—</Data></Cell>
    <Cell ss:StyleID="SummaryTotalCurrency"><Data ss:Type="Number">${totalCost}</Data></Cell>
    <Cell ss:StyleID="SummaryTotalCurrency"><Data ss:Type="Number">${totalRetail}</Data></Cell>
    <Cell ss:StyleID="SummaryTotalCurrency"><Data ss:Type="Number">${totalRetail - totalCost}</Data></Cell>
    <Cell ss:StyleID="SummaryTotalLabel"><Data ss:Type="String">${totalRetail > 0 ? (((totalRetail - totalCost) / totalRetail) * 100).toFixed(1) : 0}%</Data></Cell>
    <Cell ss:StyleID="SummaryTotalLabel"><Data ss:Type="String">—</Data></Cell>
    <Cell ss:StyleID="SummaryTotalLabel"><Data ss:Type="String">—</Data></Cell>
   </Row>
  </Table>
 </Worksheet>
</Workbook>`;

        const blob = new Blob([xmlString], { type: 'application/vnd.ms-excel;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AlphaPharmacy_Batches_${new Date().toISOString().split('T')[0]}_SuperPremium.xls`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`Exported ${filtered.length} batches to Super Bright Excel!`);
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-96" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
                <div className="w-14 h-14 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                <p className="mt-4 text-gray-600 font-semibold text-sm">Loading pharmacy batch inventory...</p>
                <p className="text-xs text-gray-400 mt-1">Connecting to active batches &amp; live products</p>
            </div>
        );
    }

    return (
        <div className="w-full max-w-full space-y-4 px-1 md:px-2" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-700 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg flex-shrink-0">
                        📦
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold text-gray-800">Pharmacy Batch Management</h1>
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold border border-emerald-200">
                                FEFO Protected
                            </span>
                        </div>
                        <p className="text-gray-500 text-xs">
                            Active Outlet: <span className="font-semibold text-gray-700">{outletName}</span> • Track received pharmaceutical batches, unit costs, pricing margins, and expiry lifespans
                        </p>
                    </div>
                </div>

                <div className="flex items-center flex-wrap gap-2">
                    {/* New Batch Button */}
                    <button
                        onClick={handleOpenNewModal}
                        className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl font-bold shadow-sm hover:shadow transition-all flex items-center gap-1.5 text-xs active:scale-95"
                    >
                        <span>➕</span> New Batch
                    </button>

                    {/* Bright Excel Export */}
                    <button
                        onClick={exportBrightExcel}
                        className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl font-bold shadow-sm transition-all flex items-center gap-1.5 text-xs"
                        title="Download Massive Styled Excel Workbook with bright vivid colors"
                    >
                        <span>📊</span> Super Excel
                    </button>

                    {/* Print */}
                    <button
                        onClick={() => window.print()}
                        className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl font-bold shadow-sm transition-all flex items-center gap-1 text-xs"
                    >
                        <span>🖨️</span> Print
                    </button>

                    {/* Refresh */}
                    <button
                        onClick={loadData}
                        className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl font-bold shadow-sm transition-all flex items-center gap-1 text-xs"
                    >
                        <span>🔄</span> Refresh
                    </button>
                </div>
            </div>

            {/* Light Gradient Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5 w-full">
                {/* Total Batches */}
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-3.5 border border-indigo-100 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xl">📦</span>
                        <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Active Lots</span>
                    </div>
                    <p className="text-xs text-gray-500 font-semibold">Total Batches</p>
                    <p className="text-xl font-black text-indigo-900 tracking-tight">{kpis.totalBatches}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Recv: {kpis.totalReceived.toLocaleString()}</p>
                </div>

                {/* Remaining Stock */}
                <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-2xl p-3.5 border border-cyan-100 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xl">📊</span>
                        <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">In Stock</span>
                    </div>
                    <p className="text-xs text-gray-500 font-semibold">Available Units</p>
                    <p className="text-xl font-black text-blue-900 tracking-tight">{kpis.totalRemaining.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Dispensed: {(kpis.totalReceived - kpis.totalRemaining).toLocaleString()}</p>
                </div>

                {/* Total Cost Value */}
                <div className="bg-gradient-to-br from-rose-50 to-red-50 rounded-2xl p-3.5 border border-rose-100 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xl">💰</span>
                        <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">Cost Basis</span>
                    </div>
                    <p className="text-xs text-gray-500 font-semibold">Inventory Cost</p>
                    <p className="text-base font-black text-rose-900 tracking-tight">Ksh {kpis.totalCostValue.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Purchase value</p>
                </div>

                {/* Total Retail Value */}
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-3.5 border border-emerald-100 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xl">💎</span>
                        <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Retail Value</span>
                    </div>
                    <p className="text-xs text-gray-500 font-semibold">Stock Retail</p>
                    <p className="text-base font-black text-emerald-900 tracking-tight">Ksh {kpis.totalRetailValue.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Expected Revenue</p>
                </div>

                {/* Total Profit */}
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-3.5 border border-amber-100 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xl">📈</span>
                        <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Margin</span>
                    </div>
                    <p className="text-xs text-gray-500 font-semibold">Projected Profit</p>
                    <p className="text-base font-black text-amber-900 tracking-tight">Ksh {kpis.totalProjectedProfit.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                        {kpis.totalRetailValue > 0 ? ((kpis.totalProjectedProfit / kpis.totalRetailValue) * 100).toFixed(1) : 0}% Margin
                    </p>
                </div>

                {/* Expiring / Risk Batches */}
                <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-2xl p-3.5 border border-red-100 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xl">⏰</span>
                        <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider">Risk Alert</span>
                    </div>
                    <p className="text-xs text-gray-500 font-semibold">Expiring in 90d</p>
                    <p className="text-xl font-black text-red-800 tracking-tight">{kpis.expiringSoonCount}</p>
                    <p className="text-[10px] text-red-600 font-bold mt-0.5">{kpis.expiredCount} Expired Batches</p>
                </div>
            </div>

            {/* Multi-Dimensional Filter Bar */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3">
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5">
                    {/* Omni-Search */}
                    <div className="relative flex-1 min-w-[240px]">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setCurrentPage(1);
                            }}
                            placeholder="Search by product, batch number, generic, supplier, invoice, barcode..."
                            className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-gray-800"
                        />
                        {search && (
                            <button
                                onClick={() => setSearch('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Secondary Filters */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {/* Status Filter */}
                        <select
                            value={filterStatus}
                            onChange={(e) => {
                                setFilterStatus(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 cursor-pointer outline-none focus:border-emerald-500"
                        >
                            <option value="All">All Statuses</option>
                            <option value="Active">✓ Active &amp; In Stock</option>
                            <option value="LowStock">⚠️ Low Stock (≤10)</option>
                            <option value="Out">❌ Out of Stock</option>
                            <option value="Quarantine">🔒 Quarantined</option>
                            <option value="Disposed">🗑️ Disposed</option>
                        </select>

                        {/* Category */}
                        <select
                            value={filterCategory}
                            onChange={(e) => {
                                setFilterCategory(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 cursor-pointer outline-none focus:border-emerald-500 truncate"
                        >
                            <option value="All">All Categories</option>
                            {categories.map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>

                        {/* Expiry Horizon */}
                        <select
                            value={filterExpiry}
                            onChange={(e) => {
                                setFilterExpiry(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 cursor-pointer outline-none focus:border-emerald-500"
                        >
                            <option value="All">All Expiry Dates</option>
                            <option value="Expired">🔴 Expired</option>
                            <option value="Critical">🚨 Critical (≤30d)</option>
                            <option value="Warning">⚠️ Warning (31-90d)</option>
                            <option value="Safe">✓ Safe (&gt;90d)</option>
                        </select>

                        {/* Sort Order */}
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as any)}
                            className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 cursor-pointer outline-none focus:border-emerald-500"
                        >
                            <option value="newest">🕒 Newest Batch First</option>
                            <option value="fefo">⚡ FEFO (Earliest Expiry First)</option>
                            <option value="furthest_expiry">📅 Furthest Expiry</option>
                            <option value="stock_high">📦 Stock: High→Low</option>
                            <option value="stock_low">📦 Stock: Low→High</option>
                            <option value="value_high">💎 Value: High→Low</option>
                            <option value="margin_high">📈 Margin: High→Low</option>
                            <option value="name">🔤 Product (A→Z)</option>
                        </select>
                    </div>
                </div>

                {/* Active Filter counter & Reset */}
                <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-gray-100 text-xs">
                    <span className="font-bold text-gray-700">
                        Showing <span className="text-emerald-700 font-extrabold">{filtered.length}</span> of {batches.length} batches
                    </span>
                    {activeFilterCount > 0 && (
                        <button
                            onClick={resetFilters}
                            className="text-xs text-red-600 hover:text-red-700 font-bold underline"
                        >
                            Reset All Filters ({activeFilterCount})
                        </button>
                    )}
                </div>
            </div>

            {/* Master Batch Data Table (Auto-Fit) */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Table Header Bar */}
                <div className="px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">📦</span>
                        <h2 className="text-sm font-bold tracking-wide">
                            Pharmaceutical Batches Inventory &amp; Stock Ledger
                        </h2>
                        <span className="px-2.5 py-0.5 bg-white/20 rounded-full text-xs font-extrabold backdrop-blur-xs">
                            {filtered.length} Records
                        </span>
                    </div>
                    <div className="text-xs text-white/90 flex items-center gap-3">
                        <span>
                            Total Stock: <strong className="text-white font-black">{filtered.reduce((s, b) => s + b.remaining_qty, 0).toLocaleString()}</strong>
                        </span>
                        <span>•</span>
                        <span>
                            Retail: <strong className="text-white font-black">Ksh {filtered.reduce((s, b) => s + (b.remaining_qty * b.selling_price), 0).toLocaleString()}</strong>
                        </span>
                        <button
                            onClick={() => setIsAutoFit(!isAutoFit)}
                            className="px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-xs"
                            title="Toggle Auto-Fit view (fits 100% on screen) or Expanded table"
                        >
                            <span>{isAutoFit ? '🖥️ Auto-Fit (Active)' : '↔️ Expanded'}</span>
                        </button>
                    </div>
                </div>

                <div className={isAutoFit ? 'w-full overflow-hidden' : 'overflow-x-auto'}>
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                <th className="px-2.5 py-2.5">Batch #</th>
                                <th className="px-2.5 py-2.5">Product &amp; Formulation</th>
                                <th className="px-2.5 py-2.5">Category</th>
                                <th className="px-2.5 py-2.5 text-center">Dates (Mfg / Exp)</th>
                                <th className="px-2.5 py-2.5 text-center">Lifespan Status</th>
                                <th className="px-2.5 py-2.5 text-center">Stock Progress</th>
                                <th className="px-2.5 py-2.5 text-right">Pricing (Unit)</th>
                                <th className="px-2.5 py-2.5 text-right">Valuation (Batch)</th>
                                <th className="px-2.5 py-2.5 text-center w-28">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-xs">
                            {paginatedItems.map((b) => {
                                const days = getDaysUntil(b.expiry_date);
                                const totalCost = b.remaining_qty * b.purchase_cost;
                                const totalRetail = b.remaining_qty * b.selling_price;
                                const marginPct = b.selling_price > 0 ? (((b.selling_price - b.purchase_cost) / b.selling_price) * 100).toFixed(0) : '0';
                                const stockPct = b.quantity > 0 ? Math.round((b.remaining_qty / b.quantity) * 100) : 100;

                                const rowBg = b.status === 'Quarantine'
                                    ? 'bg-purple-50/60 hover:bg-purple-100/60'
                                    : days < 0 && b.remaining_qty > 0
                                    ? 'bg-red-50/70 hover:bg-red-100/60'
                                    : days <= 30 && b.remaining_qty > 0
                                    ? 'bg-orange-50/60 hover:bg-orange-100/50'
                                    : b.remaining_qty <= 0
                                    ? 'bg-gray-50/50 text-gray-400'
                                    : 'hover:bg-gray-50/80';

                                return (
                                    <tr key={b.batch_id} className={`transition-colors ${rowBg}`}>
                                        {/* Batch Number */}
                                        <td className="px-2.5 py-2 min-w-0">
                                            <span className="font-mono font-bold text-purple-800 bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded text-[11px] block truncate max-w-[120px]">
                                                {b.batch_number}
                                            </span>
                                            <p className="text-[9.5px] text-gray-500 truncate max-w-[120px] mt-0.5">
                                                {b.supplier_name || 'Direct'}
                                            </p>
                                        </td>

                                        {/* Product & Generic */}
                                        <td className="px-2.5 py-2 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span
                                                    onClick={() => setDetailBatch(b)}
                                                    className="font-bold text-gray-900 hover:text-emerald-700 cursor-pointer truncate max-w-[200px]"
                                                    title="Click to view batch audit profile"
                                                >
                                                    {b.product_name}
                                                </span>
                                                {b.dosage && (
                                                    <span className="px-1 py-0.2 bg-gray-100 text-gray-600 rounded text-[8.5px] font-semibold">
                                                        {b.dosage}
                                                    </span>
                                                )}
                                            </div>
                                            {b.generic_name && (
                                                <p className="text-[9.5px] text-teal-700 italic truncate max-w-[190px] mt-0.5">
                                                    {b.generic_name}
                                                </p>
                                            )}
                                        </td>

                                        {/* Category */}
                                        <td className="px-2.5 py-2 min-w-0">
                                            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded text-[9.5px] font-medium truncate inline-block max-w-[95px]">
                                                {b.category}
                                            </span>
                                            {b.drug_type && (
                                                <p className="text-[9px] text-gray-400 truncate max-w-[95px] mt-0.5">{b.drug_type}</p>
                                            )}
                                        </td>

                                        {/* Dates */}
                                        <td className="px-2.5 py-2 text-center whitespace-nowrap">
                                            <p className="font-bold text-gray-800 text-[11px] leading-tight">Exp: {formatDate(b.expiry_date)}</p>
                                            {b.manufacture_date && (
                                                <p className="text-[9px] text-gray-400 mt-0.5">Mfg: {formatDate(b.manufacture_date)}</p>
                                            )}
                                        </td>

                                        {/* Lifespan Status */}
                                        <td className="px-2.5 py-2 text-center whitespace-nowrap">
                                            {getBatchBadge(days, b.remaining_qty, b.status)}
                                        </td>

                                        {/* Stock & Progress */}
                                        <td className="px-2.5 py-2 text-center whitespace-nowrap">
                                            {(() => {
                                                const ppp = b.pieces_per_package || 1;
                                                const breakdown = calculateStockBreakdown(b.remaining_qty, ppp, b.purchase_unit, b.sales_unit);
                                                return (
                                                    <div>
                                                        <p className="font-black text-gray-950 text-xs">
                                                            {breakdown.boxes > 0 ? `${breakdown.boxes} Box + ${breakdown.loosePieces} Pcs` : `${b.remaining_qty} ${b.sales_unit || 'Pcs'}`}
                                                        </p>
                                                        <span className="text-[10px] text-gray-400 font-medium">({b.remaining_qty} total / {b.quantity})</span>
                                                    </div>
                                                );
                                            })()}
                                            <div className="w-16 mx-auto bg-gray-200 rounded-full h-1 mt-1 overflow-hidden" title={`${stockPct}% remaining`}>
                                                <div
                                                    className={`h-full ${days < 0 ? 'bg-red-500' : days <= 30 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                                    style={{ width: `${Math.min(100, stockPct)}%` }}
                                                />
                                            </div>
                                        </td>

                                        {/* Pricing */}
                                        <td className="px-2.5 py-2 text-right whitespace-nowrap">
                                            <p className="font-bold text-gray-800 text-xs">Ksh {b.selling_price.toLocaleString()}</p>
                                            <p className="text-[9.5px] text-gray-400">Cost: {b.purchase_cost.toLocaleString()} ({marginPct}%)</p>
                                        </td>

                                        {/* Valuation */}
                                        <td className="px-2.5 py-2 text-right whitespace-nowrap">
                                            <p className="font-bold text-emerald-800 text-xs leading-tight">
                                                Ret: Ksh {totalRetail.toLocaleString()}
                                            </p>
                                            <p className="text-[9.5px] text-gray-500 mt-0.5">
                                                Cost: Ksh {totalCost.toLocaleString()}
                                            </p>
                                        </td>

                                        {/* Action Buttons */}
                                        <td className="px-2.5 py-2 text-center whitespace-nowrap">
                                            <div className="flex items-center justify-center gap-1">
                                                {/* Edit */}
                                                <button
                                                    onClick={() => {
                                                        setEditBatch({ ...b });
                                                        setShowEditModal(true);
                                                    }}
                                                    className="p-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-md transition-colors"
                                                    title="Edit batch particulars"
                                                >
                                                    ✏️
                                                </button>

                                                {/* Reconcile Stock */}
                                                <button
                                                    onClick={() => {
                                                        setAdjustBatch(b);
                                                        setAdjustNewQty(b.remaining_qty.toString());
                                                        setShowAdjustModal(true);
                                                    }}
                                                    className="p-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-md transition-colors"
                                                    title="Reconcile / Adjust physical stock count"
                                                >
                                                    ⚖️
                                                </button>

                                                {/* Quarantine Toggle */}
                                                <button
                                                    onClick={() => toggleQuarantine(b)}
                                                    className={`p-1 rounded-md transition-colors ${
                                                        b.status === 'Quarantine'
                                                            ? 'bg-purple-600 text-white'
                                                            : 'bg-purple-50 hover:bg-purple-100 text-purple-700'
                                                    }`}
                                                    title={b.status === 'Quarantine' ? 'Release from Quarantine' : 'Quarantine Batch'}
                                                >
                                                    🔒
                                                </button>

                                                {/* Detail Drawer */}
                                                <button
                                                    onClick={() => setDetailBatch(b)}
                                                    className="p-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md transition-colors"
                                                    title="View complete batch audit sheet"
                                                >
                                                    ℹ️
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}

                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="text-center py-16 text-gray-400">
                                        <span className="text-5xl block mb-2">📦</span>
                                        <p className="text-base font-bold text-gray-700">No batches match current filter criteria</p>
                                        <p className="text-xs text-gray-400 mt-1">Try resetting filters or registering a new medicine batch</p>
                                        <button
                                            onClick={handleOpenNewModal}
                                            className="mt-3 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 shadow-sm"
                                        >
                                            ➕ Register New Batch
                                        </button>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between flex-wrap gap-2 text-xs">
                    <div className="flex items-center gap-2">
                        <span className="text-gray-500 font-semibold">Rows per page:</span>
                        <select
                            value={pageSize}
                            onChange={(e) => {
                                setPageSize(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="px-2 py-1 bg-white border border-gray-200 rounded-md font-semibold text-gray-700 cursor-pointer"
                        >
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                            <option value={0}>All ({filtered.length})</option>
                        </select>
                        <span className="text-gray-400 ml-2">
                            Page {currentPage} of {totalPages}
                        </span>
                    </div>

                    {pageSize > 0 && totalPages > 1 && (
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1 bg-white border border-gray-200 rounded-md font-bold text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100"
                            >
                                ← Prev
                            </button>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                const pageNum = i + 1;
                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setCurrentPage(pageNum)}
                                        className={`w-7 h-7 rounded-md font-bold text-xs ${
                                            currentPage === pageNum
                                                ? 'bg-emerald-600 text-white'
                                                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                                        }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                            <button
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1 bg-white border border-gray-200 rounded-md font-bold text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100"
                            >
                                Next →
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* =====================================================================
                SUPER ULTRA NEW BATCH MODAL
            ===================================================================== */}
            {showNewModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 border border-gray-100 max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95 space-y-4">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                            <div>
                                <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                                    <span className="text-emerald-600 text-xl">📦</span> Register New Pharmaceutical Batch
                                </h3>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Outlet: <strong className="text-gray-700">{outletName}</strong> • Records batch into pharmacy inventory with live margin valuation
                                </p>
                            </div>
                            <button
                                onClick={() => setShowNewModal(false)}
                                className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-400 flex items-center justify-center font-bold text-sm"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Step 1: Select Medicine Product */}
                        <div className="space-y-1">
                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                                Select Medicine / Product <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={productSearch || selectedProduct?.product_name || ''}
                                    onFocus={() => setIsProductDropOpen(true)}
                                    onChange={(e) => {
                                        setProductSearch(e.target.value);
                                        setIsProductDropOpen(true);
                                    }}
                                    placeholder="Search medicine by name, generic, barcode or SKU..."
                                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                                />
                                {isProductDropOpen && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-56 overflow-y-auto z-20 divide-y divide-gray-100">
                                        {modalFilteredProducts.map((p) => (
                                            <div
                                                key={p.pid}
                                                onClick={() => handleSelectProduct(p)}
                                                className="p-2.5 hover:bg-emerald-50 cursor-pointer transition-colors text-xs flex items-center justify-between"
                                            >
                                                <div>
                                                    <p className="font-bold text-gray-900">{p.product_name}</p>
                                                    <p className="text-[10px] text-gray-500">
                                                        {[p.generic_name, p.dosage, p.drug_type, p.category].filter(Boolean).join(' • ')}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <span className="font-extrabold text-emerald-700">Ksh {p.sales_cost.toLocaleString()}</span>
                                                    <p className="text-[9.5px] text-gray-400">Cost: Ksh {p.purchase_cost.toLocaleString()}</p>
                                                </div>
                                            </div>
                                        ))}
                                        {modalFilteredProducts.length === 0 && (
                                            <div className="p-4 text-center text-gray-400 text-xs font-semibold">
                                                No products found matching &quot;{productSearch}&quot;
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Selected Product Pill Card */}
                            {selectedProduct && (
                                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between text-xs mt-1.5">
                                    <div>
                                        <span className="font-black text-emerald-950 block">{selectedProduct.product_name}</span>
                                        <p className="text-[10.5px] text-emerald-700">
                                            Code: {selectedProduct.product_code} • Form: {selectedProduct.drug_type || 'Medicine'} • Unit: {selectedProduct.sales_unit}
                                        </p>
                                    </div>
                                    <span className="px-2 py-0.5 bg-emerald-200 text-emerald-900 font-bold rounded text-[10px]">
                                        {selectedProduct.category}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Step 2: Batch Specifics (Batch # & Qty) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                                        Batch / Lot Number <span className="text-red-500">*</span>
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setNewBatch((prev) => ({ ...prev, batch_number: generateBatchNo() }))}
                                        className="text-[10px] text-purple-700 font-bold hover:underline"
                                    >
                                        ⚡ Auto-Generate
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    value={newBatch.batch_number}
                                    onChange={(e) => setNewBatch({ ...newBatch, batch_number: e.target.value.toUpperCase() })}
                                    placeholder="e.g. LOT-2026-X88"
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-bold text-purple-900 outline-none focus:border-purple-500 uppercase"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                                    Quantity Received <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    value={newBatch.quantity || ''}
                                    onChange={(e) => setNewBatch({ ...newBatch, quantity: Math.max(0, parseInt(e.target.value) || 0) })}
                                    placeholder="Number of units received"
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-extrabold text-gray-900 outline-none focus:border-emerald-500"
                                />
                            </div>
                        </div>

                        {/* Step 3: Dates & Quick Expiry Chips */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                                    Manufacture Date
                                </label>
                                <input
                                    type="date"
                                    value={newBatch.manufacture_date}
                                    onChange={(e) => setNewBatch({ ...newBatch, manufacture_date: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 outline-none focus:border-emerald-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                                    Expiry Date <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    value={newBatch.expiry_date}
                                    onChange={(e) => setNewBatch({ ...newBatch, expiry_date: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 outline-none focus:border-emerald-500"
                                />
                                {/* Quick Expiry Presets */}
                                <div className="flex items-center gap-1 mt-1.5 overflow-x-auto pb-0.5">
                                    <span className="text-[10px] text-gray-400 font-bold mr-1 shrink-0">Preset:</span>
                                    {[
                                        { label: '+6M', m: 6 },
                                        { label: '+1Y', m: 12 },
                                        { label: '+2Y', m: 24 },
                                        { label: '+3Y', m: 36 },
                                        { label: '+5Y', m: 60 },
                                    ].map((chip) => (
                                        <button
                                            key={chip.label}
                                            type="button"
                                            onClick={() => setQuickExpiry(chip.m)}
                                            className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-[9.5px] font-bold"
                                        >
                                            {chip.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Step 4: Unit Purchase Cost & Selling Price + Live Financial Engine */}
                        <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
                            <h4 className="text-xs font-black text-gray-800 uppercase tracking-wider flex items-center justify-between">
                                <span>💰 Batch Pricing &amp; Margin Valuation Engine</span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${batchFinancials.marginPct >= 30 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                    {batchFinancials.marginPct.toFixed(1)}% Margin
                                </span>
                            </h4>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-600 mb-1">
                                        Unit Purchase Cost (Ksh)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={newBatch.purchase_cost || ''}
                                        onChange={(e) => setNewBatch({ ...newBatch, purchase_cost: parseFloat(e.target.value) || 0 })}
                                        placeholder="Cost to buy 1 unit"
                                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-900 outline-none focus:border-emerald-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-gray-600 mb-1">
                                        Unit Selling Price (Ksh)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={newBatch.selling_price || ''}
                                        onChange={(e) => setNewBatch({ ...newBatch, selling_price: parseFloat(e.target.value) || 0 })}
                                        placeholder="Retail price per unit"
                                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-extrabold text-emerald-700 outline-none focus:border-emerald-500"
                                    />
                                </div>
                            </div>

                            {/* Live Calculations Strip */}
                            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-200 text-center text-xs">
                                <div className="p-2 bg-white rounded-xl border border-gray-100">
                                    <span className="text-gray-400 text-[10px] font-bold block uppercase">Total Batch Cost</span>
                                    <span className="font-extrabold text-red-600">Ksh {batchFinancials.totalBatchCost.toLocaleString()}</span>
                                </div>
                                <div className="p-2 bg-white rounded-xl border border-gray-100">
                                    <span className="text-gray-400 text-[10px] font-bold block uppercase">Total Batch Retail</span>
                                    <span className="font-extrabold text-emerald-700">Ksh {batchFinancials.totalBatchRetail.toLocaleString()}</span>
                                </div>
                                <div className="p-2 bg-white rounded-xl border border-gray-100">
                                    <span className="text-gray-400 text-[10px] font-bold block uppercase">Projected Profit</span>
                                    <span className="font-extrabold text-indigo-700">Ksh {batchFinancials.projectedProfit.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        {/* Step 5: Supplier & Invoice Reference */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                                    Supplier / Distributor
                                </label>
                                <div className="flex gap-1.5">
                                    <input
                                        type="text"
                                        value={newBatch.supplier_name}
                                        onChange={(e) => setNewBatch({ ...newBatch, supplier_name: e.target.value })}
                                        placeholder="e.g. Meds Wholesale Ltd"
                                        className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 outline-none focus:border-emerald-500"
                                    />
                                    {suppliers.length > 0 && (
                                        <select
                                            onChange={(e) => setNewBatch({ ...newBatch, supplier_name: e.target.value })}
                                            className="px-2 py-2 bg-gray-100 border border-gray-200 rounded-xl text-xs font-bold cursor-pointer text-gray-700"
                                            title="Pick from registered suppliers"
                                        >
                                            <option value="">Choose</option>
                                            {suppliers.map((s) => (
                                                <option key={s.supplier_id} value={s.supplier_name}>{s.supplier_name}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                                    Purchase Invoice / Delivery Note #
                                </label>
                                <input
                                    type="text"
                                    value={newBatch.purchase_invoice}
                                    onChange={(e) => setNewBatch({ ...newBatch, purchase_invoice: e.target.value })}
                                    placeholder="e.g. INV-90421"
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 outline-none focus:border-emerald-500"
                                />
                            </div>
                        </div>

                        {/* Step 6: Notes */}
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                                Internal Notes / Shelf Location
                            </label>
                            <input
                                type="text"
                                value={newBatch.notes}
                                onChange={(e) => setNewBatch({ ...newBatch, notes: e.target.value })}
                                placeholder="Shelf A2, room temp 15-25°C, verified with seal intact..."
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 outline-none focus:border-emerald-500"
                            />
                        </div>

                        {/* Modal Action Buttons */}
                        <div className="flex gap-2.5 pt-3 border-t border-gray-100">
                            <button
                                type="button"
                                onClick={() => setShowNewModal(false)}
                                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveNewBatch}
                                disabled={isSaving}
                                className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 active:scale-98 disabled:opacity-50"
                            >
                                {isSaving ? 'Registering...' : '✅ Save Batch to Inventory'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* =====================================================================
                EDIT BATCH MODAL
            ===================================================================== */}
            {showEditModal && editBatch && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-gray-100 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                            <div>
                                <h3 className="text-base font-bold text-gray-900">✏️ Edit Batch Particulars</h3>
                                <p className="text-xs text-gray-500">{editBatch.product_name}</p>
                            </div>
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-400 flex items-center justify-center font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-3 text-xs">
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-gray-600 font-bold mb-1">Batch Number</label>
                                    <input
                                        type="text"
                                        value={editBatch.batch_number}
                                        onChange={(e) => setEditBatch({ ...editBatch, batch_number: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-50 border rounded-xl font-mono font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="block text-gray-600 font-bold mb-1">Status</label>
                                    <select
                                        value={editBatch.status}
                                        onChange={(e) => setEditBatch({ ...editBatch, status: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-50 border rounded-xl font-semibold"
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Quarantine">Quarantine</option>
                                        <option value="Disposed">Disposed</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-gray-600 font-bold mb-1">Expiry Date</label>
                                    <input
                                        type="date"
                                        value={editBatch.expiry_date}
                                        onChange={(e) => setEditBatch({ ...editBatch, expiry_date: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-50 border rounded-xl font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="block text-gray-600 font-bold mb-1">Manufacture Date</label>
                                    <input
                                        type="date"
                                        value={editBatch.manufacture_date}
                                        onChange={(e) => setEditBatch({ ...editBatch, manufacture_date: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-50 border rounded-xl"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-gray-600 font-bold mb-1">Purchase Cost (Ksh)</label>
                                    <input
                                        type="number"
                                        value={editBatch.purchase_cost}
                                        onChange={(e) => setEditBatch({ ...editBatch, purchase_cost: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 bg-gray-50 border rounded-xl font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="block text-gray-600 font-bold mb-1">Selling Price (Ksh)</label>
                                    <input
                                        type="number"
                                        value={editBatch.selling_price}
                                        onChange={(e) => setEditBatch({ ...editBatch, selling_price: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 bg-gray-50 border rounded-xl font-bold text-emerald-700"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-gray-600 font-bold mb-1">Supplier Name</label>
                                <input
                                    type="text"
                                    value={editBatch.supplier_name}
                                    onChange={(e) => setEditBatch({ ...editBatch, supplier_name: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-50 border rounded-xl"
                                />
                            </div>

                            <div>
                                <label className="block text-gray-600 font-bold mb-1">Notes / Audit Remarks</label>
                                <textarea
                                    value={editBatch.notes || ''}
                                    onChange={(e) => setEditBatch({ ...editBatch, notes: e.target.value })}
                                    rows={2}
                                    className="w-full px-3 py-2 bg-gray-50 border rounded-xl"
                                />
                            </div>
                        </div>

                        <div className="flex gap-2 pt-2 border-t border-gray-100">
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveEditBatch}
                                disabled={isSaving}
                                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm"
                            >
                                {isSaving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* =====================================================================
                RECONCILE / PHYSICAL STOCK COUNT MODAL
            ===================================================================== */}
            {showAdjustModal && adjustBatch && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-gray-100 space-y-3.5">
                        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                                <span>⚖️</span> Reconcile Physical Stock
                            </h3>
                            <button
                                onClick={() => setShowAdjustModal(false)}
                                className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-400 flex items-center justify-center font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                            <p className="font-bold">{adjustBatch.product_name} [Batch: {adjustBatch.batch_number}]</p>
                            <p className="mt-0.5">Current system record: <strong className="text-amber-950 font-black">{adjustBatch.remaining_qty} {adjustBatch.sales_unit}</strong></p>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">
                                Actual Counted Physical Quantity
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={adjustNewQty}
                                onChange={(e) => setAdjustNewQty(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-extrabold text-gray-900 outline-none focus:border-amber-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">
                                Adjustment Reason
                            </label>
                            <select
                                value={adjustReason}
                                onChange={(e) => setAdjustReason(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800"
                            >
                                <option value="Physical Count Audit">Physical Audit Discrepancy</option>
                                <option value="Damaged / Breakage">Damaged / Ampoule Broken</option>
                                <option value="Supplier Return">Supplier Return / Credit</option>
                                <option value="Found Unrecorded Stock">Found Unrecorded Stock</option>
                                <option value="Dispense Correction">Dispense Correction</option>
                            </select>
                        </div>

                        <div className="flex gap-2 pt-2 border-t border-gray-100">
                            <button
                                onClick={() => setShowAdjustModal(false)}
                                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleExecuteAdjustment}
                                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm"
                            >
                                Confirm Reconcile
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* =====================================================================
                BATCH DETAIL DRAWER
            ===================================================================== */}
            {detailBatch && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-end z-50">
                    <div className="bg-white h-full w-full max-w-md shadow-2xl p-6 overflow-y-auto space-y-4 animate-in slide-in-from-right">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                            <div>
                                <h3 className="text-base font-bold text-gray-900">Batch Inventory Sheet</h3>
                                <p className="text-xs text-gray-500">Lot ID #{detailBatch.batch_id} • Outlet: {outletName}</p>
                            </div>
                            <button
                                onClick={() => setDetailBatch(null)}
                                className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-400 flex items-center justify-center font-bold text-sm"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-4 bg-emerald-50/70 border border-emerald-100 rounded-2xl">
                            <h4 className="font-extrabold text-emerald-950 text-sm">{detailBatch.product_name}</h4>
                            {detailBatch.generic_name && (
                                <p className="text-xs text-emerald-700 italic mt-0.5">{detailBatch.generic_name}</p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">
                                    {detailBatch.category}
                                </span>
                                <span className="px-2 py-0.5 bg-white text-gray-700 border border-emerald-200 rounded text-[10px] font-bold">
                                    {detailBatch.drug_type || 'Medicine'}
                                </span>
                                {detailBatch.dosage && (
                                    <span className="px-2 py-0.5 bg-white text-gray-700 border border-emerald-200 rounded text-[10px] font-bold">
                                        {detailBatch.dosage}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                <span className="text-gray-400 block text-[10px] font-bold uppercase">Batch Number</span>
                                <span className="font-mono font-bold text-purple-800 text-sm">{detailBatch.batch_number}</span>
                            </div>
                            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                <span className="text-gray-400 block text-[10px] font-bold uppercase">Status</span>
                                <span className="font-bold text-gray-900">{detailBatch.status}</span>
                            </div>
                            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                <span className="text-gray-400 block text-[10px] font-bold uppercase">Expiry Date</span>
                                <span className="font-bold text-gray-900">{formatDate(detailBatch.expiry_date)}</span>
                            </div>
                            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                <span className="text-gray-400 block text-[10px] font-bold uppercase">Manufacture Date</span>
                                <span className="font-semibold text-gray-700">{formatDate(detailBatch.manufacture_date)}</span>
                            </div>
                        </div>

                        <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100 space-y-2 text-xs">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Days to Expiry:</span>
                                <span>{getBatchBadge(getDaysUntil(detailBatch.expiry_date), detailBatch.remaining_qty, detailBatch.status)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Stock Balance:</span>
                                <span className="font-extrabold text-gray-900">
                                    {detailBatch.remaining_qty} / {detailBatch.quantity} {detailBatch.sales_unit}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Unit Purchase Cost:</span>
                                <span className="font-semibold text-gray-700">Ksh {detailBatch.purchase_cost.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Unit Selling Price:</span>
                                <span className="font-bold text-emerald-700">Ksh {detailBatch.selling_price.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between border-t border-gray-200 pt-2 font-bold">
                                <span className="text-gray-700">Total Stock Retail Value:</span>
                                <span className="text-emerald-700 font-black">
                                    Ksh {(detailBatch.selling_price * detailBatch.remaining_qty).toLocaleString()}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-1 text-xs">
                            <span className="text-gray-400 block text-[10px] font-bold uppercase">Supplier / Vendor</span>
                            <p className="font-semibold text-gray-800">{detailBatch.supplier_name || 'Direct Procurement'}</p>
                            {detailBatch.purchase_invoice && (
                                <p className="text-gray-500 text-[11px]">Invoice / Delivery Note: {detailBatch.purchase_invoice}</p>
                            )}
                        </div>

                        {detailBatch.notes && (
                            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-xs text-yellow-900">
                                <span className="font-bold block text-[10px] uppercase">Batch Notes</span>
                                <p className="mt-0.5">{detailBatch.notes}</p>
                            </div>
                        )}

                        <div className="pt-4 border-t border-gray-100 flex gap-2">
                            <button
                                onClick={() => {
                                    setEditBatch({ ...detailBatch });
                                    setDetailBatch(null);
                                    setShowEditModal(true);
                                }}
                                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                            >
                                Edit Particulars
                            </button>
                            <button
                                onClick={() => {
                                    setAdjustBatch(detailBatch);
                                    setAdjustNewQty(detailBatch.remaining_qty.toString());
                                    setDetailBatch(null);
                                    setShowAdjustModal(true);
                                }}
                                className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                            >
                                Reconcile Stock
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
