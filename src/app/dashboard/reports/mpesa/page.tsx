'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

interface MpesaEntry {
    date: string; time: string; type: 'Sale' | 'Expense';
    description: string; receipt: string; customer: string;
    phone: string; amount: number; mpesaCode: string;
}

export default function MpesaReportPage() {
    const { activeOutlet } = useOutlet();
    const outletId = activeOutlet?.outlet_id || 1;
    const [entries, setEntries] = useState<MpesaEntry[]>([]);
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
            const allEntries: MpesaEntry[] = [];

            // M-Pesa Sales
            const { data: salesData } = await supabase.from('retail_sales')
                .select('sale_date, sale_datetime, receipt_no, customer_name, customer_phone, total_amount, mpesa_code, payment_method')
                .eq('outlet_id', outletId)
                .gte('sale_date', dateFrom).lte('sale_date', dateTo)
                .ilike('payment_method', '%mpesa%')
                .order('sale_datetime', { ascending: false });

            (salesData || []).forEach(s => {
                allEntries.push({
                    date: s.sale_date,
                    time: s.sale_datetime?.split('T')[1]?.slice(0, 5) || '',
                    type: 'Sale',
                    description: `M-Pesa Sale — ${s.customer_name || 'Walk-in'}`,
                    receipt: s.receipt_no || '',
                    customer: s.customer_name || 'Walk-in',
                    phone: s.customer_phone || '',
                    amount: s.total_amount || 0,
                    mpesaCode: s.mpesa_code || '-',
                });
            });

            // M-Pesa Expenses
            const { data: expData } = await supabase.from('expenses')
                .select('expense_date, expense_name, amount, reference_no, payment_mode')
                .gte('expense_date', dateFrom).lte('expense_date', dateTo)
                .ilike('payment_mode', '%pesa%');

            (expData || []).forEach(e => {
                allEntries.push({
                    date: e.expense_date, time: '', type: 'Expense',
                    description: e.expense_name || 'Expense',
                    receipt: '', customer: '', phone: '',
                    amount: e.amount || 0, mpesaCode: e.reference_no || '-',
                });
            });

            // Sort by date desc
            allEntries.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
            setEntries(allEntries);
        } catch (err) { console.error(err); toast.error('Failed to load M-Pesa data'); }
        setLoading(false);
    }, [dateFrom, dateTo, outletId, activeOutlet]);

    useEffect(() => { loadData(); }, [loadData]);

    const filtered = entries.filter(e => {
        const matchType = filterType === 'All' || e.type === filterType;
        const q = searchQuery.toLowerCase();
        const matchSearch = !q || e.description.toLowerCase().includes(q) || e.mpesaCode.toLowerCase().includes(q) || e.phone.includes(q) || e.customer.toLowerCase().includes(q);
        return matchType && matchSearch;
    });

    const totalMpesaIncome = entries.filter(e => e.type === 'Sale').reduce((s, e) => s + e.amount, 0);
    const totalMpesaExpenses = entries.filter(e => e.type === 'Expense').reduce((s, e) => s + e.amount, 0);
    const netMpesa = totalMpesaIncome - totalMpesaExpenses;
    const transactionCount = entries.length;

    const exportCSV = () => {
        const rows = [['Date', 'Time', 'Type', 'Description', 'Receipt', 'Customer', 'Phone', 'Amount', 'M-Pesa Code']];
        filtered.forEach(e => rows.push([e.date, e.time, e.type, e.description, e.receipt, e.customer, e.phone, String(e.amount), e.mpesaCode]));
        const csv = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `mpesa_report_${dateFrom}_${dateTo}.csv`; a.click();
        toast.success('CSV exported!');
    };

    const printReport = () => {
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>M-Pesa Report</title>
<style>@page{margin:8mm;size:A4;}body{font-family:Arial,sans-serif;font-size:10px;}h1{font-size:16px;text-align:center;}
table{width:100%;border-collapse:collapse;margin-top:8px;}th,td{border:1px solid #ddd;padding:3px 5px;font-size:9px;}
th{background:#e8f5e9;font-weight:700;}.r{text-align:right;}.g{color:green;}.rd{color:red;}.total{background:#e8f0ff;}</style></head><body>
<h1>📱 M-Pesa Transaction Report</h1>
<p style="text-align:center;font-size:9px;color:#555;">${activeOutlet?.outlet_name || 'Alpha Retail'} | ${dateFrom} to ${dateTo}</p>
<p><strong>Income:</strong> Ksh ${totalMpesaIncome.toLocaleString()} | <strong>Expenses:</strong> Ksh ${totalMpesaExpenses.toLocaleString()} | <strong>Net:</strong> Ksh ${netMpesa.toLocaleString()}</p>
<table><tr><th>Date</th><th>Time</th><th>Type</th><th>Description</th><th>Customer</th><th>Phone</th><th class="r">Amount</th><th>M-Pesa Code</th></tr>
${filtered.map(e => `<tr><td>${e.date}</td><td>${e.time || '-'}</td><td class="${e.type === 'Sale' ? 'g' : 'rd'}">${e.type}</td><td>${e.description}</td><td>${e.customer || '-'}</td><td>${e.phone || '-'}</td><td class="r">${e.amount.toLocaleString()}</td><td>${e.mpesaCode}</td></tr>`).join('')}
</table></body></html>`;
        const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); w.print(); }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                    <span className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg">📱</span>
                    M-Pesa Report
                </h1>
                <div className="flex gap-2">
                    <button onClick={exportCSV} className="px-4 py-2 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 text-sm">📥 Export CSV</button>
                    <button onClick={printReport} className="px-4 py-2 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 text-sm">🖨️ Print</button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'M-Pesa Collections', sub: 'M-Pesa Income', value: `Ksh ${totalMpesaIncome.toLocaleString()}`, border: 'border-l-green-500', bg: 'bg-green-50/40', iconBg: 'bg-green-100', iconColor: 'text-green-600', icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/></svg> },
                    { label: 'M-Pesa Disbursements', sub: 'M-Pesa Expenses', value: `Ksh ${totalMpesaExpenses.toLocaleString()}`, border: 'border-l-red-500', bg: 'bg-red-50/40', iconBg: 'bg-red-100', iconColor: 'text-red-600', icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd"/></svg> },
                    { label: 'Net M-Pesa Position', sub: 'Net M-Pesa', value: `Ksh ${netMpesa.toLocaleString()}`, border: netMpesa >= 0 ? 'border-l-teal-500' : 'border-l-red-500', bg: netMpesa >= 0 ? 'bg-teal-50/40' : 'bg-red-50/40', iconBg: netMpesa >= 0 ? 'bg-teal-100' : 'bg-red-100', iconColor: netMpesa >= 0 ? 'text-teal-600' : 'text-red-600', icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/><path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd"/></svg> },
                    { label: 'Transaction Volume', sub: 'Transactions', value: transactionCount.toLocaleString(), border: 'border-l-purple-500', bg: 'bg-purple-50/40', iconBg: 'bg-purple-100', iconColor: 'text-purple-600', icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 0l-2 2a1 1 0 101.414 1.414L8 10.414l1.293 1.293a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg> },
                ].map((card, i) => (
                    <div key={i} className={`bg-white rounded-xl border border-gray-100 border-l-4 ${card.border} ${card.bg} p-4 shadow-sm hover:shadow-md transition-all group`}>
                        <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 truncate">{card.label}</p>
                                <p className="text-xl font-extrabold text-gray-800 mt-1">{card.value}</p>
                                <p className="text-[11px] text-gray-500 mt-0.5">{card.sub}</p>
                            </div>
                            <div className={`w-9 h-9 rounded-lg ${card.iconBg} ${card.iconColor} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
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
                        <button key={p.v} onClick={() => setDatePreset(p.v)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${preset === p.v ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{p.l}</button>
                    ))}
                </div>
                <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPreset(''); }} className="px-3 py-1.5 border rounded-lg text-sm" />
                <span className="text-gray-400">to</span>
                <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPreset(''); }} className="px-3 py-1.5 border rounded-lg text-sm" />
                <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-1.5 border rounded-lg text-sm">
                    <option value="All">All Types</option><option value="Sale">Sales Only</option><option value="Expense">Expenses Only</option>
                </select>
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="🔍 Search M-Pesa code, customer, phone..." className="flex-1 px-3 py-1.5 border rounded-lg text-sm" />
            </div>

            {/* M-Pesa Table */}
            <div className="bg-white rounded-2xl border overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gradient-to-r from-green-50 to-emerald-50">
                        <tr>
                            <th className="text-left py-3 px-4 text-xs font-bold text-gray-600">Date</th>
                            <th className="text-left py-3 px-4 text-xs font-bold text-gray-600">Time</th>
                            <th className="text-center py-3 px-4 text-xs font-bold text-gray-600">Type</th>
                            <th className="text-left py-3 px-4 text-xs font-bold text-gray-600">Description</th>
                            <th className="text-left py-3 px-4 text-xs font-bold text-gray-600">Customer</th>
                            <th className="text-left py-3 px-4 text-xs font-bold text-gray-600">Phone</th>
                            <th className="text-right py-3 px-4 text-xs font-bold text-gray-600">Amount</th>
                            <th className="text-center py-3 px-4 text-xs font-bold text-gray-600">M-Pesa Code</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={8} className="py-16 text-center text-gray-400">Loading M-Pesa transactions...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={8} className="py-16 text-center text-gray-400">No M-Pesa transactions found</td></tr>
                        ) : filtered.map((e, i) => (
                            <tr key={i} className={`border-t hover:bg-green-50/30 ${e.type === 'Expense' ? 'bg-red-50/20' : ''}`}>
                                <td className="py-3 px-4 text-sm">{e.date}</td>
                                <td className="py-3 px-4 text-sm text-gray-400">{e.time || '-'}</td>
                                <td className="py-3 px-4 text-center">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${e.type === 'Sale' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        {e.type}
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-sm font-medium">{e.description}</td>
                                <td className="py-3 px-4 text-sm">{e.customer || '-'}</td>
                                <td className="py-3 px-4 text-sm text-gray-500">{e.phone || '-'}</td>
                                <td className={`py-3 px-4 text-right font-bold text-sm ${e.type === 'Sale' ? 'text-green-600' : 'text-red-600'}`}>
                                    {e.type === 'Expense' ? '-' : ''}Ksh {e.amount.toLocaleString()}
                                </td>
                                <td className="py-3 px-4 text-center">
                                    <span className="px-2 py-1 bg-green-50 border border-green-200 rounded text-xs font-mono text-green-700">{e.mpesaCode}</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    {filtered.length > 0 && (
                        <tfoot>
                            <tr className="bg-gradient-to-r from-green-100 to-emerald-100 font-bold">
                                <td colSpan={6} className="py-3 px-4 text-sm">TOTALS ({filtered.length} transactions)</td>
                                <td className="py-3 px-4 text-right text-sm">Ksh {filtered.reduce((s, e) => s + (e.type === 'Sale' ? e.amount : -e.amount), 0).toLocaleString()}</td>
                                <td />
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </div>
    );
}
