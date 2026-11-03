'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

interface CreditCustomer { customer_id: number; customer_name: string; phone: string; email: string; current_balance: number; credit_limit: number; created_at: string; }
interface CreditSale { sale_id: number; customer_id: number; receipt_no: string; sale_datetime: string; total: number; amount_paid: number; payment_method: string; customer_name: string; }
interface AgingBucket { label: string; days: string; color: string; amount: number; count: number; }

const fmt = (n: number) => `KSh ${(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;
const daysBetween = (d1: string, d2: string) => Math.floor((new Date(d2).getTime() - new Date(d1).getTime()) / 86400000);

export default function AccountsReceivablePage() {
  const { activeOutlet } = useOutlet();
  const outletId = activeOutlet?.outlet_id || 1;

  const [customers, setCustomers] = useState<CreditCustomer[]>([]);
  const [creditSales, setCreditSales] = useState<CreditSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'aging' | 'detail' | 'collection'>('aging');
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CreditCustomer | null>(null);
  const [savingNote, setSavingNote] = useState(false);
  const [collectionNote, setCollectionNote] = useState('');
  const [collectionAction, setCollectionAction] = useState('phone_call');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: cData }, { data: sData }] = await Promise.all([
        supabase.from('pharmacy_credit_customers').select('*').eq('outlet_id', outletId).order('customer_name'),
        supabase.from('pharmacy_sales').select('sale_id, customer_name, receipt_no, sale_datetime, total, amount_paid, payment_method')
          .eq('outlet_id', outletId).ilike('payment_method', '%credit%').order('sale_datetime', { ascending: false }).limit(500),
      ]);
      setCustomers(cData || []);
      // Match sales to customers
      const matched = (sData || []).map((s: any) => {
        const cust = (cData || []).find((c: any) => c.customer_name === s.customer_name);
        return { ...s, customer_id: cust?.customer_id };
      });
      setCreditSales(matched);
    } catch { }
    setLoading(false);
  }, [outletId]);

  useEffect(() => { loadData(); }, [loadData]);

  const today = new Date().toISOString().split('T')[0];

  // Aging buckets per customer
  const getCustomerAging = (custId: number) => {
    const custSales = creditSales.filter(s => s.customer_id === custId && (s.total - (s.amount_paid || 0)) > 0);
    const buckets = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 };
    custSales.forEach(s => {
      const age = daysBetween(s.sale_datetime?.split('T')[0] || today, today);
      const outstanding = s.total - (s.amount_paid || 0);
      if (age <= 30) buckets.current += outstanding;
      else if (age <= 60) buckets.days30 += outstanding;
      else if (age <= 90) buckets.days60 += outstanding;
      else if (age <= 120) buckets.days90 += outstanding;
      else buckets.over90 += outstanding;
    });
    return buckets;
  };

  const agingRows = customers.map(c => ({ ...c, ...getCustomerAging(c.customer_id), outstanding: c.current_balance || 0 }));
  const filtered = agingRows.filter(c => !search || c.customer_name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search));

  // Totals
  const totals = filtered.reduce((acc, c) => ({
    current: acc.current + c.current,
    days30: acc.days30 + c.days30,
    days60: acc.days60 + c.days60,
    days90: acc.days90 + c.days90,
    over90: acc.over90 + c.over90,
    outstanding: acc.outstanding + c.outstanding,
  }), { current: 0, days30: 0, days60: 0, days90: 0, over90: 0, outstanding: 0 });

  const agingBuckets: AgingBucket[] = [
    { label: 'Current (0-30 days)', days: '0-30', color: 'emerald', amount: totals.current, count: filtered.filter(c => c.current > 0).length },
    { label: '31-60 Days', days: '31-60', color: 'blue', amount: totals.days30, count: filtered.filter(c => c.days30 > 0).length },
    { label: '61-90 Days', days: '61-90', color: 'amber', amount: totals.days60, count: filtered.filter(c => c.days60 > 0).length },
    { label: '91-120 Days', days: '91-120', color: 'orange', amount: totals.days90, count: filtered.filter(c => c.days90 > 0).length },
    { label: 'Over 120 Days', days: '>120', color: 'red', amount: totals.over90, count: filtered.filter(c => c.over90 > 0).length },
  ];

  const riskColor = (c: typeof agingRows[0]) => {
    if (c.over90 > 0) return 'bg-red-50 border-l-4 border-red-500';
    if (c.days90 > 0) return 'bg-orange-50 border-l-4 border-orange-400';
    if (c.days60 > 0) return 'bg-amber-50 border-l-4 border-amber-400';
    return '';
  };

  const logCollectionActivity = async () => {
    if (!selectedCustomer || !collectionNote) { toast.error('Select customer and enter notes'); return; }
    setSavingNote(true);
    try {
      await supabase.from('pharmacy_collection_activities').insert([{
        customer_id: selectedCustomer.customer_id, customer_name: selectedCustomer.customer_name,
        action_type: collectionAction, notes: collectionNote, action_date: today,
        outstanding_amount: selectedCustomer.current_balance, outlet_id: outletId,
      }]);
      toast.success('✅ Collection activity logged');
      setCollectionNote('');
      setSelectedCustomer(null);
    } catch (e: any) { toast.error(e.message || 'Failed'); }
    setSavingNote(false);
  };

  const customerSales = selectedCustomer
    ? creditSales.filter(s => s.customer_id === selectedCustomer.customer_id)
    : [];

  const exportCSV = () => {
    const headers = ['Customer','Phone','0-30 Days','31-60 Days','61-90 Days','91-120 Days','>120 Days','Total Outstanding','Credit Limit'];
    const rows = filtered.map(c => [c.customer_name, c.phone, c.current.toFixed(2), c.days30.toFixed(2), c.days60.toFixed(2), c.days90.toFixed(2), c.over90.toFixed(2), c.outstanding.toFixed(2), (c.credit_limit||0).toFixed(2)]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `AR-Aging-${today}.csv`; a.click();
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="w-full max-w-full space-y-3.5 px-1 md:px-2 text-gray-900">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
            <span className="text-2xl">📊</span> Accounts Receivable Aging
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Track outstanding credit, aging analysis, and collection management</p>
        </div>
        <div className="flex gap-2">
          {[['aging','📊 Aging Report'],['detail','👤 Customer Detail'],['collection','📞 Collections']].map(([t,l]) => (
            <button key={t} onClick={() => setTab(t as any)}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs ${tab===t?'bg-orange-500 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{l}</button>
          ))}
          <button onClick={exportCSV} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs">⬇️ CSV</button>
        </div>
      </div>

      {/* KPI Aging Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {agingBuckets.map((b, i) => (
          <div key={i} className={`bg-gradient-to-br from-${b.color}-50/80 via-${b.color}-50/40 to-white rounded-xl p-3 border border-${b.color}-100 shadow-sm`}>
            <p className={`text-[10px] font-bold text-${b.color}-600 bg-${b.color}-100 px-1.5 py-0.5 rounded-full w-fit`}>{b.days} days</p>
            <p className={`text-base font-black text-${b.color}-700 mt-1`}>{fmt(b.amount)}</p>
            <p className="text-[10px] font-semibold text-gray-700">{b.label}</p>
            <p className="text-[10px] text-gray-400">{b.count} customers</p>
          </div>
        ))}
      </div>

      {/* Total Outstanding Banner */}
      <div className="bg-gradient-to-r from-orange-500 via-red-500 to-rose-600 rounded-2xl p-4 text-white shadow-lg flex items-center justify-between">
        <div>
          <p className="text-xs font-bold opacity-80">TOTAL OUTSTANDING RECEIVABLES</p>
          <p className="text-3xl font-black mt-0.5">{fmt(totals.outstanding)}</p>
          <p className="text-xs opacity-80 mt-1">{customers.filter(c => (c.current_balance || 0) > 0).length} customers with outstanding balances</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold opacity-80">High Risk (90+ days)</p>
          <p className="text-2xl font-black">{fmt(totals.days90 + totals.over90)}</p>
          <p className="text-xs opacity-70">{filtered.filter(c => c.days90 > 0 || c.over90 > 0).length} accounts</p>
        </div>
      </div>

      {/* ===== AGING TABLE ===== */}
      {tab === 'aging' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-extrabold text-gray-800">👥 Customer Aging Analysis</h3>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search customer, phone..." className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none w-60" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="bg-gradient-to-r from-orange-700 via-red-700 to-rose-800 text-white">
                {['Customer','Phone','0-30 Days','31-60 Days','61-90 Days','91-120 Days','>120 Days','Total Outstanding','Credit Limit','Usage %','Risk','Action'].map(h=>(
                  <th key={h} className="px-3 py-2.5 text-left font-semibold text-[11px] whitespace-nowrap">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={12} className="text-center py-12 text-gray-400">No credit customers found</td></tr>
                ) : filtered.map((c, i) => {
                  const usagePct = c.credit_limit ? Math.round((c.outstanding / c.credit_limit) * 100) : 0;
                  const risk = c.over90 > 0 || c.days90 > 0 ? 'High' : c.days60 > 0 ? 'Medium' : c.days30 > 0 ? 'Low' : 'Current';
                  return (
                    <tr key={c.customer_id} className={`border-b border-gray-50 hover:bg-orange-50 cursor-pointer transition-colors ${riskColor(c)} ${i%2===0?'bg-white':'bg-gray-50/30'}`}
                      onClick={() => { setSelectedCustomer(c); setTab('detail'); }}>
                      <td className="px-3 py-2 font-bold text-gray-900">{c.customer_name}</td>
                      <td className="px-3 py-2 text-gray-600">{c.phone}</td>
                      <td className="px-3 py-2 font-bold text-emerald-700 text-right">{c.current > 0 ? fmt(c.current) : '—'}</td>
                      <td className="px-3 py-2 font-bold text-blue-700 text-right">{c.days30 > 0 ? fmt(c.days30) : '—'}</td>
                      <td className="px-3 py-2 font-bold text-amber-700 text-right">{c.days60 > 0 ? fmt(c.days60) : '—'}</td>
                      <td className="px-3 py-2 font-bold text-orange-700 text-right">{c.days90 > 0 ? fmt(c.days90) : '—'}</td>
                      <td className="px-3 py-2 font-black text-red-700 text-right">{c.over90 > 0 ? fmt(c.over90) : '—'}</td>
                      <td className="px-3 py-2 font-black text-gray-900 text-right">{fmt(c.outstanding)}</td>
                      <td className="px-3 py-2 text-gray-600 text-right">{fmt(c.credit_limit || 0)}</td>
                      <td className="px-3 py-2 text-center">
                        <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${usagePct > 80 ? 'bg-red-100 text-red-700' : usagePct > 50 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{usagePct}%</div>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${risk==='High'?'bg-red-100 text-red-700':risk==='Medium'?'bg-amber-100 text-amber-700':risk==='Low'?'bg-blue-100 text-blue-700':'bg-emerald-100 text-emerald-700'}`}>{risk}</span>
                      </td>
                      <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                        <button onClick={() => { setSelectedCustomer(c); setTab('collection'); }} className="px-2 py-1 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-lg font-bold text-[10px]">Chase</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gradient-to-r from-orange-50 to-red-50 border-t-2 border-orange-300 font-black">
                  <td className="px-3 py-2.5 font-extrabold text-gray-800">TOTALS ({filtered.length})</td>
                  <td className="px-3 py-2.5" />
                  <td className="px-3 py-2.5 text-emerald-800 text-right">{fmt(totals.current)}</td>
                  <td className="px-3 py-2.5 text-blue-800 text-right">{fmt(totals.days30)}</td>
                  <td className="px-3 py-2.5 text-amber-800 text-right">{fmt(totals.days60)}</td>
                  <td className="px-3 py-2.5 text-orange-800 text-right">{fmt(totals.days90)}</td>
                  <td className="px-3 py-2.5 text-red-800 text-right">{fmt(totals.over90)}</td>
                  <td className="px-3 py-2.5 text-gray-900 text-right text-sm">{fmt(totals.outstanding)}</td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ===== CUSTOMER DETAIL ===== */}
      {tab === 'detail' && (
        <div className="space-y-4">
          {!selectedCustomer ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <p className="text-gray-400">Click on a customer in the Aging Report to view their detail</p>
              <button onClick={() => setTab('aging')} className="mt-3 px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-bold">Go to Aging Report</button>
            </div>
          ) : (
            <>
              <div className="bg-gradient-to-r from-orange-500 to-red-600 rounded-2xl p-4 text-white">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold opacity-80">CUSTOMER ACCOUNT</p>
                    <p className="text-2xl font-black mt-0.5">{selectedCustomer.customer_name}</p>
                    <p className="text-xs opacity-80 mt-1">📞 {selectedCustomer.phone} {selectedCustomer.email ? `| ✉️ ${selectedCustomer.email}` : ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs opacity-80">Outstanding Balance</p>
                    <p className="text-3xl font-black">{fmt(selectedCustomer.current_balance || 0)}</p>
                    <p className="text-xs opacity-80">Credit Limit: {fmt(selectedCustomer.credit_limit || 0)}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-3 border-b border-gray-100"><h3 className="text-sm font-extrabold text-gray-800">📋 Credit Transactions</h3></div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-gradient-to-r from-orange-700 to-red-800 text-white">
                      {['Date','Receipt #','Total','Paid','Outstanding','Age (Days)','Status'].map(h=><th key={h} className="px-3 py-2.5 text-left font-semibold text-[11px]">{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {customerSales.length === 0 ? (
                        <tr><td colSpan={7} className="text-center py-8 text-gray-400">No credit sales for this customer</td></tr>
                      ) : customerSales.map((s, i) => {
                        const outstanding = s.total - (s.amount_paid || 0);
                        const age = daysBetween(s.sale_datetime?.split('T')[0] || today, today);
                        return (
                          <tr key={s.sale_id} className={`border-b border-gray-50 ${i%2===0?'bg-white':'bg-gray-50/40'}`}>
                            <td className="px-3 py-2 text-gray-600">{s.sale_datetime?.split('T')[0]}</td>
                            <td className="px-3 py-2 font-mono text-blue-700 font-bold">{s.receipt_no}</td>
                            <td className="px-3 py-2 font-bold text-gray-800">{fmt(s.total)}</td>
                            <td className="px-3 py-2 font-bold text-emerald-700">{fmt(s.amount_paid || 0)}</td>
                            <td className="px-3 py-2 font-black text-red-600">{fmt(outstanding)}</td>
                            <td className="px-3 py-2">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${age>90?'bg-red-100 text-red-700':age>60?'bg-orange-100 text-orange-700':age>30?'bg-amber-100 text-amber-700':'bg-emerald-100 text-emerald-700'}`}>{age} days</span>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${outstanding<=0?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-700'}`}>{outstanding<=0?'Settled':'Outstanding'}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ===== COLLECTIONS ===== */}
      {tab === 'collection' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h3 className="text-sm font-extrabold text-gray-800 mb-3">📞 Log Collection Activity</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-gray-600 mb-1 block">Select Customer *</label>
                <select value={selectedCustomer?.customer_id || ''} onChange={e => setSelectedCustomer(customers.find(c=>c.customer_id===Number(e.target.value))||null)} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-orange-400">
                  <option value="">Select customer...</option>
                  {customers.filter(c=>(c.current_balance||0)>0).map(c=>(
                    <option key={c.customer_id} value={c.customer_id}>{c.customer_name} — {fmt(c.current_balance||0)}</option>
                  ))}
                </select>
              </div>
              {selectedCustomer && (
                <div className="p-3 bg-orange-50 rounded-xl border border-orange-200 text-xs">
                  <p className="font-bold text-orange-800">{selectedCustomer.customer_name}</p>
                  <p className="text-orange-700">Outstanding: <strong>{fmt(selectedCustomer.current_balance||0)}</strong></p>
                  <p className="text-orange-600">Phone: {selectedCustomer.phone}</p>
                </div>
              )}
              <div>
                <label className="text-[11px] font-bold text-gray-600 mb-1 block">Action Type</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[['phone_call','📞 Phone Call'],['sms','💬 SMS'],['visit','🏠 Visit'],['email','✉️ Email'],['promise','🤝 Promise'],['legal','⚖️ Legal']].map(([v,l]) => (
                    <button key={v} onClick={() => setCollectionAction(v)}
                      className={`py-1.5 rounded-lg border text-[10px] font-bold transition-all ${collectionAction===v?'border-orange-400 bg-orange-50 text-orange-700':'border-gray-200 text-gray-500 hover:border-gray-300'}`}>{l}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-600 mb-1 block">Notes *</label>
                <textarea value={collectionNote} onChange={e=>setCollectionNote(e.target.value)} rows={3}
                  placeholder="e.g. Called customer, promised to pay by 10th Nov. Follow up on 11th..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs bg-gray-50 resize-none focus:outline-none focus:border-orange-400" />
              </div>
              <button onClick={logCollectionActivity} disabled={savingNote||!selectedCustomer||!collectionNote}
                className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold text-xs shadow-xs disabled:opacity-50">
                {savingNote?'Saving...':'✅ Log Activity'}
              </button>
            </div>
          </div>

          {/* High-risk accounts */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-3 border-b border-gray-100"><h3 className="text-sm font-extrabold text-red-800">🚨 High-Risk Accounts (90+ Days)</h3></div>
            <div className="divide-y divide-gray-100">
              {agingRows.filter(c => c.over90 > 0 || c.days90 > 0).sort((a,b) => (b.over90+b.days90)-(a.over90+a.days90)).map(c => (
                <div key={c.customer_id} className="p-3 hover:bg-red-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-gray-900 text-xs">{c.customer_name}</p>
                      <p className="text-[10px] text-gray-500">{c.phone}</p>
                      <p className="text-[10px] text-red-600 mt-0.5">91-120d: {fmt(c.days90)} | 120d+: {fmt(c.over90)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-red-700 text-sm">{fmt(c.outstanding)}</p>
                      <button onClick={() => { setSelectedCustomer(customers.find(x=>x.customer_id===c.customer_id)||null); setCollectionAction('phone_call'); }}
                        className="mt-1 px-2 py-0.5 bg-red-600 text-white rounded text-[10px] font-bold hover:bg-red-700">Chase Now</button>
                    </div>
                  </div>
                </div>
              ))}
              {agingRows.filter(c=>c.over90>0||c.days90>0).length===0 && (
                <div className="p-6 text-center text-gray-400 text-xs">✅ No high-risk accounts!</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
