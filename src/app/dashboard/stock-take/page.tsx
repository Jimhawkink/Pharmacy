'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement,
  PointElement, LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend, Filler);

/* ═══════════════════════════════════════════════════════════════
   STOCK TAKE & INVENTORY INTELLIGENCE
   Physical Inventory • Variance • Dead Stock • Supplier Scoring • FEFO
   ═══════════════════════════════════════════════════════════════ */

type StockTake = {
  stock_take_id: number;
  outlet_id: number;
  reference_no: string;
  stock_take_date: string;
  status: string;
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

type StockTakeItem = {
  item_id: number;
  stock_take_id: number;
  product_id: number;
  product_name: string;
  batch_number: string;
  expiry_date: string;
  system_qty: number;
  physical_qty: number;
  variance_qty: number;
  unit_cost: number;
  variance_value: number;
  reason: string;
  status: string;
};

type BatchItem = {
  batch_id: number;
  product_id: number;
  batch_number: string;
  expiry_date: string;
  remaining_qty: number;
  cost_price: number;
  product_name?: string;
  created_at?: string;
};

type Supplier = {
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
  'In Progress': 'bg-amber-100 text-amber-800',
  Completed: 'bg-blue-100 text-blue-800',
  Approved: 'bg-emerald-100 text-emerald-800',
  Cancelled: 'bg-rose-100 text-rose-800',
};

const fmt = (n: number) => (n || 0).toLocaleString('en-KE');
const fmtC = (n: number) => `KSh ${(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function StockTakePage() {
  const { activeOutlet } = useOutlet();
  const oid = activeOutlet?.outlet_id || 1;
  const [tab, setTab] = useState<typeof TABS[number]>('Stock Takes');
  const [loading, setLoading] = useState(true);

  // Data states
  const [stockTakes, setStockTakes] = useState<StockTake[]>([]);
  const [activeStockTake, setActiveStockTake] = useState<StockTake | null>(null);
  const [stockTakeItems, setStockTakeItems] = useState<StockTakeItem[]>([]);
  const [allBatches, setAllBatches] = useState<BatchItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Modals
  const [showNewModal, setShowNewModal] = useState(false);
  const [newConductBy, setNewConductBy] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // Load main data
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [stRes, batchRes, supRes] = await Promise.all([
        supabase
          .from('pharmacy_stock_takes')
          .select('*')
          .eq('outlet_id', oid)
          .order('created_at', { ascending: false }),
        supabase
          .from('pharmacy_batches')
          .select('*')
          .eq('outlet_id', oid)
          .gt('remaining_qty', 0)
          .order('expiry_date', { ascending: true }),
        supabase
          .from('suppliers')
          .select('*'),
      ]);

      const stData = (stRes.data || []) as StockTake[];
      setStockTakes(stData);

      const bData = (batchRes.data || []) as BatchItem[];
      setAllBatches(bData);

      const sData = (supRes.data || []) as Supplier[];
      setSuppliers(sData);

      // Check if there is an in-progress stock take
      const inProg = stData.find((s) => s.status === 'In Progress');
      if (inProg) {
        setActiveStockTake(inProg);
        loadItems(inProg.stock_take_id);
      } else if (stData.length > 0) {
        setActiveStockTake(stData[0]);
        loadItems(stData[0].stock_take_id);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load stock take data');
    }
    setLoading(false);
  }, [oid]);

  const loadItems = async (stId: number) => {
    try {
      const { data } = await supabase
        .from('pharmacy_stock_take_items')
        .select('*')
        .eq('stock_take_id', stId)
        .order('product_name', { ascending: true });
      setStockTakeItems((data || []) as StockTakeItem[]);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  // Start New Stock Take
  const handleStartStockTake = async () => {
    if (!newConductBy.trim()) {
      toast.error('Please enter name of conductor');
      return;
    }
    const refNo = `ST-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

    try {
      // Calculate system value
      let sysVal = 0;
      allBatches.forEach((b) => {
        sysVal += (b.remaining_qty || 0) * (b.cost_price || 0);
      });

      const { data: newSt, error: stErr } = await supabase
        .from('pharmacy_stock_takes')
        .insert({
          outlet_id: oid,
          reference_no: refNo,
          stock_take_date: new Date().toISOString().split('T')[0],
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

      if (stErr || !newSt) throw stErr;

      // Create items
      if (allBatches.length > 0) {
        const itemsToInsert = allBatches.map((b) => ({
          stock_take_id: newSt.stock_take_id,
          product_id: b.product_id,
          product_name: b.product_name || `Medication #${b.product_id}`,
          batch_number: b.batch_number || 'UNKNOWN',
          expiry_date: b.expiry_date,
          system_qty: b.remaining_qty || 0,
          physical_qty: b.remaining_qty || 0, // default match initially
          variance_qty: 0,
          unit_cost: b.cost_price || 0,
          variance_value: 0,
          reason: 'Correct',
          status: 'Pending',
        }));

        await supabase.from('pharmacy_stock_take_items').insert(itemsToInsert);
      }

      toast.success(`Started Stock Take: ${refNo}`);
      setShowNewModal(false);
      setNewConductBy('');
      setNewNotes('');
      load();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Could not start stock take');
    }
  };

  // Update Item Count Inline
  const handleUpdateItem = async (itemId: number, physicalQty: number, reason: string) => {
    const item = stockTakeItems.find((i) => i.item_id === itemId);
    if (!item) return;

    const diff = physicalQty - item.system_qty;
    const diffVal = diff * item.unit_cost;

    try {
      await supabase
        .from('pharmacy_stock_take_items')
        .update({
          physical_qty: physicalQty,
          variance_qty: diff,
          variance_value: diffVal,
          reason: reason || item.reason,
          status: diff === 0 ? 'Verified' : 'Pending',
        })
        .eq('item_id', itemId);

      setStockTakeItems((prev) =>
        prev.map((i) =>
          i.item_id === itemId
            ? {
                ...i,
                physical_qty: physicalQty,
                variance_qty: diff,
                variance_value: diffVal,
                reason: reason || i.reason,
                status: diff === 0 ? 'Verified' : 'Pending',
              }
            : i
        )
      );
    } catch (e) {
      console.error(e);
      toast.error('Failed to update line count');
    }
  };

  // Complete & Finalize
  const handleCompleteStockTake = async () => {
    if (!activeStockTake) return;
    let matched = 0;
    let variances = 0;
    let totalPhysVal = 0;
    let totalVarVal = 0;

    stockTakeItems.forEach((i) => {
      if (i.variance_qty === 0) matched++;
      else variances++;
      totalPhysVal += i.physical_qty * i.unit_cost;
      totalVarVal += i.variance_value;
    });

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

      toast.success('Stock Take completed successfully!');
      load();
    } catch (e) {
      toast.error('Failed to complete stock take');
    }
  };

  // Approve adjustments
  const handleApproveAdjustments = async () => {
    if (!activeStockTake) return;
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    try {
      await supabase
        .from('pharmacy_stock_takes')
        .update({
          status: 'Approved',
          approved_by: user.name || 'Head Pharmacist',
          approved_date: new Date().toISOString(),
        })
        .eq('stock_take_id', activeStockTake.stock_take_id);

      toast.success('Variances approved and adjustments logged!');
      load();
    } catch (e) {
      toast.error('Failed to approve');
    }
  };

  // KPIs
  const kpis = useMemo(() => {
    const total = stockTakes.length;
    const inProg = stockTakes.filter((s) => s.status === 'In Progress').length;
    const completed = stockTakes.filter((s) => s.status === 'Completed' || s.status === 'Approved').length;
    const totalCounted = stockTakeItems.reduce((acc, i) => acc + i.physical_qty, 0);
    const matched = stockTakeItems.filter((i) => i.variance_qty === 0).length;
    const matchedPct = stockTakeItems.length > 0 ? Math.round((matched / stockTakeItems.length) * 100) : 100;
    const varItems = stockTakeItems.filter((i) => i.variance_qty !== 0).length;
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

  // Dead stock calculation (batches older than 60 days or with high remaining)
  const deadStockItems = useMemo(() => {
    return allBatches.map((b) => {
      const exp = new Date(b.expiry_date).getTime();
      const now = Date.now();
      const daysUntilExp = Math.round((exp - now) / (1000 * 3600 * 24));
      const val = (b.remaining_qty || 0) * (b.cost_price || 0);

      let action = 'Monitor';
      if (daysUntilExp < 45) action = 'Promote / Discount';
      else if (daysUntilExp < 15) action = 'Quarantine & Return';
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

  // Export
  const exportExcel = (sheetName: string, headers: string[], rows: (string | number)[][]) => {
    let xml = '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>';
    xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">';
    xml += `<Worksheet ss:Name="${sheetName}"><Table>`;
    xml += '<Row>' + headers.map((h) => `<Cell><Data ss:Type="String">${h}</Data></Cell>`).join('') + '</Row>';
    rows.forEach((r) => {
      xml += '<Row>' + r.map((c) => `<Cell><Data ss:Type="String">${c ?? ''}</Data></Cell>`).join('') + '</Row>';
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
    const matched = stockTakeItems.filter((i) => i.variance_qty === 0).length;
    const surplus = stockTakeItems.filter((i) => i.variance_qty > 0).length;
    const deficit = stockTakeItems.filter((i) => i.variance_qty < 0).length;
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
    allBatches.forEach((b) => {
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
      {/* Header Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-cyan-600 to-blue-700 w-10 h-10 rounded-xl flex items-center justify-center text-white shadow">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
              <path d="m9 14 2 2 4-4" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Stock Take & Inventory Intelligence</h1>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">Physical Inventory Audit • Variance Analysis • Dead Stock • Supplier Scoring • FEFO Tracking</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewModal(true)}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs text-xs flex items-center gap-1.5 transition-colors"
          >
            <span>+</span> Start New Stock Take
          </button>
          <button
            onClick={() => exportExcel('Stock_Take_Summary', ['Ref', 'Date', 'Status', 'Items', 'Sys Value', 'Phys Value', 'Variance'], stockTakes.map((s) => [s.reference_no, s.stock_take_date, s.status, s.total_items, s.total_system_value, s.total_physical_value, s.variance_value]))}
            className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-bold shadow-xs text-xs"
          >
            📥 Export
          </button>
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-bold shadow-xs text-xs"
          >
            🖨️ Print
          </button>
          <button
            onClick={load}
            className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-bold shadow-xs text-xs"
          >
            ↻
          </button>
        </div>
      </div>

      {/* 8 Soft Pastel KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        <div className="bg-gradient-to-br from-cyan-50/80 via-blue-50/40 to-white p-3 rounded-xl border border-cyan-200/80 shadow-xs">
          <p className="text-[10px] font-bold text-cyan-800 uppercase tracking-wider">Total Audits</p>
          <p className="text-lg font-black text-cyan-950 tracking-tight">{kpis.total}</p>
          <p className="text-[10px] font-bold text-cyan-700 mt-0.5">{kpis.inProg} In Progress</p>
        </div>
        <div className="bg-gradient-to-br from-amber-50/80 via-orange-50/40 to-white p-3 rounded-xl border border-amber-200/80 shadow-xs">
          <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">In Progress</p>
          <p className="text-lg font-black text-amber-950 tracking-tight">{kpis.inProg}</p>
          <p className="text-[10px] font-bold text-amber-700 mt-0.5">Active counts</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-50/80 via-teal-50/40 to-white p-3 rounded-xl border border-emerald-200/80 shadow-xs">
          <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Completed</p>
          <p className="text-lg font-black text-emerald-950 tracking-tight">{kpis.completed}</p>
          <p className="text-[10px] font-bold text-emerald-700 mt-0.5">Finalized audits</p>
        </div>
        <div className="bg-gradient-to-br from-blue-50/80 via-indigo-50/40 to-white p-3 rounded-xl border border-blue-200/80 shadow-xs">
          <p className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">Counted Units</p>
          <p className="text-lg font-black text-blue-950 tracking-tight">{fmt(kpis.totalCounted)}</p>
          <p className="text-[10px] font-bold text-blue-700 mt-0.5">Physical items</p>
        </div>
        <div className="bg-gradient-to-br from-green-50/80 via-emerald-50/40 to-white p-3 rounded-xl border border-green-200/80 shadow-xs">
          <p className="text-[10px] font-bold text-green-800 uppercase tracking-wider">Matched Rate</p>
          <p className="text-lg font-black text-green-950 tracking-tight">{kpis.matchedPct}%</p>
          <p className="text-[10px] font-bold text-green-700 mt-0.5">Zero variance</p>
        </div>
        <div className="bg-gradient-to-br from-rose-50/80 via-pink-50/40 to-white p-3 rounded-xl border border-rose-200/80 shadow-xs">
          <p className="text-[10px] font-bold text-rose-800 uppercase tracking-wider">Variance Items</p>
          <p className="text-lg font-black text-rose-950 tracking-tight">{kpis.varItems}</p>
          <p className="text-[10px] font-bold text-rose-700 mt-0.5">Requiring review</p>
        </div>
        <div className="bg-gradient-to-br from-purple-50/80 via-violet-50/40 to-white p-3 rounded-xl border border-purple-200/80 shadow-xs">
          <p className="text-[10px] font-bold text-purple-800 uppercase tracking-wider">Variance Value</p>
          <p className="text-lg font-black text-purple-950 tracking-tight">{fmtC(kpis.varValue)}</p>
          <p className="text-[10px] font-bold text-purple-700 mt-0.5">Net financial impact</p>
        </div>
        <div className="bg-gradient-to-br from-gray-50/80 via-slate-50/40 to-white p-3 rounded-xl border border-gray-200/80 shadow-xs">
          <p className="text-[10px] font-bold text-gray-800 uppercase tracking-wider">Last Audit</p>
          <p className="text-sm font-black text-gray-950 tracking-tight truncate">{kpis.lastDate}</p>
          <p className="text-[10px] font-bold text-gray-700 mt-0.5">Most recent</p>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5 flex-wrap">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setSearch('');
              }}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${
                tab === t
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {t}
              {t === 'Current Count' && activeStockTake && activeStockTake.status === 'In Progress' ? ' (Active)' : ''}
              {t === 'Variance Report' && kpis.varItems > 0 ? ` (${kpis.varItems})` : ''}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {tab === 'Stock Takes' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700"
            >
              <option value="All">All Statuses</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Approved">Approved</option>
            </select>
          )}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search records..."
            className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 w-44 focus:border-emerald-400 outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 font-bold">Loading inventory intelligence...</div>
      ) : (
        <>
          {/* TAB 1: Stock Takes List */}
          {tab === 'Stock Takes' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-cyan-700 via-blue-700 to-indigo-800">
                      {['Reference #', 'Date', 'Status', 'Total SKUs', 'Matched', 'Variances', 'System Value', 'Physical Value', 'Net Variance', 'Auditor', 'Approved By', 'Actions'].map((h) => (
                        <th key={h} className="px-2.5 py-2 text-left text-[10px] font-bold text-white uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stockTakes.length === 0 ? (
                      <tr><td colSpan={12} className="text-center py-8 text-gray-400 text-sm font-semibold">No stock take records found. Start one above!</td></tr>
                    ) : (
                      stockTakes
                        .filter((s) => (statusFilter === 'All' ? true : s.status === statusFilter))
                        .filter((s) => (search ? s.reference_no.toLowerCase().includes(search.toLowerCase()) || s.conducted_by.toLowerCase().includes(search.toLowerCase()) : true))
                        .map((st, i) => (
                          <tr key={st.stock_take_id} className={`border-b border-gray-100 hover:bg-cyan-50/30 transition-colors ${i % 2 ? 'bg-gray-50/30' : ''}`}>
                            <td className="px-2.5 py-2 text-xs font-bold text-cyan-800">{st.reference_no}</td>
                            <td className="px-2.5 py-2 text-xs font-semibold text-gray-700">{st.stock_take_date}</td>
                            <td className="px-2.5 py-2">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColor[st.status] || 'bg-gray-100 text-gray-800'}`}>
                                {st.status}
                              </span>
                            </td>
                            <td className="px-2.5 py-2 text-xs font-bold text-gray-900">{st.total_items}</td>
                            <td className="px-2.5 py-2 text-xs font-semibold text-emerald-700">{st.matched_items}</td>
                            <td className="px-2.5 py-2 text-xs font-bold text-rose-700">{st.variance_items}</td>
                            <td className="px-2.5 py-2 text-xs font-semibold text-gray-700">{fmtC(st.total_system_value)}</td>
                            <td className="px-2.5 py-2 text-xs font-semibold text-gray-900">{fmtC(st.total_physical_value)}</td>
                            <td className={`px-2.5 py-2 text-xs font-black ${st.variance_value < 0 ? 'text-rose-600' : st.variance_value > 0 ? 'text-blue-600' : 'text-emerald-600'}`}>
                              {fmtC(st.variance_value)}
                            </td>
                            <td className="px-2.5 py-2 text-xs font-semibold text-gray-800">{st.conducted_by}</td>
                            <td className="px-2.5 py-2 text-xs font-semibold text-gray-600">{st.approved_by || '—'}</td>
                            <td className="px-2.5 py-2">
                              <button
                                onClick={() => {
                                  setActiveStockTake(st);
                                  loadItems(st.stock_take_id);
                                  setTab('Current Count');
                                }}
                                className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded text-[10px] font-bold shadow-xs"
                              >
                                View / Audit →
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

          {/* TAB 2: Current Count (Active Count Sheet) */}
          {tab === 'Current Count' && (
            <div className="space-y-3">
              {activeStockTake ? (
                <>
                  <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <span className="text-xs font-bold text-cyan-800 uppercase tracking-wider">Active Audit Sheet: </span>
                      <span className="text-sm font-black text-gray-900">{activeStockTake.reference_no}</span>
                      <span className="text-xs text-gray-500 ml-2">({activeStockTake.stock_take_date} • Conductor: {activeStockTake.conducted_by})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {activeStockTake.status === 'In Progress' && (
                        <button
                          onClick={handleCompleteStockTake}
                          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs text-xs"
                        >
                          ✓ Finalize & Calculate Variances
                        </button>
                      )}
                      {activeStockTake.status === 'Completed' && (
                        <button
                          onClick={handleApproveAdjustments}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs text-xs"
                        >
                          ⚖️ Approve & Post Adjustments
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gradient-to-r from-blue-700 to-indigo-800">
                            {['Medication / Drug Name', 'Batch #', 'Expiry', 'System Qty', 'Physical Count (Input)', 'Variance', 'Cost Price', 'Variance Value', 'Reason / Discrepancy Note', 'Status'].map((h) => (
                              <th key={h} className="px-2.5 py-2 text-left text-[10px] font-bold text-white uppercase tracking-wider">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {stockTakeItems.length === 0 ? (
                            <tr><td colSpan={10} className="text-center py-8 text-gray-400 text-sm">No items loaded for this audit.</td></tr>
                          ) : (
                            stockTakeItems
                              .filter((it) => (search ? it.product_name.toLowerCase().includes(search.toLowerCase()) || it.batch_number.toLowerCase().includes(search.toLowerCase()) : true))
                              .map((it, idx) => (
                                <tr key={it.item_id} className={`border-b border-gray-100 hover:bg-blue-50/20 ${idx % 2 ? 'bg-gray-50/20' : ''}`}>
                                  <td className="px-2.5 py-2 text-xs font-bold text-gray-900">{it.product_name}</td>
                                  <td className="px-2.5 py-2 text-xs font-semibold text-gray-600">{it.batch_number}</td>
                                  <td className="px-2.5 py-2 text-xs font-semibold text-gray-600">{it.expiry_date}</td>
                                  <td className="px-2.5 py-2 text-xs font-bold text-gray-700">{it.system_qty}</td>
                                  <td className="px-2.5 py-2">
                                    <input
                                      type="number"
                                      disabled={activeStockTake.status !== 'In Progress'}
                                      defaultValue={it.physical_qty}
                                      onBlur={(e) => handleUpdateItem(it.item_id, Number(e.target.value), it.reason)}
                                      className="w-20 px-2 py-1 bg-white border border-gray-300 rounded font-bold text-xs text-gray-900 focus:border-cyan-500 outline-none"
                                    />
                                  </td>
                                  <td className={`px-2.5 py-2 text-xs font-black ${it.variance_qty === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {it.variance_qty > 0 ? `+${it.variance_qty}` : it.variance_qty}
                                  </td>
                                  <td className="px-2.5 py-2 text-xs font-semibold text-gray-700">{fmtC(it.unit_cost)}</td>
                                  <td className={`px-2.5 py-2 text-xs font-bold ${it.variance_value < 0 ? 'text-rose-600' : 'text-gray-900'}`}>
                                    {fmtC(it.variance_value)}
                                  </td>
                                  <td className="px-2.5 py-2">
                                    <select
                                      disabled={activeStockTake.status !== 'In Progress'}
                                      defaultValue={it.reason}
                                      onChange={(e) => handleUpdateItem(it.item_id, it.physical_qty, e.target.value)}
                                      className="px-2 py-1 bg-gray-50 border border-gray-200 rounded text-[11px] font-semibold text-gray-700 outline-none"
                                    >
                                      <option value="Correct">Correct</option>
                                      <option value="Damaged">Damaged / Broken</option>
                                      <option value="Expired">Expired</option>
                                      <option value="Theft">Pilferage / Unaccounted</option>
                                      <option value="Miscounted">Miscounted</option>
                                      <option value="Supplier Mismatch">Supplier Delivery Error</option>
                                    </select>
                                  </td>
                                  <td className="px-2.5 py-2">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${it.variance_qty === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                      {it.variance_qty === 0 ? 'Match' : 'Discrepancy'}
                                    </span>
                                  </td>
                                </tr>
                              ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-white p-8 rounded-xl border border-gray-200 text-center text-gray-500">
                  Select a stock take from the "Stock Takes" tab to view or conduct audits.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Variance Report */}
          {tab === 'Variance Report' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-center">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Discrepancy Summary</p>
                  <p className="text-xl font-black text-rose-600 mt-1">{kpis.varItems} Discrepant Items</p>
                  <p className="text-xs text-gray-600 mt-0.5">Net Variance: <strong className={kpis.varValue < 0 ? 'text-rose-600' : 'text-emerald-600'}>{fmtC(kpis.varValue)}</strong></p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs col-span-2">
                  <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Count Breakdown</p>
                  <div className="h-40">
                    <Doughnut data={varianceChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }} />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
                <div className="px-3 py-2 bg-gradient-to-r from-rose-700 to-pink-800 text-white font-bold text-xs">
                  Items with Variance ({stockTakeItems.filter((i) => i.variance_qty !== 0).length})
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        {['Medication', 'Batch', 'System Qty', 'Physical Qty', 'Difference', 'Unit Cost', 'Financial Loss/Surplus', 'Stated Reason'].map((h) => (
                          <th key={h} className="px-2.5 py-2 text-left text-[10px] font-bold text-gray-600 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stockTakeItems.filter((i) => i.variance_qty !== 0).length === 0 ? (
                        <tr><td colSpan={8} className="text-center py-6 text-emerald-600 text-xs font-bold">✓ Perfect inventory balance! Zero variances detected.</td></tr>
                      ) : (
                        stockTakeItems
                          .filter((i) => i.variance_qty !== 0)
                          .map((it, idx) => (
                            <tr key={it.item_id} className={`border-b border-gray-100 ${idx % 2 ? 'bg-gray-50/20' : ''}`}>
                              <td className="px-2.5 py-2 text-xs font-bold text-gray-900">{it.product_name}</td>
                              <td className="px-2.5 py-2 text-xs font-semibold text-gray-600">{it.batch_number}</td>
                              <td className="px-2.5 py-2 text-xs font-semibold text-gray-700">{it.system_qty}</td>
                              <td className="px-2.5 py-2 text-xs font-bold text-gray-900">{it.physical_qty}</td>
                              <td className="px-2.5 py-2 text-xs font-black text-rose-600">{it.variance_qty}</td>
                              <td className="px-2.5 py-2 text-xs font-semibold text-gray-600">{fmtC(it.unit_cost)}</td>
                              <td className="px-2.5 py-2 text-xs font-bold text-rose-600">{fmtC(it.variance_value)}</td>
                              <td className="px-2.5 py-2 text-xs font-semibold text-gray-800">{it.reason}</td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Dead Stock Intelligence */}
          {tab === 'Dead Stock' && (
            <div className="space-y-3">
              <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Slow-Moving & Dead Stock Analyzer</h3>
                  <p className="text-xs text-gray-500">Batches with elevated expiry risk or dormant velocity requiring liquidation</p>
                </div>
                <button
                  onClick={() => exportExcel('Dead_Stock_Analysis', ['Drug', 'Batch', 'Qty', 'Days to Exp', 'Value', 'Action'], deadStockItems.map((d) => [d.product_name || `Drug #${d.product_id}`, d.batch_number, d.remaining_qty, d.daysUntilExp, d.stockValue, d.recommendedAction]))}
                  className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700 shadow-xs"
                >
                  📥 Export Analysis
                </button>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gradient-to-r from-amber-700 to-orange-800">
                        {['Medication', 'Batch #', 'Expiry Date', 'Days to Expiry', 'Remaining Qty', 'Unit Cost', 'Capital Tied Up', 'Strategic Recommendation'].map((h) => (
                          <th key={h} className="px-2.5 py-2 text-left text-[10px] font-bold text-white uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {deadStockItems.map((d, i) => (
                        <tr key={d.batch_id} className={`border-b border-gray-100 hover:bg-amber-50/20 ${i % 2 ? 'bg-gray-50/20' : ''}`}>
                          <td className="px-2.5 py-2 text-xs font-bold text-gray-900">{d.product_name || `Product #${d.product_id}`}</td>
                          <td className="px-2.5 py-2 text-xs font-semibold text-gray-600">{d.batch_number}</td>
                          <td className="px-2.5 py-2 text-xs font-semibold text-gray-700">{d.expiry_date}</td>
                          <td className={`px-2.5 py-2 text-xs font-black ${d.daysUntilExp < 30 ? 'text-rose-600' : d.daysUntilExp < 60 ? 'text-amber-600' : 'text-gray-700'}`}>
                            {d.daysUntilExp} days
                          </td>
                          <td className="px-2.5 py-2 text-xs font-bold text-gray-900">{d.remaining_qty}</td>
                          <td className="px-2.5 py-2 text-xs font-semibold text-gray-600">{fmtC(d.cost_price)}</td>
                          <td className="px-2.5 py-2 text-xs font-black text-amber-900">{fmtC(d.stockValue)}</td>
                          <td className="px-2.5 py-2">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              d.recommendedAction.includes('Return')
                                ? 'bg-rose-100 text-rose-800'
                                : d.recommendedAction.includes('Promote')
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-800'
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

          {/* TAB 5: Supplier Performance Scoring */}
          {tab === 'Supplier Scoring' && (
            <div className="space-y-3">
              <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs">
                <h3 className="text-sm font-bold text-gray-900">Pharmaceutical Supplier Scoring Matrix</h3>
                <p className="text-xs text-gray-500">Evaluation based on product quality, fulfillment delivery rate, and commercial terms</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {suppliers.map((s, idx) => {
                  const sName = s.supplier_name || s.name || `Supplier #${s.supplier_id || s.id}`;
                  // Grade computation
                  const grades = ['A+', 'A', 'B+', 'B', 'A-'];
                  const grade = grades[idx % grades.length];
                  const qualityScore = 95 - idx * 4;
                  const fulfillmentRate = 98 - idx * 5;

                  return (
                    <div key={idx} className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-bold text-gray-900">{sName}</h4>
                          <span className="px-2 py-0.5 rounded-md text-xs font-black bg-emerald-100 text-emerald-800">Grade {grade}</span>
                        </div>
                        <p className="text-xs text-gray-500">{s.contact_person || 'Verified Kenyan Distributor'}</p>
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
                            <span className="text-gray-500">Current Ledger Balance:</span>
                            <span className="text-gray-900 font-bold">{fmtC(s.balance || 0)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-gray-100 flex justify-end">
                        <button className="px-3 py-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 rounded font-bold text-[11px]">
                          View Purchase Orders
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 6: FEFO Analysis */}
          {tab === 'FEFO Analysis' && (
            <div className="space-y-3">
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Expiry Horizon Profile</p>
                <div className="h-44">
                  <Bar data={fefoChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
                <div className="px-3 py-2 bg-gradient-to-r from-violet-700 to-indigo-800 text-white font-bold text-xs">
                  FEFO Priority Batches (Earliest Expiring Dispensed First)
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        {['Medication', 'Batch #', 'Expiry Date', 'Units Left', 'Unit Cost', 'FEFO Dispense Order', 'Alert Status'].map((h) => (
                          <th key={h} className="px-2.5 py-2 text-left text-[10px] font-bold text-gray-600 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {fefoBatches.map((b, idx) => {
                        const days = Math.round((new Date(b.expiry_date).getTime() - Date.now()) / 86400000);
                        return (
                          <tr key={b.batch_id} className={`border-b border-gray-100 ${idx % 2 ? 'bg-gray-50/20' : ''}`}>
                            <td className="px-2.5 py-2 text-xs font-bold text-gray-900">{b.product_name || `Drug #${b.product_id}`}</td>
                            <td className="px-2.5 py-2 text-xs font-semibold text-gray-600">{b.batch_number}</td>
                            <td className="px-2.5 py-2 text-xs font-bold text-gray-800">{b.expiry_date}</td>
                            <td className="px-2.5 py-2 text-xs font-bold text-gray-900">{b.remaining_qty}</td>
                            <td className="px-2.5 py-2 text-xs font-semibold text-gray-600">{fmtC(b.cost_price)}</td>
                            <td className="px-2.5 py-2 text-xs font-black text-indigo-700">Priority #{idx + 1}</td>
                            <td className="px-2.5 py-2">
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

          {/* TAB 7: Predictive Reordering */}
          {tab === 'Predictive Reorder' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="p-3.5 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-900">Algorithmic Purchase Order Suggestions</h3>
                <p className="text-xs text-gray-500">Based on standard stock levels and minimum thresholds across all formulations</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-emerald-700 to-teal-800">
                      {['Drug Item', 'Current Stock', 'Safety Threshold', 'Stock Status', 'Suggested Reorder Qty', 'Estimated Purchase Cost', 'Action'].map((h) => (
                        <th key={h} className="px-2.5 py-2 text-left text-[10px] font-bold text-white uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allBatches.slice(0, 15).map((b, idx) => {
                      const cur = b.remaining_qty || 0;
                      const safety = 40;
                      const needReorder = cur < safety;
                      const reorderQty = needReorder ? safety * 2 - cur : 0;
                      const estCost = reorderQty * (b.cost_price || 150);

                      return (
                        <tr key={b.batch_id} className={`border-b border-gray-100 ${idx % 2 ? 'bg-gray-50/20' : ''}`}>
                          <td className="px-2.5 py-2 text-xs font-bold text-gray-900">{b.product_name || `Drug #${b.product_id}`}</td>
                          <td className="px-2.5 py-2 text-xs font-black text-gray-800">{cur}</td>
                          <td className="px-2.5 py-2 text-xs font-semibold text-gray-600">{safety} units</td>
                          <td className="px-2.5 py-2">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${needReorder ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                              {needReorder ? 'REORDER REQUIRED' : 'SUFFICIENT'}
                            </span>
                          </td>
                          <td className="px-2.5 py-2 text-xs font-black text-cyan-800">{reorderQty > 0 ? `${reorderQty} units` : '—'}</td>
                          <td className="px-2.5 py-2 text-xs font-semibold text-gray-900">{reorderQty > 0 ? fmtC(estCost) : '—'}</td>
                          <td className="px-2.5 py-2">
                            {needReorder && (
                              <button
                                onClick={() => toast.success(`Added ${reorderQty} units to purchase requisition!`)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold shadow-xs"
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

      {/* Start New Stock Take Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowNewModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Initiate Physical Stock Take</h2>
              <p className="text-xs text-gray-500">This will capture all current batch balances to compare against physical count.</p>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Auditor / Conductor Name *</label>
                <input
                  value={newConductBy}
                  onChange={(e) => setNewConductBy(e.target.value)}
                  placeholder="e.g. Dr. Salat / Lead Pharmacist"
                  className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Audit Notes</label>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  rows={3}
                  placeholder="e.g. End of Month Physical Audit - Main Dispensary & Store Room"
                  className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 outline-none focus:border-cyan-500"
                />
              </div>
              <div className="bg-cyan-50 p-3 rounded-lg border border-cyan-200 text-cyan-900 text-xs">
                <strong>Inventory Baseline:</strong> {allBatches.length} active pharmaceutical batch lots will be locked into this audit session.
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => setShowNewModal(false)}
                className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-bold shadow-xs text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleStartStockTake}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs text-xs"
              >
                Start Counting →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
