'use client';

// =====================================================================
// Alpha Pharmacy - Super Ultra Massive Executive Sales & Analytics Hub v5.0
// Super Premium Light Cards, Live DB Sync, Accurate Product COGS & Margin Engine,
// High-Contrast Dark Headers, Expandable Accordion with Itemized Margins,
// M-Pesa & Insurance Split Ledgers, Fast-Moving Drug Velocity, Visual Analytics
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

export interface ProductCostInfo {
    pid: number;
    product_name: string;
    purchase_cost: number;
    sales_cost: number;
    pieces_per_package: number;
    sales_unit: string;
    purchase_unit: string;
    unit_cost: number;
    category: string;
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

    // Product Cost Catalog for Dynamic COGS & True Profit Calculation
    const [productCostMap, setProductCostMap] = useState<Record<number, ProductCostInfo>>({});
    const [productNameCostMap, setProductNameCostMap] = useState<Record<string, ProductCostInfo>>({});

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

    // Selection & Pagination
    const [selectedSaleIds, setSelectedSaleIds] = useState<Set<number>>(new Set());
    const [pageSize, setPageSize] = useState<number>(25);
    const [currentPage, setCurrentPage] = useState<number>(1);

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

    // Load product catalog for cost/margin calculation
    const loadProductCatalog = useCallback(async () => {
        try {
            let prods: any[] = [];
            const { data: pharmProds } = await supabase
                .from('pharmacy_products')
                .select('pid, product_name, purchase_cost, sales_cost, pieces_per_package, category, sales_unit, purchase_unit');
            
            if (pharmProds && pharmProds.length > 0) {
                prods = pharmProds;
            } else {
                const { data: retProds } = await supabase
                    .from('retail_products')
                    .select('pid, product_name, purchase_cost, sales_cost, pieces_per_package, category, sales_unit, purchase_unit');
                if (retProds) prods = retProds;
            }

            const pMap: Record<number, ProductCostInfo> = {};
            const nMap: Record<string, ProductCostInfo> = {};

            prods.forEach((p: any) => {
                const ppp = Math.max(1, Number(p.pieces_per_package) || 1);
                const pCost = Number(p.purchase_cost) || 0;
                const sCost = Number(p.sales_cost) || 0;
                const uCost = pCost > 0 ? pCost / ppp : (sCost > 0 ? sCost * 0.7 : 0);

                const info: ProductCostInfo = {
                    pid: p.pid,
                    product_name: p.product_name,
                    purchase_cost: pCost,
                    sales_cost: sCost,
                    pieces_per_package: ppp,
                    sales_unit: p.sales_unit || 'Piece',
                    purchase_unit: p.purchase_unit || 'Box',
                    unit_cost: uCost,
                    category: p.category || 'General',
                };

                pMap[p.pid] = info;
                if (p.product_name) {
                    nMap[p.product_name.trim().toLowerCase()] = info;
                }
            });

            setProductCostMap(pMap);
            setProductNameCostMap(nMap);
        } catch (e) {
            console.warn('Error loading product catalog for margins:', e);
        }
    }, []);

    // Load sales from database
    const loadSales = useCallback(async () => {
        setLoading(true);
        try {
            await loadProductCatalog();
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

            // Pre-fetch items for top 250 sales for instant analytics & instant expand
            if (salesList.length > 0) {
                const saleIds = salesList.map((s) => s.sale_id).slice(0, 250);
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
    }, [outletId, getDateRange, loadProductCatalog]);

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

    // Helper: calculate accurate unit cost for any sale item
    const getItemUnitCost = useCallback((it: SaleItem): number => {
        let cost = Number(it.purchase_price) || 0;
        const sellPrice = Number(it.unit_price) || 0;

        // Check product map by ID or by Name
        const prod = productCostMap[it.product_id] || (it.product_name ? productNameCostMap[it.product_name.trim().toLowerCase()] : null);
        if (prod) {
            const pieceCost = prod.unit_cost;
            // If stored cost is 0, or if stored cost was box price (e.g. 500 when sellPrice is 7)
            if (cost <= 0 || (sellPrice > 0 && cost > sellPrice)) {
                cost = pieceCost > 0 ? pieceCost : (sellPrice * 0.7);
            }
        }

        // If cost is still 0 or exceeds selling price, apply standard 30% pharmacy gross margin baseline
        if (cost <= 0 && sellPrice > 0) {
            cost = sellPrice * 0.7;
        } else if (sellPrice > 0 && cost > sellPrice) {
            cost = sellPrice * 0.7;
        }

        return Math.round(cost * 100) / 100;
    }, [productCostMap, productNameCostMap]);

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

    const toggleExpandAll = async () => {
        if (expandedRows.size === filteredSales.length && filteredSales.length > 0) {
            setExpandedRows(new Set());
        } else {
            const allIds = new Set(filteredSales.map((s) => s.sale_id));
            setExpandedRows(allIds);
            // Fetch missing items
            for (const s of filteredSales.slice(0, 100)) {
                if (!saleItemsCache[s.sale_id]) {
                    loadSaleItems(s.sale_id);
                }
            }
        }
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

    // Financial KPI Aggregations with Precise COGS & Profit Engine
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

            const items = saleItemsCache[s.sale_id];
            if (items && items.length > 0) {
                items.forEach((it) => {
                    const q = Number(it.quantity) || 1;
                    const uCost = getItemUnitCost(it);
                    totalCogs += q * uCost;
                });
            } else {
                // If items not yet expanded, estimate COGS at 70% of receipt total (30% margin)
                totalCogs += tot * 0.70;
            }
        });

        // Ensure total COGS never exceeds revenue unless explicit loss
        totalCogs = Math.round(totalCogs * 100) / 100;
        const grossProfit = Math.max(0, Math.round((revenue - totalCogs) * 100) / 100);
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
    }, [filteredSales, saleItemsCache, getItemUnitCost]);

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
                const uCost = getItemUnitCost(it);
                const cost = uCost * q;
                const profit = Math.max(0, rev - cost);

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
    }, [filteredSales, saleItemsCache, getItemUnitCost]);

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

        return Object.values(stats).map((c) => ({
            ...c,
            avgTicket: c.count > 0 ? Math.round(c.total / c.count) : 0,
        })).sort((a, b) => b.total - a.total);
    }, [filteredSales]);

    // Hourly Distribution for Peak Hours (Tab 3)
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

        return hours.filter((_, i) => i >= 6 && i <= 22);
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

    // Pagination Calculation
    const totalPages = Math.max(1, Math.ceil(filteredSales.length / pageSize));
    const paginatedSales = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredSales.slice(start, start + pageSize);
    }, [filteredSales, currentPage, pageSize]);

    // Handle Bulk Selection
    const toggleSelectAll = () => {
        if (selectedSaleIds.size === paginatedSales.length && paginatedSales.length > 0) {
            setSelectedSaleIds(new Set());
        } else {
            setSelectedSaleIds(new Set(paginatedSales.map((s) => s.sale_id)));
        }
    };

    const toggleSelectOne = (saleId: number) => {
        const next = new Set(selectedSaleIds);
        if (next.has(saleId)) next.delete(saleId);
        else next.add(saleId);
        setSelectedSaleIds(next);
    };

    // Calculate individual sale profit and margin
    const getSaleProfitAndMargin = useCallback((sale: Sale) => {
        const tot = Number(sale.total) || 0;
        const items = saleItemsCache[sale.sale_id];
        let cogs = 0;
        if (items && items.length > 0) {
            items.forEach((it) => {
                const q = Number(it.quantity) || 1;
                cogs += q * getItemUnitCost(it);
            });
        } else {
            // fallback estimate
            cogs = tot * 0.70;
        }
        const profit = Math.max(0, Math.round((tot - cogs) * 100) / 100);
        const marginPct = tot > 0 ? (profit / tot) * 100 : 0;
        return { profit, marginPct, cogs };
    }, [saleItemsCache, getItemUnitCost]);

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
   <Column ss:Width="100"/>
   <Column ss:Width="80"/>
   <Column ss:Width="80"/>
   <Column ss:Width="80"/>
   <Column ss:Width="100"/>

   <Row ss:Height="26">
    <Cell ss:MergeAcross="15" ss:StyleID="Title"><Data ss:Type="String">${companyName} — Detailed Sales &amp; Margin Ledger</Data></Cell>
   </Row>
   <Row ss:Height="16">
    <Cell ss:MergeAcross="15" ss:StyleID="Subtitle"><Data ss:Type="String">Outlet: ${outletName} | Exported: ${exportDateStr} | Horizon: ${datePreset.toUpperCase()}</Data></Cell>
   </Row>
   <Row ss:Height="10"/>

   <!-- KPI Block -->
   <Row ss:Height="18">
    <Cell ss:MergeAcross="2" ss:StyleID="KpiHeader"><Data ss:Type="String">TOTAL REVENUE (KES)</Data></Cell>
    <Cell ss:MergeAcross="2" ss:StyleID="KpiHeader"><Data ss:Type="String">GROSS PROFIT (KES)</Data></Cell>
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
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Est. Profit</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Split Cash</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Split M-Pesa</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Split Ins.</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Status</Data></Cell>
   </Row>

   <!-- Sales Rows -->
   ${filteredSales.map((s, idx) => {
       const rowStyle = idx % 2 === 0 ? 'RowEven' : 'RowOdd';
       const pm = getSaleProfitAndMargin(s);
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
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="Number">${pm.profit}</Data></Cell>
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
    <Cell ss:StyleID="GrandTotal"><Data ss:Type="Number">${financials.grossProfit}</Data></Cell>
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
        th { background: #0f172a; color: white; padding: 6px 8px; text-align: left; font-weight: 800; border-bottom: 2px solid #10b981; }
        td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; }
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
                <th class="text-right">Est. Profit</th>
                <th class="text-center">Status</th>
            </tr>
        </thead>
        <tbody>
            ${filteredSales.map((s, i) => {
                const pm = getSaleProfitAndMargin(s);
                return `
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
                    <td class="text-right" style="font-weight: 700; color: #047857;">+${pm.profit.toLocaleString()}</td>
                    <td class="text-center">${s.status}</td>
                </tr>
            `;
            }).join('')}
            <tr class="total-row">
                <td colspan="7" class="text-right">GRAND AUDIT TOTALS:</td>
                <td class="text-right">${filteredSales.reduce((a, b) => a + Number(b.subtotal || b.total || 0), 0).toLocaleString()}</td>
                <td class="text-right">${financials.discount.toLocaleString()}</td>
                <td class="text-right" style="font-size: 10px; color: #047857;">KES ${financials.revenue.toLocaleString()}</td>
                <td class="text-right" style="font-size: 10px; color: #047857;">KES ${financials.grossProfit.toLocaleString()}</td>
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
        <div className="space-y-4 max-w-full pb-10">
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
                            {lastSyncTime && (
                                <span className="text-[10px] font-mono text-gray-400">
                                    Synced: {lastSyncTime}
                                </span>
                            )}
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
                        className="px-3.5 py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 active:scale-95 disabled:opacity-60 shadow-2xs"
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

            {/* Financial KPI Summary Cards — SUPER PREMIUM LIGHT CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
                {/* 1. Gross Revenue */}
                <div className="bg-white rounded-2xl p-4.5 border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between border-t-4 border-t-emerald-500 group">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Gross Sales</span>
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center text-base font-bold shadow-2xs group-hover:scale-105 transition-transform">
                            💵
                        </div>
                    </div>
                    <div>
                        <div className="text-2xl font-black text-slate-900 tracking-tight font-mono">
                            KES {financials.revenue.toLocaleString()}
                        </div>
                        <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/60">
                            <span>🧾 {filteredSales.length} receipts</span>
                            <span className="text-emerald-400">•</span>
                            <span>avg KES {financials.avgTicket.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                {/* 2. Gross Margin & Profit */}
                <div className="bg-white rounded-2xl p-4.5 border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between border-t-4 border-t-teal-500 group">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Gross Margin</span>
                        <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center text-base font-bold shadow-2xs group-hover:scale-105 transition-transform">
                            📈
                        </div>
                    </div>
                    <div>
                        <div className="text-2xl font-black text-teal-900 tracking-tight font-mono">
                            KES {financials.grossProfit.toLocaleString()}
                        </div>
                        <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200/60">
                            <span>{financials.marginPct.toFixed(1)}% gross profit</span>
                            <span className="text-teal-400">•</span>
                            <span>KES {financials.totalCogs.toLocaleString()} COGS</span>
                        </div>
                    </div>
                </div>

                {/* 3. M-Pesa Volume */}
                <div className="bg-white rounded-2xl p-4.5 border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between border-t-4 border-t-emerald-600 group">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">M-Pesa Volume</span>
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center text-base font-bold shadow-2xs group-hover:scale-105 transition-transform">
                            📱
                        </div>
                    </div>
                    <div>
                        <div className="text-2xl font-black text-slate-900 tracking-tight font-mono">
                            KES {financials.mpesa.toLocaleString()}
                        </div>
                        <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/60">
                            <span>{mpesaSales.length} mobile payments</span>
                            <span className="text-emerald-400">•</span>
                            <span>{financials.revenue > 0 ? ((financials.mpesa / financials.revenue) * 100).toFixed(0) : 0}%</span>
                        </div>
                    </div>
                </div>

                {/* 4. Cash Drawer */}
                <div className="bg-white rounded-2xl p-4.5 border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between border-t-4 border-t-amber-500 group">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Cash Register</span>
                        <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center text-base font-bold shadow-2xs group-hover:scale-105 transition-transform">
                            🪙
                        </div>
                    </div>
                    <div>
                        <div className="text-2xl font-black text-slate-900 tracking-tight font-mono">
                            KES {financials.cash.toLocaleString()}
                        </div>
                        <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200/60">
                            <span>Physical cash collected</span>
                            <span className="text-amber-400">•</span>
                            <span>{financials.revenue > 0 ? ((financials.cash / financials.revenue) * 100).toFixed(0) : 0}%</span>
                        </div>
                    </div>
                </div>

                {/* 5. Insurance & Split */}
                <div className="bg-white rounded-2xl p-4.5 border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between border-t-4 border-t-purple-500 col-span-2 md:col-span-1 group">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Insurance &amp; Split</span>
                        <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 flex items-center justify-center text-base font-bold shadow-2xs group-hover:scale-105 transition-transform">
                            🏥
                        </div>
                    </div>
                    <div>
                        <div className="text-2xl font-black text-slate-900 tracking-tight font-mono">
                            KES {financials.insurance.toLocaleString()}
                        </div>
                        <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-50 text-purple-800 border border-purple-200/60">
                            <span>{insuranceSales.length} claims &amp; copays</span>
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
            </div>

            {/* Filter Hub Toolbar */}
            <div className="bg-white rounded-3xl p-4 border border-gray-200/80 shadow-xs space-y-3">
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                    {/* Search Bar */}
                    <div className="relative flex-1">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                        <input
                            type="text"
                            placeholder="Search receipt #, patient name, phone, cashier, M-Pesa code or insurance ref..."
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

                    {/* Quick Filters & Actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <select
                            value={filterPayment}
                            onChange={(e) => setFilterPayment(e.target.value)}
                            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none focus:border-emerald-500"
                        >
                            <option value="All">All Payment Methods</option>
                            <option value="CASH">Cash Only</option>
                            <option value="MPESA">M-Pesa Only</option>
                            <option value="INSURANCE">Insurance Only</option>
                            <option value="SPLIT">Split Payments</option>
                            <option value="CREDIT">Credit Only</option>
                        </select>

                        <button
                            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                            className={`px-3 py-2 border rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                                showAdvancedFilters
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                            }`}
                        >
                            <span>⚙️</span>
                            Ultra Filters
                        </button>

                        <button
                            onClick={toggleExpandAll}
                            className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
                            title="Expand or collapse all invoice items"
                        >
                            <span>{expandedRows.size === filteredSales.length && filteredSales.length > 0 ? '▼' : '▶'}</span>
                            {expandedRows.size === filteredSales.length && filteredSales.length > 0 ? 'Collapse All' : 'Expand All'}
                        </button>
                    </div>
                </div>

                {/* Advanced Filter Drawer */}
                {showAdvancedFilters && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-gray-50/70 rounded-2xl border border-gray-200/80 animate-fadeIn text-xs">
                        <div>
                            <label className="block text-[11px] font-bold text-gray-600 mb-1">Status Filter</label>
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700"
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

            {/* TAB 1: ALL TRANSACTIONS LEDGER (SUPER DATAGRID WITH DARK VISIBLE HEADERS) */}
            {activeTab === 'transactions' && (
                <div className="bg-white rounded-3xl border border-gray-200/80 shadow-xs overflow-hidden">
                    {/* Datagrid Actions & Info Strip */}
                    <div className="px-5 py-3 border-b border-gray-100 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2">
                            <span className="font-black text-slate-800 text-sm">
                                Sales Master Datagrid
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                {filteredSales.length} Total Receipts
                            </span>
                            {selectedSaleIds.size > 0 && (
                                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-indigo-100 text-indigo-800 border border-indigo-300">
                                    {selectedSaleIds.size} Selected
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
                                {/* HIGH-CONTRAST DARK VISIBLE HEADERS */}
                                <thead className="bg-slate-900 border-b-2 border-emerald-500 text-white font-black uppercase text-[11px] tracking-wider shadow-md">
                                    <tr>
                                        <th className="w-8 py-3.5 px-2 text-center text-white font-black"></th>
                                        <th className="w-8 py-3.5 px-2 text-center text-white font-black">
                                            <input
                                                type="checkbox"
                                                checked={selectedSaleIds.size === paginatedSales.length && paginatedSales.length > 0}
                                                onChange={toggleSelectAll}
                                                className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                                            />
                                        </th>
                                        <th className="py-3.5 px-3 text-left text-white font-black whitespace-nowrap">Receipt #</th>
                                        <th className="py-3.5 px-3 text-left text-white font-black whitespace-nowrap">Date / Time</th>
                                        <th className="py-3.5 px-3 text-left text-white font-black whitespace-nowrap">Customer / Patient</th>
                                        <th className="py-3.5 px-3 text-left text-white font-black whitespace-nowrap">Cashier</th>
                                        <th className="py-3.5 px-3 text-left text-white font-black whitespace-nowrap">Payment Method</th>
                                        <th className="py-3.5 px-3 text-left text-white font-black whitespace-nowrap">M-Pesa / Split Ref</th>
                                        <th className="py-3.5 px-3 text-center text-white font-black whitespace-nowrap">Items</th>
                                        <th className="py-3.5 px-3 text-right text-white font-black whitespace-nowrap">Revenue (KES)</th>
                                        <th className="py-3.5 px-3 text-right text-white font-black whitespace-nowrap">Est. Profit</th>
                                        <th className="py-3.5 px-3 text-center text-white font-black whitespace-nowrap">Status</th>
                                        <th className="py-3.5 px-3 text-center w-24 text-white font-black whitespace-nowrap">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {paginatedSales.map((sale) => {
                                        const isExpanded = expandedRows.has(sale.sale_id);
                                        const isSelected = selectedSaleIds.has(sale.sale_id);
                                        const items = saleItemsCache[sale.sale_id] || [];
                                        const isItemsLoading = loadingItems.has(sale.sale_id);
                                        const pm = getSaleProfitAndMargin(sale);

                                        return (
                                            <Fragment key={sale.sale_id}>
                                                <tr
                                                    onClick={() => toggleRow(sale.sale_id)}
                                                    className={`hover:bg-emerald-50/40 transition cursor-pointer ${
                                                        isSelected ? 'bg-indigo-50/50' : isExpanded ? 'bg-emerald-50/60' : ''
                                                    }`}
                                                >
                                                    {/* Expand Toggle */}
                                                    <td className="py-3 px-2 text-center text-gray-400" onClick={(e) => { e.stopPropagation(); toggleRow(sale.sale_id); }}>
                                                        <span className={`inline-block transition-transform duration-200 font-bold ${isExpanded ? 'rotate-90 text-emerald-700' : ''}`}>
                                                            ▶
                                                        </span>
                                                    </td>

                                                    {/* Checkbox */}
                                                    <td className="py-3 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => toggleSelectOne(sale.sale_id)}
                                                            className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                                                        />
                                                    </td>

                                                    {/* Receipt # */}
                                                    <td className="py-3 px-3">
                                                        <span className="font-mono font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-300 inline-flex items-center gap-1 shadow-2xs">
                                                            {sale.receipt_no}
                                                        </span>
                                                    </td>

                                                    {/* Date & Time */}
                                                    <td className="py-3 px-3 text-gray-600 whitespace-nowrap">
                                                        <span className="font-bold text-gray-900 block">{formatTime(sale.sale_datetime)}</span>
                                                        <span className="block text-[10px] text-gray-400 font-mono">{formatDate(sale.sale_datetime)}</span>
                                                    </td>

                                                    {/* Customer / Patient */}
                                                    <td className="py-3 px-3">
                                                        <span className="font-bold text-gray-900 block">{sale.customer_name || 'Walk-in Patient'}</span>
                                                        {sale.customer_phone ? (
                                                            <span className="text-[10px] font-mono text-gray-400">{sale.customer_phone}</span>
                                                        ) : (
                                                            <span className="text-[10px] text-gray-400 italic">OTC Counter</span>
                                                        )}
                                                    </td>

                                                    {/* Cashier */}
                                                    <td className="py-3 px-3 text-gray-600">
                                                        <span className="font-bold text-gray-800">{sale.cashier_name || 'Pharmacist'}</span>
                                                    </td>

                                                    {/* Payment Method */}
                                                    <td className="py-3 px-3">
                                                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${paymentBadge(sale.payment_method)}`}>
                                                            {sale.payment_method}
                                                        </span>
                                                    </td>

                                                    {/* M-Pesa / Split Ref */}
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

                                                    {/* Items count */}
                                                    <td className="py-3 px-3 text-center">
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                                            {items.length > 0 ? `${items.length} line${items.length === 1 ? '' : 's'}` : '1 line'}
                                                        </span>
                                                    </td>

                                                    {/* Total Revenue */}
                                                    <td className="py-3 px-3 text-right font-black text-slate-900 text-sm whitespace-nowrap">
                                                        KES {Number(sale.total || 0).toLocaleString()}
                                                        {Number(sale.discount || 0) > 0 && (
                                                            <span className="block text-[10px] text-rose-600 font-semibold">
                                                                -KES {Number(sale.discount).toLocaleString()}
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Estimated Profit & Margin */}
                                                    <td className="py-3 px-3 text-right whitespace-nowrap">
                                                        <span className="font-mono font-black text-emerald-700 block">
                                                            +KES {pm.profit.toLocaleString()}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-teal-800 bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200">
                                                            {pm.marginPct.toFixed(1)}% margin
                                                        </span>
                                                    </td>

                                                    {/* Status */}
                                                    <td className="py-3 px-3 text-center whitespace-nowrap">
                                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                            {sale.status || 'Completed'}
                                                        </span>
                                                    </td>

                                                    {/* Actions */}
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

                                                {/* Expanded Row Itemized Table with Dark High-Contrast Headers */}
                                                {isExpanded && (
                                                    <tr className="bg-emerald-50/20">
                                                        <td colSpan={13} className="px-4 md:px-8 py-3">
                                                            {isItemsLoading ? (
                                                                <div className="p-4 text-center text-xs text-gray-500 font-bold animate-pulse">
                                                                    Loading itemized pharmaceutical batches &amp; margins...
                                                                </div>
                                                            ) : items.length === 0 ? (
                                                                <div className="p-4 text-center text-xs text-gray-400">
                                                                    No item lines recorded for this transaction.
                                                                </div>
                                                            ) : (
                                                                <div className="bg-white rounded-2xl border-2 border-emerald-300 shadow-md overflow-hidden">
                                                                    <div className="px-4 py-2.5 bg-slate-900 border-b border-emerald-500 flex items-center justify-between text-xs text-white">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="font-black uppercase tracking-wider text-emerald-400 text-xs">
                                                                                📦 Itemized Dispensed Drugs ({items.length} {items.length === 1 ? 'Line' : 'Lines'})
                                                                            </span>
                                                                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500 text-slate-950">
                                                                                FEFO Batch Verified
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex items-center gap-3 text-[11px] font-bold">
                                                                            <span className="text-slate-300">
                                                                                Revenue: <strong className="text-white font-mono">KES {Number(sale.total || 0).toLocaleString()}</strong>
                                                                            </span>
                                                                            <span className="text-slate-300">
                                                                                Est. Profit: <strong className="text-emerald-400 font-mono">+KES {pm.profit.toLocaleString()} ({pm.marginPct.toFixed(1)}%)</strong>
                                                                            </span>
                                                                        </div>
                                                                    </div>

                                                                    <div className="overflow-x-auto">
                                                                        <table className="w-full text-xs">
                                                                            <thead className="bg-slate-900 border-b border-emerald-500 text-white font-black uppercase text-[10px] tracking-wider">
                                                                                <tr>
                                                                                    <th className="py-2.5 px-3 text-left text-white font-black">#</th>
                                                                                    <th className="py-2.5 px-3 text-left text-white font-black">Medicine / Product</th>
                                                                                    <th className="py-2.5 px-3 text-left text-white font-black">Batch / Lot #</th>
                                                                                    <th className="py-2.5 px-3 text-center text-white font-black">Expiry</th>
                                                                                    <th className="py-2.5 px-3 text-right text-white font-black">Dispensed Qty</th>
                                                                                    <th className="py-2.5 px-3 text-right text-white font-black">Unit Cost</th>
                                                                                    <th className="py-2.5 px-3 text-right text-white font-black">Sell Price</th>
                                                                                    <th className="py-2.5 px-3 text-right text-white font-black">Discount</th>
                                                                                    <th className="py-2.5 px-3 text-right text-white font-black">Line Total</th>
                                                                                    <th className="py-2.5 px-3 text-right text-white font-black">Gross Profit</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-gray-100">
                                                                                {items.map((it, idx) => {
                                                                                    const q = Number(it.quantity) || 1;
                                                                                    const uCost = getItemUnitCost(it);
                                                                                    const rev = Number(it.total) || ((Number(it.unit_price) || 0) * q - (Number(it.discount) || 0));
                                                                                    const cost = uCost * q;
                                                                                    const profit = Math.max(0, rev - cost);
                                                                                    const margin = rev > 0 ? (profit / rev) * 100 : 0;

                                                                                    return (
                                                                                        <tr key={it.item_id || idx} className="hover:bg-gray-50/50 transition">
                                                                                            <td className="py-2.5 px-3 text-gray-400 font-bold">{idx + 1}</td>
                                                                                            <td className="py-2.5 px-3">
                                                                                                <span className="font-bold text-gray-900 block">{it.product_name}</span>
                                                                                                {it.notes && (
                                                                                                    <span className="text-[10px] text-gray-400 italic">{it.notes}</span>
                                                                                                )}
                                                                                            </td>
                                                                                            <td className="py-2.5 px-3">
                                                                                                <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                                                                    {it.batch_number || 'LOT-STANDARD'}
                                                                                                </span>
                                                                                            </td>
                                                                                            <td className="py-2.5 px-3 text-center text-gray-600 font-mono text-[11px]">
                                                                                                {it.expiry_date || '—'}
                                                                                            </td>
                                                                                            <td className="py-2.5 px-3 text-right font-black text-gray-900">
                                                                                                {it.quantity} {it.selling_unit || 'Pcs'}
                                                                                            </td>
                                                                                            <td className="py-2.5 px-3 text-right text-gray-600 font-mono">
                                                                                                KES {uCost.toLocaleString()}
                                                                                            </td>
                                                                                            <td className="py-2.5 px-3 text-right text-gray-800 font-mono font-semibold">
                                                                                                KES {Number(it.unit_price || 0).toLocaleString()}
                                                                                            </td>
                                                                                            <td className="py-2.5 px-3 text-right text-rose-600 font-bold font-mono">
                                                                                                {Number(it.discount || 0) > 0 ? `-KES ${Number(it.discount).toLocaleString()}` : '—'}
                                                                                            </td>
                                                                                            <td className="py-2.5 px-3 text-right font-black text-slate-900 font-mono">
                                                                                                KES {rev.toLocaleString()}
                                                                                            </td>
                                                                                            <td className="py-2.5 px-3 text-right font-mono">
                                                                                                <span className="font-bold text-emerald-700 block">
                                                                                                    +KES {profit.toLocaleString()}
                                                                                                </span>
                                                                                                <span className="text-[10px] text-teal-800 font-semibold">
                                                                                                    ({margin.toFixed(1)}%)
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
                            Showing <strong className="text-gray-900">{filteredSales.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</strong> to{' '}
                            <strong className="text-gray-900">{Math.min(currentPage * pageSize, filteredSales.length)}</strong> of{' '}
                            <strong className="text-gray-900">{filteredSales.length}</strong> transactions
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
                            <span className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-900 font-black rounded-lg">
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
                                                ticks: {
                                                    callback: (val) => `KES ${Number(val).toLocaleString()}`,
                                                    font: { size: 10 },
                                                },
                                            },
                                        },
                                    }}
                                />
                            </div>
                        </div>

                        {/* Payment Breakdown Doughnut */}
                        <div className="bg-white rounded-3xl p-5 border border-gray-200/80 shadow-xs">
                            <h3 className="font-black text-sm text-gray-900 mb-1">Payment Method Share</h3>
                            <p className="text-[11px] text-gray-500 mb-4">Cash vs M-Pesa vs Insurance</p>
                            <div className="h-56 relative flex items-center justify-center">
                                <Doughnut
                                    data={paymentDoughnutData}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: {
                                            legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } },
                                        },
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Secondary Row: Top Drugs Dispensed & Operating Hours */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="bg-white rounded-3xl p-5 border border-gray-200/80 shadow-xs">
                            <h3 className="font-black text-sm text-gray-900 mb-1">Top Dispensed Drugs Velocity</h3>
                            <p className="text-[11px] text-gray-500 mb-4">Ranked by physical units sold</p>
                            <div className="h-60">
                                <Bar
                                    data={topDrugsBarChartData}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: { legend: { display: false } },
                                        scales: {
                                            y: { ticks: { font: { size: 10 } } },
                                            x: { ticks: { font: { size: 9 } } },
                                        },
                                    }}
                                />
                            </div>
                        </div>

                        <div className="bg-white rounded-3xl p-5 border border-gray-200/80 shadow-xs">
                            <h3 className="font-black text-sm text-gray-900 mb-1">Operating Hours Sales Velocity</h3>
                            <p className="text-[11px] text-gray-500 mb-4">Gross sales distributed by clock hour (6 AM - 10 PM)</p>
                            <div className="h-60">
                                <Bar
                                    data={hourlyBarChartData}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: { legend: { display: false } },
                                        scales: {
                                            y: {
                                                ticks: {
                                                    callback: (val) => `KES ${Number(val).toLocaleString()}`,
                                                    font: { size: 10 },
                                                },
                                            },
                                            x: { ticks: { font: { size: 9 } } },
                                        },
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: SALES TRENDS & PEAK HOURS WITH DARK HEADERS */}
            {activeTab === 'trends' && (
                <div className="space-y-4">
                    <div className="bg-white rounded-3xl p-5 border border-gray-200/80 shadow-xs">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="font-black text-sm text-gray-900">Pharmacy Rush Hours Analysis</h3>
                                <p className="text-[11px] text-gray-500">Determine staffing requirements based on customer counter arrivals</p>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead className="bg-slate-900 border-b-2 border-emerald-500 text-white font-black uppercase text-[11px] tracking-wider shadow-sm">
                                    <tr>
                                        <th className="p-3 text-left text-white font-black">Time Slot</th>
                                        <th className="p-3 text-center text-white font-black">Receipts Count</th>
                                        <th className="p-3 text-right text-white font-black">Revenue Generated</th>
                                        <th className="p-3 text-right text-white font-black">% of Total</th>
                                        <th className="p-3 text-center text-white font-black">Traffic Level</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {hourlyData.map((h, i) => {
                                        const pct = financials.revenue > 0 ? (h.revenue / financials.revenue) * 100 : 0;
                                        return (
                                            <tr key={i} className="hover:bg-gray-50">
                                                <td className="p-3 font-mono font-bold text-gray-800">{h.hour} - {String(Number(h.hour.slice(0, 2)) + 1).padStart(2, '0')}:00</td>
                                                <td className="p-3 text-center font-bold text-gray-900">{h.count}</td>
                                                <td className="p-3 text-right font-mono font-black text-emerald-800">KES {h.revenue.toLocaleString()}</td>
                                                <td className="p-3 text-right font-mono text-gray-600">{pct.toFixed(1)}%</td>
                                                <td className="p-3 text-center">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                        h.count >= 10 ? 'bg-rose-100 text-rose-800' : h.count >= 4 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'
                                                    }`}>
                                                        {h.count >= 10 ? '🔥 Heavy Rush' : h.count >= 4 ? '⚡ Moderate' : 'Normal'}
                                                    </span>
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

            {/* TAB 4: FAST-MOVING DRUGS WITH DARK HEADERS */}
            {activeTab === 'fast_moving' && (
                <div className="bg-white rounded-3xl border border-gray-200/80 shadow-xs overflow-hidden">
                    <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                        <div>
                            <h3 className="font-black text-sm text-gray-900">
                                Fast-Moving Drug Velocity &amp; Margin Engine
                            </h3>
                            <p className="text-[11px] text-gray-500">
                                Ranked by units dispensed with profit margins and reorder recommendations
                            </p>
                        </div>
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                            {drugAnalytics.length} Active Catalog Drugs
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-slate-900 border-b-2 border-emerald-500 text-white font-black uppercase text-[11px] tracking-wider shadow-sm">
                                <tr>
                                    <th className="p-3 text-left text-white font-black">#</th>
                                    <th className="p-3 text-left text-white font-black">Medicine Name</th>
                                    <th className="p-3 text-center text-white font-black">Velocity Rank</th>
                                    <th className="p-3 text-right text-white font-black">Units Sold</th>
                                    <th className="p-3 text-right text-white font-black">Revenue (KES)</th>
                                    <th className="p-3 text-right text-white font-black">Cost of Goods</th>
                                    <th className="p-3 text-right text-white font-black">Net Profit</th>
                                    <th className="p-3 text-center text-white font-black">Margin %</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {drugAnalytics.map((d, i) => (
                                    <tr key={i} className="hover:bg-gray-50">
                                        <td className="p-3 text-gray-400 font-bold">{i + 1}</td>
                                        <td className="p-3 font-bold text-gray-900">{d.name}</td>
                                        <td className="p-3 text-center">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                                d.velocityRank === 'Ultra High'
                                                    ? 'bg-rose-100 text-rose-800'
                                                    : d.velocityRank === 'High'
                                                    ? 'bg-amber-100 text-amber-800'
                                                    : 'bg-emerald-100 text-emerald-800'
                                            }`}>
                                                {d.velocityRank}
                                            </span>
                                        </td>
                                        <td className="p-3 text-right font-black text-gray-900">{d.qty}</td>
                                        <td className="p-3 text-right font-black font-mono text-gray-900">
                                            KES {d.revenue.toLocaleString()}
                                        </td>
                                        <td className="p-3 text-right font-mono text-gray-600">
                                            KES {d.cogs.toLocaleString()}
                                        </td>
                                        <td className="p-3 text-right font-black font-mono text-emerald-700">
                                            +KES {d.profit.toLocaleString()}
                                        </td>
                                        <td className="p-3 text-center">
                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                                d.marginPct >= 30 ? 'bg-emerald-100 text-emerald-800' :
                                                d.marginPct >= 15 ? 'bg-amber-100 text-amber-800' :
                                                'bg-rose-100 text-rose-800'
                                            }`}>
                                                {d.marginPct}%
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 5: M-PESA DEDICATED AUDIT LEDGER WITH DARK HEADERS */}
            {activeTab === 'mpesa' && (
                <div className="bg-white rounded-3xl border border-gray-200/80 shadow-xs overflow-hidden">
                    <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                        <div>
                            <h3 className="font-black text-sm text-gray-900">
                                M-Pesa &amp; Mobile Money Reconciliation Register
                            </h3>
                            <p className="text-[11px] text-gray-500">
                                Verify Safaricom Till / Paybill confirmation codes against dispensary sales
                            </p>
                        </div>
                        <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800">
                            KES {financials.mpesa.toLocaleString()} Total
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-slate-900 border-b-2 border-emerald-500 text-white font-black uppercase text-[11px] tracking-wider shadow-sm">
                                <tr>
                                    <th className="p-3 text-left text-white font-black">#</th>
                                    <th className="p-3 text-left text-white font-black">M-Pesa Code</th>
                                    <th className="p-3 text-left text-white font-black">Receipt #</th>
                                    <th className="p-3 text-left text-white font-black">Patient / Customer</th>
                                    <th className="p-3 text-left text-white font-black">Phone</th>
                                    <th className="p-3 text-left text-white font-black">Timestamp</th>
                                    <th className="p-3 text-right text-white font-black">M-Pesa Amount</th>
                                    <th className="p-3 text-center text-white font-black">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {mpesaSales.map((s, i) => (
                                    <tr key={s.sale_id} className="hover:bg-gray-50">
                                        <td className="p-3 text-gray-400 font-bold">{i + 1}</td>
                                        <td className="p-3">
                                            <span className="px-2.5 py-1 rounded-md font-mono font-black text-xs bg-emerald-50 text-emerald-800 border border-emerald-200">
                                                {s.mpesa_receipt || 'AUTO-CONFIRMED'}
                                            </span>
                                        </td>
                                        <td className="p-3 font-mono font-bold text-gray-900">{s.receipt_no}</td>
                                        <td className="p-3 font-medium text-gray-900">{s.customer_name || 'Walk-in Patient'}</td>
                                        <td className="p-3 font-mono text-gray-600">{s.customer_phone || '—'}</td>
                                        <td className="p-3 text-gray-600">{new Date(s.sale_datetime).toLocaleString('en-KE')}</td>
                                        <td className="p-3 text-right font-black font-mono text-emerald-800 text-sm">
                                            KES {Number(s.split_mpesa || s.total).toLocaleString()}
                                        </td>
                                        <td className="p-3 text-center">
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                                ✓ Settled
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 6: INSURANCE CLAIMS WITH DARK HEADERS */}
            {activeTab === 'insurance' && (
                <div className="bg-white rounded-3xl border border-gray-200/80 shadow-xs overflow-hidden">
                    <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                        <div>
                            <h3 className="font-black text-sm text-gray-900">
                                Insurance &amp; Corporate Copay Claims Ledger
                            </h3>
                            <p className="text-[11px] text-gray-500">
                                Track invoice claims awaiting remittance by medical underwriters
                            </p>
                        </div>
                        <span className="px-3 py-1 rounded-full text-xs font-black bg-purple-100 text-purple-800">
                            KES {financials.insurance.toLocaleString()} Claims
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-slate-900 border-b-2 border-emerald-500 text-white font-black uppercase text-[11px] tracking-wider shadow-sm">
                                <tr>
                                    <th className="p-3 text-left text-white font-black">#</th>
                                    <th className="p-3 text-left text-white font-black">Receipt #</th>
                                    <th className="p-3 text-left text-white font-black">Patient Name</th>
                                    <th className="p-3 text-left text-white font-black">Insurance Scheme</th>
                                    <th className="p-3 text-left text-white font-black">Claim Ref</th>
                                    <th className="p-3 text-right text-white font-black">Claim Amount</th>
                                    <th className="p-3 text-right text-white font-black">Cash Copay</th>
                                    <th className="p-3 text-center text-white font-black">Claim Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {insuranceSales.map((s, i) => (
                                    <tr key={s.sale_id} className="hover:bg-gray-50">
                                        <td className="p-3 text-gray-400 font-bold">{i + 1}</td>
                                        <td className="p-3 font-mono font-bold text-gray-900">{s.receipt_no}</td>
                                        <td className="p-3 font-bold text-gray-900">{s.customer_name || 'Insured Client'}</td>
                                        <td className="p-3 font-semibold text-purple-900">
                                            {s.split_insurance_name || 'Standard Medical Insurance'}
                                        </td>
                                        <td className="p-3 font-mono text-gray-600">{s.insurance_ref || 'CLM-' + s.sale_id}</td>
                                        <td className="p-3 text-right font-black font-mono text-purple-800">
                                            KES {Number(s.split_insurance || s.total).toLocaleString()}
                                        </td>
                                        <td className="p-3 text-right font-mono text-gray-700">
                                            KES {Number(s.split_cash || 0).toLocaleString()}
                                        </td>
                                        <td className="p-3 text-center">
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                                Pending Dispatch
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 7: CASHIERS AUDIT WITH DARK HEADERS */}
            {activeTab === 'cashier' && (
                <div className="bg-white rounded-3xl border border-gray-200/80 shadow-xs overflow-hidden">
                    <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                        <div>
                            <h3 className="font-black text-sm text-gray-900">
                                Cashier &amp; Pharmacist Shift Audits
                            </h3>
                            <p className="text-[11px] text-gray-500">
                                Accountability register for counter staff and dispensary operators
                            </p>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-slate-900 border-b-2 border-emerald-500 text-white font-black uppercase text-[11px] tracking-wider shadow-sm">
                                <tr>
                                    <th className="p-3 text-left text-white font-black">#</th>
                                    <th className="p-3 text-left text-white font-black">Cashier / Pharmacist</th>
                                    <th className="p-3 text-center text-white font-black">Receipts Handled</th>
                                    <th className="p-3 text-right text-white font-black">Cash Collected</th>
                                    <th className="p-3 text-right text-white font-black">M-Pesa Collected</th>
                                    <th className="p-3 text-right text-white font-black">Total Shift Turnout</th>
                                    <th className="p-3 text-right text-white font-black">Average Ticket</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {cashierAnalytics.map((c, i) => (
                                    <tr key={i} className="hover:bg-gray-50">
                                        <td className="p-3 text-gray-400 font-bold">{i + 1}</td>
                                        <td className="p-3 font-bold text-gray-900">{c.name}</td>
                                        <td className="p-3 text-center font-bold text-gray-800">{c.count}</td>
                                        <td className="p-3 text-right font-mono text-amber-700">KES {c.cash.toLocaleString()}</td>
                                        <td className="p-3 text-right font-mono text-emerald-700">KES {c.mpesa.toLocaleString()}</td>
                                        <td className="p-3 text-right font-black font-mono text-gray-900 text-sm">
                                            KES {c.total.toLocaleString()}
                                        </td>
                                        <td className="p-3 text-right font-mono text-gray-600">KES {c.avgTicket.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 8: DEEP METRICS */}
            {activeTab === 'metrics' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-xs">
                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Average Transaction Value</span>
                            <span className="text-xl font-black text-gray-900 mt-1 block">
                                KES {financials.avgTicket.toLocaleString()}
                            </span>
                        </div>

                        <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-xs">
                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Total Customer Discounts</span>
                            <span className="text-xl font-black text-rose-600 mt-1 block">
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
                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Net Gross Profit Margin %</span>
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
