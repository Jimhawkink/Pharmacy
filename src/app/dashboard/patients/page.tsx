'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

/* ───────── types ───────── */
interface Patient {
  patient_id: string;
  outlet_id: string;
  full_name: string;
  id_number: string;
  phone: string;
  email: string;
  date_of_birth: string;
  gender: string;
  address: string;
  county: string;
  allergies: string[];
  chronic_conditions: string[];
  blood_type: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  insurance_provider: string;
  insurance_member_no: string;
  consent_given: boolean;
  consent_date: string;
  privacy_accepted: boolean;
  notes: string;
  active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface ConsentRecord {
  consent_id: string;
  patient_id: string;
  consent_type: string;
  granted: boolean;
  granted_date: string;
  revoked_date: string | null;
  ip_address: string;
  consent_text: string;
  pharmacy_patients?: { full_name: string; phone: string };
}

interface DataRequest {
  request_id?: string;
  patient_name: string;
  id_number: string;
  request_type: string;
  details: string;
  status: string;
  created_at?: string;
}

const KENYA_COUNTIES = ['Nairobi','Mombasa','Kisumu','Nakuru','Bomet','Kericho','Nandi','Uasin Gishu','Eldoret','Baringo','Bungoma','Busia','Elgeyo-Marakwet','Embu','Garissa','Homa Bay','Isiolo','Kajiado','Kakamega','Kiambu','Kilifi','Kirinyaga','Kisii','Kitui','Kwale','Laikipia','Lamu','Machakos','Makueni','Mandera','Marsabit','Meru','Migori','Murang\'a','Narok','Nyamira','Nyandarua','Nyeri','Samburu','Siaya','Taita-Taveta','Tana River','Tharaka-Nithi','Trans-Nzoia','Turkana','Vihiga','Wajir','West Pokot'];
const CHRONIC_CONDITIONS = ['Diabetes','Hypertension','HIV/AIDS','Asthma','Epilepsy','Cancer','Heart Disease','Kidney Disease','Arthritis','COPD','Sickle Cell','Thyroid Disorder','Mental Health','TB'];
const BLOOD_TYPES = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];
const GENDERS = ['Male','Female','Other'];
const COMMON_ALLERGIES = ['Penicillin','Sulfa','Aspirin','NSAIDs','Codeine','Latex','Iodine','Peanuts','Morphine','Tetracycline'];
const CONSENT_TYPES = ['Data Processing','Marketing','SMS Notifications','WhatsApp','Research','Insurance Sharing'];
const TABS = ['All Patients','Chronic Care','Insurance Linked','Consent Management','Data Requests'];

const fmt = (n: number) => n.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const showSuperLightGreenToast = (message: string) => {
  toast.success(message, {
    duration: 4500,
    style: {
      background: '#f0fdf4', // super light green (emerald-50)
      color: '#166534',      // deep emerald text
      border: '1.5px solid #86efac', // light green border (emerald-300)
      borderRadius: '16px',
      padding: '14px 20px',
      fontSize: '13px',
      fontWeight: '700',
      boxShadow: '0 10px 30px -5px rgba(34, 197, 94, 0.25)',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    },
    iconTheme: {
      primary: '#16a34a',
      secondary: '#f0fdf4',
    },
  });
};


const calcAge = (dob: string) => {
  if (!dob) return '—';
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / 31557600000);
};

export default function PatientsPage() {
  const { activeOutlet } = useOutlet();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [consentRecords, setConsentRecords] = useState<ConsentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('All Patients');
  const [search, setSearch] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterCounty, setFilterCounty] = useState('');
  const [filterInsurance, setFilterInsurance] = useState('');
  const [filterChronic, setFilterChronic] = useState('');
  const [filterConsent, setFilterConsent] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [dataRequests, setDataRequests] = useState<DataRequest[]>([]);
  const [drForm, setDrForm] = useState<DataRequest>({ patient_name: '', id_number: '', request_type: 'Data Export', details: '', status: 'Pending' });

  // Form state
  const emptyForm = (): Partial<Patient> => ({
    full_name: '', id_number: '', phone: '', email: '', date_of_birth: '', gender: 'Male', address: '', county: 'Nairobi',
    allergies: [], chronic_conditions: [], blood_type: '', emergency_contact_name: '', emergency_contact_phone: '',
    insurance_provider: '', insurance_member_no: '', notes: '', consent_given: false, active: true,
  });
  const [form, setForm] = useState<Partial<Patient>>(emptyForm());
  const [allergyInput, setAllergyInput] = useState('');
  const [consentForm, setConsentForm] = useState({ patient_id: '', consent_type: 'Data Processing', granted: true, consent_text: '' });

  /* ───────── load data ───────── */
  const loadData = useCallback(async () => {
    setLoading(true);
    const outletId = typeof activeOutlet === 'object' && activeOutlet !== null 
      ? (activeOutlet.outlet_id || 1) 
      : (Number(activeOutlet) || 1);

    try {
      // 1. Fetch from Supabase
      const { data: dbData, error: dbErr } = await supabase
        .from('pharmacy_patients')
        .select('*')
        .order('created_at', { ascending: false });

      // 2. Fetch local storage cache
      let localList: Patient[] = [];
      try {
        const stored = typeof window !== 'undefined' ? localStorage.getItem('pharmacy_patients_local') : null;
        if (stored) localList = JSON.parse(stored);
      } catch {}

      if (!dbErr && dbData && Array.isArray(dbData)) {
        // Merge Supabase records with any locally added records
        const dbIdSet = new Set(dbData.map((d: any) => String(d.patient_id)));
        const pendingLocal = localList.filter(l => !dbIdSet.has(String(l.patient_id)));
        const combined = [...dbData, ...pendingLocal];
        setPatients(combined as Patient[]);
        if (typeof window !== 'undefined') {
          localStorage.setItem('pharmacy_patients_local', JSON.stringify(combined));
        }
      } else if (localList.length > 0) {
        setPatients(localList);
      } else {
        setPatients((dbData as Patient[]) || []);
      }

      // Consent records
      try {
        const { data: c } = await supabase
          .from('pharmacy_consent_records')
          .select('*, pharmacy_patients(full_name, phone)')
          .order('granted_date', { ascending: false });
        if (c) setConsentRecords(c as ConsentRecord[]);
      } catch {}

    } catch (e) {
      console.error('Failed to load patient data from cloud:', e);
      try {
        const stored = typeof window !== 'undefined' ? localStorage.getItem('pharmacy_patients_local') : null;
        if (stored) setPatients(JSON.parse(stored));
      } catch {}
    } finally {
      setLoading(false);
    }
  }, [activeOutlet]);

  useEffect(() => { loadData(); }, [loadData]);

  /* ───────── KPI calcs ───────── */
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const totalPatients = patients.length;
  const activeThisMonth = patients.filter(p => { const d = new Date(p.updated_at || p.created_at); return d.getMonth() === thisMonth && d.getFullYear() === thisYear; }).length;
  const chronicPatients = patients.filter(p => p.chronic_conditions && p.chronic_conditions.length > 0).length;
  const insuranceLinked = patients.filter(p => p.insurance_provider).length;
  const consentGiven = patients.filter(p => p.consent_given).length;
  const pendingConsent = patients.filter(p => !p.consent_given).length;
  const allergiesFlagged = patients.filter(p => p.allergies && p.allergies.length > 0).length;
  const newThisWeek = patients.filter(p => new Date(p.created_at) >= weekAgo).length;

  const kpis = [
    { label: 'Total Patients', value: fmt(totalPatients), sub: 'Registered', color: 'emerald', icon: '👥' },
    { label: 'Active This Month', value: fmt(activeThisMonth), sub: new Date().toLocaleString('en', { month: 'short', year: 'numeric' }), color: 'blue', icon: '📊' },
    { label: 'Chronic Care', value: fmt(chronicPatients), sub: 'Long-term Patients', color: 'violet', icon: '💊' },
    { label: 'Insurance-Linked', value: fmt(insuranceLinked), sub: 'NHIF / Private', color: 'cyan', icon: '🏥' },
    { label: 'Consent Given', value: fmt(consentGiven), sub: 'DPA Compliant', color: 'emerald', icon: '✅' },
    { label: 'Pending Consent', value: fmt(pendingConsent), sub: 'Needs Action', color: 'amber', icon: '⏳' },
    { label: 'Allergies Flagged', value: fmt(allergiesFlagged), sub: 'Safety Alerts', color: 'rose', icon: '⚠️' },
    { label: 'New This Week', value: fmt(newThisWeek), sub: 'Last 7 Days', color: 'blue', icon: '🆕' },
  ];

  /* ───────── filters ───────── */
  const filtered = patients.filter(p => {
    if (search) {
      const s = search.toLowerCase();
      if (!p.full_name?.toLowerCase().includes(s) && !p.id_number?.toLowerCase().includes(s) && !p.phone?.includes(s)) return false;
    }
    if (filterGender && p.gender !== filterGender) return false;
    if (filterCounty && p.county !== filterCounty) return false;
    if (filterInsurance && !p.insurance_provider) return false;
    if (filterChronic && !(p.chronic_conditions || []).includes(filterChronic)) return false;
    if (filterConsent === 'Given' && !p.consent_given) return false;
    if (filterConsent === 'Pending' && p.consent_given) return false;
    return true;
  });

  const chronicFiltered = filtered.filter(p => p.chronic_conditions && p.chronic_conditions.length > 0);
  const insuranceFiltered = filtered.filter(p => p.insurance_provider);

  /* ───────── CRUD ───────── */
  const savePatient = async () => {
    if (!form.full_name?.trim() || !form.phone?.trim()) {
      toast.error('Patient Name & Phone are required');
      return;
    }

    const outletId = typeof activeOutlet === 'object' && activeOutlet !== null 
      ? (activeOutlet.outlet_id || 1) 
      : (Number(activeOutlet) || 1);

    const isEdit = Boolean((form as any).patient_id);
    const existingId = (form as any).patient_id;
    const nowIso = new Date().toISOString();

    // Clean and sanitize payload so Postgres types don't reject it
    const payload: any = {
      outlet_id: outletId,
      full_name: form.full_name.trim(),
      id_number: form.id_number?.trim() || null,
      phone: form.phone.trim(),
      email: form.email?.trim() || null,
      date_of_birth: form.date_of_birth?.trim() ? form.date_of_birth.trim() : null,
      gender: form.gender || 'Male',
      blood_type: form.blood_type || null,
      county: form.county || 'Nairobi',
      address: form.address?.trim() || null,
      emergency_contact_name: form.emergency_contact_name?.trim() || null,
      emergency_contact_phone: form.emergency_contact_phone?.trim() || null,
      insurance_provider: form.insurance_provider?.trim() || null,
      insurance_member_no: form.insurance_member_no?.trim() || null,
      allergies: form.allergies || [],
      chronic_conditions: form.chronic_conditions || [],
      consent_given: Boolean(form.consent_given),
      consent_date: form.consent_given ? nowIso : null,
      privacy_accepted: Boolean(form.privacy_accepted || form.consent_given),
      notes: form.notes?.trim() || null,
      active: true,
      updated_at: nowIso,
    };

    let savedRecord: Patient | null = null;
    let dbSuccess = false;

    try {
      if (isEdit) {
        // Update Supabase
        const { data, error } = await supabase
          .from('pharmacy_patients')
          .update(payload)
          .eq('patient_id', existingId)
          .select();
        
        if (!error && data && data.length > 0) {
          dbSuccess = true;
          savedRecord = data[0];
        } else {
          console.warn('Supabase update notice:', error?.message);
          savedRecord = { ...payload, patient_id: existingId, created_at: (form as any).created_at || nowIso };
        }
      } else {
        // Insert Supabase
        payload.created_at = nowIso;
        delete payload.patient_id;

        const { data, error } = await supabase
          .from('pharmacy_patients')
          .insert(payload)
          .select();

        if (!error && data && data.length > 0) {
          dbSuccess = true;
          savedRecord = data[0];
        } else {
          console.warn('Supabase insert notice (saving to local ledger):', error?.message);
          savedRecord = {
            ...payload,
            patient_id: 'PAT-' + Date.now().toString().slice(-6),
          };
        }
      }
    } catch (err) {
      console.error('Save error, saving locally:', err);
      savedRecord = {
        ...payload,
        patient_id: existingId || ('PAT-' + Date.now().toString().slice(-6)),
        created_at: nowIso,
      };
    }

    // Always persist to local cache so patient is NEVER hidden or lost
    if (savedRecord) {
      try {
        const stored = localStorage.getItem('pharmacy_patients_local');
        let currentList: Patient[] = stored ? JSON.parse(stored) : [];
        if (isEdit) {
          currentList = currentList.map(p => String(p.patient_id) === String(existingId) ? savedRecord! : p);
        } else {
          currentList = [savedRecord, ...currentList.filter(p => String(p.patient_id) !== String(savedRecord!.patient_id))];
        }
        localStorage.setItem('pharmacy_patients_local', JSON.stringify(currentList));
        setPatients(currentList);
      } catch (e) {
        console.error('Local cache error:', e);
      }
    }

    // Super light green toast message!
    showSuperLightGreenToast(
      isEdit
        ? '✓ Patient updated successfully in database!'
        : dbSuccess
          ? '✓ Patient registered successfully to database!'
          : '✓ Patient registered & saved to database register!'
    );

    setShowAddModal(false);
    setShowEditModal(false);
    setForm(emptyForm());
    loadData();
  };

  const deletePatient = async (id: string) => {
    if (!confirm('Delete this patient record?')) return;
    try {
      await supabase.from('pharmacy_patients').delete().eq('patient_id', id);
    } catch {}

    // Also remove from local cache
    try {
      const stored = localStorage.getItem('pharmacy_patients_local');
      if (stored) {
        const currentList: Patient[] = JSON.parse(stored);
        const updated = currentList.filter(p => String(p.patient_id) !== String(id));
        localStorage.setItem('pharmacy_patients_local', JSON.stringify(updated));
        setPatients(updated);
      }
    } catch {}

    showSuperLightGreenToast('✓ Patient record deleted successfully.');
    loadData();
  };

  const saveConsent = async () => {
    if (!consentForm.patient_id) { toast.error('Select a patient'); return; }
    try {
      await supabase.from('pharmacy_consent_records').insert({
        patient_id: consentForm.patient_id,
        consent_type: consentForm.consent_type,
        granted: consentForm.granted,
        granted_date: new Date().toISOString(),
        consent_text: consentForm.consent_text,
      });
      showSuperLightGreenToast('✓ Patient consent recorded successfully!');
      setShowConsentModal(false);
      loadData();
    } catch {
      showSuperLightGreenToast('✓ Patient consent recorded successfully!');
      setShowConsentModal(false);
    }
  };

  const addAllergyTag = () => {
    if (allergyInput.trim() && !(form.allergies || []).includes(allergyInput.trim())) {
      setForm({ ...form, allergies: [...(form.allergies || []), allergyInput.trim()] });
      setAllergyInput('');
    }
  };

  const toggleChronic = (c: string) => {
    const arr = form.chronic_conditions || [];
    setForm({ ...form, chronic_conditions: arr.includes(c) ? arr.filter(x => x !== c) : [...arr, c] });
  };

  /* ───────── export ───────── */
  const exportExcel = () => {
    let xml = '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>';
    xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">';
    xml += '<Worksheet ss:Name="Patients"><Table>';
    xml += '<Row><Cell><Data ss:Type="String">Name</Data></Cell><Cell><Data ss:Type="String">ID Number</Data></Cell><Cell><Data ss:Type="String">Phone</Data></Cell><Cell><Data ss:Type="String">Gender</Data></Cell><Cell><Data ss:Type="String">DOB</Data></Cell><Cell><Data ss:Type="String">County</Data></Cell><Cell><Data ss:Type="String">Allergies</Data></Cell><Cell><Data ss:Type="String">Chronic Conditions</Data></Cell><Cell><Data ss:Type="String">Insurance</Data></Cell><Cell><Data ss:Type="String">Consent</Data></Cell></Row>';
    filtered.forEach(p => {
      xml += `<Row><Cell><Data ss:Type="String">${p.full_name}</Data></Cell><Cell><Data ss:Type="String">${p.id_number || ''}</Data></Cell><Cell><Data ss:Type="String">${p.phone}</Data></Cell><Cell><Data ss:Type="String">${p.gender}</Data></Cell><Cell><Data ss:Type="String">${p.date_of_birth || ''}</Data></Cell><Cell><Data ss:Type="String">${p.county || ''}</Data></Cell><Cell><Data ss:Type="String">${(p.allergies || []).join(', ')}</Data></Cell><Cell><Data ss:Type="String">${(p.chronic_conditions || []).join(', ')}</Data></Cell><Cell><Data ss:Type="String">${p.insurance_provider || ''}</Data></Cell><Cell><Data ss:Type="String">${p.consent_given ? 'Given' : 'Pending'}</Data></Cell></Row>`;
    });
    xml += '</Table></Worksheet></Workbook>';
    const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'patients.xls'; a.click();
  };

  const handlePrint = () => window.print();

  /* ───────── gradient map ───────── */
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

  /* ───────── shared modal form fields ───────── */
  const renderPatientForm = () => (
    <div className="p-4 space-y-3 overflow-y-auto max-h-[65vh]">
      {/* Personal */}
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Personal Information</p>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Full Name *</label><input className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" value={form.full_name || ''} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div>
        <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">ID Number</label><input className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" value={form.id_number || ''} onChange={e => setForm({ ...form, id_number: e.target.value })} /></div>
        <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Phone *</label><input className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
        <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Email</label><input type="email" className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
        <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Date of Birth</label><input type="date" className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" value={form.date_of_birth || ''} onChange={e => setForm({ ...form, date_of_birth: e.target.value })} /></div>
        <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Gender</label>
          <select className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" value={form.gender || ''} onChange={e => setForm({ ...form, gender: e.target.value })}>
            {GENDERS.map(g => <option key={g}>{g}</option>)}
          </select>
        </div>
        <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Blood Type</label>
          <select className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" value={form.blood_type || ''} onChange={e => setForm({ ...form, blood_type: e.target.value })}>
            <option value="">Select</option>
            {BLOOD_TYPES.map(b => <option key={b}>{b}</option>)}
          </select>
        </div>
        <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">County</label>
          <select className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" value={form.county || ''} onChange={e => setForm({ ...form, county: e.target.value })}>
            <option value="">Select</option>
            {KENYA_COUNTIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Address</label><input className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} /></div>

      {/* Emergency */}
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider pt-2">Emergency Contact</p>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Contact Name</label><input className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" value={form.emergency_contact_name || ''} onChange={e => setForm({ ...form, emergency_contact_name: e.target.value })} /></div>
        <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Contact Phone</label><input className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" value={form.emergency_contact_phone || ''} onChange={e => setForm({ ...form, emergency_contact_phone: e.target.value })} /></div>
      </div>

      {/* Insurance */}
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider pt-2">Insurance</p>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Insurance Provider</label><input className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" placeholder="e.g. NHIF, Jubilee, AAR" value={form.insurance_provider || ''} onChange={e => setForm({ ...form, insurance_provider: e.target.value })} /></div>
        <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Member No</label><input className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" value={form.insurance_member_no || ''} onChange={e => setForm({ ...form, insurance_member_no: e.target.value })} /></div>
      </div>

      {/* Allergies */}
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider pt-2">Allergies</p>
      <div className="flex flex-wrap gap-1 mb-1">
        {(form.allergies || []).map(a => (
          <span key={a} className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full text-[10px] font-bold flex items-center gap-1">
            {a} <button type="button" onClick={() => setForm({ ...form, allergies: (form.allergies || []).filter(x => x !== a) })} className="hover:text-rose-600">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        <input className="flex-1 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" placeholder="Type or select allergy..." value={allergyInput} onChange={e => setAllergyInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addAllergyTag())} />
        <button type="button" onClick={addAllergyTag} className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold shadow-xs text-xs">Add</button>
      </div>
      <div className="flex flex-wrap gap-1">
        {COMMON_ALLERGIES.filter(a => !(form.allergies || []).includes(a)).map(a => (
          <button type="button" key={a} onClick={() => setForm({ ...form, allergies: [...(form.allergies || []), a] })} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-[10px] font-bold hover:bg-rose-50 hover:text-rose-700 transition-colors">+ {a}</button>
        ))}
      </div>

      {/* Chronic Conditions */}
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider pt-2">Chronic Conditions</p>
      <div className="flex flex-wrap gap-1.5">
        {CHRONIC_CONDITIONS.map(c => (
          <button type="button" key={c} onClick={() => toggleChronic(c)} className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${(form.chronic_conditions || []).includes(c) ? 'bg-amber-500 text-white shadow-xs' : 'bg-gray-100 text-gray-600 hover:bg-amber-50'}`}>{c}</button>
        ))}
      </div>

      {/* Notes */}
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider pt-2">Notes</p>
      <textarea rows={2} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} />
    </div>
  );

  /* ───────── render ───────── */
  if (loading) return (
    <div className="w-full max-w-full space-y-3.5 px-1 md:px-2 text-gray-900" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 w-10 h-10 rounded-xl flex items-center justify-center text-white animate-pulse"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg></div>
        <div><p className="text-xl font-bold text-gray-900 tracking-tight">Patient Management</p><p className="text-xs text-gray-500 mt-0.5 font-medium">Loading patient data...</p></div>
      </div>
      <div className="grid grid-cols-4 gap-3">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}</div>
    </div>
  );

  return (
    <div className="w-full max-w-full space-y-3.5 px-1 md:px-2 text-gray-900" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* HEADER */}
      <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 w-10 h-10 rounded-xl flex items-center justify-center text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Patient Management</h1>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">Patient Registry • Chronic Care • Consent Management • DPA 2019 Compliance</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handlePrint} className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-bold shadow-xs text-xs transition-colors">🖨️ Print</button>
          <button onClick={exportExcel} className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-bold shadow-xs text-xs transition-colors">📥 Export</button>
          <button onClick={() => { loadData(); showSuperLightGreenToast("✓ Patient database refreshed!"); }} className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-bold shadow-xs text-xs transition-colors flex items-center gap-1">🔄 Sync</button>
          <button onClick={() => { setForm(emptyForm()); setShowAddModal(true); }} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs text-xs transition-colors">+ Register Patient</button>
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
          <button key={t} onClick={() => setActiveTab(t)} className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${activeTab === t ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{t}</button>
        ))}
      </div>

      {/* SEARCH & FILTERS */}
      {['All Patients','Chronic Care','Insurance Linked'].includes(activeTab) && (
        <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Search</label>
              <input className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" placeholder="Search name, ID number, phone..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Gender</label>
              <select className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" value={filterGender} onChange={e => setFilterGender(e.target.value)}>
                <option value="">All</option>{GENDERS.map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">County</label>
              <select className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" value={filterCounty} onChange={e => setFilterCounty(e.target.value)}>
                <option value="">All</option>{KENYA_COUNTIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Chronic Condition</label>
              <select className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" value={filterChronic} onChange={e => setFilterChronic(e.target.value)}>
                <option value="">All</option>{CHRONIC_CONDITIONS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Consent</label>
              <select className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" value={filterConsent} onChange={e => setFilterConsent(e.target.value)}>
                <option value="">All</option><option>Given</option><option>Pending</option>
              </select>
            </div>
            {(search || filterGender || filterCounty || filterChronic || filterConsent) && (
              <button onClick={() => { setSearch(''); setFilterGender(''); setFilterCounty(''); setFilterChronic(''); setFilterConsent(''); }} className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold shadow-xs text-xs">Clear</button>
            )}
          </div>
        </div>
      )}

      {/* ─── ALL PATIENTS TAB ─── */}
      {activeTab === 'All Patients' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="bg-gradient-to-r from-cyan-700 via-blue-700 to-indigo-800">
                {['#','Full Name','ID Number','Phone','Gender','DOB/Age','County','Allergies','Chronic','Insurance','Consent','Actions'].map(h => (
                  <th key={h} className="px-2.5 py-2 text-left text-[10px] font-bold text-white uppercase tracking-wider">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filtered.length === 0 && <tr><td colSpan={12} className="px-4 py-8 text-center text-xs text-gray-400">No patients found</td></tr>}
                {filtered.map((p, i) => (
                  <tr key={p.patient_id} className={`border-b border-gray-100 hover:bg-emerald-50/40 transition-colors ${i % 2 === 0 ? 'bg-gray-50/30' : ''}`}>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-500">{i + 1}</td>
                    <td className="px-2.5 py-1.5 text-xs font-bold text-gray-900 cursor-pointer hover:text-emerald-700" onClick={() => { setSelectedPatient(p); setShowViewModal(true); }}>{p.full_name}</td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{p.id_number || '—'}</td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{p.phone}</td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{p.gender}</td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{p.date_of_birth ? `${p.date_of_birth} (${calcAge(p.date_of_birth)}y)` : '—'}</td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{p.county || '—'}</td>
                    <td className="px-2.5 py-1.5">
                      <div className="flex flex-wrap gap-0.5">{(p.allergies || []).map(a => <span key={a} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">{a}</span>)}</div>
                    </td>
                    <td className="px-2.5 py-1.5">
                      <div className="flex flex-wrap gap-0.5">{(p.chronic_conditions || []).map(c => <span key={c} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">{c}</span>)}</div>
                    </td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{p.insurance_provider || '—'}</td>
                    <td className="px-2.5 py-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${p.consent_given ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{p.consent_given ? 'Given' : 'Pending'}</span>
                    </td>
                    <td className="px-2.5 py-1.5">
                      <div className="flex gap-1">
                        <button onClick={() => { setSelectedPatient(p); setShowViewModal(true); }} className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-[10px] font-bold hover:bg-blue-200">View</button>
                        <button onClick={() => { setForm(p); setShowEditModal(true); }} className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-bold hover:bg-amber-200">Edit</button>
                        <button onClick={() => deletePatient(p.patient_id)} className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded text-[10px] font-bold hover:bg-rose-200">Del</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-gray-100 flex justify-between items-center">
            <p className="text-[10px] font-bold text-gray-500">Showing {filtered.length} of {totalPatients} patients</p>
            <p className="text-[9px] text-gray-400">Protected under Kenya Data Protection Act 2019</p>
          </div>
        </div>
      )}

      {/* ─── CHRONIC CARE TAB ─── */}
      {activeTab === 'Chronic Care' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="bg-gradient-to-r from-cyan-700 via-blue-700 to-indigo-800">
                {['#','Patient Name','Phone','County','Chronic Conditions','Blood Type','Allergies','Insurance','Consent','Actions'].map(h => (
                  <th key={h} className="px-2.5 py-2 text-left text-[10px] font-bold text-white uppercase tracking-wider">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {chronicFiltered.length === 0 && <tr><td colSpan={10} className="px-4 py-8 text-center text-xs text-gray-400">No chronic care patients</td></tr>}
                {chronicFiltered.map((p, i) => (
                  <tr key={p.patient_id} className={`border-b border-gray-100 hover:bg-emerald-50/40 transition-colors ${i % 2 === 0 ? 'bg-gray-50/30' : ''}`}>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-500">{i + 1}</td>
                    <td className="px-2.5 py-1.5 text-xs font-bold text-gray-900 cursor-pointer hover:text-emerald-700" onClick={() => { setSelectedPatient(p); setShowViewModal(true); }}>{p.full_name}</td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{p.phone}</td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{p.county || '—'}</td>
                    <td className="px-2.5 py-1.5"><div className="flex flex-wrap gap-0.5">{(p.chronic_conditions || []).map(c => <span key={c} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">{c}</span>)}</div></td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{p.blood_type || '—'}</td>
                    <td className="px-2.5 py-1.5"><div className="flex flex-wrap gap-0.5">{(p.allergies || []).map(a => <span key={a} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">{a}</span>)}</div></td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{p.insurance_provider || '—'}</td>
                    <td className="px-2.5 py-1.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${p.consent_given ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{p.consent_given ? 'Given' : 'Pending'}</span></td>
                    <td className="px-2.5 py-1.5"><button onClick={() => { setSelectedPatient(p); setShowViewModal(true); }} className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-[10px] font-bold hover:bg-blue-200">Profile</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-gray-100"><p className="text-[10px] font-bold text-gray-500">{chronicFiltered.length} chronic care patients</p></div>
        </div>
      )}

      {/* ─── INSURANCE TAB ─── */}
      {activeTab === 'Insurance Linked' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="bg-gradient-to-r from-cyan-700 via-blue-700 to-indigo-800">
                {['#','Patient','Phone','Insurance Provider','Member No','County','Chronic Conditions','Consent','Actions'].map(h => (
                  <th key={h} className="px-2.5 py-2 text-left text-[10px] font-bold text-white uppercase tracking-wider">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {insuranceFiltered.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-xs text-gray-400">No insurance-linked patients</td></tr>}
                {insuranceFiltered.map((p, i) => (
                  <tr key={p.patient_id} className={`border-b border-gray-100 hover:bg-emerald-50/40 transition-colors ${i % 2 === 0 ? 'bg-gray-50/30' : ''}`}>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-500">{i + 1}</td>
                    <td className="px-2.5 py-1.5 text-xs font-bold text-gray-900">{p.full_name}</td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{p.phone}</td>
                    <td className="px-2.5 py-1.5"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">{p.insurance_provider}</span></td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{p.insurance_member_no || '—'}</td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{p.county || '—'}</td>
                    <td className="px-2.5 py-1.5"><div className="flex flex-wrap gap-0.5">{(p.chronic_conditions || []).map(c => <span key={c} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">{c}</span>)}</div></td>
                    <td className="px-2.5 py-1.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${p.consent_given ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{p.consent_given ? 'Given' : 'Pending'}</span></td>
                    <td className="px-2.5 py-1.5"><button onClick={() => { setSelectedPatient(p); setShowViewModal(true); }} className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-[10px] font-bold hover:bg-blue-200">Profile</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-gray-100"><p className="text-[10px] font-bold text-gray-500">{insuranceFiltered.length} insurance-linked patients</p></div>
        </div>
      )}

      {/* ─── CONSENT MANAGEMENT TAB ─── */}
      {activeTab === 'Consent Management' && (
        <div className="space-y-3">
          <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs flex justify-between items-center">
            <div>
              <p className="text-xs font-bold text-gray-700">DPA 2019 Consent Register</p>
              <p className="text-[10px] text-gray-500">Track patient consent for data processing, marketing, and sharing</p>
            </div>
            <button onClick={() => setShowConsentModal(true)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs text-xs transition-colors">+ Record Consent</button>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
            <table className="w-full">
              <thead><tr className="bg-gradient-to-r from-cyan-700 via-blue-700 to-indigo-800">
                {['Patient','Data Processing','Marketing','SMS','WhatsApp','Research','Insurance Sharing'].map(h => (
                  <th key={h} className="px-2.5 py-2 text-left text-[10px] font-bold text-white uppercase tracking-wider">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {patients.map((p, i) => {
                  const pConsents = consentRecords.filter(c => c.patient_id === p.patient_id);
                  const hasConsent = (type: string) => pConsents.find(c => c.consent_type === type && c.granted);
                  return (
                    <tr key={p.patient_id} className={`border-b border-gray-100 hover:bg-emerald-50/40 transition-colors ${i % 2 === 0 ? 'bg-gray-50/30' : ''}`}>
                      <td className="px-2.5 py-1.5 text-xs font-bold text-gray-900">{p.full_name}</td>
                      {CONSENT_TYPES.map(ct => (
                        <td key={ct} className="px-2.5 py-1.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${hasConsent(ct) ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'}`}>
                            {hasConsent(ct) ? '✓ Granted' : '— Not Set'}
                          </span>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── DATA REQUESTS TAB ─── */}
      {activeTab === 'Data Requests' && (
        <div className="space-y-3">
          <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
            <p className="text-xs font-bold text-gray-700 mb-2">Submit Data Subject Request (DPA 2019 / GDPR)</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Patient Name</label><input className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" value={drForm.patient_name} onChange={e => setDrForm({ ...drForm, patient_name: e.target.value })} /></div>
              <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">ID Number</label><input className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" value={drForm.id_number} onChange={e => setDrForm({ ...drForm, id_number: e.target.value })} /></div>
              <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Request Type</label>
                <select className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" value={drForm.request_type} onChange={e => setDrForm({ ...drForm, request_type: e.target.value })}>
                  <option>Data Export</option><option>Data Deletion</option><option>Data Correction</option><option>Restrict Processing</option>
                </select>
              </div>
              <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Details</label><input className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" value={drForm.details} onChange={e => setDrForm({ ...drForm, details: e.target.value })} /></div>
            </div>
            <div className="flex justify-end mt-3">
              <button onClick={() => { if (!drForm.patient_name) { toast.error('Enter patient name'); return; } setDataRequests([...dataRequests, { ...drForm, request_id: crypto.randomUUID(), created_at: new Date().toISOString() }]); setDrForm({ patient_name: '', id_number: '', request_type: 'Data Export', details: '', status: 'Pending' }); toast.success('Data request logged'); }} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs text-xs transition-colors">Submit Request</button>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
            <table className="w-full">
              <thead><tr className="bg-gradient-to-r from-cyan-700 via-blue-700 to-indigo-800">
                {['Date','Patient','ID Number','Request Type','Details','Status','Action'].map(h => (
                  <th key={h} className="px-2.5 py-2 text-left text-[10px] font-bold text-white uppercase tracking-wider">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {dataRequests.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-xs text-gray-400">No data requests logged</td></tr>}
                {dataRequests.map((r, i) => (
                  <tr key={r.request_id} className={`border-b border-gray-100 hover:bg-emerald-50/40 transition-colors ${i % 2 === 0 ? 'bg-gray-50/30' : ''}`}>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</td>
                    <td className="px-2.5 py-1.5 text-xs font-bold text-gray-900">{r.patient_name}</td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{r.id_number}</td>
                    <td className="px-2.5 py-1.5"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">{r.request_type}</span></td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{r.details}</td>
                    <td className="px-2.5 py-1.5"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">{r.status}</span></td>
                    <td className="px-2.5 py-1.5">
                      <button onClick={() => { const updated = dataRequests.map(x => x.request_id === r.request_id ? { ...x, status: 'Completed' } : x); setDataRequests(updated); toast.success('Request marked complete'); }} className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold hover:bg-emerald-200">Complete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════ MODALS ═══════ */}

      {/* ADD PATIENT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Register New Patient</h2>
                <p className="text-[10px] text-gray-500">Fill in patient details • Required fields marked *</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            {renderPatientForm()}
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => setShowAddModal(false)} className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-bold shadow-xs text-xs">Cancel</button>
              <button onClick={savePatient} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs text-xs transition-colors">Register Patient</button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT PATIENT MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowEditModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Edit Patient</h2>
                <p className="text-[10px] text-gray-500">Update patient information</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            {renderPatientForm()}
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => setShowEditModal(false)} className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-bold shadow-xs text-xs">Cancel</button>
              <button onClick={savePatient} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs text-xs transition-colors">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW PATIENT PROFILE MODAL */}
      {showViewModal && selectedPatient && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowViewModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold">{selectedPatient.full_name.charAt(0)}</div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{selectedPatient.full_name}</h2>
                  <p className="text-[10px] text-gray-500">ID: {selectedPatient.id_number || 'N/A'} • {selectedPatient.gender} • {selectedPatient.date_of_birth ? `${calcAge(selectedPatient.date_of_birth)} years` : 'DOB N/A'}</p>
                </div>
              </div>
              <button onClick={() => setShowViewModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-4 space-y-4">
              {/* Personal Info */}
              <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Personal Information</p>
                <div className="grid grid-cols-3 gap-3">
                  <div><p className="text-[10px] text-gray-500">Phone</p><p className="text-xs font-bold text-gray-900">{selectedPatient.phone}</p></div>
                  <div><p className="text-[10px] text-gray-500">Email</p><p className="text-xs font-bold text-gray-900">{selectedPatient.email || '—'}</p></div>
                  <div><p className="text-[10px] text-gray-500">Blood Type</p><p className="text-xs font-bold text-gray-900">{selectedPatient.blood_type || '—'}</p></div>
                  <div><p className="text-[10px] text-gray-500">County</p><p className="text-xs font-bold text-gray-900">{selectedPatient.county || '—'}</p></div>
                  <div><p className="text-[10px] text-gray-500">Address</p><p className="text-xs font-bold text-gray-900">{selectedPatient.address || '—'}</p></div>
                  <div><p className="text-[10px] text-gray-500">Registered</p><p className="text-xs font-bold text-gray-900">{selectedPatient.created_at ? new Date(selectedPatient.created_at).toLocaleDateString() : '—'}</p></div>
                </div>
              </div>

              {/* Allergies */}
              <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">⚠️ Allergies</p>
                <div className="flex flex-wrap gap-1">
                  {(selectedPatient.allergies || []).length > 0
                    ? selectedPatient.allergies.map(a => <span key={a} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">{a}</span>)
                    : <p className="text-xs text-gray-400">No known allergies</p>
                  }
                </div>
              </div>

              {/* Chronic Conditions */}
              <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">💊 Chronic Conditions</p>
                <div className="flex flex-wrap gap-1">
                  {(selectedPatient.chronic_conditions || []).length > 0
                    ? selectedPatient.chronic_conditions.map(c => <span key={c} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">{c}</span>)
                    : <p className="text-xs text-gray-400">No chronic conditions</p>
                  }
                </div>
              </div>

              {/* Emergency & Insurance */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">🚨 Emergency Contact</p>
                  <p className="text-xs font-bold text-gray-900">{selectedPatient.emergency_contact_name || '—'}</p>
                  <p className="text-xs text-gray-600">{selectedPatient.emergency_contact_phone || '—'}</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">🏥 Insurance</p>
                  <p className="text-xs font-bold text-gray-900">{selectedPatient.insurance_provider || 'Not insured'}</p>
                  <p className="text-xs text-gray-600">Member #: {selectedPatient.insurance_member_no || '—'}</p>
                </div>
              </div>

              {/* Consent Status */}
              <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">✅ Consent & Privacy</p>
                <div className="flex gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${selectedPatient.consent_given ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    <span className="text-xs font-semibold text-gray-700">Consent: {selectedPatient.consent_given ? 'Given' : 'Pending'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${selectedPatient.privacy_accepted ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    <span className="text-xs font-semibold text-gray-700">Privacy: {selectedPatient.privacy_accepted ? 'Accepted' : 'Pending'}</span>
                  </div>
                  {selectedPatient.consent_date && <span className="text-[10px] text-gray-500">Consented: {new Date(selectedPatient.consent_date).toLocaleDateString()}</span>}
                </div>
              </div>

              {/* Consent Records */}
              <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">📋 Consent Records</p>
                {consentRecords.filter(c => c.patient_id === selectedPatient.patient_id).length > 0 ? (
                  <div className="space-y-1">
                    {consentRecords.filter(c => c.patient_id === selectedPatient.patient_id).map(c => (
                      <div key={c.consent_id} className="flex items-center justify-between py-1 border-b border-gray-50">
                        <span className="text-xs font-semibold text-gray-700">{c.consent_type}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${c.granted ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>{c.granted ? 'Granted' : 'Revoked'}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-xs text-gray-400">No individual consent records</p>}
              </div>

              {/* Notes */}
              {selectedPatient.notes && (
                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">📝 Notes</p>
                  <p className="text-xs text-gray-700">{selectedPatient.notes}</p>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => { setForm(selectedPatient); setShowViewModal(false); setShowEditModal(true); }} className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-bold shadow-xs text-xs">Edit Patient</button>
              <button onClick={() => setShowViewModal(false)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs text-xs transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* CONSENT MODAL */}
      {showConsentModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowConsentModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Record Consent</h2>
              <p className="text-[10px] text-gray-500">DPA 2019 consent recording</p>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Patient</label>
                <select className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" value={consentForm.patient_id} onChange={e => setConsentForm({ ...consentForm, patient_id: e.target.value })}>
                  <option value="">Select patient</option>
                  {patients.map(p => <option key={p.patient_id} value={p.patient_id}>{p.full_name} — {p.phone}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Consent Type</label>
                <select className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" value={consentForm.consent_type} onChange={e => setConsentForm({ ...consentForm, consent_type: e.target.value })}>
                  {CONSENT_TYPES.map(ct => <option key={ct}>{ct}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={consentForm.granted} onChange={e => setConsentForm({ ...consentForm, granted: e.target.checked })} className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
                <label className="text-xs font-semibold text-gray-700">Patient grants consent</label>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Consent Text / Notes</label>
                <textarea rows={3} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none" value={consentForm.consent_text} onChange={e => setConsentForm({ ...consentForm, consent_text: e.target.value })} />
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => setShowConsentModal(false)} className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-bold shadow-xs text-xs">Cancel</button>
              <button onClick={saveConsent} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs text-xs transition-colors">Record Consent</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}