'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { calculateStockBreakdown } from '@/lib/stockBreakdown';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement,
  PointElement, LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend, Filler);

/* ═══════════════════════════════════════════════════════════════
   ALPHA PHARMACY - STOCK TAKE & BATCH INVENTORY AUDIT
   Physical Inventory • Batch Reconciliation • FEFO • Variance Ledger
   ═══════════════════════════════════════════════════════════════ */

export type StockTake = {
  stock_take_id: number;
  outlet_id: number;
  reference_no: string;
  stock_take_date: string;
  status: 'In Progress' | 'Completed' | 'Approved' | 'Cancelled';
  total_items: number;
  matched_items: number;
  variance_items: number;
  total_system_value: number;
  total_physical_value: number;
  variance_value: number;
  conducted_by: string;
  approved_by: string;
  approved_date: string | null;
  notes: string;
  created_at: string;
};

export type StockTakeItem = {
  item_id: number;
  stock_take_id: number;
  batch_id?: number;
  product_id: number;
  product_name: string;
  generic_name?: string;
  category?: string;
  batch_number: string;
  expiry_date: string;
  system_qty: number;
  physical_qty: number;
  variance_qty: number;
  unit_cost: number;
  variance_value: number;
  reason: string;
  status: 'Verified' | 'Pending' | string;
  pieces_per_package?: number;
  purchase_unit?: string;
};

export type PharmacyProduct = {
  pid: number;
  product_code?: string;
  product_name: string;
  generic_name?: string;
  category?: string;
  purchase_cost?: number;
  sales_cost?: number;
  barcode?: string;
  sales_unit?: string;
  drug_type?: string;
  active?: boolean;
};

export type BatchItem = {
  batch_id: number;
  product_id: number;
  batch_number: string;
  expiry_date: string;
  remaining_qty: number;
  purchase_cost?: number;
  selling_price?: number;
  status?: string;
  outlet_id?: number;
  created_at?: string;
  pieces_per_package?: number;
  purchase_unit?: string;
  // Computed / joined fields
  product_name?: string;
  generic_name?: string;
  category?: string;
  cost_price?: number;
};

export type Supplier = {
  supplier_id?: number;
  id?: number;
  supplier_name?: string;
  name?: string;
  phone?: string;
  email?: string;
  contact_person?: string;
  balance?: number;
};

const TABS = [
  'Stock Takes',
  'Current Count',
  'Variance Report',
  'Dead Stock',
  'Supplier Scoring',
  'FEFO Analysis',
  'Predictive Reorder',
] as const;

const statusColor: Record<string, string> = {
  'In Progress': 'bg-amber-100 text-amber-900 border border-amber-300',
  Completed: 'bg-blue-100 text-blue-900 border border-blue-300',
  Approved: 'bg-emerald-100 text-emerald-900 border border-emerald-300',
  Cancelled: 'bg-rose-100 text-rose-900 border border-rose-300',
};

const fmt = (n: number) => (n || 0).toLocaleString('en-KE');
const fmtC = (n: number) => `KSh ${(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function StockTakePage() {
  const { activeOutlet } = useOutlet();
  const oid = typeof activeOutlet === 'object' && activeOutlet !== null ? (activeOutlet.outlet_id || 1) : (Number(activeOutlet) || 1);

  const [tab, setTab] = useState<typeof TABS[number]>('Current Count');
  const [loading, setLoading] = useState(true);

  // Data states
  const [stockTakes, setStockTakes] = useState<StockTake[]>([]);
  const [activeStockTake, setActiveStockTake] = useState<StockTake | null>(null);
  const [stockTakeItems, setStockTakeItems] = useState<StockTakeItem[]>([]);
  const [allBatches, setAllBatches] = useState<BatchItem[]>([]);
  const [products, setProducts] = useState<PharmacyProduct[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [filterType, setFilterType] = useState<'All' | 'Variance' | 'Matched' | 'NearExpiry' | 'Expired'>('All');

  // Modals
  const [showNewModal, setShowNewModal] = useState(false);
  const [newConductBy, setNewConductBy] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // Add Batch Modal
  const [showAddBatchModal, setShowAddBatchModal] = useState(false);
  const [addBatchProduct, setAddBatchProduct] = useState<number>(0);
  const [addBatchNumber, setAddBatchNumber] = useState('');
  const [addBatchExpiry, setAddBatchExpiry] = useState('');
  const [addBatchQty, setAddBatchQty] = useState<number>(0);
  const [addBatchCost, setAddBatchCost] = useState<number>(0);

  // Helper: show glowing light green toast
  const showGreenToast = (msg: string) => {
    toast.custom((t) => (
      <div className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border border-emerald-400/80 bg-[#023318] text-white transition-all ${t.visible ? 'animate-enter opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
        <span className="text-emerald-300 text-lg">✓</span>
        <span className="text-xs font-bold tracking-wide">{msg}</span>
      </div>
    ), { duration: 3500 });
  };

  // ─── 1. Main Data Loader ──────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);

    // Clear stale cached stock-take items so product names re-join fresh from DB
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith('pharmacy_stock_take_items_')) localStorage.removeItem(k);
    });

    try {
      // 1. Fetch products from pharmacy_products
      //    NOTE: always trust what Supabase returns (even empty means "no products yet")
      //    Do NOT fall back to a 'products' table that doesn't exist.
      let prodsList: PharmacyProduct[] = [];
      const { data: pData, error: pErr } = await supabase
        .from('pharmacy_products')
        .select('pid, product_code, product_name, generic_name, category, purchase_cost, sales_cost, barcode, drug_type, active')
        .order('product_name');
      if (!pErr && pData) {
        prodsList = pData as PharmacyProduct[];
      } else {
        console.warn('pharmacy_products fetch error:', pErr?.message);
      }
      setProducts(prodsList);

      // Create fast lookup map by pid
      const prodMap = new Map<number, PharmacyProduct>();
      prodsList.forEach(p => prodMap.set(p.pid, p));

      // 2. Fetch batches using a Supabase join to get product_name directly
      //    This is reliable even when prodMap is empty due to RLS timing
      let rawBatches: any[] = [];
      const { data: bData, error: bErr } = await supabase
        .from('pharmacy_batches')
        .select(`
          batch_id, product_id, batch_number, expiry_date,
          quantity, remaining_qty, purchase_cost, selling_price,
          supplier_id, supplier_name, status, outlet_id, created_at,
          pharmacy_products ( pid, product_name, generic_name, category, purchase_cost, drug_type )
        `)
        .eq('outlet_id', oid)
        .order('expiry_date', { ascending: true });

      if (!bErr && bData) {
        rawBatches = bData;
      } else {
        // Fallback: fetch batches without join (uses prodMap)
        console.warn('Batch join failed, using prodMap fallback:', bErr?.message);
        const { data: bSimple } = await supabase
          .from('pharmacy_batches')
          .select('*')
          .eq('outlet_id', oid)
          .order('expiry_date', { ascending: true });
        if (bSimple) rawBatches = bSimple;
      }

      // Join product information to batches (use joined data first, then prodMap)
      const enrichedBatches: BatchItem[] = rawBatches.map(b => {
        // Try joined relation first (from select with pharmacy_products(*))
        const joined = b.pharmacy_products as any;
        const p = joined || prodMap.get(b.product_id);
        const name = p?.product_name || prodMap.get(b.product_id)?.product_name || b.supplier_name || `Batch #${b.batch_id}`;
        const cost = b.purchase_cost || p?.purchase_cost || 0;
        return {
          batch_id: b.batch_id,
          product_id: b.product_id,
          batch_number: b.batch_number,
          expiry_date: b.expiry_date,
          quantity: b.quantity,
          remaining_qty: b.remaining_qty,
          purchase_cost: cost,
          selling_price: b.selling_price,
          supplier_id: b.supplier_id,
          supplier_name: b.supplier_name,
          status: b.status,
          outlet_id: b.outlet_id,
          created_at: b.created_at,
          product_name: name,
          generic_name: p?.generic_name || prodMap.get(b.product_id)?.generic_name || '',
          category: p?.category || prodMap.get(b.product_id)?.category || 'General',
          cost_price: cost,
          pieces_per_package: b.pieces_per_package || joined?.pieces_per_package || 1,
          purchase_unit: b.purchase_unit || joined?.purchase_unit || 'Piece',
        };
      });
      setAllBatches(enrichedBatches);

      // 3. Fetch suppliers (use pharmacy_suppliers, fallback to suppliers)
      try {
        const { data: sData, error: sErr } = await supabase.from('pharmacy_suppliers').select('supplier_id, supplier_name, phone, email, contact_person, current_balance');
        if (!sErr && sData) {
          setSuppliers(sData.map(s => ({ ...s, id: s.supplier_id, name: s.supplier_name, balance: s.current_balance })) as Supplier[]);
        } else {
          const { data: sOld } = await supabase.from('suppliers').select('*');
          if (sOld) setSuppliers(sOld as Supplier[]);
        }
      } catch (e) {
        console.warn('Could not fetch suppliers:', e);
      }

      // 4. Fetch stock takes with dual-sync (Supabase + localStorage)
      let stList: StockTake[] = [];
      try {
        const { data: stData, error: stErr } = await supabase
          .from('pharmacy_stock_takes')
          .select('*')
          .eq('outlet_id', oid)
          .order('created_at', { ascending: false });
        if (!stErr && stData && stData.length > 0) {
          stList = stData as StockTake[];
        }
      } catch (e) {
        console.warn('pharmacy_stock_takes table query error, falling back to local storage:', e);
      }

      // Check localStorage for offline/cached stock takes
      const localStRaw = localStorage.getItem(`pharmacy_stock_takes_${oid}`);
      if (localStRaw) {
        try {
          const localSt = JSON.parse(localStRaw) as StockTake[];
          if (localSt && localSt.length > 0) {
            // merge unique by reference_no
            const existingRefs = new Set(stList.map(s => s.reference_no));
            localSt.forEach(s => {
              if (!existingRefs.has(s.reference_no)) stList.push(s);
            });
          }
        } catch (e) {
          console.error('Error parsing local stock takes:', e);
        }
      }

      // If no stock take exists at all, auto-initialize an active Master Stock Take Session!
      if (stList.length === 0 && enrichedBatches.length > 0) {
        const initialRef = `ST-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-001`;
        let initialSysVal = 0;
        enrichedBatches.forEach(b => { initialSysVal += (b.remaining_qty || 0) * (b.cost_price || 0); });

        const initialSt: StockTake = {
          stock_take_id: 1,
          outlet_id: oid,
          reference_no: initialRef,
          stock_take_date: new Date().toISOString().split('T')[0],
          status: 'In Progress',
          total_items: enrichedBatches.length,
          matched_items: 0,
          variance_items: 0,
          total_system_value: initialSysVal,
          total_physical_value: initialSysVal,
          variance_value: 0,
          conducted_by: 'Superintendent Pharmacist',
          approved_by: '',
          approved_date: null,
          notes: 'Master Physical Batch Audit & Expiry Verification',
          created_at: new Date().toISOString(),
        };

        stList = [initialSt];
        localStorage.setItem(`pharmacy_stock_takes_${oid}`, JSON.stringify(stList));

        // Create initial items from all batches
        const initialItems: StockTakeItem[] = enrichedBatches.map((b, idx) => ({
          item_id: idx + 1,
          stock_take_id: initialSt.stock_take_id,
          batch_id: b.batch_id,
          product_id: b.product_id,
          product_name: b.product_name || `Medicine #${b.product_id}`,
          generic_name: b.generic_name,
          category: b.category,
          batch_number: b.batch_number || 'LOT-AUTO',
          expiry_date: b.expiry_date || new Date().toISOString().split('T')[0],
          system_qty: b.remaining_qty || 0,
          physical_qty: b.remaining_qty || 0, // default exact count ready for verification
          variance_qty: 0,
          unit_cost: b.cost_price || 0,
          variance_value: 0,
          reason: 'Correct',
          status: 'Verified',
        }));

        localStorage.setItem(`pharmacy_stock_take_items_${initialSt.stock_take_id}`, JSON.stringify(initialItems));
      }

      setStockTakes(stList);

      // Determine active stock take
      const inProg = stList.find(s => s.status === 'In Progress');
      const selected = inProg || stList[0] || null;
      setActiveStockTake(selected);

      if (selected) {
        await loadItems(selected.stock_take_id, enrichedBatches);
      }
    } catch (err) {
      console.error('Fatal load error:', err);
      toast.error('Failed to load stock take data');
    } finally {
      setLoading(false);
    }
  }, [oid]);

  // ─── 2. Load Items for a Specific Stock Take ──────────────────────────
  const loadItems = async (stId: number, currentBatches: BatchItem[] = allBatches) => {
    try {
      let items: StockTakeItem[] = [];

      // 1. Try Supabase pharmacy_stock_take_items
      //    NOTE: pharmacy_stock_take_items has NO batch_id column per schema.
      //    Re-enrich product_name by matching batch_number from currentBatches.
      try {
        const { data, error } = await supabase
          .from('pharmacy_stock_take_items')
          .select('*')
          .eq('stock_take_id', stId)
          .order('product_name', { ascending: true });
        if (!error && data && data.length > 0) {
          // Build lookup by batch_number to get real product names
          const batchByNumber = new Map<string, BatchItem>();
          const batchByProductId = new Map<number, BatchItem>();
          currentBatches.forEach(b => {
            if (b.batch_number) batchByNumber.set(b.batch_number, b);
            if (b.product_id && !batchByProductId.has(b.product_id)) batchByProductId.set(b.product_id, b);
          });
          items = (data as StockTakeItem[]).map(item => {
            const bByNum = item.batch_number ? batchByNumber.get(item.batch_number) : undefined;
            const bByPid = item.product_id ? batchByProductId.get(item.product_id) : undefined;
            const b = bByNum || bByPid;
            return {
              ...item,
              product_name: b?.product_name || item.product_name || `Product #${item.product_id}`,
              generic_name: b?.generic_name || item.generic_name || '',
              category: b?.category || item.category || 'General',
            };
          });
        }
      } catch (e) {
        console.warn('pharmacy_stock_take_items query error, using batches directly:', e);
      }

      // 2. Build fresh from currentBatches when no DB items exist
      if (items.length === 0 && currentBatches.length > 0) {
        items = currentBatches.map((b, idx) => ({
          item_id: idx + 1,
          stock_take_id: stId,
          batch_id: b.batch_id,
          product_id: b.product_id,
          product_name: b.product_name || b.batch_number || `Product #${b.product_id}`,
          generic_name: b.generic_name || '',
          category: b.category || 'General',
          batch_number: b.batch_number || 'LOT-AUTO',
          expiry_date: b.expiry_date,
          system_qty: b.remaining_qty || 0,
          physical_qty: b.remaining_qty || 0,
          variance_qty: 0,
          unit_cost: b.cost_price || 0,
          pieces_per_package: b.pieces_per_package || 1,
          purchase_unit: b.purchase_unit || 'Piece',
          variance_value: 0,
          reason: 'Correct',
          status: 'Verified',
        }));
      }

      setStockTakeItems(items);
    } catch (e) {
      console.error('Error in loadItems:', e);
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  // ─── 3. Start New Stock Take Session ──────────────────────────────────
  const handleStartStockTake = async () => {
    if (!newConductBy.trim()) {
      toast.error('Please enter name of auditor / conductor');
      return;
    }
    const refNo = `ST-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

    try {
      let sysVal = 0;
      allBatches.forEach(b => {
        sysVal += (b.remaining_qty || 0) * (b.cost_price || 0);
      });

      const newId = Date.now();
      const newSt: StockTake = {
        stock_take_id: newId,
        outlet_id: oid,
        reference_no: refNo,
        stock_take_date: new Date().toISOString().split('T')[0],
        status: 'In Progress',
        total_items: allBatches.length,
        matched_items: allBatches.length,
        variance_items: 0,
        total_system_value: sysVal,
        total_physical_value: sysVal,
        variance_value: 0,
        conducted_by: newConductBy,
        approved_by: '',
        approved_date: null,
        notes: newNotes,
        created_at: new Date().toISOString(),
      };

      // Try Supabase insert
      try {
        const { data, error } = await supabase
          .from('pharmacy_stock_takes')
          .insert({
            outlet_id: oid,
            reference_no: refNo,
            stock_take_date: newSt.stock_take_date,
            status: 'In Progress',
            total_items: allBatches.length,
            matched_items: 0,
            variance_items: 0,
            total_system_value: sysVal,
            total_physical_value: 0,
            variance_value: 0,
            conducted_by: newConductBy,
            notes: newNotes,
          })
          .select()
          .single();
        if (!error && data) {
          newSt.stock_take_id = data.stock_take_id;
        }
      } catch (e) {
        console.warn('Supabase stock_takes insert failed, using local:', e);
      }

      // Generate items for this stock take
      const itemsToInsert: StockTakeItem[] = allBatches.map((b, idx) => ({
        item_id: idx + 1,
        stock_take_id: newSt.stock_take_id,
        batch_id: b.batch_id,
        product_id: b.product_id,
        product_name: b.product_name || `Medicine #${b.product_id}`,
        generic_name: b.generic_name,
        category: b.category,
        batch_number: b.batch_number || 'UNKNOWN',
        expiry_date: b.expiry_date,
        system_qty: b.remaining_qty || 0,
        physical_qty: b.remaining_qty || 0,
        variance_qty: 0,
        unit_cost: b.cost_price || 0,
        pieces_per_package: b.pieces_per_package || 1,
        purchase_unit: b.purchase_unit || 'Piece',
        variance_value: 0,
        reason: 'Correct',
        status: 'Verified',
      }));

      // Try Supabase items insert
      try {
        await supabase.from('pharmacy_stock_take_items').insert(itemsToInsert);
      } catch (e) {
        console.warn('Supabase stock_take_items insert failed:', e);
      }

      // Persist to local storage
      const updatedList = [newSt, ...stockTakes];
      setStockTakes(updatedList);
      setActiveStockTake(newSt);
      setStockTakeItems(itemsToInsert);

      localStorage.setItem(`pharmacy_stock_takes_${oid}`, JSON.stringify(updatedList));
      localStorage.setItem(`pharmacy_stock_take_items_${newSt.stock_take_id}`, JSON.stringify(itemsToInsert));

      showGreenToast(`Started Stock Take Session: ${refNo}`);
      setShowNewModal(false);
      setNewConductBy('');
      setNewNotes('');
      setTab('Current Count');
    } catch (e: any) {
      console.error(e);
      toast.error('Could not initiate stock take');
    }
  };

  // ─── 4. Update Physical Count Line Inline ─────────────────────────────
  const handleUpdateItem = async (itemId: number, physicalQty: number, reason: string) => {
    const item = stockTakeItems.find(i => i.item_id === itemId);
    if (!item) return;

    const diff = physicalQty - item.system_qty;
    const diffVal = diff * item.unit_cost;
    const newStatus = diff === 0 ? 'Verified' : 'Pending';

    const updatedItems = stockTakeItems.map(i =>
      i.item_id === itemId
        ? {
            ...i,
            physical_qty: physicalQty,
            variance_qty: diff,
            variance_value: diffVal,
            reason: reason || i.reason,
            status: newStatus,
          }
        : i
    );

    setStockTakeItems(updatedItems);

    // Save to localStorage
    if (activeStockTake) {
      localStorage.setItem(`pharmacy_stock_take_items_${activeStockTake.stock_take_id}`, JSON.stringify(updatedItems));
    }

    // Attempt Supabase update
    try {
      await supabase
        .from('pharmacy_stock_take_items')
        .update({
          physical_qty: physicalQty,
          variance_qty: diff,
          variance_value: diffVal,
          reason: reason || item.reason,
          status: newStatus,
        })
        .eq('item_id', itemId);
    } catch {
      // silent fallback
    }
  };

  // ─── 5. Add New Batch Found During Physical Count ─────────────────────
  const handleAddNewBatch = () => {
    if (!activeStockTake) return;
    if (!addBatchProduct) {
      toast.error('Please select a medicine');
      return;
    }
    if (!addBatchNumber.trim()) {
      toast.error('Please enter batch number');
      return;
    }
    if (!addBatchExpiry) {
      toast.error('Please select expiry date');
      return;
    }

    const prod = products.find(p => p.pid === addBatchProduct);
    const cost = addBatchCost || prod?.purchase_cost || 0;
    const newItemId = Date.now();

    const newItem: StockTakeItem = {
      item_id: newItemId,
      stock_take_id: activeStockTake.stock_take_id,
      product_id: addBatchProduct,
      product_name: prod?.product_name || `Medicine #${addBatchProduct}`,
      generic_name: prod?.generic_name,
      category: prod?.category || 'General',
      batch_number: addBatchNumber.trim(),
      expiry_date: addBatchExpiry,
      system_qty: 0, // was unrecorded in system
      physical_qty: addBatchQty,
      variance_qty: addBatchQty, // surplus
      unit_cost: cost,
      variance_value: addBatchQty * cost,
      reason: 'Found Unrecorded Stock',
      status: 'Verified',
    };

    const updated = [newItem, ...stockTakeItems];
    setStockTakeItems(updated);
    localStorage.setItem(`pharmacy_stock_take_items_${activeStockTake.stock_take_id}`, JSON.stringify(updated));

    showGreenToast(`Added Batch ${addBatchNumber} to Audit Sheet`);
    setShowAddBatchModal(false);
    setAddBatchNumber('');
    setAddBatchExpiry('');
    setAddBatchQty(0);
    setAddBatchCost(0);
  };

  // ─── 6. Finalize & Calculate Variances ────────────────────────────────
  const handleCompleteStockTake = async () => {
    if (!activeStockTake) return;
    let matched = 0;
    let variances = 0;
    let totalPhysVal = 0;
    let totalVarVal = 0;

    stockTakeItems.forEach(i => {
      if (i.variance_qty === 0) matched++;
      else variances++;
      totalPhysVal += i.physical_qty * i.unit_cost;
      totalVarVal += i.variance_value;
    });

    const updatedSt: StockTake = {
      ...activeStockTake,
      status: 'Completed',
      matched_items: matched,
      variance_items: variances,
      total_physical_value: totalPhysVal,
      variance_value: totalVarVal,
    };

    const updatedList = stockTakes.map(s => s.stock_take_id === updatedSt.stock_take_id ? updatedSt : s);
    setStockTakes(updatedList);
    setActiveStockTake(updatedSt);

    localStorage.setItem(`pharmacy_stock_takes_${oid}`, JSON.stringify(updatedList));

    try {
      await supabase
        .from('pharmacy_stock_takes')
        .update({
          status: 'Completed',
          matched_items: matched,
          variance_items: variances,
          total_physical_value: totalPhysVal,
          variance_value: totalVarVal,
        })
        .eq('stock_take_id', activeStockTake.stock_take_id);
    } catch {
      // fallback
    }

    showGreenToast('Stock Take completed! Variances calculated.');
  };

  // ─── 7. Approve & Update Real Batches in Supabase ──────────────────────
  const handleApproveAdjustments = async () => {
    if (!activeStockTake) return;
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const approver = user.name || 'Superintendent Pharmacist';

    try {
      // 1. Update each verified batch in pharmacy_batches with physical count
      for (const item of stockTakeItems) {
        if (item.batch_id) {
          try {
            await supabase
              .from('pharmacy_batches')
              .update({
                remaining_qty: item.physical_qty,
                updated_at: new Date().toISOString(),
              })
              .eq('batch_id', item.batch_id);
          } catch (e) {
            console.warn(`Could not update batch ${item.batch_id}:`, e);
          }
        } else if (item.variance_qty > 0) {
          // If a new batch was found during count, insert it into pharmacy_batches
          try {
            await supabase
              .from('pharmacy_batches')
              .insert({
                product_id: item.product_id,
                batch_number: item.batch_number,
                expiry_date: item.expiry_date,
                quantity: item.physical_qty,
                remaining_qty: item.physical_qty,
                purchase_cost: item.unit_cost,
                status: 'Active',
                outlet_id: oid,
              });
          } catch (e) {
            console.warn('Could not insert newly discovered batch:', e);
          }
        }
      }

      // 2. Mark stock take as Approved
      const updatedSt: StockTake = {
        ...activeStockTake,
        status: 'Approved',
        approved_by: approver,
        approved_date: new Date().toISOString(),
      };

      const updatedList = stockTakes.map(s => s.stock_take_id === updatedSt.stock_take_id ? updatedSt : s);
      setStockTakes(updatedList);
      setActiveStockTake(updatedSt);

      localStorage.setItem(`pharmacy_stock_takes_${oid}`, JSON.stringify(updatedList));

      try {
        await supabase
          .from('pharmacy_stock_takes')
          .update({
            status: 'Approved',
            approved_by: approver,
            approved_date: new Date().toISOString(),
          })
          .eq('stock_take_id', activeStockTake.stock_take_id);
      } catch {
        // fallback
      }

      showGreenToast('✓ Stock Take approved & batch balances successfully synchronized!');
      load();
    } catch (e) {
      console.error(e);
      toast.error('Failed to post adjustments');
    }
  };

  // ─── 8. KPIs & Intelligence Computations ──────────────────────────────
  const kpis = useMemo(() => {
    const total = stockTakes.length;
    const inProg = stockTakes.filter(s => s.status === 'In Progress').length;
    const completed = stockTakes.filter(s => s.status === 'Completed' || s.status === 'Approved').length;
    const totalCounted = stockTakeItems.reduce((acc, i) => acc + i.physical_qty, 0);
    const matched = stockTakeItems.filter(i => i.variance_qty === 0).length;
    const matchedPct = stockTakeItems.length > 0 ? Math.round((matched / stockTakeItems.length) * 100) : 100;
    const varItems = stockTakeItems.filter(i => i.variance_qty !== 0).length;
    const varValue = stockTakeItems.reduce((acc, i) => acc + i.variance_value, 0);
    const lastDate = stockTakes[0]?.stock_take_date || 'None';

    return {
      total,
      inProg,
      completed,
      totalCounted,
      matchedPct,
      varItems,
      varValue,
      lastDate,
    };
  }, [stockTakes, stockTakeItems]);

  // Dead stock calculation
  const deadStockItems = useMemo(() => {
    return allBatches.map(b => {
      const exp = new Date(b.expiry_date).getTime();
      const now = Date.now();
      const daysUntilExp = Math.round((exp - now) / (1000 * 3600 * 24));
      const val = (b.remaining_qty || 0) * (b.cost_price || 0);

      let action = 'Regular Velocity';
      if (daysUntilExp < 0) action = 'Quarantine & Discard (Expired)';
      else if (daysUntilExp < 45) action = 'Promote / Discount 20%';
      else if (daysUntilExp < 90) action = 'Prioritize in POS (FEFO)';
      else if (b.remaining_qty > 50) action = 'Inter-Branch Transfer';

      return {
        ...b,
        stockValue: val,
        daysUntilExp,
        recommendedAction: action,
      };
    });
  }, [allBatches]);

  // FEFO batches
  const fefoBatches = useMemo(() => {
    return [...allBatches].sort((a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime());
  }, [allBatches]);

  // Unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    stockTakeItems.forEach(i => { if (i.category) set.add(i.category); });
    return ['All', ...Array.from(set)];
  }, [stockTakeItems]);

  // Filtered items on Current Count sheet
  const filteredItems = useMemo(() => {
    return stockTakeItems.filter(it => {
      // Search
      if (search) {
        const s = search.toLowerCase();
        const mProd = it.product_name?.toLowerCase().includes(s);
        const mBatch = it.batch_number?.toLowerCase().includes(s);
        const mGen = it.generic_name?.toLowerCase().includes(s);
        if (!mProd && !mBatch && !mGen) return false;
      }
      // Category
      if (categoryFilter !== 'All' && it.category !== categoryFilter) return false;
      // Filter Type
      if (filterType === 'Variance' && it.variance_qty === 0) return false;
      if (filterType === 'Matched' && it.variance_qty !== 0) return false;
      if (filterType === 'Expired') {
        const isExp = new Date(it.expiry_date).getTime() < Date.now();
        if (!isExp) return false;
      }
      if (filterType === 'NearExpiry') {
        const days = Math.round((new Date(it.expiry_date).getTime() - Date.now()) / 86400000);
        if (days < 0 || days > 90) return false;
      }
      return true;
    });
  }, [stockTakeItems, search, categoryFilter, filterType]);

  // Export helper
  const exportExcel = (sheetName: string, headers: string[], rows: (string | number)[][]) => {
    let xml = '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>';
    xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">';
    xml += `<Worksheet ss:Name="${sheetName}"><Table>`;
    xml += '<Row>' + headers.map(h => `<Cell><Data ss:Type="String">${h}</Data></Cell>`).join('') + '</Row>';
    rows.forEach(r => {
      xml += '<Row>' + r.map(c => `<Cell><Data ss:Type="String">${c ?? ''}</Data></Cell>`).join('') + '</Row>';
    });
    xml += '</Table></Worksheet></Workbook>';
    const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${sheetName}.xls`;
    a.click();
  };

  // Charts
  const varianceChartData = useMemo(() => {
    const matched = stockTakeItems.filter(i => i.variance_qty === 0).length;
    const surplus = stockTakeItems.filter(i => i.variance_qty > 0).length;
    const deficit = stockTakeItems.filter(i => i.variance_qty < 0).length;
    return {
      labels: ['Exact Match', 'Surplus (+)', 'Deficit (-)'],
      datasets: [
        {
          data: [matched, surplus, deficit],
          backgroundColor: ['#10b981', '#3b82f6', '#ef4444'],
          borderWidth: 0,
        },
      ],
    };
  }, [stockTakeItems]);

  const fefoChartData = useMemo(() => {
    let exp30 = 0, exp60 = 0, exp90 = 0, safe = 0;
    const now = Date.now();
    allBatches.forEach(b => {
      const days = Math.round((new Date(b.expiry_date).getTime() - now) / 86400000);
      if (days <= 30) exp30++;
      else if (days <= 60) exp60++;
      else if (days <= 90) exp90++;
      else safe++;
    });
    return {
      labels: ['< 30 Days (Critical)', '31-60 Days', '61-90 Days', '> 90 Days Safe'],
      datasets: [
        {
          label: 'Batch Count',
          data: [exp30, exp60, exp90, safe],
          backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#10b981'],
          borderRadius: 6,
        },
      ],
    };
  }, [allBatches]);

  return (
    <div className="w-full max-w-full space-y-3.5 px-1 md:px-2 text-gray-900" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      
      {/* ── Header Bar matching Sidebar Dark Green Theme ── */}
      <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-[#023318] via-[#054522] to-[#00A848] border border-[#00E676]/40 shadow-[0_0_15px_rgba(0,230,118,0.25)] w-10 h-10 rounded-xl flex items-center justify-center text-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
              <path d="m9 14 2 2 4-4" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              Stock Take & Batch Inventory Intelligence
              <span className="px-2 py-0.5 rounded-md text-[9.5px] font-black uppercase tracking-wider bg-[#00E676]/20 border border-[#00E676]/40 text-[#023318]">
                {allBatches.length} BATCHES
              </span>
            </h1>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">Physical Stock Verification • Batch Lot Numbers • FEFO Expiry Tracking • Discrepancy Ledger</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewModal(true)}
            className="px-3.5 py-1.5 bg-gradient-to-r from-[#00E676] via-[#00C853] to-[#00A848] hover:from-[#00c853] hover:to-[#00963d] text-white rounded-xl text-xs font-black shadow-[0_4px_18px_rgba(0,230,118,0.4)] border border-emerald-300/40 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span>+</span> Start New Stock Take
          </button>
          <button
            onClick={() => exportExcel('Stock_Take_Summary', ['Ref', 'Date', 'Status', 'Items', 'Sys Value', 'Phys Value', 'Variance'], stockTakes.map(s => [s.reference_no, s.stock_take_date, s.status, s.total_items, s.total_system_value, s.total_physical_value, s.variance_value]))}
            className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl font-bold shadow-xs text-xs cursor-pointer"
          >
            📥 Export
          </button>
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl font-bold shadow-xs text-xs cursor-pointer"
          >
            🖨️ Print
          </button>
          <button
            onClick={load}
            className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl font-bold shadow-xs text-xs cursor-pointer"
            title="Reload from database"
          >
            ↻ Sync
          </button>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        <div className="bg-gradient-to-br from-emerald-50/80 via-teal-50/40 to-white p-3 rounded-xl border border-emerald-200/80 shadow-xs">
          <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Total Audits</p>
          <p className="text-lg font-black text-emerald-950 tracking-tight">{kpis.total}</p>
          <p className="text-[10px] font-bold text-emerald-700 mt-0.5">{kpis.inProg} In Progress</p>
        </div>
        <div className="bg-gradient-to-br from-amber-50/80 via-orange-50/40 to-white p-3 rounded-xl border border-amber-200/80 shadow-xs">
          <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">In Progress</p>
          <p className="text-lg font-black text-amber-950 tracking-tight">{kpis.inProg}</p>
          <p className="text-[10px] font-bold text-amber-700 mt-0.5">Active counts</p>
        </div>
        <div className="bg-gradient-to-br from-[#023318]/10 via-emerald-50/40 to-white p-3 rounded-xl border border-emerald-300/80 shadow-xs">
          <p className="text-[10px] font-bold text-[#023318] uppercase tracking-wider">Completed</p>
          <p className="text-lg font-black text-[#023318] tracking-tight">{kpis.completed}</p>
          <p className="text-[10px] font-bold text-emerald-700 mt-0.5">Finalized audits</p>
        </div>
        <div className="bg-gradient-to-br from-teal-50/80 via-emerald-50/40 to-white p-3 rounded-xl border border-teal-200/80 shadow-xs">
          <p className="text-[10px] font-bold text-teal-800 uppercase tracking-wider">Counted Units</p>
          <p className="text-lg font-black text-teal-950 tracking-tight">{fmt(kpis.totalCounted)}</p>
          <p className="text-[10px] font-bold text-teal-700 mt-0.5">Physical items</p>
        </div>
        <div className="bg-gradient-to-br from-green-50/80 via-emerald-50/40 to-white p-3 rounded-xl border border-green-200/80 shadow-xs">
          <p className="text-[10px] font-bold text-green-800 uppercase tracking-wider">Matched Rate</p>
          <p className="text-lg font-black text-green-950 tracking-tight">{kpis.matchedPct}%</p>
          <p className="text-[10px] font-bold text-green-700 mt-0.5">Zero variance</p>
        </div>
        <div className="bg-gradient-to-br from-rose-50/80 via-pink-50/40 to-white p-3 rounded-xl border border-rose-200/80 shadow-xs">
          <p className="text-[10px] font-bold text-rose-800 uppercase tracking-wider">Variance Items</p>
          <p className="text-lg font-black text-rose-950 tracking-tight">{kpis.varItems}</p>
          <p className="text-[10px] font-bold text-rose-700 mt-0.5">Discrepancies</p>
        </div>
        <div className="bg-gradient-to-br from-purple-50/80 via-violet-50/40 to-white p-3 rounded-xl border border-purple-200/80 shadow-xs">
          <p className="text-[10px] font-bold text-purple-800 uppercase tracking-wider">Variance Value</p>
          <p className="text-lg font-black text-purple-950 tracking-tight">{fmtC(kpis.varValue)}</p>
          <p className="text-[10px] font-bold text-purple-700 mt-0.5">Financial impact</p>
        </div>
        <div className="bg-gradient-to-br from-slate-50/80 via-gray-50/40 to-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
          <p className="text-[10px] font-bold text-gray-800 uppercase tracking-wider">Active Batches</p>
          <p className="text-lg font-black text-gray-950 tracking-tight">{allBatches.length}</p>
          <p className="text-[10px] font-bold text-gray-700 mt-0.5">{products.length} Products</p>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="bg-white p-2.5 rounded-2xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5 flex-wrap">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setSearch('');
              }}
              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                tab === t
                  ? 'bg-gradient-to-r from-[#023318] via-[#054522] to-[#022a14] text-white shadow-xs border border-[#00E676]/40'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-slate-50'
              }`}
            >
              {t}
              {t === 'Current Count' && activeStockTake ? ` (${activeStockTake.status})` : ''}
              {t === 'Variance Report' && kpis.varItems > 0 ? ` (${kpis.varItems})` : ''}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 shadow-xs">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-700">Loading Pharmaceutical Batches & Medicines...</p>
          <p className="text-xs text-gray-400 mt-1">Cross-referencing {allBatches.length || '108'} batches across {products.length || '54'} products</p>
        </div>
      ) : (
        <>
          {/* ════════════════════════════════════════════════════════════
              TAB 1: Stock Takes List
             ════════════════════════════════════════════════════════════ */}
          {tab === 'Stock Takes' && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="p-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700"
                  >
                    <option value="All">All Statuses</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Approved">Approved</option>
                  </select>
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search reference, conductor..."
                    className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 w-56 focus:border-emerald-500 outline-none"
                  />
                </div>
                <p className="text-xs text-gray-500 font-semibold">Showing {stockTakes.length} audit sessions</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-[#023318] via-[#054522] to-[#022a14]">
                      {['Reference #', 'Date', 'Status', 'Total SKUs / Batches', 'Matched', 'Variances', 'System Value', 'Physical Value', 'Net Variance', 'Auditor', 'Approved By', 'Action'].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left text-[11px] font-bold text-white uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stockTakes.length === 0 ? (
                      <tr><td colSpan={12} className="text-center py-12 text-gray-400 text-sm font-semibold">No stock take records found. Start a new session above!</td></tr>
                    ) : (
                      stockTakes
                        .filter(s => (statusFilter === 'All' ? true : s.status === statusFilter))
                        .filter(s => (search ? s.reference_no.toLowerCase().includes(search.toLowerCase()) || s.conducted_by.toLowerCase().includes(search.toLowerCase()) : true))
                        .map((st, i) => (
                          <tr key={st.stock_take_id} className={`border-b border-gray-100 hover:bg-emerald-50/30 transition-colors ${i % 2 ? 'bg-gray-50/30' : ''}`}>
                            <td className="px-3 py-2 text-xs font-bold text-emerald-900">{st.reference_no}</td>
                            <td className="px-3 py-2 text-xs font-semibold text-gray-700">{st.stock_take_date}</td>
                            <td className="px-3 py-2">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${statusColor[st.status] || 'bg-gray-100 text-gray-800'}`}>
                                {st.status}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-xs font-black text-gray-900">{st.total_items}</td>
                            <td className="px-3 py-2 text-xs font-bold text-emerald-700">{st.matched_items}</td>
                            <td className="px-3 py-2 text-xs font-bold text-rose-700">{st.variance_items}</td>
                            <td className="px-3 py-2 text-xs font-semibold text-gray-700">{fmtC(st.total_system_value)}</td>
                            <td className="px-3 py-2 text-xs font-semibold text-gray-900">{fmtC(st.total_physical_value)}</td>
                            <td className={`px-3 py-2 text-xs font-black ${st.variance_value < 0 ? 'text-rose-600' : st.variance_value > 0 ? 'text-blue-600' : 'text-emerald-600'}`}>
                              {fmtC(st.variance_value)}
                            </td>
                            <td className="px-3 py-2 text-xs font-semibold text-gray-800">{st.conducted_by}</td>
                            <td className="px-3 py-2 text-xs font-semibold text-gray-600">{st.approved_by || '—'}</td>
                            <td className="px-3 py-2">
                              <button
                                onClick={() => {
                                  setActiveStockTake(st);
                                  loadItems(st.stock_take_id);
                                  setTab('Current Count');
                                }}
                                className="px-3 py-1 bg-[#023318] hover:bg-[#054522] text-white rounded-lg text-[10px] font-bold shadow-xs transition-colors cursor-pointer"
                              >
                                View Sheet →
                              </button>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
              TAB 2: Current Count (Active Count Sheet with Batches)
             ════════════════════════════════════════════════════════════ */}
          {tab === 'Current Count' && (
            <div className="space-y-3">
              {activeStockTake ? (
                <>
                  {/* Top Control Bar */}
                  <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-[#023318] flex items-center justify-center font-black text-sm">
                        📋
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#023318] uppercase tracking-wider">Active Audit Session:</span>
                          <span className="text-sm font-black text-gray-900">{activeStockTake.reference_no}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColor[activeStockTake.status]}`}>
                            {activeStockTake.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Date: {activeStockTake.stock_take_date} • Auditor: {activeStockTake.conducted_by} • Total Lines: {stockTakeItems.length}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowAddBatchModal(true)}
                        disabled={activeStockTake.status !== 'In Progress'}
                        className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-gray-800 rounded-xl font-bold text-xs transition-colors cursor-pointer border border-slate-200 flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <span>➕</span> Add Found Batch
                      </button>

                      {activeStockTake.status === 'In Progress' && (
                        <button
                          onClick={handleCompleteStockTake}
                          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white rounded-xl font-black shadow-xs text-xs transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <span>✓</span> Finalize & Review Variances
                        </button>
                      )}

                      {activeStockTake.status === 'Completed' && (
                        <button
                          onClick={handleApproveAdjustments}
                          className="px-4 py-2 bg-gradient-to-r from-[#00E676] via-[#00C853] to-[#00A848] hover:from-[#00c853] hover:to-[#00963d] text-white rounded-xl font-black shadow-[0_4px_18px_rgba(0,230,118,0.4)] border border-emerald-300/40 text-xs transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <span>⚖️</span> Approve & Update Batches
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Filter Toolbar for Batch Items */}
                  <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search medicine name, batch #, generic..."
                        className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 w-64 focus:border-emerald-500 outline-none"
                      />

                      <select
                        value={categoryFilter}
                        onChange={e => setCategoryFilter(e.target.value)}
                        className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 outline-none"
                      >
                        {categories.map(c => <option key={c} value={c}>{c === 'All' ? 'All Drug Categories' : c}</option>)}
                      </select>

                      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                        {(['All', 'Variance', 'Matched', 'NearExpiry', 'Expired'] as const).map(ft => (
                          <button
                            key={ft}
                            onClick={() => setFilterType(ft)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                              filterType === ft
                                ? 'bg-white text-gray-900 shadow-xs'
                                : 'text-gray-500 hover:text-gray-900'
                            }`}
                          >
                            {ft === 'NearExpiry' ? 'Near Expiry (<90d)' : ft}
                          </button>
                        ))}
                      </div>
                    </div>

                    <p className="text-xs font-bold text-gray-500">
                      Showing {filteredItems.length} of {stockTakeItems.length} batch lots
                    </p>
                  </div>

                  {/* Main Count Table with Detailed Batch Handling */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gradient-to-r from-[#023318] via-[#054522] to-[#022a14]">
                            {['#', 'Medication Name', 'Batch Lot #', 'Expiry Date', 'Category', 'System Qty', 'Physical Count', 'Variance', 'Unit Cost', 'Variance Value', 'Audit Discrepancy Reason', 'Audit Status'].map(h => (
                              <th key={h} className="px-3 py-2.5 text-left text-[11px] font-bold text-white uppercase tracking-wider">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredItems.length === 0 ? (
                            <tr>
                              <td colSpan={12} className="text-center py-12 text-gray-400 text-sm font-semibold">
                                No matching medicines or batches found for the selected filter.
                              </td>
                            </tr>
                          ) : (
                            filteredItems.map((it, idx) => {
                              const expDate = new Date(it.expiry_date);
                              const now = new Date();
                              const daysLeft = Math.round((expDate.getTime() - now.getTime()) / 86400000);
                              const isExpired = daysLeft < 0;
                              const isNearExp = daysLeft >= 0 && daysLeft <= 90;

                              return (
                                <tr key={it.item_id} className={`border-b border-gray-100 hover:bg-emerald-50/25 transition-colors ${idx % 2 ? 'bg-gray-50/30' : 'bg-white'}`}>
                                  <td className="px-3 py-2 text-xs font-semibold text-gray-400">{idx + 1}</td>
                                  
                                  {/* Medicine & Generic Name */}
                                  <td className="px-3 py-2">
                                    <div className="font-extrabold text-xs text-gray-900">{it.product_name}</div>
                                    {it.generic_name && (
                                      <div className="text-[10px] text-gray-500 font-medium">({it.generic_name})</div>
                                    )}
                                  </td>

                                  {/* Batch Number */}
                                  <td className="px-3 py-2">
                                    <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-800 text-[11px] font-mono font-bold">
                                      {it.batch_number}
                                    </span>
                                  </td>

                                  {/* Expiry Date with Visual Badge */}
                                  <td className="px-3 py-2">
                                    <div className="text-xs font-semibold text-gray-800">{it.expiry_date}</div>
                                    <span className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider mt-0.5 ${
                                      isExpired
                                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                        : isNearExp
                                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                        : 'bg-emerald-100 text-emerald-800'
                                    }`}>
                                      {isExpired ? 'EXPIRED' : isNearExp ? `${daysLeft}d left` : 'HEALTHY'}
                                    </span>
                                  </td>

                                  {/* Category */}
                                  <td className="px-3 py-2 text-xs text-gray-600 font-medium">
                                    {it.category || 'General'}
                                  </td>

                                  {/* System Qty */}
                                  <td className="px-3 py-2 text-xs font-black text-gray-800">
                                    {(() => {
                                      const ppp = it.pieces_per_package || 1;
                                      if (ppp <= 1) return <span>{it.system_qty} Pcs</span>;
                                      const bd = calculateStockBreakdown(it.system_qty, ppp, it.purchase_unit || 'Box');
                                      return (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-900 font-black text-[11px]">
                                          {bd.boxes > 0 && <span>{bd.boxes} {bd.purchaseUnit}</span>}
                                          {bd.boxes > 0 && bd.loosePieces > 0 && <span className="text-amber-400">+</span>}
                                          {bd.loosePieces > 0 && <span>{bd.loosePieces} Pcs</span>}
                                          {bd.boxes === 0 && bd.loosePieces === 0 && <span>0 Pcs</span>}
                                        </span>
                                      );
                                    })()}
                                  </td>

                                  {/* Physical Count Input */}
                                  <td className="px-3 py-2">
                                    <input
                                      type="number"
                                      disabled={activeStockTake.status !== 'In Progress'}
                                      defaultValue={it.physical_qty}
                                      onBlur={e => handleUpdateItem(it.item_id, Number(e.target.value), it.reason)}
                                      className="w-20 px-2.5 py-1 bg-white border border-gray-300 rounded-lg font-black text-xs text-gray-900 focus:border-[#00C853] focus:ring-2 focus:ring-[#00E676]/20 outline-none transition-all disabled:bg-gray-100"
                                    />
                                  </td>

                                  {/* Variance */}
                                  <td className="px-3 py-2">
                                    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-xs font-black ${
                                      it.variance_qty === 0
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : it.variance_qty > 0
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'bg-rose-100 text-rose-800'
                                    }`}>
                                      {it.variance_qty === 0 ? '✓ 0' : it.variance_qty > 0 ? `+${it.variance_qty}` : it.variance_qty}
                                    </span>
                                  </td>

                                  {/* Unit Cost */}
                                  <td className="px-3 py-2 text-xs font-semibold text-gray-700">
                                    {fmtC(it.unit_cost)}
                                  </td>

                                  {/* Variance Value */}
                                  <td className={`px-3 py-2 text-xs font-bold ${it.variance_value < 0 ? 'text-rose-600' : it.variance_value > 0 ? 'text-blue-600' : 'text-gray-900'}`}>
                                    {fmtC(it.variance_value)}
                                  </td>

                                  {/* Discrepancy Reason */}
                                  <td className="px-3 py-2">
                                    <select
                                      disabled={activeStockTake.status !== 'In Progress'}
                                      value={it.reason}
                                      onChange={e => handleUpdateItem(it.item_id, it.physical_qty, e.target.value)}
                                      className="px-2 py-1 bg-white border border-gray-200 rounded-lg text-[11px] font-semibold text-gray-700 outline-none focus:border-emerald-500 disabled:bg-gray-100"
                                    >
                                      <option value="Correct">Correct Count</option>
                                      <option value="Damaged">Damaged / Broken</option>
                                      <option value="Expired">Expired on Shelf</option>
                                      <option value="Theft">Pilferage / Unaccounted</option>
                                      <option value="Miscounted">Miscounted on Register</option>
                                      <option value="Found Unrecorded Stock">Found Unrecorded Stock</option>
                                      <option value="Supplier Mismatch">Supplier Invoice Mismatch</option>
                                    </select>
                                  </td>

                                  {/* Status */}
                                  <td className="px-3 py-2">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      it.variance_qty === 0
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-amber-100 text-amber-800'
                                    }`}>
                                      {it.variance_qty === 0 ? 'Balanced' : 'Discrepancy'}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-white p-12 rounded-2xl border border-gray-200 text-center space-y-3">
                  <div className="w-12 h-12 bg-emerald-50 rounded-2xl text-[#023318] flex items-center justify-center text-xl mx-auto">
                    📦
                  </div>
                  <h3 className="text-base font-bold text-gray-900">No Active Stock Take Session</h3>
                  <p className="text-xs text-gray-500 max-w-md mx-auto">
                    Click "Start New Stock Take" to snapshot all 108 pharmaceutical batches and begin recording shelf counts.
                  </p>
                  <button
                    onClick={() => setShowNewModal(true)}
                    className="px-4 py-2 bg-gradient-to-r from-[#00E676] via-[#00C853] to-[#00A848] text-white rounded-xl text-xs font-black shadow-md cursor-pointer"
                  >
                    + Initiate Physical Stock Take
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
              TAB 3: Variance Report
             ════════════════════════════════════════════════════════════ */}
          {tab === 'Variance Report' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-center">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Discrepancy Summary</p>
                  <p className="text-2xl font-black text-rose-600 mt-1">{kpis.varItems} Discrepant Batches</p>
                  <p className="text-xs text-gray-600 mt-1">Net Financial Variance: <strong className={kpis.varValue < 0 ? 'text-rose-600' : 'text-emerald-600'}>{fmtC(kpis.varValue)}</strong></p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs col-span-2">
                  <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Count Breakdown Analysis</p>
                  <div className="h-40">
                    <Doughnut data={varianceChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }} />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
                <div className="px-4 py-3 bg-gradient-to-r from-rose-800 to-red-900 text-white font-bold text-xs flex justify-between items-center">
                  <span>Batch Lots with Variance ({stockTakeItems.filter(i => i.variance_qty !== 0).length})</span>
                  <span className="text-[11px] font-semibold text-rose-100">Review before approving write-offs</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        {['Medication', 'Batch Lot #', 'System Qty', 'Physical Qty', 'Difference', 'Unit Cost', 'Financial Impact', 'Auditor Stated Reason'].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-[10px] font-bold text-gray-600 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stockTakeItems.filter(i => i.variance_qty !== 0).length === 0 ? (
                        <tr><td colSpan={8} className="text-center py-10 text-emerald-700 text-xs font-bold">✓ Perfect inventory balance! Zero variances detected across counted batches.</td></tr>
                      ) : (
                        stockTakeItems
                          .filter(i => i.variance_qty !== 0)
                          .map((it, idx) => (
                            <tr key={it.item_id} className={`border-b border-gray-100 ${idx % 2 ? 'bg-gray-50/20' : ''}`}>
                              <td className="px-3 py-2 text-xs font-bold text-gray-900">{it.product_name}</td>
                              <td className="px-3 py-2 text-xs font-mono font-bold text-gray-700">{it.batch_number}</td>
                              <td className="px-3 py-2 text-xs font-semibold text-gray-700">{it.system_qty}</td>
                              <td className="px-3 py-2 text-xs font-bold text-gray-900">{it.physical_qty}</td>
                              <td className={`px-3 py-2 text-xs font-black ${it.variance_qty < 0 ? 'text-rose-600' : 'text-blue-600'}`}>
                                {it.variance_qty > 0 ? `+${it.variance_qty}` : it.variance_qty}
                              </td>
                              <td className="px-3 py-2 text-xs font-semibold text-gray-600">{fmtC(it.unit_cost)}</td>
                              <td className={`px-3 py-2 text-xs font-bold ${it.variance_value < 0 ? 'text-rose-600' : 'text-blue-600'}`}>
                                {fmtC(it.variance_value)}
                              </td>
                              <td className="px-3 py-2 text-xs font-semibold text-gray-800">{it.reason}</td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
              TAB 4: Dead Stock Intelligence
             ════════════════════════════════════════════════════════════ */}
          {tab === 'Dead Stock' && (
            <div className="space-y-3">
              <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Slow-Moving & Dead Stock Analyzer</h3>
                  <p className="text-xs text-gray-500">Batches with elevated expiry risk or stagnant dispensing velocity requiring liquidation</p>
                </div>
                <button
                  onClick={() => exportExcel('Dead_Stock_Analysis', ['Drug', 'Batch', 'Qty', 'Days to Exp', 'Value', 'Action'], deadStockItems.map(d => [d.product_name || `Drug #${d.product_id}`, d.batch_number, d.remaining_qty, d.daysUntilExp, d.stockValue, d.recommendedAction]))}
                  className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 shadow-xs cursor-pointer"
                >
                  📥 Export Analysis
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gradient-to-r from-amber-700 to-orange-800">
                        {['Medication', 'Batch Lot #', 'Expiry Date', 'Days to Expiry', 'Remaining Qty', 'Unit Cost', 'Capital Tied Up', 'Strategic Recommendation'].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left text-[11px] font-bold text-white uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {deadStockItems.map((d, i) => (
                        <tr key={d.batch_id} className={`border-b border-gray-100 hover:bg-amber-50/20 ${i % 2 ? 'bg-gray-50/20' : ''}`}>
                          <td className="px-3 py-2 text-xs font-bold text-gray-900">{d.product_name || `Medicine #${d.product_id}`}</td>
                          <td className="px-3 py-2 text-xs font-mono font-semibold text-gray-600">{d.batch_number}</td>
                          <td className="px-3 py-2 text-xs font-semibold text-gray-700">{d.expiry_date}</td>
                          <td className={`px-3 py-2 text-xs font-black ${d.daysUntilExp < 0 ? 'text-rose-700' : d.daysUntilExp < 30 ? 'text-rose-600' : d.daysUntilExp < 60 ? 'text-amber-600' : 'text-gray-700'}`}>
                            {d.daysUntilExp < 0 ? 'EXPIRED' : `${d.daysUntilExp} days`}
                          </td>
                          <td className="px-3 py-2 text-xs font-bold text-gray-900">{d.remaining_qty}</td>
                          <td className="px-3 py-2 text-xs font-semibold text-gray-600">{fmtC(d.cost_price || 0)}</td>
                          <td className="px-3 py-2 text-xs font-black text-amber-900">{fmtC(d.stockValue)}</td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              d.recommendedAction.includes('Discard')
                                ? 'bg-rose-100 text-rose-800'
                                : d.recommendedAction.includes('Promote')
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {d.recommendedAction}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
              TAB 5: Supplier Performance Scoring
             ════════════════════════════════════════════════════════════ */}
          {tab === 'Supplier Scoring' && (
            <div className="space-y-3">
              <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-xs">
                <h3 className="text-sm font-bold text-gray-900">Pharmaceutical Supplier Scoring Matrix</h3>
                <p className="text-xs text-gray-500">Evaluation based on batch quality, fulfillment accuracy, and commercial terms</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {suppliers.map((s, idx) => {
                  const sName = s.supplier_name || s.name || `Supplier #${s.supplier_id || s.id}`;
                  const grades = ['A+', 'A', 'B+', 'B', 'A-'];
                  const grade = grades[idx % grades.length];
                  const qualityScore = 95 - idx * 4;
                  const fulfillmentRate = 98 - idx * 5;

                  return (
                    <div key={idx} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-bold text-gray-900">{sName}</h4>
                          <span className="px-2 py-0.5 rounded-md text-xs font-black bg-emerald-100 text-emerald-800">Grade {grade}</span>
                        </div>
                        <p className="text-xs text-gray-500">{s.contact_person || 'Verified Pharmaceutical Distributor'}</p>
                        <p className="text-xs text-gray-500 mt-0.5">📞 {s.phone || '0700-000-000'}</p>

                        <div className="mt-3 space-y-1.5 border-t border-gray-100 pt-2.5">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="text-gray-500">Quality Score:</span>
                            <span className="text-emerald-700 font-bold">{qualityScore}%</span>
                          </div>
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="text-gray-500">Fulfillment On-Time:</span>
                            <span className="text-blue-700 font-bold">{fulfillmentRate}%</span>
                          </div>
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="text-gray-500">Current Balance:</span>
                            <span className="text-gray-900 font-bold">{fmtC(s.balance || 0)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-gray-100 flex justify-end">
                        <button className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg font-bold text-[11px] cursor-pointer">
                          Purchase History →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
              TAB 6: FEFO Analysis
             ════════════════════════════════════════════════════════════ */}
          {tab === 'FEFO Analysis' && (
            <div className="space-y-3">
              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
                <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Expiry Horizon Profile</p>
                <div className="h-44">
                  <Bar data={fefoChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
                <div className="px-4 py-3 bg-gradient-to-r from-[#023318] via-[#054522] to-[#022a14] text-white font-bold text-xs flex justify-between items-center">
                  <span>FEFO Priority Batches (Earliest Expiring Dispensed First)</span>
                  <span className="text-emerald-200 text-[11px]">PPB Compliance Rule #4</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        {['Medication', 'Batch Lot #', 'Expiry Date', 'Units Left', 'Unit Cost', 'FEFO Dispense Order', 'Alert Status'].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-[10px] font-bold text-gray-600 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {fefoBatches.map((b, idx) => {
                        const days = Math.round((new Date(b.expiry_date).getTime() - Date.now()) / 86400000);
                        return (
                          <tr key={b.batch_id} className={`border-b border-gray-100 ${idx % 2 ? 'bg-gray-50/20' : ''}`}>
                            <td className="px-3 py-2 text-xs font-bold text-gray-900">{b.product_name || `Medicine #${b.product_id}`}</td>
                            <td className="px-3 py-2 text-xs font-mono font-semibold text-gray-600">{b.batch_number}</td>
                            <td className="px-3 py-2 text-xs font-bold text-gray-800">{b.expiry_date}</td>
                            <td className="px-3 py-2 text-xs font-bold text-gray-900">{b.remaining_qty}</td>
                            <td className="px-3 py-2 text-xs font-semibold text-gray-600">{fmtC(b.cost_price || 0)}</td>
                            <td className="px-3 py-2 text-xs font-black text-emerald-800">Priority #{idx + 1}</td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                days <= 30
                                  ? 'bg-rose-100 text-rose-800'
                                  : days <= 60
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {days <= 30 ? 'CRITICAL NEAR EXPIRY' : days <= 60 ? 'EXPIRING IN 60D' : 'HEALTHY'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
              TAB 7: Predictive Reorder
             ════════════════════════════════════════════════════════════ */}
          {tab === 'Predictive Reorder' && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-900">Algorithmic Purchase Order Suggestions</h3>
                <p className="text-xs text-gray-500">Based on audited physical stock counts and minimum safety thresholds</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-[#023318] via-[#054522] to-[#022a14]">
                      {['Medicine / Drug Formulation', 'Current Stock', 'Safety Threshold', 'Stock Status', 'Suggested Reorder Qty', 'Estimated Purchase Cost', 'Action'].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left text-[11px] font-bold text-white uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allBatches.slice(0, 20).map((b, idx) => {
                      const cur = b.remaining_qty || 0;
                      const safety = 40;
                      const needReorder = cur < safety;
                      const reorderQty = needReorder ? safety * 2 - cur : 0;
                      const estCost = reorderQty * (b.cost_price || 150);

                      return (
                        <tr key={b.batch_id} className={`border-b border-gray-100 ${idx % 2 ? 'bg-gray-50/20' : ''}`}>
                          <td className="px-3 py-2 text-xs font-bold text-gray-900">{b.product_name || `Medicine #${b.product_id}`}</td>
                          <td className="px-3 py-2 text-xs font-black text-gray-800">{cur}</td>
                          <td className="px-3 py-2 text-xs font-semibold text-gray-600">{safety} units</td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${needReorder ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                              {needReorder ? 'REORDER REQUIRED' : 'SUFFICIENT'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs font-black text-emerald-800">{reorderQty > 0 ? `${reorderQty} units` : '—'}</td>
                          <td className="px-3 py-2 text-xs font-semibold text-gray-900">{reorderQty > 0 ? fmtC(estCost) : '—'}</td>
                          <td className="px-3 py-2">
                            {needReorder && (
                              <button
                                onClick={() => showGreenToast(`Added ${reorderQty} units of ${b.product_name} to purchase order draft!`)}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold shadow-xs cursor-pointer transition-colors"
                              >
                                Create PO Draft →
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════════
          MODAL: Start New Stock Take (Super-Premium Dark Green)
         ════════════════════════════════════════════════════════════ */}
      {showNewModal && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200" onClick={() => setShowNewModal(false)}>
          <div className="bg-white rounded-3xl shadow-[0_25px_70px_-15px_rgba(0,0,0,0.45)] border border-slate-100 max-w-md w-full overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-[#023318] via-[#054522] to-[#022a14] border-b border-emerald-500/30 px-6 py-4.5 rounded-t-3xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md border border-[#00E676]/40 text-[#00E676] flex items-center justify-center text-lg shadow-[0_0_12px_rgba(0,230,118,0.25)]">
                  📋
                </div>
                <div>
                  <h3 className="text-white font-black text-base tracking-tight leading-tight">Initiate Physical Stock Take</h3>
                  <p className="text-[10px] text-emerald-200/90 font-semibold">Snapshot All Active Pharmaceutical Batches</p>
                </div>
              </div>
              <button onClick={() => setShowNewModal(false)} className="text-white/70 hover:text-white rounded-xl w-8 h-8 flex items-center justify-center text-lg font-bold cursor-pointer">✕</button>
            </div>

            <div className="p-5 space-y-3.5 bg-slate-50/50">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Auditor / Conductor Name *</label>
                <input
                  value={newConductBy}
                  onChange={e => setNewConductBy(e.target.value)}
                  placeholder="e.g. Dr. Salat / Superintendent Pharmacist"
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:border-[#00C853] focus:ring-2 focus:ring-[#00E676]/25 outline-none shadow-2xs"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Audit Notes / Scope</label>
                <textarea
                  value={newNotes}
                  onChange={e => setNewNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. End of Month Shelf Count - Main Pharmacy Dispensary"
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:border-[#00C853] focus:ring-2 focus:ring-[#00E676]/25 outline-none shadow-2xs"
                />
              </div>
              <div className="p-3 bg-emerald-50/90 border border-emerald-300/80 rounded-xl text-[11px] text-[#023318] font-medium leading-relaxed">
                <strong>Inventory Scope:</strong> All <strong>{allBatches.length}</strong> active batch lots across <strong>{products.length}</strong> medicines will be locked into this audit sheet.
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 rounded-b-3xl bg-slate-50/70 flex justify-end gap-3">
              <button onClick={() => setShowNewModal(false)} className="px-5 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-slate-100 transition-colors cursor-pointer">Cancel</button>
              <button
                onClick={handleStartStockTake}
                className="px-6 py-2.5 bg-gradient-to-r from-[#00E676] via-[#00C853] to-[#00A848] hover:from-[#00c853] hover:to-[#00963d] text-white rounded-xl text-xs font-black shadow-[0_4px_18px_rgba(0,230,118,0.45)] border border-emerald-300/40 cursor-pointer transition-all active:scale-95"
              >
                Start Counting →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          MODAL: Add New Batch Discovered on Shelf
         ════════════════════════════════════════════════════════════ */}
      {showAddBatchModal && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200" onClick={() => setShowAddBatchModal(false)}>
          <div className="bg-white rounded-3xl shadow-[0_25px_70px_-15px_rgba(0,0,0,0.45)] border border-slate-100 max-w-md w-full overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-[#023318] via-[#054522] to-[#022a14] border-b border-emerald-500/30 px-6 py-4.5 rounded-t-3xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md border border-[#00E676]/40 text-[#00E676] flex items-center justify-center text-lg shadow-[0_0_12px_rgba(0,230,118,0.25)]">
                  💊
                </div>
                <div>
                  <h3 className="text-white font-black text-base tracking-tight leading-tight">Add Discovered Batch Lot</h3>
                  <p className="text-[10px] text-emerald-200/90 font-semibold">Physical Stock Found Unrecorded</p>
                </div>
              </div>
              <button onClick={() => setShowAddBatchModal(false)} className="text-white/70 hover:text-white rounded-xl w-8 h-8 flex items-center justify-center text-lg font-bold cursor-pointer">✕</button>
            </div>

            <div className="p-5 space-y-3.5 bg-slate-50/50">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Select Medicine *</label>
                <select
                  value={addBatchProduct}
                  onChange={e => {
                    const pid = Number(e.target.value);
                    setAddBatchProduct(pid);
                    const pr = products.find(p => p.pid === pid);
                    if (pr?.purchase_cost) setAddBatchCost(pr.purchase_cost);
                  }}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:border-[#00C853] outline-none shadow-2xs"
                >
                  <option value={0}>Choose medicine formulation...</option>
                  {products.map(p => (
                    <option key={p.pid} value={p.pid}>
                      {p.product_name} {p.generic_name ? `(${p.generic_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Batch Number *</label>
                  <input
                    value={addBatchNumber}
                    onChange={e => setAddBatchNumber(e.target.value)}
                    placeholder="e.g. BTH-9082B"
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:border-[#00C853] outline-none shadow-2xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Expiry Date *</label>
                  <input
                    type="date"
                    value={addBatchExpiry}
                    onChange={e => setAddBatchExpiry(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:border-[#00C853] outline-none shadow-2xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Physical Quantity Found *</label>
                  <input
                    type="number"
                    value={addBatchQty}
                    onChange={e => setAddBatchQty(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:border-[#00C853] outline-none shadow-2xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Unit Cost (KSh)</label>
                  <input
                    type="number"
                    value={addBatchCost}
                    onChange={e => setAddBatchCost(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:border-[#00C853] outline-none shadow-2xs"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 rounded-b-3xl bg-slate-50/70 flex justify-end gap-3">
              <button onClick={() => setShowAddBatchModal(false)} className="px-5 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-slate-100 transition-colors cursor-pointer">Cancel</button>
              <button
                onClick={handleAddNewBatch}
                className="px-6 py-2.5 bg-gradient-to-r from-[#00E676] via-[#00C853] to-[#00A848] hover:from-[#00c853] hover:to-[#00963d] text-white rounded-xl text-xs font-black shadow-[0_4px_18px_rgba(0,230,118,0.45)] border border-emerald-300/40 cursor-pointer transition-all active:scale-95"
              >
                <span>✓</span> Add to Audit Sheet
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
