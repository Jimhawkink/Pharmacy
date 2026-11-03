'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

/* ── types ─────────────────────────────────────────────────────── */
interface Provider {
  provider_id: string; provider_name: string; provider_type: string;
  contact_person: string; phone: string; email: string; api_endpoint: string;
  contract_start: string; contract_end: string; copay_percentage: number;
  credit_limit: number; outstanding_balance: number; payment_terms_days: number; active: boolean;
}
interface Claim {
  claim_id: string; claim_no: string; provider_id: string; patient_id: string;
  member_no: string; sale_id: string; claim_date: string; claim_amount: number;
  copay_amount: number; approved_amount: number; status: string;
  rejection_reason: string; payment_date: string; payment_reference: string;
  items: any; notes: string; submitted_by: string;
  pharmacy_insurance_providers?: Provider;
  pharmacy_patients?: { first_name: string; last_name: string; phone: string };
}
interface Patient { patient_id: string; first_name: string; last_name: string; phone: string; }

const TABS = ['All Claims', 'Providers', 'Pending/Submitted', 'Approved', 'Rejected', 'Reimbursements', 'Analytics'] as const;
type Tab = typeof TABS[number];

const STATUS_COLORS: Record<string, string> = {
  Submitted: 'bg-blue-100 text-blue-800', 'Under Review': 'bg-amber-100 text-amber-800',
  Approved: 'bg-emerald-100 text-emerald-800', Rejected: 'bg-rose-100 text-rose-800',
  Paid: 'bg-green-100 text-green-800', Disputed: 'bg-orange-100 text-orange-800',
};
const PTYPE_COLORS: Record<string, string> = {
  SHA: 'bg-emerald-100 text-emerald-800', Private: 'bg-blue-100 text-blue-800', Corporate: 'bg-violet-100 text-violet-800',
};

const fmt = (n: number) => n.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtCurrency = (n: number) => `KSh ${n.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;

export default function InsuranceClaimsPage() {
  const { activeOutlet } = useOutlet();
  const [tab, setTab] = useState<Tab>('All Claims');
  const [claims, setClaims] = useState<Claim[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterProvider, setFilterProvider] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  // modals
  const [showNewClaim, setShowNewClaim] = useState(false);
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [showEditProvider, setShowEditProvider] = useState(false);
  const [showViewClaim, setShowViewClaim] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [viewingClaim, setViewingClaim] = useState<Claim | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showPaidModal, setShowPaidModal] = useState(false);
  const [actionClaim, setActionClaim] = useState<Claim | null>(null);
  const [approvedAmt, setApprovedAmt] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [paymentRef, setPaymentRef] = useState('');

  // new claim form
  const [claimForm, setClaimForm] = useState({
    patient_id: '', provider_id: '', member_no: '', sale_id: '',
    claim_amount: '', copay_amount: '', notes: '',
    items: [{ drug_name: '', qty: 1, unit_price: 0, total: 0 }],
  });
  // provider form
  const emptyProvider = {
    provider_name: '', provider_type: 'Private', contact_person: '', phone: '', email: '',
    api_endpoint: '', contract_start: '', contract_end: '', copay_percentage: 0,
    credit_limit: 0, outstanding_balance: 0, payment_terms_days: 30, active: true,
  };
  const [providerForm, setProviderForm] = useState<any>(emptyProvider);
  const [patientSearch, setPatientSearch] = useState('');

  /* ── data loading ─────────────────────────────────────────────── */
  const loadData = useCallback(async () => {
    if (!activeOutlet) return;
    setLoading(true);
    try {
      const [clRes, prRes, paRes] = await Promise.all([
        supabase.from('pharmacy_insurance_claims').select('*, pharmacy_insurance_providers(*), pharmacy_patients(first_name, last_name, phone)').eq('outlet_id', activeOutlet).order('claim_date', { ascending: false }),
        supabase.from('pharmacy_insurance_providers').select('*').order('provider_name'),
        supabase.from('pharmacy_patients').select('patient_id, first_name, last_name, phone').limit(500),
      ]);
      if (clRes.error) throw clRes.error;
      if (prRes.error) throw prRes.error;
      setClaims((clRes.data || []) as any);
      setProviders((prRes.data || []) as any);
      setPatients((paRes.data || []) as any);
    } catch (e: any) { toast.error(e.message || 'Load failed'); }
    setLoading(false);
  }, [activeOutlet]);

  useEffect(() => { loadData(); }, [loadData]);

  /* ── filtering ─────────────────────────────────────────────────── */
  const filtered = useMemo(() => {
    let d = [...claims];
    if (search) {
      const s = search.toLowerCase();
      d = d.filter(c =>
        c.claim_no?.toLowerCase().includes(s) ||
        `${c.pharmacy_patients?.first_name} ${c.pharmacy_patients?.last_name}`.toLowerCase().includes(s) ||
        c.pharmacy_insurance_providers?.provider_name?.toLowerCase().includes(s)
      );
    }
    if (filterProvider) d = d.filter(c => c.provider_id === filterProvider);
    if (filterStatus) d = d.filter(c => c.status === filterStatus);
    if (filterType) d = d.filter(c => c.pharmacy_insurance_providers?.provider_type === filterType);
    if (dateFrom) d = d.filter(c => c.claim_date >= dateFrom);
    if (dateTo) d = d.filter(c => c.claim_date <= dateTo);
    return d;
  }, [claims, search, filterProvider, filterStatus, filterType, dateFrom, dateTo]);

  const tabClaims = useMemo(() => {
    switch (tab) {
      case 'Pending/Submitted': return filtered.filter(c => c.status === 'Submitted' || c.status === 'Under Review');
      case 'Approved': return filtered.filter(c => c.status === 'Approved');
      case 'Rejected': return filtered.filter(c => c.status === 'Rejected' || c.status === 'Disputed');
      case 'Reimbursements': return filtered.filter(c => c.status === 'Paid');
      default: return filtered;
    }
  }, [filtered, tab]);

  /* ── KPIs ──────────────────────────────────────────────────────── */
  const kpis = useMemo(() => {
    const total = claims.length;
    const submitted = claims.filter(c => c.status === 'Submitted').length;
    const underReview = claims.filter(c => c.status === 'Under Review').length;
    const approved = claims.filter(c => c.status === 'Approved' || c.status === 'Paid').length;
    const rejected = claims.filter(c => c.status === 'Rejected').length;
    const totalClaimed = claims.reduce((s, c) => s + (c.claim_amount || 0), 0);
    const totalApproved = claims.reduce((s, c) => s + (c.approved_amount || 0), 0);
    const outstanding = totalClaimed - totalApproved;
    return { total, submitted, underReview, approved, rejected, totalClaimed, totalApproved, outstanding };
  }, [claims]);

  /* ── actions ───────────────────────────────────────────────────── */
  const submitNewClaim = async () => {
    if (!claimForm.patient_id || !claimForm.provider_id) { toast.error('Select patient & provider'); return; }
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const seq = String(claims.length + 1).padStart(3, '0');
    const claim_no = `CLM-${dateStr}-${seq}`;
    const { error } = await supabase.from('pharmacy_insurance_claims').insert({
      outlet_id: activeOutlet, claim_no, provider_id: claimForm.provider_id, patient_id: claimForm.patient_id,
      member_no: claimForm.member_no, sale_id: claimForm.sale_id || null,
      claim_date: now.toISOString().split('T')[0],
      claim_amount: parseFloat(claimForm.claim_amount) || 0,
      copay_amount: parseFloat(claimForm.copay_amount) || 0,
      approved_amount: 0, status: 'Submitted',
      items: claimForm.items, notes: claimForm.notes,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(`Claim ${claim_no} submitted`);
    setShowNewClaim(false);
    setClaimForm({ patient_id: '', provider_id: '', member_no: '', sale_id: '', claim_amount: '', copay_amount: '', notes: '', items: [{ drug_name: '', qty: 1, unit_price: 0, total: 0 }] });
    loadData();
  };

  const saveProvider = async (isEdit: boolean) => {
    if (!providerForm.provider_name) { toast.error('Provider name required'); return; }
    if (isEdit && editingProvider) {
      const { error } = await supabase.from('pharmacy_insurance_providers').update(providerForm).eq('provider_id', editingProvider.provider_id);
      if (error) { toast.error(error.message); return; }
      toast.success('Provider updated');
      setShowEditProvider(false);
    } else {
      const { error } = await supabase.from('pharmacy_insurance_providers').insert(providerForm);
      if (error) { toast.error(error.message); return; }
      toast.success('Provider added');
      setShowAddProvider(false);
    }
    setProviderForm(emptyProvider);
    loadData();
  };

  const markApproved = async () => {
    if (!actionClaim) return;
    const { error } = await supabase.from('pharmacy_insurance_claims').update({ status: 'Approved', approved_amount: parseFloat(approvedAmt) || actionClaim.claim_amount }).eq('claim_id', actionClaim.claim_id);
    if (error) { toast.error(error.message); return; }
    toast.success('Claim approved'); setShowApproveModal(false); loadData();
  };

  const markRejected = async () => {
    if (!actionClaim) return;
    const { error } = await supabase.from('pharmacy_insurance_claims').update({ status: 'Rejected', rejection_reason: rejectionReason }).eq('claim_id', actionClaim.claim_id);
    if (error) { toast.error(error.message); return; }
    toast.success('Claim rejected'); setShowRejectModal(false); loadData();
  };

  const markPaid = async () => {
    if (!actionClaim) return;
    const { error } = await supabase.from('pharmacy_insurance_claims').update({ status: 'Paid', payment_date: new Date().toISOString().split('T')[0], payment_reference: paymentRef }).eq('claim_id', actionClaim.claim_id);
    if (error) { toast.error(error.message); return; }
    toast.success('Marked as paid'); setShowPaidModal(false); loadData();
  };

  const disputeClaim = async (c: Claim) => {
    const { error } = await supabase.from('pharmacy_insurance_claims').update({ status: 'Disputed' }).eq('claim_id', c.claim_id);
    if (error) { toast.error(error.message); return; }
    toast.success('Claim disputed'); loadData();
  };

  const deleteProvider = async (p: Provider) => {
    if (!confirm(`Delete provider "${p.provider_name}"?`)) return;
    const { error } = await supabase.from('pharmacy_insurance_providers').delete().eq('provider_id', p.provider_id);
    if (error) { toast.error(error.message); return; }
    toast.success('Provider deleted'); loadData();
  };

  /* ── copay auto-calc ───────────────────────────────────────────── */
  const handleProviderChange = (pid: string) => {
    const prov = providers.find(p => p.provider_id === pid);
    setClaimForm(prev => {
      const amt = parseFloat(prev.claim_amount) || 0;
      const copay = prov ? amt * (prov.copay_percentage / 100) : 0;
      return { ...prev, provider_id: pid, copay_amount: copay.toFixed(2) };
    });
  };
  const handleClaimAmountChange = (val: string) => {
    const prov = providers.find(p => p.provider_id === claimForm.provider_id);
    const amt = parseFloat(val) || 0;
    const copay = prov ? amt * (prov.copay_percentage / 100) : 0;
    setClaimForm(prev => ({ ...prev, claim_amount: val, copay_amount: copay.toFixed(2) }));
  };

  /* ── item rows ─────────────────────────────────────────────────── */
  const updateItem = (idx: number, field: string, val: any) => {
    setClaimForm(prev => {
      const items = [...prev.items];
      (items[idx] as any)[field] = val;
      items[idx].total = items[idx].qty * items[idx].unit_price;
      return { ...prev, items };
    });
  };
  const addItem = () => setClaimForm(prev => ({ ...prev, items: [...prev.items, { drug_name: '', qty: 1, unit_price: 0, total: 0 }] }));
  const removeItem = (idx: number) => setClaimForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));

  /* ── export ────────────────────────────────────────────────────── */
  const exportExcel = (data: any[], filename: string, cols: string[]) => {
    let xml = '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>';
    xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Sheet1"><Table>';
    xml += '<Row>' + cols.map(c => `<Cell><Data ss:Type="String">${c}</Data></Cell>`).join('') + '</Row>';
    data.forEach(r => { xml += '<Row>' + cols.map(c => `<Cell><Data ss:Type="String">${r[c] ?? ''}</Data></Cell>`).join('') + '</Row>'; });
    xml += '</Table></Worksheet></Workbook>';
    const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${filename}.xls`; a.click();
  };

  const exportClaims = () => {
    const rows = tabClaims.map(c => ({
      'Claim#': c.claim_no, Date: c.claim_date,
      Patient: `${c.pharmacy_patients?.first_name || ''} ${c.pharmacy_patients?.last_name || ''}`,
      Provider: c.pharmacy_insurance_providers?.provider_name || '', 'Member No': c.member_no,
      'Claim Amount': c.claim_amount, 'Copay': c.copay_amount, 'Approved': c.approved_amount,
      Status: c.status, 'Payment Date': c.payment_date || '',
    }));
    exportExcel(rows, 'insurance-claims', Object.keys(rows[0] || {}));
  };

  const printTable = () => { window.print(); };

  /* ── Analytics data ────────────────────────────────────────────── */
  const analyticsData = useMemo(() => {
    const byProvider: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const monthly: Record<string, number> = {};
    claims.forEach(c => {
      const pName = c.pharmacy_insurance_providers?.provider_name || 'Unknown';
      byProvider[pName] = (byProvider[pName] || 0) + c.claim_amount;
      byStatus[c.status] = (byStatus[c.status] || 0) + 1;
      const mo = c.claim_date?.substring(0, 7) || 'N/A';
      monthly[mo] = (monthly[mo] || 0) + c.claim_amount;
    });
    const totalDecided = claims.filter(c => ['Approved', 'Paid', 'Rejected'].includes(c.status)).length;
    const totalAppr = claims.filter(c => ['Approved', 'Paid'].includes(c.status)).length;
    const approvalRate = totalDecided ? ((totalAppr / totalDecided) * 100).toFixed(1) : '0';
    return { byProvider, byStatus, monthly, approvalRate };
  }, [claims]);

  const reimbursementSummary = useMemo(() => {
    const map: Record<string, { name: string; total: number; count: number }> = {};
    claims.filter(c => c.status === 'Paid').forEach(c => {
      const name = c.pharmacy_insurance_providers?.provider_name || 'Unknown';
      if (!map[name]) map[name] = { name, total: 0, count: 0 };
      map[name].total += c.approved_amount || 0;
      map[name].count++;
    });
    return Object.values(map);
  }, [claims]);

  /* ── patient filter for modal ──────────────────────────────────── */
  const filteredPatients = useMemo(() => {
    if (!patientSearch) return patients.slice(0, 20);
    const s = patientSearch.toLowerCase();
    return patients.filter(p => `${p.first_name} ${p.last_name}`.toLowerCase().includes(s) || p.phone?.includes(s)).slice(0, 20);
  }, [patients, patientSearch]);

  /* ── render helpers ────────────────────────────────────────────── */
  const KPI = ({ label, value, sub, color, icon }: { label: string; value: string; sub: string; color: string; icon: string }) => {
    const c = color;
    return (
      <div className={`bg-gradient-to-br from-${c}-50/80 via-${c === 'emerald' ? 'teal' : c === 'blue' ? 'indigo' : c === 'violet' ? 'purple' : c === 'rose' ? 'pink' : c === 'amber' ? 'orange' : 'sky'}-50/40 to-white p-3 rounded-xl border border-${c}-200/80 shadow-xs`}>
        <div className="flex items-center justify-between mb-1">
          <span className={`text-[10px] font-bold text-${c}-800 uppercase tracking-wider`}>{label}</span>
          <span className="text-base">{icon}</span>
        </div>
        <div className={`text-lg font-black text-${c}-950 tracking-tight`}>{value}</div>
        <div className={`text-[10px] font-bold text-${c}-700 mt-0.5`}>{sub}</div>
      </div>
    );
  };

  if (loading) return (
    <div className="w-full max-w-full space-y-3.5 px-1 md:px-2 text-gray-900" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-xs flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mr-3" />
        <span className="text-sm font-semibold text-gray-600">Loading insurance claims...</span>
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-full space-y-3.5 px-1 md:px-2 text-gray-900" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* ─── Header ─── */}
      <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 w-10 h-10 rounded-xl flex items-center justify-center text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">Insurance Claims Management</h1>
              <p className="text-xs text-gray-500 mt-0.5 font-medium">SHA/SHIF • Private Insurers • Copayment Processing • Reimbursement Tracking</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowNewClaim(true)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs text-xs transition-colors">+ New Claim</button>
            <button onClick={exportClaims} className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-bold shadow-xs text-xs">⬇ Export</button>
            <button onClick={printTable} className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-bold shadow-xs text-xs">🖨 Print</button>
          </div>
        </div>
      </div>

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <KPI label="Total Claims" value={fmt(kpis.total)} sub="All time" color="blue" icon="📋" />
        <KPI label="Submitted" value={fmt(kpis.submitted)} sub="Awaiting review" color="cyan" icon="📤" />
        <KPI label="Under Review" value={fmt(kpis.underReview)} sub="Being processed" color="amber" icon="🔍" />
        <KPI label="Approved" value={fmt(kpis.approved)} sub="Approved + Paid" color="emerald" icon="✅" />
        <KPI label="Rejected" value={fmt(kpis.rejected)} sub="Declined claims" color="rose" icon="❌" />
        <KPI label="Total Claimed" value={fmtCurrency(kpis.totalClaimed)} sub="Sum of all claims" color="violet" icon="💰" />
        <KPI label="Total Approved" value={fmtCurrency(kpis.totalApproved)} sub="Approved value" color="emerald" icon="💵" />
        <KPI label="Outstanding" value={fmtCurrency(kpis.outstanding)} sub="Claimed − Approved" color="amber" icon="⏳" />
      </div>

      {/* ─── Tabs ─── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-1 flex flex-wrap gap-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={tab === t ? 'px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-bold text-xs shadow-xs' : 'px-3 py-1.5 bg-white text-gray-600 border border-gray-200 rounded-lg font-bold text-xs hover:bg-gray-50'}>
            {t}
          </button>
        ))}
      </div>

      {/* ─── Search & Filters ─── */}
      {tab !== 'Analytics' && tab !== 'Providers' && (
        <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            <div className="md:col-span-2">
              <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Search</label>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Claim#, patient, provider..." className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Provider</label>
              <select value={filterProvider} onChange={e => setFilterProvider(e.target.value)} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none">
                <option value="">All</option>
                {providers.map(p => <option key={p.provider_id} value={p.provider_id}>{p.provider_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Status</label>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none">
                <option value="">All</option>
                {['Submitted','Under Review','Approved','Rejected','Paid','Disputed'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">From</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">To</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" />
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════ ALL CLAIMS / PENDING / APPROVED / REJECTED / REIMBURSEMENTS TAB ═══════════════════════ */}
      {['All Claims', 'Pending/Submitted', 'Approved', 'Rejected', 'Reimbursements'].includes(tab) && (
        <>
          {tab === 'Reimbursements' && reimbursementSummary.length > 0 && (
            <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
              <h3 className="text-xs font-bold text-gray-800 mb-2 uppercase tracking-wider">Reimbursement Summary by Provider</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {reimbursementSummary.map(r => (
                  <div key={r.name} className="bg-gradient-to-br from-green-50/80 via-emerald-50/40 to-white p-2.5 rounded-xl border border-green-200/80 shadow-xs">
                    <div className="text-[10px] font-bold text-green-800 uppercase tracking-wider">{r.name}</div>
                    <div className="text-sm font-black text-green-950">{fmtCurrency(r.total)}</div>
                    <div className="text-[9px] text-gray-500">{r.count} claim{r.count !== 1 ? 's' : ''} paid</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="bg-gradient-to-r from-cyan-700 via-blue-700 to-indigo-800">
                  {['Claim#','Date','Patient','Provider','Type','Member No','Amount','Copay','Approved','Status','Payment','Actions'].map(h => (
                    <th key={h} className="px-2.5 py-2 text-left text-[10px] font-bold text-white uppercase tracking-wider">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {tabClaims.length === 0 && <tr><td colSpan={12} className="text-center py-8 text-xs text-gray-400 font-semibold">No claims found</td></tr>}
                  {tabClaims.map((c, i) => (
                    <tr key={c.claim_id} className={`border-b border-gray-100 hover:bg-emerald-50/40 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                      <td className="px-2.5 py-1.5 text-xs font-bold text-blue-700 cursor-pointer" onClick={() => { setViewingClaim(c); setShowViewClaim(true); }}>{c.claim_no}</td>
                      <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-800">{c.claim_date}</td>
                      <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-800">{c.pharmacy_patients?.first_name} {c.pharmacy_patients?.last_name}</td>
                      <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-800">{c.pharmacy_insurance_providers?.provider_name}</td>
                      <td className="px-2.5 py-1.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${PTYPE_COLORS[c.pharmacy_insurance_providers?.provider_type || ''] || 'bg-gray-100 text-gray-700'}`}>{c.pharmacy_insurance_providers?.provider_type}</span></td>
                      <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-800">{c.member_no}</td>
                      <td className="px-2.5 py-1.5 text-xs font-bold text-gray-900">{fmtCurrency(c.claim_amount)}</td>
                      <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{fmtCurrency(c.copay_amount)}</td>
                      <td className="px-2.5 py-1.5 text-xs font-bold text-emerald-700">{fmtCurrency(c.approved_amount)}</td>
                      <td className="px-2.5 py-1.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLORS[c.status] || 'bg-gray-100 text-gray-700'}`}>{c.status}</span></td>
                      <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-600">{c.payment_date || '—'}</td>
                      <td className="px-2.5 py-1.5">
                        <div className="flex gap-1">
                          {(c.status === 'Submitted' || c.status === 'Under Review') && (
                            <>
                              <button onClick={() => { setActionClaim(c); setApprovedAmt(String(c.claim_amount)); setShowApproveModal(true); }} className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold hover:bg-emerald-700">Approve</button>
                              <button onClick={() => { setActionClaim(c); setRejectionReason(''); setShowRejectModal(true); }} className="px-2 py-0.5 bg-rose-600 text-white rounded text-[10px] font-bold hover:bg-rose-700">Reject</button>
                            </>
                          )}
                          {c.status === 'Approved' && (
                            <button onClick={() => { setActionClaim(c); setPaymentRef(''); setShowPaidModal(true); }} className="px-2 py-0.5 bg-blue-600 text-white rounded text-[10px] font-bold hover:bg-blue-700">Mark Paid</button>
                          )}
                          {c.status === 'Rejected' && (
                            <button onClick={() => disputeClaim(c)} className="px-2 py-0.5 bg-orange-600 text-white rounded text-[10px] font-bold hover:bg-orange-700">Dispute</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 text-[10px] text-gray-500 font-semibold">
              Showing {tabClaims.length} of {claims.length} claims
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════ PROVIDERS TAB ═══════════════════════ */}
      {tab === 'Providers' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => { setProviderForm(emptyProvider); setShowAddProvider(true); }} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs text-xs transition-colors">+ Add Provider</button>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="bg-gradient-to-r from-cyan-700 via-blue-700 to-indigo-800">
                  {['Provider Name','Type','Contact','Phone','Email','Copay%','Credit Limit','Outstanding','Terms','Contract','Status','Actions'].map(h => (
                    <th key={h} className="px-2.5 py-2 text-left text-[10px] font-bold text-white uppercase tracking-wider">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {providers.length === 0 && <tr><td colSpan={12} className="text-center py-8 text-xs text-gray-400 font-semibold">No providers</td></tr>}
                  {providers.map((p, i) => (
                    <tr key={p.provider_id} className={`border-b border-gray-100 hover:bg-emerald-50/40 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                      <td className="px-2.5 py-1.5 text-xs font-bold text-gray-900">{p.provider_name}</td>
                      <td className="px-2.5 py-1.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${PTYPE_COLORS[p.provider_type] || 'bg-gray-100 text-gray-700'}`}>{p.provider_type}</span></td>
                      <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{p.contact_person}</td>
                      <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{p.phone}</td>
                      <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{p.email}</td>
                      <td className="px-2.5 py-1.5 text-xs font-bold text-gray-900">{p.copay_percentage}%</td>
                      <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-800">{fmtCurrency(p.credit_limit)}</td>
                      <td className="px-2.5 py-1.5 text-xs font-bold text-amber-700">{fmtCurrency(p.outstanding_balance)}</td>
                      <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{p.payment_terms_days}d</td>
                      <td className="px-2.5 py-1.5 text-[10px] font-semibold text-gray-600">{p.contract_start} → {p.contract_end}</td>
                      <td className="px-2.5 py-1.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${p.active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>{p.active ? 'Active' : 'Inactive'}</span></td>
                      <td className="px-2.5 py-1.5">
                        <div className="flex gap-1">
                          <button onClick={() => { setEditingProvider(p); setProviderForm(p); setShowEditProvider(true); }} className="px-2 py-0.5 bg-blue-600 text-white rounded text-[10px] font-bold hover:bg-blue-700">Edit</button>
                          <button onClick={() => deleteProvider(p)} className="px-2 py-0.5 bg-rose-600 text-white rounded text-[10px] font-bold hover:bg-rose-700">Del</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════ ANALYTICS TAB ═══════════════════════ */}
      {tab === 'Analytics' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
            <div className="bg-gradient-to-br from-emerald-50/80 via-teal-50/40 to-white p-3 rounded-xl border border-emerald-200/80 shadow-xs text-center">
              <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Approval Rate</div>
              <div className="text-3xl font-black text-emerald-950 tracking-tight">{analyticsData.approvalRate}%</div>
              <div className="text-[10px] font-bold text-emerald-700 mt-0.5">Of decided claims</div>
            </div>
            <div className="bg-gradient-to-br from-blue-50/80 via-indigo-50/40 to-white p-3 rounded-xl border border-blue-200/80 shadow-xs text-center">
              <div className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">Avg Claim Value</div>
              <div className="text-lg font-black text-blue-950 tracking-tight">{claims.length ? fmtCurrency(kpis.totalClaimed / claims.length) : 'KSh 0'}</div>
              <div className="text-[10px] font-bold text-blue-700 mt-0.5">Per claim</div>
            </div>
            <div className="bg-gradient-to-br from-violet-50/80 via-purple-50/40 to-white p-3 rounded-xl border border-violet-200/80 shadow-xs text-center">
              <div className="text-[10px] font-bold text-violet-800 uppercase tracking-wider">Active Providers</div>
              <div className="text-3xl font-black text-violet-950 tracking-tight">{providers.filter(p => p.active).length}</div>
              <div className="text-[10px] font-bold text-violet-700 mt-0.5">Insurance partners</div>
            </div>
            <div className="bg-gradient-to-br from-rose-50/80 via-pink-50/40 to-white p-3 rounded-xl border border-rose-200/80 shadow-xs text-center">
              <div className="text-[10px] font-bold text-rose-800 uppercase tracking-wider">Rejection Rate</div>
              <div className="text-3xl font-black text-rose-950 tracking-tight">{(100 - parseFloat(analyticsData.approvalRate)).toFixed(1)}%</div>
              <div className="text-[10px] font-bold text-rose-700 mt-0.5">Of decided claims</div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
              <h3 className="text-xs font-bold text-gray-800 mb-3 uppercase tracking-wider">Claims by Provider (KSh)</h3>
              <div className="h-64">
                <Doughnut data={{
                  labels: Object.keys(analyticsData.byProvider),
                  datasets: [{ data: Object.values(analyticsData.byProvider), backgroundColor: ['#10b981','#3b82f6','#8b5cf6','#f59e0b','#ef4444','#06b6d4','#ec4899','#84cc16'] }]
                }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 10 } } } } }} />
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
              <h3 className="text-xs font-bold text-gray-800 mb-3 uppercase tracking-wider">Claims by Status</h3>
              <div className="h-64">
                <Bar data={{
                  labels: Object.keys(analyticsData.byStatus),
                  datasets: [{ label: 'Count', data: Object.values(analyticsData.byStatus), backgroundColor: ['#3b82f6','#f59e0b','#10b981','#ef4444','#22c55e','#f97316'] }]
                }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { font: { size: 10 } } }, x: { ticks: { font: { size: 9 } } } } }} />
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs md:col-span-2">
              <h3 className="text-xs font-bold text-gray-800 mb-3 uppercase tracking-wider">Monthly Claims Trend (KSh)</h3>
              <div className="h-64">
                <Line data={{
                  labels: Object.keys(analyticsData.monthly).sort(),
                  datasets: [{ label: 'Claims Value', data: Object.keys(analyticsData.monthly).sort().map(k => analyticsData.monthly[k]), borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true, tension: 0.3 }]
                }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { font: { size: 10 } } }, x: { ticks: { font: { size: 9 } } } } }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════ NEW CLAIM MODAL ═══════════════════ */}
      {showNewClaim && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200"><h2 className="text-lg font-bold text-gray-900">New Insurance Claim</h2></div>
            <div className="p-4 space-y-3">
              {/* Patient */}
              <div>
                <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Search Patient</label>
                <input value={patientSearch} onChange={e => setPatientSearch(e.target.value)} placeholder="Type name or phone..." className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" />
                {patientSearch && (
                  <div className="mt-1 max-h-32 overflow-y-auto border border-gray-200 rounded-lg bg-white">
                    {filteredPatients.map(p => (
                      <div key={p.patient_id} onClick={() => { setClaimForm(f => ({ ...f, patient_id: p.patient_id })); setPatientSearch(`${p.first_name} ${p.last_name}`); }}
                        className={`px-2.5 py-1.5 text-xs font-semibold cursor-pointer hover:bg-emerald-50 ${claimForm.patient_id === p.patient_id ? 'bg-emerald-100' : ''}`}>
                        {p.first_name} {p.last_name} — {p.phone}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Provider</label>
                  <select value={claimForm.provider_id} onChange={e => handleProviderChange(e.target.value)} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none">
                    <option value="">Select...</option>
                    {providers.filter(p => p.active).map(p => <option key={p.provider_id} value={p.provider_id}>{p.provider_name} ({p.provider_type})</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Member No</label>
                  <input value={claimForm.member_no} onChange={e => setClaimForm(f => ({ ...f, member_no: e.target.value }))} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Sale Reference</label>
                  <input value={claimForm.sale_id} onChange={e => setClaimForm(f => ({ ...f, sale_id: e.target.value }))} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Claim Amount (KSh)</label>
                  <input type="number" value={claimForm.claim_amount} onChange={e => handleClaimAmountChange(e.target.value)} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Copay Amount (Auto)</label>
                  <input type="number" value={claimForm.copay_amount} readOnly className="w-full px-2.5 py-1.5 bg-gray-100 border border-gray-200 rounded-lg text-xs font-semibold text-gray-500 outline-none" />
                </div>
              </div>
              {/* Items */}
              <div>
                <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1 block">Claim Items</label>
                {claimForm.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-1.5 mb-1.5">
                    <input className="col-span-5 px-2 py-1 bg-gray-50 border border-gray-200 rounded text-xs font-semibold text-gray-700 outline-none" placeholder="Drug name" value={item.drug_name} onChange={e => updateItem(idx, 'drug_name', e.target.value)} />
                    <input className="col-span-2 px-2 py-1 bg-gray-50 border border-gray-200 rounded text-xs font-semibold text-gray-700 outline-none" type="number" placeholder="Qty" value={item.qty} onChange={e => updateItem(idx, 'qty', parseInt(e.target.value) || 0)} />
                    <input className="col-span-2 px-2 py-1 bg-gray-50 border border-gray-200 rounded text-xs font-semibold text-gray-700 outline-none" type="number" placeholder="Price" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)} />
                    <div className="col-span-2 px-2 py-1 bg-gray-100 border border-gray-200 rounded text-xs font-bold text-gray-800 flex items-center">{fmt(item.total)}</div>
                    <button onClick={() => removeItem(idx)} className="col-span-1 text-rose-500 hover:text-rose-700 font-bold text-sm">✕</button>
                  </div>
                ))}
                <button onClick={addItem} className="text-[10px] font-bold text-emerald-600 hover:text-emerald-800">+ Add Item</button>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Notes</label>
                <textarea value={claimForm.notes} onChange={e => setClaimForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" />
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => setShowNewClaim(false)} className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-bold shadow-xs text-xs">Cancel</button>
              <button onClick={submitNewClaim} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs text-xs transition-colors">Submit Claim</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════ PROVIDER ADD/EDIT MODAL ═══════════════════ */}
      {(showAddProvider || showEditProvider) && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200"><h2 className="text-lg font-bold text-gray-900">{showEditProvider ? 'Edit Provider' : 'Add Provider'}</h2></div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Provider Name *</label>
                  <input value={providerForm.provider_name} onChange={e => setProviderForm((f: any) => ({ ...f, provider_name: e.target.value }))} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Type</label>
                  <select value={providerForm.provider_type} onChange={e => setProviderForm((f: any) => ({ ...f, provider_type: e.target.value }))} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none">
                    <option value="SHA">SHA</option><option value="Private">Private</option><option value="Corporate">Corporate</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Contact Person</label>
                  <input value={providerForm.contact_person} onChange={e => setProviderForm((f: any) => ({ ...f, contact_person: e.target.value }))} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Phone</label>
                  <input value={providerForm.phone} onChange={e => setProviderForm((f: any) => ({ ...f, phone: e.target.value }))} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Email</label>
                  <input value={providerForm.email} onChange={e => setProviderForm((f: any) => ({ ...f, email: e.target.value }))} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">API Endpoint</label>
                  <input value={providerForm.api_endpoint} onChange={e => setProviderForm((f: any) => ({ ...f, api_endpoint: e.target.value }))} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Contract Start</label>
                  <input type="date" value={providerForm.contract_start} onChange={e => setProviderForm((f: any) => ({ ...f, contract_start: e.target.value }))} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Contract End</label>
                  <input type="date" value={providerForm.contract_end} onChange={e => setProviderForm((f: any) => ({ ...f, contract_end: e.target.value }))} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Copay %</label>
                  <input type="number" value={providerForm.copay_percentage} onChange={e => setProviderForm((f: any) => ({ ...f, copay_percentage: parseFloat(e.target.value) || 0 }))} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Credit Limit (KSh)</label>
                  <input type="number" value={providerForm.credit_limit} onChange={e => setProviderForm((f: any) => ({ ...f, credit_limit: parseFloat(e.target.value) || 0 }))} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Outstanding Balance</label>
                  <input type="number" value={providerForm.outstanding_balance} onChange={e => setProviderForm((f: any) => ({ ...f, outstanding_balance: parseFloat(e.target.value) || 0 }))} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Payment Terms (days)</label>
                  <input type="number" value={providerForm.payment_terms_days} onChange={e => setProviderForm((f: any) => ({ ...f, payment_terms_days: parseInt(e.target.value) || 0 }))} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" />
                </div>
                <div className="flex items-center gap-2 pt-4">
                  <input type="checkbox" checked={providerForm.active} onChange={e => setProviderForm((f: any) => ({ ...f, active: e.target.checked }))} className="rounded border-gray-300" />
                  <span className="text-xs font-semibold text-gray-700">Active</span>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => { setShowAddProvider(false); setShowEditProvider(false); }} className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-bold shadow-xs text-xs">Cancel</button>
              <button onClick={() => saveProvider(showEditProvider)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs text-xs transition-colors">{showEditProvider ? 'Update' : 'Add'} Provider</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════ VIEW CLAIM MODAL ═══════════════════ */}
      {showViewClaim && viewingClaim && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Claim {viewingClaim.claim_no}</h2>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLORS[viewingClaim.status]}`}>{viewingClaim.status}</span>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-[10px] font-bold text-gray-500 uppercase">Patient</span><p className="text-xs font-semibold text-gray-800">{viewingClaim.pharmacy_patients?.first_name} {viewingClaim.pharmacy_patients?.last_name}</p></div>
                <div><span className="text-[10px] font-bold text-gray-500 uppercase">Provider</span><p className="text-xs font-semibold text-gray-800">{viewingClaim.pharmacy_insurance_providers?.provider_name}</p></div>
                <div><span className="text-[10px] font-bold text-gray-500 uppercase">Member No</span><p className="text-xs font-semibold text-gray-800">{viewingClaim.member_no}</p></div>
                <div><span className="text-[10px] font-bold text-gray-500 uppercase">Claim Date</span><p className="text-xs font-semibold text-gray-800">{viewingClaim.claim_date}</p></div>
                <div><span className="text-[10px] font-bold text-gray-500 uppercase">Claim Amount</span><p className="text-xs font-bold text-gray-900">{fmtCurrency(viewingClaim.claim_amount)}</p></div>
                <div><span className="text-[10px] font-bold text-gray-500 uppercase">Copay</span><p className="text-xs font-semibold text-gray-800">{fmtCurrency(viewingClaim.copay_amount)}</p></div>
                <div><span className="text-[10px] font-bold text-gray-500 uppercase">Approved</span><p className="text-xs font-bold text-emerald-700">{fmtCurrency(viewingClaim.approved_amount)}</p></div>
                <div><span className="text-[10px] font-bold text-gray-500 uppercase">Payment Ref</span><p className="text-xs font-semibold text-gray-800">{viewingClaim.payment_reference || '—'}</p></div>
              </div>
              {viewingClaim.rejection_reason && (
                <div className="bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                  <span className="text-[10px] font-bold text-rose-700 uppercase">Rejection Reason</span>
                  <p className="text-xs font-semibold text-rose-800 mt-0.5">{viewingClaim.rejection_reason}</p>
                </div>
              )}
              {viewingClaim.items && Array.isArray(viewingClaim.items) && viewingClaim.items.length > 0 && (
                <div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase">Items</span>
                  <table className="w-full mt-1"><thead><tr className="bg-gray-100"><th className="px-2 py-1 text-[10px] font-bold text-gray-600 text-left">Drug</th><th className="px-2 py-1 text-[10px] font-bold text-gray-600 text-right">Qty</th><th className="px-2 py-1 text-[10px] font-bold text-gray-600 text-right">Price</th><th className="px-2 py-1 text-[10px] font-bold text-gray-600 text-right">Total</th></tr></thead>
                  <tbody>{viewingClaim.items.map((it: any, i: number) => (<tr key={i} className="border-b border-gray-100"><td className="px-2 py-1 text-xs font-semibold text-gray-800">{it.drug_name}</td><td className="px-2 py-1 text-xs text-right text-gray-700">{it.qty}</td><td className="px-2 py-1 text-xs text-right text-gray-700">{fmtCurrency(it.unit_price)}</td><td className="px-2 py-1 text-xs text-right font-bold text-gray-900">{fmtCurrency(it.total)}</td></tr>))}</tbody></table>
                </div>
              )}
              {viewingClaim.notes && <div><span className="text-[10px] font-bold text-gray-500 uppercase">Notes</span><p className="text-xs font-semibold text-gray-700 mt-0.5">{viewingClaim.notes}</p></div>}
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end"><button onClick={() => setShowViewClaim(false)} className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-bold shadow-xs text-xs">Close</button></div>
          </div>
        </div>
      )}

      {/* ═══════════════════ APPROVE MODAL ═══════════════════ */}
      {showApproveModal && actionClaim && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-4 border-b border-gray-200"><h2 className="text-lg font-bold text-gray-900">Approve Claim</h2><p className="text-xs text-gray-500 mt-0.5">{actionClaim.claim_no}</p></div>
            <div className="p-4 space-y-3">
              <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Approved Amount (KSh)</label>
              <input type="number" value={approvedAmt} onChange={e => setApprovedAmt(e.target.value)} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" /></div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => setShowApproveModal(false)} className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-bold shadow-xs text-xs">Cancel</button>
              <button onClick={markApproved} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs text-xs transition-colors">Approve</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════ REJECT MODAL ═══════════════════ */}
      {showRejectModal && actionClaim && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-4 border-b border-gray-200"><h2 className="text-lg font-bold text-gray-900">Reject Claim</h2><p className="text-xs text-gray-500 mt-0.5">{actionClaim.claim_no}</p></div>
            <div className="p-4 space-y-3">
              <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Rejection Reason *</label>
              <textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} rows={3} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" /></div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => setShowRejectModal(false)} className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-bold shadow-xs text-xs">Cancel</button>
              <button onClick={markRejected} className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold shadow-xs text-xs transition-colors">Reject</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════ MARK PAID MODAL ═══════════════════ */}
      {showPaidModal && actionClaim && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-4 border-b border-gray-200"><h2 className="text-lg font-bold text-gray-900">Mark as Paid</h2><p className="text-xs text-gray-500 mt-0.5">{actionClaim.claim_no} — {fmtCurrency(actionClaim.approved_amount)}</p></div>
            <div className="p-4 space-y-3">
              <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Payment Reference</label>
              <input value={paymentRef} onChange={e => setPaymentRef(e.target.value)} placeholder="e.g. CHQ-001234" className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" /></div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => setShowPaidModal(false)} className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-bold shadow-xs text-xs">Cancel</button>
              <button onClick={markPaid} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs text-xs transition-colors">Confirm Paid</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
