'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, completeSaleTransaction, getNextReceiptNumber } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

// ── Types ──
interface Product {
    id: number; name: string; barcode: string; category: string;
    availableQty: number; costPrice: number; salesPrice: number;
    salesUnit: string; purchaseUnit: string; piecesPerPackage: number;
    imageUrl: string; generic_name: string; drug_type: string;
    dosage: string; requires_prescription: boolean;
    // Batch summary for display
    batchSummary: BatchSummary[];
    nearestExpiry: number; // days until nearest expiry
}
interface BatchSummary { batch_number: string; remaining_qty: number; days_until_expiry: number; expiry_date: string; }
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

// ── Helpers ──
const getDaysUntil = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
const getExpiryColor = (d: number) => d < 0 ? 'bg-red-500 text-white' : d <= 7 ? 'bg-red-100 text-red-700' : d <= 30 ? 'bg-orange-100 text-orange-700' : d <= 90 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700';
const getExpiryLabel = (d: number) => d < 0 ? 'EXPIRED' : d === 0 ? 'Today' : d <= 7 ? `${d}d ⚠️` : d <= 30 ? `${d}d` : d <= 90 ? `${d}d` : `${d}d ✓`;

// Capsule SVG as default product image
const CapsuleIcon = ({ className = 'w-full h-full' }: { className?: string }) => (
    <svg className={className} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="15" y="25" width="50" height="30" rx="15" fill="#14b8a6" opacity="0.15"/>
        <rect x="15" y="25" width="25" height="30" rx="15" fill="#14b8a6" opacity="0.5"/>
        <rect x="40" y="25" width="25" height="30" rx="15" fill="#0d9488" opacity="0.8"/>
        <ellipse cx="28" cy="40" rx="4" ry="6" fill="white" opacity="0.3"/>
    </svg>
);

// ── M-Pesa helpers ──
const MPESA_API_URL = 'https://enlqpifpxuecxxozyiak.supabase.co/functions/v1';
const MPESA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVubHFwaWZweHVlY3h4b3p5aWFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwMjUzNjgsImV4cCI6MjA4MTYwMTM2OH0.-z3-2Mf3SkkZR3ZryOGyG-60jWERX9YLKIee048OziE';
const formatMpesaPhone = (p: string) => { let c = p.replace(/[\s+\-]/g, ''); if (c.startsWith('0')) c = '254' + c.substring(1); else if (!c.startsWith('254')) c = '254' + c; return c; };
const isValidKenyanPhone = (p: string) => /^(07\d{8}|01\d{8}|254\d{9})$/.test(p.replace(/[\s+\-]/g, ''));

// ══════════════════════════════════════════════
// PRODUCT CARD — with capsule image, expiry, batch qty
// ══════════════════════════════════════════════
const ProductCard = ({ product, onAdd }: { product: Product; onAdd: () => void }) => {
    const nearestExp = product.nearestExpiry;
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all h-[260px] flex flex-col group" title={product.name}>
            {/* Image */}
            <div className="h-[100px] bg-gradient-to-b from-teal-50 to-gray-50 flex items-center justify-center flex-shrink-0 relative">
                <div className="w-[70px] h-[70px]"><CapsuleIcon /></div>
                {product.requires_prescription && (
                    <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-red-500 text-white text-[8px] font-black rounded-md">℞ Rx</span>
                )}
                {nearestExp <= 30 && nearestExp >= 0 && (
                    <span className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 text-[8px] font-black rounded-md ${getExpiryColor(nearestExp)}`}>
                        {nearestExp}d exp
                    </span>
                )}
                {nearestExp < 0 && (
                    <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-red-600 text-white text-[8px] font-black rounded-md animate-pulse">EXPIRED</span>
                )}
            </div>
            {/* Content */}
            <div className="flex-1 p-2.5 flex flex-col min-h-0">
                <h3 className="text-[11px] font-bold text-gray-800 line-clamp-2 leading-tight mb-0.5" title={product.name}>{product.name}</h3>
                <p className="text-[9px] text-gray-400 truncate">{product.drug_type}{product.dosage ? ` • ${product.dosage}` : ''}</p>
                {/* Batch summary — show up to 2 batches */}
                <div className="flex flex-wrap gap-1 mt-1 mb-auto">
                    {product.batchSummary.slice(0, 2).map((b, i) => (
                        <span key={i} className={`px-1 py-0.5 rounded text-[7px] font-bold ${getExpiryColor(b.days_until_expiry)}`}>
                            {b.remaining_qty}u • {getExpiryLabel(b.days_until_expiry)}
                        </span>
                    ))}
                    {product.batchSummary.length > 2 && (
                        <span className="px-1 py-0.5 rounded text-[7px] font-bold bg-gray-100 text-gray-500">+{product.batchSummary.length - 2}</span>
                    )}
                </div>
                {/* Price + Stock */}
                <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-black text-gray-900">Ksh {product.salesPrice.toLocaleString()}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${product.availableQty > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {product.availableQty} {product.salesUnit}
                    </span>
                </div>
                <button onClick={(e) => { e.stopPropagation(); if (product.availableQty > 0) onAdd(); }} disabled={product.availableQty <= 0}
                    className={`w-full py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${product.availableQty <= 0 ? 'bg-gray-100 text-gray-400' : 'bg-teal-500 text-white hover:bg-teal-600 active:scale-[0.97]'}`}>
                    + Add to Cart
                </button>
            </div>
        </div>
    );
};

// ══════════════════════════════════════════════
// PAYMENT MODAL — with M-Pesa STK Push
// ══════════════════════════════════════════════
const PaymentModal = ({
    isOpen, onClose, total, onComplete, receiptNo,
    creditCustomers, selectedCustomer, setSelectedCustomer, loadCreditCustomers,
}: {
    isOpen: boolean; onClose: () => void; total: number;
    onComplete: (method: string, paid: number, receipt?: string, name?: string, checkoutId?: string, phone?: string) => void;
    receiptNo: string; creditCustomers: CreditCustomer[];
    selectedCustomer: CreditCustomer | null; setSelectedCustomer: (c: CreditCustomer | null) => void;
    loadCreditCustomers: () => void;
}) => {
    const [method, setMethod] = useState('cash');
    const [amountPaid, setAmountPaid] = useState('');
    const [mpesaPhone, setMpesaPhone] = useState('');
    const [mpesaReceipt, setMpesaReceipt] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [creditSearch, setCreditSearch] = useState('');
    // STK Push state
    const [stkStatus, setStkStatus] = useState<'idle' | 'sending' | 'waiting' | 'success' | 'failed'>('idle');
    const [stkMessage, setStkMessage] = useState('');
    const [checkoutId, setCheckoutId] = useState('');
    const pollRef = useRef<NodeJS.Timeout | null>(null);
    const doneRef = useRef(false);

    const change = method === 'cash' ? Math.max(0, Number(amountPaid) - total) : 0;

    useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);
    const resetStk = () => { if (pollRef.current) clearInterval(pollRef.current); setStkStatus('idle'); setStkMessage(''); setCheckoutId(''); doneRef.current = false; };

    const handleSTKPush = async () => {
        if (!isValidKenyanPhone(mpesaPhone)) { toast.error('Enter a valid phone (0712345678)'); return; }
        setStkStatus('sending'); setStkMessage('📤 Sending STK Push...');
        try {
            const phone = formatMpesaPhone(mpesaPhone);
            const res = await fetch(`${MPESA_API_URL}/stkpush`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': MPESA_KEY, 'Authorization': `Bearer ${MPESA_KEY}` },
                body: JSON.stringify({ phone, amount: Math.ceil(total), accountReference: receiptNo, transactionDesc: `Pharmacy - ${receiptNo}` }),
            });
            const data = await res.json();
            if (data.success && (data.checkout_request_id || data.CheckoutRequestID)) {
                const reqId = data.checkout_request_id || data.CheckoutRequestID;
                setCheckoutId(reqId); setStkStatus('waiting'); setStkMessage('📲 Enter M-Pesa PIN on your phone...');
                await supabase.from('mpesa_transactions').insert({ checkout_request_id: reqId, phone_number: phone, amount: total, account_reference: receiptNo, status: 'Pending' });
                // Poll
                let attempts = 0;
                pollRef.current = setInterval(async () => {
                    attempts++;
                    try {
                        const r = await fetch(`${MPESA_API_URL}/check-status?checkout_request_id=${reqId}`, { headers: { 'apikey': MPESA_KEY, 'Authorization': `Bearer ${MPESA_KEY}` } });
                        const d = await r.json();
                        if (d.resultCode === 0) {
                            if (pollRef.current) clearInterval(pollRef.current);
                            const receipt = d.mpesaReceiptNumber || d.MpesaReceiptNumber || `MPESA-${Date.now().toString(36).toUpperCase()}`;
                            setStkStatus('success'); setStkMessage(`✅ Payment received! ${receipt}`);
                            setMpesaReceipt(receipt); toast.success(`✅ M-Pesa paid! ${receipt}`);
                            await supabase.from('mpesa_transactions').update({ status: 'Completed', mpesa_receipt_number: receipt }).eq('checkout_request_id', reqId);
                            setTimeout(() => { if (!doneRef.current) { doneRef.current = true; onComplete('MPESA', total, receipt, customerName, reqId, mpesaPhone); } }, 1000);
                        } else if (d.resultCode && d.resultCode !== 0 && d.status !== 'pending') {
                            if (pollRef.current) clearInterval(pollRef.current);
                            const msgs: Record<number, string> = { 1: '❌ Insufficient funds', 1032: '❌ Cancelled by user', 1037: '❌ Timed out', 2001: '❌ Wrong PIN' };
                            const msg = msgs[d.resultCode] || `❌ Failed: ${d.resultDesc || d.resultCode}`;
                            setStkStatus('failed'); setStkMessage(msg); toast.error(msg);
                        } else if (attempts >= 24) {
                            if (pollRef.current) clearInterval(pollRef.current);
                            setStkStatus('failed'); setStkMessage('⏰ Timeout — check M-Pesa messages');
                        }
                    } catch { /* keep polling */ }
                }, 5000);
            } else {
                setStkStatus('failed'); setStkMessage(`❌ ${data.error || data.message || 'STK failed'}`);
            }
        } catch (err: any) { setStkStatus('failed'); setStkMessage(`❌ ${err.message}`); }
    };

    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><span>💊</span> Pharmacy Payment</h2>
                    <div className="text-right"><p className="text-xs text-gray-500">Receipt</p><p className="font-bold text-teal-600">{receiptNo}</p></div>
                </div>
                {/* Total */}
                <div className="bg-gradient-to-r from-teal-500 to-cyan-600 rounded-2xl p-5 text-white mb-6">
                    <p className="text-sm opacity-90">Total Amount</p>
                    <p className="text-4xl font-black">Ksh {total.toLocaleString()}</p>
                </div>
                {/* Methods */}
                <div className="grid grid-cols-3 gap-2 mb-6">
                    {[{ id: 'cash', icon: '💵', label: 'Cash' }, { id: 'mpesa', icon: '📱', label: 'M-Pesa' }, { id: 'credit', icon: '📋', label: 'Credit' }].map(m => (
                        <button key={m.id} onClick={() => { setMethod(m.id); resetStk(); }}
                            className={`p-3 rounded-xl border-2 transition-all ${method === m.id ? 'border-teal-500 bg-teal-50' : 'border-gray-200 bg-gray-50'}`}>
                            <span className="text-2xl block mb-1">{m.icon}</span><span className="text-xs font-medium text-gray-600">{m.label}</span>
                        </button>
                    ))}
                </div>
                {/* Cash */}
                {method === 'cash' && (
                    <div className="space-y-3 mb-6">
                        <input type="number" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} placeholder="Amount received..."
                            className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-xl text-lg font-bold focus:border-teal-500 outline-none" />
                        <div className="grid grid-cols-6 gap-2">
                            {[100, 200, 500, 1000, 2000, 5000].map(a => (
                                <button key={a} onClick={() => setAmountPaid(a.toString())} className="py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium">{a}</button>
                            ))}
                        </div>
                        <button onClick={() => setAmountPaid(total.toString())} className="w-full py-2 bg-teal-100 hover:bg-teal-200 rounded-xl text-teal-700 font-medium text-sm">Exact ({total.toLocaleString()})</button>
                        <div className="flex justify-between p-3 bg-green-50 rounded-xl border border-green-200">
                            <span className="text-green-700 font-medium">Change:</span>
                            <span className="text-2xl font-black text-green-600">Ksh {change.toLocaleString()}</span>
                        </div>
                        <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="👤 Customer name (optional)"
                            className="w-full p-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-teal-500 outline-none text-sm" />
                    </div>
                )}
                {/* M-Pesa */}
                {method === 'mpesa' && (
                    <div className="space-y-3 mb-6">
                        <input type="tel" value={mpesaPhone} onChange={e => setMpesaPhone(e.target.value)} placeholder="📱 07XX XXX XXX" disabled={stkStatus === 'sending' || stkStatus === 'waiting'}
                            className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-xl text-lg focus:border-teal-500 outline-none" />
                        <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="👤 Customer name (optional)"
                            className="w-full p-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-teal-500 outline-none text-sm" />
                        {stkStatus !== 'idle' && (
                            <div className={`p-4 rounded-xl flex items-center gap-3 ${stkStatus === 'sending' || stkStatus === 'waiting' ? 'bg-blue-50 border border-blue-300' : stkStatus === 'success' ? 'bg-green-50 border border-green-300' : 'bg-red-50 border border-red-300'}`}>
                                {(stkStatus === 'sending' || stkStatus === 'waiting') && <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                                <span className="font-medium text-sm">{stkMessage}</span>
                            </div>
                        )}
                        {(stkStatus === 'idle' || stkStatus === 'failed') && (
                            <button onClick={handleSTKPush} className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold text-lg shadow-lg">📤 Send STK Push</button>
                        )}
                        <div className="pt-3 border-t"><p className="text-xs text-gray-500 mb-2 text-center">— OR enter receipt manually —</p>
                            <input type="text" value={mpesaReceipt} onChange={e => setMpesaReceipt(e.target.value.toUpperCase())} placeholder="M-Pesa Receipt e.g. RLJ5XXXXXX"
                                className="w-full p-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-teal-500 outline-none" /></div>
                    </div>
                )}
                {/* Credit */}
                {method === 'credit' && (
                    <div className="space-y-3 mb-6">
                        <div className="p-3 bg-orange-50 rounded-xl border border-orange-200"><p className="text-orange-700 text-sm font-medium">Select credit customer</p></div>
                        <input type="text" value={creditSearch} onChange={e => setCreditSearch(e.target.value)} placeholder="Search customer..."
                            className="w-full p-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-sm focus:border-orange-400 outline-none" />
                        <div className="max-h-40 overflow-y-auto border rounded-xl">
                            {creditCustomers.filter(c => !creditSearch || c.customer_name?.toLowerCase().includes(creditSearch.toLowerCase()) || c.phone?.includes(creditSearch)).map(c => (
                                <button key={c.customer_id} onClick={() => { setSelectedCustomer(c); setCustomerName(c.customer_name); setCreditSearch(''); }}
                                    className={`w-full text-left px-4 py-3 border-b last:border-0 ${selectedCustomer?.customer_id === c.customer_id ? 'bg-teal-50 border-l-4 border-l-teal-500' : 'hover:bg-gray-50'}`}>
                                    <p className="font-semibold text-sm">{c.customer_name}</p>
                                    <p className="text-xs text-gray-500">Balance: Ksh {(c.current_balance || 0).toLocaleString()}</p>
                                </button>
                            ))}
                        </div>
                        {selectedCustomer && (
                            <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl border border-green-200">
                                <div><p className="font-bold text-green-800 text-sm">{selectedCustomer.customer_name}</p>
                                    <p className="text-xs text-green-600">Current: {(selectedCustomer.current_balance || 0).toLocaleString()} → After: {((selectedCustomer.current_balance || 0) + total).toLocaleString()}</p></div>
                                <button onClick={() => { setSelectedCustomer(null); setCustomerName(''); }} className="text-red-400 text-xs font-bold">Clear</button>
                            </div>
                        )}
                    </div>
                )}
                {/* Actions */}
                <div className="flex gap-3">
                    <button onClick={() => { resetStk(); onClose(); }} className="flex-1 py-3 border-2 border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50" disabled={stkStatus === 'sending' || stkStatus === 'waiting'}>Cancel</button>
                    {stkStatus !== 'waiting' && stkStatus !== 'sending' && (
                        <button onClick={() => {
                            if (method === 'cash' && Number(amountPaid) < total) { toast.error('Insufficient amount'); return; }
                            if (method === 'credit' && !selectedCustomer) { toast.error('Select credit customer'); return; }
                            if (method === 'mpesa' && !mpesaReceipt && stkStatus !== 'success') { toast.error('Complete M-Pesa payment first'); return; }
                            onComplete(method.toUpperCase(), method === 'cash' ? Number(amountPaid) : total, mpesaReceipt, selectedCustomer?.customer_name || customerName, checkoutId, mpesaPhone);
                        }}
                            disabled={(method === 'mpesa' && !mpesaReceipt && stkStatus !== 'success') || (method === 'credit' && !selectedCustomer)}
                            className={`flex-1 py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${(method === 'mpesa' && !mpesaReceipt && stkStatus !== 'success') || (method === 'credit' && !selectedCustomer) ? 'bg-gray-300 text-gray-500' : 'bg-gradient-to-r from-teal-500 to-cyan-600 text-white hover:shadow-lg'}`}>
                            ✅ Complete Sale
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// ══════════════════════════════════════════════
// DISCOUNT MODAL
// ══════════════════════════════════════════════
const DiscountModal = ({ isOpen, onClose, item, onSave }: { isOpen: boolean; onClose: () => void; item: CartItem | null; onSave: (d: number) => void }) => {
    const [discount, setDiscount] = useState('');
    useEffect(() => { if (item) setDiscount(item.discount > 0 ? item.discount.toString() : ''); }, [item]);
    if (!isOpen || !item) return null;
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                <h2 className="text-lg font-bold text-gray-800 mb-4">💰 Item Discount</h2>
                <p className="text-sm text-gray-600 mb-4">{item.name} — Ksh {item.effectivePrice.toLocaleString()} × {item.qty}</p>
                <input type="number" value={discount} onChange={e => setDiscount(e.target.value)} placeholder="Enter discount amount..."
                    className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-xl text-lg font-bold focus:border-teal-500 outline-none mb-4" />
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 border-2 border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50">Cancel</button>
                    <button onClick={() => { onSave(Number(discount) || 0); onClose(); }} className="flex-1 py-3 bg-teal-500 text-white rounded-xl font-semibold hover:bg-teal-600">Save</button>
                </div>
            </div>
        </div>
    );
};

// ══════════════════════════════════════════════
// MAIN POS PAGE
// ══════════════════════════════════════════════
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
    const [showDiscount, setShowDiscount] = useState(false);
    const [discountItem, setDiscountItem] = useState<CartItem | null>(null);
    const [userRole, setUserRole] = useState('');
    const searchRef = useRef<HTMLInputElement>(null);

    const canDiscount = ['Admin', 'SuperAdmin', 'Super User', 'admin'].includes(userRole);

    // ── Load data ──
    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [{ data: prods }, { data: cats }, { data: stock }, { data: batchData }] = await Promise.all([
                supabase.from('pharmacy_products').select('pid, product_code, product_name, barcode, category, purchase_unit, sales_unit, purchase_cost, sales_cost, pieces_per_package, photo, generic_name, drug_type, dosage, requires_prescription').eq('outlet_id', outletId).eq('active', true).order('product_name'),
                supabase.from('pharmacy_categories').select('*').eq('active', true),
                supabase.from('pharmacy_stock').select('pid, qty').eq('outlet_id', outletId),
                supabase.from('pharmacy_batches').select('product_id, batch_number, remaining_qty, expiry_date').eq('outlet_id', outletId).eq('status', 'Active').gt('remaining_qty', 0).order('expiry_date', { ascending: true }),
            ]);

            const stockMap: Record<number, number> = {};
            (stock || []).forEach((s: any) => { stockMap[s.pid] = (stockMap[s.pid] || 0) + (s.qty || 0); });

            // Build batch summary per product
            const batchMap: Record<number, BatchSummary[]> = {};
            (batchData || []).forEach((b: any) => {
                if (!batchMap[b.product_id]) batchMap[b.product_id] = [];
                batchMap[b.product_id].push({
                    batch_number: b.batch_number,
                    remaining_qty: b.remaining_qty,
                    days_until_expiry: getDaysUntil(b.expiry_date),
                    expiry_date: b.expiry_date,
                });
            });

            setProducts((prods || []).map((p: any) => {
                const bs = batchMap[p.pid] || [];
                const nearest = bs.length > 0 ? Math.min(...bs.map(b => b.days_until_expiry)) : 999;
                return {
                    id: p.pid, name: p.product_name, barcode: p.barcode || '',
                    category: p.category || '', availableQty: stockMap[p.pid] || 0,
                    costPrice: p.purchase_cost || 0, salesPrice: p.sales_cost || 0,
                    salesUnit: p.sales_unit || 'Piece', purchaseUnit: p.purchase_unit || 'Piece',
                    piecesPerPackage: p.pieces_per_package || 1, imageUrl: p.photo || '',
                    generic_name: p.generic_name || '', drug_type: p.drug_type || '',
                    dosage: p.dosage || '', requires_prescription: p.requires_prescription || false,
                    batchSummary: bs, nearestExpiry: nearest,
                };
            }));
            setCategories(cats || []);
            const rn = await getNextReceiptNumber(outletId);
            setReceiptNo(rn);
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            setUserRole(user.userType || '');
        } catch (err) {
            console.error('Load error:', err);
            toast.error('Failed to load products');
        }
        setLoading(false);
    }, [outletId]);

    useEffect(() => { loadData(); }, [loadData]);

    const loadCreditCustomers = async () => {
        const { data } = await supabase.from('pharmacy_credit_customers').select('*').eq('active', true);
        setCreditCustomers(data || []);
    };

    // ── FEFO Batch Selection ──
    const openBatchSelect = async (product: Product) => {
        if (product.availableQty <= 0) { toast.error('Out of stock!'); return; }
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
        if (batchList.length === 0) { addToCart(product, null); return; }
        if (batchList.length === 1) { addToCart(product, batchList[0]); return; }
        setBatches(batchList); setBatchProduct(product); setShowBatchModal(true);
    };

    const addToCart = (product: Product, batch: BatchInfo | null) => {
        const batchId = batch?.batch_id || 0;
        const price = batch?.selling_price || product.salesPrice;
        const existing = cart.findIndex(c => c.id === product.id && c.batchId === batchId);
        if (existing >= 0) {
            setCart(prev => prev.map((c, i) => i === existing ? { ...c, qty: c.qty + 1 } : c));
        } else {
            setCart(prev => [...prev, {
                ...product, qty: 1, discount: 0, effectivePrice: price,
                batchId, batchNumber: batch?.batch_number || '', expiryDate: batch?.expiry_date || '',
                daysUntilExpiry: batch?.expiry_date ? getDaysUntil(batch.expiry_date) : 999,
                sellingUnit: product.salesUnit, unitMultiplier: 1,
            }]);
        }
        setShowBatchModal(false);
        toast.success(`Added ${product.name}${batch?.batch_number ? ` [${batch.batch_number}]` : ''}`);
    };

    const updateQty = (idx: number, delta: number) => {
        setCart(prev => prev.map((c, i) => i === idx ? { ...c, qty: Math.max(1, c.qty + delta) } : c));
    };
    const removeItem = (idx: number) => setCart(prev => prev.filter((_, i) => i !== idx));
    const clearCart = () => { setCart([]); toast.success('Cart cleared'); };

    const subtotal = cart.reduce((s, c) => s + c.effectivePrice * c.qty, 0);
    const totalDiscount = cart.reduce((s, c) => s + c.discount, 0);
    const total = subtotal - totalDiscount;

    // ── Complete Sale ──
    const completeSale = async (method: string, amountPaid: number, mpesaReceipt?: string, customerName?: string, checkoutRequestId?: string, customerPhone?: string) => {
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const { data: shift } = await supabase.from('pharmacy_shift_instances')
                .select('shift_instance_id').eq('outlet_id', outletId).eq('shift_status', 'Open').limit(1).maybeSingle();

            await completeSaleTransaction({
                receiptNo, subtotal, discount: totalDiscount, tax: 0, total,
                paymentMethod: method, amountPaid, change: Math.max(0, amountPaid - total),
                cashierName: user.name || 'Pharmacist', customerName,
                mpesaReceipt, shiftInstanceId: shift?.shift_instance_id,
                checkoutRequestId, customerPhone, outletId,
                items: cart.map(c => ({
                    productId: c.id, productName: c.name, qty: c.qty,
                    price: c.effectivePrice, purchasePrice: c.costPrice,
                    discount: c.discount, batchId: c.batchId || undefined,
                    batchNumber: c.batchNumber || undefined, expiryDate: c.expiryDate || undefined,
                })),
            });

            toast.success(`✅ Sale ${receiptNo} completed!`);
            setCart([]); setShowPayment(false); setSelectedCustomer(null);
            const rn = await getNextReceiptNumber(outletId);
            setReceiptNo(rn);
            loadData();
        } catch (err: any) { toast.error(err.message || 'Sale failed!'); }
    };

    // ── Filter ──
    const filteredProducts = products.filter(p => {
        const q = search.toLowerCase();
        const matchSearch = !search || p.name.toLowerCase().includes(q) || p.barcode.includes(search) || (p.generic_name || '').toLowerCase().includes(q);
        const matchCat = selectedCat === 'All' || p.category === selectedCat;
        return matchSearch && matchCat;
    });

    if (loading) return (
        <div className="flex items-center justify-center h-96">
            <div className="text-center">
                <div className="w-16 h-16 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-500 font-medium">Loading Pharmacy POS...</p>
            </div>
        </div>
    );

    return (
        <div className="flex gap-4 h-[calc(100vh-120px)]" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
            {/* ══════ LEFT — Products ══════ */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Search & Categories */}
                <div className="mb-3 space-y-3">
                    <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg">🔍</span>
                        <input ref={searchRef} type="text" value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Search by name, barcode, generic name..."
                            className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:border-teal-400 outline-none shadow-sm" />
                        {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">✕</button>}
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        <button onClick={() => setSelectedCat('All')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${selectedCat === 'All' ? 'bg-teal-500 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-600 hover:border-teal-300'}`}>
                            📋 All ({products.length})
                        </button>
                        {categories.map(c => (
                            <button key={c.category_id} onClick={() => setSelectedCat(c.category_name)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${selectedCat === c.category_name ? 'bg-teal-500 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-600 hover:border-teal-300'}`}>
                                {c.icon} {c.category_name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Product Grid */}
                <div className="flex-1 overflow-y-auto">
                    {filteredProducts.length === 0 ? (
                        <div className="text-center py-20 text-gray-400">
                            <span className="text-5xl block mb-3">💊</span>
                            <p className="font-medium">No products found</p>
                            <p className="text-sm">{search ? 'Try a different search term' : 'Add products to see them here'}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 content-start pb-4">
                            {filteredProducts.map(p => (
                                <ProductCard key={p.id} product={p} onAdd={() => openBatchSelect(p)} />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ══════ RIGHT — Cart ══════ */}
            <div className="w-[380px] bg-white rounded-2xl shadow-lg border border-gray-200 flex flex-col flex-shrink-0">
                {/* Cart Header */}
                <div className="px-4 py-3 bg-gradient-to-r from-teal-500 to-cyan-600 rounded-t-2xl flex items-center justify-between">
                    <h2 className="text-white font-bold flex items-center gap-2">
                        🛒 Cart <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs">{cart.length}</span>
                    </h2>
                    <div className="flex items-center gap-3">
                        <span className="text-white/80 text-xs font-mono">{receiptNo}</span>
                        {cart.length > 0 && (
                            <button onClick={clearCart} className="px-2 py-1 bg-white/20 rounded-lg text-white text-xs font-bold hover:bg-white/30">Clear</button>
                        )}
                    </div>
                </div>

                {/* Cart Items */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {cart.length === 0 && (
                        <div className="text-center py-16 text-gray-400">
                            <span className="text-5xl block mb-3">💊</span>
                            <p className="font-medium">Cart is empty</p>
                            <p className="text-xs">Select products to dispense</p>
                        </div>
                    )}
                    {cart.map((item, idx) => {
                        const itemTotal = (item.effectivePrice * item.qty) - item.discount;
                        return (
                            <div key={`${item.id}-${item.batchId}-${idx}`} className="bg-gray-50 rounded-xl p-3 border border-gray-100 space-y-2">
                                <div className="flex items-start gap-2">
                                    {/* Mini capsule */}
                                    <div className="w-9 h-9 flex-shrink-0 rounded-lg bg-teal-50 flex items-center justify-center">
                                        <CapsuleIcon className="w-7 h-7" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-gray-800 truncate">{item.name}</p>
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
                                    <button onClick={() => removeItem(idx)} className="p-1 text-red-400 hover:text-red-600 flex-shrink-0">✕</button>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => updateQty(idx, -1)} className="w-8 h-8 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm flex items-center justify-center shadow-sm">−</button>
                                        <span className="w-8 text-center font-bold text-sm">{item.qty}</span>
                                        <button onClick={() => updateQty(idx, 1)} className="w-8 h-8 rounded-lg bg-green-500 hover:bg-green-600 text-white font-bold text-sm flex items-center justify-center shadow-sm">+</button>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-black text-gray-800">Ksh {itemTotal.toLocaleString()}</p>
                                        {item.discount > 0 && <p className="text-xs text-green-600">-{item.discount.toLocaleString()}</p>}
                                    </div>
                                </div>
                                {canDiscount && (
                                    <button onClick={() => { setDiscountItem(item); setShowDiscount(true); }}
                                        className="w-full py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 font-medium">
                                        💰 Discount
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Cart Footer */}
                <div className="p-4 border-t border-gray-100 space-y-3">
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Subtotal</span><span className="font-medium">{subtotal.toLocaleString()}</span></div>
                    {totalDiscount > 0 && <div className="flex justify-between text-sm"><span className="text-green-600">Discount</span><span className="text-green-600 font-medium">-{totalDiscount.toLocaleString()}</span></div>}
                    <div className="flex justify-between border-t pt-2"><span className="text-lg font-bold">Total</span><span className="text-xl font-black text-teal-600">Ksh {total.toLocaleString()}</span></div>
                    <button onClick={() => { setShowPayment(true); loadCreditCustomers(); }} disabled={cart.length === 0}
                        className="w-full py-3.5 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-xl font-bold text-lg hover:shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                        💳 Pay Ksh {total.toLocaleString()}
                    </button>
                </div>
            </div>

            {/* ══════ MODALS ══════ */}

            {/* Batch Select */}
            {showBatchModal && batchProduct && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-gray-800">📦 Select Batch (FEFO)</h2>
                            <button onClick={() => setShowBatchModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">✕</button>
                        </div>
                        <p className="text-sm text-gray-500 mb-4">{batchProduct.name} — Nearest expiry first</p>
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

            {/* Payment */}
            <PaymentModal isOpen={showPayment} onClose={() => setShowPayment(false)} total={total}
                onComplete={completeSale} receiptNo={receiptNo}
                creditCustomers={creditCustomers} selectedCustomer={selectedCustomer}
                setSelectedCustomer={setSelectedCustomer} loadCreditCustomers={loadCreditCustomers} />

            {/* Discount */}
            <DiscountModal isOpen={showDiscount} onClose={() => setShowDiscount(false)} item={discountItem}
                onSave={(d) => {
                    if (discountItem) {
                        setCart(prev => prev.map(c => c.id === discountItem.id && c.batchId === discountItem.batchId ? { ...c, discount: d } : c));
                    }
                }} />
        </div>
    );
}
