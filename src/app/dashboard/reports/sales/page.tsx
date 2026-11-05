'use client';
// =====================================================================
// Alpha Pharmacy - Super Ultra Sales Master Register & Revenue Audit Hub v2.0
// Ultra-Detailed POS Ledger, Glassmorphic KPI Cards, 360° Sale Dossier,
// Super Pagination, Multi-Dimensional Filters, Bright Excel & Landscape Print
// =====================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, logActivity } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import Link from 'next/link';
import toast from 'react-hot-toast';

export interface SaleRecord {
    sale_id: number;
    receipt_no: string;
    sale_datetime: string;
    customer_name: string | null;
    customer_phone: string | null;
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    payment_method: string;
    mpesa_receipt: string | null;
    amount_paid: number;
    change_amount?: number;
    status: string;
    cashier_name: string | null;
    notes: string | null;
    checkout_request_id?: string | null;
    shift_instance_id?: number | null;
    outlet_id?: number;
    created_at?: string;
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

export default function SalesMasterReportPage() {
    const { activeOutlet } = useOutlet();
    const outletId = activeOutlet?.outlet_id || 1;
    const outletName = activeOutlet?.outlet_name || 'Alpha Pharmacy Main';

    // Core Data
    const [sales, setSales] = useState<SaleRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [avgMarginRate, setAvgMarginRate] = useState(0.3);
    const [isAutoFit, setIsAutoFit] = useState(true);

    // Multi-Dimensional Filters
    const [search, setSearch] = useState('');
    const [filterPayment, setFilterPayment] = useState('All');
    const [filterCashier, setFilterCashier] = useState('All');
    const [filterStatus, setFilterStatus] = useState('All');
    const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
    const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
    const [preset, setPreset] = useState<'today' | 'yesterday' | 'week' | 'month' | 'quarter' | 'all'>('today');
    const [minAmount, setMinAmount] = useState<string>('');
    const [maxAmount, setMaxAmount] = useState<string>('');
    const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'amount_high' | 'amount_low' | 'profit_high' | 'receipt_asc'>('newest');

    // Selection & Bulk Actions
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    // Super Pagination
    const [pageSize, setPageSize] = useState<number>(25);
    const [currentPage, setCurrentPage] = useState<number>(1);

    // 360° Sale Dossier Modal
    const [showDossierModal, setShowDossierModal] = useState(false);
    const [activeSale, setActiveSale] = useState<SaleRecord | null>(null);

    // Formatters
    const fmtDate = (d: string) => {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };
    const fmtTime = (d: string) => {
        if (!d) return '—';
        return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    };

    // =====================================================================
    // LOAD SALES & ESTIMATE MARGIN RATE FROM PRODUCT CATALOGUE
    // =====================================================================
    const loadSales = useCallback(async () => {
        setIsLoading(true);
        try {
            let query = supabase
                .from('pharmacy_sales')
                .select('*')
                .eq('outlet_id', outletId);

            if (dateFrom) query = query.gte('sale_datetime', `${dateFrom}T00:00:00`);
            if (dateTo) query = query.lte('sale_datetime', `${dateTo}T23:59:59`);

            const { data, error } = await query.order('sale_datetime', { ascending: false });

            if (!error && data) {
                setSales(data);
            } else {
                console.error('Failed to load sales:', error);
                toast.error('Failed to load sales records');
            }
        } catch (err: any) {
            console.error('Error fetching sales:', err);
            toast.error('Connection error loading sales');
        } finally {
            setIsLoading(false);
        }
    }, [dateFrom, dateTo, outletId]);

    const loadMargin = useCallback(async () => {
        try {
            const { data } = await supabase
                .from('pharmacy_products')
                .select('purchase_cost, sales_cost')
                .eq('outlet_id', outletId)
                .limit(200);

            if (data && data.length > 0) {
                const margins = (data as { purchase_cost: number; sales_cost: number }[])
                    .filter((p) => p.sales_cost > 0)
                    .map((p) => (p.sales_cost - p.purchase_cost) / p.sales_cost);
                if (margins.length > 0) {
                    const avg = margins.reduce((s, m) => s + m, 0) / margins.length;
                    setAvgMarginRate(avg > 0 ? Math.min(avg, 0.9) : 0.3);
                }
            }
        } catch {
            /* fallback to 0.3 */
        }
    }, [outletId]);

    useEffect(() => {
        loadSales();
    }, [loadSales]);

    useEffect(() => {
        loadMargin();
    }, [loadMargin]);

    // Unique cashiers list
    const cashierList = useMemo(() => {
        const set = new Set<string>();
        sales.forEach((s) => {
            if (s.cashier_name) set.add(s.cashier_name.trim());
        });
        return Array.from(set).sort();
    }, [sales]);

    // =====================================================================
    // DATE RANGE PRESETS
    // =====================================================================
    const applyDatePreset = (p: 'today' | 'yesterday' | 'week' | 'month' | 'quarter' | 'all') => {
        setPreset(p);
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        if (p === 'all') {
            setDateFrom('');
            setDateTo('');
        } else if (p === 'today') {
            setDateFrom(todayStr);
            setDateTo(todayStr);
        } else if (p === 'yesterday') {
            const y = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const yStr = y.toISOString().split('T')[0];
            setDateFrom(yStr);
            setDateTo(yStr);
        } else if (p === 'week') {
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            setDateFrom(weekAgo.toISOString().split('T')[0]);
            setDateTo(todayStr);
        } else if (p === 'month') {
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            setDateFrom(monthStart.toISOString().split('T')[0]);
            setDateTo(todayStr);
        } else if (p === 'quarter') {
            const qAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            setDateFrom(qAgo.toISOString().split('T')[0]);
            setDateTo(todayStr);
        }
        setCurrentPage(1);
    };

    // =====================================================================
    // FILTER & SORT ENGINE
    // =====================================================================
    const filtered = useMemo(() => {
        return sales
            .filter((s) => {
                // Search query
                if (search.trim()) {
                    const q = search.toLowerCase();
                    const matchRec = (s.receipt_no || '').toLowerCase().includes(q);
                    const matchCust = (s.customer_name || '').toLowerCase().includes(q);
                    const matchPhone = (s.customer_phone || '').includes(q);
                    const matchMpesa = (s.mpesa_receipt || '').toLowerCase().includes(q);
                    const matchCashier = (s.cashier_name || '').toLowerCase().includes(q);
                    const matchNotes = (s.notes || '').toLowerCase().includes(q);
                    if (!matchRec && !matchCust && !matchPhone && !matchMpesa && !matchCashier && !matchNotes) {
                        return false;
                    }
                }

                // Payment method
                if (filterPayment !== 'All') {
                    if (!(s.payment_method || '').toLowerCase().includes(filterPayment.toLowerCase())) {
                        return false;
                    }
                }

                // Cashier
                if (filterCashier !== 'All') {
                    if ((s.cashier_name || '').trim() !== filterCashier.trim()) {
                        return false;
                    }
                }

                // Status
                if (filterStatus !== 'All') {
                    if ((s.status || '').toLowerCase() !== filterStatus.toLowerCase()) {
                        return false;
                    }
                }

                // Amount Range
                if (minAmount && (s.total || 0) < Number(minAmount)) return false;
                if (maxAmount && (s.total || 0) > Number(maxAmount)) return false;

                return true;
            })
            .sort((a, b) => {
                if (sortBy === 'newest') return new Date(b.sale_datetime).getTime() - new Date(a.sale_datetime).getTime();
                if (sortBy === 'oldest') return new Date(a.sale_datetime).getTime() - new Date(b.sale_datetime).getTime();
                if (sortBy === 'amount_high') return (b.total || 0) - (a.total || 0);
                if (sortBy === 'amount_low') return (a.total || 0) - (b.total || 0);
                if (sortBy === 'profit_high') {
                    const pa = (a.total || 0) * avgMarginRate;
                    const pb = (b.total || 0) * avgMarginRate;
                    return pb - pa;
                }
                if (sortBy === 'receipt_asc') return (a.receipt_no || '').localeCompare(b.receipt_no || '');
                return 0;
            });
    }, [sales, search, filterPayment, filterCashier, filterStatus, minAmount, maxAmount, sortBy, avgMarginRate]);

    // =====================================================================
    // KPI METRICS COMPUTATION
    // =====================================================================
    const kpis = useMemo(() => {
        const totalCount = filtered.length;
        const totalRevenue = filtered.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
        const totalSubtotal = filtered.reduce((sum, s) => sum + (Number(s.subtotal) || 0), 0);
        const totalDiscount = filtered.reduce((sum, s) => sum + (Number(s.discount) || 0), 0);
        const totalTax = filtered.reduce((sum, s) => sum + (Number(s.tax) || 0), 0);

        // Payment method breakdown
        const cashSales = filtered.filter((s) => (s.payment_method || '').toLowerCase().includes('cash'));
        const totalCash = cashSales.reduce((sum, s) => sum + (Number(s.total) || 0), 0);

        const mpesaSales = filtered.filter((s) => (s.payment_method || '').toLowerCase().includes('mpesa'));
        const totalMpesa = mpesaSales.reduce((sum, s) => sum + (Number(s.total) || 0), 0);

        const creditSales = filtered.filter((s) => (s.payment_method || '').toLowerCase().includes('credit'));
        const totalCredit = creditSales.reduce((sum, s) => sum + (Number(s.total) || 0), 0);

        const cardSales = filtered.filter((s) => (s.payment_method || '').toLowerCase().includes('card'));
        const totalCard = cardSales.reduce((sum, s) => sum + (Number(s.total) || 0), 0);

        // Profit metrics
        const estProfit = Math.round(totalRevenue * avgMarginRate);
        const estCOGS = totalRevenue - estProfit;
        const profitMarginPct = totalRevenue > 0 ? Math.round((estProfit / totalRevenue) * 100) : 0;
        const avgOrder = totalCount > 0 ? Math.round(totalRevenue / totalCount) : 0;
        const completedCount = filtered.filter((s) => (s.status || '').toLowerCase() === 'completed').length;

        // Cashier stats
        const cashierMap: Record<string, { name: string; count: number; revenue: number }> = {};
        filtered.forEach((s) => {
            const c = s.cashier_name || 'Staff Dispenser';
            if (!cashierMap[c]) cashierMap[c] = { name: c, count: 0, revenue: 0 };
            cashierMap[c].count++;
            cashierMap[c].revenue += Number(s.total) || 0;
        });
        const cashierStats = Object.values(cashierMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

        return {
            totalCount,
            totalRevenue,
            totalSubtotal,
            totalDiscount,
            totalTax,
            totalCash,
            cashCount: cashSales.length,
            totalMpesa,
            mpesaCount: mpesaSales.length,
            totalCredit,
            creditCount: creditSales.length,
            totalCard,
            cardCount: cardSales.length,
            estProfit,
            estCOGS,
            profitMarginPct,
            avgOrder,
            completedCount,
            cashierStats,
        };
    }, [filtered, avgMarginRate]);

    // =====================================================================
    // SUPER PAGINATION ENGINE
    // =====================================================================
    const totalPages = pageSize === -1 ? 1 : Math.max(1, Math.ceil(filtered.length / pageSize));
    const paginated = useMemo(() => {
        if (pageSize === -1) return filtered;
        const start = (currentPage - 1) * pageSize;
        return filtered.slice(start, start + pageSize);
    }, [filtered, currentPage, pageSize]);

    const getPageNumbers = () => {
        if (totalPages <= 7) {
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }
        const pages: (number | string)[] = [];
        if (currentPage <= 4) {
            pages.push(1, 2, 3, 4, 5, '...', totalPages);
        } else if (currentPage >= totalPages - 3) {
            pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
        } else {
            pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
        }
        return pages;
    };

    // Bulk selection
    const handleSelectAll = (checked: boolean) => {
        if (checked) setSelectedIds(new Set(paginated.map((s) => s.sale_id)));
        else setSelectedIds(new Set());
    };

    const handleSelectOne = (id: number) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    // Payment styling helper
    const getPaymentBadge = (method: string) => {
        const m = (method || '').toLowerCase();
        if (m.includes('mpesa')) return { bg: 'bg-emerald-100 text-emerald-900 border-emerald-300', text: 'M-PESA', icon: '📱' };
        if (m.includes('cash')) return { bg: 'bg-blue-100 text-blue-900 border-blue-300', text: 'CASH', icon: '💵' };
        if (m.includes('credit')) return { bg: 'bg-amber-100 text-amber-900 border-amber-300', text: 'CREDIT', icon: '📋' };
        if (m.includes('card')) return { bg: 'bg-purple-100 text-purple-900 border-purple-300', text: 'CARD', icon: '💳' };
        return { bg: 'bg-gray-100 text-gray-800 border-gray-300', text: method || 'OTHER', icon: '🏷️' };
    };

    // =====================================================================
    // BRIGHT COLORS EXCEL EXPORTER (SpreadsheetML XML)
    // Matches the exact high-voltage vivid styling of Purchases Master Ledger
    // =====================================================================
    const exportBrightExcel = () => {
        if (filtered.length === 0) {
            toast.error('No sales records to export');
            return;
        }

        const genDate = new Date().toLocaleString('en-GB');
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
   <Interior ss:Color="#0D47A1" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="MetaBanner">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#0091EA" ss:Pattern="Solid"/>
  </Style>

  <!-- VIVID KPI CARDS -->
  <Style ss:ID="KpiHdrPurple">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="9" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#5E35B1" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="KpiValPurple">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="13" ss:Bold="1" ss:Color="#311B92"/>
   <Interior ss:Color="#EDE7F6" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="&quot;Ksh &quot;#,##0.00"/>
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
   <NumberFormat ss:Format="&quot;Ksh &quot;#,##0.00"/>
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
   <NumberFormat ss:Format="&quot;Ksh &quot;#,##0.00"/>
  </Style>

  <!-- TABLE HEADER -->
  <Style ss:ID="ColHeader">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#1E293B" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#00E676"/>
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
  <Style ss:ID="CellProfit">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#00796B"/>
   <NumberFormat ss:Format="&quot;Ksh &quot;#,##0.00"/>
  </Style>
  <Style ss:ID="BadgeMpesa">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="9.5" ss:Bold="1" ss:Color="#1B5E20"/>
   <Interior ss:Color="#C8E6C9" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="BadgeCash">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="9.5" ss:Bold="1" ss:Color="#0D47A1"/>
   <Interior ss:Color="#BBDEFB" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="BadgeCredit">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="9.5" ss:Bold="1" ss:Color="#E65100"/>
   <Interior ss:Color="#FFE0B2" ss:Pattern="Solid"/>
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

 <Worksheet ss:Name="Sales Revenue Ledger">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="40"/>  <!-- # -->
   <Column ss:Width="75"/>  <!-- Date -->
   <Column ss:Width="60"/>  <!-- Time -->
   <Column ss:Width="95"/>  <!-- Receipt # -->
   <Column ss:Width="140"/> <!-- Customer -->
   <Column ss:Width="95"/>  <!-- Phone -->
   <Column ss:Width="85"/>  <!-- Payment -->
   <Column ss:Width="90"/>  <!-- Subtotal -->
   <Column ss:Width="75"/>  <!-- Discount -->
   <Column ss:Width="95"/>  <!-- Total -->
   <Column ss:Width="95"/>  <!-- Est. Profit -->
   <Column ss:Width="110"/> <!-- M-Pesa Code -->
   <Column ss:Width="110"/> <!-- Cashier -->
   <Column ss:Width="80"/>  <!-- Status -->

   <!-- Title Banner -->
   <Row ss:Height="34">
    <Cell ss:MergeAcross="13" ss:StyleID="TitleBanner"><Data ss:Type="String">ALPHA PHARMACY - SALES MASTER AUDIT &amp; REVENUE LEDGER</Data></Cell>
   </Row>

   <!-- Meta Banner -->
   <Row ss:Height="20">
    <Cell ss:MergeAcross="13" ss:StyleID="MetaBanner"><Data ss:Type="String">Generated: ${genDate} | Outlet: ${escapeXml(outletName)} | Period: ${dateFrom || 'All'} to ${dateTo || 'All'} | Count: ${filtered.length} Orders</Data></Cell>
   </Row>

   <!-- KPI Cards Row -->
   <Row ss:Height="18">
    <Cell ss:MergeAcross="3" ss:StyleID="KpiHdrPurple"><Data ss:Type="String">TOTAL REVENUE COLLECTED</Data></Cell>
    <Cell ss:MergeAcross="4" ss:StyleID="KpiHdrGreen"><Data ss:Type="String">ESTIMATED GROSS PROFIT (${Math.round(avgMarginRate * 100)}% MARGIN)</Data></Cell>
    <Cell ss:MergeAcross="4" ss:StyleID="KpiHdrRed"><Data ss:Type="String">TOTAL DISCOUNTS ALLOWED</Data></Cell>
   </Row>
   <Row ss:Height="24">
    <Cell ss:MergeAcross="3" ss:StyleID="KpiValPurple"><Data ss:Type="Number">${kpis.totalRevenue}</Data></Cell>
    <Cell ss:MergeAcross="4" ss:StyleID="KpiValGreen"><Data ss:Type="Number">${kpis.estProfit}</Data></Cell>
    <Cell ss:MergeAcross="4" ss:StyleID="KpiValRed"><Data ss:Type="Number">${kpis.totalDiscount}</Data></Cell>
   </Row>

   <Row ss:Height="10"/>

   <!-- Table Headers -->
   <Row ss:Height="24">
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">#</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">DATE</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">TIME</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">RECEIPT #</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">CUSTOMER</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">PHONE</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">PAYMENT</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">SUBTOTAL</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">DISCOUNT</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">TOTAL</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">EST. PROFIT</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">M-PESA CODE</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">CASHIER</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">STATUS</Data></Cell>
   </Row>

   <!-- Rows -->
   ${filtered
       .map((s, idx) => {
           const pStyle = (s.payment_method || '').toLowerCase().includes('mpesa')
               ? 'BadgeMpesa'
               : (s.payment_method || '').toLowerCase().includes('cash')
               ? 'BadgeCash'
               : 'BadgeCredit';
           const ep = Math.round((Number(s.total) || 0) * avgMarginRate);

           return `<Row ss:Height="20">
    <Cell ss:StyleID="CellCenter"><Data ss:Type="Number">${idx + 1}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXml(fmtDate(s.sale_datetime))}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXml(fmtTime(s.sale_datetime))}</Data></Cell>
    <Cell ss:StyleID="CellTextBold"><Data ss:Type="String">${escapeXml(s.receipt_no)}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${escapeXml(s.customer_name || 'Walk-in')}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXml(s.customer_phone || '—')}</Data></Cell>
    <Cell ss:StyleID="${pStyle}"><Data ss:Type="String">${escapeXml(s.payment_method || 'Cash')}</Data></Cell>
    <Cell ss:StyleID="CellCurrency"><Data ss:Type="Number">${s.subtotal || 0}</Data></Cell>
    <Cell ss:StyleID="CellCurrency"><Data ss:Type="Number">${s.discount || 0}</Data></Cell>
    <Cell ss:StyleID="CellCurrency"><Data ss:Type="Number">${s.total || 0}</Data></Cell>
    <Cell ss:StyleID="CellProfit"><Data ss:Type="Number">${ep}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXml(s.mpesa_receipt || '—')}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${escapeXml(s.cashier_name || 'Staff')}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXml(s.status || 'Completed')}</Data></Cell>
   </Row>`;
       })
       .join('\n')}

   <!-- Grand Summary Totals -->
   <Row ss:Height="24">
    <Cell ss:MergeAcross="6" ss:StyleID="SummaryLabel"><Data ss:Type="String">GRAND TOTALS (${filtered.length} TRANSACTIONS):</Data></Cell>
    <Cell ss:StyleID="SummaryVal"><Data ss:Type="Number">${kpis.totalSubtotal}</Data></Cell>
    <Cell ss:StyleID="SummaryVal"><Data ss:Type="Number">${kpis.totalDiscount}</Data></Cell>
    <Cell ss:StyleID="SummaryVal"><Data ss:Type="Number">${kpis.totalRevenue}</Data></Cell>
    <Cell ss:StyleID="SummaryVal"><Data ss:Type="Number">${kpis.estProfit}</Data></Cell>
    <Cell ss:MergeAcross="2" ss:StyleID="SummaryLabel"><Data ss:Type="String">—</Data></Cell>
   </Row>
  </Table>
 </Worksheet>
</Workbook>`;

        const blob = new Blob([xmlString], { type: 'application/vnd.ms-excel;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AlphaPharmacy_Sales_Audit_${new Date().toISOString().split('T')[0]}_SuperUltra.xls`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`Exported ${filtered.length} sales to Super Bright Excel!`);
    };

    // CSV Export
    const exportCSV = () => {
        const rows = [
            ['#', 'Date', 'Time', 'Receipt #', 'Customer', 'Phone', 'Payment', 'Subtotal', 'Discount', 'Total', 'Est. Profit', 'M-Pesa Code', 'Cashier', 'Status']
        ];
        filtered.forEach((s, idx) => {
            rows.push([
                String(idx + 1),
                fmtDate(s.sale_datetime),
                fmtTime(s.sale_datetime),
                s.receipt_no,
                s.customer_name || 'Walk-in',
                s.customer_phone || '',
                s.payment_method,
                String(s.subtotal || 0),
                String(s.discount || 0),
                String(s.total || 0),
                String(Math.round((s.total || 0) * avgMarginRate)),
                s.mpesa_receipt || '',
                s.cashier_name || '',
                s.status || ''
            ]);
        });
        const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AlphaPharmacy_Sales_${dateFrom}_${dateTo}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('CSV exported successfully!');
    };

    // Landscape Print Report
    const printReport = () => {
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Alpha Pharmacy - Sales Audit Report</title>
<style>@page{margin:8mm;size:A4 landscape;}body{font-family:Arial,sans-serif;font-size:9px;color:#000;margin:0;}
h1{font-size:14px;margin:0 0 2px;}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;border-bottom:2px solid #1e293b;padding-bottom:6px;}
.metrics{display:grid;grid-template-columns:repeat(6,1fr);gap:4px;margin-bottom:8px;}
.metric{border:1px solid #cbd5e1;border-radius:4px;padding:4px;text-align:center;}
.metric .lbl{font-size:7px;color:#475569;text-transform:uppercase;font-weight:700;}
.metric .val{font-size:11px;font-weight:800;color:#0f172a;}
table{width:100%;border-collapse:collapse;font-size:8px;}
th,td{border:1px solid #cbd5e1;padding:3px 5px;text-align:left;}
th{background:#1e293b;color:#fff;font-weight:700;font-size:7px;text-transform:uppercase;}
.r{text-align:right;}.c{text-align:center;}.b{font-weight:700;}
tr:nth-child(even){background:#f8fafc;}
.mpesa{color:#065f46;font-weight:700;}.cash{color:#1e40af;font-weight:700;}.credit{color:#92400e;font-weight:700;}
.profit{color:#0f766e;font-weight:700;}
tfoot tr{background:#ecfdf5;font-weight:800;border-top:2px solid #1e293b;}
</style></head><body>
<div class="hdr">
<div><h1>🏥 ALPHA PHARMACY POS — SALES AUDIT REPORT</h1>
<div style="font-size:9px;color:#475569;">${escapeXml(outletName)} &nbsp;|&nbsp; ${dateFrom || 'All'} → ${dateTo || 'All'} &nbsp;|&nbsp; ${filtered.length} Orders &nbsp;|&nbsp; Printed: ${new Date().toLocaleString('en-GB')}</div>
</div>
<div style="font-size:9px;text-align:right;color:#0f172a;">Est. Margin: ${Math.round(avgMarginRate * 100)}% avg</div>
</div>
<div class="metrics">
<div class="metric"><div class="lbl">Total Revenue</div><div class="val">Ksh ${kpis.totalRevenue.toLocaleString()}</div></div>
<div class="metric"><div class="lbl">Cash Sales</div><div class="val">Ksh ${kpis.totalCash.toLocaleString()}</div></div>
<div class="metric"><div class="lbl">M-Pesa Sales</div><div class="val">Ksh ${kpis.totalMpesa.toLocaleString()}</div></div>
<div class="metric"><div class="lbl">Credit Sales</div><div class="val">Ksh ${kpis.totalCredit.toLocaleString()}</div></div>
<div class="metric"><div class="lbl">Est. Gross Profit</div><div class="val profit">Ksh ${kpis.estProfit.toLocaleString()}</div></div>
<div class="metric"><div class="lbl">Order Volume</div><div class="val">${kpis.completedCount}/${filtered.length}</div></div>
</div>
<table><thead><tr>
<th>#</th><th>Date</th><th>Time</th><th>Receipt #</th><th>Customer</th><th>Phone</th>
<th>Payment</th><th class="r">Subtotal</th><th class="r">Disc.</th>
<th class="r">Total</th><th class="r">Est. Profit</th><th>M-Pesa Code</th><th>Cashier</th><th>Status</th>
</tr></thead><tbody>
${filtered.map((s, i) => `<tr>
<td class="c">${i + 1}</td><td class="c">${fmtDate(s.sale_datetime)}</td><td class="c">${fmtTime(s.sale_datetime)}</td>
<td class="b">${escapeXml(s.receipt_no)}</td><td>${escapeXml(s.customer_name || 'Walk-in')}</td>
<td class="c">${escapeXml(s.customer_phone || '—')}</td>
<td class="c b ${(s.payment_method || '').toLowerCase().includes('mpesa') ? 'mpesa' : (s.payment_method || '').toLowerCase().includes('cash') ? 'cash' : 'credit'}">${escapeXml(s.payment_method)}</td>
<td class="r">Ksh ${(s.subtotal || 0).toLocaleString()}</td>
<td class="r">${s.discount > 0 ? '-' + s.discount.toLocaleString() : '—'}</td>
<td class="r b">Ksh ${(s.total || 0).toLocaleString()}</td>
<td class="r profit">Ksh ${Math.round((s.total || 0) * avgMarginRate).toLocaleString()}</td>
<td class="c">${escapeXml(s.mpesa_receipt || '—')}</td><td>${escapeXml(s.cashier_name || '—')}</td><td class="c">${escapeXml(s.status || '—')}</td>
</tr>`).join('')}
</tbody><tfoot><tr>
<td colspan="7" class="b">TOTALS (${filtered.length} Orders)</td>
<td class="r b">Ksh ${kpis.totalSubtotal.toLocaleString()}</td>
<td class="r b">-${kpis.totalDiscount.toLocaleString()}</td>
<td class="r b">Ksh ${kpis.totalRevenue.toLocaleString()}</td>
<td class="r b profit">Ksh ${kpis.estProfit.toLocaleString()}</td>
<td colspan="3"></td>
</tr></tfoot></table>
<div style="margin-top:6px;font-size:7px;color:#64748b;">* Est. Profit calculated with ${Math.round(avgMarginRate * 100)}% catalogue cost margin fallback.</div>
</body></html>`;
        const w = window.open('', '_blank');
        if (w) {
            w.document.write(html);
            w.document.close();
            w.print();
        }
    };

    // Print Single Receipt Slip
    const printSingleReceipt = (sale: SaleRecord) => {
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Receipt ${sale.receipt_no}</title>
<style>@page{size:80mm auto;margin:3mm;}body{font-family:monospace;font-size:11px;color:#000;margin:0;padding:4px;}
.c{text-align:center;}.b{font-weight:bold;}.r{text-align:right;}
.line{border-top:1px dashed #000;margin:4px 0;}
table{width:100%;border-collapse:collapse;}td{padding:2px 0;}
</style></head><body>
<div class="c b" style="font-size:14px;">ALPHA PHARMACY</div>
<div class="c">${escapeXml(outletName)}</div>
<div class="c" style="font-size:9px;">Official POS Dispensing Receipt</div>
<div class="line"></div>
<div>Receipt: <span class="b">${escapeXml(sale.receipt_no)}</span></div>
<div>Date: ${fmtDate(sale.sale_datetime)} ${fmtTime(sale.sale_datetime)}</div>
<div>Customer: ${escapeXml(sale.customer_name || 'Walk-in Patient')}</div>
${sale.customer_phone ? `<div>Phone: ${escapeXml(sale.customer_phone)}</div>` : ''}
<div>Cashier: ${escapeXml(sale.cashier_name || 'Staff')}</div>
<div class="line"></div>
<table>
<tr><td>Subtotal</td><td class="r">Ksh ${(sale.subtotal || 0).toLocaleString()}</td></tr>
${sale.discount > 0 ? `<tr><td>Discount</td><td class="r">-Ksh ${sale.discount.toLocaleString()}</td></tr>` : ''}
${sale.tax > 0 ? `<tr><td>Tax / VAT</td><td class="r">Ksh ${sale.tax.toLocaleString()}</td></tr>` : ''}
<tr class="b"><td style="font-size:13px;">TOTAL</td><td class="r" style="font-size:13px;">Ksh ${(sale.total || 0).toLocaleString()}</td></tr>
</table>
<div class="line"></div>
<div>Payment: <span class="b">${escapeXml(sale.payment_method)}</span></div>
${sale.mpesa_receipt ? `<div>M-Pesa Ref: <span class="b font-mono">${escapeXml(sale.mpesa_receipt)}</span></div>` : ''}
${sale.notes ? `<div>Notes: ${escapeXml(sale.notes)}</div>` : ''}
<div class="line"></div>
<div class="c" style="font-size:9px;">Quick Recovery • Quality Medicines</div>
<div class="c" style="font-size:8px;">Thank you for choosing Alpha Pharmacy!</div>
</body></html>`;
        const w = window.open('', '_blank');
        if (w) {
            w.document.write(html);
            w.document.close();
            w.print();
        }
    };

    if (isLoading && sales.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-96" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
                <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                <p className="mt-4 text-gray-900 font-bold text-sm">Loading Sales Master Register...</p>
                <p className="text-xs text-gray-500 mt-1">Calculating revenue analytics, payment audit &amp; profit margins</p>
            </div>
        );
    }

    return (
        <div
            className="w-full max-w-full min-w-0 overflow-x-hidden space-y-4 px-1 md:px-2 pb-16"
            style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}
        >
            {/* =====================================================================
                HEADER: TITLE, OUTLET BADGES & ACTION SUITE (LIKE PURCHASES PAGE)
            ===================================================================== */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 w-full">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg flex-shrink-0">
                        📊
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">
                                Sales Master Register &amp; Ledger
                            </h1>
                            <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-900 rounded-full text-xs font-bold border border-emerald-200">
                                Enterprise Audit
                            </span>
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-900 rounded-md text-[11px] font-bold border border-blue-200">
                                Live DB: pharmacy_sales
                            </span>
                        </div>
                        <p className="text-gray-600 text-xs mt-0.5">
                            Active Outlet: <span className="font-bold text-gray-900">{outletName}</span> • Real-time POS collections, M-Pesa settlements, cashier audit &amp; estimated gross profit
                        </p>
                    </div>
                </div>

                <div className="flex items-center flex-wrap gap-2">
                    {/* Link to POS */}
                    <Link
                        href="/dashboard/pos"
                        className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl font-bold shadow-xs hover:shadow transition-all flex items-center gap-1.5 text-xs active:scale-95"
                    >
                        <span>🛒</span> Open POS
                    </Link>

                    {/* Bright Excel Export */}
                    <button
                        onClick={exportBrightExcel}
                        className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 rounded-xl font-bold shadow-xs transition-all flex items-center gap-1.5 text-xs"
                        title="Download Massive Styled Excel Workbook"
                    >
                        <span>📊</span> Super Excel
                    </button>

                    {/* CSV Export */}
                    <button
                        onClick={exportCSV}
                        className="px-3 py-2 bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 rounded-xl font-bold shadow-xs transition-all flex items-center gap-1.5 text-xs"
                    >
                        <span>📥</span> CSV
                    </button>

                    {/* Print Master View */}
                    <button
                        onClick={printReport}
                        className="px-3 py-2 bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 rounded-xl font-bold shadow-xs transition-all flex items-center gap-1 text-xs"
                    >
                        <span>🖨️</span> Print
                    </button>

                    {/* Refresh Live DB */}
                    <button
                        onClick={() => {
                            loadSales();
                            toast.success('Sales reloaded from live DB!');
                        }}
                        className="px-3 py-2 bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 rounded-xl font-bold shadow-xs transition-all flex items-center gap-1 text-xs"
                    >
                        <span>🔄</span> Refresh
                    </button>
                </div>
            </div>

            {/* =====================================================================
                GLASSMORPHIC STAT CARDS (ROW 1 & 2): 8 SUPER VIVID CARDS THAT FIT
            ===================================================================== */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full">
                {/* 1. Total Revenue */}
                <div
                    style={{ background: 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)', boxShadow: '0 8px 24px rgba(102,126,234,0.3)' }}
                    className="rounded-2xl p-3.5 text-white relative overflow-hidden flex flex-col justify-between"
                >
                    <div style={{ position: 'absolute', top: -15, right: -15, width: 65, height: 65, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
                    <div style={{ position: 'absolute', bottom: -20, left: -10, width: 50, height: 50, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider opacity-85">TOTAL REVENUE</div>
                        <div className="text-base sm:text-lg font-black tracking-tight mt-1">Ksh {kpis.totalRevenue.toLocaleString()}</div>
                    </div>
                    <div className="text-[10px] opacity-75 mt-1">{filtered.length} Filtered Transactions</div>
                    <div className="absolute bottom-2 right-2.5 text-2xl opacity-20">💰</div>
                </div>

                {/* 2. Cash Collections */}
                <div
                    style={{ background: 'linear-gradient(135deg,#11998e 0%,#38ef7d 100%)', boxShadow: '0 8px 24px rgba(17,153,142,0.3)' }}
                    className="rounded-2xl p-3.5 text-white relative overflow-hidden flex flex-col justify-between"
                >
                    <div style={{ position: 'absolute', top: -15, right: -15, width: 65, height: 65, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
                    <div style={{ position: 'absolute', bottom: -20, left: -10, width: 50, height: 50, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider opacity-85">CASH COLLECTED</div>
                        <div className="text-base sm:text-lg font-black tracking-tight mt-1">Ksh {kpis.totalCash.toLocaleString()}</div>
                    </div>
                    <div className="text-[10px] opacity-75 mt-1">{kpis.cashCount} Cash Orders ({kpis.totalRevenue > 0 ? Math.round((kpis.totalCash / kpis.totalRevenue) * 100) : 0}%)</div>
                    <div className="absolute bottom-2 right-2.5 text-2xl opacity-20">💵</div>
                </div>

                {/* 3. M-Pesa Collections */}
                <div
                    style={{ background: 'linear-gradient(135deg,#059669 0%,#10b981 100%)', boxShadow: '0 8px 24px rgba(16,185,129,0.3)' }}
                    className="rounded-2xl p-3.5 text-white relative overflow-hidden flex flex-col justify-between"
                >
                    <div style={{ position: 'absolute', top: -15, right: -15, width: 65, height: 65, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
                    <div style={{ position: 'absolute', bottom: -20, left: -10, width: 50, height: 50, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider opacity-85">M-PESA SETTLED</div>
                        <div className="text-base sm:text-lg font-black tracking-tight mt-1">Ksh {kpis.totalMpesa.toLocaleString()}</div>
                    </div>
                    <div className="text-[10px] opacity-75 mt-1">{kpis.mpesaCount} Mobile Money ({kpis.totalRevenue > 0 ? Math.round((kpis.totalMpesa / kpis.totalRevenue) * 100) : 0}%)</div>
                    <div className="absolute bottom-2 right-2.5 text-2xl opacity-20">📱</div>
                </div>

                {/* 4. Credit Sales */}
                <div
                    style={{ background: 'linear-gradient(135deg,#f7971e 0%,#ffd200 100%)', boxShadow: '0 8px 24px rgba(247,151,30,0.3)' }}
                    className="rounded-2xl p-3.5 text-white relative overflow-hidden flex flex-col justify-between"
                >
                    <div style={{ position: 'absolute', top: -15, right: -15, width: 65, height: 65, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
                    <div style={{ position: 'absolute', bottom: -20, left: -10, width: 50, height: 50, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider opacity-85">CREDIT / ON-ACCOUNT</div>
                        <div className="text-base sm:text-lg font-black tracking-tight mt-1">Ksh {kpis.totalCredit.toLocaleString()}</div>
                    </div>
                    <div className="text-[10px] opacity-75 mt-1">{kpis.creditCount} Credit Sales</div>
                    <div className="absolute bottom-2 right-2.5 text-2xl opacity-20">📋</div>
                </div>

                {/* 5. Est. Gross Profit */}
                <div
                    style={{ background: 'linear-gradient(135deg,#00b09b 0%,#96c93d 100%)', boxShadow: '0 8px 24px rgba(0,176,155,0.3)' }}
                    className="rounded-2xl p-3.5 text-white relative overflow-hidden flex flex-col justify-between"
                >
                    <div style={{ position: 'absolute', top: -15, right: -15, width: 65, height: 65, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
                    <div style={{ position: 'absolute', bottom: -20, left: -10, width: 50, height: 50, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider opacity-85">EST. GROSS PROFIT</div>
                        <div className="text-base sm:text-lg font-black tracking-tight mt-1">Ksh {kpis.estProfit.toLocaleString()}</div>
                    </div>
                    <div className="text-[10px] opacity-75 mt-1">{kpis.profitMarginPct}% Est. Margin ({Math.round(avgMarginRate * 100)}% base)</div>
                    <div className="absolute bottom-2 right-2.5 text-2xl opacity-20">📈</div>
                </div>

                {/* 6. Total Discounts */}
                <div
                    style={{ background: 'linear-gradient(135deg,#f44336 0%,#e91e63 100%)', boxShadow: '0 8px 24px rgba(244,67,54,0.3)' }}
                    className="rounded-2xl p-3.5 text-white relative overflow-hidden flex flex-col justify-between"
                >
                    <div style={{ position: 'absolute', top: -15, right: -15, width: 65, height: 65, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
                    <div style={{ position: 'absolute', bottom: -20, left: -10, width: 50, height: 50, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider opacity-85">TOTAL DISCOUNTS</div>
                        <div className="text-base sm:text-lg font-black tracking-tight mt-1">Ksh {kpis.totalDiscount.toLocaleString()}</div>
                    </div>
                    <div className="text-[10px] opacity-75 mt-1">{filtered.filter((s) => s.discount > 0).length} Concessions Issued</div>
                    <div className="absolute bottom-2 right-2.5 text-2xl opacity-20">🏷️</div>
                </div>

                {/* 7. Average Basket */}
                <div
                    style={{ background: 'linear-gradient(135deg,#06b6d4 0%,#3b82f6 100%)', boxShadow: '0 8px 24px rgba(6,182,212,0.3)' }}
                    className="rounded-2xl p-3.5 text-white relative overflow-hidden flex flex-col justify-between"
                >
                    <div style={{ position: 'absolute', top: -15, right: -15, width: 65, height: 65, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
                    <div style={{ position: 'absolute', bottom: -20, left: -10, width: 50, height: 50, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider opacity-85">AVERAGE BASKET</div>
                        <div className="text-base sm:text-lg font-black tracking-tight mt-1">Ksh {kpis.avgOrder.toLocaleString()}</div>
                    </div>
                    <div className="text-[10px] opacity-75 mt-1">Mean Value per Transaction</div>
                    <div className="absolute bottom-2 right-2.5 text-2xl opacity-20">🛒</div>
                </div>

                {/* 8. Order Volume */}
                <div
                    style={{ background: 'linear-gradient(135deg,#1e293b 0%,#334155 100%)', boxShadow: '0 8px 24px rgba(30,41,59,0.3)' }}
                    className="rounded-2xl p-3.5 text-white relative overflow-hidden flex flex-col justify-between"
                >
                    <div style={{ position: 'absolute', top: -15, right: -15, width: 65, height: 65, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
                    <div style={{ position: 'absolute', bottom: -20, left: -10, width: 50, height: 50, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider opacity-85">TOTAL VOLUME</div>
                        <div className="text-base sm:text-lg font-black tracking-tight mt-1">{filtered.length} Orders</div>
                    </div>
                    <div className="text-[10px] opacity-75 mt-1">{kpis.completedCount} Dispensed &amp; Completed</div>
                    <div className="absolute bottom-2 right-2.5 text-2xl opacity-20">🧾</div>
                </div>
            </div>

            {/* =====================================================================
                ANALYTICS BREAKDOWN STRIP: PAYMENT DISTRIBUTION & CASHIER AUDIT
            ===================================================================== */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 w-full">
                {/* Payment Breakdown Bar Strip */}
                <div className="lg:col-span-3 bg-white rounded-3xl border border-gray-200 p-4 shadow-xs">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider">📊 Payment Channel Distribution</h3>
                            <p className="text-[11px] text-gray-500 mt-0.5">Real-time revenue split across active payment gateways</p>
                        </div>
                        <span className="text-xs font-bold text-gray-900">Total: Ksh {kpis.totalRevenue.toLocaleString()}</span>
                    </div>

                    <div className="space-y-2.5">
                        {[
                            { label: 'M-Pesa Mobile Money', value: kpis.totalMpesa, count: kpis.mpesaCount, color: '#10b981', icon: '📱' },
                            { label: 'Cash Payments', value: kpis.totalCash, count: kpis.cashCount, color: '#3b82f6', icon: '💵' },
                            { label: 'Credit / Accounts', value: kpis.totalCredit, count: kpis.creditCount, color: '#f59e0b', icon: '📋' },
                            { label: 'Debit / Credit Card', value: kpis.totalCard, count: kpis.cardCount, color: '#8b5cf6', icon: '💳' },
                        ].map((m, i) => {
                            const pct = kpis.totalRevenue > 0 ? Math.round((m.value / kpis.totalRevenue) * 100) : 0;
                            return (
                                <div key={i}>
                                    <div className="flex items-center justify-between text-xs mb-1">
                                        <span className="font-semibold text-gray-800 flex items-center gap-1.5">
                                            <span>{m.icon}</span> {m.label}
                                            <span className="text-[10px] text-gray-400 font-mono">({m.count} txns)</span>
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] text-gray-400 font-mono">{pct}%</span>
                                            <span className="font-bold text-gray-900 font-mono">Ksh {m.value.toLocaleString()}</span>
                                        </div>
                                    </div>
                                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <div style={{ width: `${pct}%`, background: m.color, height: '100%', borderRadius: 999, transition: 'width 0.5s ease' }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-100 grid grid-cols-3 gap-2">
                        <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-200 text-center">
                            <p className="text-[10px] text-gray-500 uppercase font-bold">Gross Revenue</p>
                            <p className="text-xs font-black text-gray-900 mt-0.5">Ksh {kpis.totalRevenue.toLocaleString()}</p>
                        </div>
                        <div className="p-2.5 bg-red-50 rounded-xl border border-red-200 text-center">
                            <p className="text-[10px] text-red-700 uppercase font-bold">Est. Product COGS</p>
                            <p className="text-xs font-black text-red-700 mt-0.5">Ksh {kpis.estCOGS.toLocaleString()}</p>
                        </div>
                        <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
                            <p className="text-[10px] text-emerald-800 uppercase font-bold">Est. Gross Profit</p>
                            <p className="text-xs font-black text-emerald-800 mt-0.5">Ksh {kpis.estProfit.toLocaleString()}</p>
                        </div>
                    </div>
                </div>

                {/* Cashier Performance Leaderboard */}
                <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-200 p-4 shadow-xs flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider">👨‍⚕️ Cashier Performance</h3>
                                <p className="text-[11px] text-gray-500 mt-0.5">Top dispensing staff by revenue</p>
                            </div>
                        </div>

                        {kpis.cashierStats.length === 0 ? (
                            <p className="text-xs text-gray-400 text-center py-6">No cashier records in range</p>
                        ) : (
                            <div className="space-y-2">
                                {kpis.cashierStats.map((c, idx) => {
                                    const pct = kpis.totalRevenue > 0 ? Math.round((c.revenue / kpis.totalRevenue) * 100) : 0;
                                    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
                                    return (
                                        <div key={idx} className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-gray-50">
                                            <span className="text-sm">{medals[idx] || '👤'}</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between text-xs mb-0.5">
                                                    <span className="font-bold text-gray-900 truncate">{c.name}</span>
                                                    <span className="font-mono font-bold text-gray-800 text-[11px]">Ksh {c.revenue.toLocaleString()}</span>
                                                </div>
                                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                    <div style={{ width: `${pct}%`, background: '#10b981', height: '100%', borderRadius: 999 }} />
                                                </div>
                                                <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                                                    <span>{c.count} transactions</span>
                                                    <span>{pct}% of revenue</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="mt-3 p-2.5 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-emerald-800 uppercase">Estimated Profit Margin</p>
                            <p className="text-sm font-black text-emerald-900">{kpis.profitMarginPct}%</p>
                        </div>
                        <span className="text-xl">📈</span>
                    </div>
                </div>
            </div>

            {/* =====================================================================
                MULTI-DIMENSIONAL FILTER SUITE (PURCHASES PAGE STYLE)
            ===================================================================== */}
            <div className="bg-white rounded-3xl p-4 border border-gray-200 shadow-xs space-y-3">
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
                    {/* Omni-Search */}
                    <div className="relative flex-1 min-w-[220px]">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setCurrentPage(1);
                            }}
                            placeholder="Search by Receipt # (RX-001), Customer, Phone, M-Pesa Code, Cashier..."
                            className="w-full pl-8 pr-7 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold focus:bg-white focus:border-emerald-600 outline-none text-gray-900"
                        />
                        {search && (
                            <button
                                onClick={() => setSearch('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black text-xs font-bold"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Filter Payment Method */}
                    <select
                        value={filterPayment}
                        onChange={(e) => {
                            setFilterPayment(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="px-2.5 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:border-emerald-600 outline-none"
                    >
                        <option value="All">💳 All Payment Methods</option>
                        <option value="Cash">💵 Cash</option>
                        <option value="Mpesa">📱 M-Pesa</option>
                        <option value="Credit">📋 Credit / Account</option>
                        <option value="Card">💳 Card</option>
                    </select>

                    {/* Filter Cashier */}
                    <select
                        value={filterCashier}
                        onChange={(e) => {
                            setFilterCashier(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="px-2.5 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:border-emerald-600 outline-none"
                    >
                        <option value="All">👨‍⚕️ All Cashiers</option>
                        {cashierList.map((c) => (
                            <option key={c} value={c}>
                                {c}
                            </option>
                        ))}
                    </select>

                    {/* Filter Status */}
                    <select
                        value={filterStatus}
                        onChange={(e) => {
                            setFilterStatus(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="px-2.5 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:border-emerald-600 outline-none"
                    >
                        <option value="All">📌 All Statuses</option>
                        <option value="Completed">✅ Completed</option>
                        <option value="Pending">⏳ Pending</option>
                    </select>

                    {/* Sort By */}
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="px-2.5 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:border-emerald-600 outline-none"
                    >
                        <option value="newest">Sort: Newest First</option>
                        <option value="oldest">Sort: Oldest First</option>
                        <option value="amount_high">Sort: Amount (High→Low)</option>
                        <option value="amount_low">Sort: Amount (Low→High)</option>
                        <option value="profit_high">Sort: Profit (High→Low)</option>
                        <option value="receipt_asc">Sort: Receipt # (Asc)</option>
                    </select>

                    {/* Dense View Toggle (Guarantees Page Fit) */}
                    <button
                        onClick={() => setIsAutoFit(!isAutoFit)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                            isAutoFit
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                        title="Toggle dense datagrid layout to fit all columns on screen"
                    >
                        <span>⛶</span> {isAutoFit ? 'Dense Fit' : 'Standard'}
                    </button>
                </div>

                {/* Date Presets & Range Row */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 text-xs font-bold text-gray-700">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-gray-500 text-[11px]">Date Range:</span>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => {
                                setDateFrom(e.target.value);
                                setPreset('today');
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
                                setPreset('today');
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
                                Clear Dates
                            </button>
                        )}
                    </div>

                    {/* Presets */}
                    <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-gray-500 text-[11px]">Presets:</span>
                        {[
                            { id: 'today', label: 'Today' },
                            { id: 'yesterday', label: 'Yesterday' },
                            { id: 'week', label: '7 Days' },
                            { id: 'month', label: 'This Month' },
                            { id: 'quarter', label: '90 Days' },
                            { id: 'all', label: 'All Time' },
                        ].map((pr) => (
                            <button
                                key={pr.id}
                                onClick={() => applyDatePreset(pr.id as any)}
                                className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all ${
                                    preset === pr.id
                                        ? 'bg-emerald-600 text-white shadow-xs'
                                        : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                                }`}
                            >
                                {pr.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* =====================================================================
                MAIN SALES DATAGRID TABLE (FITS ANY SCREEN, NO OVERFLOW CLIPPING)
            ===================================================================== */}
            <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden w-full max-w-full">
                {/* Table Control Header */}
                <div className="px-4 py-3 bg-gray-50/90 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                        <span className="font-black text-gray-900 uppercase tracking-wide">
                            📋 Transactions Ledger ({filtered.length})
                        </span>
                        {selectedIds.size > 0 && (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 font-bold rounded-full text-[10px]">
                                {selectedIds.size} Selected
                            </span>
                        )}
                    </div>
                    <div className="text-gray-600 text-xs flex items-center gap-3">
                        <span>Revenue: <strong className="text-gray-900 font-mono">Ksh {kpis.totalRevenue.toLocaleString()}</strong></span>
                        <span>•</span>
                        <span>Est. Profit: <strong className="text-emerald-700 font-mono">Ksh {kpis.estProfit.toLocaleString()}</strong></span>
                        <span>•</span>
                        <span>Margin: <strong className="text-emerald-700">{kpis.profitMarginPct}%</strong></span>
                    </div>
                </div>

                <div className="overflow-x-auto w-full">
                    <table className={`w-full text-left border-collapse ${isAutoFit ? 'text-[11px]' : 'text-xs'}`}>
                        <thead>
                            <tr className="bg-gray-100/70 border-b border-gray-200 text-[10px] font-black uppercase text-gray-700 tracking-wider">
                                <th className="p-2.5 w-7 text-center">
                                    <input
                                        type="checkbox"
                                        checked={paginated.length > 0 && selectedIds.size === paginated.length}
                                        onChange={(e) => handleSelectAll(e.target.checked)}
                                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                    />
                                </th>
                                <th className="p-2.5 w-8 text-center">#</th>
                                <th className="p-2.5 whitespace-nowrap">Date / Time</th>
                                <th className="p-2.5 whitespace-nowrap">Receipt #</th>
                                <th className="p-2.5 whitespace-nowrap">Customer / Phone</th>
                                <th className="p-2.5 text-center whitespace-nowrap">Payment</th>
                                <th className="p-2.5 text-right whitespace-nowrap">Subtotal</th>
                                <th className="p-2.5 text-right whitespace-nowrap">Discount</th>
                                <th className="p-2.5 text-right whitespace-nowrap">Total Paid</th>
                                <th className="p-2.5 text-right whitespace-nowrap text-emerald-700">Est. Profit</th>
                                <th className="p-2.5 text-center whitespace-nowrap">M-Pesa Code</th>
                                <th className="p-2.5 text-center whitespace-nowrap">Cashier</th>
                                <th className="p-2.5 text-center whitespace-nowrap">Status</th>
                                <th className="p-2.5 text-center whitespace-nowrap w-24">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-gray-900 font-medium">
                            {paginated.length === 0 ? (
                                <tr>
                                    <td colSpan={14} className="p-12 text-center text-gray-500">
                                        <div className="text-4xl mb-2">📭</div>
                                        <p className="font-bold text-gray-800 text-sm">No sales records found</p>
                                        <p className="text-xs text-gray-400 mt-1">Try expanding the date range or clear search filters</p>
                                    </td>
                                </tr>
                            ) : (
                                paginated.map((s, idx) => {
                                    const isSelected = selectedIds.has(s.sale_id);
                                    const pb = getPaymentBadge(s.payment_method);
                                    const ep = Math.round((Number(s.total) || 0) * avgMarginRate);
                                    const isCompleted = (s.status || '').toLowerCase() === 'completed';

                                    return (
                                        <tr
                                            key={s.sale_id}
                                            className={`hover:bg-blue-50/40 transition-colors ${
                                                isSelected ? 'bg-emerald-50/60' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                                            }`}
                                        >
                                            {/* Checkbox */}
                                            <td className="p-2.5 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => handleSelectOne(s.sale_id)}
                                                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                                />
                                            </td>

                                            {/* Row # */}
                                            <td className="p-2.5 text-center text-gray-400 font-mono text-[10px]">
                                                {(currentPage - 1) * (pageSize === -1 ? 0 : pageSize) + idx + 1}
                                            </td>

                                            {/* Date / Time */}
                                            <td className="p-2.5 whitespace-nowrap">
                                                <p className="font-bold text-gray-900">{fmtDate(s.sale_datetime)}</p>
                                                <p className="text-[10px] text-gray-400 font-mono">{fmtTime(s.sale_datetime)}</p>
                                            </td>

                                            {/* Receipt # Clickable Dossier */}
                                            <td className="p-2.5 whitespace-nowrap">
                                                <button
                                                    onClick={() => {
                                                        setActiveSale(s);
                                                        setShowDossierModal(true);
                                                    }}
                                                    className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-900 font-mono font-bold rounded-md border border-blue-200 inline-flex items-center gap-1 transition-colors"
                                                    title="Click to view 360° Sale Dossier"
                                                >
                                                    {s.receipt_no}
                                                </button>
                                            </td>

                                            {/* Customer */}
                                            <td className="p-2.5 whitespace-nowrap">
                                                <p className="font-bold text-gray-900">{s.customer_name || 'Walk-in Patient'}</p>
                                                {s.customer_phone && (
                                                    <p className="text-[10px] text-gray-500 font-mono">{s.customer_phone}</p>
                                                )}
                                            </td>

                                            {/* Payment Badge */}
                                            <td className="p-2.5 text-center whitespace-nowrap">
                                                <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] border inline-flex items-center gap-1 ${pb.bg}`}>
                                                    <span>{pb.icon}</span> {pb.text}
                                                </span>
                                            </td>

                                            {/* Subtotal */}
                                            <td className="p-2.5 text-right font-mono text-gray-700 whitespace-nowrap">
                                                Ksh {(s.subtotal || 0).toLocaleString()}
                                            </td>

                                            {/* Discount */}
                                            <td className="p-2.5 text-right font-mono whitespace-nowrap">
                                                {s.discount > 0 ? (
                                                    <span className="text-red-600 font-bold">-Ksh {Number(s.discount).toLocaleString()}</span>
                                                ) : (
                                                    <span className="text-gray-300">—</span>
                                                )}
                                            </td>

                                            {/* Total Paid */}
                                            <td className="p-2.5 text-right font-mono font-black text-gray-900 whitespace-nowrap">
                                                Ksh {(s.total || 0).toLocaleString()}
                                            </td>

                                            {/* Est. Profit */}
                                            <td className="p-2.5 text-right font-mono font-black text-emerald-700 whitespace-nowrap">
                                                Ksh {ep.toLocaleString()}
                                            </td>

                                            {/* M-Pesa Code */}
                                            <td className="p-2.5 text-center whitespace-nowrap">
                                                {s.mpesa_receipt ? (
                                                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 font-mono font-bold rounded border border-emerald-200 text-[10px]">
                                                        {s.mpesa_receipt}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-300">—</span>
                                                )}
                                            </td>

                                            {/* Cashier */}
                                            <td className="p-2.5 text-center whitespace-nowrap">
                                                <span className="px-2 py-0.5 bg-gray-100 text-gray-800 font-bold rounded text-[10px]">
                                                    {s.cashier_name || 'Staff'}
                                                </span>
                                            </td>

                                            {/* Status */}
                                            <td className="p-2.5 text-center whitespace-nowrap">
                                                <span
                                                    className={`px-2 py-0.5 rounded-full font-bold text-[10px] border ${
                                                        isCompleted
                                                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                                            : 'bg-amber-100 text-amber-900 border-amber-300'
                                                    }`}
                                                >
                                                    {isCompleted ? 'Completed' : s.status || 'Pending'}
                                                </span>
                                            </td>

                                            {/* Actions */}
                                            <td className="p-2.5 text-center whitespace-nowrap">
                                                <div className="flex items-center justify-center gap-1">
                                                    {/* View 360° Dossier */}
                                                    <button
                                                        onClick={() => {
                                                            setActiveSale(s);
                                                            setShowDossierModal(true);
                                                        }}
                                                        className="p-1 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                                        title="View 360° Sale Dossier"
                                                    >
                                                        👁️
                                                    </button>
                                                    {/* Quick Print Receipt */}
                                                    <button
                                                        onClick={() => printSingleReceipt(s)}
                                                        className="p-1 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-colors"
                                                        title="Print Single POS Receipt"
                                                    >
                                                        🖨️
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>

                        {/* Grand Summary Totals Footer */}
                        {filtered.length > 0 && (
                            <tfoot>
                                <tr className="bg-gray-100/90 border-t-2 border-gray-300 font-black text-gray-900">
                                    <td colSpan={6} className="p-3 text-left">
                                        GRAND TOTALS ({filtered.length} TRANSACTIONS):
                                    </td>
                                    <td className="p-3 text-right font-mono">
                                        Ksh {kpis.totalSubtotal.toLocaleString()}
                                    </td>
                                    <td className="p-3 text-right font-mono text-red-600">
                                        -Ksh {kpis.totalDiscount.toLocaleString()}
                                    </td>
                                    <td className="p-3 text-right font-mono font-black text-blue-900">
                                        Ksh {kpis.totalRevenue.toLocaleString()}
                                    </td>
                                    <td className="p-3 text-right font-mono font-black text-emerald-700">
                                        Ksh {kpis.estProfit.toLocaleString()}
                                    </td>
                                    <td colSpan={4} className="p-3 text-xs text-gray-500 font-normal">
                                        Avg: Ksh {kpis.avgOrder.toLocaleString()} / sale • Margin: {kpis.profitMarginPct}%
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>

                {/* =====================================================================
                    SUPER PAGINATION STEPPER (LIKE PURCHASES MASTER REGISTER)
                ===================================================================== */}
                <div className="p-3.5 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-700 font-semibold">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span>
                            Showing <strong className="text-gray-900">{filtered.length === 0 ? 0 : (currentPage - 1) * (pageSize === -1 ? filtered.length : pageSize) + 1}</strong> to{' '}
                            <strong className="text-gray-900">{pageSize === -1 ? filtered.length : Math.min(currentPage * pageSize, filtered.length)}</strong> of{' '}
                            <strong className="text-gray-900">{filtered.length}</strong> sales
                        </span>
                        <span>•</span>
                        <select
                            value={pageSize}
                            onChange={(e) => {
                                setPageSize(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="px-2 py-1 bg-white border border-gray-300 rounded-lg font-bold text-gray-900 text-xs outline-none focus:border-emerald-600"
                        >
                            <option value={15}>15 per page</option>
                            <option value={25}>25 per page</option>
                            <option value={50}>50 per page</option>
                            <option value={100}>100 per page</option>
                            <option value={200}>200 per page</option>
                            <option value={-1}>Show All</option>
                        </select>
                    </div>

                    {pageSize !== -1 && totalPages > 1 && (
                        <div className="flex items-center gap-1 flex-wrap">
                            <button
                                onClick={() => setCurrentPage(1)}
                                disabled={currentPage === 1}
                                className="px-2.5 py-1 bg-white border border-gray-300 rounded-lg font-bold text-gray-800 disabled:opacity-40 hover:bg-gray-100 text-xs"
                                title="First Page"
                            >
                                « First
                            </button>
                            <button
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-2.5 py-1 bg-white border border-gray-300 rounded-lg font-bold text-gray-800 disabled:opacity-40 hover:bg-gray-100 text-xs"
                                title="Previous Page"
                            >
                                ‹ Prev
                            </button>

                            {getPageNumbers().map((p, pIdx) =>
                                p === '...' ? (
                                    <span key={`dots-${pIdx}`} className="px-1 text-gray-400">
                                        ...
                                    </span>
                                ) : (
                                    <button
                                        key={`page-${p}`}
                                        onClick={() => setCurrentPage(Number(p))}
                                        className={`w-7 h-7 rounded-lg font-bold text-xs transition-colors ${
                                            currentPage === p
                                                ? 'bg-emerald-600 text-white shadow-xs'
                                                : 'bg-white border border-gray-300 text-gray-800 hover:bg-gray-100'
                                        }`}
                                    >
                                        {p}
                                    </button>
                                )
                            )}

                            <button
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-2.5 py-1 bg-white border border-gray-300 rounded-lg font-bold text-gray-800 disabled:opacity-40 hover:bg-gray-100 text-xs"
                                title="Next Page"
                            >
                                Next ›
                            </button>
                            <button
                                onClick={() => setCurrentPage(totalPages)}
                                disabled={currentPage === totalPages}
                                className="px-2.5 py-1 bg-white border border-gray-300 rounded-lg font-bold text-gray-800 disabled:opacity-40 hover:bg-gray-100 text-xs"
                                title="Last Page"
                            >
                                Last »
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <p className="text-center text-[10px] text-gray-400">
                * Estimated Gross Profit is computed at <strong>{Math.round(avgMarginRate * 100)}%</strong> average margin based on current product catalogue costs.
            </p>

            {/* =====================================================================
                MODAL: 360° SALE DOSSIER & COMPREHENSIVE SETTLEMENT AUDIT
            ===================================================================== */}
            {showDossierModal && activeSale && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4"
                    onClick={() => setShowDossierModal(false)}
                >
                    <div
                        className="bg-white rounded-3xl shadow-2xl border border-gray-200 w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="p-4 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-xl font-bold">
                                    🧾
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-base font-black tracking-tight">{activeSale.receipt_no}</h2>
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900">
                                            {activeSale.status || 'Completed'}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-gray-300">
                                        {fmtDate(activeSale.sale_datetime)} at {fmtTime(activeSale.sale_datetime)} • Outlet: {outletName}
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

                        {/* Modal Body */}
                        <div className="p-4 space-y-3.5 overflow-y-auto text-xs">
                            {/* Key Sale Info Grid */}
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { label: 'Customer', value: activeSale.customer_name || 'Walk-in Patient', icon: '👤' },
                                    { label: 'Cashier / Dispenser', value: activeSale.cashier_name || 'Staff', icon: '👨‍⚕️' },
                                    { label: 'Payment Method', value: activeSale.payment_method, icon: '💳' },
                                    { label: 'Sale Status', value: activeSale.status || 'Completed', icon: '📌' },
                                ].map((it, idx) => (
                                    <div key={idx} className="p-2.5 rounded-xl bg-gray-50 border border-gray-200">
                                        <p className="text-[10px] text-gray-500 uppercase font-bold">{it.icon} {it.label}</p>
                                        <p className="font-bold text-gray-900 mt-0.5">{it.value}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Customer Phone */}
                            {activeSale.customer_phone && (
                                <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] text-blue-700 font-bold uppercase">Customer Phone</p>
                                        <p className="font-mono font-bold text-blue-900 text-xs mt-0.5">{activeSale.customer_phone}</p>
                                    </div>
                                    <span className="text-xl">📞</span>
                                </div>
                            )}

                            {/* M-Pesa Code */}
                            {activeSale.mpesa_receipt && (
                                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] text-emerald-800 font-bold uppercase">M-Pesa Transaction Code</p>
                                        <p className="font-mono font-bold text-emerald-950 text-xs mt-0.5">{activeSale.mpesa_receipt}</p>
                                    </div>
                                    <span className="text-xl">📱</span>
                                </div>
                            )}

                            {/* Notes */}
                            {activeSale.notes && (
                                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                                    <p className="text-[10px] text-amber-800 font-bold uppercase">Prescription / Notes</p>
                                    <p className="text-amber-950 mt-0.5">{activeSale.notes}</p>
                                </div>
                            )}

                            {/* Financial Breakdown */}
                            <div className="border-t border-gray-200 pt-3 space-y-1.5">
                                <div className="flex justify-between text-gray-600">
                                    <span>Subtotal</span>
                                    <span className="font-mono font-bold">Ksh {(activeSale.subtotal || 0).toLocaleString()}</span>
                                </div>
                                {activeSale.discount > 0 && (
                                    <div className="flex justify-between text-red-600">
                                        <span>Discount Allowance</span>
                                        <span className="font-mono font-bold">-Ksh {activeSale.discount.toLocaleString()}</span>
                                    </div>
                                )}
                                {activeSale.tax > 0 && (
                                    <div className="flex justify-between text-gray-600">
                                        <span>Tax / VAT</span>
                                        <span className="font-mono font-bold">Ksh {activeSale.tax.toLocaleString()}</span>
                                    </div>
                                )}
                                <div className="flex justify-between pt-2 border-t border-gray-200 text-sm font-black text-gray-900">
                                    <span>Total Paid</span>
                                    <span className="font-mono text-blue-900">Ksh {(activeSale.total || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between p-2.5 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200">
                                    <span className="font-bold text-emerald-900">Est. Gross Profit ({Math.round(avgMarginRate * 100)}%)</span>
                                    <span className="font-mono font-black text-emerald-950">
                                        Ksh {Math.round((activeSale.total || 0) * avgMarginRate).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer Actions */}
                        <div className="p-3 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-2">
                            <button
                                onClick={() => printSingleReceipt(activeSale)}
                                className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl font-bold shadow-xs flex items-center gap-1.5 text-xs"
                            >
                                <span>🖨️</span> Print Receipt
                            </button>
                            <button
                                onClick={() => setShowDossierModal(false)}
                                className="px-3.5 py-1.5 bg-white border border-gray-300 hover:bg-gray-100 rounded-xl font-bold text-gray-700 text-xs"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
