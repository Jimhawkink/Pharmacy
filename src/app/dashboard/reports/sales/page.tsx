'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

interface SaleRecord {
    sale_id: number; receipt_no: string; sale_date: string; sale_datetime: string;
    customer_name: string; customer_phone: string; subtotal: number; discount: number;
    total_amount: number; payment_method: string; mpesa_code: string; status: string; created_by: string;
}
interface SaleItem { product_name: string; quantity: number; unit_price: number; subtotal: number; }

export default function SalesReportPage() {
    const { activeOutlet } = useOutlet();
    const outletId = activeOutlet?.outlet_id || 1;
    const [sales, setSales] = useState<SaleRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
    const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
    const [filterPayment, setFilterPayment] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null);
    const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
    const [showDetail, setShowDetail] = useState(false);
    const [preset, setPreset] = useState('today');

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

    const loadSales = useCallback(async () => {
        if (!activeOutlet) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('retail_sales').select('*')
            .eq('outlet_id', outletId)
            .gte('sale_date', dateFrom).lte('sale_date', dateTo)
            .order('sale_datetime', { ascending: false });
        if (!error) setSales(data || []);
        setLoading(false);
    }, [dateFrom, dateTo, outletId, activeOutlet]);

    useEffect(() => { loadSales(); }, [loadSales]);

    const viewSaleDetail = async (sale: SaleRecord) => {
        setSelectedSale(sale);
        const { data } = await supabase.from('retail_sales_items').select('*').eq('sale_id', sale.sale_id);
        setSaleItems(data || []);
        setShowDetail(true);
    };

    const filtered = sales.filter(s => {
        const matchPayment = filterPayment === 'All' || (s.payment_method || '').toLowerCase().includes(filterPayment.toLowerCase());
        const q = searchQuery.toLowerCase();
        const matchSearch = !q || (s.receipt_no || '').toLowerCase().includes(q) || (s.customer_name || '').toLowerCase().includes(q) || (s.mpesa_code || '').toLowerCase().includes(q);
        return matchPayment && matchSearch;
    });

    const totalSales = filtered.reduce((s, r) => s + (r.total_amount || 0), 0);
    const totalCash = filtered.filter(r => (r.payment_method || '').toLowerCase().includes('cash')).reduce((s, r) => s + (r.total_amount || 0), 0);
    const totalMpesa = filtered.filter(r => (r.payment_method || '').toLowerCase().includes('mpesa')).reduce((s, r) => s + (r.total_amount || 0), 0);
    const totalCredit = filtered.filter(r => (r.payment_method || '').toLowerCase().includes('credit')).reduce((s, r) => s + (r.total_amount || 0), 0);
    const totalDiscount = filtered.reduce((s, r) => s + (r.discount || 0), 0);
    const avgOrder = filtered.length > 0 ? Math.round(totalSales / filtered.length) : 0;

    const exportCSV = () => {
        const rows = [['Date', 'Time', 'Receipt', 'Customer', 'Payment', 'Subtotal', 'Discount', 'Total', 'M-Pesa Code', 'Cashier']];
        filtered.forEach(s => rows.push([s.sale_date, s.sale_datetime?.split('T')[1]?.slice(0, 5) || '', s.receipt_no, s.customer_name || '', s.payment_method, String(s.subtotal || 0), String(s.discount || 0), String(s.total_amount), s.mpesa_code || '', s.created_by || '']));
        const csv = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `sales_report_${dateFrom}_${dateTo}.csv`; a.click();
        URL.revokeObjectURL(url);
        toast.success('CSV exported!');
    };

    const printReport = () => {
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Sales Report</title>
<style>@page{margin:8mm;size:A4;}body{font-family:Arial,sans-serif;font-size:11px;color:#000;}h1{font-size:16px;margin:0 0 4px;}
.info{font-size:10px;color:#555;margin-bottom:8px;}table{width:100%;border-collapse:collapse;margin-top:8px;}
th,td{border:1px solid #ddd;padding:4px 6px;text-align:left;font-size:10px;}th{background:#f5f5f5;font-weight:700;}
.r{text-align:right;}.b{font-weight:700;}.sum{background:#f0f0f0;font-weight:700;}</style></head><body>
<h1>📈 Sales Report</h1><div class="info">${activeOutlet?.outlet_name || 'Alpha Retail'} | ${dateFrom} to ${dateTo} | ${filtered.length} orders</div>
<table><tr><th>Date</th><th>Receipt</th><th>Customer</th><th>Payment</th><th class="r">Amount</th><th>M-Pesa</th><th>Cashier</th></tr>
${filtered.map(s => `<tr><td>${s.sale_date}</td><td>${s.receipt_no}</td><td>${s.customer_name || 'Walk-in'}</td><td>${s.payment_method}</td><td class="r b">Ksh ${(s.total_amount || 0).toLocaleString()}</td><td>${s.mpesa_code || '-'}</td><td>${s.created_by || '-'}</td></tr>`).join('')}
<tr class="sum"><td colspan="4">TOTAL</td><td class="r">Ksh ${totalSales.toLocaleString()}</td><td colspan="2"></td></tr></table>
<div style="margin-top:12px;font-size:9px;color:#888;">Printed: ${new Date().toLocaleString('en-GB')}</div></body></html>`;
        const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); w.print(); }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                    <span className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg">📈</span>
                    Sales Report
                </h1>
                <div className="flex gap-2">
                    <button onClick={exportCSV} className="px-4 py-2 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 transition-all text-sm">📥 Export CSV</button>
                    <button onClick={printReport} className="px-4 py-2 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 transition-all text-sm">🖨️ Print</button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                    { label: 'Sales Report', sub: 'Total Sales', value: `Ksh ${totalSales.toLocaleString()}`, border: 'border-l-blue-500', bg: 'bg-blue-50/40', iconBg: 'bg-blue-100', iconColor: 'text-blue-600', icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/><path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd"/></svg> },
                    { label: 'Cash Collections', sub: 'Cash Sales', value: `Ksh ${totalCash.toLocaleString()}`, border: 'border-l-green-500', bg: 'bg-green-50/40', iconBg: 'bg-green-100', iconColor: 'text-green-600', icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 100-2 1 1 0 000 2zm7-1a1 1 0 11-2 0 1 1 0 012 0zm-7.536 5.879a1 1 0 001.415 0A3 3 0 0110 13a3 3 0 011.95.69 1 1 0 001.414-1.413A5 5 0 0010 11a5 5 0 00-3.535 1.466 1 1 0 000 1.413z" clipRule="evenodd"/></svg> },
                    { label: 'M-Pesa Collections', sub: 'M-Pesa Sales', value: `Ksh ${totalMpesa.toLocaleString()}`, border: 'border-l-teal-500', bg: 'bg-teal-50/40', iconBg: 'bg-teal-100', iconColor: 'text-teal-600', icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/></svg> },
                    { label: 'Credit Sales', sub: 'On Account', value: `Ksh ${totalCredit.toLocaleString()}`, border: 'border-l-orange-500', bg: 'bg-orange-50/40', iconBg: 'bg-orange-100', iconColor: 'text-orange-600', icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd"/></svg> },
                    { label: 'Order Count', sub: 'Total Orders', value: filtered.length.toLocaleString(), border: 'border-l-purple-500', bg: 'bg-purple-50/40', iconBg: 'bg-purple-100', iconColor: 'text-purple-600', icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" clipRule="evenodd"/></svg> },
                    { label: 'Average Value', sub: 'Avg Order', value: `Ksh ${avgOrder.toLocaleString()}`, border: 'border-l-pink-500', bg: 'bg-pink-50/40', iconBg: 'bg-pink-100', iconColor: 'text-pink-600', icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 0l-2 2a1 1 0 101.414 1.414L8 10.414l1.293 1.293a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg> },
                ].map((card, i) => (
                    <div key={i} className={`bg-white rounded-xl border border-gray-100 border-l-4 ${card.border} ${card.bg} p-4 shadow-sm hover:shadow-md transition-all group`}>
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{card.label}</p>
                                <p className="text-lg font-extrabold text-gray-800 mt-1">{card.value}</p>
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
                        <button key={p.v} onClick={() => setDatePreset(p.v)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${preset === p.v ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{p.l}</button>
                    ))}
                </div>
                <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPreset(''); }} className="px-3 py-1.5 border rounded-lg text-sm" />
                <span className="text-gray-400">to</span>
                <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPreset(''); }} className="px-3 py-1.5 border rounded-lg text-sm" />
                <select value={filterPayment} onChange={e => setFilterPayment(e.target.value)} className="px-3 py-1.5 border rounded-lg text-sm">
                    <option value="All">All Methods</option><option value="Cash">Cash</option><option value="Mpesa">M-Pesa</option><option value="Credit">Credit</option>
                </select>
                <div className="flex-1">
                    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="🔍 Search receipt, customer, M-Pesa code..." className="w-full px-3 py-1.5 border rounded-lg text-sm" />
                </div>
            </div>

            {/* Discount Summary */}
            {totalDiscount > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2 text-sm">
                    <span>🏷️</span><span className="font-medium text-amber-800">Total Discounts Given: <strong>Ksh {totalDiscount.toLocaleString()}</strong></span>
                </div>
            )}

            {/* Sales Table */}
            <div className="bg-white rounded-2xl border overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gradient-to-r from-blue-50 to-indigo-50">
                        <tr>
                            <th className="text-left py-3 px-4 text-xs font-bold text-gray-600">Date/Time</th>
                            <th className="text-left py-3 px-4 text-xs font-bold text-gray-600">Receipt</th>
                            <th className="text-left py-3 px-4 text-xs font-bold text-gray-600">Customer</th>
                            <th className="text-center py-3 px-4 text-xs font-bold text-gray-600">Payment</th>
                            <th className="text-right py-3 px-4 text-xs font-bold text-gray-600">Subtotal</th>
                            <th className="text-right py-3 px-4 text-xs font-bold text-gray-600">Discount</th>
                            <th className="text-right py-3 px-4 text-xs font-bold text-gray-600">Total</th>
                            <th className="text-center py-3 px-4 text-xs font-bold text-gray-600">M-Pesa</th>
                            <th className="text-center py-3 px-4 text-xs font-bold text-gray-600">Cashier</th>
                            <th className="text-center py-3 px-4 text-xs font-bold text-gray-600">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={10} className="py-16 text-center text-gray-400">Loading sales...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={10} className="py-16 text-center text-gray-400">No sales found for this period</td></tr>
                        ) : filtered.map(s => (
                            <tr key={s.sale_id} className="border-t hover:bg-blue-50/30 transition-colors">
                                <td className="py-3 px-4 text-sm">{s.sale_date} <span className="text-gray-400">{s.sale_datetime?.split('T')[1]?.slice(0, 5)}</span></td>
                                <td className="py-3 px-4 font-semibold text-sm text-blue-600">{s.receipt_no}</td>
                                <td className="py-3 px-4 text-sm">{s.customer_name || 'Walk-in'}</td>
                                <td className="py-3 px-4 text-center">
                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${(s.payment_method || '').toLowerCase().includes('mpesa') ? 'bg-green-100 text-green-700' : (s.payment_method || '').toLowerCase().includes('credit') ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                        {s.payment_method}
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-right text-sm">Ksh {(s.subtotal || 0).toLocaleString()}</td>
                                <td className="py-3 px-4 text-right text-sm text-red-500">{s.discount > 0 ? `-${s.discount.toLocaleString()}` : '-'}</td>
                                <td className="py-3 px-4 text-right font-bold text-sm">Ksh {(s.total_amount || 0).toLocaleString()}</td>
                                <td className="py-3 px-4 text-center text-xs text-gray-500">{s.mpesa_code || '-'}</td>
                                <td className="py-3 px-4 text-center text-xs">{s.created_by || '-'}</td>
                                <td className="py-3 px-4 text-center">
                                    <button onClick={() => viewSaleDetail(s)} className="px-2 py-1 bg-blue-100 text-blue-600 rounded-lg text-xs hover:bg-blue-200">👁️ View</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    {filtered.length > 0 && (
                        <tfoot>
                            <tr className="bg-gradient-to-r from-blue-50 to-indigo-50 font-bold">
                                <td colSpan={4} className="py-3 px-4 text-sm">TOTALS ({filtered.length} orders)</td>
                                <td className="py-3 px-4 text-right text-sm">Ksh {filtered.reduce((s, r) => s + (r.subtotal || 0), 0).toLocaleString()}</td>
                                <td className="py-3 px-4 text-right text-sm text-red-500">-{totalDiscount.toLocaleString()}</td>
                                <td className="py-3 px-4 text-right text-sm text-blue-600">Ksh {totalSales.toLocaleString()}</td>
                                <td colSpan={3} />
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>

            {/* Sale Detail Modal */}
            {showDetail && selectedSale && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowDetail(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-[520px] max-w-[95vw] max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-800">🧾 Sale Details — {selectedSale.receipt_no}</h3>
                            <button onClick={() => setShowDetail(false)} className="p-2 hover:bg-gray-100 rounded-lg">✕</button>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                            <div className="p-3 bg-gray-50 rounded-xl"><span className="text-gray-500">Date</span><br /><strong>{selectedSale.sale_date} {selectedSale.sale_datetime?.split('T')[1]?.slice(0, 5)}</strong></div>
                            <div className="p-3 bg-gray-50 rounded-xl"><span className="text-gray-500">Customer</span><br /><strong>{selectedSale.customer_name || 'Walk-in'}</strong></div>
                            <div className="p-3 bg-gray-50 rounded-xl"><span className="text-gray-500">Payment</span><br /><strong>{selectedSale.payment_method}</strong></div>
                            <div className="p-3 bg-gray-50 rounded-xl"><span className="text-gray-500">Cashier</span><br /><strong>{selectedSale.created_by || '-'}</strong></div>
                            {selectedSale.mpesa_code && <div className="p-3 bg-green-50 rounded-xl col-span-2"><span className="text-gray-500">M-Pesa Code</span><br /><strong className="text-green-700">{selectedSale.mpesa_code}</strong></div>}
                        </div>
                        <table className="w-full mb-4">
                            <thead className="bg-gray-50"><tr><th className="text-left py-2 px-3 text-xs font-bold">Product</th><th className="text-center py-2 px-3 text-xs font-bold">Qty</th><th className="text-right py-2 px-3 text-xs font-bold">Price</th><th className="text-right py-2 px-3 text-xs font-bold">Subtotal</th></tr></thead>
                            <tbody>{saleItems.map((item, i) => (
                                <tr key={i} className="border-t"><td className="py-2 px-3 text-sm">{item.product_name}</td><td className="py-2 px-3 text-center text-sm">{item.quantity}</td><td className="py-2 px-3 text-right text-sm">Ksh {(item.unit_price || 0).toLocaleString()}</td><td className="py-2 px-3 text-right font-semibold text-sm">Ksh {(item.subtotal || 0).toLocaleString()}</td></tr>
                            ))}</tbody>
                        </table>
                        <div className="space-y-1 text-sm">
                            <div className="flex justify-between"><span>Subtotal</span><span>Ksh {(selectedSale.subtotal || 0).toLocaleString()}</span></div>
                            {selectedSale.discount > 0 && <div className="flex justify-between text-red-500"><span>Discount</span><span>-Ksh {selectedSale.discount.toLocaleString()}</span></div>}
                            <div className="flex justify-between text-lg font-bold border-t pt-2"><span>Total</span><span className="text-blue-600">Ksh {(selectedSale.total_amount || 0).toLocaleString()}</span></div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
