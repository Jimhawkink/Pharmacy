'use client';
// =====================================================================
// Alpha Pharmacy - Super Massive Purchases Master Register & Audit Hub v3.1
// Fit-To-Page Responsive Layout, Visible High-Contrast Dark Headers,
// Expandable Invoice Items Breakdown, Live Batch & Expiry Traceability,
// 360° Dossier, Printable GRN & Super Bright Excel
// =====================================================================

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import { supabase, logActivity } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import Link from 'next/link';
import toast from 'react-hot-toast';

export interface PurchaseRecord {
    purchase_id: number;
    purchase_no: string;
    purchase_date: string;
    supplier_id: number;
    supplier_name: string;
    supplier_invoice?: string;
    sub_total: number;
    discount: number;
    vat: number;
    grand_total: number;
    status: string;
    payment_status: string;
    created_by?: string;
    notes?: string;
    created_at?: string;
    outlet_id?: number;
    items_count?: number;
}

export interface PurchaseItemDetail {
    id?: number;
    pp_id?: number;
    purchase_id: number;
    product_id: number;
    product_code: string;
    product_name: string;
    quantity: number;
    unit: string;
    pieces_per_package?: number;
    rate: number;
    sales_cost?: number;
    total_amount: number;
    batch_number?: string;
    expiry_date?: string;
    remaining_qty?: number;
}

export interface SupplierOption {
    supplier_id: number;
    supplier_name: string;
    supplier_code?: string;
}

const escapeXml = (unsafe: any): string => {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
};

export default function PurchasesMasterPage() {
    const { activeOutlet } = useOutlet();
    const outletId = activeOutlet?.outlet_id || 1;
    const outletName = activeOutlet?.outlet_name || 'Alpha Pharmacy Main';

    // Core Data
    const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
    const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAutoFit, setIsAutoFit] = useState(true);
    const [activeDbTable, setActiveDbTable] = useState('purchases');

    // Expandable Rows & Items Cache
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
    const [purchaseItemsCache, setPurchaseItemsCache] = useState<Record<number, PurchaseItemDetail[]>>({});
    const [loadingItemsMap, setLoadingItemsMap] = useState<Set<number>>(new Set());

    // Filters
    const [search, setSearch] = useState('');
    const [filterSupplier, setFilterSupplier] = useState('All');
    const [filterPayment, setFilterPayment] = useState<'All' | 'Paid' | 'Unpaid' | 'Partial'>('All');
    const [filterStatus, setFilterStatus] = useState('All');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'amount_high' | 'amount_low' | 'inv_asc' | 'supplier'>('newest');

    // Selection & Bulk
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    // Pagination
    const [pageSize, setPageSize] = useState<number>(50);
    const [currentPage, setCurrentPage] = useState<number>(1);

    // View Dossier Modal
    const [showDossierModal, setShowDossierModal] = useState(false);
    const [activePurchase, setActivePurchase] = useState<PurchaseRecord | null>(null);
    const [purchaseLineItems, setPurchaseLineItems] = useState<PurchaseItemDetail[]>([]);
    const [isLoadingItems, setIsLoadingItems] = useState(false);

    // Update Payment Modal
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentPurchase, setPaymentPurchase] = useState<PurchaseRecord | null>(null);
    const [newPaymentStatus, setNewPaymentStatus] = useState<'Paid' | 'Unpaid' | 'Partial'>('Paid');
    const [paymentNotes, setPaymentNotes] = useState('');
    const [isUpdatingPayment, setIsUpdatingPayment] = useState(false);

    // Fetch line items for a single purchase with multi-tier fallback
    const fetchItemsForPurchase = useCallback(async (p: PurchaseRecord): Promise<PurchaseItemDetail[]> => {
        try {
            let items: PurchaseItemDetail[] = [];

            // 1. Try pharmacy_purchase_products
            const { data: pharmItems, error: pharmErr } = await supabase
                .from('pharmacy_purchase_products')
                .select('*')
                .eq('purchase_id', p.purchase_id)
                .order('id', { ascending: true });

            if (!pharmErr && pharmItems && pharmItems.length > 0) {
                items = pharmItems.map((r: any) => ({
                    id: r.id,
                    pp_id: r.pp_id,
                    purchase_id: r.purchase_id,
                    product_id: r.product_id,
                    product_code: r.product_code || `PRD-${r.product_id}`,
                    product_name: r.product_name,
                    quantity: Number(r.quantity) || 0,
                    unit: r.unit || 'Piece',
                    rate: Number(r.rate) || 0,
                    sales_cost: Number(r.sales_cost || r.selling_price) || 0,
                    total_amount: Number(r.total_amount) || (Number(r.quantity) * Number(r.rate)),
                    batch_number: r.batch_number,
                    expiry_date: r.expiry_date,
                }));
            } else {
                // Fallback 1: retail_purchase_products
                const { data: retItems } = await supabase
                    .from('retail_purchase_products')
                    .select('*')
                    .eq('purchase_id', p.purchase_id);
                if (retItems && retItems.length > 0) {
                    items = retItems.map((r: any) => ({
                        id: r.id,
                        purchase_id: r.purchase_id,
                        product_id: r.product_id,
                        product_code: r.product_code || `PRD-${r.product_id}`,
                        product_name: r.product_name,
                        quantity: Number(r.quantity) || 0,
                        unit: r.unit || 'Piece',
                        rate: Number(r.rate) || 0,
                        sales_cost: Number(r.sales_cost) || 0,
                        total_amount: Number(r.total_amount) || (Number(r.quantity) * Number(r.rate)),
                    }));
                }
            }

            // Fallback 2: If still empty, check pharmacy_batches matching invoice #
            if (items.length === 0 && (p.purchase_no || p.supplier_invoice)) {
                const invQuery = p.purchase_no || p.supplier_invoice;
                const { data: bData } = await supabase
                    .from('pharmacy_batches')
                    .select('*')
                    .or(`purchase_invoice.eq.${invQuery},batch_number.eq.${invQuery}`);

                if (bData && bData.length > 0) {
                    const pids = bData.map((b: any) => b.product_id).filter(Boolean);
                    const prodMap = new Map<number, string>();
                    if (pids.length > 0) {
                        const { data: prods } = await supabase
                            .from('pharmacy_products')
                            .select('pid, name, product_name')
                            .in('pid', pids);
                        if (prods) {
                            prods.forEach((pr: any) => prodMap.set(pr.pid, pr.product_name || pr.name));
                        }
                    }

                    items = bData.map((b: any, idx: number) => ({
                        id: b.batch_id || idx,
                        purchase_id: p.purchase_id,
                        product_id: b.product_id,
                        product_code: `BAT-${b.batch_number}`,
                        product_name: prodMap.get(b.product_id) || b.product_name || `Drug #${b.product_id}`,
                        quantity: Number(b.quantity) || 0,
                        unit: b.unit || 'Piece',
                        rate: Number(b.purchase_cost) || 0,
                        sales_cost: Number(b.selling_price) || 0,
                        total_amount: (Number(b.quantity) || 0) * (Number(b.purchase_cost) || 0),
                        batch_number: b.batch_number,
                        expiry_date: b.expiry_date,
                        remaining_qty: b.remaining_qty,
                    }));
                }
            }

            // Enhance with batch info from pharmacy_batches if available
            if (items.length > 0 && p.purchase_no) {
                const { data: batchData } = await supabase
                    .from('pharmacy_batches')
                    .select('batch_number, expiry_date, product_id, remaining_qty, selling_price')
                    .eq('purchase_invoice', p.purchase_no);

                if (batchData && batchData.length > 0) {
                    const batchMap = new Map<number, any>();
                    batchData.forEach((b: any) => batchMap.set(b.product_id, b));
                    items = items.map((it) => {
                        const matched = batchMap.get(it.product_id);
                        return {
                            ...it,
                            batch_number: matched?.batch_number || it.batch_number || 'N/A',
                            expiry_date: matched?.expiry_date || it.expiry_date || 'N/A',
                            remaining_qty: matched?.remaining_qty,
                            sales_cost: matched?.selling_price || it.sales_cost,
                        };
                    });
                }
            }

            return items;
        } catch (err) {
            console.error('Error fetching purchase items:', err);
            return [];
        }
    }, []);

    // Load Purchases from database
    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            let purchasesData: PurchaseRecord[] = [];
            let resolvedTable = 'purchases';

            const { data: pPharm, error: pPharmErr } = await supabase
                .from('pharmacy_purchases')
                .select('*')
                .order('purchase_id', { ascending: false });

            if (!pPharmErr && pPharm && pPharm.length > 0) {
                purchasesData = pPharm;
                resolvedTable = 'pharmacy_purchases';
            } else {
                const { data: pBase, error: pBaseErr } = await supabase
                    .from('purchases')
                    .select('*')
                    .order('purchase_id', { ascending: false });

                if (!pBaseErr && pBase && pBase.length > 0) {
                    purchasesData = pBase;
                    resolvedTable = 'purchases';
                } else {
                    const { data: pRet } = await supabase
                        .from('retail_purchases')
                        .select('*')
                        .order('purchase_id', { ascending: false });
                    if (pRet) {
                        purchasesData = pRet;
                        resolvedTable = 'retail_purchases';
                    }
                }
            }
            setActiveDbTable(resolvedTable);
            setPurchases(purchasesData);

            // Pre-fetch line items for visible purchases
            if (purchasesData.length > 0) {
                const pIds = purchasesData.map((p) => p.purchase_id).slice(0, 100);
                const { data: pItems } = await supabase
                    .from('pharmacy_purchase_products')
                    .select('*')
                    .in('purchase_id', pIds);

                const cache: Record<number, PurchaseItemDetail[]> = {};
                if (pItems && pItems.length > 0) {
                    pItems.forEach((it: any) => {
                        if (!cache[it.purchase_id]) cache[it.purchase_id] = [];
                        cache[it.purchase_id].push({
                            id: it.id,
                            pp_id: it.pp_id,
                            purchase_id: it.purchase_id,
                            product_id: it.product_id,
                            product_code: it.product_code || `PRD-${it.product_id}`,
                            product_name: it.product_name,
                            quantity: Number(it.quantity) || 0,
                            unit: it.unit || 'Piece',
                            rate: Number(it.rate) || 0,
                            sales_cost: Number(it.sales_cost) || 0,
                            total_amount: Number(it.total_amount) || (Number(it.quantity) * Number(it.rate)),
                            batch_number: it.batch_number,
                            expiry_date: it.expiry_date,
                        });
                    });
                }

                // Check pharmacy_batches for any purchases without items in pharmacy_purchase_products
                const missingP = purchasesData.filter((p) => !cache[p.purchase_id] || cache[p.purchase_id].length === 0);
                if (missingP.length > 0) {
                    const invNos = missingP.map((p) => p.purchase_no).filter(Boolean);
                    if (invNos.length > 0) {
                        const { data: bData } = await supabase
                            .from('pharmacy_batches')
                            .select('*')
                            .in('purchase_invoice', invNos);

                        if (bData && bData.length > 0) {
                            bData.forEach((b: any) => {
                                const matchedP = purchasesData.find((p) => p.purchase_no === b.purchase_invoice);
                                if (matchedP) {
                                    if (!cache[matchedP.purchase_id]) cache[matchedP.purchase_id] = [];
                                    cache[matchedP.purchase_id].push({
                                        id: b.batch_id,
                                        purchase_id: matchedP.purchase_id,
                                        product_id: b.product_id,
                                        product_code: `BAT-${b.batch_number}`,
                                        product_name: b.product_name || `Drug #${b.product_id}`,
                                        quantity: Number(b.quantity) || 0,
                                        unit: b.unit || 'Box',
                                        rate: Number(b.purchase_cost) || 0,
                                        sales_cost: Number(b.selling_price) || 0,
                                        total_amount: (Number(b.quantity) || 0) * (Number(b.purchase_cost) || 0),
                                        batch_number: b.batch_number,
                                        expiry_date: b.expiry_date,
                                        remaining_qty: b.remaining_qty,
                                    });
                                }
                            });
                        }
                    }
                }

                setPurchaseItemsCache(cache);
            }

            // Fetch Suppliers
            let suppList: SupplierOption[] = [];
            const { data: sPharm, error: sPharmErr } = await supabase
                .from('pharmacy_suppliers')
                .select('supplier_id, supplier_name, supplier_code')
                .order('supplier_name');

            if (!sPharmErr && sPharm && sPharm.length > 0) {
                suppList = sPharm;
            } else {
                const { data: sBase } = await supabase
                    .from('suppliers')
                    .select('supplier_id, supplier_name, supplier_code')
                    .order('supplier_name');
                if (sBase) suppList = sBase;
            }
            setSuppliers(suppList);
        } catch (err: any) {
            console.error('Failed to load purchases:', err);
            toast.error('Failed to connect to purchases database');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Expand/Collapse Row
    const toggleRow = async (p: PurchaseRecord) => {
        const next = new Set(expandedRows);
        if (next.has(p.purchase_id)) {
            next.delete(p.purchase_id);
        } else {
            next.add(p.purchase_id);
            if (!purchaseItemsCache[p.purchase_id]) {
                setLoadingItemsMap((prev) => new Set(prev).add(p.purchase_id));
                try {
                    const items = await fetchItemsForPurchase(p);
                    setPurchaseItemsCache((prev) => ({ ...prev, [p.purchase_id]: items }));
                } finally {
                    setLoadingItemsMap((prev) => {
                        const s = new Set(prev);
                        s.delete(p.purchase_id);
                        return s;
                    });
                }
            }
        }
        setExpandedRows(next);
    };

    // View Invoice Dossier
    const handleViewDossier = async (p: PurchaseRecord) => {
        setActivePurchase(p);
        setShowDossierModal(true);
        setIsLoadingItems(true);

        try {
            if (purchaseItemsCache[p.purchase_id] && purchaseItemsCache[p.purchase_id].length > 0) {
                setPurchaseLineItems(purchaseItemsCache[p.purchase_id]);
            } else {
                const items = await fetchItemsForPurchase(p);
                setPurchaseLineItems(items);
                setPurchaseItemsCache((prev) => ({ ...prev, [p.purchase_id]: items }));
            }
        } catch (err: any) {
            console.error('Failed to load invoice items:', err);
            toast.error('Failed to load itemized lines');
        } finally {
            setIsLoadingItems(false);
        }
    };

    // Open Quick Payment Status Update
    const handleOpenPaymentUpdate = (p: PurchaseRecord) => {
        setPaymentPurchase(p);
        setNewPaymentStatus((p.payment_status as any) || 'Paid');
        setPaymentNotes('');
        setShowPaymentModal(true);
    };

    // Save Updated Payment Status
    const handleSavePaymentStatus = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!paymentPurchase) return;

        setIsUpdatingPayment(true);
        try {
            const updatePayload: any = {
                payment_status: newPaymentStatus,
                notes: `${paymentPurchase.notes || ''}\n[${new Date().toLocaleDateString()}] Payment updated to ${newPaymentStatus}: ${paymentNotes}`,
            };
            if (activeDbTable !== 'pharmacy_purchases') {
                updatePayload.updated_at = new Date().toISOString();
            }

            const { error } = await supabase
                .from(activeDbTable)
                .update(updatePayload)
                .eq('purchase_id', paymentPurchase.purchase_id);

            if (error) throw error;

            toast.success(`Invoice ${paymentPurchase.purchase_no} status changed to ${newPaymentStatus}!`);
            await logActivity(
                'Purchase Payment Updated',
                `Invoice ${paymentPurchase.purchase_no} status marked as ${newPaymentStatus}`
            );

            setShowPaymentModal(false);
            setPaymentPurchase(null);
            loadData();
        } catch (err: any) {
            toast.error(`Update failed: ${err.message}`);
        } finally {
            setIsUpdatingPayment(false);
        }
    };

    // Delete Invoice & Line Items
    const handleDeletePurchase = async (p: PurchaseRecord) => {
        if (!confirm(`Are you sure you want to delete Invoice ${p.purchase_no}? This action will permanently remove the record.`)) {
            return;
        }

        try {
            try {
                await supabase.from('pharmacy_purchase_products').delete().eq('purchase_id', p.purchase_id);
            } catch {
                // ignore
            }
            try {
                await supabase.from('retail_purchase_products').delete().eq('purchase_id', p.purchase_id);
            } catch {
                // ignore
            }

            const { error } = await supabase.from(activeDbTable).delete().eq('purchase_id', p.purchase_id);
            if (error) throw error;

            toast.success(`Purchase ${p.purchase_no} deleted successfully.`);
            await logActivity('Purchase Deleted', `Deleted invoice ${p.purchase_no} (${p.supplier_name})`);
            loadData();
        } catch (err: any) {
            toast.error(`Delete failed: ${err.message}`);
        }
    };

    // Filter & Sort Invoices
    const filtered = useMemo(() => {
        return purchases.filter((p) => {
            if (search.trim()) {
                const q = search.toLowerCase();
                const matchNo = (p.purchase_no || '').toLowerCase().includes(q);
                const matchSupp = (p.supplier_name || '').toLowerCase().includes(q);
                const matchInv = (p.supplier_invoice || '').toLowerCase().includes(q);
                const matchBy = (p.created_by || '').toLowerCase().includes(q);
                const matchNotes = (p.notes || '').toLowerCase().includes(q);
                if (!matchNo && !matchSupp && !matchInv && !matchBy && !matchNotes) {
                    return false;
                }
            }

            if (filterSupplier !== 'All') {
                if ((p.supplier_name || '').trim().toLowerCase() !== filterSupplier.trim().toLowerCase()) {
                    return false;
                }
            }

            if (filterPayment !== 'All') {
                if ((p.payment_status || '').toLowerCase() !== filterPayment.toLowerCase()) {
                    return false;
                }
            }

            if (filterStatus !== 'All') {
                if ((p.status || '').toLowerCase() !== filterStatus.toLowerCase()) {
                    return false;
                }
            }

            if (dateFrom && p.purchase_date < dateFrom) return false;
            if (dateTo && p.purchase_date > dateTo) return false;

            return true;
        }).sort((a, b) => {
            if (sortBy === 'newest') return (b.purchase_id || 0) - (a.purchase_id || 0);
            if (sortBy === 'oldest') return (a.purchase_id || 0) - (b.purchase_id || 0);
            if (sortBy === 'amount_high') return (Number(b.grand_total) || 0) - (Number(a.grand_total) || 0);
            if (sortBy === 'amount_low') return (Number(a.grand_total) || 0) - (Number(b.grand_total) || 0);
            if (sortBy === 'inv_asc') return (a.purchase_no || '').localeCompare(b.purchase_no || '');
            if (sortBy === 'supplier') return (a.supplier_name || '').localeCompare(b.supplier_name || '');
            return 0;
        });
    }, [purchases, search, filterSupplier, filterPayment, filterStatus, dateFrom, dateTo, sortBy]);

    // Pagination
    const totalPages = pageSize === -1 ? 1 : Math.max(1, Math.ceil(filtered.length / pageSize));
    const paginated = useMemo(() => {
        if (pageSize === -1) return filtered;
        const start = (currentPage - 1) * pageSize;
        return filtered.slice(start, start + pageSize);
    }, [filtered, currentPage, pageSize]);

    // KPI Metrics
    const kpis = useMemo(() => {
        const totalCount = purchases.length;
        const totalSpend = purchases.reduce((sum, p) => sum + (Number(p.grand_total) || 0), 0);
        const paidPurchases = purchases.filter((p) => (p.payment_status || '').toLowerCase() === 'paid');
        const paidSpend = paidPurchases.reduce((sum, p) => sum + (Number(p.grand_total) || 0), 0);
        const unpaidPurchases = purchases.filter((p) => (p.payment_status || '').toLowerCase() !== 'paid');
        const unpaidDebt = unpaidPurchases.reduce((sum, p) => sum + (Number(p.grand_total) || 0), 0);
        const avgOrder = totalCount > 0 ? Math.round(totalSpend / totalCount) : 0;

        let totalUnits = 0;
        Object.values(purchaseItemsCache).forEach((items) => {
            items.forEach((it) => {
                totalUnits += Number(it.quantity) || 0;
            });
        });

        const vendorSpendMap = new Map<string, number>();
        purchases.forEach((p) => {
            const name = p.supplier_name || 'Generic Vendor';
            vendorSpendMap.set(name, (vendorSpendMap.get(name) || 0) + (Number(p.grand_total) || 0));
        });
        let topVendor = 'None';
        let topSpend = 0;
        vendorSpendMap.forEach((val, key) => {
            if (val > topSpend) {
                topSpend = val;
                topVendor = key;
            }
        });

        return {
            totalCount,
            totalSpend,
            totalUnits,
            paidCount: paidPurchases.length,
            paidSpend,
            unpaidCount: unpaidPurchases.length,
            unpaidDebt,
            avgOrder,
            topVendor,
            topSpend,
        };
    }, [purchases, purchaseItemsCache]);

    // Date range presets
    const applyDatePreset = (preset: 'today' | 'week' | 'month' | 'quarter' | 'all') => {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        if (preset === 'all') {
            setDateFrom('');
            setDateTo('');
        } else if (preset === 'today') {
            setDateFrom(todayStr);
            setDateTo(todayStr);
        } else if (preset === 'week') {
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            setDateFrom(weekAgo.toISOString().split('T')[0]);
            setDateTo(todayStr);
        } else if (preset === 'month') {
            const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);
            setDateFrom(monthAgo.toISOString().split('T')[0]);
            setDateTo(todayStr);
        } else if (preset === 'quarter') {
            const quarterAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            setDateFrom(quarterAgo.toISOString().split('T')[0]);
            setDateTo(todayStr);
        }
        setCurrentPage(1);
    };

    // Bulk selection
    const handleSelectAll = (checked: boolean) => {
        if (checked) setSelectedIds(new Set(paginated.map((p) => p.purchase_id)));
        else setSelectedIds(new Set());
    };

    const handleSelectOne = (id: number) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    // Excel Export
    const exportBrightExcel = () => {
        if (filtered.length === 0) {
            toast.error('No purchases to export');
            return;
        }

        const genDate = new Date().toLocaleString('en-GB');
        const totalGrand = filtered.reduce((acc, p) => acc + (Number(p.grand_total) || 0), 0);
        const totalSub = filtered.reduce((acc, p) => acc + (Number(p.sub_total) || 0), 0);
        const totalDisc = filtered.reduce((acc, p) => acc + (Number(p.discount) || 0), 0);

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
  <Style ss:ID="TitleBanner">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="16" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#00C853" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="MetaBanner">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#0091EA" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="KpiHdrBlue">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="9" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#2979FF" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="KpiValBlue">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="13" ss:Bold="1" ss:Color="#0D47A1"/>
   <Interior ss:Color="#E3F2FD" ss:Pattern="Solid"/>
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
  <Style ss:ID="ColHeader">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#1E293B" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#00C853"/>
   </Borders>
  </Style>
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
  <Style ss:ID="CellCurrency">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="&quot;Ksh &quot;#,##0.00"/>
  </Style>
  <Style ss:ID="BadgePaid">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="9.5" ss:Bold="1" ss:Color="#1B5E20"/>
   <Interior ss:Color="#C8E6C9" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="BadgeUnpaid">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="9.5" ss:Bold="1" ss:Color="#B71C1C"/>
   <Interior ss:Color="#FFCDD2" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="SummaryLabel">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#1E293B" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="SummaryVal">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#00E676"/>
   <Interior ss:Color="#1E293B" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="&quot;Ksh &quot;#,##0.00"/>
  </Style>
 </Styles>

 <Worksheet ss:Name="Purchases Ledger">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="85"/>
   <Column ss:Width="80"/>
   <Column ss:Width="160"/>
   <Column ss:Width="95"/>
   <Column ss:Width="110"/>
   <Column ss:Width="95"/>
   <Column ss:Width="80"/>
   <Column ss:Width="105"/>
   <Column ss:Width="80"/>
   <Column ss:Width="85"/>
   <Column ss:Width="120"/>

   <Row ss:Height="34">
    <Cell ss:MergeAcross="10" ss:StyleID="TitleBanner"><Data ss:Type="String">ALPHA PHARMACY - PROCUREMENT &amp; PURCHASES MASTER AUDIT</Data></Cell>
   </Row>

   <Row ss:Height="20">
    <Cell ss:MergeAcross="10" ss:StyleID="MetaBanner"><Data ss:Type="String">Generated: ${genDate} | Outlet: ${escapeXml(outletName)} | Database: ${escapeXml(activeDbTable)} | Count: ${filtered.length} Orders</Data></Cell>
   </Row>

   <Row ss:Height="18">
    <Cell ss:MergeAcross="3" ss:StyleID="KpiHdrBlue"><Data ss:Type="String">TOTAL PROCUREMENT ORDERS</Data></Cell>
    <Cell ss:MergeAcross="3" ss:StyleID="KpiHdrGreen"><Data ss:Type="String">LIFETIME PROCUREMENT VOLUME</Data></Cell>
    <Cell ss:MergeAcross="3" ss:StyleID="KpiHdrRed"><Data ss:Type="String">OUTSTANDING CREDIT / DEBT</Data></Cell>
   </Row>
   <Row ss:Height="24">
    <Cell ss:MergeAcross="3" ss:StyleID="KpiValBlue"><Data ss:Type="String">${filtered.length} Orders in Range</Data></Cell>
    <Cell ss:MergeAcross="3" ss:StyleID="KpiValGreen"><Data ss:Type="Number">${totalGrand}</Data></Cell>
    <Cell ss:MergeAcross="3" ss:StyleID="KpiValRed"><Data ss:Type="Number">${kpis.unpaidDebt}</Data></Cell>
   </Row>

   <Row ss:Height="10"/>

   <Row ss:Height="24">
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">PURCHASE #</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">DATE</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">SUPPLIER / DISTRIBUTOR</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">DELIVERY / INV #</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">ITEMS &amp; QTY</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">SUBTOTAL</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">DISCOUNT</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">GRAND TOTAL</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">PAYMENT</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">STATUS</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">RECEIVED BY</Data></Cell>
   </Row>

   ${filtered
       .map((p) => {
           const isPaid = (p.payment_status || '').toLowerCase() === 'paid';
           const items = purchaseItemsCache[p.purchase_id] || [];
           const qtySum = items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
           const qtyStr = items.length > 0 ? `${qtySum} Units (${items.length} lines)` : '—';
           return `<Row ss:Height="20">
    <Cell ss:StyleID="CellTextBold"><Data ss:Type="String">${escapeXml(p.purchase_no)}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXml(p.purchase_date)}</Data></Cell>
    <Cell ss:StyleID="CellTextBold"><Data ss:Type="String">${escapeXml(p.supplier_name)}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXml(p.supplier_invoice || '—')}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXml(qtyStr)}</Data></Cell>
    <Cell ss:StyleID="CellCurrency"><Data ss:Type="Number">${p.sub_total || 0}</Data></Cell>
    <Cell ss:StyleID="CellCurrency"><Data ss:Type="Number">${p.discount || 0}</Data></Cell>
    <Cell ss:StyleID="CellCurrency"><Data ss:Type="Number">${p.grand_total || 0}</Data></Cell>
    <Cell ss:StyleID="${isPaid ? 'BadgePaid' : 'BadgeUnpaid'}"><Data ss:Type="String">${escapeXml(p.payment_status || 'Paid')}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXml(p.status || 'Completed')}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${escapeXml(p.created_by || 'Staff')}</Data></Cell>
   </Row>`;
       })
       .join('\n')}

   <Row ss:Height="24">
    <Cell ss:MergeAcross="4" ss:StyleID="SummaryLabel"><Data ss:Type="String">GRAND PROCUREMENT TOTALS:</Data></Cell>
    <Cell ss:StyleID="SummaryVal"><Data ss:Type="Number">${totalSub}</Data></Cell>
    <Cell ss:StyleID="SummaryVal"><Data ss:Type="Number">${totalDisc}</Data></Cell>
    <Cell ss:StyleID="SummaryVal"><Data ss:Type="Number">${totalGrand}</Data></Cell>
    <Cell ss:MergeAcross="2" ss:StyleID="SummaryLabel"><Data ss:Type="String">—</Data></Cell>
   </Row>
  </Table>
 </Worksheet>
</Workbook>`;

        const blob = new Blob([xmlString], { type: 'application/vnd.ms-excel;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AlphaPharmacy_Purchases_Ledger_${new Date().toISOString().split('T')[0]}_SuperPremium.xls`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`Exported ${filtered.length} purchase orders to Super Bright Excel!`);
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-96">
                <div className="w-14 h-14 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                <p className="mt-4 text-gray-900 font-bold text-base">Loading Purchases &amp; Procurement Register...</p>
                <p className="text-xs text-gray-500 mt-1">Connecting to active invoices, line items &amp; vendor accounts</p>
            </div>
        );
    }

    return (
        <div className="w-full max-w-full min-w-0 space-y-3.5 pb-16">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 md:p-5 rounded-3xl border border-gray-200 shadow-xs min-w-0">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl flex items-center justify-center text-white text-xl shadow-md shrink-0">
                        📋
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">Purchases Master Register &amp; Ledger</h1>
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded-full text-xs font-bold border border-emerald-200 shrink-0">
                                Enterprise Audit
                            </span>
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-900 rounded-md text-[11px] font-bold border border-blue-200 shrink-0">
                                DB: {activeDbTable}
                            </span>
                        </div>
                        <p className="text-gray-600 text-xs mt-0.5 truncate">
                            Active Outlet: <span className="font-bold text-gray-900">{outletName}</span> • Audit supplier deliveries, itemized received batches &amp; settlement status
                        </p>
                    </div>
                </div>

                <div className="flex items-center flex-wrap gap-2 shrink-0">
                    <Link
                        href="/dashboard/purchase"
                        className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl font-bold shadow-xs transition-all flex items-center gap-1.5 text-xs active:scale-95"
                    >
                        <span>📥</span> Receive New GRN
                    </Link>

                    <Link
                        href="/dashboard/suppliers"
                        className="px-3 py-2 bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 rounded-xl font-bold shadow-xs transition-all flex items-center gap-1.5 text-xs"
                    >
                        <span>🏢</span> Vendors
                    </Link>

                    <button
                        onClick={exportBrightExcel}
                        className="px-3 py-2 bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 rounded-xl font-bold shadow-xs transition-all flex items-center gap-1.5 text-xs"
                        title="Download Massive Styled Excel Workbook"
                    >
                        <span>📊</span> Super Excel
                    </button>

                    <button
                        onClick={() => window.print()}
                        className="px-3 py-2 bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 rounded-xl font-bold shadow-xs transition-all flex items-center gap-1 text-xs"
                    >
                        <span>🖨️</span> Print
                    </button>

                    <button
                        onClick={() => {
                            loadData();
                            toast.success('Purchases reloaded from live DB!');
                        }}
                        className="px-3 py-2 bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 rounded-xl font-bold shadow-xs transition-all flex items-center gap-1 text-xs"
                    >
                        <span>🔄</span> Refresh
                    </button>
                </div>
            </div>

            {/* 6 Responsive High-Impact Stat KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5 w-full min-w-0">
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-3.5 border border-emerald-100 shadow-xs relative overflow-hidden min-w-0">
                    <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider truncate">Total Procurement</p>
                    <p className="text-lg font-black text-emerald-950 mt-1 truncate">Ksh {kpis.totalSpend.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-600 font-medium mt-0.5">{kpis.totalCount} Invoices in DB</p>
                </div>

                <div className="bg-gradient-to-br from-teal-50 to-emerald-100 rounded-2xl p-3.5 border border-teal-200 shadow-xs relative overflow-hidden min-w-0">
                    <p className="text-[10px] font-bold text-teal-800 uppercase tracking-wider truncate">Total Units Received</p>
                    <p className="text-lg font-black text-teal-950 mt-1 truncate">📦 {kpis.totalUnits.toLocaleString()} Units</p>
                    <p className="text-[10px] text-teal-800 font-medium mt-0.5">Physical Stock Intake</p>
                </div>

                <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-2xl p-3.5 border border-cyan-100 shadow-xs relative overflow-hidden min-w-0">
                    <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider truncate">Settled &amp; Paid</p>
                    <p className="text-lg font-black text-blue-950 mt-1 truncate">Ksh {kpis.paidSpend.toLocaleString()}</p>
                    <p className="text-[10px] text-blue-800 font-bold mt-0.5">{kpis.paidCount} Cleared Invoices</p>
                </div>

                <div className="bg-gradient-to-br from-rose-50 to-red-50 rounded-2xl p-3.5 border border-rose-100 shadow-xs relative overflow-hidden min-w-0">
                    <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wider truncate">Payables Due</p>
                    <p className="text-lg font-black text-rose-950 mt-1 truncate">Ksh {kpis.unpaidDebt.toLocaleString()}</p>
                    <p className="text-[10px] text-red-700 font-bold mt-0.5">{kpis.unpaidCount} Pending Settlement</p>
                </div>

                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-3.5 border border-indigo-100 shadow-xs relative overflow-hidden min-w-0">
                    <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider truncate">Average Order</p>
                    <p className="text-lg font-black text-indigo-950 mt-1 truncate">Ksh {kpis.avgOrder.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-600 font-medium mt-0.5">Mean Invoice Size</p>
                </div>

                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-3.5 border border-amber-100 shadow-xs relative overflow-hidden min-w-0">
                    <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider truncate">Top Partner</p>
                    <p className="text-sm font-black text-amber-950 mt-1 truncate" title={kpis.topVendor}>
                        {kpis.topVendor}
                    </p>
                    <p className="text-[10px] text-amber-800 font-bold mt-0.5 truncate">Ksh {kpis.topSpend.toLocaleString()}</p>
                </div>
            </div>

            {/* Responsive Multi-Dimensional Filter Suite */}
            <div className="bg-white rounded-3xl p-4 md:p-5 border border-gray-200 shadow-xs space-y-3 min-w-0">
                <div className="flex flex-wrap items-center gap-2 w-full min-w-0">
                    {/* Omni-Search */}
                    <div className="relative flex-1 min-w-[200px] max-w-full">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setCurrentPage(1);
                            }}
                            placeholder="Search by Invoice # (INV-01), vendor, ref, notes..."
                            className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold focus:bg-white focus:border-emerald-600 outline-none text-gray-900"
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
                        className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:border-emerald-600 outline-none shrink-0"
                    >
                        <option value="All">All Distributors</option>
                        {suppliers.map((s) => (
                            <option key={s.supplier_id} value={s.supplier_name}>{s.supplier_name}</option>
                        ))}
                    </select>

                    {/* Filter Payment */}
                    <select
                        value={filterPayment}
                        onChange={(e) => {
                            setFilterPayment(e.target.value as any);
                            setCurrentPage(1);
                        }}
                        className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:border-emerald-600 outline-none shrink-0"
                    >
                        <option value="All">All Payment States</option>
                        <option value="Paid">Paid / Settled</option>
                        <option value="Unpaid">Unpaid / On Credit</option>
                        <option value="Partial">Partial Settlement</option>
                    </select>

                    {/* Sort Options */}
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:border-emerald-600 outline-none shrink-0"
                    >
                        <option value="newest">Sort: Newest First</option>
                        <option value="oldest">Sort: Oldest First</option>
                        <option value="amount_high">Sort: Amount (High→Low)</option>
                        <option value="amount_low">Sort: Amount (Low→High)</option>
                        <option value="inv_asc">Sort: Invoice #</option>
                        <option value="supplier">Sort: Supplier Name</option>
                    </select>

                    {/* Auto-Fit dense toggle */}
                    <button
                        onClick={() => setIsAutoFit(!isAutoFit)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 shrink-0 ${
                            isAutoFit
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                        title="Toggle dense datagrid layout"
                    >
                        <span>⛶</span> {isAutoFit ? 'Dense View' : 'Standard'}
                    </button>
                </div>

                {/* Date Filter & Presets Row */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 text-xs font-bold text-gray-700 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-gray-500 text-[11px]">Date Range:</span>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => {
                                setDateFrom(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="px-2 py-1 bg-gray-50 border border-gray-300 rounded-lg text-xs font-mono text-gray-900"
                        />
                        <span className="text-gray-400 text-xs">to</span>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => {
                                setDateTo(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="px-2 py-1 bg-gray-50 border border-gray-300 rounded-lg text-xs font-mono text-gray-900"
                        />
                        {(dateFrom || dateTo) && (
                            <button
                                onClick={() => {
                                    setDateFrom('');
                                    setDateTo('');
                                    setCurrentPage(1);
                                }}
                                className="text-[11px] text-red-600 hover:underline font-bold"
                            >
                                Clear
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-gray-500 text-[11px]">Presets:</span>
                        {[
                            { id: 'today', label: 'Today' },
                            { id: 'week', label: '7 Days' },
                            { id: 'month', label: 'This Month' },
                            { id: 'quarter', label: '90 Days' },
                            { id: 'all', label: 'All Time' },
                        ].map((pr) => (
                            <button
                                key={pr.id}
                                onClick={() => applyDatePreset(pr.id as any)}
                                className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-[11px] font-bold transition"
                            >
                                {pr.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Fit-To-Page Streamlined Purchases DataGrid Table */}
            <div className="bg-white rounded-3xl border border-gray-200 shadow-md overflow-hidden w-full min-w-0">
                <div className="overflow-x-auto w-full">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-slate-900 border-b-2 border-emerald-500 text-white font-black uppercase text-[11px] tracking-wider">
                            <tr>
                                <th className="p-2.5 text-white text-center w-8">#</th>
                                <th className="p-2.5 text-white w-8 text-center">
                                    <input
                                        type="checkbox"
                                        checked={paginated.length > 0 && selectedIds.size === paginated.length}
                                        onChange={(e) => handleSelectAll(e.target.checked)}
                                        className="rounded border-gray-400 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                    />
                                </th>
                                <th className="p-2.5 text-white whitespace-nowrap">Invoice / GRN #</th>
                                <th className="p-2.5 text-white whitespace-nowrap">Date &amp; Received By</th>
                                <th className="p-2.5 text-white whitespace-nowrap">Distributor &amp; Delivery Ref</th>
                                <th className="p-2.5 text-white text-center whitespace-nowrap">Items &amp; Qty Received</th>
                                <th className="p-2.5 text-white text-right whitespace-nowrap">Grand Total</th>
                                <th className="p-2.5 text-white text-center whitespace-nowrap">Payment &amp; Status</th>
                                <th className="p-2.5 text-white text-center w-28 whitespace-nowrap">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-gray-900 font-medium">
                            {paginated.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="p-12 text-center text-gray-500">
                                        <div className="text-4xl mb-2">📋</div>
                                        <p className="font-bold text-gray-800 text-sm">No purchase orders found</p>
                                        <p className="text-xs text-gray-500 mt-1">Try clearing your filters or create a new GRN</p>
                                    </td>
                                </tr>
                            ) : (
                                paginated.map((p) => {
                                    const isSelected = selectedIds.has(p.purchase_id);
                                    const isPaid = (p.payment_status || '').toLowerCase() === 'paid';
                                    const isExpanded = expandedRows.has(p.purchase_id);
                                    const items = purchaseItemsCache[p.purchase_id] || [];
                                    const isRowLoading = loadingItemsMap.has(p.purchase_id);
                                    const totalUnitsInInvoice = items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);

                                    return (
                                        <Fragment key={p.purchase_id}>
                                            <tr
                                                className={`hover:bg-emerald-50/50 transition-colors border-b border-gray-100 cursor-pointer ${
                                                    isSelected ? 'bg-emerald-50/70' : isExpanded ? 'bg-emerald-50/40' : ''
                                                }`}
                                                onClick={() => toggleRow(p)}
                                            >
                                                {/* Chevron Dropdown Toggle */}
                                                <td className="p-2.5 text-center" onClick={(e) => { e.stopPropagation(); toggleRow(p); }}>
                                                    <button
                                                        type="button"
                                                        className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold transition-all ${
                                                            isExpanded
                                                                ? 'bg-emerald-600 text-white rotate-90 shadow-xs'
                                                                : 'bg-gray-100 text-gray-700 hover:bg-emerald-100 hover:text-emerald-800'
                                                        }`}
                                                        title={isExpanded ? 'Collapse line items' : 'Click to expand invoice items'}
                                                    >
                                                        ▶
                                                    </button>
                                                </td>

                                                {/* Checkbox */}
                                                <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => handleSelectOne(p.purchase_id)}
                                                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                                    />
                                                </td>

                                                {/* Purchase / GRN # */}
                                                <td className="p-2.5 whitespace-nowrap">
                                                    <span className="px-2.5 py-1 bg-blue-50 text-blue-900 font-mono font-black rounded-lg border border-blue-200 inline-flex items-center gap-1.5 shadow-xs">
                                                        <span>📄</span>
                                                        {p.purchase_no}
                                                    </span>
                                                </td>

                                                {/* Date & Received By (Stacked to save horizontal space) */}
                                                <td className="p-2.5 whitespace-nowrap text-gray-800">
                                                    <span className="font-bold font-mono text-gray-900 block">{p.purchase_date}</span>
                                                    <span className="text-[10px] text-gray-400 block font-medium">By: {p.created_by || 'Pharmacist'}</span>
                                                </td>

                                                {/* Distributor & Delivery Ref (Stacked) */}
                                                <td className="p-2.5 whitespace-nowrap">
                                                    <p className="font-black text-gray-950">{p.supplier_name}</p>
                                                    <span className="text-[10px] font-mono text-gray-500 block">
                                                        Ref: {p.supplier_invoice || '—'}
                                                    </span>
                                                </td>

                                                {/* Received Items & Qty */}
                                                <td className="p-2.5 text-center whitespace-nowrap">
                                                    {isRowLoading ? (
                                                        <span className="text-[11px] text-gray-400 font-bold animate-pulse">Loading...</span>
                                                    ) : items.length > 0 ? (
                                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs">
                                                            <span>📦</span>
                                                            <span>{totalUnitsInInvoice} Units</span>
                                                            <span className="text-emerald-700 font-normal">({items.length} {items.length === 1 ? 'line' : 'lines'})</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400 font-mono text-[11px]">Click to view</span>
                                                    )}
                                                </td>

                                                {/* Grand Total */}
                                                <td className="p-2.5 text-right whitespace-nowrap">
                                                    <span className="font-mono font-black text-emerald-950 text-sm block">
                                                        Ksh {(p.grand_total || 0).toLocaleString()}
                                                    </span>
                                                    {p.discount ? (
                                                        <span className="text-[10px] font-mono text-red-600 font-semibold block">
                                                            Disc: -Ksh {Number(p.discount).toLocaleString()}
                                                        </span>
                                                    ) : null}
                                                </td>

                                                {/* Payment & Status (Stacked) */}
                                                <td className="p-2.5 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex flex-col items-center gap-1">
                                                        <button
                                                            onClick={() => handleOpenPaymentUpdate(p)}
                                                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border transition-colors shadow-2xs ${
                                                                isPaid
                                                                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200'
                                                                    : 'bg-rose-100 text-rose-900 border-rose-300 hover:bg-rose-200'
                                                            }`}
                                                            title="Click to update payment settlement"
                                                        >
                                                            {isPaid ? '✓ Paid' : '⏳ Due'}
                                                        </button>
                                                        <span className="text-[9px] text-gray-500 font-bold uppercase">
                                                            {p.status || 'Completed'}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Actions */}
                                                <td className="p-2.5 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button
                                                            onClick={() => toggleRow(p)}
                                                            className={`p-1.5 rounded-lg transition-colors ${isExpanded ? 'bg-emerald-600 text-white' : 'bg-gray-100 hover:bg-emerald-100 text-gray-700'}`}
                                                            title="Toggle Individual Items Dropdown"
                                                        >
                                                            <span>📦</span>
                                                        </button>
                                                        <button
                                                            onClick={() => handleViewDossier(p)}
                                                            className="p-1.5 bg-gray-100 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors"
                                                            title="View Full 360° Dossier &amp; Print"
                                                        >
                                                            👁️
                                                        </button>
                                                        <button
                                                            onClick={() => handleOpenPaymentUpdate(p)}
                                                            className="p-1.5 bg-gray-100 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors"
                                                            title="Update Payment Settlement"
                                                        >
                                                            💳
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeletePurchase(p)}
                                                            className="p-1.5 bg-gray-100 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors"
                                                            title="Delete Purchase Record"
                                                        >
                                                            🗑️
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* EXPANDED INLINE ITEMS ACCORDION (100% Fit-to-Page) */}
                                            {isExpanded && (
                                                <tr className="bg-emerald-50/20">
                                                    <td colSpan={9} className="p-2 sm:p-3 md:p-4">
                                                        <div className="bg-white rounded-2xl border-2 border-emerald-300 shadow-sm p-3 md:p-4 space-y-3 w-full min-w-0">
                                                            {/* Header banner */}
                                                            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-gray-100 min-w-0">
                                                                <div className="flex items-center gap-2.5 min-w-0">
                                                                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center text-sm font-bold shadow-2xs shrink-0">
                                                                        📦
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <div className="flex items-center gap-2 flex-wrap">
                                                                            <h4 className="font-black text-xs text-gray-900 tracking-tight">
                                                                                Invoice #{p.purchase_no} — Itemized Stock Receipts &amp; Batches
                                                                            </h4>
                                                                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 shrink-0">
                                                                                FEFO Live Batch Tracked
                                                                            </span>
                                                                        </div>
                                                                        <p className="text-[11px] text-gray-500 font-medium mt-0.5 truncate">
                                                                            Supplier: <span className="font-bold text-gray-800">{p.supplier_name}</span> • Delivery Ref: <span className="font-mono text-gray-700">{p.supplier_invoice || '—'}</span> • Received: {p.purchase_date}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-1.5 shrink-0">
                                                                    <span className="px-2.5 py-1 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-lg text-xs font-black">
                                                                        Total Qty: {totalUnitsInInvoice} Units
                                                                    </span>
                                                                    <span className="px-2.5 py-1 bg-blue-50 text-blue-900 border border-blue-200 rounded-lg text-xs font-black">
                                                                        {items.length} {items.length === 1 ? 'Line' : 'Lines'}
                                                                    </span>
                                                                    <button
                                                                        onClick={() => handleViewDossier(p)}
                                                                        className="px-2.5 py-1 bg-slate-900 hover:bg-black text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs"
                                                                    >
                                                                        <span>📑</span> Dossier
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Items Sub-table */}
                                                            {isRowLoading ? (
                                                                <div className="p-6 text-center text-gray-500">
                                                                    <div className="w-7 h-7 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-2" />
                                                                    <p className="text-xs font-bold text-gray-700">Loading invoice line items &amp; batch lots...</p>
                                                                </div>
                                                            ) : items.length === 0 ? (
                                                                <div className="p-6 text-center text-gray-400 border border-dashed border-gray-200 rounded-xl">
                                                                    <p className="font-bold text-gray-700 text-xs">No individual line items registered for this invoice.</p>
                                                                    <p className="text-[11px] text-gray-400 mt-1">Invoice master record total: Ksh {Number(p.grand_total).toLocaleString()}</p>
                                                                </div>
                                                            ) : (
                                                                <div className="overflow-x-auto border border-gray-200 rounded-xl w-full">
                                                                    <table className="w-full text-xs">
                                                                        <thead className="bg-gray-100 text-gray-800 font-black uppercase text-[10px] tracking-wider border-b border-gray-200">
                                                                            <tr>
                                                                                <th className="p-2 text-left w-7 text-gray-700">#</th>
                                                                                <th className="p-2 text-left text-gray-700 min-w-[140px]">Medicine / Product</th>
                                                                                <th className="p-2 text-left text-gray-700 whitespace-nowrap">Batch / Lot #</th>
                                                                                <th className="p-2 text-left text-gray-700 whitespace-nowrap">Expiry Date</th>
                                                                                <th className="p-2 text-right text-gray-700 whitespace-nowrap">Received Qty</th>
                                                                                <th className="p-2 text-right text-gray-700 whitespace-nowrap">Unit Cost (Ksh)</th>
                                                                                <th className="p-2 text-right text-gray-700 whitespace-nowrap">Selling Price (Ksh)</th>
                                                                                <th className="p-2 text-right text-gray-700 whitespace-nowrap">Line Total (Ksh)</th>
                                                                                <th className="p-2 text-center text-gray-700 whitespace-nowrap">In Stock</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-gray-100 text-gray-900 font-medium">
                                                                            {items.map((it, idx) => {
                                                                                const lineTot = Number(it.total_amount) || (Number(it.quantity) * Number(it.rate));
                                                                                return (
                                                                                    <tr key={it.id || idx} className="hover:bg-emerald-50/30 transition">
                                                                                        <td className="p-2 text-gray-400 font-bold">{idx + 1}</td>
                                                                                        <td className="p-2">
                                                                                            <p className="font-black text-gray-900">{it.product_name}</p>
                                                                                            <span className="text-[10px] font-mono text-gray-400">{it.product_code}</span>
                                                                                        </td>
                                                                                        <td className="p-2 whitespace-nowrap">
                                                                                            <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-indigo-50 text-indigo-800 border border-indigo-200">
                                                                                                {it.batch_number || 'N/A'}
                                                                                            </span>
                                                                                        </td>
                                                                                        <td className="p-2 whitespace-nowrap font-mono text-gray-700 font-semibold">
                                                                                            {it.expiry_date || '—'}
                                                                                        </td>
                                                                                        <td className="p-2 text-right whitespace-nowrap">
                                                                                            <span className="font-black text-sm text-gray-900">
                                                                                                {it.quantity}
                                                                                            </span>
                                                                                            <span className="text-gray-500 text-[11px] ml-1">{it.unit || 'Piece'}</span>
                                                                                        </td>
                                                                                        <td className="p-2 text-right font-mono font-semibold text-gray-700 whitespace-nowrap">
                                                                                            Ksh {Number(it.rate || 0).toLocaleString()}
                                                                                        </td>
                                                                                        <td className="p-2 text-right font-mono font-semibold text-emerald-800 whitespace-nowrap">
                                                                                            Ksh {Number(it.sales_cost || 0).toLocaleString()}
                                                                                        </td>
                                                                                        <td className="p-2 text-right font-mono font-black text-gray-950 whitespace-nowrap">
                                                                                            Ksh {lineTot.toLocaleString()}
                                                                                        </td>
                                                                                        <td className="p-2 text-center whitespace-nowrap">
                                                                                            {it.remaining_qty !== undefined ? (
                                                                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                                                                                                    {it.remaining_qty} remaining
                                                                                                </span>
                                                                                            ) : (
                                                                                                <span className="text-gray-300">—</span>
                                                                                            )}
                                                                                        </td>
                                                                                    </tr>
                                                                                );
                                                                            })}
                                                                            {/* Sub-total summary row */}
                                                                            <tr className="bg-gray-50/80 font-black text-xs border-t-2 border-gray-200">
                                                                                <td colSpan={4} className="p-2 text-right uppercase text-gray-700 tracking-wider">
                                                                                    INVOICE TOTALS:
                                                                                </td>
                                                                                <td className="p-2 text-right font-black text-emerald-900 text-sm">
                                                                                    {totalUnitsInInvoice} Units
                                                                                </td>
                                                                                <td colSpan={2} className="p-2"></td>
                                                                                <td className="p-2 text-right font-black text-emerald-950 text-sm">
                                                                                    Ksh {(Number(p.grand_total) || items.reduce((s, it) => s + (Number(it.total_amount) || it.quantity * it.rate), 0)).toLocaleString()}
                                                                                </td>
                                                                                <td></td>
                                                                            </tr>
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Stepper */}
                <div className="p-3 md:p-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-700 font-semibold min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span>Showing {paginated.length} of {filtered.length} purchases</span>
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
                                                ? 'bg-emerald-600 text-white'
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
                MODAL 1: 360° INVOICE DOSSIER & ITEMIZED BATCH BREAKDOWN
            ===================================================================== */}
            {showDossierModal && activePurchase && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 animate-fadeIn">
                    <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
                        <div className="p-4 md:p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-xl font-bold">
                                    📋
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-lg font-black tracking-tight">Invoice #{activePurchase.purchase_no}</h2>
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                            (activePurchase.payment_status || '').toLowerCase() === 'paid'
                                                ? 'bg-emerald-100 text-emerald-900'
                                                : 'bg-red-100 text-red-900'
                                        }`}>
                                            {activePurchase.payment_status || 'Paid'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-300">
                                        Vendor: <span className="font-bold text-white">{activePurchase.supplier_name}</span> • Received on {activePurchase.purchase_date}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowDossierModal(false)}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold text-sm"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 md:p-4 bg-gray-50 border-b border-gray-200 text-xs">
                            <div className="bg-white p-3 rounded-xl border border-gray-200">
                                <p className="text-[10px] text-gray-500 font-bold uppercase">Subtotal</p>
                                <p className="text-base font-black text-gray-900">
                                    Ksh {(activePurchase.sub_total || 0).toLocaleString()}
                                </p>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-gray-200">
                                <p className="text-[10px] text-gray-500 font-bold uppercase">Discount</p>
                                <p className="text-base font-black text-gray-900">
                                    Ksh {(activePurchase.discount || 0).toLocaleString()}
                                </p>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-gray-200">
                                <p className="text-[10px] text-gray-500 font-bold uppercase">Net Total</p>
                                <p className="text-base font-black text-emerald-900">
                                    Ksh {(activePurchase.grand_total || 0).toLocaleString()}
                                </p>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-gray-200">
                                <p className="text-[10px] text-gray-500 font-bold uppercase">Line Items</p>
                                <p className="text-base font-black text-blue-900">
                                    {purchaseLineItems.length} Products
                                </p>
                            </div>
                        </div>

                        <div className="p-4 md:p-5 overflow-y-auto flex-1 space-y-3">
                            <h3 className="font-black text-xs uppercase tracking-wider text-gray-900">
                                Itemized Merchandise &amp; Linked Batches
                            </h3>

                            {isLoadingItems ? (
                                <div className="p-8 text-center text-gray-500">
                                    <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                    <p className="font-bold text-xs">Loading itemized products...</p>
                                </div>
                            ) : purchaseLineItems.length === 0 ? (
                                <div className="p-8 text-center text-gray-500 border border-dashed border-gray-300 rounded-2xl">
                                    <p className="font-bold text-gray-800">No individual line items stored for this purchase</p>
                                    <p className="text-xs text-gray-500 mt-1">Invoice header is verified with total of Ksh {Number(activePurchase.grand_total).toLocaleString()}</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto border border-gray-200 rounded-2xl w-full">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-gray-100 text-[10px] font-black uppercase text-gray-900 border-b border-gray-200">
                                            <tr>
                                                <th className="p-2 text-gray-800">#</th>
                                                <th className="p-2 text-gray-800">Product Name</th>
                                                <th className="p-2 text-gray-800">Batch #</th>
                                                <th className="p-2 text-gray-800">Expiry Date</th>
                                                <th className="p-2 text-right text-gray-800">Received Qty</th>
                                                <th className="p-2 text-right text-gray-800">Unit Rate</th>
                                                <th className="p-2 text-right text-gray-800">Total Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 text-gray-900 font-medium">
                                            {purchaseLineItems.map((it, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50">
                                                    <td className="p-2 text-gray-400 font-bold">{idx + 1}</td>
                                                    <td className="p-2">
                                                        <p className="font-bold text-gray-900">{it.product_name}</p>
                                                        <span className="text-[10px] font-mono text-gray-500">{it.product_code}</span>
                                                    </td>
                                                    <td className="p-2 font-mono font-bold text-indigo-700 whitespace-nowrap">
                                                        {it.batch_number || 'N/A'}
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap">
                                                        {it.expiry_date || 'N/A'}
                                                    </td>
                                                    <td className="p-2 text-right font-mono font-bold whitespace-nowrap">
                                                        {it.quantity} {it.unit}
                                                    </td>
                                                    <td className="p-2 text-right font-mono whitespace-nowrap">
                                                        Ksh {(it.rate || 0).toLocaleString()}
                                                    </td>
                                                    <td className="p-2 text-right font-mono font-black text-gray-950 whitespace-nowrap">
                                                        Ksh {(it.total_amount || (it.quantity * it.rate)).toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {activePurchase.notes && (
                                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs">
                                    <p className="text-[10px] text-gray-500 font-bold uppercase mb-0.5">Invoice Notes</p>
                                    <p className="text-gray-800 whitespace-pre-wrap">{activePurchase.notes}</p>
                                </div>
                            )}
                        </div>

                        <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                            <button
                                onClick={() => window.print()}
                                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 flex items-center gap-1.5"
                            >
                                🖨️ Print Receipt
                            </button>
                            <button
                                onClick={() => setShowDossierModal(false)}
                                className="px-6 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-black"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* =====================================================================
                MODAL 2: UPDATE PAYMENT STATUS SETTLEMENT
            ===================================================================== */}
            {showPaymentModal && paymentPurchase && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
                    <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden">
                        <div className="p-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
                            <div>
                                <h3 className="font-black text-base">Update Payment Settlement</h3>
                                <p className="text-xs text-emerald-100">
                                    Invoice {paymentPurchase.purchase_no} • {paymentPurchase.supplier_name}
                                </p>
                            </div>
                            <button onClick={() => setShowPaymentModal(false)} className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center font-bold">✕</button>
                        </div>
                        <form onSubmit={handleSavePaymentStatus} className="p-6 space-y-4 text-xs font-bold text-gray-900">
                            <div className="bg-gray-50 p-3 rounded-2xl border border-gray-200 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] text-gray-500 uppercase font-black">Invoice Total</p>
                                    <p className="text-lg font-black text-gray-900">
                                        Ksh {(Number(paymentPurchase.grand_total) || 0).toLocaleString()}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-500 uppercase font-black">Current Status</p>
                                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900">
                                        {paymentPurchase.payment_status || 'Paid'}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label className="block mb-1">New Settlement Status *</label>
                                <select
                                    value={newPaymentStatus}
                                    onChange={(e) => setNewPaymentStatus(e.target.value as any)}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:bg-white focus:border-emerald-600 outline-none"
                                >
                                    <option value="Paid">Paid / Settled in Full</option>
                                    <option value="Unpaid">Unpaid / Added to Credit Debt</option>
                                    <option value="Partial">Partial Payment Made</option>
                                </select>
                            </div>

                            <div>
                                <label className="block mb-1">Payment Reference / Remarks</label>
                                <textarea
                                    rows={2}
                                    value={paymentNotes}
                                    onChange={(e) => setPaymentNotes(e.target.value)}
                                    placeholder="e.g. Paid via M-Pesa Paybill / Cheque #99281 on Nov 3"
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs text-gray-900 focus:bg-white focus:border-emerald-600 outline-none"
                                />
                            </div>

                            <div className="pt-3 border-t border-gray-200 flex items-center justify-between">
                                <button type="button" onClick={() => setShowPaymentModal(false)} className="px-4 py-2 bg-gray-100 text-gray-800 rounded-xl font-bold">
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isUpdatingPayment}
                                    className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl font-bold shadow-md disabled:opacity-50"
                                >
                                    {isUpdatingPayment ? 'Saving...' : 'Update Status'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
