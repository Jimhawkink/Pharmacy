'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

interface Supplier { supplier_id: number; supplier_name: string; phone: string; email: string; }
interface Product { id: number; name: string; barcode: string; generic_name: string; drug_type: string; costPrice: number; salesPrice: number; salesUnit: string; }
interface GRNItem {
  product_id: number; product_name: string; barcode: string; batch_number: string;
  manufacture_date: string; expiry_date: string; quantity_ordered: number; quantity_received: number;
  quantity_rejected: number; unit_cost: number; total_cost: number; selling_price: number;
  vat_applicable: boolean; rejection_reason: string; storage_condition: string;
}
interface GRN {
  grn_id?: number; grn_number: string; po_number: string; supplier_id: number; supplier_name: string;
  invoice_number: string; invoice_date: string; delivery_date: string; received_by: string;
  verified_by: string; status: string; notes: string; total_value: number; outlet_id: number;
  items?: GRNItem[];
}

const fmt = (n: number) => `KSh ${n.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().split('T')[0];

const STORAGE_CONDITIONS = ['Ambient (15-25°C)', 'Refrigerated (2-8°C)', 'Frozen (-20°C)', 'Cool & Dry', 'Protect from Light', 'Controlled Temperature'];

export default function GRNPage() {
  const { activeOutlet } = useOutlet();
  const outletId = activeOutlet?.outlet_id || 1;

  const [grns, setGrns] = useState<GRN[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'list' | 'new' | 'view'>('list');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewGrn, setViewGrn] = useState<GRN | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [productDrop, setProductDrop] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userName, setUserName] = useState('Pharmacist');

  const [form, setForm] = useState<GRN>({
    grn_number: '', po_number: '', supplier_id: 0, supplier_name: '', invoice_number: '',
    invoice_date: today(), delivery_date: today(), received_by: '', verified_by: '',
    status: 'Draft', notes: '', total_value: 0, outlet_id: outletId, items: [],
  });
  const [items, setItems] = useState<GRNItem[]>([]);

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) { try { const p = JSON.parse(u); setUserName(p.name || p.email || 'Pharmacist'); } catch {} }
  }, []);

  const genGrnNumber = () => {
    const d = new Date();
    return `GRN-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 9000 + 1000)}`;
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: gData }, { data: sData }, { data: pData }] = await Promise.all([
        supabase.from('pharmacy_grn').select('*').eq('outlet_id', outletId).order('grn_id', { ascending: false }).limit(200),
        supabase.from('pharmacy_suppliers').select('supplier_id, supplier_name, phone, email').order('supplier_name'),
        supabase.from('pharmacy_products').select('id, name, barcode, generic_name, drug_type, cost_price, sales_price, sales_unit').order('name').limit(500),
      ]);
      setGrns(gData || []);
      setSuppliers(sData || []);
      setProducts((pData || []).map((p: any) => ({
        id: p.id, name: p.name, barcode: p.barcode, generic_name: p.generic_name,
        drug_type: p.drug_type, costPrice: p.cost_price || 0, salesPrice: p.sales_price || 0, salesUnit: p.sales_unit || 'Unit',
      })));
    } catch (e) { toast.error('Failed to load data'); }
    setLoading(false);
  }, [outletId]);

  useEffect(() => { loadData(); }, [loadData]);

  const startNew = () => {
    setForm({
      grn_number: genGrnNumber(), po_number: '', supplier_id: 0, supplier_name: '',
      invoice_number: '', invoice_date: today(), delivery_date: today(),
      received_by: userName, verified_by: '', status: 'Draft', notes: '', total_value: 0, outlet_id: outletId, items: [],
    });
    setItems([]);
    setTab('new');
  };

  const addItemRow = (prod?: Product) => {
    const newItem: GRNItem = {
      product_id: prod?.id || 0, product_name: prod?.name || '', barcode: prod?.barcode || '',
      batch_number: '', manufacture_date: '', expiry_date: '',
      quantity_ordered: 0, quantity_received: 0, quantity_rejected: 0,
      unit_cost: prod?.costPrice || 0, total_cost: 0, selling_price: prod?.salesPrice || 0,
      vat_applicable: false, rejection_reason: '', storage_condition: 'Ambient (15-25°C)',
    };
    setItems(prev => [...prev, newItem]);
    setProductSearch('');
    setProductDrop(false);
  };

  const updateItem = (idx: number, field: keyof GRNItem, val: any) => {
    setItems(prev => {
      const n = [...prev];
      n[idx] = { ...n[idx], [field]: val };
      if (field === 'quantity_received' || field === 'unit_cost') {
        n[idx].total_cost = (n[idx].quantity_received - n[idx].quantity_rejected) * n[idx].unit_cost;
      }
      if (field === 'quantity_rejected') {
        n[idx].total_cost = (n[idx].quantity_received - n[idx].quantity_rejected) * n[idx].unit_cost;
      }
      return n;
    });
  };

  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const totalValue = items.reduce((s, i) => s + (i.total_cost || 0), 0);

  const saveGRN = async (statusOverride?: string) => {
    if (!form.supplier_id) { toast.error('Select a supplier'); return; }
    if (!form.invoice_number) { toast.error('Enter invoice number'); return; }
    if (items.length === 0) { toast.error('Add at least one item'); return; }
    const badItem = items.find(i => !i.product_id || !i.batch_number || !i.expiry_date);
    if (badItem) { toast.error('All items need product, batch number, and expiry date'); return; }
    setSaving(true);
    try {
      const status = statusOverride || form.status;
      const grnData = { ...form, status, total_value: totalValue, outlet_id: outletId };
      const { data: saved, error } = await supabase.from('pharmacy_grn').insert([grnData]).select().single();
      if (error) throw error;
      // Insert GRN items
      const grnItems = items.map(item => ({ ...item, grn_id: saved.grn_id }));
      const { error: itemsErr } = await supabase.from('pharmacy_grn_items').insert(grnItems);
      if (itemsErr) console.warn('GRN items:', itemsErr);

      // If posting, update stock & batches
      if (status === 'Posted') {
        for (const item of items) {
          if (!item.product_id || item.quantity_received <= 0) continue;
          const acceptedQty = item.quantity_received - item.quantity_rejected;
          // Update/insert batch
          await supabase.from('pharmacy_batches').upsert([{
            product_id: item.product_id, batch_number: item.batch_number,
            manufacture_date: item.manufacture_date || null, expiry_date: item.expiry_date,
            purchase_cost: item.unit_cost, selling_price: item.selling_price,
            quantity_received: acceptedQty, remaining_qty: acceptedQty,
            storage_condition: item.storage_condition, outlet_id: outletId,
          }], { onConflict: 'product_id,batch_number,outlet_id' });
          // Update stock
          const { data: stk } = await supabase.from('pharmacy_stock').select('st_id, qty').eq('pid', item.product_id).eq('outlet_id', outletId).limit(1).single();
          if (stk) {
            await supabase.from('pharmacy_stock').update({ qty: (stk.qty || 0) + acceptedQty }).eq('st_id', stk.st_id);
          } else {
            await supabase.from('pharmacy_stock').insert([{ pid: item.product_id, qty: acceptedQty, outlet_id: outletId }]);
          }
        }
        toast.success(`✅ GRN ${form.grn_number} posted! Stock updated.`);
      } else {
        toast.success(`GRN ${form.grn_number} saved as ${status}`);
      }
      await loadData();
      setTab('list');
    } catch (e: any) { toast.error(e.message || 'Save failed'); }
    setSaving(false);
  };

  const viewGrnDetail = async (grn: GRN) => {
    const { data: itemData } = await supabase.from('pharmacy_grn_items').select('*').eq('grn_id', grn.grn_id);
    setViewGrn({ ...grn, items: itemData || [] });
    setTab('view');
  };

  const filteredGrns = grns.filter(g =>
    (statusFilter === 'all' || g.status === statusFilter) &&
    (!search || g.grn_number?.toLowerCase().includes(search.toLowerCase()) ||
      g.supplier_name?.toLowerCase().includes(search.toLowerCase()) ||
      g.invoice_number?.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredProducts = products.filter(p =>
    !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.barcode?.includes(productSearch) || p.generic_name?.toLowerCase().includes(productSearch.toLowerCase())
  ).slice(0, 12);

  const statusBadge = (s: string) => {
    const m: Record<string, string> = {
      Draft: 'bg-gray-100 text-gray-700', Verified: 'bg-blue-100 text-blue-700',
      Posted: 'bg-emerald-100 text-emerald-700', Rejected: 'bg-red-100 text-red-700',
    };
    return `text-[10px] font-bold px-2 py-0.5 rounded-full ${m[s] || 'bg-gray-100 text-gray-700'}`;
  };

  // Stats
  const totalGRNs = grns.length;
  const postedGRNs = grns.filter(g => g.status === 'Posted').length;
  const draftGRNs = grns.filter(g => g.status === 'Draft').length;
  const totalPostedValue = grns.filter(g => g.status === 'Posted').reduce((s, g) => s + (g.total_value || 0), 0);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="w-full max-w-full space-y-3.5 px-1 md:px-2 text-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
            <span className="text-2xl">📦</span> Goods Received Note (GRN)
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Receive, verify & post incoming stock from suppliers — batch tracking, expiry logging & stock update</p>
        </div>
        <div className="flex gap-2">
          {tab !== 'list' && (
            <button onClick={() => setTab('list')} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold text-xs">
              ← Back to List
            </button>
          )}
          {tab === 'list' && (
            <button onClick={startNew} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs text-xs">
              + New GRN
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total GRNs', value: totalGRNs, icon: '📄', color: 'blue', sub: 'All time records' },
          { label: 'Posted GRNs', value: postedGRNs, icon: '✅', color: 'emerald', sub: 'Stock updated' },
          { label: 'Draft / Pending', value: draftGRNs, icon: '⏳', color: 'amber', sub: 'Awaiting verification' },
          { label: 'Total Posted Value', value: fmt(totalPostedValue), icon: '💰', color: 'purple', sub: 'Stock received' },
        ].map((k, i) => (
          <div key={i} className={`bg-gradient-to-br from-${k.color}-50/80 via-${k.color}-50/40 to-white rounded-xl p-3.5 border border-${k.color}-100 shadow-sm`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-lg">{k.icon}</span>
              <span className={`text-[10px] font-semibold text-${k.color}-600 bg-${k.color}-100 px-1.5 py-0.5 rounded-full`}>GRN</span>
            </div>
            <p className={`text-xl font-black text-${k.color}-700`}>{k.value}</p>
            <p className="text-xs font-semibold text-gray-700 mt-0.5">{k.label}</p>
            <p className="text-[10px] text-gray-400">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* ============ LIST TAB ============ */}
      {tab === 'list' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-3 border-b border-gray-100 flex flex-wrap gap-2 items-center justify-between">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search GRN#, Supplier, Invoice..." className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-emerald-400 w-64" />
            <div className="flex gap-1.5">
              {['all', 'Draft', 'Verified', 'Posted', 'Rejected'].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)} className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${statusFilter === s ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {s === 'all' ? 'All' : s}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-800 text-white">
                  {['GRN Number', 'Supplier', 'Invoice #', 'Delivery Date', 'Received By', 'Items', 'Total Value', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-semibold text-[11px] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredGrns.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-12 text-gray-400">No GRNs found. Click "New GRN" to receive stock.</td></tr>
                ) : filteredGrns.map((g, i) => (
                  <tr key={g.grn_id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                    <td className="px-3 py-2 font-mono font-bold text-blue-700">{g.grn_number}</td>
                    <td className="px-3 py-2 font-semibold text-gray-800">{g.supplier_name}</td>
                    <td className="px-3 py-2 text-gray-600">{g.invoice_number}</td>
                    <td className="px-3 py-2 text-gray-600">{g.delivery_date}</td>
                    <td className="px-3 py-2 text-gray-600">{g.received_by}</td>
                    <td className="px-3 py-2">
                      <span className="bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-full text-[10px]">{(g as any).item_count || '—'}</span>
                    </td>
                    <td className="px-3 py-2 font-bold text-emerald-700">{fmt(g.total_value || 0)}</td>
                    <td className="px-3 py-2"><span className={statusBadge(g.status)}>{g.status}</span></td>
                    <td className="px-3 py-2">
                      <button onClick={() => viewGrnDetail(g)} className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-bold text-[10px]">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============ NEW GRN TAB ============ */}
      {tab === 'new' && (
        <div className="space-y-4">
          {/* Header Info */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h3 className="text-sm font-extrabold text-gray-800 mb-3 flex items-center gap-2">
              <span>📋</span> GRN Header Information
              <span className="ml-auto font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg text-xs">{form.grn_number}</span>
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold text-gray-600 mb-1 block">Supplier *</label>
                <select value={form.supplier_id} onChange={e => {
                  const sup = suppliers.find(s => s.supplier_id === Number(e.target.value));
                  setForm(f => ({ ...f, supplier_id: Number(e.target.value), supplier_name: sup?.supplier_name || '' }));
                }} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-emerald-400">
                  <option value={0}>Select Supplier...</option>
                  {suppliers.map(s => <option key={s.supplier_id} value={s.supplier_id}>{s.supplier_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-600 mb-1 block">Invoice Number *</label>
                <input value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} placeholder="e.g. INV-2024-00123" className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-emerald-400" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-600 mb-1 block">PO Number (Optional)</label>
                <input value={form.po_number} onChange={e => setForm(f => ({ ...f, po_number: e.target.value }))} placeholder="e.g. PO-2024-0045" className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-emerald-400" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-600 mb-1 block">Invoice Date</label>
                <input type="date" value={form.invoice_date} onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-emerald-400" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-600 mb-1 block">Delivery Date</label>
                <input type="date" value={form.delivery_date} onChange={e => setForm(f => ({ ...f, delivery_date: e.target.value }))} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-emerald-400" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-600 mb-1 block">Received By</label>
                <input value={form.received_by} onChange={e => setForm(f => ({ ...f, received_by: e.target.value }))} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-emerald-400" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-600 mb-1 block">Verified By (Pharmacist)</label>
                <input value={form.verified_by} onChange={e => setForm(f => ({ ...f, verified_by: e.target.value }))} placeholder="Supervising pharmacist name" className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-emerald-400" />
              </div>
              <div className="md:col-span-2">
                <label className="text-[11px] font-bold text-gray-600 mb-1 block">Notes / Delivery Conditions</label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. Delivery in good condition, cold chain maintained..." className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-emerald-400" />
              </div>
            </div>
          </div>

          {/* Items Section */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-gray-800 flex items-center gap-2">
                <span>💊</span> Items Received ({items.length})
              </h3>
              {/* Product search to add item */}
              <div className="relative">
                <input
                  value={productSearch} onChange={e => { setProductSearch(e.target.value); setProductDrop(true); }}
                  onFocus={() => setProductDrop(true)}
                  placeholder="🔍 Search medicine to add..."
                  className="px-3 py-1.5 border border-emerald-200 rounded-lg text-xs bg-emerald-50 focus:outline-none focus:border-emerald-500 w-64"
                />
                {productDrop && filteredProducts.length > 0 && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 w-80 max-h-64 overflow-y-auto">
                    {filteredProducts.map(p => (
                      <button key={p.id} onClick={() => addItemRow(p)} className="w-full text-left px-3 py-2 hover:bg-emerald-50 border-b border-gray-50 last:border-0 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-800 text-xs">{p.name}</p>
                          <p className="text-[10px] text-gray-500">{p.generic_name} • {p.barcode}</p>
                        </div>
                        <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-bold">{p.salesUnit}</span>
                      </button>
                    ))}
                    <button onClick={() => addItemRow()} className="w-full px-3 py-2 text-center text-xs text-emerald-700 font-bold hover:bg-emerald-50">
                      + Add blank row
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[1100px]">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-700 via-gray-700 to-zinc-800 text-white">
                    {['#', 'Medicine', 'Batch No.', 'Mfg Date', 'Expiry Date', 'Qty Ordered', 'Qty Received', 'Qty Rejected', 'Unit Cost (KSh)', 'Sell Price (KSh)', 'Total (KSh)', 'Storage', 'VAT', ''].map(h => (
                      <th key={h} className="px-2 py-2.5 text-left font-semibold text-[10px] whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={14} className="text-center py-10 text-gray-400">Search for a medicine above to add it to this GRN</td></tr>
                  ) : items.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-2 py-1.5 font-bold text-gray-500">{idx + 1}</td>
                      <td className="px-2 py-1.5">
                        {item.product_name ? (
                          <div>
                            <p className="font-bold text-gray-800">{item.product_name}</p>
                            <p className="text-[10px] text-gray-400">{item.barcode}</p>
                          </div>
                        ) : (
                          <select onChange={e => {
                            const p = products.find(prod => prod.id === Number(e.target.value));
                            if (p) updateItem(idx, 'product_id', p.id);
                            if (p) updateItem(idx, 'product_name', p.name);
                            if (p) updateItem(idx, 'barcode', p.barcode);
                            if (p) updateItem(idx, 'unit_cost', p.costPrice);
                            if (p) updateItem(idx, 'selling_price', p.salesPrice);
                          }} className="px-1 py-1 border border-gray-200 rounded text-xs w-40">
                            <option value="">Select...</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <input value={item.batch_number} onChange={e => updateItem(idx, 'batch_number', e.target.value)} placeholder="Batch #" className="px-1.5 py-1 border border-gray-200 rounded text-xs w-24 font-mono uppercase" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="date" value={item.manufacture_date} onChange={e => updateItem(idx, 'manufacture_date', e.target.value)} className="px-1 py-1 border border-gray-200 rounded text-xs w-28" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="date" value={item.expiry_date} onChange={e => updateItem(idx, 'expiry_date', e.target.value)} className={`px-1 py-1 border rounded text-xs w-28 ${item.expiry_date && new Date(item.expiry_date) < new Date(Date.now() + 90 * 86400000) ? 'border-amber-400 bg-amber-50' : 'border-gray-200'}`} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" value={item.quantity_ordered || ''} onChange={e => updateItem(idx, 'quantity_ordered', Number(e.target.value))} className="px-1 py-1 border border-gray-200 rounded text-xs w-16 text-center" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" value={item.quantity_received || ''} onChange={e => updateItem(idx, 'quantity_received', Number(e.target.value))} className="px-1 py-1 border border-emerald-300 rounded text-xs w-16 text-center bg-emerald-50 font-bold" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" value={item.quantity_rejected || ''} onChange={e => updateItem(idx, 'quantity_rejected', Number(e.target.value))} className="px-1 py-1 border border-red-200 rounded text-xs w-16 text-center bg-red-50" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" value={item.unit_cost || ''} onChange={e => updateItem(idx, 'unit_cost', Number(e.target.value))} className="px-1 py-1 border border-gray-200 rounded text-xs w-20 text-right" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" value={item.selling_price || ''} onChange={e => updateItem(idx, 'selling_price', Number(e.target.value))} className="px-1 py-1 border border-blue-200 rounded text-xs w-20 text-right bg-blue-50" />
                      </td>
                      <td className="px-2 py-1.5 font-bold text-emerald-700 text-right whitespace-nowrap">
                        {item.total_cost.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-2 py-1.5">
                        <select value={item.storage_condition} onChange={e => updateItem(idx, 'storage_condition', e.target.value)} className="px-1 py-1 border border-gray-200 rounded text-[10px] w-28">
                          {STORAGE_CONDITIONS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <input type="checkbox" checked={item.vat_applicable} onChange={e => updateItem(idx, 'vat_applicable', e.target.checked)} className="rounded" />
                      </td>
                      <td className="px-2 py-1.5">
                        <button onClick={() => removeItem(idx)} className="p-1 text-red-500 hover:bg-red-50 rounded-lg font-bold text-xs">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {items.length > 0 && (
                  <tfoot>
                    <tr className="bg-gradient-to-r from-emerald-50 to-teal-50 border-t-2 border-emerald-200">
                      <td colSpan={9} className="px-3 py-2 font-bold text-gray-700 text-xs">
                        TOTALS: {items.reduce((s, i) => s + i.quantity_received, 0)} units received,&nbsp;
                        {items.reduce((s, i) => s + i.quantity_rejected, 0)} rejected
                      </td>
                      <td colSpan={2} className="px-3 py-2 font-black text-emerald-800 text-right text-sm">
                        {fmt(totalValue)}
                      </td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Rejection reasons */}
          {items.some(i => i.quantity_rejected > 0) && (
            <div className="bg-red-50 rounded-xl border border-red-200 p-4">
              <h4 className="text-xs font-extrabold text-red-800 mb-2 flex items-center gap-1.5"><span>⚠️</span> Rejection Reasons (Required for rejected items)</h4>
              <div className="space-y-2">
                {items.filter(i => i.quantity_rejected > 0).map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-red-700 w-40 truncate">{item.product_name}</span>
                    <input
                      value={item.rejection_reason}
                      onChange={e => {
                        const actualIdx = items.findIndex(it => it === item);
                        updateItem(actualIdx, 'rejection_reason', e.target.value);
                      }}
                      placeholder="e.g. Damaged packaging, short-dated, wrong product..."
                      className="flex-1 px-2 py-1 border border-red-200 rounded-lg text-xs bg-white focus:outline-none focus:border-red-400"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="text-sm font-black text-gray-800">
              Grand Total: <span className="text-emerald-700">{fmt(totalValue)}</span>
              <span className="text-xs text-gray-500 font-normal ml-2">({items.length} product lines)</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setTab('list')} className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg font-semibold text-xs hover:bg-gray-50">Cancel</button>
              <button onClick={() => saveGRN('Draft')} disabled={saving} className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-bold text-xs">
                {saving ? 'Saving...' : '💾 Save Draft'}
              </button>
              <button onClick={() => saveGRN('Verified')} disabled={saving} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs">
                {saving ? 'Saving...' : '🔍 Save & Verify'}
              </button>
              <button onClick={() => saveGRN('Posted')} disabled={saving} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs text-xs">
                {saving ? 'Posting...' : '✅ Post & Update Stock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ VIEW TAB ============ */}
      {tab === 'view' && viewGrn && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
                <span>📋</span> GRN Detail: {viewGrn.grn_number}
                <span className={statusBadge(viewGrn.status)}>{viewGrn.status}</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">Supplier: {viewGrn.supplier_name} • Invoice: {viewGrn.invoice_number} • Received by: {viewGrn.received_by}</p>
            </div>
            <button onClick={() => window.print()} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg font-bold text-xs hover:bg-blue-700">🖨️ Print GRN</button>
          </div>
          <div className="grid grid-cols-3 gap-4 p-4 text-xs border-b border-gray-100">
            {[
              ['GRN Number', viewGrn.grn_number],
              ['PO Number', viewGrn.po_number || '—'],
              ['Invoice Number', viewGrn.invoice_number],
              ['Invoice Date', viewGrn.invoice_date],
              ['Delivery Date', viewGrn.delivery_date],
              ['Received By', viewGrn.received_by],
              ['Verified By', viewGrn.verified_by || '—'],
              ['Total Value', fmt(viewGrn.total_value || 0)],
              ['Notes', viewGrn.notes || '—'],
            ].map(([label, val]) => (
              <div key={label}>
                <p className="text-[10px] text-gray-400 font-bold uppercase">{label}</p>
                <p className="font-semibold text-gray-800 mt-0.5">{val}</p>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-800 text-white">
                  {['#', 'Medicine', 'Batch No', 'Expiry', 'Qty Ordered', 'Qty Received', 'Qty Rejected', 'Unit Cost', 'Total', 'Storage'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-semibold text-[11px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(viewGrn.items || []).map((item, i) => (
                  <tr key={i} className={`border-b border-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                    <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                    <td className="px-3 py-2 font-semibold text-gray-800">{item.product_name}</td>
                    <td className="px-3 py-2 font-mono text-blue-700">{item.batch_number}</td>
                    <td className="px-3 py-2">{item.expiry_date}</td>
                    <td className="px-3 py-2 text-center">{item.quantity_ordered}</td>
                    <td className="px-3 py-2 text-center font-bold text-emerald-700">{item.quantity_received}</td>
                    <td className="px-3 py-2 text-center font-bold text-red-600">{item.quantity_rejected || 0}</td>
                    <td className="px-3 py-2 text-right">{fmt(item.unit_cost)}</td>
                    <td className="px-3 py-2 text-right font-bold text-emerald-700">{fmt(item.total_cost)}</td>
                    <td className="px-3 py-2 text-gray-500 text-[10px]">{item.storage_condition}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-emerald-50 border-t-2 border-emerald-200">
                  <td colSpan={8} className="px-3 py-2 font-bold text-gray-700 text-right text-xs">GRAND TOTAL:</td>
                  <td className="px-3 py-2 font-black text-emerald-800 text-right">{fmt(viewGrn.total_value || 0)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
