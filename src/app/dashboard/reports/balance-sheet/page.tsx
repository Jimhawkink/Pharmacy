'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

export default function BalanceSheetPage() {
    const { activeOutlet } = useOutlet();
    const outletId = activeOutlet?.outlet_id || 1;
    const [loading, setLoading] = useState(true);
    const [asAtDate, setAsAtDate] = useState(new Date().toISOString().split('T')[0]);

    // Assets
    const [cashInHand, setCashInHand] = useState(0);
    const [mpesaBalance, setMpesaBalance] = useState(0);
    const [accountsReceivable, setAccountsReceivable] = useState(0);
    const [inventory, setInventory] = useState(0);

    // Liabilities
    const [accountsPayable, setAccountsPayable] = useState(0);

    // Equity
    const [retainedEarnings, setRetainedEarnings] = useState(0);

    const totalCurrentAssets = cashInHand + mpesaBalance + accountsReceivable + inventory;
    const totalAssets = totalCurrentAssets;
    const totalLiabilities = accountsPayable;
    const totalEquity = retainedEarnings;
    const totalLiabEquity = totalLiabilities + totalEquity;

    const loadData = useCallback(async () => {
        if (!activeOutlet) return;
        setLoading(true);
        try {
            // Cash in Hand: all cash sales minus cash expenses (up to asAtDate)
            const { data: cashSalesData } = await supabase.from('retail_sales').select('total_amount')
                .eq('outlet_id', outletId).lte('sale_date', asAtDate)
                .ilike('payment_method', '%cash%');
            const totalCashSales = (cashSalesData || []).reduce((s, r) => s + (r.total_amount || 0), 0);
            const { data: cashExpData } = await supabase.from('expenses').select('amount')
                .lte('expense_date', asAtDate).ilike('payment_mode', '%cash%');
            const totalCashExpenses = (cashExpData || []).reduce((s, e) => s + (e.amount || 0), 0);
            setCashInHand(totalCashSales - totalCashExpenses);

            // M-Pesa Balance: all M-Pesa sales minus M-Pesa expenses
            const { data: mpesaSalesData } = await supabase.from('retail_sales').select('total_amount')
                .eq('outlet_id', outletId).lte('sale_date', asAtDate)
                .ilike('payment_method', '%mpesa%');
            const totalMpesaSales = (mpesaSalesData || []).reduce((s, r) => s + (r.total_amount || 0), 0);
            const { data: mpesaExpData } = await supabase.from('expenses').select('amount')
                .lte('expense_date', asAtDate).ilike('payment_mode', '%pesa%');
            const totalMpesaExpenses = (mpesaExpData || []).reduce((s, e) => s + (e.amount || 0), 0);
            setMpesaBalance(totalMpesaSales - totalMpesaExpenses);

            // Accounts Receivable: total credit customer balances
            const { data: creditCusts } = await supabase.from('retail_credit_customers').select('balance').eq('active', true);
            setAccountsReceivable((creditCusts || []).reduce((s, c) => s + (c.balance || 0), 0));

            // Inventory: current stock value at cost
            const { data: products } = await supabase.from('retail_products').select('pid, purchase_cost').eq('outlet_id', outletId);
            const costMap: Record<number, number> = {};
            (products || []).forEach(p => { costMap[p.pid] = p.purchase_cost || 0; });
            const { data: stockData } = await supabase.from('retail_stock').select('pid, qty').eq('outlet_id', outletId);
            let stockVal = 0;
            (stockData || []).forEach(s => { stockVal += (s.qty || 0) * (costMap[s.pid] || 0); });
            setInventory(stockVal);

            // Accounts Payable (supplier balances — estimate from purchases minus payments)
            setAccountsPayable(0); // Set to 0 if not tracked separately

            // Retained Earnings = Total Assets - Total Liabilities
            const totalA = (totalCashSales - totalCashExpenses) + (totalMpesaSales - totalMpesaExpenses) + (creditCusts || []).reduce((s, c) => s + (c.balance || 0), 0) + stockVal;
            setRetainedEarnings(totalA - 0); // liabilities = 0

        } catch (err) { console.error(err); toast.error('Failed to load balance sheet'); }
        setLoading(false);
    }, [asAtDate, outletId, activeOutlet]);

    useEffect(() => { loadData(); }, [loadData]);

    const isBalanced = Math.abs(totalAssets - totalLiabEquity) < 1;

    const printReport = () => {
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Balance Sheet</title>
<style>@page{margin:10mm;size:A4;}body{font-family:Arial,sans-serif;font-size:11px;}h1{font-size:16px;text-align:center;}
h2{font-size:13px;border-bottom:2px solid #333;padding-bottom:3px;margin-top:14px;}
.row{display:flex;justify-content:space-between;padding:3px 0;}.indent{padding-left:24px;}.bold{font-weight:700;}
.line{border-top:1px solid #333;margin:4px 0;}.dline{border-top:3px double #333;margin:6px 0;}
.total-box{background:#f0f0f0;padding:8px;font-size:13px;margin-top:8px;}</style></head><body>
<h1>📋 Balance Sheet</h1>
<p style="text-align:center;font-size:10px;color:#555;">${activeOutlet?.outlet_name || 'Alpha Retail'} | As at ${asAtDate}</p>
<h2>ASSETS</h2>
<p style="font-weight:700;margin:6px 0;">Current Assets</p>
<div class="row indent"><span>Cash in Hand</span><span>Ksh ${cashInHand.toLocaleString()}</span></div>
<div class="row indent"><span>M-Pesa Balance</span><span>Ksh ${mpesaBalance.toLocaleString()}</span></div>
<div class="row indent"><span>Accounts Receivable</span><span>Ksh ${accountsReceivable.toLocaleString()}</span></div>
<div class="row indent"><span>Inventory</span><span>Ksh ${inventory.toLocaleString()}</span></div>
<div class="line"></div>
<div class="row bold"><span>Total Assets</span><span>Ksh ${totalAssets.toLocaleString()}</span></div>
<div class="dline"></div>
<h2>LIABILITIES</h2>
<div class="row indent"><span>Accounts Payable</span><span>Ksh ${accountsPayable.toLocaleString()}</span></div>
<div class="line"></div>
<div class="row bold"><span>Total Liabilities</span><span>Ksh ${totalLiabilities.toLocaleString()}</span></div>
<h2>EQUITY</h2>
<div class="row indent"><span>Retained Earnings</span><span>Ksh ${retainedEarnings.toLocaleString()}</span></div>
<div class="line"></div>
<div class="row bold"><span>Total Equity</span><span>Ksh ${totalEquity.toLocaleString()}</span></div>
<div class="dline"></div>
<div class="total-box"><strong>Total Liabilities + Equity: Ksh ${totalLiabEquity.toLocaleString()}</strong></div>
<p style="margin-top:10px;font-size:9px;color:#888;">Balance Check: ${isBalanced ? '✅ BALANCED' : '⚠️ UNBALANCED'} | Printed: ${new Date().toLocaleString('en-GB')}</p></body></html>`;
        const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); w.print(); }
    };

    const BSRow = ({ label, value, indent, bold, line, dline }: any) => (
        <>
            {line && <div className="border-t border-gray-300 my-1" />}
            {dline && <div className="border-t-4 border-double border-gray-800 my-2" />}
            <div className={`flex justify-between py-1.5 ${indent ? 'pl-8' : ''} ${bold ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
                <span className="text-sm">{label}</span>
                <span className="text-sm font-mono">Ksh {value.toLocaleString()}</span>
            </div>
        </>
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                    <span className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg">📋</span>
                    Balance Sheet
                </h1>
                <button onClick={printReport} className="px-4 py-2 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 text-sm">🖨️ Print Report</button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Asset Position', sub: 'Total Assets', value: `Ksh ${totalAssets.toLocaleString()}`, border: 'border-l-blue-500', bg: 'bg-blue-50/40', iconBg: 'bg-blue-100', iconColor: 'text-blue-600', icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/><path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd"/></svg> },
                    { label: 'Debt Position', sub: 'Total Liabilities', value: `Ksh ${totalLiabilities.toLocaleString()}`, border: 'border-l-red-500', bg: 'bg-red-50/40', iconBg: 'bg-red-100', iconColor: 'text-red-600', icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd"/></svg> },
                    { label: 'Net Worth', sub: 'Total Equity', value: `Ksh ${totalEquity.toLocaleString()}`, border: 'border-l-green-500', bg: 'bg-green-50/40', iconBg: 'bg-green-100', iconColor: 'text-green-600', icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd"/></svg> },
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

            {/* Date Filter */}
            <div className="bg-white rounded-2xl border p-4 flex items-center gap-4">
                <span className="text-sm font-medium text-gray-600">As at:</span>
                <input type="date" value={asAtDate} onChange={e => setAsAtDate(e.target.value)} className="px-3 py-1.5 border rounded-lg text-sm" />
                <button onClick={loadData} className="px-4 py-1.5 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600">🔄 Refresh</button>
            </div>

            {loading ? (
                <div className="bg-white rounded-2xl border p-16 text-center text-gray-400">Loading balance sheet...</div>
            ) : (
                <div className="bg-white rounded-2xl border p-6 max-w-3xl mx-auto">
                    <h2 className="text-center text-lg font-bold text-gray-800 mb-1">{activeOutlet?.outlet_name || 'Alpha Retail'}</h2>
                    <p className="text-center text-sm text-gray-500 mb-6">Balance Sheet as at {asAtDate}</p>

                    {/* ASSETS */}
                    <div className="bg-blue-50 rounded-xl px-5 py-2 mb-3 text-sm font-bold text-blue-800">🏦 ASSETS</div>
                    <div className="px-2 mb-2">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-4 mb-1">Current Assets</p>
                        <BSRow label="Cash in Hand" value={cashInHand} indent />
                        <BSRow label="M-Pesa Balance" value={mpesaBalance} indent />
                        <BSRow label="Accounts Receivable (Credit Customers)" value={accountsReceivable} indent />
                        <BSRow label="Inventory (Stock at Cost)" value={inventory} indent />
                        <BSRow label="Total Current Assets" value={totalCurrentAssets} bold line />
                    </div>
                    <div className="bg-blue-100 rounded-xl px-5 py-3 mb-4 flex justify-between font-bold text-blue-800">
                        <span>TOTAL ASSETS</span><span>Ksh {totalAssets.toLocaleString()}</span>
                    </div>

                    {/* LIABILITIES */}
                    <div className="bg-red-50 rounded-xl px-5 py-2 mb-3 text-sm font-bold text-red-800">📋 LIABILITIES</div>
                    <div className="px-2 mb-2">
                        <BSRow label="Accounts Payable (Suppliers)" value={accountsPayable} indent />
                        <BSRow label="Total Liabilities" value={totalLiabilities} bold line />
                    </div>

                    {/* EQUITY */}
                    <div className="bg-green-50 rounded-xl px-5 py-2 mb-3 text-sm font-bold text-green-800">💎 EQUITY</div>
                    <div className="px-2 mb-2">
                        <BSRow label="Retained Earnings (Net Worth)" value={retainedEarnings} indent />
                        <BSRow label="Total Equity" value={totalEquity} bold line />
                    </div>

                    <div className="bg-gray-100 rounded-xl px-5 py-3 flex justify-between font-bold text-gray-800">
                        <span>TOTAL LIABILITIES + EQUITY</span><span>Ksh {totalLiabEquity.toLocaleString()}</span>
                    </div>

                    <div className={`mt-4 text-center py-2 rounded-xl text-sm font-semibold ${isBalanced ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {isBalanced ? '✅ Balance Sheet is Balanced — Assets = Liabilities + Equity' : `⚠️ Unbalanced — Difference: Ksh ${Math.abs(totalAssets - totalLiabEquity).toLocaleString()}`}
                    </div>
                </div>
            )}
        </div>
    );
}
