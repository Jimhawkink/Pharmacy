'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

interface TempLog { id?: number; location: string; temperature: number; humidity?: number; recorded_at: string; recorded_by: string; status: string; notes: string; device_id?: string; outlet_id: number; }
interface ColdChainItem { id?: number; product_id?: number; product_name: string; batch_number: string; storage_location: string; min_temp: number; max_temp: number; current_temp?: number; status: string; last_checked?: string; outlet_id: number; }

const fmt = (n: number) => `KSh ${(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;
const now8601 = () => new Date().toISOString().slice(0, 16);

const LOCATIONS = [
  'Main Refrigerator (2-8°C)', 'Vaccine Cold Box', 'Narcotic Safe (Ambient)', 'Storage Room (15-25°C)',
  'Dispensing Counter', 'Insulin Cabinet (2-8°C)', 'Biologics Freezer (-20°C)', 'Blood Products Fridge (2-6°C)',
];
const RANGES: Record<string, { min: number; max: number }> = {
  'Main Refrigerator (2-8°C)': { min: 2, max: 8 },
  'Vaccine Cold Box': { min: 2, max: 8 },
  'Insulin Cabinet (2-8°C)': { min: 2, max: 8 },
  'Blood Products Fridge (2-6°C)': { min: 2, max: 6 },
  'Biologics Freezer (-20°C)': { min: -25, max: -15 },
  'Storage Room (15-25°C)': { min: 15, max: 25 },
  'Narcotic Safe (Ambient)': { min: 15, max: 25 },
  'Dispensing Counter': { min: 15, max: 30 },
};

const tempStatus = (temp: number, location: string): { status: string; color: string } => {
  const range = RANGES[location] || { min: 2, max: 8 };
  if (temp < range.min - 2) return { status: 'CRITICAL LOW', color: 'red' };
  if (temp < range.min) return { status: 'LOW', color: 'blue' };
  if (temp > range.max + 2) return { status: 'CRITICAL HIGH', color: 'red' };
  if (temp > range.max) return { status: 'HIGH', color: 'orange' };
  return { status: 'NORMAL', color: 'emerald' };
};

export default function ColdChainPage() {
  const { activeOutlet } = useOutlet();
  const outletId = activeOutlet?.outlet_id || 1;

  const [logs, setLogs] = useState<TempLog[]>([]);
  const [coldItems, setColdItems] = useState<ColdChainItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'monitor' | 'log' | 'items' | 'alerts'>('monitor');
  const [saving, setSaving] = useState(false);
  const [userName, setUserName] = useState('Pharmacist');

  const [form, setForm] = useState<TempLog>({
    location: LOCATIONS[0], temperature: 0, humidity: undefined, recorded_at: now8601(),
    recorded_by: '', status: 'NORMAL', notes: '', outlet_id: outletId,
  });

  const [itemForm, setItemForm] = useState<ColdChainItem>({
    product_name: '', batch_number: '', storage_location: LOCATIONS[0], min_temp: 2, max_temp: 8, status: 'Active', outlet_id: outletId,
  });

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) { try { const p = JSON.parse(u); const n = p.name || p.email || 'Pharmacist'; setUserName(n); setForm(f => ({ ...f, recorded_by: n })); } catch {} }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: logData }, { data: itemData }] = await Promise.all([
        supabase.from('pharmacy_temp_logs').select('*').eq('outlet_id', outletId).order('recorded_at', { ascending: false }).limit(200),
        supabase.from('pharmacy_cold_chain_items').select('*').eq('outlet_id', outletId).order('product_name'),
      ]);
      setLogs(logData || []);
      setColdItems(itemData || []);
    } catch { }
    setLoading(false);
  }, [outletId]);

  useEffect(() => { loadData(); }, [loadData]);

  const updateTempStatus = (temp: number, loc: string) => {
    const { status } = tempStatus(temp, loc);
    setForm(f => ({ ...f, temperature: temp, status }));
  };

  const saveLog = async () => {
    if (!form.temperature && form.temperature !== 0) { toast.error('Enter temperature reading'); return; }
    setSaving(true);
    try {
      const { status } = tempStatus(form.temperature, form.location);
      const logData = { ...form, status, outlet_id: outletId, recorded_at: form.recorded_at || now8601() };
      const { error } = await supabase.from('pharmacy_temp_logs').insert([logData]);
      if (error) throw error;
      if (status.includes('CRITICAL')) {
        toast.error(`🚨 CRITICAL TEMPERATURE ALERT! ${form.location}: ${form.temperature}°C — ${status}`);
      } else if (status !== 'NORMAL') {
        toast(`⚠️ Temperature deviation: ${form.location}: ${form.temperature}°C — ${status}`, { icon: '⚠️' });
      } else {
        toast.success(`✅ Temperature logged: ${form.location} — ${form.temperature}°C`);
      }
      setForm(f => ({ ...f, temperature: 0, humidity: undefined, notes: '', recorded_at: now8601(), status: 'NORMAL' }));
      await loadData();
    } catch (e: any) { toast.error(e.message || 'Save failed'); }
    setSaving(false);
  };

  const saveItem = async () => {
    if (!itemForm.product_name) { toast.error('Enter product name'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('pharmacy_cold_chain_items').insert([{ ...itemForm, outlet_id: outletId }]);
      if (error) throw error;
      toast.success('✅ Cold chain item added');
      setItemForm({ product_name: '', batch_number: '', storage_location: LOCATIONS[0], min_temp: 2, max_temp: 8, status: 'Active', outlet_id: outletId });
      await loadData();
    } catch (e: any) { toast.error(e.message || 'Save failed'); }
    setSaving(false);
  };

  // Latest reading per location
  const latestByLocation: Record<string, TempLog> = {};
  logs.forEach(log => {
    if (!latestByLocation[log.location] || log.recorded_at > latestByLocation[log.location].recorded_at) {
      latestByLocation[log.location] = log;
    }
  });

  const criticalAlerts = logs.filter(l => l.status?.includes('CRITICAL')).slice(0, 20);
  const deviations = logs.filter(l => l.status !== 'NORMAL').slice(0, 20);

  const tempGaugeColor = (loc: string, temp: number) => {
    const { color } = tempStatus(temp, loc);
    return color === 'emerald' ? 'from-emerald-400 to-green-500' : color === 'blue' ? 'from-blue-400 to-cyan-500' : color === 'orange' ? 'from-orange-400 to-amber-500' : 'from-red-500 to-rose-600';
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-4 border-cyan-200 border-t-cyan-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="w-full max-w-full space-y-3.5 px-1 md:px-2 text-gray-900">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
            <span className="text-2xl">🌡️</span> Cold Chain & Temperature Monitoring
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">PPB-compliant cold chain management — vaccine fridge, insulin, biologics, narcotics temperature logging</p>
        </div>
        <div className="flex gap-2">
          {[['monitor','🌡️ Monitor'],['log','+ Log Reading'],['items','💊 Cold Items'],['alerts','🚨 Alerts']].map(([t,l]) => (
            <button key={t} onClick={() => setTab(t as any)}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${tab===t?'bg-cyan-600 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{l}</button>
          ))}
        </div>
      </div>

      {/* Critical Alert Banner */}
      {criticalAlerts.length > 0 && (
        <div className="bg-red-50 border-2 border-red-400 rounded-xl p-3 flex items-center gap-3 animate-pulse">
          <span className="text-2xl">🚨</span>
          <div>
            <p className="font-extrabold text-red-800">CRITICAL TEMPERATURE BREACH DETECTED!</p>
            <p className="text-xs text-red-600">{criticalAlerts[0].location}: {criticalAlerts[0].temperature}°C — {criticalAlerts[0].status} — {criticalAlerts[0].recorded_at}</p>
          </div>
          <button onClick={() => setTab('alerts')} className="ml-auto px-3 py-1.5 bg-red-600 text-white rounded-lg font-bold text-xs">View Alerts</button>
        </div>
      )}

      {/* ===== MONITOR ===== */}
      {tab === 'monitor' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Locations Monitored', value: Object.keys(latestByLocation).length, icon: '📍', color: 'cyan' },
              { label: 'Total Readings', value: logs.length, icon: '📊', color: 'blue' },
              { label: 'Deviations (All Time)', value: deviations.length, icon: '⚠️', color: 'amber' },
              { label: 'Critical Alerts', value: criticalAlerts.length, icon: '🚨', color: 'red' },
            ].map((k,i) => (
              <div key={i} className={`bg-gradient-to-br from-${k.color}-50/80 via-${k.color}-50/40 to-white rounded-xl p-3.5 border border-${k.color}-100 shadow-sm`}>
                <div className="flex items-center justify-between mb-1"><span className="text-lg">{k.icon}</span></div>
                <p className={`text-2xl font-black text-${k.color}-700`}>{k.value}</p>
                <p className="text-xs font-semibold text-gray-700">{k.label}</p>
              </div>
            ))}
          </div>

          {/* Live Location Gauges */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {LOCATIONS.map(loc => {
              const latest = latestByLocation[loc];
              const range = RANGES[loc] || { min: 2, max: 8 };
              const { status, color } = latest ? tempStatus(latest.temperature, loc) : { status: 'NO DATA', color: 'gray' };
              return (
                <div key={loc} className={`bg-white rounded-xl border shadow-sm overflow-hidden border-${color}-200`}>
                  <div className={`bg-gradient-to-r ${color === 'emerald' ? 'from-emerald-500 to-green-600' : color === 'blue' ? 'from-blue-500 to-cyan-600' : color === 'orange' ? 'from-orange-500 to-amber-600' : color === 'red' ? 'from-red-500 to-rose-600' : 'from-gray-400 to-gray-500'} p-3 text-white`}>
                    <p className="text-[10px] font-bold opacity-80 truncate">{loc}</p>
                    <p className="text-3xl font-black mt-0.5">{latest ? `${latest.temperature}°C` : '—'}</p>
                    <p className="text-[10px] font-bold opacity-90">{status}</p>
                  </div>
                  <div className="p-3 text-xs">
                    <p className="text-gray-500">Range: {range.min}°C to {range.max}°C</p>
                    {latest?.humidity && <p className="text-gray-500">Humidity: {latest.humidity}%</p>}
                    <p className="text-gray-400 mt-1 text-[10px]">{latest ? `Last: ${latest.recorded_at.replace('T', ' ')}` : 'No readings yet'}</p>
                    <button onClick={() => { setForm(f => ({ ...f, location: loc })); setTab('log'); }}
                      className="mt-2 w-full py-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 rounded-lg font-bold text-[10px] border border-cyan-200">Log Reading</button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recent Readings Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-3 border-b border-gray-100"><h3 className="text-sm font-extrabold text-gray-800">📋 Recent Temperature Readings</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="bg-gradient-to-r from-cyan-700 to-blue-800 text-white">
                  {['Date/Time','Location','Temperature','Humidity','Status','Recorded By','Notes'].map(h=><th key={h} className="px-3 py-2.5 text-left font-semibold text-[11px]">{h}</th>)}
                </tr></thead>
                <tbody>
                  {logs.slice(0,30).map((log,i) => {
                    const {status,color} = tempStatus(log.temperature, log.location);
                    return (
                      <tr key={log.id||i} className={`border-b border-gray-50 hover:bg-gray-50 ${i%2===0?'bg-white':'bg-gray-50/40'}`}>
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{log.recorded_at?.replace('T',' ')}</td>
                        <td className="px-3 py-2 font-semibold text-gray-800 max-w-[180px] truncate">{log.location}</td>
                        <td className="px-3 py-2">
                          <span className={`font-black text-${color}-700 text-base`}>{log.temperature}°C</span>
                        </td>
                        <td className="px-3 py-2 text-gray-600">{log.humidity ? `${log.humidity}%` : '—'}</td>
                        <td className="px-3 py-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-${color}-100 text-${color}-800`}>{status}</span>
                        </td>
                        <td className="px-3 py-2 text-gray-600">{log.recorded_by}</td>
                        <td className="px-3 py-2 text-gray-500 max-w-[150px] truncate">{log.notes||'—'}</td>
                      </tr>
                    );
                  })}
                  {logs.length===0&&<tr><td colSpan={7} className="text-center py-10 text-gray-400">No temperature readings yet. Click "Log Reading" to start.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===== LOG READING ===== */}
      {tab === 'log' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 max-w-2xl">
          <h3 className="text-sm font-extrabold text-gray-800 mb-4 flex items-center gap-2">🌡️ Log Temperature Reading</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold text-gray-600 mb-1 block">Storage Location *</label>
              <select value={form.location} onChange={e=>{const loc=e.target.value;setForm(f=>({...f,location:loc}));updateTempStatus(form.temperature,loc);}} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-cyan-400">
                {LOCATIONS.map(l=><option key={l}>{l}</option>)}
              </select>
              {RANGES[form.location] && (
                <p className="text-[10px] text-cyan-700 mt-1 font-semibold">Target: {RANGES[form.location].min}°C to {RANGES[form.location].max}°C</p>
              )}
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-600 mb-1 block">Date & Time *</label>
              <input type="datetime-local" value={form.recorded_at} onChange={e=>setForm(f=>({...f,recorded_at:e.target.value}))} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-cyan-400" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-600 mb-1 block">Temperature (°C) *</label>
              <input type="number" step="0.1" value={form.temperature||''} onChange={e=>updateTempStatus(Number(e.target.value),form.location)} className={`w-full px-3 py-2 border rounded-lg text-lg font-black text-center focus:outline-none ${(() => { const {color}=tempStatus(form.temperature,form.location); return color==='emerald'?'border-emerald-300 bg-emerald-50 text-emerald-700':color==='red'?'border-red-400 bg-red-50 text-red-700':color==='blue'?'border-blue-300 bg-blue-50 text-blue-700':'border-orange-300 bg-orange-50 text-orange-700'; })()}`} />
              {/* Live status indicator */}
              {form.temperature !== 0 && (
                <div className={`mt-2 p-2 rounded-xl border text-xs font-bold flex items-center gap-2 ${(() => { const {status,color}=tempStatus(form.temperature,form.location); return `bg-${color}-50 border-${color}-200 text-${color}-800`; })()}`}>
                  {(() => { const {status}=tempStatus(form.temperature,form.location); return status.includes('CRITICAL')?'🚨':status!=='NORMAL'?'⚠️':'✅'; })()} {(() => { const {status}=tempStatus(form.temperature,form.location); return status; })()}
                </div>
              )}
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-600 mb-1 block">Humidity (%) — Optional</label>
              <input type="number" step="1" min="0" max="100" value={form.humidity||''} onChange={e=>setForm(f=>({...f,humidity:Number(e.target.value)||undefined}))} placeholder="e.g. 65" className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-cyan-400 text-center" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-600 mb-1 block">Recorded By</label>
              <input value={form.recorded_by} onChange={e=>setForm(f=>({...f,recorded_by:e.target.value}))} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-cyan-400" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-600 mb-1 block">Device ID (optional)</label>
              <input value={form.device_id||''} onChange={e=>setForm(f=>({...f,device_id:e.target.value}))} placeholder="Thermometer / sensor ID" className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-cyan-400" />
            </div>
            <div className="col-span-2">
              <label className="text-[11px] font-bold text-gray-600 mb-1 block">Notes / Action Taken</label>
              <input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="e.g. Fridge running normally. Defrosted unit. Alert sent to pharmacist..." className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-cyan-400" />
            </div>
          </div>
          <div className="flex gap-2 mt-4 justify-end">
            <button onClick={()=>setTab('monitor')} className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-50">Cancel</button>
            <button onClick={saveLog} disabled={saving} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-bold text-xs shadow-xs disabled:opacity-50">
              {saving?'Saving...':'🌡️ Save Reading'}
            </button>
          </div>
        </div>
      )}

      {/* ===== COLD ITEMS ===== */}
      {tab === 'items' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h3 className="text-sm font-extrabold text-gray-800 mb-4">➕ Register Cold Chain Product</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-gray-600 mb-1 block">Product Name *</label>
                <input value={itemForm.product_name} onChange={e=>setItemForm(f=>({...f,product_name:e.target.value}))} placeholder="e.g. Insulin Glargine, Hepatitis B Vaccine" className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-cyan-400" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-600 mb-1 block">Batch Number</label>
                <input value={itemForm.batch_number} onChange={e=>setItemForm(f=>({...f,batch_number:e.target.value}))} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none font-mono" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-600 mb-1 block">Storage Location</label>
                <select value={itemForm.storage_location} onChange={e=>{const loc=e.target.value;const r=RANGES[loc]||{min:2,max:8};setItemForm(f=>({...f,storage_location:loc,min_temp:r.min,max_temp:r.max}));}} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-cyan-400">
                  {LOCATIONS.map(l=><option key={l}>{l}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-gray-600 mb-1 block">Min Temp (°C)</label>
                  <input type="number" step="0.5" value={itemForm.min_temp} onChange={e=>setItemForm(f=>({...f,min_temp:Number(e.target.value)}))} className="w-full px-2 py-1.5 border border-blue-200 rounded-lg text-xs bg-blue-50 text-center" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-600 mb-1 block">Max Temp (°C)</label>
                  <input type="number" step="0.5" value={itemForm.max_temp} onChange={e=>setItemForm(f=>({...f,max_temp:Number(e.target.value)}))} className="w-full px-2 py-1.5 border border-red-200 rounded-lg text-xs bg-red-50 text-center" />
                </div>
              </div>
              <button onClick={saveItem} disabled={saving} className="w-full py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-bold text-xs shadow-xs disabled:opacity-50">
                {saving?'Saving...':'✅ Register Item'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-3 border-b border-gray-100"><h3 className="text-sm font-extrabold text-gray-800">💊 Registered Cold Chain Items ({coldItems.length})</h3></div>
            <div className="overflow-auto max-h-96">
              <table className="w-full text-xs">
                <thead><tr className="bg-gradient-to-r from-cyan-700 to-blue-800 text-white">
                  {['Product','Batch','Location','Range','Status'].map(h=><th key={h} className="px-3 py-2.5 text-left font-semibold text-[11px]">{h}</th>)}
                </tr></thead>
                <tbody>
                  {coldItems.length===0?<tr><td colSpan={5} className="text-center py-8 text-gray-400">No cold chain items registered</td></tr>:
                    coldItems.map((item,i)=>(
                      <tr key={item.id||i} className={`border-b border-gray-50 ${i%2===0?'bg-white':'bg-gray-50/40'}`}>
                        <td className="px-3 py-2 font-bold text-gray-900">{item.product_name}</td>
                        <td className="px-3 py-2 font-mono text-blue-700">{item.batch_number||'—'}</td>
                        <td className="px-3 py-2 text-gray-600 text-[10px] max-w-[120px] truncate">{item.storage_location}</td>
                        <td className="px-3 py-2 text-gray-600">{item.min_temp}°C – {item.max_temp}°C</td>
                        <td className="px-3 py-2"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{item.status}</span></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===== ALERTS ===== */}
      {tab === 'alerts' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-3 border-b border-red-100 bg-red-50"><h3 className="text-sm font-extrabold text-red-800">🚨 Temperature Deviations & Alerts</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="bg-gradient-to-r from-red-700 to-rose-800 text-white">
                  {['Date/Time','Location','Temperature','Status','Recorded By','Notes'].map(h=><th key={h} className="px-3 py-2.5 text-left font-semibold text-[11px]">{h}</th>)}
                </tr></thead>
                <tbody>
                  {deviations.length===0?<tr><td colSpan={6} className="text-center py-10 text-gray-400">✅ No temperature deviations recorded</td></tr>:
                    deviations.map((log,i)=>{
                      const {status,color}=tempStatus(log.temperature,log.location);
                      return (
                        <tr key={log.id||i} className={`border-b border-gray-50 ${log.status?.includes('CRITICAL')?'bg-red-50':'bg-orange-50/30'}`}>
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{log.recorded_at?.replace('T',' ')}</td>
                          <td className="px-3 py-2 font-semibold text-gray-800">{log.location}</td>
                          <td className="px-3 py-2 font-black text-red-700 text-base">{log.temperature}°C</td>
                          <td className="px-3 py-2"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-${color}-100 text-${color}-800`}>{status}</span></td>
                          <td className="px-3 py-2 text-gray-600">{log.recorded_by}</td>
                          <td className="px-3 py-2 text-gray-500">{log.notes||'—'}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* WHO/Kenya Cold Chain Guidelines */}
          <div className="bg-cyan-50 rounded-xl border border-cyan-200 p-4">
            <h4 className="text-xs font-extrabold text-cyan-900 mb-3 flex items-center gap-1.5">🇰🇪 Kenya PPB Cold Chain Requirements</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { name: 'Vaccines', temp: '+2°C to +8°C', note: 'Never freeze most vaccines' },
                { name: 'Insulin & Biologics', temp: '+2°C to +8°C', note: 'Do not freeze' },
                { name: 'Oral medications', temp: '+15°C to +25°C', note: 'Room temperature, dry place' },
                { name: 'Frozen products', temp: '-20°C to -15°C', note: 'Maintain frozen chain' },
              ].map((r,i) => (
                <div key={i} className="bg-white rounded-xl p-3 border border-cyan-100">
                  <p className="font-bold text-cyan-800 text-xs">{r.name}</p>
                  <p className="text-sm font-black text-cyan-600 mt-0.5">{r.temp}</p>
                  <p className="text-[10px] text-gray-500 mt-1">{r.note}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
