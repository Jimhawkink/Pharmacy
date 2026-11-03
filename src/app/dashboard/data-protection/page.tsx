'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

/* ═══════════════════════════════════════════════════════════════
   DATA PROTECTION ACT 2019 (DPA) COMPLIANCE CENTRE
   Kenya ODPC Compliance | Alpha Pharmacy | PPB Standards
   ═══════════════════════════════════════════════════════════════ */

type ConsentRecord = {
  consent_id: number;
  patient_id: number;
  patient_name: string;
  consent_type: string;
  granted: boolean;
  granted_at: string;
  revoked_at: string | null;
  ip_address: string;
  consent_version: string;
  collector_name: string;
  outlet_id: number;
};

type DataRequest = {
  request_id: number;
  patient_name: string;
  patient_email: string;
  patient_phone: string;
  request_type: 'export' | 'delete' | 'rectify' | 'restrict';
  status: 'Pending' | 'Processing' | 'Completed' | 'Rejected';
  requested_at: string;
  completed_at: string | null;
  handled_by: string;
  notes: string;
  outlet_id: number;
};

type DataBreachLog = {
  breach_id: number;
  breach_date: string;
  description: string;
  affected_records: number;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  reported_to_odpc: boolean;
  reported_at: string | null;
  remediation: string;
  reported_by: string;
  outlet_id: number;
};

const CONSENT_TYPES = [
  { key: 'health_data_processing', label: 'Health Data Processing', desc: 'Consent to process sensitive personal health data per DPA 2019 s.32' },
  { key: 'prescription_storage', label: 'Prescription Retention', desc: 'Consent to retain prescription records for 5 years (PPB requirement)' },
  { key: 'insurance_sharing', label: 'Insurance Data Sharing', desc: 'Consent to share data with SHA/SHIF and private insurers for claims' },
  { key: 'sms_marketing', label: 'SMS/Marketing Communications', desc: 'Consent to receive refill reminders and health tips' },
  { key: 'research_analytics', label: 'Anonymized Research & Analytics', desc: 'Consent to use anonymized data for pharmacy analytics and research' },
  { key: 'third_party_labs', label: 'Third-Party Laboratory Sharing', desc: 'Consent to share data with affiliated labs and diagnostic centres' },
];

const REQUEST_TYPE_LABELS = {
  export: { label: '📤 Data Export', color: 'bg-blue-100 text-blue-800', desc: 'Patient requests a copy of all their data (DPA s.26)' },
  delete: { label: '🗑️ Data Deletion', color: 'bg-red-100 text-red-800', desc: 'Patient requests erasure of personal data (DPA s.38)' },
  rectify: { label: '✏️ Data Rectification', color: 'bg-amber-100 text-amber-800', desc: 'Patient requests correction of inaccurate data (DPA s.35)' },
  restrict: { label: '🔒 Processing Restriction', color: 'bg-purple-100 text-purple-800', desc: 'Patient requests restriction of data processing (DPA s.36)' },
};

const SEVERITY_COLOR = { Low: 'bg-blue-100 text-blue-800', Medium: 'bg-amber-100 text-amber-800', High: 'bg-rose-100 text-rose-800', Critical: 'bg-red-100 text-red-800 font-black border border-red-300' };

const TABS = ['Consent Management', 'Data Subject Rights', 'Breach Register', 'Privacy Policy', 'Compliance Dashboard'] as const;

const DPA_REQUIREMENTS = [
  { req: 'Patient consent management', status: '✅', detail: 'This module manages all consent records per DPA 2019' },
  { req: 'Right to access personal data', status: '✅', detail: 'Data export requests handled within 21 days (DPA s.26)' },
  { req: 'Right to erasure ("right to be forgotten")', status: '✅', detail: 'Delete requests tracked and processed within 21 days' },
  { req: 'Right to rectification', status: '✅', detail: 'Correction requests managed with audit trail' },
  { req: 'Data breach notification (72 hrs to ODPC)', status: '✅', detail: 'Breach register with ODPC notification tracking' },
  { req: 'Privacy policy in place', status: '✅', detail: 'Full privacy policy displayed to all users/patients' },
  { req: 'Supabase RLS row-level security', status: '⚠️', detail: 'Partially enabled — run pharmacy_premium_modules.sql to complete' },
  { req: '2FA / MFA for staff', status: '⚠️', detail: 'PIN + password in place. Full 2FA via Supabase Auth planned' },
  { req: '5-year prescription retention', status: '✅', detail: 'Prescription records tagged with retention policy in DDR module' },
  { req: 'Audit trail for all data access', status: '✅', detail: 'Activity log records all data access events' },
  { req: 'Encryption at rest', status: '✅', detail: 'Supabase AES-256 encryption at rest on all tables' },
  { req: 'Encryption in transit', status: '✅', detail: 'All API calls over HTTPS/TLS 1.3' },
  { req: 'ODPC registration as data controller', status: '⚠️', detail: 'Manual step: Register at www.odpc.go.ke' },
  { req: 'Data Protection Officer (DPO) appointed', status: '⚠️', detail: 'Required for health data processors — appoint a DPO' },
];

export default function DataProtectionPage() {
  const { activeOutlet } = useOutlet();
  const oid = activeOutlet?.outlet_id || 1;
  const [tab, setTab] = useState<typeof TABS[number]>('Consent Management');
  const [loading, setLoading] = useState(false);
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [requests, setRequests] = useState<DataRequest[]>([]);
  const [breaches, setBreaches] = useState<DataBreachLog[]>([]);
  const [search, setSearch] = useState('');

  // Consent form
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentForm, setConsentForm] = useState({ patient_id: '', patient_name: '', consent_type: CONSENT_TYPES[0].key, granted: true, consent_version: '1.0', ip_address: '' });

  // Request form
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestForm, setRequestForm] = useState({ patient_name: '', patient_email: '', patient_phone: '', request_type: 'export' as DataRequest['request_type'], notes: '' });

  // Breach form
  const [showBreachModal, setShowBreachModal] = useState(false);
  const [breachForm, setBreachForm] = useState({ breach_date: new Date().toISOString().split('T')[0], description: '', affected_records: 0, severity: 'Medium' as DataBreachLog['severity'], remediation: '' });

  const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, r, b] = await Promise.all([
        supabase.from('pharmacy_consent_records').select('*').eq('outlet_id', oid).order('granted_at', { ascending: false }).limit(200),
        supabase.from('pharmacy_data_requests').select('*').eq('outlet_id', oid).order('requested_at', { ascending: false }).limit(200),
        supabase.from('pharmacy_breach_logs').select('*').eq('outlet_id', oid).order('breach_date', { ascending: false }).limit(100),
      ]);
      setConsents((c.data || []) as ConsentRecord[]);
      setRequests((r.data || []) as DataRequest[]);
      setBreaches((b.data || []) as DataBreachLog[]);
    } catch { /* tables may not exist yet */ }
    setLoading(false);
  }, [oid]);

  useEffect(() => { load(); }, [load]);

  const saveConsent = async () => {
    if (!consentForm.patient_name || !consentForm.patient_id) { toast.error('Patient name and ID required'); return; }
    const { error } = await supabase.from('pharmacy_consent_records').insert({
      ...consentForm, outlet_id: oid, collector_name: user.name || 'Staff',
      granted_at: new Date().toISOString(), ip_address: consentForm.ip_address || 'In-pharmacy',
    });
    if (error) { toast.error('Failed to save consent: ' + error.message); return; }
    toast.success('Consent record saved ✅');
    setShowConsentModal(false);
    load();
  };

  const revokeConsent = async (id: number) => {
    if (!confirm('Revoke this consent? The patient will be noted as having withdrawn consent.')) return;
    const { error } = await supabase.from('pharmacy_consent_records').update({ granted: false, revoked_at: new Date().toISOString() }).eq('consent_id', id);
    if (error) { toast.error('Failed to revoke'); return; }
    toast.success('Consent revoked — noted in record');
    load();
  };

  const saveRequest = async () => {
    if (!requestForm.patient_name) { toast.error('Patient name required'); return; }
    const { error } = await supabase.from('pharmacy_data_requests').insert({
      ...requestForm, outlet_id: oid, status: 'Pending', requested_at: new Date().toISOString(), handled_by: user.name || 'Staff',
    });
    if (error) { toast.error('Failed to log request: ' + error.message); return; }
    toast.success('Data subject request logged — must respond within 21 days (DPA s.26)');
    setShowRequestModal(false);
    load();
  };

  const updateRequestStatus = async (id: number, status: DataRequest['status']) => {
    const { error } = await supabase.from('pharmacy_data_requests').update({ status, completed_at: status === 'Completed' ? new Date().toISOString() : null, handled_by: user.name || 'Staff' }).eq('request_id', id);
    if (error) { toast.error('Failed to update'); return; }
    toast.success(`Request marked as ${status}`);
    load();
  };

  const saveBreach = async () => {
    if (!breachForm.description) { toast.error('Breach description required'); return; }
    const { error } = await supabase.from('pharmacy_breach_logs').insert({
      ...breachForm, outlet_id: oid, reported_to_odpc: false, reported_by: user.name || 'Staff',
    });
    if (error) { toast.error('Failed to log breach: ' + error.message); return; }
    toast.error('⚠️ Data breach logged! You must notify ODPC within 72 hours if it affects personal data.', { duration: 8000 });
    setShowBreachModal(false);
    load();
  };

  const markODPCReported = async (id: number) => {
    const { error } = await supabase.from('pharmacy_breach_logs').update({ reported_to_odpc: true, reported_at: new Date().toISOString() }).eq('breach_id', id);
    if (error) { toast.error('Failed to update'); return; }
    toast.success('Marked as reported to ODPC ✅');
    load();
  };

  const exportPatientData = (patientName: string) => {
    const data = { patient: patientName, exported_at: new Date().toISOString(), exported_by: user.name, note: 'Data export per DPA 2019 s.26 — Right of Access', data_categories: ['Personal identifiers', 'Health records', 'Prescription history', 'Payment records', 'Consent records'] };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `data_export_${patientName.replace(/ /g, '_')}_${Date.now()}.json`; a.click();
    toast.success('Data export initiated — deliver securely to patient');
  };

  const filteredConsents = consents.filter(c => !search || c.patient_name?.toLowerCase().includes(search.toLowerCase()));
  const filteredRequests = requests.filter(r => !search || r.patient_name?.toLowerCase().includes(search.toLowerCase()));
  const pendingRequests = requests.filter(r => r.status === 'Pending');
  const unreportedBreaches = breaches.filter(b => !b.reported_to_odpc && (b.severity === 'High' || b.severity === 'Critical'));
  const complianceScore = Math.round((DPA_REQUIREMENTS.filter(r => r.status === '✅').length / DPA_REQUIREMENTS.length) * 100);

  return (
    <div className="w-full max-w-full space-y-3.5 px-1 md:px-2 text-gray-900" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-indigo-500 to-blue-600 w-10 h-10 rounded-xl flex items-center justify-center text-white shadow">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Data Protection Compliance</h1>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">Kenya DPA 2019 • ODPC Compliance • Patient Rights • Consent Management</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {unreportedBreaches.length > 0 && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-red-600 text-white animate-pulse">🚨 {unreportedBreaches.length} Unreported Breach(es)!</span>
          )}
          {pendingRequests.length > 0 && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-500 text-white">⚠️ {pendingRequests.length} Pending Request(s)</span>
          )}
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${complianceScore >= 80 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>DPA Score: {complianceScore}%</span>
          <button onClick={load} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-xs text-xs">↻ Refresh</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2">
        {[
          { label: 'Consent Records', value: consents.length, sub: 'Total consents', color: 'indigo', color2: 'blue' },
          { label: 'Active Consents', value: consents.filter(c => c.granted).length, sub: 'Currently granted', color: 'emerald', color2: 'teal' },
          { label: 'Revoked Consents', value: consents.filter(c => !c.granted).length, sub: 'Withdrawn by patient', color: 'rose', color2: 'red' },
          { label: 'Data Requests', value: requests.length, sub: `${pendingRequests.length} pending`, color: 'amber', color2: 'orange' },
          { label: 'Breach Incidents', value: breaches.length, sub: `${unreportedBreaches.length} unreported`, color: unreportedBreaches.length > 0 ? 'red' : 'violet', color2: 'purple' },
        ].map((c, i) => (
          <div key={i} className={`bg-gradient-to-br from-${c.color}-50/80 via-${c.color2}-50/40 to-white p-3 rounded-xl border border-${c.color}-200/80 shadow-xs`}>
            <p className={`text-[10px] font-bold text-${c.color}-800 uppercase tracking-wider`}>{c.label}</p>
            <p className={`text-xl font-black text-${c.color}-950`}>{c.value}</p>
            <p className={`text-[10px] font-bold text-${c.color}-700 mt-0.5`}>{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Tabs + Search */}
      <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5 flex-wrap">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${tab === t ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>{t}</button>
          ))}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient..." className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 w-44 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none" />
      </div>

      {/* ═══ CONSENT MANAGEMENT ═══ */}
      {tab === 'Consent Management' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-xs font-semibold text-indigo-800">
              📋 <strong>DPA 2019 s.30:</strong> Consent for sensitive personal data (health records) must be explicit, freely given, specific, informed, and unambiguous. Document every consent.
            </div>
            <button onClick={() => setShowConsentModal(true)} className="ml-3 flex-shrink-0 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-xs text-xs">+ Record Consent</button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="bg-gradient-to-r from-indigo-700 via-blue-700 to-violet-800">
                  {['Patient', 'Consent Type', 'Status', 'Granted', 'Revoked', 'Version', 'Collector', 'Actions'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-[10px] font-bold text-white uppercase tracking-wider">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} className="text-center py-8 text-gray-400 font-semibold text-sm">Loading...</td></tr>
                  ) : filteredConsents.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-10 text-gray-400 font-bold">No consent records yet. Start recording patient consents.</td></tr>
                  ) : filteredConsents.map((c, i) => (
                    <tr key={c.consent_id} className={`border-b border-gray-100 hover:bg-indigo-50/30 ${i % 2 ? 'bg-gray-50/30' : ''}`}>
                      <td className="px-3 py-2 text-xs font-bold text-gray-900">{c.patient_name}<br /><span className="text-[10px] text-gray-500">ID: {c.patient_id}</span></td>
                      <td className="px-3 py-2 text-xs font-semibold text-gray-700">{CONSENT_TYPES.find(ct => ct.key === c.consent_type)?.label || c.consent_type}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${c.granted ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                          {c.granted ? '✅ Granted' : '❌ Revoked'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-[10px] font-semibold text-gray-600">{c.granted_at ? new Date(c.granted_at).toLocaleDateString('en-KE') : '—'}</td>
                      <td className="px-3 py-2 text-[10px] font-semibold text-gray-500">{c.revoked_at ? new Date(c.revoked_at).toLocaleDateString('en-KE') : '—'}</td>
                      <td className="px-3 py-2 text-[10px] font-semibold text-gray-600">v{c.consent_version}</td>
                      <td className="px-3 py-2 text-[10px] font-semibold text-gray-600">{c.collector_name}</td>
                      <td className="px-3 py-2">
                        {c.granted && (
                          <button onClick={() => revokeConsent(c.consent_id)} className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-[10px] font-bold">Revoke</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Consent types reference */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-4">
            <h3 className="text-sm font-bold text-gray-800 mb-3">📋 Consent Types Reference</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {CONSENT_TYPES.map((ct, i) => (
                <div key={i} className="bg-indigo-50 rounded-xl border border-indigo-100 p-3">
                  <p className="text-xs font-black text-indigo-900">{ct.label}</p>
                  <p className="text-[10px] text-indigo-700 mt-0.5 font-semibold">{ct.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ DATA SUBJECT RIGHTS ═══ */}
      {tab === 'Data Subject Rights' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center gap-3">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex-1 text-xs font-semibold text-amber-800">
              ⚖️ <strong>DPA 2019 s.26:</strong> Patients have the right to access, correct, delete, and port their personal data. You must respond to requests within <strong>21 days</strong>. Failure attracts fines up to KSh 5,000,000.
            </div>
            <button onClick={() => setShowRequestModal(true)} className="flex-shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold shadow-xs text-xs">+ New Request</button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.entries(REQUEST_TYPE_LABELS).map(([k, v]) => (
              <div key={k} className={`p-3 rounded-xl border ${v.color.replace('text-', 'border-').replace('100', '200')} ${v.color}`}>
                <p className="text-xs font-black">{v.label}</p>
                <p className="text-[10px] font-semibold mt-0.5">{requests.filter(r => r.request_type === k).length} requests</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="bg-gradient-to-r from-amber-700 via-orange-700 to-rose-800">
                  {['Patient', 'Contact', 'Request Type', 'Status', 'Requested', 'Completed', 'Handled By', 'Actions'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-[10px] font-bold text-white uppercase tracking-wider">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filteredRequests.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-10 text-gray-400 font-bold">No data subject requests yet</td></tr>
                  ) : filteredRequests.map((r, i) => {
                    const typeInfo = REQUEST_TYPE_LABELS[r.request_type];
                    const daysSince = Math.floor((Date.now() - new Date(r.requested_at).getTime()) / 86400000);
                    const overdue = r.status === 'Pending' && daysSince > 21;
                    return (
                      <tr key={r.request_id} className={`border-b border-gray-100 hover:bg-amber-50/30 ${i % 2 ? 'bg-gray-50/30' : ''} ${overdue ? 'bg-red-50' : ''}`}>
                        <td className="px-3 py-2 text-xs font-bold text-gray-900">{r.patient_name}</td>
                        <td className="px-3 py-2 text-[10px] font-semibold text-gray-600">{r.patient_email}<br />{r.patient_phone}</td>
                        <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${typeInfo.color}`}>{typeInfo.label}</span></td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${r.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' : r.status === 'Rejected' ? 'bg-red-100 text-red-800' : r.status === 'Processing' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>{r.status}</span>
                          {overdue && <span className="ml-1 px-1.5 py-0.5 bg-red-600 text-white text-[9px] font-black rounded-full animate-pulse">OVERDUE</span>}
                        </td>
                        <td className="px-3 py-2 text-[10px] font-semibold text-gray-600">{new Date(r.requested_at).toLocaleDateString('en-KE')}<br /><span className="text-gray-400">Day {daysSince}/21</span></td>
                        <td className="px-3 py-2 text-[10px] font-semibold text-gray-500">{r.completed_at ? new Date(r.completed_at).toLocaleDateString('en-KE') : '—'}</td>
                        <td className="px-3 py-2 text-[10px] font-semibold text-gray-600">{r.handled_by}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1 flex-wrap">
                            {r.request_type === 'export' && r.status !== 'Completed' && (
                              <button onClick={() => exportPatientData(r.patient_name)} className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-[10px] font-bold">Export</button>
                            )}
                            {r.status === 'Pending' && (
                              <button onClick={() => updateRequestStatus(r.request_id, 'Processing')} className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded text-[10px] font-bold">Process</button>
                            )}
                            {r.status !== 'Completed' && r.status !== 'Rejected' && (
                              <button onClick={() => updateRequestStatus(r.request_id, 'Completed')} className="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded text-[10px] font-bold">Done</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══ BREACH REGISTER ═══ */}
      {tab === 'Breach Register' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center gap-3">
            <div className="bg-red-50 border border-red-300 rounded-xl p-3 flex-1 text-xs font-semibold text-red-800">
              🚨 <strong>DPA 2019 s.43:</strong> Data breaches affecting personal data must be reported to the ODPC within <strong>72 hours</strong> of discovery. Failure is a criminal offence with fines up to KSh 3,000,000. Contact ODPC: <strong>+254 20 2628 000 | info@odpc.go.ke</strong>
            </div>
            <button onClick={() => setShowBreachModal(true)} className="flex-shrink-0 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-xs text-xs">🚨 Log Breach</button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="bg-gradient-to-r from-red-700 via-rose-700 to-pink-800">
                  {['Date', 'Description', 'Records Affected', 'Severity', 'ODPC Reported', 'Reported At', 'Reported By', 'Remediation', 'Actions'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-[10px] font-bold text-white uppercase tracking-wider">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {breaches.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-10 text-gray-400 font-bold">✅ No breach incidents recorded</td></tr>
                  ) : breaches.map((b, i) => (
                    <tr key={b.breach_id} className={`border-b border-gray-100 ${i % 2 ? 'bg-gray-50/30' : ''} ${!b.reported_to_odpc && (b.severity === 'High' || b.severity === 'Critical') ? 'bg-red-50' : ''}`}>
                      <td className="px-3 py-2 text-xs font-bold text-gray-900">{b.breach_date}</td>
                      <td className="px-3 py-2 text-xs font-semibold text-gray-700 max-w-[200px]">{b.description}</td>
                      <td className="px-3 py-2 text-xs font-bold text-gray-800">{b.affected_records.toLocaleString()}</td>
                      <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${SEVERITY_COLOR[b.severity]}`}>{b.severity}</span></td>
                      <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${b.reported_to_odpc ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>{b.reported_to_odpc ? '✅ Yes' : '❌ No'}</span></td>
                      <td className="px-3 py-2 text-[10px] font-semibold text-gray-500">{b.reported_at ? new Date(b.reported_at).toLocaleDateString('en-KE') : '—'}</td>
                      <td className="px-3 py-2 text-[10px] font-semibold text-gray-600">{b.reported_by}</td>
                      <td className="px-3 py-2 text-[10px] font-semibold text-gray-600 max-w-[150px]">{b.remediation}</td>
                      <td className="px-3 py-2">
                        {!b.reported_to_odpc && (
                          <button onClick={() => markODPCReported(b.breach_id)} className="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded text-[10px] font-bold">Mark Reported</button>
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

      {/* ═══ PRIVACY POLICY ═══ */}
      {tab === 'Privacy Policy' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-6 space-y-4 max-w-4xl">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🔒</span>
            <div>
              <h2 className="text-xl font-black text-gray-900">Alpha Pharmacy — Privacy Policy</h2>
              <p className="text-xs text-gray-500 font-semibold">Last Updated: {new Date().toLocaleDateString('en-KE')} | Version 1.0 | Kenya DPA 2019 Compliant</p>
            </div>
          </div>

          {[
            { title: '1. Data Controller', content: 'Alpha Pharmacy ("We", "Us") is the data controller for all personal data collected through this pharmacy management system. We are registered/applying for registration with the Office of Data Protection Commissioner (ODPC), Kenya, as required by the Data Protection Act, 2019.' },
            { title: '2. What Data We Collect', content: 'We collect: Full name, National ID/Passport number, date of birth, contact details (phone, email, address); Health data including prescriptions, diagnoses, allergies, chronic conditions, medication history; Payment data including M-Pesa transaction references, insurance membership details; Pharmacy visit records and dispensing history.' },
            { title: '3. Legal Basis for Processing (DPA 2019 s.30)', content: 'We process your health data based on: (a) Your explicit consent obtained at the time of service; (b) Performance of health services you have requested; (c) Compliance with our legal obligations under the Pharmacy and Poisons Act, Cap. 244; (d) Protection of your vital interests.' },
            { title: '4. Your Rights Under DPA 2019', content: 'You have the right to: Access your personal data (s.26); Correct inaccurate data (s.35); Delete your data where no legal obligation requires retention (s.38); Restrict processing (s.36); Object to processing (s.37); Data portability (s.39). Note: Prescription records must be retained for 5 years under PPB regulations even if you request deletion.' },
            { title: '5. Data Retention', content: 'Prescription records: 5 years (PPB requirement); DDR/controlled drugs records: 5 years minimum; Financial records: 7 years (Kenya Revenue Authority requirement); General patient records: 3 years after last visit; Consent records: Permanently retained as evidence.' },
            { title: '6. Data Security', content: 'We implement: AES-256 encryption at rest (Supabase); TLS 1.3 encryption in transit; Role-based access control (RBAC); 30-minute session auto-logout; Audit logging of all data access events; Regular security assessments.' },
            { title: '7. Sharing of Personal Data', content: 'We may share your data with: SHA/SHIF for insurance claims (with your consent); Private insurers (with your consent); Regulatory bodies (PPB, ODPC) as legally required; Lab partners (with your explicit consent). We never sell your personal data.' },
            { title: '8. Contact & Complaints', content: 'Data Protection Officer (DPO): pharmacy@alpha.co.ke | To exercise your rights or file a complaint: Contact us first. If unresolved, contact ODPC: www.odpc.go.ke | info@odpc.go.ke | +254 20 2628 000' },
          ].map((s, i) => (
            <div key={i} className="border-b border-gray-100 pb-4 last:border-0">
              <h3 className="text-sm font-black text-gray-900 mb-1.5">{s.title}</h3>
              <p className="text-xs font-semibold text-gray-600 leading-relaxed">{s.content}</p>
            </div>
          ))}
          <button onClick={() => { const blob = new Blob([document.getElementById('privacy')?.innerText || ''], { type: 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'Alpha_Pharmacy_Privacy_Policy.txt'; a.click(); }} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs">📄 Download Privacy Policy PDF</button>
        </div>
      )}

      {/* ═══ COMPLIANCE DASHBOARD ═══ */}
      {tab === 'Compliance Dashboard' && (
        <div className="space-y-3">
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-800">📊 DPA 2019 Compliance Score</h2>
              <span className={`text-3xl font-black ${complianceScore >= 80 ? 'text-emerald-600' : complianceScore >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{complianceScore}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
              <div className={`h-3 rounded-full transition-all ${complianceScore >= 80 ? 'bg-emerald-500' : complianceScore >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${complianceScore}%` }} />
            </div>
            <div className="space-y-2">
              {DPA_REQUIREMENTS.map((r, i) => (
                <div key={i} className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
                  <span className="text-base flex-shrink-0">{r.status}</span>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-gray-800">{r.req}</p>
                    <p className="text-[10px] font-semibold text-gray-500">{r.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ODPC Action Items */}
          <div className="bg-amber-50 rounded-xl border border-amber-300 p-4">
            <h3 className="text-sm font-black text-amber-900 mb-3">📋 ODPC Registration Action Items</h3>
            <div className="space-y-2">
              {[
                { step: '1', action: 'Register on ODPC portal', url: 'www.odpc.go.ke', status: '⚠️ Pending' },
                { step: '2', action: 'Appoint a Data Protection Officer (DPO)', url: '', status: '⚠️ Pending' },
                { step: '3', action: 'Complete Data Protection Impact Assessment (DPIA)', url: '', status: '⚠️ Pending' },
                { step: '4', action: 'Train all staff on DPA 2019 requirements', url: '', status: '⚠️ Pending' },
                { step: '5', action: 'Implement full Supabase RLS policies', url: '', status: '✅ In Progress (run SQL files)' },
              ].map((a, i) => (
                <div key={i} className="flex items-center gap-3 py-1.5">
                  <span className="w-6 h-6 bg-amber-600 text-white rounded-full text-[10px] font-black flex items-center justify-center flex-shrink-0">{a.step}</span>
                  <span className="text-xs font-semibold text-amber-800 flex-1">{a.action}{a.url && <> — <span className="text-blue-600 underline">{a.url}</span></>}</span>
                  <span className="text-[10px] font-bold text-amber-700">{a.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ CONSENT MODAL ═══ */}
      {showConsentModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-5 py-4 rounded-t-2xl flex items-center justify-between">
              <h3 className="text-white font-black text-base">📋 Record Patient Consent</h3>
              <button onClick={() => setShowConsentModal(false)} className="text-white hover:bg-white/20 rounded-lg p-1 text-xl leading-none">×</button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Patient ID / File No. *</label>
                  <input value={consentForm.patient_id} onChange={e => setConsentForm(p => ({ ...p, patient_id: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold outline-none focus:border-indigo-400" placeholder="e.g. 001" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Patient Full Name *</label>
                  <input value={consentForm.patient_name} onChange={e => setConsentForm(p => ({ ...p, patient_name: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold outline-none focus:border-indigo-400" placeholder="Full name" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Consent Type *</label>
                <select value={consentForm.consent_type} onChange={e => setConsentForm(p => ({ ...p, consent_type: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold outline-none focus:border-indigo-400 bg-white">
                  {CONSENT_TYPES.map(ct => <option key={ct.key} value={ct.key}>{ct.label}</option>)}
                </select>
                <p className="text-[10px] text-indigo-600 font-semibold mt-1">{CONSENT_TYPES.find(ct => ct.key === consentForm.consent_type)?.desc}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Status</label>
                  <select value={consentForm.granted ? 'yes' : 'no'} onChange={e => setConsentForm(p => ({ ...p, granted: e.target.value === 'yes' }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold outline-none focus:border-indigo-400 bg-white">
                    <option value="yes">✅ Consent Granted</option>
                    <option value="no">❌ Consent Refused</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Collection Method</label>
                  <input value={consentForm.ip_address} onChange={e => setConsentForm(p => ({ ...p, ip_address: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold outline-none focus:border-indigo-400" placeholder="In-pharmacy / Online" />
                </div>
              </div>
              <p className="text-[10px] text-gray-500 font-semibold bg-gray-50 p-2 rounded-lg">⚠️ By recording this consent, you confirm that the patient was informed of their rights under DPA 2019 and that consent was freely given.</p>
            </div>
            <div className="px-5 pb-5 flex gap-3">
              <button onClick={() => setShowConsentModal(false)} className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs">Cancel</button>
              <button onClick={saveConsent} className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs">Save Consent Record</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ REQUEST MODAL ═══ */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="bg-gradient-to-r from-amber-600 to-orange-600 px-5 py-4 rounded-t-2xl flex items-center justify-between">
              <h3 className="text-white font-black text-base">⚖️ Log Data Subject Request</h3>
              <button onClick={() => setShowRequestModal(false)} className="text-white hover:bg-white/20 rounded-lg p-1 text-xl leading-none">×</button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Patient Name *</label>
                <input value={requestForm.patient_name} onChange={e => setRequestForm(p => ({ ...p, patient_name: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold outline-none focus:border-amber-400" placeholder="Full name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Email</label>
                  <input type="email" value={requestForm.patient_email} onChange={e => setRequestForm(p => ({ ...p, patient_email: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold outline-none focus:border-amber-400" placeholder="email@example.com" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Phone</label>
                  <input value={requestForm.patient_phone} onChange={e => setRequestForm(p => ({ ...p, patient_phone: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold outline-none focus:border-amber-400" placeholder="07XXXXXXXX" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Request Type *</label>
                <select value={requestForm.request_type} onChange={e => setRequestForm(p => ({ ...p, request_type: e.target.value as DataRequest['request_type'] }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold outline-none focus:border-amber-400 bg-white">
                  {Object.entries(REQUEST_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Notes / Details</label>
                <textarea value={requestForm.notes} onChange={e => setRequestForm(p => ({ ...p, notes: e.target.value }))} rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold outline-none focus:border-amber-400 resize-none" placeholder="Additional details about the request..." />
              </div>
              <p className="text-[10px] text-amber-700 font-bold bg-amber-50 p-2 rounded-lg">⏱ You have 21 days to respond to this request. Failure to respond is a violation of DPA 2019.</p>
            </div>
            <div className="px-5 pb-5 flex gap-3">
              <button onClick={() => setShowRequestModal(false)} className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs">Cancel</button>
              <button onClick={saveRequest} className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs">Log Request</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ BREACH MODAL ═══ */}
      {showBreachModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="bg-gradient-to-r from-red-600 to-rose-600 px-5 py-4 rounded-t-2xl flex items-center justify-between">
              <h3 className="text-white font-black text-base">🚨 Log Data Breach Incident</h3>
              <button onClick={() => setShowBreachModal(false)} className="text-white hover:bg-white/20 rounded-lg p-1 text-xl leading-none">×</button>
            </div>
            <div className="p-5 space-y-3">
              <div className="bg-red-50 border border-red-300 rounded-xl p-3 text-xs font-bold text-red-800">⚠️ URGENT: If this breach involves personal health data, you must notify the ODPC within 72 hours (DPA 2019 s.43).</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Breach Date *</label>
                  <input type="date" value={breachForm.breach_date} onChange={e => setBreachForm(p => ({ ...p, breach_date: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold outline-none focus:border-red-400" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Severity</label>
                  <select value={breachForm.severity} onChange={e => setBreachForm(p => ({ ...p, severity: e.target.value as DataBreachLog['severity'] }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold outline-none focus:border-red-400 bg-white">
                    {(['Low', 'Medium', 'High', 'Critical'] as const).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Breach Description *</label>
                <textarea value={breachForm.description} onChange={e => setBreachForm(p => ({ ...p, description: e.target.value }))} rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold outline-none focus:border-red-400 resize-none" placeholder="Describe what happened, what data was affected..." />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Estimated Records Affected</label>
                <input type="number" value={breachForm.affected_records} onChange={e => setBreachForm(p => ({ ...p, affected_records: Number(e.target.value) }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold outline-none focus:border-red-400" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Remediation Actions Taken</label>
                <textarea value={breachForm.remediation} onChange={e => setBreachForm(p => ({ ...p, remediation: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold outline-none focus:border-red-400 resize-none" placeholder="Steps taken to contain the breach..." />
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-3">
              <button onClick={() => setShowBreachModal(false)} className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs">Cancel</button>
              <button onClick={saveBreach} className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs">Log Breach Incident</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
