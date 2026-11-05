'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

interface SaleRecord {
    sale_id: number; receipt_no: string; sale_datetime: string;
    customer_name: string | null; customer_phone: string | null;
    subtotal: number; discount: number; tax: number; total: number;
    payment_method: string; mpesa_receipt: string | null;
    amount_paid: number; status: string; cashier_name: string | null;
    notes: string | null; checkout_request_id: string | null;
}

export default function SalesReportPage() {
    const { activeOutlet } = useOutlet();
    const outletId = activeOutlet?.outlet_id || 1;

    const [sales, setSales] = useState<SaleRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [avgMarginRate, setAvgMarginRate] = useState(0.3);
    const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
    const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
    const [filterPayment, setFilterPayment] = useState('All');
    const [filterCashier, setFilterCashier] = useState('All');
    const [filterStatus, setFilterStatus] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [preset, setPreset] = useState('today');
    const [sortField, setSortField] = useState<'date' | 'total' | 'discount'>('date');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null);
    const [showDetail, setShowDetail] = useState(false);
    const [cashierList, setCashierList] = useState<string[]>([]);

    const fmtDate = (d: string) => {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };
    const fmtTime = (d: string) => {
        if (!d) return '—';
        return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    };

    const setDatePreset = (p: string) => {
        setPreset(p);
        const now = new Date();
        const to = now.toISOString().split('T')[0];
        let from = to;
        if (p === '7d') { const d = new Date(); d.setDate(d.getDate() - 7); from = d.toISOString().split('T')[0]; }
        else if (p === '30d') { const d = new Date(); d.setDate(d.getDate() - 30); from = d.toISOString().split('T')[0]; }
        else if (p === 'month') { from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`; }
        else if (p === '3m') { const d = new Date(); d.setMonth(d.getMonth() - 3); from = d.toISOString().split('T')[0]; }
        setDateFrom(from); setDateTo(to);
    };

    const loadSales = useCallback(async () => {
        if (!activeOutlet) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('pharmacy_sales').select('*')
            .eq('outlet_id', outletId)
            .gte('sale_datetime', `${dateFrom}T00:00:00`)
            .lte('sale_datetime', `${dateTo}T23:59:59`)
            .order('sale_datetime', { ascending: false });
        if (!error) {
            setSales(data || []);
            const uniq = Array.from(new Set((data || []).map((s: SaleRecord) => s.cashier_name).filter(Boolean))) as string[];
            setCashierList(uniq);
        } else { toast.error('Failed to load sales'); }
        setLoading(false);
    }, [dateFrom, dateTo, outletId, activeOutlet]);

    const loadMargin = useCallback(async () => {
        const { data } = await supabase.from('pharmacy_products').select('purchase_cost, sales_cost').eq('outlet_id', outletId).limit(200);
        if (data && data.length > 0) {
            const margins = (data as { purchase_cost: number; sales_cost: number }[])
                .filter(p => p.sales_cost > 0)
                .map(p => (p.sales_cost - p.purchase_cost) / p.sales_cost);
            if (margins.length > 0) {
                const avg = margins.reduce((s, m) => s + m, 0) / margins.length;
                setAvgMarginRate(avg > 0 ? Math.min(avg, 0.9) : 0.3);
            }
        }
    }, [outletId]);

    useEffect(() => { loadSales(); }, [loadSales]);
    useEffect(() => { loadMargin(); }, [loadMargin]);

    const filtered = useMemo(() => {
        return sales.filter(s => {
            const mp = filterPayment === 'All' || (s.payment_method || '').toLowerCase().includes(filterPayment.toLowerCase());
            const mc = filterCashier === 'All' || s.cashier_name === filterCashier;
            const ms = filterStatus === 'All' || s.status === filterStatus;
            const q = searchQuery.toLowerCase();
            const mq = !q || (s.receipt_no || '').toLowerCase().includes(q)
                || (s.customer_name || '').toLowerCase().includes(q)
                || (s.mpesa_receipt || '').toLowerCase().includes(q)
                || (s.customer_phone || '').includes(q)
                || (s.cashier_name || '').toLowerCase().includes(q);
            return mp && mc && ms && mq;
        }).sort((a, b) => {
            let va = 0, vb = 0;
            if (sortField === 'date') { va = new Date(a.sale_datetime).getTime(); vb = new Date(b.sale_datetime).getTime(); }
            else if (sortField === 'total') { va = a.total; vb = b.total; }
            else if (sortField === 'discount') { va = a.discount; vb = b.discount; }
            return sortDir === 'desc' ? vb - va : va - vb;
        });
    }, [sales, filterPayment, filterCashier, filterStatus, searchQuery, sortField, sortDir]);

    const metrics = useMemo(() => {
        const totalRevenue = filtered.reduce((s, r) => s + (r.total || 0), 0);
        const totalCash = filtered.filter(r => (r.payment_method || '').toLowerCase().includes('cash')).reduce((s, r) => s + (r.total || 0), 0);
        const totalMpesa = filtered.filter(r => (r.payment_method || '').toLowerCase().includes('mpesa')).reduce((s, r) => s + (r.total || 0), 0);
        const totalCredit = filtered.filter(r => (r.payment_method || '').toLowerCase().includes('credit')).reduce((s, r) => s + (r.total || 0), 0);
        const totalCard = filtered.filter(r => (r.payment_method || '').toLowerCase().includes('card')).reduce((s, r) => s + (r.total || 0), 0);
        const totalDiscount = filtered.reduce((s, r) => s + (r.discount || 0), 0);
        const estProfit = Math.round(totalRevenue * avgMarginRate);
        const estCOGS = totalRevenue - estProfit;
        const profitMarginPct = totalRevenue > 0 ? Math.round((estProfit / totalRevenue) * 100) : 0;
        const avgOrder = filtered.length > 0 ? Math.round(totalRevenue / filtered.length) : 0;
        const completedCount = filtered.filter(r => r.status === 'Completed').length;
        const cashierMap: Record<string, { name: string; count: number; revenue: number }> = {};
        filtered.forEach(s => {
            const c = s.cashier_name || 'Unknown';
            if (!cashierMap[c]) cashierMap[c] = { name: c, count: 0, revenue: 0 };
            cashierMap[c].count++;
            cashierMap[c].revenue += s.total || 0;
        });
        const cashierStats = Object.values(cashierMap).sort((a, b) => b.revenue - a.revenue).slice(0, 6);
        return { totalRevenue, totalCash, totalMpesa, totalCredit, totalCard, totalDiscount, estProfit, estCOGS, profitMarginPct, avgOrder, completedCount, cashierStats };
    }, [filtered, avgMarginRate]);

    const toggleSort = (f: 'date' | 'total' | 'discount') => {
        if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(f); setSortDir('desc'); }
    };
    const si = (f: string) => sortField === f ? (sortDir === 'desc' ? ' ▼' : ' ▲') : ' ⇅';

    const getPS = (method: string) => {
        const m = (method || '').toLowerCase();
        if (m.includes('mpesa')) return { bg: 'rgba(16,185,129,0.12)', color: '#065f46', border: '1px solid rgba(16,185,129,0.25)', text: 'M-PESA' };
        if (m.includes('cash')) return { bg: 'rgba(59,130,246,0.12)', color: '#1e40af', border: '1px solid rgba(59,130,246,0.25)', text: 'CASH' };
        if (m.includes('credit')) return { bg: 'rgba(245,158,11,0.12)', color: '#92400e', border: '1px solid rgba(245,158,11,0.25)', text: 'CREDIT' };
        if (m.includes('card')) return { bg: 'rgba(139,92,246,0.12)', color: '#5b21b6', border: '1px solid rgba(139,92,246,0.25)', text: 'CARD' };
        return { bg: 'rgba(107,114,128,0.12)', color: '#374151', border: '1px solid rgba(107,114,128,0.25)', text: method || '—' };
    };

    const exportCSV = () => {
        const rows = [['#', 'Date', 'Time', 'Receipt', 'Customer', 'Phone', 'Payment', 'Subtotal', 'Discount', 'Total', 'Est.Profit', 'M-Pesa', 'Cashier', 'Status']];
        filtered.forEach((s, i) => rows.push([
            String(i + 1), fmtDate(s.sale_datetime), fmtTime(s.sale_datetime),
            s.receipt_no, s.customer_name || 'Walk-in', s.customer_phone || '',
            s.payment_method, String(s.subtotal || 0), String(s.discount || 0),
            String(s.total), String(Math.round((s.total || 0) * avgMarginRate)),
            s.mpesa_receipt || '', s.cashier_name || '', s.status || ''
        ]));
        const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = `alpha_pharmacy_sales_${dateFrom}_${dateTo}.csv`; a.click();
        URL.revokeObjectURL(url);
        toast.success('✅ CSV exported!');
    };

    const printReport = () => {
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Sales Report</title>
<style>@page{margin:8mm;size:A4 landscape;}body{font-family:Arial,sans-serif;font-size:9px;color:#000;}
h1{font-size:14px;margin:0 0 2px;}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;border-bottom:2px solid #333;padding-bottom:6px;}
.metrics{display:grid;grid-template-columns:repeat(6,1fr);gap:4px;margin-bottom:8px;}
.metric{border:1px solid #ddd;border-radius:4px;padding:4px;text-align:center;}
.metric .lbl{font-size:7px;color:#666;text-transform:uppercase;font-weight:700;}
.metric .val{font-size:11px;font-weight:800;color:#111;}
table{width:100%;border-collapse:collapse;font-size:8px;}
th,td{border:1px solid #ddd;padding:3px 5px;text-align:left;}
th{background:#2c3e50;color:#fff;font-weight:700;font-size:7px;text-transform:uppercase;}
.r{text-align:right;}.c{text-align:center;}.b{font-weight:700;}
tr:nth-child(even){background:#f8f8f8;}
.mpesa{color:#065f46;}.cash{color:#1e40af;}.credit{color:#92400e;}
.profit{color:#065f46;font-weight:700;}
tfoot tr{background:#ecfdf5;font-weight:800;border-top:2px solid #333;}
</style></head><body>
<div class="hdr">
<div><h1>🏥 ALPHA PHARMACY POS — SALES REPORT</h1>
<div style="font-size:9px;color:#555;">${activeOutlet?.outlet_name || 'Main Pharmacy'} &nbsp;|&nbsp; ${dateFrom} → ${dateTo} &nbsp;|&nbsp; ${filtered.length} orders &nbsp;|&nbsp; Printed: ${new Date().toLocaleString('en-GB')}</div>
</div>
<div style="font-size:9px;text-align:right;color:#333;">Margin used: ${Math.round(avgMarginRate * 100)}% avg</div>
</div>
<div class="metrics">
<div class="metric"><div class="lbl">Total Revenue</div><div class="val">Ksh ${metrics.totalRevenue.toLocaleString()}</div></div>
<div class="metric"><div class="lbl">Cash</div><div class="val">Ksh ${metrics.totalCash.toLocaleString()}</div></div>
<div class="metric"><div class="lbl">M-Pesa</div><div class="val">Ksh ${metrics.totalMpesa.toLocaleString()}</div></div>
<div class="metric"><div class="lbl">Credit</div><div class="val">Ksh ${metrics.totalCredit.toLocaleString()}</div></div>
<div class="metric"><div class="lbl">Est. Profit</div><div class="val" style="color:#065f46;">Ksh ${metrics.estProfit.toLocaleString()}</div></div>
<div class="metric"><div class="lbl">Orders</div><div class="val">${metrics.completedCount}/${metrics.totalRevenue > 0 ? filtered.length : 0}</div></div>
</div>
<table><thead><tr>
<th>#</th><th>Date</th><th>Time</th><th>Receipt</th><th>Customer</th>
<th>Payment</th><th class="r">Subtotal</th><th class="r">Disc.</th>
<th class="r">Total</th><th class="r">Est.Profit</th><th>M-Pesa Code</th><th>Cashier</th><th>Status</th>
</tr></thead><tbody>
${filtered.map((s, i) => `<tr>
<td>${i + 1}</td><td>${fmtDate(s.sale_datetime)}</td><td>${fmtTime(s.sale_datetime)}</td>
<td class="b">${s.receipt_no}</td><td>${s.customer_name || 'Walk-in'}</td>
<td class="c b ${(s.payment_method || '').toLowerCase().includes('mpesa') ? 'mpesa' : (s.payment_method || '').toLowerCase().includes('cash') ? 'cash' : 'credit'}">${s.payment_method}</td>
<td class="r">Ksh ${(s.subtotal || 0).toLocaleString()}</td>
<td class="r">${s.discount > 0 ? '-' + s.discount.toLocaleString() : '—'}</td>
<td class="r b">Ksh ${(s.total || 0).toLocaleString()}</td>
<td class="r profit">Ksh ${Math.round((s.total || 0) * avgMarginRate).toLocaleString()}</td>
<td>${s.mpesa_receipt || '—'}</td><td>${s.cashier_name || '—'}</td><td class="c">${s.status || '—'}</td>
</tr>`).join('')}
</tbody><tfoot><tr>
<td colspan="6" class="b">TOTALS (${filtered.length} orders)</td>
<td class="r b">Ksh ${filtered.reduce((s, r) => s + (r.subtotal || 0), 0).toLocaleString()}</td>
<td class="r b">-${metrics.totalDiscount.toLocaleString()}</td>
<td class="r b">Ksh ${metrics.totalRevenue.toLocaleString()}</td>
<td class="r b" style="color:#065f46;">Ksh ${metrics.estProfit.toLocaleString()}</td>
<td colspan="3"></td>
</tr></tfoot></table>
<div style="margin-top:6px;font-size:7px;color:#999;">* Est. Profit uses ${Math.round(avgMarginRate * 100)}% avg margin from product catalogue. For exact line-item profit, expand sales_items schema.</div>
</body></html>`;
        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); w.print(); }
    };

    const CARD_COLORS = ['#667eea', '#11998e', '#f7971e', '#f44336', '#8b5cf6', '#06b6d4'];

    return (
        <div className="space-y-5">

            {/* ==================== HEADER ==================== */}
            <div style={{ background: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)', borderRadius: 20, padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 50, height: 50, borderRadius: 14, background: 'linear-gradient(135deg, #667eea, #764ba2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, boxShadow: '0 8px 20px rgba(102,126,234,0.5)' }}>📊</div>
                    <div>
                        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.3px' }}>Sales Report</h1>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', margin: '2px 0 0' }}>
                            {activeOutlet?.outlet_name || 'Main Pharmacy'} &nbsp;•&nbsp;
                            {dateFrom === dateTo ? fmtDate(dateFrom) : `${fmtDate(dateFrom)} → ${fmtDate(dateTo)}`} &nbsp;•&nbsp;
                            {metrics.completedCount} completed &nbsp;•&nbsp; {filtered.length} total
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => loadSales()} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '8px 14px', borderRadius: 10, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>🔄 Refresh</button>
                    <button onClick={exportCSV} style={{ background: 'linear-gradient(135deg,#11998e,#38ef7d)', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 15px rgba(56,239,125,0.3)' }}>📥 Export CSV</button>
                    <button onClick={printReport} style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 15px rgba(102,126,234,0.3)' }}>🖨️ Print Report</button>
                </div>
            </div>

            {/* ==================== GLASSMORPHIC CARDS ROW 1 ==================== */}
            <div className="grid grid-cols-4 gap-4">
                {[
                    { label: 'TOTAL REVENUE', sub: 'Gross Sales', value: `Ksh ${metrics.totalRevenue.toLocaleString()}`, icon: '💰', grad: 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)', shadow: 'rgba(102,126,234,0.35)' },
                    { label: 'CASH COLLECTIONS', sub: 'Cash Payments', value: `Ksh ${metrics.totalCash.toLocaleString()}`, icon: '💵', grad: 'linear-gradient(135deg,#11998e 0%,#38ef7d 100%)', shadow: 'rgba(17,153,142,0.35)' },
                    { label: 'M-PESA COLLECTIONS', sub: 'Mobile Money', value: `Ksh ${metrics.totalMpesa.toLocaleString()}`, icon: '📱', grad: 'linear-gradient(135deg,#4CAF50 0%,#087f23 100%)', shadow: 'rgba(76,175,80,0.35)' },
                    { label: 'CREDIT SALES', sub: 'On Account', value: `Ksh ${metrics.totalCredit.toLocaleString()}`, icon: '📋', grad: 'linear-gradient(135deg,#f7971e 0%,#ffd200 100%)', shadow: 'rgba(247,151,30,0.35)' },
                ].map((card, i) => (
                    <div key={i} style={{ background: card.grad, borderRadius: 18, padding: '18px 20px', boxShadow: `0 12px 40px ${card.shadow}`, position: 'relative', overflow: 'hidden', color: '#fff' }}>
                        <div style={{ position: 'absolute', top: -18, right: -18, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
                        <div style={{ position: 'absolute', bottom: -25, left: -12, width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.2px', opacity: 0.8, textTransform: 'uppercase' }}>{card.label}</div>
                        <div style={{ fontSize: 22, fontWeight: 900, margin: '8px 0 4px', letterSpacing: '-0.5px' }}>{card.value}</div>
                        <div style={{ fontSize: 11, opacity: 0.72 }}>{card.sub}</div>
                        <div style={{ position: 'absolute', bottom: 12, right: 14, fontSize: 26, opacity: 0.22 }}>{card.icon}</div>
                    </div>
                ))}
            </div>

            {/* ==================== GLASSMORPHIC CARDS ROW 2 ==================== */}
            <div className="grid grid-cols-4 gap-4">
                {[
                    { label: 'EST. GROSS PROFIT', sub: `~${Math.round(avgMarginRate * 100)}% avg margin`, value: `Ksh ${metrics.estProfit.toLocaleString()}`, icon: '📈', grad: 'linear-gradient(135deg,#00b09b 0%,#96c93d 100%)', shadow: 'rgba(0,176,155,0.35)' },
                    { label: 'TOTAL DISCOUNTS', sub: 'Allowances issued', value: `Ksh ${metrics.totalDiscount.toLocaleString()}`, icon: '🏷️', grad: 'linear-gradient(135deg,#f44336 0%,#b71c1c 100%)', shadow: 'rgba(244,67,54,0.35)' },
                    { label: 'ORDER COUNT', sub: `${metrics.completedCount} Completed`, value: String(filtered.length), icon: '🧾', grad: 'linear-gradient(135deg,#2196F3 0%,#0d47a1 100%)', shadow: 'rgba(33,150,243,0.35)' },
                    { label: 'AVERAGE ORDER', sub: 'Per transaction', value: `Ksh ${metrics.avgOrder.toLocaleString()}`, icon: '⬆️', grad: 'linear-gradient(135deg,#e91e63 0%,#880e4f 100%)', shadow: 'rgba(233,30,99,0.35)' },
                ].map((card, i) => (
                    <div key={i} style={{ background: card.grad, borderRadius: 18, padding: '18px 20px', boxShadow: `0 12px 40px ${card.shadow}`, position: 'relative', overflow: 'hidden', color: '#fff' }}>
                        <div style={{ position: 'absolute', top: -18, right: -18, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
                        <div style={{ position: 'absolute', bottom: -25, left: -12, width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.2px', opacity: 0.8, textTransform: 'uppercase' }}>{card.label}</div>
                        <div style={{ fontSize: 22, fontWeight: 900, margin: '8px 0 4px', letterSpacing: '-0.5px' }}>{card.value}</div>
                        <div style={{ fontSize: 11, opacity: 0.72 }}>{card.sub}</div>
                        <div style={{ position: 'absolute', bottom: 12, right: 14, fontSize: 26, opacity: 0.22 }}>{card.icon}</div>
                    </div>
                ))}
            </div>

            {/* ==================== ANALYTICS STRIP ==================== */}
            <div className="grid grid-cols-5 gap-4">
                {/* Payment Breakdown */}
                <div className="col-span-3 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                    <h3 className="text-sm font-bold text-gray-800 mb-1 flex items-center gap-2">📊 Payment Method Breakdown</h3>
                    <p className="text-xs text-gray-400 mb-4">Revenue distribution across all payment channels</p>
                    <div className="space-y-3">
                        {[
                            { label: 'M-Pesa', value: metrics.totalMpesa, color: '#10b981', icon: '📱' },
                            { label: 'Cash', value: metrics.totalCash, color: '#3b82f6', icon: '💵' },
                            { label: 'Credit', value: metrics.totalCredit, color: '#f59e0b', icon: '📋' },
                            { label: 'Card', value: metrics.totalCard, color: '#8b5cf6', icon: '💳' },
                        ].map((m, i) => {
                            const pct = metrics.totalRevenue > 0 ? Math.round((m.value / metrics.totalRevenue) * 100) : 0;
                            return (
                                <div key={i}>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5"><span>{m.icon}</span>{m.label}</span>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-gray-400 font-mono">{pct}%</span>
                                            <span className="text-xs font-bold text-gray-800">Ksh {m.value.toLocaleString()}</span>
                                        </div>
                                    </div>
                                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <div style={{ width: `${pct}%`, background: m.color, height: '100%', borderRadius: 999, transition: 'width 0.8s ease' }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="mt-5 pt-4 border-t border-gray-100 grid grid-cols-3 gap-3">
                        <div className="text-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                            <p className="text-[10px] text-gray-500 uppercase font-bold">Revenue</p>
                            <p className="text-sm font-black text-gray-800">Ksh {metrics.totalRevenue.toLocaleString()}</p>
                        </div>
                        <div className="text-center p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                            <p className="text-[10px] text-red-500 uppercase font-bold">Est. COGS</p>
                            <p className="text-sm font-black text-red-600">Ksh {metrics.estCOGS.toLocaleString()}</p>
                        </div>
                        <div className="text-center p-3 rounded-xl" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
                            <p className="text-[10px] text-emerald-600 uppercase font-bold">Est. Profit</p>
                            <p className="text-sm font-black text-emerald-700">Ksh {metrics.estProfit.toLocaleString()}</p>
                        </div>
                    </div>
                </div>

                {/* Cashier Performance */}
                <div className="col-span-2 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                    <h3 className="text-sm font-bold text-gray-800 mb-1 flex items-center gap-2">👨‍⚕️ Cashier Performance</h3>
                    <p className="text-xs text-gray-400 mb-4">Top performers by revenue collected</p>
                    {metrics.cashierStats.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-6">No cashier data available</p>
                    ) : (
                        <div className="space-y-2.5">
                            {metrics.cashierStats.map((c, i) => {
                                const pct = metrics.totalRevenue > 0 ? Math.round((c.revenue / metrics.totalRevenue) * 100) : 0;
                                return (
                                    <div key={i} className="flex items-center gap-3">
                                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: CARD_COLORS[i % CARD_COLORS.length], color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>{i + 1}</div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-0.5">
                                                <span className="text-xs font-semibold text-gray-800 truncate">{c.name}</span>
                                                <span className="text-xs font-bold text-gray-700 ml-2 flex-shrink-0">Ksh {c.revenue.toLocaleString()}</span>
                                            </div>
                                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                <div style={{ width: `${pct}%`, background: CARD_COLORS[i % CARD_COLORS.length], height: '100%', borderRadius: 999 }} />
                                            </div>
                                            <div className="text-[10px] text-gray-400 mt-0.5">{c.count} sales &nbsp;•&nbsp; {pct}%</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    <div className="mt-4 p-3 rounded-xl" style={{ background: 'linear-gradient(135deg,rgba(16,185,129,0.06),rgba(5,150,105,0.1))', border: '1px solid rgba(16,185,129,0.2)' }}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[10px] text-emerald-700 font-bold uppercase">Est. Profit Margin</p>
                                <p className="text-xl font-black text-emerald-700">{metrics.profitMarginPct}%</p>
                            </div>
                            <span className="text-3xl opacity-30">📈</span>
                        </div>
                        <p className="text-[10px] text-emerald-600 mt-1">Based on avg product cost margin</p>
                    </div>
                </div>
            </div>

            {/* ==================== FILTERS ==================== */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
                        {[{ l: 'Today', v: 'today' }, { l: '7 Days', v: '7d' }, { l: '30 Days', v: '30d' }, { l: 'Month', v: 'month' }, { l: '3 Months', v: '3m' }].map(p => (
                            <button key={p.v} onClick={() => setDatePreset(p.v)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${preset === p.v ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{p.l}</button>
                        ))}
                    </div>
                    <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPreset(''); }} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-blue-400" />
                    <span className="text-gray-400 text-xs">→</span>
                    <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPreset(''); }} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-blue-400" />
                    <select value={filterPayment} onChange={e => setFilterPayment(e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-blue-400">
                        <option value="All">💳 All Methods</option>
                        <option value="Cash">💵 Cash</option>
                        <option value="Mpesa">📱 M-Pesa</option>
                        <option value="Credit">📋 Credit</option>
                        <option value="Card">💳 Card</option>
                    </select>
                    <select value={filterCashier} onChange={e => setFilterCashier(e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-blue-400">
                        <option value="All">👨‍⚕️ All Cashiers</option>
                        {cashierList.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-blue-400">
                        <option value="All">📌 All Statuses</option>
                        <option value="Completed">✅ Completed</option>
                        <option value="Pending">⏳ Pending</option>
                    </select>
                    <div className="flex-1 min-w-48">
                        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="🔍 Search receipt, customer, M-Pesa code, phone..." className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-blue-400" />
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap">Showing <strong className="text-gray-700">{filtered.length}</strong> / {sales.length}</span>
                </div>
            </div>

            {/* Discount Alert */}
            {metrics.totalDiscount > 0 && (
                <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'linear-gradient(135deg,rgba(245,158,11,0.07),rgba(217,119,6,0.1))', border: '1px solid rgba(245,158,11,0.25)' }}>
                    <span>🏷️</span>
                    <span className="text-xs font-medium text-amber-800">Discounts issued: <strong>Ksh {metrics.totalDiscount.toLocaleString()}</strong> across {filtered.filter(s => s.discount > 0).length} transactions</span>
                </div>
            )}

            {/* ==================== MAIN TABLE ==================== */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between" style={{ background: 'linear-gradient(90deg,#f8faff,#f0f4ff)' }}>
                    <h3 className="text-sm font-bold text-gray-800">📋 Transactions ({filtered.length})</h3>
                    <div className="text-xs text-gray-500">
                        Revenue: <strong className="text-gray-800">Ksh {metrics.totalRevenue.toLocaleString()}</strong>
                        &nbsp;•&nbsp; Est. Profit: <strong className="text-emerald-700">Ksh {metrics.estProfit.toLocaleString()}</strong>
                        &nbsp;•&nbsp; Margin: <strong className="text-emerald-700">{metrics.profitMarginPct}%</strong>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr style={{ background: 'linear-gradient(90deg,#f0f4ff,#f8f0ff)' }}>
                                {[
                                    { label: '#', align: 'left', sort: null },
                                    { label: `Date/Time${si('date')}`, align: 'left', sort: 'date' as const },
                                    { label: 'Receipt', align: 'left', sort: null },
                                    { label: 'Customer', align: 'left', sort: null },
                                    { label: 'Payment', align: 'center', sort: null },
                                    { label: `Total${si('total')}`, align: 'right', sort: 'total' as const },
                                    { label: `Discount${si('discount')}`, align: 'right', sort: 'discount' as const },
                                    { label: 'Est. Profit', align: 'right', sort: null },
                                    { label: 'M-Pesa Code', align: 'center', sort: null },
                                    { label: 'Cashier', align: 'center', sort: null },
                                    { label: 'Status', align: 'center', sort: null },
                                    { label: 'Action', align: 'center', sort: null },
                                ].map((col, ci) => (
                                    <th key={ci}
                                        className={`py-3 px-4 text-${col.align === 'right' ? 'right' : col.align === 'center' ? 'center' : 'left'} text-xs font-bold uppercase tracking-wide ${col.label === 'Est. Profit' ? 'text-emerald-600' : 'text-gray-500'} ${col.sort ? 'cursor-pointer hover:text-blue-600 select-none' : ''}`}
                                        onClick={() => col.sort ? toggleSort(col.sort) : undefined}
                                    >{col.label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={12} className="py-20 text-center">
                                    <div className="flex flex-col items-center gap-3 text-gray-400">
                                        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
                                        <span className="text-sm">Loading sales data...</span>
                                    </div>
                                </td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={12} className="py-20 text-center">
                                    <div className="flex flex-col items-center gap-2 text-gray-400">
                                        <span className="text-4xl">📭</span>
                                        <p className="text-sm font-medium">No sales found for this period</p>
                                        <p className="text-xs">Try adjusting the date range or filters</p>
                                    </div>
                                </td></tr>
                            ) : filtered.map((s, idx) => {
                                const ps = getPS(s.payment_method);
                                const ep = Math.round((s.total || 0) * avgMarginRate);
                                return (
                                    <tr key={s.sale_id} className="border-t border-gray-50 hover:bg-blue-50/25 transition-colors group" style={{ background: idx % 2 === 0 ? '#fff' : '#fafbff' }}>
                                        <td className="py-2.5 px-4 text-xs text-gray-400 font-mono">{idx + 1}</td>
                                        <td className="py-2.5 px-4">
                                            <p className="text-xs font-semibold text-gray-800">{fmtDate(s.sale_datetime)}</p>
                                            <p className="text-[10px] text-gray-400 font-mono">{fmtTime(s.sale_datetime)}</p>
                                        </td>
                                        <td className="py-2.5 px-4">
                                            <span className="text-xs font-bold text-blue-600 font-mono">{s.receipt_no}</span>
                                        </td>
                                        <td className="py-2.5 px-4">
                                            <p className="text-xs font-medium text-gray-800">{s.customer_name || 'Walk-in'}</p>
                                            {s.customer_phone && <p className="text-[10px] text-gray-400">{s.customer_phone}</p>}
                                        </td>
                                        <td className="py-2.5 px-4 text-center">
                                            <span style={{ padding: '2px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: ps.bg, color: ps.color, border: ps.border, display: 'inline-block' }}>{ps.text}</span>
                                        </td>
                                        <td className="py-2.5 px-4 text-right">
                                            <p className="text-xs font-bold text-gray-800">Ksh {(s.total || 0).toLocaleString()}</p>
                                            {s.subtotal !== s.total && <p className="text-[10px] text-gray-400">Sub: {(s.subtotal || 0).toLocaleString()}</p>}
                                        </td>
                                        <td className="py-2.5 px-4 text-right">
                                            {s.discount > 0
                                                ? <span className="text-xs font-semibold text-red-500">-{s.discount.toLocaleString()}</span>
                                                : <span className="text-xs text-gray-300">—</span>}
                                        </td>
                                        <td className="py-2.5 px-4 text-right">
                                            <span className="text-xs font-bold text-emerald-700">Ksh {ep.toLocaleString()}</span>
                                        </td>
                                        <td className="py-2.5 px-4 text-center">
                                            {s.mpesa_receipt
                                                ? <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold">{s.mpesa_receipt}</span>
                                                : <span className="text-xs text-gray-300">—</span>}
                                        </td>
                                        <td className="py-2.5 px-4 text-center text-xs text-gray-600">{s.cashier_name || '—'}</td>
                                        <td className="py-2.5 px-4 text-center">
                                            <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, display: 'inline-block', background: s.status === 'Completed' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', color: s.status === 'Completed' ? '#065f46' : '#92400e', border: s.status === 'Completed' ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(245,158,11,0.25)' }}>
                                                {s.status === 'Completed' ? '✅' : '⏳'} {s.status || 'Unknown'}
                                            </span>
                                        </td>
                                        <td className="py-2.5 px-4 text-center">
                                            <button onClick={() => { setSelectedSale(s); setShowDetail(true); }} className="px-3 py-1 rounded-lg text-xs font-semibold opacity-0 group-hover:opacity-100 transition-all" style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)', color: '#fff' }}>
                                                👁️ View
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        {filtered.length > 0 && (
                            <tfoot>
                                <tr style={{ background: 'linear-gradient(90deg,#f0f4ff,#f0fff4)', borderTop: '2px solid #e0e7ff' }}>
                                    <td colSpan={5} className="py-3 px-4 text-xs font-black text-gray-700">TOTALS — {filtered.length} orders</td>
                                    <td className="py-3 px-4 text-right text-xs font-black text-gray-800">Ksh {metrics.totalRevenue.toLocaleString()}</td>
                                    <td className="py-3 px-4 text-right text-xs font-black text-red-500">-{metrics.totalDiscount.toLocaleString()}</td>
                                    <td className="py-3 px-4 text-right text-xs font-black text-emerald-700">Ksh {metrics.estProfit.toLocaleString()}</td>
                                    <td colSpan={4} className="py-3 px-4 text-xs text-gray-400">Avg: Ksh {metrics.avgOrder.toLocaleString()} / order &nbsp;•&nbsp; Margin: {metrics.profitMarginPct}%</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            <p className="text-center text-[10px] text-gray-400">
                * Est. Profit uses <strong>{Math.round(avgMarginRate * 100)}%</strong> average margin from product catalogue. For exact line-item profit, expand sales items schema.
            </p>

            {/* ==================== DETAIL MODAL ==================== */}
            {showDetail && selectedSale && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowDetail(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()} style={{ border: '1px solid rgba(102,126,234,0.15)' }}>
                        <div style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)', borderRadius: '20px 20px 0 0', padding: '18px 22px' }}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 800, margin: 0 }}>🧾 Sale Details</h3>
                                    <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, margin: '2px 0 0' }}>{selectedSale.receipt_no} &nbsp;•&nbsp; {fmtDate(selectedSale.sale_datetime)} at {fmtTime(selectedSale.sale_datetime)}</p>
                                </div>
                                <button onClick={() => setShowDetail(false)} style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', border: 'none', color: '#fff', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                            </div>
                        </div>
                        <div className="p-5">
                            <div className="grid grid-cols-2 gap-2.5 mb-4">
                                {[
                                    { label: 'Customer', value: selectedSale.customer_name || 'Walk-in Patient', icon: '👤' },
                                    { label: 'Cashier', value: selectedSale.cashier_name || 'Unknown', icon: '👨‍⚕️' },
                                    { label: 'Payment Method', value: selectedSale.payment_method, icon: '💳' },
                                    { label: 'Status', value: selectedSale.status || 'Completed', icon: '📌' },
                                ].map((item, i) => (
                                    <div key={i} className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                                        <p className="text-[10px] text-gray-400 uppercase font-bold mb-0.5">{item.icon} {item.label}</p>
                                        <p className="text-xs font-bold text-gray-800">{item.value}</p>
                                    </div>
                                ))}
                            </div>
                            {selectedSale.customer_phone && (
                                <div className="p-3 rounded-xl mb-2.5 border" style={{ background: 'rgba(59,130,246,0.04)', borderColor: 'rgba(59,130,246,0.15)' }}>
                                    <p className="text-[10px] text-blue-600 uppercase font-bold">📞 Customer Phone</p>
                                    <p className="text-xs font-bold text-blue-700">{selectedSale.customer_phone}</p>
                                </div>
                            )}
                            {selectedSale.mpesa_receipt && (
                                <div className="p-3 rounded-xl mb-2.5 border" style={{ background: 'rgba(16,185,129,0.04)', borderColor: 'rgba(16,185,129,0.2)' }}>
                                    <p className="text-[10px] text-emerald-600 uppercase font-bold">📱 M-Pesa Transaction Code</p>
                                    <p className="text-xs font-bold text-emerald-700 font-mono">{selectedSale.mpesa_receipt}</p>
                                </div>
                            )}
                            {selectedSale.notes && (
                                <div className="p-3 rounded-xl mb-2.5 border border-amber-200 bg-amber-50">
                                    <p className="text-[10px] text-amber-700 uppercase font-bold">📝 Notes / Prescription</p>
                                    <p className="text-xs text-amber-800">{selectedSale.notes}</p>
                                </div>
                            )}
                            <div className="border-t border-gray-100 pt-4 space-y-2">
                                <div className="flex justify-between"><span className="text-xs text-gray-500">Subtotal</span><span className="text-xs font-semibold text-gray-700">Ksh {(selectedSale.subtotal || 0).toLocaleString()}</span></div>
                                {selectedSale.discount > 0 && <div className="flex justify-between"><span className="text-xs text-red-500">Discount</span><span className="text-xs font-semibold text-red-500">-Ksh {selectedSale.discount.toLocaleString()}</span></div>}
                                {selectedSale.tax > 0 && <div className="flex justify-between"><span className="text-xs text-gray-500">Tax</span><span className="text-xs font-semibold text-gray-700">Ksh {selectedSale.tax.toLocaleString()}</span></div>}
                                <div className="flex justify-between pt-2 border-t border-gray-100"><span className="text-sm font-black text-gray-800">Total Paid</span><span className="text-sm font-black text-blue-700">Ksh {(selectedSale.total || 0).toLocaleString()}</span></div>
                                <div className="flex justify-between p-3 rounded-xl" style={{ background: 'linear-gradient(135deg,rgba(16,185,129,0.06),rgba(5,150,105,0.1))', border: '1px solid rgba(16,185,129,0.18)' }}>
                                    <span className="text-xs font-bold text-emerald-700">Est. Gross Profit ({Math.round(avgMarginRate * 100)}%)</span>
                                    <span className="text-sm font-black text-emerald-700">Ksh {Math.round((selectedSale.total || 0) * avgMarginRate).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
