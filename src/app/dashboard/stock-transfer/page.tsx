'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';
import { FiRepeat, FiPlus, FiTrash2, FiSearch, FiTruck, FiCheck, FiX, FiPackage, FiArrowRight, FiEye } from 'react-icons/fi';

interface Product { pid: number; product_code: string; product_name: string; purchase_unit: string; }
interface TransferItem { id: number; productId: number; productCode: string; productName: string; quantity: number; unit: string; receivedQty: number; }
interface Transfer { transfer_id: number; transfer_no: string; from_outlet_id: number; to_outlet_id: number; transfer_date: string; status: string; notes: string; created_by: string; received_by: string; created_at: string; received_at: string; }

export default function StockTransferPage() {
    const { activeOutlet, outlets } = useOutlet();
    const [transfers, setTransfers] = useState<Transfer[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [showView, setShowView] = useState(false);
    const [viewTransfer, setViewTransfer] = useState<Transfer | null>(null);
    const [viewItems, setViewItems] = useState<TransferItem[]>([]);

    // Create form
    const [toOutletId, setToOutletId] = useState<number>(0);
    const [items, setItems] = useState<TransferItem[]>([]);
    const [transferNotes, setTransferNotes] = useState('');
    const [productSearch, setProductSearch] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const outletId = activeOutlet?.outlet_id || 1;
            const { data: tData } = await supabase.from('retail_stock_transfers').select('*')
                .or(`from_outlet_id.eq.${outletId},to_outlet_id.eq.${outletId}`)
                .order('created_at', { ascending: false });
            setTransfers(tData || []);
            const { data: pData } = await supabase.from('retail_products').select('pid, product_code, product_name, purchase_unit').eq('active', true).order('product_name');
            setProducts(pData || []);
        } catch { toast.error('Error loading data'); }
        setIsLoading(false);
    }, [activeOutlet]);

    useEffect(() => { loadData(); }, [loadData]);

    const genTransferNo = () => `TRF-${Date.now().toString().slice(-6)}`;

    const filteredProducts = productSearch.trim().length > 0
        ? products.filter(p => p.product_name.toLowerCase().includes(productSearch.toLowerCase()) || p.product_code.toLowerCase().includes(productSearch.toLowerCase())).slice(0, 10) : [];

    const addItem = (p: Product) => {
        if (items.find(i => i.productId === p.pid)) { toast.error('Already added'); return; }
        setItems(prev => [...prev, { id: Date.now(), productId: p.pid, productCode: p.product_code, productName: p.product_name, quantity: 1, unit: p.purchase_unit || 'Piece', receivedQty: 0 }]);
        setProductSearch(''); setShowDropdown(false);
    };

    const createTransfer = async () => {
        if (!toOutletId) { toast.error('Select destination outlet'); return; }
        if (items.length === 0) { toast.error('Add at least one product'); return; }
        const fromId = activeOutlet?.outlet_id || 1;
        if (toOutletId === fromId) { toast.error('Cannot transfer to same outlet'); return; }
        setIsSaving(true);
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const tNo = genTransferNo();
            const { data: tData, error: tErr } = await supabase.from('retail_stock_transfers').insert({
                transfer_no: tNo, from_outlet_id: fromId, to_outlet_id: toOutletId,
                status: 'Pending', notes: transferNotes, created_by: user?.name || 'Unknown',
            }).select().single();
            if (tErr) throw tErr;
            const transferItems = items.map(i => ({ transfer_id: tData.transfer_id, product_id: i.productId, product_name: i.productName, product_code: i.productCode, quantity: i.quantity, unit: i.unit }));
            await supabase.from('retail_stock_transfer_items').insert(transferItems);

            // Deduct stock from source outlet
            for (const item of items) {
                const { data: sData } = await supabase.from('retail_stock').select('st_id, qty').eq('pid', item.productId).eq('outlet_id', fromId).single();
                if (sData) { await supabase.from('retail_stock').update({ qty: Math.max(0, (sData.qty || 0) - item.quantity) }).eq('st_id', sData.st_id); }
            }
            toast.success(`Transfer ${tNo} created!`);
            setShowCreate(false); setItems([]); setTransferNotes(''); setToOutletId(0);
            loadData();
        } catch (err: any) { toast.error(err.message || 'Error'); }
        setIsSaving(false);
    };

    const receiveTransfer = async (t: Transfer) => {
        if (t.status !== 'Pending') return;
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const { data: tItems } = await supabase.from('retail_stock_transfer_items').select('*').eq('transfer_id', t.transfer_id);
            if (!tItems) return;
            for (const item of tItems) {
                const { data: sData } = await supabase.from('retail_stock').select('st_id, qty').eq('pid', item.product_id).eq('outlet_id', t.to_outlet_id).single();
                if (sData) { await supabase.from('retail_stock').update({ qty: (sData.qty || 0) + item.quantity }).eq('st_id', sData.st_id); }
                else { await supabase.from('retail_stock').insert({ pid: item.product_id, qty: item.quantity, outlet_id: t.to_outlet_id, storage_type: 'Store' }); }
            }
            await supabase.from('retail_stock_transfers').update({ status: 'Received', received_by: user?.name || '', received_at: new Date().toISOString() }).eq('transfer_id', t.transfer_id);
            toast.success('Transfer received! Stock updated.');
            loadData();
        } catch (err: any) { toast.error(err.message || 'Error'); }
    };

    const viewTransferDetails = async (t: Transfer) => {
        const { data } = await supabase.from('retail_stock_transfer_items').select('*').eq('transfer_id', t.transfer_id);
        setViewItems((data || []).map((d: any) => ({ id: d.item_id, productId: d.product_id, productCode: d.product_code, productName: d.product_name, quantity: d.quantity, unit: d.unit, receivedQty: d.received_qty || 0 })));
        setViewTransfer(t); setShowView(true);
    };

    const getOutletName = (id: number) => outlets.find(o => o.outlet_id === id)?.outlet_name || `Outlet #${id}`;
    const statusColor = (s: string) => s === 'Received' ? 'bg-emerald-100 text-emerald-700' : s === 'Cancelled' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700';

    if (isLoading) return (<div className="flex flex-col items-center justify-center h-96"><div className="w-14 h-14 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /><p className="mt-4 text-gray-500 font-medium text-sm">Loading...</p></div>);

    return (
        <div className="space-y-5" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>

            {/* Create Modal */}
            {showCreate && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4 text-white rounded-t-3xl flex items-center justify-between sticky top-0">
                            <h2 className="text-lg font-bold flex items-center gap-2"><FiRepeat size={18} /> New Stock Transfer</h2>
                            <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-white/20 rounded-lg"><FiX size={18} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">From Outlet</label>
                                    <div className="px-3 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm font-bold text-gray-700">{activeOutlet?.outlet_name || 'Current'}</div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">To Outlet *</label>
                                    <select value={toOutletId} onChange={e => setToOutletId(Number(e.target.value))}
                                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-indigo-500 outline-none">
                                        <option value={0}>Select destination...</option>
                                        {outlets.filter(o => o.outlet_id !== activeOutlet?.outlet_id && o.active).map(o => (
                                            <option key={o.outlet_id} value={o.outlet_id}>{o.outlet_name} ({o.outlet_code})</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            {/* Product search */}
                            <div className="relative">
                                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" size={14} />
                                <input type="text" value={productSearch} onChange={e => { setProductSearch(e.target.value); setShowDropdown(e.target.value.length > 0); }}
                                    placeholder="Search product to add..." className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-indigo-500 outline-none" />
                                {showDropdown && filteredProducts.length > 0 && (
                                    <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                                        {filteredProducts.map(p => (
                                            <button key={p.pid} onClick={() => addItem(p)} className="w-full text-left px-4 py-2 hover:bg-indigo-50 text-sm border-b border-gray-50">
                                                <span className="text-xs text-indigo-500 font-mono">{p.product_code}</span> • {p.product_name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {/* Items */}
                            {items.length > 0 && (
                                <table className="w-full text-sm">
                                    <thead><tr className="bg-gray-50"><th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">Product</th><th className="px-3 py-2 text-center text-[10px] font-bold text-gray-500 uppercase">Unit</th><th className="px-3 py-2 text-center text-[10px] font-bold text-gray-500 uppercase">Qty</th><th className="px-3 py-2 w-10"></th></tr></thead>
                                    <tbody>{items.map(i => (
                                        <tr key={i.id} className="border-b border-gray-50">
                                            <td className="px-3 py-2"><span className="text-xs text-gray-400 font-mono">{i.productCode}</span> {i.productName}</td>
                                            <td className="px-3 py-2 text-center"><span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">{i.unit}</span></td>
                                            <td className="px-3 py-2 text-center"><input type="number" value={i.quantity} onChange={e => setItems(prev => prev.map(x => x.id === i.id ? { ...x, quantity: Number(e.target.value) } : x))} min={0.01} step={0.01} className="w-16 px-2 py-1 border border-gray-200 rounded text-center text-sm font-bold" /></td>
                                            <td className="px-3 py-2"><button onClick={() => setItems(prev => prev.filter(x => x.id !== i.id))} className="text-red-400 hover:text-red-600"><FiTrash2 size={14} /></button></td>
                                        </tr>
                                    ))}</tbody>
                                </table>
                            )}
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Notes</label>
                                <textarea value={transferNotes} onChange={e => setTransferNotes(e.target.value)} placeholder="Optional..." rows={2}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-indigo-500 outline-none resize-none" />
                            </div>
                            <div className="flex gap-3 pt-3 border-t">
                                <button onClick={() => setShowCreate(false)} className="flex-1 py-3 border-2 border-gray-200 text-gray-600 font-bold rounded-xl text-sm">Cancel</button>
                                <button onClick={createTransfer} disabled={isSaving} className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold rounded-xl text-sm disabled:opacity-50">
                                    {isSaving ? 'Sending...' : 'Send Transfer'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* View Modal */}
            {showView && viewTransfer && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={() => setShowView(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-4 text-white rounded-t-3xl flex items-center justify-between">
                            <h2 className="text-lg font-bold">{viewTransfer.transfer_no}</h2>
                            <button onClick={() => setShowView(false)} className="p-1 hover:bg-white/20 rounded-lg"><FiX size={18} /></button>
                        </div>
                        <div className="p-5 space-y-3">
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="p-3 bg-gray-50 rounded-xl"><p className="text-[10px] text-gray-400 uppercase font-bold">From</p><p className="font-bold text-gray-800">{getOutletName(viewTransfer.from_outlet_id)}</p></div>
                                <div className="p-3 bg-gray-50 rounded-xl"><p className="text-[10px] text-gray-400 uppercase font-bold">To</p><p className="font-bold text-gray-800">{getOutletName(viewTransfer.to_outlet_id)}</p></div>
                                <div className="p-3 bg-gray-50 rounded-xl"><p className="text-[10px] text-gray-400 uppercase font-bold">Status</p><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusColor(viewTransfer.status)}`}>{viewTransfer.status}</span></div>
                                <div className="p-3 bg-gray-50 rounded-xl"><p className="text-[10px] text-gray-400 uppercase font-bold">Date</p><p className="font-medium text-gray-700">{new Date(viewTransfer.created_at).toLocaleDateString()}</p></div>
                            </div>
                            <table className="w-full text-sm">
                                <thead><tr className="bg-gray-50"><th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500">Product</th><th className="px-3 py-2 text-center text-[10px] font-bold text-gray-500">Qty</th><th className="px-3 py-2 text-center text-[10px] font-bold text-gray-500">Unit</th></tr></thead>
                                <tbody>{viewItems.map(i => (
                                    <tr key={i.id} className="border-b border-gray-50">
                                        <td className="px-3 py-2">{i.productName}</td>
                                        <td className="px-3 py-2 text-center font-bold">{i.quantity}</td>
                                        <td className="px-3 py-2 text-center"><span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">{i.unit}</span></td>
                                    </tr>
                                ))}</tbody>
                            </table>
                            {viewTransfer.status === 'Pending' && viewTransfer.to_outlet_id === activeOutlet?.outlet_id && (
                                <button onClick={() => { receiveTransfer(viewTransfer); setShowView(false); }} className="w-full py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2">
                                    <FiCheck size={16} /> Receive Transfer
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* TOP BAR */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-300/40"><FiRepeat className="text-white" size={24} /></div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Stock Transfer</h1>
                        <p className="text-gray-500 text-sm mt-1">Transfer stock between outlets</p>
                    </div>
                </div>
                <button onClick={() => setShowCreate(true)} className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-semibold flex items-center gap-2 shadow-lg hover:shadow-xl transition-all text-sm">
                    <FiPlus size={16} /> New Transfer
                </button>
            </div>

            {/* STAT CARDS */}
            <div className="grid grid-cols-4 gap-4">
                {[
                    { label: 'Total Transfers', value: transfers.length, color: 'from-blue-500 to-indigo-600', icon: <FiRepeat size={20} /> },
                    { label: 'Pending', value: transfers.filter(t => t.status === 'Pending').length, color: 'from-amber-500 to-orange-600', icon: <FiTruck size={20} /> },
                    { label: 'Received', value: transfers.filter(t => t.status === 'Received').length, color: 'from-emerald-500 to-green-600', icon: <FiCheck size={20} /> },
                    { label: 'Outgoing', value: transfers.filter(t => t.from_outlet_id === activeOutlet?.outlet_id).length, color: 'from-purple-500 to-violet-600', icon: <FiPackage size={20} /> },
                ].map((s, i) => (
                    <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm relative overflow-hidden">
                        <div className={`absolute top-0 right-0 w-16 h-16 bg-gradient-to-br ${s.color} opacity-10 rounded-bl-full`} />
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center text-white mb-3`}>{s.icon}</div>
                        <p className="text-2xl font-black text-gray-800">{s.value}</p>
                        <p className="text-xs text-gray-500 font-medium">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* TRANSFERS LIST */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-white">Transfer History</h2>
                </div>
                {transfers.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                        <FiRepeat size={40} className="mx-auto mb-3 opacity-30" />
                        <p className="font-medium text-sm">No transfers yet</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead><tr className="bg-gray-50">
                            <th className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase">Transfer #</th>
                            <th className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase">From</th>
                            <th className="px-4 py-2.5 text-center text-[10px] font-bold text-gray-500 uppercase"></th>
                            <th className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase">To</th>
                            <th className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase">Date</th>
                            <th className="px-4 py-2.5 text-center text-[10px] font-bold text-gray-500 uppercase">Status</th>
                            <th className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase">By</th>
                            <th className="px-4 py-2.5 text-center text-[10px] font-bold text-gray-500 uppercase">Actions</th>
                        </tr></thead>
                        <tbody>
                            {transfers.map((t, idx) => (
                                <tr key={t.transfer_id} className={`border-b border-gray-50 hover:bg-blue-50/30 transition-colors ${idx % 2 ? 'bg-gray-50/30' : ''}`}>
                                    <td className="px-4 py-3 text-sm font-mono font-bold text-indigo-600">{t.transfer_no}</td>
                                    <td className="px-4 py-3 text-sm font-medium text-gray-700">{getOutletName(t.from_outlet_id)}</td>
                                    <td className="px-4 py-3 text-center"><FiArrowRight className="text-gray-300 mx-auto" size={14} /></td>
                                    <td className="px-4 py-3 text-sm font-medium text-gray-700">{getOutletName(t.to_outlet_id)}</td>
                                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(t.created_at).toLocaleDateString()}</td>
                                    <td className="px-4 py-3 text-center"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColor(t.status)}`}>{t.status}</span></td>
                                    <td className="px-4 py-3 text-xs text-gray-500">{t.created_by}</td>
                                    <td className="px-4 py-3 text-center flex items-center justify-center gap-1">
                                        <button onClick={() => viewTransferDetails(t)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500" title="View"><FiEye size={14} /></button>
                                        {t.status === 'Pending' && t.to_outlet_id === activeOutlet?.outlet_id && (
                                            <button onClick={() => receiveTransfer(t)} className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-500" title="Receive"><FiCheck size={14} /></button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
