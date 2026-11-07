'use client';

// =====================================================================
// Alpha Pharmacy - Super Ultra Massive Sales Return & Restocking Hub v5.2
// Live Database Sync, Auto-Populated Receipts Engine, Smart Itemization & Restocking,
// Full Executive Pagination, High-Contrast Dark Headers, Super Premium Light Cards,
// Return Reasons Analytics, Super Styled Excel (.xls), Official Credit Note Slip & PDF Audit
// =====================================================================

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import { useCompanyName } from '@/context/SettingsContext';
import toast from 'react-hot-toast';

export interface SalesReturn {
    return_id: number;
    return_no: string;
    return_date: string;
    original_sale_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    total_amount: number;
    total?: number;
    reason: string;
    status: string;
    processed_by: string;
    created_at?: string;
    outlet_id?: number;
}

export interface SaleLookup {
    sale_id: number | null;
    receipt_no: string;
    sale_datetime: string;
    customer_name: string;
    customer_phone: string;
    total: number;
    payment_method: string;
    source: 'pharmacy' | 'retail';
}

export interface SaleItemLookup {
    item_id: number;
    sale_id: number | null;
    product_id: number;
    product_name: string;
    batch_id?: number;
    batch_number?: string;
    quantity: number;
    unit_price: number;
    selling_unit?: string;
}

export interface ProductCatalogItem {
    pid: number;
    product_name: string;
    sales_cost: number;
    purchase_cost: number;
    sales_unit: string;
    category: string;
}

// ==================== REUSABLE EXECUTIVE PAGINATION FOOTER ====================
function PaginationFooter({
    currentPage,
    totalItems,
    pageSize,
    onPageChange,
    onPageSizeChange,
    itemLabel = 'items',
}: {
    currentPage: number;
    totalItems: number;
    pageSize: number;
    onPageChange: (p: number) => void;
    onPageSizeChange: (s: number) => void;
    itemLabel?: string;
}) {
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const startIdx = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const endIdx = Math.min(totalItems, currentPage * pageSize);

    const getPageNumbers = () => {
        const pages: (number | string)[] = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            if (currentPage > 3) pages.push('...');
            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);
            for (let i = start; i <= end; i++) pages.push(i);
            if (currentPage < totalPages - 2) pages.push('...');
            pages.push(totalPages);
        }
        return pages;
    };

    return (
        <div className="p-4 border-t border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-semibold text-slate-600">
            <div className="flex items-center gap-3 flex-wrap">
                <span className="text-slate-500 font-bold">Rows per page:</span>
                <select
                    value={pageSize}
                    onChange={(e) => {
                        onPageSizeChange(Number(e.target.value));
                        onPageChange(1);
                    }}
                    className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-800 shadow-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                    {[10, 25, 50, 100].map((n) => (
                        <option key={n} value={n}>{n}</option>
                    ))}
                </select>
                <span className="text-slate-300">|</span>
                <span className="text-slate-700">
                    Showing <strong className="text-slate-900 font-mono">{startIdx}</strong> - <strong className="text-slate-900 font-mono">{endIdx}</strong> of <strong className="text-emerald-700 font-mono font-extrabold">{totalItems}</strong> {itemLabel}
                </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
                <button
                    onClick={() => onPageChange(1)}
                    disabled={currentPage === 1}
                    title="First Page"
                    className="px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed shadow-xs transition-colors font-mono font-bold"
                >
                    «
                </button>
                <button
                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    title="Previous Page"
                    className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed shadow-xs transition-colors font-bold"
                >
                    ‹ Prev
                </button>

                <div className="hidden sm:flex items-center gap-1">
                    {getPageNumbers().map((num, i) => {
                        if (num === '...') {
                            return <span key={`dots-${i}`} className="px-2 text-slate-400 font-mono">...</span>;
                        }
                        const pNum = Number(num);
                        const isActive = pNum === currentPage;
                        return (
                            <button
                                key={pNum}
                                onClick={() => onPageChange(pNum)}
                                className={`w-8 h-8 rounded-xl font-mono text-xs font-bold transition-all ${
                                    isActive
                                        ? 'bg-slate-900 text-white shadow-sm'
                                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                                }`}
                            >
                                {pNum}
                            </button>
                        );
                    })}
                </div>

                <span className="sm:hidden px-2 font-mono font-bold text-slate-800">
                    {currentPage} / {totalPages}
                </span>

                <button
                    onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage >= totalPages}
                    title="Next Page"
                    className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed shadow-xs transition-colors font-bold"
                >
                    Next ›
                </button>
                <button
                    onClick={() => onPageChange(totalPages)}
                    disabled={currentPage >= totalPages}
                    title="Last Page"
                    className="px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed shadow-xs transition-colors font-mono font-bold"
                >
                    »
                </button>
            </div>
        </div>
    );
}

export default function SalesReturnPage() {
    const { activeOutlet } = useOutlet();
    const outletId = activeOutlet?.outlet_id || 1;
    const outletName = activeOutlet?.outlet_name || 'Alpha Pharmacy Main Store';
    const companyName = useCompanyName() || 'Alpha Pharmacy';

    // Core Data State
    const [returns, setReturns] = useState<SalesReturn[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [lastSyncTime, setLastSyncTime] = useState<string>('');

    // Filters & Search
    const [searchQuery, setSearchQuery] = useState('');
    const [filterReason, setFilterReason] = useState('All');
    const [filterStatus, setFilterStatus] = useState('All');
    type DateHorizon = 'all' | 'today' | 'yesterday' | 'week' | 'month';
    const [dateHorizon, setDateHorizon] = useState<DateHorizon>('all');

    // Tabs
    const [activeTab, setActiveTab] = useState<'all' | 'completed' | 'pending' | 'reasons' | 'financials'>('all');

    // Selection & Pagination
    const [selectedReturnIds, setSelectedReturnIds] = useState<Set<number>>(new Set());
    const [pageSize, setPageSize] = useState<number>(25);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [expandedReturnId, setExpandedReturnId] = useState<number | null>(null);

    // Return Modal State
    const [showModal, setShowModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [intakeMode, setIntakeMode] = useState<'receipt' | 'manual'>('receipt');

    // Auto-Populated Receipt Lookup in Modal
    const [availableSales, setAvailableSales] = useState<SaleLookup[]>([]);
    const [receiptSearchTerm, setReceiptSearchTerm] = useState('');
    const [isSearchingReceipts, setIsSearchingReceipts] = useState(false);
    const [selectedSale, setSelectedSale] = useState<SaleLookup | null>(null);
    const [saleItems, setSaleItems] = useState<SaleItemLookup[]>([]);
    const [isLoadingItems, setIsLoadingItems] = useState(false);
    const [selectedSaleItem, setSelectedSaleItem] = useState<SaleItemLookup | null>(null);

    // OTC Product Catalog Lookup
    const [catalogProducts, setCatalogProducts] = useState<ProductCatalogItem[]>([]);
    const [productSearchTerm, setProductSearchTerm] = useState('');

    // Modal Form Data
    const [formData, setFormData] = useState({
        original_sale_id: '',
        product_name: '',
        product_id: 0,
        batch_id: 0,
        batch_number: '',
        quantity: 1,
        max_quantity: 999,
        unit_price: 0,
        reason: 'Wrong Medication Dispensed',
        refund_method: 'Cash from Register',
        restock_inventory: true,
        quarantine_defective: false,
        pharmacist_notes: '',
    });

    // Credit Note Voucher Modal
    const [showVoucherModal, setShowVoucherModal] = useState(false);
    const [voucherReturn, setVoucherReturn] = useState<SalesReturn | null>(null);

    // ==================== 1. LOAD SALES RETURNS FROM DATABASE ====================
    const loadReturns = useCallback(async () => {
        setIsLoading(true);
        try {
            let res = await supabase
                .from('sales_returns')
                .select('*')
                .order('return_id', { ascending: false });

            if (res.error) {
                console.warn('Initial sales_returns order query error, trying fallback:', res.error);
                res = await supabase.from('sales_returns').select('*');
            }

            if (res.data) {
                setReturns(res.data);
                try {
                    setLastSyncTime(new Date().toLocaleTimeString());
                } catch {
                    setLastSyncTime(new Date().toTimeString().split(' ')[0]);
                }
            } else if (res.error) {
                console.error('Failed to load sales returns:', res.error);
                toast.error(res.error.message || 'Could not sync sales returns');
            }
        } catch (err: any) {
            console.error('Unexpected error loading sales returns:', err);
            toast.error(err?.message || 'Error communicating with database');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // 2. Realtime Database Subscription
    useEffect(() => {
        loadReturns();

        const channel = supabase
            .channel('sales_returns_realtime_stream')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'sales_returns' },
                () => {
                    loadReturns();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [loadReturns]);

    // 3. Preload Drug Catalog for OTC Returns
    useEffect(() => {
        const loadCatalog = async () => {
            try {
                let prods: any[] = [];
                const { data: pharmProds } = await supabase
                    .from('pharmacy_products')
                    .select('pid, product_name, sales_cost, purchase_cost, sales_unit, category')
                    .limit(200);

                if (pharmProds && pharmProds.length > 0) {
                    prods = pharmProds;
                } else {
                    const { data: retProds } = await supabase
                        .from('retail_products')
                        .select('pid, product_name, sales_cost, purchase_cost, sales_unit, category')
                        .limit(200);
                    if (retProds) prods = retProds;
                }

                setCatalogProducts(
                    prods.map((p) => ({
                        pid: p.pid,
                        product_name: p.product_name,
                        sales_cost: Number(p.sales_cost) || 0,
                        purchase_cost: Number(p.purchase_cost) || 0,
                        sales_unit: p.sales_unit || 'Piece',
                        category: p.category || 'General',
                    }))
                );
            } catch (e) {
                console.warn('Error preloading product catalog:', e);
            }
        };
        loadCatalog();
    }, []);

    // ==================== 4. AUTO-POPULATE SALES RECEIPTS ENGINE ====================
    // Fetches all recent receipts from pharmacy_sales & retail_sales automatically on modal open
    const loadRecentReceipts = useCallback(async () => {
        setIsSearchingReceipts(true);
        try {
            // Step A: Fetch pharmacy_sales
            const { data: pSales } = await supabase
                .from('pharmacy_sales')
                .select('sale_id, receipt_no, sale_datetime, customer_name, customer_phone, total, payment_method, cashier_name')
                .order('sale_datetime', { ascending: false })
                .limit(25);

            // Step B: Fetch retail_sales
            const { data: rSales } = await supabase
                .from('retail_sales')
                .select('sale_id, receipt_no, sale_date, sale_datetime, customer_name, customer_phone, total_amount, payment_method')
                .order('sale_date', { ascending: false })
                .limit(25);

            const combined: SaleLookup[] = [
                ...(pSales || []).map((s: any) => ({
                    sale_id: s.sale_id,
                    receipt_no: s.receipt_no,
                    sale_datetime: s.sale_datetime || '',
                    customer_name: s.customer_name || 'Walk-in Patient',
                    customer_phone: s.customer_phone || '',
                    total: Number(s.total) || 0,
                    payment_method: s.payment_method || 'CASH',
                    source: 'pharmacy' as const,
                })),
                ...(rSales || []).map((s: any) => ({
                    sale_id: s.sale_id,
                    receipt_no: s.receipt_no,
                    sale_datetime: s.sale_datetime || s.sale_date || '',
                    customer_name: s.customer_name || 'Walk-in Customer',
                    customer_phone: s.customer_phone || '',
                    total: Number(s.total_amount) || 0,
                    payment_method: s.payment_method || 'CASH',
                    source: 'retail' as const,
                })),
            ];

            // Deduplicate by receipt_no
            const seen = new Set<string>();
            const unique: SaleLookup[] = [];
            combined.forEach((s) => {
                if (s.receipt_no && !seen.has(s.receipt_no)) {
                    seen.add(s.receipt_no);
                    unique.push(s);
                }
            });

            setAvailableSales(unique);

            // Auto-select the first recent sale immediately so modal is 100% auto-populated!
            if (unique.length > 0 && !selectedSale) {
                handleSelectSale(unique[0]);
            }
        } catch (err) {
            console.error('Error preloading receipts:', err);
        } finally {
            setIsSearchingReceipts(false);
        }
    }, [selectedSale]);

    // When modal opens, immediately auto-populate receipts
    useEffect(() => {
        if (showModal && intakeMode === 'receipt' && availableSales.length === 0) {
            loadRecentReceipts();
        }
    }, [showModal, intakeMode, availableSales.length, loadRecentReceipts]);

    // Filter available receipts by search input in real time
    const filteredAvailableSales = useMemo(() => {
        if (!receiptSearchTerm.trim()) return availableSales;
        const q = receiptSearchTerm.toLowerCase().trim();
        return availableSales.filter(
            (s) =>
                s.receipt_no.toLowerCase().includes(q) ||
                s.customer_name.toLowerCase().includes(q) ||
                s.customer_phone.includes(q)
        );
    }, [availableSales, receiptSearchTerm]);

    // 5. Select Sale Receipt & Auto-Fetch Sold Line Items
    const handleSelectSale = async (sale: SaleLookup) => {
        setSelectedSale(sale);
        setIsLoadingItems(true);
        setSelectedSaleItem(null);
        setSaleItems([]);

        try {
            let itemsFound: SaleItemLookup[] = [];

            // Try retail_sales_items first
            if (sale.sale_id) {
                const { data: rItems } = await supabase
                    .from('retail_sales_items')
                    .select('*')
                    .eq('sale_id', sale.sale_id);

                if (rItems && rItems.length > 0) {
                    itemsFound = rItems.map((itm: any) => ({
                        item_id: itm.item_id,
                        sale_id: sale.sale_id,
                        product_id: itm.product_id,
                        product_name: itm.product_name,
                        batch_id: itm.batch_id || 0,
                        batch_number: itm.barcode || '',
                        quantity: Number(itm.quantity) || 1,
                        unit_price: Number(itm.unit_price) || 0,
                        selling_unit: 'Piece',
                    }));
                }
            }

            // Fallback: Check pharmacy_sales_items if retail_sales_items was empty
            if (itemsFound.length === 0 && sale.sale_id) {
                try {
                    const { data: pItems } = await supabase
                        .from('pharmacy_sales_items')
                        .select('*')
                        .eq('sale_id', sale.sale_id);

                    if (pItems && pItems.length > 0) {
                        itemsFound = pItems.map((itm: any) => ({
                            item_id: itm.item_id,
                            sale_id: sale.sale_id,
                            product_id: itm.product_id,
                            product_name: itm.product_name,
                            batch_id: itm.batch_id || 0,
                            batch_number: itm.batch_number || '',
                            quantity: Number(itm.quantity) || 1,
                            unit_price: Number(itm.unit_price) || 0,
                            selling_unit: 'Piece',
                        }));
                    }
                } catch { /* silent */ }
            }

            // If still no items, synthesize line item from sale total
            if (itemsFound.length === 0) {
                itemsFound = [
                    {
                        item_id: sale.sale_id || 1,
                        sale_id: sale.sale_id,
                        product_id: 1,
                        product_name: `Prescription Items on ${sale.receipt_no}`,
                        quantity: 1,
                        unit_price: sale.total,
                        selling_unit: 'Batch / Receipt Items',
                    },
                ];
            }

            setSaleItems(itemsFound);

            // Auto-populate form with first item
            if (itemsFound.length > 0) {
                handleSelectSaleItem(itemsFound[0], sale);
            }
        } catch (err) {
            console.error('Error fetching line items for receipt:', err);
            toast.error('Could not load receipt items');
        } finally {
            setIsLoadingItems(false);
        }
    };

    // 6. Select Sold Line Item & Auto-Populate Form
    const handleSelectSaleItem = (item: SaleItemLookup, saleOverride?: SaleLookup) => {
        const sale = saleOverride || selectedSale;
        setSelectedSaleItem(item);
        setFormData((prev) => ({
            ...prev,
            original_sale_id: sale ? sale.receipt_no : prev.original_sale_id,
            product_name: item.product_name,
            product_id: item.product_id,
            batch_id: item.batch_id || 0,
            batch_number: item.batch_number || '',
            unit_price: Number(item.unit_price) || 0,
            quantity: 1,
            max_quantity: Number(item.quantity) || 1,
        }));
    };

    // 7. Reset Form
    const resetModalForm = () => {
        setSelectedSale(null);
        setSaleItems([]);
        setSelectedSaleItem(null);
        setReceiptSearchTerm('');
        setProductSearchTerm('');
        setFormData({
            original_sale_id: '',
            product_name: '',
            product_id: 0,
            batch_id: 0,
            batch_number: '',
            quantity: 1,
            max_quantity: 999,
            unit_price: 0,
            reason: 'Wrong Medication Dispensed',
            refund_method: 'Cash from Register',
            restock_inventory: true,
            quarantine_defective: false,
            pharmacist_notes: '',
        });
    };

    // 8. Generate Return Number (SR-XXXX)
    const generateReturnNo = async (): Promise<string> => {
        try {
            const { data } = await supabase
                .from('sales_returns')
                .select('return_no')
                .order('return_id', { ascending: false })
                .limit(1);

            if (data && data.length > 0 && data[0].return_no) {
                const match = data[0].return_no.match(/SR-(d+)/);
                if (match) {
                    const nextNum = parseInt(match[1], 10) + 1;
                    return `SR-${String(nextNum).padStart(4, '0')}`;
                }
            }
        } catch (e) {
            console.warn('Error reading return_no sequence:', e);
        }
        return 'SR-0006';
    };

    // 9. Save Return
    const handleSaveReturn = async () => {
        if (!formData.product_name.trim()) {
            toast.error('Please select or specify the returned drug name');
            return;
        }
        if (formData.quantity <= 0) {
            toast.error('Quantity must be greater than zero');
            return;
        }
        if (formData.quantity > formData.max_quantity) {
            toast.error(`Quantity cannot exceed original sold amount (${formData.max_quantity})`);
            return;
        }

        setIsSaving(true);
        try {
            const returnNo = await generateReturnNo();
            const totalRefund = formData.quantity * formData.unit_price;
            const todayStr = new Date().toISOString().split('T')[0];

            const returnPayload = {
                return_no: returnNo,
                return_date: todayStr,
                original_sale_id: formData.original_sale_id || (selectedSale ? selectedSale.receipt_no : 'OTC-DIRECT'),
                product_name: formData.product_name,
                quantity: formData.quantity,
                unit_price: formData.unit_price,
                total_amount: totalRefund,
                reason: formData.reason,
                status: formData.quarantine_defective ? 'Quarantined' : 'Completed',
                processed_by: 'Super Admin',
            };

            const { data: inserted, error: insErr } = await supabase
                .from('sales_returns')
                .insert([returnPayload])
                .select()
                .single();

            if (insErr) throw insErr;

            // Restock to batch & inventory if requested
            if (formData.restock_inventory && !formData.quarantine_defective) {
                try {
                    // Update batch remaining_qty if batch_id provided
                    if (formData.batch_id > 0) {
                        const { data: bRow } = await supabase
                            .from('pharmacy_batches')
                            .select('remaining_qty')
                            .eq('batch_id', formData.batch_id)
                            .single();
                        if (bRow) {
                            await supabase
                                .from('pharmacy_batches')
                                .update({ remaining_qty: (bRow.remaining_qty || 0) + formData.quantity })
                                .eq('batch_id', formData.batch_id);
                        }
                    }

                    // Update pharmacy_stock
                    if (formData.product_id > 0) {
                        const { data: sRow } = await supabase
                            .from('pharmacy_stock')
                            .select('st_id, qty')
                            .eq('pid', formData.product_id)
                            .eq('outlet_id', outletId)
                            .limit(1)
                            .maybeSingle();
                        if (sRow) {
                            await supabase
                                .from('pharmacy_stock')
                                .update({ qty: (sRow.qty || 0) + formData.quantity })
                                .eq('st_id', sRow.st_id);
                        }
                    }
                } catch (stockErr) {
                    console.warn('Stock restock notice:', stockErr);
                }
            }

            toast.success(`Return ${returnNo} authorized! KES ${totalRefund.toLocaleString()} processed.`);
            setShowModal(false);
            resetModalForm();
            loadReturns();

            // Open credit note slip for printing
            if (inserted) {
                setVoucherReturn(inserted);
                setShowVoucherModal(true);
            }
        } catch (err: any) {
            console.error('Error authorizing return:', err);
            toast.error(err.message || 'Failed to save return record');
        } finally {
            setIsSaving(false);
        }
    };

    // ==================== FILTERING & METRICS ====================
    const filteredReturns = useMemo(() => {
        return returns.filter((r) => {
            const q = searchQuery.toLowerCase().trim();
            const matchesSearch =
                !q ||
                (r.return_no || '').toLowerCase().includes(q) ||
                (r.original_sale_id || '').toLowerCase().includes(q) ||
                (r.product_name || '').toLowerCase().includes(q) ||
                (r.reason || '').toLowerCase().includes(q) ||
                (r.processed_by || '').toLowerCase().includes(q);

            let matchesReason = true;
            if (filterReason !== 'All') {
                matchesReason = (r.reason || '').toLowerCase() === filterReason.toLowerCase();
            }

            let matchesStatus = true;
            if (filterStatus !== 'All') {
                matchesStatus = (r.status || '').toLowerCase() === filterStatus.toLowerCase();
            }

            let matchesTab = true;
            if (activeTab === 'completed') matchesTab = (r.status || '').toLowerCase() === 'completed';
            if (activeTab === 'pending') matchesTab = (r.status || '').toLowerCase() === 'pending' || (r.status || '').toLowerCase() === 'quarantined';

            let matchesHorizon = true;
            if (dateHorizon !== 'all' && r.return_date) {
                const today = new Date().toISOString().split('T')[0];
                const rDate = r.return_date.split('T')[0];
                if (dateHorizon === 'today') matchesHorizon = rDate === today;
                else if (dateHorizon === 'yesterday') {
                    const y = new Date();
                    y.setDate(y.getDate() - 1);
                    matchesHorizon = rDate === y.toISOString().split('T')[0];
                } else if (dateHorizon === 'week') {
                    const d = new Date();
                    d.setDate(d.getDate() - 7);
                    matchesHorizon = rDate >= d.toISOString().split('T')[0];
                } else if (dateHorizon === 'month') {
                    const d = new Date();
                    d.setDate(1);
                    matchesHorizon = rDate >= d.toISOString().split('T')[0];
                }
            }

            return matchesSearch && matchesReason && matchesStatus && matchesTab && matchesHorizon;
        });
    }, [returns, searchQuery, filterReason, filterStatus, activeTab, dateHorizon]);

    // Paginated slice
    const paginatedReturns = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredReturns.slice(start, start + pageSize);
    }, [filteredReturns, currentPage, pageSize]);

    // Summary Metrics
    const metrics = useMemo(() => {
        let totalRefund = 0;
        let restockedCount = 0;
        let quarantinedCount = 0;
        const reasonsMap: Record<string, number> = {};

        returns.forEach((r) => {
            const amount = Number(r.total_amount ?? r.total ?? (r.quantity * r.unit_price)) || 0;
            totalRefund += amount;

            const st = (r.status || '').toLowerCase();
            if (st === 'completed') restockedCount += r.quantity || 1;
            else if (st === 'quarantined' || st === 'pending') quarantinedCount += r.quantity || 1;

            const rsn = r.reason || 'Customer Request';
            reasonsMap[rsn] = (reasonsMap[rsn] || 0) + 1;
        });

        let primaryReason = 'None Recorded';
        let maxReasonCount = 0;
        Object.entries(reasonsMap).forEach(([rsn, count]) => {
            if (count > maxReasonCount) {
                maxReasonCount = count;
                primaryReason = rsn;
            }
        });

        return {
            totalReturns: returns.length,
            totalRefund,
            restockedCount,
            quarantinedCount,
            primaryReason,
            maxReasonCount,
            reasonsList: Object.entries(reasonsMap).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
        };
    }, [returns]);

    // Selection Handlers
    const toggleSelectAll = () => {
        if (selectedReturnIds.size === paginatedReturns.length && paginatedReturns.length > 0) {
            setSelectedReturnIds(new Set());
        } else {
            setSelectedReturnIds(new Set(paginatedReturns.map((r) => r.return_id)));
        }
    };

    const toggleSelectOne = (id: number) => {
        const next = new Set(selectedReturnIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedReturnIds(next);
    };

    // Open Credit Note Slip
    const viewCreditNote = (ret: SalesReturn) => {
        setVoucherReturn(ret);
        setShowVoucherModal(true);
    };

    // Export to Excel
    const exportToSuperExcel = () => {
        if (filteredReturns.length === 0) {
            toast.error('No return records to export');
            return;
        }

        const now = new Date();
        const exportDate = now.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });

        const xmlString = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Header">
   <Font ss:Bold="1" ss:Color="#FFFFFF" ss:Size="11"/>
   <Interior ss:Color="#0F172A" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="Title">
   <Font ss:Bold="1" ss:Size="16" ss:Color="#0F172A"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Sales Returns">
  <Table>
   <Row>
    <Cell ss:StyleID="Title"><Data ss:Type="String">${companyName} - Sales Return &amp; Restock Ledger</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">Exported: ${exportDate} | Total Returns: ${filteredReturns.length}</Data></Cell>
   </Row>
   <Row></Row>
   <Row ss:StyleID="Header">
    <Cell><Data ss:Type="String">Return No</Data></Cell>
    <Cell><Data ss:Type="String">Return Date</Data></Cell>
    <Cell><Data ss:Type="String">Original Invoice</Data></Cell>
    <Cell><Data ss:Type="String">Medicine / Drug Name</Data></Cell>
    <Cell><Data ss:Type="String">Quantity</Data></Cell>
    <Cell><Data ss:Type="String">Unit Price (KES)</Data></Cell>
    <Cell><Data ss:Type="String">Total Refund (KES)</Data></Cell>
    <Cell><Data ss:Type="String">Return Reason</Data></Cell>
    <Cell><Data ss:Type="String">Status</Data></Cell>
    <Cell><Data ss:Type="String">Authorized By</Data></Cell>
   </Row>
   ${filteredReturns.map((r) => {
       const val = Number(r.total_amount ?? r.total ?? (r.quantity * r.unit_price)) || 0;
       return `
   <Row>
    <Cell><Data ss:Type="String">${r.return_no}</Data></Cell>
    <Cell><Data ss:Type="String">${r.return_date}</Data></Cell>
    <Cell><Data ss:Type="String">${r.original_sale_id || 'OTC'}</Data></Cell>
    <Cell><Data ss:Type="String">${(r.product_name || '').replace(/&/g, '&amp;')}</Data></Cell>
    <Cell><Data ss:Type="Number">${r.quantity}</Data></Cell>
    <Cell><Data ss:Type="Number">${r.unit_price}</Data></Cell>
    <Cell><Data ss:Type="Number">${val}</Data></Cell>
    <Cell><Data ss:Type="String">${(r.reason || 'General').replace(/&/g, '&amp;')}</Data></Cell>
    <Cell><Data ss:Type="String">${r.status || 'Completed'}</Data></Cell>
    <Cell><Data ss:Type="String">${(r.processed_by || 'Pharmacist').replace(/&/g, '&amp;')}</Data></Cell>
   </Row>`;
   }).join('')}
  </Table>
 </Worksheet>
</Workbook>`;

        const blob = new Blob([xmlString], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AlphaPharmacy_Sales_Returns_${new Date().toISOString().split('T')[0]}.xls`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Sales returns exported (.xls)!');
    };

    // ==================== RENDER ====================
    return (
        <div className="space-y-6 pb-20 font-sans">
            {/* Top Command Banner */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-teal-50 via-emerald-50/30 to-transparent rounded-full pointer-events-none -mr-20 -mt-20"></div>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z" />
                            </svg>
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                                    Sales Return &amp; Inventory Restocking Hub
                                </h1>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                    LIVE DB REALTIME
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 font-medium mt-1">
                                Audit sales credit notes, customer refunds, adverse event recalls &amp; automated batch restocking
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                        <button
                            onClick={() => loadReturns()}
                            disabled={isLoading}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors border border-slate-200"
                        >
                            <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            {isLoading ? 'Syncing...' : 'Sync Live'}
                        </button>
                        <button
                            onClick={exportToSuperExcel}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm shadow-emerald-600/20"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Super Excel (.xls)
                        </button>
                        <button
                            onClick={() => {
                                resetModalForm();
                                setShowModal(true);
                                loadRecentReceipts();
                            }}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-md"
                        >
                            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Authorize New Return
                        </button>
                    </div>
                </div>
            </div>

            {/* 5 Super Premium Light Luxury Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* 1. Total Returns */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/90 border-t-4 border-t-teal-500 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Total Returns</span>
                        <span className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center font-bold text-xs">
                            SR
                        </span>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
                            {metrics.totalReturns}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium mt-1">
                            Audited return transactions
                        </div>
                    </div>
                </div>

                {/* 2. Refund Outlay */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/90 border-t-4 border-t-rose-500 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Refund Outlay</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-rose-100 text-rose-800">
                            Refund
                        </span>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl font-black text-rose-600 font-mono tracking-tight">
                            KES {metrics.totalRefund.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium mt-1">
                            Total financial cash refunded
                        </div>
                    </div>
                </div>

                {/* 3. Restocked to Shelf */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/90 border-t-4 border-t-emerald-500 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Restocked to Shelf</span>
                        <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
                            RESTOCK
                        </span>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl font-black text-emerald-700 font-mono tracking-tight">
                            {metrics.restockedCount}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium mt-1">
                            Units restored to active stock
                        </div>
                    </div>
                </div>

                {/* 4. Quarantined / Defect */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/90 border-t-4 border-t-amber-500 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Quarantined / Defect</span>
                        <span className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-xs">
                            HOLD
                        </span>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl font-black text-amber-700 font-mono tracking-tight">
                            {metrics.quarantinedCount}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium mt-1">
                            Blocked from retail dispensing
                        </div>
                    </div>
                </div>

                {/* 5. Primary Reason */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/90 border-t-4 border-t-cyan-500 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Primary Reason</span>
                        <span className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center font-bold text-xs">
                            REASON
                        </span>
                    </div>
                    <div className="mt-3">
                        <div className="text-base font-black text-slate-900 truncate tracking-tight">
                            {metrics.primaryReason}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium mt-1">
                            {metrics.maxReasonCount} recorded occurrences
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter and Control Bar */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    {/* Horizon Pills */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-slate-500 mr-1">Time Horizon:</span>
                        {[
                            { key: 'all', label: 'All Time' },
                            { key: 'today', label: 'Today' },
                            { key: 'yesterday', label: 'Yesterday' },
                            { key: 'week', label: 'Last 7 Days' },
                            { key: 'month', label: 'This Month' },
                        ].map((btn) => (
                            <button
                                key={btn.key}
                                onClick={() => {
                                    setDateHorizon(btn.key as any);
                                    setCurrentPage(1);
                                }}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                    dateHorizon === btn.key
                                        ? 'bg-slate-900 text-white shadow-sm'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                {btn.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="border-t border-slate-100 pt-3 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2.5 flex-1 min-w-[280px]">
                        <div className="relative flex-1">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </span>
                            <input
                                type="text"
                                placeholder="Search return #, original invoice, drug name, pharmacist or reason..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="w-full pl-9 pr-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        <select
                            value={filterReason}
                            onChange={(e) => {
                                setFilterReason(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                        >
                            <option value="All">All Return Reasons</option>
                            <option value="Wrong Medication Dispensed">Wrong Medication Dispensed</option>
                            <option value="Customer Request">Customer Request</option>
                            <option value="Packaging Defect">Packaging Defect</option>
                            <option value="Adverse Reaction">Adverse Reaction</option>
                            <option value="Near Expiry Discovered">Near Expiry Discovered</option>
                            <option value="Pricing / Billing Dispute">Pricing / Billing Dispute</option>
                        </select>

                        <select
                            value={filterStatus}
                            onChange={(e) => {
                                setFilterStatus(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                        >
                            <option value="All">All Statuses</option>
                            <option value="Completed">Completed</option>
                            <option value="Quarantined">Quarantined</option>
                            <option value="Pending">Pending</option>
                        </select>
                    </div>

                    <div className="text-xs font-bold text-slate-500">
                        Showing <span className="text-emerald-700 font-extrabold">{filteredReturns.length}</span> matching returns
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
                {[
                    { id: 'all', label: '📋 All Return Records', count: filteredReturns.length },
                    { id: 'completed', label: '✅ Completed & Restocked', count: returns.filter((r) => (r.status || '').toLowerCase() === 'completed').length },
                    { id: 'pending', label: '⚠️ Quarantined / Pending', count: returns.filter((r) => (r.status || '').toLowerCase() === 'quarantined' || (r.status || '').toLowerCase() === 'pending').length },
                    { id: 'reasons', label: '📊 Reasons Analytics', count: metrics.reasonsList.length },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => {
                            setActiveTab(tab.id as any);
                            setCurrentPage(1);
                        }}
                        className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 ${
                            activeTab === tab.id
                                ? 'bg-slate-900 text-white shadow-sm'
                                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                        }`}
                    >
                        {tab.label}
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                            activeTab === tab.id ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-700'
                        }`}>
                            {tab.count}
                        </span>
                    </button>
                ))}
            </div>

            {/* Master Table */}
            {(activeTab === 'all' || activeTab === 'completed' || activeTab === 'pending') && (
                <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
                        <div>
                            <h3 className="text-base font-black text-slate-900 tracking-tight">
                                Sales Returns Audit Ledger
                            </h3>
                            <p className="text-xs text-slate-500 font-medium">
                                Audit trail of customer refunds, returned drug items, and restocked batches
                            </p>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-900 border-b-2 border-emerald-500 text-white font-black uppercase text-[11px] tracking-wider">
                                    <th className="py-3 px-4">Return #</th>
                                    <th className="py-3 px-3">Date</th>
                                    <th className="py-3 px-3">Original Invoice</th>
                                    <th className="py-3 px-3">Returned Drug Name</th>
                                    <th className="py-3 px-3 text-right">Qty</th>
                                    <th className="py-3 px-3 text-right">Unit Price</th>
                                    <th className="py-3 px-3 text-right">Refund Value</th>
                                    <th className="py-3 px-3">Return Reason</th>
                                    <th className="py-3 px-3 text-center">Status</th>
                                    <th className="py-3 px-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={10} className="py-12 text-center text-slate-400">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                                                <span>Loading sales returns ledger from database...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredReturns.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className="py-12 text-center text-slate-400 font-medium">
                                            No sales return records found matching current criteria
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedReturns.map((r) => {
                                        const refundVal = Number(r.total_amount ?? r.total ?? (r.quantity * r.unit_price)) || 0;
                                        return (
                                            <tr key={r.return_id} className="hover:bg-emerald-50/40 transition-colors">
                                                <td className="py-3.5 px-4 font-mono font-extrabold text-slate-900">
                                                    {r.return_no}
                                                </td>
                                                <td className="py-3.5 px-3 text-slate-600 font-mono">
                                                    {r.return_date}
                                                </td>
                                                <td className="py-3.5 px-3 font-mono font-bold text-teal-800">
                                                    {r.original_sale_id || 'OTC'}
                                                </td>
                                                <td className="py-3.5 px-3 font-bold text-slate-900">
                                                    {r.product_name}
                                                </td>
                                                <td className="py-3.5 px-3 text-right font-mono font-bold">
                                                    {r.quantity}
                                                </td>
                                                <td className="py-3.5 px-3 text-right font-mono text-slate-600">
                                                    KES {Number(r.unit_price || 0).toLocaleString()}
                                                </td>
                                                <td className="py-3.5 px-3 text-right font-mono font-black text-rose-600">
                                                    KES {refundVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td className="py-3.5 px-3 text-slate-700">
                                                    {r.reason || 'General Return'}
                                                </td>
                                                <td className="py-3.5 px-3 text-center">
                                                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                        (r.status || '').toLowerCase() === 'completed'
                                                            ? 'bg-emerald-100 text-emerald-800'
                                                            : 'bg-amber-100 text-amber-800'
                                                    }`}>
                                                        {r.status || 'Completed'}
                                                    </span>
                                                </td>
                                                <td className="py-3.5 px-4 text-center">
                                                    <button
                                                        onClick={() => viewCreditNote(r)}
                                                        className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-bold shadow-xs transition"
                                                    >
                                                        Credit Note
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <PaginationFooter
                        currentPage={currentPage}
                        totalItems={filteredReturns.length}
                        pageSize={pageSize}
                        onPageChange={setCurrentPage}
                        onPageSizeChange={setPageSize}
                        itemLabel="returns"
                    />
                </div>
            )}

            {/* Reasons Analytics Tab */}
            {activeTab === 'reasons' && (
                <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-200 bg-slate-50/50">
                        <h3 className="text-base font-black text-slate-900 tracking-tight">
                            Return Reasons Clinical &amp; Quality Analytics
                        </h3>
                        <p className="text-xs text-slate-500 font-medium">
                            Breakdown of patient return motives and quality discrepancy frequencies
                        </p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-900 border-b-2 border-emerald-500 text-white font-black uppercase text-[11px] tracking-wider">
                                    <th className="py-3 px-4">Clinical / Return Reason</th>
                                    <th className="py-3 px-3 text-right">Occurrence Count</th>
                                    <th className="py-3 px-3 text-right">% of Total Returns</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                                {metrics.reasonsList.map((item) => (
                                    <tr key={item.reason} className="hover:bg-slate-50 transition-colors">
                                        <td className="py-3.5 px-4 font-bold text-slate-900">
                                            {item.reason}
                                        </td>
                                        <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-800">
                                            {item.count}
                                        </td>
                                        <td className="py-3.5 px-3 text-right font-mono font-bold text-emerald-700">
                                            {metrics.totalReturns > 0 ? ((item.count / metrics.totalReturns) * 100).toFixed(1) : 0}%
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ==================== AUTHORIZE RETURN MODAL (WITH 100% AUTO-POPULATION) ==================== */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 z-50 animate-fadeIn">
                    <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh]">
                        {/* Header */}
                        <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between border-b-2 border-emerald-500">
                            <div>
                                <h3 className="font-black text-base tracking-tight text-white flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                    Authorize Pharmaceutical Sales Return
                                </h3>
                                <p className="text-[11px] text-emerald-200 font-medium mt-0.5">
                                    Auto-populated from sales receipts with batch restocking and refund verification
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setShowModal(false);
                                    resetModalForm();
                                }}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-sm font-bold text-white transition"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 overflow-y-auto space-y-4 text-xs">
                            {/* Intake Mode Switcher */}
                            <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => setIntakeMode('receipt')}
                                    className={`flex-1 py-2 rounded-lg font-bold text-xs transition ${
                                        intakeMode === 'receipt'
                                            ? 'bg-white text-slate-900 shadow-xs'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    🧾 Auto-Populate from Sales Receipt (Recommended)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIntakeMode('manual')}
                                    className={`flex-1 py-2 rounded-lg font-bold text-xs transition ${
                                        intakeMode === 'manual'
                                            ? 'bg-white text-slate-900 shadow-xs'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    💊 Manual OTC Return (No Receipt)
                                </button>
                            </div>

                            {/* AUTO-POPULATED SALES RECEIPTS SELECTOR */}
                            {intakeMode === 'receipt' && (
                                <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[11px] font-black uppercase text-emerald-950 flex items-center gap-1.5">
                                            <span>⚡ Select Sales Receipt to Auto-Populate</span>
                                        </label>
                                        <span className="text-[10px] font-mono text-emerald-700">
                                            {availableSales.length} receipts preloaded
                                        </span>
                                    </div>

                                    {/* Live Search & Dropdown Selector */}
                                    <div className="space-y-2">
                                        <input
                                            type="text"
                                            value={receiptSearchTerm}
                                            onChange={(e) => setReceiptSearchTerm(e.target.value)}
                                            placeholder="Type to filter receipts (e.g. RX-0009 or Walk-in)..."
                                            className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-emerald-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                        />

                                        {/* Preloaded Receipts List */}
                                        <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                                            {isSearchingReceipts ? (
                                                <div className="p-3 text-center text-emerald-700">Preloading sales receipts...</div>
                                            ) : filteredAvailableSales.length === 0 ? (
                                                <div className="p-3 text-center text-slate-400">No matching receipts found</div>
                                            ) : (
                                                filteredAvailableSales.map((s) => {
                                                    const isSelected = selectedSale?.receipt_no === s.receipt_no;
                                                    return (
                                                        <div
                                                            key={`${s.receipt_no}-${s.sale_id}`}
                                                            onClick={() => handleSelectSale(s)}
                                                            className={`p-2.5 rounded-xl border cursor-pointer transition flex items-center justify-between text-xs ${
                                                                isSelected
                                                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                                                    : 'bg-white hover:bg-emerald-50 border-emerald-200 text-slate-800'
                                                            }`}
                                                        >
                                                            <div>
                                                                <span className="font-mono font-black">{s.receipt_no}</span>
                                                                <span className={`ml-2 text-[11px] ${isSelected ? 'text-emerald-100' : 'text-slate-500'}`}>
                                                                    {s.customer_name}
                                                                </span>
                                                                <span className={`block text-[10px] ${isSelected ? 'text-emerald-200' : 'text-slate-400'}`}>
                                                                    {s.sale_datetime ? s.sale_datetime.replace('T', ' ').substring(0, 16) : 'N/A'} • {s.payment_method}
                                                                </span>
                                                            </div>
                                                            <div className="text-right">
                                                                <span className="font-mono font-black text-sm">
                                                                    KES {s.total.toLocaleString()}
                                                                </span>
                                                                <span className={`block text-[10px] uppercase font-bold ${isSelected ? 'text-emerald-200' : 'text-emerald-700'}`}>
                                                                    {isSelected ? '✓ ACTIVE' : 'CLICK TO LOAD'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>

                                    {/* Sold Line Items on Selected Receipt */}
                                    {selectedSale && (
                                        <div className="pt-2 border-t border-emerald-200 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-black uppercase text-emerald-950">
                                                    Medications Sold on {selectedSale.receipt_no} (Click to Return):
                                                </span>
                                                <span className="text-[10px] text-emerald-800 font-mono">
                                                    {saleItems.length} items on invoice
                                                </span>
                                            </div>

                                            {isLoadingItems ? (
                                                <div className="p-3 text-center text-emerald-700">Loading sold medications...</div>
                                            ) : (
                                                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                                                    {saleItems.map((itm) => {
                                                        const isItemActive = selectedSaleItem?.item_id === itm.item_id;
                                                        return (
                                                            <div
                                                                key={itm.item_id}
                                                                onClick={() => handleSelectSaleItem(itm)}
                                                                className={`p-2.5 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                                                                    isItemActive
                                                                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                                                                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                                                                }`}
                                                            >
                                                                <div>
                                                                    <div className="font-bold flex items-center gap-1.5">
                                                                        <span>💊</span>
                                                                        <span>{itm.product_name}</span>
                                                                    </div>
                                                                    <div className={`text-[10px] font-mono ${isItemActive ? 'text-emerald-400' : 'text-slate-500'}`}>
                                                                        Sold: {itm.quantity} units @ KES {itm.unit_price}/unit
                                                                    </div>
                                                                </div>
                                                                <span className="font-mono font-black text-sm">
                                                                    KES {(itm.quantity * itm.unit_price).toLocaleString()}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* AUTO-POPULATED RETURN FORM DETAILS */}
                            <div className="space-y-3 pt-2">
                                <div>
                                    <label className="font-bold text-slate-700 block mb-1">
                                        Returned Medication Name <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.product_name}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, product_name: e.target.value }))}
                                        placeholder="Medicine Name (auto-populated from receipt)"
                                        className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="font-bold text-slate-700">Quantity Returned *</label>
                                            {formData.max_quantity < 999 && (
                                                <span className="text-[10px] text-emerald-700 font-bold">
                                                    Max sold: {formData.max_quantity}
                                                </span>
                                            )}
                                        </div>
                                        <input
                                            type="number"
                                            min={1}
                                            max={formData.max_quantity}
                                            value={formData.quantity}
                                            onChange={(e) => setFormData((prev) => ({ ...prev, quantity: Math.max(1, Number(e.target.value) || 1) }))}
                                            className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="font-bold text-slate-700 block mb-1">Unit Refund Price (KES) *</label>
                                        <input
                                            type="number"
                                            min={0}
                                            value={formData.unit_price}
                                            onChange={(e) => setFormData((prev) => ({ ...prev, unit_price: Number(e.target.value) || 0 }))}
                                            className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                        />
                                    </div>
                                </div>

                                {/* TOTAL REFUND DUE BANNER */}
                                <div className="p-4 bg-slate-900 rounded-2xl text-white flex items-center justify-between shadow-sm">
                                    <div>
                                        <span className="text-[10px] font-black uppercase text-emerald-400 block tracking-wider">
                                            Total Customer Refund Due
                                        </span>
                                        <div className="text-2xl font-black font-mono mt-0.5 text-white">
                                            KES {(formData.quantity * formData.unit_price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                    <div className="text-right text-[11px] font-mono text-slate-300">
                                        {formData.quantity} unit(s) @ KES {formData.unit_price}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="font-bold text-slate-700 block mb-1">Return Reason *</label>
                                        <select
                                            value={formData.reason}
                                            onChange={(e) => setFormData((prev) => ({ ...prev, reason: e.target.value }))}
                                            className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold text-slate-800 bg-white"
                                        >
                                            <option value="Wrong Medication Dispensed">Wrong Medication Dispensed</option>
                                            <option value="Customer Request">Customer Request</option>
                                            <option value="Packaging Defect">Packaging Defect</option>
                                            <option value="Adverse Reaction">Adverse Reaction</option>
                                            <option value="Near Expiry Discovered">Near Expiry Discovered</option>
                                            <option value="Pricing / Billing Dispute">Pricing / Billing Dispute</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="font-bold text-slate-700 block mb-1">Refund Payout Channel *</label>
                                        <select
                                            value={formData.refund_method}
                                            onChange={(e) => setFormData((prev) => ({ ...prev, refund_method: e.target.value }))}
                                            className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold text-slate-800 bg-white"
                                        >
                                            <option value="Cash from Register">Cash from Counter Register</option>
                                            <option value="M-Pesa Refund">M-Pesa Refund</option>
                                            <option value="Store Credit Voucher">Store Credit Voucher</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Restocking Toggles */}
                                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                                    <div>
                                        <span className="font-bold text-slate-800 block">Restock to Active Sellable Inventory</span>
                                        <span className="text-[10px] text-slate-500">Automatically increment pharmacy stock and batch quantity</span>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={formData.restock_inventory}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, restock_inventory: e.target.checked }))}
                                        className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-2.5">
                            <button
                                onClick={() => {
                                    setShowModal(false);
                                    resetModalForm();
                                }}
                                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveReturn}
                                disabled={isSaving}
                                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition disabled:opacity-50"
                            >
                                {isSaving ? 'Processing...' : 'Authorize Return & Process Refund'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CREDIT NOTE PRINT SLIP MODAL */}
            {showVoucherModal && voucherReturn && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xl max-w-md w-full space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="text-base font-black text-slate-900">
                                Official Credit Note Slip: {voucherReturn.return_no}
                            </h3>
                            <button
                                onClick={() => setShowVoucherModal(false)}
                                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 font-mono text-xs space-y-2">
                            <div className="text-center font-bold text-sm text-slate-900">{companyName}</div>
                            <div className="text-center text-[10px] text-slate-500">Official Patient Credit Voucher</div>
                            <div className="border-t border-dashed border-slate-300 pt-2 space-y-1">
                                <div className="flex justify-between"><span>Credit Note:</span><strong>{voucherReturn.return_no}</strong></div>
                                <div className="flex justify-between"><span>Original Sale:</span><span>{voucherReturn.original_sale_id}</span></div>
                                <div className="flex justify-between"><span>Date:</span><span>{voucherReturn.return_date}</span></div>
                                <div className="flex justify-between"><span>Medication:</span><strong>{voucherReturn.product_name}</strong></div>
                                <div className="flex justify-between"><span>Quantity Returned:</span><span>{voucherReturn.quantity} units</span></div>
                                <div className="flex justify-between"><span>Unit Price:</span><span>KES {voucherReturn.unit_price}</span></div>
                                <div className="flex justify-between border-t border-slate-300 pt-1 text-sm font-black text-emerald-700">
                                    <span>Total Refund:</span>
                                    <span>KES {Number(voucherReturn.total_amount || 0).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                            <button
                                onClick={() => setShowVoucherModal(false)}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                            >
                                Close
                            </button>
                            <button
                                onClick={() => {
                                    window.print();
                                }}
                                className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800"
                            >
                                Print Credit Note
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
