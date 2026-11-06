'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

/* ───────── types ───────── */
interface Prescription {
  prescription_id: string;
  outlet_id: string;
  patient_id: string;
  prescription_no: string;
  prescriber_name: string;
  prescriber_reg_no: string;
  prescriber_facility: string;
  prescriber_phone: string;
  diagnosis: string;
  prescription_date: string;
  expiry_date: string;
  status: string;
  is_controlled: boolean;
  image_url: string;
  notes: string;
  dispensed_by: string;
  verified_by: string;
  verification_date: string;
  created_by: string;
  created_at: string;
  pharmacy_patients?: { full_name: string; phone: string; patient_id: string };
}

interface PrescriptionItem {
  item_id: string;
  prescription_id: string;
  product_id: string;
  drug_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity_prescribed: number;
  quantity_dispensed: number;
  instructions: string;
  substitution_allowed: boolean;
  status: string;
}

interface Patient {
  patient_id: string;
  full_name: string;
  phone: string;
  id_number: string;
}

const STATUSES = ['Pending', 'Partially Dispensed', 'Fully Dispensed', 'Expired', 'Cancelled'];
const FREQUENCIES = ['OD (Once Daily)', 'BD (Twice Daily)', 'TDS (Three Times)', 'QID (Four Times)', 'PRN (As Needed)', 'STAT (Immediately)', 'Nocte (At Night)', 'Mane (Morning)', 'Weekly'];
const TABS = ['All Prescriptions', 'Pending', 'Dispensing Queue', 'Controlled', 'Expired/Archive'];

const fmt = (n: number) => n.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const statusColors: Record<string, string> = {
  'Pending': 'bg-amber-100 text-amber-800',
  'Partially Dispensed': 'bg-blue-100 text-blue-800',
  'Fully Dispensed': 'bg-emerald-100 text-emerald-800',
  'Expired': 'bg-gray-200 text-gray-600',
  'Cancelled': 'bg-rose-100 text-rose-800',
};

export default function PrescriptionsPage() {
  const { activeOutlet } = useOutlet();
  const outletId = typeof activeOutlet === "object" && activeOutlet !== null ? (activeOutlet.outlet_id || 1) : (Number(activeOutlet) || 1);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [items, setItems] = useState<PrescriptionItem[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('All Prescriptions');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterControlled, setFilterControlled] = useState('');
  const [filterPrescriber, setFilterPrescriber] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedRx, setSelectedRx] = useState<Prescription | null>(null);
  const [selectedItems, setSelectedItems] = useState<PrescriptionItem[]>([]);
  const [patientSearch, setPatientSearch] = useState('');

  // New Rx form
  const emptyRxForm = () => ({
    patient_id: '',
    prescriber_name: '',
    prescriber_reg_no: '',
    prescriber_facility: '',
    prescriber_phone: '',
    diagnosis: '',
    prescription_date: new Date().toISOString().split('T')[0],
    is_controlled: false,
    notes: '',
  });
  const [rxForm, setRxForm] = useState(emptyRxForm());

  const emptyItem = (): Partial<PrescriptionItem> => ({
    drug_name: '', dosage: '', frequency: 'OD (Once Daily)', duration: '', quantity_prescribed: 0, instructions: '', substitution_allowed: true, status: 'Pending',
  });
  const [rxItems, setRxItems] = useState<Partial<PrescriptionItem>[]>([emptyItem()]);

  /* ───────── load ───────── */
  const loadData = useCallback(async () => {
    const outletId = typeof activeOutlet === 'object' && activeOutlet !== null ? (activeOutlet.outlet_id || 1) : (Number(activeOutlet) || 1);
    setLoading(true);
    try {
      const { data: rx } = await supabase.from('pharmacy_prescriptions').select('*, pharmacy_patients(full_name, phone, patient_id)').eq('outlet_id', outletId).order('created_at', { ascending: false });
      setPrescriptions((rx as Prescription[]) || []);
      const { data: pi } = await supabase.from('pharmacy_prescription_items').select('*');
      setItems((pi as PrescriptionItem[]) || []);
      const { data: pts } = await supabase.from('pharmacy_patients').select('patient_id, full_name, phone, id_number').eq('outlet_id', outletId).order('full_name');
      setPatients((pts as Patient[]) || []);
    } catch { toast.error('Failed to load prescriptions'); }
    setLoading(false);
  }, [activeOutlet]);

  useEffect(() => { loadData(); }, [loadData]);

  /* ───────── KPI calcs ───────── */
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const totalRx = prescriptions.length;
  const pendingRx = prescriptions.filter(r => r.status === 'Pending').length;
  const partialRx = prescriptions.filter(r => r.status === 'Partially Dispensed').length;
  const fullyRx = prescriptions.filter(r => r.status === 'Fully Dispensed').length;
  const controlledRx = prescriptions.filter(r => r.is_controlled).length;
  const expiredRx = prescriptions.filter(r => r.status === 'Expired' || (r.expiry_date && new Date(r.expiry_date) < now)).length;
  const todayRx = prescriptions.filter(r => r.prescription_date === today || (r.created_at && r.created_at.startsWith(today))).length;
  const verifiedRx = prescriptions.filter(r => r.verified_by).length;

  const kpis = [
    { label: 'Total Prescriptions', value: fmt(totalRx), sub: 'All Records', color: 'blue', icon: '📋' },
    { label: 'Pending Dispensing', value: fmt(pendingRx), sub: 'Awaiting', color: 'amber', icon: '⏳' },
    { label: 'Partially Dispensed', value: fmt(partialRx), sub: 'In Progress', color: 'cyan', icon: '🔄' },
    { label: 'Fully Dispensed', value: fmt(fullyRx), sub: 'Complete', color: 'emerald', icon: '✅' },
    { label: 'Controlled Rx', value: fmt(controlledRx), sub: 'Schedule II-V', color: 'rose', icon: '🛡️' },
    { label: 'Expired Rx', value: fmt(expiredRx), sub: 'Past Expiry', color: 'violet', icon: '📅' },
    { label: "Today's Rx", value: fmt(todayRx), sub: today, color: 'blue', icon: '📝' },
    { label: 'Verified', value: fmt(verifiedRx), sub: 'By Pharmacist', color: 'emerald', icon: '✔️' },
  ];

  const colorMap: Record<string, string> = {
    emerald: 'from-emerald-50/80 via-teal-50/40 to-white border-emerald-200/80',
    blue: 'from-blue-50/80 via-indigo-50/40 to-white border-blue-200/80',
    violet: 'from-violet-50/80 via-purple-50/40 to-white border-violet-200/80',
    cyan: 'from-cyan-50/80 via-sky-50/40 to-white border-cyan-200/80',
    rose: 'from-rose-50/80 via-pink-50/40 to-white border-rose-200/80',
    amber: 'from-amber-50/80 via-orange-50/40 to-white border-amber-200/80',
  };
  const textMap: Record<string, { label: string; value: string; sub: string }> = {
    emerald: { label: 'text-emerald-800', value: 'text-emerald-950', sub: 'text-emerald-700' },
    blue: { label: 'text-blue-800', value: 'text-blue-950', sub: 'text-blue-700' },
    violet: { label: 'text-violet-800', value: 'text-violet-950', sub: 'text-violet-700' },
    cyan: { label: 'text-cyan-800', value: 'text-cyan-950', sub: 'text-cyan-700' },
    rose: { label: 'text-rose-800', value: 'text-rose-950', sub: 'text-rose-700' },
    amber: { label: 'text-amber-800', value: 'text-amber-950', sub: 'text-amber-700' },
  };

  /* ───────── filters ───────── */
  const applyFilters = (list: Prescription[]) => list.filter(r => {
    if (search) {
      const s = search.toLowerCase();
      const pName = r.pharmacy_patients?.full_name?.toLowerCase() || '';
      if (!r.prescription_no?.toLowerCase().includes(s) && !pName.includes(s) && !r.prescriber_name?.toLowerCase().includes(s)) return false;
    }
    if (filterStatus && r.status !== filterStatus) return false;
    if (filterControlled === 'Yes' && !r.is_controlled) return false;
    if (filterControlled === 'No' && r.is_controlled) return false;
    if (filterPrescriber && !r.prescriber_name?.toLowerCase().includes(filterPrescriber.toLowerCase())) return false;
    if (filterDateFrom && r.prescription_date < filterDateFrom) return false;
    if (filterDateTo && r.prescription_date > filterDateTo) return false;
    return true;
  });

  const filtered = applyFilters(prescriptions);
  const pendingList = applyFilters(prescriptions.filter(r => r.status === 'Pending'));
  const queueList = applyFilters(prescriptions.filter(r => r.status === 'Pending' || r.status === 'Partially Dispensed'));
  const controlledList = applyFilters(prescriptions.filter(r => r.is_controlled));
  const expiredList = applyFilters(prescriptions.filter(r => r.status === 'Expired' || r.status === 'Cancelled' || (r.expiry_date && new Date(r.expiry_date) < now)));

  const getTabData = () => {
    switch (activeTab) {
      case 'Pending': return pendingList;
      case 'Dispensing Queue': return queueList;
      case 'Controlled': return controlledList;
      case 'Expired/Archive': return expiredList;
      default: return filtered;
    }
  };

  const tableData = getTabData();

  /* ───────── CRUD ───────── */
  const generateRxNo = () => `RX-${Date.now().toString(36).toUpperCase()}`;

  const saveRx = async () => {
    if (!rxForm.patient_id) { toast.error('Select a patient'); return; }
    if (!rxForm.prescriber_name) { toast.error('Enter prescriber name'); return; }
    if (rxItems.some(it => !it.drug_name)) { toast.error('All items need a drug name'); return; }
    try {
      const rxNo = generateRxNo();
      const expiryDate = new Date(rxForm.prescription_date);
      expiryDate.setMonth(expiryDate.getMonth() + 6);
      const { data: newRx, error } = await supabase.from('pharmacy_prescriptions').insert({
        outlet_id: outletId,
        patient_id: rxForm.patient_id,
        prescription_no: rxNo,
        prescriber_name: rxForm.prescriber_name,
        prescriber_reg_no: rxForm.prescriber_reg_no,
        prescriber_facility: rxForm.prescriber_facility,
        prescriber_phone: rxForm.prescriber_phone,
        diagnosis: rxForm.diagnosis,
        prescription_date: rxForm.prescription_date,
        expiry_date: expiryDate.toISOString().split('T')[0],
        status: 'Pending',
        is_controlled: rxForm.is_controlled,
        notes: rxForm.notes,
      }).select().single();
      if (error) throw error;
      // Insert items
      const itemsToInsert = rxItems.filter(it => it.drug_name).map(it => ({
        prescription_id: (newRx as any).prescription_id,
        drug_name: it.drug_name,
        dosage: it.dosage,
        frequency: it.frequency,
        duration: it.duration,
        quantity_prescribed: it.quantity_prescribed || 0,
        quantity_dispensed: 0,
        instructions: it.instructions,
        substitution_allowed: it.substitution_allowed ?? true,
        status: 'Pending',
      }));
      if (itemsToInsert.length > 0) {
        await supabase.from('pharmacy_prescription_items').insert(itemsToInsert);
      }
      toast.success(`Prescription ${rxNo} created`);
      setShowNewModal(false);
      setRxForm(emptyRxForm());
      setRxItems([emptyItem()]);
      loadData();
    } catch (e) { toast.error('Failed to save prescription'); console.error(e); }
  };

  const verifyRx = async (rx: Prescription) => {
    try {
      await supabase.from('pharmacy_prescriptions').update({
        verified_by: 'Current Pharmacist',
        verification_date: new Date().toISOString(),
      }).eq('prescription_id', rx.prescription_id);
      toast.success(`Rx ${rx.prescription_no} verified`);
      loadData();
    } catch { toast.error('Verification failed'); }
  };

  const dispenseRx = async (rx: Prescription) => {
    try {
      const rxItems_local = items.filter(it => it.prescription_id === rx.prescription_id);
      // Mark all items fully dispensed
      for (const it of rxItems_local) {
        await supabase.from('pharmacy_prescription_items').update({
          quantity_dispensed: it.quantity_prescribed,
          status: 'Dispensed',
        }).eq('item_id', it.item_id);
      }
      await supabase.from('pharmacy_prescriptions').update({
        status: 'Fully Dispensed',
        dispensed_by: 'Current Pharmacist',
      }).eq('prescription_id', rx.prescription_id);
      toast.success(`Rx ${rx.prescription_no} dispensed`);
      loadData();
    } catch { toast.error('Dispensing failed'); }
  };

  const cancelRx = async (id: string) => {
    if (!confirm('Cancel this prescription?')) return;
    await supabase.from('pharmacy_prescriptions').update({ status: 'Cancelled' }).eq('prescription_id', id);
    toast.success('Prescription cancelled');
    loadData();
  };

  const openRxDetail = (rx: Prescription) => {
    setSelectedRx(rx);
    setSelectedItems(items.filter(it => it.prescription_id === rx.prescription_id));
    setShowViewModal(true);
  };

  const addItem = () => setRxItems([...rxItems, emptyItem()]);
  const removeItem = (idx: number) => { if (rxItems.length > 1) setRxItems(rxItems.filter((_, i) => i !== idx)); };
  const updateItem = (idx: number, field: string, value: any) => {
    const updated = [...rxItems];
    (updated[idx] as any)[field] = value;
    setRxItems(updated);
  };

  const filteredPatients = patients.filter(p => {
    if (!patientSearch) return true;
    const s = patientSearch.toLowerCase();
    return p.full_name.toLowerCase().includes(s) || p.phone?.includes(s) || p.id_number?.toLowerCase().includes(s);
  });

  /* ───────── export ───────── */
  const exportExcel = () => {
    let xml = '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>';
    xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">';
    xml += '<Worksheet ss:Name="Prescriptions"><Table>';
    xml += '<Row><Cell><Data ss:Type="String">Rx#</Data></Cell><Cell><Data ss:Type="String">Date</Data></Cell><Cell><Data ss:Type="String">Patient</Data></Cell><Cell><Data ss:Type="String">Prescriber</Data></Cell><Cell><Data ss:Type="String">Facility</Data></Cell><Cell><Data ss:Type="String">Diagnosis</Data></Cell><Cell><Data ss:Type="String">Status</Data></Cell><Cell><Data ss:Type="String">Controlled</Data></Cell><Cell><Data ss:Type="String">Verified By</Data></Cell></Row>';
    tableData.forEach(r => {
      xml += `<Row><Cell><Data ss:Type="String">${r.prescription_no || ''}</Data></Cell><Cell><Data ss:Type="String">${r.prescription_date || ''}</Data></Cell><Cell><Data ss:Type="String">${r.pharmacy_patients?.full_name || ''}</Data></Cell><Cell><Data ss:Type="String">${r.prescriber_name || ''}</Data></Cell><Cell><Data ss:Type="String">${r.prescriber_facility || ''}</Data></Cell><Cell><Data ss:Type="String">${r.diagnosis || ''}</Data></Cell><Cell><Data ss:Type="String">${r.status}</Data></Cell><Cell><Data ss:Type="String">${r.is_controlled ? 'Yes' : 'No'}</Data></Cell><Cell><Data ss:Type="String">${r.verified_by || ''}</Data></Cell></Row>`;
    });
    xml += '</Table></Worksheet></Workbook>';
    const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'prescriptions.xls'; a.click();
  };

  const handlePrint = () => window.print();

  /* ───────── retention calc ───────── */
  const retentionDate = (dateStr: string) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    d.setFullYear(d.getFullYear() + 5);
    return d.toLocaleDateString();
  };

  /* ───────── render ───────── */
  if (loading) return (
    <div className="w-full max-w-full space-y-3.5 px-1 md:px-2 text-gray-900" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3">
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 w-10 h-10 rounded-xl flex items-center justify-center text-white animate-pulse">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
        </div>
        <div><p className="text-xl font-bold text-gray-900 tracking-tight">Prescription Management</p><p className="text-xs text-gray-500 mt-0.5 font-medium">Loading prescriptions...</p></div>
      </div>
      <div className="grid grid-cols-4 gap-3">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}</div>
    </div>
  );

  return (
    <div className="w-full max-w-full space-y-3.5 px-1 md:px-2 text-gray-900" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* HEADER */}
      <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 w-10 h-10 rounded-xl flex items-center justify-center text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Prescription Management</h1>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">Digital Rx Entry • Verification Workflow • 5-Year Retention • PPB Compliance</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handlePrint} className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-bold shadow-xs text-xs transition-colors">🖨️ Print</button>
          <button onClick={exportExcel} className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-bold shadow-xs text-xs transition-colors">📥 Export</button>
          <button onClick={() => { setRxForm(emptyRxForm()); setRxItems([emptyItem()]); setShowNewModal(true); }} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs text-xs transition-colors">+ New Prescription</button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-4 gap-3">
        {kpis.map((k, i) => (
          <div key={i} className={`bg-gradient-to-br ${colorMap[k.color]} p-3 rounded-xl shadow-xs`}>
            <div className="flex items-center justify-between">
              <p className={`text-[10px] font-bold ${textMap[k.color].label} uppercase tracking-wider`}>{k.label}</p>
              <span className="text-base">{k.icon}</span>
            </div>
            <p className={`text-lg font-black ${textMap[k.color].value} tracking-tight`}>{k.value}</p>
            <p className={`text-[10px] font-bold ${textMap[k.color].sub} mt-0.5`}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div className="bg-white p-1.5 rounded-xl border border-gray-200 shadow-xs flex gap-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setActiveTab(t)} className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${activeTab === t ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{t}
            {t === 'Pending' && pendingRx > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] bg-amber-200 text-amber-900 font-bold">{pendingRx}</span>}
            {t === 'Dispensing Queue' && queueList.length > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] bg-blue-200 text-blue-900 font-bold">{queueList.length}</span>}
            {t === 'Controlled' && controlledRx > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] bg-rose-200 text-rose-900 font-bold">{controlledRx}</span>}
          </button>
        ))}
      </div>

      {/* SEARCH & FILTERS */}
      <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Search</label>
            <input className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" placeholder="Rx#, patient name, prescriber..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Status</label>
            <select className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All</option>{STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Controlled</label>
            <select className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" value={filterControlled} onChange={e => setFilterControlled(e.target.value)}>
              <option value="">All</option><option>Yes</option><option>No</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Prescriber</label>
            <input className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" placeholder="Filter..." value={filterPrescriber} onChange={e => setFilterPrescriber(e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">From</label>
            <input type="date" className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">To</label>
            <input type="date" className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
          </div>
          {(search || filterStatus || filterControlled || filterPrescriber || filterDateFrom || filterDateTo) && (
            <button onClick={() => { setSearch(''); setFilterStatus(''); setFilterControlled(''); setFilterPrescriber(''); setFilterDateFrom(''); setFilterDateTo(''); }} className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold shadow-xs text-xs">Clear</button>
          )}
        </div>
      </div>

      {/* ─── DATA TABLE ─── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-gradient-to-r from-cyan-700 via-blue-700 to-indigo-800">
              {['Rx#','Date','Patient','Prescriber','Facility','Diagnosis','Items','Status','Controlled','Verified','Actions'].map(h => (
                <th key={h} className="px-2.5 py-2 text-left text-[10px] font-bold text-white uppercase tracking-wider">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {tableData.length === 0 && <tr><td colSpan={11} className="px-4 py-8 text-center text-xs text-gray-400">No prescriptions found</td></tr>}
              {tableData.map((r, i) => {
                const rxItemCount = items.filter(it => it.prescription_id === r.prescription_id).length;
                return (
                  <tr key={r.prescription_id} className={`border-b border-gray-100 hover:bg-emerald-50/40 transition-colors ${i % 2 === 0 ? 'bg-gray-50/30' : ''}`}>
                    <td className="px-2.5 py-1.5 text-xs font-bold text-blue-700 cursor-pointer hover:text-blue-900" onClick={() => openRxDetail(r)}>{r.prescription_no}</td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{r.prescription_date}</td>
                    <td className="px-2.5 py-1.5 text-xs font-bold text-gray-900">{r.pharmacy_patients?.full_name || '—'}</td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{r.prescriber_name}</td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-600">{r.prescriber_facility || '—'}</td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700 max-w-[150px] truncate">{r.diagnosis || '—'}</td>
                    <td className="px-2.5 py-1.5 text-xs font-bold text-gray-800">{rxItemCount}</td>
                    <td className="px-2.5 py-1.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColors[r.status] || 'bg-gray-100 text-gray-600'}`}>{r.status}</span></td>
                    <td className="px-2.5 py-1.5 text-center">
                      {r.is_controlled && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">🛡️ Yes</span>}
                    </td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{r.verified_by ? <span className="text-emerald-700">✔ {r.verified_by}</span> : <span className="text-amber-600">Unverified</span>}</td>
                    <td className="px-2.5 py-1.5">
                      <div className="flex gap-1 flex-wrap">
                        <button onClick={() => openRxDetail(r)} className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-[10px] font-bold hover:bg-blue-200">View</button>
                        {!r.verified_by && <button onClick={() => verifyRx(r)} className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold hover:bg-emerald-200">Verify</button>}
                        {(r.status === 'Pending' || r.status === 'Partially Dispensed') && <button onClick={() => dispenseRx(r)} className="px-2 py-0.5 bg-cyan-100 text-cyan-800 rounded text-[10px] font-bold hover:bg-cyan-200">Dispense</button>}
                        {r.status === 'Pending' && <button onClick={() => cancelRx(r.prescription_id)} className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded text-[10px] font-bold hover:bg-rose-200">Cancel</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="p-3 border-t border-gray-100 flex justify-between items-center">
          <p className="text-[10px] font-bold text-gray-500">Showing {tableData.length} prescriptions • Tab: {activeTab}</p>
          <p className="text-[9px] text-gray-400">PPB Kenya • 5-Year Retention Policy</p>
        </div>
      </div>

      {/* ═══════ NEW PRESCRIPTION MODAL ═══════ */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowNewModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">New Prescription</h2>
                <p className="text-[10px] text-gray-500">Digital Rx entry • All fields required for PPB compliance</p>
              </div>
              <button onClick={() => setShowNewModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto max-h-[70vh]">
              {/* Patient Selection */}
              <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Patient Selection</p>
                <input className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none mb-2" placeholder="Search patient by name, phone, ID..." value={patientSearch} onChange={e => setPatientSearch(e.target.value)} />
                {rxForm.patient_id && (
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">✓ {patients.find(p => p.patient_id === rxForm.patient_id)?.full_name}</span>
                    <button onClick={() => setRxForm({ ...rxForm, patient_id: '' })} className="text-[10px] text-rose-600 hover:text-rose-800 font-bold">Change</button>
                  </div>
                )}
                {!rxForm.patient_id && patientSearch && (
                  <div className="max-h-32 overflow-y-auto border border-gray-100 rounded-lg">
                    {filteredPatients.slice(0, 8).map(p => (
                      <button key={p.patient_id} onClick={() => { setRxForm({ ...rxForm, patient_id: p.patient_id }); setPatientSearch(''); }} className="w-full text-left px-2.5 py-1.5 hover:bg-emerald-50 text-xs font-semibold text-gray-700 border-b border-gray-50">
                        {p.full_name} — {p.phone} {p.id_number ? `(${p.id_number})` : ''}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Prescriber Info */}
              <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Prescriber Information</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Prescriber Name *</label><input className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" value={rxForm.prescriber_name} onChange={e => setRxForm({ ...rxForm, prescriber_name: e.target.value })} /></div>
                  <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Reg No</label><input className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" placeholder="KMPDC/PPB reg" value={rxForm.prescriber_reg_no} onChange={e => setRxForm({ ...rxForm, prescriber_reg_no: e.target.value })} /></div>
                  <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Facility</label><input className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" value={rxForm.prescriber_facility} onChange={e => setRxForm({ ...rxForm, prescriber_facility: e.target.value })} /></div>
                  <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Phone</label><input className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" value={rxForm.prescriber_phone} onChange={e => setRxForm({ ...rxForm, prescriber_phone: e.target.value })} /></div>
                </div>
              </div>

              {/* Diagnosis & Details */}
              <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Diagnosis & Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Diagnosis</label><input className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" value={rxForm.diagnosis} onChange={e => setRxForm({ ...rxForm, diagnosis: e.target.value })} /></div>
                  <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Prescription Date</label><input type="date" className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" value={rxForm.prescription_date} onChange={e => setRxForm({ ...rxForm, prescription_date: e.target.value })} /></div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <input type="checkbox" checked={rxForm.is_controlled} onChange={e => setRxForm({ ...rxForm, is_controlled: e.target.checked })} className="rounded border-gray-300 text-rose-600 focus:ring-rose-500" />
                  <label className="text-xs font-bold text-rose-700">🛡️ Controlled Substance Prescription</label>
                </div>
                <div className="mt-2"><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Notes</label><textarea rows={2} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" value={rxForm.notes} onChange={e => setRxForm({ ...rxForm, notes: e.target.value })} /></div>
              </div>

              {/* Prescription Items */}
              <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Prescription Items</p>
                  <button onClick={addItem} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs text-xs transition-colors">+ Add Item</button>
                </div>
                <div className="space-y-3">
                  {rxItems.map((item, idx) => (
                    <div key={idx} className="bg-gray-50/50 p-3 rounded-lg border border-gray-100 relative">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-gray-500">Item #{idx + 1}</span>
                        {rxItems.length > 1 && <button onClick={() => removeItem(idx)} className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded text-[10px] font-bold hover:bg-rose-200">Remove</button>}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Drug Name *</label><input className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" value={item.drug_name || ''} onChange={e => updateItem(idx, 'drug_name', e.target.value)} /></div>
                        <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Dosage</label><input className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" placeholder="e.g. 500mg" value={item.dosage || ''} onChange={e => updateItem(idx, 'dosage', e.target.value)} /></div>
                        <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Frequency</label>
                          <select className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" value={item.frequency || ''} onChange={e => updateItem(idx, 'frequency', e.target.value)}>
                            {FREQUENCIES.map(f => <option key={f}>{f}</option>)}
                          </select>
                        </div>
                        <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Duration</label><input className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" placeholder="e.g. 7 days" value={item.duration || ''} onChange={e => updateItem(idx, 'duration', e.target.value)} /></div>
                        <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Qty Prescribed</label><input type="number" className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" value={item.quantity_prescribed || ''} onChange={e => updateItem(idx, 'quantity_prescribed', parseInt(e.target.value) || 0)} /></div>
                        <div className="flex items-end pb-1">
                          <label className="flex items-center gap-1.5">
                            <input type="checkbox" checked={item.substitution_allowed ?? true} onChange={e => updateItem(idx, 'substitution_allowed', e.target.checked)} className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
                            <span className="text-[10px] font-bold text-gray-600">Substitution OK</span>
                          </label>
                        </div>
                      </div>
                      <div className="mt-2"><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Instructions</label><textarea rows={1} className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" placeholder="Special instructions for dispensing..." value={item.instructions || ''} onChange={e => updateItem(idx, 'instructions', e.target.value)} /></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-between items-center">
              <p className="text-[10px] text-gray-500">{rxItems.length} item(s) • {rxForm.is_controlled ? '🛡️ Controlled' : 'Standard Rx'}</p>
              <div className="flex gap-2">
                <button onClick={() => setShowNewModal(false)} className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-bold shadow-xs text-xs">Cancel</button>
                <button onClick={saveRx} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs text-xs transition-colors">Create Prescription</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ VIEW RX DETAIL MODAL ═══════ */}
      {showViewModal && selectedRx && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowViewModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold ${selectedRx.is_controlled ? 'bg-gradient-to-br from-rose-500 to-red-600' : 'bg-gradient-to-br from-blue-500 to-indigo-600'}`}>
                  {selectedRx.is_controlled ? '🛡️' : 'Rx'}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{selectedRx.prescription_no}</h2>
                  <p className="text-[10px] text-gray-500">
                    {selectedRx.prescription_date} • {selectedRx.pharmacy_patients?.full_name} •
                    <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColors[selectedRx.status]}`}>{selectedRx.status}</span>
                  </p>
                </div>
              </div>
              <button onClick={() => setShowViewModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-4 space-y-4">
              {/* Prescriber */}
              <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Prescriber Details</p>
                <div className="grid grid-cols-4 gap-3">
                  <div><p className="text-[10px] text-gray-500">Name</p><p className="text-xs font-bold text-gray-900">{selectedRx.prescriber_name}</p></div>
                  <div><p className="text-[10px] text-gray-500">Reg No</p><p className="text-xs font-bold text-gray-900">{selectedRx.prescriber_reg_no || '—'}</p></div>
                  <div><p className="text-[10px] text-gray-500">Facility</p><p className="text-xs font-bold text-gray-900">{selectedRx.prescriber_facility || '—'}</p></div>
                  <div><p className="text-[10px] text-gray-500">Phone</p><p className="text-xs font-bold text-gray-900">{selectedRx.prescriber_phone || '—'}</p></div>
                </div>
              </div>

              {/* Diagnosis & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Diagnosis</p>
                  <p className="text-xs font-bold text-gray-900">{selectedRx.diagnosis || '—'}</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Verification</p>
                  {selectedRx.verified_by ? (
                    <div><p className="text-xs font-bold text-emerald-700">✔ Verified by {selectedRx.verified_by}</p><p className="text-[10px] text-gray-500">{selectedRx.verification_date ? new Date(selectedRx.verification_date).toLocaleString() : ''}</p></div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-amber-700">⚠ Not Verified</p>
                      <button onClick={() => { verifyRx(selectedRx); setShowViewModal(false); }} className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold hover:bg-emerald-200">Verify Now</button>
                    </div>
                  )}
                </div>
              </div>

              {/* Controlled Warning */}
              {selectedRx.is_controlled && (
                <div className="bg-rose-50 p-3 rounded-xl border border-rose-200">
                  <p className="text-xs font-bold text-rose-800">🛡️ CONTROLLED SUBSTANCE PRESCRIPTION</p>
                  <p className="text-[10px] text-rose-600 mt-0.5">This prescription contains controlled substances. Enhanced record-keeping applies per PPB regulations.</p>
                </div>
              )}

              {/* Retention */}
              <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">📅 Record Retention</p>
                <div className="flex gap-4">
                  <div><p className="text-[10px] text-gray-500">Rx Date</p><p className="text-xs font-bold text-gray-900">{selectedRx.prescription_date}</p></div>
                  <div><p className="text-[10px] text-gray-500">Expiry Date</p><p className="text-xs font-bold text-gray-900">{selectedRx.expiry_date || '—'}</p></div>
                  <div><p className="text-[10px] text-gray-500">Retain Until</p><p className="text-xs font-bold text-blue-700">{retentionDate(selectedRx.prescription_date)}</p></div>
                </div>
              </div>

              {/* Items */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
                <div className="p-3 border-b border-gray-100">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Prescription Items ({selectedItems.length})</p>
                </div>
                <table className="w-full">
                  <thead><tr className="bg-gray-50">
                    {['Drug','Dosage','Frequency','Duration','Qty Rx','Qty Disp','Sub OK','Status'].map(h => (
                      <th key={h} className="px-2.5 py-1.5 text-left text-[10px] font-bold text-gray-600 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {selectedItems.length === 0 && <tr><td colSpan={8} className="px-4 py-4 text-center text-xs text-gray-400">No items</td></tr>}
                    {selectedItems.map((it, i) => (
                      <tr key={it.item_id} className={`border-b border-gray-50 ${i % 2 === 0 ? 'bg-gray-50/30' : ''}`}>
                        <td className="px-2.5 py-1.5 text-xs font-bold text-gray-900">{it.drug_name}</td>
                        <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{it.dosage || '—'}</td>
                        <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{it.frequency}</td>
                        <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{it.duration || '—'}</td>
                        <td className="px-2.5 py-1.5 text-xs font-bold text-gray-800">{it.quantity_prescribed}</td>
                        <td className="px-2.5 py-1.5 text-xs font-bold text-gray-800">{it.quantity_dispensed}</td>
                        <td className="px-2.5 py-1.5 text-xs">{it.substitution_allowed ? <span className="text-emerald-600 font-bold">✓</span> : <span className="text-rose-600 font-bold">✗</span>}</td>
                        <td className="px-2.5 py-1.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${it.status === 'Dispensed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{it.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Notes */}
              {selectedRx.notes && (
                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">📝 Notes</p>
                  <p className="text-xs text-gray-700">{selectedRx.notes}</p>
                </div>
              )}

              {/* Dispensing info */}
              {selectedRx.dispensed_by && (
                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">💊 Dispensed By</p>
                  <p className="text-xs font-bold text-gray-900">{selectedRx.dispensed_by}</p>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-between items-center">
              <div className="flex gap-2">
                {!selectedRx.verified_by && <button onClick={() => { verifyRx(selectedRx); setShowViewModal(false); }} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs text-xs transition-colors">Verify Rx</button>}
                {(selectedRx.status === 'Pending' || selectedRx.status === 'Partially Dispensed') && <button onClick={() => { dispenseRx(selectedRx); setShowViewModal(false); }} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs text-xs transition-colors">Dispense All</button>}
              </div>
              <button onClick={() => setShowViewModal(false)} className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-bold shadow-xs text-xs">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}