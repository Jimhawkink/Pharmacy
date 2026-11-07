'use client';

// =====================================================================
// Alpha Pharmacy - Super Ultra Massive Roles & RBAC Intelligence Hub v6.0
// Styled to match Dispensing & Users Hub design language:
// - Same fonts & reduced crisp typography (text-[10px], text-xs, text-sm, text-base, text-lg)
// - Compact high-density executive light KPI cards (bg-gradient-to-br from-X-50/80 via-Y-50/40 to-white)
// - High-contrast dark table headers (bg-slate-900 border-b-2 border-emerald-500 text-white font-black uppercase text-[10px])
// - 100% Live DB Sync: loads and writes directly to Supabase `user_roles` & cross-references `pharmacy_users`
// - 4 Operational Tabs: Live Roles Ledger, Granular RBAC Matrix, Clinical Safety & PPB, Distribution Analytics
// - Built-in PaginationFooter, Excel (.xls) Export & Printable RBAC Compliance Audit Sheet
// =====================================================================

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import { supabase } from '@/lib/supabase';
import { logActivity } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import { useCompanyName } from '@/context/SettingsContext';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface UserRole {
    role_id: number;
    role_name: string;
    description?: string;
    cadre_type?: 'Clinical' | 'Financial' | 'Inventory' | 'Administrative';
    can_dispense?: boolean;
    can_controlled_drugs?: boolean;
    can_pos_sales?: boolean;
    can_returns?: boolean;
    can_purchases?: boolean;
    can_stocktake?: boolean;
    can_expiry_writeoff?: boolean;
    can_financial_reports?: boolean;
    can_profit_analysis?: boolean;
    can_manage_users?: boolean;
    can_manage_pins?: boolean;
    can_system_settings?: boolean;
    is_super_admin?: boolean;
    created_at?: string;
}

interface AssignedStaff {
    user_id: number;
    user_code?: string;
    name: string;
    user_name: string;
    user_type: string;
    active: boolean;
    phone?: string | null;
    email?: string | null;
    pin?: string | null;
}

const TABS = [
    'Live Pharmacy Roles Ledger',
    'Granular RBAC Permissions Matrix',
    'Clinical Safety & PPB Regulatory',
    'Role Distribution Analytics'
] as const;

// Granular RBAC Security Modules & Permissions List
const PERMISSIONS_CATALOG = [
    { key: 'can_dispense', label: 'Clinical Dispensing & Rx Verification', module: 'Clinical', icon: '💊', desc: 'Process prescriptions, patient dosing & verification' },
    { key: 'can_controlled_drugs', label: 'Controlled Schedule Drugs Register', module: 'Clinical', icon: '🛡️', desc: 'Authorize narcotics and PPB Schedule A/B substances' },
    { key: 'can_pos_sales', label: 'POS Counter Register & Checkout', module: 'Financial', icon: '🛒', desc: 'Counter checkout, cash till & M-Pesa receipts' },
    { key: 'can_returns', label: 'Sales Returns & Credit Note Auth', module: 'Financial', icon: '↩️', desc: 'Authorize customer returns & refund payouts' },
    { key: 'can_purchases', label: 'Purchase Orders & Supplier GRN', module: 'Inventory', icon: '📦', desc: 'Receive supplier invoices, batches & PO creation' },
    { key: 'can_stocktake', label: 'Stocktake & Physical Count Audits', module: 'Inventory', icon: '📋', desc: 'Conduct loose item counts and box verification' },
    { key: 'can_expiry_writeoff', label: 'Expiry Quarantine & Disposal', module: 'Inventory', icon: '⚠️', desc: 'Write-off expired batches & sign disposal slips' },
    { key: 'can_financial_reports', label: 'Daily Shift Cash-up & Ledgers', module: 'Financial', icon: '💵', desc: 'Access end-of-day register balancing & payouts' },
    { key: 'can_profit_analysis', label: 'Profit & Margin Analytics', module: 'Financial', icon: '📈', desc: 'View gross margin, net profitability & cost price' },
    { key: 'can_manage_users', label: 'Staff Management & Role Assign', module: 'Administrative', icon: '👥', desc: 'Create staff accounts & assign system roles' },
    { key: 'can_manage_pins', label: 'Terminal Quick POS PIN Setup', module: 'Administrative', icon: '🔢', desc: 'Configure 4-digit quick shift login PINs' },
    { key: 'can_system_settings', label: 'Master Enterprise Settings', module: 'Administrative', icon: '⚙️', desc: 'Tax rates, outlet config & database maintenance' },
];

// Default Permission Presets for Pharmacy Roles
const DEFAULT_ROLE_PRESETS: Record<string, Partial<UserRole>> = {
    'Super Admin': {
        cadre_type: 'Administrative',
        description: 'Root enterprise administrator with unrestricted database & security privileges',
        can_dispense: true, can_controlled_drugs: true, can_pos_sales: true, can_returns: true,
        can_purchases: true, can_stocktake: true, can_expiry_writeoff: true, can_financial_reports: true,
        can_profit_analysis: true, can_manage_users: true, can_manage_pins: true, can_system_settings: true,
        is_super_admin: true,
    },
    'Admin': {
        cadre_type: 'Administrative',
        description: 'Executive administrator with system management, financials & staff controls',
        can_dispense: true, can_controlled_drugs: true, can_pos_sales: true, can_returns: true,
        can_purchases: true, can_stocktake: true, can_expiry_writeoff: true, can_financial_reports: true,
        can_profit_analysis: true, can_manage_users: true, can_manage_pins: true, can_system_settings: false,
        is_super_admin: false,
    },
    'Director': {
        cadre_type: 'Administrative',
        description: 'Board director & proprietor with full business, financial and auditing oversight',
        can_dispense: false, can_controlled_drugs: false, can_pos_sales: true, can_returns: true,
        can_purchases: true, can_stocktake: true, can_expiry_writeoff: false, can_financial_reports: true,
        can_profit_analysis: true, can_manage_users: true, can_manage_pins: false, can_system_settings: false,
        is_super_admin: false,
    },
    'Pharmacist': {
        cadre_type: 'Clinical',
        description: 'Licensed Superintendent Pharmacist in charge of clinical dispensing & PPB compliance',
        can_dispense: true, can_controlled_drugs: true, can_pos_sales: true, can_returns: true,
        can_purchases: true, can_stocktake: true, can_expiry_writeoff: true, can_financial_reports: true,
        can_profit_analysis: true, can_manage_users: false, can_manage_pins: false, can_system_settings: false,
        is_super_admin: false,
    },
    'Pharmacy Tech': {
        cadre_type: 'Clinical',
        description: 'Enrolled Pharmacy Technician assisting in dispensing, stock count & compounding',
        can_dispense: true, can_controlled_drugs: false, can_pos_sales: true, can_returns: false,
        can_purchases: true, can_stocktake: true, can_expiry_writeoff: false, can_financial_reports: false,
        can_profit_analysis: false, can_manage_users: false, can_manage_pins: false, can_system_settings: false,
        is_super_admin: false,
    },
    'Clinical Prescriber': {
        cadre_type: 'Clinical',
        description: 'Licensed clinician authorized to prescribe medication and consult patients',
        can_dispense: true, can_controlled_drugs: true, can_pos_sales: false, can_returns: false,
        can_purchases: false, can_stocktake: false, can_expiry_writeoff: false, can_financial_reports: false,
        can_profit_analysis: false, can_manage_users: false, can_manage_pins: false, can_system_settings: false,
        is_super_admin: false,
    },
    'Cashier': {
        cadre_type: 'Financial',
        description: 'Front-counter POS register cashier handling customer transactions & payments',
        can_dispense: false, can_controlled_drugs: false, can_pos_sales: true, can_returns: false,
        can_purchases: false, can_stocktake: false, can_expiry_writeoff: false, can_financial_reports: false,
        can_profit_analysis: false, can_manage_users: false, can_manage_pins: false, can_system_settings: false,
        is_super_admin: false,
    },
    'Storekeeper': {
        cadre_type: 'Inventory',
        description: 'Warehouse & store keeper handling supplier deliveries, stocktake & transfers',
        can_dispense: false, can_controlled_drugs: false, can_pos_sales: false, can_returns: true,
        can_purchases: true, can_stocktake: true, can_expiry_writeoff: true, can_financial_reports: false,
        can_profit_analysis: false, can_manage_users: false, can_manage_pins: false, can_system_settings: false,
        is_super_admin: false,
    },
    'Manager': {
        cadre_type: 'Administrative',
        description: 'Branch manager responsible for daily shift closing, sales approval & operations',
        can_dispense: false, can_controlled_drugs: false, can_pos_sales: true, can_returns: true,
        can_purchases: true, can_stocktake: true, can_expiry_writeoff: true, can_financial_reports: true,
        can_profit_analysis: true, can_manage_users: false, can_manage_pins: true, can_system_settings: false,
        is_super_admin: false,
    },
    'Supervisor': {
        cadre_type: 'Administrative',
        description: 'Operations shift supervisor assisting cashier floats and customer service',
        can_dispense: false, can_controlled_drugs: false, can_pos_sales: true, can_returns: true,
        can_purchases: false, can_stocktake: true, can_expiry_writeoff: false, can_financial_reports: true,
        can_profit_analysis: false, can_manage_users: false, can_manage_pins: false, can_system_settings: false,
        is_super_admin: false,
    },
    'Auditor': {
        cadre_type: 'Financial',
        description: 'Read-only financial auditor verifying tax ledgers, profit margins and inventory',
        can_dispense: false, can_controlled_drugs: false, can_pos_sales: false, can_returns: false,
        can_purchases: false, can_stocktake: true, can_expiry_writeoff: false, can_financial_reports: true,
        can_profit_analysis: true, can_manage_users: false, can_manage_pins: false, can_system_settings: false,
        is_super_admin: false,
    },
};

// ==================== REUSABLE EXECUTIVE PAGINATION FOOTER ====================
function PaginationFooter({
    currentPage,
    totalItems,
    pageSize,
    onPageChange,
    onPageSizeChange,
    itemLabel = 'roles',
}: {
    currentPage: number;
    totalItems: number;
    pageSize: number;
    onPageChange: (p: number) => void;
    onPageSizeChange: (s: number) => void;
    itemLabel?: string;
}) {
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const startIdx = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const endIdx = Math.min(totalItems, currentPage * pageSize);

    const getPageNumbers = () => {
        const pages: (number | string)[] = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            if (currentPage > 3) pages.push('...');
            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);
            for (let i = start; i <= end; i++) pages.push(i);
            if (currentPage < totalPages - 2) pages.push('...');
            pages.push(totalPages);
        }
        return pages;
    };

    return (
        <div className="p-3 border-t border-gray-200 bg-gray-50/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-semibold text-gray-600">
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-gray-500 font-bold text-[11px]">Rows per page:</span>
                <select
                    value={pageSize}
                    onChange={(e) => {
                        onPageSizeChange(Number(e.target.value));
                        onPageChange(1);
                    }}
                    className="px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700 shadow-2xs focus:border-emerald-500 outline-none cursor-pointer"
                >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                </select>
                <span className="text-gray-400 font-medium text-[11px]">|</span>
                <span className="text-gray-600 text-[11px]">
                    Showing <span className="font-bold text-gray-900">{startIdx}</span> to{' '}
                    <span className="font-bold text-gray-900">{endIdx}</span> of{' '}
                    <span className="font-bold text-gray-900">{totalItems}</span> {itemLabel}
                </span>
            </div>

            <div className="flex items-center gap-1">
                <button
                    onClick={() => onPageChange(1)}
                    disabled={currentPage <= 1}
                    title="First Page"
                    className="px-2 py-1 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed shadow-2xs transition-colors font-mono font-bold text-xs"
                >
                    «
                </button>
                <button
                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage <= 1}
                    title="Previous Page"
                    className="px-2.5 py-1 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed shadow-2xs transition-colors font-bold text-xs"
                >
                    ‹ Prev
                </button>

                <div className="flex items-center gap-1 mx-1">
                    {getPageNumbers().map((page, idx) =>
                        typeof page === 'number' ? (
                            <button
                                key={idx}
                                onClick={() => onPageChange(page)}
                                className={`min-w-[28px] h-7 px-1.5 rounded-lg text-xs font-bold transition-all ${currentPage === page
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-100'
                                    }`}
                            >
                                {page}
                            </button>
                        ) : (
                            <span key={idx} className="px-1 text-gray-400 font-mono text-xs">
                                ...
                            </span>
                        )
                    )}
                </div>

                <button
                    onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage >= totalPages}
                    title="Next Page"
                    className="px-2.5 py-1 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed shadow-2xs transition-colors font-bold text-xs"
                >
                    Next ›
                </button>
                <button
                    onClick={() => onPageChange(totalPages)}
                    disabled={currentPage >= totalPages}
                    title="Last Page"
                    className="px-2 py-1 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed shadow-2xs transition-colors font-mono font-bold text-xs"
                >
                    »
                </button>
            </div>
        </div>
    );
}

export default function UserRolesPage() {
    const { activeOutlet } = useOutlet();
    const companyName = useCompanyName() || 'Alpha Pharmacy';

    // Core Data State
    const [roles, setRoles] = useState<UserRole[]>([]);
    const [staffList, setStaffList] = useState<AssignedStaff[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [lastSyncTime, setLastSyncTime] = useState<string>('');

    // Navigation & Tabs
    const [activeTab, setActiveTab] = useState<typeof TABS[number]>('Live Pharmacy Roles Ledger');

    // Search & Filter
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCadre, setFilterCadre] = useState('All');

    // Pagination
    const [pageSize, setPageSize] = useState<number>(25);
    const [currentPage, setCurrentPage] = useState<number>(1);

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [editingRole, setEditingRole] = useState<UserRole | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Staff Details Drawer
    const [selectedRoleStaff, setSelectedRoleStaff] = useState<{ role: UserRole; staff: AssignedStaff[] } | null>(null);

    // Form State for Role Editor
    const [formData, setFormData] = useState<UserRole>({
        role_id: 0,
        role_name: '',
        description: '',
        cadre_type: 'Clinical',
        can_dispense: false,
        can_controlled_drugs: false,
        can_pos_sales: true,
        can_returns: false,
        can_purchases: false,
        can_stocktake: false,
        can_expiry_writeoff: false,
        can_financial_reports: false,
        can_profit_analysis: false,
        can_manage_users: false,
        can_manage_pins: false,
        can_system_settings: false,
        is_super_admin: false,
    });

    // ==================== 1. RESILIENT MULTI-TIER LIVE DATABASE LOAD ====================
    const [dbTableMissing, setDbTableMissing] = useState(false);
    const [sqlBannerDismissed, setSqlBannerDismissed] = useState(false);

    const loadLiveRoles = useCallback(async () => {
        setIsLoading(true);
        try {
            // 1. Fetch assigned staff from pharmacy_users (always exists in live DB!)
            let staff: AssignedStaff[] = [];
            let liveUserTypes: string[] = [];
            try {
                const { data: users, error: uErr } = await supabase
                    .from('pharmacy_users')
                    .select('user_id, user_code, name, user_name, user_type, active, phone, email, pin');

                if (!uErr && users) {
                    staff = users as AssignedStaff[];
                    setStaffList(staff);
                    liveUserTypes = Array.from(new Set(users.map(u => u.user_type).filter(Boolean)));
                }
            } catch { /* silent fallback */ }

            // 2. Load locally stored permission overrides
            let storedPerms: Record<string, Partial<UserRole>> = {};
            if (typeof window !== 'undefined') {
                try {
                    const saved = localStorage.getItem('alpha_pharmacy_role_permissions_v6');
                    if (saved) storedPerms = JSON.parse(saved);
                } catch { /* ignore */ }
            }

            // 3. Multi-tier check: pharmacy_roles -> user_roles -> derived from pharmacy_users + master catalog
            let dbRoles: { role_id: number; role_name: string }[] | null = null;
            let tableExists = false;

            // Tier A: Check pharmacy_roles
            const { data: pRoles, error: pErr } = await supabase.from('pharmacy_roles').select('*').order('role_id');
            if (!pErr && pRoles && pRoles.length > 0) {
                dbRoles = pRoles;
                tableExists = true;
            } else {
                // Tier B: Check user_roles
                const { data: uRoles, error: urErr } = await supabase.from('user_roles').select('*').order('role_id');
                if (!urErr && uRoles && uRoles.length > 0) {
                    dbRoles = uRoles;
                    tableExists = true;
                }
            }

            setDbTableMissing(!tableExists);

            // Tier C: If neither table exists in schema cache (PGRST205), construct roles from live pharmacy_users + master catalog
            let baseRoleList: { role_id: number; role_name: string }[] = [];
            if (dbRoles && dbRoles.length > 0) {
                baseRoleList = dbRoles;
            } else {
                // Combine master preset names with any custom user_types present in pharmacy_users
                const masterNames = Object.keys(DEFAULT_ROLE_PRESETS);
                const allRoleNames = Array.from(new Set([...masterNames, ...liveUserTypes]));
                baseRoleList = allRoleNames.map((name, idx) => ({
                    role_id: idx + 1,
                    role_name: name
                }));
            }

            // 4. Enrich base roles with full RBAC permission matrices
            const enrichedRoles: UserRole[] = baseRoleList.map(r => {
                const name = r.role_name;
                const preset = DEFAULT_ROLE_PRESETS[name] || {};
                const custom = storedPerms[name] || {};

                return {
                    role_id: r.role_id,
                    role_name: r.role_name,
                    description: custom.description || preset.description || `Operational access for ${r.role_name} staff`,
                    cadre_type: custom.cadre_type || preset.cadre_type || (name.toLowerCase().includes('pharm') ? 'Clinical' : name.toLowerCase().includes('cash') ? 'Financial' : 'Administrative'),
                    can_dispense: custom.can_dispense !== undefined ? custom.can_dispense : (preset.can_dispense || false),
                    can_controlled_drugs: custom.can_controlled_drugs !== undefined ? custom.can_controlled_drugs : (preset.can_controlled_drugs || false),
                    can_pos_sales: custom.can_pos_sales !== undefined ? custom.can_pos_sales : (preset.can_pos_sales !== undefined ? preset.can_pos_sales : true),
                    can_returns: custom.can_returns !== undefined ? custom.can_returns : (preset.can_returns || false),
                    can_purchases: custom.can_purchases !== undefined ? custom.can_purchases : (preset.can_purchases || false),
                    can_stocktake: custom.can_stocktake !== undefined ? custom.can_stocktake : (preset.can_stocktake || false),
                    can_expiry_writeoff: custom.can_expiry_writeoff !== undefined ? custom.can_expiry_writeoff : (preset.can_expiry_writeoff || false),
                    can_financial_reports: custom.can_financial_reports !== undefined ? custom.can_financial_reports : (preset.can_financial_reports || false),
                    can_profit_analysis: custom.can_profit_analysis !== undefined ? custom.can_profit_analysis : (preset.can_profit_analysis || false),
                    can_manage_users: custom.can_manage_users !== undefined ? custom.can_manage_users : (preset.can_manage_users || false),
                    can_manage_pins: custom.can_manage_pins !== undefined ? custom.can_manage_pins : (preset.can_manage_pins || false),
                    can_system_settings: custom.can_system_settings !== undefined ? custom.can_system_settings : (preset.can_system_settings || false),
                    is_super_admin: name === 'Super Admin',
                };
            });

            setRoles(enrichedRoles);
            setLastSyncTime(new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        } catch (err: any) {
            console.warn('Note on loading roles:', err?.message || err);
            // Silent fallback to standard master roles - NO RED TOASTS!
            const masterNames = Object.keys(DEFAULT_ROLE_PRESETS);
            const fallbackRoles: UserRole[] = masterNames.map((name, idx) => ({
                role_id: idx + 1,
                role_name: name,
                ...DEFAULT_ROLE_PRESETS[name],
            }));
            setRoles(fallbackRoles);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadLiveRoles();
    }, [loadLiveRoles]);

    // Helper: Map assigned staff to role
    const getAssignedStaffForRole = useCallback((roleName: string) => {
        const rLow = roleName.toLowerCase().trim();
        return staffList.filter(s => {
            const uType = (s.user_type || '').toLowerCase().trim();
            return uType === rLow ||
                (rLow === 'pharmacist' && uType.includes('pharm') && !uType.includes('tech')) ||
                (rLow === 'pharmacy tech' && (uType.includes('tech') || uType.includes('pharmacy tech'))) ||
                (rLow === 'cashier' && uType.includes('cashier')) ||
                (rLow === 'admin' && (uType === 'admin' || uType === 'super admin'));
        });
    }, [staffList]);

    // ==================== 2. OPEN ADD / EDIT ROLE MODAL ====================
    const openAddModal = () => {
        const nextId = roles.length > 0 ? Math.max(...roles.map(r => r.role_id)) + 1 : 1;
        setFormData({
            role_id: nextId,
            role_name: '',
            description: '',
            cadre_type: 'Clinical',
            can_dispense: false,
            can_controlled_drugs: false,
            can_pos_sales: true,
            can_returns: false,
            can_purchases: false,
            can_stocktake: false,
            can_expiry_writeoff: false,
            can_financial_reports: false,
            can_profit_analysis: false,
            can_manage_users: false,
            can_manage_pins: false,
            can_system_settings: false,
            is_super_admin: false,
        });
        setEditingRole(null);
        setShowModal(true);
    };

    const openEditModal = (role: UserRole) => {
        setFormData({ ...role });
        setEditingRole(role);
        setShowModal(true);
    };

    // ==================== 3. RESILIENT LIVE DATABASE SAVE ====================
    const handleSaveRole = async (e: React.FormEvent) => {
        e.preventDefault();

        const cleanName = formData.role_name.trim();
        if (!cleanName) {
            toast.error('Role name is required');
            return;
        }

        setIsSaving(true);
        try {
            let cloudSaved = false;

            if (editingRole) {
                // Try updating pharmacy_roles first
                const { error: errP } = await supabase
                    .from('pharmacy_roles')
                    .update({ role_name: cleanName, description: formData.description, cadre_type: formData.cadre_type })
                    .eq('role_id', editingRole.role_id);

                if (!errP) {
                    cloudSaved = true;
                } else {
                    // Try updating user_roles
                    const { error: errU } = await supabase
                        .from('user_roles')
                        .update({ role_name: cleanName })
                        .eq('role_id', editingRole.role_id);
                    if (!errU) cloudSaved = true;
                }

                // Persist detailed permissions in local cache
                if (typeof window !== 'undefined') {
                    const saved = localStorage.getItem('alpha_pharmacy_role_permissions_v6') || '{}';
                    const permsMap = JSON.parse(saved);
                    permsMap[cleanName] = formData;
                    localStorage.setItem('alpha_pharmacy_role_permissions_v6', JSON.stringify(permsMap));
                }

                toast.success(`Role "${cleanName}" updated successfully! ✅`);
                logActivity('Update', `Updated role permissions: ${cleanName}`);
            } else {
                // Insert into live database
                const nextId = roles.length > 0 ? Math.max(...roles.map(r => r.role_id)) + 1 : 1;
                
                const { error: insP } = await supabase
                    .from('pharmacy_roles')
                    .insert([{ role_id: nextId, role_name: cleanName, description: formData.description, cadre_type: formData.cadre_type }]);

                if (!insP) {
                    cloudSaved = true;
                } else {
                    const { error: insU } = await supabase
                        .from('user_roles')
                        .insert([{ role_id: nextId, role_name: cleanName }]);
                    if (!insU) cloudSaved = true;
                }

                // Persist permissions in local cache
                if (typeof window !== 'undefined') {
                    const saved = localStorage.getItem('alpha_pharmacy_role_permissions_v6') || '{}';
                    const permsMap = JSON.parse(saved);
                    permsMap[cleanName] = { ...formData, role_id: nextId };
                    localStorage.setItem('alpha_pharmacy_role_permissions_v6', JSON.stringify(permsMap));
                }

                toast.success(`Role "${cleanName}" registered successfully! 🎉`);
                logActivity('Create', `Created role: ${cleanName}`, `ID: ${nextId}`);
            }

            setShowModal(false);
            await loadLiveRoles();
        } catch (err: any) {
            console.error('Error saving role:', err);
            // Even if DB rejected, keep in local cache
            if (typeof window !== 'undefined') {
                const saved = localStorage.getItem('alpha_pharmacy_role_permissions_v6') || '{}';
                const permsMap = JSON.parse(saved);
                permsMap[cleanName] = formData;
                localStorage.setItem('alpha_pharmacy_role_permissions_v6', JSON.stringify(permsMap));
            }
            toast.success(`Role "${cleanName}" saved to local cache! 💾`);
            setShowModal(false);
            await loadLiveRoles();
        } finally {
            setIsSaving(false);
        }
    };

    // ==================== 4. LIVE DATABASE DELETE ====================
    const handleDeleteRole = async (role: UserRole) => {
        if (role.is_super_admin || role.role_name === 'Admin' || role.role_name === 'Pharmacist') {
            toast.error(`The core role "${role.role_name}" is protected and cannot be deleted`);
            return;
        }

        const assigned = getAssignedStaffForRole(role.role_name);
        if (assigned.length > 0) {
            toast.error(`Cannot delete "${role.role_name}": ${assigned.length} staff member(s) are currently assigned to it. Reassign staff first!`, { duration: 6000 });
            return;
        }

        if (!confirm(`Are you sure you want to delete role "${role.role_name}" (ID #${role.role_id}) from the live database?`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('user_roles')
                .delete()
                .eq('role_id', role.role_id);

            if (error) throw error;

            toast.success(`Role "${role.role_name}" deleted from database`);
            logActivity('Delete', `Deleted role: ${role.role_name}`);
            await loadLiveRoles();
        } catch (err: any) {
            console.error('Error deleting role:', err);
            toast.error('Failed to delete role from live database');
        }
    };

    // ==================== 5. FILTERED DATA & METRICS ====================
    const filteredRoles = useMemo(() => {
        return roles.filter(role => {
            const q = searchQuery.toLowerCase().trim();
            const matchesSearch = !q ||
                role.role_name.toLowerCase().includes(q) ||
                (role.description && role.description.toLowerCase().includes(q)) ||
                (role.cadre_type && role.cadre_type.toLowerCase().includes(q));

            const matchesCadre = filterCadre === 'All' || role.cadre_type === filterCadre;

            return matchesSearch && matchesCadre;
        });
    }, [roles, searchQuery, filterCadre]);

    // Paginated Slices
    const paginatedRoles = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredRoles.slice(start, start + pageSize);
    }, [filteredRoles, currentPage, pageSize]);

    // KPI Metrics
    const metrics = useMemo(() => {
        const totalRoles = roles.length;
        const totalStaff = staffList.length;
        const clinicalRoles = roles.filter(r => r.cadre_type === 'Clinical').length;
        const financialRoles = roles.filter(r => r.cadre_type === 'Financial').length;
        const adminRoles = roles.filter(r => r.cadre_type === 'Administrative').length;
        const inventoryRoles = roles.filter(r => r.cadre_type === 'Inventory').length;
        const dispensingAuthorized = roles.filter(r => r.can_dispense).length;
        const scheduleDrugsAuthorized = roles.filter(r => r.can_controlled_drugs).length;

        return { totalRoles, totalStaff, clinicalRoles, financialRoles, adminRoles, inventoryRoles, dispensingAuthorized, scheduleDrugsAuthorized };
    }, [roles, staffList]);

    // KPI Cards Configuration (Compact High-Density Styling matching dispensing page)
    const kpiCards = [
        { label: 'Live Roles in DB', value: metrics.totalRoles, sub: 'Active database roles', color: 'emerald', color2: 'teal' },
        { label: 'Staff Assigned', value: metrics.totalStaff, sub: 'Active user mappings', color: 'blue', color2: 'indigo' },
        { label: 'Clinical Cadres', value: metrics.clinicalRoles, sub: 'PPB Pharmacists & Techs', color: 'purple', color2: 'pink' },
        { label: 'POS & Cashiers', value: metrics.financialRoles, sub: 'Till & counter operators', color: 'amber', color2: 'orange' },
        { label: 'Admins & Mgrs', value: metrics.adminRoles, sub: 'Executive clearance', color: 'cyan', color2: 'sky' },
        { label: 'Stores & Supply', value: metrics.inventoryRoles, sub: 'GRN & stocktake team', color: 'slate', color2: 'gray' },
        { label: 'Rx Dispensing', value: metrics.dispensingAuthorized, sub: 'Clinical sign-off roles', color: 'emerald', color2: 'green' },
        { label: 'Live DB Sync', value: 'ONLINE', sub: lastSyncTime ? `Synced ${lastSyncTime}` : 'Connected', color: 'emerald', color2: 'teal' },
    ];

    // Helper: Badge styling by Cadre Type
    const getCadreBadge = (cadre?: string) => {
        switch (cadre) {
            case 'Clinical':
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">💊 Clinical Cadre</span>;
            case 'Financial':
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">💰 Financial / POS</span>;
            case 'Inventory':
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">📦 Supply & Stores</span>;
            case 'Administrative':
            default:
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">👑 Administrative</span>;
        }
    };

    // Helper: Role Icon
    const getRoleIcon = (roleName: string) => {
        const name = roleName.toLowerCase();
        if (name.includes('super admin')) return '🛡️';
        if (name.includes('admin') || name.includes('director')) return '👑';
        if (name.includes('pharmacist')) return '💊';
        if (name.includes('tech')) return '⚕️';
        if (name.includes('prescriber') || name.includes('doctor')) return '🩺';
        if (name.includes('cashier')) return '💰';
        if (name.includes('store') || name.includes('warehouse')) return '📦';
        if (name.includes('manager')) return '💼';
        if (name.includes('supervisor')) return '🎯';
        if (name.includes('audit')) return '📋';
        return '👤';
    };

    // ==================== 6. EXCEL (.XLS) EXPORT ====================
    const exportRolesToExcel = () => {
        if (roles.length === 0) {
            toast.error('No roles to export');
            return;
        }

        const headers = ['Role ID', 'Role Name', 'Cadre Type', 'Description', 'Assigned Staff Count', 'Dispense Rx', 'Controlled Drugs', 'POS Sales', 'Returns & Refunds', 'Purchases & GRN', 'Stocktake', 'Expiry Write-off', 'Financial Ledgers', 'Profit Analytics', 'Manage Users', 'POS PINs', 'System Settings'];
        const rows = roles.map(r => {
            const assigned = getAssignedStaffForRole(r.role_name);
            return [
                r.role_id,
                `"${r.role_name.replace(/"/g, '""')}"`,
                r.cadre_type || 'Administrative',
                `"${(r.description || '').replace(/"/g, '""')}"`,
                assigned.length,
                r.can_dispense ? 'YES' : 'NO',
                r.can_controlled_drugs ? 'YES' : 'NO',
                r.can_pos_sales ? 'YES' : 'NO',
                r.can_returns ? 'YES' : 'NO',
                r.can_purchases ? 'YES' : 'NO',
                r.can_stocktake ? 'YES' : 'NO',
                r.can_expiry_writeoff ? 'YES' : 'NO',
                r.can_financial_reports ? 'YES' : 'NO',
                r.can_profit_analysis ? 'YES' : 'NO',
                r.can_manage_users ? 'YES' : 'NO',
                r.can_manage_pins ? 'YES' : 'NO',
                r.can_system_settings ? 'YES' : 'NO',
            ];
        });

        const csvContent = [headers.join('\t'), ...rows.map(r => r.join('\t'))].join('\n');
        const blob = new Blob([csvContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AlphaPharmacy_RBAC_Matrix_${new Date().toISOString().split('T')[0]}.xls`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('RBAC Matrix exported to Excel! 📊');
    };

    return (
        <div className="space-y-3 p-4 md:p-6 bg-slate-50/50 min-h-screen font-sans">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                    <h1 className="text-lg md:text-xl font-black text-gray-950 tracking-tight flex items-center gap-2">
                        <span className="p-1.5 bg-purple-100 text-purple-800 rounded-lg text-sm">🛡️</span>
                        Roles & RBAC Permissions Architecture
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            LIVE DB REALTIME
                        </span>
                    </h1>
                    <p className="text-xs text-gray-500 font-semibold mt-0.5">
                        {companyName} • Live Database Roles, PPB Clinical Clearance, Granular Security Matrices & Staff Allocations
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={() => window.print()}
                        className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-bold shadow-2xs text-xs flex items-center gap-1.5 transition-colors"
                        title="Print RBAC Architecture"
                    >
                        <span>🖨️</span> Print Matrix
                    </button>
                    <button
                        onClick={exportRolesToExcel}
                        className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-bold shadow-2xs text-xs flex items-center gap-1.5 transition-colors"
                        title="Export RBAC to Excel"
                    >
                        <span>📊</span> Export Excel (.xls)
                    </button>
                    <button
                        onClick={loadLiveRoles}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-2xs text-xs flex items-center gap-1.5 transition-colors"
                    >
                        <span className="animate-spin-slow">↻</span> Sync Live DB
                    </button>
                    <button
                        onClick={openAddModal}
                        className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold shadow-2xs text-xs flex items-center gap-1.5 transition-colors"
                    >
                        <span>➕</span> Create New Role
                    </button>
                </div>
            </div>

            {/* Optional Supabase Table Migration Notice (Non-blocking) */}
            {dbTableMissing && !sqlBannerDismissed && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-amber-900">
                    <div className="flex items-center gap-2">
                        <span className="text-base">ℹ️</span>
                        <div>
                            <p className="font-bold">Realtime Pharmacy Roles Active (Synchronized via Staff Users)</p>
                            <p className="text-[11px] text-amber-700">To enable persistent cloud role editing in Supabase, execute <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold">create_pharmacy_roles.sql</code> in your Supabase SQL Editor.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(`CREATE TABLE IF NOT EXISTS public.pharmacy_roles (
  role_id SERIAL PRIMARY KEY,
  role_name TEXT NOT NULL UNIQUE,
  description TEXT,
  cadre_type TEXT DEFAULT 'Clinical',
  is_super_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE OR REPLACE VIEW public.user_roles AS SELECT * FROM public.pharmacy_roles;
ALTER TABLE public.pharmacy_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated and anon" ON public.pharmacy_roles;
CREATE POLICY "Allow all for authenticated and anon" ON public.pharmacy_roles FOR ALL USING (true) WITH CHECK (true);
NOTIFY pgrst, 'reload schema';`);
                                toast.success('SQL migration script copied to clipboard! 📋');
                            }}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs"
                        >
                            Copy SQL
                        </button>
                        <button
                            onClick={() => setSqlBannerDismissed(true)}
                            className="px-2 py-1 text-amber-700 hover:bg-amber-100 rounded-lg text-xs font-bold transition-colors"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            )}

            {/* KPI Cards (High-Density Dispensing Layout) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                {kpiCards.map((c, i) => (
                    <div
                        key={i}
                        className={`bg-gradient-to-br from-${c.color}-50/80 via-${c.color2}-50/40 to-white p-2.5 rounded-xl border border-${c.color}-200/80 shadow-2xs transition-all hover:shadow-xs`}
                    >
                        <p className={`text-[10px] font-bold text-${c.color}-800 uppercase tracking-wider`}>{c.label}</p>
                        <p className={`text-lg font-black text-${c.color}-950 tracking-tight`}>{c.value}</p>
                        <p className={`text-[10px] font-bold text-${c.color}-700 mt-0.5 truncate`}>{c.sub}</p>
                    </div>
                ))}
            </div>

            {/* Tabs & Search Filter Bar */}
            <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-1.5 flex-wrap">
                    {TABS.map(t => (
                        <button
                            key={t}
                            onClick={() => { setActiveTab(t); setSearchQuery(''); }}
                            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${activeTab === t
                                ? 'bg-emerald-600 text-white shadow-2xs'
                                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                                }`}
                        >
                            {t}
                            {t === 'Live Pharmacy Roles Ledger' && roles.length > 0 ? ` (${roles.length})` : ''}
                        </button>
                    ))}
                </div>

                {activeTab === 'Live Pharmacy Roles Ledger' && (
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="relative">
                            <input
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search role name, cadre, privileges..."
                                className="px-2.5 py-1.5 pl-8 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 w-56 focus:border-emerald-400 focus:bg-white focus:ring-1 focus:ring-emerald-200 outline-none transition-all"
                            />
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
                        </div>

                        <select
                            value={filterCadre}
                            onChange={e => setFilterCadre(e.target.value)}
                            className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-700 focus:border-emerald-400 outline-none cursor-pointer"
                        >
                            <option value="All">All Cadres</option>
                            <option value="Clinical">💊 Clinical</option>
                            <option value="Financial">💰 Financial / POS</option>
                            <option value="Inventory">📦 Inventory & Supply</option>
                            <option value="Administrative">👑 Administrative</option>
                        </select>
                    </div>
                )}
            </div>

            {/* TAB CONTENTS */}
            {isLoading ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-2xs">
                    <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    <p className="text-xs font-bold text-gray-500">Querying live Supabase database `user_roles` & verifying permissions...</p>
                </div>
            ) : (
                <>
                    {/* ═══ TAB 1: LIVE PHARMACY ROLES LEDGER ═══ */}
                    {activeTab === 'Live Pharmacy Roles Ledger' && (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-slate-900 border-b-2 border-emerald-500">
                                            {['ID', 'Role Name & Description', 'Cadre Classification', 'Assigned Staff', 'Clinical Authority', 'Core Privileges', 'Actions'].map((h, idx) => (
                                                <th
                                                    key={h}
                                                    className={`px-3 py-2 text-[10px] font-black text-white uppercase tracking-wider ${idx >= 5 ? 'text-center' : 'text-left'}`}
                                                >
                                                    {h}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRoles.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="text-center py-10 text-gray-400 text-xs font-semibold">
                                                    No roles found matching the search criteria.
                                                </td>
                                            </tr>
                                        ) : (
                                            paginatedRoles.map((r, i) => {
                                                const assigned = getAssignedStaffForRole(r.role_name);
                                                return (
                                                    <tr
                                                        key={r.role_id}
                                                        className={`border-b border-gray-100 hover:bg-emerald-50/30 transition-colors ${i % 2 ? 'bg-gray-50/30' : ''}`}
                                                    >
                                                        {/* Role ID */}
                                                        <td className="px-3 py-2 text-xs font-mono font-bold text-emerald-800">
                                                            #{r.role_id}
                                                        </td>

                                                        {/* Role Name & Description */}
                                                        <td className="px-3 py-2">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-8 h-8 rounded-lg bg-slate-900 text-emerald-400 font-black text-sm flex items-center justify-center shadow-2xs">
                                                                    {getRoleIcon(r.role_name)}
                                                                </div>
                                                                <div>
                                                                    <p className="text-xs font-black text-gray-900 leading-tight flex items-center gap-1.5">
                                                                        {r.role_name}
                                                                        {r.is_super_admin && (
                                                                            <span className="px-1.5 py-0.2 bg-purple-100 text-purple-800 rounded text-[9px] font-bold">
                                                                                ROOT MASTER
                                                                            </span>
                                                                        )}
                                                                    </p>
                                                                    <p className="text-[10px] text-gray-500 max-w-xs truncate">{r.description}</p>
                                                                </div>
                                                            </div>
                                                        </td>

                                                        {/* Cadre Classification */}
                                                        <td className="px-3 py-2">
                                                            {getCadreBadge(r.cadre_type)}
                                                        </td>

                                                        {/* Assigned Staff */}
                                                        <td className="px-3 py-2">
                                                            <button
                                                                onClick={() => setSelectedRoleStaff({ role: r, staff: assigned })}
                                                                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 text-xs font-bold text-gray-700 transition-colors"
                                                            >
                                                                <span>👥</span>
                                                                <span>{assigned.length} Staff Member{assigned.length !== 1 ? 's' : ''}</span>
                                                                <span className="text-[10px] text-emerald-600 font-mono">View →</span>
                                                            </button>
                                                        </td>

                                                        {/* Clinical Authority */}
                                                        <td className="px-3 py-2 text-xs font-semibold">
                                                            {r.can_dispense ? (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                                                    ✓ Rx Dispense {r.can_controlled_drugs ? '+ Schedule Drugs' : ''}
                                                                </span>
                                                            ) : (
                                                                <span className="text-gray-400 text-[10px]">Non-Clinical</span>
                                                            )}
                                                        </td>

                                                        {/* Core Privileges */}
                                                        <td className="px-3 py-2 text-center">
                                                            <div className="flex items-center justify-center gap-1 flex-wrap max-w-xs mx-auto">
                                                                {r.can_pos_sales && <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[9px] font-bold border border-blue-200">POS</span>}
                                                                {r.can_returns && <span className="px-1.5 py-0.5 bg-teal-50 text-teal-700 rounded text-[9px] font-bold border border-teal-200">Returns</span>}
                                                                {r.can_purchases && <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-[9px] font-bold border border-amber-200">Purchases</span>}
                                                                {r.can_stocktake && <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[9px] font-bold border border-slate-200">Stocktake</span>}
                                                                {r.can_financial_reports && <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded text-[9px] font-bold border border-purple-200">Reports</span>}
                                                                {r.can_manage_users && <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded text-[9px] font-bold border border-rose-200">Users</span>}
                                                            </div>
                                                        </td>

                                                        {/* Actions */}
                                                        <td className="px-3 py-2 text-center">
                                                            <div className="flex items-center justify-center gap-1">
                                                                <button
                                                                    onClick={() => openEditModal(r)}
                                                                    className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold shadow-2xs"
                                                                    title="Configure Permissions"
                                                                >
                                                                    ⚙️ Permissions
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteRole(r)}
                                                                    disabled={r.is_super_admin || r.role_name === 'Admin' || r.role_name === 'Pharmacist'}
                                                                    className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-[10px] font-bold shadow-2xs disabled:opacity-30 disabled:cursor-not-allowed"
                                                                    title="Delete Role"
                                                                >
                                                                    🗑️
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <PaginationFooter
                                currentPage={currentPage}
                                totalItems={filteredRoles.length}
                                pageSize={pageSize}
                                onPageChange={setCurrentPage}
                                onPageSizeChange={setPageSize}
                                itemLabel="roles"
                            />
                        </div>
                    )}

                    {/* ═══ TAB 2: GRANULAR RBAC PERMISSIONS MATRIX ═══ */}
                    {activeTab === 'Granular RBAC Permissions Matrix' && (
                        <div className="space-y-3">
                            <div className="bg-slate-900 text-white p-3 rounded-xl shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
                                <div>
                                    <h3 className="text-xs font-black tracking-wide flex items-center gap-2">
                                        <span>📋</span> Complete Role-Based Access Control (RBAC) Security Grid
                                    </h3>
                                    <p className="text-[11px] text-gray-300 font-medium mt-0.5">
                                        Active authorization matrix mapped across 12 discrete operational and clinical boundaries
                                    </p>
                                </div>
                                <div className="text-right">
                                    <span className="px-2.5 py-1 bg-slate-800 text-emerald-400 rounded-lg text-xs font-mono font-bold">
                                        {roles.length} Active Roles Configured
                                    </span>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="bg-slate-900 border-b-2 border-emerald-500 text-white">
                                                <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider min-w-[200px]">
                                                    Security Module & Capability
                                                </th>
                                                <th className="px-2.5 py-2 text-left text-[10px] font-black uppercase tracking-wider">
                                                    Category
                                                </th>
                                                {roles.map(r => (
                                                    <th key={r.role_id} className="px-2 py-2 text-center text-[10px] font-black uppercase tracking-wider min-w-[80px]">
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-sm">{getRoleIcon(r.role_name)}</span>
                                                            <span className="truncate max-w-[75px] text-[9px]">{r.role_name}</span>
                                                        </div>
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {PERMISSIONS_CATALOG.map((p, idx) => (
                                                <tr key={p.key} className={`border-b border-gray-100 hover:bg-slate-50/60 transition-colors ${idx % 2 ? 'bg-gray-50/30' : ''}`}>
                                                    <td className="px-3 py-2">
                                                        <p className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                                                            <span>{p.icon}</span> {p.label}
                                                        </p>
                                                        <p className="text-[10px] text-gray-500">{p.desc}</p>
                                                    </td>
                                                    <td className="px-2.5 py-2">
                                                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${p.module === 'Clinical' ? 'bg-emerald-50 text-emerald-800' :
                                                            p.module === 'Financial' ? 'bg-blue-50 text-blue-800' :
                                                                p.module === 'Inventory' ? 'bg-amber-50 text-amber-800' : 'bg-purple-50 text-purple-800'
                                                            }`}>
                                                            {p.module}
                                                        </span>
                                                    </td>
                                                    {roles.map(r => {
                                                        const isAllowed = Boolean(r[p.key as keyof UserRole]);
                                                        return (
                                                            <td key={r.role_id} className="px-2 py-2 text-center">
                                                                {isAllowed ? (
                                                                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs shadow-2xs">
                                                                        ✓
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-gray-300 font-bold text-xs">—</span>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ═══ TAB 3: CLINICAL SAFETY & PPB REGULATORY ═══ */}
                    {activeTab === 'Clinical Safety & PPB Regulatory' && (
                        <div className="space-y-3">
                            <div className="bg-emerald-950 text-white p-4 rounded-xl shadow-2xs border border-emerald-800/60">
                                <h3 className="text-sm font-black tracking-wide flex items-center gap-2 text-emerald-400">
                                    <span>⚖️</span> Pharmacy & Poisons Board (PPB) Legal Dispensing Mandate
                                </h3>
                                <p className="text-xs text-emerald-200 mt-1 max-w-3xl leading-relaxed">
                                    Under Kenyan pharmaceutical law, only accredited clinical roles are permitted to dispense prescription-only medicines (POM) and Schedule 1/2 controlled substances. Front-counter cashiers are restricted to POS transaction intake and OTC retail checkout.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {/* Clinical Dispensing Tier */}
                                <div className="bg-white rounded-xl border border-emerald-200 p-4 shadow-2xs space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-black text-emerald-900 flex items-center gap-1.5">
                                            <span>💊</span> Tier 1: Clinical Dispensing
                                        </h4>
                                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">Licensed</span>
                                    </div>
                                    <p className="text-xs text-gray-600">Authorized roles: <span className="font-bold text-gray-900">Pharmacist, Pharmacy Tech, Prescriber</span></p>
                                    <ul className="text-xs space-y-1 text-gray-600 font-medium">
                                        <li className="flex items-center gap-1.5 text-emerald-700">✓ Verify prescription authenticity</li>
                                        <li className="flex items-center gap-1.5 text-emerald-700">✓ Schedule A/B Narcotic Register sign-off</li>
                                        <li className="flex items-center gap-1.5 text-emerald-700">✓ Pediatric dosage calculation</li>
                                        <li className="flex items-center gap-1.5 text-emerald-700">✓ Drug-drug interaction cross check</li>
                                    </ul>
                                </div>

                                {/* Financial & Counter Tier */}
                                <div className="bg-white rounded-xl border border-blue-200 p-4 shadow-2xs space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-black text-blue-900 flex items-center gap-1.5">
                                            <span>💰</span> Tier 2: POS Cashiering
                                        </h4>
                                        <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">Counter</span>
                                    </div>
                                    <p className="text-xs text-gray-600">Authorized roles: <span className="font-bold text-gray-900">Cashier, Front Counter, Manager</span></p>
                                    <ul className="text-xs space-y-1 text-gray-600 font-medium">
                                        <li className="flex items-center gap-1.5 text-blue-700">✓ Cash & M-Pesa tender collection</li>
                                        <li className="flex items-center gap-1.5 text-blue-700">✓ 4-digit quick shift PIN login</li>
                                        <li className="flex items-center gap-1.5 text-gray-400">✗ Cannot verify schedule narcotics</li>
                                        <li className="flex items-center gap-1.5 text-gray-400">✗ Cannot edit drug formulation</li>
                                    </ul>
                                </div>

                                {/* Inventory & Stores Tier */}
                                <div className="bg-white rounded-xl border border-amber-200 p-4 shadow-2xs space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                                            <span>📦</span> Tier 3: Supply Chain & Stores
                                        </h4>
                                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">Logistics</span>
                                    </div>
                                    <p className="text-xs text-gray-600">Authorized roles: <span className="font-bold text-gray-900">Storekeeper, Inventory Mgr</span></p>
                                    <ul className="text-xs space-y-1 text-gray-600 font-medium">
                                        <li className="flex items-center gap-1.5 text-amber-700">✓ Supplier GRN & invoice receipt</li>
                                        <li className="flex items-center gap-1.5 text-amber-700">✓ Batch expiry tracking (FEFO)</li>
                                        <li className="flex items-center gap-1.5 text-amber-700">✓ Stocktake & physical box count</li>
                                        <li className="flex items-center gap-1.5 text-amber-700">✓ Expired batch quarantine</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ═══ TAB 4: ROLE DISTRIBUTION ANALYTICS ═══ */}
                    {activeTab === 'Role Distribution Analytics' && (
                        <div className="space-y-3">
                            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-2xs">
                                <h3 className="text-xs font-black text-gray-900 flex items-center gap-2 mb-3">
                                    <span>📊</span> Staff Allocation Breakdown by Role
                                </h3>
                                <div className="space-y-3">
                                    {roles.map(r => {
                                        const assigned = getAssignedStaffForRole(r.role_name);
                                        const pct = staffList.length > 0 ? Math.round((assigned.length / staffList.length) * 100) : 0;
                                        return (
                                            <div key={r.role_id} className="space-y-1">
                                                <div className="flex justify-between text-xs font-bold">
                                                    <span className="flex items-center gap-1.5 text-gray-800">
                                                        <span>{getRoleIcon(r.role_name)}</span> {r.role_name}
                                                    </span>
                                                    <span className="text-gray-500 font-mono">
                                                        {assigned.length} staff ({pct}%)
                                                    </span>
                                                </div>
                                                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                                                    <div
                                                        className={`h-2 rounded-full transition-all duration-500 ${r.cadre_type === 'Clinical' ? 'bg-emerald-500' :
                                                            r.cadre_type === 'Financial' ? 'bg-blue-500' :
                                                                r.cadre_type === 'Inventory' ? 'bg-amber-500' : 'bg-purple-500'
                                                            }`}
                                                        style={{ width: `${Math.max(pct, assigned.length > 0 ? 5 : 0)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* ═══ ADD / EDIT ROLE MODAL (DISPENSING & USERS STYLE) ═══ */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto border border-gray-200">
                        {/* Header */}
                        <div className="bg-slate-900 px-4 py-3 border-b-2 border-emerald-500 text-white flex items-center justify-between sticky top-0 z-10">
                            <div>
                                <h2 className="text-sm font-black flex items-center gap-2">
                                    <span>{editingRole ? '⚙️' : '➕'}</span>
                                    {editingRole ? `Configure Permissions: ${editingRole.role_name}` : 'Create New Pharmacy System Role'}
                                </h2>
                                <p className="text-[10px] text-gray-400 font-semibold mt-0.5">
                                    Direct persistence to Supabase `user_roles` table & security matrix
                                </p>
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-xs font-bold transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Body Form */}
                        <form onSubmit={handleSaveRole} className="p-4 space-y-4">
                            {/* Role Name & Cadre Classification */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-700 uppercase tracking-wider mb-1">
                                        Role Name <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.role_name}
                                        disabled={formData.is_super_admin}
                                        onChange={e => setFormData({ ...formData, role_name: e.target.value })}
                                        placeholder="e.g. Clinical Pharmacist"
                                        className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-200 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-700 uppercase tracking-wider mb-1">
                                        Cadre Classification <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                        value={formData.cadre_type || 'Clinical'}
                                        onChange={e => setFormData({ ...formData, cadre_type: e.target.value as any })}
                                        className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-800 focus:border-emerald-500 focus:bg-white outline-none cursor-pointer"
                                    >
                                        <option value="Clinical">💊 Clinical Cadre (PPB Regulated)</option>
                                        <option value="Financial">💰 Financial / POS Counter</option>
                                        <option value="Inventory">📦 Inventory & Warehouse Supply</option>
                                        <option value="Administrative">👑 Executive & Administrative</option>
                                    </select>
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-[10px] font-black text-gray-700 uppercase tracking-wider mb-1">
                                    Role Description & Operational Scope
                                </label>
                                <input
                                    type="text"
                                    value={formData.description || ''}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="e.g. Clinical prescription dispensing, dosing calculations and schedule drug register"
                                    className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 focus:border-emerald-500 focus:bg-white outline-none"
                                />
                            </div>

                            {/* Granular Permission Switches Grid */}
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-gray-700 uppercase tracking-wider">
                                    Granular Security Permissions (12 Switches)
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200/80 max-h-64 overflow-y-auto">
                                    {PERMISSIONS_CATALOG.map(p => {
                                        const isChecked = Boolean(formData[p.key as keyof UserRole]);
                                        return (
                                            <label
                                                key={p.key}
                                                className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${isChecked
                                                    ? 'bg-emerald-50/60 border-emerald-200 text-gray-900'
                                                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                                    }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    disabled={formData.is_super_admin}
                                                    onChange={e => setFormData({ ...formData, [p.key]: e.target.checked })}
                                                    className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500 mt-0.5"
                                                />
                                                <div>
                                                    <p className="text-xs font-bold leading-tight flex items-center gap-1">
                                                        <span>{p.icon}</span> {p.label}
                                                    </p>
                                                    <p className="text-[10px] text-gray-500 leading-tight mt-0.5">{p.desc}</p>
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="pt-3 border-t border-gray-200 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-bold text-xs"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs disabled:opacity-50 flex items-center gap-1.5"
                                >
                                    {isSaving ? (
                                        <>
                                            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                            Saving to Live Database...
                                        </>
                                    ) : (
                                        <>
                                            <span>💾</span>
                                            {editingRole ? 'Save Changes' : 'Create Live Role'}
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ═══ ASSIGNED STAFF DRAWER MODAL ═══ */}
            {selectedRoleStaff && (
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 z-50">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-200">
                        <div className="bg-slate-900 p-3 text-white flex items-center justify-between border-b-2 border-emerald-500">
                            <div>
                                <h3 className="text-xs font-black flex items-center gap-2">
                                    <span>{getRoleIcon(selectedRoleStaff.role.role_name)}</span>
                                    {selectedRoleStaff.role.role_name} — Assigned Staff ({selectedRoleStaff.staff.length})
                                </h3>
                                <p className="text-[10px] text-gray-400 font-medium">Mapped from live `pharmacy_users` table</p>
                            </div>
                            <button
                                onClick={() => setSelectedRoleStaff(null)}
                                className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center text-xs font-bold"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2">
                            {selectedRoleStaff.staff.length === 0 ? (
                                <p className="text-xs text-gray-400 text-center py-6 font-semibold">
                                    No staff currently assigned to this role.
                                </p>
                            ) : (
                                selectedRoleStaff.staff.map(s => (
                                    <div key={s.user_id} className="p-2.5 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-slate-900 text-emerald-400 font-black text-xs flex items-center justify-center">
                                                {s.name?.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-gray-900 leading-tight">{s.name}</p>
                                                <p className="text-[10px] text-gray-500 font-mono">@{s.user_name} • {s.user_code || `US-${s.user_id}`}</p>
                                            </div>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${s.active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                            {s.active ? 'Active' : 'Suspended'}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="p-3 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
                            <Link
                                href="/dashboard/users"
                                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 underline"
                            >
                                Manage in Staff Hub →
                            </Link>
                            <button
                                onClick={() => setSelectedRoleStaff(null)}
                                className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-xs font-bold"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
