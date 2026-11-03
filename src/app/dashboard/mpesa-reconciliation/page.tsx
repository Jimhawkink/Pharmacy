'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

interface MpesaTx { id?: number; mpesa_receipt: string; phone: string; amount: number; date: string; time: string; type: string; account_ref: string; transaction_id: string; matched: boolean; matched_sale_id?: number; matched_receipt?: string; outlet_id: number; }
interface Sale { sale_id: number; receipt_no: string; total: number; mpesa_receipt: string; payment_method: string; sale_datetime: string; customer_phone: string; }

const fmt = (n: number) => `KSh ${(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().split('T')[0];
const firstOfMonth = () => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; };

export default function MpesaReconciliationPage() {
  const { activeOutlet } = useOutlet();
  const outletId = activeOutlet?.outlet_id || 1;

  const [tab, setTab] = useState<'dashboard' | 'import' | 'match' | 'history'>('dashboard');
  const [mpesaTxs, setMpesaTxs] = useState<MpesaTx[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo, setDateTo] = useState(today());
  const [search, setSearch] = useState('');
  const [importRows, setImportRows] = useState<MpesaTx[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: txData }, { data: saleData }] = await Promise.all([
        supabase.from('pharmacy_mpesa_transactions').select('*').eq('outlet_id', outletId).order('date', { ascending: false }).order('time', { ascending: false }).limit(500),
        supabase.from('pharmacy_sales').select('sale_id, receipt_no, total, mpesa_receipt, payment_method, sale_datetime, customer_phone')
          .eq('outlet_id', outletId).ilike('payment_method', '%mpesa%').order('sale_id', { ascending: false }).limit(500),
      ]);
      setMpesaTxs(txData || []);
      setSales(saleData || []);
    } catch { }
    setLoading(false);
  }, [outletId]);

  useEffect(() => { loadData(); }, [loadData]);

  const addImportRow = () => {
    setImportRows(prev => [...prev, {
      mpesa_receipt: '', phone: '', amount: 0, date: today(), time: '12:00', type: 'Pay Bill',
      account_ref: '', transaction_id: '', matched: false, outlet_id: outletId,
    }]);
  };
  const updateRow = (idx: number, field: keyof MpesaTx, val: any) => {
    setImportRows(prev => { const n = [...prev]; (n[idx] as any)[field] = val; return n; });
  };
  const removeRow = (idx: number) => setImportRows(prev => prev.filter((_, i) => i !== idx));

  const saveImport = async () => {
    if (!importRows.length) { toast.error('Add at least one entry'); return; }
    const bad = importRows.find(r => !r.mpesa_receipt || !r.amount);
    if (bad) { toast.error('Each row needs an M-Pesa receipt code and amount'); return; }
    setSaving(true);
    try {
      const rows = importRows.map(r => ({ ...r, outlet_id: outletId }));
      const { error } = await supabase.from('pharmacy_mpesa_transactions').insert(rows);
      if (error) throw error;
      toast.success(`✅ ${rows.length} M-Pesa transactions imported`);
      setImportRows([]);
      await loadData();
      setTab('match');
    } catch (e: any) { toast.error(e.message || 'Import failed'); }
    setSaving(false);
  };

  const autoMatch = async () => {
    setSaving(true);
    let matched = 0;
    try {
      for (const tx of mpesaTxs.filter(t => !t.matched)) {
        // Try match by receipt code first
        const byReceipt = sales.find(s => s.mpesa_receipt && s.mpesa_receipt.toUpperCase() === tx.mpesa_receipt.toUpperCase());
        // Try match by amount + phone
        const byAmtPhone = !byReceipt ? sales.find(s => Math.abs(s.total - tx.amount) < 1 && s.customer_phone && tx.phone && s.customer_phone.replace(/\D/g,'').slice(-9) === tx.phone.replace(/\D/g,'').slice(-9)) : null;
        const match = byReceipt || byAmtPhone;
        if (match) {
          await supabase.from('pharmacy_mpesa_transactions').update({ matched: true, matched_sale_id: match.sale_id, matched_receipt: match.receipt_no }).eq('id', tx.id);
          matched++;
        }
      }
      toast.success(`✅ Auto-matched ${matched} M-Pesa transactions to sales`);
      await loadData();
    } catch (e: any) { toast.error(e.message || 'Match failed'); }
    setSaving(false);
  };

  const manualMatch = async (txId: number, saleId: number, saleReceiptNo: string) => {
    try {
      await supabase.from('pharmacy_mpesa_transactions').update({ matched: true, matched_sale_id: saleId, matched_receipt: saleReceiptNo }).eq('id', txId);
      toast.success('✅ Transaction matched to sale');
      await loadData();
    } catch { toast.error('Match failed'); }
  };

  const unmatch = async (txId: number) => {
    try {
      await supabase.from('pharmacy_mpesa_transactions').update({ matched: false, matched_sale_id: null, matched_receipt: null }).eq('id', txId);
      toast.success('Unmatched');
      await loadData();
    } catch { }
  };

  const period = mpesaTxs.filter(t => t.date >= dateFrom && t.date <= dateTo);
  const periodSales = sales.filter(s => s.sale_datetime?.slice(0,10) >= dateFrom && s.sale_datetime?.slice(0,10) <= dateTo);
  const totalMpesaTx = period.reduce((s, t) => s + t.amount, 0);
  const totalMpesaSales = periodSales.reduce((s, x) => s + x.total, 0);
  const matched = period.filter(t => t.matched).length;
  const unmatched = period.filter(t => !t.matched).length;
  const variance = totalMpesaSales - totalMpesaTx;

  const filteredTxs = mpesaTxs.filter(t =>
    (!search || t.mpesa_receipt?.toLowerCase().includes(search.toLowerCase()) || t.phone?.includes(search) || t.account_ref?.toLowerCase().includes(search.toLowerCase())) &&
    t.date >= dateFrom && t.date <= dateTo
  );
  const unmatchedSalesForMatch = sales.filter(s => !s.mpesa_receipt || !mpesaTxs.find(t => t.matched_sale_id === s.sale_id));

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="w-full max-w-full space-y-3.5 px-1 md:px-2 text-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
            <span className="text-2xl">📱</span> M-Pesa Reconciliation
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Import M-Pesa statement, auto-match transactions to sales, detect unmatched payments</p>
        </div>
        <div className="flex gap-2">
          {[['dashboard','📊 Overview'],['import','📤 Import'],['match','🔗 Match'],['history','📋 History']].map(([t,l]) => (
            <button key={t} onClick={() => setTab(t as any)}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${tab === t ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Date range filter */}
      <div className="flex gap-2 items-center bg-white rounded-xl border border-gray-200 p-2.5 shadow-sm flex-wrap">
        <span className="text-xs font-bold text-gray-600">Period:</span>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-2 py-1 border border-gray-200 rounded-lg text-xs bg-gray-50" />
        <span className="text-gray-400 text-xs">to</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-2 py-1 border border-gray-200 rounded-lg text-xs bg-gray-50" />
        {tab === 'match' && (
          <button onClick={autoMatch} disabled={saving} className="ml-auto px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-xs shadow-xs disabled:opacity-50">
            {saving ? 'Matching...' : '🤖 Auto-Match All'}
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'M-Pesa Transactions', value: period.length, icon: '📱', color: 'green', sub: fmt(totalMpesaTx) },
          { label: 'M-Pesa Sales', value: periodSales.length, icon: '🛒', color: 'emerald', sub: fmt(totalMpesaSales) },
          { label: 'Matched', value: `${matched}/${period.length}`, icon: '✅', color: 'blue', sub: `${period.length > 0 ? Math.round((matched/period.length)*100) : 0}% match rate` },
          { label: 'Variance', value: fmt(Math.abs(variance)), icon: variance === 0 ? '✅' : '⚠️', color: Math.abs(variance) < 500 ? 'emerald' : 'red', sub: variance === 0 ? 'Balanced!' : `${variance > 0 ? 'Sales > Bank' : 'Bank > Sales'}` },
        ].map((k, i) => (
          <div key={i} className={`bg-gradient-to-br from-${k.color}-50/80 via-${k.color}-50/40 to-white rounded-xl p-3.5 border border-${k.color}-100 shadow-sm`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-lg">{k.icon}</span>
              <span className={`text-[10px] font-semibold text-${k.color}-600 bg-${k.color}-100 px-1.5 py-0.5 rounded-full`}>M-Pesa</span>
            </div>
            <p className={`text-xl font-black text-${k.color}-700`}>{k.value}</p>
            <p className="text-xs font-semibold text-gray-700 mt-0.5">{k.label}</p>
            <p className="text-[10px] text-gray-400">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* ===== DASHBOARD ===== */}
      {tab === 'dashboard' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-3 border-b border-gray-100"><h3 className="text-sm font-extrabold text-gray-800">📱 Recent M-Pesa Transactions</h3></div>
            <div className="overflow-auto max-h-72">
              <table className="w-full text-xs">
                <thead><tr className="bg-gradient-to-r from-green-700 to-emerald-800 text-white">
                  {['Date','M-Pesa Receipt','Phone','Amount','Matched?'].map(h=><th key={h} className="px-3 py-2 text-left font-semibold text-[11px]">{h}</th>)}
                </tr></thead>
                <tbody>
                  {mpesaTxs.slice(0,20).map((t,i) => (
                    <tr key={i} className={`border-b border-gray-50 ${i%2===0?'bg-white':'bg-gray-50/40'}`}>
                      <td className="px-3 py-1.5 text-gray-600">{t.date}</td>
                      <td className="px-3 py-1.5 font-mono font-bold text-green-700">{t.mpesa_receipt}</td>
                      <td className="px-3 py-1.5 text-gray-600">{t.phone}</td>
                      <td className="px-3 py-1.5 font-bold text-emerald-700">{fmt(t.amount)}</td>
                      <td className="px-3 py-1.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.matched?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-700'}`}>{t.matched?'✅ Yes':'❌ No'}</span>
                      </td>
                    </tr>
                  ))}
                  {mpesaTxs.length===0 && <tr><td colSpan={5} className="text-center py-8 text-gray-400">No transactions. Import M-Pesa statement.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-3 border-b border-gray-100"><h3 className="text-sm font-extrabold text-gray-800">🛒 M-Pesa Sales (System)</h3></div>
            <div className="overflow-auto max-h-72">
              <table className="w-full text-xs">
                <thead><tr className="bg-gradient-to-r from-emerald-700 to-teal-800 text-white">
                  {['Date','Receipt','Total','M-Pesa Code','Phone'].map(h=><th key={h} className="px-3 py-2 text-left font-semibold text-[11px]">{h}</th>)}
                </tr></thead>
                <tbody>
                  {sales.slice(0,20).map((s,i) => (
                    <tr key={i} className={`border-b border-gray-50 ${i%2===0?'bg-white':'bg-gray-50/40'}`}>
                      <td className="px-3 py-1.5 text-gray-600">{s.sale_datetime?.slice(0,10)}</td>
                      <td className="px-3 py-1.5 font-mono text-blue-700 font-bold">{s.receipt_no}</td>
                      <td className="px-3 py-1.5 font-bold text-emerald-700">{fmt(s.total)}</td>
                      <td className="px-3 py-1.5 font-mono text-green-700">{s.mpesa_receipt||'—'}</td>
                      <td className="px-3 py-1.5 text-gray-600">{s.customer_phone||'—'}</td>
                    </tr>
                  ))}
                  {sales.length===0 && <tr><td colSpan={5} className="text-center py-8 text-gray-400">No M-Pesa sales recorded.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          {unmatched > 0 && (
            <div className="md:col-span-2 p-4 bg-red-50 rounded-xl border border-red-200 flex items-center justify-between">
              <div>
                <p className="font-extrabold text-red-800">⚠️ {unmatched} Unmatched M-Pesa Transactions</p>
                <p className="text-xs text-red-600 mt-0.5">These payments were received but cannot be linked to a sale. Run auto-match or manually match them.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setTab('match')} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs">View Unmatched</button>
                <button onClick={autoMatch} disabled={saving} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-xs disabled:opacity-50">Auto-Match</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== IMPORT ===== */}
      {tab === 'import' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-gray-800">📤 Import M-Pesa Statement</h3>
            <button onClick={addImportRow} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-xs">+ Add Row</button>
          </div>
          <div className="p-3 bg-green-50 border-b border-green-100 text-xs text-green-800">
            <strong>Instructions:</strong> Download your M-Pesa statement (Safaricom App → M-Pesa → Statement) and enter each transaction below. Required: receipt code and amount.
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[900px]">
              <thead><tr className="bg-gradient-to-r from-green-700 to-emerald-800 text-white">
                {['#','Date','Time','M-Pesa Receipt *','Phone','Amount (KSh) *','Type','Account Ref','Transaction ID',''].map(h => (
                  <th key={h} className="px-2 py-2.5 text-left font-semibold text-[11px]">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {importRows.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-10 text-gray-400">Click "+ Add Row" to add M-Pesa entries</td></tr>
                ) : importRows.map((row, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-2 py-1.5 text-gray-400 font-bold">{idx+1}</td>
                    <td className="px-2 py-1.5"><input type="date" value={row.date} onChange={e=>updateRow(idx,'date',e.target.value)} className="px-1 py-1 border border-gray-200 rounded text-xs w-28" /></td>
                    <td className="px-2 py-1.5"><input type="time" value={row.time} onChange={e=>updateRow(idx,'time',e.target.value)} className="px-1 py-1 border border-gray-200 rounded text-xs w-20" /></td>
                    <td className="px-2 py-1.5"><input value={row.mpesa_receipt} onChange={e=>updateRow(idx,'mpesa_receipt',e.target.value.toUpperCase())} placeholder="e.g. RLJ57XYZ99" className="px-1.5 py-1 border border-green-300 rounded text-xs w-28 font-mono uppercase bg-green-50" /></td>
                    <td className="px-2 py-1.5"><input value={row.phone} onChange={e=>updateRow(idx,'phone',e.target.value)} placeholder="07XXXXXXXX" className="px-1.5 py-1 border border-gray-200 rounded text-xs w-28" /></td>
                    <td className="px-2 py-1.5"><input type="number" value={row.amount||''} onChange={e=>updateRow(idx,'amount',Number(e.target.value))} placeholder="0.00" className="px-1.5 py-1 border border-emerald-300 rounded text-xs w-24 text-right bg-emerald-50 font-bold" /></td>
                    <td className="px-2 py-1.5">
                      <select value={row.type} onChange={e=>updateRow(idx,'type',e.target.value)} className="px-1 py-1 border border-gray-200 rounded text-xs w-24">
                        {['Pay Bill','Buy Goods','Till','Send Money'].map(t=><option key={t}>{t}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5"><input value={row.account_ref} onChange={e=>updateRow(idx,'account_ref',e.target.value)} placeholder="Account ref" className="px-1.5 py-1 border border-gray-200 rounded text-xs w-28" /></td>
                    <td className="px-2 py-1.5"><input value={row.transaction_id} onChange={e=>updateRow(idx,'transaction_id',e.target.value)} placeholder="Tx ID" className="px-1.5 py-1 border border-gray-200 rounded text-xs w-24 font-mono" /></td>
                    <td className="px-2 py-1.5"><button onClick={()=>removeRow(idx)} className="p-1 text-red-500 hover:bg-red-50 rounded text-xs">✕</button></td>
                  </tr>
                ))}
              </tbody>
              {importRows.length > 0 && (
                <tfoot><tr className="bg-green-50 border-t-2 border-green-200">
                  <td colSpan={4} className="px-3 py-2 font-bold text-gray-700 text-xs">TOTAL ({importRows.length} entries)</td>
                  <td className="px-3 py-2 font-black text-emerald-700 text-right">{fmt(importRows.reduce((s,r)=>s+r.amount,0))}</td>
                  <td colSpan={5} />
                </tr></tfoot>
              )}
            </table>
          </div>
          <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
            <button onClick={()=>{setImportRows([]);setTab('dashboard');}} className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-50">Cancel</button>
            <button onClick={saveImport} disabled={saving||importRows.length===0} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold shadow-xs disabled:opacity-50">
              {saving?'Saving...':`💾 Import ${importRows.length} Entries`}
            </button>
          </div>
        </div>
      )}

      {/* ===== MATCH ===== */}
      {tab === 'match' && (
        <div className="space-y-4">
          <div className="flex gap-2 items-center">
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search receipt, phone..." className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none w-64" />
            <span className="text-xs text-gray-500">{filteredTxs.filter(t=>!t.matched).length} unmatched</span>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-3 border-b border-gray-100"><h3 className="text-sm font-extrabold text-gray-800">🔗 M-Pesa Transaction Matching</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="bg-gradient-to-r from-green-700 to-emerald-800 text-white">
                  {['Date','M-Pesa Receipt','Phone','Amount','Matched To Sale','Status','Action'].map(h=><th key={h} className="px-3 py-2.5 text-left font-semibold text-[11px]">{h}</th>)}
                </tr></thead>
                <tbody>
                  {filteredTxs.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-10 text-gray-400">No transactions in this period. Import M-Pesa statement first.</td></tr>
                  ) : filteredTxs.map((t,i) => (
                    <tr key={i} className={`border-b border-gray-50 hover:bg-gray-50 ${i%2===0?'bg-white':'bg-gray-50/40'}`}>
                      <td className="px-3 py-2 text-gray-600">{t.date} {t.time}</td>
                      <td className="px-3 py-2 font-mono font-bold text-green-700">{t.mpesa_receipt}</td>
                      <td className="px-3 py-2 text-gray-600">{t.phone}</td>
                      <td className="px-3 py-2 font-bold text-emerald-700">{fmt(t.amount)}</td>
                      <td className="px-3 py-2">{t.matched_receipt ? <span className="font-mono text-blue-700 font-bold">{t.matched_receipt}</span> : <span className="text-gray-400">—</span>}</td>
                      <td className="px-3 py-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.matched?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-700'}`}>{t.matched?'✅ Matched':'❌ Unmatched'}</span>
                      </td>
                      <td className="px-3 py-2">
                        {t.matched ? (
                          <button onClick={()=>unmatch(t.id!)} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-bold text-[10px]">Unmatch</button>
                        ) : (
                          <select onChange={e=>{if(e.target.value){const s=sales.find(x=>x.sale_id===Number(e.target.value));if(s)manualMatch(t.id!,s.sale_id,s.receipt_no);}}} className="px-2 py-1 border border-gray-200 rounded text-[10px] bg-gray-50 max-w-[180px]">
                            <option value="">Match to sale...</option>
                            {unmatchedSalesForMatch.filter(s=>Math.abs(s.total-t.amount)<1000).map(s=>(
                              <option key={s.sale_id} value={s.sale_id}>{s.receipt_no} — {fmt(s.total)}</option>
                            ))}
                          </select>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===== HISTORY ===== */}
      {tab === 'history' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-gray-800">📋 All M-Pesa Transactions</h3>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 w-52" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="bg-gradient-to-r from-green-700 to-emerald-800 text-white">
                {['Date','Time','Receipt','Phone','Amount','Type','Account Ref','Matched Sale','Status'].map(h=><th key={h} className="px-3 py-2.5 text-left font-semibold text-[11px]">{h}</th>)}
              </tr></thead>
              <tbody>
                {filteredTxs.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-10 text-gray-400">No M-Pesa transactions found</td></tr>
                ) : filteredTxs.map((t,i) => (
                  <tr key={i} className={`border-b border-gray-50 ${i%2===0?'bg-white':'bg-gray-50/40'}`}>
                    <td className="px-3 py-1.5 text-gray-600">{t.date}</td>
                    <td className="px-3 py-1.5 text-gray-500">{t.time}</td>
                    <td className="px-3 py-1.5 font-mono font-bold text-green-700">{t.mpesa_receipt}</td>
                    <td className="px-3 py-1.5 text-gray-600">{t.phone}</td>
                    <td className="px-3 py-1.5 font-bold text-emerald-700">{fmt(t.amount)}</td>
                    <td className="px-3 py-1.5 text-gray-500">{t.type}</td>
                    <td className="px-3 py-1.5 text-gray-500">{t.account_ref||'—'}</td>
                    <td className="px-3 py-1.5 font-mono text-blue-700">{t.matched_receipt||'—'}</td>
                    <td className="px-3 py-1.5"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.matched?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-700'}`}>{t.matched?'Matched':'Unmatched'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
