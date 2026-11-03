'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

// ─── Types ──────────────────────────────────────────────────────────
interface DDRDrug {
  ddr_id: string;
  outlet_id: string;
  product_id: string;
  drug_name: string;
  drug_schedule: string;
  generic_name: string;
  strength: string;
  dosage_form: string;
  opening_balance: number;
  current_balance: number;
  unit: string;
  storage_location: string;
  last_reconciliation_date: string | null;
  active: boolean;
}

interface DDRTransaction {
  transaction_id: string;
  ddr_id: string;
  outlet_id: string;
  transaction_type: string;
  transaction_date: string;
  quantity: number;
  balance_after: number;
  batch_number: string;
  expiry_date: string;
  supplier_name: string;
  supplier_address: string;
  invoice_number: string;
  patient_name: string;
  patient_id_number: string;
  patient_address: string;
  patient_phone: string;
  prescriber_name: string;
  prescriber_reg_no: string;
  prescriber_facility: string;
  prescription_date: string;
  prescription_no: string;
  pharmacist_name: string;
  pharmacist_reg_no: string;
  counter_signatory: string;
  counter_sign_reg_no: string;
  disposal_method: string;
  disposal_witness: string;
  ppb_reference: string;
  loss_type: string;
  police_report_no: string;
  ppb_notification_date: string;
  notes: string;
  created_by: string;
  pharmacy_ddr_register?: DDRDrug;
}

// ─── Helpers ────────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtCurrency = (n: number) => `KSh ${n.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const scheduleColors: Record<string, { bg: string; text: string; ring: string }> = {
  S1: { bg: 'bg-emerald-100', text: 'text-emerald-800', ring: 'ring-emerald-300' },
  S2: { bg: 'bg-blue-100', text: 'text-blue-800', ring: 'ring-blue-300' },
  S3: { bg: 'bg-violet-100', text: 'text-violet-800', ring: 'ring-violet-300' },
  S4: { bg: 'bg-amber-100', text: 'text-amber-800', ring: 'ring-amber-300' },
  S5: { bg: 'bg-orange-100', text: 'text-orange-800', ring: 'ring-orange-300' },
  S6: { bg: 'bg-rose-100', text: 'text-rose-800', ring: 'ring-rose-300' },
  S7: { bg: 'bg-red-100', text: 'text-red-800', ring: 'ring-red-300' },
};

const txTypeColors: Record<string, { bg: string; text: string }> = {
  Receipt: { bg: 'bg-emerald-100', text: 'text-emerald-800' },
  Dispensing: { bg: 'bg-blue-100', text: 'text-blue-800' },
  Disposal: { bg: 'bg-amber-100', text: 'text-amber-800' },
  Loss: { bg: 'bg-rose-100', text: 'text-rose-800' },
  Theft: { bg: 'bg-red-100', text: 'text-red-800' },
  Adjustment: { bg: 'bg-violet-100', text: 'text-violet-800' },
};

const tabs = ['Register', 'Transactions', 'Dispensing Log', 'Loss & Theft', 'Disposal', 'Reconciliation', 'PPB Returns'] as const;
type Tab = typeof tabs[number];

const emptyTx: Partial<DDRTransaction> = {
  transaction_type: 'Receipt', transaction_date: new Date().toISOString().slice(0, 10),
  quantity: 0, batch_number: '', expiry_date: '', supplier_name: '', supplier_address: '',
  invoice_number: '', patient_name: '', patient_id_number: '', patient_address: '', patient_phone: '',
  prescriber_name: '', prescriber_reg_no: '', prescriber_facility: '', prescription_date: '',
  prescription_no: '', pharmacist_name: '', pharmacist_reg_no: '', counter_signatory: '',
  counter_sign_reg_no: '', disposal_method: '', disposal_witness: '', ppb_reference: '',
  loss_type: '', police_report_no: '', ppb_notification_date: '', notes: '',
};

const emptyDrug: Partial<DDRDrug> = {
  drug_name: '', drug_schedule: 'S1', generic_name: '', strength: '', dosage_form: 'Tablet',
  opening_balance: 0, current_balance: 0, unit: 'tablets', storage_location: '', active: true,
};

// ─── Component ──────────────────────────────────────────────────────
export default function DangerousDrugsPage() {
  const { activeOutlet } = useOutlet();
  const [activeTab, setActiveTab] = useState<Tab>('Register');
  const [loading, setLoading] = useState(true);
  const [drugs, setDrugs] = useState<DDRDrug[]>([]);
  const [transactions, setTransactions] = useState<DDRTransaction[]>([]);
  const [search, setSearch] = useState('');
  const [scheduleFilter, setScheduleFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [txTypeFilter, setTxTypeFilter] = useState('All');

  // Modals
  const [showAddDrug, setShowAddDrug] = useState(false);
  const [showEditDrug, setShowEditDrug] = useState(false);
  const [showViewDrug, setShowViewDrug] = useState(false);
  const [showDeleteDrug, setShowDeleteDrug] = useState(false);
  const [showRecordTx, setShowRecordTx] = useState(false);
  const [showRecon, setShowRecon] = useState(false);
  const [selectedDrug, setSelectedDrug] = useState<DDRDrug | null>(null);
  const [drugForm, setDrugForm] = useState<Partial<DDRDrug>>(emptyDrug);
  const [txForm, setTxForm] = useState<Partial<DDRTransaction>>(emptyTx);
  const [reconData, setReconData] = useState<{ ddr_id: string; drug_name: string; system_balance: number; physical_count: number }[]>([]);

  // ─── Data Loading ─────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!activeOutlet) return;
    setLoading(true);
    try {
      const [{ data: d1, error: e1 }, { data: d2, error: e2 }] = await Promise.all([
        supabase.from('pharmacy_ddr_register').select('*').eq('outlet_id', activeOutlet).order('drug_name'),
        supabase.from('pharmacy_ddr_transactions').select('*, pharmacy_ddr_register(drug_name, drug_schedule)').eq('outlet_id', activeOutlet).order('transaction_date', { ascending: false }),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      setDrugs((d1 as any[]) || []);
      setTransactions((d2 as any[]) || []);
    } catch (err: any) {
      toast.error('Failed to load DDR data: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [activeOutlet]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Computed KPIs ────────────────────────────────────────────────
  const totalDrugs = drugs.filter(d => d.active).length;
  const totalValue = drugs.reduce((s, d) => s + d.current_balance * 150, 0); // placeholder unit cost
  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const dispensedToday = transactions.filter(t => t.transaction_type === 'Dispensing' && t.transaction_date?.startsWith(today)).reduce((s, t) => s + t.quantity, 0);
  const dispensedMonth = transactions.filter(t => t.transaction_type === 'Dispensing' && t.transaction_date?.startsWith(thisMonth)).reduce((s, t) => s + t.quantity, 0);
  const pendingRecon = drugs.filter(d => !d.last_reconciliation_date || new Date(d.last_reconciliation_date) < new Date(Date.now() - 30 * 86400000)).length;
  const lossReports = transactions.filter(t => t.transaction_type === 'Loss' || t.transaction_type === 'Theft').length;
  const disposalsPending = transactions.filter(t => t.transaction_type === 'Disposal' && !t.ppb_reference).length;
  const lastAudit = drugs.reduce((latest, d) => {
    if (d.last_reconciliation_date && (!latest || d.last_reconciliation_date > latest)) return d.last_reconciliation_date;
    return latest;
  }, '' as string);

  // ─── Filters ──────────────────────────────────────────────────────
  const filteredDrugs = drugs.filter(d => {
    if (search && !d.drug_name.toLowerCase().includes(search.toLowerCase()) && !d.generic_name?.toLowerCase().includes(search.toLowerCase())) return false;
    if (scheduleFilter !== 'All' && d.drug_schedule !== scheduleFilter) return false;
    return true;
  });

  const filteredTransactions = transactions.filter(t => {
    const drugInfo = (t as any).pharmacy_ddr_register;
    const drugName = drugInfo?.drug_name || '';
    if (search && !drugName.toLowerCase().includes(search.toLowerCase()) && !t.patient_name?.toLowerCase().includes(search.toLowerCase())) return false;
    if (scheduleFilter !== 'All' && drugInfo?.drug_schedule !== scheduleFilter) return false;
    if (txTypeFilter !== 'All' && t.transaction_type !== txTypeFilter) return false;
    if (dateFrom && t.transaction_date < dateFrom) return false;
    if (dateTo && t.transaction_date > dateTo) return false;
    return true;
  });

  const dispensingTx = filteredTransactions.filter(t => t.transaction_type === 'Dispensing');
  const lossTx = filteredTransactions.filter(t => t.transaction_type === 'Loss' || t.transaction_type === 'Theft');
  const disposalTx = filteredTransactions.filter(t => t.transaction_type === 'Disposal');

  // ─── CRUD Operations ─────────────────────────────────────────────
  const saveDrug = async (isEdit: boolean) => {
    try {
      if (isEdit && selectedDrug) {
        const { error } = await supabase.from('pharmacy_ddr_register').update(drugForm).eq('ddr_id', selectedDrug.ddr_id);
        if (error) throw error;
        toast.success('Drug updated successfully');
      } else {
        const { error } = await supabase.from('pharmacy_ddr_register').insert({ ...drugForm, outlet_id: activeOutlet });
        if (error) throw error;
        toast.success('Drug added to DDR register');
      }
      setShowAddDrug(false); setShowEditDrug(false);
      setDrugForm(emptyDrug);
      loadData();
    } catch (err: any) { toast.error(err.message); }
  };

  const deleteDrug = async () => {
    if (!selectedDrug) return;
    try {
      const { error } = await supabase.from('pharmacy_ddr_register').update({ active: false }).eq('ddr_id', selectedDrug.ddr_id);
      if (error) throw error;
      toast.success('Drug deactivated from register');
      setShowDeleteDrug(false);
      loadData();
    } catch (err: any) { toast.error(err.message); }
  };

  const saveTransaction = async () => {
    try {
      const { error } = await supabase.from('pharmacy_ddr_transactions').insert({ ...txForm, outlet_id: activeOutlet });
      if (error) throw error;
      toast.success('Transaction recorded successfully');
      setShowRecordTx(false);
      setTxForm(emptyTx);
      loadData();
    } catch (err: any) { toast.error(err.message); }
  };

  // ─── Export ───────────────────────────────────────────────────────
  const exportExcel = (title: string, headers: string[], rows: string[][]) => {
    let xml = '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>';
    xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">';
    xml += `<Worksheet ss:Name="${title}"><Table>`;
    xml += '<Row>' + headers.map(h => `<Cell><Data ss:Type="String">${h}</Data></Cell>`).join('') + '</Row>';
    rows.forEach(r => { xml += '<Row>' + r.map(c => `<Cell><Data ss:Type="String">${c ?? ''}</Data></Cell>`).join('') + '</Row>'; });
    xml += '</Table></Worksheet></Workbook>';
    const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `DDR_${title}_${today}.xls`; a.click();
    toast.success('Exported to Excel');
  };

  const printTable = () => { window.print(); };

  const exportRegister = () => exportExcel('Register',
    ['DDR#', 'Drug Name', 'Schedule', 'Generic', 'Strength', 'Form', 'Balance', 'Unit', 'Location', 'Last Reconciliation'],
    filteredDrugs.map(d => [d.ddr_id?.slice(0, 8), d.drug_name, d.drug_schedule, d.generic_name, d.strength, d.dosage_form, String(d.current_balance), d.unit, d.storage_location, fmtDate(d.last_reconciliation_date)])
  );

  const exportTransactions = () => exportExcel('Transactions',
    ['Date', 'Type', 'Drug', 'Qty', 'Balance After', 'Patient/Supplier', 'Prescriber', 'Pharmacist', 'Counter-Signatory'],
    filteredTransactions.map(t => [fmtDate(t.transaction_date), t.transaction_type, (t as any).pharmacy_ddr_register?.drug_name || '', String(t.quantity), String(t.balance_after), t.patient_name || t.supplier_name || '', t.prescriber_name, t.pharmacist_name, t.counter_signatory])
  );

  // ─── Schedule Badge ───────────────────────────────────────────────
  const ScheduleBadge = ({ schedule }: { schedule: string }) => {
    const c = scheduleColors[schedule] || scheduleColors.S1;
    return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${c.bg} ${c.text}`}>{schedule}</span>;
  };

  const TxTypeBadge = ({ type }: { type: string }) => {
    const c = txTypeColors[type] || txTypeColors.Receipt;
    return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${c.bg} ${c.text}`}>{type}</span>;
  };

  // ─── Input Helper ─────────────────────────────────────────────────
  const inputCls = 'w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none';
  const labelCls = 'text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5';

  // ─── Render ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="w-full max-w-full space-y-3.5 px-1 md:px-2 text-gray-900" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-2" />
          <div className="h-4 bg-gray-100 rounded w-96" />
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => <div key={i} className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs animate-pulse h-20" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full space-y-3.5 px-1 md:px-2 text-gray-900" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-rose-500 to-red-700 w-10 h-10 rounded-xl flex items-center justify-center text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">Controlled Substances Register</h1>
              <p className="text-xs text-gray-500 mt-0.5 font-medium">PPB Dangerous Drugs Register — Schedule S1–S7</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={printTable} className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-bold shadow-xs text-xs transition-colors">🖨️ Print</button>
            <button onClick={() => activeTab === 'Register' ? exportRegister() : exportTransactions()} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs text-xs transition-colors">📥 Export Excel</button>
          </div>
        </div>
      </div>

      {/* ── KPI Cards Row 1 ────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Controlled Drugs', value: fmt(totalDrugs), sub: 'Active in register', color: 'emerald', icon: '💊' },
          { label: 'Total Stock Value', value: fmtCurrency(totalValue), sub: 'Estimated value', color: 'blue', icon: '💰' },
          { label: 'Dispensed Today', value: fmt(dispensedToday), sub: today, color: 'violet', icon: '📋' },
          { label: 'Dispensed This Month', value: fmt(dispensedMonth), sub: thisMonth, color: 'cyan', icon: '📊' },
        ].map((kpi, i) => (
          <div key={i} className={`bg-gradient-to-br from-${kpi.color}-50/80 via-white to-white p-3 rounded-xl border border-${kpi.color}-200/80 shadow-xs`}>
            <div className="flex items-center justify-between">
              <p className={`text-[10px] font-bold text-${kpi.color}-800 uppercase tracking-wider`}>{kpi.label}</p>
              <span className="text-sm">{kpi.icon}</span>
            </div>
            <p className={`text-lg font-black text-${kpi.color}-950 tracking-tight mt-1`}>{kpi.value}</p>
            <p className={`text-[10px] font-bold text-${kpi.color}-700 mt-0.5`}>{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* ── KPI Cards Row 2 ────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Pending Reconciliation', value: fmt(pendingRecon), sub: 'Overdue >30 days', color: 'amber', icon: '⚠️' },
          { label: 'Loss/Theft Reports', value: fmt(lossReports), sub: 'Total recorded', color: 'rose', icon: '🚨' },
          { label: 'Disposals Pending', value: fmt(disposalsPending), sub: 'Awaiting PPB ref', color: 'orange', icon: '🗑️' },
          { label: 'Last Audit Date', value: lastAudit ? fmtDate(lastAudit) : 'Never', sub: 'Most recent', color: 'indigo', icon: '🔍' },
        ].map((kpi, i) => (
          <div key={i} className={`bg-gradient-to-br from-${kpi.color}-50/80 via-white to-white p-3 rounded-xl border border-${kpi.color}-200/80 shadow-xs`}>
            <div className="flex items-center justify-between">
              <p className={`text-[10px] font-bold text-${kpi.color}-800 uppercase tracking-wider`}>{kpi.label}</p>
              <span className="text-sm">{kpi.icon}</span>
            </div>
            <p className={`text-lg font-black text-${kpi.color}-950 tracking-tight mt-1`}>{kpi.value}</p>
            <p className={`text-[10px] font-bold text-${kpi.color}-700 mt-0.5`}>{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Tab Navigation ─────────────────────────────────────── */}
      <div className="bg-white p-1.5 rounded-xl border border-gray-200 shadow-xs flex flex-wrap gap-1">
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={activeTab === tab
              ? 'px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-bold text-xs shadow-xs'
              : 'px-3 py-1.5 bg-white text-gray-600 border border-gray-200 rounded-lg font-bold text-xs hover:bg-gray-50'}>
            {tab}
          </button>
        ))}
      </div>

      {/* ── Filters ────────────────────────────────────────────── */}
      <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className={labelCls}>Search</label>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Drug name, patient..." className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Schedule</label>
            <select value={scheduleFilter} onChange={e => setScheduleFilter(e.target.value)} className={inputCls}>
              <option value="All">All Schedules</option>
              {['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {(activeTab !== 'Register') && (
            <>
              <div>
                <label className={labelCls}>From Date</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>To Date</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Transaction Type</label>
                <select value={txTypeFilter} onChange={e => setTxTypeFilter(e.target.value)} className={inputCls}>
                  <option value="All">All Types</option>
                  {['Receipt', 'Dispensing', 'Disposal', 'Loss', 'Theft', 'Adjustment'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          REGISTER TAB
         ══════════════════════════════════════════════════════════ */}
      {activeTab === 'Register' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-3 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-800">DDR Register — {filteredDrugs.length} controlled substance(s)</h2>
            <button onClick={() => { setDrugForm(emptyDrug); setShowAddDrug(true); }} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs text-xs transition-colors">+ Add Drug</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="bg-gradient-to-r from-cyan-700 via-blue-700 to-indigo-800">
                {['DDR #', 'Drug Name', 'Schedule', 'Generic Name', 'Strength', 'Form', 'Balance', 'Unit', 'Storage', 'Last Recon', 'Actions'].map(h => (
                  <th key={h} className="px-2.5 py-2 text-left text-[10px] font-bold text-white uppercase tracking-wider">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filteredDrugs.map((d, i) => (
                  <tr key={d.ddr_id} className={`border-b border-gray-100 hover:bg-emerald-50/40 transition-colors ${i % 2 ? 'bg-gray-50/30' : ''}`}>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-800 font-mono">{d.ddr_id?.slice(0, 8)}</td>
                    <td className="px-2.5 py-1.5 text-xs font-bold text-gray-900">{d.drug_name}</td>
                    <td className="px-2.5 py-1.5"><ScheduleBadge schedule={d.drug_schedule} /></td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{d.generic_name}</td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{d.strength}</td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{d.dosage_form}</td>
                    <td className="px-2.5 py-1.5 text-xs font-black text-gray-900">{fmt(d.current_balance)}</td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-600">{d.unit}</td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-600">{d.storage_location}</td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-600">{fmtDate(d.last_reconciliation_date)}</td>
                    <td className="px-2.5 py-1.5">
                      <div className="flex gap-1">
                        <button onClick={() => { setSelectedDrug(d); setShowViewDrug(true); }} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-bold hover:bg-blue-100">View</button>
                        <button onClick={() => { setSelectedDrug(d); setDrugForm(d); setShowEditDrug(true); }} className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-[10px] font-bold hover:bg-amber-100">Edit</button>
                        <button onClick={() => { setSelectedDrug(d); setShowDeleteDrug(true); }} className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded text-[10px] font-bold hover:bg-rose-100">Del</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredDrugs.length === 0 && (
                  <tr><td colSpan={11} className="px-4 py-8 text-center text-sm text-gray-400">No controlled substances found in the register</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          TRANSACTIONS TAB
         ══════════════════════════════════════════════════════════ */}
      {activeTab === 'Transactions' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-3 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-800">All DDR Transactions — {filteredTransactions.length} record(s)</h2>
            <button onClick={() => { setTxForm({ ...emptyTx, ddr_id: drugs[0]?.ddr_id || '' }); setShowRecordTx(true); }} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs text-xs transition-colors">+ Record Transaction</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="bg-gradient-to-r from-cyan-700 via-blue-700 to-indigo-800">
                {['Date', 'Type', 'Drug', 'Qty', 'Balance After', 'Patient / Supplier', 'Prescriber', 'Pharmacist', 'Counter-Signatory', 'Batch #'].map(h => (
                  <th key={h} className="px-2.5 py-2 text-left text-[10px] font-bold text-white uppercase tracking-wider">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filteredTransactions.map((t, i) => (
                  <tr key={t.transaction_id} className={`border-b border-gray-100 hover:bg-emerald-50/40 transition-colors ${i % 2 ? 'bg-gray-50/30' : ''}`}>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{fmtDate(t.transaction_date)}</td>
                    <td className="px-2.5 py-1.5"><TxTypeBadge type={t.transaction_type} /></td>
                    <td className="px-2.5 py-1.5 text-xs font-bold text-gray-900">{(t as any).pharmacy_ddr_register?.drug_name || '—'}</td>
                    <td className="px-2.5 py-1.5 text-xs font-black text-gray-900">{fmt(t.quantity)}</td>
                    <td className="px-2.5 py-1.5 text-xs font-bold text-gray-800">{fmt(t.balance_after)}</td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{t.patient_name || t.supplier_name || '—'}</td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{t.prescriber_name || '—'}</td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{t.pharmacist_name || '—'}</td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{t.counter_signatory || '—'}</td>
                    <td className="px-2.5 py-1.5 text-xs font-mono text-gray-600">{t.batch_number || '—'}</td>
                  </tr>
                ))}
                {filteredTransactions.length === 0 && (
                  <tr><td colSpan={10} className="px-4 py-8 text-center text-sm text-gray-400">No transactions found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          DISPENSING LOG TAB
         ══════════════════════════════════════════════════════════ */}
      {activeTab === 'Dispensing Log' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-3 border-b border-gray-200">
            <h2 className="text-sm font-bold text-gray-800">Dispensing Log — {dispensingTx.length} dispensing record(s)</h2>
            <p className="text-[10px] text-gray-500 mt-0.5">All controlled substance dispensing with dual-signatory verification</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="bg-gradient-to-r from-cyan-700 via-blue-700 to-indigo-800">
                {['Date', 'Drug', 'Qty', 'Balance', 'Patient Name', 'Patient ID', 'Address', 'Phone', 'Prescriber', 'Reg No', 'Facility', 'Rx No', 'Pharmacist', 'Counter-Sign'].map(h => (
                  <th key={h} className="px-2.5 py-2 text-left text-[10px] font-bold text-white uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {dispensingTx.map((t, i) => (
                  <tr key={t.transaction_id} className={`border-b border-gray-100 hover:bg-emerald-50/40 transition-colors ${i % 2 ? 'bg-gray-50/30' : ''}`}>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700 whitespace-nowrap">{fmtDate(t.transaction_date)}</td>
                    <td className="px-2.5 py-1.5 text-xs font-bold text-gray-900">{(t as any).pharmacy_ddr_register?.drug_name || '—'}</td>
                    <td className="px-2.5 py-1.5 text-xs font-black text-gray-900">{fmt(t.quantity)}</td>
                    <td className="px-2.5 py-1.5 text-xs font-bold text-gray-800">{fmt(t.balance_after)}</td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-800">{t.patient_name || '—'}</td>
                    <td className="px-2.5 py-1.5 text-xs font-mono text-gray-600">{t.patient_id_number || '—'}</td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-600">{t.patient_address || '—'}</td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-600">{t.patient_phone || '—'}</td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{t.prescriber_name || '—'}</td>
                    <td className="px-2.5 py-1.5 text-xs font-mono text-gray-600">{t.prescriber_reg_no || '—'}</td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-600">{t.prescriber_facility || '—'}</td>
                    <td className="px-2.5 py-1.5 text-xs font-mono text-gray-600">{t.prescription_no || '—'}</td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{t.pharmacist_name || '—'}</td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{t.counter_signatory ? `${t.counter_signatory} (${t.counter_sign_reg_no})` : '—'}</td>
                  </tr>
                ))}
                {dispensingTx.length === 0 && (
                  <tr><td colSpan={14} className="px-4 py-8 text-center text-sm text-gray-400">No dispensing records found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          LOSS & THEFT TAB
         ══════════════════════════════════════════════════════════ */}
      {activeTab === 'Loss & Theft' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-3 border-b border-gray-200">
            <h2 className="text-sm font-bold text-gray-800">🚨 Loss & Theft Reports — {lossTx.length} record(s)</h2>
            <p className="text-[10px] text-gray-500 mt-0.5">All reported losses and thefts — police reports and PPB notifications</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="bg-gradient-to-r from-rose-700 via-red-700 to-rose-800">
                {['Date', 'Type', 'Drug', 'Qty Lost', 'Balance After', 'Loss Type', 'Police Report #', 'PPB Notification', 'PPB Reference', 'Notes', 'Recorded By'].map(h => (
                  <th key={h} className="px-2.5 py-2 text-left text-[10px] font-bold text-white uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {lossTx.map((t, i) => (
                  <tr key={t.transaction_id} className={`border-b border-gray-100 hover:bg-rose-50/40 transition-colors ${i % 2 ? 'bg-gray-50/30' : ''}`}>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700 whitespace-nowrap">{fmtDate(t.transaction_date)}</td>
                    <td className="px-2.5 py-1.5"><TxTypeBadge type={t.transaction_type} /></td>
                    <td className="px-2.5 py-1.5 text-xs font-bold text-gray-900">{(t as any).pharmacy_ddr_register?.drug_name || '—'}</td>
                    <td className="px-2.5 py-1.5 text-xs font-black text-rose-700">{fmt(t.quantity)}</td>
                    <td className="px-2.5 py-1.5 text-xs font-bold text-gray-800">{fmt(t.balance_after)}</td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{t.loss_type || '—'}</td>
                    <td className="px-2.5 py-1.5 text-xs font-mono text-gray-700">{t.police_report_no || <span className="text-rose-500 font-bold">MISSING</span>}</td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-600">{fmtDate(t.ppb_notification_date)}</td>
                    <td className="px-2.5 py-1.5 text-xs font-mono text-gray-600">{t.ppb_reference || '—'}</td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-600 max-w-[200px] truncate">{t.notes || '—'}</td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-600">{t.created_by || '—'}</td>
                  </tr>
                ))}
                {lossTx.length === 0 && (
                  <tr><td colSpan={11} className="px-4 py-8 text-center text-sm text-gray-400">No loss or theft reports recorded</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          DISPOSAL TAB
         ══════════════════════════════════════════════════════════ */}
      {activeTab === 'Disposal' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-3 border-b border-gray-200">
            <h2 className="text-sm font-bold text-gray-800">🗑️ Controlled Drug Disposals — {disposalTx.length} record(s)</h2>
            <p className="text-[10px] text-gray-500 mt-0.5">Supervised destruction records with PPB authorization</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="bg-gradient-to-r from-amber-700 via-orange-700 to-amber-800">
                {['Date', 'Drug', 'Qty Disposed', 'Balance After', 'Method', 'Witness', 'PPB Reference', 'Pharmacist', 'Counter-Signatory', 'Batch #', 'Notes'].map(h => (
                  <th key={h} className="px-2.5 py-2 text-left text-[10px] font-bold text-white uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {disposalTx.map((t, i) => (
                  <tr key={t.transaction_id} className={`border-b border-gray-100 hover:bg-amber-50/40 transition-colors ${i % 2 ? 'bg-gray-50/30' : ''}`}>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700 whitespace-nowrap">{fmtDate(t.transaction_date)}</td>
                    <td className="px-2.5 py-1.5 text-xs font-bold text-gray-900">{(t as any).pharmacy_ddr_register?.drug_name || '—'}</td>
                    <td className="px-2.5 py-1.5 text-xs font-black text-amber-700">{fmt(t.quantity)}</td>
                    <td className="px-2.5 py-1.5 text-xs font-bold text-gray-800">{fmt(t.balance_after)}</td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{t.disposal_method || '—'}</td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{t.disposal_witness || '—'}</td>
                    <td className="px-2.5 py-1.5 text-xs font-mono text-gray-600">{t.ppb_reference || <span className="text-amber-600 font-bold">PENDING</span>}</td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{t.pharmacist_name || '—'}</td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{t.counter_signatory || '—'}</td>
                    <td className="px-2.5 py-1.5 text-xs font-mono text-gray-600">{t.batch_number || '—'}</td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-600 max-w-[200px] truncate">{t.notes || '—'}</td>
                  </tr>
                ))}
                {disposalTx.length === 0 && (
                  <tr><td colSpan={11} className="px-4 py-8 text-center text-sm text-gray-400">No disposal records found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          RECONCILIATION TAB
         ══════════════════════════════════════════════════════════ */}
      {activeTab === 'Reconciliation' && (
        <div className="space-y-3.5">
          <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-bold text-gray-800">Stock Reconciliation</h2>
                <p className="text-[10px] text-gray-500 mt-0.5">Compare system balance against physical count for each controlled substance</p>
              </div>
              <button onClick={() => {
                setReconData(drugs.filter(d => d.active).map(d => ({ ddr_id: d.ddr_id, drug_name: d.drug_name, system_balance: d.current_balance, physical_count: d.current_balance })));
                setShowRecon(true);
              }} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs text-xs transition-colors">🔄 Start Reconciliation</button>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
            <table className="w-full">
              <thead><tr className="bg-gradient-to-r from-cyan-700 via-blue-700 to-indigo-800">
                {['Drug Name', 'Schedule', 'System Balance', 'Last Reconciliation', 'Days Since', 'Status'].map(h => (
                  <th key={h} className="px-2.5 py-2 text-left text-[10px] font-bold text-white uppercase tracking-wider">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filteredDrugs.filter(d => d.active).map((d, i) => {
                  const daysSince = d.last_reconciliation_date ? Math.floor((Date.now() - new Date(d.last_reconciliation_date).getTime()) / 86400000) : 999;
                  const status = daysSince <= 7 ? 'Current' : daysSince <= 30 ? 'Due Soon' : 'Overdue';
                  const statusCls = status === 'Current' ? 'bg-emerald-100 text-emerald-800' : status === 'Due Soon' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800';
                  return (
                    <tr key={d.ddr_id} className={`border-b border-gray-100 hover:bg-emerald-50/40 transition-colors ${i % 2 ? 'bg-gray-50/30' : ''}`}>
                      <td className="px-2.5 py-1.5 text-xs font-bold text-gray-900">{d.drug_name}</td>
                      <td className="px-2.5 py-1.5"><ScheduleBadge schedule={d.drug_schedule} /></td>
                      <td className="px-2.5 py-1.5 text-xs font-black text-gray-900">{fmt(d.current_balance)} {d.unit}</td>
                      <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{fmtDate(d.last_reconciliation_date)}</td>
                      <td className="px-2.5 py-1.5 text-xs font-bold text-gray-700">{daysSince < 999 ? `${daysSince} days` : 'Never'}</td>
                      <td className="px-2.5 py-1.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusCls}`}>{status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          PPB RETURNS TAB
         ══════════════════════════════════════════════════════════ */}
      {activeTab === 'PPB Returns' && (
        <div className="space-y-3.5">
          <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-gray-800">PPB Quarterly / Annual Returns</h2>
                <p className="text-[10px] text-gray-500 mt-0.5">Summary of all controlled substance movements for PPB submission</p>
              </div>
              <button onClick={() => {
                const headers = ['Drug Name', 'Schedule', 'Opening Balance', 'Total Receipts', 'Total Dispensed', 'Total Disposed', 'Total Losses', 'Closing Balance'];
                const rows = drugs.filter(d => d.active).map(d => {
                  const dtx = transactions.filter(t => t.ddr_id === d.ddr_id);
                  const receipts = dtx.filter(t => t.transaction_type === 'Receipt').reduce((s, t) => s + t.quantity, 0);
                  const dispensed = dtx.filter(t => t.transaction_type === 'Dispensing').reduce((s, t) => s + t.quantity, 0);
                  const disposed = dtx.filter(t => t.transaction_type === 'Disposal').reduce((s, t) => s + t.quantity, 0);
                  const losses = dtx.filter(t => t.transaction_type === 'Loss' || t.transaction_type === 'Theft').reduce((s, t) => s + t.quantity, 0);
                  return [d.drug_name, d.drug_schedule, String(d.opening_balance), String(receipts), String(dispensed), String(disposed), String(losses), String(d.current_balance)];
                });
                exportExcel('PPB_Returns', headers, rows);
              }} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs text-xs transition-colors">📥 Export PPB Returns</button>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
            <table className="w-full">
              <thead><tr className="bg-gradient-to-r from-cyan-700 via-blue-700 to-indigo-800">
                {['Drug Name', 'Schedule', 'Opening Bal', 'Total Receipts', 'Total Dispensed', 'Total Disposed', 'Total Losses', 'Closing Balance'].map(h => (
                  <th key={h} className="px-2.5 py-2 text-left text-[10px] font-bold text-white uppercase tracking-wider">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {drugs.filter(d => d.active).map((d, i) => {
                  const dtx = transactions.filter(t => t.ddr_id === d.ddr_id);
                  const receipts = dtx.filter(t => t.transaction_type === 'Receipt').reduce((s, t) => s + t.quantity, 0);
                  const dispensed = dtx.filter(t => t.transaction_type === 'Dispensing').reduce((s, t) => s + t.quantity, 0);
                  const disposed = dtx.filter(t => t.transaction_type === 'Disposal').reduce((s, t) => s + t.quantity, 0);
                  const losses = dtx.filter(t => t.transaction_type === 'Loss' || t.transaction_type === 'Theft').reduce((s, t) => s + t.quantity, 0);
                  return (
                    <tr key={d.ddr_id} className={`border-b border-gray-100 hover:bg-emerald-50/40 transition-colors ${i % 2 ? 'bg-gray-50/30' : ''}`}>
                      <td className="px-2.5 py-1.5 text-xs font-bold text-gray-900">{d.drug_name}</td>
                      <td className="px-2.5 py-1.5"><ScheduleBadge schedule={d.drug_schedule} /></td>
                      <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-800">{fmt(d.opening_balance)}</td>
                      <td className="px-2.5 py-1.5 text-xs font-bold text-emerald-700">+{fmt(receipts)}</td>
                      <td className="px-2.5 py-1.5 text-xs font-bold text-blue-700">-{fmt(dispensed)}</td>
                      <td className="px-2.5 py-1.5 text-xs font-bold text-amber-700">-{fmt(disposed)}</td>
                      <td className="px-2.5 py-1.5 text-xs font-bold text-rose-700">-{fmt(losses)}</td>
                      <td className="px-2.5 py-1.5 text-xs font-black text-gray-900">{fmt(d.current_balance)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          ADD / EDIT DRUG MODAL
         ══════════════════════════════════════════════════════════ */}
      {(showAddDrug || showEditDrug) && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">{showEditDrug ? 'Edit Controlled Drug' : 'Add Controlled Drug to DDR'}</h3>
              <p className="text-xs text-gray-500 mt-0.5">PPB Dangerous Drugs Register entry</p>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Drug Name *</label><input className={inputCls} value={drugForm.drug_name || ''} onChange={e => setDrugForm({ ...drugForm, drug_name: e.target.value })} /></div>
                <div><label className={labelCls}>Schedule *</label>
                  <select className={inputCls} value={drugForm.drug_schedule || 'S1'} onChange={e => setDrugForm({ ...drugForm, drug_schedule: e.target.value })}>
                    {['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div><label className={labelCls}>Generic Name</label><input className={inputCls} value={drugForm.generic_name || ''} onChange={e => setDrugForm({ ...drugForm, generic_name: e.target.value })} /></div>
                <div><label className={labelCls}>Strength</label><input className={inputCls} value={drugForm.strength || ''} onChange={e => setDrugForm({ ...drugForm, strength: e.target.value })} placeholder="e.g. 10mg" /></div>
                <div><label className={labelCls}>Dosage Form</label>
                  <select className={inputCls} value={drugForm.dosage_form || 'Tablet'} onChange={e => setDrugForm({ ...drugForm, dosage_form: e.target.value })}>
                    {['Tablet', 'Capsule', 'Injection', 'Syrup', 'Patch', 'Suppository', 'Powder', 'Solution', 'Other'].map(f => <option key={f}>{f}</option>)}
                  </select>
                </div>
                <div><label className={labelCls}>Unit</label><input className={inputCls} value={drugForm.unit || ''} onChange={e => setDrugForm({ ...drugForm, unit: e.target.value })} placeholder="e.g. tablets, ampoules" /></div>
                <div><label className={labelCls}>Opening Balance</label><input type="number" className={inputCls} value={drugForm.opening_balance || 0} onChange={e => setDrugForm({ ...drugForm, opening_balance: +e.target.value })} /></div>
                <div><label className={labelCls}>Current Balance</label><input type="number" className={inputCls} value={drugForm.current_balance || 0} onChange={e => setDrugForm({ ...drugForm, current_balance: +e.target.value })} /></div>
                <div className="col-span-2"><label className={labelCls}>Storage Location</label><input className={inputCls} value={drugForm.storage_location || ''} onChange={e => setDrugForm({ ...drugForm, storage_location: e.target.value })} placeholder="e.g. Controlled Cabinet A, Safe Room 1" /></div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => { setShowAddDrug(false); setShowEditDrug(false); }} className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-bold shadow-xs text-xs">Cancel</button>
              <button onClick={() => saveDrug(showEditDrug)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs text-xs transition-colors">{showEditDrug ? 'Update Drug' : 'Add to Register'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── View Drug Modal ────────────────────────────────────── */}
      {showViewDrug && selectedDrug && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">{selectedDrug.drug_name}</h3>
              <ScheduleBadge schedule={selectedDrug.drug_schedule} />
            </div>
            <div className="p-4 space-y-2">
              {[
                ['DDR ID', selectedDrug.ddr_id],
                ['Generic Name', selectedDrug.generic_name],
                ['Strength', selectedDrug.strength],
                ['Dosage Form', selectedDrug.dosage_form],
                ['Opening Balance', fmt(selectedDrug.opening_balance)],
                ['Current Balance', fmt(selectedDrug.current_balance) + ' ' + selectedDrug.unit],
                ['Storage Location', selectedDrug.storage_location],
                ['Last Reconciliation', fmtDate(selectedDrug.last_reconciliation_date)],
                ['Status', selectedDrug.active ? 'Active' : 'Inactive'],
              ].map(([lbl, val]) => (
                <div key={lbl} className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-xs font-bold text-gray-500 uppercase">{lbl}</span>
                  <span className="text-xs font-semibold text-gray-800">{val}</span>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end">
              <button onClick={() => setShowViewDrug(false)} className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-bold shadow-xs text-xs">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Drug Modal ──────────────────────────────────── */}
      {showDeleteDrug && selectedDrug && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Deactivate Controlled Drug</h3>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-700">Are you sure you want to deactivate <span className="font-bold">{selectedDrug.drug_name}</span> from the DDR register?</p>
              <p className="text-xs text-amber-600 mt-2 font-semibold">⚠️ This will not delete records — the drug will be marked as inactive per PPB requirements.</p>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => setShowDeleteDrug(false)} className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-bold shadow-xs text-xs">Cancel</button>
              <button onClick={deleteDrug} className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold shadow-xs text-xs">Deactivate</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          RECORD TRANSACTION MODAL (MASSIVE)
         ══════════════════════════════════════════════════════════ */}
      {showRecordTx && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Record DDR Transaction</h3>
              <p className="text-xs text-gray-500 mt-0.5">All fields required by PPB for controlled substance transactions</p>
            </div>
            <div className="p-4 space-y-4">
              {/* Transaction Basics */}
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                <h4 className="text-xs font-bold text-gray-800 mb-2 uppercase tracking-wider">Transaction Details</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div><label className={labelCls}>Drug *</label>
                    <select className={inputCls} value={txForm.ddr_id || ''} onChange={e => setTxForm({ ...txForm, ddr_id: e.target.value })}>
                      <option value="">Select Drug</option>
                      {drugs.filter(d => d.active).map(d => <option key={d.ddr_id} value={d.ddr_id}>{d.drug_name} ({d.drug_schedule})</option>)}
                    </select>
                  </div>
                  <div><label className={labelCls}>Type *</label>
                    <select className={inputCls} value={txForm.transaction_type || 'Receipt'} onChange={e => setTxForm({ ...txForm, transaction_type: e.target.value })}>
                      {['Receipt', 'Dispensing', 'Disposal', 'Loss', 'Theft', 'Adjustment'].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div><label className={labelCls}>Date *</label><input type="date" className={inputCls} value={txForm.transaction_date || ''} onChange={e => setTxForm({ ...txForm, transaction_date: e.target.value })} /></div>
                  <div><label className={labelCls}>Quantity *</label><input type="number" className={inputCls} value={txForm.quantity || 0} onChange={e => setTxForm({ ...txForm, quantity: +e.target.value })} /></div>
                  <div><label className={labelCls}>Batch Number</label><input className={inputCls} value={txForm.batch_number || ''} onChange={e => setTxForm({ ...txForm, batch_number: e.target.value })} /></div>
                  <div><label className={labelCls}>Expiry Date</label><input type="date" className={inputCls} value={txForm.expiry_date || ''} onChange={e => setTxForm({ ...txForm, expiry_date: e.target.value })} /></div>
                </div>
              </div>

              {/* Supplier Details (Receipt) */}
              {txForm.transaction_type === 'Receipt' && (
                <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-200">
                  <h4 className="text-xs font-bold text-emerald-800 mb-2 uppercase tracking-wider">Supplier Details</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div><label className={labelCls}>Supplier Name</label><input className={inputCls} value={txForm.supplier_name || ''} onChange={e => setTxForm({ ...txForm, supplier_name: e.target.value })} /></div>
                    <div><label className={labelCls}>Supplier Address</label><input className={inputCls} value={txForm.supplier_address || ''} onChange={e => setTxForm({ ...txForm, supplier_address: e.target.value })} /></div>
                    <div><label className={labelCls}>Invoice Number</label><input className={inputCls} value={txForm.invoice_number || ''} onChange={e => setTxForm({ ...txForm, invoice_number: e.target.value })} /></div>
                  </div>
                </div>
              )}

              {/* Patient Details (Dispensing) */}
              {txForm.transaction_type === 'Dispensing' && (
                <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-200">
                  <h4 className="text-xs font-bold text-blue-800 mb-2 uppercase tracking-wider">Patient Details</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={labelCls}>Patient Full Name *</label><input className={inputCls} value={txForm.patient_name || ''} onChange={e => setTxForm({ ...txForm, patient_name: e.target.value })} /></div>
                    <div><label className={labelCls}>ID / Passport Number *</label><input className={inputCls} value={txForm.patient_id_number || ''} onChange={e => setTxForm({ ...txForm, patient_id_number: e.target.value })} /></div>
                    <div><label className={labelCls}>Patient Address</label><input className={inputCls} value={txForm.patient_address || ''} onChange={e => setTxForm({ ...txForm, patient_address: e.target.value })} /></div>
                    <div><label className={labelCls}>Patient Phone</label><input className={inputCls} value={txForm.patient_phone || ''} onChange={e => setTxForm({ ...txForm, patient_phone: e.target.value })} /></div>
                  </div>
                </div>
              )}

              {/* Prescriber Details (Dispensing) */}
              {txForm.transaction_type === 'Dispensing' && (
                <div className="bg-violet-50/50 p-3 rounded-xl border border-violet-200">
                  <h4 className="text-xs font-bold text-violet-800 mb-2 uppercase tracking-wider">Prescriber Details</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div><label className={labelCls}>Prescriber Name *</label><input className={inputCls} value={txForm.prescriber_name || ''} onChange={e => setTxForm({ ...txForm, prescriber_name: e.target.value })} /></div>
                    <div><label className={labelCls}>Registration No *</label><input className={inputCls} value={txForm.prescriber_reg_no || ''} onChange={e => setTxForm({ ...txForm, prescriber_reg_no: e.target.value })} /></div>
                    <div><label className={labelCls}>Facility</label><input className={inputCls} value={txForm.prescriber_facility || ''} onChange={e => setTxForm({ ...txForm, prescriber_facility: e.target.value })} /></div>
                    <div><label className={labelCls}>Prescription Date</label><input type="date" className={inputCls} value={txForm.prescription_date || ''} onChange={e => setTxForm({ ...txForm, prescription_date: e.target.value })} /></div>
                    <div><label className={labelCls}>Prescription No</label><input className={inputCls} value={txForm.prescription_no || ''} onChange={e => setTxForm({ ...txForm, prescription_no: e.target.value })} /></div>
                  </div>
                </div>
              )}

              {/* Disposal Details */}
              {txForm.transaction_type === 'Disposal' && (
                <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-200">
                  <h4 className="text-xs font-bold text-amber-800 mb-2 uppercase tracking-wider">Disposal Details</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div><label className={labelCls}>Disposal Method *</label>
                      <select className={inputCls} value={txForm.disposal_method || ''} onChange={e => setTxForm({ ...txForm, disposal_method: e.target.value })}>
                        <option value="">Select Method</option>
                        {['Incineration', 'Chemical Destruction', 'Witnessed Flushing', 'Return to Manufacturer', 'Other'].map(m => <option key={m}>{m}</option>)}
                      </select>
                    </div>
                    <div><label className={labelCls}>Witness Name *</label><input className={inputCls} value={txForm.disposal_witness || ''} onChange={e => setTxForm({ ...txForm, disposal_witness: e.target.value })} /></div>
                    <div><label className={labelCls}>PPB Reference</label><input className={inputCls} value={txForm.ppb_reference || ''} onChange={e => setTxForm({ ...txForm, ppb_reference: e.target.value })} /></div>
                  </div>
                </div>
              )}

              {/* Loss/Theft Details */}
              {(txForm.transaction_type === 'Loss' || txForm.transaction_type === 'Theft') && (
                <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-200">
                  <h4 className="text-xs font-bold text-rose-800 mb-2 uppercase tracking-wider">Loss / Theft Details</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div><label className={labelCls}>Loss Type *</label>
                      <select className={inputCls} value={txForm.loss_type || ''} onChange={e => setTxForm({ ...txForm, loss_type: e.target.value })}>
                        <option value="">Select Type</option>
                        {['Breakage', 'Spillage', 'Theft', 'Unexplained Shortage', 'Expired', 'Other'].map(l => <option key={l}>{l}</option>)}
                      </select>
                    </div>
                    <div><label className={labelCls}>Police Report No</label><input className={inputCls} value={txForm.police_report_no || ''} onChange={e => setTxForm({ ...txForm, police_report_no: e.target.value })} /></div>
                    <div><label className={labelCls}>PPB Notification Date</label><input type="date" className={inputCls} value={txForm.ppb_notification_date || ''} onChange={e => setTxForm({ ...txForm, ppb_notification_date: e.target.value })} /></div>
                    <div><label className={labelCls}>PPB Reference</label><input className={inputCls} value={txForm.ppb_reference || ''} onChange={e => setTxForm({ ...txForm, ppb_reference: e.target.value })} /></div>
                  </div>
                </div>
              )}

              {/* Pharmacist & Counter-Signatory */}
              <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-200">
                <h4 className="text-xs font-bold text-indigo-800 mb-2 uppercase tracking-wider">Pharmacist & Counter-Signatory (Dual Signature Required)</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={labelCls}>Pharmacist Name *</label><input className={inputCls} value={txForm.pharmacist_name || ''} onChange={e => setTxForm({ ...txForm, pharmacist_name: e.target.value })} /></div>
                  <div><label className={labelCls}>Pharmacist Reg No *</label><input className={inputCls} value={txForm.pharmacist_reg_no || ''} onChange={e => setTxForm({ ...txForm, pharmacist_reg_no: e.target.value })} /></div>
                  <div><label className={labelCls}>Counter-Signatory Name *</label><input className={inputCls} value={txForm.counter_signatory || ''} onChange={e => setTxForm({ ...txForm, counter_signatory: e.target.value })} /></div>
                  <div><label className={labelCls}>Counter-Sign Reg No *</label><input className={inputCls} value={txForm.counter_sign_reg_no || ''} onChange={e => setTxForm({ ...txForm, counter_sign_reg_no: e.target.value })} /></div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className={labelCls}>Notes / Remarks</label>
                <textarea className={inputCls + ' min-h-[60px]'} value={txForm.notes || ''} onChange={e => setTxForm({ ...txForm, notes: e.target.value })} placeholder="Additional notes..." />
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => setShowRecordTx(false)} className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-bold shadow-xs text-xs">Cancel</button>
              <button onClick={saveTransaction} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs text-xs transition-colors">Record Transaction</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          RECONCILIATION MODAL
         ══════════════════════════════════════════════════════════ */}
      {showRecon && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">🔄 Stock Reconciliation</h3>
              <p className="text-xs text-gray-500 mt-0.5">Enter physical count for each controlled substance</p>
            </div>
            <div className="p-4">
              <table className="w-full">
                <thead><tr className="bg-gradient-to-r from-cyan-700 via-blue-700 to-indigo-800">
                  {['Drug Name', 'System Balance', 'Physical Count', 'Variance'].map(h => (
                    <th key={h} className="px-2.5 py-2 text-left text-[10px] font-bold text-white uppercase tracking-wider">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {reconData.map((r, i) => {
                    const variance = r.physical_count - r.system_balance;
                    return (
                      <tr key={r.ddr_id} className={`border-b border-gray-100 ${i % 2 ? 'bg-gray-50/30' : ''}`}>
                        <td className="px-2.5 py-1.5 text-xs font-bold text-gray-900">{r.drug_name}</td>
                        <td className="px-2.5 py-1.5 text-xs font-black text-gray-800">{fmt(r.system_balance)}</td>
                        <td className="px-2.5 py-1.5"><input type="number" className={inputCls + ' w-24'} value={r.physical_count} onChange={e => {
                          const updated = [...reconData]; updated[i].physical_count = +e.target.value; setReconData(updated);
                        }} /></td>
                        <td className={`px-2.5 py-1.5 text-xs font-black ${variance === 0 ? 'text-emerald-700' : variance > 0 ? 'text-blue-700' : 'text-rose-700'}`}>
                          {variance > 0 ? '+' : ''}{variance}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => setShowRecon(false)} className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-bold shadow-xs text-xs">Cancel</button>
              <button onClick={async () => {
                try {
                  for (const r of reconData) {
                    await supabase.from('pharmacy_ddr_register').update({
                      current_balance: r.physical_count,
                      last_reconciliation_date: new Date().toISOString().slice(0, 10),
                    }).eq('ddr_id', r.ddr_id);
                  }
                  toast.success('Reconciliation completed — balances updated');
                  setShowRecon(false);
                  loadData();
                } catch (err: any) { toast.error(err.message); }
              }} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs text-xs transition-colors">✅ Submit Reconciliation</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
