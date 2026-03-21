'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

interface ProfitItem {
    name: string; category: string; qtySold: number; revenue: number;
    costPrice: number; totalCost: number; profit: number; margin: number;
}

export default function ProfitReportPage() {
    const { activeOutlet } = useOutlet();
    const outletId = activeOutlet?.outlet_id || 1;
    const [items, setItems] = useState<ProfitItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
    const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
    const [filterCategory, setFilterCategory] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [categories, setCategories] = useState<string[]>([]);
    const [preset, setPreset] = useState('today');
    const [sortBy, setSortBy] = useState<'profit' | 'margin' | 'revenue'>('profit');

    const setDatePreset = (p: string) => {
        setPreset(p);
        const now = new Date();
        const to = now.toISOString().split('T')[0];
        let from = to;
        if (p === '7d') { const d = new Date(); d.setDate(d.getDate() - 7); from = d.toISOString().split('T')[0]; }
        else if (p === '30d') { const d = new Date(); d.setDate(d.getDate() - 30); from = d.toISOString().split('T')[0]; }
        else if (p === 'month') { from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`; }
        setDateFrom(from); setDateTo(to);
    };

    const loadData = useCallback(async () => {
        if (!activeOutlet) return;
        setLoading(true);
        try {
            // Get sales items in date range
            const { data: salesItems } = await supabase
                .from('retail_sales_items')
                .select('product_id, product_name, quantity, unit_price, subtotal, created_at')
                .gte('created_at', `${dateFrom}T00:00:00`)
                .lte('created_at', `${dateTo}T23:59:59`);

            // Get product costs
            const { data: products } = await supabase
                .from('retail_products')
                .select('pid, product_name, purchase_cost, sales_cost, category')
                .eq('outlet_id', outletId);

            const costMap: Record<number, { cost: number; category: string }> = {};
            (products || []).forEach(p => { costMap[p.pid] = { cost: p.purchase_cost || 0, category: p.category || 'Uncategorized' }; });

            // Aggregate by product
            const profitMap = new Map<string, ProfitItem>();
            (salesItems || []).forEach(item => {
                const key = item.product_name || 'Unknown';
                const pid = item.product_id;
                const info = costMap[pid] || { cost: 0, category: 'Uncategorized' };
                if (!profitMap.has(key)) {
                    profitMap.set(key, { name: key, category: info.category, qtySold: 0, revenue: 0, costPrice: info.cost, totalCost: 0, profit: 0, margin: 0 });
                }
                const e = profitMap.get(key)!;
                e.qtySold += item.quantity || 0;
                e.revenue += item.subtotal || 0;
                e.totalCost += (info.cost * (item.quantity || 0));
            });

            const result: ProfitItem[] = Array.from(profitMap.values()).map(p => ({
                ...p,
                profit: p.revenue - p.totalCost,
                margin: p.revenue > 0 ? Math.round(((p.revenue - p.totalCost) / p.revenue) * 100) : 0,
            }));

            setItems(result);
            const cats = Array.from(new Set(result.map(r => r.category))).sort();
            setCategories(cats);
        } catch (err) {
            console.error(err);
            toast.error('Failed to load profit data');
        }
        setLoading(false);
    }, [dateFrom, dateTo, outletId, activeOutlet]);

    useEffect(() => { loadData(); }, [loadData]);

    const filtered = items.filter(i => {
        const matchCat = filterCategory === 'All' || i.category === filterCategory;
        const matchSearch = !searchQuery || i.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchCat && matchSearch;
    }).sort((a, b) => sortBy === 'margin' ? b.margin - a.margin : sortBy === 'revenue' ? b.revenue - a.revenue : b.profit - a.profit);

    const totalRevenue = filtered.reduce((s, i) => s + i.revenue, 0);
    const totalCOGS = filtered.reduce((s, i) => s + i.totalCost, 0);
    const grossProfit = totalRevenue - totalCOGS;
    const overallMargin = totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 100) : 0;

    const exportCSV = () => {
        const rows = [['Product', 'Category', 'Qty Sold', 'Revenue', 'Cost Price', 'Total Cost', 'Profit', 'Margin%']];
        filtered.forEach(i => rows.push([i.name, i.category, String(i.qtySold), String(i.revenue), String(i.costPrice), String(i.totalCost), String(i.profit), `${i.margin}%`]));
        const csv = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `profit_report_${dateFrom}_${dateTo}.csv`; a.click();
        toast.success('CSV exported!');
    };

    const printReport = () => {
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Profit Report</title>
<style>@page{margin:8mm;size:A4;}body{font-family:Arial,sans-serif;font-size:11px;}h1{font-size:16px;}
table{width:100%;border-collapse:collapse;margin-top:8px;}th,td{border:1px solid #ddd;padding:4px 6px;font-size:10px;}
th{background:#f5f5f5;font-weight:700;}.r{text-align:right;}.b{font-weight:700;}.g{color:green;}.rd{color:red;}</style></head><body>
<h1>💹 Profit Report</h1><p style="font-size:10px;color:#555;">${activeOutlet?.outlet_name || 'Alpha Retail'} | ${dateFrom} to ${dateTo}</p>
<p><strong>Revenue:</strong> Ksh ${totalRevenue.toLocaleString()} | <strong>COGS:</strong> Ksh ${totalCOGS.toLocaleString()} | <strong>Gross Profit:</strong> Ksh ${grossProfit.toLocaleString()} (${overallMargin}%)</p>
<table><tr><th>Product</th><th>Category</th><th class="r">Qty</th><th class="r">Revenue</th><th class="r">COGS</th><th class="r">Profit</th><th class="r">Margin</th></tr>
${filtered.map(i => `<tr><td>${i.name}</td><td>${i.category}</td><td class="r">${i.qtySold}</td><td class="r">Ksh ${i.revenue.toLocaleString()}</td><td class="r">Ksh ${i.totalCost.toLocaleString()}</td><td class="r ${i.profit >= 0 ? 'g' : 'rd'} b">Ksh ${i.profit.toLocaleString()}</td><td class="r">${i.margin}%</td></tr>`).join('')}
</table></body></html>`;
        const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); w.print(); }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                    <span className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg">💹</span>
                    Profit Report
                </h1>
                <div className="flex gap-2">
                    <button onClick={exportCSV} className="px-4 py-2 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 text-sm">📥 Export CSV</button>
                    <button onClick={printReport} className="px-4 py-2 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 text-sm">🖨️ Print</button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Revenue Analysis', sub: 'Total Revenue', value: `Ksh ${totalRevenue.toLocaleString()}`, border: 'border-l-blue-500', bg: 'bg-blue-50/40', iconBg: 'bg-blue-100', iconColor: 'text-blue-600', icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/><path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd"/></svg> },
                    { label: 'Cost of Goods', sub: 'Total COGS', value: `Ksh ${totalCOGS.toLocaleString()}`, border: 'border-l-red-500', bg: 'bg-red-50/40', iconBg: 'bg-red-100', iconColor: 'text-red-600', icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd"/></svg> },
                    { label: 'Profit Analysis', sub: grossProfit >= 0 ? 'Gross Profit' : 'Gross Loss', value: `Ksh ${grossProfit.toLocaleString()}`, border: grossProfit >= 0 ? 'border-l-green-500' : 'border-l-red-500', bg: grossProfit >= 0 ? 'bg-green-50/40' : 'bg-red-50/40', iconBg: grossProfit >= 0 ? 'bg-green-100' : 'bg-red-100', iconColor: grossProfit >= 0 ? 'text-green-600' : 'text-red-600', icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd"/></svg> },
                    { label: 'Margin Rate', sub: 'Profit Margin', value: `${overallMargin}%`, border: overallMargin >= 20 ? 'border-l-teal-500' : 'border-l-amber-500', bg: overallMargin >= 20 ? 'bg-teal-50/40' : 'bg-amber-50/40', iconBg: overallMargin >= 20 ? 'bg-teal-100' : 'bg-amber-100', iconColor: overallMargin >= 20 ? 'text-teal-600' : 'text-amber-600', icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 0l-2 2a1 1 0 101.414 1.414L8 10.414l1.293 1.293a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg> },
                ].map((card, i) => (
                    <div key={i} className={`bg-white rounded-xl border border-gray-100 border-l-4 ${card.border} ${card.bg} p-4 shadow-sm hover:shadow-md transition-all group`}>
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{card.label}</p>
                                <p className="text-xl font-extrabold text-gray-800 mt-1">{card.value}</p>
                                <p className="text-[11px] text-gray-500 mt-0.5">{card.sub}</p>
                            </div>
                            <div className={`w-9 h-9 rounded-lg ${card.iconBg} ${card.iconColor} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                                {card.icon}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="bg-white rounded-2xl border p-4 flex items-center gap-4 flex-wrap">
                <div className="flex gap-1">
                    {[{ l: 'Today', v: 'today' }, { l: '7 Days', v: '7d' }, { l: '30 Days', v: '30d' }, { l: 'Month', v: 'month' }].map(p => (
                        <button key={p.v} onClick={() => setDatePreset(p.v)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${preset === p.v ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{p.l}</button>
                    ))}
                </div>
                <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPreset(''); }} className="px-3 py-1.5 border rounded-lg text-sm" />
                <span className="text-gray-400">to</span>
                <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPreset(''); }} className="px-3 py-1.5 border rounded-lg text-sm" />
                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="px-3 py-1.5 border rounded-lg text-sm">
                    <option value="All">All Categories</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="px-3 py-1.5 border rounded-lg text-sm">
                    <option value="profit">Sort by Profit</option><option value="margin">Sort by Margin</option><option value="revenue">Sort by Revenue</option>
                </select>
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="🔍 Search product..." className="flex-1 px-3 py-1.5 border rounded-lg text-sm" />
            </div>

            {/* Profit Table */}
            <div className="bg-white rounded-2xl border overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gradient-to-r from-emerald-50 to-green-50">
                        <tr>
                            <th className="text-left py-3 px-4 text-xs font-bold text-gray-600">Product</th>
                            <th className="text-left py-3 px-4 text-xs font-bold text-gray-600">Category</th>
                            <th className="text-right py-3 px-4 text-xs font-bold text-gray-600">Qty Sold</th>
                            <th className="text-right py-3 px-4 text-xs font-bold text-gray-600">Revenue</th>
                            <th className="text-right py-3 px-4 text-xs font-bold text-gray-600">Cost/Unit</th>
                            <th className="text-right py-3 px-4 text-xs font-bold text-gray-600">Total COGS</th>
                            <th className="text-right py-3 px-4 text-xs font-bold text-gray-600">Profit</th>
                            <th className="text-right py-3 px-4 text-xs font-bold text-gray-600">Margin</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={8} className="py-16 text-center text-gray-400">Loading profit data...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={8} className="py-16 text-center text-gray-400">No sales data found</td></tr>
                        ) : filtered.map((item, i) => (
                            <tr key={i} className="border-t hover:bg-green-50/30">
                                <td className="py-3 px-4 font-semibold text-sm">{item.name}</td>
                                <td className="py-3 px-4 text-sm"><span className="px-2 py-1 bg-gray-100 rounded-full text-xs">{item.category}</span></td>
                                <td className="py-3 px-4 text-right text-sm">{item.qtySold}</td>
                                <td className="py-3 px-4 text-right text-sm font-medium">Ksh {item.revenue.toLocaleString()}</td>
                                <td className="py-3 px-4 text-right text-sm text-gray-500">Ksh {item.costPrice.toLocaleString()}</td>
                                <td className="py-3 px-4 text-right text-sm text-red-500">Ksh {item.totalCost.toLocaleString()}</td>
                                <td className={`py-3 px-4 text-right font-bold text-sm ${item.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    Ksh {item.profit.toLocaleString()}
                                </td>
                                <td className="py-3 px-4 text-right">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${item.margin >= 30 ? 'bg-green-100 text-green-700' : item.margin >= 15 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                        {item.margin}%
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    {filtered.length > 0 && (
                        <tfoot>
                            <tr className="bg-gradient-to-r from-emerald-50 to-green-50 font-bold">
                                <td colSpan={2} className="py-3 px-4 text-sm">TOTALS ({filtered.length} products)</td>
                                <td className="py-3 px-4 text-right text-sm">{filtered.reduce((s, i) => s + i.qtySold, 0)}</td>
                                <td className="py-3 px-4 text-right text-sm">Ksh {totalRevenue.toLocaleString()}</td>
                                <td className="py-3 px-4 text-right text-sm" />
                                <td className="py-3 px-4 text-right text-sm text-red-500">Ksh {totalCOGS.toLocaleString()}</td>
                                <td className={`py-3 px-4 text-right text-sm ${grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>Ksh {grossProfit.toLocaleString()}</td>
                                <td className="py-3 px-4 text-right text-sm">{overallMargin}%</td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </div>
    );
}
