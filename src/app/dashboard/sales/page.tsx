'use client';

import { useState, useEffect } from 'react';
import { useCompanyName } from '@/context/SettingsContext';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

interface Sale {
    sale_id: number;
    receipt_no: string;
    sale_date: string;
    sale_datetime: string;
    customer_name: string;
    customer_phone: string;
    subtotal: number;
    discount: number;
    total_amount: number;
    payment_method: string;
    amount_paid: number;
    change_amount: number;
    mpesa_code: string;
    checkout_request_id: string;
    status: string;
}

interface SaleItem {
    item_id: number;
    sale_id: number;
    product_id: number;
    product_name: string;
    quantity: number;
    unit_price: number;
    discount: number;
    subtotal: number;
    selling_unit: string;
}

export default function SalesPage() {
    const { activeOutlet } = useOutlet();
    const outletId = activeOutlet?.outlet_id || 1;
    const [sales, setSales] = useState<Sale[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
    const [filterPayment, setFilterPayment] = useState('All');
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
    const [selectedSaleItems, setSelectedSaleItems] = useState<SaleItem[]>([]);
    const companyName = useCompanyName();

    // Expandable rows state
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
    const [saleItemsCache, setSaleItemsCache] = useState<Record<number, SaleItem[]>>({});
    const [loadingItems, setLoadingItems] = useState<Set<number>>(new Set());

    // Load sales from database
    const loadSales = async () => {
        if (!activeOutlet) return;
        setLoading(true);
        try {
            let data: any[] | null = null;
            const r1 = await supabase
                .from('retail_sales')
                .select('*')
                .eq('outlet_id', outletId)
                .eq('sale_date', filterDate)
                .order('sale_datetime', { ascending: false });
            if (r1.error) {
                const r2 = await supabase
                    .from('retail_sales')
                    .select('*')
                    .eq('sale_date', filterDate)
                    .order('sale_datetime', { ascending: false });
                data = r2.data;
            } else {
                data = r1.data;
            }
            setSales(data || []);
            setExpandedRows(new Set());
            setSaleItemsCache({});
        } catch (err) {
            console.error('Error loading sales:', err);
            toast.error('Failed to load sales');
        } finally {
            setLoading(false);
        }
    };

    // Load sale items for a specific sale
    const loadSaleItems = async (saleId: number) => {
        if (saleItemsCache[saleId]) return saleItemsCache[saleId];
        setLoadingItems(prev => new Set(prev).add(saleId));
        try {
            const { data } = await supabase
                .from('retail_sales_items')
                .select('*')
                .eq('sale_id', saleId)
                .order('item_id');
            const items = data || [];
            setSaleItemsCache(prev => ({ ...prev, [saleId]: items }));
            return items;
        } catch (err) {
            console.error('Error loading sale items:', err);
            return [];
        } finally {
            setLoadingItems(prev => {
                const next = new Set(prev);
                next.delete(saleId);
                return next;
            });
        }
    };

    // Toggle expanded row
    const toggleRow = async (saleId: number) => {
        const next = new Set(expandedRows);
        if (next.has(saleId)) {
            next.delete(saleId);
        } else {
            next.add(saleId);
            await loadSaleItems(saleId);
        }
        setExpandedRows(next);
    };

    // View receipt modal with items
    const viewReceipt = async (sale: Sale) => {
        setSelectedSale(sale);
        const items = await loadSaleItems(sale.sale_id);
        setSelectedSaleItems(items);
        setShowReceiptModal(true);
    };

    useEffect(() => {
        loadSales();
    }, [filterDate, outletId, activeOutlet]);

    const filteredSales = sales.filter(s => {
        const matchesSearch =
            (s.receipt_no || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (s.customer_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (s.customer_phone || '').includes(searchQuery) ||
            (s.mpesa_code || '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchesPayment = filterPayment === 'All' || (s.payment_method || '').toUpperCase() === filterPayment.toUpperCase();
        return matchesSearch && matchesPayment;
    });

    const totalRevenue = filteredSales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
    const cashTotal = filteredSales.filter(s => (s.payment_method || '').toUpperCase() === 'CASH').reduce((sum, s) => sum + (s.total_amount || 0), 0);
    const mpesaTotal = filteredSales.filter(s => (s.payment_method || '').toUpperCase() === 'MPESA' || (s.payment_method || '').toUpperCase() === 'M-PESA').reduce((sum, s) => sum + (s.total_amount || 0), 0);
    const creditTotal = filteredSales.filter(s => (s.payment_method || '').toUpperCase() === 'CREDIT').reduce((sum, s) => sum + (s.total_amount || 0), 0);

    const formatTime = (datetime: string) => {
        if (!datetime) return '';
        const date = new Date(datetime);
        return date.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
    };

    const paymentBadge = (method: string) => {
        const m = (method || '').toUpperCase();
        if (m === 'CASH') return 'bg-yellow-100 text-yellow-700';
        if (m === 'MPESA' || m === 'M-PESA') return 'bg-green-100 text-green-700';
        if (m === 'CREDIT') return 'bg-orange-100 text-orange-700';
        return 'bg-gray-100 text-gray-700';
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <span>💰</span> Sales & Transactions
                    </h1>
                    <p className="text-sm text-gray-500">View all sales across your store</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={loadSales}
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 font-medium transition-colors"
                    >
                        <span>🔄</span> Refresh
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 font-medium">
                        <span>📥</span> Export
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center"><span className="text-2xl">📊</span></div>
                        <div>
                            <p className="text-sm opacity-90 font-medium">Total Sales</p>
                            <p className="text-xl font-bold">Ksh {totalRevenue.toLocaleString()}</p>
                        </div>
                    </div>
                    <p className="text-xs opacity-80 mt-2">{filteredSales.length} transactions</p>
                </div>
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 text-white shadow-lg">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center"><span className="text-2xl">📱</span></div>
                        <div>
                            <p className="text-sm opacity-90 font-medium">M-Pesa</p>
                            <p className="text-xl font-bold">Ksh {mpesaTotal.toLocaleString()}</p>
                        </div>
                    </div>
                    <p className="text-xs opacity-80 mt-2">Mobile payments</p>
                </div>
                <div className="bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl p-6 text-white shadow-lg">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center"><span className="text-2xl">💵</span></div>
                        <div>
                            <p className="text-sm opacity-90 font-medium">Cash</p>
                            <p className="text-xl font-bold">Ksh {cashTotal.toLocaleString()}</p>
                        </div>
                    </div>
                    <p className="text-xs opacity-80 mt-2">Cash payments</p>
                </div>
                <div className="bg-gradient-to-br from-cyan-500 to-blue-500 rounded-2xl p-6 text-white shadow-lg">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center"><span className="text-2xl">💳</span></div>
                        <div>
                            <p className="text-sm opacity-90 font-medium">Credit</p>
                            <p className="text-xl font-bold">Ksh {creditTotal.toLocaleString()}</p>
                        </div>
                    </div>
                    <p className="text-xs opacity-80 mt-2">Credit sales</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="flex-1 relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search receipt, customer, phone, M-Pesa code..."
                            className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 text-sm"
                        />
                    </div>
                    <input
                        type="date"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                        className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 text-sm"
                    />
                    <select
                        value={filterPayment}
                        onChange={(e) => setFilterPayment(e.target.value)}
                        className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 text-sm"
                    >
                        <option value="All">All Payments</option>
                        <option value="Cash">Cash</option>
                        <option value="MPESA">M-Pesa</option>
                        <option value="Credit">Credit</option>
                    </select>
                </div>
            </div>

            {/* Sales Table with Expandable Rows */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                {loading ? (
                    <div className="p-12 text-center text-gray-500">
                        <div className="animate-spin text-3xl mb-3">⏳</div>
                        <p className="text-sm">Loading sales...</p>
                    </div>
                ) : filteredSales.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        <div className="text-4xl mb-3">📭</div>
                        <p className="text-sm">No sales found for selected date</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                                <tr>
                                    <th className="w-10 py-3 px-2"></th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Receipt</th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Time</th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Customer</th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Payment</th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">M-Pesa Code</th>
                                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Amount</th>
                                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSales.map(sale => {
                                    const isExpanded = expandedRows.has(sale.sale_id);
                                    const items = saleItemsCache[sale.sale_id] || [];
                                    const isItemsLoading = loadingItems.has(sale.sale_id);
                                    return (
                                        <>
                                            <tr key={sale.sale_id} className={`border-t border-gray-100 hover:bg-blue-50 transition-colors cursor-pointer ${isExpanded ? 'bg-blue-50' : ''}`} onClick={() => toggleRow(sale.sale_id)}>
                                                {/* Chevron */}
                                                <td className="py-3 px-2 text-center">
                                                    <span className={`inline-block transition-transform duration-200 text-gray-400 text-sm ${isExpanded ? 'rotate-90' : ''}`}>
                                                        ▶
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium">
                                                        {sale.receipt_no || '-'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-600">{formatTime(sale.sale_datetime)}</td>
                                                <td className="py-3 px-4 text-sm font-medium text-gray-800">{sale.customer_name || 'Walk-in'}</td>
                                                <td className="py-3 px-4">
                                                    <span className={`px-3 py-1 rounded-lg text-sm font-medium ${paymentBadge(sale.payment_method)}`}>
                                                        {sale.payment_method || '-'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    {sale.mpesa_code ? (
                                                        <span className="px-3 py-1 bg-green-50 text-green-700 rounded-lg text-sm font-mono font-semibold">{sale.mpesa_code}</span>
                                                    ) : (
                                                        <span className="text-gray-400 text-sm">-</span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 text-right font-bold text-gray-900 text-sm">
                                                    Ksh {(sale.total_amount || 0).toLocaleString()}
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <span className={`px-3 py-1 rounded-lg text-sm font-medium ${sale.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                                        sale.status === 'Credit' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                                                        }`}>
                                                        {sale.status === 'Completed' ? '✅' : sale.status === 'Credit' ? '🔄' : '❌'} {sale.status}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            onClick={() => viewReceipt(sale)}
                                                            className="p-2 hover:bg-blue-100 rounded-lg text-blue-600 transition-colors"
                                                            title="View Receipt"
                                                        >
                                                            👁️
                                                        </button>
                                                        <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors" title="Print">
                                                            🖨️
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* Expanded Items Row */}
                                            {isExpanded && (
                                                <tr key={`items-${sale.sale_id}`} className="bg-gradient-to-r from-blue-50 to-indigo-50">
                                                    <td colSpan={9} className="px-6 py-3">
                                                        {isItemsLoading ? (
                                                            <div className="flex items-center gap-2 text-gray-500 text-sm py-2">
                                                                <span className="animate-spin">⏳</span> Loading items...
                                                            </div>
                                                        ) : items.length === 0 ? (
                                                            <div className="text-gray-400 text-sm py-2">No items found for this sale</div>
                                                        ) : (
                                                            <div className="rounded-xl overflow-hidden border border-blue-200 bg-white">
                                                                <table className="w-full">
                                                                    <thead>
                                                                        <tr className="bg-gradient-to-r from-blue-100 to-indigo-100">
                                                                            <th className="text-left py-2 px-4 text-xs font-semibold text-blue-800">#</th>
                                                                            <th className="text-left py-2 px-4 text-xs font-semibold text-blue-800">Product</th>
                                                                            <th className="text-center py-2 px-4 text-xs font-semibold text-blue-800">Qty</th>
                                                                            <th className="text-right py-2 px-4 text-xs font-semibold text-blue-800">Price</th>
                                                                            <th className="text-right py-2 px-4 text-xs font-semibold text-blue-800">Discount</th>
                                                                            <th className="text-right py-2 px-4 text-xs font-semibold text-blue-800">Subtotal</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {items.map((item, idx) => (
                                                                            <tr key={item.item_id} className={`border-t border-blue-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-blue-50/30'}`}>
                                                                                <td className="py-2 px-4 text-xs text-gray-500">{idx + 1}</td>
                                                                                <td className="py-2 px-4 text-sm font-medium text-gray-800">
                                                                                    {item.product_name}
                                                                                    {item.selling_unit && item.selling_unit !== 'Piece' && (
                                                                                        <span className="ml-1 text-xs text-blue-500">({item.selling_unit})</span>
                                                                                    )}
                                                                                </td>
                                                                                <td className="py-2 px-4 text-center text-sm text-gray-700">{item.quantity}</td>
                                                                                <td className="py-2 px-4 text-right text-sm text-gray-700">Ksh {(item.unit_price || 0).toLocaleString()}</td>
                                                                                <td className="py-2 px-4 text-right text-sm">{(item.discount || 0) > 0 ? <span className="text-red-500">-{item.discount}</span> : <span className="text-gray-300">-</span>}</td>
                                                                                <td className="py-2 px-4 text-right text-sm font-semibold text-gray-900">Ksh {(item.subtotal || (item.unit_price * item.quantity)).toLocaleString()}</td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                    <tfoot>
                                                                        <tr className="border-t-2 border-blue-200 bg-blue-50">
                                                                            <td colSpan={5} className="py-2 px-4 text-right text-sm font-bold text-blue-800">Total:</td>
                                                                            <td className="py-2 px-4 text-right text-sm font-bold text-blue-800">Ksh {(sale.total_amount || 0).toLocaleString()}</td>
                                                                        </tr>
                                                                    </tfoot>
                                                                </table>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Receipt Modal with Items */}
            {showReceiptModal && selectedSale && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="text-center border-b border-dashed border-gray-300 pb-4 mb-4">
                            <h2 className="text-xl font-bold text-gray-800">{companyName}</h2>
                            <p className="text-sm text-gray-500">Sales Receipt</p>
                        </div>

                        <div className="space-y-2 text-sm mb-4">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Receipt:</span>
                                <span className="font-semibold">{selectedSale.receipt_no}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Date/Time:</span>
                                <span>{new Date(selectedSale.sale_datetime).toLocaleString('en-KE')}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Customer:</span>
                                <span>{selectedSale.customer_name || 'Walk-in'}</span>
                            </div>
                            {selectedSale.customer_phone && (
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Phone:</span>
                                    <span className="font-mono">{selectedSale.customer_phone}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-gray-600">Payment:</span>
                                <span className="font-medium">{selectedSale.payment_method}</span>
                            </div>
                            {selectedSale.mpesa_code && (
                                <div className="flex justify-between">
                                    <span className="text-gray-600">M-Pesa Code:</span>
                                    <span className="font-mono text-green-600 font-semibold">{selectedSale.mpesa_code}</span>
                                </div>
                            )}
                        </div>

                        {/* Items Table in Receipt */}
                        {selectedSaleItems.length > 0 && (
                            <div className="border-t border-dashed border-gray-300 pt-3 mb-3">
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Items</h3>
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-gray-500 text-xs">
                                            <th className="text-left py-1">Item</th>
                                            <th className="text-center py-1">Qty</th>
                                            <th className="text-right py-1">Price</th>
                                            <th className="text-right py-1">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedSaleItems.map(item => (
                                            <tr key={item.item_id} className="border-t border-gray-100">
                                                <td className="py-1.5 text-gray-800">{item.product_name}</td>
                                                <td className="py-1.5 text-center text-gray-600">{item.quantity}</td>
                                                <td className="py-1.5 text-right text-gray-600">{(item.unit_price || 0).toLocaleString()}</td>
                                                <td className="py-1.5 text-right font-medium">{(item.subtotal || (item.unit_price * item.quantity)).toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div className="border-t border-dashed border-gray-300 pt-4 mb-4">
                            {(selectedSale.discount || 0) > 0 && (
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-600">Discount:</span>
                                    <span className="text-red-500">-Ksh {selectedSale.discount.toLocaleString()}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-lg font-bold">
                                <span>Total:</span>
                                <span className="text-blue-600">Ksh {(selectedSale.total_amount || 0).toLocaleString()}</span>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowReceiptModal(false)}
                                className="flex-1 py-3 border-2 border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                            >
                                Close
                            </button>
                            <button className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-blue-700 text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2">
                                <span>🖨️</span> Print
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
