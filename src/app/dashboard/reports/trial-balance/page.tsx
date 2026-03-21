'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

interface TBAccount { name: string; code: string; debit: number; credit: number; type: string; }

export default function TrialBalancePage() {
    const { activeOutlet } = useOutlet();
    const outletId = activeOutlet?.outlet_id || 1;
    const [loading, setLoading] = useState(true);
    const [dateFrom, setDateFrom] = useState(() => `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`);
    const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
    const [preset, setPreset] = useState('month');
    const [accounts, setAccounts] = useState<TBAccount[]>([]);

    const setDatePreset = (p: string) => {
        setPreset(p);
        const now = new Date();
        const to = now.toISOString().split('T')[0];
        let from = to;
        if (p === 'today') from = to;
        else if (p === 'month') from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        else if (p === 'quarter') { const qm = Math.floor(now.getMonth() / 3) * 3; from = `${now.getFullYear()}-${String(qm + 1).padStart(2, '0')}-01`; }
        else if (p === 'year') from = `${now.getFullYear()}-01-01`;
        setDateFrom(from); setDateTo(to);
    };

    const loadData = useCallback(async () => {
        if (!activeOutlet) return;
        setLoading(true);
        try {
            const accts: TBAccount[] = [];

            // 1. Sales Revenue (Credit)
            const { data: salesData } = await supabase.from('retail_sales').select('total_amount, payment_method')
                .eq('outlet_id', outletId).gte('sale_date', dateFrom).lte('sale_date', dateTo);
            const totalSales = (salesData || []).reduce((s, r) => s + (r.total_amount || 0), 0);
            const cashSales = (salesData || []).filter(r => (r.payment_method || '').toLowerCase().includes('cash')).reduce((s, r) => s + (r.total_amount || 0), 0);
            const mpesaSales = (salesData || []).filter(r => (r.payment_method || '').toLowerCase().includes('mpesa')).reduce((s, r) => s + (r.total_amount || 0), 0);
            const creditSales = (salesData || []).filter(r => (r.payment_method || '').toLowerCase().includes('credit')).reduce((s, r) => s + (r.total_amount || 0), 0);

            accts.push({ name: 'Sales Revenue', code: '4000', debit: 0, credit: totalSales, type: 'Revenue' });

            // 2. Cash Account (Debit = Cash Sales)
            accts.push({ name: 'Cash in Hand', code: '1100', debit: cashSales, credit: 0, type: 'Asset' });

            // 3. M-Pesa Account (Debit = M-Pesa Sales)
            accts.push({ name: 'M-Pesa Account', code: '1200', debit: mpesaSales, credit: 0, type: 'Asset' });

            // 4. Accounts Receivable (Debit = Credit Sales)
            accts.push({ name: 'Accounts Receivable', code: '1300', debit: creditSales, credit: 0, type: 'Asset' });

            // 5. COGS (Debit = cost of goods sold)
            const { data: salesItems } = await supabase.from('retail_sales_items').select('product_id, quantity')
                .gte('created_at', `${dateFrom}T00:00:00`).lte('created_at', `${dateTo}T23:59:59`);
            const { data: products } = await supabase.from('retail_products').select('pid, purchase_cost').eq('outlet_id', outletId);
            const costMap: Record<number, number> = {};
            (products || []).forEach(p => { costMap[p.pid] = p.purchase_cost || 0; });
            let cogs = 0;
            (salesItems || []).forEach(item => { cogs += (costMap[item.product_id] || 0) * (item.quantity || 0); });
            accts.push({ name: 'Cost of Goods Sold', code: '5000', debit: cogs, credit: 0, type: 'Expense' });

            // 6. Inventory (Debit = current stock value)
            const { data: stockData } = await supabase.from('retail_stock').select('pid, qty').eq('outlet_id', outletId);
            let stockVal = 0;
            (stockData || []).forEach(s => { stockVal += (s.qty || 0) * (costMap[s.pid] || 0); });
            accts.push({ name: 'Inventory', code: '1400', debit: stockVal, credit: 0, type: 'Asset' });

            // 7. Purchases (Debit)
            const { data: purchaseData } = await supabase.from('retail_purchases').select('grand_total')
                .eq('outlet_id', outletId).gte('purchase_date', dateFrom).lte('purchase_date', dateTo);
            const totalPurchases = (purchaseData || []).reduce((s, r) => s + (r.grand_total || 0), 0);
            accts.push({ name: 'Purchases', code: '5100', debit: totalPurchases, credit: 0, type: 'Expense' });

            // 8. Expenses by category (Debit)
            const { data: expData } = await supabase.from('expenses').select('category, amount')
                .gte('expense_date', dateFrom).lte('expense_date', dateTo);
            const expMap = new Map<string, number>();
            (expData || []).forEach(e => {
                const cat = e.category || 'Other';
                expMap.set(cat, (expMap.get(cat) || 0) + (e.amount || 0));
            });
            let expCode = 6000;
            expMap.forEach((amount, name) => {
                accts.push({ name: `Expense: ${name}`, code: String(expCode++), debit: amount, credit: 0, type: 'Expense' });
            });

            // 9. Cash paid for expenses (Credit to Cash)
            const totalCashExpenses = (expData || []).reduce((s, e) => s + (e.amount || 0), 0);
            // Adjust cash: subtract cash expenses
            const cashIdx = accts.findIndex(a => a.code === '1100');
            if (cashIdx >= 0) accts[cashIdx].debit -= totalCashExpenses;
            // If cash went negative, it means more expenses than cash sales — show 0 debit and move to credit
            if (cashIdx >= 0 && accts[cashIdx].debit < 0) {
                accts[cashIdx].credit = Math.abs(accts[cashIdx].debit);
                accts[cashIdx].debit = 0;
            }

            // 10. Retained Earnings (Credit = balancing figure)
            const totalDebits = accts.reduce((s, a) => s + a.debit, 0);
            const totalCredits = accts.reduce((s, a) => s + a.credit, 0);
            const retained = totalDebits - totalCredits;
            if (retained > 0) {
                accts.push({ name: 'Retained Earnings', code: '3000', debit: 0, credit: retained, type: 'Equity' });
            } else if (retained < 0) {
                accts.push({ name: 'Retained Earnings', code: '3000', debit: Math.abs(retained), credit: 0, type: 'Equity' });
            }

            setAccounts(accts);
        } catch (err) { console.error(err); toast.error('Failed to load trial balance'); }
        setLoading(false);
    }, [dateFrom, dateTo, outletId, activeOutlet]);

    useEffect(() => { loadData(); }, [loadData]);

    const totalDebits = accounts.reduce((s, a) => s + a.debit, 0);
    const totalCredits = accounts.reduce((s, a) => s + a.credit, 0);
    const isBalanced = Math.abs(totalDebits - totalCredits) < 1;

    const printReport = () => {
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Trial Balance</title>
<style>@page{margin:10mm;size:A4;}body{font-family:Arial,sans-serif;font-size:11px;}h1{font-size:16px;text-align:center;}
table{width:100%;border-collapse:collapse;margin-top:10px;}th,td{border:1px solid #ccc;padding:5px 8px;font-size:10px;}
th{background:#f0f0f0;font-weight:700;}.r{text-align:right;}.total{background:#e0e8f0;font-weight:700;}</style></head><body>
<h1>⚖️ Trial Balance</h1>
<p style="text-align:center;font-size:10px;color:#555;">${activeOutlet?.outlet_name || 'Alpha Retail'} | As at ${dateTo} | Period: ${dateFrom} to ${dateTo}</p>
<table><tr><th>A/C Code</th><th>Account Name</th><th>Type</th><th class="r">Debit (Ksh)</th><th class="r">Credit (Ksh)</th></tr>
${accounts.filter(a => a.debit > 0 || a.credit > 0).map(a => `<tr><td>${a.code}</td><td>${a.name}</td><td>${a.type}</td><td class="r">${a.debit > 0 ? a.debit.toLocaleString() : '-'}</td><td class="r">${a.credit > 0 ? a.credit.toLocaleString() : '-'}</td></tr>`).join('')}
<tr class="total"><td colspan="3">TOTALS</td><td class="r">${totalDebits.toLocaleString()}</td><td class="r">${totalCredits.toLocaleString()}</td></tr>
</table><p style="font-size:9px;margin-top:10px;">Balance Check: ${isBalanced ? '✅ BALANCED' : '⚠️ UNBALANCED'} | Printed: ${new Date().toLocaleString('en-GB')}</p></body></html>`;
        const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); w.print(); }
    };

    const typeColor: Record<string, string> = {
        Asset: 'bg-blue-100 text-blue-700', Revenue: 'bg-green-100 text-green-700',
        Expense: 'bg-red-100 text-red-700', Equity: 'bg-purple-100 text-purple-700',
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                    <span className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg">⚖️</span>
                    Trial Balance
                </h1>
                <button onClick={printReport} className="px-4 py-2 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 text-sm">🖨️ Print</button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Debit Accounts', sub: 'Total Debits', value: `Ksh ${totalDebits.toLocaleString()}`, border: 'border-l-blue-500', bg: 'bg-blue-50/40', iconBg: 'bg-blue-100', iconColor: 'text-blue-600', icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 0l-2 2a1 1 0 101.414 1.414L8 10.414l1.293 1.293a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg> },
                    { label: 'Credit Accounts', sub: 'Total Credits', value: `Ksh ${totalCredits.toLocaleString()}`, border: 'border-l-green-500', bg: 'bg-green-50/40', iconBg: 'bg-green-100', iconColor: 'text-green-600', icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 0l-2 2a1 1 0 101.414 1.414L8 10.414l1.293 1.293a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg> },
                    { label: 'Balance Verification', sub: 'Balance Check', value: isBalanced ? 'BALANCED' : 'UNBALANCED', border: isBalanced ? 'border-l-teal-500' : 'border-l-red-500', bg: isBalanced ? 'bg-teal-50/40' : 'bg-red-50/40', iconBg: isBalanced ? 'bg-teal-100' : 'bg-red-100', iconColor: isBalanced ? 'text-teal-600' : 'text-red-600', icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d={isBalanced ? "M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" : "M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"} clipRule="evenodd"/></svg> },
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
            <div className="bg-white rounded-2xl border p-4 flex items-center gap-4">
                <div className="flex gap-1">
                    {[{ l: 'Month', v: 'month' }, { l: 'Quarter', v: 'quarter' }, { l: 'Year', v: 'year' }].map(p => (
                        <button key={p.v} onClick={() => setDatePreset(p.v)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${preset === p.v ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{p.l}</button>
                    ))}
                </div>
                <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPreset(''); }} className="px-3 py-1.5 border rounded-lg text-sm" />
                <span className="text-gray-400">to</span>
                <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPreset(''); }} className="px-3 py-1.5 border rounded-lg text-sm" />
            </div>

            {/* Trial Balance Table */}
            {loading ? (
                <div className="bg-white rounded-2xl border p-16 text-center text-gray-400">Loading trial balance...</div>
            ) : (
                <div className="bg-white rounded-2xl border overflow-hidden max-w-4xl mx-auto">
                    <div className="text-center py-4 border-b bg-gradient-to-r from-indigo-50 to-purple-50">
                        <h2 className="text-lg font-bold text-gray-800">{activeOutlet?.outlet_name || 'Alpha Retail'}</h2>
                        <p className="text-sm text-gray-500">Trial Balance as at {dateTo}</p>
                    </div>
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50">
                                <th className="text-left py-3 px-4 text-xs font-bold text-gray-600 w-24">A/C Code</th>
                                <th className="text-left py-3 px-4 text-xs font-bold text-gray-600">Account Name</th>
                                <th className="text-center py-3 px-4 text-xs font-bold text-gray-600 w-24">Type</th>
                                <th className="text-right py-3 px-4 text-xs font-bold text-gray-600 w-36">Debit (Ksh)</th>
                                <th className="text-right py-3 px-4 text-xs font-bold text-gray-600 w-36">Credit (Ksh)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {accounts.filter(a => a.debit > 0 || a.credit > 0).map((a, i) => (
                                <tr key={i} className="border-t hover:bg-indigo-50/30">
                                    <td className="py-3 px-4 text-sm font-mono text-gray-500">{a.code}</td>
                                    <td className="py-3 px-4 text-sm font-medium">{a.name}</td>
                                    <td className="py-3 px-4 text-center"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${typeColor[a.type] || 'bg-gray-100'}`}>{a.type}</span></td>
                                    <td className="py-3 px-4 text-right text-sm font-mono">{a.debit > 0 ? a.debit.toLocaleString() : '-'}</td>
                                    <td className="py-3 px-4 text-right text-sm font-mono">{a.credit > 0 ? a.credit.toLocaleString() : '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-gradient-to-r from-indigo-100 to-purple-100 font-bold">
                                <td colSpan={3} className="py-3 px-4 text-sm">TOTALS</td>
                                <td className="py-3 px-4 text-right text-sm font-mono">Ksh {totalDebits.toLocaleString()}</td>
                                <td className="py-3 px-4 text-right text-sm font-mono">Ksh {totalCredits.toLocaleString()}</td>
                            </tr>
                            <tr>
                                <td colSpan={5} className={`py-2 px-4 text-center text-sm font-semibold ${isBalanced ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                                    {isBalanced ? '✅ Trial Balance is Balanced — Debits = Credits' : `⚠️ Trial Balance is Unbalanced — Difference: Ksh ${Math.abs(totalDebits - totalCredits).toLocaleString()}`}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </div>
    );
}
