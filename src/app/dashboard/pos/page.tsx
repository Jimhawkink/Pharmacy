'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, completeSaleTransaction, getNextReceiptNumber } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

interface Product {
    id: number; name: string; barcode: string; category: string;
    availableQty: number; costPrice: number; salesPrice: number;
    salesUnit: string; purchaseUnit: string; piecesPerPackage: number;
    imageUrl: string; generic_name: string; drug_type: string;
    dosage: string; requires_prescription: boolean;
}
interface BatchInfo {
    batch_id: number; batch_number: string; expiry_date: string;
    remaining_qty: number; purchase_cost: number; selling_price: number;
    days_until_expiry: number;
}
interface CartItem extends Product {
    qty: number; discount: number; effectivePrice: number;
    batchId: number; batchNumber: string; expiryDate: string;
    daysUntilExpiry: number; sellingUnit: string; unitMultiplier: number;
}
interface Category { category_id: number; category_name: string; icon: string; }
interface CreditCustomer {
    customer_id: number; customer_name: string; phone: string;
    current_balance: number; credit_limit: number;
}

const getDaysUntil = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
const getExpiryColor = (d: number) => d < 0 ? 'bg-red-500 text-white' : d <= 7 ? 'bg-red-100 text-red-700' : d <= 30 ? 'bg-orange-100 text-orange-700' : d <= 90 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700';

export default function PharmacyPOS() {
    const { activeOutlet } = useOutlet();
    const outletId = activeOutlet?.outlet_id || 1;
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedCat, setSelectedCat] = useState('All');
    const [receiptNo, setReceiptNo] = useState('');
    const [showPayment, setShowPayment] = useState(false);
    const [showBatchModal, setShowBatchModal] = useState(false);
    const [batchProduct, setBatchProduct] = useState<Product | null>(null);
    const [batches, setBatches] = useState<BatchInfo[]>([]);
    const [creditCustomers, setCreditCustomers] = useState<CreditCustomer[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<CreditCustomer | null>(null);
    const [userRole, setUserRole] = useState('');
    const searchRef = useRef<HTMLInputElement>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        const [{ data: prods }, { data: cats }, { data: stock }] = await Promise.all([
            supabase.from('pharmacy_products').select('pid, product_code, product_name, barcode, category, purchase_unit, sales_unit, purchase_cost, sales_cost, pieces_per_package, photo, generic_name, drug_type, dosage, requires_prescription').eq('outlet_id', outletId).eq('active', true).eq('show_in_pos', true).order('product_name'),
            supabase.from('pharmacy_categories').select('*').eq('active', true),
            supabase.from('pharmacy_stock').select('pid, qty').eq('outlet_id', outletId),
        ]);
        const stockMap: Record<number, number> = {};
        (stock || []).forEach((s: any) => { stockMap[s.pid] = (stockMap[s.pid] || 0) + (s.qty || 0); });

        setProducts((prods || []).map((p: any) => ({
            id: p.pid, name: p.product_name, barcode: p.barcode || '',
            category: p.category || '', availableQty: stockMap[p.pid] || 0,
            costPrice: p.purchase_cost, salesPrice: p.sales_cost,
            salesUnit: p.sales_unit || 'Piece', purchaseUnit: p.purchase_unit || 'Piece',
            piecesPerPackage: p.pieces_per_package || 1, imageUrl: p.photo || '',
            generic_name: p.generic_name || '', drug_type: p.drug_type || '',
            dosage: p.dosage || '', requires_prescription: p.requires_prescription || false,
        })));
        setCategories(cats || []);
        const rn = await getNextReceiptNumber(outletId);
        setReceiptNo(rn);
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        setUserRole(user.userType || '');
        setLoading(false);
    }, [outletId]);

    useEffect(() => { loadData(); }, [loadData]);

    const loadCreditCustomers = async () => {
        const { data } = await supabase.from('pharmacy_credit_customers').select('*').eq('active', true);
        setCreditCustomers(data || []);
    };

    // FEFO: Load batches for product, sorted by nearest expiry first
    const openBatchSelect = async (product: Product) => {
        const { data } = await supabase.from('pharmacy_batches')
            .select('*').eq('product_id', product.id).eq('outlet_id', outletId)
            .eq('status', 'Active').gt('remaining_qty', 0)
            .order('expiry_date', { ascending: true });
        const batchList: BatchInfo[] = (data || []).map((b: any) => ({
            batch_id: b.batch_id, batch_number: b.batch_number,
            expiry_date: b.expiry_date, remaining_qty: b.remaining_qty,
            purchase_cost: b.purchase_cost, selling_price: b.selling_price,
            days_until_expiry: getDaysUntil(b.expiry_date),
        }));
        if (batchList.length === 0) {
            // No batches — add directly with default pricing
            addToCart(product, null);
            return;
        }
        if (batchList.length === 1) {
            addToCart(product, batchList[0]);
            return;
        }
        setBatches(batchList);
        setBatchProduct(product);
        setShowBatchModal(true);
    };

    const addToCart = (product: Product, batch: BatchInfo | null) => {
        const batchId = batch?.batch_id || 0;
        const batchNumber = batch?.batch_number || '';
        const expiryDate = batch?.expiry_date || '';
        const price = batch?.selling_price || product.salesPrice;
        const existing = cart.findIndex(c => c.id === product.id && c.batchId === batchId);
        if (existing >= 0) {
            setCart(prev => prev.map((c, i) => i === existing ? { ...c, qty: c.qty + 1 } : c));
        } else {
            setCart(prev => [...prev, {
                ...product, qty: 1, discount: 0, effectivePrice: price,
                batchId, batchNumber, expiryDate,
                daysUntilExpiry: expiryDate ? getDaysUntil(expiryDate) : 999,
                sellingUnit: product.salesUnit, unitMultiplier: 1,
            }]);
        }
        setShowBatchModal(false);
        toast.success(`Added ${product.name}${batchNumber ? ` [${batchNumber}]` : ''}`);
    };

    const updateQty = (idx: number, delta: number) => {
        setCart(prev => prev.map((c, i) => i === idx ? { ...c, qty: Math.max(1, c.qty + delta) } : c));
    };
    const removeItem = (idx: number) => setCart(prev => prev.filter((_, i) => i !== idx));

    const subtotal = cart.reduce((s, c) => s + c.effectivePrice * c.qty, 0);
    const totalDiscount = cart.reduce((s, c) => s + c.discount, 0);
    const total = subtotal - totalDiscount;

    const completeSale = async (method: string, amountPaid: number, mpesaReceipt?: string, customerName?: string) => {
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const { data: shift } = await supabase.from('pharmacy_shift_instances')
                .select('shift_instance_id').eq('outlet_id', outletId).eq('shift_status', 'Open').limit(1).single();

            await completeSaleTransaction({
                receiptNo, subtotal, discount: totalDiscount, tax: 0, total,
                paymentMethod: method, amountPaid, change: Math.max(0, amountPaid - total),
                cashierName: user.name || 'Pharmacist', customerName,
                mpesaReceipt, shiftInstanceId: shift?.shift_instance_id,
                outletId,
                items: cart.map(c => ({
                    productId: c.id, productName: c.name, qty: c.qty,
                    price: c.effectivePrice, purchasePrice: c.costPrice,
                    discount: c.discount, batchId: c.batchId || undefined,
                    batchNumber: c.batchNumber || undefined, expiryDate: c.expiryDate || undefined,
                })),
            });

            toast.success(`Sale ${receiptNo} completed!`);
            setCart([]); setShowPayment(false); setSelectedCustomer(null);
            const rn = await getNextReceiptNumber(outletId);
            setReceiptNo(rn);
            loadData();
        } catch (err: any) { toast.error(err.message || 'Sale failed'); }
    };

    const filteredProducts = products.filter(p => {
        const q = search.toLowerCase();
        const matchSearch = !search || p.name.toLowerCase().includes(q) || p.barcode.includes(search) || (p.generic_name || '').toLowerCase().includes(q);
        const matchCat = selectedCat === 'All' || p.category === selectedCat;
        return matchSearch && matchCat;
    });

    if (loading) return (
        <div className="flex items-center justify-center h-96">
            <div className="w-14 h-14 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="flex gap-4 h-[calc(100vh-120px)]" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
            {/* LEFT - Products */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Search & Categories */}
                <div className="mb-3 space-y-3">
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2">🔍</span>
                        <input ref={searchRef} type="text" value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Search by name, barcode, generic name..."
                            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:border-teal-400 outline-none shadow-sm" />
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        <button onClick={() => setSelectedCat('All')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap ${selectedCat === 'All' ? 'bg-teal-500 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
                            📋 All
                        </button>
                        {categories.map(c => (
                            <button key={c.category_id} onClick={() => setSelectedCat(c.category_name)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap ${selectedCat === c.category_name ? 'bg-teal-500 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
                                {c.icon} {c.category_name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Product Grid */}
                <div className="flex-1 overflow-y-auto grid grid-cols-4 gap-3 content-start">
                    {filteredProducts.map(p => (
                        <div key={p.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 hover:shadow-md transition-shadow flex flex-col h-[180px]">
                            <h3 className="text-xs font-semibold text-gray-800 line-clamp-2 mb-1">{p.name}</h3>
                            <p className="text-[10px] text-gray-400 truncate">{p.drug_type} {p.dosage ? `• ${p.dosage}` : ''}</p>
                            {p.requires_prescription && <span className="text-[10px] text-red-500 font-bold">℞ Prescription</span>}
                            <div className="flex-1" />
                            <p className="text-sm font-bold text-gray-900 mb-1">Ksh {p.salesPrice.toLocaleString()}</p>
                            <div className="flex items-center justify-between mb-2">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${p.availableQty > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {p.availableQty} {p.salesUnit}
                                </span>
                            </div>
                            <button onClick={() => openBatchSelect(p)} disabled={p.availableQty <= 0}
                                className={`w-full py-2 rounded-lg text-xs font-bold ${p.availableQty <= 0 ? 'bg-gray-100 text-gray-400' : 'bg-teal-500 text-white hover:bg-teal-600 active:scale-95'} transition-all`}>
                                + Add to Cart
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* RIGHT - Cart */}
            <div className="w-96 bg-white rounded-2xl shadow-lg border border-gray-200 flex flex-col">
                {/* Cart Header */}
                <div className="px-4 py-3 bg-gradient-to-r from-teal-500 to-cyan-600 rounded-t-2xl flex items-center justify-between">
                    <h2 className="text-white font-bold flex items-center gap-2">🛒 Cart <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs">{cart.length}</span></h2>
                    <span className="text-white/80 text-xs">{receiptNo}</span>
                </div>

                {/* Cart Items */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {cart.length === 0 && (
                        <div className="text-center py-12 text-gray-400">
                            <span className="text-4xl block mb-2">💊</span>
                            <p className="text-sm">Cart is empty</p>
                            <p className="text-xs">Select products to add</p>
                        </div>
                    )}
                    {cart.map((item, idx) => (
                        <div key={`${item.id}-${item.batchId}-${idx}`} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                            <div className="flex items-start justify-between mb-1">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-800 truncate">{item.name}</p>
                                    <p className="text-xs text-gray-400">@ Ksh {item.effectivePrice.toLocaleString()} / {item.sellingUnit}</p>
                                    {item.batchNumber && (
                                        <div className="flex items-center gap-1 mt-0.5">
                                            <span className="text-[10px] text-purple-600 font-mono font-bold">📦 {item.batchNumber}</span>
                                            {item.expiryDate && (
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${getExpiryColor(item.daysUntilExpiry)}`}>
                                                    {item.daysUntilExpiry < 0 ? 'EXPIRED' : `${item.daysUntilExpiry}d`}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <button onClick={() => removeItem(idx)} className="p-1 text-red-400 hover:text-red-600">✕</button>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1">
                                    <button onClick={() => updateQty(idx, -1)} className="w-7 h-7 rounded-lg bg-orange-500 text-white font-bold text-sm">−</button>
                                    <span className="w-8 text-center font-bold text-sm">{item.qty}</span>
                                    <button onClick={() => updateQty(idx, 1)} className="w-7 h-7 rounded-lg bg-green-500 text-white font-bold text-sm">+</button>
                                </div>
                                <p className="font-bold text-gray-800">Ksh {((item.effectivePrice * item.qty) - item.discount).toLocaleString()}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Cart Footer */}
                <div className="p-4 border-t border-gray-100 space-y-3">
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Subtotal</span><span className="font-medium">{subtotal.toLocaleString()}</span></div>
                    {totalDiscount > 0 && <div className="flex justify-between text-sm"><span className="text-green-600">Discount</span><span className="text-green-600 font-medium">-{totalDiscount.toLocaleString()}</span></div>}
                    <div className="flex justify-between border-t pt-2"><span className="text-lg font-bold">Total</span><span className="text-xl font-black text-teal-600">Ksh {total.toLocaleString()}</span></div>
                    <button onClick={() => { setShowPayment(true); loadCreditCustomers(); }} disabled={cart.length === 0}
                        className="w-full py-3.5 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-xl font-bold text-lg hover:shadow-lg transition-all disabled:opacity-40">
                        💳 Pay Now
                    </button>
                    {cart.length > 0 && <button onClick={() => setCart([])} className="w-full py-2 text-sm text-gray-400 hover:text-red-500">Clear Cart</button>}
                </div>
            </div>

            {/* BATCH SELECT MODAL */}
            {showBatchModal && batchProduct && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-gray-800">📦 Select Batch</h2>
                            <button onClick={() => setShowBatchModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">✕</button>
                        </div>
                        <p className="text-sm text-gray-500 mb-4">{batchProduct.name} — Nearest expiry first (FEFO)</p>
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                            {batches.map(b => (
                                <button key={b.batch_id} onClick={() => addToCart(batchProduct, b)}
                                    className="w-full p-4 border-2 rounded-xl text-left hover:border-teal-400 hover:bg-teal-50 transition-all flex items-center justify-between group">
                                    <div>
                                        <p className="font-mono font-bold text-gray-800">{b.batch_number}</p>
                                        <p className="text-xs text-gray-500">Exp: {b.expiry_date}</p>
                                        <p className="text-xs text-gray-400">{b.remaining_qty} units available</p>
                                    </div>
                                    <div className="text-right">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${getExpiryColor(b.days_until_expiry)}`}>
                                            {b.days_until_expiry < 0 ? 'EXPIRED' : `${b.days_until_expiry} days`}
                                        </span>
                                        <p className="text-sm font-bold text-gray-800 mt-1">Ksh {b.selling_price.toLocaleString()}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* PAYMENT MODAL */}
            {showPayment && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold">💳 Payment</h2>
                            <button onClick={() => setShowPayment(false)} className="p-2 hover:bg-gray-100 rounded-lg">✕</button>
                        </div>
                        <div className="bg-gradient-to-r from-teal-500 to-cyan-600 rounded-2xl p-5 text-white mb-6">
                            <p className="text-sm opacity-90">Total Amount</p>
                            <p className="text-4xl font-bold">Ksh {total.toLocaleString()}</p>
                        </div>
                        <PaymentSection total={total} onComplete={completeSale} receiptNo={receiptNo}
                            creditCustomers={creditCustomers} selectedCustomer={selectedCustomer}
                            setSelectedCustomer={setSelectedCustomer} loadCreditCustomers={loadCreditCustomers} />
                    </div>
                </div>
            )}
        </div>
    );
}

// Payment section component
function PaymentSection({ total, onComplete, receiptNo, creditCustomers, selectedCustomer, setSelectedCustomer, loadCreditCustomers }: {
    total: number; onComplete: (method: string, paid: number, receipt?: string, name?: string) => void;
    receiptNo: string; creditCustomers: CreditCustomer[]; selectedCustomer: CreditCustomer | null;
    setSelectedCustomer: (c: CreditCustomer | null) => void; loadCreditCustomers: () => void;
}) {
    const [method, setMethod] = useState('cash');
    const [amountPaid, setAmountPaid] = useState('');
    const [mpesaPhone, setMpesaPhone] = useState('');
    const [customerName, setCustomerName] = useState('');
    const change = method === 'cash' ? Math.max(0, Number(amountPaid) - total) : 0;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
                {[{ id: 'cash', icon: '💵', label: 'Cash' }, { id: 'mpesa', icon: '📱', label: 'M-Pesa' }, { id: 'credit', icon: '📋', label: 'Credit' }].map(m => (
                    <button key={m.id} onClick={() => setMethod(m.id)}
                        className={`p-3 rounded-xl border-2 ${method === m.id ? 'border-teal-500 bg-teal-50' : 'border-gray-200 bg-gray-50'}`}>
                        <span className="text-2xl block">{m.icon}</span><span className="text-xs font-medium">{m.label}</span>
                    </button>
                ))}
            </div>

            {method === 'cash' && (
                <div className="space-y-3">
                    <input type="number" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} placeholder="Amount received..."
                        className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-xl text-lg font-semibold focus:border-teal-500 outline-none" />
                    <div className="grid grid-cols-6 gap-2">
                        {[100, 200, 500, 1000, 2000, 5000].map(a => (
                            <button key={a} onClick={() => setAmountPaid(a.toString())} className="py-2 bg-gray-100 rounded-xl text-sm font-medium">{a}</button>
                        ))}
                    </div>
                    <button onClick={() => setAmountPaid(total.toString())} className="w-full py-2 bg-teal-100 rounded-xl text-teal-700 font-medium text-sm">Exact ({total.toLocaleString()})</button>
                    <div className="flex justify-between p-3 bg-green-50 rounded-xl"><span className="text-green-700">Change:</span><span className="text-xl font-bold text-green-600">Ksh {change.toLocaleString()}</span></div>
                </div>
            )}

            {method === 'mpesa' && (
                <div className="space-y-3">
                    <input type="tel" value={mpesaPhone} onChange={e => setMpesaPhone(e.target.value)} placeholder="07XX XXX XXX"
                        className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-teal-500 outline-none" />
                </div>
            )}

            {method === 'credit' && (
                <div className="space-y-3">
                    <div className="max-h-40 overflow-y-auto border rounded-xl">
                        {creditCustomers.map(c => (
                            <button key={c.customer_id} onClick={() => { setSelectedCustomer(c); setCustomerName(c.customer_name); }}
                                className={`w-full text-left px-4 py-3 border-b last:border-b-0 ${selectedCustomer?.customer_id === c.customer_id ? 'bg-teal-50 border-l-4 border-l-teal-500' : 'hover:bg-gray-50'}`}>
                                <p className="font-semibold text-sm">{c.customer_name}</p>
                                <p className="text-xs text-gray-500">Balance: Ksh {(c.current_balance || 0).toLocaleString()}</p>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <button onClick={() => {
                if (method === 'cash' && Number(amountPaid) < total) { toast.error('Insufficient amount'); return; }
                if (method === 'credit' && !selectedCustomer) { toast.error('Select credit customer'); return; }
                onComplete(method.toUpperCase(), method === 'cash' ? Number(amountPaid) : total, undefined, customerName || selectedCustomer?.customer_name);
            }} className="w-full py-4 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-xl font-bold text-lg hover:shadow-lg">
                ✅ Complete Sale
            </button>
        </div>
    );
}

interface CreditCustomer { customer_id: number; customer_name: string; phone: string; current_balance: number; credit_limit: number; }
