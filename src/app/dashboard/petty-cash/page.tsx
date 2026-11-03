'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

interface PettyCashEntry {
  id?: number; date: string; type: 'receipt' | 'payment'; category: string;
  description: string; reference: string; amount: number; balance?: number;
  voucher_number: string; approved_by: string; received_by: string; outlet_id: number;
}
interface PettyCashFund {
  id?: number; fund_name: string; float_amount: number; current_balance: number;
  custodian: string; outlet_id: number; last_replenished?: string;
}

const fmt = (n: number) => `KSh ${(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().split('T')[0];
const firstOfMonth = () => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; };

const CATEGORIES_PAYMENT = [
  'Office Supplies', 'Cleaning Supplies', 'Tea & Refreshments', 'Postage & Courier',
  'Minor Repairs', 'Transport/Fare', 'Printing & Stationery', 'Staff Welfare',
  'Medical Supplies (Minor)', 'Utilities (Minor)', 'Miscellaneous', 'Emergency Purchase',
];
const CATEGORIES_RECEIPT = ['Float Top-up', 'Cash Refund', 'Reimbursement', 'Other Receipt'];

export default function PettyCashPage() {
  const { activeOutlet } = useOutlet();
  const outletId = activeOutlet?.outlet_id || 1;

  const [entries, setEntries] = useState<PettyCashEntry[]>([]);
  const [fund, setFund] = useState<PettyCashFund | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'ledger' | 'entry' | 'replenish' | 'reports'>('ledger');
  const [typeFilter, setTypeFilter] = useState<'all' | 'receipt' | 'payment'>('all');
  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo, setDateTo] = useState(today());
  const [saving, setSaving] = useState(false);
  const [userName, setUserName] = useState('Pharmacist');

  const [form, setForm] = useState<PettyCashEntry>({
    date: today(), type: 'payment', category: CATEGORIES_PAYMENT[0], description: '',
    reference: '', amount: 0, voucher_number: '', approved_by: '', received_by: '',
    outlet_id: outletId,
  });
  const [replenishAmount, setReplenishAmount] = useState('');
  const [replenishRef, setReplenishRef] = useState('');

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) { try { const p = JSON.parse(u); setUserName(p.name || p.email || 'Pharmacist'); } catch {} }
  }, []);

  const genVoucher = () => {
    const d = new Date();
    return `PCV-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 900 + 100)}`;
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: entryData }, { data: fundData }] = await Promise.all([
        supabase.from('pharmacy_petty_cash').select('*').eq('outlet_id', outletId).order('date', { ascending: false }).order('id', { ascending: false }).limit(300),
        supabase.from('pharmacy_petty_cash_fund').select('*').eq('outlet_id', outletId).limit(1).single(),
      ]);
      setEntries(entryData || []);
      setFund(fundData || null);
    } catch (e) { /* quiet if tables don't exist yet */ }
    setLoading(false);
  }, [outletId]);

  useEffect(() => { loadData(); }, [loadData]);

  const saveEntry = async () => {
    if (!form.description) { toast.error('Enter a description'); return; }
    if (!form.amount || form.amount <= 0) { toast.error('Enter a valid amount'); return; }
    if (!form.approved_by) { toast.error('Enter approver name'); return; }
    setSaving(true);
    try {
      const entry = { ...form, voucher_number: form.voucher_number || genVoucher(), received_by: form.received_by || userName, outlet_id: outletId };
      const { error } = await supabase.from('pharmacy_petty_cash').insert([entry]);
      if (error) throw error;

      // Update fund balance
      if (fund) {
        const change = form.type === 'receipt' ? form.amount : -form.amount;
        await supabase.from('pharmacy_petty_cash_fund').update({ current_balance: (fund.current_balance || 0) + change }).eq('id', fund.id);
      }
      toast.success(`✅ Petty cash ${form.type === 'payment' ? 'payment' : 'receipt'} recorded: ${form.voucher_number || 'PCV'}!`);
      setForm({ date: today(), type: 'payment', category: CATEGORIES_PAYMENT[0], description: '', reference: '', amount: 0, voucher_number: genVoucher(), approved_by: '', received_by: '', outlet_id: outletId });
      await loadData();
      setTab('ledger');
    } catch (e: any) { toast.error(e.message || 'Save failed'); }
    setSaving(false);
  };

  const initFund = async () => {
    if (fund) { toast('Fund already exists'); return; }
    try {
      const { error } = await supabase.from('pharmacy_petty_cash_fund').insert([{
        fund_name: 'Alpha Pharmacy Petty Cash', float_amount: 10000,
        current_balance: 10000, custodian: userName, outlet_id: outletId,
      }]);
      if (error) throw error;
      toast.success('✅ Petty cash fund initialized with KSh 10,000');
      await loadData();
    } catch (e: any) { toast.error(e.message || 'Failed'); }
  };

  const replenishFund = async () => {
    if (!replenishAmount || Number(replenishAmount) <= 0) { toast.error('Enter replenishment amount'); return; }
    setSaving(true);
    try {
      const amount = Number(replenishAmount);
      // Record replenishment as receipt entry
      const entry: PettyCashEntry = {
        date: today(), type: 'receipt', category: 'Float Top-up',
        description: `Petty Cash Fund Replenishment${replenishRef ? ` - Ref: ${replenishRef}` : ''}`,
        reference: replenishRef, amount, voucher_number: genVoucher(),
        approved_by: userName, received_by: userName, outlet_id: outletId,
      };
      await supabase.from('pharmacy_petty_cash').insert([entry]);
      if (fund) {
        await supabase.from('pharmacy_petty_cash_fund').update({
          current_balance: (fund.current_balance || 0) + amount, last_replenished: today(),
        }).eq('id', fund.id);
      }
      toast.success(`✅ Fund replenished with ${fmt(amount)}`);
      setReplenishAmount(''); setReplenishRef('');
      await loadData();
      setTab('ledger');
    } catch (e: any) { toast.error(e.message || 'Failed'); }
    setSaving(false);
  };

  const filteredEntries = entries.filter(e =>
    (typeFilter === 'all' || e.type === typeFilter) &&
    (!dateFrom || e.date >= dateFrom) && (!dateTo || e.date <= dateTo)
  );

  // Running balance calc
  const withBalance = [...filteredEntries].reverse().reduce((acc: (PettyCashEntry & { runBalance: number })[], entry) => {
    const prev = acc.length > 0 ? acc[acc.length - 1].runBalance : (fund?.current_balance || 0);
    const runBalance = entry.type === 'receipt' ? prev + entry.amount : prev - entry.amount;
    acc.push({ ...entry, runBalance });
    return acc;
  }, []).reverse();

  const totalPayments = filteredEntries.filter(e => e.type === 'payment').reduce((s, e) => s + e.amount, 0);
  const totalReceipts = filteredEntries.filter(e => e.type === 'receipt').reduce((s, e) => s + e.amount, 0);

  // Category breakdown
  const catBreakdown = filteredEntries.filter(e => e.type === 'payment').reduce((acc: Record<string, number>, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {});
  const sortedCats = Object.entries(catBreakdown).sort((a, b) => b[1] - a[1]);

  const floatPct = fund ? Math.min(100, Math.round((fund.current_balance / (fund.float_amount || 1)) * 100)) : 0;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="w-full max-w-full space-y-3.5 px-1 md:px-2 text-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
            <span className="text-2xl">💵</span> Petty Cash Management
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Manage petty cash fund, vouchers, payments & reconciliation — full audit trail</p>
        </div>
        <div className="flex gap-2">
          {['ledger', 'entry', 'replenish', 'reports'].map(t => (
            <button key={t} onClick={() => { setTab(t as any); if (t === 'entry') setForm(f => ({ ...f, voucher_number: genVoucher() })); }}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${tab === t ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {t === 'ledger' ? '📒 Ledger' : t === 'entry' ? '+ New Entry' : t === 'replenish' ? '💰 Replenish' : '📊 Reports'}
            </button>
          ))}
        </div>
      </div>

      {/* Fund Status Card */}
      {fund ? (
        <div className="bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-500 rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold opacity-80 uppercase tracking-wide">Petty Cash Fund — {fund.fund_name}</p>
              <p className="text-4xl font-black mt-1">{fmt(fund.current_balance)}</p>
              <p className="text-xs opacity-80 mt-1">Float: {fmt(fund.float_amount)} | Custodian: {fund.custodian}</p>
              {fund.last_replenished && <p className="text-xs opacity-70 mt-0.5">Last replenished: {fund.last_replenished}</p>}
            </div>
            <div className="text-right">
              <p className="text-xs font-bold opacity-80 mb-2">Fund Level</p>
              <div className="w-32 bg-white/30 rounded-full h-3 overflow-hidden">
                <div className={`h-3 rounded-full transition-all ${floatPct > 50 ? 'bg-white' : floatPct > 25 ? 'bg-yellow-200' : 'bg-red-300'}`} style={{ width: `${floatPct}%` }} />
              </div>
              <p className="text-xs font-bold opacity-90 mt-1">{floatPct}% remaining</p>
              {floatPct < 25 && <p className="text-[10px] bg-red-500/30 rounded px-2 py-0.5 mt-1">⚠️ Low — Replenish Soon</p>}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border-2 border-dashed border-amber-300 rounded-2xl p-6 text-center">
          <p className="text-amber-800 font-semibold text-sm mb-2">No petty cash fund set up yet</p>
          <p className="text-amber-600 text-xs mb-4">Initialize a petty cash fund to start tracking expenses</p>
          <button onClick={initFund} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-sm">
            💵 Initialize Petty Cash Fund (KSh 10,000)
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Payments', value: fmt(totalPayments), icon: '📤', color: 'red', sub: `${filteredEntries.filter(e => e.type === 'payment').length} vouchers` },
          { label: 'Total Receipts', value: fmt(totalReceipts), icon: '📥', color: 'emerald', sub: `${filteredEntries.filter(e => e.type === 'receipt').length} entries` },
          { label: 'Net Change', value: fmt(totalReceipts - totalPayments), icon: '⚖️', color: totalReceipts >= totalPayments ? 'blue' : 'amber', sub: 'Period net flow' },
          { label: 'Entries Shown', value: filteredEntries.length, icon: '📋', color: 'purple', sub: 'Filtered period' },
        ].map((k, i) => (
          <div key={i} className={`bg-gradient-to-br from-${k.color}-50/80 via-${k.color}-50/40 to-white rounded-xl p-3.5 border border-${k.color}-100 shadow-sm`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-lg">{k.icon}</span>
              <span className={`text-[10px] font-semibold text-${k.color}-600 bg-${k.color}-100 px-1.5 py-0.5 rounded-full`}>Cash</span>
            </div>
            <p className={`text-lg font-black text-${k.color}-700`}>{k.value}</p>
            <p className="text-xs font-semibold text-gray-700 mt-0.5">{k.label}</p>
            <p className="text-[10px] text-gray-400">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* ============ LEDGER TAB ============ */}
      {tab === 'ledger' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-3 border-b border-gray-100 flex flex-wrap gap-2 items-center justify-between">
            <div className="flex gap-1.5">
              {[['all', 'All'], ['payment', '📤 Payments'], ['receipt', '📥 Receipts']].map(([v, l]) => (
                <button key={v} onClick={() => setTypeFilter(v as any)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${typeFilter === v ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {l}
                </button>
              ))}
            </div>
            <div className="flex gap-2 items-center">
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-2 py-1 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none" />
              <span className="text-gray-400 text-xs">to</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-2 py-1 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gradient-to-r from-amber-600 via-orange-600 to-yellow-700 text-white">
                  {['Date', 'Voucher #', 'Type', 'Category', 'Description', 'Reference', 'Payment', 'Receipt', 'Balance', 'Approved By', 'Received By'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-semibold text-[11px] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {withBalance.length === 0 ? (
                  <tr><td colSpan={11} className="text-center py-12 text-gray-400">No entries found. Add entries using "New Entry".</td></tr>
                ) : withBalance.map((e, i) => (
                  <tr key={e.id || i} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{e.date}</td>
                    <td className="px-3 py-2 font-mono text-blue-700 font-bold text-[10px]">{e.voucher_number}</td>
                    <td className="px-3 py-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${e.type === 'payment' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {e.type === 'payment' ? '📤 Payment' : '📥 Receipt'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600 text-[10px]">{e.category}</td>
                    <td className="px-3 py-2 font-semibold text-gray-800 max-w-[200px] truncate" title={e.description}>{e.description}</td>
                    <td className="px-3 py-2 text-gray-500 font-mono text-[10px]">{e.reference || '—'}</td>
                    <td className="px-3 py-2 font-bold text-red-600 text-right">{e.type === 'payment' ? fmt(e.amount) : '—'}</td>
                    <td className="px-3 py-2 font-bold text-emerald-700 text-right">{e.type === 'receipt' ? fmt(e.amount) : '—'}</td>
                    <td className="px-3 py-2 font-black text-gray-800 text-right">{fmt((e as any).runBalance || 0)}</td>
                    <td className="px-3 py-2 text-gray-600">{e.approved_by}</td>
                    <td className="px-3 py-2 text-gray-600">{e.received_by}</td>
                  </tr>
                ))}
              </tbody>
              {filteredEntries.length > 0 && (
                <tfoot>
                  <tr className="bg-gradient-to-r from-amber-50 to-orange-50 border-t-2 border-amber-200">
                    <td colSpan={6} className="px-3 py-2 font-bold text-gray-700 text-xs">PERIOD TOTALS ({filteredEntries.length} entries)</td>
                    <td className="px-3 py-2 font-black text-red-600 text-right">{fmt(totalPayments)}</td>
                    <td className="px-3 py-2 font-black text-emerald-700 text-right">{fmt(totalReceipts)}</td>
                    <td className="px-3 py-2 font-black text-gray-800 text-right">{fmt(fund?.current_balance || 0)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ============ NEW ENTRY TAB ============ */}
      {tab === 'entry' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 max-w-2xl">
          <h3 className="text-sm font-extrabold text-gray-800 mb-4 flex items-center gap-2">
            📝 New Petty Cash Entry
            <span className="ml-auto font-mono text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg text-xs">{form.voucher_number}</span>
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold text-gray-600 mb-1 block">Transaction Type *</label>
              <div className="flex gap-2">
                {[['payment', '📤 Payment'], ['receipt', '📥 Receipt']].map(([v, l]) => (
                  <button key={v} onClick={() => setForm(f => ({ ...f, type: v as any, category: v === 'payment' ? CATEGORIES_PAYMENT[0] : CATEGORIES_RECEIPT[0] }))}
                    className={`flex-1 py-2 rounded-xl border-2 font-bold text-xs transition-all ${form.type === v ? (v === 'payment' ? 'border-red-400 bg-red-50 text-red-700' : 'border-emerald-400 bg-emerald-50 text-emerald-700') : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-600 mb-1 block">Date *</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-amber-400" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-600 mb-1 block">Category *</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-amber-400">
                {(form.type === 'payment' ? CATEGORIES_PAYMENT : CATEGORIES_RECEIPT).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-600 mb-1 block">Amount (KSh) *</label>
              <input type="number" value={form.amount || ''} onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) }))} placeholder="0.00" className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-amber-400 font-bold text-right" />
            </div>
            <div className="col-span-2">
              <label className="text-[11px] font-bold text-gray-600 mb-1 block">Description *</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe this expense/receipt..." className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-amber-400" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-600 mb-1 block">Reference / Receipt #</label>
              <input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="e.g. Receipt-001" className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-amber-400" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-600 mb-1 block">Voucher Number</label>
              <input value={form.voucher_number} onChange={e => setForm(f => ({ ...f, voucher_number: e.target.value }))} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-amber-400 font-mono" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-600 mb-1 block">Approved By *</label>
              <input value={form.approved_by} onChange={e => setForm(f => ({ ...f, approved_by: e.target.value }))} placeholder="Manager / pharmacist name" className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-amber-400" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-600 mb-1 block">Received By</label>
              <input value={form.received_by || userName} onChange={e => setForm(f => ({ ...f, received_by: e.target.value }))} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-amber-400" />
            </div>
          </div>

          {/* Balance Preview */}
          {fund && form.amount > 0 && (
            <div className={`mt-4 p-3 rounded-xl border text-xs font-semibold flex items-center justify-between ${form.type === 'payment' && form.amount > (fund.current_balance || 0) ? 'bg-red-50 border-red-200 text-red-900' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
              <span>Balance after this entry:</span>
              <span className="font-black text-base">
                {form.type === 'payment' ? fmt((fund.current_balance || 0) - form.amount) : fmt((fund.current_balance || 0) + form.amount)}
              </span>
              {form.type === 'payment' && form.amount > (fund.current_balance || 0) && (
                <span className="text-red-700">⚠️ Exceeds available balance!</span>
              )}
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <button onClick={() => setTab('ledger')} className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-lg font-semibold text-xs hover:bg-gray-50">Cancel</button>
            <button onClick={saveEntry} disabled={saving} className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-xs shadow-xs">
              {saving ? 'Saving...' : `✅ Save ${form.type === 'payment' ? 'Payment' : 'Receipt'}`}
            </button>
          </div>
        </div>
      )}

      {/* ============ REPLENISH TAB ============ */}
      {tab === 'replenish' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 max-w-lg">
          <h3 className="text-sm font-extrabold text-gray-800 mb-4 flex items-center gap-2">💰 Replenish Petty Cash Fund</h3>
          {fund && (
            <div className="mb-4 p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs">
              <p className="font-bold text-amber-800">Current Balance: <span className="text-lg">{fmt(fund.current_balance)}</span></p>
              <p className="text-amber-600 mt-0.5">Fund Float: {fmt(fund.float_amount)} | Deficit: {fmt(Math.max(0, (fund.float_amount || 0) - (fund.current_balance || 0)))}</p>
            </div>
          )}
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-bold text-gray-600 mb-1 block">Replenishment Amount (KSh) *</label>
              <input type="number" value={replenishAmount} onChange={e => setReplenishAmount(e.target.value)}
                placeholder="e.g. 5000" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-amber-400 font-bold text-right" />
              {fund && replenishAmount && (
                <p className="text-xs text-emerald-700 font-semibold mt-1">
                  New balance will be: {fmt((fund.current_balance || 0) + Number(replenishAmount))}
                </p>
              )}
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-600 mb-1 block">Reference (Bank/Transfer Reference)</label>
              <input value={replenishRef} onChange={e => setReplenishRef(e.target.value)} placeholder="e.g. EFT-2024-001 or M-Pesa code" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-amber-400" />
            </div>
            {/* Quick amounts */}
            <div>
              <label className="text-[11px] font-bold text-gray-600 mb-1 block">Quick Amounts</label>
              <div className="flex gap-2">
                {[2000, 5000, 10000, 20000].map(amt => (
                  <button key={amt} onClick={() => setReplenishAmount(amt.toString())} className="flex-1 py-2 bg-gray-100 hover:bg-amber-100 rounded-lg text-xs font-bold text-gray-700 transition-colors">
                    {(amt / 1000).toFixed(0)}K
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setTab('ledger')} className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-lg font-semibold text-xs hover:bg-gray-50">Cancel</button>
            <button onClick={replenishFund} disabled={saving || !replenishAmount} className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-xs shadow-xs disabled:opacity-50">
              {saving ? 'Processing...' : `✅ Replenish ${replenishAmount ? fmt(Number(replenishAmount)) : 'Fund'}`}
            </button>
          </div>
        </div>
      )}

      {/* ============ REPORTS TAB ============ */}
      {tab === 'reports' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Category Breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-3 border-b border-gray-100">
              <h3 className="text-sm font-extrabold text-gray-800">📊 Expense by Category</h3>
            </div>
            <div className="p-4 space-y-2">
              {sortedCats.length === 0 ? (
                <p className="text-center text-gray-400 py-8 text-xs">No payments recorded yet</p>
              ) : sortedCats.map(([cat, amt]) => (
                <div key={cat} className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 w-36 truncate">{cat}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div className="h-2 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full" style={{ width: `${Math.min(100, (amt / totalPayments) * 100)}%` }} />
                  </div>
                  <span className="text-xs font-bold text-amber-700 w-24 text-right">{fmt(amt)}</span>
                  <span className="text-[10px] text-gray-400 w-8">{Math.round((amt / totalPayments) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Fund Health */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-3 border-b border-gray-100">
              <h3 className="text-sm font-extrabold text-gray-800">🏥 Fund Health & Compliance</h3>
            </div>
            <div className="p-4 space-y-3">
              {fund ? (
                <>
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-xs font-semibold text-gray-700">Fund Float (Ceiling)</span>
                    <span className="font-bold text-gray-900">{fmt(fund.float_amount)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-xs font-semibold text-gray-700">Current Balance</span>
                    <span className={`font-bold ${floatPct < 25 ? 'text-red-600' : 'text-emerald-700'}`}>{fmt(fund.current_balance)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-xs font-semibold text-gray-700">Total Payments (Period)</span>
                    <span className="font-bold text-red-600">{fmt(totalPayments)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-xs font-semibold text-gray-700">Total Receipts (Period)</span>
                    <span className="font-bold text-emerald-700">{fmt(totalReceipts)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-xs font-semibold text-gray-700">Net Movement</span>
                    <span className={`font-bold ${totalReceipts >= totalPayments ? 'text-emerald-700' : 'text-red-600'}`}>{fmt(totalReceipts - totalPayments)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-xs font-semibold text-gray-700">Replenishment Needed</span>
                    <span className={`font-bold ${fund.float_amount > fund.current_balance ? 'text-amber-700' : 'text-emerald-700'}`}>
                      {fund.float_amount > fund.current_balance ? fmt(fund.float_amount - fund.current_balance) : 'None — Sufficient'}
                    </span>
                  </div>
                  {floatPct < 25 && (
                    <div className="mt-2 p-3 bg-red-50 rounded-xl border border-red-200 text-xs text-red-800 font-semibold">
                      🚨 Fund is critically low ({floatPct}%)! Click "Replenish" immediately.
                    </div>
                  )}
                </>
              ) : (
                <p className="text-center text-gray-400 py-8 text-xs">Initialize the petty cash fund first</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
