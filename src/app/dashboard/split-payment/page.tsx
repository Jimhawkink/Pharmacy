'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

interface Sale {
  sale_id: number; receipt_no: string; sale_datetime: string; total: number;
  payment_method: string; customer_name: string; status: string;
  split_cash?: number; split_mpesa?: number; split_insurance?: number;
  split_insurance_name?: string; mpesa_receipt?: string;
}

const MPESA_API_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1` : '';
const MPESA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const fmt = (n: number) => `KSh ${(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;
const fmtPhone = (p: string) => {
  const d = p.replace(/\D/g, '');
  if (d.startsWith('0')) return '254' + d.slice(1);
  if (d.startsWith('254')) return d;
  return '254' + d;
};
const validPhone = (p: string) => /^(07|01|2547|2541)\d{8}$/.test(p.replace(/\s/g, ''));

export default function SplitPaymentPage() {
  const { activeOutlet } = useOutlet();
  const outletId = activeOutlet?.outlet_id || 1;

  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'new' | 'history'>('pending');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [stkStatus, setStkStatus] = useState<'idle'|'sending'|'waiting'|'success'|'failed'>('idle');
  const [stkMsg, setStkMsg] = useState('');

  // Split amounts
  const [cashPortion, setCashPortion] = useState('');
  const [mpesaPortion, setMpesaPortion] = useState('');
  const [insurancePortion, setInsurancePortion] = useState('');
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [mpesaReceipt, setMpesaReceipt] = useState('');
  const [insuranceName, setInsuranceName] = useState('');
  const [insuranceRef, setInsuranceRef] = useState('');
  const [customerName, setCustomerName] = useState('');

  // Grand total for new split (standalone)
  const [newTotal, setNewTotal] = useState('');
  const [newReceiptRef, setNewReceiptRef] = useState('');

  useEffect(() => { loadData(); }, [outletId]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('pharmacy_sales')
        .select('sale_id, receipt_no, sale_datetime, total, payment_method, customer_name, status, split_cash, split_mpesa, split_insurance, split_insurance_name, mpesa_receipt')
        .eq('outlet_id', outletId)
        .order('sale_id', { ascending: false })
        .limit(200);
      setSales(data || []);
    } catch { }
    setLoading(false);
  }, [outletId]);

  const splitSales = sales.filter(s => s.payment_method?.toLowerCase().includes('split'));
  const pendingSales = sales.filter(s => s.status === 'Pending' || s.status === 'partial');
  const filteredSales = (tab === 'history' ? splitSales : pendingSales).filter(s =>
    !search || s.receipt_no?.toLowerCase().includes(search.toLowerCase()) ||
    s.customer_name?.toLowerCase().includes(search.toLowerCase())
  );

  const selectSaleForSplit = (sale: Sale) => {
    setSelectedSale(sale);
    setNewTotal(sale.total.toString());
    setNewReceiptRef(sale.receipt_no);
    setTab('new');
  };

  const grandTotal = selectedSale ? selectedSale.total : Number(newTotal) || 0;
  const cashAmt = Number(cashPortion) || 0;
  const mpesaAmt = Number(mpesaPortion) || 0;
  const insuranceAmt = Number(insurancePortion) || 0;
  const splitTotal = cashAmt + mpesaAmt + insuranceAmt;
  const remaining = grandTotal - splitTotal;

  const handleSTKPush = async () => {
    if (!validPhone(mpesaPhone)) { toast.error('Enter valid Safaricom/Airtel phone'); return; }
    if (mpesaAmt <= 0) { toast.error('Enter M-Pesa amount first'); return; }
    setStkStatus('sending'); setStkMsg('Sending STK Push...');
    try {
      const phone = fmtPhone(mpesaPhone);
      const res = await fetch(`${MPESA_API_URL}/stkpush`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: MPESA_KEY, Authorization: `Bearer ${MPESA_KEY}` },
        body: JSON.stringify({ phone, amount: Math.ceil(mpesaAmt), accountReference: newReceiptRef, transactionDesc: `Split Pay - ${newReceiptRef}` }),
      });
      const data = await res.json();
      if (data.success) {
        setStkStatus('waiting'); setStkMsg('Waiting for PIN entry on phone...');
        const reqId = data.checkout_request_id || data.CheckoutRequestID;
        let attempts = 0;
        const poll = setInterval(async () => {
          attempts++;
          try {
            const r = await fetch(`${MPESA_API_URL}/check-status?checkout_request_id=${reqId}`, {
              headers: { apikey: MPESA_KEY, Authorization: `Bearer ${MPESA_KEY}` },
            });
            const d = await r.json();
            if (d.resultCode === 0) {
              clearInterval(poll);
              const rc = d.mpesaReceiptNumber || `MPE-${Date.now().toString(36).toUpperCase()}`;
              setMpesaReceipt(rc);
              setStkStatus('success');
              setStkMsg(`✅ Paid KSh ${mpesaAmt.toLocaleString()} — Receipt: ${rc}`);
            } else if (d.resultCode && d.resultCode !== 0 && d.status !== 'pending') {
              clearInterval(poll); setStkStatus('failed'); setStkMsg('Payment cancelled or failed');
            } else if (attempts >= 24) {
              clearInterval(poll); setStkStatus('failed'); setStkMsg('Timeout — Enter receipt manually below');
            }
          } catch { }
        }, 4000);
      } else {
        setStkStatus('failed'); setStkMsg(data.error || 'STK Push failed');
      }
    } catch (e: any) { setStkStatus('failed'); setStkMsg(e.message || 'M-Pesa service error'); }
  };

  const completeSplitPayment = async () => {
    if (Math.abs(remaining) > 1) { toast.error(`Amounts do not add up. Remaining: ${fmt(remaining)}`); return; }
    if (mpesaAmt > 0 && !mpesaReceipt && stkStatus !== 'success') { toast.error('Complete M-Pesa payment or enter receipt manually'); return; }
    if (insuranceAmt > 0 && !insuranceName) { toast.error('Enter insurance provider name'); return; }
    setSaving(true);
    try {
      const payMethod = [cashAmt > 0 && 'CASH', mpesaAmt > 0 && 'MPESA', insuranceAmt > 0 && 'INSURANCE'].filter(Boolean).join('+');
      const updateData: any = {
        payment_method: `SPLIT(${payMethod})`,
        split_cash: cashAmt || null,
        split_mpesa: mpesaAmt || null,
        split_insurance: insuranceAmt || null,
        split_insurance_name: insuranceName || null,
        mpesa_receipt: mpesaReceipt || null,
        insurance_ref: insuranceRef || null,
        customer_name: customerName || selectedSale?.customer_name || null,
        status: 'Completed',
        amount_paid: grandTotal,
      };
      if (selectedSale?.sale_id) {
        const { error } = await supabase.from('pharmacy_sales').update(updateData).eq('sale_id', selectedSale.sale_id);
        if (error) throw error;
      } else {
        // New standalone split payment record
        const userName = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}').name || 'Pharmacist'; } catch { return 'Pharmacist'; } })();
        const prefix = `SPLIT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-`;
        const receiptNo = newReceiptRef || `${prefix}${Math.floor(Math.random() * 9000 + 1000)}`;
        const { error } = await supabase.from('pharmacy_sales').insert([{
          receipt_no: receiptNo, sale_datetime: new Date().toISOString(),
          subtotal: grandTotal, discount: 0, tax: 0, total: grandTotal,
          ...updateData, cashier_name: userName, outlet_id: outletId,
        }]);
        if (error) throw error;
      }
      toast.success(`✅ Split payment recorded! Cash: ${fmt(cashAmt)} | M-Pesa: ${fmt(mpesaAmt)} | Insurance: ${fmt(insuranceAmt)}`);
      setCashPortion(''); setMpesaPortion(''); setInsurancePortion('');
      setMpesaPhone(''); setMpesaReceipt(''); setInsuranceName(''); setInsuranceRef('');
      setCustomerName(''); setSelectedSale(null); setNewTotal(''); setNewReceiptRef('');
      setStkStatus('idle'); setStkMsg('');
      await loadData();
      setTab('history');
    } catch (e: any) { toast.error(e.message || 'Save failed'); }
    setSaving(false);
  };

  const autoDistribute = () => {
    if (!grandTotal) return;
    const cash = Math.round(grandTotal * 0.3);
    const mpesa = Math.round(grandTotal * 0.5);
    const ins = grandTotal - cash - mpesa;
    setCashPortion(cash.toString());
    setMpesaPortion(mpesa.toString());
    setInsurancePortion(ins.toString());
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="w-full max-w-full space-y-3.5 px-1 md:px-2 text-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
            <span className="text-2xl">💳</span> Split Payment
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Accept payment across Cash + M-Pesa + Insurance in a single transaction — full audit trail</p>
        </div>
        <div className="flex gap-2">
          {[['pending','⏳ Pending Sales'],['new','+ New Split'],['history','📋 History']].map(([t,l]) => (
            <button key={t} onClick={() => { setTab(t as any); if (t === 'new') setSelectedSale(null); }}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${tab === t ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Split Transactions', value: splitSales.length, icon: '💳', color: 'purple' },
          { label: 'Cash in Splits', value: fmt(splitSales.reduce((s,x) => s+(x.split_cash||0),0)), icon: '💵', color: 'emerald' },
          { label: 'M-Pesa in Splits', value: fmt(splitSales.reduce((s,x) => s+(x.split_mpesa||0),0)), icon: '📱', color: 'green' },
          { label: 'Insurance in Splits', value: fmt(splitSales.reduce((s,x) => s+(x.split_insurance||0),0)), icon: '🏥', color: 'blue' },
        ].map((k, i) => (
          <div key={i} className={`bg-gradient-to-br from-${k.color}-50/80 via-${k.color}-50/40 to-white rounded-xl p-3.5 border border-${k.color}-100 shadow-sm`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-lg">{k.icon}</span>
              <span className={`text-[10px] font-semibold text-${k.color}-600 bg-${k.color}-100 px-1.5 py-0.5 rounded-full`}>Split</span>
            </div>
            <p className={`text-lg font-black text-${k.color}-700`}>{k.value}</p>
            <p className="text-xs font-semibold text-gray-700 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* ===== NEW SPLIT TAB ===== */}
      {tab === 'new' && (
        <div className="max-w-2xl space-y-4">
          {selectedSale && (
            <div className="bg-gradient-to-r from-purple-600 to-indigo-700 rounded-2xl p-4 text-white">
              <p className="text-xs font-bold opacity-80">Splitting payment for sale:</p>
              <p className="text-2xl font-black mt-0.5">{fmt(selectedSale.total)}</p>
              <p className="text-xs opacity-80 mt-1">{selectedSale.receipt_no} | {selectedSale.customer_name || 'Walk-in'}</p>
            </div>
          )}

          {/* Manual total if no sale selected */}
          {!selectedSale && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <h4 className="text-xs font-extrabold text-gray-700 mb-3">Transaction Details</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-gray-600 mb-1 block">Grand Total (KSh) *</label>
                  <input type="number" value={newTotal} onChange={e => setNewTotal(e.target.value)} placeholder="Enter total amount" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 font-bold text-right focus:outline-none focus:border-purple-400" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-600 mb-1 block">Customer Name</label>
                  <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Patient / Customer name" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none focus:border-purple-400" />
                </div>
                <div className="col-span-2">
                  <label className="text-[11px] font-bold text-gray-600 mb-1 block">Reference (Receipt/Sale #)</label>
                  <input value={newReceiptRef} onChange={e => setNewReceiptRef(e.target.value)} placeholder="e.g. PHARM-20241103-001" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs bg-gray-50 font-mono focus:outline-none focus:border-purple-400" />
                </div>
              </div>
            </div>
          )}

          {/* Payment Split Allocation */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-extrabold text-gray-700">Allocate Payment Portions</h4>
              <button onClick={autoDistribute} className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-[10px] font-bold border border-purple-200">
                Auto-Distribute 30/50/20
              </button>
            </div>

            {/* Live Balance Indicator */}
            {grandTotal > 0 && (
              <div className={`mb-4 p-3 rounded-xl border flex items-center justify-between text-xs font-bold ${Math.abs(remaining) < 1 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                <span>Total: {fmt(grandTotal)} | Allocated: {fmt(splitTotal)}</span>
                <span className={`text-base font-black ${remaining === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {remaining === 0 ? '✅ Balanced!' : `${fmt(Math.abs(remaining))} ${remaining > 0 ? 'remaining' : 'over-allocated'}`}
                </span>
              </div>
            )}

            <div className="space-y-4">
              {/* Cash Portion */}
              <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">💵</span>
                  <span className="font-extrabold text-emerald-800 text-xs">Cash</span>
                </div>
                <div className="flex gap-2 items-center">
                  <input type="number" value={cashPortion} onChange={e => setCashPortion(e.target.value)}
                    placeholder="0.00" className="flex-1 px-3 py-2 border border-emerald-300 rounded-lg text-sm font-bold text-right bg-white focus:outline-none focus:border-emerald-500" />
                  <button onClick={() => setCashPortion(String(Math.max(0, grandTotal - mpesaAmt - insuranceAmt)))}
                    className="px-2 py-2 bg-emerald-600 text-white rounded-lg text-[10px] font-bold hover:bg-emerald-700">Fill</button>
                </div>
              </div>

              {/* M-Pesa Portion */}
              <div className="bg-green-50 rounded-xl p-3 border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">📱</span>
                  <span className="font-extrabold text-green-800 text-xs">M-Pesa</span>
                </div>
                <div className="flex gap-2 items-center mb-2">
                  <input type="number" value={mpesaPortion} onChange={e => setMpesaPortion(e.target.value)}
                    placeholder="0.00" className="flex-1 px-3 py-2 border border-green-300 rounded-lg text-sm font-bold text-right bg-white focus:outline-none focus:border-green-500" />
                  <button onClick={() => setMpesaPortion(String(Math.max(0, grandTotal - cashAmt - insuranceAmt)))}
                    className="px-2 py-2 bg-green-600 text-white rounded-lg text-[10px] font-bold hover:bg-green-700">Fill</button>
                </div>
                {mpesaAmt > 0 && (
                  <>
                    <input type="tel" value={mpesaPhone} onChange={e => setMpesaPhone(e.target.value)}
                      placeholder="07XX XXX XXX — Phone for STK Push" className="w-full px-3 py-1.5 border border-green-200 rounded-lg text-xs bg-white mb-1.5 focus:outline-none" />
                    {stkStatus === 'idle' || stkStatus === 'failed' ? (
                      <button onClick={handleSTKPush}
                        className="w-full py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg text-xs font-bold hover:from-green-600 hover:to-emerald-700 flex items-center justify-center gap-2">
                        <span>📱</span> Send STK Push for {fmt(mpesaAmt)}
                      </button>
                    ) : (
                      <div className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-2 ${stkStatus === 'success' ? 'bg-emerald-100 text-emerald-800' : stkStatus === 'waiting' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>
                        {(stkStatus === 'sending' || stkStatus === 'waiting') && <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                        {stkMsg}
                      </div>
                    )}
                    <input value={mpesaReceipt} onChange={e => setMpesaReceipt(e.target.value.toUpperCase())}
                      placeholder="OR enter M-Pesa receipt code manually (e.g. RLJ57XYZ)" className="w-full px-3 py-1.5 border border-green-200 rounded-lg text-xs bg-white font-mono mt-1.5 focus:outline-none uppercase" />
                  </>
                )}
              </div>

              {/* Insurance Portion */}
              <div className="bg-blue-50 rounded-xl p-3 border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🏥</span>
                  <span className="font-extrabold text-blue-800 text-xs">Insurance / SHA / SHIF</span>
                </div>
                <div className="flex gap-2 items-center mb-2">
                  <input type="number" value={insurancePortion} onChange={e => setInsurancePortion(e.target.value)}
                    placeholder="0.00" className="flex-1 px-3 py-2 border border-blue-300 rounded-lg text-sm font-bold text-right bg-white focus:outline-none focus:border-blue-500" />
                  <button onClick={() => setInsurancePortion(String(Math.max(0, grandTotal - cashAmt - mpesaAmt)))}
                    className="px-2 py-2 bg-blue-600 text-white rounded-lg text-[10px] font-bold hover:bg-blue-700">Fill</button>
                </div>
                {insuranceAmt > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    <input value={insuranceName} onChange={e => setInsuranceName(e.target.value)}
                      placeholder="Provider (e.g. SHA, Jubilee, AAR)" className="px-3 py-1.5 border border-blue-200 rounded-lg text-xs bg-white focus:outline-none" />
                    <input value={insuranceRef} onChange={e => setInsuranceRef(e.target.value)}
                      placeholder="Claim/Auth reference" className="px-3 py-1.5 border border-blue-200 rounded-lg text-xs bg-white focus:outline-none font-mono" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Complete Button */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center justify-between">
            <div className="text-xs text-gray-600">
              {grandTotal > 0 && (
                <div className="space-y-1">
                  {cashAmt > 0 && <p>💵 Cash: <strong>{fmt(cashAmt)}</strong></p>}
                  {mpesaAmt > 0 && <p>📱 M-Pesa: <strong>{fmt(mpesaAmt)}</strong></p>}
                  {insuranceAmt > 0 && <p>🏥 Insurance: <strong>{fmt(insuranceAmt)}</strong></p>}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setTab('pending')} className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-50">Cancel</button>
              <button onClick={completeSplitPayment} disabled={saving || Math.abs(remaining) > 1 || grandTotal <= 0}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 text-white rounded-xl font-extrabold text-sm shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</> : <><span>✅</span> Complete Split Payment</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== PENDING SALES TAB ===== */}
      {tab === 'pending' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-gray-800">⏳ Pending Sales — Apply Split Payment</h3>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search receipt, customer..." className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none w-52" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gradient-to-r from-purple-700 via-indigo-700 to-blue-800 text-white">
                  {['Receipt #', 'Date', 'Customer', 'Total', 'Method', 'Status', 'Action'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-semibold text-[11px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredSales.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400">
                    No pending sales. Use "New Split" to record a split payment, or go to POS to create sales.
                  </td></tr>
                ) : filteredSales.map((s, i) => (
                  <tr key={s.sale_id} className={`border-b border-gray-50 hover:bg-purple-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                    <td className="px-3 py-2 font-mono font-bold text-purple-700">{s.receipt_no}</td>
                    <td className="px-3 py-2 text-gray-600">{s.sale_datetime?.split('T')[0]}</td>
                    <td className="px-3 py-2 font-semibold text-gray-800">{s.customer_name || 'Walk-in'}</td>
                    <td className="px-3 py-2 font-black text-emerald-700">{fmt(s.total)}</td>
                    <td className="px-3 py-2 text-gray-600">{s.payment_method}</td>
                    <td className="px-3 py-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{s.status}</span>
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => selectSaleForSplit(s)} className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-[10px]">
                        Apply Split
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== HISTORY TAB ===== */}
      {tab === 'history' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-gray-800">📋 Split Payment History</h3>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:outline-none w-52" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gradient-to-r from-purple-700 via-indigo-700 to-blue-800 text-white">
                  {['Receipt #', 'Date', 'Customer', 'Total', 'Cash', 'M-Pesa', 'Insurance', 'M-Pesa Ref', 'Insurance Provider', 'Method'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-semibold text-[11px] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredSales.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-12 text-gray-400">No split payment history yet.</td></tr>
                ) : filteredSales.map((s, i) => (
                  <tr key={s.sale_id} className={`border-b border-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                    <td className="px-3 py-2 font-mono font-bold text-purple-700">{s.receipt_no}</td>
                    <td className="px-3 py-2 text-gray-600">{s.sale_datetime?.split('T')[0]}</td>
                    <td className="px-3 py-2 font-semibold text-gray-800">{s.customer_name || '—'}</td>
                    <td className="px-3 py-2 font-black text-emerald-700">{fmt(s.total)}</td>
                    <td className="px-3 py-2 font-bold text-emerald-700">{s.split_cash ? fmt(s.split_cash) : '—'}</td>
                    <td className="px-3 py-2 font-bold text-green-700">{s.split_mpesa ? fmt(s.split_mpesa) : '—'}</td>
                    <td className="px-3 py-2 font-bold text-blue-700">{s.split_insurance ? fmt(s.split_insurance) : '—'}</td>
                    <td className="px-3 py-2 font-mono text-gray-600 text-[10px]">{s.mpesa_receipt || '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{s.split_insurance_name || '—'}</td>
                    <td className="px-3 py-2 text-[10px] text-gray-500">{s.payment_method}</td>
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
