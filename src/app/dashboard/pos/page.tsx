'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, completeSaleTransaction, getNextReceiptNumber } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

interface Product {
    id: number; name: string; barcode: string; category: string;
    availableQty: number; costPrice: number; salesPrice: number;
    salesUnit: string; imageUrl: string; generic_name: string;
    drug_type: string; dosage: string; requires_prescription: boolean;
    batches: { batch_number: string; qty: number; days: number }[];
}
interface BatchInfo {
    batch_id: number; batch_number: string; expiry_date: string;
    remaining_qty: number; purchase_cost: number; selling_price: number;
    days_until_expiry: number;
}
interface CartItem extends Product {
    qty: number; discount: number; effectivePrice: number;
    batchId: number; batchNumber: string; expiryDate: string;
    daysUntilExpiry: number; sellingUnit: string;
}
interface Category { category_id: number; category_name: string; icon: string; }
interface CreditCustomer {
    customer_id: number; customer_name: string; phone: string;
    current_balance: number; credit_limit: number;
}

const getDaysUntil = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
const getExpiryColor = (d: number) => d < 0 ? 'bg-red-500 text-white' : d <= 30 ? 'bg-orange-100 text-orange-700' : d <= 90 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700';

const MPESA_API_URL = 'https://enlqpifpxuecxxozyiak.supabase.co/functions/v1';
const MPESA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVubHFwaWZweHVlY3h4b3p5aWFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwMjUzNjgsImV4cCI6MjA4MTYwMTM2OH0.-z3-2Mf3SkkZR3ZryOGyG-60jWERX9YLKIee048OziE';
const fmtPhone = (p: string) => { let c = p.replace(/[\s+\-]/g, ''); if (c.startsWith('0')) c = '254' + c.substring(1); else if (!c.startsWith('254')) c = '254' + c; return c; };
const validPhone = (p: string) => /^(07\d{8}|01\d{8}|254\d{9})$/.test(p.replace(/[\s+\-]/g, ''));

// Product Card - Fixed Height, Compact Design (EXACT retail copy)
const ProductCard = ({ product, onAdd }: { product: Product; onAdd: () => void }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow h-[240px] flex flex-col" title={product.name}>
        {/* Image - Fixed 110px */}
        <div className="h-[110px] bg-gray-50 flex items-center justify-center flex-shrink-0">
            {product.imageUrl ? (
                <img src={product.imageUrl} alt={product.name} className="max-h-[100px] max-w-[100px] object-contain" onError={(e) => { (e.target as HTMLImageElement).src = '/no-image.png'; }} />
            ) : (
                <img src="/no-image.png" alt="No image" className="h-[100px] w-[100px] object-contain" />
            )}
        </div>
        {/* Content */}
        <div className="flex-1 p-2 flex flex-col">
            <h3 className="text-[12px] font-medium text-gray-800 line-clamp-1 cursor-default" title={product.name}>{product.name}</h3>
            <p className="text-[9px] text-gray-400 truncate" title={`SKU: ${product.barcode || product.id}`}>SKU: {product.barcode || product.id}</p>
            <div className="h-[18px] flex items-center">
                <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[8px]">{product.category || 'General'}</span>
            </div>
            <div className="flex-1"></div>
            <div className="flex items-center gap-2 mb-2">
                <span className="text-[15px] font-bold text-gray-900">Ksh {product.salesPrice.toLocaleString()}</span>
                <div className="flex flex-col gap-0.5">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${product.availableQty > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        🔢 {product.availableQty} {product.salesUnit}
                    </span>
                </div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); if (product.availableQty > 0) onAdd(); }} disabled={product.availableQty === 0}
                className={`w-full py-1.5 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1 ${product.availableQty === 0 ? 'bg-gray-100 text-gray-400' : 'bg-emerald-500 text-white hover:bg-emerald-600 active:scale-[0.98]'}`}>
                + Add to Cart
            </button>
        </div>
    </div>
);

//  CART ITEM ROW  exact same as retail 
const CartItemRow = ({ item, onIncrease, onDecrease, onRemove, onEditDiscount, canDiscount = true }: {
    item: CartItem; onIncrease: () => void; onDecrease: () => void; onRemove: () => void; onEditDiscount: () => void; canDiscount?: boolean;
}) => {
    const itemTotal = (item.effectivePrice * item.qty) - item.discount;
    return (
        <div className="bg-white rounded-xl p-3 space-y-2 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm truncate">{item.name}</p>
                    <p className="text-xs text-gray-500">@ Ksh {item.effectivePrice.toLocaleString()} / {item.sellingUnit || item.salesUnit || 'Pc'}</p>
                    {item.batchNumber && (
                        <p className="text-[10px] text-purple-600 font-mono font-bold"> {item.batchNumber}  {item.daysUntilExpiry < 0 ? 'EXPIRED' : item.daysUntilExpiry + 'd'}</p>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={onDecrease} className="w-8 h-8 rounded-lg bg-orange-500 hover:bg-orange-600 flex items-center justify-center font-bold text-white text-lg shadow-sm"></button>
                    <span className="w-8 text-center font-bold text-gray-800">{item.qty}</span>
                    <button onClick={onIncrease} className="w-8 h-8 rounded-lg bg-green-500 hover:bg-green-600 flex items-center justify-center font-bold text-white text-lg shadow-sm">+</button>
                </div>
                <div className="text-right min-w-[80px]">
                    <p className="font-bold text-gray-800">{itemTotal.toLocaleString()}</p>
                    {item.discount > 0 && <p className="text-xs text-green-600">-{item.discount.toLocaleString()}</p>}
                </div>
                <button onClick={onRemove} className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-500"></button>
            </div>
            {canDiscount && (
                <button onClick={onEditDiscount} className="w-full py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 font-medium"> Discount</button>
            )}
        </div>
    );
};

//  MAIN POS PAGE 
export default function PharmacyPOS() {
    const { activeOutlet } = useOutlet();
    const outletId = activeOutlet?.outlet_id || 1;
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
    const [categoryProducts, setCategoryProducts] = useState<Product[]>([]);
    const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
    const [receiptNo, setReceiptNo] = useState('');
    const [showPayment, setShowPayment] = useState(false);
    const [showBatchModal, setShowBatchModal] = useState(false);
    const [batchProduct, setBatchProduct] = useState<Product | null>(null);
    const [batchList, setBatchList] = useState<BatchInfo[]>([]);
    const [creditCustomers, setCreditCustomers] = useState<CreditCustomer[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<CreditCustomer | null>(null);
    const [customerSearch, setCustomerSearch] = useState('');
    const [showCustomerDrop, setShowCustomerDrop] = useState(false);
    const [showDiscountModal, setShowDiscountModal] = useState(false);
    const [discountItem, setDiscountItem] = useState<CartItem | null>(null);
    const [discountAmt, setDiscountAmt] = useState('');
    const [userRole, setUserRole] = useState('');
    const [isFullscreen, setIsFullscreen] = useState(false);
    // Register
    const [registerOpen, setRegisterOpen] = useState(false);
    const [currentShiftId, setCurrentShiftId] = useState<number | null>(null);
    const [showOpeningDrop, setShowOpeningDrop] = useState(false);
    const [openingAmount, setOpeningAmount] = useState('');
    const [showCloseReg, setShowCloseReg] = useState(false);
    const [closeData, setCloseData] = useState<any>(null);
    const [loadingReg, setLoadingReg] = useState(false);
    // Payment
    const [payMethod, setPayMethod] = useState('cash');
    const [amountPaid, setAmountPaid] = useState('');
    const [mpesaPhone, setMpesaPhone] = useState('');
    const [mpesaReceipt, setMpesaReceipt] = useState('');
    const [payCustomerName, setPayCustomerName] = useState('');
    const [creditSearch, setCreditSearch] = useState('');
    const [stkStatus, setStkStatus] = useState<'idle'|'sending'|'waiting'|'success'|'failed'>('idle');
    const [stkMsg, setStkMsg] = useState('');
    const [checkoutId, setCheckoutId] = useState('');
    const pollRef = useRef<NodeJS.Timeout | null>(null);
    const doneRef = useRef(false);
    const searchRef = useRef<HTMLInputElement>(null);

    const canDiscount = ['Admin','SuperAdmin','Super User','admin','superadmin'].includes(userRole);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
        else document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    };

    //  Load data 
    const loadData = useCallback(async () => {
        if (!activeOutlet) return;
        setLoading(true);
        try {
            const [{ data: prods }, { data: cats }, { data: stock }, { data: bData }] = await Promise.all([
                supabase.from('pharmacy_products').select('pid, product_code, product_name, barcode, category, purchase_unit, sales_unit, purchase_cost, sales_cost, pieces_per_package, photo, generic_name, drug_type, dosage, requires_prescription').eq('outlet_id', outletId).eq('active', true).order('product_name'),
                supabase.from('pharmacy_categories').select('*').eq('active', true).order('category_name'),
                supabase.from('pharmacy_stock').select('pid, qty').eq('outlet_id', outletId),
                supabase.from('pharmacy_batches').select('product_id, batch_number, remaining_qty, expiry_date').eq('outlet_id', outletId).eq('status', 'Active').gt('remaining_qty', 0).order('expiry_date', { ascending: true }),
            ]);
            const stockMap: Record<number, number> = {};
            (stock || []).forEach((s: any) => { stockMap[s.pid] = (stockMap[s.pid] || 0) + (s.qty || 0); });
            const batchMap: Record<number, { batch_number: string; qty: number; days: number }[]> = {};
            (bData || []).forEach((b: any) => {
                if (!batchMap[b.product_id]) batchMap[b.product_id] = [];
                batchMap[b.product_id].push({ batch_number: b.batch_number, qty: b.remaining_qty, days: getDaysUntil(b.expiry_date) });
            });
            setProducts((prods || []).map((p: any) => ({
                id: p.pid, name: p.product_name, barcode: p.barcode || '', category: p.category || '',
                availableQty: stockMap[p.pid] || 0, costPrice: p.purchase_cost || 0, salesPrice: p.sales_cost || 0,
                salesUnit: p.sales_unit || 'Piece', imageUrl: p.photo || '',
                generic_name: p.generic_name || '', drug_type: p.drug_type || '', dosage: p.dosage || '',
                requires_prescription: p.requires_prescription || false, batches: batchMap[p.pid] || [],
            })));
            setCategories(cats || []);
            const rn = await getNextReceiptNumber(outletId);
            setReceiptNo(rn);
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            setUserRole(user.userType || '');
        } catch (err) { console.error(err); toast.error('Failed to load products'); }
        setLoading(false);
    }, [activeOutlet, outletId]);

    const loadCreditCustomers = useCallback(async () => {
        const { data } = await supabase.from('pharmacy_credit_customers').select('*').eq('active', true).order('customer_name');
        setCreditCustomers(data || []);
    }, []);

    const loadActiveShift = useCallback(async () => {
        const { data } = await supabase.from('pharmacy_shift_instances').select('*').eq('shift_status', 'Open').order('shift_instance_id', { ascending: false }).limit(1).maybeSingle();
        if (data) { setCurrentShiftId(data.shift_instance_id); setRegisterOpen(true); }
    }, []);

    useEffect(() => { loadData(); loadCreditCustomers(); loadActiveShift(); }, [loadData, loadCreditCustomers, loadActiveShift]);

    // Search filter
    useEffect(() => {
        if (!searchQuery.trim()) { setFilteredProducts([]); return; }
        const q = searchQuery.toLowerCase();
        setFilteredProducts(products.filter(p => p.name.toLowerCase().includes(q) || p.barcode.includes(searchQuery) || (p.generic_name || '').toLowerCase().includes(q)).slice(0, 20));
    }, [searchQuery, products]);

    const loadCategoryProducts2 = (catId: number, catName: string) => {
        setSelectedCategory(catId);
        setCategoryProducts(products.filter(p => p.category.toLowerCase() === catName.toLowerCase()));
    };

    //  Batch select (FEFO) 
    const openBatchSelect = async (product: Product) => {
        if (product.availableQty <= 0) { toast.error('Out of stock!'); return; }
        const { data } = await supabase.from('pharmacy_batches')
            .select('*').eq('product_id', product.id).eq('outlet_id', outletId)
            .eq('status', 'Active').gt('remaining_qty', 0).order('expiry_date', { ascending: true });
        const bl: BatchInfo[] = (data || []).map((b: any) => ({
            batch_id: b.batch_id, batch_number: b.batch_number, expiry_date: b.expiry_date,
            remaining_qty: b.remaining_qty, purchase_cost: b.purchase_cost, selling_price: b.selling_price,
            days_until_expiry: getDaysUntil(b.expiry_date),
        }));
        if (bl.length === 0) { addToCart(product, null); return; }
        if (bl.length === 1) { addToCart(product, bl[0]); return; }
        setBatchList(bl); setBatchProduct(product); setShowBatchModal(true);
    };

    const addToCart = (product: Product, batch: BatchInfo | null) => {
        const bId = batch?.batch_id || 0;
        const price = batch?.selling_price || product.salesPrice;
        const existing = cart.findIndex(c => c.id === product.id && c.batchId === bId);
        if (existing >= 0) { setCart(prev => prev.map((c, i) => i === existing ? { ...c, qty: c.qty + 1 } : c)); }
        else {
            setCart(prev => [...prev, { ...product, qty: 1, discount: 0, effectivePrice: price,
                batchId: bId, batchNumber: batch?.batch_number || '', expiryDate: batch?.expiry_date || '',
                daysUntilExpiry: batch?.expiry_date ? getDaysUntil(batch.expiry_date) : 999, sellingUnit: product.salesUnit,
            }]);
        }
        setShowBatchModal(false);
        toast.success(`Added ${product.name}${batch?.batch_number ? ` [${batch.batch_number}]` : ''}`);
        setSearchQuery(''); searchRef.current?.focus();
    };

    const increaseQty = (idx: number) => setCart(prev => prev.map((c, i) => i === idx ? { ...c, qty: c.qty + 1 } : c));
    const decreaseQty = (idx: number) => setCart(prev => prev.map((c, i) => i === idx && c.qty > 1 ? { ...c, qty: c.qty - 1 } : c));
    const removeFromCart = (idx: number) => setCart(prev => prev.filter((_, i) => i !== idx));
    const clearCart = () => { setCart([]); toast.success('Cart cleared'); };

    const subtotal = cart.reduce((s, c) => s + c.effectivePrice * c.qty, 0);
    const totalDiscount = cart.reduce((s, c) => s + c.discount, 0);
    const grandTotal = subtotal - totalDiscount;

    //  Register 
    const handleOpenRegister = async () => {
        const amt = Number(openingAmount) || 0;
        try {
            const { data: shift, error } = await supabase.from('pharmacy_shift_instances').insert({
                shift_date: new Date().toISOString().split('T')[0], shift_type: 'Day',
                start_time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
                opening_cash: amt, shift_status: 'Open', opened_by: 'Pharmacist', outlet_id: outletId,
            }).select('shift_instance_id').single();
            if (error) throw error;
            setCurrentShiftId(shift.shift_instance_id); setRegisterOpen(true);
            setShowOpeningDrop(false); setOpeningAmount('');
            toast.success(`Register opened with Ksh ${amt.toLocaleString()}`);
        } catch (err: any) { toast.error('Failed: ' + err.message); }
    };

    const handleCloseRegister = async () => {
        setLoadingReg(true);
        try {
            const today = new Date().toISOString().split('T')[0];
            const { data: salesData } = await supabase.from('pharmacy_sales').select('sale_id, total, payment_method').eq('outlet_id', outletId).gte('sale_datetime', today);
            const { data: expData } = await supabase.from('pharmacy_expenses').select('amount').eq('outlet_id', outletId).gte('created_at', today);
            let openingCash = 0;
            if (currentShiftId) {
                const { data: sd } = await supabase.from('pharmacy_shift_instances').select('opening_cash').eq('shift_instance_id', currentShiftId).single();
                openingCash = sd?.opening_cash || 0;
            }
            const sales = salesData || [];
            const totalSales = sales.reduce((s: number, r: any) => s + (r.total || 0), 0);
            const totalCash = sales.filter((r: any) => (r.payment_method || '').toLowerCase().includes('cash')).reduce((s: number, r: any) => s + (r.total || 0), 0);
            const totalMpesa = sales.filter((r: any) => (r.payment_method || '').toLowerCase().includes('mpesa')).reduce((s: number, r: any) => s + (r.total || 0), 0);
            const totalCredit = sales.filter((r: any) => (r.payment_method || '').toLowerCase().includes('credit')).reduce((s: number, r: any) => s + (r.total || 0), 0);
            const totalExpenses = (expData || []).reduce((s: number, e: any) => s + (e.amount || 0), 0);
            setCloseData({ totalSales, totalCash, totalMpesa, totalCredit, totalExpenses, openingCash, netSales: totalSales - totalExpenses - totalCredit, orderCount: sales.length });
            setShowCloseReg(true);
        } catch (err: any) { toast.error('Failed: ' + err.message); }
        setLoadingReg(false);
    };

    const finalizeClose = async () => {
        if (currentShiftId) {
            await supabase.from('pharmacy_shift_instances').update({
                end_time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
                closing_cash: closeData?.totalCash || 0, total_sales: closeData?.totalSales || 0,
                shift_status: 'Closed', closed_by: 'Pharmacist',
            }).eq('shift_instance_id', currentShiftId);
        }
        setRegisterOpen(false); setCurrentShiftId(null); setShowCloseReg(false); setCloseData(null);
        toast.success('Register closed successfully');
    };

    //  M-Pesa Reset 
    const resetStk = () => { if (pollRef.current) clearInterval(pollRef.current); setStkStatus('idle'); setStkMsg(''); setCheckoutId(''); doneRef.current = false; };

    //  Complete Sale 
    const completeSale = async (method: string, paid: number, receipt?: string, custName?: string, cId?: string, cPhone?: string) => {
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const { data: shift } = await supabase.from('pharmacy_shift_instances')
                .select('shift_instance_id').eq('outlet_id', outletId).eq('shift_status', 'Open').limit(1).maybeSingle();
            await completeSaleTransaction({
                receiptNo, subtotal, discount: totalDiscount, tax: 0, total: grandTotal,
                paymentMethod: method, amountPaid: paid, change: Math.max(0, paid - grandTotal),
                cashierName: user.name || 'Pharmacist', customerName: selectedCustomer?.customer_name || custName,
                mpesaReceipt: receipt, shiftInstanceId: shift?.shift_instance_id,
                checkoutRequestId: cId, customerPhone: cPhone, outletId,
                items: cart.map(c => ({
                    productId: c.id, productName: c.name, qty: c.qty, price: c.effectivePrice,
                    purchasePrice: c.costPrice, discount: c.discount,
                    batchId: c.batchId || undefined, batchNumber: c.batchNumber || undefined, expiryDate: c.expiryDate || undefined,
                })),
            });
            if (method === 'CREDIT' && selectedCustomer) {
                const nb = (selectedCustomer.current_balance || 0) + grandTotal;
                await supabase.from('pharmacy_credit_customers').update({ current_balance: nb }).eq('customer_id', selectedCustomer.customer_id);
            }
            toast.success(`Sale ${receiptNo} completed!`);
            setCart([]); setShowPayment(false); setSelectedCustomer(null); setCustomerSearch('');
            resetStk(); setPayMethod('cash'); setAmountPaid(''); setMpesaPhone(''); setMpesaReceipt(''); setPayCustomerName(''); setCreditSearch('');
            const rn = await getNextReceiptNumber(outletId);
            setReceiptNo(rn); loadData(); loadCreditCustomers();
        } catch (err: any) { toast.error(err.message || 'Sale failed'); }
    };

    //  STK Push 
    const handleSTK = async () => {
        if (!validPhone(mpesaPhone)) { toast.error('Enter valid phone'); return; }
        setStkStatus('sending'); setStkMsg(' Sending STK Push...');
        try {
            const phone = fmtPhone(mpesaPhone);
            const res = await fetch(`${MPESA_API_URL}/stkpush`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': MPESA_KEY, 'Authorization': `Bearer ${MPESA_KEY}` },
                body: JSON.stringify({ phone, amount: Math.ceil(grandTotal), accountReference: receiptNo, transactionDesc: `Pharmacy - ${receiptNo}` }),
            });
            const data = await res.json();
            if (data.success && (data.checkout_request_id || data.CheckoutRequestID)) {
                const reqId = data.checkout_request_id || data.CheckoutRequestID;
                setCheckoutId(reqId); setStkStatus('waiting'); setStkMsg(' Enter PIN on phone...');
                let attempts = 0;
                pollRef.current = setInterval(async () => {
                    attempts++;
                    try {
                        const r = await fetch(`${MPESA_API_URL}/check-status?checkout_request_id=${reqId}`, { headers: { 'apikey': MPESA_KEY, 'Authorization': `Bearer ${MPESA_KEY}` } });
                        const d = await r.json();
                        if (d.resultCode === 0) {
                            if (pollRef.current) clearInterval(pollRef.current);
                            const rc = d.mpesaReceiptNumber || `MPESA-${Date.now().toString(36).toUpperCase()}`;
                            setStkStatus('success'); setStkMsg(` Paid! ${rc}`); setMpesaReceipt(rc);
                            setTimeout(() => { if (!doneRef.current) { doneRef.current = true; completeSale('MPESA', grandTotal, rc, payCustomerName, reqId, mpesaPhone); } }, 1000);
                        } else if (d.resultCode && d.resultCode !== 0 && d.status !== 'pending') {
                            if (pollRef.current) clearInterval(pollRef.current);
                            const msgs: Record<number, string> = { 1: ' Insufficient funds', 1032: ' Cancelled', 2001: ' Wrong PIN' };
                            setStkStatus('failed'); setStkMsg(msgs[d.resultCode] || ` Failed`);
                        } else if (attempts >= 24) { if (pollRef.current) clearInterval(pollRef.current); setStkStatus('failed'); setStkMsg(' Timeout'); }
                    } catch {}
                }, 5000);
            } else { setStkStatus('failed'); setStkMsg(` ${data.error || 'Failed'}`); }
        } catch (err: any) { setStkStatus('failed'); setStkMsg(` ${err.message}`); }
    };

    const change = payMethod === 'cash' ? Math.max(0, Number(amountPaid) - grandTotal) : 0;

    if (loading) return (<div className="flex items-center justify-center h-full text-gray-400"><div className="flex flex-col items-center gap-3"><div className="w-10 h-10 border-4 border-teal-400/30 border-t-teal-500 rounded-full animate-spin"></div><span>Loading pharmacy POS...</span></div></div>);

    const displayProducts = searchQuery ? filteredProducts : (selectedCategory ? categoryProducts : products);

    return (
        <div className="h-[calc(100vh-64px)] flex flex-col bg-gray-50 -m-6">
            {/* Top Bar */}
            <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <span className="text-gray-400 text-sm"> Pharmacy POS</span>
                    <span className="text-gray-300">|</span>
                    <span className="text-gray-600 text-sm font-medium">Alpha Pharmacy</span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">{new Date().toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    <span className="px-3 py-1 bg-teal-100 text-teal-700 rounded-lg text-sm font-semibold">{receiptNo}</span>
                    <button onClick={toggleFullscreen} className="p-2 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white rounded-lg shadow-md" title="Fullscreen">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                    </button>
                </div>
            </div>

            {/* Controls Header  EXACT same as retail */}
            <div className="bg-white border-b border-gray-200 px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Store/Branch</label>
                            <select className="px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 font-medium focus:outline-none focus:border-teal-500 cursor-pointer min-w-[180px]">
                                <option> Main Pharmacy</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Counter</label>
                            <select className="px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 font-medium focus:outline-none focus:border-teal-500 cursor-pointer min-w-[120px]">
                                <option>Counter 1</option><option>Counter 2</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex-1 max-w-xl">
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></span>
                            <input ref={searchRef} type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search products by name, barcode, generic name..."
                                className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-teal-500 focus:bg-white" autoFocus />
                            {searchQuery && <button onClick={() => { setSearchQuery(''); searchRef.current?.focus(); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"></button>}
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Category</label>
                            <select value={selectedCategory || ''} onChange={e => { const id = Number(e.target.value); if (id) { const cat = categories.find(c => c.category_id === id); if (cat) loadCategoryProducts2(id, cat.category_name); } else { setSelectedCategory(null); setCategoryProducts([]); } }}
                                className="px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 focus:outline-none focus:border-teal-500 cursor-pointer min-w-[140px]">
                                <option value="">All Categories</option>
                                {categories.map(c => <option key={c.category_id} value={c.category_id}>{c.icon} {c.category_name}</option>)}
                            </select>
                        </div>
                        <div className="relative">
                            <label className="block text-xs text-gray-500 mb-1">Customer</label>
                            <input value={customerSearch} onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDrop(true); if (!e.target.value) setSelectedCustomer(null); }}
                                onFocus={() => setShowCustomerDrop(true)} onBlur={() => setTimeout(() => setShowCustomerDrop(false), 200)}
                                placeholder={selectedCustomer ? selectedCustomer.customer_name : ' Walk-in Customer'}
                                className={`px-3 py-2 border rounded-lg bg-gray-50 focus:outline-none focus:border-teal-500 min-w-[200px] text-sm ${selectedCustomer ? 'border-teal-400 bg-teal-50 font-semibold text-teal-800' : 'border-gray-200'}`} />
                            {selectedCustomer && <button onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); }} className="absolute right-2 top-[calc(50%+8px)] -translate-y-1/2 text-gray-400 hover:text-red-500 text-xs"></button>}
                            {showCustomerDrop && customerSearch && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                                    {creditCustomers.filter(c => c.customer_name?.toLowerCase().includes(customerSearch.toLowerCase())).slice(0, 8).map(c => (
                                        <button key={c.customer_id} onMouseDown={() => { setSelectedCustomer(c); setCustomerSearch(c.customer_name); setShowCustomerDrop(false); }}
                                            className="w-full text-left px-3 py-2 hover:bg-teal-50 border-b border-gray-50 last:border-0">
                                            <p className="font-semibold text-gray-800 text-sm">{c.customer_name}</p>
                                            <p className="text-[10px] text-gray-500">{c.phone}  Bal: Ksh {(c.current_balance || 0).toLocaleString()}</p>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        {!registerOpen ? (
                            <button onClick={() => setShowOpeningDrop(true)} className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium mt-4"> Open Register</button>
                        ) : (
                            <button onClick={handleCloseRegister} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium mt-4"> Close Register</button>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content  Products + Cart */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left - Products */}
                <div className="flex-1 flex flex-col p-4 overflow-hidden">
                    <div className="flex-1 overflow-y-auto">
                        {displayProducts.length > 0 ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                {displayProducts.map(p => <ProductCard key={p.id} product={p} onAdd={() => openBatchSelect(p)} />)}
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-12">
                                <span className="text-5xl mb-3">{searchQuery ? '' : ''}</span>
                                <p className="text-lg font-medium">{searchQuery ? `No products for "${searchQuery}"` : 'No products found'}</p>
                                <p className="text-sm">{searchQuery ? 'Try a different search' : 'Add products in the Products page'}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right - Cart (exact same as retail) */}
                <div className="w-[400px] bg-white flex flex-col border-l border-gray-200 shadow-lg">
                    <div className="px-4 py-3 bg-gradient-to-r from-teal-500 to-cyan-600 text-white flex items-center justify-between">
                        <h2 className="font-bold flex items-center gap-2"><span></span> Cart ({cart.length} items)</h2>
                        {cart.length > 0 && <button onClick={clearCart} className="text-sm bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg">Clear</button>}
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {cart.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                <span className="text-5xl mb-3"></span><p className="font-medium">Cart is empty</p><p className="text-sm">Add products to begin</p>
                            </div>
                        ) : cart.map((item, idx) => (
                            <CartItemRow key={`${item.id}-${item.batchId}-${idx}`} item={item}
                                onIncrease={() => increaseQty(idx)} onDecrease={() => decreaseQty(idx)}
                                onRemove={() => removeFromCart(idx)}
                                onEditDiscount={() => { setDiscountItem(item); setDiscountAmt(item.discount > 0 ? item.discount.toString() : ''); setShowDiscountModal(true); }}
                                canDiscount={canDiscount} />
                        ))}
                    </div>
                    <div className="border-t border-gray-200 p-3 bg-gray-50 space-y-1 shrink-0">
                        <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><span>Ksh {subtotal.toLocaleString()}</span></div>
                        {totalDiscount > 0 && <div className="flex justify-between text-sm text-green-600"><span>Discount</span><span>- Ksh {totalDiscount.toLocaleString()}</span></div>}
                        <div className="flex justify-between text-xl font-bold text-gray-800 pt-2 border-t border-gray-300"><span>TOTAL</span><span>Ksh {grandTotal.toLocaleString()}</span></div>
                    </div>
                    <div className="p-3 border-t border-gray-200 shrink-0">
                        <button onClick={() => setShowPayment(true)} disabled={cart.length === 0}
                            className="w-full py-3 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-xl font-bold text-lg hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                            <span></span><span>PAY Ksh {grandTotal.toLocaleString()}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/*  BATCH SELECT MODAL  */}
            {showBatchModal && batchProduct && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-gray-800"> Select Batch (FEFO)</h2>
                            <button onClick={() => setShowBatchModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"></button>
                        </div>
                        <p className="text-sm text-gray-500 mb-4">{batchProduct.name}  Nearest expiry first</p>
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                            {batchList.map(b => (
                                <button key={b.batch_id} onClick={() => addToCart(batchProduct, b)}
                                    className="w-full p-4 border-2 rounded-xl text-left hover:border-teal-400 hover:bg-teal-50 transition-all flex items-center justify-between">
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
                        <button onClick={() => setShowBatchModal(false)} className="w-full mt-4 py-3 border-2 border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition-colors">Cancel</button>
                    </div>
                </div>
            )}

            {/*  PAYMENT MODAL  */}
            {showPayment && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold flex items-center gap-2"><span></span> Payment</h2>
                            <div className="text-right"><p className="text-xs text-gray-500">Receipt</p><p className="font-bold text-teal-600">{receiptNo}</p></div>
                        </div>
                        <div className="bg-gradient-to-r from-teal-500 to-cyan-600 rounded-2xl p-5 text-white mb-6">
                            <p className="text-sm opacity-90">Total Amount</p><p className="text-4xl font-bold">Ksh {grandTotal.toLocaleString()}</p>
                        </div>
                        <div className="grid grid-cols-4 gap-2 mb-6">
                            {[{id:'cash',icon:'',label:'Cash'},{id:'mpesa',icon:'',label:'M-Pesa'},{id:'card',icon:'',label:'Card'},{id:'credit',icon:'',label:'Credit'}].map(m => (
                                <button key={m.id} onClick={() => { setPayMethod(m.id); resetStk(); }}
                                    className={`p-3 rounded-xl border-2 ${payMethod === m.id ? 'border-teal-500 bg-teal-50' : 'border-gray-200 bg-gray-50'}`}>
                                    <span className="text-2xl block mb-1">{m.icon}</span><span className="text-xs font-medium text-gray-600">{m.label}</span>
                                </button>
                            ))}
                        </div>
                        {payMethod === 'cash' && (
                            <div className="space-y-3 mb-6">
                                <label className="text-sm font-medium text-gray-600 block">Amount Received</label>
                                <input type="number" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} placeholder="Enter amount..."
                                    className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-xl text-lg font-semibold focus:border-teal-500 outline-none" />
                                <div className="grid grid-cols-6 gap-2">
                                    {[100,200,500,1000,2000,5000].map(a => <button key={a} onClick={() => setAmountPaid(a.toString())} className="py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium">{a.toLocaleString()}</button>)}
                                </div>
                                <button onClick={() => setAmountPaid(grandTotal.toString())} className="w-full py-2 bg-teal-100 rounded-xl text-teal-700 font-medium">Exact ({grandTotal.toLocaleString()})</button>
                                <div className="flex justify-between p-4 bg-green-50 rounded-xl border border-green-200"><span className="text-green-700 font-medium">Change:</span><span className="text-2xl font-bold text-green-600">Ksh {change.toLocaleString()}</span></div>
                                <input type="text" value={payCustomerName} onChange={e => setPayCustomerName(e.target.value)} placeholder=" Customer name (optional)" className="w-full p-3 bg-gray-50 border-2 border-gray-200 rounded-xl outline-none" />
                            </div>
                        )}
                        {payMethod === 'mpesa' && (
                            <div className="space-y-3 mb-6">
                                <input type="tel" value={mpesaPhone} onChange={e => setMpesaPhone(e.target.value)} placeholder=" 07XX XXX XXX" disabled={stkStatus==='sending'||stkStatus==='waiting'}
                                    className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-xl text-lg focus:border-teal-500 outline-none" />
                                <input type="text" value={payCustomerName} onChange={e => setPayCustomerName(e.target.value)} placeholder=" Customer name (optional)" className="w-full p-3 bg-gray-50 border-2 border-gray-200 rounded-xl outline-none" />
                                {stkStatus !== 'idle' && (
                                    <div className={`p-4 rounded-xl flex items-center gap-3 ${stkStatus==='sending'||stkStatus==='waiting' ? 'bg-blue-50 border border-blue-300' : stkStatus==='success' ? 'bg-green-50 border border-green-300' : 'bg-red-50 border border-red-300'}`}>
                                        {(stkStatus==='sending'||stkStatus==='waiting') && <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>}
                                        <span className="font-medium text-sm">{stkMsg}</span>
                                    </div>
                                )}
                                {(stkStatus==='idle'||stkStatus==='failed') && <button onClick={handleSTK} className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold text-lg shadow-lg"> Send STK Push</button>}
                                <div className="pt-3 border-t"><p className="text-xs text-gray-500 mb-2 text-center"> OR enter receipt manually </p>
                                    <input type="text" value={mpesaReceipt} onChange={e => setMpesaReceipt(e.target.value.toUpperCase())} placeholder="M-Pesa Receipt e.g. RLJ5XXXXXX" className="w-full p-3 bg-gray-50 border-2 border-gray-200 rounded-xl outline-none" />
                                </div>
                            </div>
                        )}
                        {payMethod === 'credit' && (
                            <div className="space-y-3 mb-6">
                                <div className="p-3 bg-orange-50 rounded-xl border border-orange-200"><p className="text-orange-700 text-sm font-medium">Select credit customer</p></div>
                                <input type="text" value={creditSearch} onChange={e => setCreditSearch(e.target.value)} placeholder="Search customer..." className="w-full p-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-sm outline-none" />
                                <div className="max-h-44 overflow-y-auto rounded-xl border border-gray-200 bg-white">
                                    {creditCustomers.filter(c => !creditSearch || c.customer_name?.toLowerCase().includes(creditSearch.toLowerCase())).map(c => (
                                        <button key={c.customer_id} onClick={() => { setSelectedCustomer(c); setPayCustomerName(c.customer_name); setCreditSearch(''); }}
                                            className={`w-full text-left px-4 py-3 border-b last:border-0 ${selectedCustomer?.customer_id === c.customer_id ? 'bg-teal-50 border-l-4 border-l-teal-500' : 'hover:bg-gray-50'}`}>
                                            <div className="flex justify-between"><div><p className="font-semibold text-sm">{c.customer_name}</p><p className="text-xs text-gray-500">{c.phone}</p></div>
                                                <div className="text-right"><p className={`text-sm font-bold ${(c.current_balance||0)>0?'text-red-500':'text-green-600'}`}>Ksh {(c.current_balance||0).toLocaleString()}</p><p className="text-[10px] text-gray-400">Balance</p></div></div>
                                        </button>
                                    ))}
                                </div>
                                {selectedCustomer && (
                                    <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-200">
                                        <div className="flex-1"><p className="font-bold text-green-800 text-sm">{selectedCustomer.customer_name}</p>
                                            <p className="text-xs text-green-600">Current: Ksh {(selectedCustomer.current_balance||0).toLocaleString()}  After: Ksh {((selectedCustomer.current_balance||0)+grandTotal).toLocaleString()}</p></div>
                                        <button onClick={() => { setSelectedCustomer(null); setPayCustomerName(''); }} className="text-red-400 text-xs font-bold">Clear</button>
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="flex gap-3">
                            <button onClick={() => { setShowPayment(false); resetStk(); }} className="flex-1 py-3 border-2 border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50" disabled={stkStatus==='sending'||stkStatus==='waiting'}>Cancel</button>
                            {stkStatus !== 'waiting' && stkStatus !== 'sending' && (
                                <button onClick={() => {
                                    if (payMethod==='credit' && !selectedCustomer) { toast.error('Select credit customer'); return; }
                                    if (payMethod==='cash' && Number(amountPaid)<grandTotal) { toast.error('Insufficient amount'); return; }
                                    if (payMethod==='mpesa' && !mpesaReceipt && stkStatus!=='success') { toast.error('Complete M-Pesa first'); return; }
                                    completeSale(payMethod==='mpesa'?'MPESA':payMethod.toUpperCase(), payMethod==='cash'?Number(amountPaid):grandTotal, mpesaReceipt, selectedCustomer?.customer_name||payCustomerName, checkoutId, mpesaPhone);
                                }} disabled={(payMethod==='mpesa'&&!mpesaReceipt&&stkStatus!=='success')||(payMethod==='credit'&&!selectedCustomer)}
                                    className={`flex-1 py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 ${(payMethod==='mpesa'&&!mpesaReceipt&&stkStatus!=='success')||(payMethod==='credit'&&!selectedCustomer)?'bg-gray-300 text-gray-500':'bg-gradient-to-r from-teal-500 to-cyan-600 text-white hover:shadow-lg'}`}>
                                     Complete Sale
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/*  DISCOUNT MODAL  */}
            {showDiscountModal && discountItem && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><span></span> Item Discount</h2>
                        <p className="text-sm text-gray-600 mb-4">{discountItem.name} @ Ksh {discountItem.effectivePrice.toLocaleString()} x {discountItem.qty}</p>
                        <input type="number" value={discountAmt} onChange={e => setDiscountAmt(e.target.value)} placeholder="Enter discount amount..."
                            className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-xl text-lg font-semibold focus:border-teal-500 outline-none mb-4" />
                        <div className="flex gap-3">
                            <button onClick={() => { setShowDiscountModal(false); setDiscountItem(null); }} className="flex-1 py-3 border-2 border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50">Cancel</button>
                            <button onClick={() => { const d = Number(discountAmt) || 0; if (discountItem) setCart(prev => prev.map(c => c.id===discountItem.id && c.batchId===discountItem.batchId ? {...c, discount: d} : c)); setShowDiscountModal(false); setDiscountItem(null); }}
                                className="flex-1 py-3 bg-teal-500 text-white rounded-xl font-semibold hover:bg-teal-600">Save</button>
                        </div>
                    </div>
                </div>
            )}

            {/*  OPEN REGISTER  */}
            {showOpeningDrop && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-[420px] max-w-[95vw]">
                        <h3 className="text-xl font-bold text-gray-800 mb-2"> Open Register</h3>
                        <p className="text-sm text-gray-500 mb-4">Enter opening cash amount.</p>
                        <label className="text-sm font-medium text-gray-600 mb-2 block"> Opening Cash</label>
                        <input type="number" value={openingAmount} onChange={e => setOpeningAmount(e.target.value)} placeholder="Enter amount (e.g., 5000)"
                            className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-xl text-xl font-bold text-center focus:border-green-500 outline-none mb-4" autoFocus />
                        <div className="grid grid-cols-4 gap-2 mb-4">
                            {[0,1000,2000,5000].map(a => <button key={a} onClick={() => setOpeningAmount(a.toString())} className="py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium">{a===0?'Zero':`Ksh ${a.toLocaleString()}`}</button>)}
                        </div>
                        <div className="p-4 bg-green-50 rounded-xl border border-green-200 mb-4 text-center">
                            <span className="text-green-700 font-medium text-sm">Opening Cash: </span>
                            <span className="text-2xl font-bold text-green-600">Ksh {(Number(openingAmount)||0).toLocaleString()}</span>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => { setShowOpeningDrop(false); setOpeningAmount(''); }} className="flex-1 py-3 border-2 border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50">Cancel</button>
                            <button onClick={handleOpenRegister} className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold hover:shadow-lg"> Open Register</button>
                        </div>
                    </div>
                </div>
            )}

            {/*  CLOSE REGISTER  */}
            {showCloseReg && closeData && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-[480px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-bold text-gray-800 mb-4"> Close Register  End of Day</h3>
                        <div className="space-y-2 mb-4">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Sales Breakdown</p>
                            <div className="flex justify-between p-3 bg-gray-50 rounded-xl"><span className="text-gray-600"> Cash</span><span className="font-bold text-lg">Ksh {closeData.totalCash.toLocaleString()}</span></div>
                            <div className="flex justify-between p-3 bg-gray-50 rounded-xl"><span className="text-gray-600"> M-Pesa</span><span className="font-bold text-green-600 text-lg">Ksh {closeData.totalMpesa.toLocaleString()}</span></div>
                            <div className="flex justify-between p-3 bg-gray-50 rounded-xl"><span className="text-gray-600"> Credit</span><span className="font-bold text-orange-600 text-lg">Ksh {closeData.totalCredit.toLocaleString()}</span></div>
                        </div>
                        <div className="bg-gradient-to-r from-teal-500 to-cyan-600 rounded-xl p-4 text-white mb-4">
                            <div className="flex justify-between"><span>Total Sales ({closeData.orderCount} orders)</span><span className="text-2xl font-bold">Ksh {closeData.totalSales.toLocaleString()}</span></div>
                        </div>
                        <div className="space-y-2 mb-4">
                            <p className="text-xs font-semibold text-gray-500 uppercase">Deductions</p>
                            <div className="flex justify-between p-3 bg-red-50 rounded-xl border border-red-200"><span className="text-red-600"> Expenses</span><span className="font-bold text-red-600">-Ksh {closeData.totalExpenses.toLocaleString()}</span></div>
                        </div>
                        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-4 text-white mb-4">
                            <div className="flex justify-between"><span className="font-bold text-lg">NET SALES</span><span className="text-3xl font-bold">Ksh {closeData.netSales.toLocaleString()}</span></div>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => { setShowCloseReg(false); setCloseData(null); }} className="flex-1 py-3 border-2 border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50">Cancel</button>
                            <button onClick={finalizeClose} className="flex-1 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-bold hover:shadow-lg"> Close & Save</button>
                        </div>
                    </div>
                </div>
            )}

            {loadingReg && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-6 flex items-center gap-3">
                        <div className="w-6 h-6 border-3 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="font-medium text-gray-700">Loading register data...</span>
                    </div>
                </div>
            )}
        </div>
    );
}
