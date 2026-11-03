'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

interface BankStatement {
  id?: number; date: string; description: string; reference: string;
  debit: number; credit: number; balance: number; matched: boolean;
  matched_to?: string; bank_account: string; outlet_id: number;
}
interface SystemRecord {
  id: string; date: string; type: string; reference: string; amount: number;
  method: string; description: string; matched: boolean;
}
interface Reconciliation {
  id?: number; period_start: string; period_end: string; bank_account: string;
  opening_balance: number; closing_balance: number; total_credits: number;
  total_debits: number; unmatched_bank: number; unmatched_system: number;
  status: string; prepared_by: string; approved_by: string; outlet_id: number;
  created_at?: string;
}

const fmt = (n: number) => `KSh ${(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().split('T')[0];
const firstOfMonth = () => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; };

const BANK_ACCOUNTS = [
  'KCB Bank - Alpha Pharmacy Main', 'Equity Bank - Operations', 'Co-op Bank - Payroll',
  'M-Pesa Paybill - Till 247247', 'Stanbic Bank - Savings', 'NCBA Bank - Current',
];

export default function BankReconciliationPage() {
  const { activeOutlet } = useOutlet();
  const outletId = activeOutlet?.outlet_id || 1;

  const [tab, setTab] = useState<'dashboard' | 'new' | 'history' | 'import'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [reconciliations, setReconciliations] = useState<Reconciliation[]>([]);
  const [bankStatements, setBankStatements] = useState<BankStatement[]>([]);
  const [systemRecords, setSystemRecords] = useState<SystemRecord[]>([]);
  const [userName, setUserName] = useState('Pharmacist');

  // New reconciliation form
  const [selectedBank, setSelectedBank] = useState(BANK_ACCOUNTS[0]);
  const [periodStart, setPeriodStart] = useState(firstOfMonth());
  const [periodEnd, setPeriodEnd] = useState(today());
  const [openingBal, setOpeningBal] = useState('');
  const [closingBal, setClosingBal] = useState('');
  const [approvedBy, setApprovedBy] = useState('');
  const [saving, setSaving] = useState(false);

  // Bank statement import
  const [importRows, setImportRows] = useState<BankStatement[]>([]);
  const [importBank, setImportBank] = useState(BANK_ACCOUNTS[0]);

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) { try { const p = JSON.parse(u); setUserName(p.name || p.email || 'Pharmacist'); } catch {} }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: recData }, { data: stmtData }, { data: salesData }, { data: expData }] = await Promise.all([
        supabase.from('pharmacy_bank_reconciliations').select('*').eq('outlet_id', outletId).order('id', { ascending: false }).limit(50),
        supabase.from('pharmacy_bank_statements').select('*').eq('outlet_id', outletId).order('date', { ascending: false }).limit(200),
        supabase.from('pharmacy_sales').select('sale_id, sale_datetime, total, payment_method, mpesa_receipt, receipt_no').eq('outlet_id', outletId).gte('sale_datetime', firstOfMonth()).order('sale_datetime', { ascending: false }),
        supabase.from('pharmacy_expenses').select('expense_id, expense_date, amount, description, reference_no').eq('outlet_id', outletId).gte('expense_date', firstOfMonth()).order('expense_date', { ascending: false }),
      ]);
      setReconciliations(recData || []);
      setBankStatements(stmtData || []);

      // Build system records from sales + expenses
      const sysRecs: SystemRecord[] = [
        ...(salesData || []).map((s: any) => ({
          id: `SALE-${s.sale_id}`, date: s.sale_datetime?.split('T')[0] || '',
          type: 'Sale', reference: s.receipt_no || `SALE-${s.sale_id}`,
          amount: s.total || 0, method: s.payment_method || 'CASH',
          description: `Sale Receipt ${s.receipt_no}`, matched: false,
        })),
        ...(expData || []).map((e: any) => ({
          id: `EXP-${e.expense_id}`, date: e.expense_date || '',
          type: 'Expense', reference: e.reference_no || `EXP-${e.expense_id}`,
          amount: -(e.amount || 0), method: 'CASH',
          description: e.description, matched: false,
        })),
      ];
      setSystemRecords(sysRecs);
    } catch (e) { toast.error('Failed to load data'); }
    setLoading(false);
  }, [outletId]);

  useEffect(() => { loadData(); }, [loadData]);

  const addImportRow = () => {
    setImportRows(prev => [...prev, {
      date: today(), description: '', reference: '', debit: 0, credit: 0,
      balance: 0, matched: false, bank_account: importBank, outlet_id: outletId,
    }]);
  };
  const updateImportRow = (idx: number, field: keyof BankStatement, val: any) => {
    setImportRows(prev => { const n = [...prev]; (n[idx] as any)[field] = val; return n; });
  };
  const removeImportRow = (idx: number) => setImportRows(prev => prev.filter((_, i) => i !== idx));

  const saveImport = async () => {
    if (importRows.length === 0) { toast.error('Add at least one bank statement entry'); return; }
    setSaving(true);
    try {
      const rows = importRows.map(r => ({ ...r, bank_account: importBank, outlet_id: outletId }));
      const { error } = await supabase.from('pharmacy_bank_statements').insert(rows);
      if (error) throw error;
      toast.success(`✅ ${rows.length} bank statement entries imported`);
      setImportRows([]);
      await loadData();
      setTab('dashboard');
    } catch (e: any) { toast.error(e.message || 'Import failed'); }
    setSaving(false);
  };

  const saveReconciliation = async (status: 'Draft' | 'Final') => {
    if (!openingBal) { toast.error('Enter opening balance'); return; }
    if (!closingBal) { toast.error('Enter closing balance'); return; }
    setSaving(true);
    try {
      // Calculate matched/unmatched
      const periodStmts = bankStatements.filter(s => s.bank_account === selectedBank && s.date >= periodStart && s.date <= periodEnd);
      const totalCredits = periodStmts.reduce((s, r) => s + (r.credit || 0), 0);
      const totalDebits = periodStmts.reduce((s, r) => s + (r.debit || 0), 0);
      const unmatchedBank = periodStmts.filter(s => !s.matched).length;
      const periodSys = systemRecords.filter(r => r.date >= periodStart && r.date <= periodEnd);
      const unmatchedSys = periodSys.filter(r => !r.matched).length;

      const rec: Reconciliation = {
        period_start: periodStart, period_end: periodEnd, bank_account: selectedBank,
        opening_balance: Number(openingBal), closing_balance: Number(closingBal),
        total_credits: totalCredits, total_debits: totalDebits,
        unmatched_bank: unmatchedBank, unmatched_system: unmatchedSys,
        status, prepared_by: userName, approved_by: approvedBy, outlet_id: outletId,
      };
      const { error } = await supabase.from('pharmacy_bank_reconciliations').insert([rec]);
      if (error) throw error;
      toast.success(`Bank reconciliation saved as ${status}`);
      await loadData();
      setTab('history');
    } catch (e: any) { toast.error(e.message || 'Save failed'); }
    setSaving(false);
  };

  // Summary stats
  const thisMonth = reconciliations.filter(r => r.period_start >= firstOfMonth());
  const totalSalesThisMonth = systemRecords.filter(r => r.type === 'Sale' && r.amount > 0).reduce((s, r) => s + r.amount, 0);
  const totalExpThisMonth = systemRecords.filter(r => r.type === 'Expense').reduce((s, r) => s + Math.abs(r.amount), 0);
  const totalBankCredits = bankStatements.filter(s => s.date >= firstOfMonth()).reduce((s, r) => s + (r.credit || 0), 0);
  const variance = totalSalesThisMonth - totalBankCredits;

  const statusBadge = (s: string) => {
    if (s === 'Final') return 'bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full';
    return 'bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full';
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="w-full max-w-full space-y-3.5 px-1 md:px-2 text-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
            <span className="text-2xl">🏦</span> Bank Reconciliation
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Match pharmacy system records with bank statements — detect discrepancies, track unmatched entries</p>
        </div>
        <div className="flex gap-2">
          {['dashboard', 'new', 'import', 'history'].map(t => (
            <button key={t} onClick={() => setTab(t as any)}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${tab === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {t === 'dashboard' ? '📊 Overview' : t === 'new' ? '+ New Recon' : t === 'import' ? '📤 Import Statement' : '📋 History'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'System Sales (MTD)', value: fmt(totalSalesThisMonth), icon: '💰', color: 'emerald', sub: `${systemRecords.filter(r => r.type === 'Sale').length} transactions` },
          { label: 'Bank Credits (MTD)', value: fmt(totalBankCredits), icon: '🏦', color: 'blue', sub: `${bankStatements.filter(s => s.date >= firstOfMonth()).length} entries` },
          { label: 'Variance (System vs Bank)', value: fmt(Math.abs(variance)), icon: variance === 0 ? '✅' : '⚠️', color: Math.abs(variance) < 1000 ? 'emerald' : 'red', sub: variance === 0 ? 'Balanced!' : `${variance > 0 ? 'Over' : 'Under'} reported` },
          { label: 'Completed Reconciliations', value: reconciliations.filter(r => r.status === 'Final').length, icon: '📋', color: 'purple', sub: `${reconciliations.length} total` },
        ].map((k, i) => (
          <div key={i} className={`bg-gradient-to-br from-${k.color}-50/80 via-${k.color}-50/40 to-white rounded-xl p-3.5 border border-${k.color}-100 shadow-sm`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-lg">{k.icon}</span>
              <span className={`text-[10px] font-semibold text-${k.color}-600 bg-${k.color}-100 px-1.5 py-0.5 rounded-full`}>Bank</span>
            </div>
            <p className={`text-lg font-black text-${k.color}-700`}>{k.value}</p>
            <p className="text-xs font-semibold text-gray-700 mt-0.5">{k.label}</p>
            <p className="text-[10px] text-gray-400">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* ============ DASHBOARD TAB ============ */}
      {tab === 'dashboard' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* System Records */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-gray-800">💻 System Records (This Month)</h3>
              <span className="text-xs text-gray-500">{systemRecords.length} records</span>
            </div>
            <div className="overflow-auto max-h-80">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white">
                    {['Date', 'Type', 'Reference', 'Amount', 'Method'].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-[11px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {systemRecords.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8 text-gray-400">No records this month</td></tr>
                  ) : systemRecords.slice(0, 30).map((r, i) => (
                    <tr key={r.id} className={`border-b border-gray-50 hover:bg-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                      <td className="px-3 py-1.5 text-gray-600">{r.date}</td>
                      <td className="px-3 py-1.5">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${r.type === 'Sale' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{r.type}</span>
                      </td>
                      <td className="px-3 py-1.5 font-mono text-gray-700">{r.reference}</td>
                      <td className={`px-3 py-1.5 font-bold ${r.amount >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{fmt(Math.abs(r.amount))}</td>
                      <td className="px-3 py-1.5 text-gray-500 text-[10px]">{r.method}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bank Statements */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-gray-800">🏦 Bank Statement Entries</h3>
              <button onClick={() => setTab('import')} className="px-2 py-1 bg-blue-600 text-white rounded-lg font-bold text-[10px]">+ Import</button>
            </div>
            <div className="overflow-auto max-h-80">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gradient-to-r from-indigo-700 to-purple-800 text-white">
                    {['Date', 'Description', 'Reference', 'Credit', 'Debit'].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-[11px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bankStatements.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8 text-gray-400">No bank statements imported yet. Click "Import Statement" above.</td></tr>
                  ) : bankStatements.slice(0, 30).map((s, i) => (
                    <tr key={i} className={`border-b border-gray-50 hover:bg-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                      <td className="px-3 py-1.5 text-gray-600">{s.date}</td>
                      <td className="px-3 py-1.5 text-gray-700 max-w-[140px] truncate" title={s.description}>{s.description}</td>
                      <td className="px-3 py-1.5 font-mono text-gray-600 text-[10px]">{s.reference}</td>
                      <td className="px-3 py-1.5 font-bold text-emerald-700">{s.credit > 0 ? fmt(s.credit) : '—'}</td>
                      <td className="px-3 py-1.5 font-bold text-red-600">{s.debit > 0 ? fmt(s.debit) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Reconciliation Summary */}
          <div className="md:col-span-2 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-4">
            <h3 className="text-sm font-extrabold text-blue-900 mb-3 flex items-center gap-2">⚖️ This Month's Reconciliation Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Sales (System)', value: fmt(totalSalesThisMonth), positive: true },
                { label: 'Total Expenses (System)', value: fmt(totalExpThisMonth), positive: false },
                { label: 'Net System Position', value: fmt(totalSalesThisMonth - totalExpThisMonth), positive: totalSalesThisMonth > totalExpThisMonth },
                { label: 'Bank Credits Recorded', value: fmt(totalBankCredits), positive: true },
              ].map((item, i) => (
                <div key={i} className="bg-white rounded-xl p-3 border border-blue-100">
                  <p className="text-[10px] font-bold text-gray-500 uppercase">{item.label}</p>
                  <p className={`text-base font-black mt-1 ${item.positive ? 'text-emerald-700' : 'text-red-600'}`}>{item.value}</p>
                </div>
              ))}
            </div>
            {Math.abs(variance) > 0 && (
              <div className={`mt-3 p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${Math.abs(variance) < 5000 ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
                <span>{Math.abs(variance) < 5000 ? '⚠️' : '🚨'}</span>
                <span>Variance detected: System shows {fmt(totalSalesThisMonth)} but bank shows {fmt(totalBankCredits)} — difference of {fmt(Math.abs(variance))}. {variance > 0 ? 'Some sales may not have been deposited.' : 'Bank has more credits than system records.'}</span>
              </div>
            )}
            {variance === 0 && bankStatements.length > 0 && (
              <div className="mt-3 p-3 rounded-xl border bg-emerald-50 border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2">
                <span>✅</span> System and bank records are balanced this month!
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============ NEW RECONCILIATION TAB ============ */}
      {tab === 'new' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-extrabold text-gray-800 mb-4 flex items-center gap-2">⚖️ New Bank Reconciliation</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="text-[11px] font-bold text-gray-600 mb-1 block">Bank Account</label>
              <select value={selectedBank} onChange={e => setSelectedBank(e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-blue-400">
                {BANK_ACCOUNTS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-600 mb-1 block">Period Start</label>
              <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-600 mb-1 block">Period End</label>
              <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-600 mb-1 block">Opening Balance (KSh) *</label>
              <input type="number" value={openingBal} onChange={e => setOpeningBal(e.target.value)} placeholder="Bank opening balance" className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-600 mb-1 block">Closing Balance (KSh) *</label>
              <input type="number" value={closingBal} onChange={e => setClosingBal(e.target.value)} placeholder="Bank closing balance" className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-600 mb-1 block">Prepared By</label>
              <input value={userName} readOnly className="w-full px-2 py-1.5 border border-gray-100 rounded-lg text-xs bg-gray-100 text-gray-600" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-600 mb-1 block">Approved By (Manager)</label>
              <input value={approvedBy} onChange={e => setApprovedBy(e.target.value)} placeholder="Approving manager name" className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-blue-400" />
            </div>
          </div>

          {/* Summary for period */}
          {periodStart && periodEnd && (
            <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
              <h4 className="text-xs font-extrabold text-blue-900 mb-3">📊 Period Summary ({periodStart} → {periodEnd})</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(() => {
                  const periodSales = systemRecords.filter(r => r.date >= periodStart && r.date <= periodEnd && r.type === 'Sale');
                  const periodExp = systemRecords.filter(r => r.date >= periodStart && r.date <= periodEnd && r.type === 'Expense');
                  const periodStmts = bankStatements.filter(s => s.date >= periodStart && s.date <= periodEnd && s.bank_account === selectedBank);
                  const sysTotal = periodSales.reduce((s, r) => s + r.amount, 0);
                  const expTotal = periodExp.reduce((s, r) => s + Math.abs(r.amount), 0);
                  const bankTotal = periodStmts.reduce((s, r) => s + (r.credit || 0), 0);
                  const diff = sysTotal - bankTotal;
                  return [
                    { label: 'System Sales', value: fmt(sysTotal), tx: `${periodSales.length} tx` },
                    { label: 'System Expenses', value: fmt(expTotal), tx: `${periodExp.length} tx` },
                    { label: 'Bank Credits', value: fmt(bankTotal), tx: `${periodStmts.length} entries` },
                    { label: 'Variance', value: fmt(Math.abs(diff)), tx: diff === 0 ? '✅ Balanced' : diff > 0 ? '⚠️ System > Bank' : '⚠️ Bank > System' },
                  ].map((item, i) => (
                    <div key={i} className="bg-white rounded-xl p-3 border border-blue-100">
                      <p className="text-[10px] font-bold text-gray-500">{item.label}</p>
                      <p className="text-sm font-black text-blue-800 mt-0.5">{item.value}</p>
                      <p className="text-[10px] text-gray-400">{item.tx}</p>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end mt-4">
            <button onClick={() => setTab('dashboard')} className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-50">Cancel</button>
            <button onClick={() => saveReconciliation('Draft')} disabled={saving} className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-xs font-bold">
              {saving ? 'Saving...' : '💾 Save Draft'}
            </button>
            <button onClick={() => saveReconciliation('Final')} disabled={saving} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs">
              {saving ? 'Saving...' : '✅ Finalize Reconciliation'}
            </button>
          </div>
        </div>
      )}

      {/* ============ IMPORT STATEMENT TAB ============ */}
      {tab === 'import' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-gray-800">📤 Import Bank Statement</h3>
            <div className="flex items-center gap-3">
              <select value={importBank} onChange={e => setImportBank(e.target.value)} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none">
                {BANK_ACCOUNTS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <button onClick={addImportRow} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs">+ Add Row</button>
            </div>
          </div>
          <div className="p-3 bg-blue-50 border-b border-blue-100 text-xs text-blue-800">
            <strong>Instructions:</strong> Enter bank statement entries manually (download from your bank portal and transcribe here), then click "Save Import" to record them for reconciliation.
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[900px]">
              <thead>
                <tr className="bg-gradient-to-r from-indigo-700 to-purple-800 text-white">
                  {['#', 'Date', 'Description', 'Reference', 'Credit (KSh)', 'Debit (KSh)', 'Balance (KSh)', ''].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-semibold text-[11px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {importRows.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-10 text-gray-400">Click "+ Add Row" to start entering bank statement entries</td></tr>
                ) : importRows.map((row, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-2 py-1.5 text-gray-500 font-bold">{idx + 1}</td>
                    <td className="px-2 py-1.5">
                      <input type="date" value={row.date} onChange={e => updateImportRow(idx, 'date', e.target.value)} className="px-1 py-1 border border-gray-200 rounded text-xs w-28" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input value={row.description} onChange={e => updateImportRow(idx, 'description', e.target.value)} placeholder="Transaction description" className="px-1.5 py-1 border border-gray-200 rounded text-xs w-52" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input value={row.reference} onChange={e => updateImportRow(idx, 'reference', e.target.value)} placeholder="Ref/TRN#" className="px-1.5 py-1 border border-gray-200 rounded text-xs w-28 font-mono uppercase" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" value={row.credit || ''} onChange={e => updateImportRow(idx, 'credit', Number(e.target.value))} placeholder="0.00" className="px-1 py-1 border border-emerald-200 rounded text-xs w-24 text-right bg-emerald-50" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" value={row.debit || ''} onChange={e => updateImportRow(idx, 'debit', Number(e.target.value))} placeholder="0.00" className="px-1 py-1 border border-red-200 rounded text-xs w-24 text-right bg-red-50" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" value={row.balance || ''} onChange={e => updateImportRow(idx, 'balance', Number(e.target.value))} placeholder="0.00" className="px-1 py-1 border border-gray-200 rounded text-xs w-28 text-right" />
                    </td>
                    <td className="px-2 py-1.5">
                      <button onClick={() => removeImportRow(idx)} className="p-1 text-red-500 hover:bg-red-50 rounded-lg text-xs font-bold">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {importRows.length > 0 && (
                <tfoot>
                  <tr className="bg-gradient-to-r from-indigo-50 to-purple-50 border-t-2 border-indigo-200">
                    <td colSpan={4} className="px-3 py-2 font-bold text-gray-700 text-xs">TOTALS ({importRows.length} entries)</td>
                    <td className="px-3 py-2 font-black text-emerald-700 text-right">{fmt(importRows.reduce((s, r) => s + (r.credit || 0), 0))}</td>
                    <td className="px-3 py-2 font-black text-red-600 text-right">{fmt(importRows.reduce((s, r) => s + (r.debit || 0), 0))}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
            <button onClick={() => { setImportRows([]); setTab('dashboard'); }} className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-50">Cancel</button>
            <button onClick={saveImport} disabled={saving || importRows.length === 0} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs disabled:opacity-50">
              {saving ? 'Saving...' : `💾 Save ${importRows.length} Entries`}
            </button>
          </div>
        </div>
      )}

      {/* ============ HISTORY TAB ============ */}
      {tab === 'history' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-3 border-b border-gray-100">
            <h3 className="text-sm font-extrabold text-gray-800">📋 Reconciliation History</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 text-white">
                  {['Period', 'Bank Account', 'Opening Bal', 'Closing Bal', 'Total Credits', 'Total Debits', 'Unmatched', 'Prepared By', 'Approved By', 'Status'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-semibold text-[11px] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reconciliations.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-12 text-gray-400">No reconciliations yet. Click "New Recon" to start.</td></tr>
                ) : reconciliations.map((r, i) => (
                  <tr key={r.id} className={`border-b border-gray-50 hover:bg-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                    <td className="px-3 py-2 font-semibold text-gray-800 whitespace-nowrap">{r.period_start} → {r.period_end}</td>
                    <td className="px-3 py-2 text-gray-600 max-w-[160px] truncate">{r.bank_account}</td>
                    <td className="px-3 py-2 font-bold text-gray-700">{fmt(r.opening_balance)}</td>
                    <td className="px-3 py-2 font-bold text-gray-700">{fmt(r.closing_balance)}</td>
                    <td className="px-3 py-2 font-bold text-emerald-700">{fmt(r.total_credits)}</td>
                    <td className="px-3 py-2 font-bold text-red-600">{fmt(r.total_debits)}</td>
                    <td className="px-3 py-2">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${r.unmatched_bank === 0 && r.unmatched_system === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {r.unmatched_bank}B / {r.unmatched_system}S
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{r.prepared_by}</td>
                    <td className="px-3 py-2 text-gray-600">{r.approved_by || '—'}</td>
                    <td className="px-3 py-2"><span className={statusBadge(r.status)}>{r.status}</span></td>
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
