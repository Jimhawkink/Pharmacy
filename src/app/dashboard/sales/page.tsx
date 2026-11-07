'use client';

// =====================================================================
// Alpha Pharmacy - Super Ultra Massive Sales & Analytics Engine v4.0
// Live Realtime Database Sync, Visual Chart.js Analytics, Sales Trends,
// Fast-Moving Drug Velocity, M-Pesa & Insurance Split Ledgers,
// Super World-Class Styled Excel (.xls), Executive PDF & Thermal Receipts
// =====================================================================

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import { useCompanyName } from '@/context/SettingsContext';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

export interface Sale {
    sale_id: number;
    receipt_no: string;
    sale_datetime: string;
    customer_name?: string;
    customer_phone?: string;
    cashier_name?: string;
    subtotal: number;
    discount: number;
    tax?: number;
    total: number;
    payment_method: string;
    amount_paid?: number;
    change_amount?: number;
    mpesa_receipt?: string;
    checkout_request_id?: string;
    status: string;
    outlet_id?: number;
    notes?: string;
    split_cash?: number;
    split_mpesa?: number;
    split_insurance?: number;
    split_insurance_name?: string;
    insurance_ref?: string;
    split_airtel?: number;
    created_at?: string;
}

export interface SaleItem {
    item_id: number;
    sale_id: number;
    product_id: number;
    product_name: string;
    batch_id?: number;
    batch_number?: string;
    expiry_date?: string;
    quantity: number;
    unit_price: number;
    discount?: number;
    total?: number;
    purchase_price?: number;
    notes?: string;
    selling_unit?: string;
}

export interface DrugAnalytics {
    name: string;
    qty: number;
    revenue: number;
    cogs: number;
    profit: number;
    marginPct: number;
    transactions: number;
    velocityRank: 'Ultra High' | 'High' | 'Medium' | 'Low';
}

export interface CashierAnalytics {
    name: string;
    count: number;
    total: number;
    cash: number;
    mpesa: number;
    insurance: number;
    avgTicket: number;
}

export default function SalesPage() {
    const { activeOutlet } = useOutlet();
    const outletId = activeOutlet?.outlet_id || 1;
    const outletName = activeOutlet?.outlet_name || 'Alpha Pharmacy Main Store';
    const companyName = useCompanyName() || 'Alpha Pharmacy';

    // Core Data State
    const [sales, setSales] = useState<Sale[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterPayment, setFilterPayment] = useState('All');
    const [filterStatus, setFilterStatus] = useState('All');
    const [minAmount, setMinAmount] = useState<string>('');
    const [maxAmount, setMaxAmount] = useState<string>('');
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

    // Multi-horizon Date Presets
    type DatePreset = 'today' | 'yesterday' | 'week' | 'month' | 'last_month' | 'quarter' | 'all' | 'custom';
    const [datePreset, setDatePreset] = useState<DatePreset>('today');
    const [customStartDate, setCustomStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [customEndDate, setCustomEndDate] = useState(new Date().toISOString().split('T')[0]);

    // Active Super Tab
    const [activeTab, setActiveTab] = useState<
        'transactions' | 'charts' | 'trends' | 'fast_moving' | 'mpesa' | 'insurance' | 'cashier' | 'metrics'
    >('transactions');
    const [lastSyncTime, setLastSyncTime] = useState<string>('');

    // Expandable Rows & Line Items Cache
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
    const [saleItemsCache, setSaleItemsCache] = useState<Record<number, SaleItem[]>>({});
    const [loadingItems, setLoadingItems] = useState<Set<number>>(new Set());

    // Modals
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
    const [selectedSaleItems, setSelectedSaleItems] = useState<SaleItem[]>([]);

    // Date Range calculation
    const getDateRange = useCallback(() => {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        if (datePreset === 'all') {
            return { start: null, end: null };
        }
        if (datePreset === 'today') {
            return { start: `${todayStr}T00:00:00`, end: `${todayStr}T23:59:59` };
        }
        if (datePreset === 'yesterday') {
            const y = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const yStr = y.toISOString().split('T')[0];
            return { start: `${yStr}T00:00:00`, end: `${yStr}T23:59:59` };
        }
        if (datePreset === 'week') {
            const w = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return { start: `${w.toISOString().split('T')[0]}T00:00:00`, end: `${todayStr}T23:59:59` };
        }
        if (datePreset === 'month') {
            const m = new Date(now.getFullYear(), now.getMonth(), 1);
            return { start: `${m.toISOString().split('T')[0]}T00:00:00`, end: `${todayStr}T23:59:59` };
        }
        if (datePreset === 'last_month') {
            const lmStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lmEnd = new Date(now.getFullYear(), now.getMonth(), 0);
            return { start: `${lmStart.toISOString().split('T')[0]}T00:00:00`, end: `${lmEnd.toISOString().split('T')[0]}T23:59:59` };
        }
        if (datePreset === 'quarter') {
            const q = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            return { start: `${q.toISOString().split('T')[0]}T00:00:00`, end: `${todayStr}T23:59:59` };
        }
        return { start: `${customStartDate}T00:00:00`, end: `${customEndDate}T23:59:59` };
    }, [datePreset, customStartDate, customEndDate]);

    // Load sales from database
    const loadSales = useCallback(async () => {
        setLoading(true);
        try {
            const { start, end } = getDateRange();
            let query = supabase
                .from('pharmacy_sales')
                .select('*')
                .order('sale_datetime', { ascending: false });

            if (outletId) {
                query = query.eq('outlet_id', outletId);
            }

            if (start && end) {
                query = query.gte('sale_datetime', start).lte('sale_datetime', end);
            }

            const { data, error } = await query;
            if (error) throw error;

            const salesList: Sale[] = data || [];
            setSales(salesList);
            setLastSyncTime(new Date().toLocaleTimeString('en-KE'));

            // Pre-fetch items for top 150 sales for fast analytics & instant expand
            if (salesList.length > 0) {
                const saleIds = salesList.map((s) => s.sale_id).slice(0, 150);
                const { data: itemsData } = await supabase
                    .from('pharmacy_sales_items')
                    .select('*')
                    .in('sale_id', saleIds)
                    .order('item_id', { ascending: true });

                if (itemsData && itemsData.length > 0) {
                    const cache: Record<number, SaleItem[]> = {};
                    itemsData.forEach((it: SaleItem) => {
                        if (!cache[it.sale_id]) cache[it.sale_id] = [];
                        cache[it.sale_id].push(it);
                    });
                    setSaleItemsCache((prev) => ({ ...prev, ...cache }));
                }
            }
        } catch (err) {
            console.error('Error loading sales:', err);
            toast.error('Failed to load sales from database');
        } finally {
            setLoading(false);
        }
    }, [outletId, getDateRange]);

    // Realtime Supabase Channel
    useEffect(() => {
        loadSales();

        const channel = supabase
            .channel('pharmacy_sales_live_stream')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'pharmacy_sales' },
                () => {
                    loadSales();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [loadSales]);

    // Load single sale items (fallback)
    const loadSaleItems = async (saleId: number) => {
        if (saleItemsCache[saleId]) return saleItemsCache[saleId];
        setLoadingItems((prev) => new Set(prev).add(saleId));
        try {
            const { data } = await supabase
                .from('pharmacy_sales_items')
                .select('*')
                .eq('sale_id', saleId)
                .order('item_id');
            const items = data || [];
            setSaleItemsCache((prev) => ({ ...prev, [saleId]: items }));
            return items;
        } catch (err) {
            console.error('Error loading sale items:', err);
            return [];
        } finally {
            setLoadingItems((prev) => {
                const next = new Set(prev);
                next.delete(saleId);
                return next;
            });
        }
    };

    const toggleRow = async (saleId: number) => {
        const next = new Set(expandedRows);
        if (next.has(saleId)) {
            next.delete(saleId);
        } else {
            next.add(saleId);
            await loadSaleItems(saleId);
        }
        setExpandedRows(next);
    };

    const viewReceipt = async (sale: Sale) => {
        setSelectedSale(sale);
        const items = await loadSaleItems(sale.sale_id);
        setSelectedSaleItems(items);
        setShowReceiptModal(true);
    };

    // Filtered sales
    const filteredSales = useMemo(() => {
        return sales.filter((s) => {
            const query = searchQuery.trim().toLowerCase();
            const matchesSearch =
                !query ||
                (s.receipt_no || '').toLowerCase().includes(query) ||
                (s.customer_name || '').toLowerCase().includes(query) ||
                (s.customer_phone || '').includes(query) ||
                (s.cashier_name || '').toLowerCase().includes(query) ||
                (s.insurance_ref || '').toLowerCase().includes(query) ||
                (s.split_insurance_name || '').toLowerCase().includes(query) ||
                (s.mpesa_receipt || '').toLowerCase().includes(query);

            const pm = (s.payment_method || '').toUpperCase();
            let matchesPayment = true;
            if (filterPayment !== 'All') {
                const filter = filterPayment.toUpperCase();
                if (filter === 'CASH') matchesPayment = pm === 'CASH' || (Number(s.split_cash) || 0) > 0;
                else if (filter === 'MPESA') matchesPayment = pm.includes('MPESA') || pm.includes('M-PESA') || (Number(s.split_mpesa) || 0) > 0;
                else if (filter === 'INSURANCE') matchesPayment = pm.includes('INSURANCE') || (Number(s.split_insurance) || 0) > 0;
                else if (filter === 'SPLIT') matchesPayment = pm.includes('SPLIT') || ((Number(s.split_cash) || 0) > 0 && (Number(s.split_mpesa) || 0) > 0);
                else if (filter === 'CREDIT') matchesPayment = pm.includes('CREDIT') || s.status === 'Credit';
                else matchesPayment = pm === filter;
            }

            let matchesStatus = true;
            if (filterStatus !== 'All') {
                matchesStatus = (s.status || '').toLowerCase() === filterStatus.toLowerCase();
            }

            const totalVal = Number(s.total) || 0;
            let matchesMin = true;
            if (minAmount) matchesMin = totalVal >= Number(minAmount);

            let matchesMax = true;
            if (maxAmount) matchesMax = totalVal <= Number(maxAmount);

            return matchesSearch && matchesPayment && matchesStatus && matchesMin && matchesMax;
        });
    }, [sales, searchQuery, filterPayment, filterStatus, minAmount, maxAmount]);

    // Financial KPI Aggregations
    const financials = useMemo(() => {
        let revenue = 0;
        let totalCogs = 0;
        let cash = 0;
        let mpesa = 0;
        let insurance = 0;
        let discount = 0;
        let tax = 0;

        filteredSales.forEach((s) => {
            const tot = Number(s.total) || 0;
            revenue += tot;
            discount += Number(s.discount) || 0;
            tax += Number(s.tax) || 0;

            if (Number(s.split_cash) > 0 || Number(s.split_mpesa) > 0 || Number(s.split_insurance) > 0) {
                cash += Number(s.split_cash) || 0;
                mpesa += Number(s.split_mpesa) || 0;
                insurance += Number(s.split_insurance) || 0;
            } else {
                const pm = (s.payment_method || '').toUpperCase();
                if (pm === 'CASH') cash += tot;
                else if (pm.includes('MPESA') || pm.includes('M-PESA')) mpesa += tot;
                else if (pm.includes('INSURANCE')) insurance += tot;
                else cash += tot;
            }

            const items = saleItemsCache[s.sale_id] || [];
            items.forEach((it) => {
                const q = Number(it.quantity) || 0;
                const cost = Number(it.purchase_price) || 0;
                totalCogs += q * cost;
            });
        });

        const grossProfit = Math.max(0, revenue - totalCogs);
        const marginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
        const avgTicket = filteredSales.length > 0 ? Math.round(revenue / filteredSales.length) : 0;

        return {
            revenue,
            grossProfit,
            totalCogs,
            marginPct,
            cash,
            mpesa,
            insurance,
            discount,
            tax,
            avgTicket,
        };
    }, [filteredSales, saleItemsCache]);

    // Subsets
    const mpesaSales = useMemo(() => {
        return filteredSales.filter(
            (s) =>
                (s.payment_method || '').toUpperCase().includes('MPESA') ||
                (s.payment_method || '').toUpperCase().includes('M-PESA') ||
                Boolean(s.mpesa_receipt) ||
                (Number(s.split_mpesa) || 0) > 0
        );
    }, [filteredSales]);

    const insuranceSales = useMemo(() => {
        return filteredSales.filter(
            (s) =>
                (s.payment_method || '').toUpperCase().includes('INSURANCE') ||
                Boolean(s.split_insurance_name) ||
                Boolean(s.insurance_ref) ||
                (Number(s.split_insurance) || 0) > 0
        );
    }, [filteredSales]);

    // Fast-Moving Drug Analytics (Tab 4)
    const drugAnalytics = useMemo(() => {
        const stats: Record<string, DrugAnalytics> = {};
        filteredSales.forEach((s) => {
            const items = saleItemsCache[s.sale_id] || [];
            items.forEach((it) => {
                const key = it.product_name || `Drug #${it.product_id}`;
                const q = Number(it.quantity) || 0;
                const rev = Number(it.total) || (Number(it.unit_price || 0) * q);
                const cost = (Number(it.purchase_price) || 0) * q;
                const profit = rev - cost;

                if (!stats[key]) {
                    stats[key] = {
                        name: key,
                        qty: 0,
                        revenue: 0,
                        cogs: 0,
                        profit: 0,
                        marginPct: 0,
                        transactions: 0,
                        velocityRank: 'Medium',
                    };
                }
                stats[key].qty += q;
                stats[key].revenue += rev;
                stats[key].cogs += cost;
                stats[key].profit += profit;
                stats[key].transactions += 1;
            });
        });

        const list = Object.values(stats).map((d) => {
            const marginPct = d.revenue > 0 ? Math.round((d.profit / d.revenue) * 100) : 0;
            let velocityRank: 'Ultra High' | 'High' | 'Medium' | 'Low' = 'Medium';
            if (d.qty >= 50) velocityRank = 'Ultra High';
            else if (d.qty >= 20) velocityRank = 'High';
            else if (d.qty < 5) velocityRank = 'Low';

            return {
                ...d,
                marginPct,
                velocityRank,
            };
        });

        return list.sort((a, b) => b.qty - a.qty);
    }, [filteredSales, saleItemsCache]);

    // Cashier Analytics (Tab 7)
    const cashierAnalytics = useMemo(() => {
        const stats: Record<string, CashierAnalytics> = {};
        filteredSales.forEach((s) => {
            const name = s.cashier_name?.trim() || 'Counter Pharmacist';
            const tot = Number(s.total) || 0;
            if (!stats[name]) {
                stats[name] = { name, count: 0, total: 0, cash: 0, mpesa: 0, insurance: 0, avgTicket: 0 };
            }
            stats[name].count += 1;
            stats[name].total += tot;

            const pm = (s.payment_method || '').toUpperCase();
            if (pm === 'CASH') stats[name].cash += tot;
            else if (pm.includes('MPESA') || pm.includes('M-PESA')) stats[name].mpesa += tot;
            else if (pm.includes('INSURANCE')) stats[name].insurance += tot;
        });

        return Object.values(stats)
            .map((c) => ({
                ...c,
                avgTicket: c.count > 0 ? Math.round(c.total / c.count) : 0,
            }))
            .sort((a, b) => b.total - a.total);
    }, [filteredSales]);

    // Hourly Distribution for Sales Trends (Tab 3 & Charts)
    const hourlyData = useMemo(() => {
        const hours = Array.from({ length: 24 }, (_, i) => ({
            hour: `${String(i).padStart(2, '0')}:00`,
            revenue: 0,
            count: 0,
        }));

        filteredSales.forEach((s) => {
            if (!s.sale_datetime) return;
            const h = new Date(s.sale_datetime).getHours();
            if (hours[h]) {
                hours[h].revenue += Number(s.total) || 0;
                hours[h].count += 1;
            }
        });

        return hours.filter((_, i) => i >= 6 && i <= 22); // Focus on operating pharmacy hours 6 AM to 10 PM
    }, [filteredSales]);

    // Daily Trend Data for Charts (Tab 2)
    const dailyTrendData = useMemo(() => {
        const dayMap: Record<string, { label: string; revenue: number; count: number }> = {};
        filteredSales.forEach((s) => {
            if (!s.sale_datetime) return;
            const dStr = s.sale_datetime.split('T')[0];
            if (!dayMap[dStr]) {
                const dateObj = new Date(s.sale_datetime);
                dayMap[dStr] = {
                    label: dateObj.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' }),
                    revenue: 0,
                    count: 0,
                };
            }
            dayMap[dStr].revenue += Number(s.total) || 0;
            dayMap[dStr].count += 1;
        });

        return Object.keys(dayMap)
            .sort()
            .map((k) => dayMap[k]);
    }, [filteredSales]);

    // Chart.js Configuration Objects
    const revenueLineChartData = useMemo(() => {
        return {
            labels: dailyTrendData.length > 0 ? dailyTrendData.map((d) => d.label) : ['Today'],
            datasets: [
                {
                    label: 'Gross Revenue (KES)',
                    data: dailyTrendData.length > 0 ? dailyTrendData.map((d) => d.revenue) : [financials.revenue],
                    borderColor: '#059669',
                    backgroundColor: 'rgba(16, 185, 129, 0.12)',
                    fill: true,
                    tension: 0.35,
                    borderWidth: 2.5,
                    pointBackgroundColor: '#047857',
                    pointRadius: 4,
                },
            ],
        };
    }, [dailyTrendData, financials.revenue]);

    const paymentDoughnutData = useMemo(() => {
        return {
            labels: ['Cash', 'M-Pesa', 'Insurance', 'Other / Credit'],
            datasets: [
                {
                    data: [financials.cash, financials.mpesa, financials.insurance, Math.max(0, financials.revenue - financials.cash - financials.mpesa - financials.insurance)],
                    backgroundColor: ['#F59E0B', '#10B981', '#8B5CF6', '#64748B'],
                    borderWidth: 2,
                    borderColor: '#FFFFFF',
                },
            ],
        };
    }, [financials]);

    const topDrugsBarChartData = useMemo(() => {
        const top10 = drugAnalytics.slice(0, 8);
        return {
            labels: top10.map((d) => (d.name.length > 18 ? d.name.slice(0, 18) + '...' : d.name)),
            datasets: [
                {
                    label: 'Units Dispensed',
                    data: top10.map((d) => d.qty),
                    backgroundColor: '#14B8A6',
                    borderRadius: 8,
                },
            ],
        };
    }, [drugAnalytics]);

    const hourlyBarChartData = useMemo(() => {
        return {
            labels: hourlyData.map((h) => h.hour),
            datasets: [
                {
                    label: 'Hourly Sales (KES)',
                    data: hourlyData.map((h) => h.revenue),
                    backgroundColor: 'rgba(5, 150, 105, 0.75)',
                    hoverBackgroundColor: '#047857',
                    borderRadius: 6,
                },
            ],
        };
    }, [hourlyData]);

    // =====================================================================
    // SUPER WORLD-CLASS STYLED EXCEL EXPORT (.xls)
    // =====================================================================
    const exportToSuperExcel = () => {
        if (filteredSales.length === 0) {
            toast.error('No sales records to export');
            return;
        }

        const now = new Date();
        const exportDateStr = now.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });

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
   <Font ss:FontName="Calibri" ss:Size="16" ss:Bold="1" ss:Color="#047857"/>
  </Style>
  <Style ss:ID="Subtitle">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#64748B"/>
  </Style>
  <Style ss:ID="KpiHeader">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="9" ss:Bold="1" ss:Color="#475569"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="KpiGreen">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="12" ss:Bold="1" ss:Color="#047857"/>
   <Interior ss:Color="#ECFDF5" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="#,##0"/>
  </Style>
  <Style ss:ID="KpiBlue">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="12" ss:Bold="1" ss:Color="#1D4ED8"/>
   <Interior ss:Color="#EFF6FF" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="#,##0"/>
  </Style>
  <Style ss:ID="ColHeader">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#047857" ss:Pattern="Solid"/>
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
 <Worksheet ss:Name="Sales Transactions">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="40"/>
   <Column ss:Width="110"/>
   <Column ss:Width="130"/>
   <Column ss:Width="130"/>
   <Column ss:Width="90"/>
   <Column ss:Width="100"/>
   <Column ss:Width="90"/>
   <Column ss:Width="100"/>
   <Column ss:Width="80"/>
   <Column ss:Width="80"/>
   <Column ss:Width="100"/>
   <Column ss:Width="80"/>
   <Column ss:Width="80"/>
   <Column ss:Width="80"/>
   <Column ss:Width="100"/>

   <Row ss:Height="26">
    <Cell ss:MergeAcross="14" ss:StyleID="Title"><Data ss:Type="String">${companyName} — Detailed Sales &amp; Revenue Ledger</Data></Cell>
   </Row>
   <Row ss:Height="16">
    <Cell ss:MergeAcross="14" ss:StyleID="Subtitle"><Data ss:Type="String">Outlet: ${outletName} | Exported: ${exportDateStr} | Horizon: ${datePreset.toUpperCase()}</Data></Cell>
   </Row>
   <Row ss:Height="10"/>

   <!-- KPI Block -->
   <Row ss:Height="18">
    <Cell ss:MergeAcross="2" ss:StyleID="KpiHeader"><Data ss:Type="String">TOTAL REVENUE (KES)</Data></Cell>
    <Cell ss:MergeAcross="2" ss:StyleID="KpiHeader"><Data ss:Type="String">EST. GROSS PROFIT</Data></Cell>
    <Cell ss:MergeAcross="2" ss:StyleID="KpiHeader"><Data ss:Type="String">M-PESA VOLUME</Data></Cell>
    <Cell ss:MergeAcross="2" ss:StyleID="KpiHeader"><Data ss:Type="String">CASH REGISTER</Data></Cell>
    <Cell ss:MergeAcross="2" ss:StyleID="KpiHeader"><Data ss:Type="String">INSURANCE CLAIMS</Data></Cell>
   </Row>
   <Row ss:Height="24">
    <Cell ss:MergeAcross="2" ss:StyleID="KpiGreen"><Data ss:Type="Number">${financials.revenue}</Data></Cell>
    <Cell ss:MergeAcross="2" ss:StyleID="KpiGreen"><Data ss:Type="Number">${financials.grossProfit}</Data></Cell>
    <Cell ss:MergeAcross="2" ss:StyleID="KpiBlue"><Data ss:Type="Number">${financials.mpesa}</Data></Cell>
    <Cell ss:MergeAcross="2" ss:StyleID="KpiBlue"><Data ss:Type="Number">${financials.cash}</Data></Cell>
    <Cell ss:MergeAcross="2" ss:StyleID="KpiBlue"><Data ss:Type="Number">${financials.insurance}</Data></Cell>
   </Row>
   <Row ss:Height="12"/>

   <!-- Column Headers -->
   <Row ss:Height="24">
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">#</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Receipt No</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Date &amp; Time</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Customer Name</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Phone</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Cashier</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Payment Method</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">M-Pesa Code</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Subtotal</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Discount</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Total Amount</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Split Cash</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Split M-Pesa</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Split Ins.</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Status</Data></Cell>
   </Row>

   <!-- Sales Rows -->
   ${filteredSales.map((s, idx) => {
       const rowStyle = idx % 2 === 0 ? 'RowEven' : 'RowOdd';
       return `<Row ss:Height="20">
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="Number">${idx + 1}</Data></Cell>
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="String">${s.receipt_no}</Data></Cell>
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="String">${new Date(s.sale_datetime).toLocaleString('en-KE')}</Data></Cell>
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="String">${(s.customer_name || 'Walk-in').replace(/&/g, '&amp;')}</Data></Cell>
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="String">${s.customer_phone || '—'}</Data></Cell>
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="String">${(s.cashier_name || 'Counter').replace(/&/g, '&amp;')}</Data></Cell>
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="String">${s.payment_method || 'Cash'}</Data></Cell>
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="String">${s.mpesa_receipt || '—'}</Data></Cell>
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="Number">${Number(s.subtotal || s.total || 0)}</Data></Cell>
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="Number">${Number(s.discount || 0)}</Data></Cell>
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="Number">${Number(s.total || 0)}</Data></Cell>
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="Number">${Number(s.split_cash || 0)}</Data></Cell>
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="Number">${Number(s.split_mpesa || 0)}</Data></Cell>
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="Number">${Number(s.split_insurance || 0)}</Data></Cell>
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="String">${s.status || 'Completed'}</Data></Cell>
   </Row>`;
   }).join('\n')}

   <!-- Grand Total Row -->
   <Row ss:Height="24">
    <Cell ss:MergeAcross="7" ss:StyleID="GrandTotal"><Data ss:Type="String">TOTALS (${filteredSales.length} TRANSACTIONS):</Data></Cell>
    <Cell ss:StyleID="GrandTotal"><Data ss:Type="Number">${filteredSales.reduce((sum, s) => sum + Number(s.subtotal || s.total || 0), 0)}</Data></Cell>
    <Cell ss:StyleID="GrandTotal"><Data ss:Type="Number">${financials.discount}</Data></Cell>
    <Cell ss:StyleID="GrandTotal"><Data ss:Type="Number">${financials.revenue}</Data></Cell>
    <Cell ss:StyleID="GrandTotal"><Data ss:Type="Number">${financials.cash}</Data></Cell>
    <Cell ss:StyleID="GrandTotal"><Data ss:Type="Number">${financials.mpesa}</Data></Cell>
    <Cell ss:StyleID="GrandTotal"><Data ss:Type="Number">${financials.insurance}</Data></Cell>
    <Cell ss:StyleID="GrandTotal"><Data ss:Type="String">—</Data></Cell>
   </Row>
  </Table>
 </Worksheet>
</Workbook>`;

        const blob = new Blob([xmlString], { type: 'application/vnd.ms-excel;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AlphaPharmacy_Sales_${datePreset}_${now.toISOString().split('T')[0]}_SuperExcel.xls`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`Exported ${filteredSales.length} records to Super World-Class Excel!`);
    };

    // =====================================================================
    // SUPER WORLD-CLASS PDF / AUDIT REPORT GENERATOR
    // =====================================================================
    const generatePdfReport = () => {
        if (filteredSales.length === 0) {
            toast.error('No sales data to generate PDF');
            return;
        }

        const now = new Date();
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            toast.error('Please allow popups to open the PDF report');
            return;
        }

        const reportHtml = `<!DOCTYPE html>
<html>
<head>
    <title>Executive Sales Audit Report — ${companyName}</title>
    <style>
        @page { size: A4 landscape; margin: 10mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 0; font-size: 10px; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2.5px solid #047857; padding-bottom: 10px; margin-bottom: 12px; }
        .logo-box { font-size: 18px; font-weight: 900; color: #047857; }
        .meta { text-align: right; font-size: 9px; color: #64748b; }
        .kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 12px; }
        .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; text-align: center; }
        .kpi-label { font-size: 8px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 2px; }
        .kpi-value { font-size: 13px; font-weight: 900; color: #0f172a; }
        table { width: 100%; border-collapse: collapse; font-size: 9px; }
        th { background: #047857; color: white; padding: 5px 6px; text-align: left; font-weight: 700; }
        td { padding: 4px 6px; border-bottom: 1px solid #e2e8f0; }
        tr:nth-child(even) { background-color: #f8fafc; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .font-mono { font-family: monospace; }
        .total-row { background: #f1f5f9; font-weight: 900; border-top: 2px solid #cbd5e1; }
        .badge { padding: 1.5px 5px; border-radius: 4px; font-weight: 700; font-size: 8px; }
        .badge-green { background: #d1fae5; color: #065f46; }
        .badge-blue { background: #dbeafe; color: #1e40af; }
        .badge-purple { background: #f3e8ff; color: #6b21a8; }
        .sign-box { margin-top: 18px; display: flex; justify-content: space-between; }
        .sign-line { width: 180px; border-top: 1px dashed #94a3b8; text-align: center; padding-top: 4px; font-size: 8px; color: #64748b; }
        .footer { margin-top: 16px; display: flex; justify-content: space-between; font-size: 8px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 6px; }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <div class="logo-box">🏥 ${companyName}</div>
            <div style="font-size: 11px; color: #334155; font-weight: 700;">Executive Pharmaceutical Sales &amp; Revenue Audit</div>
            <div style="font-size: 9px; color: #64748b;">Outlet: ${outletName}</div>
        </div>
        <div class="meta">
            <div><strong>Generated:</strong> ${now.toLocaleDateString('en-KE')} ${now.toLocaleTimeString('en-KE')}</div>
            <div><strong>Filter Period:</strong> ${datePreset.toUpperCase()}</div>
            <div><strong>Records:</strong> ${filteredSales.length} Transactions</div>
        </div>
    </div>

    <div class="kpi-grid">
        <div class="kpi-card">
            <div class="kpi-label">Gross Revenue</div>
            <div class="kpi-value" style="color: #047857;">KES ${financials.revenue.toLocaleString()}</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">Gross Margin</div>
            <div class="kpi-value" style="color: #0d9488;">KES ${financials.grossProfit.toLocaleString()} (${financials.marginPct.toFixed(1)}%)</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">M-Pesa Collections</div>
            <div class="kpi-value" style="color: #059669;">KES ${financials.mpesa.toLocaleString()}</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">Cash Collected</div>
            <div class="kpi-value" style="color: #d97706;">KES ${financials.cash.toLocaleString()}</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">Insurance Claims</div>
            <div class="kpi-value" style="color: #7c3aed;">KES ${financials.insurance.toLocaleString()}</div>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th style="width: 25px;">#</th>
                <th>Receipt #</th>
                <th>Date / Time</th>
                <th>Patient / Customer</th>
                <th>Payment</th>
                <th>M-Pesa Code</th>
                <th>Cashier</th>
                <th class="text-right">Subtotal</th>
                <th class="text-right">Discount</th>
                <th class="text-right">Total (KES)</th>
                <th class="text-center">Status</th>
            </tr>
        </thead>
        <tbody>
            ${filteredSales.map((s, i) => `
                <tr>
                    <td>${i + 1}</td>
                    <td class="font-mono"><strong>${s.receipt_no}</strong></td>
                    <td>${new Date(s.sale_datetime).toLocaleDateString('en-KE')} ${new Date(s.sale_datetime).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>${s.customer_name || 'Walk-in'}</td>
                    <td><span class="badge ${s.payment_method === 'CASH' ? 'badge-blue' : s.payment_method.includes('MPESA') ? 'badge-green' : 'badge-purple'}">${s.payment_method}</span></td>
                    <td class="font-mono">${s.mpesa_receipt || '—'}</td>
                    <td>${s.cashier_name || 'Counter'}</td>
                    <td class="text-right">${Number(s.subtotal || s.total || 0).toLocaleString()}</td>
                    <td class="text-right">${Number(s.discount || 0) > 0 ? `-${Number(s.discount).toLocaleString()}` : '—'}</td>
                    <td class="text-right" style="font-weight: 700;">${Number(s.total || 0).toLocaleString()}</td>
                    <td class="text-center">${s.status}</td>
                </tr>
            `).join('')}
            <tr class="total-row">
                <td colspan="7" class="text-right">GRAND AUDIT TOTALS:</td>
                <td class="text-right">${filteredSales.reduce((a, b) => a + Number(b.subtotal || b.total || 0), 0).toLocaleString()}</td>
                <td class="text-right">${financials.discount.toLocaleString()}</td>
                <td class="text-right" style="font-size: 10px; color: #047857;">KES ${financials.revenue.toLocaleString()}</td>
                <td class="text-center">✓</td>
            </tr>
        </tbody>
    </table>

    <div class="sign-box">
        <div class="sign-line">Pharmacist In-Charge Signature</div>
        <div class="sign-line">Finance &amp; Audit Officer</div>
        <div class="sign-line">Managing Director Stamp</div>
    </div>

    <div class="footer">
        <div>Alpha Pharmacy POS — Professional Health System Audit Report</div>
        <div>Page 1 of 1</div>
    </div>

    <script>
        window.onload = function() {
            window.print();
        };
    </script>
</body>
</html>`;

        printWindow.document.write(reportHtml);
        printWindow.document.close();
    };

    const formatTime = (datetime: string) => {
        if (!datetime) return '';
        const date = new Date(datetime);
        return date.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (datetime: string) => {
        if (!datetime) return '';
        const date = new Date(datetime);
        return date.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const paymentBadge = (method: string) => {
        const m = (method || '').toUpperCase();
        if (m === 'CASH') return 'bg-amber-100 text-amber-800 border border-amber-200';
        if (m.includes('MPESA') || m.includes('M-PESA')) return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
        if (m.includes('INSURANCE')) return 'bg-purple-100 text-purple-800 border border-purple-200';
        if (m.includes('SPLIT')) return 'bg-sky-100 text-sky-800 border border-sky-200';
        if (m.includes('CREDIT')) return 'bg-rose-100 text-rose-800 border border-rose-200';
        return 'bg-gray-100 text-gray-800 border border-gray-200';
    };

    return (
        <div className="space-y-4 max-w-full">
            {/* Header with Live Sync Status & Super Export Buttons */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white rounded-3xl p-5 border border-gray-200/80 shadow-xs">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center text-2xl font-bold shadow-md flex-shrink-0">
                        💰
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">
                                Sales &amp; Revenue Command Engine
                            </h1>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                LIVE DB REALTIME
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 font-medium mt-0.5">
                            Realtime POS sales, gross margins, drug velocity, M-Pesa ledger &amp; insurance audits
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={loadSales}
                        disabled={loading}
                        className="px-3.5 py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 active:scale-95 disabled:opacity-60"
                        title="Sync live records from database"
                    >
                        <span className={loading ? 'animate-spin' : ''}>🔄</span>
                        {loading ? 'Syncing...' : 'Sync Live'}
                    </button>

                    <button
                        onClick={exportToSuperExcel}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm hover:shadow active:scale-95"
                        title="Download styled Excel spreadsheet"
                    >
                        <span>📊</span>
                        Super Excel (.xls)
                    </button>

                    <button
                        onClick={generatePdfReport}
                        className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm hover:shadow active:scale-95"
                        title="Print / Save Executive PDF report"
                    >
                        <span>📑</span>
                        PDF Audit
                    </button>
                </div>
            </div>

            {/* Financial KPI Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-4 text-white shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between opacity-90 mb-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Gross Sales</span>
                        <span className="text-lg">💵</span>
                    </div>
                    <div>
                        <div className="text-xl md:text-2xl font-black">
                            KES {financials.revenue.toLocaleString()}
                        </div>
                        <div className="text-[10px] opacity-80 mt-1 font-medium">
                            {filteredSales.length} receipts (avg KES {financials.avgTicket})
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-teal-600 to-cyan-700 rounded-2xl p-4 text-white shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between opacity-90 mb-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Gross Margin</span>
                        <span className="text-lg">📈</span>
                    </div>
                    <div>
                        <div className="text-xl md:text-2xl font-black">
                            KES {financials.grossProfit.toLocaleString()}
                        </div>
                        <div className="text-[10px] opacity-80 mt-1 font-medium">
                            {financials.marginPct.toFixed(1)}% gross profit margin
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-emerald-700 to-green-800 rounded-2xl p-4 text-white shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between opacity-90 mb-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider">M-Pesa Volume</span>
                        <span className="text-lg">📱</span>
                    </div>
                    <div>
                        <div className="text-xl md:text-2xl font-black">
                            KES {financials.mpesa.toLocaleString()}
                        </div>
                        <div className="text-[10px] opacity-80 mt-1 font-medium">
                            {mpesaSales.length} mobile money payments
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-amber-600 to-orange-700 rounded-2xl p-4 text-white shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between opacity-90 mb-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Cash Register</span>
                        <span className="text-lg">🪙</span>
                    </div>
                    <div>
                        <div className="text-xl md:text-2xl font-black">
                            KES {financials.cash.toLocaleString()}
                        </div>
                        <div className="text-[10px] opacity-80 mt-1 font-medium">
                            Physical cash collected
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl p-4 text-white shadow-sm flex flex-col justify-between col-span-2 md:col-span-1">
                    <div className="flex items-center justify-between opacity-90 mb-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Insurance &amp; Split</span>
                        <span className="text-lg">🏥</span>
                    </div>
                    <div>
                        <div className="text-xl md:text-2xl font-black">
                            KES {financials.insurance.toLocaleString()}
                        </div>
                        <div className="text-[10px] opacity-80 mt-1 font-medium">
                            {insuranceSales.length} claims &amp; copays
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Super Tabs Bar */}
            <div className="bg-white rounded-2xl border border-gray-200/80 p-2 shadow-xs flex items-center justify-between gap-2 overflow-x-auto">
                <div className="flex items-center gap-1.5 min-w-max">
                    <button
                        onClick={() => setActiveTab('transactions')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                            activeTab === 'transactions'
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                    >
                        <span>🧾</span> Transactions ({filteredSales.length})
                    </button>

                    <button
                        onClick={() => setActiveTab('charts')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                            activeTab === 'charts'
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                    >
                        <span>📊</span> Graphical Analytics
                    </button>

                    <button
                        onClick={() => setActiveTab('trends')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                            activeTab === 'trends'
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                    >
                        <span>📈</span> Sales Trends
                    </button>

                    <button
                        onClick={() => setActiveTab('fast_moving')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                            activeTab === 'fast_moving'
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                    >
                        <span>⚡</span> Fast-Moving Drugs ({drugAnalytics.length})
                    </button>

                    <button
                        onClick={() => setActiveTab('mpesa')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                            activeTab === 'mpesa'
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                    >
                        <span>📱</span> M-Pesa Ledger ({mpesaSales.length})
                    </button>

                    <button
                        onClick={() => setActiveTab('insurance')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                            activeTab === 'insurance'
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                    >
                        <span>🏥</span> Insurance ({insuranceSales.length})
                    </button>

                    <button
                        onClick={() => setActiveTab('cashier')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                            activeTab === 'cashier'
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                    >
                        <span>👤</span> Cashiers ({cashierAnalytics.length})
                    </button>

                    <button
                        onClick={() => setActiveTab('metrics')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                            activeTab === 'metrics'
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                    >
                        <span>💎</span> Deep Metrics
                    </button>
                </div>

                {lastSyncTime && (
                    <span className="text-[11px] font-bold text-gray-400 hidden xl:inline-block pr-2">
                        Synced: {lastSyncTime}
                    </span>
                )}
            </div>

            {/* Filter & Deep Search Bar */}
            <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-xs space-y-3">
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                    {/* Deep Search */}
                    <div className="relative flex-1">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search receipt #, patient name, phone, cashier, M-Pesa code or insurance ref..."
                            className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:border-emerald-500 focus:bg-white"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Quick Filters Group */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <select
                            value={filterPayment}
                            onChange={(e) => setFilterPayment(e.target.value)}
                            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:outline-none focus:border-emerald-500 cursor-pointer"
                        >
                            <option value="All">All Payment Methods</option>
                            <option value="Cash">Cash Only</option>
                            <option value="MPESA">M-Pesa Only</option>
                            <option value="Insurance">Insurance Only</option>
                            <option value="Split">Split Payments</option>
                            <option value="Credit">Credit / Accounts</option>
                        </select>

                        <button
                            type="button"
                            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                            className={`px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                                showAdvancedFilters
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                            }`}
                        >
                            <span>⚙️</span> Ultra Filters
                        </button>
                    </div>
                </div>

                {/* Advanced Filters Expandable Area */}
                {showAdvancedFilters && (
                    <div className="p-3 bg-gray-50/80 rounded-xl border border-gray-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                            <label className="block text-[11px] font-bold text-gray-600 mb-1">Status Filter</label>
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-800"
                            >
                                <option value="All">All Statuses</option>
                                <option value="Completed">Completed Only</option>
                                <option value="Credit">Credit Only</option>
                                <option value="Pending">Pending Only</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-gray-600 mb-1">Min Ticket Amount (KES)</label>
                            <input
                                type="number"
                                placeholder="0"
                                value={minAmount}
                                onChange={(e) => setMinAmount(e.target.value)}
                                className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-800"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-gray-600 mb-1">Max Ticket Amount (KES)</label>
                            <input
                                type="number"
                                placeholder="e.g. 50000"
                                value={maxAmount}
                                onChange={(e) => setMaxAmount(e.target.value)}
                                className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-800"
                            />
                        </div>
                    </div>
                )}

                {/* Date Horizon Selector */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-gray-500 mr-1">Time Horizon:</span>
                        {(['today', 'yesterday', 'week', 'month', 'last_month', 'quarter', 'all', 'custom'] as const).map((preset) => (
                            <button
                                key={preset}
                                type="button"
                                onClick={() => setDatePreset(preset)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition capitalize ${
                                    datePreset === preset
                                        ? 'bg-emerald-600 text-white shadow-xs'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                {preset === 'week' ? 'Last 7D' : preset === 'month' ? 'This Month' : preset === 'last_month' ? 'Last Month' : preset === 'quarter' ? 'Last 90D' : preset}
                            </button>
                        ))}
                    </div>

                    {datePreset === 'custom' && (
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={customStartDate}
                                onChange={(e) => setCustomStartDate(e.target.value)}
                                className="px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-700"
                            />
                            <span className="text-gray-400 font-bold">to</span>
                            <input
                                type="date"
                                value={customEndDate}
                                onChange={(e) => setCustomEndDate(e.target.value)}
                                className="px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-700"
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* TAB 1: ALL TRANSACTIONS LEDGER */}
            {activeTab === 'transactions' && (
                <div className="bg-white rounded-3xl border border-gray-200/80 shadow-xs overflow-hidden">
                    {loading ? (
                        <div className="p-12 text-center text-gray-500">
                            <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-3" />
                            <p className="text-xs font-bold text-gray-600">Streaming live sales from database...</p>
                        </div>
                    ) : filteredSales.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">
                            <div className="text-4xl mb-2">🧾</div>
                            <p className="text-sm font-bold text-gray-800">No sales transactions found</p>
                            <p className="text-xs text-gray-400 mt-1">
                                {datePreset === 'today'
                                    ? 'No sales recorded yet today. Switch horizon to "Last 7 Days" or "All Time" to view historical sales.'
                                    : 'No receipts match your search filter.'}
                            </p>
                            {datePreset === 'today' && (
                                <button
                                    onClick={() => setDatePreset('all')}
                                    className="mt-3 px-4 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition"
                                >
                                    Show All Time Sales
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-700 font-black uppercase text-[10px] tracking-wider">
                                        <th className="w-8 py-3 px-2 text-center"></th>
                                        <th className="py-3 px-3 text-left">Receipt #</th>
                                        <th className="py-3 px-3 text-left">Date / Time</th>
                                        <th className="py-3 px-3 text-left">Customer / Patient</th>
                                        <th className="py-3 px-3 text-left">Cashier</th>
                                        <th className="py-3 px-3 text-left">Payment Method</th>
                                        <th className="py-3 px-3 text-left">M-Pesa / Ref</th>
                                        <th className="py-3 px-3 text-right">Total (KES)</th>
                                        <th className="py-3 px-3 text-center">Status</th>
                                        <th className="py-3 px-3 text-center w-24">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredSales.map((sale) => {
                                        const isExpanded = expandedRows.has(sale.sale_id);
                                        const items = saleItemsCache[sale.sale_id] || [];
                                        const isItemsLoading = loadingItems.has(sale.sale_id);

                                        return (
                                            <Fragment key={sale.sale_id}>
                                                <tr
                                                    onClick={() => toggleRow(sale.sale_id)}
                                                    className={`hover:bg-emerald-50/40 transition cursor-pointer ${
                                                        isExpanded ? 'bg-emerald-50/60' : ''
                                                    }`}
                                                >
                                                    <td className="py-3 px-2 text-center text-gray-400">
                                                        <span className={`inline-block transition-transform duration-200 font-bold ${isExpanded ? 'rotate-90 text-emerald-700' : ''}`}>
                                                            ▶
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-3">
                                                        <span className="font-mono font-black text-gray-900 bg-gray-100 px-2 py-0.5 rounded-lg border border-gray-200">
                                                            {sale.receipt_no}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-3 text-gray-600 whitespace-nowrap">
                                                        <span className="font-bold text-gray-800">{formatTime(sale.sale_datetime)}</span>
                                                        <span className="block text-[10px] text-gray-400">{formatDate(sale.sale_datetime)}</span>
                                                    </td>
                                                    <td className="py-3 px-3">
                                                        <span className="font-bold text-gray-900 block">{sale.customer_name || 'Walk-in'}</span>
                                                        {sale.customer_phone && (
                                                            <span className="text-[10px] font-mono text-gray-400">{sale.customer_phone}</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-3 text-gray-600">
                                                        <span className="font-medium text-gray-700">{sale.cashier_name || 'Counter'}</span>
                                                    </td>
                                                    <td className="py-3 px-3">
                                                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${paymentBadge(sale.payment_method)}`}>
                                                            {sale.payment_method}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-3 font-mono">
                                                        {sale.mpesa_receipt ? (
                                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                {sale.mpesa_receipt}
                                                            </span>
                                                        ) : sale.insurance_ref ? (
                                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                                                {sale.insurance_ref}
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-300">—</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-3 text-right font-black text-gray-900 text-sm">
                                                        KES {Number(sale.total || 0).toLocaleString()}
                                                    </td>
                                                    <td className="py-3 px-3 text-center">
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                                            {sale.status || 'Completed'}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <button
                                                                onClick={() => viewReceipt(sale)}
                                                                className="p-1.5 bg-gray-100 hover:bg-emerald-100 text-gray-600 hover:text-emerald-700 rounded-lg transition"
                                                                title="View Full Receipt"
                                                            >
                                                                👁️
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    navigator.clipboard.writeText(sale.receipt_no);
                                                                    toast.success(`Copied ${sale.receipt_no}`);
                                                                }}
                                                                className="p-1.5 bg-gray-100 hover:bg-blue-100 text-gray-600 hover:text-blue-700 rounded-lg transition"
                                                                title="Copy Receipt #"
                                                            >
                                                                📋
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>

                                                {/* Expanded Row Itemized Table */}
                                                {isExpanded && (
                                                    <tr className="bg-emerald-50/20">
                                                        <td colSpan={10} className="px-6 py-3">
                                                            {isItemsLoading ? (
                                                                <div className="p-3 text-center text-xs text-gray-500 font-bold">
                                                                    Loading itemized batches...
                                                                </div>
                                                            ) : items.length === 0 ? (
                                                                <div className="p-3 text-center text-xs text-gray-400">
                                                                    No item lines recorded for this transaction.
                                                                </div>
                                                            ) : (
                                                                <div className="bg-white rounded-2xl border border-emerald-200/80 shadow-xs overflow-hidden">
                                                                    <div className="px-3 py-2 bg-emerald-50/60 border-b border-emerald-100 flex items-center justify-between text-xs">
                                                                        <span className="font-black text-emerald-900 uppercase tracking-wider text-[10px]">
                                                                            Dispensed Items ({items.length} Lines)
                                                                        </span>
                                                                        <span className="text-[10px] font-bold text-emerald-700">
                                                                            FEFO Batch Tracked
                                                                        </span>
                                                                    </div>
                                                                    <table className="w-full text-xs">
                                                                        <thead>
                                                                            <tr className="border-b border-gray-100 text-gray-500 text-[10px] uppercase font-bold">
                                                                                <th className="p-2 text-left">#</th>
                                                                                <th className="p-2 text-left">Medicine / Product</th>
                                                                                <th className="p-2 text-left">Batch #</th>
                                                                                <th className="p-2 text-left">Expiry</th>
                                                                                <th className="p-2 text-right">Qty</th>
                                                                                <th className="p-2 text-right">Unit Price</th>
                                                                                <th className="p-2 text-right">Discount</th>
                                                                                <th className="p-2 text-right">Line Total</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-gray-50">
                                                                            {items.map((it, idx) => (
                                                                                <tr key={it.item_id || idx} className="hover:bg-gray-50/50">
                                                                                    <td className="p-2 text-gray-400 font-bold">{idx + 1}</td>
                                                                                    <td className="p-2 font-bold text-gray-900">{it.product_name}</td>
                                                                                    <td className="p-2 font-mono text-indigo-700 font-bold">
                                                                                        {it.batch_number || '—'}
                                                                                    </td>
                                                                                    <td className="p-2 text-gray-600">
                                                                                        {it.expiry_date || '—'}
                                                                                    </td>
                                                                                    <td className="p-2 text-right font-black text-gray-800">
                                                                                        {it.quantity} {it.selling_unit || 'Pcs'}
                                                                                    </td>
                                                                                    <td className="p-2 text-right text-gray-700">
                                                                                        KES {Number(it.unit_price || 0).toLocaleString()}
                                                                                    </td>
                                                                                    <td className="p-2 text-right text-red-600 font-bold">
                                                                                        {Number(it.discount || 0) > 0 ? `-KES ${Number(it.discount).toLocaleString()}` : '—'}
                                                                                    </td>
                                                                                    <td className="p-2 text-right font-black text-emerald-800">
                                                                                        KES {Number(it.total || it.unit_price * it.quantity).toLocaleString()}
                                                                                    </td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            )}
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
                </div>
            )}

            {/* TAB 2: GRAPHICAL PRESENTATIONS & VISUAL CHARTS */}
            {activeTab === 'charts' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Daily Revenue Curve */}
                        <div className="lg:col-span-2 bg-white rounded-3xl p-5 border border-gray-200/80 shadow-xs">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="font-black text-sm text-gray-900">Revenue Trajectory Curve</h3>
                                    <p className="text-[11px] text-gray-500">Daily gross revenue over selected horizon</p>
                                </div>
                                <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                                    KES {financials.revenue.toLocaleString()}
                                </span>
                            </div>
                            <div className="h-64">
                                <Line
                                    data={revenueLineChartData}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: { legend: { display: false } },
                                        scales: {
                                            y: {
                                                ticks: { callback: (v) => `KES ${Number(v).toLocaleString()}` },
                                                grid: { color: 'rgba(0,0,0,0.04)' },
                                            },
                                            x: { grid: { display: false } },
                                        },
                                    }}
                                />
                            </div>
                        </div>

                        {/* Payment Method Distribution */}
                        <div className="bg-white rounded-3xl p-5 border border-gray-200/80 shadow-xs">
                            <div className="mb-4">
                                <h3 className="font-black text-sm text-gray-900">Settlement Breakdown</h3>
                                <p className="text-[11px] text-gray-500">M-Pesa vs Cash vs Insurance share</p>
                            </div>
                            <div className="h-64 flex items-center justify-center">
                                <Doughnut
                                    data={paymentDoughnutData}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: { legend: { position: 'bottom' } },
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Peak Operating Hours */}
                        <div className="bg-white rounded-3xl p-5 border border-gray-200/80 shadow-xs">
                            <div className="mb-4">
                                <h3 className="font-black text-sm text-gray-900">Peak Pharmacy Rush Hours</h3>
                                <p className="text-[11px] text-gray-500">Hourly sales volume (6:00 AM – 10:00 PM)</p>
                            </div>
                            <div className="h-60">
                                <Bar
                                    data={hourlyBarChartData}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: { legend: { display: false } },
                                        scales: {
                                            y: { ticks: { callback: (v) => `KES ${Number(v).toLocaleString()}` }, grid: { color: 'rgba(0,0,0,0.04)' } },
                                            x: { grid: { display: false } },
                                        },
                                    }}
                                />
                            </div>
                        </div>

                        {/* Top Dispensed Drugs */}
                        <div className="bg-white rounded-3xl p-5 border border-gray-200/80 shadow-xs">
                            <div className="mb-4">
                                <h3 className="font-black text-sm text-gray-900">Top Dispensed Therapeutic Units</h3>
                                <p className="text-[11px] text-gray-500">Units sold for leading medicines</p>
                            </div>
                            <div className="h-60">
                                <Bar
                                    data={topDrugsBarChartData}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        indexAxis: 'y' as const,
                                        plugins: { legend: { display: false } },
                                        scales: {
                                            x: { grid: { color: 'rgba(0,0,0,0.04)' } },
                                            y: { grid: { display: false } },
                                        },
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: SALES TRENDS & PEAK DEMAND */}
            {activeTab === 'trends' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-xs">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Average Basket Value</span>
                            <span className="text-2xl font-black text-emerald-800 mt-1 block">
                                KES {financials.avgTicket.toLocaleString()}
                            </span>
                            <p className="text-[11px] text-gray-400 mt-0.5">Average revenue per customer receipt</p>
                        </div>

                        <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-xs">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Busiest Hour of Day</span>
                            <span className="text-2xl font-black text-indigo-700 mt-1 block">
                                {hourlyData.reduce((max, h) => (h.revenue > max.revenue ? h : max), hourlyData[0] || { hour: '11:00', revenue: 0 }).hour}
                            </span>
                            <p className="text-[11px] text-gray-400 mt-0.5">Peak dispensing rush time</p>
                        </div>

                        <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-xs">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Digital Collection Ratio</span>
                            <span className="text-2xl font-black text-teal-700 mt-1 block">
                                {financials.revenue > 0 ? (((financials.mpesa + financials.insurance) / financials.revenue) * 100).toFixed(1) : 0}%
                            </span>
                            <p className="text-[11px] text-gray-400 mt-0.5">M-Pesa + Insurance share of total sales</p>
                        </div>
                    </div>

                    {/* Hourly Demand Table */}
                    <div className="bg-white rounded-3xl border border-gray-200/80 shadow-xs overflow-hidden">
                        <div className="p-4 bg-gray-50/70 border-b border-gray-200 flex items-center justify-between">
                            <div>
                                <h3 className="font-black text-xs uppercase tracking-wider text-gray-800">
                                    Hour-by-Hour Dispensing &amp; Sales Distribution
                                </h3>
                                <p className="text-[11px] text-gray-500">Identify staffing requirements &amp; counter bottlenecks</p>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="bg-gray-50/50 border-b border-gray-200 text-gray-600 font-bold uppercase text-[10px]">
                                        <th className="p-3 text-left">Time Slot</th>
                                        <th className="p-3 text-center">Receipts Count</th>
                                        <th className="p-3 text-right">Revenue Generated</th>
                                        <th className="p-3 text-right">% of Total</th>
                                        <th className="p-3 text-left">Demand Heat Indicator</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {hourlyData.map((h, i) => {
                                        const pct = financials.revenue > 0 ? (h.revenue / financials.revenue) * 100 : 0;
                                        return (
                                            <tr key={i} className="hover:bg-gray-50">
                                                <td className="p-3 font-mono font-bold text-gray-800">{h.hour}</td>
                                                <td className="p-3 text-center font-bold">{h.count}</td>
                                                <td className="p-3 text-right font-black text-emerald-800">
                                                    KES {h.revenue.toLocaleString()}
                                                </td>
                                                <td className="p-3 text-right font-bold text-gray-600">
                                                    {pct.toFixed(1)}%
                                                </td>
                                                <td className="p-3">
                                                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                                                        <div
                                                            className="bg-emerald-600 h-2 rounded-full"
                                                            style={{ width: `${Math.min(100, pct * 4)}%` }}
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 4: FAST-MOVING DRUGS & INVENTORY VELOCITY */}
            {activeTab === 'fast_moving' && (
                <div className="bg-white rounded-3xl border border-gray-200/80 shadow-xs overflow-hidden">
                    <div className="p-4 bg-teal-50/60 border-b border-teal-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-xl">⚡</span>
                            <div>
                                <h3 className="font-black text-teal-900 text-xs uppercase tracking-wider">
                                    Fast-Moving Drug Velocity &amp; Margin Engine
                                </h3>
                                <p className="text-[11px] text-teal-700">
                                    Ranked by units dispensed with profit margins and reorder recommendations
                                </p>
                            </div>
                        </div>
                        <span className="px-3 py-1 bg-teal-200 text-teal-900 font-black text-xs rounded-full">
                            {drugAnalytics.length} Dispensed Items
                        </span>
                    </div>

                    {drugAnalytics.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">
                            <div className="text-4xl mb-2">⚡</div>
                            <p className="text-sm font-bold text-gray-800">No drug line items recorded</p>
                            <p className="text-xs text-gray-400 mt-1">Dispensed drug lines will appear here automatically.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="bg-gray-50/80 border-b border-gray-200 text-[10px] font-black uppercase tracking-wider text-gray-700">
                                        <th className="p-3 text-left">#</th>
                                        <th className="p-3 text-left">Medicine Name</th>
                                        <th className="p-3 text-center">Velocity Rank</th>
                                        <th className="p-3 text-right">Units Sold</th>
                                        <th className="p-3 text-right">Gross Sales (KES)</th>
                                        <th className="p-3 text-right">Cost of Goods</th>
                                        <th className="p-3 text-right">Gross Profit (KES)</th>
                                        <th className="p-3 text-center">Margin %</th>
                                        <th className="p-3 text-center">Rx Tickets</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {drugAnalytics.map((d, idx) => (
                                        <tr key={idx} className="hover:bg-teal-50/30 transition">
                                            <td className="p-3 text-gray-400 font-bold">{idx + 1}</td>
                                            <td className="p-3 font-bold text-gray-900">{d.name}</td>
                                            <td className="p-3 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                                    d.velocityRank === 'Ultra High' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                                                    d.velocityRank === 'High' ? 'bg-cyan-100 text-cyan-800 border border-cyan-300' :
                                                    d.velocityRank === 'Medium' ? 'bg-amber-100 text-amber-800' :
                                                    'bg-gray-100 text-gray-600'
                                                }`}>
                                                    {d.velocityRank}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right font-black text-gray-900">{d.qty.toLocaleString()}</td>
                                            <td className="p-3 text-right font-black text-emerald-800">
                                                KES {d.revenue.toLocaleString()}
                                            </td>
                                            <td className="p-3 text-right text-gray-600">
                                                KES {d.cogs.toLocaleString()}
                                            </td>
                                            <td className="p-3 text-right font-black text-teal-700">
                                                KES {d.profit.toLocaleString()}
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                                    d.marginPct >= 30 ? 'bg-emerald-100 text-emerald-800' :
                                                    d.marginPct >= 15 ? 'bg-amber-100 text-amber-800' :
                                                    'bg-gray-100 text-gray-700'
                                                }`}>
                                                    {d.marginPct}%
                                                </span>
                                            </td>
                                            <td className="p-3 text-center font-bold text-gray-700">{d.transactions}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 5: M-PESA & MOBILE MONEY LEDGER */}
            {activeTab === 'mpesa' && (
                <div className="bg-white rounded-3xl border border-gray-200/80 shadow-xs overflow-hidden">
                    <div className="p-4 bg-emerald-50/60 border-b border-emerald-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-xl">📱</span>
                            <div>
                                <h3 className="font-black text-emerald-900 text-xs uppercase tracking-wider">
                                    M-Pesa Reconciliation &amp; C2B Payments
                                </h3>
                                <p className="text-[11px] text-emerald-700">
                                    Direct validation codes, checkout request IDs &amp; customer confirmation
                                </p>
                            </div>
                        </div>
                        <span className="px-3 py-1 bg-emerald-200 text-emerald-900 font-black text-xs rounded-full">
                            Total: KES {financials.mpesa.toLocaleString()}
                        </span>
                    </div>

                    {mpesaSales.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">
                            <div className="text-4xl mb-2">📱</div>
                            <p className="text-sm font-bold text-gray-800">No M-Pesa transactions found</p>
                            <p className="text-xs text-gray-400 mt-1">No receipts with M-Pesa confirmation code in selected period.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="bg-gray-50/80 border-b border-gray-200 text-[10px] font-black uppercase tracking-wider text-gray-700">
                                        <th className="p-3 text-left">#</th>
                                        <th className="p-3 text-left">M-Pesa Code</th>
                                        <th className="p-3 text-left">Receipt #</th>
                                        <th className="p-3 text-left">Patient / Customer</th>
                                        <th className="p-3 text-left">Phone #</th>
                                        <th className="p-3 text-left">Date / Time</th>
                                        <th className="p-3 text-right">M-Pesa Amount (KES)</th>
                                        <th className="p-3 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {mpesaSales.map((s, idx) => {
                                        const mpesaAmt = Number(s.split_mpesa) > 0 ? Number(s.split_mpesa) : Number(s.total);
                                        return (
                                            <tr key={s.sale_id} className="hover:bg-emerald-50/40 transition">
                                                <td className="p-3 text-gray-400 font-bold">{idx + 1}</td>
                                                <td className="p-3 font-mono font-black text-emerald-700">
                                                    <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 rounded">
                                                        {s.mpesa_receipt || 'STK-CONFIRMED'}
                                                    </span>
                                                </td>
                                                <td className="p-3 font-mono font-bold text-gray-800">{s.receipt_no}</td>
                                                <td className="p-3 font-bold text-gray-900">{s.customer_name || 'Walk-in'}</td>
                                                <td className="p-3 font-mono text-gray-700">{s.customer_phone || '—'}</td>
                                                <td className="p-3 text-gray-600">{new Date(s.sale_datetime).toLocaleString('en-KE')}</td>
                                                <td className="p-3 text-right font-black text-emerald-800 text-sm">
                                                    KES {mpesaAmt.toLocaleString()}
                                                </td>
                                                <td className="p-3 text-center">
                                                    <button
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(s.mpesa_receipt || s.receipt_no);
                                                            toast.success('M-Pesa code copied!');
                                                        }}
                                                        className="px-2.5 py-1 bg-gray-100 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg text-[10px] transition"
                                                    >
                                                        Copy Code
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 6: INSURANCE & SPLIT CLAIMS */}
            {activeTab === 'insurance' && (
                <div className="bg-white rounded-3xl border border-gray-200/80 shadow-xs overflow-hidden">
                    <div className="p-4 bg-purple-50/60 border-b border-purple-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-xl">🏥</span>
                            <div>
                                <h3 className="font-black text-purple-900 text-xs uppercase tracking-wider">
                                    Insurance Claims &amp; Split Payment Settlements
                                </h3>
                                <p className="text-[11px] text-purple-700">
                                    Corporate schemes, pre-authorization refs &amp; patient copay breakdown
                                </p>
                            </div>
                        </div>
                        <span className="px-3 py-1 bg-purple-200 text-purple-900 font-black text-xs rounded-full">
                            Claims: KES {financials.insurance.toLocaleString()}
                        </span>
                    </div>

                    {insuranceSales.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">
                            <div className="text-4xl mb-2">🏥</div>
                            <p className="text-sm font-bold text-gray-800">No insurance transactions found</p>
                            <p className="text-xs text-gray-400 mt-1">No insurance claims or split copays in selected range.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="bg-gray-50/80 border-b border-gray-200 text-[10px] font-black uppercase tracking-wider text-gray-700">
                                        <th className="p-3 text-left">#</th>
                                        <th className="p-3 text-left">Receipt #</th>
                                        <th className="p-3 text-left">Patient Name</th>
                                        <th className="p-3 text-left">Insurance Scheme</th>
                                        <th className="p-3 text-left">Claim Ref #</th>
                                        <th className="p-3 text-right">Insurance Claimed</th>
                                        <th className="p-3 text-right">Patient Copay</th>
                                        <th className="p-3 text-right">Total Invoice</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {insuranceSales.map((s, idx) => (
                                        <tr key={s.sale_id} className="hover:bg-purple-50/30 transition">
                                            <td className="p-3 text-gray-400 font-bold">{idx + 1}</td>
                                            <td className="p-3 font-mono font-bold text-gray-900">{s.receipt_no}</td>
                                            <td className="p-3 font-bold text-gray-900">{s.customer_name || 'Walk-in Patient'}</td>
                                            <td className="p-3">
                                                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-purple-100 text-purple-800">
                                                    {s.split_insurance_name || s.payment_method || 'Medical Insurance'}
                                                </span>
                                            </td>
                                            <td className="p-3 font-mono text-purple-700 font-bold">
                                                {s.insurance_ref || 'PENDING-AUTH'}
                                            </td>
                                            <td className="p-3 text-right font-black text-purple-900">
                                                KES {Number(s.split_insurance || (s.payment_method === 'Insurance' ? s.total : 0)).toLocaleString()}
                                            </td>
                                            <td className="p-3 text-right font-bold text-gray-700">
                                                KES {Number(s.split_cash || s.split_mpesa || 0).toLocaleString()}
                                            </td>
                                            <td className="p-3 text-right font-black text-gray-900 text-sm">
                                                KES {Number(s.total || 0).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 7: CASHIER & SHIFT AUDIT */}
            {activeTab === 'cashier' && (
                <div className="bg-white rounded-3xl border border-gray-200/80 shadow-xs overflow-hidden">
                    <div className="p-4 bg-sky-50/60 border-b border-sky-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-xl">👤</span>
                            <div>
                                <h3 className="font-black text-sky-900 text-xs uppercase tracking-wider">
                                    Cashier &amp; Pharmacist Shift Performance Audit
                                </h3>
                                <p className="text-[11px] text-sky-700">
                                    Individual staff collection volume, ticket averages &amp; settlement breakdown
                                </p>
                            </div>
                        </div>
                    </div>

                    {cashierAnalytics.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">
                            <div className="text-4xl mb-2">👤</div>
                            <p className="text-sm font-bold text-gray-800">No cashier shift records</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="bg-gray-50/80 border-b border-gray-200 text-[10px] font-black uppercase tracking-wider text-gray-700">
                                        <th className="p-3 text-left">#</th>
                                        <th className="p-3 text-left">Cashier / Pharmacist</th>
                                        <th className="p-3 text-center">Receipts Handled</th>
                                        <th className="p-3 text-right">Cash Collected</th>
                                        <th className="p-3 text-right">M-Pesa Collected</th>
                                        <th className="p-3 text-right">Insurance Handled</th>
                                        <th className="p-3 text-right">Avg Basket Value</th>
                                        <th className="p-3 text-right">Total Revenue (KES)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {cashierAnalytics.map((c, idx) => (
                                        <tr key={idx} className="hover:bg-sky-50/30 transition">
                                            <td className="p-3 text-gray-400 font-bold">{idx + 1}</td>
                                            <td className="p-3 font-bold text-gray-900 flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-full bg-sky-100 text-sky-800 flex items-center justify-center font-black text-xs">
                                                    {c.name.charAt(0).toUpperCase()}
                                                </div>
                                                {c.name}
                                            </td>
                                            <td className="p-3 text-center font-bold text-gray-800">{c.count}</td>
                                            <td className="p-3 text-right font-bold text-amber-700">KES {c.cash.toLocaleString()}</td>
                                            <td className="p-3 text-right font-bold text-emerald-700">KES {c.mpesa.toLocaleString()}</td>
                                            <td className="p-3 text-right font-bold text-purple-700">KES {c.insurance.toLocaleString()}</td>
                                            <td className="p-3 text-right text-gray-700 font-mono">KES {c.avgTicket.toLocaleString()}</td>
                                            <td className="p-3 text-right font-black text-sky-900 text-sm">
                                                KES {c.total.toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 8: DEEP EXECUTIVE METRICS MATRIX */}
            {activeTab === 'metrics' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-xs">
                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Total Subtotal</span>
                            <span className="text-xl font-black text-gray-900 mt-1 block">
                                KES {filteredSales.reduce((a, b) => a + Number(b.subtotal || b.total || 0), 0).toLocaleString()}
                            </span>
                        </div>

                        <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-xs">
                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Customer Discounts Given</span>
                            <span className="text-xl font-black text-red-600 mt-1 block">
                                KES {financials.discount.toLocaleString()}
                            </span>
                        </div>

                        <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-xs">
                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Tax &amp; VAT Accrued</span>
                            <span className="text-xl font-black text-blue-700 mt-1 block">
                                KES {financials.tax.toLocaleString()}
                            </span>
                        </div>

                        <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-xs">
                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Net Profit Margin %</span>
                            <span className="text-xl font-black text-emerald-700 mt-1 block">
                                {financials.marginPct.toFixed(1)}%
                            </span>
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-xs space-y-4">
                        <h3 className="font-black text-sm text-gray-900 uppercase tracking-wider">
                            Executive Financial &amp; Retail Performance Summary
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
                                <div className="flex justify-between py-1 border-b border-gray-200">
                                    <span className="text-gray-600">Total Validated Receipts:</span>
                                    <span className="font-bold text-gray-900">{filteredSales.length}</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-gray-200">
                                    <span className="text-gray-600">Total Gross Income:</span>
                                    <span className="font-black text-emerald-800">KES {financials.revenue.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-gray-200">
                                    <span className="text-gray-600">Estimated Cost of Goods (COGS):</span>
                                    <span className="font-bold text-gray-700">KES {financials.totalCogs.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between py-1">
                                    <span className="font-bold text-gray-800">Estimated Gross Margin:</span>
                                    <span className="font-black text-emerald-700">KES {financials.grossProfit.toLocaleString()}</span>
                                </div>
                            </div>

                            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
                                <div className="flex justify-between py-1 border-b border-gray-200">
                                    <span className="text-gray-600">M-Pesa Receipts Volume:</span>
                                    <span className="font-bold text-emerald-700">KES {financials.mpesa.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-gray-200">
                                    <span className="text-gray-600">Cash Register In-Hand:</span>
                                    <span className="font-bold text-amber-700">KES {financials.cash.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-gray-200">
                                    <span className="text-gray-600">Insurance &amp; Corporate Credit:</span>
                                    <span className="font-bold text-purple-700">KES {financials.insurance.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between py-1">
                                    <span className="font-bold text-gray-800">Average Basket Ticket:</span>
                                    <span className="font-black text-gray-900">KES {financials.avgTicket.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* RECEIPT PREVIEW & THERMAL 80MM PRINT MODAL */}
            {showReceiptModal && selectedSale && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
                    <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-4 text-white flex items-center justify-between flex-shrink-0">
                            <div>
                                <h3 className="font-black text-base tracking-tight">Receipt #{selectedSale.receipt_no}</h3>
                                <p className="text-[11px] text-emerald-100">{new Date(selectedSale.sale_datetime).toLocaleString('en-KE')}</p>
                            </div>
                            <button
                                onClick={() => setShowReceiptModal(false)}
                                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-sm font-bold transition"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Body / Thermal 80mm preview */}
                        <div className="p-6 overflow-y-auto space-y-4 text-xs font-mono">
                            <div className="text-center border-b border-dashed border-gray-300 pb-3">
                                <h2 className="text-sm font-black text-gray-900 tracking-tight font-sans">{companyName}</h2>
                                <p className="text-[10px] text-gray-500 font-sans">{outletName}</p>
                                <p className="text-[10px] text-gray-400 font-sans mt-0.5">Licensed Pharmaceutical Chemist</p>
                            </div>

                            <div className="space-y-1.5 text-gray-700">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Receipt No:</span>
                                    <span className="font-bold">{selectedSale.receipt_no}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Date:</span>
                                    <span>{new Date(selectedSale.sale_datetime).toLocaleString('en-KE')}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Customer:</span>
                                    <span className="font-bold">{selectedSale.customer_name || 'Walk-in'}</span>
                                </div>
                                {selectedSale.customer_phone && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Phone:</span>
                                        <span>{selectedSale.customer_phone}</span>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Cashier:</span>
                                    <span>{selectedSale.cashier_name || 'Pharmacist'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Payment:</span>
                                    <span className="font-bold">{selectedSale.payment_method}</span>
                                </div>
                                {selectedSale.mpesa_receipt && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">M-Pesa Code:</span>
                                        <span className="font-bold text-emerald-700">{selectedSale.mpesa_receipt}</span>
                                    </div>
                                )}
                                {selectedSale.insurance_ref && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Insurance Ref:</span>
                                        <span className="font-bold text-purple-700">{selectedSale.insurance_ref}</span>
                                    </div>
                                )}
                            </div>

                            {/* Itemized Table */}
                            <div className="border-t border-b border-dashed border-gray-300 py-3 space-y-2">
                                <div className="grid grid-cols-12 text-[10px] font-bold text-gray-400 uppercase">
                                    <span className="col-span-6">Item</span>
                                    <span className="col-span-2 text-right">Qty</span>
                                    <span className="col-span-4 text-right">Total</span>
                                </div>
                                {selectedSaleItems.map((it, i) => (
                                    <div key={i} className="grid grid-cols-12 text-[11px] text-gray-800">
                                        <div className="col-span-6">
                                            <span className="font-bold block">{it.product_name}</span>
                                            {it.batch_number && (
                                                <span className="text-[9px] text-gray-400">Lot: {it.batch_number}</span>
                                            )}
                                        </div>
                                        <span className="col-span-2 text-right">{it.quantity}</span>
                                        <span className="col-span-4 text-right font-bold">
                                            KES {Number(it.total || it.unit_price * it.quantity).toLocaleString()}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Totals */}
                            <div className="space-y-1.5 pt-1">
                                <div className="flex justify-between text-gray-600">
                                    <span>Subtotal:</span>
                                    <span>KES {Number(selectedSale.subtotal || selectedSale.total).toLocaleString()}</span>
                                </div>
                                {Number(selectedSale.discount || 0) > 0 && (
                                    <div className="flex justify-between text-red-600 font-bold">
                                        <span>Discount:</span>
                                        <span>-KES {Number(selectedSale.discount).toLocaleString()}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-base font-black text-gray-900 pt-2 border-t border-gray-200">
                                    <span>TOTAL:</span>
                                    <span className="text-emerald-700">KES {Number(selectedSale.total || 0).toLocaleString()}</span>
                                </div>
                            </div>

                            <div className="text-center text-[10px] text-gray-400 pt-3 border-t border-dashed border-gray-300">
                                <p>Thank you for choosing {companyName}!</p>
                                <p className="mt-0.5">Medicines once sold cannot be returned without original receipt.</p>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-3 flex-shrink-0">
                            <button
                                onClick={() => setShowReceiptModal(false)}
                                className="px-4 py-2 border border-gray-300 text-gray-700 font-bold rounded-xl text-xs hover:bg-gray-100 transition"
                            >
                                Close
                            </button>
                            <button
                                onClick={() => window.print()}
                                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs shadow-md transition flex items-center gap-1.5"
                            >
                                <span>🖨️</span> Print 80mm Receipt
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
