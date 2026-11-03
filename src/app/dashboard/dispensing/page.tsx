'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

/* ═══════════════════════════════════════════════════════════════
   DISPENSING WORKFLOW — Rx Processing, FEFO, Dosage Calculator
   ═══════════════════════════════════════════════════════════════ */

type Rx = { prescription_id: number; prescription_no: string; patient_id: number; prescriber_name: string; prescriber_reg_no: string; prescriber_facility: string; diagnosis: string; prescription_date: string; status: string; is_controlled: boolean; verified_by: string; created_at: string; patient_name?: string };
type RxItem = { item_id: number; prescription_id: number; drug_name: string; dosage: string; frequency: string; duration: string; quantity_prescribed: number; quantity_dispensed: number; instructions: string; substitution_allowed: boolean; status: string };
type DispLog = { dispensing_id: number; drug_name: string; batch_number: string; expiry_date: string; quantity_dispensed: number; dosage_instructions: string; dispensed_by: string; verified_by: string; verification_status: string; is_controlled: boolean; is_substituted: boolean; original_drug: string; substitution_reason: string; label_printed: boolean; created_at: string; patient_name?: string };
type Batch = { batch_id: number; product_id: number; batch_number: string; expiry_date: string; remaining_qty: number; cost_price: number };

const TABS = ['Dispensing Queue', 'Completed', 'Verification', 'Dosage Calculator', 'Label Generator'] as const;
const FREQUENCIES = ['OD (Once daily)', 'BD (Twice daily)', 'TDS (Three times daily)', 'QID (Four times daily)', 'PRN (As needed)', 'STAT (Immediately)', 'Nocte (At night)', 'Mane (Morning)', 'Q4H (Every 4 hours)', 'Q6H (Every 6 hours)', 'Q8H (Every 8 hours)', 'Weekly'];
const statusColor: Record<string, string> = { Pending: 'bg-amber-100 text-amber-800', 'Partially Dispensed': 'bg-blue-100 text-blue-800', 'Fully Dispensed': 'bg-emerald-100 text-emerald-800', Verified: 'bg-emerald-100 text-emerald-800', Rejected: 'bg-rose-100 text-rose-800' };

// Common pediatric dosing reference
const DOSE_REF = [
  { drug: 'Paracetamol', dose_per_kg: '10–15', unit: 'mg/kg/dose', max_daily: '60 mg/kg', freq: 'Q4-6H', notes: 'Max 4g/day adult' },
  { drug: 'Ibuprofen', dose_per_kg: '5–10', unit: 'mg/kg/dose', max_daily: '40 mg/kg', freq: 'Q6-8H', notes: 'Max 1.2g/day' },
  { drug: 'Amoxicillin', dose_per_kg: '25–50', unit: 'mg/kg/day', max_daily: '3g/day', freq: 'BD or TDS', notes: 'Divide into 2-3 doses' },
  { drug: 'Azithromycin', dose_per_kg: '10', unit: 'mg/kg/day', max_daily: '500mg', freq: 'OD', notes: 'Day 1: 10mg/kg, Day 2-5: 5mg/kg' },
  { drug: 'Cetirizine', dose_per_kg: '0.25', unit: 'mg/kg/dose', max_daily: '10mg', freq: 'OD', notes: '2-5y: 2.5mg, 6-11y: 5mg, ≥12y: 10mg' },
  { drug: 'Metronidazole', dose_per_kg: '7.5', unit: 'mg/kg/dose', max_daily: '4g/day', freq: 'TDS', notes: '7-10 day course typical' },
  { drug: 'Ciprofloxacin', dose_per_kg: '10–20', unit: 'mg/kg/day', max_daily: '1.5g/day', freq: 'BD', notes: 'Not recommended <18y unless necessary' },
  { drug: 'Diclofenac', dose_per_kg: '1–3', unit: 'mg/kg/day', max_daily: '150mg', freq: 'BD-TDS', notes: 'Divide into 2-3 doses' },
  { drug: 'Omeprazole', dose_per_kg: '0.7–1', unit: 'mg/kg/dose', max_daily: '20mg', freq: 'OD', notes: '10-20kg: 10mg, >20kg: 20mg' },
  { drug: 'Fluconazole', dose_per_kg: '3–12', unit: 'mg/kg/dose', max_daily: '400mg', freq: 'OD', notes: 'Loading: 6-12mg/kg Day 1' },
];

const fmt = (n: number) => n.toLocaleString('en-KE');

export default function DispensingPage() {
  const { activeOutlet } = useOutlet();
  const oid = activeOutlet?.outlet_id || 1;
  const [tab, setTab] = useState<typeof TABS[number]>('Dispensing Queue');
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<Rx[]>([]);
  const [dispLogs, setDispLogs] = useState<DispLog[]>([]);
  const [pendingVerify, setPendingVerify] = useState<DispLog[]>([]);
  const [search, setSearch] = useState('');
  const [showDispenseModal, setShowDispenseModal] = useState(false);
  const [selectedRx, setSelectedRx] = useState<Rx | null>(null);
  const [rxItems, setRxItems] = useState<RxItem[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  // Dosage calculator state
  const [calcWeight, setCalcWeight] = useState<number>(0);
  const [calcAge, setCalcAge] = useState<number>(0);
  const [calcDrug, setCalcDrug] = useState('');
  const [calcStrength, setCalcStrength] = useState<number>(0);
  const [calcDosePerKg, setCalcDosePerKg] = useState<number>(10);
  // Label generator state
  const [label, setLabel] = useState({ patientName: '', drugName: '', dosage: '', frequency: '', duration: '', instructions: '', pharmacist: '', date: new Date().toISOString().split('T')[0] });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [q, d] = await Promise.all([
        supabase.from('pharmacy_prescriptions').select('*').eq('outlet_id', oid).in('status', ['Pending', 'Partially Dispensed']).order('created_at', { ascending: false }),
        supabase.from('pharmacy_dispensing_log').select('*').eq('outlet_id', oid).order('created_at', { ascending: false }).limit(200),
      ]);
      // Enrich with patient names
      const rxData = (q.data || []) as Rx[];
      if (rxData.length > 0) {
        const patientIds = Array.from(new Set(rxData.map(r => r.patient_id).filter(Boolean)));
        if (patientIds.length > 0) {
          const { data: patients } = await supabase.from('pharmacy_patients').select('patient_id, full_name').in('patient_id', patientIds);
          const pMap = new Map((patients || []).map((p: any) => [p.patient_id, p.full_name]));
          rxData.forEach(r => { r.patient_name = pMap.get(r.patient_id) || 'Unknown'; });
        }
      }
      setQueue(rxData);
      const logs = (d.data || []) as DispLog[];
      setDispLogs(logs);
      setPendingVerify(logs.filter(l => l.verification_status === 'Pending'));
    } catch { toast.error('Failed to load'); }
    setLoading(false);
  }, [oid]);

  useEffect(() => { load(); }, [load]);

  // Open dispense modal
  const openDispense = async (rx: Rx) => {
    setSelectedRx(rx);
    const { data: items } = await supabase.from('pharmacy_prescription_items').select('*').eq('prescription_id', rx.prescription_id);
    setRxItems((items || []) as RxItem[]);
    const { data: b } = await supabase.from('pharmacy_batches').select('*').eq('outlet_id', oid).gt('remaining_qty', 0).order('expiry_date', { ascending: true });
    setBatches((b || []) as Batch[]);
    setShowDispenseModal(true);
  };

  // Dispense action
  const dispenseItem = async (item: RxItem, qty: number, batchNum: string, batchExpiry: string, instructions: string) => {
    if (qty <= 0) return;
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const { error } = await supabase.from('pharmacy_dispensing_log').insert({
      outlet_id: oid, prescription_id: selectedRx?.prescription_id, patient_id: selectedRx?.patient_id,
      drug_name: item.drug_name, batch_number: batchNum, expiry_date: batchExpiry || null,
      quantity_dispensed: qty, dosage_instructions: instructions || item.instructions,
      dispensed_by: user.name || 'Staff', verification_status: 'Pending',
      is_controlled: selectedRx?.is_controlled || false, is_substituted: false,
    });
    if (error) { toast.error('Dispense failed'); return; }
    // Update prescription item
    const newQty = (item.quantity_dispensed || 0) + qty;
    await supabase.from('pharmacy_prescription_items').update({ quantity_dispensed: newQty, status: newQty >= item.quantity_prescribed ? 'Dispensed' : 'Partial' }).eq('item_id', item.item_id);
    toast.success(`Dispensed ${qty}x ${item.drug_name}`);
  };

  // Verify dispensed item
  const verifyItem = async (id: number, status: 'Verified' | 'Rejected') => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    await supabase.from('pharmacy_dispensing_log').update({ verification_status: status, verified_by: user.name || 'Pharmacist' }).eq('dispensing_id', id);
    toast.success(status === 'Verified' ? 'Verified ✓' : 'Rejected');
    load();
  };

  // Filter
  const filteredQueue = useMemo(() => queue.filter(r => {
    if (!search) return true;
    const s = search.toLowerCase();
    return r.prescription_no.toLowerCase().includes(s) || (r.patient_name || '').toLowerCase().includes(s) || r.prescriber_name.toLowerCase().includes(s);
  }), [queue, search]);

  const filteredLogs = useMemo(() => dispLogs.filter(d => {
    if (!search) return true;
    const s = search.toLowerCase();
    return d.drug_name.toLowerCase().includes(s) || (d.dispensed_by || '').toLowerCase().includes(s);
  }), [dispLogs, search]);

  const kpis = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayLogs = dispLogs.filter(d => d.created_at?.startsWith(today));
    return {
      queueSize: queue.length,
      todayDispensed: todayLogs.length,
      pendingVerify: pendingVerify.length,
      verified: dispLogs.filter(d => d.verification_status === 'Verified').length,
      controlled: dispLogs.filter(d => d.is_controlled).length,
      substitutions: dispLogs.filter(d => d.is_substituted).length,
      totalDispensed: dispLogs.length,
      labelsPrinted: dispLogs.filter(d => d.label_printed).length,
    };
  }, [queue, dispLogs, pendingVerify]);

  const kpiCards = [
    { label: 'Dispensing Queue', value: kpis.queueSize, sub: 'Pending Rx', color: 'amber', color2: 'orange' },
    { label: 'Dispensed Today', value: kpis.todayDispensed, sub: 'Items today', color: 'emerald', color2: 'teal' },
    { label: 'Pending Verification', value: kpis.pendingVerify, sub: 'Awaiting pharmacist', color: 'blue', color2: 'indigo' },
    { label: 'Verified', value: kpis.verified, sub: 'Pharmacist approved', color: 'green', color2: 'emerald' },
    { label: 'Controlled Dispensed', value: kpis.controlled, sub: 'Schedule drugs', color: 'violet', color2: 'purple' },
    { label: 'Substitutions', value: kpis.substitutions, sub: 'Generic swaps', color: 'cyan', color2: 'sky' },
    { label: 'Total Dispensed', value: fmt(kpis.totalDispensed), sub: 'All time', color: 'rose', color2: 'pink' },
    { label: 'Labels Printed', value: kpis.labelsPrinted, sub: 'Generated', color: 'orange', color2: 'amber' },
  ];

  // Calculate dose
  const calculatedDose = useMemo(() => {
    if (!calcWeight || !calcDosePerKg) return null;
    const dosePerDose = calcWeight * calcDosePerKg;
    const tabletCount = calcStrength > 0 ? dosePerDose / calcStrength : 0;
    return { dosePerDose: dosePerDose.toFixed(1), tabletCount: tabletCount.toFixed(2) };
  }, [calcWeight, calcDosePerKg, calcStrength]);

  // Print label
  const printLabel = () => {
    const w = window.open('', '_blank', 'width=400,height=300');
    if (!w) return;
    w.document.write(`<html><head><title>Label</title><style>body{font-family:Arial;font-size:11px;padding:10px;width:280px}h3{margin:0 0 4px;font-size:13px;border-bottom:1px solid #000;padding-bottom:3px}.row{display:flex;justify-content:space-between;margin:2px 0}.bold{font-weight:bold}.sm{font-size:9px;color:#555}</style></head><body>`);
    w.document.write(`<h3>💊 Alpha Pharmacy</h3>`);
    w.document.write(`<div class="row"><span class="bold">Patient:</span><span>${label.patientName}</span></div>`);
    w.document.write(`<div class="row"><span class="bold">Medication:</span><span>${label.drugName}</span></div>`);
    w.document.write(`<div class="row"><span class="bold">Dosage:</span><span>${label.dosage}</span></div>`);
    w.document.write(`<div class="row"><span class="bold">Frequency:</span><span>${label.frequency}</span></div>`);
    w.document.write(`<div class="row"><span class="bold">Duration:</span><span>${label.duration}</span></div>`);
    if (label.instructions) w.document.write(`<div style="margin-top:4px;padding:4px;border:1px solid #ccc;font-size:10px"><strong>Instructions:</strong> ${label.instructions}</div>`);
    w.document.write(`<div class="row sm" style="margin-top:6px"><span>Pharmacist: ${label.pharmacist}</span><span>Date: ${label.date}</span></div>`);
    w.document.write(`<div class="sm" style="text-align:center;margin-top:4px">Keep out of reach of children</div>`);
    w.document.write(`</body></html>`);
    w.document.close();
    w.print();
  };

  return (
    <div className="w-full max-w-full space-y-3.5 px-1 md:px-2 text-gray-900" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-violet-500 to-purple-600 w-10 h-10 rounded-xl flex items-center justify-center text-white shadow">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 3h15"/><path d="M6 3v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V3"/><path d="M6 14h12"/></svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Dispensing Workflow</h1>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">Prescription Processing • FEFO Enforcement • Dosage Calculator • Label Printing</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => window.print()} className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-bold shadow-xs text-xs">🖨️ Print</button>
          <button onClick={load} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs text-xs">↻ Refresh</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {kpiCards.map((c, i) => (
          <div key={i} className={`bg-gradient-to-br from-${c.color}-50/80 via-${c.color2}-50/40 to-white p-3 rounded-xl border border-${c.color}-200/80 shadow-xs`}>
            <p className={`text-[10px] font-bold text-${c.color}-800 uppercase tracking-wider`}>{c.label}</p>
            <p className={`text-lg font-black text-${c.color}-950 tracking-tight`}>{c.value}</p>
            <p className={`text-[10px] font-bold text-${c.color}-700 mt-0.5`}>{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Tabs + Search */}
      <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5 flex-wrap">
          {TABS.map(t => (
            <button key={t} onClick={() => { setTab(t); setSearch(''); }} className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${tab === t ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
              {t}{t === 'Verification' && pendingVerify.length > 0 ? ` (${pendingVerify.length})` : ''}{t === 'Dispensing Queue' && queue.length > 0 ? ` (${queue.length})` : ''}
            </button>
          ))}
        </div>
        {(tab === 'Dispensing Queue' || tab === 'Completed') && (
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 w-48 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" />
        )}
      </div>

      {loading ? <div className="text-center py-10 text-gray-400 font-bold">Loading...</div> : (
        <>
          {/* ═══ Dispensing Queue ═══ */}
          {tab === 'Dispensing Queue' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="bg-gradient-to-r from-violet-700 via-purple-700 to-indigo-800">
                    {['Rx #','Date','Patient','Prescriber','Facility','Diagnosis','Status','Controlled','Actions'].map(h => (
                      <th key={h} className="px-2.5 py-2 text-left text-[10px] font-bold text-white uppercase tracking-wider">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {filteredQueue.length === 0 ? <tr><td colSpan={9} className="text-center py-8 text-gray-400 text-sm font-semibold">No prescriptions in queue</td></tr> :
                    filteredQueue.map((rx, i) => (
                      <tr key={rx.prescription_id} className={`border-b border-gray-100 hover:bg-violet-50/40 transition-colors ${i % 2 ? 'bg-gray-50/30' : ''}`}>
                        <td className="px-2.5 py-1.5 text-xs font-bold text-violet-700">{rx.prescription_no}</td>
                        <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-800">{rx.prescription_date}</td>
                        <td className="px-2.5 py-1.5 text-xs font-bold text-gray-900">{rx.patient_name || '—'}</td>
                        <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{rx.prescriber_name}</td>
                        <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-600">{rx.prescriber_facility || '—'}</td>
                        <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-600 max-w-[150px] truncate">{rx.diagnosis || '—'}</td>
                        <td className="px-2.5 py-1.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColor[rx.status] || 'bg-gray-100 text-gray-800'}`}>{rx.status}</span></td>
                        <td className="px-2.5 py-1.5">{rx.is_controlled && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">🛡️ S-Drug</span>}</td>
                        <td className="px-2.5 py-1.5"><button onClick={() => openDispense(rx)} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold">Dispense →</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ═══ Completed ═══ */}
          {tab === 'Completed' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="bg-gradient-to-r from-cyan-700 via-blue-700 to-indigo-800">
                    {['Date','Drug','Batch','Expiry','Qty','Instructions','Dispensed By','Verified','Status','Controlled','Substituted'].map(h => (
                      <th key={h} className="px-2.5 py-2 text-left text-[10px] font-bold text-white uppercase tracking-wider">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {filteredLogs.length === 0 ? <tr><td colSpan={11} className="text-center py-8 text-gray-400 text-sm font-semibold">No dispensing records</td></tr> :
                    filteredLogs.map((d, i) => (
                      <tr key={d.dispensing_id} className={`border-b border-gray-100 hover:bg-blue-50/40 transition-colors ${i % 2 ? 'bg-gray-50/30' : ''}`}>
                        <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-800">{new Date(d.created_at).toLocaleDateString()}</td>
                        <td className="px-2.5 py-1.5 text-xs font-bold text-gray-900">{d.drug_name}</td>
                        <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-600">{d.batch_number || '—'}</td>
                        <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-600">{d.expiry_date || '—'}</td>
                        <td className="px-2.5 py-1.5 text-xs font-bold text-gray-900">{d.quantity_dispensed}</td>
                        <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-600 max-w-[150px] truncate">{d.dosage_instructions || '—'}</td>
                        <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{d.dispensed_by}</td>
                        <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-600">{d.verified_by || '—'}</td>
                        <td className="px-2.5 py-1.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColor[d.verification_status] || 'bg-gray-100 text-gray-800'}`}>{d.verification_status}</span></td>
                        <td className="px-2.5 py-1.5">{d.is_controlled && <span className="text-rose-600 font-bold text-[10px]">🛡️</span>}</td>
                        <td className="px-2.5 py-1.5">{d.is_substituted && <span className="text-amber-600 font-bold text-[10px]">↔</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 text-[10px] font-bold text-gray-500">Showing {filteredLogs.length} records</div>
            </div>
          )}

          {/* ═══ Verification ═══ */}
          {tab === 'Verification' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="px-3 py-2 bg-amber-50 border-b border-amber-200"><p className="text-xs font-bold text-amber-800">⚠️ {pendingVerify.length} items awaiting pharmacist verification</p></div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="bg-gradient-to-r from-amber-600 via-orange-600 to-red-700">
                    {['Date','Drug','Qty','Batch','Instructions','Dispensed By','Actions'].map(h => (
                      <th key={h} className="px-2.5 py-2 text-left text-[10px] font-bold text-white uppercase tracking-wider">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {pendingVerify.length === 0 ? <tr><td colSpan={7} className="text-center py-8 text-emerald-600 text-sm font-semibold">✓ All items verified</td></tr> :
                    pendingVerify.map((d, i) => (
                      <tr key={d.dispensing_id} className={`border-b border-gray-100 hover:bg-amber-50/40 transition-colors ${i % 2 ? 'bg-gray-50/30' : ''}`}>
                        <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-800">{new Date(d.created_at).toLocaleDateString()}</td>
                        <td className="px-2.5 py-1.5 text-xs font-bold text-gray-900">{d.drug_name}</td>
                        <td className="px-2.5 py-1.5 text-xs font-bold text-gray-900">{d.quantity_dispensed}</td>
                        <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-600">{d.batch_number || '—'}</td>
                        <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-600 max-w-[200px]">{d.dosage_instructions || '—'}</td>
                        <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{d.dispensed_by}</td>
                        <td className="px-2.5 py-1.5">
                          <div className="flex gap-1">
                            <button onClick={() => verifyItem(d.dispensing_id, 'Verified')} className="px-2.5 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold">✓ Verify</button>
                            <button onClick={() => verifyItem(d.dispensing_id, 'Rejected')} className="px-2.5 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold">✗ Reject</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ═══ Dosage Calculator ═══ */}
          {tab === 'Dosage Calculator' && (
            <div className="space-y-3">
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                <h3 className="text-sm font-bold text-gray-900 mb-3">💊 Pediatric & Adult Dosage Calculator</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Patient Weight (kg)</label><input type="number" value={calcWeight || ''} onChange={e => setCalcWeight(+e.target.value)} placeholder="e.g. 25" className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 outline-none" /></div>
                  <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Patient Age (years)</label><input type="number" value={calcAge || ''} onChange={e => setCalcAge(+e.target.value)} placeholder="e.g. 8" className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 outline-none" /></div>
                  <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Drug Name</label><input value={calcDrug} onChange={e => setCalcDrug(e.target.value)} placeholder="e.g. Paracetamol" className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 outline-none" /></div>
                  <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Dose (mg/kg)</label><input type="number" value={calcDosePerKg || ''} onChange={e => setCalcDosePerKg(+e.target.value)} placeholder="10" className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 outline-none" /></div>
                  <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Tablet Strength (mg)</label><input type="number" value={calcStrength || ''} onChange={e => setCalcStrength(+e.target.value)} placeholder="500" className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 outline-none" /></div>
                </div>
                {calculatedDose && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="bg-gradient-to-br from-emerald-50/80 via-teal-50/40 to-white p-3 rounded-xl border border-emerald-200/80 shadow-xs">
                      <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Calculated Dose Per Dose</p>
                      <p className="text-lg font-black text-emerald-950 tracking-tight">{calculatedDose.dosePerDose} mg</p>
                      <p className="text-[10px] font-bold text-emerald-700 mt-0.5">{calcWeight}kg × {calcDosePerKg}mg/kg</p>
                    </div>
                    {calcStrength > 0 && (
                      <div className="bg-gradient-to-br from-blue-50/80 via-indigo-50/40 to-white p-3 rounded-xl border border-blue-200/80 shadow-xs">
                        <p className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">Tablets/Capsules Per Dose</p>
                        <p className="text-lg font-black text-blue-950 tracking-tight">{calculatedDose.tabletCount}</p>
                        <p className="text-[10px] font-bold text-blue-700 mt-0.5">{calculatedDose.dosePerDose}mg ÷ {calcStrength}mg</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {/* Reference table */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
                <div className="px-3 py-2 bg-gradient-to-r from-cyan-700 via-blue-700 to-indigo-800"><p className="text-[10px] font-bold text-white uppercase tracking-wider">📋 Common Pediatric Dosing Reference</p></div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead><tr className="bg-gray-50 border-b border-gray-200">
                      {['Drug','Dose','Unit','Max Daily','Frequency','Notes'].map(h => <th key={h} className="px-2.5 py-2 text-left text-[10px] font-bold text-gray-600 uppercase tracking-wider">{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {DOSE_REF.map((d, i) => (
                        <tr key={i} className={`border-b border-gray-100 hover:bg-blue-50/40 ${i % 2 ? 'bg-gray-50/30' : ''}`}>
                          <td className="px-2.5 py-1.5 text-xs font-bold text-gray-900">{d.drug}</td>
                          <td className="px-2.5 py-1.5 text-xs font-bold text-emerald-700">{d.dose_per_kg}</td>
                          <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-600">{d.unit}</td>
                          <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{d.max_daily}</td>
                          <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{d.freq}</td>
                          <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-500">{d.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ═══ Label Generator ═══ */}
          {tab === 'Label Generator' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3">
                <h3 className="text-sm font-bold text-gray-900">🏷️ Medication Label Generator</h3>
                <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Patient Name</label><input value={label.patientName} onChange={e => setLabel({ ...label, patientName: e.target.value })} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700" /></div>
                <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Drug Name</label><input value={label.drugName} onChange={e => setLabel({ ...label, drugName: e.target.value })} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Dosage</label><input value={label.dosage} onChange={e => setLabel({ ...label, dosage: e.target.value })} placeholder="e.g. 500mg" className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700" /></div>
                  <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Frequency</label><select value={label.frequency} onChange={e => setLabel({ ...label, frequency: e.target.value })} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700"><option value="">Select...</option>{FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}</select></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Duration</label><input value={label.duration} onChange={e => setLabel({ ...label, duration: e.target.value })} placeholder="e.g. 5 days" className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700" /></div>
                  <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Pharmacist</label><input value={label.pharmacist} onChange={e => setLabel({ ...label, pharmacist: e.target.value })} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700" /></div>
                </div>
                <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Special Instructions</label><textarea value={label.instructions} onChange={e => setLabel({ ...label, instructions: e.target.value })} rows={2} placeholder="Take with food, avoid alcohol..." className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700" /></div>
                <button onClick={printLabel} className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs text-sm">🖨️ Print Label</button>
              </div>
              {/* Label Preview */}
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                <h3 className="text-sm font-bold text-gray-900 mb-3">Preview</h3>
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 bg-gray-50 max-w-[320px]">
                  <div className="border-b border-gray-400 pb-1 mb-2"><p className="text-sm font-black text-gray-900">💊 Alpha Pharmacy</p></div>
                  <div className="space-y-1">
                    <div className="flex justify-between"><span className="text-[10px] font-bold text-gray-600">Patient:</span><span className="text-[10px] font-semibold text-gray-900">{label.patientName || '—'}</span></div>
                    <div className="flex justify-between"><span className="text-[10px] font-bold text-gray-600">Medication:</span><span className="text-[10px] font-semibold text-gray-900">{label.drugName || '—'}</span></div>
                    <div className="flex justify-between"><span className="text-[10px] font-bold text-gray-600">Dosage:</span><span className="text-[10px] font-semibold text-gray-900">{label.dosage || '—'}</span></div>
                    <div className="flex justify-between"><span className="text-[10px] font-bold text-gray-600">Frequency:</span><span className="text-[10px] font-semibold text-gray-900">{label.frequency || '—'}</span></div>
                    <div className="flex justify-between"><span className="text-[10px] font-bold text-gray-600">Duration:</span><span className="text-[10px] font-semibold text-gray-900">{label.duration || '—'}</span></div>
                  </div>
                  {label.instructions && <div className="mt-2 p-1.5 bg-white border border-gray-300 rounded text-[9px] text-gray-700"><strong>Instructions:</strong> {label.instructions}</div>}
                  <div className="mt-2 pt-1 border-t border-gray-300 flex justify-between text-[9px] text-gray-500">
                    <span>Pharm: {label.pharmacist || '—'}</span><span>{label.date}</span>
                  </div>
                  <p className="text-center text-[8px] text-gray-400 mt-1">Keep out of reach of children</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══ Dispense Modal ═══ */}
      {showDispenseModal && selectedRx && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowDispenseModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Dispense: {selectedRx.prescription_no}</h2>
                  <p className="text-xs text-gray-500">Patient: {selectedRx.patient_name} | Prescriber: {selectedRx.prescriber_name} ({selectedRx.prescriber_reg_no})</p>
                </div>
                {selectedRx.is_controlled && <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">🛡️ Controlled Substance</span>}
              </div>
            </div>
            <div className="p-4">
              {rxItems.length === 0 ? <p className="text-gray-400 text-sm text-center py-4">No prescription items found</p> :
              <div className="space-y-3">
                {rxItems.map(item => {
                  const remaining = item.quantity_prescribed - (item.quantity_dispensed || 0);
                  return (
                    <div key={item.item_id} className={`p-3 rounded-xl border ${remaining <= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-sm font-bold text-gray-900">{item.drug_name}</p>
                          <p className="text-[10px] text-gray-500">{item.dosage} | {item.frequency} | {item.duration}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-gray-900">Prescribed: {item.quantity_prescribed}</p>
                          <p className="text-[10px] text-gray-500">Dispensed: {item.quantity_dispensed || 0} | Remaining: {remaining}</p>
                        </div>
                      </div>
                      {remaining > 0 && (
                        <div className="grid grid-cols-4 gap-2 mt-2">
                          <div>
                            <label className="text-[10px] font-bold text-gray-600 uppercase block">Qty to Dispense</label>
                            <input type="number" id={`qty-${item.item_id}`} defaultValue={remaining} max={remaining} min={1} className="w-full px-2 py-1 bg-gray-50 border border-gray-200 rounded text-xs font-semibold" />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-gray-600 uppercase block">Batch (FEFO)</label>
                            <select id={`batch-${item.item_id}`} className="w-full px-2 py-1 bg-gray-50 border border-gray-200 rounded text-xs font-semibold">
                              <option value="">Select batch...</option>
                              {batches.map(b => <option key={b.batch_id} value={`${b.batch_number}|${b.expiry_date}`}>{b.batch_number} (Exp: {b.expiry_date}, Qty: {b.remaining_qty})</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-gray-600 uppercase block">Instructions</label>
                            <input id={`inst-${item.item_id}`} defaultValue={item.instructions || ''} className="w-full px-2 py-1 bg-gray-50 border border-gray-200 rounded text-xs font-semibold" />
                          </div>
                          <div className="flex items-end">
                            <button onClick={() => {
                              const qty = +(document.getElementById(`qty-${item.item_id}`) as HTMLInputElement)?.value || 0;
                              const batchVal = (document.getElementById(`batch-${item.item_id}`) as HTMLSelectElement)?.value || '';
                              const [bn, be] = batchVal.split('|');
                              const inst = (document.getElementById(`inst-${item.item_id}`) as HTMLInputElement)?.value || '';
                              dispenseItem(item, qty, bn || '', be || '', inst);
                            }} className="w-full px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold">Dispense</button>
                          </div>
                        </div>
                      )}
                      {remaining <= 0 && <p className="text-xs font-bold text-emerald-700 mt-1">✓ Fully dispensed</p>}
                    </div>
                  );
                })}
              </div>}
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end">
              <button onClick={() => { setShowDispenseModal(false); load(); }} className="px-4 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-bold shadow-xs text-xs">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
