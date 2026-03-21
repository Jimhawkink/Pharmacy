'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface ActivityLog {
    id: number;
    action_type: string;
    description: string;
    details: string;
    user_name: string;
    user_type: string;
    ip_address: string;
    created_at: string;
}

const activityTypes = [
    'All', 'Login', 'Logout', 'Create', 'Update', 'Delete',
    'Sale', 'Purchase', 'Stock Adjust', 'Price Change',
    'Shift Open', 'Shift Close', 'Payment', 'Refund', 'Export', 'Import', 'Other'
];

const getActionColor = (type: string) => {
    switch (type?.toLowerCase()) {
        case 'create': return 'bg-emerald-100 text-emerald-700';
        case 'update': return 'bg-blue-100 text-blue-700';
        case 'delete': return 'bg-red-100 text-red-700';
        case 'login': return 'bg-purple-100 text-purple-700';
        case 'logout': return 'bg-gray-100 text-gray-600';
        case 'sale': return 'bg-green-100 text-green-700';
        case 'purchase': return 'bg-cyan-100 text-cyan-700';
        case 'stock adjust': return 'bg-amber-100 text-amber-700';
        case 'price change': return 'bg-orange-100 text-orange-700';
        case 'shift open': return 'bg-indigo-100 text-indigo-700';
        case 'shift close': return 'bg-violet-100 text-violet-700';
        case 'payment': return 'bg-teal-100 text-teal-700';
        case 'refund': return 'bg-rose-100 text-rose-700';
        default: return 'bg-gray-100 text-gray-600';
    }
};

const getActionIcon = (type: string) => {
    switch (type?.toLowerCase()) {
        case 'create': return '➕';
        case 'update': return '✏️';
        case 'delete': return '🗑️';
        case 'login': return '🔑';
        case 'logout': return '🚪';
        case 'sale': return '💰';
        case 'purchase': return '📥';
        case 'stock adjust': return '📦';
        case 'price change': return '💹';
        case 'shift open': return '▶️';
        case 'shift close': return '⏹️';
        case 'payment': return '💳';
        case 'refund': return '↩️';
        case 'export': return '📤';
        case 'import': return '📥';
        default: return '📋';
    }
};

export default function ActivityLogPage() {
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [filterUser, setFilterUser] = useState('All');
    const [filterType, setFilterType] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [users, setUsers] = useState<string[]>([]);
    const [page, setPage] = useState(1);
    const perPage = 50;

    // Check user role access
    const [hasAccess, setHasAccess] = useState(false);
    useEffect(() => {
        const userData = localStorage.getItem('user');
        if (userData) {
            const u = JSON.parse(userData);
            const role = (u.userType || '').toLowerCase();
            setHasAccess(['superadmin', 'superuser', 'super admin', 'admin', 'manager'].includes(role));
        }
    }, []);

    const loadLogs = useCallback(async () => {
        setIsLoading(true);
        try {
            let query = supabase
                .from('retail_activity_log')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(500);

            if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00`);
            if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59`);
            if (filterUser !== 'All') query = query.eq('user_name', filterUser);
            if (filterType !== 'All') query = query.ilike('action_type', filterType);

            const { data, error } = await query;
            if (error) {
                // Table might not exist yet - create it
                if (error.message?.includes('does not exist') || error.code === '42P01') {
                    toast.error('Activity Log table not found. Please run the SQL to create retail_activity_log table.');
                } else {
                    throw error;
                }
            }
            setLogs(data || []);

            // Extract unique users
            const uniqueUsers = Array.from(new Set((data || []).map((l: ActivityLog) => l.user_name).filter(Boolean)));
            setUsers(uniqueUsers as string[]);
        } catch (err) {
            console.error('Load activity logs error:', err);
            toast.error('Failed to load activity logs');
        }
        setIsLoading(false);
    }, [dateFrom, dateTo, filterUser, filterType]);

    useEffect(() => {
        if (hasAccess) loadLogs();
    }, [hasAccess, loadLogs]);

    // Filter by search
    const filtered = logs.filter(l => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            l.description?.toLowerCase().includes(q) ||
            l.details?.toLowerCase().includes(q) ||
            l.user_name?.toLowerCase().includes(q) ||
            l.action_type?.toLowerCase().includes(q)
        );
    });

    const totalPages = Math.ceil(filtered.length / perPage);
    const paginated = filtered.slice((page - 1) * perPage, page * perPage);

    // Stats
    const todayCount = logs.filter(l => {
        const d = new Date(l.created_at).toDateString();
        return d === new Date().toDateString();
    }).length;

    if (!hasAccess) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <span className="text-6xl">🔒</span>
                    <h2 className="text-2xl font-bold text-gray-800 mt-4">Access Denied</h2>
                    <p className="text-gray-500 mt-2">Activity Log is restricted to Super Admin, Admin, and Manager roles.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 md:p-6">
            {/* Header */}
            <div className="mb-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-3">
                            <span className="text-3xl">📜</span>
                            Activity Log
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">
                            Track all system activities and user actions
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="bg-white rounded-2xl px-5 py-3 shadow-sm border border-gray-100">
                            <p className="text-xs text-gray-500">Today&apos;s Activities</p>
                            <p className="text-2xl font-black text-indigo-600">{todayCount}</p>
                        </div>
                        <div className="bg-white rounded-2xl px-5 py-3 shadow-sm border border-gray-100">
                            <p className="text-xs text-gray-500">Total Loaded</p>
                            <p className="text-2xl font-black text-gray-800">{logs.length}</p>
                        </div>
                        <button
                            onClick={loadLogs}
                            className="px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-2xl shadow-lg transition-all"
                        >
                            🔄 Refresh
                        </button>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-6">
                <div className="flex flex-col lg:flex-row gap-3 items-end">
                    {/* Date From */}
                    <div className="flex-1">
                        <label className="block text-xs font-semibold text-gray-500 mb-1">📅 Date From</label>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-400/20"
                        />
                    </div>
                    {/* Date To */}
                    <div className="flex-1">
                        <label className="block text-xs font-semibold text-gray-500 mb-1">📅 Date To</label>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={e => setDateTo(e.target.value)}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-400/20"
                        />
                    </div>
                    {/* User Filter */}
                    <div className="flex-1">
                        <label className="block text-xs font-semibold text-gray-500 mb-1">👤 User</label>
                        <select
                            value={filterUser}
                            onChange={e => { setFilterUser(e.target.value); setPage(1); }}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-400/20 cursor-pointer"
                        >
                            <option value="All">All Users</option>
                            {users.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                    </div>
                    {/* Activity Type */}
                    <div className="flex-1">
                        <label className="block text-xs font-semibold text-gray-500 mb-1">🏷️ Activity</label>
                        <select
                            value={filterType}
                            onChange={e => { setFilterType(e.target.value); setPage(1); }}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-400/20 cursor-pointer"
                        >
                            {activityTypes.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    {/* Search */}
                    <div className="flex-1">
                        <label className="block text-xs font-semibold text-gray-500 mb-1">🔍 Search</label>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                            placeholder="Search description..."
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-400/20"
                        />
                    </div>
                    <button
                        onClick={() => { setDateFrom(''); setDateTo(''); setFilterUser('All'); setFilterType('All'); setSearchQuery(''); }}
                        className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-all text-sm font-medium"
                    >
                        ✕ Clear
                    </button>
                </div>
            </div>

            {/* Activity Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                                <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider">Date & Time</th>
                                <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider">User</th>
                                <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider">Activity</th>
                                <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider">Description</th>
                                <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider hidden lg:table-cell">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-12 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-10 h-10 border-4 border-indigo-400/30 border-t-indigo-500 rounded-full animate-spin"></div>
                                            <span className="text-gray-500">Loading activity logs...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : paginated.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-12 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <span className="text-5xl">📭</span>
                                            <span className="text-gray-500">No activity logs found</span>
                                            <p className="text-xs text-gray-400">Try adjusting your filters or date range</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginated.map((log, idx) => {
                                    const dt = new Date(log.created_at);
                                    return (
                                        <tr key={log.id} className={`hover:bg-indigo-50/40 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                                            <td className="px-4 py-3">
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-800">{dt.toLocaleDateString('en-GB')}</p>
                                                    <p className="text-xs text-gray-500">{dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                                                        {(log.user_name || '?').charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-semibold text-gray-800">{log.user_name || 'System'}</p>
                                                        <p className="text-[10px] text-gray-400">{log.user_type || ''}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${getActionColor(log.action_type)}`}>
                                                    {getActionIcon(log.action_type)} {log.action_type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="text-sm text-gray-700 max-w-xs truncate" title={log.description}>{log.description}</p>
                                            </td>
                                            <td className="px-4 py-3 hidden lg:table-cell">
                                                <p className="text-xs text-gray-500 max-w-sm truncate" title={log.details}>{log.details || '-'}</p>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                    <span className="text-sm text-gray-500">
                        Showing <span className="font-bold text-gray-800">{(page - 1) * perPage + 1}-{Math.min(page * perPage, filtered.length)}</span> of <span className="font-bold text-gray-800">{filtered.length}</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                        <button onClick={() => setPage(1)} disabled={page === 1} className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-gray-500 hover:text-indigo-600 disabled:opacity-30 transition-all text-sm">⏮</button>
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-gray-500 hover:text-indigo-600 disabled:opacity-30 transition-all text-sm">◀</button>
                        <span className="px-4 py-2 text-sm font-bold text-indigo-600">Page {page} of {totalPages}</span>
                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-gray-500 hover:text-indigo-600 disabled:opacity-30 transition-all text-sm">▶</button>
                        <button onClick={() => setPage(totalPages)} disabled={page >= totalPages} className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-gray-500 hover:text-indigo-600 disabled:opacity-30 transition-all text-sm">⏭</button>
                    </div>
                </div>
            )}
        </div>
    );
}
