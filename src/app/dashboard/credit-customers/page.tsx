'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { FiUsers, FiPlus, FiSearch, FiFilter, FiEdit2, FiTrash2, FiRefreshCw, FiDownload, FiPhone, FiMail, FiMapPin, FiDollarSign, FiUserCheck, FiAlertTriangle, FiX, FiChevronLeft, FiChevronRight, FiEye } from 'react-icons/fi';

interface Customer {
    customer_id: number;
    customer_code: string;
    customer_name: string;
    phone: string;
    email: string;
    address: string;
    credit_limit: number;
    current_balance: number;
    active: boolean;
    created_at: string;
}

const emptyForm = {
    customer_name: '', phone: '', email: '', address: '',
    credit_limit: 0, current_balance: 0, active: true
};

export default function CreditCustomersPage() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<'All' | 'With Balance' | 'Zero Balance'>('All');
    const [showModal, setShowModal] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [formData, setFormData] = useState(emptyForm);
    const [page, setPage] = useState(1);
    const [viewCustomer, setViewCustomer] = useState<Customer | null>(null);
    const [customerSales, setCustomerSales] = useState<any[]>([]);
    const [customerPayments, setCustomerPayments] = useState<any[]>([]);
    const perPage = 15;

    useEffect(() => { loadCustomers(); }, []);

    const loadCustomers = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('retail_credit_customers')
            .select('*')
            .order('customer_name');
        if (error) { toast.error('Failed to load customers'); console.error(error); }
        else setCustomers(data || []);
        setLoading(false);
    };

    const loadCustomerDetails = async (c: Customer) => {
        setViewCustomer(c);
        // Load sales for this customer
        const { data: sales } = await supabase
            .from('retail_sales')
            .select('*')
            .eq('customer_id', c.customer_id)
            .order('sale_datetime', { ascending: false })
            .limit(50);
        setCustomerSales(sales || []);
        // Load payments
        const { data: payments } = await supabase
            .from('retail_credit_payments')
            .select('*')
            .eq('customer_id', c.customer_id)
            .order('payment_datetime', { ascending: false })
            .limit(50);
        setCustomerPayments(payments || []);
    };

    const filtered = useMemo(() => {
        let list = customers;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            list = list.filter(c =>
                c.customer_name?.toLowerCase().includes(q) ||
                c.phone?.toLowerCase().includes(q) ||
                c.email?.toLowerCase().includes(q) ||
                c.customer_code?.toLowerCase().includes(q)
            );
        }
        if (filterStatus === 'With Balance') list = list.filter(c => c.current_balance > 0);
        if (filterStatus === 'Zero Balance') list = list.filter(c => c.current_balance === 0);
        return list;
    }, [customers, searchQuery, filterStatus]);

    const totalPages = Math.ceil(filtered.length / perPage);
    const paginated = filtered.slice((page - 1) * perPage, page * perPage);

    const totalOwed = customers.reduce((s, c) => s + (c.current_balance || 0), 0);
    const activeCount = customers.filter(c => c.active).length;
    const withBalance = customers.filter(c => c.current_balance > 0).length;

    const openAddModal = () => {
        setEditingCustomer(null);
        setFormData(emptyForm);
        setShowModal(true);
    };

    const openEditModal = (c: Customer) => {
        setEditingCustomer(c);
        setFormData({
            customer_name: c.customer_name || '',
            phone: c.phone || '',
            email: c.email || '',
            address: c.address || '',
            credit_limit: c.credit_limit || 0,
            current_balance: c.current_balance || 0,
            active: c.active !== false
        });
        setShowModal(true);
    };

    const generateCode = () => {
        const num = customers.length + 1;
        return `CUST-${String(num).padStart(4, '0')}`;
    };

    const handleSubmit = async () => {
        if (!formData.customer_name.trim()) { toast.error('Customer name is required'); return; }

        try {
            if (editingCustomer) {
                const { error } = await supabase
                    .from('retail_credit_customers')
                    .update({
                        customer_name: formData.customer_name.trim(),
                        phone: formData.phone.trim(),
                        email: formData.email.trim(),
                        address: formData.address.trim(),
                        credit_limit: Number(formData.credit_limit) || 0,
                        active: formData.active
                    })
                    .eq('customer_id', editingCustomer.customer_id);
                if (error) throw error;
                toast.success('Customer updated!');
            } else {
                const { error } = await supabase
                    .from('retail_credit_customers')
                    .insert({
                        customer_code: generateCode(),
                        customer_name: formData.customer_name.trim(),
                        phone: formData.phone.trim(),
                        email: formData.email.trim(),
                        address: formData.address.trim(),
                        credit_limit: Number(formData.credit_limit) || 0,
                        current_balance: Number(formData.current_balance) || 0,
                        active: formData.active
                    });
                if (error) throw error;
                toast.success('Customer added!');
            }
            setShowModal(false);
            loadCustomers();
        } catch (err: any) {
            toast.error(err.message || 'Failed to save');
        }
    };

    const deleteCustomer = async (c: Customer) => {
        if (!confirm(`Delete customer "${c.customer_name}"? This cannot be undone.`)) return;
        const { error } = await supabase.from('retail_credit_customers').delete().eq('customer_id', c.customer_id);
        if (error) toast.error(error.message);
        else { toast.success('Customer deleted'); loadCustomers(); }
    };

    const exportCSV = () => {
        const headers = ['Code', 'Name', 'Phone', 'Email', 'Balance', 'Credit Limit', 'Active'];
        const rows = filtered.map(c => [c.customer_code, c.customer_name, c.phone, c.email, c.current_balance, c.credit_limit, c.active ? 'Yes' : 'No']);
        const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'customers.csv'; a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-5" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>

            {/* ━━━ TOP BAR ━━━ */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-300/40">
                        <FiUsers className="text-white" size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Credit Customers</h1>
                        <p className="text-gray-500 text-sm mt-1">Manage customers &bull; Credit tracking &bull; Balances</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={loadCustomers} className="p-2.5 rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-all shadow-sm" title="Refresh">
                        <FiRefreshCw size={16} />
                    </button>
                    <button onClick={exportCSV} className="px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-600 hover:text-blue-600 hover:border-blue-300 transition-all text-sm font-semibold flex items-center gap-2 shadow-sm">
                        <FiDownload size={14} /> Export
                    </button>
                    <button onClick={openAddModal} className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-2xl shadow-lg shadow-blue-300/40 hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-300">
                        <FiPlus size={16} strokeWidth={3} /> Add Customer
                    </button>
                </div>
            </div>

            {/* ━━━ STAT CARDS ━━━ */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total Customers', value: customers.length, icon: FiUsers, gradient: 'from-blue-500 to-blue-600', bg: 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200', text: 'text-blue-600' },
                    { label: 'Active', value: activeCount, icon: FiUserCheck, gradient: 'from-green-500 to-green-600', bg: 'bg-gradient-to-br from-green-50 to-green-100 border-green-200', text: 'text-green-600' },
                    { label: 'With Balance', value: withBalance, icon: FiAlertTriangle, gradient: 'from-orange-500 to-orange-600', bg: 'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200', text: 'text-orange-600' },
                    { label: 'Total Owed', value: `Ksh ${totalOwed.toLocaleString()}`, icon: FiDollarSign, gradient: 'from-red-500 to-red-600', bg: 'bg-gradient-to-br from-red-50 to-red-100 border-red-200', text: 'text-red-600' },
                ].map((s, i) => (
                    <div key={i} className={`${s.bg} rounded-2xl p-5 border hover:shadow-lg transition-all group cursor-default`}>
                        <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${s.gradient} flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform`}>
                                <s.icon size={20} />
                            </div>
                            <div>
                                <p className={`text-sm ${s.text} font-medium`}>{s.label}</p>
                                <p className="text-2xl font-bold text-gray-800">{s.value}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ━━━ SEARCH & FILTER ━━━ */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-col lg:flex-row gap-3 items-center shadow-sm">
                <div className="flex-1 relative w-full">
                    <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input type="text" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                        placeholder="Search by name, phone, email, or code..."
                        className="w-full px-5 py-3 pl-12 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-400/20 transition-all" />
                </div>
                <div className="flex items-center gap-2">
                    <FiFilter className="text-gray-400" size={14} />
                    {(['All', 'With Balance', 'Zero Balance'] as const).map(s => (
                        <button key={s} onClick={() => { setFilterStatus(s); setPage(1); }}
                            className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${filterStatus === s
                                ? 'bg-blue-500 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            {/* ━━━ TABLE ━━━ */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-14 h-14 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                    <p className="mt-4 text-gray-500 font-medium">Loading customers...</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-20">
                    <FiUsers size={48} className="mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500 font-medium">No customers found</p>
                    <button onClick={openAddModal} className="mt-3 px-5 py-2 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600">Add First Customer</button>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gradient-to-r from-blue-500 to-blue-600">
                                    <th className="px-4 py-3.5 text-left text-[11px] font-bold text-blue-100 uppercase tracking-wider">Code</th>
                                    <th className="px-4 py-3.5 text-left text-[11px] font-bold text-blue-100 uppercase tracking-wider">Customer Name</th>
                                    <th className="px-4 py-3.5 text-left text-[11px] font-bold text-blue-100 uppercase tracking-wider">Phone</th>
                                    <th className="px-4 py-3.5 text-left text-[11px] font-bold text-blue-100 uppercase tracking-wider">Email</th>
                                    <th className="px-4 py-3.5 text-right text-[11px] font-bold text-blue-100 uppercase tracking-wider">Balance</th>
                                    <th className="px-4 py-3.5 text-right text-[11px] font-bold text-blue-100 uppercase tracking-wider">Credit Limit</th>
                                    <th className="px-4 py-3.5 text-center text-[11px] font-bold text-blue-100 uppercase tracking-wider">Status</th>
                                    <th className="px-4 py-3.5 text-center text-[11px] font-bold text-blue-100 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginated.map(c => (
                                    <tr key={c.customer_id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                                        <td className="px-4 py-3">
                                            <span className="text-xs font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">{c.customer_code}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="font-semibold text-gray-800 text-sm">{c.customer_name}</p>
                                            {c.address && <p className="text-[11px] text-gray-400 truncate max-w-[200px]">{c.address}</p>}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600">{c.phone || '-'}</td>
                                        <td className="px-4 py-3 text-sm text-gray-600 truncate max-w-[150px]">{c.email || '-'}</td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={`font-bold text-sm ${c.current_balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                Ksh {(c.current_balance || 0).toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm text-gray-600">
                                            Ksh {(c.credit_limit || 0).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${c.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                {c.active ? '● Active' : '● Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <button onClick={() => loadCustomerDetails(c)} className="p-1.5 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-all" title="View Details">
                                                    <FiEye size={13} className="text-blue-500" />
                                                </button>
                                                <button onClick={() => openEditModal(c)} className="p-1.5 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-all" title="Edit">
                                                    <FiEdit2 size={13} className="text-blue-500" />
                                                </button>
                                                <button onClick={() => deleteCustomer(c)} className="p-1.5 bg-white border border-gray-200 rounded-lg hover:bg-red-50 hover:border-red-300 transition-all" title="Delete">
                                                    <FiTrash2 size={13} className="text-red-500" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                            <span className="text-xs text-gray-500">Showing {(page - 1) * perPage + 1}-{Math.min(page * perPage, filtered.length)} of {filtered.length}</span>
                            <div className="flex items-center gap-1">
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg disabled:opacity-30 hover:bg-gray-100 transition-all">
                                    <FiChevronLeft size={16} />
                                </button>
                                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                    const pg = i + 1;
                                    return (
                                        <button key={pg} onClick={() => setPage(pg)}
                                            className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${pg === page ? 'bg-blue-500 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}>
                                            {pg}
                                        </button>
                                    );
                                })}
                                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 rounded-lg disabled:opacity-30 hover:bg-gray-100 transition-all">
                                    <FiChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ━━━ VIEW CUSTOMER DETAILS ━━━ */}
            {viewCustomer && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-5 text-white rounded-t-3xl">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-bold">{viewCustomer.customer_name}</h2>
                                    <p className="text-blue-100 text-sm">{viewCustomer.customer_code} &bull; {viewCustomer.phone}</p>
                                </div>
                                <button onClick={() => setViewCustomer(null)} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
                                    <FiX size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Customer Summary */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-blue-50 p-4 rounded-xl text-center">
                                    <p className="text-xs text-blue-600 font-medium">Current Balance</p>
                                    <p className={`text-2xl font-bold ${viewCustomer.current_balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        Ksh {(viewCustomer.current_balance || 0).toLocaleString()}
                                    </p>
                                </div>
                                <div className="bg-green-50 p-4 rounded-xl text-center">
                                    <p className="text-xs text-green-600 font-medium">Credit Limit</p>
                                    <p className="text-2xl font-bold text-green-700">Ksh {(viewCustomer.credit_limit || 0).toLocaleString()}</p>
                                </div>
                                <div className="bg-purple-50 p-4 rounded-xl text-center">
                                    <p className="text-xs text-purple-600 font-medium">Total Sales</p>
                                    <p className="text-2xl font-bold text-purple-700">{customerSales.length}</p>
                                </div>
                            </div>

                            {/* Contact Info */}
                            <div className="flex items-center gap-6 text-sm text-gray-600">
                                {viewCustomer.phone && <span className="flex items-center gap-1"><FiPhone size={14} /> {viewCustomer.phone}</span>}
                                {viewCustomer.email && <span className="flex items-center gap-1"><FiMail size={14} /> {viewCustomer.email}</span>}
                                {viewCustomer.address && <span className="flex items-center gap-1"><FiMapPin size={14} /> {viewCustomer.address}</span>}
                            </div>

                            {/* Recent Sales */}
                            <div>
                                <h3 className="font-bold text-gray-800 mb-3">Recent Sales</h3>
                                {customerSales.length === 0 ? (
                                    <p className="text-gray-400 text-sm">No sales found</p>
                                ) : (
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {customerSales.slice(0, 10).map((s: any) => (
                                            <div key={s.sale_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-800">{s.receipt_no}</p>
                                                    <p className="text-xs text-gray-500">{new Date(s.sale_datetime).toLocaleDateString()} &bull; {s.payment_method}</p>
                                                </div>
                                                <p className="font-bold text-gray-800">Ksh {(s.total_amount || 0).toLocaleString()}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Recent Payments */}
                            <div>
                                <h3 className="font-bold text-gray-800 mb-3">Payment History</h3>
                                {customerPayments.length === 0 ? (
                                    <p className="text-gray-400 text-sm">No payments found</p>
                                ) : (
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {customerPayments.slice(0, 10).map((p: any) => (
                                            <div key={p.payment_id} className="flex items-center justify-between p-3 bg-green-50 rounded-xl">
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-800">Ksh {(p.amount_paid || 0).toLocaleString()}</p>
                                                    <p className="text-xs text-gray-500">{new Date(p.payment_datetime).toLocaleDateString()} &bull; {p.payment_method}{p.receipt_no ? ` • ${p.receipt_no}` : ''}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs text-gray-400">Balance after</p>
                                                    <p className="font-bold text-sm text-gray-700">Ksh {(p.balance_after || 0).toLocaleString()}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ━━━ ADD/EDIT MODAL ━━━ */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-5 text-white rounded-t-3xl">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-bold">{editingCustomer ? 'Edit Customer' : 'Add Customer'}</h2>
                                    {editingCustomer && <p className="text-blue-100 text-xs">{editingCustomer.customer_code}</p>}
                                </div>
                                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
                                    <FiX size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Customer Name *</label>
                                <input value={formData.customer_name} onChange={e => setFormData({ ...formData, customer_name: e.target.value })}
                                    placeholder="e.g., John Kamau" required
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-400/20 transition-all" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Phone</label>
                                    <input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="07XX XXX XXX"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-400/20 transition-all" />
                                </div>
                                <div>
                                    <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Email</label>
                                    <input value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="email@example.com"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-400/20 transition-all" />
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Address</label>
                                <input value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })}
                                    placeholder="P.O. Box 123, Nairobi"
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-400/20 transition-all" />
                            </div>

                            {/* Pricing section */}
                            <div className="bg-green-50/50 rounded-2xl p-5 border border-green-200">
                                <h3 className="font-bold text-green-800 mb-4 flex items-center gap-2">
                                    <FiDollarSign size={16} /> Credit Settings
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Credit Limit</label>
                                        <input type="number" value={formData.credit_limit} onChange={e => setFormData({ ...formData, credit_limit: Number(e.target.value) })}
                                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-400/20 transition-all" />
                                    </div>
                                    {!editingCustomer && (
                                        <div>
                                            <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Opening Balance</label>
                                            <input type="number" value={formData.current_balance} onChange={e => setFormData({ ...formData, current_balance: Number(e.target.value) })}
                                                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-400/20 transition-all" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Active toggle */}
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                <input type="checkbox" checked={formData.active} onChange={e => setFormData({ ...formData, active: e.target.checked })}
                                    className="w-5 h-5 rounded-lg accent-blue-500" />
                                <span className="text-sm font-medium text-gray-700">Active Customer</span>
                            </div>

                            {/* Submit */}
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-3 bg-gray-100 text-gray-600 rounded-xl font-semibold hover:bg-gray-200 transition-all">Cancel</button>
                                <button onClick={handleSubmit} className="flex-1 px-5 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-300/40 hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all">
                                    {editingCustomer ? 'Update Customer' : 'Add Customer'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
