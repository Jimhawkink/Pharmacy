'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';
import { FiShoppingBag, FiRefreshCw, FiSearch, FiFilter, FiCalendar, FiChevronLeft, FiChevronRight, FiChevronsLeft, FiChevronsRight, FiX, FiEye, FiTrash2, FiTruck, FiDollarSign, FiCheckCircle, FiClock, FiAlertTriangle, FiDownload, FiPlus, FiTrendingUp, FiPackage, FiPrinter, FiFileText } from 'react-icons/fi';

interface Purchase {
    purchase_id: number; purchase_no: string; purchase_date: string;
    supplier_id: number; supplier_name: string; supplier_invoice: string;
    sub_total: number; discount: number; vat: number; grand_total: number;
    status: string; payment_status: string; created_by: string; created_at: string;
}
interface PurchaseItem {
    pp_id: number; product_id: number; product_code: string; product_name: string;
    quantity: number; unit: string; rate: number; total_amount: number;
}
interface Supplier { supplier_id: number; supplier_name: string; }
interface Category { category_id: number; category_name: string; }

export default function PurchasesPage() {
    const { activeOutlet } = useOutlet();
    const outletId = activeOutlet?.outlet_id || 1;
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [filterSupplier, setFilterSupplier] = useState('All');
    const [filterStatus, setFilterStatus] = useState('All');
    const [filterPayment, setFilterPayment] = useState('All');
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(20);

    // View Modal
    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
    const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
    const [isLoadingItems, setIsLoadingItems] = useState(false);

    // ─── DATA LOADING ───
    const loadPurchases = useCallback(async () => {
        if (!activeOutlet) return; // Wait for outlet context
        setIsLoading(true);
        try {
            // Try with outlet_id, fallback without
            let query = supabase.from('retail_purchases').select('*').eq('outlet_id', outletId).order('purchase_id', { ascending: false });
            if (dateFrom) query = query.gte('purchase_date', dateFrom);
            if (dateTo) query = query.lte('purchase_date', dateTo);
            let { data, error } = await query;
            if (error) {
                let fb = supabase.from('retail_purchases').select('*').order('purchase_id', { ascending: false });
                if (dateFrom) fb = fb.gte('purchase_date', dateFrom);
                if (dateTo) fb = fb.lte('purchase_date', dateTo);
                const r2 = await fb;
                data = r2.data;
            }
            setPurchases(data || []);
        } catch { toast.error('Failed to load purchases'); }
        setIsLoading(false);
    }, [dateFrom, dateTo]);

    const loadSuppliers = useCallback(async () => {
        try { const { data } = await supabase.from('retail_suppliers').select('supplier_id, supplier_name').eq('active', true).order('supplier_name'); setSuppliers(data || []); } catch { /* silent */ }
    }, []);

    const loadCategories = useCallback(async () => {
        try { const { data } = await supabase.from('retail_categories').select('category_id, category_name').eq('active', true).order('category_name'); setCategories(data || []); } catch { /* silent */ }
    }, []);

    useEffect(() => { loadPurchases(); loadSuppliers(); loadCategories(); }, [loadPurchases, loadSuppliers, loadCategories]);

    // ─── ACTIONS ───
    const viewPurchaseDetails = async (purchase: Purchase) => {
        setSelectedPurchase(purchase); setShowViewModal(true); setIsLoadingItems(true);
        try { const { data, error } = await supabase.from('retail_purchase_products').select('*').eq('purchase_id', purchase.purchase_id); if (error) throw error; setPurchaseItems(data || []); }
        catch { toast.error('Failed to load items'); }
        setIsLoadingItems(false);
    };

    const deletePurchase = async (purchase: Purchase) => {
        if (!confirm(`Delete purchase ${purchase.purchase_no}? This will also delete all items and reverse stock.`)) return;
        try {
            // Reverse stock
            const { data: items } = await supabase.from('retail_purchase_products').select('product_id, quantity').eq('purchase_id', purchase.purchase_id);
            if (items) {
                for (const item of items) {
                    await supabase.from('retail_stock').insert({ pid: item.product_id, invoice_no: `DEL-${purchase.purchase_no}`, qty: -item.quantity, storage_type: 'Store', notes: `Purchase ${purchase.purchase_no} deleted` });
                }
            }
            await supabase.from('retail_purchase_products').delete().eq('purchase_id', purchase.purchase_id);
            const { error } = await supabase.from('retail_purchases').delete().eq('purchase_id', purchase.purchase_id);
            if (error) throw error;
            toast.success('Purchase deleted & stock reversed'); loadPurchases();
        } catch { toast.error('Failed to delete purchase'); }
    };

    const exportPurchases = () => {
        const headers = ['Purchase No,Date,Supplier,Invoice,Sub Total,Discount,Grand Total,Status,Payment'];
        const rows = filtered.map(p => `${p.purchase_no},${p.purchase_date},${p.supplier_name || ''},${p.supplier_invoice || ''},${p.sub_total},${p.discount || 0},${p.grand_total},${p.status || ''},${p.payment_status || ''}`);
        const csv = headers.concat(rows).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `purchases_${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
        toast.success('Exported!');
    };

    const printPurchaseDetail = (purchase: Purchase, items: PurchaseItem[]) => {
        const html = `<!DOCTYPE html><html><head><style>
            @page{margin:10mm;}body{font-family:Arial,sans-serif;font-size:12px;}h1{font-size:18px;text-align:center;margin-bottom:4px;}
            .info{display:flex;justify-content:space-between;margin:8px 0;}.info span{font-size:11px;}.info b{font-size:12px;}
            table{width:100%;border-collapse:collapse;margin-top:10px;}th,td{border:1px solid #ccc;padding:6px 8px;font-size:11px;}
            th{background:#f0f0f0;font-weight:bold;text-align:left;}.right{text-align:right;}.total{font-size:14px;font-weight:bold;text-align:right;margin-top:8px;}
        </style></head><body>
        <h1>Purchase Order - ${purchase.purchase_no}</h1>
        <div class="info"><span>Supplier: <b>${purchase.supplier_name || 'N/A'}</b></span><span>Date: <b>${new Date(purchase.purchase_date).toLocaleDateString('en-GB')}</b></span></div>
        <div class="info"><span>Invoice: <b>${purchase.supplier_invoice || 'N/A'}</b></span><span>Status: <b>${purchase.payment_status || 'N/A'}</b></span></div>
        <table><thead><tr><th>#</th><th>Code</th><th>Product</th><th>Unit</th><th class="right">Qty</th><th class="right">Rate</th><th class="right">Total</th></tr></thead>
        <tbody>${items.map((item, i) => `<tr><td>${i + 1}</td><td>${item.product_code}</td><td>${item.product_name}</td><td>${item.unit}</td><td class="right">${item.quantity}</td><td class="right">Ksh ${item.rate?.toLocaleString()}</td><td class="right">Ksh ${item.total_amount?.toLocaleString()}</td></tr>`).join('')}</tbody></table>
        <p class="total">Grand Total: Ksh ${purchase.grand_total.toLocaleString()}</p>
        </body></html>`;
        const iframe = document.createElement('iframe'); iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;';
        document.body.appendChild(iframe); const doc = iframe.contentWindow?.document;
        if (doc) { doc.open(); doc.write(html); doc.close(); setTimeout(() => { iframe.contentWindow?.print(); setTimeout(() => document.body.removeChild(iframe), 2000); }, 500); }
    };

    const clearFilters = () => { setSearchQuery(''); setDateFrom(''); setDateTo(''); setFilterSupplier('All'); setFilterStatus('All'); setFilterPayment('All'); setPage(1); };

    // ─── COMPUTED ───
    const filtered = purchases.filter(p => {
        const q = searchQuery.toLowerCase();
        const matchSearch = !q || p.purchase_no?.toLowerCase().includes(q) || p.supplier_name?.toLowerCase().includes(q) || p.supplier_invoice?.toLowerCase().includes(q);
        const matchSupplier = filterSupplier === 'All' || p.supplier_name === filterSupplier;
        const matchStatus = filterStatus === 'All' || p.status === filterStatus;
        const matchPayment = filterPayment === 'All' || p.payment_status === filterPayment;
        return matchSearch && matchSupplier && matchStatus && matchPayment;
    });
    const totalPages = Math.ceil(filtered.length / perPage);
    const paginated = filtered.slice((page - 1) * perPage, page * perPage);
    const totalAmount = filtered.reduce((s, p) => s + (p.grand_total || 0), 0);
    const paidCount = filtered.filter(p => p.payment_status === 'Paid').length;
    const pendingCount = filtered.filter(p => p.payment_status !== 'Paid').length;
    const thisMonth = filtered.filter(p => { const d = new Date(p.purchase_date); const n = new Date(); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear(); });
    const thisMonthTotal = thisMonth.reduce((s, p) => s + (p.grand_total || 0), 0);
    const uniqueSuppliers = Array.from(new Set(filtered.map(p => p.supplier_name).filter((n): n is string => !!n)));

    return (
        <div className="space-y-5" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>

            {/* ━━━ TOP BAR ━━━ */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-300/40">
                        <FiShoppingBag className="text-white" size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Purchase Records</h1>
                        <p className="text-gray-500 text-sm mt-1">Track, manage & analyze all procurement orders</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => { loadPurchases(); }} className="p-2.5 rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-all shadow-sm" title="Refresh"><FiRefreshCw size={16} /></button>
                    <button onClick={exportPurchases} className="px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-600 hover:text-blue-600 hover:border-blue-300 transition-all text-sm font-semibold flex items-center gap-2 shadow-sm">
                        <FiDownload size={14} /> Export
                    </button>
                    <a href="/dashboard/purchase" className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold rounded-2xl shadow-lg shadow-indigo-300/40 hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-300">
                        <FiPlus size={16} strokeWidth={3} /> New Purchase
                    </a>
                </div>
            </div>

            {/* ━━━ PREMIUM STAT CARDS ━━━ */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="relative overflow-hidden rounded-2xl bg-white border border-indigo-100 p-5 shadow-sm hover:shadow-xl transition-all group">
                    <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-gradient-to-br from-indigo-100 to-purple-50 opacity-60 group-hover:scale-125 transition-transform" />
                    <div className="relative flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-indigo-500 uppercase tracking-wider">Total Purchases</p>
                            <p className="text-3xl font-black text-gray-800 mt-1">{filtered.length}</p>
                            <p className="text-[10px] text-gray-400 mt-1">All purchase orders</p>
                        </div>
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-300/30 group-hover:scale-110 transition-transform">
                            <FiShoppingBag className="text-white" size={22} />
                        </div>
                    </div>
                </div>
                <div className="relative overflow-hidden rounded-2xl bg-white border border-emerald-100 p-5 shadow-sm hover:shadow-xl transition-all group">
                    <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-gradient-to-br from-emerald-100 to-green-50 opacity-60 group-hover:scale-125 transition-transform" />
                    <div className="relative flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Paid Orders</p>
                            <p className="text-3xl font-black text-gray-800 mt-1">{paidCount}</p>
                            <p className="text-[10px] text-gray-400 mt-1">Fully settled</p>
                        </div>
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-300/30 group-hover:scale-110 transition-transform">
                            <FiCheckCircle className="text-white" size={22} />
                        </div>
                    </div>
                </div>
                <div className="relative overflow-hidden rounded-2xl bg-white border border-amber-100 p-5 shadow-sm hover:shadow-xl transition-all group">
                    <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-gradient-to-br from-amber-100 to-orange-50 opacity-60 group-hover:scale-125 transition-transform" />
                    <div className="relative flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-amber-500 uppercase tracking-wider">Pending / Unpaid</p>
                            <p className="text-3xl font-black text-gray-800 mt-1">{pendingCount}</p>
                            <p className="text-[10px] text-gray-400 mt-1">{pendingCount > 0 ? 'Awaiting payment' : 'All clear!'}</p>
                        </div>
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform ${pendingCount > 0 ? 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-300/30' : 'bg-gradient-to-br from-teal-500 to-cyan-600 shadow-teal-300/30'}`}>
                            <FiClock className="text-white" size={22} />
                        </div>
                    </div>
                </div>
                <div className="relative overflow-hidden rounded-2xl bg-white border border-blue-100 p-5 shadow-sm hover:shadow-xl transition-all group">
                    <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-gradient-to-br from-blue-100 to-cyan-50 opacity-60 group-hover:scale-125 transition-transform" />
                    <div className="relative flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-blue-500 uppercase tracking-wider">Suppliers</p>
                            <p className="text-3xl font-black text-gray-800 mt-1">{uniqueSuppliers.length}</p>
                            <p className="text-[10px] text-gray-400 mt-1">Active vendors</p>
                        </div>
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-blue-300/30 group-hover:scale-110 transition-transform">
                            <FiTruck className="text-white" size={22} />
                        </div>
                    </div>
                </div>
            </div>

            {/* ━━━ VALUATION CARDS ━━━ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-700 p-5 text-white shadow-lg shadow-indigo-400/20 hover:shadow-xl transition-all relative overflow-hidden">
                    <div className="absolute right-3 top-3 w-16 h-16 rounded-full bg-white/10 blur-lg" />
                    <div className="absolute right-8 bottom-2 opacity-10"><FiDollarSign size={70} /></div>
                    <p className="text-xs font-bold text-indigo-200 uppercase tracking-wider">Total Purchase Value</p>
                    <p className="text-3xl font-black mt-2">Ksh {totalAmount.toLocaleString()}</p>
                    <div className="flex items-center gap-2 mt-2"><FiTrendingUp size={14} className="text-indigo-200" /><span className="text-xs text-indigo-200">All filtered purchases combined</span></div>
                </div>
                <div className="rounded-2xl bg-gradient-to-br from-emerald-500 via-green-600 to-teal-700 p-5 text-white shadow-lg shadow-emerald-400/20 hover:shadow-xl transition-all relative overflow-hidden">
                    <div className="absolute right-3 top-3 w-16 h-16 rounded-full bg-white/10 blur-lg" />
                    <div className="absolute right-8 bottom-2 opacity-10"><FiCalendar size={70} /></div>
                    <p className="text-xs font-bold text-emerald-200 uppercase tracking-wider">This Month Purchases</p>
                    <p className="text-3xl font-black mt-2">Ksh {thisMonthTotal.toLocaleString()}</p>
                    <div className="flex items-center gap-2 mt-2"><FiTrendingUp size={14} className="text-emerald-200" /><span className="text-xs text-emerald-200">{thisMonth.length} orders this month</span></div>
                </div>
                <div className="rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 p-5 text-white shadow-lg shadow-orange-400/20 hover:shadow-xl transition-all relative overflow-hidden">
                    <div className="absolute right-3 top-3 w-16 h-16 rounded-full bg-white/10 blur-lg" />
                    <div className="absolute right-8 bottom-2 opacity-10"><FiAlertTriangle size={70} /></div>
                    <p className="text-xs font-bold text-amber-100 uppercase tracking-wider">Unpaid Balance</p>
                    <p className="text-3xl font-black mt-2">Ksh {filtered.filter(p => p.payment_status !== 'Paid').reduce((s, p) => s + (p.grand_total || 0), 0).toLocaleString()}</p>
                    <div className="flex items-center gap-2 mt-2"><FiClock size={14} className="text-amber-100" /><span className="text-xs text-amber-100">{pendingCount} pending orders to settle</span></div>
                </div>
            </div>

            {/* ━━━ FILTERS ━━━ */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-[200px] relative">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input type="text" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                            placeholder="Search invoice, supplier..." className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-indigo-500 outline-none" />
                    </div>
                    <div className="min-w-[130px]">
                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">From Date</label>
                        <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-indigo-500 outline-none" />
                    </div>
                    <div className="min-w-[130px]">
                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">To Date</label>
                        <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-indigo-500 outline-none" />
                    </div>
                    <div className="min-w-[140px]">
                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Supplier</label>
                        <select value={filterSupplier} onChange={e => { setFilterSupplier(e.target.value); setPage(1); }}
                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-indigo-500 outline-none cursor-pointer">
                            <option value="All">All Suppliers</option>
                            {suppliers.map(s => <option key={s.supplier_id} value={s.supplier_name}>{s.supplier_name}</option>)}
                        </select>
                    </div>
                    <div className="min-w-[120px]">
                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Status</label>
                        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-indigo-500 outline-none cursor-pointer">
                            <option value="All">All Status</option>
                            <option value="Completed">Completed</option>
                            <option value="Pending">Pending</option>
                            <option value="Cancelled">Cancelled</option>
                        </select>
                    </div>
                    <div className="min-w-[120px]">
                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Payment</label>
                        <select value={filterPayment} onChange={e => { setFilterPayment(e.target.value); setPage(1); }}
                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-indigo-500 outline-none cursor-pointer">
                            <option value="All">All Payments</option>
                            <option value="Paid">Paid</option>
                            <option value="Unpaid">Unpaid</option>
                            <option value="Partial">Partial</option>
                        </select>
                    </div>
                    <button onClick={clearFilters} className="px-4 py-2.5 bg-gray-100 text-gray-500 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-all flex items-center gap-1">
                        <FiX size={14} /> Clear
                    </button>
                    <button onClick={loadPurchases} className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl text-sm font-bold hover:shadow-lg transition-all flex items-center gap-2">
                        <FiFilter size={14} /> Apply
                    </button>
                </div>
            </div>

            {/* ━━━ TABLE ━━━ */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-14 h-14 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                    <p className="mt-4 text-gray-500 font-medium text-sm">Loading purchases...</p>
                </div>
            ) : paginated.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
                    <FiShoppingBag className="text-gray-300" size={64} />
                    <p className="mt-4 text-gray-500 font-semibold">No purchases found</p>
                    <a href="/dashboard/purchase" className="mt-3 px-5 py-2 bg-indigo-500 text-white rounded-xl font-semibold hover:bg-indigo-600 transition-all text-sm">Create First Purchase</a>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gradient-to-r from-indigo-500 to-purple-600">
                                    <th className="px-4 py-3.5 text-left text-[11px] font-bold text-indigo-100 uppercase tracking-wider">Invoice</th>
                                    <th className="px-4 py-3.5 text-left text-[11px] font-bold text-indigo-100 uppercase tracking-wider">Date</th>
                                    <th className="px-4 py-3.5 text-left text-[11px] font-bold text-indigo-100 uppercase tracking-wider">Supplier</th>
                                    <th className="px-4 py-3.5 text-left text-[11px] font-bold text-indigo-100 uppercase tracking-wider hidden md:table-cell">Sup. Invoice</th>
                                    <th className="px-4 py-3.5 text-right text-[11px] font-bold text-indigo-100 uppercase tracking-wider">Amount</th>
                                    <th className="px-4 py-3.5 text-center text-[11px] font-bold text-indigo-100 uppercase tracking-wider">Status</th>
                                    <th className="px-4 py-3.5 text-center text-[11px] font-bold text-indigo-100 uppercase tracking-wider">Payment</th>
                                    <th className="px-4 py-3.5 text-center text-[11px] font-bold text-indigo-100 uppercase tracking-wider">Created By</th>
                                    <th className="px-4 py-3.5 text-center text-[11px] font-bold text-indigo-100 uppercase tracking-wider w-28">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginated.map((p, idx) => (
                                    <tr key={p.purchase_id} className={`border-b border-gray-50 hover:bg-indigo-50/40 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                                        <td className="px-4 py-3">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold">
                                                <FiFileText size={11} /> {p.purchase_no}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600">{new Date(p.purchase_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{(p.supplier_name || 'N')[0]}</div>
                                                <span className="text-sm font-semibold text-gray-800 truncate max-w-[120px]">{p.supplier_name || 'N/A'}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell">{p.supplier_invoice || '—'}</td>
                                        <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">Ksh {(p.grand_total || 0).toLocaleString()}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${p.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : p.status === 'Cancelled' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${p.status === 'Completed' ? 'bg-emerald-500' : p.status === 'Cancelled' ? 'bg-red-500' : 'bg-amber-500'}`} />{p.status || 'Pending'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${p.payment_status === 'Paid' ? 'bg-cyan-100 text-cyan-700' : p.payment_status === 'Partial' ? 'bg-purple-100 text-purple-700' : 'bg-red-100 text-red-600'}`}>
                                                {p.payment_status || 'Unpaid'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center text-xs text-gray-500">{p.created_by || '—'}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-center gap-1">
                                                <button onClick={() => viewPurchaseDetails(p)} className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all" title="View"><FiEye size={12} /></button>
                                                <button onClick={() => deletePurchase(p)} className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-all" title="Delete"><FiTrash2 size={12} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ━━━ FLOATING PAGINATION FOOTER ━━━ */}
            <div className="sticky bottom-0 z-30 bg-white/95 backdrop-blur-md border-t border-gray-200 rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-5 py-3 -mx-5 mt-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500">Showing</span>
                        <select value={perPage} onChange={e => { setPerPage(parseInt(e.target.value)); setPage(1); }} className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold focus:border-indigo-500 outline-none">
                            {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                        <span className="text-sm text-gray-500">of <span className="font-bold text-gray-800">{filtered.length}</span> purchases</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button onClick={() => setPage(1)} disabled={page === 1} className="p-2 rounded-lg bg-gray-50 border border-gray-200 text-gray-500 hover:text-indigo-600 hover:border-indigo-300 disabled:opacity-30 transition-all" title="First"><FiChevronsLeft size={14} /></button>
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg bg-gray-50 border border-gray-200 text-gray-500 hover:text-indigo-600 hover:border-indigo-300 disabled:opacity-30 transition-all" title="Previous"><FiChevronLeft size={14} /></button>
                        {Array.from({ length: Math.min(7, totalPages || 1) }, (_, i) => {
                            const start = Math.max(1, Math.min(page - 3, (totalPages || 1) - 6));
                            const pg = start + i; if (pg > (totalPages || 1)) return null;
                            return (
                                <button key={pg} onClick={() => setPage(pg)}
                                    className={`w-9 h-9 rounded-lg text-xs font-bold transition-all ${pg === page ? 'bg-indigo-500 text-white shadow-md shadow-indigo-300/30' : 'bg-gray-50 border border-gray-200 text-gray-600 hover:text-indigo-600 hover:border-indigo-300'}`}>{pg}</button>
                            );
                        })}
                        <button onClick={() => setPage(p => Math.min(totalPages || 1, p + 1))} disabled={page >= (totalPages || 1)} className="p-2 rounded-lg bg-gray-50 border border-gray-200 text-gray-500 hover:text-indigo-600 hover:border-indigo-300 disabled:opacity-30 transition-all" title="Next"><FiChevronRight size={14} /></button>
                        <button onClick={() => setPage(totalPages || 1)} disabled={page >= (totalPages || 1)} className="p-2 rounded-lg bg-gray-50 border border-gray-200 text-gray-500 hover:text-indigo-600 hover:border-indigo-300 disabled:opacity-30 transition-all" title="Last"><FiChevronsRight size={14} /></button>
                    </div>
                    <span className="text-sm text-gray-400">Page <span className="font-bold text-gray-700">{page}</span> of <span className="font-bold text-gray-700">{totalPages || 1}</span></span>
                </div>
            </div>

            {/* ━━━ VIEW PURCHASE MODAL ━━━ */}
            {showViewModal && selectedPurchase && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center p-4 z-50" onClick={() => setShowViewModal(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-4 text-white sticky top-0 z-10 flex items-center justify-between rounded-t-3xl">
                            <div className="flex items-center gap-3"><FiShoppingBag size={20} /><div><h2 className="text-lg font-bold">Purchase {selectedPurchase.purchase_no}</h2><p className="text-indigo-100 text-xs">{new Date(selectedPurchase.purchase_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p></div></div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => printPurchaseDetail(selectedPurchase, purchaseItems)} className="p-2 hover:bg-white/20 rounded-xl" title="Print"><FiPrinter size={16} /></button>
                                <button onClick={() => setShowViewModal(false)} className="p-2 hover:bg-white/20 rounded-xl"><FiX size={18} /></button>
                            </div>
                        </div>
                        <div className="p-5 space-y-5">
                            {/* Info Grid */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                <div className="p-3 bg-gray-50 rounded-xl"><p className="text-[10px] text-gray-400 uppercase font-bold">Invoice No</p><p className="text-sm font-bold text-gray-800 mt-0.5">{selectedPurchase.purchase_no}</p></div>
                                <div className="p-3 bg-gray-50 rounded-xl"><p className="text-[10px] text-gray-400 uppercase font-bold">Supplier</p><p className="text-sm font-bold text-gray-800 mt-0.5">{selectedPurchase.supplier_name || 'N/A'}</p></div>
                                <div className="p-3 bg-gray-50 rounded-xl"><p className="text-[10px] text-gray-400 uppercase font-bold">Status</p><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold mt-0.5 ${selectedPurchase.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{selectedPurchase.status || 'Pending'}</span></div>
                                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200"><p className="text-[10px] text-emerald-500 uppercase font-bold">Grand Total</p><p className="text-xl font-black text-emerald-700 mt-0.5">Ksh {selectedPurchase.grand_total.toLocaleString()}</p></div>
                            </div>
                            {/* Items Table */}
                            <div>
                                <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2"><FiPackage size={14} /> Purchase Items ({purchaseItems.length})</h3>
                                {isLoadingItems ? (
                                    <div className="text-center py-8"><div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" /><p className="mt-2 text-gray-400 text-sm">Loading...</p></div>
                                ) : purchaseItems.length === 0 ? (
                                    <p className="text-center text-gray-400 py-8 text-sm">No items found</p>
                                ) : (
                                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                        <table className="w-full">
                                            <thead><tr className="bg-gray-50">
                                                <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">#</th>
                                                <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">Code</th>
                                                <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">Product</th>
                                                <th className="px-3 py-2 text-center text-[10px] font-bold text-gray-500 uppercase">Unit</th>
                                                <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-500 uppercase">Qty</th>
                                                <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-500 uppercase">Rate</th>
                                                <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-500 uppercase">Total</th>
                                            </tr></thead>
                                            <tbody>
                                                {purchaseItems.map((item, idx) => (
                                                    <tr key={item.pp_id} className={`border-t border-gray-100 ${idx % 2 ? 'bg-gray-50/30' : ''}`}>
                                                        <td className="px-3 py-2 text-xs text-gray-400">{idx + 1}</td>
                                                        <td className="px-3 py-2 text-xs text-indigo-600 font-mono font-medium">{item.product_code}</td>
                                                        <td className="px-3 py-2 text-sm font-semibold text-gray-800">{item.product_name}</td>
                                                        <td className="px-3 py-2 text-center"><span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{item.unit}</span></td>
                                                        <td className="px-3 py-2 text-right text-sm font-bold text-gray-700">{item.quantity}</td>
                                                        <td className="px-3 py-2 text-right text-xs text-gray-500">Ksh {item.rate?.toLocaleString()}</td>
                                                        <td className="px-3 py-2 text-right text-sm font-bold text-emerald-600">Ksh {item.total_amount?.toLocaleString()}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                            {/* Totals */}
                            <div className="flex justify-end">
                                <div className="w-64 space-y-2 bg-gray-50 rounded-xl p-4">
                                    <div className="flex justify-between text-sm"><span className="text-gray-500">Sub Total</span><span className="font-medium">Ksh {(selectedPurchase.sub_total || 0).toLocaleString()}</span></div>
                                    {(selectedPurchase.discount || 0) > 0 && <div className="flex justify-between text-sm"><span className="text-gray-500">Discount</span><span className="font-medium text-red-500">-Ksh {selectedPurchase.discount.toLocaleString()}</span></div>}
                                    <div className="border-t border-gray-200 pt-2 flex justify-between text-base"><span className="font-bold text-gray-700">Grand Total</span><span className="font-black text-emerald-600">Ksh {selectedPurchase.grand_total.toLocaleString()}</span></div>
                                </div>
                            </div>
                            <div className="flex gap-3 pt-3 border-t">
                                <button onClick={() => printPurchaseDetail(selectedPurchase, purchaseItems)} className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2"><FiPrinter size={14} /> Print</button>
                                <button onClick={() => setShowViewModal(false)} className="flex-1 px-4 py-3 border-2 border-gray-200 text-gray-600 font-bold rounded-xl text-sm">Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
