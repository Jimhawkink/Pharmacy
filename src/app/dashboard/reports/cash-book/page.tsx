'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

interface CashEntry {
    date: string; time: string; description: string; reference: string;
    type: 'inflow' | 'outflow'; amount: number; balance: number; category: string;
}

export default function CashBookPage() {
    const { activeOutlet } = useOutlet();
    const outletId = activeOutlet?.outlet_id || 1;
    const [entries, setEntries] = useState<CashEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
    const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
    const [filterType, setFilterType] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [preset, setPreset] = useState('today');

    const setDatePreset = (p: string) => {
        setPreset(p);
        const now = new Date();
        const to = now.toISOString().split('T')[0];
        let from = to;
        if (p === '7d') { const d = new Date(); d.setDate(d.getDate() - 7); from = d.toISOString().split('T')[0]; }
        else if (p === '30d') { const d = new Date(); d.setDate(d.getDate() - 30); from = d.toISOString().split('T')[0]; }
        else if (p === 'month') from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        setDateFrom(from); setDateTo(to);
    };

    const loadData = useCallback(async () => {
        if (!activeOutlet) return;
        setLoading(true);
        try {
            const allEntries: CashEntry[] = [];

            // Cash Sales (inflows)
            const { data: salesData } = await supabase.from('retail_sales')
                .select('sale_date, sale_datetime, receipt_no, customer_name, total_amount, payment_method')
                .eq('outlet_id', outletId)
                .gte('sale_date', dateFrom).lte('sale_date', dateTo)
                .ilike('payment_method', '%cash%')
                .order('sale_datetime');

            (salesData || []).forEach(s => {
                allEntries.push({
                    date: s.sale_date, time: s.sale_datetime?.split('T')[1]?.slice(0, 5) || '',
                    description: `Cash Sale — ${s.customer_name || 'Walk-in'}`,
                    reference: s.receipt_no, type: 'inflow', amount: s.total_amount || 0,
                    balance: 0, category: 'Sales',
                });
            });

            // Cash Expenses (outflows)
            const { data: expData } = await supabase.from('expenses')
                .select('expense_date, expense_name, category, amount, reference_no, payment_mode')
                .gte('expense_date', dateFrom).lte('expense_date', dateTo)
                .ilike('payment_mode', '%cash%');

            (expData || []).forEach(e => {
                allEntries.push({
                    date: e.expense_date, time: '',
                    description: `${e.expense_name} (${e.category || 'Expense'})`,
                    reference: e.reference_no || '-', type: 'outflow', amount: e.amount || 0,
                    balance: 0, category: e.category || 'Expense',
                });
            });

            // Cash Purchases (outflows)
            const { data: purchData } = await supabase.from('retail_purchases')
                .select('purchase_date, supplier_name, purchase_no, grand_total, payment_mode')
                .eq('outlet_id', outletId)
                .gte('purchase_date', dateFrom).lte('purchase_date', dateTo);

            (purchData || []).forEach(p => {
                if ((p.payment_mode || 'cash').toLowerCase().includes('cash')) {
                    allEntries.push({
                        date: p.purchase_date, time: '',
                        description: `Purchase — ${p.supplier_name || 'Supplier'}`,
                        reference: p.purchase_no || '-', type: 'outflow', amount: p.grand_total || 0,
                        balance: 0, category: 'Purchases',
                    });
                }
            });

            // Sort by date + time
            allEntries.sort((a, b) => {
                const da = a.date + a.time;
                const db = b.date + b.time;
                return da.localeCompare(db);
            });

            // Calculate running balance
            let runningBalance = 0;
            allEntries.forEach(e => {
                if (e.type === 'inflow') runningBalance += e.amount;
                else runningBalance -= e.amount;
                e.balance = runningBalance;
            });

            setEntries(allEntries);
        } catch (err) { console.error(err); toast.error('Failed to load cash book'); }
        setLoading(false);
    }, [dateFrom, dateTo, outletId, activeOutlet]);

    useEffect(() => { loadData(); }, [loadData]);

    const filtered = entries.filter(e => {
        const matchType = filterType === 'All' || e.type === filterType.toLowerCase();
        const q = searchQuery.toLowerCase();
        const matchSearch = !q || e.description.toLowerCase().includes(q) || e.reference.toLowerCase().includes(q);
        return matchType && matchSearch;
    });

    const totalInflows = entries.filter(e => e.type === 'inflow').reduce((s, e) => s + e.amount, 0);
    const totalOutflows = entries.filter(e => e.type === 'outflow').reduce((s, e) => s + e.amount, 0);
    const closingBalance = totalInflows - totalOutflows;

    const exportCSV = () => {
        const rows = [['Date', 'Time', 'Description', 'Reference', 'Type', 'Inflow', 'Outflow', 'Balance']];
        entries.forEach(e => rows.push([e.date, e.time, e.description, e.reference, e.type, e.type === 'inflow' ? String(e.amount) : '', e.type === 'outflow' ? String(e.amount) : '', String(e.balance)]));
        const csv = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `cash_book_${dateFrom}_${dateTo}.csv`; a.click();
        toast.success('CSV exported!');
    };

    const printReport = () => {
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Cash Book</title>
<style>@page{margin:8mm;size:A4;}body{font-family:Arial,sans-serif;font-size:10px;}h1{font-size:16px;text-align:center;}
table{width:100%;border-collapse:collapse;margin-top:8px;}th,td{border:1px solid #ddd;padding:3px 5px;font-size:9px;}
th{background:#f5f5f5;font-weight:700;}.r{text-align:right;}.g{color:green;font-weight:700;}.rd{color:red;font-weight:700;}.total{background:#e8f0ff;}</style></head><body>
<h1>💵 Cash Book</h1><p style="text-align:center;font-size:9px;color:#555;">${activeOutlet?.outlet_name || ''} | ${dateFrom} to ${dateTo}</p>
<p><strong>Inflows:</strong> Ksh ${totalInflows.toLocaleString()} | <strong>Outflows:</strong> Ksh ${totalOutflows.toLocaleString()} | <strong>Balance:</strong> Ksh ${closingBalance.toLocaleString()}</p>
<table><tr><th>Date</th><th>Time</th><th>Description</th><th>Ref</th><th class="r">Inflow</th><th class="r">Outflow</th><th class="r">Balance</th></tr>
${entries.map(e => `<tr><td>${e.date}</td><td>${e.time}</td><td>${e.description}</td><td>${e.reference}</td><td class="r g">${e.type === 'inflow' ? e.amount.toLocaleString() : ''}</td><td class="r rd">${e.type === 'outflow' ? e.amount.toLocaleString() : ''}</td><td class="r">${e.balance.toLocaleString()}</td></tr>`).join('')}
<tr class="total"><td colspan="4"><strong>TOTALS</strong></td><td class="r g"><strong>${totalInflows.toLocaleString()}</strong></td><td class="r rd"><strong>${totalOutflows.toLocaleString()}</strong></td><td class="r"><strong>${closingBalance.toLocaleString()}</strong></td></tr>
</table></body></html>`;
        const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); w.print(); }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                    <span className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg">💵</span>
                    Cash Book
                </h1>
                <div className="flex gap-2">
                    <button onClick={exportCSV} className="px-4 py-2 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 text-sm">📥 Export CSV</button>
                    <button onClick={printReport} className="px-4 py-2 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 text-sm">🖨️ Print</button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Period Start', sub: 'Opening Balance', value: 'Ksh 0', border: 'border-l-blue-500', bg: 'bg-blue-50/40', iconBg: 'bg-blue-100', iconColor: 'text-blue-600', icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd"/></svg> },
                    { label: 'Cash Receipts', sub: 'Total Inflows', value: `Ksh ${totalInflows.toLocaleString()}`, border: 'border-l-green-500', bg: 'bg-green-50/40', iconBg: 'bg-green-100', iconColor: 'text-green-600', icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd"/></svg> },
                    { label: 'Cash Payments', sub: 'Total Outflows', value: `Ksh ${totalOutflows.toLocaleString()}`, border: 'border-l-red-500', bg: 'bg-red-50/40', iconBg: 'bg-red-100', iconColor: 'text-red-600', icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd"/></svg> },
                    { label: 'Cash Position', sub: 'Closing Balance', value: `Ksh ${closingBalance.toLocaleString()}`, border: closingBalance >= 0 ? 'border-l-teal-500' : 'border-l-red-500', bg: closingBalance >= 0 ? 'bg-teal-50/40' : 'bg-red-50/40', iconBg: closingBalance >= 0 ? 'bg-teal-100' : 'bg-red-100', iconColor: closingBalance >= 0 ? 'text-teal-600' : 'text-red-600', icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/><path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd"/></svg> },
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
                        <button key={p.v} onClick={() => setDatePreset(p.v)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${preset === p.v ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{p.l}</button>
                    ))}
                </div>
                <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPreset(''); }} className="px-3 py-1.5 border rounded-lg text-sm" />
                <span className="text-gray-400">to</span>
                <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPreset(''); }} className="px-3 py-1.5 border rounded-lg text-sm" />
                <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-1.5 border rounded-lg text-sm">
                    <option value="All">All Transactions</option><option value="inflow">Inflows Only</option><option value="outflow">Outflows Only</option>
                </select>
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="🔍 Search description, ref..." className="flex-1 px-3 py-1.5 border rounded-lg text-sm" />
            </div>

            {/* Cash Book Table */}
            <div className="bg-white rounded-2xl border overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gradient-to-r from-amber-50 to-yellow-50">
                        <tr>
                            <th className="text-left py-3 px-4 text-xs font-bold text-gray-600">Date</th>
                            <th className="text-left py-3 px-4 text-xs font-bold text-gray-600">Time</th>
                            <th className="text-left py-3 px-4 text-xs font-bold text-gray-600">Description</th>
                            <th className="text-left py-3 px-4 text-xs font-bold text-gray-600">Reference</th>
                            <th className="text-right py-3 px-4 text-xs font-bold text-green-700">Inflow (Ksh)</th>
                            <th className="text-right py-3 px-4 text-xs font-bold text-red-700">Outflow (Ksh)</th>
                            <th className="text-right py-3 px-4 text-xs font-bold text-gray-600">Balance (Ksh)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={7} className="py-16 text-center text-gray-400">Loading cash book...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={7} className="py-16 text-center text-gray-400">No cash transactions found</td></tr>
                        ) : filtered.map((e, i) => (
                            <tr key={i} className={`border-t hover:bg-amber-50/30 ${e.type === 'outflow' ? 'bg-red-50/20' : ''}`}>
                                <td className="py-3 px-4 text-sm">{e.date}</td>
                                <td className="py-3 px-4 text-sm text-gray-400">{e.time || '-'}</td>
                                <td className="py-3 px-4 text-sm font-medium">{e.description}</td>
                                <td className="py-3 px-4 text-sm text-gray-500">{e.reference}</td>
                                <td className="py-3 px-4 text-right text-sm font-bold text-green-600">{e.type === 'inflow' ? e.amount.toLocaleString() : ''}</td>
                                <td className="py-3 px-4 text-right text-sm font-bold text-red-600">{e.type === 'outflow' ? e.amount.toLocaleString() : ''}</td>
                                <td className={`py-3 px-4 text-right text-sm font-mono font-semibold ${e.balance >= 0 ? 'text-gray-800' : 'text-red-600'}`}>{e.balance.toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                    {filtered.length > 0 && (
                        <tfoot>
                            <tr className="bg-gradient-to-r from-amber-100 to-yellow-100 font-bold">
                                <td colSpan={4} className="py-3 px-4 text-sm">TOTALS ({entries.length} entries)</td>
                                <td className="py-3 px-4 text-right text-sm text-green-700">Ksh {totalInflows.toLocaleString()}</td>
                                <td className="py-3 px-4 text-right text-sm text-red-700">Ksh {totalOutflows.toLocaleString()}</td>
                                <td className={`py-3 px-4 text-right text-sm ${closingBalance >= 0 ? 'text-gray-900' : 'text-red-700'}`}>Ksh {closingBalance.toLocaleString()}</td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </div>
    );
}
