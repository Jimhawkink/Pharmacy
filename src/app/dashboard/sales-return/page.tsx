'use client';

// =====================================================================
// Alpha Pharmacy - Super Ultra Massive Sales Return & Restocking Hub v5.0
// Live Database Sync, Smart Receipt Lookup, Verified Batch Restocking,
// High-Contrast Dark Headers, Super Premium Light Cards, Return Reasons Analytics,
// Super World-Class Styled Excel (.xls), Official Credit Note Slip & PDF Audit
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
    sale_id: number;
    receipt_no: string;
    sale_datetime: string;
    customer_name?: string;
    customer_phone?: string;
    total: number;
    payment_method: string;
}

export interface SaleItemLookup {
    item_id: number;
    sale_id: number;
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

    // Super Tabs
    const [activeTab, setActiveTab] = useState<'all' | 'completed' | 'pending' | 'reasons' | 'financials'>('all');

    // Selection & Pagination
    const [selectedReturnIds, setSelectedReturnIds] = useState<Set<number>>(new Set());
    const [pageSize, setPageSize] = useState<number>(25);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [expandedReturnId, setExpandedReturnId] = useState<number | null>(null);

    // Super Premium Return Modal State
    const [showModal, setShowModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [intakeMode, setIntakeMode] = useState<'receipt' | 'manual'>('receipt');

    // Receipt Lookup in Modal
    const [receiptSearchTerm, setReceiptSearchTerm] = useState('');
    const [isSearchingReceipts, setIsSearchingReceipts] = useState(false);
    const [foundSales, setFoundSales] = useState<SaleLookup[]>([]);
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

    // 1. Load Sales Returns from Database
    const loadReturns = useCallback(async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('sales_returns')
                .select('*')
                .order('return_id', { ascending: false });

            if (error) throw error;
            setReturns(data || []);
            setLastSyncTime(new Date().toLocaleTimeString('en-KE'));
        } catch (err) {
            console.error('Error loading sales returns:', err);
            toast.error('Failed to load sales returns from database');
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

    // 4. Receipt Search Handler in Modal
    const handleSearchReceipts = async () => {
        if (!receiptSearchTerm.trim()) {
            toast.error('Enter a receipt # or customer name');
            return;
        }
        setIsSearchingReceipts(true);
        try {
            const term = receiptSearchTerm.trim();
            const { data, error } = await supabase
                .from('pharmacy_sales')
                .select('sale_id, receipt_no, sale_datetime, customer_name, customer_phone, total, payment_method')
                .or(`receipt_no.ilike.%${term}%,customer_name.ilike.%${term}%,customer_phone.ilike.%${term}%`)
                .order('sale_datetime', { ascending: false })
                .limit(10);

            if (error) throw error;
            setFoundSales(data || []);
            if (!data || data.length === 0) {
                toast('No matching sales receipts found in database', { icon: 'ℹ️' });
            }
        } catch (e) {
            console.error('Error searching receipts:', e);
            toast.error('Search query failed');
        } finally {
            setIsSearchingReceipts(false);
        }
    };

    // 5. Select a Sale Receipt -> Fetch Items
    const handleSelectSale = async (sale: SaleLookup) => {
        setSelectedSale(sale);
        setIsLoadingItems(true);
        setSelectedSaleItem(null);
        setFormData((prev) => ({
            ...prev,
            original_sale_id: sale.receipt_no,
            product_name: '',
            product_id: 0,
            unit_price: 0,
            quantity: 1,
        }));

        try {
            const { data, error } = await supabase
                .from('pharmacy_sales_items')
                .select('*')
                .eq('sale_id', sale.sale_id);

            if (error) throw error;
            setSaleItems(data || []);
        } catch (e) {
            console.error('Error loading sale items:', e);
            toast.error('Could not retrieve items for this receipt');
        } finally {
            setIsLoadingItems(false);
        }
    };

    // 6. Select a Line Item from Receipt
    const handleSelectSaleItem = (item: SaleItemLookup) => {
        setSelectedSaleItem(item);
        setFormData((prev) => ({
            ...prev,
            product_name: item.product_name,
            product_id: item.product_id,
            batch_id: item.batch_id || 0,
            batch_number: item.batch_number || '',
            unit_price: Number(item.unit_price) || 0,
            quantity: 1,
            max_quantity: Number(item.quantity) || 1,
        }));
    };

    // 7. Generate Return Number (SR-XXXX)
    const generateReturnNo = async (): Promise<string> => {
        try {
            const { data } = await supabase
                .from('sales_returns')
                .select('return_no')
                .order('return_id', { ascending: false })
                .limit(1);

            if (data && data.length > 0 && data[0].return_no) {
                const match = data[0].return_no.match(/SR-(\d+)/);
                if (match) {
                    const nextNum = parseInt(match[1], 10) + 1;
                    return `SR-${String(nextNum).padStart(4, '0')}`;
                }
            }
        } catch (e) {
            console.warn('Error reading return_no sequence:', e);
        }
        return 'SR-0005';
    };

    // 8. Process & Save Return
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
            const userData = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
            const user = userData ? JSON.parse(userData) : null;
            const staffName = user?.name || user?.userName || 'Pharmacist In-Charge';

            const totalAmount = formData.quantity * formData.unit_price;
            const returnDate = new Date().toISOString().split('T')[0];

            // 1. Insert into sales_returns table
            const { error: insertErr } = await supabase.from('sales_returns').insert({
                return_no: returnNo,
                return_date: returnDate,
                original_sale_id: formData.original_sale_id || 'OTC-MANUAL',
                product_name: formData.product_name,
                quantity: formData.quantity,
                unit_price: formData.unit_price,
                total_amount: totalAmount,
                reason: formData.reason,
                status: formData.quarantine_defective ? 'Quarantined' : 'Completed',
                processed_by: staffName,
            });

            if (insertErr) throw insertErr;

            // 2. Automated Inventory Restock if requested & not quarantined
            if (formData.restock_inventory && !formData.quarantine_defective) {
                try {
                    // Try to restock specific batch if batch_id provided
                    if (formData.batch_id) {
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

                    // Also increment general stock
                    if (formData.product_id) {
                        const { data: sRow } = await supabase
                            .from('pharmacy_stock')
                            .select('qty')
                            .eq('pid', formData.product_id)
                            .eq('outlet_id', outletId)
                            .single();

                        if (sRow) {
                            await supabase
                                .from('pharmacy_stock')
                                .update({ qty: (sRow.qty || 0) + formData.quantity })
                                .eq('pid', formData.product_id)
                                .eq('outlet_id', outletId);
                        }
                    }
                } catch (stockErr) {
                    console.warn('Stock restock warning:', stockErr);
                }
            }

            toast.success(`Return ${returnNo} processed successfully!`);
            setShowModal(false);
            resetModalForm();
            loadReturns();
        } catch (err: any) {
            console.error('Error processing sales return:', err);
            toast.error(err.message || 'Failed to authorize sales return');
        } finally {
            setIsSaving(false);
        }
    };

    const resetModalForm = () => {
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
        setSelectedSale(null);
        setSelectedSaleItem(null);
        setSaleItems([]);
        setFoundSales([]);
        setReceiptSearchTerm('');
        setProductSearchTerm('');
    };

    // Filter Logic
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
                const now = new Date();
                const todayStr = now.toISOString().split('T')[0];
                if (dateHorizon === 'today') matchesHorizon = r.return_date === todayStr;
                else if (dateHorizon === 'yesterday') {
                    const y = new Date(now.getTime() - 86400000).toISOString().split('T')[0];
                    matchesHorizon = r.return_date === y;
                } else if (dateHorizon === 'week') {
                    const w = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0];
                    matchesHorizon = r.return_date >= w;
                } else if (dateHorizon === 'month') {
                    const m = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                    matchesHorizon = r.return_date >= m;
                }
            }

            return matchesSearch && matchesReason && matchesStatus && matchesTab && matchesHorizon;
        });
    }, [returns, searchQuery, filterReason, filterStatus, activeTab, dateHorizon]);

    // Financial & Operational Metrics
    const metrics = useMemo(() => {
        let totalValue = 0;
        let totalUnits = 0;
        let completedCount = 0;
        let quarantinedCount = 0;
        const uniqueInvoices = new Set<string>();
        const reasonsMap: Record<string, { count: number; value: number }> = {};

        returns.forEach((r) => {
            const val = Number(r.total_amount ?? r.total ?? (r.quantity * r.unit_price)) || 0;
            const q = Number(r.quantity) || 0;
            totalValue += val;
            totalUnits += q;
            if (r.original_sale_id) uniqueInvoices.add(r.original_sale_id);

            const st = (r.status || '').toLowerCase();
            if (st === 'completed') completedCount += 1;
            else if (st === 'quarantined' || st === 'pending') quarantinedCount += 1;

            const rsn = r.reason || 'General Return';
            if (!reasonsMap[rsn]) reasonsMap[rsn] = { count: 0, value: 0 };
            reasonsMap[rsn].count += 1;
            reasonsMap[rsn].value += val;
        });

        const topReasons = Object.entries(reasonsMap)
            .map(([reason, data]) => ({ reason, ...data }))
            .sort((a, b) => b.count - a.count);

        return {
            totalReturns: returns.length,
            totalValue,
            totalUnits,
            completedCount,
            quarantinedCount,
            uniqueInvoicesCount: uniqueInvoices.size,
            topReasons,
        };
    }, [returns]);

    // Pagination Calculation
    const totalPages = Math.max(1, Math.ceil(filteredReturns.length / pageSize));
    const paginatedReturns = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredReturns.slice(start, start + pageSize);
    }, [filteredReturns, currentPage, pageSize]);

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

    // Export to Super World-Class Styled Excel
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
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#1E293B"/>
  </Style>
  <Style ss:ID="Title">
   <Font ss:FontName="Calibri" ss:Size="16" ss:Bold="1" ss:Color="#B91C1C"/>
  </Style>
  <Style ss:ID="Subtitle">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#64748B"/>
  </Style>
  <Style ss:ID="KpiHeader">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="9" ss:Bold="1" ss:Color="#475569"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="KpiRed">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="12" ss:Bold="1" ss:Color="#B91C1C"/>
   <Interior ss:Color="#FEF2F2" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="#,##0"/>
  </Style>
  <Style ss:ID="ColHeader">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#0F172A" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="RowEven"><Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/></Style>
  <Style ss:ID="RowOdd"><Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/></Style>
  <Style ss:ID="GrandTotal">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#0F172A"/>
   <Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="#,##0"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Sales Returns Ledger">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="40"/>
   <Column ss:Width="100"/>
   <Column ss:Width="90"/>
   <Column ss:Width="120"/>
   <Column ss:Width="180"/>
   <Column ss:Width="60"/>
   <Column ss:Width="90"/>
   <Column ss:Width="100"/>
   <Column ss:Width="160"/>
   <Column ss:Width="90"/>
   <Column ss:Width="120"/>

   <Row ss:Height="26">
    <Cell ss:MergeAcross="10" ss:StyleID="Title"><Data ss:Type="String">${companyName} — Sales Return &amp; Restock Ledger</Data></Cell>
   </Row>
   <Row ss:Height="16">
    <Cell ss:MergeAcross="10" ss:StyleID="Subtitle"><Data ss:Type="String">Outlet: ${outletName} | Exported: ${exportDate} | Records: ${filteredReturns.length}</Data></Cell>
   </Row>
   <Row ss:Height="10"/>

   <!-- Column Headers -->
   <Row ss:Height="24">
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">#</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Return No</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Return Date</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Original Invoice</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Medicine / Drug Name</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Quantity</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Unit Price (KES)</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Total Refund (KES)</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Return Reason</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Status</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Authorized By</Data></Cell>
   </Row>

   <!-- Rows -->
   ${filteredReturns.map((r, idx) => {
       const rowStyle = idx % 2 === 0 ? 'RowEven' : 'RowOdd';
       const val = Number(r.total_amount ?? r.total ?? (r.quantity * r.unit_price)) || 0;
       return `<Row ss:Height="20">
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="Number">${idx + 1}</Data></Cell>
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="String">${r.return_no}</Data></Cell>
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="String">${r.return_date}</Data></Cell>
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="String">${r.original_sale_id || 'OTC'}</Data></Cell>
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="String">${(r.product_name || '').replace(/&/g, '&amp;')}</Data></Cell>
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="Number">${r.quantity}</Data></Cell>
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="Number">${r.unit_price}</Data></Cell>
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="Number">${val}</Data></Cell>
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="String">${(r.reason || 'General').replace(/&/g, '&amp;')}</Data></Cell>
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="String">${r.status || 'Completed'}</Data></Cell>
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="String">${(r.processed_by || 'Pharmacist').replace(/&/g, '&amp;')}</Data></Cell>
   </Row>`;
   }).join('\n')}

   <!-- Grand Total -->
   <Row ss:Height="24">
    <Cell ss:MergeAcross="6" ss:StyleID="GrandTotal"><Data ss:Type="String">TOTAL REFUND VALUE (${filteredReturns.length} RETURNS):</Data></Cell>
    <Cell ss:StyleID="GrandTotal"><Data ss:Type="Number">${filteredReturns.reduce((sum, r) => sum + (Number(r.total_amount ?? r.total ?? (r.quantity * r.unit_price)) || 0), 0)}</Data></Cell>
    <Cell ss:MergeAcross="2" ss:StyleID="GrandTotal"><Data ss:Type="String">—</Data></Cell>
   </Row>
  </Table>
 </Worksheet>
</Workbook>`;

        const blob = new Blob([xmlString], { type: 'application/vnd.ms-excel;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AlphaPharmacy_Sales_Returns_${now.toISOString().split('T')[0]}_SuperExcel.xls`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`Exported ${filteredReturns.length} return records to Excel!`);
    };

    return (
        <div className="space-y-4 max-w-full pb-12">
            {/* Header with Live Sync Status & Super Action Buttons */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white rounded-3xl p-5 border border-gray-200/80 shadow-xs">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-rose-600 text-white flex items-center justify-center text-2xl font-bold shadow-md flex-shrink-0">
                        ↩️
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">
                                Sales Return &amp; Inventory Restocking Hub
                            </h1>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                LIVE DB REALTIME
                            </span>
                            {lastSyncTime && (
                                <span className="text-[10px] font-mono text-gray-400">
                                    Synced: {lastSyncTime}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-gray-500 font-medium mt-0.5">
                            Audit sales credit notes, customer refunds, adverse event recalls &amp; automated batch restocking
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={loadReturns}
                        disabled={isLoading}
                        className="px-3.5 py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 active:scale-95 disabled:opacity-60 shadow-2xs"
                        title="Sync live records from database"
                    >
                        <span className={isLoading ? 'animate-spin' : ''}>🔄</span>
                        {isLoading ? 'Syncing...' : 'Sync Live'}
                    </button>

                    <button
                        onClick={exportToSuperExcel}
                        className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95"
                        title="Download styled Excel ledger"
                    >
                        <span>📊</span>
                        Super Excel (.xls)
                    </button>

                    <button
                        onClick={() => {
                            resetModalForm();
                            setShowModal(true);
                        }}
                        className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-md active:scale-95"
                    >
                        <span>➕</span>
                        Authorize New Return
                    </button>
                </div>
            </div>

            {/* SUPER PREMIUM LIGHT CARDS (REMOVED THICK HEAVY COLORED CARDS) */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
                {/* 1. Total Returns Volume */}
                <div className="bg-white rounded-2xl p-4.5 border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between border-t-4 border-t-amber-500 group">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Total Returns</span>
                        <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center text-base font-bold shadow-2xs group-hover:scale-105 transition-transform">
                            ↩️
                        </div>
                    </div>
                    <div>
                        <div className="text-2xl font-black text-slate-900 tracking-tight font-mono">
                            {metrics.totalReturns}
                        </div>
                        <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200/60">
                            <span>🧾 {metrics.uniqueInvoicesCount} invoices impacted</span>
                        </div>
                    </div>
                </div>

                {/* 2. Total Refund Outlay */}
                <div className="bg-white rounded-2xl p-4.5 border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between border-t-4 border-t-rose-500 group">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Refund Outlay</span>
                        <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center text-base font-bold shadow-2xs group-hover:scale-105 transition-transform">
                            💰
                        </div>
                    </div>
                    <div>
                        <div className="text-2xl font-black text-rose-700 tracking-tight font-mono">
                            KES {metrics.totalValue.toLocaleString()}
                        </div>
                        <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200/60">
                            <span>Total financial refund</span>
                        </div>
                    </div>
                </div>

                {/* 3. Units Restocked to Shelf */}
                <div className="bg-white rounded-2xl p-4.5 border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between border-t-4 border-t-emerald-500 group">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Restocked to Shelf</span>
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center text-base font-bold shadow-2xs group-hover:scale-105 transition-transform">
                            📦
                        </div>
                    </div>
                    <div>
                        <div className="text-2xl font-black text-slate-900 tracking-tight font-mono">
                            {metrics.completedCount}
                        </div>
                        <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/60">
                            <span>{metrics.totalUnits} items restored</span>
                        </div>
                    </div>
                </div>

                {/* 4. Quarantined / Defective */}
                <div className="bg-white rounded-2xl p-4.5 border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between border-t-4 border-t-purple-500 group">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Quarantined / Defect</span>
                        <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 flex items-center justify-center text-base font-bold shadow-2xs group-hover:scale-105 transition-transform">
                            ⚠️
                        </div>
                    </div>
                    <div>
                        <div className="text-2xl font-black text-slate-900 tracking-tight font-mono">
                            {metrics.quarantinedCount}
                        </div>
                        <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-50 text-purple-800 border border-purple-200/60">
                            <span>Blocked from shelf</span>
                        </div>
                    </div>
                </div>

                {/* 5. Top Return Reason */}
                <div className="bg-white rounded-2xl p-4.5 border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between border-t-4 border-t-sky-500 col-span-2 md:col-span-1 group">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Primary Reason</span>
                        <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-200 text-sky-700 flex items-center justify-center text-base font-bold shadow-2xs group-hover:scale-105 transition-transform">
                            🔍
                        </div>
                    </div>
                    <div>
                        <div className="text-base font-black text-slate-900 tracking-tight truncate" title={metrics.topReasons[0]?.reason || 'None'}>
                            {metrics.topReasons[0]?.reason || 'None Recorded'}
                        </div>
                        <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-sky-50 text-sky-800 border border-sky-200/60">
                            <span>{metrics.topReasons[0]?.count || 0} occurrences</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Super Tabs Bar */}
            <div className="bg-white rounded-2xl border border-gray-200/80 p-2 shadow-xs flex items-center justify-between gap-2 overflow-x-auto">
                <div className="flex items-center gap-1.5 min-w-max">
                    <button
                        onClick={() => setActiveTab('all')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                            activeTab === 'all'
                                ? 'bg-slate-900 text-white shadow-sm'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                    >
                        <span>🧾</span> All Return Records ({returns.length})
                    </button>

                    <button
                        onClick={() => setActiveTab('completed')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                            activeTab === 'completed'
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                    >
                        <span>✅</span> Completed &amp; Restocked ({metrics.completedCount})
                    </button>

                    <button
                        onClick={() => setActiveTab('pending')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                            activeTab === 'pending'
                                ? 'bg-amber-600 text-white shadow-sm'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                    >
                        <span>⚠️</span> Quarantined / Pending ({metrics.quarantinedCount})
                    </button>

                    <button
                        onClick={() => setActiveTab('reasons')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                            activeTab === 'reasons'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                    >
                        <span>📊</span> Reasons Analytics ({metrics.topReasons.length})
                    </button>

                    <button
                        onClick={() => setActiveTab('financials')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                            activeTab === 'financials'
                                ? 'bg-teal-600 text-white shadow-sm'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                    >
                        <span>💰</span> Financial Impact
                    </button>
                </div>
            </div>

            {/* Filter Hub Toolbar */}
            <div className="bg-white rounded-3xl p-4 border border-gray-200/80 shadow-xs space-y-3">
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                    {/* Search Bar */}
                    <div className="relative flex-1">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                        <input
                            type="text"
                            placeholder="Search return #, original invoice, drug name, pharmacist or reason..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50/80 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Filter Dropdowns */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <select
                            value={filterReason}
                            onChange={(e) => setFilterReason(e.target.value)}
                            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none focus:border-emerald-500"
                        >
                            <option value="All">All Return Reasons</option>
                            <option value="Wrong Order">Wrong Order</option>
                            <option value="Wrong Medication Dispensed">Wrong Medication Dispensed</option>
                            <option value="Customer Request">Customer Request</option>
                            <option value="Damaged Packaging">Damaged Packaging</option>
                            <option value="Adverse Reaction">Adverse Reaction</option>
                            <option value="Quality Issue">Quality Issue</option>
                            <option value="Overcharge">Overcharge</option>
                        </select>

                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none focus:border-emerald-500"
                        >
                            <option value="All">All Statuses</option>
                            <option value="Completed">Completed Only</option>
                            <option value="Quarantined">Quarantined Only</option>
                            <option value="Pending">Pending Only</option>
                        </select>
                    </div>
                </div>

                {/* Horizon Presets */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-gray-500 mr-1">Time Horizon:</span>
                        {(['all', 'today', 'yesterday', 'week', 'month'] as const).map((preset) => (
                            <button
                                key={preset}
                                type="button"
                                onClick={() => setDateHorizon(preset)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition capitalize ${
                                    dateHorizon === preset
                                        ? 'bg-slate-900 text-white shadow-xs'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                {preset === 'all' ? 'All Time' : preset === 'week' ? 'Last 7 Days' : preset === 'month' ? 'This Month' : preset}
                            </button>
                        ))}
                    </div>

                    <div className="text-gray-400 font-medium text-[11px]">
                        Showing {filteredReturns.length} matching returns
                    </div>
                </div>
            </div>

            {/* TAB 1: MASTER RETURNS DATAGRID WITH DARK VISIBLE HEADERS */}
            {(activeTab === 'all' || activeTab === 'completed' || activeTab === 'pending') && (
                <div className="bg-white rounded-3xl border border-gray-200/80 shadow-xs overflow-hidden">
                    {/* Header Strip */}
                    <div className="px-5 py-3 border-b border-gray-100 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2">
                            <span className="font-black text-slate-800 text-sm">
                                Sales Returns Audit Ledger
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                {filteredReturns.length} Records
                            </span>
                            {selectedReturnIds.size > 0 && (
                                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-indigo-100 text-indigo-800 border border-indigo-300">
                                    {selectedReturnIds.size} Selected
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <label className="text-[11px] font-bold text-slate-500">Rows per page:</label>
                            <select
                                value={pageSize}
                                onChange={(e) => {
                                    setPageSize(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                                className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="p-12 text-center text-gray-500">
                            <div className="w-10 h-10 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin mx-auto mb-3" />
                            <p className="text-xs font-bold text-gray-600">Streaming returns ledger from database...</p>
                        </div>
                    ) : filteredReturns.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">
                            <div className="text-4xl mb-2">↩️</div>
                            <p className="text-sm font-bold text-gray-800">No sales return records found</p>
                            <p className="text-xs text-gray-400 mt-1">
                                No customer returns match the selected filter criteria.
                            </p>
                            <button
                                onClick={() => {
                                    resetModalForm();
                                    setShowModal(true);
                                }}
                                className="mt-3 px-4 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition"
                            >
                                ➕ Process First Return
                            </button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                {/* HIGH-CONTRAST DARK VISIBLE HEADERS */}
                                <thead className="bg-slate-900 border-b-2 border-emerald-500 text-white font-black uppercase text-[11px] tracking-wider shadow-md">
                                    <tr>
                                        <th className="w-8 py-3.5 px-2 text-center text-white font-black"></th>
                                        <th className="w-8 py-3.5 px-2 text-center text-white font-black">
                                            <input
                                                type="checkbox"
                                                checked={selectedReturnIds.size === paginatedReturns.length && paginatedReturns.length > 0}
                                                onChange={toggleSelectAll}
                                                className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                                            />
                                        </th>
                                        <th className="py-3.5 px-3 text-left text-white font-black whitespace-nowrap">Return #</th>
                                        <th className="py-3.5 px-3 text-left text-white font-black whitespace-nowrap">Date</th>
                                        <th className="py-3.5 px-3 text-left text-white font-black whitespace-nowrap">Original Invoice</th>
                                        <th className="py-3.5 px-3 text-left text-white font-black whitespace-nowrap">Returned Medication</th>
                                        <th className="py-3.5 px-3 text-center text-white font-black whitespace-nowrap">Qty Returned</th>
                                        <th className="py-3.5 px-3 text-right text-white font-black whitespace-nowrap">Unit Price</th>
                                        <th className="py-3.5 px-3 text-right text-white font-black whitespace-nowrap">Total Refund</th>
                                        <th className="py-3.5 px-3 text-left text-white font-black whitespace-nowrap">Return Reason</th>
                                        <th className="py-3.5 px-3 text-center text-white font-black whitespace-nowrap">Status</th>
                                        <th className="py-3.5 px-3 text-left text-white font-black whitespace-nowrap">Authorized By</th>
                                        <th className="py-3.5 px-3 text-center w-24 text-white font-black whitespace-nowrap">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {paginatedReturns.map((r) => {
                                        const isExpanded = expandedReturnId === r.return_id;
                                        const isSelected = selectedReturnIds.has(r.return_id);
                                        const refundVal = Number(r.total_amount ?? r.total ?? (r.quantity * r.unit_price)) || 0;

                                        return (
                                            <Fragment key={r.return_id}>
                                                <tr
                                                    onClick={() => setExpandedReturnId(isExpanded ? null : r.return_id)}
                                                    className={`hover:bg-amber-50/40 transition cursor-pointer ${
                                                        isSelected ? 'bg-indigo-50/50' : isExpanded ? 'bg-amber-50/60' : ''
                                                    }`}
                                                >
                                                    {/* Toggle */}
                                                    <td className="py-3 px-2 text-center text-gray-400">
                                                        <span className={`inline-block transition-transform duration-200 font-bold ${isExpanded ? 'rotate-90 text-amber-700' : ''}`}>
                                                            ▶
                                                        </span>
                                                    </td>

                                                    {/* Checkbox */}
                                                    <td className="py-3 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => toggleSelectOne(r.return_id)}
                                                            className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                                                        />
                                                    </td>

                                                    {/* Return # */}
                                                    <td className="py-3 px-3">
                                                        <span className="font-mono font-black text-amber-900 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 inline-flex items-center gap-1 shadow-2xs">
                                                            {r.return_no}
                                                        </span>
                                                    </td>

                                                    {/* Date */}
                                                    <td className="py-3 px-3 text-gray-700 font-mono whitespace-nowrap">
                                                        {r.return_date ? new Date(r.return_date).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                                    </td>

                                                    {/* Original Invoice */}
                                                    <td className="py-3 px-3">
                                                        <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                                            {r.original_sale_id || 'OTC Counter'}
                                                        </span>
                                                    </td>

                                                    {/* Returned Medicine */}
                                                    <td className="py-3 px-3 font-bold text-slate-900">
                                                        {r.product_name}
                                                    </td>

                                                    {/* Qty */}
                                                    <td className="py-3 px-3 text-center font-black text-slate-900">
                                                        {r.quantity}
                                                    </td>

                                                    {/* Unit Price */}
                                                    <td className="py-3 px-3 text-right font-mono text-gray-600">
                                                        KES {Number(r.unit_price || 0).toLocaleString()}
                                                    </td>

                                                    {/* Total Refund */}
                                                    <td className="py-3 px-3 text-right font-mono font-black text-rose-700 text-sm whitespace-nowrap">
                                                        KES {refundVal.toLocaleString()}
                                                    </td>

                                                    {/* Reason */}
                                                    <td className="py-3 px-3">
                                                        <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                                                            {r.reason || 'General'}
                                                        </span>
                                                    </td>

                                                    {/* Status */}
                                                    <td className="py-3 px-3 text-center whitespace-nowrap">
                                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                                            (r.status || '').toLowerCase() === 'completed'
                                                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                                                : 'bg-purple-50 text-purple-800 border-purple-300'
                                                        }`}>
                                                            {(r.status || '').toLowerCase() === 'completed' ? '✓ Restocked' : (r.status || 'Under Review')}
                                                        </span>
                                                    </td>

                                                    {/* Authorized By */}
                                                    <td className="py-3 px-3 text-gray-700 font-medium">
                                                        {r.processed_by || 'Pharmacist'}
                                                    </td>

                                                    {/* Actions */}
                                                    <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <button
                                                                onClick={() => viewCreditNote(r)}
                                                                className="p-1.5 bg-gray-100 hover:bg-amber-100 text-gray-700 hover:text-amber-800 rounded-lg transition"
                                                                title="Print Credit Note Voucher"
                                                            >
                                                                🖨️
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    navigator.clipboard.writeText(r.return_no);
                                                                    toast.success(`Copied ${r.return_no}`);
                                                                }}
                                                                className="p-1.5 bg-gray-100 hover:bg-blue-100 text-gray-700 hover:text-blue-800 rounded-lg transition"
                                                                title="Copy Return #"
                                                            >
                                                                📋
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>

                                                {/* Expanded Detail Dossier */}
                                                {isExpanded && (
                                                    <tr className="bg-amber-50/20">
                                                        <td colSpan={13} className="px-6 py-4">
                                                            <div className="bg-white rounded-2xl border-2 border-amber-300 shadow-md p-4 space-y-3">
                                                                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-black text-amber-900 text-xs">
                                                                            Return Audit Dossier: {r.return_no}
                                                                        </span>
                                                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                                                                            Invoice: {r.original_sale_id || 'OTC'}
                                                                        </span>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => viewCreditNote(r)}
                                                                        className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-2xs"
                                                                    >
                                                                        <span>🖨️</span> Print Official Credit Note
                                                                    </button>
                                                                </div>

                                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                                                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                                                                        <span className="text-[10px] text-gray-400 font-bold uppercase block">Returned Product</span>
                                                                        <span className="font-black text-gray-900 text-sm mt-0.5 block">{r.product_name}</span>
                                                                    </div>

                                                                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                                                                        <span className="text-[10px] text-gray-400 font-bold uppercase block">Refund Calculation</span>
                                                                        <span className="font-mono font-bold text-gray-900 mt-0.5 block">
                                                                            {r.quantity} × KES {Number(r.unit_price || 0).toLocaleString()} = <strong className="text-rose-700">KES {refundVal.toLocaleString()}</strong>
                                                                        </span>
                                                                    </div>

                                                                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                                                                        <span className="text-[10px] text-gray-400 font-bold uppercase block">Clinical Justification</span>
                                                                        <span className="font-bold text-amber-900 mt-0.5 block">{r.reason || 'General Customer Request'}</span>
                                                                    </div>

                                                                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                                                                        <span className="text-[10px] text-gray-400 font-bold uppercase block">Disposition Status</span>
                                                                        <span className="font-bold text-emerald-800 mt-0.5 block">
                                                                            {(r.status || '').toLowerCase() === 'completed' ? 'Restocked to Active Sellable Batch' : 'Quarantined for Inspection'}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination Strip */}
                    <div className="p-4 border-t border-gray-100 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                        <div className="text-gray-500 font-medium">
                            Showing <strong className="text-gray-900">{filteredReturns.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</strong> to{' '}
                            <strong className="text-gray-900">{Math.min(currentPage * pageSize, filteredReturns.length)}</strong> of{' '}
                            <strong className="text-gray-900">{filteredReturns.length}</strong> records
                        </div>

                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => setCurrentPage(1)}
                                disabled={currentPage === 1}
                                className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-700 font-bold hover:bg-gray-100 disabled:opacity-40 transition"
                            >
                                ««
                            </button>
                            <button
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-700 font-bold hover:bg-gray-100 disabled:opacity-40 transition"
                            >
                                Previous
                            </button>
                            <span className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-900 font-black rounded-lg">
                                Page {currentPage} of {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-700 font-bold hover:bg-gray-100 disabled:opacity-40 transition"
                            >
                                Next
                            </button>
                            <button
                                onClick={() => setCurrentPage(totalPages)}
                                disabled={currentPage === totalPages}
                                className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-700 font-bold hover:bg-gray-100 disabled:opacity-40 transition"
                            >
                                »»
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 4: RETURN REASONS ANALYTICS WITH DARK HEADERS */}
            {activeTab === 'reasons' && (
                <div className="bg-white rounded-3xl border border-gray-200/80 shadow-xs overflow-hidden">
                    <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                        <div>
                            <h3 className="font-black text-sm text-gray-900">
                                Return Reasons Clinical &amp; Quality Analytics
                            </h3>
                            <p className="text-[11px] text-gray-500">
                                Track dispensary error patterns, packaging defects, and patient complaints
                            </p>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-slate-900 border-b-2 border-emerald-500 text-white font-black uppercase text-[11px] tracking-wider shadow-sm">
                                <tr>
                                    <th className="p-3 text-left text-white font-black">#</th>
                                    <th className="p-3 text-left text-white font-black">Return Reason Category</th>
                                    <th className="p-3 text-center text-white font-black">Occurrences</th>
                                    <th className="p-3 text-right text-white font-black">Total Financial Value (KES)</th>
                                    <th className="p-3 text-right text-white font-black">% of All Returns</th>
                                    <th className="p-3 text-center text-white font-black">Severity / Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {metrics.topReasons.map((r, i) => {
                                    const pct = metrics.totalValue > 0 ? (r.value / metrics.totalValue) * 100 : 0;
                                    return (
                                        <tr key={i} className="hover:bg-gray-50">
                                            <td className="p-3 text-gray-400 font-bold">{i + 1}</td>
                                            <td className="p-3 font-bold text-gray-900">{r.reason}</td>
                                            <td className="p-3 text-center font-bold text-gray-800">{r.count}</td>
                                            <td className="p-3 text-right font-mono font-black text-rose-700">
                                                KES {r.value.toLocaleString()}
                                            </td>
                                            <td className="p-3 text-right font-mono text-gray-600">{pct.toFixed(1)}%</td>
                                            <td className="p-3 text-center">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                    r.reason.toLowerCase().includes('wrong')
                                                        ? 'bg-rose-100 text-rose-800'
                                                        : r.reason.toLowerCase().includes('adverse')
                                                        ? 'bg-purple-100 text-purple-800'
                                                        : 'bg-amber-100 text-amber-800'
                                                }`}>
                                                    {r.reason.toLowerCase().includes('wrong') ? '⚠️ Counter Review' : 'Quality Check'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 5: FINANCIAL IMPACT */}
            {activeTab === 'financials' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white rounded-3xl p-5 border border-gray-200/80 shadow-xs">
                            <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Gross Sales Returned</h4>
                            <p className="text-2xl font-black text-rose-700 font-mono mt-1">KES {metrics.totalValue.toLocaleString()}</p>
                            <p className="text-xs text-gray-500 mt-2">Deducted from gross pharmacy sales revenue.</p>
                        </div>
                        <div className="bg-white rounded-3xl p-5 border border-gray-200/80 shadow-xs">
                            <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Salvaged Stock Value</h4>
                            <p className="text-2xl font-black text-emerald-700 font-mono mt-1">
                                KES {returns.filter(r => (r.status || '').toLowerCase() === 'completed').reduce((s, r) => s + (Number(r.total_amount ?? r.total ?? 0)), 0).toLocaleString()}
                            </p>
                            <p className="text-xs text-gray-500 mt-2">Inventory placed back on dispensary shelves for resale.</p>
                        </div>
                        <div className="bg-white rounded-3xl p-5 border border-gray-200/80 shadow-xs">
                            <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Net Loss (Quarantine/Spoilage)</h4>
                            <p className="text-2xl font-black text-purple-700 font-mono mt-1">
                                KES {returns.filter(r => (r.status || '').toLowerCase() !== 'completed').reduce((s, r) => s + (Number(r.total_amount ?? r.total ?? 0)), 0).toLocaleString()}
                            </p>
                            <p className="text-xs text-gray-500 mt-2">Damaged or unreturnable drugs written off.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* SUPER PREMIUM SALES RETURN MODAL (BEST BEST BEST CODE EVER) */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 z-50 animate-fadeIn">
                    <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh]">
                        {/* Modal Header */}
                        <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-teal-900 px-6 py-4 text-white flex items-center justify-between flex-shrink-0 border-b-2 border-emerald-500">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-400 flex items-center justify-center text-xl font-bold">
                                    ↩️
                                </div>
                                <div>
                                    <h3 className="font-black text-base tracking-tight">Authorize Pharmaceutical Sales Return</h3>
                                    <p className="text-[11px] text-emerald-200 font-medium">Verify original receipt, reverse transaction &amp; restore inventory</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-sm font-bold transition"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto space-y-4 text-xs">
                            {/* Mode Switcher */}
                            <div className="flex items-center p-1 bg-gray-100 rounded-xl border border-gray-200">
                                <button
                                    type="button"
                                    onClick={() => setIntakeMode('receipt')}
                                    className={`flex-1 py-2 rounded-lg font-bold text-xs transition flex items-center justify-center gap-1.5 ${
                                        intakeMode === 'receipt'
                                            ? 'bg-white text-emerald-900 shadow-xs'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    <span>🧾</span> Lookup from Sales Receipt (Recommended)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIntakeMode('manual')}
                                    className={`flex-1 py-2 rounded-lg font-bold text-xs transition flex items-center justify-center gap-1.5 ${
                                        intakeMode === 'manual'
                                            ? 'bg-white text-emerald-900 shadow-xs'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    <span>OTC</span> OTC Manual Return (No Receipt)
                                </button>
                            </div>

                            {/* Mode A: Receipt Search & Line Items Pull */}
                            {intakeMode === 'receipt' ? (
                                <div className="space-y-3 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="Enter Receipt # (e.g. RX-0009) or customer phone..."
                                            value={receiptSearchTerm}
                                            onChange={(e) => setReceiptSearchTerm(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSearchReceipts()}
                                            className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:border-emerald-500"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleSearchReceipts}
                                            disabled={isSearchingReceipts}
                                            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold transition flex items-center gap-1 disabled:opacity-60"
                                        >
                                            {isSearchingReceipts ? 'Searching...' : 'Find Receipt'}
                                        </button>
                                    </div>

                                    {/* Found Receipts List */}
                                    {foundSales.length > 0 && !selectedSale && (
                                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                            <p className="text-[10px] font-bold text-gray-500 uppercase">Select Receipt to Return Items From:</p>
                                            {foundSales.map((s) => (
                                                <div
                                                    key={s.sale_id}
                                                    onClick={() => handleSelectSale(s)}
                                                    className="p-2.5 bg-white hover:bg-emerald-50 border border-gray-200 rounded-xl cursor-pointer transition flex items-center justify-between"
                                                >
                                                    <div>
                                                        <span className="font-mono font-black text-gray-900">{s.receipt_no}</span>
                                                        <span className="text-gray-500 ml-2">({s.customer_name || 'Walk-in'})</span>
                                                        <span className="block text-[10px] text-gray-400">{new Date(s.sale_datetime).toLocaleString('en-KE')}</span>
                                                    </div>
                                                    <span className="font-mono font-black text-emerald-800 text-sm">KES {Number(s.total || 0).toLocaleString()}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Active Selected Receipt Banner */}
                                    {selectedSale && (
                                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                                            <div>
                                                <span className="font-mono font-black text-emerald-950 text-sm">{selectedSale.receipt_no}</span>
                                                <span className="text-emerald-700 ml-2 font-medium">({selectedSale.customer_name || 'Walk-in'})</span>
                                                <span className="block text-[10px] text-emerald-600 font-mono">Total Paid: KES {Number(selectedSale.total || 0).toLocaleString()} via {selectedSale.payment_method}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedSale(null);
                                                    setSaleItems([]);
                                                    setSelectedSaleItem(null);
                                                }}
                                                className="text-xs text-rose-600 font-bold hover:underline"
                                            >
                                                Change Receipt
                                            </button>
                                        </div>
                                    )}

                                    {/* Line Items Picker */}
                                    {isLoadingItems ? (
                                        <p className="text-center py-4 text-gray-500 animate-pulse font-bold">Retrieving dispensed drug lines...</p>
                                    ) : saleItems.length > 0 ? (
                                        <div className="space-y-1.5">
                                            <p className="text-[10px] font-bold text-gray-500 uppercase">Click the Medicine Being Returned:</p>
                                            <div className="space-y-1 max-h-48 overflow-y-auto">
                                                {saleItems.map((it) => (
                                                    <div
                                                        key={it.item_id}
                                                        onClick={() => handleSelectSaleItem(it)}
                                                        className={`p-2.5 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                                                            selectedSaleItem?.item_id === it.item_id
                                                                ? 'bg-emerald-100/80 border-emerald-400 shadow-xs'
                                                                : 'bg-white border-gray-200 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        <div>
                                                            <span className="font-bold text-gray-900 block">{it.product_name}</span>
                                                            <span className="text-[10px] font-mono text-gray-500">
                                                                Batch: {it.batch_number || 'LOT-AUTO'} • Dispensed: {it.quantity} {it.selling_unit || 'Pcs'}
                                                            </span>
                                                        </div>
                                                        <span className="font-mono font-black text-gray-900">
                                                            KES {Number(it.unit_price || 0).toLocaleString()} / unit
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            ) : (
                                /* Mode B: OTC Manual Drug Search */
                                <div className="space-y-2 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200">
                                    <label className="block text-[11px] font-bold text-gray-700">Search Medication from Catalog:</label>
                                    <input
                                        type="text"
                                        placeholder="Type medicine name to auto-fill pricing..."
                                        value={productSearchTerm}
                                        onChange={(e) => setProductSearchTerm(e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-800"
                                    />
                                    {productSearchTerm.trim() && (
                                        <div className="max-h-36 overflow-y-auto space-y-1 bg-white p-2 border border-gray-200 rounded-xl">
                                            {catalogProducts
                                                .filter((p) => p.product_name.toLowerCase().includes(productSearchTerm.toLowerCase()))
                                                .slice(0, 8)
                                                .map((p) => (
                                                    <div
                                                        key={p.pid}
                                                        onClick={() => {
                                                            setFormData((prev) => ({
                                                                ...prev,
                                                                product_name: p.product_name,
                                                                product_id: p.pid,
                                                                unit_price: p.sales_cost,
                                                                max_quantity: 999,
                                                            }));
                                                            setProductSearchTerm('');
                                                        }}
                                                        className="p-2 hover:bg-emerald-50 rounded-lg cursor-pointer flex justify-between items-center"
                                                    >
                                                        <span className="font-bold text-gray-900">{p.product_name}</span>
                                                        <span className="font-mono font-bold text-emerald-800">KES {p.sales_cost.toLocaleString()}</span>
                                                    </div>
                                                ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Return Form Controls */}
                            <div className="space-y-3 pt-2 border-t border-gray-100">
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Returned Medication Name *</label>
                                    <input
                                        type="text"
                                        value={formData.product_name}
                                        onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                                        placeholder="Medicine Name"
                                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl font-bold text-gray-900 focus:outline-none focus:border-emerald-500"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="text-[11px] font-bold text-gray-700">Quantity Returned *</label>
                                            {formData.max_quantity < 999 && (
                                                <span className="text-[10px] text-gray-400">Max: {formData.max_quantity}</span>
                                            )}
                                        </div>
                                        <input
                                            type="number"
                                            min={1}
                                            max={formData.max_quantity}
                                            value={formData.quantity}
                                            onChange={(e) => setFormData({ ...formData, quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl font-black text-gray-900 font-mono"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-700 mb-1">Unit Refund Price (KES) *</label>
                                        <input
                                            type="number"
                                            value={formData.unit_price}
                                            onChange={(e) => setFormData({ ...formData, unit_price: Math.max(0, parseFloat(e.target.value) || 0) })}
                                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl font-black text-gray-900 font-mono"
                                        />
                                    </div>
                                </div>

                                {/* Dynamic Refund Summary Box */}
                                <div className="p-3.5 bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl text-white flex items-center justify-between">
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Customer Refund Due</span>
                                        <span className="text-xl font-black text-emerald-400 font-mono">
                                            KES {(formData.quantity * formData.unit_price).toLocaleString()}
                                        </span>
                                    </div>
                                    <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-white/10 text-slate-200">
                                        {formData.quantity} unit{formData.quantity === 1 ? '' : 's'} @ KES {formData.unit_price.toLocaleString()}
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-700 mb-1">Return Reason *</label>
                                        <select
                                            value={formData.reason}
                                            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-800"
                                        >
                                            <option value="Wrong Medication Dispensed">Wrong Medication Dispensed (Pharmacy Error)</option>
                                            <option value="Prescription Modified by Physician">Prescription Modified by Physician</option>
                                            <option value="Damaged Packaging / Broken Seal">Damaged Packaging / Broken Seal</option>
                                            <option value="Adverse Drug Reaction / Allergy">Adverse Drug Reaction / Allergy</option>
                                            <option value="Near-Expiry / Shelf Life Concern">Near-Expiry / Shelf Life Concern</option>
                                            <option value="Overcharge / Pricing Dispute">Overcharge / Pricing Dispute</option>
                                            <option value="Customer Request / Change of Mind">Customer Request / Change of Mind</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-700 mb-1">Refund Payout Channel</label>
                                        <select
                                            value={formData.refund_method}
                                            onChange={(e) => setFormData({ ...formData, refund_method: e.target.value })}
                                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-800"
                                        >
                                            <option value="Cash from Register">Cash from Counter Register</option>
                                            <option value="M-Pesa Payout">M-Pesa Reversal / Payout</option>
                                            <option value="Store Credit Voucher">Pharmacy Store Credit Voucher</option>
                                            <option value="Direct Replacement">Direct Drug Replacement</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Restock vs Quarantine Toggles */}
                                <div className="p-3 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.restock_inventory && !formData.quarantine_defective}
                                            onChange={(e) => setFormData({ ...formData, restock_inventory: e.target.checked })}
                                            disabled={formData.quarantine_defective}
                                            className="w-4 h-4 rounded accent-emerald-600"
                                        />
                                        <span className="text-xs font-bold text-gray-800">
                                            Restock into Active Inventory (Return unopened drug back to shelf)
                                        </span>
                                    </label>

                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.quarantine_defective}
                                            onChange={(e) => setFormData({ ...formData, quarantine_defective: e.target.checked })}
                                            className="w-4 h-4 rounded accent-rose-600"
                                        />
                                        <span className="text-xs font-bold text-rose-700">
                                            Quarantine / Damaged Drug (Do not return to sellable inventory)
                                        </span>
                                    </label>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Pharmacist Clinical Notes</label>
                                    <input
                                        type="text"
                                        value={formData.pharmacist_notes}
                                        onChange={(e) => setFormData({ ...formData, pharmacist_notes: e.target.value })}
                                        placeholder="Optional explanation for audit log..."
                                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-medium text-gray-800"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-3 flex-shrink-0">
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 border border-gray-300 text-gray-700 font-bold rounded-xl text-xs hover:bg-gray-100 transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveReturn}
                                disabled={isSaving}
                                className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black rounded-xl text-xs shadow-md transition flex items-center gap-1.5 disabled:opacity-60"
                            >
                                {isSaving ? 'Authorizing Return...' : '✅ Authorize Return & Process Refund'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* OFFICIAL CREDIT NOTE VOUCHER MODAL */}
            {showVoucherModal && voucherReturn && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
                    <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 max-w-sm w-full overflow-hidden flex flex-col">
                        <div className="bg-slate-900 px-5 py-4 text-white flex items-center justify-between flex-shrink-0 border-b border-emerald-500">
                            <div>
                                <h3 className="font-black text-sm">Credit Note #{voucherReturn.return_no}</h3>
                                <p className="text-[10px] text-gray-400">Official Pharmacy Refund Voucher</p>
                            </div>
                            <button
                                onClick={() => setShowVoucherModal(false)}
                                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-xs font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6 font-mono text-xs space-y-3">
                            <div className="text-center border-b border-dashed border-gray-300 pb-3 font-sans">
                                <h2 className="text-sm font-black text-gray-900">{companyName}</h2>
                                <p className="text-[10px] text-gray-500">{outletName}</p>
                                <span className="mt-1 inline-block px-2 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-900">
                                    CREDIT NOTE / REFUND VOUCHER
                                </span>
                            </div>

                            <div className="space-y-1 text-gray-700 text-[11px]">
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Voucher No:</span>
                                    <span className="font-black text-gray-900">{voucherReturn.return_no}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Date:</span>
                                    <span>{voucherReturn.return_date}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Original Invoice:</span>
                                    <span>{voucherReturn.original_sale_id || 'OTC Counter'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Authorized By:</span>
                                    <span>{voucherReturn.processed_by}</span>
                                </div>
                            </div>

                            <div className="border-t border-b border-dashed border-gray-300 py-2 space-y-1">
                                <div className="flex justify-between text-gray-900 font-bold">
                                    <span>{voucherReturn.product_name}</span>
                                    <span>x{voucherReturn.quantity}</span>
                                </div>
                                <div className="flex justify-between text-[10px] text-gray-500">
                                    <span>Reason:</span>
                                    <span className="italic">{voucherReturn.reason}</span>
                                </div>
                            </div>

                            <div className="flex justify-between items-center text-sm font-black pt-1">
                                <span>TOTAL REFUND:</span>
                                <span className="text-rose-700">
                                    KES {Number(voucherReturn.total_amount ?? voucherReturn.total ?? (voucherReturn.quantity * voucherReturn.unit_price)).toLocaleString()}
                                </span>
                            </div>

                            <div className="text-center text-[9px] text-gray-400 pt-3 border-t border-dashed border-gray-300 font-sans">
                                <p>This voucher serves as proof of pharmaceutical return.</p>
                                <p className="mt-0.5">Alpha Pharmacy POS — Licensed Chemist</p>
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-2">
                            <button
                                onClick={() => setShowVoucherModal(false)}
                                className="px-4 py-2 border border-gray-300 text-gray-700 font-bold rounded-xl text-xs"
                            >
                                Close
                            </button>
                            <button
                                onClick={() => window.print()}
                                className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl text-xs flex items-center gap-1"
                            >
                                <span>🖨️</span> Print Slip
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
