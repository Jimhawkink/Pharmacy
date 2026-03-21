'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Product {
    pid: number;
    product_code: string;
    product_name: string;
    alias: string;
    category: string;
    sales_unit: string;
    purchase_cost: number;
    sales_cost: number;
    active: boolean;
}

interface HistoryItem {
    type: 'Sale' | 'Purchase' | 'Movement' | 'Opening';
    date: string;
    qty: number;
    price?: number;
    reference?: string;
    notes?: string;
    details?: string;
}

export default function ItemLookupPage({ params }: { params: Promise<{ pid: string }> }) {
    const resolvedParams = use(params);
    const pid = resolvedParams.pid;
    const router = useRouter();

    const [product, setProduct] = useState<Product | null>(null);
    const [historyData, setHistoryData] = useState<HistoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [stockData, setStockData] = useState<number>(0);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            // 1. Fetch Product Details
            const { data: prod, error: pErr } = await supabase
                .from('retail_products')
                .select('*')
                .eq('pid', pid)
                .single();

            if (pErr) throw pErr;
            setProduct(prod);

            // 2. Fetch Stock Level
            const { data: stock } = await supabase
                .from('retail_stock')
                .select('qty')
                .eq('pid', pid);

            const totalStock = (stock || []).reduce((sum, s) => sum + (s.qty || 0), 0);
            setStockData(totalStock);

            // 3. Fetch History Items
            const combined: HistoryItem[] = [];

            // Sales
            const { data: sales } = await supabase
                .from('retail_sales_items')
                .select(`
                    quantity,
                    unit_price,
                    created_at,
                    sale:sale_id (receipt_no, sale_date, customer_name)
                `)
                .eq('product_id', pid);

            sales?.forEach(s => combined.push({
                type: 'Sale',
                date: (s.sale as any)?.sale_date || s.created_at,
                qty: -s.quantity,
                price: s.unit_price,
                reference: (s.sale as any)?.receipt_no,
                details: (s.sale as any)?.customer_name ? `Customer: ${(s.sale as any).customer_name}` : undefined
            }));

            // Purchases
            const { data: purchases } = await supabase
                .from('retail_purchase_products')
                .select(`
                    quantity,
                    rate,
                    created_at,
                    purchase:purchase_id (purchase_no, purchase_date, supplier_name)
                `)
                .eq('product_id', pid);

            purchases?.forEach(p => combined.push({
                type: 'Purchase',
                date: (p.purchase as any)?.purchase_date || p.created_at,
                qty: p.quantity,
                price: p.rate,
                reference: (p.purchase as any)?.purchase_no,
                details: (p.purchase as any)?.supplier_name ? `Supplier: ${(p.purchase as any).supplier_name}` : undefined
            }));

            // Movements
            const { data: movements } = await supabase
                .from('retail_stock_movements')
                .select('*')
                .eq('product_id', pid);

            movements?.forEach(m => combined.push({
                type: 'Movement',
                date: m.movement_date || m.created_at,
                qty: m.movement_type?.toLowerCase() === 'in' ? m.quantity : -m.quantity,
                price: m.unit_cost,
                reference: m.reference_no,
                notes: m.reason
            }));

            // Initial Stock
            const { data: initialStock } = await supabase
                .from('retail_stock')
                .select('*')
                .eq('pid', pid)
                .eq('invoice_no', 'OPENING');

            initialStock?.forEach(st => {
                combined.push({
                    type: 'Opening',
                    date: st.created_at,
                    qty: st.qty,
                    reference: 'OPENING'
                });
            });

            setHistoryData(combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        } catch (err) {
            console.error('Error loading item history:', err);
            toast.error('Failed to load item activity');
        } finally {
            setIsLoading(false);
        }
    }, [pid]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                <p className="text-gray-500 font-medium animate-pulse">Loading item activity...</p>
            </div>
        );
    }

    if (!product) {
        return (
            <div className="text-center py-20 bg-white rounded-3xl shadow-sm border border-gray-100">
                <div className="text-6xl mb-4">🚫</div>
                <h2 className="text-2xl font-bold text-gray-800">Product not found</h2>
                <p className="text-gray-500 mt-2">The product you're looking for doesn't exist.</p>
                <Link href="/dashboard/products" className="mt-6 inline-block px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold">
                    Go Back
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Breadcrumbs & Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                        <Link href="/dashboard/products" className="hover:text-indigo-600 transition-colors">Products</Link>
                        <span>›</span>
                        <span className="text-gray-800 font-medium">Item Lookup</span>
                    </div>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-3">
                        <span className="p-2 bg-indigo-100 rounded-xl text-2xl">🔍</span>
                        {product.product_name}
                    </h1>
                    <p className="text-gray-500 mt-1 flex items-center gap-3">
                        <span className="px-2 py-0.5 bg-gray-100 rounded-md text-xs font-bold">{product.product_code}</span>
                        <span>•</span>
                        <span>{product.category || 'No Category'}</span>
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.back()}
                        className="px-5 py-2.5 border-2 border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-all"
                    >
                        ← Back
                    </button>
                    <button
                        onClick={() => window.print()}
                        className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center gap-2"
                    >
                        <span>🖨️</span> Print History
                    </button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-2xl">📦</div>
                    <div>
                        <p className="text-sm text-gray-500 font-medium">Current Stock</p>
                        <p className={`text-2xl font-black ${stockData > 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {stockData.toLocaleString()} {product.sales_unit}
                        </p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center text-2xl">💰</div>
                    <div>
                        <p className="text-sm text-gray-500 font-medium">Selling Price</p>
                        <p className="text-2xl font-black text-gray-800">
                            Ksh {product.sales_cost.toLocaleString()}
                        </p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-purple-50 flex items-center justify-center text-2xl">💹</div>
                    <div>
                        <p className="text-sm text-gray-500 font-medium">Purchase Cost</p>
                        <p className="text-2xl font-black text-gray-800">
                            Ksh {product.purchase_cost.toLocaleString()}
                        </p>
                    </div>
                </div>
            </div>

            {/* Activity Timeline */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <span>⌛</span> Activity Timeline
                    </h3>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Sort: Newest First</span>
                </div>

                <div className="p-6">
                    {historyData.length === 0 ? (
                        <div className="text-center py-20">
                            <div className="text-6xl mb-4">📭</div>
                            <h3 className="text-lg font-bold text-gray-800">No activity found</h3>
                            <p className="text-gray-500">This item hasn't had any movements yet.</p>
                        </div>
                    ) : (
                        <div className="relative">
                            <div className="absolute left-[23px] top-6 bottom-6 w-0.5 bg-indigo-50"></div>
                            <div className="space-y-8">
                                {historyData.map((item, idx) => (
                                    <div key={idx} className="relative flex gap-8 pl-14 group">
                                        <div className={`absolute left-0 w-12 h-12 rounded-2xl flex items-center justify-center z-10 shadow-sm border-4 border-white transition-transform group-hover:scale-110 ${item.type === 'Sale' ? 'bg-orange-100 text-orange-600' :
                                                item.type === 'Purchase' ? 'bg-green-100 text-green-600' :
                                                    item.type === 'Movement' ? 'bg-blue-100 text-blue-600' :
                                                        'bg-purple-100 text-purple-600'
                                            }`}>
                                            {item.type === 'Sale' ? '🛒' :
                                                item.type === 'Purchase' ? '📥' :
                                                    item.type === 'Movement' ? '🔄' : '📦'}
                                        </div>

                                        <div className="flex-1">
                                            <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
                                                <div>
                                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${item.type === 'Sale' ? 'bg-orange-600 text-white' :
                                                            item.type === 'Purchase' ? 'bg-green-600 text-white' :
                                                                item.type === 'Movement' ? 'bg-blue-600 text-white' :
                                                                    'bg-purple-600 text-white'
                                                        }`}>
                                                        {item.type}
                                                    </span>
                                                    <h4 className="mt-1 font-bold text-gray-800 text-lg">
                                                        {item.qty > 0 ? '+' : ''}{item.qty} {product.sales_unit}
                                                    </h4>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-bold text-gray-700">
                                                        {new Date(item.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </p>
                                                    <p className="text-xs text-gray-400">
                                                        {new Date(item.date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="bg-gray-50 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 border border-transparent group-hover:border-indigo-100 transition-all">
                                                <div className="space-y-1">
                                                    {item.reference && (
                                                        <p className="text-sm text-gray-700">
                                                            <span className="text-gray-400 font-medium">Ref:</span> <span className="font-bold">{item.reference}</span>
                                                        </p>
                                                    )}
                                                    {item.details && (
                                                        <p className="text-sm text-gray-600 italic">{item.details}</p>
                                                    )}
                                                    {item.notes && (
                                                        <p className="text-sm text-indigo-600 font-medium">“{item.notes}”</p>
                                                    )}
                                                </div>

                                                {item.price !== undefined && item.price > 0 && (
                                                    <div className="px-4 py-2 bg-white rounded-xl border border-gray-100 shadow-sm">
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase">{item.type === 'Sale' ? 'Price' : 'Cost'}</p>
                                                        <p className="text-sm font-black text-gray-800">Ksh {item.price.toLocaleString()}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Summary */}
            <div className="p-6 bg-gradient-to-r from-indigo-600 to-blue-700 rounded-3xl text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl shadow-indigo-100">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center text-3xl">📊</div>
                    <div>
                        <h3 className="text-xl font-bold">Lifecycle Summary</h3>
                        <p className="text-indigo-100 opacity-80">Aggregate impact of all tracked activities</p>
                    </div>
                </div>

                <div className="flex gap-10">
                    <div className="text-center">
                        <p className="text-xs font-bold text-indigo-200 uppercase tracking-widest mb-1">Total In</p>
                        <p className="text-2xl font-black">{historyData.filter(i => i.qty > 0).reduce((sum, i) => sum + i.qty, 0)} {product.sales_unit}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-xs font-bold text-indigo-200 uppercase tracking-widest mb-1">Total Out</p>
                        <p className="text-2xl font-black">{Math.abs(historyData.filter(i => i.qty < 0).reduce((sum, i) => sum + i.qty, 0))} {product.sales_unit}</p>
                    </div>
                    <div className="w-px h-12 bg-white/20"></div>
                    <div className="text-center">
                        <p className="text-xs font-bold text-indigo-200 uppercase tracking-widest mb-1">Net Balance</p>
                        <p className="text-2xl font-black">{historyData.reduce((sum, i) => sum + i.qty, 0)} {product.sales_unit}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
