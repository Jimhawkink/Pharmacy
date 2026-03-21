'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

interface ExpiryItem {
    batch_id: number; product_id: number; batch_number: string;
    expiry_date: string; manufacture_date: string; remaining_qty: number;
    quantity: number; purchase_cost: number; selling_price: number;
    status: string; product_name: string; category: string;
    generic_name: string; drug_type: string;
}

const getDaysUntil = (date: string) => Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);

export default function ExpiryRegisterPage() {
    const { activeOutlet } = useOutlet();
    const outletId = activeOutlet?.outlet_id || 1;
    const [items, setItems] = useState<ExpiryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterDays, setFilterDays] = useState(90);
    const [filterStatus, setFilterStatus] = useState('All');
    const [filterCategory, setFilterCategory] = useState('All');
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState<'expiry' | 'value' | 'qty'>('expiry');
    const [categories, setCategories] = useState<string[]>([]);

    const loadData = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('pharmacy_batches')
            .select('*, pharmacy_products!inner(product_name, category, generic_name, drug_type, purchase_cost, sales_cost)')
            .eq('outlet_id', outletId)
            .gt('remaining_qty', 0)
            .order('expiry_date', { ascending: true });

        if (error) { toast.error('Failed to load'); setLoading(false); return; }

        const mapped: ExpiryItem[] = (data || []).map((b: any) => ({
            batch_id: b.batch_id, product_id: b.product_id,
            batch_number: b.batch_number, expiry_date: b.expiry_date,
            manufacture_date: b.manufacture_date || '', remaining_qty: b.remaining_qty,
            quantity: b.quantity, purchase_cost: b.purchase_cost || b.pharmacy_products.purchase_cost,
            selling_price: b.selling_price || b.pharmacy_products.sales_cost,
            status: b.status, product_name: b.pharmacy_products.product_name,
            category: b.pharmacy_products.category || '', generic_name: b.pharmacy_products.generic_name || '',
            drug_type: b.pharmacy_products.drug_type || '',
        }));
        setItems(mapped);
        const cats = Array.from(new Set(mapped.map(i => i.category).filter(Boolean)));
        setCategories(cats);
        setLoading(false);
    }, [outletId]);

    useEffect(() => { loadData(); }, [loadData]);

    const today = new Date();
    const allExpired = items.filter(i => getDaysUntil(i.expiry_date) < 0);
    const expIn7 = items.filter(i => { const d = getDaysUntil(i.expiry_date); return d >= 0 && d <= 7; });
    const expIn30 = items.filter(i => { const d = getDaysUntil(i.expiry_date); return d >= 0 && d <= 30; });
    const expIn90 = items.filter(i => { const d = getDaysUntil(i.expiry_date); return d >= 0 && d <= 90; });

    const sumPurchase = (arr: ExpiryItem[]) => arr.reduce((s, i) => s + i.purchase_cost * i.remaining_qty, 0);
    const sumRetail = (arr: ExpiryItem[]) => arr.reduce((s, i) => s + i.selling_price * i.remaining_qty, 0);

    // Filter items
    const filtered = items.filter(i => {
        const days = getDaysUntil(i.expiry_date);
        if (filterStatus === 'Expired' && days >= 0) return false;
        if (filterStatus === 'Active' && days < 0) return false;
        if (filterDays > 0 && filterStatus !== 'Expired' && days > filterDays) return false;
        if (filterCategory !== 'All' && i.category !== filterCategory) return false;
        if (search) {
            const q = search.toLowerCase();
            if (!i.product_name.toLowerCase().includes(q) && !i.batch_number.toLowerCase().includes(q) && !(i.generic_name || '').toLowerCase().includes(q)) return false;
        }
        return true;
    }).sort((a, b) => {
        if (sortBy === 'expiry') return new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime();
        if (sortBy === 'value') return (b.selling_price * b.remaining_qty) - (a.selling_price * a.remaining_qty);
        return b.remaining_qty - a.remaining_qty;
    });

    const getExpiryBadge = (days: number) => {
        if (days < 0) return <span className="px-2 py-1 bg-red-500 text-white rounded-full text-xs font-bold animate-pulse">EXPIRED</span>;
        if (days <= 7) return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">⚠️ {days}d</span>;
        if (days <= 30) return <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-bold">{days}d</span>;
        if (days <= 90) return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold">{days}d</span>;
        return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">{days}d ✓</span>;
    };

    const markDisposed = async (batchId: number) => {
        if (!confirm('Mark this batch as disposed?')) return;
        await supabase.from('pharmacy_batches').update({ status: 'Disposed', remaining_qty: 0 }).eq('batch_id', batchId);
        toast.success('Batch marked as disposed');
        loadData();
    };

    // Excel export
    const exportExcel = () => {
        const header = ['Product', 'Generic Name', 'Batch #', 'Drug Type', 'Category', 'Expiry Date', 'Days Until Expiry', 'Status', 'Qty', 'Purchase Cost', 'Selling Price', 'Total Purchase Value', 'Total Retail Value'];
        const rows = filtered.map(i => {
            const days = getDaysUntil(i.expiry_date);
            return [i.product_name, i.generic_name, i.batch_number, i.drug_type, i.category, i.expiry_date, days, days < 0 ? 'EXPIRED' : days <= 7 ? 'CRITICAL' : days <= 30 ? 'WARNING' : 'OK', i.remaining_qty, i.purchase_cost, i.selling_price, i.purchase_cost * i.remaining_qty, i.selling_price * i.remaining_qty];
        });
        const totalPurchase = filtered.reduce((s, i) => s + i.purchase_cost * i.remaining_qty, 0);
        const totalRetail = filtered.reduce((s, i) => s + i.selling_price * i.remaining_qty, 0);
        rows.push(['', '', '', '', '', '', '', 'TOTALS', filtered.reduce((s, i) => s + i.remaining_qty, 0), '', '', totalPurchase, totalRetail]);

        const csvContent = [
            'ALPHA PHARMACY - EXPIRY REGISTER',
            `Generated: ${new Date().toLocaleString()}`,
            `Filter: ${filterStatus} items expiring within ${filterDays} days`,
            '',
            header.join(','),
            ...rows.map(r => r.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `expiry_register_${new Date().toISOString().split('T')[0]}.csv`;
        a.click(); URL.revokeObjectURL(url);
        toast.success('Excel exported');
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-96">
            <div className="w-14 h-14 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
            <p className="mt-4 text-gray-500 text-sm">Loading expiry data...</p>
        </div>
    );

    return (
        <div className="space-y-5" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center shadow-lg"><span className="text-2xl">⏰</span></div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Expiry Register</h1>
                        <p className="text-gray-500 text-sm">Track & manage drug expiry dates and batch disposal</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={exportExcel} className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold hover:shadow-lg transition-all flex items-center gap-2 text-sm">📊 Export Excel</button>
                    <button onClick={loadData} className="px-5 py-2.5 bg-white border border-gray-200 rounded-xl font-bold hover:bg-gray-50 transition-all text-sm">🔄 Refresh</button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-6 gap-3">
                {[
                    { label: 'Expired', count: allExpired.length, value: sumPurchase(allExpired), retail: sumRetail(allExpired), color: 'from-red-500 to-red-600', icon: '🔴', textColor: 'text-red-600' },
                    { label: 'In 7 Days', count: expIn7.length, value: sumPurchase(expIn7), retail: sumRetail(expIn7), color: 'from-orange-500 to-red-500', icon: '🟠', textColor: 'text-orange-600' },
                    { label: 'In 30 Days', count: expIn30.length, value: sumPurchase(expIn30), retail: sumRetail(expIn30), color: 'from-yellow-500 to-orange-500', icon: '🟡', textColor: 'text-yellow-600' },
                    { label: 'In 90 Days', count: expIn90.length, value: sumPurchase(expIn90), retail: sumRetail(expIn90), color: 'from-green-500 to-teal-500', icon: '🟢', textColor: 'text-green-600' },
                    { label: 'At-Risk (Cost)', count: null, value: sumPurchase([...allExpired, ...expIn90]), retail: null, color: 'from-purple-500 to-indigo-600', icon: '💰', textColor: 'text-purple-600' },
                    { label: 'At-Risk (Retail)', count: null, value: null, retail: sumRetail([...allExpired, ...expIn90]), color: 'from-cyan-500 to-blue-600', icon: '💎', textColor: 'text-cyan-600' },
                ].map((card, idx) => (
                    <div key={idx} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-lg">{card.icon}</span>
                            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center`}>
                                {card.count !== null && <span className="text-white text-xs font-bold">{card.count}</span>}
                                {card.count === null && <span className="text-white text-xs">$</span>}
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 font-semibold uppercase">{card.label}</p>
                        {card.value !== null && <p className={`text-lg font-black ${card.textColor}`}>Ksh {card.value.toLocaleString()}</p>}
                        {card.retail !== null && card.value !== null && <p className="text-xs text-gray-400">Retail: Ksh {card.retail.toLocaleString()}</p>}
                        {card.value === null && card.retail !== null && <p className={`text-lg font-black ${card.textColor}`}>Ksh {card.retail.toLocaleString()}</p>}
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <div className="relative flex-1 max-w-xs">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2">🔍</span>
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search product, batch, generic..."
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-teal-400 outline-none" />
                </div>
                <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500 font-bold">Expiring in:</span>
                    {[7, 14, 30, 60, 90, 180, 365].map(d => (
                        <button key={d} onClick={() => setFilterDays(d)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterDays === d ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                            {d}d
                        </button>
                    ))}
                </div>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm cursor-pointer">
                    <option value="All">All Status</option>
                    <option value="Expired">Expired Only</option>
                    <option value="Active">Active Only</option>
                </select>
                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm cursor-pointer">
                    <option value="All">All Categories</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm cursor-pointer">
                    <option value="expiry">Sort: Expiry Date</option>
                    <option value="value">Sort: Value (High→Low)</option>
                    <option value="qty">Sort: Quantity</option>
                </select>
                <span className="text-sm text-gray-400 font-medium">{filtered.length} items</span>
            </div>

            {/* DataGrid */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-gradient-to-r from-red-500 to-orange-600 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">⏰ Expiry Items <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs">{filtered.length}</span></h2>
                    <div className="text-xs text-white/80">
                        Total Purchase: <span className="font-bold text-white">Ksh {sumPurchase(filtered).toLocaleString()}</span> | Retail: <span className="font-bold text-white">Ksh {sumRetail(filtered).toLocaleString()}</span>
                    </div>
                </div>
                <table className="w-full">
                    <thead><tr className="bg-gray-50 border-b">
                        <th className="px-3 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase">Product</th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase">Batch #</th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase">Category</th>
                        <th className="px-3 py-2.5 text-center text-[10px] font-bold text-gray-500 uppercase">Expiry Date</th>
                        <th className="px-3 py-2.5 text-center text-[10px] font-bold text-gray-500 uppercase">Days Left</th>
                        <th className="px-3 py-2.5 text-right text-[10px] font-bold text-gray-500 uppercase">Qty</th>
                        <th className="px-3 py-2.5 text-right text-[10px] font-bold text-gray-500 uppercase">Purchase</th>
                        <th className="px-3 py-2.5 text-right text-[10px] font-bold text-gray-500 uppercase">Retail</th>
                        <th className="px-3 py-2.5 text-right text-[10px] font-bold text-gray-500 uppercase">Total Value</th>
                        <th className="px-3 py-2.5 text-center text-[10px] font-bold text-gray-500 uppercase w-20">Action</th>
                    </tr></thead>
                    <tbody>
                        {filtered.map(item => {
                            const days = getDaysUntil(item.expiry_date);
                            const rowBg = days < 0 ? 'bg-red-50' : days <= 7 ? 'bg-orange-50' : days <= 30 ? 'bg-yellow-50/50' : '';
                            return (
                                <tr key={item.batch_id} className={`border-b border-gray-50 hover:bg-teal-50/30 transition-colors ${rowBg}`}>
                                    <td className="px-3 py-2.5">
                                        <p className="text-sm font-semibold text-gray-800">{item.product_name}</p>
                                        {item.generic_name && <p className="text-xs text-teal-600">{item.generic_name}</p>}
                                    </td>
                                    <td className="px-3 py-2.5 font-mono text-sm text-gray-700 font-bold">{item.batch_number}</td>
                                    <td className="px-3 py-2.5"><span className="px-2 py-0.5 bg-gray-100 rounded text-xs">{item.category || '—'}</span></td>
                                    <td className="px-3 py-2.5 text-center text-sm text-gray-600">{item.expiry_date}</td>
                                    <td className="px-3 py-2.5 text-center">{getExpiryBadge(days)}</td>
                                    <td className="px-3 py-2.5 text-right text-sm font-bold">{item.remaining_qty}</td>
                                    <td className="px-3 py-2.5 text-right text-sm text-gray-600">{item.purchase_cost.toLocaleString()}</td>
                                    <td className="px-3 py-2.5 text-right text-sm text-green-600 font-medium">{item.selling_price.toLocaleString()}</td>
                                    <td className="px-3 py-2.5 text-right text-sm font-bold text-gray-800">Ksh {(item.selling_price * item.remaining_qty).toLocaleString()}</td>
                                    <td className="px-3 py-2.5 text-center">
                                        <button onClick={() => markDisposed(item.batch_id)} className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg text-xs font-bold transition-colors" title="Mark as Disposed">
                                            🗑️ Dispose
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {filtered.length === 0 && (
                            <tr><td colSpan={10} className="text-center py-12 text-gray-400">
                                <span className="text-4xl block mb-2">✅</span>No expiring items found with current filters
                            </td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
