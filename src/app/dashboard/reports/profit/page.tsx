'use client';

// =====================================================================
// Alpha Pharmacy - Super Ultra Massive World-Class Profit & Margin Intelligence Hub v5.5
// Realtime Live Database Sync, Multi-tier Retail/Pharmacy Fallback, True COGS Engine,
// Linear Trend Charts, Category Contribution, Cashier ROI, Returns Safeguard,
// High-Contrast Dark Headers, Super Premium Light Cards, Professional Excel & PDF Audit
// =====================================================================

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import { useCompanyName } from '@/context/SettingsContext';
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

// ==================== DATA INTERFACES ====================
export interface ProductProfitRow {
    product_id: number;
    product_name: string;
    product_code: string;
    category: string;
    units_sold: number;
    sales_unit: string;
    purchase_unit: string;
    pieces_per_package: number;
    avg_sell_price: number;
    unit_cost: number;
    total_revenue: number;
    total_cogs: number;
    gross_profit: number;
    margin_pct: number;
    tx_count: number;
    last_sale_date: string;
}

export interface SaleTxItem {
    item_id: number;
    sale_id: number;
    product_id: number;
    product_name: string;
    quantity: number;
    unit_price: number;
    total: number;
    purchase_price?: number;
    unit_cost: number;
    cogs: number;
    profit: number;
    margin_pct: number;
}

export interface SaleTx {
    sale_id: number;
    receipt_no: string;
    sale_datetime: string;
    payment_method: string;
    cashier_name: string;
    customer_name: string;
    total_amount: number;
    paid_amount: number;
    discount: number;
    tax: number;
    outlet_id: number;
    cogs: number;
    profit: number;
    margin_pct: number;
    items: SaleTxItem[];
}

export interface DailyProfitRow {
    date: string;
    display_date: string;
    revenue: number;
    cogs: number;
    profit: number;
    margin_pct: number;
    tx_count: number;
    units_sold: number;
}

export interface CategoryProfitRow {
    category: string;
    revenue: number;
    cogs: number;
    profit: number;
    margin_pct: number;
    units_sold: number;
    product_count: number;
}

export interface CashierProfitRow {
    cashier_name: string;
    tx_count: number;
    revenue: number;
    cogs: number;
    profit: number;
    margin_pct: number;
    avg_basket_profit: number;
}

export default function ProfitReportPage() {
    const { activeOutlet } = useOutlet();
    const companyName = useCompanyName() || 'Alpha Pharmacy';
    const outletId = activeOutlet?.outlet_id || 1;

    // Filters and state
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'categories' | 'daily' | 'transactions' | 'cashiers'>('overview');

    const [preset, setPreset] = useState<string>('month');
    const [dateFrom, setDateFrom] = useState<string>(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    });
    const [dateTo, setDateTo] = useState<string>(() => new Date().toISOString().split('T')[0]);

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [selectedCashier, setSelectedCashier] = useState('All');
    const [marginFilter, setMarginFilter] = useState<'All' | 'High' | 'Healthy' | 'Low' | 'Loss'>('All');
    const [sortBy, setSortBy] = useState<'profit_desc' | 'profit_asc' | 'margin_desc' | 'margin_asc' | 'revenue_desc' | 'qty_desc'>('profit_desc');

    // Pagination
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [expandedTxId, setExpandedTxId] = useState<number | null>(null);
    const [expandedProductId, setExpandedProductId] = useState<number | null>(null);

    // Master Aggregates
    const [productRows, setProductRows] = useState<ProductProfitRow[]>([]);
    const [transactions, setTransactions] = useState<SaleTx[]>([]);
    const [dailyRows, setDailyRows] = useState<DailyProfitRow[]>([]);
    const [categoryRows, setCategoryRows] = useState<CategoryProfitRow[]>([]);
    const [cashierRows, setCashierRows] = useState<CashierProfitRow[]>([]);
    const [totalReturnsAmount, setTotalReturnsAmount] = useState<number>(0);
    const [totalReturnsCount, setTotalReturnsCount] = useState<number>(0);
    const [categoriesList, setCategoriesList] = useState<string[]>([]);
    const [cashiersList, setCashiersList] = useState<string[]>([]);

    // Date Presets Handler
    const handlePresetChange = (p: string) => {
        setPreset(p);
        const now = new Date();
        const formatYMD = (d: Date) => d.toISOString().split('T')[0];
        const todayStr = formatYMD(now);

        if (p === 'today') {
            setDateFrom(todayStr);
            setDateTo(todayStr);
        } else if (p === 'yesterday') {
            const y = new Date();
            y.setDate(y.getDate() - 1);
            const yStr = formatYMD(y);
            setDateFrom(yStr);
            setDateTo(yStr);
        } else if (p === '7d') {
            const d = new Date();
            d.setDate(d.getDate() - 6);
            setDateFrom(formatYMD(d));
            setDateTo(todayStr);
        } else if (p === 'month') {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            setDateFrom(formatYMD(startOfMonth));
            setDateTo(todayStr);
        } else if (p === 'last_month') {
            const startOfLast = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const endOfLast = new Date(now.getFullYear(), now.getMonth(), 0);
            setDateFrom(formatYMD(startOfLast));
            setDateTo(formatYMD(endOfLast));
        } else if (p === '90d') {
            const d = new Date();
            d.setDate(d.getDate() - 89);
            setDateFrom(formatYMD(d));
            setDateTo(todayStr);
        } else if (p === 'all') {
            setDateFrom('2024-01-01');
            setDateTo(todayStr);
        }
    };

    // ==================== CORE PROFIT ENGINE ====================
    const fetchProfitData = useCallback(async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        else setRefreshing(true);

        try {
            // Step 1: Catalog lookup with retail_products fallback
            let catalog: any[] = [];
            const { data: pProds } = await supabase
                .from('pharmacy_products')
                .select('pid, product_name, product_code, purchase_cost, sales_cost, pieces_per_package, category, sales_unit, purchase_unit');

            if (pProds && pProds.length > 0) {
                catalog = pProds;
            } else {
                const { data: rProds } = await supabase
                    .from('retail_products')
                    .select('pid, product_name, product_code, purchase_cost, sales_cost, pieces_per_package, category, sales_unit, purchase_unit');
                if (rProds) catalog = rProds;
            }

            // Also check pharmacy_batches for exact batch unit costs
            const { data: batchesData } = await supabase
                .from('pharmacy_batches')
                .select('product_id, purchase_cost, selling_price, remaining_qty');

            const batchCostMap: Record<number, number> = {};
            (batchesData || []).forEach((b: any) => {
                if (b.product_id && b.purchase_cost && b.purchase_cost > 0) {
                    if (!batchCostMap[b.product_id] || b.purchase_cost < batchCostMap[b.product_id]) {
                        batchCostMap[b.product_id] = Number(b.purchase_cost);
                    }
                }
            });

            const prodMap: Record<number, {
                name: string;
                code: string;
                category: string;
                unit_cost: number;
                sell_price: number;
                pieces: number;
                sales_unit: string;
                purchase_unit: string;
            }> = {};

            catalog.forEach((p: any) => {
                const pieces = Number(p.pieces_per_package) || 1;
                const rawCost = Number(p.purchase_cost) || 0;
                let unitCost = rawCost > 0 ? (pieces > 1 ? rawCost / pieces : rawCost) : 0;
                if (unitCost === 0 && batchCostMap[p.pid]) {
                    unitCost = batchCostMap[p.pid];
                }

                prodMap[p.pid] = {
                    name: p.product_name || `Drug #${p.pid}`,
                    code: p.product_code || `DRG-${String(p.pid).padStart(4, '0')}`,
                    category: p.category || 'General',
                    unit_cost: unitCost,
                    sell_price: Number(p.sales_cost) || 0,
                    pieces: pieces,
                    sales_unit: p.sales_unit || 'Piece',
                    purchase_unit: p.purchase_unit || 'Box',
                };
            });

            // Step 2: Fetch Sales within date range
            let salesQuery = supabase
                .from('pharmacy_sales')
                .select('*')
                .gte('sale_datetime', `${dateFrom}T00:00:00`)
                .lte('sale_datetime', `${dateTo}T23:59:59`)
                .order('sale_datetime', { ascending: false });

            if (outletId) {
                salesQuery = salesQuery.eq('outlet_id', outletId);
            }

            const { data: salesList, error: sErr } = await salesQuery;
            if (sErr) throw sErr;

            const sales = salesList || [];
            const saleIds = sales.map((s: any) => s.sale_id);

            // Step 3: Fetch sales items in chunks of 400
            let allItems: any[] = [];
            if (saleIds.length > 0) {
                for (let i = 0; i < saleIds.length; i += 400) {
                    const chunk = saleIds.slice(i, i + 400);
                    const { data: chunkItems, error: itmErr } = await supabase
                        .from('pharmacy_sales_items')
                        .select('*')
                        .in('sale_id', chunk)
                        .order('item_id', { ascending: true });
                    if (itmErr) throw itmErr;
                    if (chunkItems) allItems.push(...chunkItems);
                }
            }

            // Step 4: Fetch sales returns in date range
            let returnsQuery = supabase
                .from('sales_returns')
                .select('*')
                .gte('return_date', dateFrom)
                .lte('return_date', dateTo);

            const { data: returnsList } = await returnsQuery;
            const validReturns = (returnsList || []).filter((r: any) => r.status !== 'Rejected');
            const totalRetVal = validReturns.reduce((sum: number, r: any) => sum + (Number(r.total_amount) || 0), 0);
            setTotalReturnsAmount(totalRetVal);
            setTotalReturnsCount(validReturns.length);

            // Group items by sale_id
            const itemsBySaleId: Record<number, any[]> = {};
            allItems.forEach((itm: any) => {
                if (!itemsBySaleId[itm.sale_id]) itemsBySaleId[itm.sale_id] = [];
                itemsBySaleId[itm.sale_id].push(itm);
            });

            // Step 5: Build Transformed Sales Transactions
            const txList: SaleTx[] = [];
            sales.forEach((s: any) => {
                const sItems = itemsBySaleId[s.sale_id] || [];
                let sCogs = 0;
                let sRevenue = 0;

                const processedItems: SaleTxItem[] = sItems.map((itm: any) => {
                    const pid = Number(itm.product_id);
                    const prod = prodMap[pid];
                    const qty = Number(itm.quantity) || 1;
                    const itmRev = Number(itm.total) || (Number(itm.unit_price) * qty) || 0;

                    // True unit cost logic
                    let uCost = 0;
                    if (itm.purchase_price && Number(itm.purchase_price) > 0) {
                        uCost = Number(itm.purchase_price);
                    } else if (prod && prod.unit_cost > 0) {
                        uCost = prod.unit_cost;
                    } else if (Number(itm.unit_price) > 0) {
                        // Fallback reasonable pharmaceutical cost (70% of retail price)
                        uCost = Number(itm.unit_price) * 0.7;
                    }

                    const itmCogs = uCost * qty;
                    const itmProfit = itmRev - itmCogs;
                    const itmMargin = itmRev > 0 ? (itmProfit / itmRev) * 100 : 0;

                    sCogs += itmCogs;
                    sRevenue += itmRev;

                    return {
                        item_id: itm.item_id || Math.random(),
                        sale_id: s.sale_id,
                        product_id: pid,
                        product_name: itm.product_name || prod?.name || 'Drug Item',
                        quantity: qty,
                        unit_price: Number(itm.unit_price) || 0,
                        total: itmRev,
                        purchase_price: itm.purchase_price,
                        unit_cost: uCost,
                        cogs: itmCogs,
                        profit: itmProfit,
                        margin_pct: itmMargin,
                    };
                });

                const txTotal = Number(s.total_amount) || sRevenue;
                const txProfit = txTotal - sCogs;
                const txMargin = txTotal > 0 ? (txProfit / txTotal) * 100 : 0;

                txList.push({
                    sale_id: s.sale_id,
                    receipt_no: s.receipt_no || `RX-${String(s.sale_id).padStart(5, '0')}`,
                    sale_datetime: s.sale_datetime || s.created_at || new Date().toISOString(),
                    payment_method: s.payment_method || 'CASH',
                    cashier_name: s.cashier_name || 'Admin',
                    customer_name: s.customer_name || 'Walk-in Patient',
                    total_amount: txTotal,
                    paid_amount: Number(s.paid_amount) || txTotal,
                    discount: Number(s.discount) || 0,
                    tax: Number(s.tax) || 0,
                    outlet_id: s.outlet_id || 1,
                    cogs: sCogs,
                    profit: txProfit,
                    margin_pct: txMargin,
                    items: processedItems,
                });
            });

            setTransactions(txList);

            // Step 6: Build Product Profitability Rows
            const productAggMap = new Map<string, ProductProfitRow>();

            txList.forEach((tx) => {
                tx.items.forEach((itm) => {
                    const pid = itm.product_id;
                    const prod = prodMap[pid];
                    const key = `${pid}_${itm.product_name}`;

                    if (!productAggMap.has(key)) {
                        productAggMap.set(key, {
                            product_id: pid,
                            product_name: itm.product_name || prod?.name || 'Drug',
                            product_code: prod?.code || `DRG-${pid}`,
                            category: prod?.category || 'General',
                            units_sold: 0,
                            sales_unit: prod?.sales_unit || 'Piece',
                            purchase_unit: prod?.purchase_unit || 'Box',
                            pieces_per_package: prod?.pieces || 1,
                            avg_sell_price: 0,
                            unit_cost: itm.unit_cost,
                            total_revenue: 0,
                            total_cogs: 0,
                            gross_profit: 0,
                            margin_pct: 0,
                            tx_count: 0,
                            last_sale_date: tx.sale_datetime,
                        });
                    }

                    const pRow = productAggMap.get(key)!;
                    pRow.units_sold += itm.quantity;
                    pRow.total_revenue += itm.total;
                    pRow.total_cogs += itm.cogs;
                    pRow.tx_count += 1;
                    if (new Date(tx.sale_datetime) > new Date(pRow.last_sale_date)) {
                        pRow.last_sale_date = tx.sale_datetime;
                    }
                });
            });

            const calculatedProds: ProductProfitRow[] = Array.from(productAggMap.values()).map((p) => {
                const profit = p.total_revenue - p.total_cogs;
                const margin = p.total_revenue > 0 ? (profit / p.total_revenue) * 100 : 0;
                const avgPrice = p.units_sold > 0 ? p.total_revenue / p.units_sold : 0;
                return {
                    ...p,
                    avg_sell_price: avgPrice,
                    gross_profit: profit,
                    margin_pct: margin,
                };
            });

            setProductRows(calculatedProds);

            // Step 7: Build Daily Aggregates
            const dailyMap = new Map<string, DailyProfitRow>();
            txList.forEach((tx) => {
                const dKey = tx.sale_datetime.split('T')[0];
                if (!dailyMap.has(dKey)) {
                    const dObj = new Date(dKey);
                    const display = dObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                    dailyMap.set(dKey, {
                        date: dKey,
                        display_date: display,
                        revenue: 0,
                        cogs: 0,
                        profit: 0,
                        margin_pct: 0,
                        tx_count: 0,
                        units_sold: 0,
                    });
                }
                const dRow = dailyMap.get(dKey)!;
                dRow.revenue += tx.total_amount;
                dRow.cogs += tx.cogs;
                dRow.tx_count += 1;
                dRow.units_sold += tx.items.reduce((sum, itm) => sum + itm.quantity, 0);
            });

            const calculatedDaily: DailyProfitRow[] = Array.from(dailyMap.values())
                .map((d) => {
                    const prof = d.revenue - d.cogs;
                    const marg = d.revenue > 0 ? (prof / d.revenue) * 100 : 0;
                    return { ...d, profit: prof, margin_pct: marg };
                })
                .sort((a, b) => b.date.localeCompare(a.date));

            setDailyRows(calculatedDaily);

            // Step 8: Build Category Aggregates
            const categoryMap = new Map<string, CategoryProfitRow>();
            calculatedProds.forEach((p) => {
                const catKey = p.category || 'General';
                if (!categoryMap.has(catKey)) {
                    categoryMap.set(catKey, {
                        category: catKey,
                        revenue: 0,
                        cogs: 0,
                        profit: 0,
                        margin_pct: 0,
                        units_sold: 0,
                        product_count: 0,
                    });
                }
                const cRow = categoryMap.get(catKey)!;
                cRow.revenue += p.total_revenue;
                cRow.cogs += p.total_cogs;
                cRow.units_sold += p.units_sold;
                cRow.product_count += 1;
            });

            const calculatedCategories: CategoryProfitRow[] = Array.from(categoryMap.values()).map((c) => {
                const prof = c.revenue - c.cogs;
                const marg = c.revenue > 0 ? (prof / c.revenue) * 100 : 0;
                return { ...c, profit: prof, margin_pct: marg };
            }).sort((a, b) => b.profit - a.profit);

            setCategoryRows(calculatedCategories);

            // Step 9: Build Cashier Aggregates
            const cashierMap = new Map<string, CashierProfitRow>();
            txList.forEach((tx) => {
                const cName = tx.cashier_name || 'Staff Dispenser';
                if (!cashierMap.has(cName)) {
                    cashierMap.set(cName, {
                        cashier_name: cName,
                        tx_count: 0,
                        revenue: 0,
                        cogs: 0,
                        profit: 0,
                        margin_pct: 0,
                        avg_basket_profit: 0,
                    });
                }
                const cRow = cashierMap.get(cName)!;
                cRow.tx_count += 1;
                cRow.revenue += tx.total_amount;
                cRow.cogs += tx.cogs;
            });

            const calculatedCashiers: CashierProfitRow[] = Array.from(cashierMap.values()).map((c) => {
                const prof = c.revenue - c.cogs;
                const marg = c.revenue > 0 ? (prof / c.revenue) * 100 : 0;
                const avgProf = c.tx_count > 0 ? prof / c.tx_count : 0;
                return { ...c, profit: prof, margin_pct: marg, avg_basket_profit: avgProf };
            }).sort((a, b) => b.profit - a.profit);

            setCashierRows(calculatedCashiers);

            // Unique categories & cashiers for filters
            const cats = Array.from(new Set(calculatedProds.map((p) => p.category))).filter(Boolean).sort();
            setCategoriesList(cats);
            const cashs = Array.from(new Set(txList.map((t) => t.cashier_name))).filter(Boolean).sort();
            setCashiersList(cashs);

        } catch (err: any) {
            console.error('Failed to load profit intelligence data:', err);
            toast.error(err.message || 'Error compiling financial profit ledger');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [dateFrom, dateTo, outletId]);

    // Initial load & date changes
    useEffect(() => {
        fetchProfitData();
    }, [fetchProfitData]);

    // Realtime Supabase Subscription
    useEffect(() => {
        const channel = supabase
            .channel('profit-intelligence-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pharmacy_sales' }, () => {
                fetchProfitData(true);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_returns' }, () => {
                fetchProfitData(true);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchProfitData]);

    // ==================== FILTERING & SORTING ====================
    const filteredProducts = useMemo(() => {
        return productRows.filter((p) => {
            const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
            const matchesSearch = !searchQuery ||
                p.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.product_code.toLowerCase().includes(searchQuery.toLowerCase());

            let matchesMargin = true;
            if (marginFilter === 'High') matchesMargin = p.margin_pct >= 35;
            else if (marginFilter === 'Healthy') matchesMargin = p.margin_pct >= 15 && p.margin_pct < 35;
            else if (marginFilter === 'Low') matchesMargin = p.margin_pct >= 0 && p.margin_pct < 15;
            else if (marginFilter === 'Loss') matchesMargin = p.margin_pct < 0;

            return matchesCat && matchesSearch && matchesMargin;
        }).sort((a, b) => {
            if (sortBy === 'profit_desc') return b.gross_profit - a.gross_profit;
            if (sortBy === 'profit_asc') return a.gross_profit - b.gross_profit;
            if (sortBy === 'margin_desc') return b.margin_pct - a.margin_pct;
            if (sortBy === 'margin_asc') return a.margin_pct - b.margin_pct;
            if (sortBy === 'revenue_desc') return b.total_revenue - a.total_revenue;
            if (sortBy === 'qty_desc') return b.units_sold - a.units_sold;
            return b.gross_profit - a.gross_profit;
        });
    }, [productRows, selectedCategory, searchQuery, marginFilter, sortBy]);

    const filteredTransactions = useMemo(() => {
        return transactions.filter((tx) => {
            const matchesCashier = selectedCashier === 'All' || tx.cashier_name === selectedCashier;
            const matchesSearch = !searchQuery ||
                tx.receipt_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
                tx.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                tx.items.some((itm) => itm.product_name.toLowerCase().includes(searchQuery.toLowerCase()));

            return matchesCashier && matchesSearch;
        });
    }, [transactions, selectedCashier, searchQuery]);

    // Summary Totals
    const totalGrossRevenue = useMemo(() => transactions.reduce((sum, tx) => sum + tx.total_amount, 0), [transactions]);
    const totalCOGS = useMemo(() => transactions.reduce((sum, tx) => sum + tx.cogs, 0), [transactions]);
    const netRevenue = useMemo(() => Math.max(0, totalGrossRevenue - totalReturnsAmount), [totalGrossRevenue, totalReturnsAmount]);
    const totalGrossProfit = useMemo(() => netRevenue - totalCOGS, [netRevenue, totalCOGS]);
    const overallMarginPct = useMemo(() => netRevenue > 0 ? (totalGrossProfit / netRevenue) * 100 : 0, [netRevenue, totalGrossProfit]);
    const totalUnitsSold = useMemo(() => productRows.reduce((sum, p) => sum + p.units_sold, 0), [productRows]);
    const avgProfitPerTx = useMemo(() => transactions.length > 0 ? totalGrossProfit / transactions.length : 0, [transactions, totalGrossProfit]);

    // ==================== VISUAL CHARTS CONFIGURATION ====================
    // 1. Linear Profit & Revenue Trend Chart
    const linearTrendChartData = useMemo(() => {
        const sortedDaily = [...dailyRows].reverse();
        const labels = sortedDaily.map((d) => d.display_date);
        const revenueData = sortedDaily.map((d) => d.revenue);
        const cogsData = sortedDaily.map((d) => d.cogs);
        const profitData = sortedDaily.map((d) => d.profit);

        return {
            labels,
            datasets: [
                {
                    label: 'Net Revenue (KES)',
                    data: revenueData,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.08)',
                    tension: 0.35,
                    borderWidth: 2.5,
                    pointBackgroundColor: '#10b981',
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    fill: true,
                },
                {
                    label: 'Cost of Goods Sold (COGS)',
                    data: cogsData,
                    borderColor: '#64748b',
                    backgroundColor: 'transparent',
                    borderDash: [5, 5],
                    tension: 0.35,
                    borderWidth: 2,
                    pointBackgroundColor: '#64748b',
                    pointRadius: 3,
                },
                {
                    label: 'Gross Profit Realized (KES)',
                    data: profitData,
                    borderColor: '#06b6d4',
                    backgroundColor: 'rgba(6, 182, 212, 0.15)',
                    tension: 0.35,
                    borderWidth: 3,
                    pointBackgroundColor: '#06b6d4',
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    fill: true,
                },
            ],
        };
    }, [dailyRows]);

    // 2. Top 10 Most Profitable Drugs Horizontal Bar
    const topProfitableChartData = useMemo(() => {
        const top10 = [...productRows].sort((a, b) => b.gross_profit - a.gross_profit).slice(0, 10);
        return {
            labels: top10.map((p) => p.product_name.length > 18 ? p.product_name.substring(0, 18) + '...' : p.product_name),
            datasets: [
                {
                    label: 'Gross Profit (KES)',
                    data: top10.map((p) => Math.round(p.gross_profit)),
                    backgroundColor: 'rgba(16, 185, 129, 0.85)',
                    borderRadius: 6,
                    hoverBackgroundColor: '#059669',
                },
                {
                    label: 'COGS Outlay (KES)',
                    data: top10.map((p) => Math.round(p.total_cogs)),
                    backgroundColor: 'rgba(100, 116, 139, 0.45)',
                    borderRadius: 6,
                    hoverBackgroundColor: '#475569',
                },
            ],
        };
    }, [productRows]);

    // 3. Category Profit Contribution Bar
    const categoryBarChartData = useMemo(() => {
        const topCats = [...categoryRows].slice(0, 8);
        return {
            labels: topCats.map((c) => c.category),
            datasets: [
                {
                    label: 'Revenue (KES)',
                    data: topCats.map((c) => Math.round(c.revenue)),
                    backgroundColor: 'rgba(14, 165, 233, 0.8)',
                    borderRadius: 6,
                },
                {
                    label: 'Net Profit (KES)',
                    data: topCats.map((c) => Math.round(c.profit)),
                    backgroundColor: 'rgba(16, 185, 129, 0.9)',
                    borderRadius: 6,
                },
            ],
        };
    }, [categoryRows]);

    // 4. Margin Health Distribution Doughnut
    const marginHealthDoughnutData = useMemo(() => {
        let high = 0;
        let healthy = 0;
        let low = 0;
        let loss = 0;

        productRows.forEach((p) => {
            if (p.margin_pct >= 35) high++;
            else if (p.margin_pct >= 15) healthy++;
            else if (p.margin_pct >= 0) low++;
            else loss++;
        });

        return {
            labels: ['High Margin (>35%)', 'Healthy (15-35%)', 'Low Margin (0-15%)', 'Loss / At Cost (<0%)'],
            datasets: [
                {
                    data: [high, healthy, low, loss],
                    backgroundColor: ['#10b981', '#06b6d4', '#f59e0b', '#f43f5e'],
                    borderWidth: 2,
                    borderColor: '#ffffff',
                    hoverOffset: 6,
                },
            ],
        };
    }, [productRows]);

    // ==================== EXPORT UTILITIES ====================
    const exportExcelXLS = () => {
        try {
            const tableHeaders = ['Product Name', 'Category', 'Code', 'Units Sold', 'Avg Sell Price (KES)', 'Unit Cost (KES)', 'Gross Revenue (KES)', 'Total COGS (KES)', 'Net Profit (KES)', 'Margin %', 'Last Sale Date'];
            const rowsXML = filteredProducts.map((p) => `
                <Row>
                    <Cell><Data ss:Type="String">${p.product_name.replace(/&/g, '&amp;')}</Data></Cell>
                    <Cell><Data ss:Type="String">${p.category.replace(/&/g, '&amp;')}</Data></Cell>
                    <Cell><Data ss:Type="String">${p.product_code}</Data></Cell>
                    <Cell><Data ss:Type="Number">${p.units_sold}</Data></Cell>
                    <Cell><Data ss:Type="Number">${p.avg_sell_price.toFixed(2)}</Data></Cell>
                    <Cell><Data ss:Type="Number">${p.unit_cost.toFixed(2)}</Data></Cell>
                    <Cell><Data ss:Type="Number">${p.total_revenue.toFixed(2)}</Data></Cell>
                    <Cell><Data ss:Type="Number">${p.total_cogs.toFixed(2)}</Data></Cell>
                    <Cell><Data ss:Type="Number">${p.gross_profit.toFixed(2)}</Data></Cell>
                    <Cell><Data ss:Type="String">${p.margin_pct.toFixed(1)}%</Data></Cell>
                    <Cell><Data ss:Type="String">${p.last_sale_date ? p.last_sale_date.split('T')[0] : 'N/A'}</Data></Cell>
                </Row>
            `).join('');

            const excelXML = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Header">
   <Font ss:Bold="1" ss:Color="#FFFFFF" ss:Size="11"/>
   <Interior ss:Color="#0F172A" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="Title">
   <Font ss:Bold="1" ss:Size="16" ss:Color="#0F172A"/>
  </Style>
  <Style ss:ID="Summary">
   <Font ss:Bold="1" ss:Color="#0F172A"/>
   <Interior ss:Color="#ECFDF5" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Profit Intelligence">
  <Table>
   <Row>
    <Cell ss:StyleID="Title"><Data ss:Type="String">${companyName} - Executive Profit &amp; Margin Ledger</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">Period: ${dateFrom} to ${dateTo} | Generated: ${new Date().toLocaleString()}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="Summary"><Data ss:Type="String">Net Revenue: KES ${netRevenue.toLocaleString()}</Data></Cell>
    <Cell ss:StyleID="Summary"><Data ss:Type="String">Total COGS: KES ${totalCOGS.toLocaleString()}</Data></Cell>
    <Cell ss:StyleID="Summary"><Data ss:Type="String">Gross Profit: KES ${totalGrossProfit.toLocaleString()} (${overallMarginPct.toFixed(1)}%)</Data></Cell>
    <Cell ss:StyleID="Summary"><Data ss:Type="String">Returns Deducted: KES ${totalReturnsAmount.toLocaleString()}</Data></Cell>
   </Row>
   <Row></Row>
   <Row ss:StyleID="Header">
    ${tableHeaders.map((h) => `<Cell><Data ss:Type="String">${h}</Data></Cell>`).join('')}
   </Row>
   ${rowsXML}
  </Table>
 </Worksheet>
</Workbook>`;

            const blob = new Blob([excelXML], { type: 'application/vnd.ms-excel' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `AlphaPharmacy_Profit_Ledger_${dateFrom}_to_${dateTo}.xls`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success('Executive Profit Ledger exported (.xls)!');
        } catch (e: any) {
            toast.error('Failed to export Excel: ' + e.message);
        }
    };

    const printAuditReport = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            toast.error('Please allow popups to print report');
            return;
        }

        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8"/>
    <title>Executive Profit & Margin Audit - ${companyName}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 18mm; color: #0f172a; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #10b981; padding-bottom: 12px; margin-bottom: 18px; }
        .title { font-size: 22px; font-weight: 800; color: #0f172a; margin: 0; }
        .subtitle { font-size: 12px; color: #64748b; margin-top: 4px; }
        .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 22px; }
        .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; background: #f8fafc; }
        .card-lbl { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; }
        .card-val { font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 4px; font-family: monospace; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
        th { background: #0f172a; color: #ffffff; text-transform: uppercase; font-size: 9px; padding: 8px 10px; text-align: left; }
        th.r, td.r { text-align: right; }
        td { border-bottom: 1px solid #f1f5f9; padding: 7px 10px; font-family: -apple-system, sans-serif; }
        .mono { font-family: monospace; font-weight: 600; }
        .green { color: #059669; font-weight: 700; }
        .red { color: #dc2626; font-weight: 700; }
        .footer { margin-top: 25px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 10px; }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <h1 class="title">${companyName}</h1>
            <p class="subtitle">Executive Profit & Margin Intelligence Audit Slip | Outlet: ${activeOutlet?.outlet_name || 'Main Pharmacy'}</p>
        </div>
        <div style="text-align: right;">
            <p style="font-size: 12px; font-weight: 700; margin: 0;">Period: ${dateFrom} to ${dateTo}</p>
            <p style="font-size: 10px; color: #64748b; margin-top: 4px;">Audited: ${new Date().toLocaleString()}</p>
        </div>
    </div>

    <div class="cards">
        <div class="card">
            <div class="card-lbl">Net Revenue</div>
            <div class="card-val">KES ${netRevenue.toLocaleString()}</div>
        </div>
        <div class="card">
            <div class="card-lbl">Inventory COGS</div>
            <div class="card-val">KES ${totalCOGS.toLocaleString()}</div>
        </div>
        <div class="card">
            <div class="card-lbl">Gross Profit Realized</div>
            <div class="card-val green">KES ${totalGrossProfit.toLocaleString()}</div>
        </div>
        <div class="card">
            <div class="card-lbl">Gross Profit Margin</div>
            <div class="card-val">${overallMarginPct.toFixed(1)}%</div>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>Drug / Product</th>
                <th>Category</th>
                <th class="r">Qty Sold</th>
                <th class="r">Avg Price</th>
                <th class="r">Unit Cost</th>
                <th class="r">Revenue (KES)</th>
                <th class="r">COGS (KES)</th>
                <th class="r">Profit (KES)</th>
                <th class="r">Margin %</th>
            </tr>
        </thead>
        <tbody>
            ${filteredProducts.slice(0, 150).map((p) => `
                <tr>
                    <td><strong>${p.product_name}</strong> <span style="font-size:9px; color:#64748b;">(${p.product_code})</span></td>
                    <td>${p.category}</td>
                    <td class="r mono">${p.units_sold}</td>
                    <td class="r mono">${p.avg_sell_price.toFixed(2)}</td>
                    <td class="r mono">${p.unit_cost.toFixed(2)}</td>
                    <td class="r mono">${p.total_revenue.toLocaleString()}</td>
                    <td class="r mono">${p.total_cogs.toLocaleString()}</td>
                    <td class="r mono ${p.gross_profit >= 0 ? 'green' : 'red'}">${p.gross_profit.toLocaleString()}</td>
                    <td class="r mono ${p.margin_pct >= 20 ? 'green' : ''}">${p.margin_pct.toFixed(1)}%</td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <div class="footer">
        Confidential Internal Financial Audit. Generated by Alpha Pharmacy Intelligence Engine v5.5.
    </div>
    <script>window.onload = function() { window.print(); };</script>
</body>
</html>`;

        printWindow.document.write(html);
        printWindow.document.close();
    };

    // ==================== RENDER ====================
    return (
        <div className="space-y-6 pb-20 font-sans">
            {/* Top Command Banner */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-emerald-50 via-teal-50/30 to-transparent rounded-full pointer-events-none -mr-20 -mt-20"></div>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                                    Profit &amp; Margin Command Engine
                                </h1>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                    LIVE DB REALTIME
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 font-medium mt-1">
                                Comprehensive gross profit analytics, true COGS margins, inventory return safeguards &amp; financial velocity
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                        <button
                            onClick={() => fetchProfitData(true)}
                            disabled={refreshing}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors border border-slate-200"
                        >
                            <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            {refreshing ? 'Syncing...' : 'Sync Live'}
                        </button>
                        <button
                            onClick={exportExcelXLS}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm shadow-emerald-600/20"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Super Excel (.xls)
                        </button>
                        <button
                            onClick={printAuditReport}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-sm"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                            PDF Audit
                        </button>
                    </div>
                </div>
            </div>

            {/* Super Premium Light Luxury Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* 1. Net Sales Revenue */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/90 border-t-4 border-t-emerald-500 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Net Sales Revenue</span>
                        <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
                            KES
                        </span>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
                            KES {netRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium mt-1">
                            {transactions.length} receipts • {totalUnitsSold} units dispensed
                        </div>
                    </div>
                </div>

                {/* 2. Total COGS */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/90 border-t-4 border-t-slate-600 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Inventory COGS</span>
                        <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs">
                            COST
                        </span>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
                            KES {totalCOGS.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium mt-1">
                            Calculated per-piece drug purchase cost
                        </div>
                    </div>
                </div>

                {/* 3. Realized Gross Profit */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/90 border-t-4 border-t-teal-500 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Realized Gross Profit</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-teal-100 text-teal-800">
                            {overallMarginPct >= 0 ? '+' : ''}{overallMarginPct.toFixed(1)}%
                        </span>
                    </div>
                    <div className="mt-3">
                        <div className={`text-2xl font-black font-mono tracking-tight ${totalGrossProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                            KES {totalGrossProfit.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium mt-1">
                            Net earnings after inventory COGS
                        </div>
                    </div>
                </div>

                {/* 4. Overall Gross Margin */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/90 border-t-4 border-t-cyan-500 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Gross Margin %</span>
                        <span className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center font-bold text-xs">
                            %
                        </span>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
                            {overallMarginPct.toFixed(1)}%
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium mt-1">
                            Benchmark target: &gt; 28.0%
                        </div>
                    </div>
                </div>

                {/* 5. Returns & Safeguards */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/90 border-t-4 border-t-amber-500 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Returns Safeguard</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-100 text-amber-800">
                            {totalReturnsCount} returns
                        </span>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl font-black text-amber-700 font-mono tracking-tight">
                            -KES {totalReturnsAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium mt-1">
                            Deducted from gross for true net profit
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter and Date Horizon Control Center */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    {/* Time Horizon Pills */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-slate-500 mr-1">Time Horizon:</span>
                        {[
                            { key: 'today', label: 'Today' },
                            { key: 'yesterday', label: 'Yesterday' },
                            { key: '7d', label: 'Last 7D' },
                            { key: 'month', label: 'This Month' },
                            { key: 'last_month', label: 'Last Month' },
                            { key: '90d', label: 'Last 90D' },
                            { key: 'all', label: 'All Time' },
                        ].map((btn) => (
                            <button
                                key={btn.key}
                                onClick={() => handlePresetChange(btn.key)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                    preset === btn.key
                                        ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                {btn.label}
                            </button>
                        ))}
                    </div>

                    {/* Date Inputs */}
                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => {
                                setDateFrom(e.target.value);
                                setPreset('custom');
                            }}
                            className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <span className="text-xs font-bold text-slate-400">to</span>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => {
                                setDateTo(e.target.value);
                                setPreset('custom');
                            }}
                            className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>
                </div>

                <div className="border-t border-slate-100 pt-3 flex items-center justify-between flex-wrap gap-3">
                    {/* Search and Secondary Selectors */}
                    <div className="flex items-center gap-2.5 flex-1 min-w-[260px]">
                        <div className="relative flex-1">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </span>
                            <input
                                type="text"
                                placeholder="Search by drug name, code, receipt #, or customer..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                        >
                            <option value="All">All Categories ({categoryRows.length})</option>
                            {categoriesList.map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>

                        <select
                            value={marginFilter}
                            onChange={(e) => setMarginFilter(e.target.value as any)}
                            className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                        >
                            <option value="All">All Margins</option>
                            <option value="High">High (&gt; 35%)</option>
                            <option value="Healthy">Healthy (15% - 35%)</option>
                            <option value="Low">Low (0% - 15%)</option>
                            <option value="Loss">Loss / Negative</option>
                        </select>

                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as any)}
                            className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                        >
                            <option value="profit_desc">Highest Profit</option>
                            <option value="profit_asc">Lowest Profit</option>
                            <option value="margin_desc">Highest Margin %</option>
                            <option value="margin_asc">Lowest Margin %</option>
                            <option value="revenue_desc">Highest Revenue</option>
                            <option value="qty_desc">Highest Volume Sold</option>
                        </select>
                    </div>

                    <div className="text-xs font-bold text-slate-500">
                        Showing <span className="text-emerald-600 font-extrabold">{filteredProducts.length}</span> drugs • <span className="text-slate-800 font-extrabold">{filteredTransactions.length}</span> sales
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
                {[
                    { id: 'overview', label: '📊 Visual Analytics & Trends', count: null },
                    { id: 'products', label: '💊 Drug Profitability Matrix', count: filteredProducts.length },
                    { id: 'categories', label: '🏷️ Category Performance', count: categoryRows.length },
                    { id: 'daily', label: '📅 Daily Profit Ledger', count: dailyRows.length },
                    { id: 'transactions', label: '🧾 Receipt Profit Audit', count: filteredTransactions.length },
                    { id: 'cashiers', label: '👤 Cashier & Dispenser ROI', count: cashierRows.length },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => {
                            setActiveTab(tab.id as any);
                            setPage(1);
                        }}
                        className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 ${
                            activeTab === tab.id
                                ? 'bg-slate-900 text-white shadow-sm'
                                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                        }`}
                    >
                        {tab.label}
                        {tab.count !== null && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                                activeTab === tab.id ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-700'
                            }`}>
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* ==================== TAB 1: VISUAL ANALYTICS & TRENDS ==================== */}
            {activeTab === 'overview' && (
                <div className="space-y-6">
                    {/* Linear Profit & Revenue Trend Chart */}
                    <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm">
                        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                            <div>
                                <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                                    Financial Velocity Trajectory: Revenue vs COGS vs Gross Profit
                                </h3>
                                <p className="text-xs text-slate-500 font-medium mt-0.5">
                                    Daily performance timeline illustrating gross sales realization versus inventory outlay
                                </p>
                            </div>
                            <div className="flex items-center gap-4 text-xs font-bold text-slate-600">
                                <span className="flex items-center gap-1.5">
                                    <span className="w-3 h-3 rounded-full bg-emerald-500"></span> Net Revenue
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="w-3 h-3 rounded-full bg-slate-500"></span> Inventory COGS
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="w-3 h-3 rounded-full bg-cyan-500"></span> Gross Profit
                                </span>
                            </div>
                        </div>

                        <div className="h-80 w-full">
                            {dailyRows.length > 0 ? (
                                <Line
                                    data={linearTrendChartData}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: {
                                            legend: { display: false },
                                            tooltip: {
                                                backgroundColor: '#0f172a',
                                                titleFont: { size: 12, weight: 'bold' },
                                                bodyFont: { size: 11, family: 'monospace' },
                                                padding: 10,
                                                callbacks: {
                                                    label: (ctx) => ` ${ctx.dataset.label}: KES ${Number(ctx.parsed.y).toLocaleString()}`,
                                                },
                                            },
                                        },
                                        scales: {
                                            y: {
                                                beginAtZero: true,
                                                grid: { color: '#f1f5f9' },
                                                ticks: {
                                                    font: { size: 10, family: 'monospace' },
                                                    callback: (val) => `KES ${Number(val).toLocaleString()}`,
                                                },
                                            },
                                            x: {
                                                grid: { display: false },
                                                ticks: { font: { size: 10, weight: 'bold' } },
                                            },
                                        },
                                    }}
                                />
                            ) : (
                                <div className="h-full flex items-center justify-center text-slate-400 text-xs font-semibold">
                                    No sales data recorded within selected time horizon
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Mid Charts Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Top 10 Profit Drivers */}
                        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm">
                            <h3 className="text-base font-black text-slate-900 tracking-tight mb-1 flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-teal-500"></span>
                                Top 10 Pharmacy Profit Drivers (KES)
                            </h3>
                            <p className="text-xs text-slate-500 font-medium mb-4">
                                Highest gross earnings medications compared with their wholesale inventory outlay
                            </p>
                            <div className="h-72 w-full">
                                {productRows.length > 0 ? (
                                    <Bar
                                        data={topProfitableChartData}
                                        options={{
                                            responsive: true,
                                            maintainAspectRatio: false,
                                            plugins: {
                                                legend: {
                                                    position: 'top',
                                                    labels: { font: { size: 11, weight: 'bold' }, boxWidth: 12 },
                                                },
                                                tooltip: {
                                                    backgroundColor: '#0f172a',
                                                    titleFont: { size: 12, weight: 'bold' },
                                                    bodyFont: { size: 11, family: 'monospace' },
                                                    padding: 10,
                                                    callbacks: {
                                                        label: (ctx) => ` ${ctx.dataset.label}: KES ${Number(ctx.parsed.y).toLocaleString()}`,
                                                    },
                                                },
                                            },
                                            scales: {
                                                y: {
                                                    beginAtZero: true,
                                                    grid: { color: '#f1f5f9' },
                                                    ticks: {
                                                        font: { size: 10, family: 'monospace' },
                                                        callback: (val) => `KES ${Number(val).toLocaleString()}`,
                                                    },
                                                },
                                                x: {
                                                    grid: { display: false },
                                                    ticks: { font: { size: 10, weight: 'bold' }, maxRotation: 45, minRotation: 20 },
                                                },
                                            },
                                        }}
                                    />
                                ) : (
                                    <div className="h-full flex items-center justify-center text-slate-400 text-xs font-semibold">
                                        No product profit records found
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Margin Health Distribution Doughnut */}
                        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm">
                            <h3 className="text-base font-black text-slate-900 tracking-tight mb-1 flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-cyan-500"></span>
                                Margin Health Segmentation
                            </h3>
                            <p className="text-xs text-slate-500 font-medium mb-4">
                                Categorization of dispensed drugs by gross margin yield
                            </p>
                            <div className="h-56 w-full relative">
                                <Doughnut
                                    data={marginHealthDoughnutData}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: {
                                            legend: {
                                                position: 'bottom',
                                                labels: { font: { size: 10, weight: 'bold' }, boxWidth: 10 },
                                            },
                                        },
                                        cutout: '70%',
                                    }}
                                />
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-6">
                                    <span className="text-2xl font-black text-slate-900 font-mono">
                                        {overallMarginPct.toFixed(1)}%
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Avg Margin</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Category Profit Performance Chart */}
                    <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm">
                        <h3 className="text-base font-black text-slate-900 tracking-tight mb-1 flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                            Category Profitability &amp; Revenue Breakdown
                        </h3>
                        <p className="text-xs text-slate-500 font-medium mb-4">
                            Direct comparison between gross sales generated and profit retained across categories
                        </p>
                        <div className="h-72 w-full">
                            {categoryRows.length > 0 ? (
                                <Bar
                                    data={categoryBarChartData}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: {
                                            legend: {
                                                position: 'top',
                                                labels: { font: { size: 11, weight: 'bold' }, boxWidth: 12 },
                                            },
                                            tooltip: {
                                                backgroundColor: '#0f172a',
                                                titleFont: { size: 12, weight: 'bold' },
                                                bodyFont: { size: 11, family: 'monospace' },
                                                padding: 10,
                                                callbacks: {
                                                    label: (ctx) => ` ${ctx.dataset.label}: KES ${Number(ctx.parsed.y).toLocaleString()}`,
                                                },
                                            },
                                        },
                                        scales: {
                                            y: {
                                                beginAtZero: true,
                                                grid: { color: '#f1f5f9' },
                                                ticks: {
                                                    font: { size: 10, family: 'monospace' },
                                                    callback: (val) => `KES ${Number(val).toLocaleString()}`,
                                                },
                                            },
                                            x: {
                                                grid: { display: false },
                                                ticks: { font: { size: 10, weight: 'bold' } },
                                            },
                                        },
                                    }}
                                />
                            ) : (
                                <div className="h-full flex items-center justify-center text-slate-400 text-xs font-semibold">
                                    No category data available
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ==================== TAB 2: DRUG PROFITABILITY MATRIX ==================== */}
            {activeTab === 'products' && (
                <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between flex-wrap gap-3">
                        <div>
                            <h3 className="text-base font-black text-slate-900 tracking-tight">
                                Drug Profitability &amp; Margin Ledger
                            </h3>
                            <p className="text-xs text-slate-500 font-medium">
                                Individual medication profit analysis with exact unit cost, revenue, and gross profit margins
                            </p>
                        </div>
                        <div className="text-xs font-bold text-slate-600">
                            Showing {Math.min(filteredProducts.length, (page - 1) * pageSize + 1)} - {Math.min(filteredProducts.length, page * pageSize)} of {filteredProducts.length} items
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-900 border-b-2 border-emerald-500 text-white font-black uppercase text-[11px] tracking-wider">
                                    <th className="py-3 px-4">Drug / Pharmaceutical</th>
                                    <th className="py-3 px-3">Category</th>
                                    <th className="py-3 px-3 text-right">Units Sold</th>
                                    <th className="py-3 px-3 text-right">Avg Retail Price</th>
                                    <th className="py-3 px-3 text-right">Unit COGS Cost</th>
                                    <th className="py-3 px-3 text-right">Gross Revenue</th>
                                    <th className="py-3 px-3 text-right">Total COGS</th>
                                    <th className="py-3 px-3 text-right">Gross Profit</th>
                                    <th className="py-3 px-4 text-center">Margin %</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                                {loading ? (
                                    <tr>
                                        <td colSpan={9} className="py-12 text-center text-slate-400">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                                                <span>Compiling profit matrix from database...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredProducts.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="py-12 text-center text-slate-400 font-medium">
                                            No drug sales recorded matching current filters
                                        </td>
                                    </tr>
                                ) : (
                                    filteredProducts
                                        .slice((page - 1) * pageSize, page * pageSize)
                                        .map((p) => {
                                            const isExpanded = expandedProductId === p.product_id;
                                            return (
                                                <Fragment key={p.product_id}>
                                                    <tr
                                                        onClick={() => setExpandedProductId(isExpanded ? null : p.product_id)}
                                                        className="hover:bg-emerald-50/40 cursor-pointer transition-colors"
                                                    >
                                                        <td className="py-3.5 px-4 font-bold text-slate-900">
                                                            <div className="flex items-center gap-2">
                                                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                                                <div>
                                                                    <div className="font-extrabold text-slate-900">{p.product_name}</div>
                                                                    <div className="text-[10px] text-slate-500 font-mono">{p.product_code}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="py-3.5 px-3">
                                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                                                                {p.category}
                                                            </span>
                                                        </td>
                                                        <td className="py-3.5 px-3 text-right font-mono font-bold">
                                                            {p.units_sold} {p.sales_unit}
                                                        </td>
                                                        <td className="py-3.5 px-3 text-right font-mono text-slate-700">
                                                            KES {p.avg_sell_price.toFixed(2)}
                                                        </td>
                                                        <td className="py-3.5 px-3 text-right font-mono text-slate-700">
                                                            KES {p.unit_cost.toFixed(2)}
                                                        </td>
                                                        <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-900">
                                                            KES {p.total_revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </td>
                                                        <td className="py-3.5 px-3 text-right font-mono text-slate-600">
                                                            KES {p.total_cogs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </td>
                                                        <td className={`py-3.5 px-3 text-right font-mono font-black ${
                                                            p.gross_profit >= 0 ? 'text-emerald-700' : 'text-rose-600'
                                                        }`}>
                                                            KES {p.gross_profit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </td>
                                                        <td className="py-3.5 px-4 text-center">
                                                            <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black font-mono ${
                                                                p.margin_pct >= 35
                                                                    ? 'bg-emerald-100 text-emerald-800'
                                                                    : p.margin_pct >= 15
                                                                    ? 'bg-cyan-100 text-cyan-800'
                                                                    : p.margin_pct >= 0
                                                                    ? 'bg-amber-100 text-amber-800'
                                                                    : 'bg-rose-100 text-rose-800'
                                                            }`}>
                                                                {p.margin_pct.toFixed(1)}%
                                                            </span>
                                                        </td>
                                                    </tr>

                                                    {/* Expanded Product Details */}
                                                    {isExpanded && (
                                                        <tr className="bg-slate-50/80">
                                                            <td colSpan={9} className="p-4">
                                                                <div className="bg-white rounded-xl p-4 border border-slate-200 space-y-2">
                                                                    <div className="flex items-center justify-between text-xs font-bold text-slate-700 border-b border-slate-100 pb-2">
                                                                        <span>Drug Configuration &amp; Performance Profile: {p.product_name}</span>
                                                                        <span className="font-mono text-slate-500">Transactions: {p.tx_count} sales</span>
                                                                    </div>
                                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs pt-1">
                                                                        <div>
                                                                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Packaging Ratio</span>
                                                                            <span className="font-bold text-slate-800">{p.pieces_per_package} {p.sales_unit} per {p.purchase_unit}</span>
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Unit Cost Basis</span>
                                                                            <span className="font-mono font-bold text-slate-800">KES {p.unit_cost.toFixed(2)} / {p.sales_unit}</span>
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Gross Profit Per Unit</span>
                                                                            <span className="font-mono font-bold text-emerald-600">KES {(p.avg_sell_price - p.unit_cost).toFixed(2)}</span>
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Last Dispensed Date</span>
                                                                            <span className="font-mono text-slate-700">{p.last_sale_date ? p.last_sale_date.replace('T', ' ').substring(0, 16) : 'N/A'}</span>
                                                                        </div>
                                                                    </div>
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

                    {/* Pagination Bar */}
                    <div className="p-4 border-t border-slate-200 flex items-center justify-between flex-wrap gap-3 text-xs">
                        <div className="flex items-center gap-2">
                            <span className="text-slate-500">Rows per page:</span>
                            <select
                                value={pageSize}
                                onChange={(e) => {
                                    setPageSize(Number(e.target.value));
                                    setPage(1);
                                }}
                                className="px-2 py-1 rounded border border-slate-300 font-bold text-slate-700 focus:outline-none"
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                disabled={page === 1}
                                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Previous
                            </button>
                            <span className="font-mono font-bold text-slate-700">
                                Page {page} of {Math.max(1, Math.ceil(filteredProducts.length / pageSize))}
                            </span>
                            <button
                                disabled={page >= Math.ceil(filteredProducts.length / pageSize)}
                                onClick={() => setPage((prev) => prev + 1)}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ==================== TAB 3: CATEGORY PERFORMANCE ==================== */}
            {activeTab === 'categories' && (
                <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-200 bg-slate-50/50">
                        <h3 className="text-base font-black text-slate-900 tracking-tight">
                            Category Profitability &amp; Financial Yield
                        </h3>
                        <p className="text-xs text-slate-500 font-medium">
                            Aggregate margin performance by pharmaceutical category
                        </p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-900 border-b-2 border-emerald-500 text-white font-black uppercase text-[11px] tracking-wider">
                                    <th className="py-3 px-4">Category Name</th>
                                    <th className="py-3 px-3 text-right">Products Count</th>
                                    <th className="py-3 px-3 text-right">Total Units Sold</th>
                                    <th className="py-3 px-3 text-right">Gross Revenue (KES)</th>
                                    <th className="py-3 px-3 text-right">Total COGS (KES)</th>
                                    <th className="py-3 px-3 text-right">Gross Profit (KES)</th>
                                    <th className="py-3 px-4 text-center">Margin %</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                                {categoryRows.map((c) => (
                                    <tr key={c.category} className="hover:bg-emerald-50/40 transition-colors">
                                        <td className="py-3.5 px-4 font-bold text-slate-900">
                                            {c.category}
                                        </td>
                                        <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-600">
                                            {c.product_count} drugs
                                        </td>
                                        <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-700">
                                            {c.units_sold.toLocaleString()}
                                        </td>
                                        <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-900">
                                            KES {c.revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="py-3.5 px-3 text-right font-mono text-slate-600">
                                            KES {c.cogs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="py-3.5 px-3 text-right font-mono font-black text-emerald-700">
                                            KES {c.profit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="py-3.5 px-4 text-center">
                                            <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black font-mono ${
                                                c.margin_pct >= 25 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                            }`}>
                                                {c.margin_pct.toFixed(1)}%
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ==================== TAB 4: DAILY PROFIT LEDGER ==================== */}
            {activeTab === 'daily' && (
                <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-200 bg-slate-50/50">
                        <h3 className="text-base font-black text-slate-900 tracking-tight">
                            Chronological Daily Profit Ledger
                        </h3>
                        <p className="text-xs text-slate-500 font-medium">
                            Daily gross sales, COGS expenditure, and net earnings timeline
                        </p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-900 border-b-2 border-emerald-500 text-white font-black uppercase text-[11px] tracking-wider">
                                    <th className="py-3 px-4">Date</th>
                                    <th className="py-3 px-3 text-right">Receipts Count</th>
                                    <th className="py-3 px-3 text-right">Units Dispensed</th>
                                    <th className="py-3 px-3 text-right">Gross Revenue (KES)</th>
                                    <th className="py-3 px-3 text-right">COGS Outlay (KES)</th>
                                    <th className="py-3 px-3 text-right">Gross Profit (KES)</th>
                                    <th className="py-3 px-4 text-center">Daily Margin %</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                                {dailyRows.map((d) => (
                                    <tr key={d.date} className="hover:bg-emerald-50/40 transition-colors">
                                        <td className="py-3.5 px-4 font-bold text-slate-900 font-mono">
                                            {d.display_date}
                                        </td>
                                        <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-600">
                                            {d.tx_count}
                                        </td>
                                        <td className="py-3.5 px-3 text-right font-mono text-slate-700">
                                            {d.units_sold}
                                        </td>
                                        <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-900">
                                            KES {d.revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="py-3.5 px-3 text-right font-mono text-slate-600">
                                            KES {d.cogs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="py-3.5 px-3 text-right font-mono font-black text-emerald-700">
                                            KES {d.profit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="py-3.5 px-4 text-center">
                                            <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-black font-mono bg-emerald-100 text-emerald-800">
                                                {d.margin_pct.toFixed(1)}%
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ==================== TAB 5: RECEIPT PROFIT AUDIT ==================== */}
            {activeTab === 'transactions' && (
                <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between flex-wrap gap-3">
                        <div>
                            <h3 className="text-base font-black text-slate-900 tracking-tight">
                                POS Receipt Profit &amp; Itemization Audit
                            </h3>
                            <p className="text-xs text-slate-500 font-medium">
                                Individual sales receipts with cashier name, customer, revenue, and itemized profit margin
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <select
                                value={selectedCashier}
                                onChange={(e) => setSelectedCashier(e.target.value)}
                                className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                            >
                                <option value="All">All Cashiers ({cashiersList.length})</option>
                                {cashiersList.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-900 border-b-2 border-emerald-500 text-white font-black uppercase text-[11px] tracking-wider">
                                    <th className="py-3 px-4">Receipt #</th>
                                    <th className="py-3 px-3">Date &amp; Time</th>
                                    <th className="py-3 px-3">Customer</th>
                                    <th className="py-3 px-3">Payment</th>
                                    <th className="py-3 px-3">Cashier</th>
                                    <th className="py-3 px-3 text-right">Revenue (KES)</th>
                                    <th className="py-3 px-3 text-right">COGS (KES)</th>
                                    <th className="py-3 px-3 text-right">Profit (KES)</th>
                                    <th className="py-3 px-4 text-center">Margin %</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                                {filteredTransactions.slice((page - 1) * pageSize, page * pageSize).map((tx) => {
                                    const isExpanded = expandedTxId === tx.sale_id;
                                    return (
                                        <Fragment key={tx.sale_id}>
                                            <tr
                                                onClick={() => setExpandedTxId(isExpanded ? null : tx.sale_id)}
                                                className="hover:bg-emerald-50/40 cursor-pointer transition-colors"
                                            >
                                                <td className="py-3.5 px-4 font-mono font-extrabold text-slate-900">
                                                    {tx.receipt_no}
                                                </td>
                                                <td className="py-3.5 px-3 text-slate-600 font-mono">
                                                    {tx.sale_datetime.replace('T', ' ').substring(0, 16)}
                                                </td>
                                                <td className="py-3.5 px-3 font-semibold text-slate-800">
                                                    {tx.customer_name}
                                                </td>
                                                <td className="py-3.5 px-3">
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                                                        {tx.payment_method}
                                                    </span>
                                                </td>
                                                <td className="py-3.5 px-3 font-medium text-slate-600">
                                                    {tx.cashier_name}
                                                </td>
                                                <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-900">
                                                    KES {tx.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td className="py-3.5 px-3 text-right font-mono text-slate-600">
                                                    KES {tx.cogs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td className="py-3.5 px-3 text-right font-mono font-black text-emerald-700">
                                                    KES {tx.profit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td className="py-3.5 px-4 text-center">
                                                    <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-black font-mono bg-emerald-100 text-emerald-800">
                                                        {tx.margin_pct.toFixed(1)}%
                                                    </span>
                                                </td>
                                            </tr>

                                            {/* Expandable Line Items Accordion */}
                                            {isExpanded && (
                                                <tr className="bg-slate-50/80">
                                                    <td colSpan={9} className="p-4">
                                                        <div className="bg-white rounded-xl p-4 border border-slate-200">
                                                            <div className="text-xs font-bold text-slate-700 mb-3 flex items-center justify-between">
                                                                <span>Dispensed Medication Line Items ({tx.items.length})</span>
                                                                <span className="font-mono text-slate-500">Receipt Ref: {tx.receipt_no}</span>
                                                            </div>
                                                            <table className="w-full text-left border-collapse text-xs">
                                                                <thead>
                                                                    <tr className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px]">
                                                                        <th className="py-2 px-3">Item</th>
                                                                        <th className="py-2 px-3 text-right">Qty</th>
                                                                        <th className="py-2 px-3 text-right">Unit Price</th>
                                                                        <th className="py-2 px-3 text-right">Unit Cost</th>
                                                                        <th className="py-2 px-3 text-right">Line Revenue</th>
                                                                        <th className="py-2 px-3 text-right">Line COGS</th>
                                                                        <th className="py-2 px-3 text-right">Line Profit</th>
                                                                        <th className="py-2 px-3 text-center">Margin %</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-slate-100 font-medium">
                                                                    {tx.items.map((itm) => (
                                                                        <tr key={itm.item_id}>
                                                                            <td className="py-2 px-3 font-semibold text-slate-800">{itm.product_name}</td>
                                                                            <td className="py-2 px-3 text-right font-mono">{itm.quantity}</td>
                                                                            <td className="py-2 px-3 text-right font-mono">KES {itm.unit_price.toFixed(2)}</td>
                                                                            <td className="py-2 px-3 text-right font-mono">KES {itm.unit_cost.toFixed(2)}</td>
                                                                            <td className="py-2 px-3 text-right font-mono font-bold">KES {itm.total.toFixed(2)}</td>
                                                                            <td className="py-2 px-3 text-right font-mono text-slate-600">KES {itm.cogs.toFixed(2)}</td>
                                                                            <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600">KES {itm.profit.toFixed(2)}</td>
                                                                            <td className="py-2 px-3 text-center font-mono font-bold text-slate-700">{itm.margin_pct.toFixed(1)}%</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
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

                    {/* Pagination Bar */}
                    <div className="p-4 border-t border-slate-200 flex items-center justify-between flex-wrap gap-3 text-xs">
                        <div className="flex items-center gap-2">
                            <span className="text-slate-500">Rows per page:</span>
                            <select
                                value={pageSize}
                                onChange={(e) => {
                                    setPageSize(Number(e.target.value));
                                    setPage(1);
                                }}
                                className="px-2 py-1 rounded border border-slate-300 font-bold text-slate-700 focus:outline-none"
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                disabled={page === 1}
                                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Previous
                            </button>
                            <span className="font-mono font-bold text-slate-700">
                                Page {page} of {Math.max(1, Math.ceil(filteredTransactions.length / pageSize))}
                            </span>
                            <button
                                disabled={page >= Math.ceil(filteredTransactions.length / pageSize)}
                                onClick={() => setPage((prev) => prev + 1)}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ==================== TAB 6: CASHIER ROI ==================== */}
            {activeTab === 'cashiers' && (
                <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-200 bg-slate-50/50">
                        <h3 className="text-base font-black text-slate-900 tracking-tight">
                            Cashier &amp; Dispensing Staff Profit Contribution
                        </h3>
                        <p className="text-xs text-slate-500 font-medium">
                            Sales performance and profit generated per cashier
                        </p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-900 border-b-2 border-emerald-500 text-white font-black uppercase text-[11px] tracking-wider">
                                    <th className="py-3 px-4">Cashier Name</th>
                                    <th className="py-3 px-3 text-right">Transactions Dispensed</th>
                                    <th className="py-3 px-3 text-right">Gross Revenue (KES)</th>
                                    <th className="py-3 px-3 text-right">Inventory COGS (KES)</th>
                                    <th className="py-3 px-3 text-right">Gross Profit (KES)</th>
                                    <th className="py-3 px-3 text-right">Avg Profit / Basket</th>
                                    <th className="py-3 px-4 text-center">Margin %</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                                {cashierRows.map((c) => (
                                    <tr key={c.cashier_name} className="hover:bg-emerald-50/40 transition-colors">
                                        <td className="py-3.5 px-4 font-bold text-slate-900">
                                            {c.cashier_name}
                                        </td>
                                        <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-600">
                                            {c.tx_count}
                                        </td>
                                        <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-900">
                                            KES {c.revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="py-3.5 px-3 text-right font-mono text-slate-600">
                                            KES {c.cogs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="py-3.5 px-3 text-right font-mono font-black text-emerald-700">
                                            KES {c.profit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="py-3.5 px-3 text-right font-mono font-bold text-teal-600">
                                            KES {c.avg_basket_profit.toFixed(2)}
                                        </td>
                                        <td className="py-3.5 px-4 text-center">
                                            <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-black font-mono bg-emerald-100 text-emerald-800">
                                                {c.margin_pct.toFixed(1)}%
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
