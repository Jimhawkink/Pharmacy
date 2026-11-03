'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend, Filler);

/* ═══════════════════════════════════════════════════════════════
   CUSTOMER LOYALTY & ENGAGEMENT
   Points • Tiers • SMS Reminders • Feedback
   ═══════════════════════════════════════════════════════════════ */

type Member = { loyalty_id: number; patient_id: number; outlet_id: number; membership_no: string; tier: string; total_points: number; redeemed_points: number; available_points: number; total_spent: number; visit_count: number; last_visit: string; join_date: string; sms_consent: boolean; whatsapp_consent: boolean; active: boolean; full_name?: string; phone?: string };
type LoyaltyTx = { transaction_id: number; loyalty_id: number; transaction_type: string; points: number; sale_id: number; description: string; created_at: string; member_name?: string };
type Patient = { patient_id: number; full_name: string; phone: string };

const TABS = ['All Members', 'Tier Overview', 'Transactions', 'SMS Campaigns', 'Feedback', 'Settings'] as const;
const TIERS = ['Bronze', 'Silver', 'Gold', 'Platinum'] as const;
const tierColor: Record<string, string> = { Bronze: 'bg-amber-100 text-amber-800', Silver: 'bg-gray-200 text-gray-800', Gold: 'bg-yellow-100 text-yellow-800', Platinum: 'bg-violet-100 text-violet-800' };
const tierBg: Record<string, string> = { Bronze: 'from-amber-50/80 via-orange-50/40', Silver: 'from-gray-50/80 via-slate-50/40', Gold: 'from-yellow-50/80 via-amber-50/40', Platinum: 'from-violet-50/80 via-purple-50/40' };
const tierThresholds = { Bronze: { min: 0, max: 999 }, Silver: { min: 1000, max: 4999 }, Gold: { min: 5000, max: 14999 }, Platinum: { min: 15000, max: Infinity } };
const txColor: Record<string, string> = { Earn: 'bg-emerald-100 text-emerald-800', Redeem: 'bg-blue-100 text-blue-800', Bonus: 'bg-violet-100 text-violet-800', Expire: 'bg-rose-100 text-rose-800' };

const fmt = (n: number) => n.toLocaleString('en-KE');
const fmtC = (n: number) => `KSh ${n.toLocaleString('en-KE', { minimumFractionDigits: 0 })}`;

export default function LoyaltyPage() {
  const { activeOutlet } = useOutlet();
  const oid = activeOutlet?.outlet_id || 1;
  const [tab, setTab] = useState<typeof TABS[number]>('All Members');
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [transactions, setTransactions] = useState<LoyaltyTx[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('All');
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [showPointsModal, setShowPointsModal] = useState(false);
  const [enrollPatientId, setEnrollPatientId] = useState<number>(0);
  const [enrollSms, setEnrollSms] = useState(true);
  const [enrollWa, setEnrollWa] = useState(false);
  const [manualMemberId, setManualMemberId] = useState<number>(0);
  const [manualPoints, setManualPoints] = useState<number>(0);
  const [manualType, setManualType] = useState('Bonus');
  const [manualDesc, setManualDesc] = useState('');
  // Feedback state
  const [feedbacks, setFeedbacks] = useState<{ id: number; name: string; rating: number; comment: string; date: string }[]>([]);
  const [fbName, setFbName] = useState(''); const [fbRating, setFbRating] = useState(5); const [fbComment, setFbComment] = useState('');
  // SMS Campaign state
  const [smsMsg, setSmsMsg] = useState(''); const [smsTier, setSmsTier] = useState('All'); const [campaigns, setCampaigns] = useState<{ msg: string; tier: string; count: number; date: string }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, t, p] = await Promise.all([
        supabase.from('pharmacy_loyalty').select('*').eq('outlet_id', oid).order('total_points', { ascending: false }),
        supabase.from('pharmacy_loyalty_transactions').select('*').order('created_at', { ascending: false }).limit(500),
        supabase.from('pharmacy_patients').select('patient_id, full_name, phone').eq('outlet_id', oid).eq('active', true),
      ]);
      const mData = (m.data || []) as Member[];
      const pData = (p.data || []) as Patient[];
      const pMap = new Map(pData.map(pt => [pt.patient_id, pt]));
      mData.forEach(mb => { const pt = pMap.get(mb.patient_id); mb.full_name = pt?.full_name || 'Unknown'; mb.phone = pt?.phone || '—'; });
      const txData = (t.data || []) as LoyaltyTx[];
      const mMap = new Map(mData.map(mb => [mb.loyalty_id, mb.full_name || '']));
      txData.forEach(tx => { tx.member_name = mMap.get(tx.loyalty_id) || '—'; });
      setMembers(mData);
      setTransactions(txData);
      setPatients(pData);
    } catch { toast.error('Failed to load'); }
    setLoading(false);
  }, [oid]);

  useEffect(() => { load(); }, [load]);

  // KPIs
  const kpis = useMemo(() => {
    const bronze = members.filter(m => m.tier === 'Bronze').length;
    const silver = members.filter(m => m.tier === 'Silver').length;
    const gold = members.filter(m => m.tier === 'Gold').length;
    const platinum = members.filter(m => m.tier === 'Platinum').length;
    const totalPts = members.reduce((s, m) => s + m.total_points, 0);
    const redeemed = members.reduce((s, m) => s + m.redeemed_points, 0);
    const active30 = members.filter(m => { if (!m.last_visit) return false; const d = new Date(m.last_visit); const ago = (Date.now() - d.getTime()) / 86400000; return ago <= 30; }).length;
    const avgPts = members.length > 0 ? Math.round(totalPts / members.length) : 0;
    return { total: members.length, bronze, silver, gold, platinum, totalPts, redeemed, active30, avgPts };
  }, [members]);

  // Filter
  const filtered = useMemo(() => members.filter(m => {
    if (tierFilter !== 'All' && m.tier !== tierFilter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (m.full_name || '').toLowerCase().includes(s) || m.membership_no.toLowerCase().includes(s) || (m.phone || '').includes(s);
  }), [members, search, tierFilter]);

  const filteredTx = useMemo(() => transactions.filter(t => {
    if (!search) return true;
    return (t.member_name || '').toLowerCase().includes(search.toLowerCase()) || (t.description || '').toLowerCase().includes(search.toLowerCase());
  }), [transactions, search]);

  // Enroll member
  const enroll = async () => {
    if (!enrollPatientId) { toast.error('Select a patient'); return; }
    const existing = members.find(m => m.patient_id === enrollPatientId);
    if (existing) { toast.error('Patient already enrolled'); return; }
    const membership_no = `ALP-${String(members.length + 1).padStart(4, '0')}`;
    const { error } = await supabase.from('pharmacy_loyalty').insert({ patient_id: enrollPatientId, outlet_id: oid, membership_no, tier: 'Bronze', total_points: 0, redeemed_points: 0, available_points: 0, total_spent: 0, visit_count: 0, join_date: new Date().toISOString().split('T')[0], sms_consent: enrollSms, whatsapp_consent: enrollWa, active: true });
    if (error) { toast.error('Failed to enroll'); return; }
    toast.success(`Enrolled as ${membership_no}`);
    setShowEnrollModal(false);
    load();
  };

  // Manual points
  const addManualPoints = async () => {
    if (!manualMemberId || !manualPoints) { toast.error('Fill all fields'); return; }
    const { error } = await supabase.from('pharmacy_loyalty_transactions').insert({ loyalty_id: manualMemberId, transaction_type: manualType, points: manualPoints, description: manualDesc || `Manual ${manualType}` });
    if (error) { toast.error('Failed'); return; }
    // Update member points
    const member = members.find(m => m.loyalty_id === manualMemberId);
    if (member) {
      const newTotal = member.total_points + (manualType === 'Redeem' || manualType === 'Expire' ? 0 : manualPoints);
      const newRedeemed = member.redeemed_points + (manualType === 'Redeem' ? manualPoints : 0);
      const newAvail = newTotal - newRedeemed;
      const newTier = newTotal >= 15000 ? 'Platinum' : newTotal >= 5000 ? 'Gold' : newTotal >= 1000 ? 'Silver' : 'Bronze';
      await supabase.from('pharmacy_loyalty').update({ total_points: newTotal, redeemed_points: newRedeemed, available_points: newAvail, tier: newTier }).eq('loyalty_id', manualMemberId);
    }
    toast.success('Points added');
    setShowPointsModal(false);
    setManualPoints(0); setManualDesc('');
    load();
  };

  // Add feedback
  const addFeedback = () => {
    if (!fbName) { toast.error('Enter name'); return; }
    setFeedbacks(prev => [{ id: Date.now(), name: fbName, rating: fbRating, comment: fbComment, date: new Date().toISOString().split('T')[0] }, ...prev]);
    toast.success('Feedback recorded');
    setFbName(''); setFbComment(''); setFbRating(5);
  };

  // Simulate SMS
  const sendCampaign = () => {
    if (!smsMsg) { toast.error('Enter message'); return; }
    const targets = smsTier === 'All' ? members : members.filter(m => m.tier === smsTier);
    const smsTargets = targets.filter(m => m.sms_consent);
    setCampaigns(prev => [{ msg: smsMsg, tier: smsTier, count: smsTargets.length, date: new Date().toISOString().split('T')[0] }, ...prev]);
    toast.success(`Campaign queued for ${smsTargets.length} members`);
    setSmsMsg('');
  };

  // Chart data
  const tierChartData = { labels: ['Bronze', 'Silver', 'Gold', 'Platinum'], datasets: [{ data: [kpis.bronze, kpis.silver, kpis.gold, kpis.platinum], backgroundColor: ['#f59e0b', '#9ca3af', '#eab308', '#8b5cf6'], borderWidth: 0 }] };
  const pointsChartData = { labels: ['Earned', 'Redeemed', 'Available'], datasets: [{ data: [kpis.totalPts, kpis.redeemed, kpis.totalPts - kpis.redeemed], backgroundColor: ['#10b981', '#3b82f6', '#f59e0b'], borderWidth: 0, borderRadius: 6 }] };

  const kpiCards = [
    { label: 'Total Members', value: kpis.total, sub: 'All enrolled', color: 'emerald', color2: 'teal' },
    { label: 'Bronze', value: kpis.bronze, sub: '0–999 pts', color: 'amber', color2: 'orange' },
    { label: 'Silver', value: kpis.silver, sub: '1K–4.9K pts', color: 'gray', color2: 'slate' },
    { label: 'Gold', value: kpis.gold, sub: '5K–14.9K pts', color: 'yellow', color2: 'amber' },
    { label: 'Platinum', value: kpis.platinum, sub: '15K+ pts', color: 'violet', color2: 'purple' },
    { label: 'Total Points', value: fmt(kpis.totalPts), sub: 'All earned', color: 'blue', color2: 'indigo' },
    { label: 'Active (30d)', value: kpis.active30, sub: 'Recent visitors', color: 'cyan', color2: 'sky' },
    { label: 'Avg Points', value: fmt(kpis.avgPts), sub: 'Per member', color: 'rose', color2: 'pink' },
  ];

  return (
    <div className="w-full max-w-full space-y-3.5 px-1 md:px-2 text-gray-900" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-amber-500 to-orange-600 w-10 h-10 rounded-xl flex items-center justify-center text-white shadow"><span className="text-lg">⭐</span></div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Customer Loyalty & Engagement</h1>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">Loyalty Points • Tier Rewards • SMS Campaigns • Customer Feedback</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowEnrollModal(true)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs text-xs">+ Enroll Member</button>
          <button onClick={() => setShowPointsModal(true)} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs text-xs">+ Manual Points</button>
          <button onClick={load} className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-bold shadow-xs text-xs">↻</button>
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

      {/* Tabs */}
      <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5 flex-wrap">{TABS.map(t => <button key={t} onClick={() => { setTab(t); setSearch(''); }} className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${tab === t ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>{t}</button>)}</div>
        {(tab === 'All Members' || tab === 'Transactions') && (
          <div className="flex gap-2">
            {tab === 'All Members' && <select value={tierFilter} onChange={e => setTierFilter(e.target.value)} className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700"><option value="All">All Tiers</option>{TIERS.map(t => <option key={t}>{t}</option>)}</select>}
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 w-48 focus:border-emerald-400 outline-none" />
          </div>
        )}
      </div>

      {loading ? <div className="text-center py-10 text-gray-400 font-bold">Loading...</div> : (
        <>
          {/* ═══ All Members ═══ */}
          {tab === 'All Members' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto"><table className="w-full"><thead><tr className="bg-gradient-to-r from-amber-600 via-orange-600 to-red-700">
                {['Member #','Name','Phone','Tier','Total Pts','Redeemed','Available','Spent (KSh)','Visits','Last Visit','SMS','WhatsApp'].map(h => <th key={h} className="px-2.5 py-2 text-left text-[10px] font-bold text-white uppercase tracking-wider">{h}</th>)}
              </tr></thead><tbody>
                {filtered.length === 0 ? <tr><td colSpan={12} className="text-center py-8 text-gray-400 text-sm font-semibold">No members found</td></tr> :
                filtered.map((m, i) => (
                  <tr key={m.loyalty_id} className={`border-b border-gray-100 hover:bg-amber-50/40 transition-colors ${i % 2 ? 'bg-gray-50/30' : ''}`}>
                    <td className="px-2.5 py-1.5 text-xs font-bold text-amber-700">{m.membership_no}</td>
                    <td className="px-2.5 py-1.5 text-xs font-bold text-gray-900">{m.full_name}</td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-600">{m.phone}</td>
                    <td className="px-2.5 py-1.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${tierColor[m.tier]}`}>{m.tier}</span></td>
                    <td className="px-2.5 py-1.5 text-xs font-bold text-gray-900">{fmt(m.total_points)}</td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-blue-700">{fmt(m.redeemed_points)}</td>
                    <td className="px-2.5 py-1.5 text-xs font-bold text-emerald-700">{fmt(m.available_points)}</td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{fmtC(m.total_spent)}</td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-700">{m.visit_count}</td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-600">{m.last_visit || '—'}</td>
                    <td className="px-2.5 py-1.5">{m.sms_consent ? <span className="text-emerald-600 font-bold text-[10px]">✓</span> : <span className="text-gray-400 text-[10px]">✗</span>}</td>
                    <td className="px-2.5 py-1.5">{m.whatsapp_consent ? <span className="text-emerald-600 font-bold text-[10px]">✓</span> : <span className="text-gray-400 text-[10px]">✗</span>}</td>
                  </tr>
                ))}
              </tbody></table></div>
              <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 text-[10px] font-bold text-gray-500">Showing {filtered.length} of {members.length} members</div>
            </div>
          )}

          {/* ═══ Tier Overview ═══ */}
          {tab === 'Tier Overview' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {TIERS.map(t => (
                  <div key={t} className={`bg-gradient-to-br ${tierBg[t]} to-white p-4 rounded-xl border border-gray-200 shadow-xs text-center`}>
                    <p className="text-2xl mb-1">{t === 'Bronze' ? '🥉' : t === 'Silver' ? '🥈' : t === 'Gold' ? '🥇' : '💎'}</p>
                    <p className="text-sm font-bold text-gray-900">{t}</p>
                    <p className="text-2xl font-black text-gray-900 mt-1">{t === 'Bronze' ? kpis.bronze : t === 'Silver' ? kpis.silver : t === 'Gold' ? kpis.gold : kpis.platinum}</p>
                    <p className="text-[10px] text-gray-500 font-bold mt-1">{tierThresholds[t].min}–{tierThresholds[t].max === Infinity ? '∞' : fmt(tierThresholds[t].max)} pts</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                  <p className="text-sm font-bold text-gray-900 mb-3">Tier Distribution</p>
                  <div className="h-64"><Doughnut data={tierChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 11, weight: 'bold' } } } } }} /></div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                  <p className="text-sm font-bold text-gray-900 mb-3">Points Summary</p>
                  <div className="h-64"><Bar data={pointsChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { font: { size: 10 } } }, x: { ticks: { font: { size: 10, weight: 'bold' } } } } }} /></div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ Transactions ═══ */}
          {tab === 'Transactions' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto"><table className="w-full"><thead><tr className="bg-gradient-to-r from-cyan-700 via-blue-700 to-indigo-800">
                {['Date','Member','Type','Points','Sale Ref','Description'].map(h => <th key={h} className="px-2.5 py-2 text-left text-[10px] font-bold text-white uppercase tracking-wider">{h}</th>)}
              </tr></thead><tbody>
                {filteredTx.length === 0 ? <tr><td colSpan={6} className="text-center py-8 text-gray-400 text-sm font-semibold">No transactions</td></tr> :
                filteredTx.map((t, i) => (
                  <tr key={t.transaction_id} className={`border-b border-gray-100 hover:bg-blue-50/40 ${i % 2 ? 'bg-gray-50/30' : ''}`}>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-800">{new Date(t.created_at).toLocaleDateString()}</td>
                    <td className="px-2.5 py-1.5 text-xs font-bold text-gray-900">{t.member_name}</td>
                    <td className="px-2.5 py-1.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${txColor[t.transaction_type] || 'bg-gray-100 text-gray-800'}`}>{t.transaction_type}</span></td>
                    <td className="px-2.5 py-1.5 text-xs font-bold text-gray-900">{t.transaction_type === 'Redeem' || t.transaction_type === 'Expire' ? '-' : '+'}{fmt(t.points)}</td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-600">{t.sale_id || '—'}</td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-gray-600">{t.description || '—'}</td>
                  </tr>
                ))}
              </tbody></table></div>
            </div>
          )}

          {/* ═══ SMS Campaigns ═══ */}
          {tab === 'SMS Campaigns' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3">
                <h3 className="text-sm font-bold text-gray-900">📱 Create SMS Campaign</h3>
                <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Target Tier</label><select value={smsTier} onChange={e => setSmsTier(e.target.value)} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700"><option value="All">All Members</option>{TIERS.map(t => <option key={t}>{t}</option>)}</select></div>
                <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Message</label><textarea value={smsMsg} onChange={e => setSmsMsg(e.target.value)} rows={3} placeholder="Dear {name}, your health is our priority..." className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700" /></div>
                <p className="text-[10px] text-gray-500 font-bold">Recipients: {(smsTier === 'All' ? members : members.filter(m => m.tier === smsTier)).filter(m => m.sms_consent).length} members with SMS consent</p>
                <button onClick={sendCampaign} className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs text-sm">📤 Send Campaign</button>
              </div>
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                <h3 className="text-sm font-bold text-gray-900 mb-3">Campaign History</h3>
                {campaigns.length === 0 ? <p className="text-gray-400 text-xs text-center py-4">No campaigns sent yet</p> :
                <div className="space-y-2">{campaigns.map((c, i) => (
                  <div key={i} className="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex justify-between"><span className="text-[10px] font-bold text-gray-500">{c.date}</span><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">{c.tier}</span></div>
                    <p className="text-xs font-semibold text-gray-800 mt-1">{c.msg}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Sent to {c.count} members</p>
                  </div>
                ))}</div>}
              </div>
            </div>
          )}

          {/* ═══ Feedback ═══ */}
          {tab === 'Feedback' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3">
                <h3 className="text-sm font-bold text-gray-900">💬 Collect Customer Feedback</h3>
                <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Customer Name</label><input value={fbName} onChange={e => setFbName(e.target.value)} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700" /></div>
                <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Rating</label><div className="flex gap-1">{[1,2,3,4,5].map(n => <button key={n} onClick={() => setFbRating(n)} className={`text-xl ${n <= fbRating ? 'text-amber-500' : 'text-gray-300'}`}>★</button>)}</div></div>
                <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Comment</label><textarea value={fbComment} onChange={e => setFbComment(e.target.value)} rows={2} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700" /></div>
                <button onClick={addFeedback} className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs text-sm">Submit Feedback</button>
              </div>
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                <h3 className="text-sm font-bold text-gray-900 mb-3">Recent Feedback</h3>
                {feedbacks.length === 0 ? <p className="text-gray-400 text-xs text-center py-4">No feedback collected yet</p> :
                <div className="space-y-2">{feedbacks.map(f => (
                  <div key={f.id} className="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex justify-between"><span className="text-xs font-bold text-gray-900">{f.name}</span><span className="text-[10px] text-gray-500">{f.date}</span></div>
                    <div className="flex gap-0.5 mt-0.5">{[1,2,3,4,5].map(n => <span key={n} className={`text-xs ${n <= f.rating ? 'text-amber-500' : 'text-gray-300'}`}>★</span>)}</div>
                    {f.comment && <p className="text-xs text-gray-600 mt-1">{f.comment}</p>}
                  </div>
                ))}</div>}
              </div>
            </div>
          )}

          {/* ═══ Settings ═══ */}
          {tab === 'Settings' && (
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs max-w-lg space-y-4">
              <h3 className="text-sm font-bold text-gray-900">⚙️ Loyalty Program Settings</h3>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Points per KSh 100</label><input type="number" defaultValue={1} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700" /></div>
                <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Redemption (KSh per point)</label><input type="number" defaultValue={1} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700" /></div>
                <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Point Expiry (days)</label><input type="number" defaultValue={365} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700" /></div>
                <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Min Redeem Points</label><input type="number" defaultValue={100} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700" /></div>
              </div>
              <div className="border-t border-gray-100 pt-3"><p className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-2">Tier Thresholds</p>
                <div className="grid grid-cols-4 gap-2">
                  {TIERS.map(t => (
                    <div key={t} className="text-center"><p className="text-[10px] font-bold text-gray-700">{t}</p><p className="text-xs font-black text-gray-900">{tierThresholds[t].min}+</p></div>
                  ))}
                </div>
              </div>
              <button className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs text-xs">Save Settings</button>
            </div>
          )}
        </>
      )}

      {/* ═══ Enroll Modal ═══ */}
      {showEnrollModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowEnrollModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200"><h2 className="text-lg font-bold text-gray-900">Enroll New Loyalty Member</h2></div>
            <div className="p-4 space-y-3">
              <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Select Patient</label><select value={enrollPatientId} onChange={e => setEnrollPatientId(+e.target.value)} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700"><option value={0}>Choose patient...</option>{patients.map(p => <option key={p.patient_id} value={p.patient_id}>{p.full_name} ({p.phone})</option>)}</select></div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-700"><input type="checkbox" checked={enrollSms} onChange={e => setEnrollSms(e.target.checked)} className="rounded" />SMS Consent</label>
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-700"><input type="checkbox" checked={enrollWa} onChange={e => setEnrollWa(e.target.checked)} className="rounded" />WhatsApp Consent</label>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => setShowEnrollModal(false)} className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-bold shadow-xs text-xs">Cancel</button>
              <button onClick={enroll} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs text-xs">Enroll</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Manual Points Modal ═══ */}
      {showPointsModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowPointsModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200"><h2 className="text-lg font-bold text-gray-900">Manual Points Adjustment</h2></div>
            <div className="p-4 space-y-3">
              <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Member</label><select value={manualMemberId} onChange={e => setManualMemberId(+e.target.value)} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700"><option value={0}>Select member...</option>{members.map(m => <option key={m.loyalty_id} value={m.loyalty_id}>{m.full_name} ({m.membership_no})</option>)}</select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Type</label><select value={manualType} onChange={e => setManualType(e.target.value)} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700"><option>Bonus</option><option>Earn</option><option>Redeem</option><option>Expire</option></select></div>
                <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Points</label><input type="number" value={manualPoints || ''} onChange={e => setManualPoints(+e.target.value)} className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700" /></div>
              </div>
              <div><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-0.5 block">Description</label><input value={manualDesc} onChange={e => setManualDesc(e.target.value)} placeholder="Reason for adjustment" className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700" /></div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => setShowPointsModal(false)} className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-bold shadow-xs text-xs">Cancel</button>
              <button onClick={addManualPoints} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs text-xs">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
