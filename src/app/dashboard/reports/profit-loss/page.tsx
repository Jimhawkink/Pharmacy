'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

interface ExpenseCategory { name: string; amount: number; }

export default function ProfitLossPage() {
    const { activeOutlet } = useOutlet();
    const outletId = activeOutlet?.outlet_id || 1;
    const [loading, setLoading] = useState(true);
    const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; });
    const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
    const [preset, setPreset] = useState('month');

    // P&L data
    const [grossSales, setGrossSales] = useState(0);
    const [salesReturns, setSalesReturns] = useState(0);
    const [totalCOGS, setTotalCOGS] = useState(0);
    const [purchases, setPurchases] = useState(0);
    const [openingStock, setOpeningStock] = useState(0);
    const [closingStock, setClosingStock] = useState(0);
    const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
    const [totalExpenses, setTotalExpenses] = useState(0);

    const netRevenue = grossSales - salesReturns;
    const grossProfit = netRevenue - totalCOGS;
    const netProfit = grossProfit - totalExpenses;
    const grossMargin = netRevenue > 0 ? Math.round((grossProfit / netRevenue) * 100) : 0;
    const netMargin = netRevenue > 0 ? Math.round((netProfit / netRevenue) * 100) : 0;

    const setDatePreset = (p: string) => {
        setPreset(p);
        const now = new Date();
        const to = now.toISOString().split('T')[0];
        let from = to;
        if (p === 'today') from = to;
        else if (p === '7d') { const d = new Date(); d.setDate(d.getDate() - 7); from = d.toISOString().split('T')[0]; }
        else if (p === 'month') from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        else if (p === 'quarter') { const qm = Math.floor(now.getMonth() / 3) * 3; from = `${now.getFullYear()}-${String(qm + 1).padStart(2, '0')}-01`; }
        else if (p === 'year') from = `${now.getFullYear()}-01-01`;
        setDateFrom(from); setDateTo(to);
    };

    const loadData = useCallback(async () => {
        if (!activeOutlet) return;
        setLoading(true);
        try {
            // Gross Sales
            const { data: salesData } = await supabase
                .from('retail_sales').select('total_amount').eq('outlet_id', outletId)
                .gte('sale_date', dateFrom).lte('sale_date', dateTo);
            setGrossSales((salesData || []).reduce((s, r) => s + (r.total_amount || 0), 0));

            // Sales Returns (currently zero if not tracked)
            setSalesReturns(0);

            // COGS: purchase_cost × quantity for items sold in period
            const { data: salesItems } = await supabase
                .from('retail_sales_items').select('product_id, quantity')
                .gte('created_at', `${dateFrom}T00:00:00`).lte('created_at', `${dateTo}T23:59:59`);
            const { data: products } = await supabase
                .from('retail_products').select('pid, purchase_cost').eq('outlet_id', outletId);
            const costMap: Record<number, number> = {};
            (products || []).forEach(p => { costMap[p.pid] = p.purchase_cost || 0; });
            let cogs = 0;
            (salesItems || []).forEach(item => {
                cogs += (costMap[item.product_id] || 0) * (item.quantity || 0);
            });
            setTotalCOGS(cogs);

            // Purchases in period
            const { data: purchaseData } = await supabase
                .from('retail_purchases').select('grand_total').eq('outlet_id', outletId)
                .gte('purchase_date', dateFrom).lte('purchase_date', dateTo);
            setPurchases((purchaseData || []).reduce((s, r) => s + (r.grand_total || 0), 0));

            // Stock values (current = closing stock)
            const { data: stockData } = await supabase.from('retail_stock').select('pid, qty').eq('outlet_id', outletId);
            let closVal = 0;
            (stockData || []).forEach(s => {
                closVal += (s.qty || 0) * (costMap[s.pid] || 0);
            });
            setClosingStock(closVal);
            // Opening stock = closing + COGS - purchases (approximate)
            setOpeningStock(closVal + cogs - (purchaseData || []).reduce((s, r) => s + (r.grand_total || 0), 0));

            // Expenses by category
            const { data: expData } = await supabase
                .from('expenses').select('category, amount')
                .gte('expense_date', dateFrom).lte('expense_date', dateTo);
            const expMap = new Map<string, number>();
            (expData || []).forEach(e => {
                const cat = e.category || 'Other';
                expMap.set(cat, (expMap.get(cat) || 0) + (e.amount || 0));
            });
            const cats = Array.from(expMap.entries()).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
            setExpenseCategories(cats);
            setTotalExpenses(cats.reduce((s, c) => s + c.amount, 0));
        } catch (err) { console.error(err); toast.error('Failed to load P&L data'); }
        setLoading(false);
    }, [dateFrom, dateTo, outletId, activeOutlet]);

    useEffect(() => { loadData(); }, [loadData]);

    const printReport = () => {
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Profit & Loss</title>
<style>@page{margin:10mm;size:A4;}body{font-family:Arial,sans-serif;font-size:11px;}h1{font-size:16px;text-align:center;}
h2{font-size:13px;border-bottom:2px solid #333;padding-bottom:3px;margin-top:12px;}
.row{display:flex;justify-content:space-between;padding:3px 0;}.indent{padding-left:24px;}.bold{font-weight:700;}
.line{border-top:1px solid #333;margin:4px 0;}.dline{border-top:3px double #333;margin:6px 0;}
.neg{color:red;}.pos{color:green;}</style></head><body>
<h1>📉 Profit & Loss Statement</h1>
<p style="text-align:center;font-size:10px;color:#555;">${activeOutlet?.outlet_name || 'Alpha Retail'} | ${dateFrom} to ${dateTo}</p>
<h2>INCOME</h2>
<div class="row indent"><span>Gross Sales</span><span>Ksh ${grossSales.toLocaleString()}</span></div>
<div class="row indent"><span>Less: Sales Returns</span><span>(Ksh ${salesReturns.toLocaleString()})</span></div>
<div class="line"></div>
<div class="row bold"><span>Net Revenue</span><span>Ksh ${netRevenue.toLocaleString()}</span></div>
<h2>COST OF GOODS SOLD</h2>
<div class="row indent"><span>Opening Stock</span><span>Ksh ${openingStock.toLocaleString()}</span></div>
<div class="row indent"><span>Add: Purchases</span><span>Ksh ${purchases.toLocaleString()}</span></div>
<div class="row indent"><span>Less: Closing Stock</span><span>(Ksh ${closingStock.toLocaleString()})</span></div>
<div class="line"></div>
<div class="row bold"><span>Cost of Goods Sold</span><span>Ksh ${totalCOGS.toLocaleString()}</span></div>
<div class="dline"></div>
<div class="row bold" style="font-size:13px;"><span>GROSS PROFIT</span><span class="${grossProfit >= 0 ? 'pos' : 'neg'}">Ksh ${grossProfit.toLocaleString()} (${grossMargin}%)</span></div>
<h2>OPERATING EXPENSES</h2>
${expenseCategories.map(c => `<div class="row indent"><span>${c.name}</span><span>Ksh ${c.amount.toLocaleString()}</span></div>`).join('')}
<div class="line"></div>
<div class="row bold"><span>Total Expenses</span><span>Ksh ${totalExpenses.toLocaleString()}</span></div>
<div class="dline"></div>
<div class="row bold" style="font-size:14px;"><span>NET ${netProfit >= 0 ? 'PROFIT' : 'LOSS'}</span><span class="${netProfit >= 0 ? 'pos' : 'neg'}">Ksh ${Math.abs(netProfit).toLocaleString()} (${netMargin}%)</span></div>
<p style="margin-top:16px;font-size:8px;color:#888;">Printed: ${new Date().toLocaleString('en-GB')}</p></body></html>`;
        const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); w.print(); }
    };

    const StatRow = ({ label, value, indent, bold, line, dline, negative }: any) => (
        <>
            {line && <div className="border-t border-gray-300 my-1" />}
            {dline && <div className="border-t-4 border-double border-gray-800 my-2" />}
            <div className={`flex justify-between py-1.5 ${indent ? 'pl-8' : ''} ${bold ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
                <span className="text-sm">{label}</span>
                <span className={`text-sm font-mono ${negative ? 'text-red-600' : bold ? '' : ''}`}>
                    {negative ? `(Ksh ${Math.abs(value).toLocaleString()})` : `Ksh ${value.toLocaleString()}`}
                </span>
            </div>
        </>
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                    <span className="w-12 h-12 bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg">📉</span>
                    Profit & Loss Statement
                </h1>
                <button onClick={printReport} className="px-4 py-2 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 text-sm">🖨️ Print Report</button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                    { label: 'Income Statement', sub: 'Net Revenue', value: `Ksh ${netRevenue.toLocaleString()}`, border: 'border-l-blue-500', bg: 'bg-blue-50/40', iconBg: 'bg-blue-100', iconColor: 'text-blue-600', icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/><path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd"/></svg> },
                    { label: 'Cost Analysis', sub: 'COGS', value: `Ksh ${totalCOGS.toLocaleString()}`, border: 'border-l-red-500', bg: 'bg-red-50/40', iconBg: 'bg-red-100', iconColor: 'text-red-600', icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd"/></svg> },
                    { label: 'Gross Analysis', sub: `Gross Profit (${grossMargin}%)`, value: `Ksh ${grossProfit.toLocaleString()}`, border: grossProfit >= 0 ? 'border-l-green-500' : 'border-l-red-500', bg: grossProfit >= 0 ? 'bg-green-50/40' : 'bg-red-50/40', iconBg: grossProfit >= 0 ? 'bg-green-100' : 'bg-red-100', iconColor: grossProfit >= 0 ? 'text-green-600' : 'text-red-600', icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd"/></svg> },
                    { label: 'Operating Costs', sub: 'Total Expenses', value: `Ksh ${totalExpenses.toLocaleString()}`, border: 'border-l-orange-500', bg: 'bg-orange-50/40', iconBg: 'bg-orange-100', iconColor: 'text-orange-600', icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd"/></svg> },
                    { label: netProfit >= 0 ? 'Net Earnings' : 'Net Deficit', sub: `Net ${netProfit >= 0 ? 'Profit' : 'Loss'} (${netMargin}%)`, value: `Ksh ${Math.abs(netProfit).toLocaleString()}`, border: netProfit >= 0 ? 'border-l-teal-500' : 'border-l-red-500', bg: netProfit >= 0 ? 'bg-teal-50/40' : 'bg-red-50/40', iconBg: netProfit >= 0 ? 'bg-teal-100' : 'bg-red-100', iconColor: netProfit >= 0 ? 'text-teal-600' : 'text-red-600', icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd"/></svg> },
                ].map((card, i) => (
                    <div key={i} className={`bg-white rounded-xl border border-gray-100 border-l-4 ${card.border} ${card.bg} p-4 shadow-sm hover:shadow-md transition-all group`}>
                        <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 truncate">{card.label}</p>
                                <p className="text-lg font-extrabold text-gray-800 mt-1">{card.value}</p>
                                <p className="text-[11px] text-gray-500 mt-0.5">{card.sub}</p>
                            </div>
                            <div className={`w-9 h-9 rounded-lg ${card.iconBg} ${card.iconColor} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                                {card.icon}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Date Filters */}
            <div className="bg-white rounded-2xl border p-4 flex items-center gap-4">
                <div className="flex gap-1">
                    {[{ l: 'Today', v: 'today' }, { l: '7d', v: '7d' }, { l: 'Month', v: 'month' }, { l: 'Quarter', v: 'quarter' }, { l: 'Year', v: 'year' }].map(p => (
                        <button key={p.v} onClick={() => setDatePreset(p.v)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${preset === p.v ? 'bg-rose-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{p.l}</button>
                    ))}
                </div>
                <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPreset(''); }} className="px-3 py-1.5 border rounded-lg text-sm" />
                <span className="text-gray-400">to</span>
                <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPreset(''); }} className="px-3 py-1.5 border rounded-lg text-sm" />
            </div>

            {loading ? (
                <div className="bg-white rounded-2xl border p-16 text-center text-gray-400">Loading P&L statement...</div>
            ) : (
                <div className="bg-white rounded-2xl border p-6 max-w-3xl mx-auto">
                    <h2 className="text-center text-lg font-bold text-gray-800 mb-1">{activeOutlet?.outlet_name || 'Alpha Retail'}</h2>
                    <p className="text-center text-sm text-gray-500 mb-6">Profit & Loss Statement for the period {dateFrom} to {dateTo}</p>

                    <div className="bg-blue-50 rounded-xl px-5 py-2 mb-3 text-sm font-bold text-blue-800">📊 INCOME</div>
                    <div className="px-2">
                        <StatRow label="Gross Sales" value={grossSales} indent />
                        <StatRow label="Less: Sales Returns" value={salesReturns} indent negative={salesReturns > 0} />
                        <StatRow label="Net Revenue" value={netRevenue} bold line />
                    </div>

                    <div className="bg-red-50 rounded-xl px-5 py-2 mt-4 mb-3 text-sm font-bold text-red-800">📦 COST OF GOODS SOLD</div>
                    <div className="px-2">
                        <StatRow label="Opening Stock" value={openingStock} indent />
                        <StatRow label="Add: Purchases" value={purchases} indent />
                        <StatRow label="Less: Closing Stock" value={closingStock} indent negative />
                        <StatRow label="Cost of Goods Sold" value={totalCOGS} bold line />
                    </div>

                    <div className="bg-green-50 rounded-xl px-5 py-3 mt-4 text-sm font-bold text-green-800 flex justify-between">
                        <span>GROSS PROFIT</span>
                        <span className={grossProfit >= 0 ? '' : 'text-red-600'}>Ksh {grossProfit.toLocaleString()} ({grossMargin}%)</span>
                    </div>

                    <div className="bg-orange-50 rounded-xl px-5 py-2 mt-4 mb-3 text-sm font-bold text-orange-800">💸 OPERATING EXPENSES</div>
                    <div className="px-2">
                        {expenseCategories.map(cat => (
                            <StatRow key={cat.name} label={cat.name} value={cat.amount} indent />
                        ))}
                        {expenseCategories.length === 0 && <p className="text-sm text-gray-400 pl-8 py-2">No expenses recorded</p>}
                        <StatRow label="Total Expenses" value={totalExpenses} bold line />
                    </div>

                    <div className={`rounded-xl px-5 py-4 mt-4 font-bold text-lg flex justify-between ${netProfit >= 0 ? 'bg-teal-50 text-teal-800' : 'bg-red-100 text-red-800'}`}>
                        <span>NET {netProfit >= 0 ? 'PROFIT' : 'LOSS'}</span>
                        <span>Ksh {Math.abs(netProfit).toLocaleString()} ({netMargin}%)</span>
                    </div>
                </div>
            )}
        </div>
    );
}
