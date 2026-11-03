'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

interface PayableBill {
  id?: number; supplier_id: number; supplier_name: string; invoice_number: string;
  invoice_date: string; due_date: string; amount: number; amount_paid: number;
  balance: number; payment_terms: string; category: string; description: string;
  status: string; reference: string; outlet_id: number; payment_date?: string;
  payment_method?: string; payment_ref?: string;
}
interface Supplier { supplier_id: number; supplier_name: string; phone: string; email: string; }

const fmt = (n: number) => `KSh ${(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().split('T')[0];
const addDays = (d: string, n: number) => { const dt = new Date(d); dt.setDate(dt.getDate() + n); return dt.toISOString().split('T')[0]; };
const daysBetween = (d1: string, d2: string) => Math.floor((new Date(d2).getTime() - new Date(d1).getTime()) / 86400000);

const CATEGORIES = ['Drug Supplies', 'Packaging Materials', 'Medical Equipment', 'Utilities', 'Rent', 'Insurance Premium', 'Professional Services', 'Maintenance', 'Marketing', 'Other'];
const PAYMENT_TERMS = ['Net 7', 'Net 14', 'Net 30', 'Net 45', 'Net 60', 'Cash on Delivery', '2/10 Net 30', 'Due on Receipt'];

export default function AccountsPayablePage() {
  const { activeOutlet } = useOutlet();
  const outletId = activeOutlet?.outlet_id || 1;

  const [bills, setBills] = useState<PayableBill[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'dashboard' | 'new' | 'schedule' | 'history'>('dashboard');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [payModal, setPayModal] = useState<PayableBill | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Bank Transfer');
  const [payRef, setPayRef] = useState('');
  const [payDate, setPayDate] = useState(today());
  const [userName, setUserName] = useState('Pharmacist');

  const [form, setForm] = useState<PayableBill>({
    supplier_id: 0, supplier_name: '', invoice_number: '', invoice_date: today(),
    due_date: addDays(today(), 30), amount: 0, amount_paid: 0, balance: 0,
    payment_terms: 'Net 30', category: 'Drug Supplies', description: '',
    status: 'Unpaid', reference: '', outlet_id: outletId,
  });

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) { try { const p = JSON.parse(u); setUserName(p.name || p.email || 'Pharmacist'); } catch {} }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: bData }, { data: sData }] = await Promise.all([
        supabase.from('pharmacy_payable_bills').select('*').eq('outlet_id', outletId).order('due_date', { ascending: true }).limit(300),
        supabase.from('pharmacy_suppliers').select('supplier_id, supplier_name, phone, email').order('supplier_name'),
      ]);
      setBills(bData || []);
      setSuppliers(sData || []);
    } catch { }
    setLoading(false);
  }, [outletId]);

  useEffect(() => { loadData(); }, [loadData]);

  const saveBill = async () => {
    if (!form.supplier_id) { toast.error('Select a supplier'); return; }
    if (!form.invoice_number) { toast.error('Enter invoice number'); return; }
    if (!form.amount || form.amount <= 0) { toast.error('Enter a valid amount'); return; }
    setSaving(true);
    try {
      const billData = { ...form, balance: form.amount - form.amount_paid, outlet_id: outletId };
      const { error } = await supabase.from('pharmacy_payable_bills').insert([billData]);
      if (error) throw error;
      toast.success(`✅ Bill ${form.invoice_number} added — Due: ${form.due_date}`);
      setForm({ supplier_id: 0, supplier_name: '', invoice_number: '', invoice_date: today(), due_date: addDays(today(), 30), amount: 0, amount_paid: 0, balance: 0, payment_terms: 'Net 30', category: 'Drug Supplies', description: '', status: 'Unpaid', reference: '', outlet_id: outletId });
      await loadData();
      setTab('dashboard');
    } catch (e: any) { toast.error(e.message || 'Save failed'); }
    setSaving(false);
  };

  const processPay = async () => {
    if (!payModal) return;
    if (!payAmount || Number(payAmount) <= 0) { toast.error('Enter payment amount'); return; }
    const amt = Math.min(Number(payAmount), payModal.balance);
    setSaving(true);
    try {
      const newPaid = (payModal.amount_paid || 0) + amt;
      const newBalance = payModal.amount - newPaid;
      const newStatus = newBalance <= 0 ? 'Paid' : 'Partial';
      const { error } = await supabase.from('pharmacy_payable_bills').update({
        amount_paid: newPaid, balance: newBalance, status: newStatus,
        payment_date: payDate, payment_method: payMethod, payment_ref: payRef,
      }).eq('id', payModal.id);
      if (error) throw error;
      // Log expense
      await supabase.from('pharmacy_expenses').insert([{
        expense_date: payDate, category: payModal.category || 'Supplier Payment',
        amount: amt, description: `Payment to ${payModal.supplier_name} — Inv: ${payModal.invoice_number}`,
        reference_no: payRef || payModal.invoice_number, outlet_id: outletId, created_by: userName,
      }]);
      toast.success(`✅ Payment of ${fmt(amt)} recorded for ${payModal.supplier_name}`);
      setPayModal(null); setPayAmount(''); setPayRef('');
      await loadData();
    } catch (e: any) { toast.error(e.message || 'Payment failed'); }
    setSaving(false);
  };

  const filtered = bills.filter(b =>
    (statusFilter === 'all' || b.status === statusFilter) &&
    (!search || b.supplier_name?.toLowerCase().includes(search.toLowerCase()) || b.invoice_number?.toLowerCase().includes(search.toLowerCase()))
  );

  const todayStr = today();
  const overdue = bills.filter(b => b.status !== 'Paid' && b.due_date < todayStr);
  const dueThisWeek = bills.filter(b => b.status !== 'Paid' && b.due_date >= todayStr && b.due_date <= addDays(todayStr, 7));
  const totalOutstanding = bills.filter(b => b.status !== 'Paid').reduce((s, b) => s + (b.balance || 0), 0);
  const totalOverdue = overdue.reduce((s, b) => s + (b.balance || 0), 0);

  const overdueClass = (bill: PayableBill) => {
    if (bill.status === 'Paid') return '';
    const age = daysBetween(bill.due_date, todayStr);
    if (age > 30) return 'border-l-4 border-red-500 bg-red-50/30';
    if (age > 0) return 'border-l-4 border-orange-400 bg-orange-50/20';
    if (age > -7) return 'border-l-4 border-amber-400 bg-amber-50/20';
    return '';
  };

  const statusBadge = (s: string) => {
    const m: Record<string, string> = { Paid: 'bg-emerald-100 text-emerald-700', Partial: 'bg-blue-100 text-blue-700', Unpaid: 'bg-red-100 text-red-700', Overdue: 'bg-red-200 text-red-800' };
    return `text-[10px] font-bold px-2 py-0.5 rounded-full ${m[s] || 'bg-gray-100 text-gray-600'}`;
  };

  // Upcoming schedule next 30 days
  const upcoming = bills.filter(b => b.status !== 'Paid' && b.due_date >= todayStr && b.due_date <= addDays(todayStr, 30))
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="w-full max-w-full space-y-3.5 px-1 md:px-2 text-gray-900">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
            <span className="text-2xl">📑</span> Accounts Payable
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Manage supplier invoices, payment scheduling, due dates & automated expense logging</p>
        </div>
        <div className="flex gap-2">
          {[['dashboard','📊 Dashboard'],['new','+ New Bill'],['schedule','📅 Schedule'],['history','📋 All Bills']].map(([t,l]) => (
            <button key={t} onClick={() => setTab(t as any)}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${tab===t?'bg-indigo-600 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{l}</button>
          ))}
        </div>
      </div>

      {/* Overdue Alert Banner */}
      {overdue.length > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🚨</span>
            <div>
              <p className="font-extrabold text-red-800 text-sm">{overdue.length} OVERDUE BILLS — {fmt(totalOverdue)}</p>
              <p className="text-xs text-red-600">Immediate payment required to maintain supplier relationships</p>
            </div>
          </div>
          <button onClick={() => { setStatusFilter('Unpaid'); setTab('history'); }} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold">Pay Now</button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Outstanding', value: fmt(totalOutstanding), icon: '💰', color: 'indigo', sub: `${bills.filter(b=>b.status!=='Paid').length} bills` },
          { label: 'Overdue Amount', value: fmt(totalOverdue), icon: '🚨', color: 'red', sub: `${overdue.length} bills overdue` },
          { label: 'Due This Week', value: fmt(dueThisWeek.reduce((s,b)=>s+(b.balance||0),0)), icon: '⏰', color: 'amber', sub: `${dueThisWeek.length} bills` },
          { label: 'Paid This Month', value: fmt(bills.filter(b=>b.status==='Paid'&&b.payment_date?.slice(0,7)===today().slice(0,7)).reduce((s,b)=>s+(b.amount_paid||0),0)), icon: '✅', color: 'emerald', sub: `${bills.filter(b=>b.status==='Paid').length} paid total` },
        ].map((k,i) => (
          <div key={i} className={`bg-gradient-to-br from-${k.color}-50/80 via-${k.color}-50/40 to-white rounded-xl p-3.5 border border-${k.color}-100 shadow-sm`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-lg">{k.icon}</span>
              <span className={`text-[10px] font-semibold text-${k.color}-600 bg-${k.color}-100 px-1.5 py-0.5 rounded-full`}>AP</span>
            </div>
            <p className={`text-lg font-black text-${k.color}-700`}>{k.value}</p>
            <p className="text-xs font-semibold text-gray-700 mt-0.5">{k.label}</p>
            <p className="text-[10px] text-gray-400">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* ===== DASHBOARD ===== */}
      {tab === 'dashboard' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Due Soon */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-3 border-b border-gray-100"><h3 className="text-sm font-extrabold text-gray-800">⏰ Due This Week</h3></div>
            <div className="divide-y divide-gray-100">
              {dueThisWeek.length === 0 ? <p className="text-center text-gray-400 py-8 text-xs">No bills due this week ✅</p> :
                dueThisWeek.map(b => (
                  <div key={b.id} className="p-3 flex items-center justify-between hover:bg-amber-50">
                    <div>
                      <p className="font-bold text-gray-900 text-xs">{b.supplier_name}</p>
                      <p className="text-[10px] text-gray-500">{b.invoice_number} | Due: {b.due_date}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-amber-700">{fmt(b.balance)}</span>
                      <button onClick={() => { setPayModal(b); setPayAmount(b.balance.toString()); }} className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold">Pay</button>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Overdue */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-3 border-b border-red-100 bg-red-50"><h3 className="text-sm font-extrabold text-red-800">🚨 Overdue Bills</h3></div>
            <div className="divide-y divide-gray-100">
              {overdue.length === 0 ? <p className="text-center text-gray-400 py-8 text-xs">No overdue bills ✅</p> :
                overdue.sort((a,b)=>a.due_date.localeCompare(b.due_date)).map(b => {
                  const age = daysBetween(b.due_date, todayStr);
                  return (
                    <div key={b.id} className="p-3 flex items-center justify-between hover:bg-red-50">
                      <div>
                        <p className="font-bold text-gray-900 text-xs">{b.supplier_name}</p>
                        <p className="text-[10px] text-gray-500">{b.invoice_number}</p>
                        <p className="text-[10px] text-red-600 font-bold">{age} days overdue</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-red-700">{fmt(b.balance)}</span>
                        <button onClick={() => { setPayModal(b); setPayAmount(b.balance.toString()); }} className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[10px] font-bold">Pay Now</button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Supplier Summary */}
          <div className="md:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-3 border-b border-gray-100"><h3 className="text-sm font-extrabold text-gray-800">🏭 Outstanding by Supplier</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="bg-gradient-to-r from-indigo-700 to-purple-800 text-white">
                  {['Supplier','Bills','Total Owed','Overdue','Due 7 Days','Due 30 Days','Action'].map(h=><th key={h} className="px-3 py-2.5 text-left font-semibold text-[11px]">{h}</th>)}
                </tr></thead>
                <tbody>
                  {(() => {
                    const supplierMap: Record<string, any> = {};
                    bills.filter(b=>b.status!=='Paid').forEach(b => {
                      if (!supplierMap[b.supplier_name]) supplierMap[b.supplier_name] = { name: b.supplier_name, count: 0, total: 0, overdue: 0, week: 0, month: 0 };
                      supplierMap[b.supplier_name].count++;
                      supplierMap[b.supplier_name].total += b.balance || 0;
                      if (b.due_date < todayStr) supplierMap[b.supplier_name].overdue += b.balance || 0;
                      if (b.due_date >= todayStr && b.due_date <= addDays(todayStr, 7)) supplierMap[b.supplier_name].week += b.balance || 0;
                      if (b.due_date >= todayStr && b.due_date <= addDays(todayStr, 30)) supplierMap[b.supplier_name].month += b.balance || 0;
                    });
                    const rows = Object.values(supplierMap).sort((a,b)=>b.total-a.total);
                    if (rows.length === 0) return <tr><td colSpan={7} className="text-center py-8 text-gray-400">No outstanding payables</td></tr>;
                    return rows.map((r, i) => (
                      <tr key={i} className={`border-b border-gray-50 hover:bg-indigo-50 ${i%2===0?'bg-white':'bg-gray-50/40'}`}>
                        <td className="px-3 py-2 font-bold text-gray-900">{r.name}</td>
                        <td className="px-3 py-2 text-center"><span className="bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full text-[10px]">{r.count}</span></td>
                        <td className="px-3 py-2 font-black text-indigo-700">{fmt(r.total)}</td>
                        <td className="px-3 py-2 font-bold text-red-600">{r.overdue > 0 ? fmt(r.overdue) : '—'}</td>
                        <td className="px-3 py-2 font-bold text-amber-700">{r.week > 0 ? fmt(r.week) : '—'}</td>
                        <td className="px-3 py-2 font-bold text-blue-700">{r.month > 0 ? fmt(r.month) : '—'}</td>
                        <td className="px-3 py-2">
                          <button onClick={() => { setSearch(r.name); setTab('history'); }} className="px-2 py-1 bg-gray-100 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-bold">View Bills</button>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===== NEW BILL ===== */}
      {tab === 'new' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 max-w-3xl">
          <h3 className="text-sm font-extrabold text-gray-800 mb-4 flex items-center gap-2">📑 Add Supplier Bill / Invoice</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="text-[11px] font-bold text-gray-600 mb-1 block">Supplier *</label>
              <select value={form.supplier_id} onChange={e => {
                const s = suppliers.find(x=>x.supplier_id===Number(e.target.value));
                setForm(f=>({...f, supplier_id:Number(e.target.value), supplier_name: s?.supplier_name||''}));
              }} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-indigo-400">
                <option value={0}>Select Supplier...</option>
                {suppliers.map(s=><option key={s.supplier_id} value={s.supplier_id}>{s.supplier_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-600 mb-1 block">Invoice Number *</label>
              <input value={form.invoice_number} onChange={e=>setForm(f=>({...f,invoice_number:e.target.value}))} placeholder="e.g. INV-2024-00123" className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-indigo-400" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-600 mb-1 block">Category</label>
              <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-indigo-400">
                {CATEGORIES.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-600 mb-1 block">Invoice Date</label>
              <input type="date" value={form.invoice_date} onChange={e=>setForm(f=>({...f,invoice_date:e.target.value,due_date:addDays(e.target.value,30)}))} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-indigo-400" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-600 mb-1 block">Payment Terms</label>
              <select value={form.payment_terms} onChange={e=>{
                setForm(f=>{
                  const days = parseInt(e.target.value.replace(/\D/g,'')) || 30;
                  return {...f, payment_terms:e.target.value, due_date:addDays(f.invoice_date, days)};
                });
              }} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-indigo-400">
                {PAYMENT_TERMS.map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-600 mb-1 block">Due Date</label>
              <input type="date" value={form.due_date} onChange={e=>setForm(f=>({...f,due_date:e.target.value}))} className={`w-full px-2 py-1.5 border rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-indigo-400 ${form.due_date < today() ? 'border-red-300 bg-red-50' : 'border-gray-200'}`} />
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-600 mb-1 block">Invoice Amount (KSh) *</label>
              <input type="number" value={form.amount||''} onChange={e=>setForm(f=>({...f,amount:Number(e.target.value),balance:Number(e.target.value)-f.amount_paid}))} placeholder="0.00" className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-indigo-400 font-bold text-right" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-600 mb-1 block">Amount Already Paid (KSh)</label>
              <input type="number" value={form.amount_paid||''} onChange={e=>setForm(f=>({...f,amount_paid:Number(e.target.value),balance:f.amount-Number(e.target.value)}))} placeholder="0.00" className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-indigo-400 text-right" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-600 mb-1 block">Reference / PO Number</label>
              <input value={form.reference} onChange={e=>setForm(f=>({...f,reference:e.target.value}))} placeholder="e.g. PO-2024-001" className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-indigo-400" />
            </div>
            <div className="col-span-2 md:col-span-3">
              <label className="text-[11px] font-bold text-gray-600 mb-1 block">Description</label>
              <input value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Brief description of goods/services..." className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-indigo-400" />
            </div>
          </div>
          {form.amount > 0 && (
            <div className="mt-4 p-3 bg-indigo-50 rounded-xl border border-indigo-200 flex items-center justify-between text-xs">
              <span className="font-semibold text-indigo-800">Invoice: {fmt(form.amount)} | Paid: {fmt(form.amount_paid)} | Balance Due: <strong>{fmt(form.amount - form.amount_paid)}</strong></span>
              <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${form.due_date < today() ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{form.due_date < today() ? '⚠️ Past Due' : `Due in ${daysBetween(today(), form.due_date)} days`}</span>
            </div>
          )}
          <div className="flex gap-2 mt-4 justify-end">
            <button onClick={() => setTab('dashboard')} className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-50">Cancel</button>
            <button onClick={saveBill} disabled={saving} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-xs disabled:opacity-50">
              {saving ? 'Saving...' : '✅ Save Bill'}
            </button>
          </div>
        </div>
      )}

      {/* ===== SCHEDULE ===== */}
      {tab === 'schedule' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-3 border-b border-gray-100"><h3 className="text-sm font-extrabold text-gray-800">📅 Payment Schedule — Next 30 Days</h3></div>
          {upcoming.length === 0 ? (
            <div className="text-center py-12 text-gray-400"><p>No upcoming payments in the next 30 days ✅</p></div>
          ) : (
            <div className="divide-y divide-gray-100">
              {upcoming.map(b => {
                const daysLeft = daysBetween(todayStr, b.due_date);
                return (
                  <div key={b.id} className={`p-4 flex items-center justify-between hover:bg-indigo-50 transition-colors ${daysLeft <= 3 ? 'border-l-4 border-red-400' : daysLeft <= 7 ? 'border-l-4 border-amber-400' : ''}`}>
                    <div className="flex items-center gap-4">
                      <div className={`text-center w-14 rounded-xl p-2 ${daysLeft <= 3 ? 'bg-red-100' : daysLeft <= 7 ? 'bg-amber-100' : 'bg-indigo-50'}`}>
                        <p className={`text-xs font-black ${daysLeft <= 3 ? 'text-red-700' : daysLeft <= 7 ? 'text-amber-700' : 'text-indigo-700'}`}>{daysLeft}</p>
                        <p className={`text-[9px] font-bold ${daysLeft <= 3 ? 'text-red-600' : daysLeft <= 7 ? 'text-amber-600' : 'text-indigo-600'}`}>days</p>
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-xs">{b.supplier_name}</p>
                        <p className="text-[10px] text-gray-500">{b.invoice_number} • {b.category}</p>
                        <p className="text-[10px] text-gray-400">Due: {b.due_date} • Terms: {b.payment_terms}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-black text-indigo-700 text-sm">{fmt(b.balance)}</p>
                        <span className={statusBadge(b.status)}>{b.status}</span>
                      </div>
                      <button onClick={() => { setPayModal(b); setPayAmount(b.balance.toString()); }} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs">Pay</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===== ALL BILLS ===== */}
      {tab === 'history' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-3 border-b border-gray-100 flex flex-wrap gap-2 items-center justify-between">
            <div className="flex gap-1.5">
              {['all','Unpaid','Partial','Paid'].map(s=>(
                <button key={s} onClick={()=>setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${statusFilter===s?'bg-indigo-600 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{s==='all'?'All':s}</button>
              ))}
            </div>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search supplier, invoice..." className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none w-56" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="bg-gradient-to-r from-indigo-700 via-purple-700 to-violet-800 text-white">
                {['Supplier','Invoice #','Category','Invoice Date','Due Date','Amount','Paid','Balance','Terms','Status','Action'].map(h=>(
                  <th key={h} className="px-3 py-2.5 text-left font-semibold text-[11px] whitespace-nowrap">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filtered.length===0 ? (
                  <tr><td colSpan={11} className="text-center py-12 text-gray-400">No bills found. Click "New Bill" to add.</td></tr>
                ) : filtered.map((b,i) => (
                  <tr key={b.id} className={`border-b border-gray-50 hover:bg-indigo-50 transition-colors ${overdueClass(b)} ${i%2===0?'bg-white':'bg-gray-50/30'}`}>
                    <td className="px-3 py-2 font-bold text-gray-900">{b.supplier_name}</td>
                    <td className="px-3 py-2 font-mono text-blue-700">{b.invoice_number}</td>
                    <td className="px-3 py-2 text-gray-500 text-[10px]">{b.category}</td>
                    <td className="px-3 py-2 text-gray-600">{b.invoice_date}</td>
                    <td className={`px-3 py-2 font-semibold ${b.due_date<todayStr&&b.status!=='Paid'?'text-red-600':'text-gray-700'}`}>{b.due_date}</td>
                    <td className="px-3 py-2 font-bold text-gray-800 text-right">{fmt(b.amount)}</td>
                    <td className="px-3 py-2 font-bold text-emerald-700 text-right">{fmt(b.amount_paid)}</td>
                    <td className="px-3 py-2 font-black text-indigo-700 text-right">{fmt(b.balance)}</td>
                    <td className="px-3 py-2 text-gray-500 text-[10px]">{b.payment_terms}</td>
                    <td className="px-3 py-2"><span className={statusBadge(b.status)}>{b.status}</span></td>
                    <td className="px-3 py-2">
                      {b.status !== 'Paid' && (
                        <button onClick={()=>{setPayModal(b);setPayAmount(b.balance.toString());}} className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-[10px]">Pay</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr className="bg-gradient-to-r from-indigo-50 to-purple-50 border-t-2 border-indigo-200">
                    <td colSpan={5} className="px-3 py-2 font-bold text-gray-700 text-xs">TOTALS ({filtered.length} bills)</td>
                    <td className="px-3 py-2 font-black text-gray-800 text-right">{fmt(filtered.reduce((s,b)=>s+b.amount,0))}</td>
                    <td className="px-3 py-2 font-black text-emerald-700 text-right">{fmt(filtered.reduce((s,b)=>s+(b.amount_paid||0),0))}</td>
                    <td className="px-3 py-2 font-black text-indigo-700 text-right">{fmt(filtered.reduce((s,b)=>s+(b.balance||0),0))}</td>
                    <td colSpan={3}/>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ===== PAYMENT MODAL ===== */}
      {payModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-100">
            <h3 className="text-base font-extrabold text-gray-800 mb-3 flex items-center gap-2">💳 Record Payment</h3>
            <div className="mb-4 p-3 bg-indigo-50 rounded-xl border border-indigo-200">
              <p className="font-bold text-indigo-800">{payModal.supplier_name}</p>
              <p className="text-xs text-indigo-600">Invoice: {payModal.invoice_number} | Balance: <strong>{fmt(payModal.balance)}</strong></p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-gray-600 mb-1 block">Payment Amount (KSh) *</label>
                <input type="number" value={payAmount} onChange={e=>setPayAmount(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-bold text-right bg-gray-50 focus:outline-none focus:border-indigo-400" />
                <div className="flex gap-2 mt-1.5">
                  <button onClick={()=>setPayAmount(payModal.balance.toString())} className="flex-1 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-bold border border-emerald-200">Full Amount {fmt(payModal.balance)}</button>
                  <button onClick={()=>setPayAmount(Math.round(payModal.balance/2).toString())} className="flex-1 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[10px] font-bold border border-blue-200">Half {fmt(payModal.balance/2)}</button>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-600 mb-1 block">Payment Method</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {['Bank Transfer','M-Pesa','Cheque','Cash','RTGS'].map(m=>(
                    <button key={m} onClick={()=>setPayMethod(m)} className={`py-1.5 rounded-lg border text-[10px] font-bold ${payMethod===m?'border-indigo-400 bg-indigo-50 text-indigo-700':'border-gray-200 text-gray-500 hover:border-gray-300'}`}>{m}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-600 mb-1 block">Payment Date</label>
                <input type="date" value={payDate} onChange={e=>setPayDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-600 mb-1 block">Reference / Cheque # / EFT Ref</label>
                <input value={payRef} onChange={e=>setPayRef(e.target.value)} placeholder="Transaction reference..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-indigo-400 font-mono" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={()=>{setPayModal(null);setPayAmount('');setPayRef('');}} className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={processPay} disabled={saving||!payAmount} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-extrabold text-sm shadow-md disabled:opacity-50">
                {saving?'Processing...':'✅ Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
