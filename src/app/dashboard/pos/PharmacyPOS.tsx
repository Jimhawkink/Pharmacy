'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, Bell, Box, CalendarDays, Check, ChevronDown, ChevronLeft,
  ChevronRight, Clock3, CreditCard, FileText, HeartPulse, Home, Keyboard,
  Layers3, Leaf, LogOut, Package, Pill, Plus, Search, Settings, ShieldCheck,
  ShoppingCart, SlidersHorizontal, Stethoscope, Tag, Trash2, Truck, User,
  Users, Volume2, X, Zap, ScanBarcode, Menu, BarChart3
} from '@/components/LucideIcons';
import { MedicineVisual } from '@/lib/medicineVisual';

export interface Product {
  id: number;
  name: string;
  barcode: string;
  category: string;
  availableQty: number;
  salesPrice: number;
  salesUnit: string;
  costPrice?: number;
  imageUrl?: string;
  generic_name?: string;
  drug_type?: string;
  dosage?: string;
  requires_prescription?: boolean;
  batches?: any[];
}

export interface CartItem extends Product {
  qty: number;
  discount: number;
  effectivePrice: number;
  batchId?: number;
  batchNumber?: string;
  expiryDate?: string;
  daysUntilExpiry?: number;
  prescriptionNote?: string;
  doctorName?: string;
}

export type PharmacyPOSProps = {
  products?: Product[];
  cart?: CartItem[];
  onAddToCart?: (product: Product) => void;
  onUpdateQty?: (id: number, delta: number) => void;
  onRemoveItem?: (idx: number) => void;
  onClearCart?: () => void;
  onCheckout?: (items: CartItem[], total: number) => void | Promise<void>;
  onCloseRegister?: () => void;
  onOpenRegister?: () => void;
  registerOpen?: boolean;
  currentShiftId?: number;
  receiptNo?: string;
  activeBranch?: string;
  branches?: string[];
  onSelectBranch?: (b: string) => void;
  selectedCategory?: string;
  onSelectCategory?: (c: string) => void;
  categoriesList?: string[];
  selectedPatient?: { name: string; phone?: string; balance?: number } | null;
  onSelectPatient?: () => void;
  onClearPatient?: () => void;
  onOpenShortcutHelp?: () => void;
  onToggleSound?: () => void;
  isSoundOn?: boolean;
  heldSalesCount?: number;
  onOpenHeldModal?: () => void;
  onHoldSale?: () => void;
  onOpenBatches?: (product: Product) => void;
  embedded?: boolean;
};

const demoProducts: Product[] = [
  { id: 1, name: 'Amoxicillin 500mg', barcode: '616400100001', category: 'Antibiotics', availableQty: 2584, salesPrice: 10, salesUnit: 'Piece', generic_name: 'Amoxicillin', drug_type: 'Tablet', dosage: '500mg' },
  { id: 2, name: 'Amoxicillin Suspension', barcode: '616400100002', category: 'Antibiotics', availableQty: 1134, salesPrice: 300, salesUnit: 'Bottle', generic_name: 'Amoxicillin', drug_type: 'Syrup', dosage: '125mg/5ml' },
  { id: 3, name: 'Antifungal Powder 50g', barcode: '616400100003', category: 'Antifungals', availableQty: 524, salesPrice: 100, salesUnit: 'Piece', generic_name: 'Miconazole', drug_type: 'Powder', dosage: '50g' },
  { id: 4, name: 'Artificial Tears 15ml', barcode: '616400100004', category: 'Eye Care', availableQty: 1294, salesPrice: 120, salesUnit: 'Bottle', generic_name: 'Carboxymethylcellulose', drug_type: 'Eye drops', dosage: '15ml' },
  { id: 5, name: 'Azithromycin 250mg', barcode: '616400100005', category: 'Antibiotics', availableQty: 761, salesPrice: 25, salesUnit: 'Piece', generic_name: 'Azithromycin', drug_type: 'Tablet', dosage: '250mg' },
  { id: 6, name: 'Baby Diapers Size 3', barcode: '616400100006', category: 'Baby Care', availableQty: 2000, salesPrice: 850, salesUnit: 'Pack', generic_name: 'Baby diapers', drug_type: 'Diaper', dosage: 'Size 3' },
  { id: 7, name: 'Baby Lotion 200ml', barcode: '616400100007', category: 'Baby Care', availableQty: 4504, salesPrice: 280, salesUnit: 'Bottle', generic_name: 'Baby lotion', drug_type: 'Lotion', dosage: '200ml' },
  { id: 8, name: 'BACTIFIX TABS USP', barcode: '616400100008', category: 'Antibiotics', availableQty: 2026, salesPrice: 100, salesUnit: 'Strip', generic_name: 'Cefixime', drug_type: 'Tablet', dosage: '400mg' },
  { id: 9, name: 'Betadine Ointment 30g', barcode: '616400100009', category: 'Antiseptics', availableQty: 744, salesPrice: 150, salesUnit: 'Tube', generic_name: 'Povidone-iodine', drug_type: 'Ointment', dosage: '30g' },
  { id: 10, name: 'Calamine Lotion 100ml', barcode: '616400100010', category: 'Skin Care', availableQty: 2144, salesPrice: 100, salesUnit: 'Bottle', generic_name: 'Calamine', drug_type: 'Lotion', dosage: '100ml' },
  { id: 11, name: 'Calcium + D3 Tablets', barcode: '616400100011', category: 'Supplements', availableQty: 1054, salesPrice: 200, salesUnit: 'Strip', generic_name: 'Calcium carbonate + Vitamin D3', drug_type: 'Tablet', dosage: '500mg' },
  { id: 12, name: 'Ceftriaxone IV 1g', barcode: '616400100012', category: 'Antibiotics', availableQty: 2164, salesPrice: 280, salesUnit: 'Vial', generic_name: 'Ceftriaxone', drug_type: 'Injection', dosage: '1g' },
  { id: 13, name: 'Cetirizine 10mg', barcode: '616400100013', category: 'Antihistamines', availableQty: 1744, salesPrice: 50, salesUnit: 'Strip', generic_name: 'Cetirizine', drug_type: 'Tablet', dosage: '10mg' },
  { id: 14, name: 'Chloramphenicol Eye Drops', barcode: '616400100014', category: 'Eye Care', availableQty: 1754, salesPrice: 120, salesUnit: 'Bottle', generic_name: 'Chloramphenicol', drug_type: 'Eye drops', dosage: '0.5%' },
  { id: 15, name: 'Ciprofloxacin 500mg', barcode: '616400100015', category: 'Antibiotics', availableQty: 2111, salesPrice: 120, salesUnit: 'Strip', generic_name: 'Ciprofloxacin', drug_type: 'Tablet', dosage: '500mg' },
];

const money = (amount: number) =>
  new Intl.NumberFormat('en-KE', { maximumFractionDigits: 2 }).format(amount);

function BrandMark() {
  return (
    <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-300 via-emerald-500 to-green-800 shadow-[0_8px_22px_rgba(0,190,90,.35)] ring-1 ring-white/40">
      <span className="absolute text-[26px] font-black leading-none text-white">✚</span>
      <Leaf className="absolute bottom-1 right-1 h-4 w-4 fill-lime-300 text-lime-100" />
    </div>
  );
}

function ProductArtwork({ product }: { product: Product }) {
  if (product.imageUrl && product.imageUrl.startsWith('http')) {
    return <img src={product.imageUrl} alt={product.name} className="h-full w-full object-contain p-2" />;
  }

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-white via-emerald-50/20 to-slate-50 p-1">
      <MedicineVisual
        name={product.name}
        category={product.category}
        drugType={product.drug_type}
        genericName={product.generic_name}
        className="w-20 h-14"
      />
    </div>
  );
}

export default function PharmacyPOS({
  products = demoProducts,
  cart: controlledCart,
  onAddToCart,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  onCheckout,
  onCloseRegister,
  onOpenRegister,
  registerOpen = true,
  currentShiftId = 1,
  receiptNo = 'RX-0002',
  activeBranch = 'Main Pharmacy',
  branches = ['Main Pharmacy', 'Branch 2', 'Branch 3'],
  onSelectBranch,
  selectedCategory: controlledCategory,
  onSelectCategory,
  categoriesList,
  selectedPatient,
  onSelectPatient,
  onClearPatient,
  onOpenShortcutHelp,
  onToggleSound,
  isSoundOn = true,
  heldSalesCount = 0,
  onOpenHeldModal,
  onHoldSale,
  onOpenBatches,
  embedded = false,
}: PharmacyPOSProps) {
  const [internalCart, setInternalCart] = useState<CartItem[]>([]);
  const cart = controlledCart !== undefined ? controlledCart : internalCart;

  const [search, setSearch] = useState('');
  const [internalCategory, setInternalCategory] = useState('All Categories');
  const category = controlledCategory !== undefined ? controlledCategory : internalCategory;

  const [internalBranch, setInternalBranch] = useState(activeBranch);
  const branch = activeBranch || internalBranch;

  const [soundOn, setSoundOn] = useState(isSoundOn);
  const [time, setTime] = useState(new Date());
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleKeys = (event: KeyboardEvent) => {
      if (event.key === 'F1') {
        event.preventDefault();
        document.getElementById('pharmacy-pos-search')?.focus();
      }
      if (event.key === 'F9') {
        event.preventDefault();
        if (cart.length && onCheckout) void handleCheckout();
      }
      if (event.key === 'Escape') setSearch('');
    };
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, [cart, onCheckout]);

  const categories = useMemo(() => {
    if (categoriesList && categoriesList.length) {
      return ['All Categories', ...categoriesList.filter(c => c !== 'All Categories')];
    }
    return ['All Categories', ...Array.from(new Set(products.map((p) => p.category))).filter(Boolean).sort()];
  }, [products, categoriesList]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchesCategory = category === 'All Categories' || p.category === category;
      const matchesSearch =
        !q ||
        [p.name, p.barcode, p.category, p.generic_name, p.dosage]
          .some((value) => value?.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [products, search, category]);

  const subtotal = cart.reduce((sum, item) => sum + (item.effectivePrice || item.salesPrice) * item.qty - (item.discount || 0), 0);
  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);

  const handleAddToCart = (product: Product) => {
    if (product.availableQty <= 0) return;
    if (onAddToCart) {
      onAddToCart(product);
      return;
    }
    setInternalCart((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) {
        return current.map((item) =>
          item.id === product.id && item.qty < product.availableQty
            ? { ...item, qty: item.qty + 1 }
            : item
        );
      }
      return [...current, { ...product, qty: 1, discount: 0, effectivePrice: product.salesPrice }];
    });
  };

  const handleUpdateQty = (id: number, delta: number, idx?: number) => {
    if (onUpdateQty) {
      onUpdateQty(id, delta);
      return;
    }
    setInternalCart((current) =>
      current
        .map((item) => ({ ...item, qty: Math.min(item.availableQty, item.qty + delta) }))
        .filter((item) => item.id !== id || item.qty > 0)
    );
  };

  const handleClear = () => {
    if (onClearCart) onClearCart();
    else setInternalCart([]);
  };

  const handleCheckout = async () => {
    if (!cart.length || !onCheckout) return;
    setCheckingOut(true);
    try {
      await onCheckout(cart, subtotal);
    } finally {
      setCheckingOut(false);
    }
  };

  const navGroups: Array<{ label: string; icon: React.ElementType; active?: boolean; children?: Array<{ label: string; icon: React.ElementType; active?: boolean; badge?: string }> }> = [
    { label: 'Dashboard', icon: Home, active: false },
    { label: 'Pharmacy', icon: Pill, active: true, children: [
      { label: 'Pharmacy POS', icon: ShoppingCart, active: true },
      { label: 'Dispensing', icon: Package },
      { label: 'Prescriptions', icon: FileText },
      { label: 'Expiry Register', icon: Clock3, badge: '3' },
      { label: 'Batch Management', icon: Box },
    ]},
    { label: 'Clinical', icon: HeartPulse },
    { label: 'Products & Sales', icon: Tag },
    { label: 'Purchases', icon: Truck },
    { label: 'Inventory', icon: Layers3 },
    { label: 'Insurance', icon: ShieldCheck },
  ];

  const posWorkspace = (
    <div className="flex min-h-0 flex-1 flex-col gap-3 select-none text-slate-800">
      {/* 1. STATUS STRIP */}
      <section className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white bg-white/80 px-4 py-3 shadow-[0_5px_18px_rgba(20,70,40,.06)] shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-2 text-xs font-black tracking-wide text-white bg-gradient-to-r from-emerald-600 to-green-700 px-3.5 py-1.5 rounded-full shadow-xs">
            <Pill className="h-4 w-4" /> ALPHA PHARMACY POS
          </span>
          <span className="hidden h-5 w-px bg-slate-200 sm:block" />
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-[11px] font-semibold text-slate-700 shadow-xs">
            📍 {branch}
          </span>
          <span className={`rounded-full px-3.5 py-1.5 text-[11px] font-bold flex items-center gap-1.5 shadow-xs ${registerOpen ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'border border-red-200 bg-red-50 text-red-600 animate-pulse'}`}>
            <span className={`h-2 w-2 rounded-full ${registerOpen ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]' : 'bg-red-500'}`} />
            {registerOpen ? `Shift #${currentShiftId} Open` : 'Register Closed'}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {heldSalesCount > 0 && (
            <button
              onClick={onOpenHeldModal}
              className="flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-800 shadow-xs hover:bg-amber-100 transition"
              title="View parked sales [F4]"
            >
              <span>⏸️</span>
              <span>Held Sales ({heldSalesCount})</span>
            </button>
          )}
          <button
            onClick={() => {
              setSoundOn((v) => !v);
              onToggleSound?.();
            }}
            className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-800 shadow-xs"
          >
            <Volume2 className="h-3.5 w-3.5" />
            {soundOn ? 'Sound' : 'Muted'}
          </button>
          <button
            onClick={onOpenShortcutHelp}
            className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-600 shadow-xs hover:bg-slate-100 transition"
          >
            <Keyboard className="h-3.5 w-3.5" />
            Shortcuts
          </button>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold tabular-nums text-slate-600 shadow-xs">
            <Clock3 className="mr-1 inline h-3.5 w-3.5" />
            {time.toLocaleTimeString('en-GB')}
          </span>
          <span className="rounded-full border border-blue-200 bg-blue-50 px-3.5 py-1.5 text-[11px] font-bold text-blue-700 shadow-xs font-mono">
            {receiptNo}
          </span>
        </div>
      </section>

      {/* 2. FILTER BAR */}
      <section className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-[160px_minmax(220px,1fr)_190px_190px_160px] shrink-0">
        <select
          value={branch}
          onChange={(e) => {
            setInternalBranch(e.target.value);
            onSelectBranch?.(e.target.value);
          }}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm outline-none focus:border-emerald-400 cursor-pointer"
        >
          {branches.map((b) => (
            <option key={b} value={b}>⭐ {b}</option>
          ))}
        </select>

        <div className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 shadow-sm">
          <Search className="h-4 w-4 text-emerald-700" />
          <input
            id="pharmacy-pos-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Scan Barcode [Enter] or Search by Drug..."
            className="min-w-0 flex-1 text-xs outline-none placeholder:text-slate-400 bg-transparent font-medium"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600 text-xs font-bold px-1">
              ✕
            </button>
          )}
          <kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500 font-mono">F1</kbd>
        </div>

        <select
          value={category}
          onChange={(e) => {
            setInternalCategory(e.target.value);
            onSelectCategory?.(e.target.value);
          }}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm outline-none focus:border-emerald-400 cursor-pointer"
        >
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <button
          onClick={onSelectPatient}
          className={`flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-bold shadow-sm transition ${selectedPatient ? 'border-blue-300 bg-blue-50 text-blue-900' : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300'}`}
        >
          <User className="h-4 w-4 text-emerald-700" />
          <span className="truncate">{selectedPatient ? selectedPatient.name : 'Walk-in Patient'}</span>
          {selectedPatient && onClearPatient && (
            <span onClick={(e) => { e.stopPropagation(); onClearPatient(); }} className="ml-1 text-slate-400 hover:text-red-500">✕</span>
          )}
        </button>

        {!registerOpen ? (
          <button
            onClick={onOpenRegister}
            className="flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 px-3 text-xs font-extrabold text-white shadow-[0_5px_15px_rgba(16,185,129,.25)] transition hover:brightness-105 active:scale-95"
          >
            <span>🟢</span> Open Register
          </button>
        ) : (
          <button
            onClick={onCloseRegister}
            className="flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-3 text-xs font-extrabold text-white shadow-[0_5px_15px_rgba(220,38,38,.2)] transition hover:brightness-105 active:scale-95"
          >
            <X className="h-4 w-4" /> Close Register
          </button>
        )}
      </section>

      {/* 3. CATALOG + CART */}
      <section className="grid min-h-0 flex-1 grid-cols-1 gap-3 2xl:grid-cols-[minmax(0,1fr)_370px]">
        {/* CATALOG GRID */}
        <div className="min-h-[480px] overflow-y-auto rounded-2xl border border-white/80 bg-white/55 p-3 shadow-inner">
          <div className="mb-3 flex items-center justify-between px-1">
            <div>
              <h2 className="text-sm font-extrabold text-slate-800">Medicine Catalogue</h2>
              <p className="text-[10px] text-slate-500">
                {filteredProducts.length} products available · Select an item to add to cart
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
              <SlidersHorizontal className="h-3.5 w-3.5" /> Live stock
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4 min-[1700px]:grid-cols-5">
            {filteredProducts.map((product) => {
              const isMultiBatch = (product.batches || []).length > 1;
              return (
                <article
                  key={product.id}
                  onClick={() => {
                    if (product.availableQty > 0) {
                      if (isMultiBatch && onOpenBatches) onOpenBatches(product);
                      else handleAddToCart(product);
                    }
                  }}
                  className="group relative flex min-w-0 flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-2.5 shadow-[0_4px_12px_rgba(15,50,35,.05)] transition duration-200 hover:-translate-y-1 hover:border-emerald-300 hover:shadow-[0_12px_25px_rgba(16,120,70,.12)] cursor-pointer h-[236px]"
                  title={product.name}
                >
                  {/* Stock pill */}
                  <span
                    className={`absolute right-2 top-2 z-10 rounded-full border px-2 py-0.5 text-[9px] font-extrabold shadow-2xs ${
                      product.availableQty < 20
                        ? 'border-red-200 bg-red-50 text-red-600'
                        : product.availableQty < 100
                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {product.availableQty.toLocaleString()} {product.salesUnit || ''}
                  </span>

                  {/* 3D Realistic Medicine Visual Box */}
                  <div className="mx-auto mb-2 mt-4 h-[86px] w-full max-w-[130px] rounded-xl border border-emerald-100/70 bg-gradient-to-br from-white via-emerald-50/20 to-slate-50 flex items-center justify-center relative p-1 group-hover:scale-105 transition-transform duration-200">
                    <ProductArtwork product={product} />
                  </div>

                  {/* Title & info */}
                  <div>
                    <h3 className="truncate text-[11px] font-extrabold text-slate-900 group-hover:text-emerald-700 transition-colors" title={product.name}>
                      {product.name}
                    </h3>
                    <p className="mt-0.5 truncate text-[9px] italic text-slate-500">
                      {product.generic_name || product.category} · {product.dosage || product.drug_type || product.salesUnit}
                    </p>
                  </div>

                  {/* Price & Add to Cart */}
                  <div className="mt-auto pt-2">
                    <div className="mb-2 flex items-center justify-between gap-1">
                      <span className="text-sm font-black text-emerald-900">
                        Ksh {money(product.salesPrice)}
                      </span>
                      <div className="flex items-center gap-1">
                        {isMultiBatch && (
                          <span className="rounded bg-purple-50 text-purple-700 border border-purple-200 px-1 py-0.2 text-[7.5px] font-bold">
                            {product.batches?.length}B
                          </span>
                        )}
                        <span className="truncate rounded bg-slate-100 px-1.5 py-0.5 text-[8px] font-semibold text-slate-500">
                          {product.category}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isMultiBatch && onOpenBatches) onOpenBatches(product);
                        else handleAddToCart(product);
                      }}
                      disabled={product.availableQty <= 0}
                      className="flex w-full items-center justify-center gap-1 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-700 py-2 text-[10px] font-extrabold text-white shadow-[0_4px_10px_rgba(5,150,80,.2)] transition hover:from-emerald-600 hover:to-green-800 disabled:cursor-not-allowed disabled:opacity-40 active:scale-98"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add to Cart
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {filteredProducts.length === 0 && (
            <div className="flex min-h-56 flex-col items-center justify-center text-center py-16">
              <Search className="mb-2 h-8 w-8 text-slate-300" />
              <p className="text-sm font-bold text-slate-600">No medicines found</p>
              <p className="text-xs text-slate-400">Try another name, barcode or category</p>
            </div>
          )}
        </div>

        {/* DISPENSING CART */}
        <aside className="flex min-h-[470px] w-full flex-col overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-[0_10px_35px_rgba(0,65,35,.09)]">
          {/* Header */}
          <div className="flex items-center justify-between bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-800 px-4 py-4 text-white shadow-md">
            <div className="flex items-center gap-2 text-sm font-black">
              <ShoppingCart className="h-5 w-5" /> Dispensing Cart ({totalItems})
            </div>
            <div className="flex items-center gap-1.5">
              {cart.length > 0 && onHoldSale && (
                <button
                  onClick={onHoldSale}
                  className="text-xs bg-white/20 hover:bg-white/30 text-white font-semibold px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
                  title="Park sale for next patient [F4]"
                >
                  <span>⏸️</span> Hold
                </button>
              )}
              <button
                onClick={handleClear}
                title="Clear cart"
                className="rounded-lg p-1.5 text-white/80 hover:bg-white/15 hover:text-white transition"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Cart items list */}
          <div className="flex min-h-[220px] flex-1 flex-col overflow-y-auto p-3">
            {cart.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
                <div className="relative mb-4 flex h-28 w-32 items-center justify-center rounded-full bg-gradient-to-br from-emerald-50 to-white shadow-inner">
                  <ShoppingCart className="h-16 w-16 text-slate-300" />
                  <span className="absolute right-3 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg">
                    <Plus className="h-5 w-5" />
                  </span>
                  <Leaf className="absolute bottom-2 left-2 h-6 w-6 text-emerald-200" />
                </div>
                <h3 className="text-sm font-extrabold text-slate-800">Cart is empty</h3>
                <p className="mt-1 max-w-[220px] text-[11px] leading-5 text-slate-400">
                  Scan barcode or click on medicine to add to prescription
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map((item, idx) => (
                  <div key={`${item.id}-${idx}`} className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/70 p-2 shadow-2xs hover:border-emerald-200 transition">
                    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-emerald-100 bg-white flex items-center justify-center p-1">
                      <ProductArtwork product={item} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-bold text-slate-800">{item.name}</p>
                      <p className="text-[10px] text-slate-500">
                        Ksh {money(item.effectivePrice || item.salesPrice)} / {item.salesUnit || 'Pc'}
                      </p>
                      <p className="text-[10px] font-bold text-emerald-800">
                        Ksh {money((item.effectivePrice || item.salesPrice) * item.qty - (item.discount || 0))}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleUpdateQty(item.id, -1, idx)}
                        className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-100 active:scale-95"
                      >
                        −
                      </button>
                      <span className="w-5 text-center text-xs font-bold text-slate-800">{item.qty}</span>
                      <button
                        onClick={() => handleUpdateQty(item.id, 1, idx)}
                        className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-100 active:scale-95"
                      >
                        +
                      </button>
                      {onRemoveItem && (
                        <button
                          onClick={() => onRemoveItem(idx)}
                          className="ml-1 text-slate-400 hover:text-red-500 text-xs px-1 font-bold"
                          title="Remove item"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart Footer */}
          <div className="space-y-3 border-t border-slate-100 bg-slate-50/70 p-4 shrink-0">
            <div className="flex justify-between text-xs text-slate-600">
              <span>Subtotal ({totalItems} items)</span>
              <span className="font-semibold">Ksh {money(subtotal)}</span>
            </div>
            <div className="h-px bg-slate-200" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-black tracking-wide text-slate-800">PAYABLE TOTAL</span>
              <span className="text-2xl font-black tracking-tight text-emerald-700">
                Ksh {money(subtotal)}
              </span>
            </div>
            <button
              onClick={() => void handleCheckout()}
              disabled={!cart.length || !onCheckout || checkingOut}
              className="flex w-full items-center justify-between rounded-xl bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-800 px-5 py-4 text-sm font-black text-white shadow-[0_8px_20px_rgba(5,150,80,.25)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.99]"
            >
              <span className="flex items-center gap-2">
                <Check className="h-5 w-5" />
                {checkingOut ? 'Processing...' : 'Checkout'}
                <kbd className="rounded bg-white/20 px-2 py-0.5 text-[10px] font-mono">F9</kbd>
              </span>
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </aside>
      </section>

      {/* 4. FOOTER FEATURE WAVE BANNER */}
      <footer className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white bg-white/85 px-4 py-2.5 text-[10px] shadow-[0_5px_20px_rgba(20,70,40,.05)] shrink-0">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-bold text-emerald-900">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-600" /> Trusted Pharmacy Solution
          </span>
          <span className="flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-amber-500" /> Fast & Efficient
          </span>
          <span className="flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4 text-emerald-600" /> Real-time Inventory
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4 text-emerald-600" /> Better Patient Care
          </span>
        </div>
        <div className="font-extrabold text-emerald-800 flex items-center gap-1">
          <span className="px-3 py-1 bg-gradient-to-r from-emerald-600 to-[#00A848] text-white rounded-full text-[11px] font-bold shadow-xs flex items-center gap-1.5">
            Alpha Pharmacy POS <span className="text-emerald-100 font-normal">v1.0</span> 👑
          </span>
        </div>
      </footer>
    </div>
  );

  if (embedded) {
    return posWorkspace;
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[#edf5ef] text-slate-800">
      <div className="flex min-h-screen">
        {/* SIDEBAR */}
        <aside className={`${sidebarOpen ? 'w-[248px]' : 'w-[82px]'} relative z-20 hidden shrink-0 flex-col overflow-hidden bg-gradient-to-b from-[#003d24] via-[#00512d] to-[#002b1c] text-white shadow-[8px_0_30px_rgba(0,54,30,.18)] transition-all duration-300 lg:flex`}>
          <div className="absolute -bottom-10 -left-12 h-52 w-52 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="relative flex items-center gap-3 border-b border-white/10 px-5 py-6">
            <BrandMark />
            {sidebarOpen && (
              <div>
                <div className="text-[17px] font-black tracking-tight">Alpha Pharmacy</div>
                <div className="mt-0.5 text-[10px] tracking-wide text-emerald-100/80">Care Today. Health Tomorrow.</div>
              </div>
            )}
          </div>
          <nav className="relative flex-1 space-y-1 px-3 py-5">
            {navGroups.map((group) => {
              const Icon = group.icon;
              return (
                <div key={group.label}>
                  <button className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-semibold transition ${group.active ? 'bg-white/10 text-emerald-100' : 'text-white/85 hover:bg-white/10'}`}>
                    <Icon className="h-[18px] w-[18px] shrink-0" />
                    {sidebarOpen && (
                      <>
                        <span className="flex-1">{group.label}</span>
                        {group.children && <ChevronDown className="h-4 w-4" />}
                      </>
                    )}
                  </button>
                  {group.children && sidebarOpen && (
                    <div className="ml-4 mt-1 space-y-1 border-l border-emerald-200/20 pl-3">
                      {group.children.map((child) => {
                        const ChildIcon = child.icon;
                        return (
                          <button key={child.label} className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[12px] transition ${child.active ? 'bg-gradient-to-r from-emerald-400 to-green-600 font-bold text-white shadow-[0_5px_18px_rgba(0,255,100,.28)] ring-1 ring-lime-200/50' : 'text-emerald-50/85 hover:bg-white/10'}`}>
                            <ChildIcon className="h-4 w-4 shrink-0" />
                            <span className="flex-1">{child.label}</span>
                            {'badge' in child && child.badge && (
                              <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white">{child.badge}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
          {sidebarOpen && (
            <div className="relative mx-3 mb-4 rounded-2xl border border-emerald-300/30 bg-gradient-to-br from-emerald-400/20 to-emerald-900/50 p-3 shadow-inner">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-8 w-8 text-amber-300" />
                <div className="text-xs font-extrabold">Secure & Compliant</div>
              </div>
              <p className="mt-1 pl-10 text-[10px] leading-4 text-emerald-100/80">Pharmacy Management System</p>
            </div>
          )}
          <div className="relative flex items-center gap-3 border-t border-white/10 bg-black/10 px-4 py-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-200 to-emerald-500 font-black text-emerald-950 ring-2 ring-white/20">S</div>
            {sidebarOpen && <div className="min-w-0 flex-1"><div className="text-xs font-bold">Super Admin</div><div className="text-[10px] text-emerald-100/70">Administrator</div></div>}
            {sidebarOpen && <LogOut className="h-4 w-4 text-emerald-100/70" />}
          </div>
          <button onClick={() => setSidebarOpen((v) => !v)} className="absolute right-[-13px] top-24 z-30 flex h-7 w-7 items-center justify-center rounded-full border border-emerald-100 bg-white text-emerald-800 shadow-md">
            {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </aside>

        {/* MAIN AREA */}
        <main className="flex min-w-0 flex-1 flex-col">
          {/* HEADER */}
          <header className="relative z-10 flex min-h-[76px] flex-wrap items-center justify-between gap-3 border-b border-emerald-100 bg-white/90 px-4 py-3 shadow-[0_4px_20px_rgba(13,70,42,.05)] backdrop-blur-xl xl:px-7">
            <div className="flex items-center gap-3">
              <button className="rounded-xl p-2 text-emerald-800 hover:bg-emerald-50 lg:hidden" onClick={() => setSidebarOpen((v) => !v)}><Menu className="h-5 w-5" /></button>
              <div className="text-2xl">☀️</div>
              <div><div className="text-[17px] font-extrabold tracking-tight text-slate-900">Good Morning 👋</div><div className="text-[11px] font-medium text-slate-500">Alpha Pharmacy POS</div></div>
            </div>
            <div className="order-3 flex w-full items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 shadow-[0_5px_20px_rgba(20,60,40,.08)] md:order-none md:max-w-[470px] md:flex-1 xl:mx-8">
              <Search className="h-5 w-5 text-emerald-700" />
              <input id="pharmacy-pos-search-top" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Scan barcode or search by drug, generic name, SKU..." className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-slate-400" />
              <ScanBarcode className="h-5 w-5 text-slate-400" />
            </div>
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />Online</span>
              <button className="relative rounded-full p-2.5 text-slate-600 hover:bg-emerald-50"><Bell className="h-5 w-5" /><span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" /></button>
              <div className="hidden rounded-xl bg-gradient-to-r from-emerald-700 to-green-600 px-4 py-2 text-right text-[10px] font-bold leading-4 text-white shadow-md sm:block"><div>{time.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</div><div>{time.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div></div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-700 font-black text-white shadow-md ring-2 ring-emerald-100">S</div>
            </div>
          </header>

          <div className="p-3 xl:p-5 flex min-h-0 flex-1 flex-col">
            {posWorkspace}
          </div>
        </main>
      </div>
    </div>
  );
}
