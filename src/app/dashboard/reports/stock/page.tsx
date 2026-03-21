'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

interface StockItem {
    pid: number; name: string; category: string; purchaseUnit: string; salesUnit: string;
    stock: number; purchasePrice: number; salesPrice: number; stockValue: number;
    reorderPoint: number; status: 'ok' | 'low' | 'critical' | 'out';
}

export default function StockReportPage() {
    const { activeOutlet } = useOutlet();
    const outletId = activeOutlet?.outlet_id || 1;
    const [items, setItems] = useState<StockItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('All');
    const [filterCategory, setFilterCategory] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [categories, setCategories] = useState<string[]>([]);

    const loadData = useCallback(async () => {
        if (!activeOutlet) return;
        setLoading(true);
        try {
            const { data: products } = await supabase
                .from('retail_products')
                .select('pid, product_name, category, purchase_unit, sales_unit, purchase_cost, sales_cost, reorder_point')
                .eq('active', true).eq('outlet_id', outletId).order('product_name');

            const { data: stockData } = await supabase
                .from('retail_stock').select('pid, qty').eq('outlet_id', outletId);

            const stockMap: Record<number, number> = {};
            (stockData || []).forEach(s => { stockMap[s.pid] = (stockMap[s.pid] || 0) + (s.qty || 0); });

            const result: StockItem[] = (products || []).map(p => {
                const stock = stockMap[p.pid] || 0;
                const reorder = p.reorder_point || 5;
                let status: StockItem['status'] = 'ok';
                if (stock === 0) status = 'out';
                else if (stock <= reorder * 0.3) status = 'critical';
                else if (stock <= reorder) status = 'low';

                return {
                    pid: p.pid, name: p.product_name, category: p.category || 'Uncategorized',
                    purchaseUnit: p.purchase_unit || 'Piece', salesUnit: p.sales_unit || 'Piece',
                    stock, purchasePrice: p.purchase_cost || 0, salesPrice: p.sales_cost || 0,
                    stockValue: stock * (p.purchase_cost || 0), reorderPoint: reorder, status,
                };
            });

            setItems(result);
            setCategories(Array.from(new Set(result.map(r => r.category))).sort());
        } catch (err) { console.error(err); toast.error('Failed to load stock data'); }
        setLoading(false);
    }, [outletId, activeOutlet]);

    useEffect(() => { loadData(); }, [loadData]);

    const filtered = items.filter(i => {
        const matchStatus = filterStatus === 'All' || i.status === filterStatus.toLowerCase();
        const matchCat = filterCategory === 'All' || i.category === filterCategory;
        const matchSearch = !searchQuery || i.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchStatus && matchCat && matchSearch;
    });

    const totalProducts = items.length;
    const totalStockValue = filtered.reduce((s, i) => s + i.stockValue, 0);
    const lowStockCount = items.filter(i => i.status === 'low' || i.status === 'critical').length;
    const outOfStockCount = items.filter(i => i.status === 'out').length;
    const totalRetailValue = filtered.reduce((s, i) => s + (i.stock * i.salesPrice), 0);

    const exportCSV = () => {
        const rows = [['Product', 'Category', 'Purchase Unit', 'Sales Unit', 'Stock Qty', 'Purchase Price', 'Sales Price', 'Stock Value', 'Reorder Point', 'Status']];
        filtered.forEach(i => rows.push([i.name, i.category, i.purchaseUnit, i.salesUnit, String(i.stock), String(i.purchasePrice), String(i.salesPrice), String(i.stockValue), String(i.reorderPoint), i.status]));
        const csv = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `stock_report_${new Date().toISOString().split('T')[0]}.csv`; a.click();
        toast.success('CSV exported!');
    };

    const printReport = () => {
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Stock Report</title>
<style>@page{margin:8mm;size:A4 landscape;}body{font-family:Arial,sans-serif;font-size:10px;}h1{font-size:16px;}
table{width:100%;border-collapse:collapse;}th,td{border:1px solid #ddd;padding:3px 5px;font-size:9px;}
th{background:#f5f5f5;font-weight:700;}.r{text-align:right;}.out{color:red;font-weight:700;}.low{color:orange;}.ok{color:green;}</style></head><body>
<h1>📊 Stock Report</h1><p>${activeOutlet?.outlet_name || 'Alpha Retail'} | ${new Date().toLocaleDateString('en-GB')} | Total Value: Ksh ${totalStockValue.toLocaleString()}</p>
<table><tr><th>Product</th><th>Category</th><th>Unit</th><th class="r">Stock</th><th class="r">Cost</th><th class="r">Price</th><th class="r">Value</th><th>Status</th></tr>
${filtered.map(i => `<tr><td>${i.name}</td><td>${i.category}</td><td>${i.salesUnit}</td><td class="r">${i.stock}</td><td class="r">Ksh ${i.purchasePrice.toLocaleString()}</td><td class="r">Ksh ${i.salesPrice.toLocaleString()}</td><td class="r">Ksh ${i.stockValue.toLocaleString()}</td><td class="${i.status}">${i.status.toUpperCase()}</td></tr>`).join('')}
</table></body></html>`;
        const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); w.print(); }
    };

    const statusColors: Record<string, string> = {
        ok: 'bg-green-100 text-green-700', low: 'bg-amber-100 text-amber-700',
        critical: 'bg-red-100 text-red-700', out: 'bg-gray-200 text-gray-700',
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                    <span className="w-12 h-12 bg-gradient-to-br from-purple-500 to-violet-600 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg">📊</span>
                    Stock Report
                </h1>
                <div className="flex gap-2">
                    <button onClick={exportCSV} className="px-4 py-2 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 text-sm">📥 Export CSV</button>
                    <button onClick={printReport} className="px-4 py-2 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 text-sm">🖨️ Print</button>
                    <button onClick={loadData} className="px-4 py-2 bg-purple-500 text-white rounded-xl font-semibold hover:bg-purple-600 text-sm">🔄 Refresh</button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                    { label: 'Product Catalog', sub: 'Total Products', value: totalProducts.toLocaleString(), border: 'border-l-blue-500', bg: 'bg-blue-50/40', iconBg: 'bg-blue-100', iconColor: 'text-blue-600', icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd"/></svg> },
                    { label: 'Stock Valuation - Purchase Cost', sub: 'Stock Value (Cost)', value: `Ksh ${totalStockValue.toLocaleString()}`, border: 'border-l-green-500', bg: 'bg-green-50/40', iconBg: 'bg-green-100', iconColor: 'text-green-600', icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/><path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd"/></svg> },
                    { label: 'Stock Valuation - Sales Rate', sub: 'Retail Value', value: `Ksh ${totalRetailValue.toLocaleString()}`, border: 'border-l-teal-500', bg: 'bg-teal-50/40', iconBg: 'bg-teal-100', iconColor: 'text-teal-600', icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/></svg> },
                    { label: 'Low Stock Alert', sub: 'Low Stock Items', value: lowStockCount.toLocaleString(), border: 'border-l-amber-500', bg: 'bg-amber-50/40', iconBg: 'bg-amber-100', iconColor: 'text-amber-600', icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg> },
                    { label: 'Out of Stock', sub: 'Needs Restock', value: outOfStockCount.toLocaleString(), border: 'border-l-red-500', bg: 'bg-red-50/40', iconBg: 'bg-red-100', iconColor: 'text-red-600', icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd"/></svg> },
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

            {/* Filters */}
            <div className="bg-white rounded-2xl border p-4 flex items-center gap-4 flex-wrap">
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-1.5 border rounded-lg text-sm">
                    <option value="All">All Status</option><option value="ok">In Stock</option><option value="low">Low Stock</option><option value="critical">Critical</option><option value="out">Out of Stock</option>
                </select>
                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="px-3 py-1.5 border rounded-lg text-sm">
                    <option value="All">All Categories</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <div className="flex-1">
                    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="🔍 Search products..." className="w-full px-3 py-1.5 border rounded-lg text-sm" />
                </div>
            </div>

            {/* Stock Table */}
            <div className="bg-white rounded-2xl border overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gradient-to-r from-purple-50 to-violet-50">
                        <tr>
                            <th className="text-left py-3 px-4 text-xs font-bold text-gray-600">Product</th>
                            <th className="text-left py-3 px-4 text-xs font-bold text-gray-600">Category</th>
                            <th className="text-center py-3 px-4 text-xs font-bold text-gray-600">Purchase Unit</th>
                            <th className="text-center py-3 px-4 text-xs font-bold text-gray-600">Sales Unit</th>
                            <th className="text-right py-3 px-4 text-xs font-bold text-gray-600">Stock Qty</th>
                            <th className="text-right py-3 px-4 text-xs font-bold text-gray-600">Cost Price</th>
                            <th className="text-right py-3 px-4 text-xs font-bold text-gray-600">Sales Price</th>
                            <th className="text-right py-3 px-4 text-xs font-bold text-gray-600">Stock Value</th>
                            <th className="text-center py-3 px-4 text-xs font-bold text-gray-600">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={9} className="py-16 text-center text-gray-400">Loading stock data...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={9} className="py-16 text-center text-gray-400">No products found</td></tr>
                        ) : filtered.map(item => (
                            <tr key={item.pid} className={`border-t hover:bg-purple-50/30 ${item.status === 'out' ? 'bg-red-50/40' : ''}`}>
                                <td className="py-3 px-4 font-semibold text-sm">{item.name}</td>
                                <td className="py-3 px-4 text-sm"><span className="px-2 py-1 bg-gray-100 rounded-full text-xs">{item.category}</span></td>
                                <td className="py-3 px-4 text-center text-sm text-gray-500">{item.purchaseUnit}</td>
                                <td className="py-3 px-4 text-center text-sm text-gray-500">{item.salesUnit}</td>
                                <td className="py-3 px-4 text-right font-bold text-sm">{item.stock}</td>
                                <td className="py-3 px-4 text-right text-sm">Ksh {item.purchasePrice.toLocaleString()}</td>
                                <td className="py-3 px-4 text-right text-sm">Ksh {item.salesPrice.toLocaleString()}</td>
                                <td className="py-3 px-4 text-right font-semibold text-sm">Ksh {item.stockValue.toLocaleString()}</td>
                                <td className="py-3 px-4 text-center"><span className={`px-2 py-1 rounded-full text-xs font-bold ${statusColors[item.status]}`}>{item.status.toUpperCase()}</span></td>
                            </tr>
                        ))}
                    </tbody>
                    {filtered.length > 0 && (
                        <tfoot>
                            <tr className="bg-gradient-to-r from-purple-50 to-violet-50 font-bold">
                                <td colSpan={4} className="py-3 px-4 text-sm">TOTALS ({filtered.length} products)</td>
                                <td className="py-3 px-4 text-right text-sm">{filtered.reduce((s, i) => s + i.stock, 0)}</td>
                                <td colSpan={2} />
                                <td className="py-3 px-4 text-right text-sm text-purple-600">Ksh {totalStockValue.toLocaleString()}</td>
                                <td />
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </div>
    );
}
