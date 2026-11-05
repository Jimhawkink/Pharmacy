'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, completeSaleTransaction, getNextReceiptNumber } from '@/lib/supabase';
import { printCustomerReceipt, createReceiptData, loadCompanyInfo, CompanyInfo } from '@/lib/receiptPrinter';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

interface Product {
    id: number;
    name: string;
    barcode: string;
    category: string;
    availableQty: number;
    costPrice: number;
    salesPrice: number;
    salesUnit: string;
    imageUrl: string;
    generic_name: string;
    drug_type: string;
    dosage: string;
    requires_prescription: boolean;
    batches: { batch_id: number; batch_number: string; qty: number; days: number; expiry_date: string; selling_price: number }[];
}

interface BatchInfo {
    batch_id: number;
    batch_number: string;
    expiry_date: string;
    remaining_qty: number;
    purchase_cost: number;
    selling_price: number;
    days_until_expiry: number;
}

interface CartItem extends Product {
    qty: number;
    discount: number;
    effectivePrice: number;
    batchId: number;
    batchNumber: string;
    expiryDate: string;
    daysUntilExpiry: number;
    sellingUnit: string;
    prescriptionNote?: string;
    doctorName?: string;
}

interface Category {
    category_id: number;
    category_name: string;
    icon: string;
}

interface CreditCustomer {
    customer_id: number;
    customer_name: string;
    phone: string;
    current_balance: number;
    credit_limit: number;
}

interface HeldSale {
    id: string;
    heldAt: string;
    customerName: string;
    items: CartItem[];
    subtotal: number;
    grandTotal: number;
    notes?: string;
}

const getDaysUntil = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
const getExpiryColor = (d: number) => {
    if (d < 0) return 'bg-red-500 text-white';
    if (d <= 30) return 'bg-rose-100 text-rose-700 border border-rose-200';
    if (d <= 90) return 'bg-amber-100 text-amber-800 border border-amber-200';
    return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
};

// Web Audio API Synthesizer (No external dependencies)
const playSound = (type: 'beep' | 'success' | 'warning' = 'beep') => {
    if (typeof window === 'undefined') return;
    try {
        const isMuted = localStorage.getItem('pos_sound_muted') === 'true';
        if (isMuted) return;
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        if (type === 'beep') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1760, now); // A6 beep
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.08);
        } else if (type === 'success') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(523.25, now);
            osc.frequency.setValueAtTime(659.25, now + 0.08);
            osc.frequency.setValueAtTime(783.99, now + 0.16);
            osc.frequency.setValueAtTime(1046.50, now + 0.24);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.45);
        } else if (type === 'warning') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(240, now);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.22);
        }
    } catch { /* silent */ }
};

const SUPABASE_BASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://qqjlpwqtzfprvbsopycd.supabase.co';
const MPESA_API_URL = `${SUPABASE_BASE_URL}/functions/v1`;
const MPESA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxamxwd3F0emZwcnZic29weWNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1NTQ4NjQsImV4cCI6MjEwOTEzMDg2NH0.LWusY9hDiKddMM8E11_mn7_hopKGr1Rk2CS-JHLF3cQ';

const fmtPhone = (p: string) => {
    let c = p.replace(/[\s+\-]/g, '');
    if (c.startsWith('0')) c = '254' + c.substring(1);
    else if (!c.startsWith('254')) c = '254' + c;
    return c;
};
const validPhone = (p: string) => /^(07\d{8}|01\d{8}|254\d{9})$/.test(p.replace(/[\s+\-]/g, ''));

// ==================== PRODUCT CARD ====================
const ProductCard = ({
    product,
    onAdd,
    onOpenBatches,
}: {
    product: Product;
    onAdd: () => void;
    onOpenBatches: () => void;
}) => {
    const validBatches = (product.batches || []).filter(b => b.days >= 0);
    const nearestBatch = validBatches[0] || product.batches?.[0];
    const isExpired = nearestBatch && nearestBatch.days < 0;
    const isMultiBatch = (product.batches || []).length > 1;

    return (
        <div
            onClick={() => {
                if (product.availableQty > 0 && !isExpired) {
                    if (isMultiBatch) onOpenBatches();
                    else onAdd();
                }
            }}
            className={`bg-white rounded-xl shadow-sm border transition-all duration-200 h-[170px] flex flex-col group relative overflow-hidden cursor-pointer ${
                product.availableQty === 0
                    ? 'border-gray-200 opacity-60 bg-gray-50/50'
                    : isExpired
                    ? 'border-red-200 hover:border-red-300'
                    : 'border-gray-200 hover:shadow-md hover:border-emerald-400 active:scale-[0.99]'
            }`}
            title={product.name}
        >
            {/* Top Badges overlay */}
            <div className="absolute top-1.5 left-1.5 right-1.5 z-10 flex items-center justify-between pointer-events-none">
                {product.requires_prescription ? (
                    <span className="px-1 py-0.2 bg-blue-600 text-white rounded text-[7.5px] font-bold tracking-wider shadow-sm flex items-center gap-0.5">
                        <span>℞</span> Rx
                    </span>
                ) : <span />}

                {nearestBatch && (
                    <span
                        className={`px-1 py-0.2 rounded text-[7.5px] font-bold shadow-sm ${
                            nearestBatch.days < 0
                                ? 'bg-red-600 text-white animate-pulse'
                                : nearestBatch.days <= 30
                                ? 'bg-amber-500 text-white font-extrabold'
                                : nearestBatch.days <= 90
                                ? 'bg-amber-100 text-amber-900 border border-amber-300 font-semibold'
                                : 'bg-emerald-100 text-emerald-800 font-semibold'
                        }`}
                    >
                        {nearestBatch.days < 0 ? 'EXPIRED' : `${nearestBatch.days}d`}
                    </span>
                )}
            </div>

            {/* Compact Image - 58px */}
            <div className="h-[58px] bg-gradient-to-b from-gray-50 to-white flex items-center justify-center flex-shrink-0 relative p-1">
                {product.imageUrl ? (
                    <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="max-h-[50px] max-w-[50px] object-contain group-hover:scale-105 transition-transform duration-200"
                        onError={(e) => {
                            (e.target as HTMLImageElement).src = '/no-image.png';
                        }}
                    />
                ) : (
                    <div className="h-[42px] w-[42px] rounded-lg bg-emerald-50/60 border border-emerald-100 flex items-center justify-center text-emerald-600 text-xl">
                        💊
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 px-2 py-1.5 flex flex-col justify-between min-h-0">
                <div className="min-w-0">
                    <h3 className="text-[11px] font-bold text-gray-800 line-clamp-1 group-hover:text-emerald-700 transition-colors" title={product.name}>
                        {product.name}
                    </h3>

                    {/* Generic / Dosage / Form Subtitle */}
                    {(product.generic_name || product.dosage || product.drug_type) ? (
                        <p className="text-[8.5px] text-gray-500 line-clamp-1 italic">
                            {[product.generic_name, product.dosage, product.drug_type].filter(Boolean).join(' • ')}
                        </p>
                    ) : (
                        <p className="text-[8.5px] text-gray-400 truncate">SKU: {product.barcode || product.id}</p>
                    )}

                    <div className="flex items-center gap-1 mt-0.5">
                        <span className="px-1 py-0.2 bg-gray-100 text-gray-600 rounded text-[7.5px] font-medium truncate max-w-[85px]">
                            {product.category || 'General'}
                        </span>
                        {isMultiBatch && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenBatches();
                                }}
                                className="px-1 py-0.2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded text-[7.5px] font-bold"
                                title="Click to pick a specific batch"
                            >
                                {product.batches.length} Batches
                            </button>
                        )}
                    </div>
                </div>

                <div className="pt-1">
                    <div className="flex items-baseline justify-between mb-1">
                        <span className="text-[12px] font-extrabold text-gray-900 leading-none">
                            Ksh {product.salesPrice.toLocaleString()}
                        </span>
                        <span
                            className={`px-1 py-0.2 rounded text-[8px] font-bold leading-none ${
                                product.availableQty > 10
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : product.availableQty > 0
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-red-50 text-red-600 border border-red-200'
                            }`}
                        >
                            {product.availableQty > 0 ? `${product.availableQty} ${product.salesUnit}` : 'Out'}
                        </span>
                    </div>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (product.availableQty > 0 && !isExpired) {
                                if (isMultiBatch) onOpenBatches();
                                else onAdd();
                            }
                        }}
                        disabled={product.availableQty === 0 || isExpired}
                        className={`w-full py-1 rounded-md text-[10px] font-semibold flex items-center justify-center gap-1 transition-all ${
                            product.availableQty === 0
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : isExpired
                                ? 'bg-red-100 text-red-600 cursor-not-allowed font-bold'
                                : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 active:scale-[0.98] shadow-sm hover:shadow'
                        }`}
                    >
                        {isExpired ? '⚠️ Expired' : product.availableQty === 0 ? 'Out of Stock' : '+ Add to Cart'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ==================== CART ITEM ROW ====================
const CartItemRow = ({
    item,
    onIncrease,
    onDecrease,
    onRemove,
    onEditDiscount,
    onEditRx,
    canDiscount = true,
}: {
    item: CartItem;
    onIncrease: () => void;
    onDecrease: () => void;
    onRemove: () => void;
    onEditDiscount: () => void;
    onEditRx: () => void;
    canDiscount?: boolean;
}) => {
    const itemTotal = item.effectivePrice * item.qty - item.discount;

    return (
        <div className="bg-white rounded-xl p-3 space-y-2 border border-gray-100 shadow-sm hover:border-gray-200 transition-colors">
            <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-semibold text-gray-800 text-sm truncate" title={item.name}>
                            {item.name}
                        </p>
                        {item.requires_prescription && (
                            <span className="px-1 py-0.2 bg-blue-100 text-blue-700 rounded text-[8px] font-bold">
                                ℞ Rx
                            </span>
                        )}
                    </div>

                    <p className="text-xs text-gray-500">
                        @ Ksh {item.effectivePrice.toLocaleString()} / {item.sellingUnit || item.salesUnit || 'Pc'}
                    </p>

                    {item.batchNumber && (
                        <p className="text-[10px] text-purple-700 font-mono font-medium flex items-center gap-1 mt-0.5">
                            <span>🏷️ Batch: {item.batchNumber}</span>
                            <span>•</span>
                            <span className={item.daysUntilExpiry <= 30 ? 'text-amber-700 font-bold' : 'text-gray-500'}>
                                {item.daysUntilExpiry < 0 ? 'EXPIRED' : `${item.daysUntilExpiry}d left`}
                            </span>
                        </p>
                    )}

                    {item.prescriptionNote && (
                        <p className="text-[10px] text-blue-700 bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5 mt-1 italic">
                            ℞ Note: {item.prescriptionNote}
                        </p>
                    )}
                </div>

                {/* Qty Stepper */}
                <div className="flex items-center gap-1">
                    <button
                        onClick={onDecrease}
                        className="w-7 h-7 rounded-lg bg-orange-500 hover:bg-orange-600 flex items-center justify-center font-bold text-white transition-colors text-base shadow-sm active:scale-95"
                        title="Decrease quantity"
                    >
                        -
                    </button>
                    <span className="w-8 text-center font-bold text-gray-800 text-sm">{item.qty}</span>
                    <button
                        onClick={onIncrease}
                        className="w-7 h-7 rounded-lg bg-green-500 hover:bg-green-600 flex items-center justify-center font-bold text-white transition-colors text-base shadow-sm active:scale-95"
                        title="Increase quantity"
                    >
                        +
                    </button>
                </div>

                {/* Total */}
                <div className="text-right min-w-[70px]">
                    <p className="font-bold text-gray-800 text-sm">Ksh {itemTotal.toLocaleString()}</p>
                    {item.discount > 0 && <p className="text-[10px] text-emerald-600 font-medium">-{item.discount.toLocaleString()}</p>}
                </div>

                {/* Remove */}
                <button
                    onClick={onRemove}
                    className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-500 transition-colors shrink-0"
                    title="Remove item"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                </button>
            </div>

            {/* Item Action Pills */}
            <div className="flex gap-2 pt-1 border-t border-gray-50">
                {canDiscount && (
                    <button
                        onClick={onEditDiscount}
                        className="flex-1 py-1 text-[11px] bg-gray-50 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors font-medium flex items-center justify-center gap-1 border border-gray-100"
                    >
                        <span>🏷️</span> Discount {item.discount > 0 ? `(Ksh ${item.discount})` : ''}
                    </button>
                )}
                <button
                    onClick={onEditRx}
                    className={`flex-1 py-1 text-[11px] rounded-lg transition-colors font-medium flex items-center justify-center gap-1 border ${
                        item.prescriptionNote
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-100'
                    }`}
                >
                    <span>℞</span> {item.prescriptionNote ? 'Edit Rx' : '+ Rx Note'}
                </button>
            </div>
        </div>
    );
};

// ==================== MAIN COMPONENT ====================
export default function PharmacyPOS() {
    const { activeOutlet, outlets, switchOutlet } = useOutlet();
    const outletId = activeOutlet?.outlet_id || 1;
    const storeName = activeOutlet?.outlet_name || 'Alpha Pharmacy';

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
    const [showRxModal, setShowRxModal] = useState(false);
    const [rxItem, setRxItem] = useState<CartItem | null>(null);
    const [rxNote, setRxNote] = useState('');
    const [userRole, setUserRole] = useState('');
    const [userName, setUserName] = useState('Pharmacist');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [registerOpen, setRegisterOpen] = useState(false);
    const [currentShiftId, setCurrentShiftId] = useState<number | null>(null);
    const [showOpeningDrop, setShowOpeningDrop] = useState(false);
    const [openingAmount, setOpeningAmount] = useState('');
    const [showCloseReg, setShowCloseReg] = useState(false);
    const [closeData, setCloseData] = useState<any>(null);
    const [loadingReg, setLoadingReg] = useState(false);
    const [payMethod, setPayMethod] = useState('cash');
    const [amountPaid, setAmountPaid] = useState('');
    const [mpesaPhone, setMpesaPhone] = useState('');
    const [mpesaReceipt, setMpesaReceipt] = useState('');
    const [payCustomerName, setPayCustomerName] = useState('');
    const [doctorNameInput, setDoctorNameInput] = useState('');
    const [creditSearchPay, setCreditSearchPay] = useState('');
    const [stkStatus, setStkStatus] = useState<'idle' | 'sending' | 'waiting' | 'success' | 'failed'>('idle');
    const [stkMsg, setStkMsg] = useState('');
    const [checkoutId, setCheckoutId] = useState('');
    const [isMuted, setIsMuted] = useState(false);
    const [heldSales, setHeldSales] = useState<HeldSale[]>([]);
    const [showHeldModal, setShowHeldModal] = useState(false);
    const [showShortcutsModal, setShowShortcutsModal] = useState(false);
    const [currentTime, setCurrentTime] = useState('');

    const pollRef = useRef<NodeJS.Timeout | null>(null);
    const doneRef = useRef(false);
    const searchRef = useRef<HTMLInputElement>(null);

    const canDiscount = ['Admin', 'SuperAdmin', 'Super User', 'admin', 'superadmin'].includes(userRole);

    // Live clock
    useEffect(() => {
        const updateClock = () => {
            setCurrentTime(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        };
        updateClock();
        const t = setInterval(updateClock, 1000);
        return () => clearInterval(t);
    }, []);

    // Load sound preference & held carts from localStorage
    useEffect(() => {
        if (typeof window !== 'undefined') {
            setIsMuted(localStorage.getItem('pos_sound_muted') === 'true');
            const storedHeld = localStorage.getItem('pharmacy_held_sales');
            if (storedHeld) {
                try { setHeldSales(JSON.parse(storedHeld)); } catch { /* ignore */ }
            }
        }
    }, []);

    const toggleSound = () => {
        const next = !isMuted;
        setIsMuted(next);
        if (typeof window !== 'undefined') {
            localStorage.setItem('pos_sound_muted', next ? 'true' : 'false');
        }
        toast.success(next ? 'Sound Muted' : 'Sound Enabled');
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => { });
        } else {
            document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => { });
        }
    };

    // Load data
    const loadData = useCallback(async () => {
        if (!activeOutlet) return;
        setLoading(true);
        try {
            const [{ data: prods }, { data: cats }, { data: stock }, { data: bData }] = await Promise.all([
                supabase
                    .from('pharmacy_products')
                    .select('pid, product_code, product_name, barcode, category, purchase_unit, sales_unit, purchase_cost, sales_cost, pieces_per_package, photo, generic_name, drug_type, dosage, requires_prescription')
                    .eq('outlet_id', outletId)
                    .eq('active', true)
                    .order('product_name'),
                supabase.from('pharmacy_categories').select('*').eq('active', true).order('category_name'),
                supabase.from('pharmacy_stock').select('pid, qty').eq('outlet_id', outletId),
                supabase
                    .from('pharmacy_batches')
                    .select('batch_id, product_id, batch_number, remaining_qty, expiry_date, selling_price')
                    .eq('outlet_id', outletId)
                    .eq('status', 'Active')
                    .gt('remaining_qty', 0)
                    .order('expiry_date', { ascending: true }),
            ]);

            const stockMap: Record<number, number> = {};
            (stock || []).forEach((s: any) => {
                stockMap[s.pid] = (stockMap[s.pid] || 0) + (s.qty || 0);
            });

            const batchMap: Record<number, { batch_id: number; batch_number: string; qty: number; days: number; expiry_date: string; selling_price: number }[]> = {};
            (bData || []).forEach((b: any) => {
                if (!batchMap[b.product_id]) batchMap[b.product_id] = [];
                batchMap[b.product_id].push({
                    batch_id: b.batch_id,
                    batch_number: b.batch_number,
                    qty: b.remaining_qty,
                    days: getDaysUntil(b.expiry_date),
                    expiry_date: b.expiry_date,
                    selling_price: b.selling_price || 0,
                });
            });

            setProducts(
                (prods || []).map((p: any) => ({
                    id: p.pid,
                    name: p.product_name,
                    barcode: p.barcode || '',
                    category: p.category || '',
                    availableQty: stockMap[p.pid] || 0,
                    costPrice: p.purchase_cost || 0,
                    salesPrice: p.sales_cost || 0,
                    salesUnit: p.sales_unit || 'Piece',
                    imageUrl: p.photo || '',
                    generic_name: p.generic_name || '',
                    drug_type: p.drug_type || '',
                    dosage: p.dosage || '',
                    requires_prescription: p.requires_prescription || false,
                    batches: batchMap[p.pid] || [],
                }))
            );
            setCategories(cats || []);
            const rn = await getNextReceiptNumber(outletId);
            setReceiptNo(rn);
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            setUserRole(user.userType || '');
            setUserName(user.name || 'Pharmacist');
        } catch (err) {
            console.error(err);
            toast.error('Failed to load products');
        }
        setLoading(false);
    }, [activeOutlet, outletId]);

    const loadCreditCustomers = useCallback(async () => {
        const { data } = await supabase.from('pharmacy_credit_customers').select('*').eq('active', true).order('customer_name');
        setCreditCustomers(data || []);
    }, []);

    const loadActiveShift = useCallback(async () => {
        const { data } = await supabase
            .from('pharmacy_shift_instances')
            .select('*')
            .eq('shift_status', 'Open')
            .order('shift_instance_id', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (data) {
            setCurrentShiftId(data.shift_instance_id);
            setRegisterOpen(true);
        }
    }, []);

    useEffect(() => {
        loadData();
        loadCreditCustomers();
        loadActiveShift();
    }, [loadData, loadCreditCustomers, loadActiveShift]);

    // Live search filter
    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredProducts([]);
            return;
        }
        const q = searchQuery.toLowerCase().trim();
        setFilteredProducts(
            products
                .filter(
                    (p) =>
                        p.name.toLowerCase().includes(q) ||
                        p.barcode.toLowerCase().includes(q) ||
                        (p.generic_name || '').toLowerCase().includes(q) ||
                        (p.category || '').toLowerCase().includes(q)
                )
                .slice(0, 24)
        );
    }, [searchQuery, products]);

    const loadCatProducts = (catId: number, catName: string) => {
        setSelectedCategory(catId);
        setCategoryProducts(products.filter((p) => p.category.toLowerCase() === catName.toLowerCase()));
    };

    // Open Batch Selection or Auto-Pick (FEFO)
    const openBatchSelect = async (product: Product, forceModal = false) => {
        if (!registerOpen) {
            playSound('warning');
            toast.error('Please open the register first!');
            return;
        }
        if (product.availableQty <= 0) {
            playSound('warning');
            toast.error(`${product.name} is out of stock!`);
            return;
        }

        // Fetch fresh batches
        const { data } = await supabase
            .from('pharmacy_batches')
            .select('*')
            .eq('product_id', product.id)
            .eq('outlet_id', outletId)
            .eq('status', 'Active')
            .gt('remaining_qty', 0)
            .order('expiry_date', { ascending: true }); // FEFO

        const bl: BatchInfo[] = (data || []).map((b: any) => ({
            batch_id: b.batch_id,
            batch_number: b.batch_number,
            expiry_date: b.expiry_date,
            remaining_qty: b.remaining_qty,
            purchase_cost: b.purchase_cost,
            selling_price: b.selling_price || product.salesPrice,
            days_until_expiry: getDaysUntil(b.expiry_date),
        }));

        if (bl.length === 0) {
            addToCart(product, null);
            return;
        }

        // Filter valid (unexpired) batches
        const validBatches = bl.filter((b) => b.days_until_expiry >= 0);

        if (validBatches.length === 0) {
            playSound('warning');
            toast.error(`All batches for ${product.name} have expired! Cannot dispense expired medicine.`);
            return;
        }

        if (validBatches.length === 1 && !forceModal) {
            addToCart(product, validBatches[0]);
            return;
        }

        // If multiple batches or forced modal, let user choose with FEFO sorting
        setBatchList(bl);
        setBatchProduct(product);
        setShowBatchModal(true);
    };

    const addToCart = (product: Product, batch: BatchInfo | null) => {
        const bId = batch?.batch_id || 0;
        const price = batch?.selling_price || product.salesPrice;
        const existing = cart.findIndex((c) => c.id === product.id && c.batchId === bId);

        if (existing >= 0) {
            setCart((prev) => prev.map((c, i) => (i === existing ? { ...c, qty: c.qty + 1 } : c)));
        } else {
            setCart((prev) => [
                ...prev,
                {
                    ...product,
                    qty: 1,
                    discount: 0,
                    effectivePrice: price,
                    batchId: bId,
                    batchNumber: batch?.batch_number || '',
                    expiryDate: batch?.expiry_date || '',
                    daysUntilExpiry: batch?.expiry_date ? getDaysUntil(batch.expiry_date) : 999,
                    sellingUnit: product.salesUnit,
                },
            ]);
        }

        playSound('beep');
        setShowBatchModal(false);
        toast.success(`Added ${product.name}${batch?.batch_number ? ` [Batch: ${batch.batch_number}]` : ''}`);
        setSearchQuery('');
        searchRef.current?.focus();
    };

    // Instant Hardware Barcode Scan / Enter Key handler
    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const query = searchQuery.trim().toLowerCase();
            if (!query) return;

            // 1. Exact barcode match
            const exactBarcode = products.find((p) => p.barcode && p.barcode.toLowerCase() === query);
            if (exactBarcode) {
                openBatchSelect(exactBarcode);
                setSearchQuery('');
                return;
            }

            // 2. Exact code or exact name match
            const exactName = products.find(
                (p) => p.name.toLowerCase() === query || (p.id.toString() === query)
            );
            if (exactName) {
                openBatchSelect(exactName);
                setSearchQuery('');
                return;
            }

            // 3. Top filtered product
            if (filteredProducts.length > 0) {
                openBatchSelect(filteredProducts[0]);
                setSearchQuery('');
            }
        }
    };

    // Global POS Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const tag = (document.activeElement as HTMLElement)?.tagName;
            const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

            if (e.key === 'F1' || (e.key === '/' && !isInput)) {
                e.preventDefault();
                searchRef.current?.focus();
                searchRef.current?.select();
            } else if (e.key === 'F2' && !isInput) {
                e.preventDefault();
                if (cart.length > 0 && registerOpen) {
                    setPayMethod('cash');
                    setShowPayment(true);
                }
            } else if (e.key === 'F3' && !isInput) {
                e.preventDefault();
                if (cart.length > 0 && registerOpen) {
                    setPayMethod('mpesa');
                    setShowPayment(true);
                }
            } else if (e.key === 'F4' && !isInput) {
                e.preventDefault();
                handleHoldSale();
            } else if (e.key === 'F9' || (e.ctrlKey && e.key === 'Enter')) {
                e.preventDefault();
                if (!showPayment && cart.length > 0 && registerOpen) {
                    setShowPayment(true);
                }
            } else if (e.key === 'Escape') {
                setShowPayment(false);
                setShowBatchModal(false);
                setShowDiscountModal(false);
                setShowRxModal(false);
                setShowOpeningDrop(false);
                setShowCloseReg(false);
                setShowHeldModal(false);
                setShowShortcutsModal(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [cart, registerOpen, showPayment]);

    const increaseQty = (idx: number) => setCart((prev) => prev.map((c, i) => (i === idx ? { ...c, qty: c.qty + 1 } : c)));
    const decreaseQty = (idx: number) => setCart((prev) => prev.map((c, i) => (i === idx && c.qty > 1 ? { ...c, qty: c.qty - 1 } : c)));
    const removeFromCart = (idx: number) => setCart((prev) => prev.filter((_, i) => i !== idx));
    const clearCart = () => {
        setCart([]);
        toast.success('Cart cleared');
    };

    const subtotal = cart.reduce((s, c) => s + c.effectivePrice * c.qty, 0);
    const totalDiscount = cart.reduce((s, c) => s + c.discount, 0);
    const grandTotal = Math.max(0, subtotal - totalDiscount);

    // Park / Hold Cart
    const handleHoldSale = () => {
        if (cart.length === 0) {
            toast.error('Cart is empty. Add items first to hold.');
            return;
        }
        const custName = selectedCustomer?.customer_name || customerSearch || 'Walk-in Patient';
        const newHold: HeldSale = {
            id: `HOLD-${Date.now().toString(36).toUpperCase()}`,
            heldAt: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
            customerName: custName,
            items: [...cart],
            subtotal,
            grandTotal,
        };

        const updated = [newHold, ...heldSales];
        setHeldSales(updated);
        if (typeof window !== 'undefined') {
            localStorage.setItem('pharmacy_held_sales', JSON.stringify(updated));
        }

        setCart([]);
        setSelectedCustomer(null);
        setCustomerSearch('');
        playSound('beep');
        toast.success(`Sale parked: ${custName} (${cart.length} items)`);
    };

    const resumeHeldSale = (hold: HeldSale) => {
        if (cart.length > 0) {
            if (!confirm('Current cart has items. Replace with parked sale?')) return;
        }
        setCart(hold.items);
        setCustomerSearch(hold.customerName !== 'Walk-in Patient' ? hold.customerName : '');
        const updated = heldSales.filter((h) => h.id !== hold.id);
        setHeldSales(updated);
        if (typeof window !== 'undefined') {
            localStorage.setItem('pharmacy_held_sales', JSON.stringify(updated));
        }
        setShowHeldModal(false);
        playSound('beep');
        toast.success(`Resumed sale for ${hold.customerName}`);
    };

    const deleteHeldSale = (id: string) => {
        const updated = heldSales.filter((h) => h.id !== id);
        setHeldSales(updated);
        if (typeof window !== 'undefined') {
            localStorage.setItem('pharmacy_held_sales', JSON.stringify(updated));
        }
        toast.success('Parked sale removed');
    };

    // Register Handlers
    const handleOpenRegister = async () => {
        const amt = Number(openingAmount) || 0;
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const { data: shift, error } = await supabase
                .from('pharmacy_shift_instances')
                .insert({
                    shift_date: new Date().toISOString().split('T')[0],
                    actual_start_time: new Date().toISOString(),
                    opening_cash: amt,
                    shift_status: 'Open',
                    opened_by: user.name || 'Pharmacist',
                    created_by: user.name || 'Pharmacist',
                    outlet_id: outletId,
                })
                .select('shift_instance_id')
                .single();
            if (error) throw error;
            setCurrentShiftId(shift.shift_instance_id);
            setRegisterOpen(true);
            setShowOpeningDrop(false);
            setOpeningAmount('');
            playSound('success');
            toast.success(`Register opened with Ksh ${amt.toLocaleString()}`);
        } catch (err: any) {
            toast.error('Failed: ' + err.message);
        }
    };

    const handleCloseRegister = async () => {
        setLoadingReg(true);
        try {
            const today = new Date().toISOString().split('T')[0];
            const { data: salesData } = await supabase
                .from('pharmacy_sales')
                .select('sale_id, total, payment_method')
                .eq('outlet_id', outletId)
                .gte('sale_datetime', today);
            const { data: expData } = await supabase
                .from('pharmacy_expenses')
                .select('amount')
                .eq('outlet_id', outletId)
                .gte('created_at', today);

            let oCash = 0;
            if (currentShiftId) {
                const { data: sd } = await supabase
                    .from('pharmacy_shift_instances')
                    .select('opening_cash')
                    .eq('shift_instance_id', currentShiftId)
                    .single();
                oCash = sd?.opening_cash || 0;
            }

            const sales = salesData || [];
            const totalSales = sales.reduce((s: number, r: any) => s + (r.total || 0), 0);
            const totalCash = sales
                .filter((r: any) => (r.payment_method || '').toLowerCase().includes('cash'))
                .reduce((s: number, r: any) => s + (r.total || 0), 0);
            const totalMpesa = sales
                .filter((r: any) => (r.payment_method || '').toLowerCase().includes('mpesa'))
                .reduce((s: number, r: any) => s + (r.total || 0), 0);
            const totalCredit = sales
                .filter((r: any) => (r.payment_method || '').toLowerCase().includes('credit'))
                .reduce((s: number, r: any) => s + (r.total || 0), 0);
            const totalExp = (expData || []).reduce((s: number, e: any) => s + (e.amount || 0), 0);

            const saleIds = sales.map((s: any) => s.sale_id);
            let totalCostPrice = 0;
            if (saleIds.length > 0) {
                const { data: itemsData } = await supabase
                    .from('pharmacy_sales_items')
                    .select('quantity, purchase_price')
                    .in('sale_id', saleIds);
                totalCostPrice = (itemsData || []).reduce(
                    (sum: number, item: any) => sum + (item.purchase_price || 0) * (item.quantity || 0),
                    0
                );
            }
            const profit = totalSales - totalCostPrice;

            setCloseData({
                totalSales,
                totalCash,
                totalMpesa,
                totalCredit,
                totalExpenses: totalExp,
                openingCash: oCash,
                netSales: totalSales - totalExp - totalCredit,
                orderCount: sales.length,
                profit,
            });
            setShowCloseReg(true);
        } catch (err: any) {
            toast.error('Failed: ' + err.message);
        }
        setLoadingReg(false);
    };

    const printCloseRegisterReport = () => {
        if (!closeData) return;
        const d = closeData;
        const now = new Date();
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Close Register</title>
<style>
  @page{margin:0;size:80mm auto;}
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:Arial,sans-serif;font-size:11px;font-weight:700;width:80mm;padding:4mm;background:#fff;color:#000;line-height:1.4;}
  .c{text-align:center;}
  .r{display:flex;justify-content:space-between;padding:3px 0;border-bottom:0.5px dashed #ccc;}
  .d{border:none;border-top:1px solid #000;margin:4px 0;}
  .dd{border:none;border-top:1px dashed #000;margin:3px 0;}
  .big{font-size:14px;font-weight:900;}
  @media print{body{width:80mm;}}
</style></head><body>
  <div class="c">
    <div style="font-size:14px;font-weight:900;text-transform:uppercase;">${storeName}</div>
    <div style="font-size:9px;margin:2px 0;">Close Register Report</div>
  </div>
  <hr class="d">
  <div class="c" style="margin:4px 0;">
    <div style="background:#000;color:#fff;padding:4px 12px;display:inline-block;font-size:11px;font-weight:900;letter-spacing:1px;">END OF DAY REPORT</div>
  </div>
  <hr class="dd">
  <div class="r"><span style="font-size:9px;">Date</span><span style="font-size:10px;">${now.toLocaleDateString('en-GB')}</span></div>
  <div class="r"><span style="font-size:9px;">Time</span><span style="font-size:10px;">${now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span></div>
  <div class="r"><span style="font-size:9px;">Total Orders</span><span style="font-size:10px;">${d.orderCount}</span></div>
  <hr class="d">
  <div class="c" style="font-size:9px;font-weight:900;letter-spacing:1px;margin:3px 0;">SALES BREAKDOWN</div>
  <div class="r"><span>💵 Cash Sales</span><span class="big">Ksh ${d.totalCash.toLocaleString()}</span></div>
  <div class="r"><span>📱 M-Pesa Sales</span><span class="big">Ksh ${d.totalMpesa.toLocaleString()}</span></div>
  <div class="r"><span>📋 Credit Sales</span><span class="big">Ksh ${d.totalCredit.toLocaleString()}</span></div>
  <hr class="dd">
  <div style="background:#000;color:#fff;padding:5px 8px;margin:4px 0;display:flex;justify-content:space-between;">
    <span style="font-size:11px;font-weight:900;">TOTAL SALES</span>
    <span style="font-size:14px;font-weight:900;">Ksh ${d.totalSales.toLocaleString()}</span>
  </div>
  <hr class="d">
  <div class="c" style="font-size:9px;font-weight:900;letter-spacing:1px;margin:3px 0;">DEDUCTIONS</div>
  <div class="r"><span>💰 Total Expenses</span><span style="color:#c00;" class="big">Ksh ${d.totalExpenses.toLocaleString()}</span></div>
  <div class="r"><span>📋 Total Credit</span><span style="color:#c00;" class="big">Ksh ${d.totalCredit.toLocaleString()}</span></div>
  <hr class="d">
  <div class="c" style="font-size:9px;font-weight:900;letter-spacing:1px;margin:3px 0;">CASH SUMMARY</div>
  <div class="r"><span>🟢 Opening Cash</span><span class="big">Ksh ${d.openingCash.toLocaleString()}</span></div>
  <div class="r"><span>💵 Cash Sales</span><span class="big">Ksh ${d.totalCash.toLocaleString()}</span></div>
  <div class="r"><span>🔴 Expenses</span><span style="color:#c00;" class="big">-Ksh ${d.totalExpenses.toLocaleString()}</span></div>
  <hr class="dd">
  <div style="background:#000;color:#fff;padding:6px 8px;margin:4px 0;display:flex;justify-content:space-between;">
    <span style="font-size:12px;font-weight:900;">NET SALES</span>
    <span style="font-size:16px;font-weight:900;">Ksh ${d.netSales.toLocaleString()}</span>
  </div>
  <div style="background:#000;color:#fff;padding:5px 8px;margin:2px 0;display:flex;justify-content:space-between;">
    <span style="font-size:10px;font-weight:900;">EXPECTED IN DRAWER</span>
    <span style="font-size:13px;font-weight:900;">Ksh ${(d.openingCash + d.totalCash - d.totalExpenses).toLocaleString()}</span>
  </div>
  <div style="background:#000;color:#fff;padding:6px 8px;margin:4px 0;display:flex;justify-content:space-between;">
    <span style="font-size:12px;font-weight:900;">📈 PROFIT</span>
    <span style="font-size:16px;font-weight:900;">Ksh ${(d.profit || 0).toLocaleString()}</span>
  </div>
  <hr class="d">
  <div class="c" style="padding:4px 0;">
    <div style="font-size:8px;">Printed: ${now.toLocaleDateString('en-GB')} ${now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
    <div style="font-size:7px;margin-top:2px;color:#666;">Powered by Alpha Pharmacy POS</div>
  </div>
</body></html>`;
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;visibility:hidden;';
        document.body.appendChild(iframe);
        const doc = iframe.contentWindow?.document;
        if (doc) {
            doc.open();
            doc.write(html);
            doc.close();
            iframe.onload = () => {
                setTimeout(() => {
                    try {
                        iframe.contentWindow?.focus();
                        iframe.contentWindow?.print();
                    } catch (e) {
                        console.error(e);
                    }
                    setTimeout(() => document.body.removeChild(iframe), 1000);
                }, 300);
            };
        }
    };

    const finalizeClose = async () => {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (currentShiftId) {
            await supabase
                .from('pharmacy_shift_instances')
                .update({
                    actual_end_time: new Date().toISOString(),
                    closing_cash: closeData?.totalCash || 0,
                    shift_status: 'Closed',
                    closed_by: user.name || 'Pharmacist',
                    closed_date: new Date().toISOString(),
                })
                .eq('shift_instance_id', currentShiftId);
        }
        setRegisterOpen(false);
        setCurrentShiftId(null);
        setShowCloseReg(false);
        setCloseData(null);
        playSound('success');
        toast.success('Register closed successfully');
    };

    const resetStk = () => {
        if (pollRef.current) clearInterval(pollRef.current);
        setStkStatus('idle');
        setStkMsg('');
        setCheckoutId('');
        doneRef.current = false;
    };

    // Complete Sale Transaction
    const completeSale = async (
        method: string,
        paid: number,
        receipt?: string,
        custName?: string,
        cId?: string,
        cPhone?: string
    ) => {
        try {
            const cashierName = userName || 'Pharmacist';

            // Generate fresh receipt number
            let freshReceiptNo = receiptNo;
            try {
                const prefix = `PHARM-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-`;
                const { data: latestSales } = await supabase
                    .from('pharmacy_sales')
                    .select('receipt_no')
                    .like('receipt_no', `${prefix}%`)
                    .order('sale_id', { ascending: false })
                    .limit(1);
                if (latestSales && latestSales.length > 0) {
                    const regex = new RegExp(`${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)`);
                    const match = latestSales[0].receipt_no?.match(regex);
                    if (match) {
                        freshReceiptNo = `${prefix}${String(parseInt(match[1]) + 1).padStart(2, '0')}`;
                    }
                }
            } catch { /* fallback */ }

            const effectiveCustomer = selectedCustomer?.customer_name || custName || payCustomerName || null;
            const effectivePhone = selectedCustomer?.phone || cPhone || mpesaPhone || null;

            // Insert sale record
            const { data: sale, error: saleError } = await supabase
                .from('pharmacy_sales')
                .insert([
                    {
                        receipt_no: freshReceiptNo,
                        sale_datetime: new Date().toISOString(),
                        subtotal: subtotal,
                        discount: totalDiscount,
                        tax: 0,
                        total: grandTotal,
                        payment_method: method.toUpperCase(),
                        amount_paid: method.toUpperCase() === 'CREDIT' ? 0 : paid,
                        change_amount: Math.max(0, paid - grandTotal),
                        customer_name: effectiveCustomer,
                        cashier_name: cashierName,
                        mpesa_receipt: receipt || null,
                        shift_instance_id: currentShiftId || null,
                        checkout_request_id: cId || null,
                        customer_phone: effectivePhone,
                        status: 'Completed',
                        outlet_id: outletId,
                        notes: doctorNameInput ? `Prescribed by Dr. ${doctorNameInput}` : null,
                    },
                ])
                .select()
                .single();

            if (saleError) throw saleError;

            // Insert sale items
            const saleItems = cart.map((item) => ({
                sale_id: sale.sale_id,
                product_id: item.id,
                product_name: item.name,
                batch_id: item.batchId || null,
                batch_number: item.batchNumber || null,
                expiry_date: item.expiryDate || null,
                quantity: item.qty,
                unit_price: item.effectivePrice,
                discount: item.discount,
                total: item.effectivePrice * item.qty - item.discount,
                purchase_price: item.costPrice,
                notes: item.prescriptionNote || null,
            }));

            const { error: itemsError } = await supabase.from('pharmacy_sales_items').insert(saleItems);
            if (itemsError) console.error('Sale items warning:', itemsError);

            // Deduct stock from batches & general stock
            for (const item of cart) {
                try {
                    if (item.batchId) {
                        const { data: batchRow } = await supabase
                            .from('pharmacy_batches')
                            .select('remaining_qty')
                            .eq('batch_id', item.batchId)
                            .single();
                        if (batchRow) {
                            await supabase
                                .from('pharmacy_batches')
                                .update({ remaining_qty: Math.max(0, (batchRow.remaining_qty || 0) - item.qty) })
                                .eq('batch_id', item.batchId);
                        }
                    }
                    const { data: stockRow } = await supabase
                        .from('pharmacy_stock')
                        .select('st_id, qty')
                        .eq('pid', item.id)
                        .eq('outlet_id', outletId)
                        .limit(1)
                        .single();
                    if (stockRow) {
                        await supabase
                            .from('pharmacy_stock')
                            .update({ qty: Math.max(0, (stockRow.qty || 0) - item.qty) })
                            .eq('st_id', stockRow.st_id);
                    }
                } catch (stockErr) {
                    console.warn('Stock deduction notice:', item.name, stockErr);
                }
            }

            // Update credit balance if credit sale
            if (method.toUpperCase() === 'CREDIT' && selectedCustomer) {
                const newBalance = (selectedCustomer.current_balance || 0) + grandTotal;
                await supabase
                    .from('pharmacy_credit_customers')
                    .update({ current_balance: newBalance })
                    .eq('customer_id', selectedCustomer.customer_id);
            }

            // Print Thermal Receipt
            try {
                const company = await loadCompanyInfo();
                const receiptData = createReceiptData(
                    freshReceiptNo,
                    cart.map((c) => ({
                        name: c.name,
                        qty: c.qty,
                        price: c.effectivePrice,
                        discount: c.discount,
                        notes: c.prescriptionNote || undefined,
                        batchNumber: c.batchNumber || undefined,
                        expiryDate: c.expiryDate || undefined,
                    })),
                    method,
                    paid,
                    cashierName,
                    {
                        customerName: effectiveCustomer || undefined,
                        customerPhone: effectivePhone || undefined,
                        mpesaReceipt: receipt,
                        discount: totalDiscount,
                        tax: 0,
                        isPaid: true,
                    }
                );
                printCustomerReceipt(receiptData, company);
            } catch (printErr) {
                console.error('Receipt print error:', printErr);
            }

            playSound('success');
            toast.success(`✅ Sale ${freshReceiptNo} completed!`);

            setCart([]);
            setShowPayment(false);
            setSelectedCustomer(null);
            setCustomerSearch('');
            resetStk();
            setPayMethod('cash');
            setAmountPaid('');
            setMpesaPhone('');
            setMpesaReceipt('');
            setPayCustomerName('');
            setDoctorNameInput('');
            setCreditSearchPay('');

            const rn = await getNextReceiptNumber(outletId);
            setReceiptNo(rn);
            loadData();
            loadCreditCustomers();
        } catch (err: any) {
            console.error('Sale error:', err);
            playSound('warning');
            toast.error(`Sale failed: ${err?.message || 'Check database connection'}`);
        }
    };

    // M-Pesa STK Push
    const handleSTK = async () => {
        if (!validPhone(mpesaPhone)) {
            toast.error('Enter valid phone (e.g. 0712345678)');
            return;
        }
        setStkStatus('sending');
        setStkMsg('Initiating STK Push...');
        try {
            const phone = fmtPhone(mpesaPhone);
            const res = await fetch(`${MPESA_API_URL}/stkpush`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    apikey: MPESA_KEY,
                    Authorization: `Bearer ${MPESA_KEY}`,
                },
                body: JSON.stringify({
                    phone,
                    amount: Math.ceil(grandTotal),
                    accountReference: receiptNo,
                    transactionDesc: `Pharmacy - ${receiptNo}`,
                }),
            });
            const data = await res.json();
            if (data.success && (data.checkout_request_id || data.CheckoutRequestID)) {
                const reqId = data.checkout_request_id || data.CheckoutRequestID;
                setCheckoutId(reqId);
                setStkStatus('waiting');
                setStkMsg('Check phone to enter M-Pesa PIN...');
                let attempts = 0;
                pollRef.current = setInterval(async () => {
                    attempts++;
                    try {
                        const r = await fetch(`${MPESA_API_URL}/check-status?checkout_request_id=${reqId}`, {
                            headers: { apikey: MPESA_KEY, Authorization: `Bearer ${MPESA_KEY}` },
                        });
                        const d = await r.json();
                        if (d.resultCode === 0) {
                            if (pollRef.current) clearInterval(pollRef.current);
                            const rc = d.mpesaReceiptNumber || `MPESA-${Date.now().toString(36).toUpperCase()}`;
                            setStkStatus('success');
                            setStkMsg(`Paid! Ref: ${rc}`);
                            setMpesaReceipt(rc);
                            setTimeout(() => {
                                if (!doneRef.current) {
                                    doneRef.current = true;
                                    completeSale('MPESA', grandTotal, rc, payCustomerName, reqId, mpesaPhone);
                                }
                            }, 1000);
                        } else if (d.resultCode && d.resultCode !== 0 && d.status !== 'pending') {
                            if (pollRef.current) clearInterval(pollRef.current);
                            setStkStatus('failed');
                            setStkMsg('PIN cancelled or payment failed');
                        } else if (attempts >= 24) {
                            if (pollRef.current) clearInterval(pollRef.current);
                            setStkStatus('failed');
                            setStkMsg('STK push timed out. Enter receipt code below.');
                        }
                    } catch { /* silent */ }
                }, 4000);
            } else {
                setStkStatus('failed');
                setStkMsg(data.error || 'STK Push failed. Enter code manually below.');
            }
        } catch (err: any) {
            setStkStatus('failed');
            setStkMsg(err.message || 'M-Pesa service unreachable. Enter receipt manually.');
        }
    };

    const change = payMethod === 'cash' ? Math.max(0, Number(amountPaid) - grandTotal) : 0;
    const displayProducts = searchQuery ? filteredProducts : selectedCategory ? categoryProducts : products;

    if (loading) {
        return (
            <div className="flex items-center justify-center flex-1 h-full text-gray-500 bg-gray-50">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
                    <span className="font-semibold text-gray-700">Loading Alpha Pharmacy POS...</span>
                    <span className="text-xs text-gray-400">Restoring medicines, stock & batch registers</span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 h-full flex flex-col bg-gray-50 select-none overflow-hidden">
            {/* ==================== 1. TOP STATUS BAR ==================== */}
            <div className="px-4 py-2 flex items-center justify-between shrink-0" style={{background:"linear-gradient(90deg,#00471F 0%,#007C35 50%,#00A848 100%)",borderRadius:"0 0 16px 16px",boxShadow:"0 4px 16px rgba(0,168,72,0.20)"}}>
                <div className="flex items-center gap-3">
                    <span className="text-white font-extrabold text-sm flex items-center gap-1.5">
                        <span className="text-lg">💊</span> ALPHA PHARMACY POS
                    </span>
                    <span className="text-emerald-300 opacity-50">|</span>
                    <span className="text-white text-xs font-semibold bg-white/15 px-2 py-0.5 rounded-md">
                        📍 {storeName}
                    </span>
                    <span className="text-emerald-300 opacity-50">|</span>
                    {/* Shift & Register Status Indicator */}
                    <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm ${
                            registerOpen
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                                : 'bg-red-50 text-red-600 border border-red-300 animate-pulse'
                        }`}
                    >
                        <span className={`w-2 h-2 rounded-full ${registerOpen ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        {registerOpen ? `Shift #${currentShiftId || 1} Open` : 'Register Closed'}
                    </span>
                </div>

                <div className="flex items-center gap-2.5">
                    {/* Held Carts Button */}
                    {heldSales.length > 0 && (
                        <button
                            onClick={() => setShowHeldModal(true)}
                            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                            title="View parked sales [F4]"
                        >
                            <span>⏸️</span>
                            <span>Held Sales</span>
                            <span className="w-4 h-4 rounded-full bg-amber-600 text-white text-[10px] flex items-center justify-center">
                                {heldSales.length}
                            </span>
                        </button>
                    )}

                    {/* Sound Toggle */}
                    <button
                        onClick={toggleSound}
                        className={`p-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            isMuted
                                ? 'bg-gray-100 text-gray-400 border-gray-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                        title={isMuted ? 'Unmute scanner beep' : 'Mute scanner beep'}
                    >
                        {isMuted ? '🔇 Muted' : '🔊 Sound'}
                    </button>

                    {/* Shortcuts Cheatsheet */}
                    <button
                        onClick={() => setShowShortcutsModal(true)}
                        className="p-1.5 px-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium border border-gray-200 flex items-center gap-1"
                        title="Keyboard Shortcuts"
                    >
                        <span>⌨️</span> <span className="hidden sm:inline">Shortcuts</span>
                    </button>

                    {/* Live Clock */}
                    <span className="text-xs font-mono font-bold text-white bg-white/15 border border-white/20 px-2 py-1 rounded-md hidden md:inline">
                        🕒 {currentTime}
                    </span>

                    {/* Receipt Badge */}
                    <span className="px-3 py-1 bg-white/20 text-white border border-white/30 rounded-lg text-xs font-bold font-mono">
                        {receiptNo}
                    </span>

                    {/* Fullscreen Button */}
                    <button
                        onClick={toggleFullscreen}
                        className="p-1.5 bg-gray-700 hover:bg-gray-800 text-white rounded-lg transition-all active:scale-95 shadow-sm"
                        title="Toggle Fullscreen"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* ==================== 2. CONTROLS HEADER ==================== */}
            <div className="bg-white border-b border-gray-200 px-4 py-2.5 shrink-0">
                <div className="flex items-center justify-between gap-3">
                    {/* Outlets & Counter */}
                    <div className="flex items-center gap-2">
                        <div>
                            <select
                                value={activeOutlet?.outlet_id || ''}
                                onChange={(e) => switchOutlet(Number(e.target.value))}
                                className="px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-800 text-xs font-semibold focus:outline-none focus:border-emerald-500 cursor-pointer min-w-[150px]"
                            >
                                {outlets.map((o) => (
                                    <option key={o.outlet_id} value={o.outlet_id}>
                                        {o.is_main ? '⭐' : '📍'} {o.outlet_name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Central High-Performance Search & Barcode Scan Bar */}
                    <div className="flex-1 max-w-2xl relative">
                        <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                                🔍
                            </span>
                            <input
                                ref={searchRef}
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={handleSearchKeyDown}
                                placeholder="Scan Barcode [Enter] or Search by Drug, Generic Name, SKU (Press / or F1)..."
                                className="w-full pl-9 pr-16 py-2 bg-gray-50 hover:bg-white focus:bg-white border border-gray-200 focus:border-emerald-500 rounded-lg text-sm font-medium transition-all outline-none shadow-inner"
                                autoFocus
                            />
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                {searchQuery && (
                                    <button
                                        onClick={() => {
                                            setSearchQuery('');
                                            searchRef.current?.focus();
                                        }}
                                        className="text-gray-400 hover:text-gray-600 text-xs font-bold px-1.5 py-0.5 rounded"
                                    >
                                        ✕
                                    </button>
                                )}
                                <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-mono font-bold hidden sm:inline">
                                    F1
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Category Dropdown */}
                    <div className="flex items-center gap-2">
                        <select
                            value={selectedCategory || ''}
                            onChange={(e) => {
                                const id = Number(e.target.value);
                                if (id) {
                                    const cat = categories.find((c) => c.category_id === id);
                                    if (cat) loadCatProducts(id, cat.category_name);
                                } else {
                                    setSelectedCategory(null);
                                    setCategoryProducts([]);
                                }
                            }}
                            className="px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 text-xs font-medium focus:outline-none focus:border-emerald-500 cursor-pointer min-w-[130px]"
                        >
                            <option value="">All Categories ({categories.length})</option>
                            {categories.map((c) => (
                                <option key={c.category_id} value={c.category_id}>
                                    {c.icon} {c.category_name}
                                </option>
                            ))}
                        </select>

                        {/* Customer Search / Selection */}
                        <div className="relative">
                            <div className="relative">
                                <input
                                    value={customerSearch}
                                    onChange={(e) => {
                                        setCustomerSearch(e.target.value);
                                        setShowCustomerDrop(true);
                                        if (!e.target.value) setSelectedCustomer(null);
                                    }}
                                    onFocus={() => setShowCustomerDrop(true)}
                                    onBlur={() => setTimeout(() => setShowCustomerDrop(false), 200)}
                                    placeholder={selectedCustomer ? selectedCustomer.customer_name : '👤 Walk-in Patient'}
                                    className={`px-3 py-2 border rounded-lg text-xs font-medium focus:outline-none focus:border-emerald-500 cursor-text min-w-[170px] ${
                                        selectedCustomer
                                            ? 'border-blue-400 bg-blue-50 font-bold text-blue-900'
                                            : 'border-gray-200 bg-gray-50 text-gray-700'
                                    }`}
                                />
                                {selectedCustomer && (
                                    <button
                                        onClick={() => {
                                            setSelectedCustomer(null);
                                            setCustomerSearch('');
                                        }}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 text-xs font-bold"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>

                            {showCustomerDrop && customerSearch && (
                                <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-52 w-64 overflow-y-auto">
                                    {creditCustomers
                                        .filter((c) => c.customer_name?.toLowerCase().includes(customerSearch.toLowerCase()))
                                        .slice(0, 8)
                                        .map((c) => (
                                            <button
                                                key={c.customer_id}
                                                onMouseDown={() => {
                                                    setSelectedCustomer(c);
                                                    setCustomerSearch(c.customer_name);
                                                    setShowCustomerDrop(false);
                                                }}
                                                className="w-full text-left px-3 py-2 hover:bg-emerald-50 transition-colors border-b border-gray-50 last:border-0"
                                            >
                                                <p className="font-semibold text-gray-800 text-xs">{c.customer_name}</p>
                                                <p className="text-[10px] text-gray-500">
                                                    {c.phone || 'No phone'} • Debt: Ksh {(c.current_balance || 0).toLocaleString()}
                                                </p>
                                            </button>
                                        ))}
                                </div>
                            )}
                        </div>

                        {/* Open / Close Register Button */}
                        {!registerOpen ? (
                            <button
                                onClick={() => setShowOpeningDrop(true)}
                                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
                            >
                                <span>🟢</span> Open Register
                            </button>
                        ) : (
                            <button
                                onClick={handleCloseRegister}
                                className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
                            >
                                <span>🔴</span> Close Register
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ==================== 3. MAIN WORKSPACE ==================== */}
            <div className="flex-1 flex overflow-hidden">
                {/* Product Catalog Grid */}
                <div className="flex-1 flex flex-col p-3 overflow-hidden">
                    {/* Register Closed Banner */}
                    {!registerOpen && (
                        <div className="mb-3 p-3.5 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-xl flex items-center justify-between shrink-0 shadow-sm">
                            <div className="flex items-center gap-3">
                                <span className="text-3xl">⚠️</span>
                                <div>
                                    <p className="font-bold text-amber-900 text-sm">Register is currently closed</p>
                                    <p className="text-xs text-amber-700">Open register to start dispensing and track daily cashier shifts</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowOpeningDrop(true)}
                                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-md transition-all active:scale-95"
                            >
                                🟢 Open Register Drawer
                            </button>
                        </div>
                    )}

                    {/* Catalog Grid View */}
                    <div className="flex-1 overflow-y-auto pr-1">
                        {displayProducts.length > 0 ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 pb-4">
                                {displayProducts.map((p) => (
                                    <ProductCard
                                        key={p.id}
                                        product={p}
                                        onAdd={() => openBatchSelect(p, false)}
                                        onOpenBatches={() => openBatchSelect(p, true)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-16">
                                <span className="text-5xl mb-3">{searchQuery ? '🔍' : '💊'}</span>
                                <p className="text-base font-semibold text-gray-700">
                                    {searchQuery ? `No medicines found matching "${searchQuery}"` : 'No products available'}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                    {searchQuery ? 'Try generic drug name, brand, or barcode' : 'Add products in Products/Drugs'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* ==================== 4. CART SIDEBAR ==================== */}
                <div className="w-[410px] bg-white flex flex-col shrink-0" style={{borderRadius:"16px 0 0 16px",boxShadow:"-4px 0 24px rgba(0,0,0,0.10)",overflow:"hidden",margin:"8px 0 8px 0"}}>
                    {/* Cart Header */}
                    <div className="px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white flex items-center justify-between shrink-0" style={{borderRadius:"16px 0 0 0",boxShadow:"0 4px 12px rgba(0,168,72,0.25)"}}>
                        <div className="flex items-center gap-2">
                            <span className="text-lg">🛒</span>
                            <h2 className="font-extrabold text-sm tracking-wide">
                                DISPENSING CART ({cart.length})
                            </h2>
                        </div>
                        <div className="flex items-center gap-1.5">
                            {cart.length > 0 && (
                                <>
                                    <button
                                        onClick={handleHoldSale}
                                        className="text-xs bg-white/20 hover:bg-white/30 text-white font-semibold px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
                                        title="Park sale for next patient [F4]"
                                    >
                                        <span>⏸️</span> Hold
                                    </button>
                                    <button
                                        onClick={clearCart}
                                        className="text-xs bg-red-500/80 hover:bg-red-600 text-white font-semibold px-2.5 py-1 rounded-lg transition-colors"
                                        title="Clear cart"
                                    >
                                        Clear
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Customer indicator in cart */}
                    {selectedCustomer && (
                        <div className="px-3.5 py-1.5 bg-blue-50 border-b border-blue-100 flex items-center justify-between text-xs text-blue-900 shrink-0">
                            <span className="font-bold flex items-center gap-1">
                                <span>👤</span> {selectedCustomer.customer_name}
                            </span>
                            <span className="text-[10px] text-blue-700">
                                Bal: Ksh {(selectedCustomer.current_balance || 0).toLocaleString()}
                            </span>
                        </div>
                    )}

                    {/* Cart Item List */}
                    <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
                        {cart.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400 py-12">
                                <span className="text-4xl mb-2">🧾</span>
                                <p className="font-semibold text-gray-600 text-sm">Cart is empty</p>
                                <p className="text-xs text-gray-400 text-center max-w-[200px] mt-1">
                                    Scan barcode or click on medicine to add to prescription
                                </p>
                            </div>
                        ) : (
                            cart.map((item, idx) => (
                                <CartItemRow
                                    key={`${item.id}-${item.batchId}-${idx}`}
                                    item={item}
                                    onIncrease={() => increaseQty(idx)}
                                    onDecrease={() => decreaseQty(idx)}
                                    onRemove={() => removeFromCart(idx)}
                                    onEditDiscount={() => {
                                        setDiscountItem(item);
                                        setDiscountAmt(item.discount > 0 ? item.discount.toString() : '');
                                        setShowDiscountModal(true);
                                    }}
                                    onEditRx={() => {
                                        setRxItem(item);
                                        setRxNote(item.prescriptionNote || '');
                                        setShowRxModal(true);
                                    }}
                                    canDiscount={canDiscount}
                                />
                            ))
                        )}
                    </div>

                    {/* Cart Summary */}
                    <div className="border-t border-gray-200 p-3 bg-gray-50 space-y-1.5 shrink-0">
                        <div className="flex justify-between text-xs text-gray-600 font-medium">
                            <span>Subtotal ({cart.reduce((s, c) => s + c.qty, 0)} items)</span>
                            <span>Ksh {subtotal.toLocaleString()}</span>
                        </div>
                        {totalDiscount > 0 && (
                            <div className="flex justify-between text-xs text-emerald-600 font-semibold">
                                <span>Total Discount</span>
                                <span>- Ksh {totalDiscount.toLocaleString()}</span>
                            </div>
                        )}
                        <div className="flex justify-between items-baseline pt-2 border-t border-gray-200">
                            <span className="text-xs font-bold text-gray-700 tracking-wider uppercase">PAYABLE TOTAL</span>
                            <span className="text-2xl font-black text-gray-900">
                                Ksh {grandTotal.toLocaleString()}
                            </span>
                        </div>
                    </div>

                    {/* Checkout Button */}
                    <div className="p-3 border-t border-gray-200 bg-white shrink-0">
                        <button
                            onClick={() => {
                                if (!registerOpen) {
                                    playSound('warning');
                                    toast.error('Open register first!');
                                    return;
                                }
                                setShowPayment(true);
                            }}
                            disabled={cart.length === 0}
                            className="w-full py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl font-extrabold text-base hover:from-green-600 hover:to-emerald-700 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.99] shadow-lg"
                        >
                            <span>💳</span>
                            <span>CHECKOUT Ksh {grandTotal.toLocaleString()}</span>
                            <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded font-mono font-normal">F9</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* ==================== 5. MODALS ==================== */}

            {/* 1. Batch Selection Modal (FEFO) */}
            {showBatchModal && batchProduct && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-5 border border-gray-100">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                            <div>
                                <h3 className="text-base font-bold text-gray-800 flex items-center gap-1.5">
                                    <span>📦</span> Select Batch (FEFO - Earliest Expiry First)
                                </h3>
                                <p className="text-xs text-gray-500 mt-0.5">{batchProduct.name}</p>
                            </div>
                            <button
                                onClick={() => setShowBatchModal(false)}
                                className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-500 flex items-center justify-center font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-2 mt-3 max-h-80 overflow-y-auto">
                            {batchList.map((b) => {
                                const isExpired = b.days_until_expiry < 0;
                                return (
                                    <button
                                        key={b.batch_id}
                                        disabled={isExpired}
                                        onClick={() => addToCart(batchProduct, b)}
                                        className={`w-full p-3.5 border-2 rounded-xl text-left transition-all flex items-center justify-between ${
                                            isExpired
                                                ? 'bg-red-50/60 border-red-200 opacity-60 cursor-not-allowed'
                                                : 'border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/40 active:scale-[0.99]'
                                        }`}
                                    >
                                        <div>
                                            <p className="font-mono font-bold text-gray-800 text-sm">
                                                Batch: {b.batch_number}
                                            </p>
                                            <p className="text-xs text-gray-600 mt-0.5">
                                                Exp: {b.expiry_date} • Available: <span className="font-bold">{b.remaining_qty}</span> units
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${getExpiryColor(b.days_until_expiry)}`}>
                                                {isExpired ? 'EXPIRED' : `${b.days_until_expiry} days left`}
                                            </span>
                                            <p className="text-sm font-extrabold text-gray-900 mt-1">
                                                Ksh {b.selling_price.toLocaleString()}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            onClick={() => setShowBatchModal(false)}
                            className="w-full mt-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 text-sm transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* 2. Payment Modal */}
            {showPayment && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto border border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-extrabold text-gray-800 flex items-center gap-2">
                                <span>💳</span> Complete Dispensing & Payment
                            </h2>
                            <div className="text-right">
                                <p className="text-[10px] text-gray-400 uppercase font-bold">Receipt</p>
                                <p className="font-bold text-xs text-blue-700 font-mono">{receiptNo}</p>
                            </div>
                        </div>

                        {/* Grand Total Hero Box */}
                        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-4 text-white mb-4 shadow-md">
                            <p className="text-xs font-semibold opacity-90 uppercase tracking-wider">Total Payable</p>
                            <p className="text-3xl font-black mt-0.5">Ksh {grandTotal.toLocaleString()}</p>
                            {cart.some((c) => c.requires_prescription) && (
                                <p className="text-[11px] bg-white/20 rounded px-2 py-0.5 mt-2 inline-block font-semibold">
                                    ℞ Contains Prescription Medicines
                                </p>
                            )}
                        </div>

                        {/* Payment Method Selector */}
                        <div className="grid grid-cols-4 gap-2 mb-4">
                            {[
                                { id: 'cash', icon: '💵', label: 'Cash (F2)' },
                                { id: 'mpesa', icon: '📱', label: 'M-Pesa (F3)' },
                                { id: 'card', icon: '💳', label: 'Card' },
                                { id: 'credit', icon: '📋', label: 'Credit' },
                            ].map((m) => (
                                <button
                                    key={m.id}
                                    onClick={() => {
                                        setPayMethod(m.id);
                                        resetStk();
                                    }}
                                    className={`p-2.5 rounded-xl border-2 transition-all flex flex-col items-center justify-center ${
                                        payMethod === m.id
                                            ? 'border-emerald-500 bg-emerald-50/80 text-emerald-800 shadow-sm'
                                            : 'border-gray-200 hover:border-gray-300 bg-gray-50 text-gray-600'
                                    }`}
                                >
                                    <span className="text-xl">{m.icon}</span>
                                    <span className="text-[11px] font-bold mt-1">{m.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* Cash Payment Mode */}
                        {payMethod === 'cash' && (
                            <div className="space-y-3 mb-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-700 mb-1 block">Cash Tendered by Patient</label>
                                    <input
                                        type="number"
                                        value={amountPaid}
                                        onChange={(e) => setAmountPaid(e.target.value)}
                                        placeholder="Enter amount given..."
                                        className="w-full p-3 bg-gray-50 border-2 border-gray-200 focus:border-emerald-500 rounded-xl text-lg font-bold outline-none"
                                        autoFocus
                                    />
                                </div>

                                {/* Quick Tender Buttons */}
                                <div className="grid grid-cols-6 gap-1.5">
                                    {[100, 200, 500, 1000, 2000, 5000].map((amt) => (
                                        <button
                                            key={amt}
                                            onClick={() => setAmountPaid(amt.toString())}
                                            className="py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-bold text-xs transition-colors"
                                        >
                                            {amt}
                                        </button>
                                    ))}
                                </div>

                                <button
                                    onClick={() => setAmountPaid(grandTotal.toString())}
                                    className="w-full py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-emerald-800 font-bold text-xs transition-colors"
                                >
                                    Exact Amount (Ksh {grandTotal.toLocaleString()})
                                </button>

                                {/* Live Change Calculator */}
                                <div
                                    className={`flex items-center justify-between p-3 rounded-xl border ${
                                        Number(amountPaid) >= grandTotal
                                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                            : 'bg-amber-50 border-amber-200 text-amber-900'
                                    }`}
                                >
                                    <span className="font-semibold text-xs">
                                        {Number(amountPaid) >= grandTotal ? 'Change to Return:' : 'Remaining Balance:'}
                                    </span>
                                    <span className="text-xl font-black">
                                        Ksh{' '}
                                        {Number(amountPaid) >= grandTotal
                                            ? change.toLocaleString()
                                            : (grandTotal - (Number(amountPaid) || 0)).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* M-Pesa STK Push Mode */}
                        {payMethod === 'mpesa' && (
                            <div className="space-y-3 mb-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-700 mb-1 block">Patient Phone (Safaricom M-Pesa)</label>
                                    <input
                                        type="tel"
                                        value={mpesaPhone}
                                        onChange={(e) => setMpesaPhone(e.target.value)}
                                        placeholder="07XX XXX XXX or 01XX XXX XXX"
                                        className="w-full p-3 bg-gray-50 border-2 border-gray-200 focus:border-emerald-500 rounded-xl text-base font-semibold outline-none"
                                        disabled={stkStatus === 'sending' || stkStatus === 'waiting'}
                                        autoFocus
                                    />
                                </div>

                                {stkStatus !== 'idle' && (
                                    <div
                                        className={`p-3 rounded-xl flex items-center gap-2.5 text-xs font-semibold ${
                                            stkStatus === 'sending'
                                                ? 'bg-amber-50 border border-amber-300 text-amber-800'
                                                : stkStatus === 'waiting'
                                                ? 'bg-blue-50 border border-blue-300 text-blue-800'
                                                : stkStatus === 'success'
                                                ? 'bg-emerald-50 border border-emerald-300 text-emerald-800'
                                                : 'bg-red-50 border border-red-300 text-red-800'
                                        }`}
                                    >
                                        {(stkStatus === 'sending' || stkStatus === 'waiting') && (
                                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                        )}
                                        <span>{stkMsg}</span>
                                    </div>
                                )}

                                {(stkStatus === 'idle' || stkStatus === 'failed') && (
                                    <button
                                        onClick={handleSTK}
                                        className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-bold text-sm transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <span>📱</span> Send M-Pesa STK Push
                                    </button>
                                )}

                                <div className="pt-2 border-t border-gray-200">
                                    <p className="text-[10px] text-gray-400 text-center mb-1 font-medium">
                                        - OR enter M-Pesa receipt code if already paid -
                                    </p>
                                    <input
                                        type="text"
                                        value={mpesaReceipt}
                                        onChange={(e) => setMpesaReceipt(e.target.value.toUpperCase())}
                                        placeholder="e.g. RLJ57XYZ99"
                                        className="w-full p-2.5 bg-gray-50 border-2 border-gray-200 focus:border-emerald-500 rounded-xl text-xs font-mono font-bold uppercase outline-none"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Card Mode */}
                        {payMethod === 'card' && (
                            <div className="space-y-3 mb-4">
                                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 font-medium">
                                    Swipe or tap card on POS terminal, then enter authorization reference below.
                                </div>
                                <input
                                    type="text"
                                    value={mpesaReceipt}
                                    onChange={(e) => setMpesaReceipt(e.target.value.toUpperCase())}
                                    placeholder="Card Approval Reference / Auth Code"
                                    className="w-full p-3 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 rounded-xl text-xs font-mono font-bold outline-none"
                                />
                            </div>
                        )}

                        {/* Credit Mode */}
                        {payMethod === 'credit' && (
                            <div className="space-y-3 mb-4">
                                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 font-medium">
                                    Select an authorized credit patient account.
                                </div>
                                <input
                                    type="text"
                                    value={creditSearchPay}
                                    onChange={(e) => setCreditSearchPay(e.target.value)}
                                    placeholder="Search patient name or phone..."
                                    className="w-full p-2.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-xs outline-none focus:border-amber-500"
                                />
                                <div className="max-h-36 overflow-y-auto rounded-xl border border-gray-200 bg-white">
                                    {creditCustomers
                                        .filter(
                                            (c) =>
                                                !creditSearchPay ||
                                                c.customer_name?.toLowerCase().includes(creditSearchPay.toLowerCase()) ||
                                                c.phone?.includes(creditSearchPay)
                                        )
                                        .map((c) => (
                                            <button
                                                key={c.customer_id}
                                                onClick={() => {
                                                    setSelectedCustomer(c);
                                                    setPayCustomerName(c.customer_name);
                                                    setCreditSearchPay('');
                                                }}
                                                className={`w-full text-left px-3 py-2 border-b border-gray-100 last:border-0 text-xs transition-colors flex items-center justify-between ${
                                                    selectedCustomer?.customer_id === c.customer_id
                                                        ? 'bg-amber-50 font-bold border-l-4 border-l-amber-500'
                                                        : 'hover:bg-gray-50'
                                                }`}
                                            >
                                                <div>
                                                    <p className="font-semibold text-gray-800">{c.customer_name}</p>
                                                    <p className="text-[10px] text-gray-500">{c.phone}</p>
                                                </div>
                                                <span className="font-bold text-red-600">
                                                    Ksh {(c.current_balance || 0).toLocaleString()}
                                                </span>
                                            </button>
                                        ))}
                                </div>
                            </div>
                        )}

                        {/* Optional Doctor / Prescriber Input */}
                        <div className="pt-2 border-t border-gray-100 mb-4">
                            <label className="text-[11px] font-bold text-gray-600 mb-1 block">
                                🩺 Doctor / Prescriber Name (Optional)
                            </label>
                            <input
                                type="text"
                                value={doctorNameInput}
                                onChange={(e) => setDoctorNameInput(e.target.value)}
                                placeholder="e.g. Dr. Kamau (for prescription audit log)"
                                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:border-emerald-500"
                            />
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2.5">
                            <button
                                onClick={() => {
                                    setShowPayment(false);
                                    resetStk();
                                }}
                                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-50 transition-colors"
                            >
                                Cancel [Esc]
                            </button>

                            <button
                                onClick={() => {
                                    if (payMethod === 'credit' && !selectedCustomer) {
                                        toast.error('Select an authorized credit patient');
                                        return;
                                    }
                                    if (payMethod === 'cash' && Number(amountPaid) < grandTotal) {
                                        toast.error('Cash given is less than total payable');
                                        return;
                                    }
                                    if (payMethod === 'mpesa' && !mpesaReceipt && stkStatus !== 'success') {
                                        toast.error('Complete M-Pesa or enter receipt number');
                                        return;
                                    }
                                    completeSale(
                                        payMethod.toUpperCase(),
                                        payMethod === 'cash' ? Number(amountPaid) : grandTotal,
                                        mpesaReceipt,
                                        selectedCustomer?.customer_name || payCustomerName,
                                        checkoutId,
                                        selectedCustomer?.phone || mpesaPhone
                                    );
                                }}
                                disabled={
                                    (payMethod === 'mpesa' && !mpesaReceipt && stkStatus !== 'success') ||
                                    (payMethod === 'credit' && !selectedCustomer)
                                }
                                className={`flex-1 py-3 rounded-xl font-extrabold text-sm transition-all shadow-md flex items-center justify-center gap-1.5 ${
                                    (payMethod === 'mpesa' && !mpesaReceipt && stkStatus !== 'success') ||
                                    (payMethod === 'credit' && !selectedCustomer)
                                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 active:scale-95'
                                }`}
                            >
                                <span>✅</span>
                                <span>Complete & Print Receipt</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 3. Held Sales Modal */}
            {showHeldModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-5 border border-gray-100">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                            <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                                <span>⏸️</span> Parked / Held Sales ({heldSales.length})
                            </h3>
                            <button
                                onClick={() => setShowHeldModal(false)}
                                className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-500 flex items-center justify-center font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-2 mt-3 max-h-80 overflow-y-auto">
                            {heldSales.length === 0 ? (
                                <p className="text-center text-gray-400 py-8 text-sm">No sales currently parked</p>
                            ) : (
                                heldSales.map((h) => (
                                    <div
                                        key={h.id}
                                        className="p-3 border rounded-xl hover:border-emerald-300 bg-gray-50 flex items-center justify-between gap-3"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-gray-800 text-xs truncate">{h.customerName}</p>
                                            <p className="text-[10px] text-gray-500">
                                                Parked at {h.heldAt} • {h.items.length} items
                                            </p>
                                            <p className="font-bold text-emerald-700 text-sm mt-0.5">
                                                Ksh {h.grandTotal.toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <button
                                                onClick={() => resumeHeldSale(h)}
                                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm"
                                            >
                                                Resume
                                            </button>
                                            <button
                                                onClick={() => deleteHeldSale(h.id)}
                                                className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs"
                                                title="Discard"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <button
                            onClick={() => setShowHeldModal(false)}
                            className="w-full mt-4 py-2 border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 text-xs"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

            {/* 4. Discount Modal */}
            {showDiscountModal && discountItem && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl">
                        <h2 className="text-base font-bold text-gray-800 mb-2">Item Discount (KES)</h2>
                        <p className="text-xs text-gray-600 mb-3">
                            {discountItem.name} @ Ksh {discountItem.effectivePrice.toLocaleString()} x {discountItem.qty}
                        </p>
                        <input
                            type="number"
                            value={discountAmt}
                            onChange={(e) => setDiscountAmt(e.target.value)}
                            placeholder="Enter discount in KES..."
                            className="w-full p-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-base font-bold focus:border-emerald-500 outline-none mb-3"
                            autoFocus
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    setShowDiscountModal(false);
                                    setDiscountItem(null);
                                }}
                                className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-xs hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    const d = Number(discountAmt) || 0;
                                    if (discountItem) {
                                        setCart((prev) =>
                                            prev.map((c) =>
                                                c.id === discountItem.id && c.batchId === discountItem.batchId
                                                    ? { ...c, discount: d }
                                                    : c
                                            )
                                        );
                                    }
                                    setShowDiscountModal(false);
                                    setDiscountItem(null);
                                    toast.success('Discount applied');
                                }}
                                className="flex-1 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold text-xs"
                            >
                                Apply Discount
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 5. Prescription Note Modal */}
            {showRxModal && rxItem && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl">
                        <h2 className="text-base font-bold text-gray-800 mb-1 flex items-center gap-1.5">
                            <span>℞</span> Prescription Dosage Instructions
                        </h2>
                        <p className="text-xs text-gray-500 mb-3">
                            {rxItem.name} — Prints on thermal receipt below medicine name
                        </p>
                        <textarea
                            value={rxNote}
                            onChange={(e) => setRxNote(e.target.value)}
                            placeholder="e.g. 1 tab 3 times daily after meals for 5 days..."
                            rows={3}
                            className="w-full p-2.5 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-emerald-500 outline-none mb-3 text-xs resize-none"
                            autoFocus
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    setShowRxModal(false);
                                    setRxItem(null);
                                }}
                                className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-xs hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    if (rxItem) {
                                        setCart((prev) =>
                                            prev.map((c) =>
                                                c.id === rxItem.id && c.batchId === rxItem.batchId
                                                    ? { ...c, prescriptionNote: rxNote }
                                                    : c
                                            )
                                        );
                                    }
                                    setShowRxModal(false);
                                    setRxItem(null);
                                    toast.success('Prescription note saved');
                                }}
                                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-xs hover:bg-blue-700"
                            >
                                Save Note
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 6. Open Register Modal */}
            {showOpeningDrop && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-[420px] max-w-[95vw]">
                        <h3 className="text-lg font-bold text-gray-800 mb-1 flex items-center gap-2">
                            <span>🟢</span> Open Register Drawer
                        </h3>
                        <p className="text-xs text-gray-500 mb-4">Count cash float and enter starting balance.</p>

                        <input
                            type="number"
                            value={openingAmount}
                            onChange={(e) => setOpeningAmount(e.target.value)}
                            placeholder="e.g. 5000"
                            className="w-full p-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-emerald-500 outline-none text-xl font-black text-center mb-3"
                            autoFocus
                        />

                        <div className="grid grid-cols-4 gap-1.5 mb-3">
                            {[0, 1000, 2000, 5000].map((a) => (
                                <button
                                    key={a}
                                    onClick={() => setOpeningAmount(a.toString())}
                                    className="py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-bold text-gray-700"
                                >
                                    {a === 0 ? 'Zero' : `${a.toLocaleString()}`}
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    setShowOpeningDrop(false);
                                    setOpeningAmount('');
                                }}
                                className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-xs hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleOpenRegister}
                                className="flex-1 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold text-xs shadow-md"
                            >
                                Confirm & Open
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 7. Close Register Modal */}
            {showCloseReg && closeData && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-5 w-[460px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
                        <h3 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
                            <span>🔴</span> Close Register — End of Day Shift Report
                        </h3>

                        <div className="space-y-1.5 mb-3">
                            <div className="flex justify-between items-center p-2.5 bg-gray-50 rounded-xl text-xs">
                                <span className="text-gray-600 font-medium">💵 Cash Sales</span>
                                <span className="font-bold text-gray-800">Ksh {closeData.totalCash.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center p-2.5 bg-gray-50 rounded-xl text-xs">
                                <span className="text-gray-600 font-medium">📱 M-Pesa Sales</span>
                                <span className="font-bold text-emerald-600">Ksh {closeData.totalMpesa.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center p-2.5 bg-gray-50 rounded-xl text-xs">
                                <span className="text-gray-600 font-medium">📋 Credit Sales</span>
                                <span className="font-bold text-amber-600">Ksh {closeData.totalCredit.toLocaleString()}</span>
                            </div>
                        </div>

                        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl p-3 text-white mb-3">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-semibold">Total Revenue ({closeData.orderCount} sales)</span>
                                <span className="text-xl font-black">Ksh {closeData.totalSales.toLocaleString()}</span>
                            </div>
                        </div>

                        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-3 text-white mb-4">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold uppercase">NET SALES</span>
                                <span className="text-2xl font-black">Ksh {closeData.netSales.toLocaleString()}</span>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    setShowCloseReg(false);
                                    setCloseData(null);
                                }}
                                className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-xs hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={printCloseRegisterReport}
                                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1 shadow-sm"
                            >
                                🖨️ Print
                            </button>
                            <button
                                onClick={finalizeClose}
                                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs shadow-md"
                            >
                                Close & Lock
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 8. Keyboard Shortcuts Modal */}
            {showShortcutsModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-sm border border-gray-100">
                        <div className="flex items-center justify-between pb-2 border-b border-gray-100 mb-3">
                            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                                <span>⌨️</span> POS Keyboard Shortcuts
                            </h3>
                            <button
                                onClick={() => setShowShortcutsModal(false)}
                                className="w-7 h-7 rounded hover:bg-gray-100 text-gray-400 text-xs font-bold"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="space-y-2 text-xs">
                            <div className="flex justify-between items-center py-1 border-b border-gray-50">
                                <span className="text-gray-600">Focus Barcode / Search</span>
                                <span className="px-2 py-0.5 bg-gray-100 font-mono font-bold rounded">F1 or /</span>
                            </div>
                            <div className="flex justify-between items-center py-1 border-b border-gray-50">
                                <span className="text-gray-600">Quick Cash Checkout</span>
                                <span className="px-2 py-0.5 bg-gray-100 font-mono font-bold rounded">F2</span>
                            </div>
                            <div className="flex justify-between items-center py-1 border-b border-gray-50">
                                <span className="text-gray-600">Quick M-Pesa Checkout</span>
                                <span className="px-2 py-0.5 bg-gray-100 font-mono font-bold rounded">F3</span>
                            </div>
                            <div className="flex justify-between items-center py-1 border-b border-gray-50">
                                <span className="text-gray-600">Park / Hold Sale</span>
                                <span className="px-2 py-0.5 bg-gray-100 font-mono font-bold rounded">F4</span>
                            </div>
                            <div className="flex justify-between items-center py-1 border-b border-gray-50">
                                <span className="text-gray-600">Complete / Checkout</span>
                                <span className="px-2 py-0.5 bg-gray-100 font-mono font-bold rounded">F9 or Ctrl+Enter</span>
                            </div>
                            <div className="flex justify-between items-center py-1">
                                <span className="text-gray-600">Close Any Modal</span>
                                <span className="px-2 py-0.5 bg-gray-100 font-mono font-bold rounded">Esc</span>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowShortcutsModal(false)}
                            className="w-full mt-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs"
                        >
                            Got It
                        </button>
                    </div>
                </div>
            )}

            {loadingReg && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-5 flex items-center gap-3 shadow-xl">
                        <div className="w-6 h-6 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="font-semibold text-gray-700 text-sm">Auditing register transactions...</span>
                    </div>
                </div>
            )}
        </div>
    );
}
