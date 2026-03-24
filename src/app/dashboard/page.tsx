'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
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
    Filler,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

// ────────────────── Types ──────────────────
interface DailySales { date: string; cash: number; mpesa: number; credit: number; total: number; orders: number; }
interface TopProduct { name: string; qty: number; revenue: number; avgPrice: number; }
interface LowStockItem { name: string; stock: number; reorder: number; type: 'dish' | 'ingredient' | 'product'; status: 'out' | 'critical' | 'low'; }
interface UserSalesData { name: string; sales: number; orders: number; }
interface RecentPurchase { date: string; supplier: string; total: number; status: string; items: number; }
interface ExpiryStats { expired: number; expiring7: number; expiring30: number; atRiskValue: number; }

// ────────────────── Dashboard ──────────────────
export default function DashboardPage() {
    const { activeOutlet } = useOutlet();
    const outletId = activeOutlet?.outlet_id || 1;
    const [isLoading, setIsLoading] = useState(true);
    const [dateFrom, setDateFrom] = useState(() => {
        const d = new Date(); d.setDate(d.getDate() - 7);
        return d.toISOString().split('T')[0];
    });
    const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
    const [rangePreset, setRangePreset] = useState<string>('7d');

    // KPI Stats
    const [todaySales, setTodaySales] = useState(0);
    const [yesterdaySales, setYesterdaySales] = useState(0);
    const [todayOrders, setTodayOrders] = useState(0);
    const [yesterdayOrders, setYesterdayOrders] = useState(0);
    const [todayCash, setTodayCash] = useState(0);
    const [todayMpesa, setTodayMpesa] = useState(0);
    const [todayCredit, setTodayCredit] = useState(0);
    const [pendingBills, setPendingBills] = useState(0);
    const [totalExpenses, setTotalExpenses] = useState(0);
    const [totalAdvances, setTotalAdvances] = useState(0);
    const [totalVouchers, setTotalVouchers] = useState(0);
    const [activeShifts, setActiveShifts] = useState(0);
    const [closedShifts, setClosedShifts] = useState(0);

    // Chart data
    const [dailySales, setDailySales] = useState<DailySales[]>([]);
    const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
    const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
    const [userSales, setUserSales] = useState<UserSalesData[]>([]);
    const [recentPurchases, setRecentPurchases] = useState<RecentPurchase[]>([]);
    const [expiryStats, setExpiryStats] = useState<ExpiryStats>({ expired: 0, expiring7: 0, expiring30: 0, atRiskValue: 0 });
    const scrollRef = useRef<HTMLDivElement>(null);

    // ──── Date Presets ────
    const setPreset = (preset: string) => {
        setRangePreset(preset);
        const now = new Date();
        const to = now.toISOString().split('T')[0];
        let from = to;
        if (preset === '1d') from = to;
        else if (preset === '7d') { const d = new Date(); d.setDate(d.getDate() - 7); from = d.toISOString().split('T')[0]; }
        else if (preset === '14d') { const d = new Date(); d.setDate(d.getDate() - 14); from = d.toISOString().split('T')[0]; }
        else if (preset === '30d') { const d = new Date(); d.setDate(d.getDate() - 30); from = d.toISOString().split('T')[0]; }
        else if (preset === 'month') { from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`; }
        setDateFrom(from);
        setDateTo(to);
    };

    // ──── Data Loading ────
    const loadDashboardData = useCallback(async () => {
        setIsLoading(true);
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        try {
            // ── Today's Sales by payment method ──
            const { data: todayData } = await supabase.from('pharmacy_sales').select('total, payment_method').eq('sale_datetime', today).eq('outlet_id', outletId);
            const tData = todayData || [];
            setTodaySales(tData.reduce((s, r) => s + (r.total || 0), 0));
            setTodayOrders(tData.length);
            setTodayCash(tData.filter(r => (r.payment_method || '').toLowerCase().includes('cash')).reduce((s, r) => s + (r.total || 0), 0));
            setTodayMpesa(tData.filter(r => (r.payment_method || '').toLowerCase().includes('mpesa')).reduce((s, r) => s + (r.total || 0), 0));
            setTodayCredit(tData.filter(r => (r.payment_method || '').toLowerCase().includes('credit')).reduce((s, r) => s + (r.total || 0), 0));

            // ── Yesterday's Sales ──
            const { data: yData } = await supabase.from('pharmacy_sales').select('total').eq('sale_datetime', yesterday).eq('outlet_id', outletId);
            setYesterdaySales((yData || []).reduce((s, r) => s + (r.total || 0), 0));
            setYesterdayOrders((yData || []).length);

            // ── Pending Bills ──
            const { data: pBills } = await supabase.from('pharmacy_sales').select('sale_id').eq('status', 'Pending').eq('outlet_id', outletId);
            setPendingBills(pBills?.length || 0);

            // ── Pharmacy Expiry Stats ──
            const { data: batchData } = await supabase.from('pharmacy_batches').select('expiry_date, remaining_qty, purchase_cost, selling_price').eq('outlet_id', outletId).eq('status', 'Active').gt('remaining_qty', 0);
            const getDaysUntil = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
            let expired = 0, exp7 = 0, exp30 = 0, atRisk = 0;
            (batchData || []).forEach((b: any) => {
                const days = getDaysUntil(b.expiry_date);
                if (days < 0) { expired++; atRisk += (b.selling_price || 0) * b.remaining_qty; }
                else if (days <= 7) { exp7++; atRisk += (b.selling_price || 0) * b.remaining_qty; }
                else if (days <= 30) { exp30++; atRisk += (b.selling_price || 0) * b.remaining_qty; }
            });
            setExpiryStats({ expired, expiring7: exp7, expiring30: exp30, atRiskValue: atRisk });

            // ── Daily Sales Trend (by date range, broken by payment method) ──
            const { data: rangeSales } = await supabase
                .from('pharmacy_sales')
                .select('sale_datetime, total, payment_method')
                .gte('sale_datetime', `T00:00:00`)
                .lte('sale_datetime', `T23:59:59`)
                .eq('outlet_id', outletId)
                .order('sale_datetime');

            const salesMap = new Map<string, DailySales>();
            // Fill in all dates in range
            const start = new Date(dateFrom);
            const end = new Date(dateTo);
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const key = d.toISOString().split('T')[0];
                salesMap.set(key, { date: key, cash: 0, mpesa: 0, credit: 0, total: 0, orders: 0 });
            }
            (rangeSales || []).forEach(s => {
                const key = s.sale_datetime;
                if (!salesMap.has(key)) salesMap.set(key, { date: key, cash: 0, mpesa: 0, credit: 0, total: 0, orders: 0 });
                const entry = salesMap.get(key)!;
                const amt = s.total || 0;
                const method = (s.payment_method || '').toLowerCase();
                entry.total += amt; entry.orders += 1;
                if (method.includes('mpesa')) entry.mpesa += amt;
                else if (method.includes('credit')) entry.credit += amt;
                else entry.cash += amt;
            });
            setDailySales(Array.from(salesMap.values()).sort((a, b) => a.date.localeCompare(b.date)));

            // ── Top Selling Products ──
            const { data: salesItems } = await supabase
                .from('pharmacy_sales_items')
                .select('product_name, quantity, subtotal, created_at')
                .gte('created_at', `${dateFrom}T00:00:00`)
                .lte('created_at', `${dateTo}T23:59:59`)
                .limit(1000);

            const prodMap = new Map<string, { qty: number; revenue: number }>();
            (salesItems || []).forEach(item => {
                const name = item.product_name || 'Unknown';
                if (!prodMap.has(name)) prodMap.set(name, { qty: 0, revenue: 0 });
                const e = prodMap.get(name)!;
                e.qty += item.quantity || 0;
                e.revenue += item.subtotal || 0;
            });
            setTopProducts(
                Array.from(prodMap.entries())
                    .map(([name, data]) => ({ name, ...data, avgPrice: data.qty > 0 ? Math.round(data.revenue / data.qty) : 0 }))
                    .sort((a, b) => b.qty - a.qty)
                    .slice(0, 15)
            );

            // ── Low Stock Items ──
            const { data: retailProds } = await supabase.from('pharmacy_products').select('pid, product_name, reorder_point').eq('active', true).eq('outlet_id', outletId).order('product_name');
            const { data: retailStock } = await supabase.from('pharmacy_stock').select('pid, qty').eq('outlet_id', outletId);
            const stockMap: Record<number, number> = {};
            (retailStock || []).forEach((s: { pid: number; qty: number }) => { stockMap[s.pid] = (stockMap[s.pid] || 0) + (s.qty || 0); });

            const lowItems: LowStockItem[] = [];
            (retailProds || []).forEach(p => {
                const stock = stockMap[p.pid] || 0;
                const reorder = p.reorder_point || 5;
                if (stock <= reorder) {
                    lowItems.push({ name: p.product_name, stock, reorder, type: 'product', status: stock === 0 ? 'out' : stock <= reorder * 0.3 ? 'critical' : 'low' });
                }
            });
            setLowStock(lowItems.sort((a, b) => a.stock - b.stock));

            // ── Pharmacist Sales ──
            const { data: cashierData } = await supabase
                .from('pharmacy_sales')
                .select('created_by, total')
                .gte('sale_datetime', `T00:00:00`).lte('sale_datetime', `T23:59:59`)
                .eq('outlet_id', outletId);
            const wMap = new Map<string, { sales: number; orders: number }>();
            (cashierData || []).forEach(s => {
                const name = s.created_by || 'Unknown';
                if (!wMap.has(name)) wMap.set(name, { sales: 0, orders: 0 });
                const e = wMap.get(name)!;
                e.sales += s.total || 0; e.orders += 1;
            });
            setUserSales(Array.from(wMap.entries()).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.sales - a.sales).slice(0, 10));

            // ── Recent Purchases ──
            const { data: purchasesData } = await supabase
                .from('pharmacy_purchases')
                .select('purchase_date, supplier_name, grand_total, status, purchase_no')
                .eq('outlet_id', outletId)
                .order('purchase_date', { ascending: false })
                .limit(8);
            setRecentPurchases((purchasesData || []).map(p => ({
                date: p.purchase_date, supplier: p.supplier_name || '-', total: p.grand_total || 0, status: p.status || 'Pending', items: 0,
            })));

            // ── Financials (expenses, filtered by outlet) ──
            const { data: expData } = await supabase.from('pharmacy_expenses').select('amount').gte('expense_date', dateFrom).lte('expense_date', dateTo).eq('outlet_id', outletId);
            setTotalExpenses((expData || []).reduce((s: number, e: any) => s + (e.amount || 0), 0));

            // ── Shifts ──
            const { data: shData } = await supabase.from('pharmacy_shift_instances').select('shift_status, created_at').gte('created_at', `${dateFrom}T00:00:00`).lte('created_at', `${dateTo}T23:59:59`);
            setActiveShifts((shData || []).filter((s: any) => s.shift_status === 'Open').length);
            setClosedShifts((shData || []).filter((s: any) => s.shift_status === 'Closed').length);

            // Reset unused hotel-only fields
            setTotalAdvances(0);
            setTotalVouchers(0);

        } catch (err) { console.error('Dashboard error:', err); }
        setIsLoading(false);
    }, [dateFrom, dateTo, outletId]);

    useEffect(() => { loadDashboardData(); }, [loadDashboardData]);

    // ──── Computed ────
    const salesChange = yesterdaySales > 0 ? ((todaySales - yesterdaySales) / yesterdaySales * 100) : 0;
    const netSales = todaySales - totalExpenses - totalAdvances - totalVouchers;
    const totalRangeSales = dailySales.reduce((s, d) => s + d.total, 0);
    const totalRangeOrders = dailySales.reduce((s, d) => s + d.orders, 0);
    const avgOrderValue = totalRangeOrders > 0 ? Math.round(totalRangeSales / totalRangeOrders) : 0;

    // ──── Chart Configs ────
    const chartLabels = dailySales.map(d => {
        const dt = new Date(d.date);
        return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    });

    const salesLineData = {
        labels: chartLabels,
        datasets: [
            {
                label: 'Total Sales',
                data: dailySales.map(d => d.total),
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.08)',
                fill: true,
                tension: 0.4,
                borderWidth: 3,
                pointRadius: dailySales.length > 14 ? 0 : 4,
                pointHoverRadius: 6,
                pointBackgroundColor: '#6366f1',
            },
            {
                label: 'Cash',
                data: dailySales.map(d => d.cash),
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.05)',
                fill: false,
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 5,
                borderDash: [],
            },
            {
                label: 'M-Pesa',
                data: dailySales.map(d => d.mpesa),
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.05)',
                fill: false,
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 5,
            },
            {
                label: 'Credit',
                data: dailySales.map(d => d.credit),
                borderColor: '#ef4444',
                backgroundColor: 'rgba(239, 68, 68, 0.05)',
                fill: false,
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 5,
                borderDash: [5, 5],
            },
        ],
    };

    const salesLineOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index' as const, intersect: false },
        plugins: {
            legend: { position: 'top' as const, labels: { usePointStyle: true, padding: 20, font: { size: 12, weight: 500 as const } } },
            tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                padding: 14,
                titleFont: { size: 13, weight: 'bold' as const },
                bodyFont: { size: 12 },
                cornerRadius: 10,
                callbacks: {
                    label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) =>
                        `${ctx.dataset.label}: Ksh ${(ctx.parsed.y || 0).toLocaleString()}`,
                },
            },
        },
        scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11 }, maxRotation: 45 } },
            y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 11 }, callback: (v: string | number) => `Ksh ${Number(v).toLocaleString()}` } },
        },
    };

    const paymentBarData = {
        labels: chartLabels,
        datasets: [
            { label: 'Cash', data: dailySales.map(d => d.cash), backgroundColor: 'rgba(16, 185, 129, 0.8)', borderRadius: 6, barPercentage: 0.7 },
            { label: 'M-Pesa', data: dailySales.map(d => d.mpesa), backgroundColor: 'rgba(245, 158, 11, 0.8)', borderRadius: 6, barPercentage: 0.7 },
            { label: 'Credit', data: dailySales.map(d => d.credit), backgroundColor: 'rgba(239, 68, 68, 0.7)', borderRadius: 6, barPercentage: 0.7 },
        ],
    };

    const paymentBarOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top' as const, labels: { usePointStyle: true, padding: 15, font: { size: 12 } } },
            tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                padding: 12, cornerRadius: 10,
                callbacks: {
                    label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) =>
                        `${ctx.dataset.label}: Ksh ${(ctx.parsed.y || 0).toLocaleString()}`,
                },
            },
        },
        scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11 }, maxRotation: 45 } },
            y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 11 }, callback: (v: string | number) => `Ksh ${Number(v).toLocaleString()}` } },
        },
    };

    const userBarData = {
        labels: userSales.map(u => u.name),
        datasets: [{
            label: 'Revenue',
            data: userSales.map(u => u.sales),
            backgroundColor: userSales.map((_, i) => {
                const colors = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#818cf8', '#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#818cf8'];
                return colors[i % colors.length];
            }),
            borderRadius: 8,
            barPercentage: 0.6,
        }],
    };

    const userBarOptions = {
        indexAxis: 'y' as const,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                padding: 12, cornerRadius: 10,
                callbacks: {
                    label: (ctx: { parsed: { x: number | null } }) =>
                        `Revenue: Ksh ${(ctx.parsed.x || 0).toLocaleString()}`,
                },
            },
        },
        scales: {
            x: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 11 }, callback: (v: string | number) => `Ksh ${Number(v).toLocaleString()}` } },
            y: { grid: { display: false }, ticks: { font: { size: 12, weight: 500 as const } } },
        },
    };

    // Payment donut
    const totalPayments = todayCash + todayMpesa + todayCredit;
    const donutData = {
        labels: ['Cash', 'M-Pesa', 'Credit'],
        datasets: [{
            data: [todayCash || 0.01, todayMpesa || 0.01, todayCredit || 0.01],
            backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
            borderWidth: 0,
            cutout: '72%',
        }],
    };
    const donutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                padding: 12, cornerRadius: 10,
                callbacks: {
                    label: (ctx: { label?: string; parsed: number }) =>
                        `${ctx.label}: Ksh ${ctx.parsed.toLocaleString()}`,
                },
            },
        },
    };

    // ──── Helpers ────
    const fmt = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toLocaleString();
    const pct = (val: number) => val >= 0 ? `+${val.toFixed(1)}%` : `${val.toFixed(1)}%`;

    // ──────────────── RENDER ────────────────
    return (
        <div className="space-y-5 pb-8" ref={scrollRef}>
            {/* ══════ Header ══════ */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-3">
                        <span className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl flex items-center justify-center text-white text-lg shadow-lg shadow-teal-200">💊</span>
                        Pharmacy Dashboard
                    </h1>
                    <p className="text-sm text-gray-500 mt-0.5">Real-time pharmacy analytics & expiry tracking</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Date Presets */}
                    {['1d', '7d', '14d', '30d', 'month'].map(p => (
                        <button key={p} onClick={() => setPreset(p)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${rangePreset === p ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
                            {p === '1d' ? 'Today' : p === 'month' ? 'This Month' : p.toUpperCase()}
                        </button>
                    ))}
                    <div className="flex items-center gap-1.5 ml-2">
                        <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setRangePreset('custom'); }}
                            className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-300 focus:outline-none" />
                        <span className="text-gray-400 text-xs">→</span>
                        <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setRangePreset('custom'); }}
                            className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-300 focus:outline-none" />
                    </div>
                    <button onClick={loadDashboardData}
                        className="px-4 py-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg text-xs font-bold hover:shadow-lg hover:shadow-indigo-200 transition-all">
                        {isLoading ? '⏳' : '🔄'} Refresh
                    </button>
                </div>
            </div>

            {/* ══════ Alert Banner ══════ */}
            {(expiryStats.expired > 0 || expiryStats.expiring7 > 0 || lowStock.filter(i => i.status === 'out').length > 0) && (
                <div className="bg-gradient-to-r from-red-500 via-orange-500 to-amber-500 rounded-2xl px-5 py-3 text-white flex items-center justify-between shadow-lg shadow-orange-200/50">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl animate-pulse">🚨</span>
                        <div>
                            <p className="font-bold text-sm">Pharmacy Alerts</p>
                            <p className="text-xs opacity-90">
                                {expiryStats.expired > 0 && `${expiryStats.expired} EXPIRED batches • `}
                                {expiryStats.expiring7 > 0 && `${expiryStats.expiring7} expiring in 7 days • `}
                                {lowStock.filter(i => i.status === 'out').length > 0 && `${lowStock.filter(i => i.status === 'out').length} items OUT OF STOCK`}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <a href="/dashboard/expiry-register" className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold transition">Expiry Register</a>
                        <a href="/dashboard/products" className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold transition">View Stock</a>
                    </div>
                </div>
            )}

            {/* ══════ KPI Cards Row ══════ */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                {/* Today's Sales */}
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-4 text-white shadow-lg shadow-emerald-200/50 relative overflow-hidden">
                    <div className="absolute -top-6 -right-6 w-20 h-20 bg-white/10 rounded-full" />
                    <p className="text-xs font-medium opacity-80">💊 Today&apos;s Sales</p>
                    <p className="text-2xl font-extrabold mt-1">Ksh {fmt(todaySales)}</p>
                    <div className="flex items-center gap-1 mt-1">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${salesChange >= 0 ? 'bg-white/25' : 'bg-red-400/40'}`}>{pct(salesChange)}</span>
                        <span className="text-xs opacity-70">vs yday</span>
                    </div>
                </div>
                {/* Orders */}
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-4 text-white shadow-lg shadow-blue-200/50 relative overflow-hidden">
                    <p className="text-xs font-medium opacity-80">🧾 Prescriptions</p>
                    <p className="text-2xl font-extrabold mt-1">{todayOrders}</p>
                    <p className="text-xs opacity-70 mt-1">Avg: Ksh {avgOrderValue.toLocaleString()}</p>
                </div>
                {/* Cash */}
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-4 text-white shadow-lg shadow-green-200/50">
                    <p className="text-xs font-medium opacity-80">💵 Cash</p>
                    <p className="text-2xl font-extrabold mt-1">Ksh {fmt(todayCash)}</p>
                    <p className="text-xs opacity-70 mt-1">{totalPayments > 0 ? ((todayCash / totalPayments) * 100).toFixed(0) : 0}%</p>
                </div>
                {/* M-Pesa */}
                <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-4 text-white shadow-lg shadow-amber-200/50">
                    <p className="text-xs font-medium opacity-80">📱 M-Pesa</p>
                    <p className="text-2xl font-extrabold mt-1">Ksh {fmt(todayMpesa)}</p>
                    <p className="text-xs opacity-70 mt-1">{totalPayments > 0 ? ((todayMpesa / totalPayments) * 100).toFixed(0) : 0}%</p>
                </div>
                {/* Credit */}
                <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl p-4 text-white shadow-lg shadow-red-200/50">
                    <p className="text-xs font-medium opacity-80">🏦 Credit</p>
                    <p className="text-2xl font-extrabold mt-1">Ksh {fmt(todayCredit)}</p>
                    <p className="text-xs opacity-70 mt-1">{totalPayments > 0 ? ((todayCredit / totalPayments) * 100).toFixed(0) : 0}%</p>
                </div>
                {/* EXPIRED */}
                <div className="bg-gradient-to-br from-red-600 to-red-800 rounded-2xl p-4 text-white shadow-lg shadow-red-300/50 relative overflow-hidden">
                    <p className="text-xs font-medium opacity-80">🔴 Expired</p>
                    <p className="text-2xl font-extrabold mt-1">{expiryStats.expired}</p>
                    <p className="text-xs opacity-70 mt-1">batches</p>
                </div>
                {/* EXPIRING SOON */}
                <div className="bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl p-4 text-white shadow-lg shadow-orange-200/50">
                    <p className="text-xs font-medium opacity-80">⏰ Exp 30d</p>
                    <p className="text-2xl font-extrabold mt-1">{expiryStats.expiring30}</p>
                    <p className="text-xs opacity-70 mt-1">{expiryStats.expiring7} in 7d</p>
                </div>
                {/* AT-RISK VALUE */}
                <div className="bg-gradient-to-br from-purple-600 to-violet-700 rounded-2xl p-4 text-white shadow-lg shadow-purple-200/50">
                    <p className="text-xs font-medium opacity-80">💰 At-Risk</p>
                    <p className="text-2xl font-extrabold mt-1">Ksh {fmt(expiryStats.atRiskValue)}</p>
                    <p className="text-xs opacity-70 mt-1">expiry loss</p>
                </div>
            </div>

            {/* ══════ Main Charts Row ══════ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Sales Trend Line Chart */}
                <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <span className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-sm">📈</span>
                            Sales Trend
                        </h3>
                        <span className="text-xs text-gray-400 font-medium">
                            Total: Ksh {totalRangeSales.toLocaleString()} • {totalRangeOrders} orders
                        </span>
                    </div>
                    <div style={{ height: '320px' }}>
                        {dailySales.length > 0 ? (
                            <Line data={salesLineData} options={salesLineOptions} />
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400">
                                <div className="text-center"><span className="text-4xl">📊</span><p className="mt-2">No sales data for this period</p></div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Payment Split Donut */}
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
                        <span className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center text-sm">💳</span>
                        Today&apos;s Payment Split
                    </h3>
                    <div style={{ height: '200px' }} className="flex items-center justify-center relative">
                        <Doughnut data={donutData} options={donutOptions} />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="text-center">
                                <p className="text-2xl font-extrabold text-gray-800">Ksh {fmt(totalPayments)}</p>
                                <p className="text-xs text-gray-500">Total</p>
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 space-y-2">
                        {[
                            { label: 'Cash', value: todayCash, color: '#10b981', icon: '💵' },
                            { label: 'M-Pesa', value: todayMpesa, color: '#f59e0b', icon: '📱' },
                            { label: 'Credit', value: todayCredit, color: '#ef4444', icon: '🏦' },
                        ].map(m => (
                            <div key={m.label} className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: m.color }} />
                                <span className="text-sm text-gray-600 flex-1">{m.icon} {m.label}</span>
                                <span className="text-sm font-bold text-gray-800">Ksh {m.value.toLocaleString()}</span>
                                <span className="text-xs text-gray-400">{totalPayments > 0 ? ((m.value / totalPayments) * 100).toFixed(0) : 0}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ══════ Payment Comparison + User Sales ══════ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Payment Comparison Bar Chart */}
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
                        <span className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center text-sm">📊</span>
                        Payment Method Comparison
                    </h3>
                    <div style={{ height: '300px' }}>
                        {dailySales.length > 0 ? <Bar data={paymentBarData} options={paymentBarOptions} /> : (
                            <div className="h-full flex items-center justify-center text-gray-400"><p>No data</p></div>
                        )}
                    </div>
                </div>

                {/* User/Waiter Sales */}
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
                        <span className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center text-sm">👥</span>
                        Staff Sales Ranking
                    </h3>
                    <div style={{ height: '300px' }}>
                        {userSales.length > 0 ? <Bar data={userBarData} options={userBarOptions} /> : (
                            <div className="h-full flex items-center justify-center text-gray-400"><p>No staff data</p></div>
                        )}
                    </div>
                </div>
            </div>

            {/* ══════ Data Grids Row ══════ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Best Sellers Grid */}
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
                        <span className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center text-sm">🔥</span>
                        Best Sellers
                    </h3>
                    <div className="overflow-auto max-h-[400px]">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-gray-50">
                                <tr className="text-left text-xs font-semibold text-gray-500 uppercase">
                                    <th className="py-2 px-2">#</th>
                                    <th className="py-2 px-2">Product</th>
                                    <th className="py-2 px-2 text-right">Qty</th>
                                    <th className="py-2 px-2 text-right">Revenue</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {topProducts.map((p, i) => (
                                    <tr key={i} className="hover:bg-indigo-50/50 transition">
                                        <td className="py-2 px-2">
                                            <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold text-white ${i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-amber-600' : 'bg-indigo-400'}`}>
                                                {i + 1}
                                            </span>
                                        </td>
                                        <td className="py-2 px-2 font-medium text-gray-800 max-w-[140px] truncate">{p.name}</td>
                                        <td className="py-2 px-2 text-right font-bold text-indigo-600">{p.qty}</td>
                                        <td className="py-2 px-2 text-right text-gray-600">Ksh {p.revenue.toLocaleString()}</td>
                                    </tr>
                                ))}
                                {topProducts.length === 0 && (
                                    <tr><td colSpan={4} className="py-8 text-center text-gray-400">No sales data</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Low Stock / Out of Stock Grid */}
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
                        <span className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center text-sm">⚠️</span>
                        Stock Alerts
                        {lowStock.length > 0 && (
                            <span className="ml-auto px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-bold">{lowStock.length}</span>
                        )}
                    </h3>
                    <div className="overflow-auto max-h-[400px]">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-gray-50">
                                <tr className="text-left text-xs font-semibold text-gray-500 uppercase">
                                    <th className="py-2 px-2">Item</th>
                                    <th className="py-2 px-2">Type</th>
                                    <th className="py-2 px-2 text-right">Stock</th>
                                    <th className="py-2 px-2 text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {lowStock.map((item, i) => (
                                    <tr key={i} className={`transition ${item.status === 'out' ? 'bg-red-50' : item.status === 'critical' ? 'bg-orange-50' : 'hover:bg-yellow-50/50'}`}>
                                        <td className="py-2 px-2 font-medium text-gray-800 max-w-[130px] truncate">{item.name}</td>
                                        <td className="py-2 px-2">
                                            <span className={`text-xs px-1.5 py-0.5 rounded ${item.type === 'dish' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                                {item.type === 'dish' ? '🍽️' : '🥬'} {item.type}
                                            </span>
                                        </td>
                                        <td className="py-2 px-2 text-right font-bold">{item.stock} / {item.reorder}</td>
                                        <td className="py-2 px-2 text-right">
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${item.status === 'out' ? 'bg-red-200 text-red-800' :
                                                    item.status === 'critical' ? 'bg-orange-200 text-orange-800' : 'bg-yellow-200 text-yellow-800'
                                                }`}>
                                                {item.status === 'out' ? '❌ OUT' : item.status === 'critical' ? '🔴 CRITICAL' : '🟡 LOW'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {lowStock.length === 0 && (
                                    <tr><td colSpan={4} className="py-8 text-center text-gray-400">
                                        <span className="text-3xl">✅</span><p className="mt-1">All stock levels good!</p>
                                    </td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Recent Purchases Grid */}
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
                        <span className="w-8 h-8 bg-cyan-100 rounded-lg flex items-center justify-center text-sm">📦</span>
                        Recent Purchases
                    </h3>
                    <div className="overflow-auto max-h-[400px]">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-gray-50">
                                <tr className="text-left text-xs font-semibold text-gray-500 uppercase">
                                    <th className="py-2 px-2">Date</th>
                                    <th className="py-2 px-2">Supplier</th>
                                    <th className="py-2 px-2 text-right">Total</th>
                                    <th className="py-2 px-2 text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {recentPurchases.map((p, i) => (
                                    <tr key={i} className="hover:bg-cyan-50/50 transition">
                                        <td className="py-2 px-2 text-gray-600">{new Date(p.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</td>
                                        <td className="py-2 px-2 font-medium text-gray-800 max-w-[120px] truncate">{p.supplier}</td>
                                        <td className="py-2 px-2 text-right font-bold text-gray-700">Ksh {p.total.toLocaleString()}</td>
                                        <td className="py-2 px-2 text-right">
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                                    p.status === 'Pending' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                                                }`}>{p.status}</span>
                                        </td>
                                    </tr>
                                ))}
                                {recentPurchases.length === 0 && (
                                    <tr><td colSpan={4} className="py-8 text-center text-gray-400">No purchase data</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* ══════ Financial Cards ══════ */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="bg-gradient-to-br from-rose-500 to-pink-600 rounded-2xl p-4 text-white shadow-lg shadow-rose-200/50">
                    <p className="text-xs opacity-80">💸 Expenses</p>
                    <p className="text-xl font-extrabold mt-1">Ksh {fmt(totalExpenses)}</p>
                    <a href="/dashboard/expenses" className="text-xs underline opacity-70 hover:opacity-100 mt-1 inline-block">View →</a>
                </div>
                <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-4 text-white shadow-lg shadow-violet-200/50">
                    <p className="text-xs opacity-80">💵 Advances</p>
                    <p className="text-xl font-extrabold mt-1">Ksh {fmt(totalAdvances)}</p>
                    <a href="/dashboard/advances" className="text-xs underline opacity-70 hover:opacity-100 mt-1 inline-block">View →</a>
                </div>
                <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-4 text-white shadow-lg shadow-amber-200/50">
                    <p className="text-xs opacity-80">🎟️ Vouchers</p>
                    <p className="text-xl font-extrabold mt-1">Ksh {fmt(totalVouchers)}</p>
                    <a href="/dashboard/vouchers" className="text-xs underline opacity-70 hover:opacity-100 mt-1 inline-block">View →</a>
                </div>
                <div className="bg-gradient-to-br from-cyan-500 to-sky-600 rounded-2xl p-4 text-white shadow-lg shadow-cyan-200/50">
                    <p className="text-xs opacity-80">⏰ Shifts</p>
                    <div className="flex items-center gap-3 mt-1">
                        <div><p className="text-lg font-extrabold">{activeShifts}</p><p className="text-xs opacity-70">Active</p></div>
                        <div className="h-6 w-px bg-white/30" />
                        <div><p className="text-lg font-extrabold">{closedShifts}</p><p className="text-xs opacity-70">Closed</p></div>
                    </div>
                    <a href="/dashboard/shifts" className="text-xs underline opacity-70 hover:opacity-100 mt-1 inline-block">Manage →</a>
                </div>
                <div className="bg-gradient-to-br from-slate-700 to-slate-900 rounded-2xl p-4 text-white shadow-lg shadow-slate-300/50">
                    <p className="text-xs opacity-80">⚠️ Pending Bills</p>
                    <p className="text-xl font-extrabold mt-1">{pendingBills}</p>
                    <a href="/dashboard/bills" className="text-xs underline opacity-70 hover:opacity-100 mt-1 inline-block">View →</a>
                </div>
            </div>

            {/* ══════ Quick Actions ══════ */}
            <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 rounded-2xl p-5 text-white">
                <h3 className="font-bold text-sm mb-3 flex items-center gap-2">⚡ Quick Actions</h3>
                <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                    {[
                        { icon: '💊', label: 'POS', href: '/dashboard/pos' },
                        { icon: '⏰', label: 'Expiry', href: '/dashboard/expiry-register' },
                        { icon: '📥', label: 'Purchase', href: '/dashboard/purchase' },
                        { icon: '📦', label: 'Products', href: '/dashboard/products' },
                        { icon: '💸', label: 'Expenses', href: '/dashboard/expenses' },
                        { icon: '📋', label: 'Reports', href: '/dashboard/shift-reports' },
                        { icon: '👥', label: 'Suppliers', href: '/dashboard/suppliers' },
                        { icon: '🔄', label: 'Shifts', href: '/dashboard/shifts' },
                    ].map(a => (
                        <a key={a.label} href={a.href}
                            className="flex flex-col items-center gap-1.5 p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all hover:scale-105">
                            <span className="text-2xl">{a.icon}</span>
                            <span className="text-xs font-medium">{a.label}</span>
                        </a>
                    ))}
                </div>
            </div>
        </div>
    );
}
