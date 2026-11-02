'use client';
// =====================================================================
// Alpha Pharmacy - Super Massive Purchases Master Register & Audit Hub v2.0
// Ultra-Detailed Procurement Ledger, Invoice Breakdown, Dual DB Fallback,
// Live Batch & Expiry Traceability, 360° Dossier, Printable GRN & Super Bright Excel
// =====================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
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
    // Linked items count
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

    // =====================================================================
    // LOAD PURCHASES & VENDORS WITH DUAL-TABLE DATABASE FALLBACK
    // =====================================================================
    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            // 1. Fetch Purchases (pharmacy_purchases -> fallback to purchases & retail_purchases)
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

            // 2. Fetch Suppliers (pharmacy_suppliers -> fallback to suppliers)
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

    // View Invoice Dossier with Line Items & Linked Batches
    const handleViewDossier = async (p: PurchaseRecord) => {
        setActivePurchase(p);
        setShowDossierModal(true);
        setIsLoadingItems(true);

        try {
            // 1. Try fetching line items from pharmacy_purchase_products then retail_purchase_products
            let items: PurchaseItemDetail[] = [];
            const { data: pharmItems, error: pharmErr } = await supabase
                .from('pharmacy_purchase_products')
                .select('*')
                .eq('purchase_id', p.purchase_id);

            if (!pharmErr && pharmItems && pharmItems.length > 0) {
                items = pharmItems;
            } else {
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
                        pieces_per_package: r.pieces_per_package || 1,
                        rate: Number(r.rate) || 0,
                        sales_cost: Number(r.sales_cost) || 0,
                        total_amount: Number(r.total_amount) || (Number(r.quantity) * Number(r.rate)),
                    }));
                }
            }

            // 2. Fetch linked batches from pharmacy_batches matching this invoice #
            if (p.purchase_no) {
                const { data: batchData } = await supabase
                    .from('pharmacy_batches')
                    .select('batch_number, expiry_date, product_id')
                    .eq('purchase_invoice', p.purchase_no);

                if (batchData && batchData.length > 0) {
                    const batchMap = new Map<number, { batch_number: string; expiry_date: string }>();
                    batchData.forEach((b: any) => batchMap.set(b.product_id, b));

                    items = items.map((it) => {
                        const matched = batchMap.get(it.product_id);
                        return {
                            ...it,
                            batch_number: matched?.batch_number || it.batch_number || 'N/A',
                            expiry_date: matched?.expiry_date || it.expiry_date || 'N/A',
                        };
                    });
                }
            }

            setPurchaseLineItems(items);
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
            const { error } = await supabase
                .from(activeDbTable)
                .update({
                    payment_status: newPaymentStatus,
                    updated_at: new Date().toISOString(),
                    notes: `${paymentPurchase.notes || ''}\n[${new Date().toLocaleDateString()}] Payment updated to ${newPaymentStatus}: ${paymentNotes}`,
                })
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

    // Delete Invoice & Reverse Stock
    const handleDeletePurchase = async (p: PurchaseRecord) => {
        if (!confirm(`Are you sure you want to delete Invoice ${p.purchase_no}? This action will permanently remove the record.`)) {
            return;
        }

        try {
            // Delete line items
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

            // Delete master
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
            // Search text
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

            // Supplier filter
            if (filterSupplier !== 'All') {
                if ((p.supplier_name || '').trim().toLowerCase() !== filterSupplier.trim().toLowerCase()) {
                    return false;
                }
            }

            // Payment status
            if (filterPayment !== 'All') {
                if ((p.payment_status || '').toLowerCase() !== filterPayment.toLowerCase()) {
                    return false;
                }
            }

            // Invoice status
            if (filterStatus !== 'All') {
                if ((p.status || '').toLowerCase() !== filterStatus.toLowerCase()) {
                    return false;
                }
            }

            // Date Range
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

    // KPI Metrics Computation
    const kpis = useMemo(() => {
        const totalCount = purchases.length;
        const totalSpend = purchases.reduce((sum, p) => sum + (Number(p.grand_total) || 0), 0);
        const paidPurchases = purchases.filter((p) => (p.payment_status || '').toLowerCase() === 'paid');
        const paidSpend = paidPurchases.reduce((sum, p) => sum + (Number(p.grand_total) || 0), 0);
        const unpaidPurchases = purchases.filter((p) => (p.payment_status || '').toLowerCase() !== 'paid');
        const unpaidDebt = unpaidPurchases.reduce((sum, p) => sum + (Number(p.grand_total) || 0), 0);
        const avgOrder = totalCount > 0 ? Math.round(totalSpend / totalCount) : 0;

        // Top Vendor by spend
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
            paidCount: paidPurchases.length,
            paidSpend,
            unpaidCount: unpaidPurchases.length,
            unpaidDebt,
            avgOrder,
            topVendor,
            topSpend,
        };
    }, [purchases]);

    // Quick Date Range Presets
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

    // =====================================================================
    // BRIGHT COLORS EXCEL EXPORTER (SpreadsheetML XML)
    // Matches the exact high-voltage vivid styling of Batches / Suppliers
    // =====================================================================
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
  <!-- BRIGHT TITLE BANNERS -->
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

  <!-- VIVID KPI CARDS -->
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

  <!-- TABLE HEADER -->
  <Style ss:ID="ColHeader">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#1E293B" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#00C853"/>
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

  <!-- TOTALS -->
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
   <Column ss:Width="85"/>  <!-- Invoice No -->
   <Column ss:Width="80"/>  <!-- Date -->
   <Column ss:Width="160"/> <!-- Supplier -->
   <Column ss:Width="95"/>  <!-- Delivery Ref -->
   <Column ss:Width="95"/>  <!-- Subtotal -->
   <Column ss:Width="80"/>  <!-- Discount -->
   <Column ss:Width="105"/> <!-- Grand Total -->
   <Column ss:Width="80"/>  <!-- Payment -->
   <Column ss:Width="85"/>  <!-- Status -->
   <Column ss:Width="120"/> <!-- Received By -->

   <!-- Title Banner -->
   <Row ss:Height="34">
    <Cell ss:MergeAcross="9" ss:StyleID="TitleBanner"><Data ss:Type="String">ALPHA PHARMACY - PROCUREMENT &amp; PURCHASES MASTER AUDIT</Data></Cell>
   </Row>

   <!-- Meta Banner -->
   <Row ss:Height="20">
    <Cell ss:MergeAcross="9" ss:StyleID="MetaBanner"><Data ss:Type="String">Generated: ${genDate} | Outlet: ${escapeXml(outletName)} | Database: ${escapeXml(activeDbTable)} | Count: ${filtered.length} Orders</Data></Cell>
   </Row>

   <!-- KPI Cards Row -->
   <Row ss:Height="18">
    <Cell ss:MergeAcross="2" ss:StyleID="KpiHdrBlue"><Data ss:Type="String">TOTAL PROCUREMENT ORDERS</Data></Cell>
    <Cell ss:MergeAcross="3" ss:StyleID="KpiHdrGreen"><Data ss:Type="String">LIFETIME PROCUREMENT VOLUME</Data></Cell>
    <Cell ss:MergeAcross="3" ss:StyleID="KpiHdrRed"><Data ss:Type="String">OUTSTANDING CREDIT / DEBT</Data></Cell>
   </Row>
   <Row ss:Height="24">
    <Cell ss:MergeAcross="2" ss:StyleID="KpiValBlue"><Data ss:Type="String">${filtered.length} Orders in Range</Data></Cell>
    <Cell ss:MergeAcross="3" ss:StyleID="KpiValGreen"><Data ss:Type="Number">${totalGrand}</Data></Cell>
    <Cell ss:MergeAcross="3" ss:StyleID="KpiValRed"><Data ss:Type="Number">${kpis.unpaidDebt}</Data></Cell>
   </Row>

   <Row ss:Height="10"/>

   <!-- Table Headers -->
   <Row ss:Height="24">
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">PURCHASE #</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">DATE</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">SUPPLIER / DISTRIBUTOR</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">DELIVERY / INV #</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">SUBTOTAL</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">DISCOUNT</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">GRAND TOTAL</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">PAYMENT</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">STATUS</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">RECEIVED BY</Data></Cell>
   </Row>

   <!-- Rows -->
   ${filtered
       .map((p) => {
           const isPaid = (p.payment_status || '').toLowerCase() === 'paid';
           return `<Row ss:Height="20">
    <Cell ss:StyleID="CellTextBold"><Data ss:Type="String">${escapeXml(p.purchase_no)}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXml(p.purchase_date)}</Data></Cell>
    <Cell ss:StyleID="CellTextBold"><Data ss:Type="String">${escapeXml(p.supplier_name)}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXml(p.supplier_invoice || '—')}</Data></Cell>
    <Cell ss:StyleID="CellCurrency"><Data ss:Type="Number">${p.sub_total || 0}</Data></Cell>
    <Cell ss:StyleID="CellCurrency"><Data ss:Type="Number">${p.discount || 0}</Data></Cell>
    <Cell ss:StyleID="CellCurrency"><Data ss:Type="Number">${p.grand_total || 0}</Data></Cell>
    <Cell ss:StyleID="${isPaid ? 'BadgePaid' : 'BadgeUnpaid'}"><Data ss:Type="String">${escapeXml(p.payment_status || 'Paid')}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXml(p.status || 'Completed')}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${escapeXml(p.created_by || 'Staff')}</Data></Cell>
   </Row>`;
       })
       .join('\n')}

   <!-- Grand Summary Totals -->
   <Row ss:Height="24">
    <Cell ss:MergeAcross="3" ss:StyleID="SummaryLabel"><Data ss:Type="String">GRAND PROCUREMENT TOTALS:</Data></Cell>
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
            <div className="flex flex-col items-center justify-center h-96" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
                <div className="w-14 h-14 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                <p className="mt-4 text-gray-900 font-bold text-base">Loading Purchases &amp; Procurement Register...</p>
                <p className="text-xs text-gray-500 mt-1">Connecting to active invoices, line items &amp; vendor accounts</p>
            </div>
        );
    }

    return (
        <div className="w-full max-w-full space-y-4 px-1 md:px-2 pb-16" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg flex-shrink-0">
                        📋
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Purchases Master Register &amp; Ledger</h1>
                            <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-900 rounded-full text-xs font-bold border border-emerald-200">
                                Enterprise Audit
                            </span>
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-900 rounded-md text-[11px] font-bold border border-blue-200">
                                DB: {activeDbTable}
                            </span>
                        </div>
                        <p className="text-gray-600 text-xs mt-0.5">
                            Active Outlet: <span className="font-bold text-gray-900">{outletName}</span> • Audit supplier deliveries, GRN invoices, itemized pharmaceutical lot history &amp; settlement status
                        </p>
                    </div>
                </div>

                <div className="flex items-center flex-wrap gap-2">
                    {/* Link to Purchase Entry */}
                    <Link
                        href="/dashboard/purchase"
                        className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl font-bold shadow-sm hover:shadow transition-all flex items-center gap-1.5 text-xs active:scale-95"
                    >
                        <span>📥</span> Receive New GRN
                    </Link>

                    {/* Link to Suppliers */}
                    <Link
                        href="/dashboard/suppliers"
                        className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 rounded-xl font-bold shadow-xs transition-all flex items-center gap-1.5 text-xs"
                    >
                        <span>🏢</span> Vendors SRM
                    </Link>

                    {/* Bright Excel Export */}
                    <button
                        onClick={exportBrightExcel}
                        className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 rounded-xl font-bold shadow-xs transition-all flex items-center gap-1.5 text-xs"
                        title="Download Massive Styled Excel Workbook"
                    >
                        <span>📊</span> Super Excel
                    </button>

                    {/* Print Master View */}
                    <button
                        onClick={() => window.print()}
                        className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 rounded-xl font-bold shadow-xs transition-all flex items-center gap-1 text-xs"
                    >
                        <span>🖨️</span> Print
                    </button>

                    {/* Refresh Live DB */}
                    <button
                        onClick={() => {
                            loadData();
                            toast.success('Purchases reloaded from live DB!');
                        }}
                        className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 rounded-xl font-bold shadow-xs transition-all flex items-center gap-1 text-xs"
                    >
                        <span>🔄</span> Refresh
                    </button>
                </div>
            </div>

            {/* 6 Light Gradient Stat KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5 w-full">
                {/* Total Procurement Spend */}
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-3.5 border border-emerald-100 shadow-xs relative overflow-hidden">
                    <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Total Procurement</p>
                    <p className="text-lg font-black text-emerald-950 mt-1">Ksh {kpis.totalSpend.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-600 font-medium mt-0.5">{kpis.totalCount} Invoices in DB</p>
                </div>

                {/* Paid Spend */}
                <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-2xl p-3.5 border border-cyan-100 shadow-xs relative overflow-hidden">
                    <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Settled &amp; Paid</p>
                    <p className="text-lg font-black text-blue-950 mt-1">Ksh {kpis.paidSpend.toLocaleString()}</p>
                    <p className="text-[10px] text-blue-800 font-bold mt-0.5">{kpis.paidCount} Cleared Invoices</p>
                </div>

                {/* Outstanding Credit / Debt */}
                <div className="bg-gradient-to-br from-rose-50 to-red-50 rounded-2xl p-3.5 border border-rose-100 shadow-xs relative overflow-hidden">
                    <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">Payables Due</p>
                    <p className="text-lg font-black text-rose-950 mt-1">Ksh {kpis.unpaidDebt.toLocaleString()}</p>
                    <p className="text-[10px] text-red-700 font-bold mt-0.5">{kpis.unpaidCount} Pending Settlement</p>
                </div>

                {/* Average Order Value */}
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-3.5 border border-indigo-100 shadow-xs relative overflow-hidden">
                    <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Average Order</p>
                    <p className="text-lg font-black text-indigo-950 mt-1">Ksh {kpis.avgOrder.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-600 font-medium mt-0.5">Mean Invoice Size</p>
                </div>

                {/* Top Vendor */}
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-3.5 border border-amber-100 shadow-xs relative overflow-hidden">
                    <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Top Partner</p>
                    <p className="text-sm font-black text-amber-950 mt-1 truncate" title={kpis.topVendor}>
                        {kpis.topVendor}
                    </p>
                    <p className="text-[10px] text-amber-800 font-bold mt-0.5">Ksh {kpis.topSpend.toLocaleString()}</p>
                </div>

                {/* Filtered Range Total */}
                <div className="bg-gradient-to-br from-slate-50 to-gray-100 rounded-2xl p-3.5 border border-gray-200 shadow-xs relative overflow-hidden">
                    <p className="text-[10px] font-bold text-gray-700 uppercase tracking-wider">Filtered View Total</p>
                    <p className="text-lg font-black text-gray-950 mt-1">
                        Ksh {filtered.reduce((sum, p) => sum + (Number(p.grand_total) || 0), 0).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-gray-600 font-medium mt-0.5">{filtered.length} Matching Orders</p>
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
                            placeholder="Search by Invoice # (INV-01), vendor name, delivery ref, notes..."
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
                        className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:border-emerald-600 outline-none"
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
                        className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:border-emerald-600 outline-none"
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
                        className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:border-emerald-600 outline-none"
                    >
                        <option value="newest">Sort: Newest First</option>
                        <option value="oldest">Sort: Oldest First</option>
                        <option value="amount_high">Sort: Amount (High→Low)</option>
                        <option value="amount_low">Sort: Amount (Low→High)</option>
                        <option value="inv_asc">Sort: Invoice # (Ascending)</option>
                        <option value="supplier">Sort: Supplier Name (A-Z)</option>
                    </select>

                    {/* Auto-Fit dense toggle */}
                    <button
                        onClick={() => setIsAutoFit(!isAutoFit)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
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
                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-gray-100 text-xs font-bold text-gray-700">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-gray-500">Date Range:</span>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => {
                                setDateFrom(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="px-2 py-1 bg-gray-50 border border-gray-300 rounded-lg text-xs font-mono text-gray-900"
                        />
                        <span className="text-gray-400">to</span>
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
                                className="text-[11px] text-red-600 hover:underline"
                            >
                                Clear
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
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
                                className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-[11px] font-bold"
                            >
                                {pr.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Purchases DataGrid Table */}
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
                                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                    />
                                </th>
                                <th className="p-3">Purchase / GRN #</th>
                                <th className="p-3">Date</th>
                                <th className="p-3">Distributor / Supplier</th>
                                <th className="p-3">Delivery Ref</th>
                                <th className="p-3 text-right">Subtotal</th>
                                <th className="p-3 text-right">Discount</th>
                                <th className="p-3 text-right">Grand Total</th>
                                <th className="p-3 text-center">Payment Status</th>
                                <th className="p-3 text-center">Order Status</th>
                                <th className="p-3">Received By</th>
                                <th className="p-3 text-center w-36">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-gray-900 font-medium">
                            {paginated.length === 0 ? (
                                <tr>
                                    <td colSpan={12} className="p-12 text-center text-gray-500">
                                        <div className="text-4xl mb-2">📋</div>
                                        <p className="font-bold text-gray-800 text-sm">No purchase orders found</p>
                                        <p className="text-xs text-gray-500 mt-1">Try clearing your filters or create a new GRN</p>
                                    </td>
                                </tr>
                            ) : (
                                paginated.map((p) => {
                                    const isSelected = selectedIds.has(p.purchase_id);
                                    const isPaid = (p.payment_status || '').toLowerCase() === 'paid';

                                    return (
                                        <tr
                                            key={p.purchase_id}
                                            className={`hover:bg-emerald-50/40 transition-colors ${
                                                isSelected ? 'bg-emerald-50/70' : ''
                                            }`}
                                        >
                                            <td className="p-3">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => handleSelectOne(p.purchase_id)}
                                                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                                />
                                            </td>
                                            <td className="p-3 whitespace-nowrap">
                                                <button
                                                    onClick={() => handleViewDossier(p)}
                                                    className="px-2.5 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-900 font-mono font-bold rounded-md border border-blue-200 inline-flex items-center gap-1 transition-colors"
                                                    title="Click to view full line items dossier"
                                                >
                                                    {p.purchase_no}
                                                </button>
                                            </td>
                                            <td className="p-3 whitespace-nowrap text-gray-700 font-semibold">
                                                {p.purchase_date}
                                            </td>
                                            <td className="p-3 whitespace-nowrap">
                                                <p className="font-bold text-gray-900">{p.supplier_name}</p>
                                            </td>
                                            <td className="p-3 whitespace-nowrap font-mono text-gray-700">
                                                {p.supplier_invoice || '—'}
                                            </td>
                                            <td className="p-3 text-right font-mono font-bold text-gray-800 whitespace-nowrap">
                                                Ksh {(p.sub_total || 0).toLocaleString()}
                                            </td>
                                            <td className="p-3 text-right font-mono text-gray-600 whitespace-nowrap">
                                                {p.discount ? `Ksh ${Number(p.discount).toLocaleString()}` : '—'}
                                            </td>
                                            <td className="p-3 text-right font-mono font-black text-gray-950 whitespace-nowrap">
                                                Ksh {(p.grand_total || 0).toLocaleString()}
                                            </td>
                                            <td className="p-3 text-center whitespace-nowrap">
                                                <button
                                                    onClick={() => handleOpenPaymentUpdate(p)}
                                                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                                                        isPaid
                                                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200'
                                                            : 'bg-red-100 text-red-900 border-red-300 hover:bg-red-200'
                                                    }`}
                                                    title="Click to update payment settlement"
                                                >
                                                    {p.payment_status || 'Paid'}
                                                </button>
                                            </td>
                                            <td className="p-3 text-center whitespace-nowrap">
                                                <span className="px-2 py-0.5 bg-gray-100 text-gray-800 rounded font-bold text-[10px]">
                                                    {p.status || 'Completed'}
                                                </span>
                                            </td>
                                            <td className="p-3 whitespace-nowrap text-gray-700">
                                                {p.created_by || 'Pharmacist'}
                                            </td>
                                            <td className="p-3 text-center whitespace-nowrap">
                                                <div className="flex items-center justify-center gap-1">
                                                    {/* View Line Items */}
                                                    <button
                                                        onClick={() => handleViewDossier(p)}
                                                        className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                                        title="View Line Items &amp; Batches"
                                                    >
                                                        👁️
                                                    </button>

                                                    {/* Update Payment */}
                                                    <button
                                                        onClick={() => handleOpenPaymentUpdate(p)}
                                                        className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors"
                                                        title="Update Payment Settlement"
                                                    >
                                                        💳
                                                    </button>

                                                    {/* Delete */}
                                                    <button
                                                        onClick={() => handleDeletePurchase(p)}
                                                        className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                                                        title="Delete Purchase Record"
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
                        {/* Header */}
                        <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
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

                        {/* Invoice KPI Strip */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-4 bg-gray-50 border-b border-gray-200 text-xs">
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

                        {/* Line Items Table */}
                        <div className="p-5 overflow-y-auto flex-1 space-y-3">
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
                                <div className="overflow-x-auto border border-gray-200 rounded-2xl">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-900 border-b border-gray-200">
                                            <tr>
                                                <th className="p-2.5">#</th>
                                                <th className="p-2.5">Product Name</th>
                                                <th className="p-2.5">Batch #</th>
                                                <th className="p-2.5">Expiry Date</th>
                                                <th className="p-2.5 text-right">Received Qty</th>
                                                <th className="p-2.5 text-right">Unit Rate</th>
                                                <th className="p-2.5 text-right">Total Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 text-gray-900 font-medium">
                                            {purchaseLineItems.map((it, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50">
                                                    <td className="p-2.5 text-gray-400 font-bold">{idx + 1}</td>
                                                    <td className="p-2.5">
                                                        <p className="font-bold text-gray-900">{it.product_name}</p>
                                                        <span className="text-[10px] font-mono text-gray-500">{it.product_code}</span>
                                                    </td>
                                                    <td className="p-2.5 font-mono font-bold text-indigo-700 whitespace-nowrap">
                                                        {it.batch_number || 'N/A'}
                                                    </td>
                                                    <td className="p-2.5 whitespace-nowrap">
                                                        {it.expiry_date || 'N/A'}
                                                    </td>
                                                    <td className="p-2.5 text-right font-mono font-bold whitespace-nowrap">
                                                        {it.quantity} {it.unit}
                                                    </td>
                                                    <td className="p-2.5 text-right font-mono whitespace-nowrap">
                                                        Ksh {(it.rate || 0).toLocaleString()}
                                                    </td>
                                                    <td className="p-2.5 text-right font-mono font-black text-gray-950 whitespace-nowrap">
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

                        {/* Footer */}
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
