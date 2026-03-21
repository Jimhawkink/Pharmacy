'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet, Outlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';
import { FiMapPin, FiPlus, FiEdit3, FiTrash2, FiStar, FiCheck, FiX, FiPhone, FiMail, FiHome, FiSearch, FiUsers, FiUserPlus, FiUserMinus } from 'react-icons/fi';

export default function OutletsPage() {
    const { outlets, reloadOutlets, activeOutlet } = useOutlet();
    const [allOutlets, setAllOutlets] = useState<Outlet[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Modal
    const [showModal, setShowModal] = useState(false);
    const [editingOutlet, setEditingOutlet] = useState<Outlet | null>(null);
    const [form, setForm] = useState({ outlet_name: '', outlet_code: '', address: '', city: '', phone: '', email: '', is_main: false });
    const [isSaving, setIsSaving] = useState(false);

    // Staff Assignment Modal
    const [showStaffModal, setShowStaffModal] = useState(false);
    const [staffOutlet, setStaffOutlet] = useState<Outlet | null>(null);
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [assignedUserIds, setAssignedUserIds] = useState<number[]>([]);
    const [staffSearch, setStaffSearch] = useState('');
    const [loadingStaff, setLoadingStaff] = useState(false);
    const [staffCounts, setStaffCounts] = useState<Record<number, number>>({});

    const loadAll = useCallback(async () => {
        setIsLoading(true);
        try {
            const { data } = await supabase.from('retail_outlets').select('*').order('is_main', { ascending: false }).order('outlet_name');
            setAllOutlets(data || []);
        } catch { toast.error('Failed to load outlets'); }
        setIsLoading(false);
    }, []);

    useEffect(() => { loadAll(); }, [loadAll]);

    // Load staff counts for all outlets
    const loadStaffCounts = async () => {
        try {
            const { data } = await supabase.from('retail_user_outlets').select('outlet_id');
            const counts: Record<number, number> = {};
            (data || []).forEach((row: any) => {
                counts[row.outlet_id] = (counts[row.outlet_id] || 0) + 1;
            });
            setStaffCounts(counts);
        } catch { }
    };

    useEffect(() => { loadStaffCounts(); }, [allOutlets]);

    const openAdd = () => {
        setEditingOutlet(null);
        setForm({ outlet_name: '', outlet_code: '', address: '', city: '', phone: '', email: '', is_main: false });
        setShowModal(true);
    };

    const openEdit = (o: Outlet) => {
        setEditingOutlet(o);
        setForm({ outlet_name: o.outlet_name, outlet_code: o.outlet_code, address: o.address || '', city: o.city || '', phone: o.phone || '', email: '', is_main: o.is_main });
        setShowModal(true);
    };

    const save = async () => {
        if (!form.outlet_name.trim() || !form.outlet_code.trim()) { toast.error('Name and code are required'); return; }
        setIsSaving(true);
        try {
            if (editingOutlet) {
                const { error } = await supabase.from('retail_outlets').update({
                    outlet_name: form.outlet_name, outlet_code: form.outlet_code.toUpperCase(),
                    address: form.address, city: form.city, phone: form.phone, is_main: form.is_main,
                    updated_at: new Date().toISOString(),
                }).eq('outlet_id', editingOutlet.outlet_id);
                if (error) throw error;
                toast.success('Outlet updated!');
            } else {
                const { error } = await supabase.from('retail_outlets').insert({
                    outlet_name: form.outlet_name, outlet_code: form.outlet_code.toUpperCase(),
                    address: form.address, city: form.city, phone: form.phone, is_main: form.is_main,
                    active: true,
                });
                if (error) throw error;
                toast.success('Outlet created!');
            }
            setShowModal(false);
            loadAll();
            reloadOutlets();
        } catch (err: any) { toast.error(err.message || 'Error saving'); }
        setIsSaving(false);
    };

    const toggleActive = async (o: Outlet) => {
        if (o.is_main) { toast.error("Can't deactivate main outlet"); return; }
        await supabase.from('retail_outlets').update({ active: !o.active }).eq('outlet_id', o.outlet_id);
        toast.success(o.active ? 'Outlet deactivated' : 'Outlet activated');
        loadAll(); reloadOutlets();
    };

    const deleteOutlet = async (o: Outlet) => {
        if (o.is_main) { toast.error("Can't delete main outlet"); return; }
        if (!confirm(`Delete "${o.outlet_name}"? This cannot be undone.`)) return;
        await supabase.from('retail_outlets').delete().eq('outlet_id', o.outlet_id);
        toast.success('Outlet deleted');
        loadAll(); reloadOutlets();
    };

    // ─── Staff Assignment ──────────────────────
    const openStaffModal = async (o: Outlet) => {
        setStaffOutlet(o);
        setStaffSearch('');
        setShowStaffModal(true);
        setLoadingStaff(true);
        try {
            // Load all users
            const { data: users } = await supabase.from('retail_users').select('user_id, user_name, name, user_type, email').eq('active', true).order('name');
            setAllUsers(users || []);
            // Load assigned user IDs for this outlet
            const { data: links } = await supabase.from('retail_user_outlets').select('user_id').eq('outlet_id', o.outlet_id);
            setAssignedUserIds((links || []).map((l: any) => l.user_id));
        } catch { toast.error('Failed to load staff'); }
        setLoadingStaff(false);
    };

    const assignUser = async (userId: number) => {
        if (!staffOutlet) return;
        try {
            await supabase.from('retail_user_outlets').insert({ user_id: userId, outlet_id: staffOutlet.outlet_id });
            setAssignedUserIds(prev => [...prev, userId]);
            setStaffCounts(prev => ({ ...prev, [staffOutlet.outlet_id]: (prev[staffOutlet.outlet_id] || 0) + 1 }));
            toast.success('User assigned!');
        } catch (err: any) {
            if (err?.code === '23505') toast.error('Already assigned');
            else toast.error('Failed to assign');
        }
    };

    const removeUser = async (userId: number) => {
        if (!staffOutlet) return;
        await supabase.from('retail_user_outlets').delete().eq('user_id', userId).eq('outlet_id', staffOutlet.outlet_id);
        setAssignedUserIds(prev => prev.filter(id => id !== userId));
        setStaffCounts(prev => ({ ...prev, [staffOutlet.outlet_id]: Math.max(0, (prev[staffOutlet.outlet_id] || 0) - 1) }));
        toast.success('User removed');
    };

    const filtered = allOutlets.filter(o => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return o.outlet_name.toLowerCase().includes(q) || o.outlet_code.toLowerCase().includes(q);
    });

    const activeCount = allOutlets.filter(o => o.active).length;

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center h-96">
            <div className="w-14 h-14 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            <p className="mt-4 text-gray-500 font-medium text-sm">Loading outlets...</p>
        </div>
    );

    return (
        <div className="space-y-5" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-4 text-white rounded-t-3xl flex items-center justify-between">
                            <h2 className="text-lg font-bold flex items-center gap-2"><FiMapPin size={18} /> {editingOutlet ? 'Edit Outlet' : 'Add New Outlet'}</h2>
                            <button onClick={() => setShowModal(false)} className="p-1 hover:bg-white/20 rounded-lg"><FiX size={18} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Outlet Name *</label>
                                    <input type="text" value={form.outlet_name} onChange={e => setForm({ ...form, outlet_name: e.target.value })} placeholder="e.g. Silibwet Branch"
                                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-indigo-500 outline-none" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Code *</label>
                                    <input type="text" value={form.outlet_code} onChange={e => setForm({ ...form, outlet_code: e.target.value.toUpperCase() })} placeholder="e.g. SLB" maxLength={10}
                                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-indigo-500 outline-none uppercase font-mono" />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Address</label>
                                <input type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Physical address"
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-indigo-500 outline-none" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">City</label>
                                    <input type="text" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="Town/City"
                                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-indigo-500 outline-none" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Phone</label>
                                    <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="0720..."
                                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-indigo-500 outline-none" />
                                </div>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer p-3 bg-amber-50 border border-amber-200 rounded-xl">
                                <input type="checkbox" checked={form.is_main} onChange={e => setForm({ ...form, is_main: e.target.checked })} className="accent-amber-600" />
                                <div>
                                    <span className="text-sm font-bold text-amber-800">Set as Main/Head Office</span>
                                    <p className="text-[10px] text-amber-600">Main outlet can view all outlets' data</p>
                                </div>
                            </label>
                            <div className="flex gap-3 pt-3 border-t">
                                <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-3 border-2 border-gray-200 text-gray-600 font-bold rounded-xl text-sm">Cancel</button>
                                <button onClick={save} disabled={isSaving} className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold rounded-xl text-sm disabled:opacity-50">
                                    {isSaving ? 'Saving...' : editingOutlet ? 'Update Outlet' : 'Create Outlet'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Staff Assignment Modal */}
            {showStaffModal && staffOutlet && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={() => setShowStaffModal(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-4 text-white rounded-t-3xl flex items-center justify-between shrink-0">
                            <div>
                                <h2 className="text-lg font-bold flex items-center gap-2"><FiUsers size={18} /> Manage Staff</h2>
                                <p className="text-xs text-white/70 mt-0.5">{staffOutlet.outlet_name} ({staffOutlet.outlet_code})</p>
                            </div>
                            <button onClick={() => setShowStaffModal(false)} className="p-1 hover:bg-white/20 rounded-lg"><FiX size={18} /></button>
                        </div>
                        {loadingStaff ? (
                            <div className="flex flex-col items-center justify-center py-16">
                                <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                                <p className="mt-3 text-sm text-gray-500">Loading staff...</p>
                            </div>
                        ) : (
                            <div className="overflow-y-auto p-5 space-y-4">
                                {/* Assigned Users */}
                                <div>
                                    <p className="text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1"><FiCheck size={12} /> Assigned Staff ({assignedUserIds.length})</p>
                                    {assignedUserIds.length === 0 ? (
                                        <p className="text-sm text-gray-400 italic py-3 text-center bg-gray-50 rounded-xl">No staff assigned — all users can access this outlet</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {allUsers.filter(u => assignedUserIds.includes(u.user_id)).map(u => (
                                                <div key={u.user_id} className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                                                    <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">
                                                        {u.name?.charAt(0) || 'U'}
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-sm font-bold text-gray-800">{u.name}</p>
                                                        <p className="text-[10px] text-gray-500">{u.user_type} • {u.user_name}</p>
                                                    </div>
                                                    <button onClick={() => removeUser(u.user_id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Remove">
                                                        <FiUserMinus size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Unassigned Users */}
                                <div>
                                    <p className="text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1"><FiUserPlus size={12} /> Available Users</p>
                                    <div className="relative mb-2">
                                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                        <input type="text" value={staffSearch} onChange={e => setStaffSearch(e.target.value)} placeholder="Search users..."
                                            className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-emerald-500 outline-none" />
                                    </div>
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {allUsers
                                            .filter(u => !assignedUserIds.includes(u.user_id))
                                            .filter(u => !staffSearch || u.name?.toLowerCase().includes(staffSearch.toLowerCase()) || u.user_name?.toLowerCase().includes(staffSearch.toLowerCase()))
                                            .map(u => (
                                                <div key={u.user_id} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl hover:border-emerald-300 transition-colors">
                                                    <div className="w-9 h-9 rounded-full bg-gray-300 text-white flex items-center justify-center text-sm font-bold">
                                                        {u.name?.charAt(0) || 'U'}
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-sm font-bold text-gray-700">{u.name}</p>
                                                        <p className="text-[10px] text-gray-500">{u.user_type} • {u.user_name}</p>
                                                    </div>
                                                    <button onClick={() => assignUser(u.user_id)} className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors flex items-center gap-1">
                                                        <FiUserPlus size={12} /> Assign
                                                    </button>
                                                </div>
                                            ))}
                                        {allUsers.filter(u => !assignedUserIds.includes(u.user_id)).length === 0 && (
                                            <p className="text-sm text-gray-400 italic text-center py-4">All users are assigned</p>
                                        )}
                                    </div>
                                </div>

                                <div className="text-center pt-3 border-t">
                                    <p className="text-[10px] text-gray-400">💡 If no staff is assigned, all users can access this outlet</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TOP BAR */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-300/40">
                        <FiMapPin className="text-white" size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Outlet Management</h1>
                        <p className="text-gray-500 text-sm mt-1">Create and manage your business outlets/branches</p>
                    </div>
                </div>
                <button onClick={openAdd} className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-semibold flex items-center gap-2 shadow-lg hover:shadow-xl transition-all text-sm">
                    <FiPlus size={16} /> Add Outlet
                </button>
            </div>

            {/* STAT CARDS */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Total Outlets', value: allOutlets.length, color: 'from-indigo-500 to-purple-600', icon: <FiMapPin size={20} /> },
                    { label: 'Active', value: activeCount, color: 'from-emerald-500 to-green-600', icon: <FiCheck size={20} /> },
                    { label: 'Inactive', value: allOutlets.length - activeCount, color: 'from-amber-500 to-orange-600', icon: <FiX size={20} /> },
                ].map((s, i) => (
                    <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm relative overflow-hidden">
                        <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${s.color} opacity-10 rounded-bl-full`} />
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center text-white mb-3`}>{s.icon}</div>
                        <p className="text-2xl font-black text-gray-800">{s.value}</p>
                        <p className="text-xs text-gray-500 font-medium">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Search */}
            <div className="relative">
                <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search outlets..."
                    className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:border-indigo-500 outline-none shadow-sm" />
            </div>

            {/* OUTLETS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(o => (
                    <div key={o.outlet_id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all hover:shadow-md ${o.active ? 'border-gray-100' : 'border-red-200 opacity-60'} ${activeOutlet?.outlet_id === o.outlet_id ? 'ring-2 ring-indigo-500' : ''}`}>
                        <div className={`px-5 py-3 flex items-center justify-between ${o.is_main ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white' : 'bg-gray-50'}`}>
                            <div className="flex items-center gap-2">
                                {o.is_main && <FiStar size={14} />}
                                <span className={`text-xs font-mono font-bold ${o.is_main ? 'text-white/80' : 'text-gray-400'}`}>{o.outlet_code}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${o.active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                    {o.active ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                        </div>
                        <div className="p-5">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                {o.outlet_name}
                                {o.is_main && <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-bold">HEAD OFFICE</span>}
                            </h3>
                            {o.address && <p className="text-xs text-gray-500 mt-1 flex items-center gap-1"><FiHome size={10} /> {o.address}</p>}
                            {o.city && <p className="text-xs text-gray-400">{o.city}</p>}
                            {o.phone && <p className="text-xs text-gray-500 mt-1 flex items-center gap-1"><FiPhone size={10} /> {o.phone}</p>}
                            <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
                                <button onClick={() => openStaffModal(o)} className="flex-1 py-2 text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors flex items-center justify-center gap-1">
                                    <FiUsers size={12} /> Staff {staffCounts[o.outlet_id] ? `(${staffCounts[o.outlet_id]})` : ''}
                                </button>
                                <button onClick={() => openEdit(o)} className="flex-1 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors flex items-center justify-center gap-1">
                                    <FiEdit3 size={12} /> Edit
                                </button>
                                <button onClick={() => toggleActive(o)} className={`py-2 px-3 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1 ${o.active ? 'text-amber-600 bg-amber-50 hover:bg-amber-100' : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'}`}>
                                    {o.active ? <><FiX size={12} /></> : <><FiCheck size={12} /></>}
                                </button>
                                {!o.is_main && (
                                    <button onClick={() => deleteOutlet(o)} className="py-2 px-3 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors">
                                        <FiTrash2 size={12} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {filtered.length === 0 && (
                <div className="text-center py-16 text-gray-400">
                    <FiMapPin size={48} className="mx-auto mb-4 opacity-30" />
                    <p className="font-medium">No outlets found</p>
                    <p className="text-sm">Click "Add Outlet" to create one</p>
                </div>
            )}
        </div>
    );
}
