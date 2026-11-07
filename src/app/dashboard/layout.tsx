'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { SettingsProvider } from '@/context/SettingsContext';
import { OutletProvider, useOutlet } from '@/context/OutletContext';
import { logActivity } from '@/lib/supabase';
import {
  Home,
  Pill,
  ShoppingCart,
  ClipboardList,
  FileText,
  Clock,
  Boxes,
  Stethoscope,
  Box,
  ShoppingBag,
  Store,
  ShieldCheck,
  CreditCard,
  Users,
  BarChart3,
  Shield,
  Settings,
  Power,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Bell,
  RotateCcw,
  AlertTriangle,
  Heart,
  Activity,
  Building2,
  DollarSign,
  UserPlus,
  TrendingUp,
  FileSpreadsheet,
  Lock,
  Zap,
  Calendar,
  Menu,
} from 'lucide-react';

/* ─── Menu Groups Definition with Lucide Icons ───────────────────── */
type SubItem = { name: string; href: string; icon: any; badge?: string; adminOnly?: boolean; superAdminOnly?: boolean };
type MenuGroup = { id: string; name: string; icon: any; href?: string; single?: boolean; items?: SubItem[] };

const menuGroups: MenuGroup[] = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    icon: Home,
    href: '/dashboard',
    single: true,
  },
  {
    id: 'pharmacy',
    name: 'Pharmacy',
    icon: Pill,
    items: [
      { name: 'Pharmacy POS',     href: '/dashboard/pos',              icon: ShoppingCart },
      { name: 'Dispensing',        href: '/dashboard/dispensing',       icon: ClipboardList },
      { name: 'Prescriptions',    href: '/dashboard/prescriptions',    icon: FileText },
      { name: 'Expiry Register',  href: '/dashboard/expiry-register',  icon: Clock, badge: '3' },
      { name: 'Batch Management', href: '/dashboard/batches',          icon: Boxes },
    ],
  },
  {
    id: 'clinical',
    name: 'Clinical',
    icon: Stethoscope,
    items: [
      { name: 'Patients',          href: '/dashboard/patients',         icon: UserPlus },
      { name: 'Dangerous Drugs',   href: '/dashboard/dangerous-drugs',  icon: AlertTriangle, badge: 'DDR' },
      { name: 'Pharmacovigilance', href: '/dashboard/pharmacovigilance', icon: Activity },
      { name: 'Drug Interactions', href: '/dashboard/drug-interactions', icon: Heart },
      { name: 'Data Protection 🔒', href: '/dashboard/data-protection', icon: Lock, badge: 'DPA' },
    ],
  },
  {
    id: 'products',
    name: 'Products & Sales',
    icon: Box,
    items: [
      { name: 'Products / Drugs', href: '/dashboard/products',         icon: Pill },
      { name: 'Categories',       href: '/dashboard/categories',       icon: Boxes },
      { name: 'Sales Records',    href: '/dashboard/sales',            icon: FileText },
      { name: 'Sales Return',     href: '/dashboard/sales-return',     icon: RotateCcw },
    ],
  },
  {
    id: 'purchases',
    name: 'Purchases',
    icon: ShoppingBag,
    items: [
      { name: 'Suppliers',            href: '/dashboard/suppliers',        icon: Building2 },
      { name: 'Purchase Entry',       href: '/dashboard/purchase',         icon: Boxes },
      { name: 'Purchase Records',     href: '/dashboard/purchases',        icon: FileText },
      { name: 'Purchase Return',      href: '/dashboard/purchase-return',  icon: RotateCcw },
      { name: 'Goods Received (GRN)', href: '/dashboard/grn',              icon: Boxes, badge: 'NEW' },
      { name: 'Accounts Payable',     href: '/dashboard/accounts-payable', icon: DollarSign, badge: 'NEW' },
    ],
  },
  {
    id: 'inventory',
    name: 'Inventory',
    icon: Store,
    items: [
      { name: 'Stock Movement',   href: '/dashboard/stock-movement', icon: RotateCcw },
      { name: 'Stock Take',       href: '/dashboard/stock-take',     icon: ClipboardList },
      { name: 'Stock Transfer',   href: '/dashboard/stock-transfer', icon: Boxes },
      { name: 'Low Stock',        href: '/dashboard/low-stock',      icon: AlertTriangle },
      { name: 'Cold Chain 🌡️',   href: '/dashboard/cold-chain',     icon: ShieldCheck, badge: 'NEW' },
    ],
  },
  {
    id: 'insurance',
    name: 'Insurance',
    icon: ShieldCheck,
    items: [
      { name: 'Insurance Claims',    href: '/dashboard/insurance-claims',   icon: ShieldCheck },
      { name: 'Credit Customers',    href: '/dashboard/credit-customers',   icon: Users },
      { name: 'Credit Payments',     href: '/dashboard/credit-payments',    icon: CreditCard },
      { name: 'Accounts Receivable', href: '/dashboard/accounts-receivable', icon: BarChart3, badge: 'NEW' },
    ],
  },
  {
    id: 'finance',
    name: 'Finance',
    icon: CreditCard,
    items: [
      { name: 'Expenses',              href: '/dashboard/expenses',             icon: CreditCard },
      { name: 'Petty Cash',            href: '/dashboard/petty-cash',           icon: DollarSign,  badge: 'NEW' },
      { name: 'Split Payment',         href: '/dashboard/split-payment',        icon: CreditCard,  badge: 'NEW' },
      { name: 'Bank Reconciliation',   href: '/dashboard/bank-reconciliation',  icon: Building2,   badge: 'NEW' },
      { name: 'M-Pesa Reconciliation', href: '/dashboard/mpesa-reconciliation', icon: DollarSign,  badge: 'NEW' },
      { name: 'Accounts Receivable',   href: '/dashboard/accounts-receivable',  icon: BarChart3,   badge: 'NEW' },
    ],
  },
  {
    id: 'hr',
    name: 'HR & Payroll',
    icon: Users,
    items: [
      { name: 'Shifts',        href: '/dashboard/shifts',        icon: Clock },
      { name: 'Shift Reports', href: '/dashboard/shift-reports', icon: FileSpreadsheet },
    ],
  },
  {
    id: 'reports',
    name: 'Reports',
    icon: BarChart3,
    items: [
      { name: 'Sales Report',  href: '/dashboard/reports/sales',  icon: TrendingUp },
      { name: 'Profit Report', href: '/dashboard/reports/profit', icon: TrendingUp },
      { name: 'Stock Report',  href: '/dashboard/reports/stock',  icon: BarChart3 },
      { name: 'Expiry Report', href: '/dashboard/reports/expiry', icon: Clock },
    ],
  },
  {
    id: 'admin',
    name: 'Administration',
    icon: Shield,
    items: [
      { name: 'Outlets',      href: '/dashboard/outlets',      icon: Building2, superAdminOnly: true },
      { name: 'Users',        href: '/dashboard/users',        icon: Users },
      { name: 'User Roles',   href: '/dashboard/user-roles',   icon: Shield },
      { name: 'Activity Log', href: '/dashboard/activity-log', icon: FileText, adminOnly: true },
      { name: 'Company',      href: '/dashboard/company',      icon: Building2 },
      { name: 'Tax Settings', href: '/dashboard/tax-settings', icon: Settings },
    ],
  },
];

/* ─── Role badge helper ──────────────────────────────────────────── */
function getRoleBadge(userType?: string) {
  const t = (userType || '').toLowerCase();
  if (t.includes('super')) return { label: 'Administrator', cls: 'text-emerald-300' };
  if (t === 'admin')       return { label: 'Administrator', cls: 'text-emerald-300' };
  if (t === 'manager')     return { label: 'Manager',       cls: 'text-emerald-300' };
  if (t === 'pharmacist')  return { label: 'Pharmacist',    cls: 'text-emerald-300' };
  if (t === 'cashier')     return { label: 'Cashier',       cls: 'text-emerald-300' };
  return { label: userType || 'Administrator', cls: 'text-emerald-300' };
}

/* ─── Outlet Switcher for Header ─────────────────────────────────── */
function OutletSwitcher() {
  const { activeOutlet, outlets, switchOutlet } = useOutlet();
  if (outlets.length <= 1) return null;
  return (
    <select
      value={activeOutlet?.outlet_id || ''}
      onChange={e => switchOutlet(Number(e.target.value))}
      className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 focus:border-emerald-400 outline-none cursor-pointer shadow-sm"
    >
      {outlets.map(o => (
        <option key={o.outlet_id} value={o.outlet_id}>
          {o.is_main ? '⭐ ' : '📍 '}{o.outlet_name}
        </option>
      ))}
    </select>
  );
}

/* ─── Main Dashboard Layout ──────────────────────────────────────── */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [user, setUser]               = useState<{ userId: string; name: string; userType: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [expanded, setExpanded]       = useState<Set<string>>(new Set(['pharmacy']));

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) { router.push('/'); return; }
    try {
      setUser(JSON.parse(userData));
    } catch {
      setUser(null);
    }
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    // Auto-logout after 30 minutes of inactivity
    let timeout: NodeJS.Timeout;
    const resetTimer = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        localStorage.removeItem('user');
        router.push('/?session_expired=1');
      }, 30 * 60 * 1000);
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);
    resetTimer();

    return () => {
      clearInterval(timer);
      clearTimeout(timeout);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
    };
  }, [router]);

  // Keep active group expanded
  useEffect(() => {
    const active = menuGroups.find(g => !g.single && g.items?.some(i => i.href === pathname));
    if (active) setExpanded(prev => { const s = new Set(prev); s.add(active.id); return s; });
  }, [pathname]);

  const toggleGroup = (id: string) =>
    setExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const getGreeting = () => {
    const h = currentTime.getHours();
    if (h < 12) return { text: 'Good Morning',   emoji: '☀️' };
    if (h < 17) return { text: 'Good Afternoon', emoji: '☀️' };
    if (h < 21) return { text: 'Good Evening',   emoji: '🌆' };
    return         { text: 'Good Night',      emoji: '🌙' };
  };
  const greeting = getGreeting();

  const handleLogout = async () => {
    await logActivity('Logout', `${user?.name || 'Unknown'} logged out`);
    localStorage.removeItem('user');
    router.push('/');
  };

  if (!user) return null;

  const isCashier    = ['cashier', 'waiter'].includes((user.userType || '').toLowerCase());
  const isSuperAdmin = ['superadmin', 'superuser', 'super admin'].includes((user.userType || '').toLowerCase());
  const isAdmin      = isSuperAdmin || ['admin', 'manager'].includes((user.userType || '').toLowerCase());
  const roleBadge    = getRoleBadge(user.userType);
  const avatarLetter = (user.name || 'S').charAt(0).toUpperCase();

  const formattedDate = currentTime.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const formattedTime = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <SettingsProvider>
      <OutletProvider>
        <div className="min-h-screen bg-[#F0F5F2] flex select-none text-slate-800">

          {/* ══════════════════════════════════════════════════════════════
              SLENDER SUPER-PREMIUM EMERALD SIDEBAR WITH CURVED USER PANEL
             ══════════════════════════════════════════════════════════════ */}
          {!isCashier && (
            <aside
              style={{
                backgroundImage: "url('/sidebar-bg.jpg')",
                backgroundSize: '100% 100%',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
              }}
              className={`${
                sidebarOpen ? 'w-[224px]' : 'w-[68px]'
              } bg-[#023318] border-r border-[#00E676]/40 flex flex-col fixed h-full z-50 transition-all duration-300 shadow-[4px_0_24px_rgba(0,180,80,0.22)] overflow-hidden`}
            >
              {/* ── Top Centered Cross & Brand Header ── */}
              <div className="flex flex-col items-center justify-center pt-4 pb-2 px-2 border-b border-emerald-900/60 relative flex-shrink-0">
                {/* White Medical Cross with Green Leaf */}
                <div className="relative mb-1.5">
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* White Greek Cross */}
                    <path
                      d="M15 4C15 2.89543 15.8954 2 17 2H23C24.1046 2 25 2.89543 25 4V15H36C37.1046 15 38 15.8954 38 17V23C38 24.1046 37.1046 25 36 25H25V36C25 37.1046 24.1046 38 23 38H17C15.8954 38 15 37.1046 15 36V25H4C2.89543 25 2 24.1046 2 23V17C2 15.8954 2.89543 15 4 15H15V4Z"
                      fill="white"
                    />
                    {/* Vibrant Leaf in upper right arm */}
                    <path
                      d="M23 15C23 15 25 7 34 5C34 5 36 12 31 17C28 20 23 19 23 19V15Z"
                      fill="#00E676"
                    />
                    <path
                      d="M24 17.5C27 15.5 30 11.5 33 5"
                      stroke="#008A3D"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>

                {sidebarOpen && (
                  <div className="flex flex-col items-center text-center">
                    <h1 className="text-[17px] font-black text-white tracking-tight leading-tight">
                      Alpha Pharmacy
                    </h1>
                    <p className="text-[10px] text-emerald-200/90 font-medium tracking-wide mt-0.5">
                      Care Today. Health Tomorrow.
                    </p>
                  </div>
                )}

                {/* Edge collapse button */}
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="absolute -right-3 top-7 w-6 h-6 bg-[#00A848] border border-emerald-300 text-white rounded-full flex items-center justify-center shadow-md hover:bg-[#00D060] transition-colors z-10"
                  title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                >
                  {sidebarOpen ? <ChevronLeft className="w-3.5 h-3.5 text-white" /> : <ChevronRight className="w-3.5 h-3.5 text-white" />}
                </button>
              </div>

              {/* ── Nav Items Scroll Area with White Scrollbar ── */}
              <nav
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'rgba(255, 255, 255, 0.5) transparent',
                }}
                className="flex-1 overflow-y-auto py-2.5 px-2 space-y-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-white/50 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent"
              >
                {menuGroups.map(group => {
                  const isGroupActive = group.single
                    ? pathname === group.href
                    : group.items?.some(i => i.href === pathname) ?? false;
                  const isOpen = expanded.has(group.id);
                  const GroupIcon = group.icon;

                  // ── Dashboard Standalone Pill ──
                  if (group.single) {
                    return (
                      <div key={group.id} className="pt-0.5">
                        <Link
                          href={group.href!}
                          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl transition-all duration-200 group relative ${
                            isGroupActive
                              ? 'bg-gradient-to-r from-[#00D060]/30 via-[#00A848]/40 to-[#00D060]/30 border-2 border-[#00E676] text-white font-extrabold shadow-[0_0_20px_rgba(0,230,118,0.45)]'
                              : 'text-white/95 hover:text-white bg-black/20 hover:bg-black/35 border border-[#00E676]/40 shadow-[0_0_12px_rgba(0,230,118,0.2)] font-bold'
                          }`}
                          title={!sidebarOpen ? group.name : undefined}
                        >
                          <span className="flex-shrink-0 text-white">
                            <GroupIcon className="w-4 h-4 text-white" />
                          </span>
                          {sidebarOpen && (
                            <span className="text-[13px] truncate font-bold">{group.name}</span>
                          )}
                        </Link>
                      </div>
                    );
                  }

                  const visibleItems = group.items?.filter(item => {
                    if (item.superAdminOnly && !isSuperAdmin) return false;
                    if (item.adminOnly      && !isAdmin)      return false;
                    return true;
                  }) ?? [];

                  return (
                    <div key={group.id} className="space-y-1">
                      {/* Parent Group Header */}
                      <button
                        onClick={() => toggleGroup(group.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all group relative ${
                          isGroupActive
                            ? 'text-white font-bold bg-white/[0.08]'
                            : 'text-white/85 hover:text-white hover:bg-white/[0.06] font-semibold'
                        }`}
                        title={!sidebarOpen ? group.name : undefined}
                      >
                        <span className="flex-shrink-0 text-white">
                          <GroupIcon className="w-4 h-4 text-white" />
                        </span>
                        {sidebarOpen && (
                          <>
                            <span className="text-[13px] truncate flex-1 text-left font-bold tracking-wide">{group.name}</span>
                            <span className="flex-shrink-0 text-emerald-300">
                              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                            </span>
                          </>
                        )}
                      </button>

                      {/* Sub-items List */}
                      {isOpen && sidebarOpen && visibleItems.length > 0 && (
                        <div className="space-y-1 pt-0.5 pl-1">
                          {visibleItems.map(item => {
                            const isActive = pathname === item.href;
                            const SubIcon  = item.icon;

                            // ── Active Pill (Pharmacy POS) ──
                            if (isActive) {
                              return (
                                <Link
                                  key={item.href}
                                  href={item.href}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-2xl bg-gradient-to-r from-[#00E676] via-[#00C853] to-[#00A848] text-white font-extrabold shadow-[0_4px_18px_rgba(0,230,118,0.55)] border border-emerald-300/40 transition-all active:scale-[0.99]"
                                >
                                  <span className="flex-shrink-0 text-white">
                                    <SubIcon className="w-4 h-4 text-white" />
                                  </span>
                                  <span className="text-[13px] truncate flex-1 font-extrabold tracking-wide">{item.name}</span>
                                  {item.badge && (
                                    <span className="w-4 h-4 rounded-full bg-[#E52538] text-white text-[9.5px] font-black flex items-center justify-center shadow-md">
                                      {item.badge}
                                    </span>
                                  )}
                                </Link>
                              );
                            }

                            // ── Inactive Sub-Item ──
                            return (
                              <Link
                                key={item.href}
                                href={item.href}
                                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-[12.5px] text-white/90 hover:text-white hover:bg-white/[0.08] transition-all font-medium group"
                              >
                                <span className="flex-shrink-0 text-white/80 group-hover:text-white">
                                  <SubIcon className="w-3.5 h-3.5 text-white" />
                                </span>
                                <span className="truncate flex-1">{item.name}</span>
                                {item.badge && (
                                  <span className="w-4 h-4 rounded-full bg-[#E52538] text-white text-[9.5px] font-black flex items-center justify-center shadow-md flex-shrink-0">
                                    {item.badge}
                                  </span>
                                )}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* ── Secure & Compliant Card ── */}
                {sidebarOpen && (
                  <div className="pt-2">
                    <div className="px-3 py-2 rounded-2xl bg-black/25 border border-white/20 backdrop-blur-md flex items-center gap-2.5 shadow-lg">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white shadow-md flex-shrink-0">
                        <ShieldCheck className="w-4 h-4 text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-extrabold text-white tracking-wide leading-tight">Secure & Compliant</p>
                        <p className="text-[9.5px] text-emerald-200/80 font-medium truncate mt-0.5">Pharmacy Management System</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Bottom Spacer to reveal pill & leaves from background */}
                <div className="h-14" />
              </nav>

              {/* ── Curvy Floating User Panel (Dynamic Logged-In User) ── */}
              <div className="mx-2 mb-2 p-2.5 rounded-2xl bg-black/75 border border-white/15 backdrop-blur-xl shadow-2xl flex items-center gap-2.5 flex-shrink-0">
                {/* Avatar with photo or dynamic letter */}
                <div className="relative w-8 h-8 rounded-full overflow-hidden border border-emerald-400 flex-shrink-0 shadow bg-gradient-to-tr from-[#00A848] to-[#00E676] flex items-center justify-center text-white font-black text-xs">
                  <img
                    src="/admin-avatar.png"
                    alt={user.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <span className="w-full h-full flex items-center justify-center text-white font-black text-xs absolute inset-0 -z-10">
                    {avatarLetter}
                  </span>
                </div>

                {sidebarOpen && (
                  <>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="text-[12px] font-extrabold text-white truncate leading-tight">
                          {user.name}
                        </p>
                        <ChevronDown className="w-3 h-3 text-emerald-300 flex-shrink-0" />
                      </div>
                      <p className="text-[9.5px] text-emerald-300 font-semibold truncate mt-0.5">
                        {roleBadge.label}
                      </p>
                    </div>

                    {/* Settings Gear */}
                    <button
                      onClick={() => router.push('/dashboard/tax-settings')}
                      title="Settings"
                      className="flex-shrink-0 text-white/90 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      <Settings className="w-3.5 h-3.5 text-white" />
                    </button>

                    {/* Power / Sign out */}
                    <button
                      onClick={handleLogout}
                      title="Sign Out"
                      className="flex-shrink-0 text-white/90 hover:text-red-400 p-1 rounded-lg hover:bg-red-500/15 transition-colors"
                    >
                      <Power className="w-3.5 h-3.5 text-white" />
                    </button>
                  </>
                )}
              </div>
            </aside>
          )}

          {/* ── Main Workspace ── */}
          <main className={`flex-1 ${isCashier ? 'ml-0' : sidebarOpen ? 'ml-[224px]' : 'ml-[68px]'} transition-all duration-300 flex flex-col ${pathname === '/dashboard/pos' ? 'h-screen overflow-hidden' : 'min-h-screen'} min-w-0 max-w-full overflow-x-hidden`}>
            {/* Top header - Exactly matching reference */}
            <header className="h-16 bg-white/95 backdrop-blur-sm border-b border-gray-100 flex items-center justify-between px-6 sticky top-0 z-40 shrink-0 shadow-xs">
              {/* Left Greeting & Sidebar Toggle */}
              <div className="flex items-center gap-3">
                {!isCashier && (
                  <button
                    onClick={() => setSidebarOpen(prev => !prev)}
                    className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-700 transition-colors"
                    title="Toggle Sidebar"
                  >
                    <Menu className="w-5 h-5 text-gray-800" />
                  </button>
                )}
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl select-none">☀️</span>
                  <div>
                    <h2 className="text-[15px] font-extrabold text-gray-900 leading-tight">
                      {greeting.text} 👋
                    </h2>
                    <p className="text-[11px] text-gray-400 font-semibold">Alpha Pharmacy POS</p>
                  </div>
                </div>
              </div>

              {/* Center Search Pill */}
              <div className="hidden xl:flex items-center flex-1 max-w-xl mx-6">
                <div className="relative w-full">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
                  <input
                    type="text"
                    placeholder="Scan Barcode or Search by Drug, Generic Name, SKU (Press Enter)"
                    className="w-full pl-10 pr-10 py-2 bg-gray-50/70 hover:bg-white focus:bg-white border border-gray-200/90 rounded-full text-xs font-medium text-gray-700 outline-none shadow-xs transition-all focus:border-emerald-500"
                    readOnly
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-xs cursor-pointer" title="Scan Barcode">
                    📷
                  </span>
                </div>
              </div>

              {/* Right Controls */}
              <div className="flex items-center gap-3">
                <OutletSwitcher />
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200/80 rounded-full shadow-xs">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-xs font-bold">Online</span>
                </div>
                <button
                  onClick={() => window.location.reload()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00A848] text-white text-xs font-bold rounded-full hover:bg-[#00923e] transition-colors shadow-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-white" />
                  Refresh
                </button>
                <button className="relative p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-700">
                  <Bell className="w-4 h-4 text-gray-700" />
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-extrabold rounded-full flex items-center justify-center">3</span>
                </button>

                {/* 3D Rich Emerald Calendar & Time Capsule */}
                <div
                  className="hidden sm:flex items-center gap-2.5 px-4 py-1.5 rounded-2xl text-white select-none cursor-default"
                  style={{
                    background: 'linear-gradient(135deg, #004D25 0%, #006837 50%, #008A45 100%)',
                    boxShadow: '0 4px 14px rgba(0, 77, 37, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.3)',
                    border: '1px solid rgba(52, 211, 153, 0.3)'
                  }}
                >
                  <Calendar className="w-4 h-4 text-emerald-200 shrink-0" />
                  <div className="text-left leading-tight">
                    <p className="text-[11px] font-bold text-white tracking-tight">{formattedDate}</p>
                    <p className="text-[10px] text-emerald-200 font-semibold">{formattedTime}</p>
                  </div>
                </div>

                {/* Circular Avatar */}
                <div className="w-9 h-9 rounded-full bg-[#00A848] text-white font-extrabold text-sm flex items-center justify-center shadow-xs">
                  {avatarLetter}
                </div>
              </div>
            </header>

            {/* Content Area */}
            <div className={`flex-1 flex flex-col min-w-0 max-w-full overflow-x-hidden ${pathname === '/dashboard/pos' ? 'p-0 overflow-hidden' : 'p-3 md:p-4'}`}>
              {children}
            </div>

            {/* ── Luxury Emerald Bottom Curved Wave Ribbon Footer ── */}
            <footer className="h-10 bg-white border-t border-emerald-100/80 flex items-center justify-between select-none shrink-0 sticky bottom-0 z-30 shadow-[0_-1px_6px_rgba(0,0,0,0.03)] overflow-hidden">
              {/* Left Curved Wave - mirrors the right ribbon */}
              <div className="relative h-full flex items-center shrink-0 overflow-hidden pr-14 pl-5">
                {/* Left SVG wave shape */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 380 40" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="leftWaveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#00471F" />
                      <stop offset="55%" stopColor="#007C35" />
                      <stop offset="100%" stopColor="#00A848" />
                    </linearGradient>
                    <linearGradient id="leftNeonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#00E676" />
                      <stop offset="60%" stopColor="#34D399" />
                      <stop offset="100%" stopColor="#00E676" stopOpacity="0.1" />
                    </linearGradient>
                    <filter id="leftNeonGlow" x="-20%" y="-40%" width="140%" height="180%">
                      <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
                      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                  </defs>
                  {/* Mirror curve: starts at top-left (0,0), swoops down-right */}
                  <path d="M 0,0 L 220,0 C 245,0 268,0 285,10 C 308,23 335,39 380,40 L 0,40 Z" fill="url(#leftWaveGrad)" />
                  {/* Inner 3D glass highlight */}
                  <path d="M 0,5 L 215,5 C 238,5 260,6 278,15 C 298,26 320,38 355,40" stroke="#ffffff" strokeWidth="1" strokeOpacity="0.25" fill="none" />
                  {/* Neon edge stroke along the curve */}
                  <path d="M 0,0 L 220,0 C 245,0 268,0 285,10 C 308,23 335,39 380,40" stroke="url(#leftNeonGrad)" strokeWidth="2.6" fill="none" filter="url(#leftNeonGlow)" />
                </svg>
                {/* Left ribbon text */}
                <div className="relative z-10 flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-white/25 flex items-center justify-center shrink-0">
                    <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <span className="text-white font-bold text-[11.5px] tracking-tight drop-shadow-xs">Trusted Pharmacy Solution</span>
                </div>
              </div>

              {/* Centre Feature Badges */}
              <div className="flex items-center gap-2 sm:gap-4 lg:gap-5 text-[11.5px] font-semibold text-gray-700 whitespace-nowrap overflow-x-auto no-scrollbar">
                {/* 2. Fast & Efficient */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-400 shrink-0 drop-shadow-xs" />
                  <span className="text-gray-800 tracking-tight">Fast & Efficient</span>
                </div>

                <span className="text-gray-300 font-light select-none text-xs">|</span>

                {/* 3. Real-time Inventory */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <svg className="w-3.5 h-3.5 fill-[#00A848] shrink-0" viewBox="0 0 24 24">
                    <rect x="3" y="14" width="3" height="8" rx="1" />
                    <rect x="9" y="9" width="3" height="13" rx="1" />
                    <rect x="15" y="4" width="3" height="18" rx="1" />
                    <rect x="21" y="1" width="3" height="21" rx="1" />
                  </svg>
                  <span className="text-gray-800 tracking-tight">Real-time Inventory</span>
                </div>

                <span className="text-gray-300 font-light select-none text-xs hidden md:inline">|</span>

                {/* 4. Better Patient Care */}
                <div className="hidden md:flex items-center gap-1.5 shrink-0">
                  <Users className="w-3.5 h-3.5 text-[#00A848] shrink-0" strokeWidth={2.4} />
                  <span className="text-gray-800 tracking-tight">Better Patient Care</span>
                </div>
              </div>

              {/* Right 3D Emerald Curved Wave Ribbon */}
              <div className="relative h-full flex items-center justify-end shrink-0 select-none overflow-hidden pl-16 pr-5">
                {/* SVG Curved Background with Glowing Neon Edge */}
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  viewBox="0 0 380 40"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="waveEmeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#00A848" />
                      <stop offset="45%" stopColor="#007C35" />
                      <stop offset="100%" stopColor="#00471F" />
                    </linearGradient>

                    <linearGradient id="neonLineGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#00E676" stopOpacity="0.1" />
                      <stop offset="25%" stopColor="#00E676" stopOpacity="0.95" />
                      <stop offset="65%" stopColor="#34D399" />
                      <stop offset="100%" stopColor="#00E676" />
                    </linearGradient>

                    <filter id="neonGlow" x="-20%" y="-40%" width="140%" height="180%">
                      <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>

                    <linearGradient id="goldCrownGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#FDE68A" />
                      <stop offset="50%" stopColor="#F59E0B" />
                      <stop offset="100%" stopColor="#D97706" />
                    </linearGradient>
                  </defs>

                  {/* Main Curved Wave Ribbon Fill */}
                  <path
                    d="M 0,40 C 45,39 72,23 95,10 C 112,0 135,0 160,0 L 380,0 L 380,40 Z"
                    fill="url(#waveEmeraldGrad)"
                  />

                  {/* Secondary subtle inner 3D glass highlight contour */}
                  <path
                    d="M 20,40 C 58,38 82,26 102,14 C 118,6 138,4 162,4 L 380,4"
                    stroke="#ffffff"
                    strokeWidth="1"
                    strokeOpacity="0.3"
                    fill="none"
                  />

                  {/* Radiant Glowing Neon Lime Top Stroke */}
                  <path
                    d="M 0,40 C 45,39 72,23 95,10 C 112,0 135,0 160,0 L 380,0"
                    stroke="url(#neonLineGrad)"
                    strokeWidth="2.6"
                    fill="none"
                    filter="url(#neonGlow)"
                  />
                </svg>

                {/* Ribbon Text and Golden Crown */}
                <div className="relative z-10 flex items-center gap-2">
                  <span className="font-bold text-[12.5px] text-white tracking-tight drop-shadow-xs">
                    Alpha Pharmacy POS
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-200 drop-shadow-xs">
                    v1.0
                  </span>
                  {/* Golden Crown */}
                  <svg
                    className="w-4 h-4 ml-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M2 4l3.2 12h13.6L22 4l-6.2 6.5L12 3.5 8.2 10.5 2 4zm3 14h14v2H5v-2z"
                      fill="url(#goldCrownGrad)"
                      stroke="#B45309"
                      strokeWidth="0.8"
                    />
                  </svg>
                </div>
              </div>
            </footer>
          </main>
        </div>
      </OutletProvider>
    </SettingsProvider>
  );
}
