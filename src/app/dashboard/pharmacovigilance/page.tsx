'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

/* ═══════════════════════════════════════════════════════════════
   PHARMACOVIGILANCE & DRUG SAFETY — PPB Compliance
   ADR Reporting • Drug Recalls • Drug Interactions
   ═══════════════════════════════════════════════════════════════ */

type ADR = { report_id: number; outlet_id: number; report_no: string; patient_name: string; patient_age: number; patient_gender: string; patient_weight: number; reaction_date: string; report_date: string; suspected_drug: string; batch_number: string; manufacturer: string; indication: string; reaction_description: string; severity: string; outcome: string; action_taken: string; rechallenge: string; concomitant_drugs: string; reporter_name: string; reporter_designation: string; ppb_submitted: boolean; ppb_submission_date: string; ppb_reference: string; status: string; created_by: string; created_at: string };
type Recall = { recall_id: number; outlet_id: number; drug_name: string; batch_numbers: string[]; manufacturer: string; recall_class: string; recall_reason: string; recall_date: string; ppb_notice_no: string; quantity_in_stock: number; quantity_quarantined: number; quantity_returned: number; status: string; action_taken: string; resolved_date: string; created_at: string };
type Interaction = { interaction_id: number; drug_a: string; drug_b: string; severity: string; description: string; mechanism: string; clinical_effect: string; management: string; reference_source: string };

const TABS = ['ADR Reports', 'Drug Recalls', 'Drug Interactions', 'Interaction Checker'] as const;
const SEVERITIES = ['Mild', 'Moderate', 'Severe', 'Fatal'] as const;
const OUTCOMES = ['Recovered', 'Recovering', 'Not Recovered', 'Fatal', 'Unknown'] as const;
const RECALL_CLASSES = ['Class I', 'Class II', 'Class III'] as const;
const RECALL_STATUSES = ['Active', 'Quarantined', 'Returned', 'Resolved'] as const;
const sevColor: Record<string, string> = { Mild: 'bg-blue-100 text-blue-800', Moderate: 'bg-amber-100 text-amber-800', Severe: 'bg-orange-100 text-orange-800', Fatal: 'bg-rose-100 text-rose-800', Minor: 'bg-blue-100 text-blue-800', Major: 'bg-red-100 text-red-800', Contraindicated: 'bg-rose-200 text-rose-900' };
const recallStatusColor: Record<string, string> = { Active: 'bg-rose-100 text-rose-800', Quarantined: 'bg-amber-100 text-amber-800', Returned: 'bg-blue-100 text-blue-800', Resolved: 'bg-emerald-100 text-emerald-800' };
const outcomeColor: Record<string, string> = { Recovered: 'bg-emerald-100 text-emerald-800', Recovering: 'bg-blue-100 text-blue-800', 'Not Recovered': 'bg-amber-100 text-amber-800', Fatal: 'bg-rose-100 text-rose-800', Unknown: 'bg-gray-100 text-gray-800' };
const statusColor: Record<string, string> = { Draft: 'bg-gray-100 text-gray-800', Submitted: 'bg-blue-100 text-blue-800', Acknowledged: 'bg-emerald-100 text-emerald-800' };

const fmt = (n: number) => n.toLocaleString('en-KE');

export default function PharmacovigilancePage() {
  const { activeOutlet } = useOutlet();
  const oid = activeOutlet?.outlet_id || 1;
  const [tab, setTab] = useState<typeof TABS[number]>('ADR Reports');
  const [loading, setLoading] = useState(true);
  const [adrs, setAdrs] = useState<ADR[]>([]);
  const [recalls, setRecalls] = useState<Recall[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [search, setSearch] = useState('');
  const [sevFilter, setSevFilter] = useState('All');
  const [showADRModal, setShowADRModal] = useState(false);
  const [showRecallModal, setShowRecallModal] = useState(false);
  const [viewADR, setViewADR] = useState<ADR | null>(null);
  const [drugA, setDrugA] = useState('');
  const [drugB, setDrugB] = useState('');
  const [checkerResults, setCheckerResults] = useState<Interaction[]>([]);

  // ADR form
  const emptyADR = { patient_name: '', patient_age: 0, patient_gender: 'Male', patient_weight: 0, reaction_date: new Date().toISOString().split('T')[0], suspected_drug: '', batch_number: '', manufacturer: '', indication: '', reaction_description: '', severity: 'Moderate' as string, outcome: 'Unknown' as string, action_taken: '', rechallenge: 'N/A' as string, concomitant_drugs: '', reporter_name: '', reporter_designation: '' };
  const [adrForm, setAdrForm] = useState(emptyADR);
  const emptyRecall = { drug_name: '', batch_numbers_str: '', manufacturer: '', recall_class: 'Class II' as string, recall_reason: '', recall_date: new Date().toISOString().split('T')[0], ppb_notice_no: '', quantity_in_stock: 0, action_taken: '' };
  const [recallForm, setRecallForm] = useState(emptyRecall);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, r, i] = await Promise.all([
        supabase.from('pharmacy_adr_reports').select('*').eq('outlet_id', oid).order('created_at', { ascending: false }),
        supabase.from('pharmacy_drug_recalls').select('*').eq('outlet_id', oid).order('created_at', { ascending: false }),
        supabase.from('pharmacy_drug_interactions').select('*').order('drug_a'),
      ]);
      setAdrs((a.data as ADR[]) || []);
      setRecalls((r.data as Recall[]) || []);
      setInteractions((i.data as Interaction[]) || []);
    } catch { toast.error('Failed to load data'); }
    setLoading(false);
  }, [oid]);

  useEffect(() => { load(); }, [load]);

  // KPI computations
  const kpis = useMemo(() => {
    const submitted = adrs.filter(a => a.ppb_submitted).length;
    const pending = adrs.filter(a => !a.ppb_submitted).length;
    const activeRecalls = recalls.filter(r => r.status !== 'Resolved').length;
    const quarantined = recalls.reduce((s, r) => s + (r.quantity_quarantined || 0), 0);
    const severe = adrs.filter(a => a.severity === 'Severe' || a.severity === 'Fatal').length;
    return { total: adrs.length, submitted, pending, activeRecalls, quarantined, interactionCount: interactions.length, severe, recallTotal: recalls.length };
  }, [adrs, recalls, interactions]);

  // Filter
  const filteredADRs = useMemo(() => adrs.filter(a => {
    if (search && !a.suspected_drug.toLowerCase().includes(search.toLowerCase()) && !a.patient_name.toLowerCase().includes(search.toLowerCase()) && !a.report_no.toLowerCase().includes(search.toLowerCase())) return false;
    if (sevFilter !== 'All' && a.severity !== sevFilter) return false;
    return true;
  }), [adrs, search, sevFilter]);

  const filteredRecalls = useMemo(() => recalls.filter(r => {
    if (search && !r.drug_name.toLowerCase().includes(search.toLowerCase()) && !r.manufacturer?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [recalls, search]);

  const filteredInteractions = useMemo(() => interactions.filter(i => {
    if (!search) return true;
    const s = search.toLowerCase();
    return i.drug_a.toLowerCase().includes(s) || i.drug_b.toLowerCase().includes(s);
  }), [interactions, search]);

  // Submit ADR
  const submitADR = async () => {
    if (!adrForm.patient_name || !adrForm.suspected_drug || !adrForm.reaction_description) { toast.error('Fill required fields'); return; }
    const report_no = `ADR-${Date.now().toString(36).toUpperCase()}`;
    const { error } = await supabase.from('pharmacy_adr_reports').insert({ ...adrForm, outlet_id: oid, report_no, report_date: new Date().toISOString().split('T')[0], status: 'Draft', ppb_submitted: false });
    if (error) { toast.error('Failed to save'); return; }
    toast.success('ADR Report created');
    setShowADRModal(false);
    setAdrForm(emptyADR);
    load();
  };

  // Submit to PPB
  const submitToPPB = async (id: number) => {
    await supabase.from('pharmacy_adr_reports').update({ ppb_submitted: true, ppb_submission_date: new Date().toISOString().split('T')[0], status: 'Submitted' }).eq('report_id', id);
    toast.success('Submitted to PPB');
    load();
  };

  // Submit Recall
  const submitRecall = async () => {
    if (!recallForm.drug_name || !recallForm.recall_reason) { toast.error('Fill required fields'); return; }
    const batches = recallForm.batch_numbers_str.split(',').map(b => b.trim()).filter(Boolean);
    const { error } = await supabase.from('pharmacy_drug_recalls').insert({ outlet_id: oid, drug_name: recallForm.drug_name, batch_numbers: batches, manufacturer: recallForm.manufacturer, recall_class: recallForm.recall_class, recall_reason: recallForm.recall_reason, recall_date: recallForm.recall_date, ppb_notice_no: recallForm.ppb_notice_no, quantity_in_stock: recallForm.quantity_in_stock, status: 'Active', action_taken: recallForm.action_taken });
    if (error) { toast.error('Failed to save'); return; }
    toast.success('Drug recall logged');
    setShowRecallModal(false);
    setRecallForm(emptyRecall);
    load();
  };

  // Update recall status
  const updateRecallStatus = async (id: number, status: string) => {
    await supabase.from('pharmacy_drug_recalls').update({ status, resolved_date: status === 'Resolved' ? new Date().toISOString().split('T')[0] : null }).eq('recall_id', id);
    toast.success(`Status → ${status}`);
    load();
  };

  // Interaction checker
  const checkInteractions = () => {
    if (!drugA || !drugB) { toast.error('Enter both drugs'); return; }
    const a = drugA.toLowerCase(), b = drugB.toLowerCase();
    const results = interactions.filter(i => (i.drug_a.toLowerCase().includes(a) && i.drug_b.toLowerCase().includes(b)) || (i.drug_a.toLowerCase().includes(b) && i.drug_b.toLowerCase().includes(a)));
    setCheckerResults(results);
    if (results.length === 0) toast.success('No known interactions found');
  };

  // Export
  const exportExcel = (title: string, headers: string[], rows: string[][]) => {
    let xml = '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>';
    xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">';
    xml += `<Worksheet ss:Name="${title}"><Table>`;
    xml += '<Row>' + headers.map(h => `<Cell><Data ss:Type="String">${h}</Data></Cell>`).join('') + '</Row>';
    rows.forEach(r => { xml += '<Row>' + r.map(c => `<Cell><Data ss:Type="String">${c || ''}</Data></Cell>`).join('') + '</Row>'; });
    xml += '</Table></Worksheet></Workbook>';
    const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${title}.xls`; a.click();
  };

  const kpiCards = [
    { label: 'Total ADR Reports', value: kpis.total, sub: 'All time', color: 'rose', color2: 'pink' },
    { label: 'Submitted to PPB', value: kpis.submitted, sub: 'Acknowledged', color: 'emerald', color2: 'teal' },
    { label: 'Pending Reports', value: kpis.pending, sub: 'Draft / Not submitted', color: 'amber', color2: 'orange' },
    { label: 'Severe / Fatal', value: kpis.severe, sub: 'High severity', color: 'red', color2: 'rose' },
    { label: 'Active Recalls', value: kpis.activeRecalls, sub: 'Unresolved', color: 'violet', color2: 'purple' },
    { label: 'Total Recalls', value: kpis.recallTotal, sub: 'All time', color: 'blue', color2: 'indigo' },
    { label: 'Qty Quarantined', value: fmt(kpis.quarantined), sub: 'Units held', color: 'orange', color2: 'amber' },
    { label: 'Interactions DB', value: kpis.interactionCount, sub: 'Known pairs', color: 'cyan', color2: 'sky' },
  ];

  return (
    <div className="w-full max-w-full space-y-3.5 px-1 md:px-2 text-gray-900" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-rose-500 to-pink-600 w-10 h-10 rounded-xl flex items-center justify-center text-white shadow">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/></svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Pharmacovigilance & Drug Safety</h1>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">Adverse Drug Reaction Reporting • Drug Recalls • Interaction Database • PPB Compliance</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportExcel('ADR_Reports', ['Report#','Date','Patient','Drug','Severity','Outcome','PPB Status'], filteredADRs.map(a => [a.report_no, a.report_date, a.patient_name, a.suspected_drug, a.severity, a.outcome, a.ppb_submitted ? 'Submitted' : 'Draft']))} className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-bold shadow-xs text-xs">📥 Export</button>
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
      <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1.5 flex-wrap">
            {TABS.map(t => (
              <button key={t} onClick={() => { setTab(t); setSearch(''); }} className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${tab === t ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>{t}</button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {tab === 'ADR Reports' && (
              <select value={sevFilter} onChange={e => setSevFilter(e.target.value)} className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700">
                <option value="All">All Severity</option>
                {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            {tab !== 'Interaction Checker' && (
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 w-48 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" />
            )}
            {tab === 'ADR Reports' && <button onClick={() => setShowADRModal(true)} className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold shadow-xs text-xs">+ New ADR Report</button>}
            {tab === 'Drug Recalls' && <button onClick={() => setShowRecallModal(true)} className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold shadow-xs text-xs">+ Log Recall</button>}
          </div>
        </div>
      </div>

      {loading ? <div className="text-center py-10 text-gray-400 font-bold">Loading...</div> : (
        <>
          {/* ═══ ADR Reports ═══ */}
          {tab === 'ADR Reports' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="bg-gradient-to-r from-rose-700 via-pink-700 to-fuchsia-800">
                    {['Report #','Date','Patient','Age/Gender','Suspected Drug','Batch','Severity','Outcome','PPB Status','Actions'].map(h => (
                      <th key={h} className="px-2.5 py-2 text-left text-[10px] font-bold text-white uppercase tracking-wider">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {filteredADRs.length === 0 ? <tr><td colSpan={10} className="text-center py-8 text-gray-400 text-sm font-semibold">No ADR reports found</td></tr> :
                    filteredADRs.map((a, i) => (
                      <tr key={a.report_id} className={`border-b border-gray-100 hover:bg-rose-50/40 transition-colors ${i % 2 ? 'bg-gray-50/30' : ''}`}>
                        <td className="px-2.5 py-1.5 text-xs font-bold text-rose-700">{a.report_no}</td>
                        <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-800">{a.report_date}</td>
                        <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-800">{a.patient_name}</td>
                        <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-600">{a.patient_age}y / {a.patient_gender}</td>
                        <td className="px-2.5 py-1.5 text-xs font-bold text-gray-900">{a.suspected_drug}</td>
                        <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-600">{a.batch_number || '—'}</td>
                        <td className="px-2.5 py-1.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${sevColor[a.severity] || 'bg-gray-100 text-gray-800'}`}>{a.severity}</span></td>
                        <td className="px-2.5 py-1.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${outcomeColor[a.outcome] || 'bg-gray-100 text-gray-800'}`}>{a.outcome}</span></td>
                        <td className="px-2.5 py-1.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${a.ppb_submitted ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{a.ppb_submitted ? '✓ Submitted' : 'Draft'}</span></td>
                        <td className="px-2.5 py-1.5">
                          <div className="flex gap-1">
                            <button onClick={() => setViewADR(a)} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-bold hover:bg-blue-100">View</button>
                            {!a.ppb_submitted && <button onClick={() => submitToPPB(a.report_id)} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-bold hover:bg-emerald-100">Submit PPB</button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 text-[10px] font-bold text-gray-500">Showing {filteredADRs.length} of {adrs.length} reports</div>
            </div>
          )}

          {/* ═══ Drug Recalls ═══ */}
          {tab === 'Drug Recalls' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="bg-gradient-to-r from-amber-700 via-orange-700 to-red-800">
                    {['Drug Name','Batch Numbers','Manufacturer','Class','Reason','Date','PPB Notice','Qty Stock','Qty Quarantined','Qty Returned','Status','Actions'].map(h => (
                      <th key={h} className="px-2.5 py-2 text-left text-[10px] font-bold text-white uppercase tracking-wider">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {filteredRecalls.length === 0 ? <tr><td colSpan={12} className="text-center py-8 text-gray-400 text-sm font-semibold">No recalls found</td></tr> :
                    filteredRecalls.map((r, i) => (
                      <tr key={r.recall_id} className={`border-b border-gray-100 hover:bg-amber-50/40 transition-colors ${i % 2 ? 'bg-gray-50/30' : ''}`}>
                        <td className="px-2.5 py-1.5 text-xs font-bold text-gray-900">{r.drug_name}</td>
                        <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-600">{(r.batch_numbers || []).join(', ') || '—'}</td>
                        <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{r.manufacturer || '—'}</td>
                        <td className="px-2.5 py-1.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${r.recall_class === 'Class I' ? 'bg-rose-100 text-rose-800' : r.recall_class === 'Class II' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>{r.recall_class}</span></td>
                        <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700 max-w-[200px] truncate">{r.recall_reason}</td>
                        <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-800">{r.recall_date}</td>
                        <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-600">{r.ppb_notice_no || '—'}</td>
                        <td className="px-2.5 py-1.5 text-xs font-bold text-gray-900">{fmt(r.quantity_in_stock)}</td>
                        <td className="px-2.5 py-1.5 text-xs font-bold text-amber-700">{fmt(r.quantity_quarantined)}</td>
                        <td className="px-2.5 py-1.5 text-xs font-bold text-blue-700">{fmt(r.quantity_returned)}</td>
                        <td className="px-2.5 py-1.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${recallStatusColor[r.status] || 'bg-gray-100 text-gray-800'}`}>{r.status}</span></td>
                        <td className="px-2.5 py-1.5">
                          <select value={r.status} onChange={e => updateRecallStatus(r.recall_id, e.target.value)} className="px-1.5 py-0.5 bg-gray-50 border border-gray-200 rounded text-[10px] font-bold text-gray-700">
                            {RECALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 text-[10px] font-bold text-gray-500">Showing {filteredRecalls.length} recalls</div>
            </div>
          )}

          {/* ═══ Drug Interactions Database ═══ */}
          {tab === 'Drug Interactions' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="bg-gradient-to-r from-violet-700 via-purple-700 to-indigo-800">
                    {['Drug A','Drug B','Severity','Description','Mechanism','Clinical Effect','Management','Source'].map(h => (
                      <th key={h} className="px-2.5 py-2 text-left text-[10px] font-bold text-white uppercase tracking-wider">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {filteredInteractions.length === 0 ? <tr><td colSpan={8} className="text-center py-8 text-gray-400 text-sm font-semibold">No interactions found — search by drug name</td></tr> :
                    filteredInteractions.map((ix, i) => (
                      <tr key={ix.interaction_id} className={`border-b border-gray-100 hover:bg-violet-50/40 transition-colors ${i % 2 ? 'bg-gray-50/30' : ''}`}>
                        <td className="px-2.5 py-1.5 text-xs font-bold text-gray-900">{ix.drug_a}</td>
                        <td className="px-2.5 py-1.5 text-xs font-bold text-gray-900">{ix.drug_b}</td>
                        <td className="px-2.5 py-1.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${sevColor[ix.severity] || 'bg-gray-100 text-gray-800'}`}>{ix.severity}</span></td>
                        <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700 max-w-[180px]">{ix.description}</td>
                        <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-600 max-w-[140px]">{ix.mechanism || '—'}</td>
                        <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-600 max-w-[140px]">{ix.clinical_effect || '—'}</td>
                        <td className="px-2.5 py-1.5 text-xs font-semibold text-emerald-700 max-w-[160px]">{ix.management || '—'}</td>
                        <td className="px-2.5 py-1.5 text-[10px] font-bold text-gray-500">{ix.reference_source || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 text-[10px] font-bold text-gray-500">{filteredInteractions.length} interactions in database</div>
            </div>
          )}

          {/* ═══ Interaction Checker ═══ */}
          {tab === 'Interaction Checker' && (
            <div className="space-y-3">
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                <h3 className="text-sm font-bold text-gray-900 mb-3">⚠️ Drug Interaction Checker</h3>
                <p className="text-xs text-gray-500 mb-3">Enter two or more drug names to check for known interactions</p>
                <div className="flex flex-wrap gap-3 items-end">
                  <div>
                    <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Drug A</label>
                    <input value={drugA} onChange={e => setDrugA(e.target.value)} placeholder="e.g. Warfarin" className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 w-52 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Drug B</label>
                    <input value={drugB} onChange={e => setDrugB(e.target.value)} placeholder="e.g. Aspirin" className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 w-52 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" />
                  </div>
                  <button onClick={checkInteractions} className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold shadow-xs text-xs">🔍 Check Interactions</button>
                </div>
              </div>
              {checkerResults.length > 0 && (
                <div className="space-y-2">
                  {checkerResults.map(ix => (
                    <div key={ix.interaction_id} className={`p-3 rounded-xl border shadow-xs ${ix.severity === 'Major' || ix.severity === 'Contraindicated' ? 'bg-rose-50 border-rose-200' : ix.severity === 'Moderate' ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${sevColor[ix.severity]}`}>{ix.severity}</span>
                        <span className="text-sm font-bold text-gray-900">{ix.drug_a} ↔ {ix.drug_b}</span>
                      </div>
                      <p className="text-xs font-semibold text-gray-800 mb-1">{ix.description}</p>
                      {ix.mechanism && <p className="text-[10px] text-gray-600"><strong>Mechanism:</strong> {ix.mechanism}</p>}
                      {ix.clinical_effect && <p className="text-[10px] text-gray-600"><strong>Effect:</strong> {ix.clinical_effect}</p>}
                      {ix.management && <p className="text-[10px] text-emerald-700 font-bold mt-1">💡 {ix.management}</p>}
                    </div>
                  ))}
                </div>
              )}
              {checkerResults.length === 0 && drugA && drugB && <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 text-center"><p className="text-sm font-bold text-emerald-800">✓ No known interactions between these drugs</p><p className="text-xs text-emerald-600 mt-1">Always use clinical judgment — database may not include all interactions</p></div>}
            </div>
          )}
        </>
      )}

      {/* ═══ ADR Modal ═══ */}
      {showADRModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowADRModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200"><h2 className="text-lg font-bold text-gray-900">New Adverse Drug Reaction Report</h2><p className="text-xs text-gray-500">PPB Pharmacovigilance Form</p></div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Patient Name *</label><input value={adrForm.patient_name} onChange={e => setAdrForm({ ...adrForm, patient_name: e.target.value })} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700" /></div>
                <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Age</label><input type="number" value={adrForm.patient_age || ''} onChange={e => setAdrForm({ ...adrForm, patient_age: +e.target.value })} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700" /></div>
                <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Gender</label><select value={adrForm.patient_gender} onChange={e => setAdrForm({ ...adrForm, patient_gender: e.target.value })} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700"><option>Male</option><option>Female</option><option>Other</option></select></div>
                <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Weight (kg)</label><input type="number" value={adrForm.patient_weight || ''} onChange={e => setAdrForm({ ...adrForm, patient_weight: +e.target.value })} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700" /></div>
              </div>
              <div className="border-t border-gray-100 pt-3">
                <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wider mb-2">Suspected Drug Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Suspected Drug *</label><input value={adrForm.suspected_drug} onChange={e => setAdrForm({ ...adrForm, suspected_drug: e.target.value })} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700" /></div>
                  <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Batch Number</label><input value={adrForm.batch_number} onChange={e => setAdrForm({ ...adrForm, batch_number: e.target.value })} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700" /></div>
                  <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Manufacturer</label><input value={adrForm.manufacturer} onChange={e => setAdrForm({ ...adrForm, manufacturer: e.target.value })} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700" /></div>
                  <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Indication</label><input value={adrForm.indication} onChange={e => setAdrForm({ ...adrForm, indication: e.target.value })} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700" /></div>
                  <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Reaction Date</label><input type="date" value={adrForm.reaction_date} onChange={e => setAdrForm({ ...adrForm, reaction_date: e.target.value })} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700" /></div>
                  <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Concomitant Drugs</label><input value={adrForm.concomitant_drugs} onChange={e => setAdrForm({ ...adrForm, concomitant_drugs: e.target.value })} placeholder="Other drugs taken" className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700" /></div>
                </div>
              </div>
              <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Reaction Description *</label><textarea value={adrForm.reaction_description} onChange={e => setAdrForm({ ...adrForm, reaction_description: e.target.value })} rows={3} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700" /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Severity</label><select value={adrForm.severity} onChange={e => setAdrForm({ ...adrForm, severity: e.target.value })} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700">{SEVERITIES.map(s => <option key={s}>{s}</option>)}</select></div>
                <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Outcome</label><select value={adrForm.outcome} onChange={e => setAdrForm({ ...adrForm, outcome: e.target.value })} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700">{OUTCOMES.map(s => <option key={s}>{s}</option>)}</select></div>
                <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Rechallenge</label><select value={adrForm.rechallenge} onChange={e => setAdrForm({ ...adrForm, rechallenge: e.target.value })} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700"><option>N/A</option><option>Yes</option><option>No</option></select></div>
              </div>
              <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Action Taken</label><input value={adrForm.action_taken} onChange={e => setAdrForm({ ...adrForm, action_taken: e.target.value })} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700" /></div>
              <div className="border-t border-gray-100 pt-3">
                <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-2">Reporter Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Reporter Name</label><input value={adrForm.reporter_name} onChange={e => setAdrForm({ ...adrForm, reporter_name: e.target.value })} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700" /></div>
                  <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Designation</label><input value={adrForm.reporter_designation} onChange={e => setAdrForm({ ...adrForm, reporter_designation: e.target.value })} placeholder="Pharmacist / PharmTech" className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700" /></div>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => setShowADRModal(false)} className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-bold shadow-xs text-xs">Cancel</button>
              <button onClick={submitADR} className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold shadow-xs text-xs">Save ADR Report</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Recall Modal ═══ */}
      {showRecallModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowRecallModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200"><h2 className="text-lg font-bold text-gray-900">Log Drug Recall</h2></div>
            <div className="p-4 space-y-3">
              <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Drug Name *</label><input value={recallForm.drug_name} onChange={e => setRecallForm({ ...recallForm, drug_name: e.target.value })} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700" /></div>
              <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Batch Numbers (comma-separated)</label><input value={recallForm.batch_numbers_str} onChange={e => setRecallForm({ ...recallForm, batch_numbers_str: e.target.value })} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Manufacturer</label><input value={recallForm.manufacturer} onChange={e => setRecallForm({ ...recallForm, manufacturer: e.target.value })} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700" /></div>
                <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Recall Class</label><select value={recallForm.recall_class} onChange={e => setRecallForm({ ...recallForm, recall_class: e.target.value })} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700">{RECALL_CLASSES.map(c => <option key={c}>{c}</option>)}</select></div>
              </div>
              <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Recall Reason *</label><textarea value={recallForm.recall_reason} onChange={e => setRecallForm({ ...recallForm, recall_reason: e.target.value })} rows={2} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Recall Date</label><input type="date" value={recallForm.recall_date} onChange={e => setRecallForm({ ...recallForm, recall_date: e.target.value })} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700" /></div>
                <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">PPB Notice No</label><input value={recallForm.ppb_notice_no} onChange={e => setRecallForm({ ...recallForm, ppb_notice_no: e.target.value })} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700" /></div>
              </div>
              <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Qty In Stock</label><input type="number" value={recallForm.quantity_in_stock || ''} onChange={e => setRecallForm({ ...recallForm, quantity_in_stock: +e.target.value })} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700" /></div>
              <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Action Taken</label><input value={recallForm.action_taken} onChange={e => setRecallForm({ ...recallForm, action_taken: e.target.value })} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700" /></div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => setShowRecallModal(false)} className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-bold shadow-xs text-xs">Cancel</button>
              <button onClick={submitRecall} className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold shadow-xs text-xs">Log Recall</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ View ADR Detail Modal ═══ */}
      {viewADR && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setViewADR(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div><h2 className="text-lg font-bold text-gray-900">ADR Report: {viewADR.report_no}</h2><p className="text-xs text-gray-500">{viewADR.report_date}</p></div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColor[viewADR.status] || 'bg-gray-100 text-gray-800'}`}>{viewADR.status}</span>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 p-2.5 rounded-lg"><p className="text-[10px] font-bold text-gray-500 uppercase">Patient</p><p className="text-sm font-bold text-gray-900">{viewADR.patient_name}</p><p className="text-xs text-gray-600">{viewADR.patient_age}y, {viewADR.patient_gender}, {viewADR.patient_weight}kg</p></div>
                <div className="bg-rose-50 p-2.5 rounded-lg"><p className="text-[10px] font-bold text-rose-600 uppercase">Suspected Drug</p><p className="text-sm font-bold text-gray-900">{viewADR.suspected_drug}</p><p className="text-xs text-gray-600">Batch: {viewADR.batch_number || '—'} | Mfr: {viewADR.manufacturer || '—'}</p></div>
              </div>
              <div className="bg-amber-50 p-2.5 rounded-lg"><p className="text-[10px] font-bold text-amber-600 uppercase">Reaction Description</p><p className="text-xs font-semibold text-gray-800 mt-1">{viewADR.reaction_description}</p></div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 p-2.5 rounded-lg"><p className="text-[10px] font-bold text-gray-500 uppercase">Severity</p><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${sevColor[viewADR.severity]}`}>{viewADR.severity}</span></div>
                <div className="bg-gray-50 p-2.5 rounded-lg"><p className="text-[10px] font-bold text-gray-500 uppercase">Outcome</p><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${outcomeColor[viewADR.outcome]}`}>{viewADR.outcome}</span></div>
                <div className="bg-gray-50 p-2.5 rounded-lg"><p className="text-[10px] font-bold text-gray-500 uppercase">Rechallenge</p><p className="text-xs font-bold text-gray-800">{viewADR.rechallenge}</p></div>
              </div>
              {viewADR.indication && <div className="bg-gray-50 p-2.5 rounded-lg"><p className="text-[10px] font-bold text-gray-500 uppercase">Indication</p><p className="text-xs font-semibold text-gray-800">{viewADR.indication}</p></div>}
              {viewADR.action_taken && <div className="bg-emerald-50 p-2.5 rounded-lg"><p className="text-[10px] font-bold text-emerald-600 uppercase">Action Taken</p><p className="text-xs font-semibold text-gray-800">{viewADR.action_taken}</p></div>}
              {viewADR.concomitant_drugs && <div className="bg-gray-50 p-2.5 rounded-lg"><p className="text-[10px] font-bold text-gray-500 uppercase">Concomitant Drugs</p><p className="text-xs font-semibold text-gray-800">{viewADR.concomitant_drugs}</p></div>}
              <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-3">
                <div><p className="text-[10px] font-bold text-gray-500 uppercase">Reporter</p><p className="text-xs font-bold text-gray-800">{viewADR.reporter_name || '—'}</p><p className="text-[10px] text-gray-500">{viewADR.reporter_designation || ''}</p></div>
                <div><p className="text-[10px] font-bold text-gray-500 uppercase">PPB Submission</p><p className="text-xs font-bold text-gray-800">{viewADR.ppb_submitted ? `Submitted ${viewADR.ppb_submission_date}` : 'Not yet submitted'}</p>{viewADR.ppb_reference && <p className="text-[10px] text-gray-500">Ref: {viewADR.ppb_reference}</p>}</div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              {!viewADR.ppb_submitted && <button onClick={() => { submitToPPB(viewADR.report_id); setViewADR(null); }} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs text-xs">Submit to PPB</button>}
              <button onClick={() => setViewADR(null)} className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-bold shadow-xs text-xs">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
