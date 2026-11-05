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
  Calendar,
  Building2,
  DollarSign,
  UserPlus,
  TrendingUp,
  FileSpreadsheet,
  Lock,
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
function getRoleBadge(userType: string) {
  const t = (userType || '').toLowerCase();
  if (t.includes('super')) return { label: 'Administrator', cls: 'text-emerald-300' };
  if (t === 'admin')       return { label: 'Administrator', cls: 'text-emerald-300' };
  if (t === 'manager')     return { label: 'Manager',       cls: 'text-emerald-300' };
  if (t === 'pharmacist')  return { label: 'Pharmacist',    cls: 'text-emerald-300' };
  if (t === 'cashier')     return { label: 'Cashier',       cls: 'text-emerald-300' };
  return { label: userType, cls: 'text-emerald-300' };
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
    setUser(JSON.parse(userData));
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

  return (
    <SettingsProvider>
      <OutletProvider>
        <div className="min-h-screen bg-[#F0F5F2] flex select-none text-slate-800">

          {/* ══════════════════════════════════════════════════════════════
              EXACT SUPER PREMIUM EMERALD SIDEBAR WITH REAL BACKGROUND
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
                sidebarOpen ? 'w-[264px]' : 'w-[76px]'
              } bg-[#023318] border-r border-[#00E676]/40 flex flex-col fixed h-full z-50 transition-all duration-300 shadow-[4px_0_30px_rgba(0,180,80,0.25)] overflow-hidden`}
            >
              {/* ── Top Centered Cross & Brand Header ── */}
              <div className="flex flex-col items-center justify-center pt-5 pb-3 px-3 border-b border-emerald-900/60 relative flex-shrink-0">
                {/* White Medical Cross with Green Leaf */}
                <div className="relative mb-2">
                  <svg width="46" height="46" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
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
                    <h1 className="text-[19px] font-black text-white tracking-tight leading-tight">
                      Alpha Pharmacy
                    </h1>
                    <p className="text-[11px] text-emerald-200/90 font-medium tracking-wide mt-0.5">
                      Care Today. Health Tomorrow.
                    </p>
                  </div>
                )}

                {/* Edge collapse button */}
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="absolute -right-3 top-8 w-6 h-6 bg-[#00A848] border border-emerald-300 text-white rounded-full flex items-center justify-center shadow-md hover:bg-[#00D060] transition-colors z-10"
                  title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                >
                  {sidebarOpen ? <ChevronLeft className="w-3.5 h-3.5 text-white" /> : <ChevronRight className="w-3.5 h-3.5 text-white" />}
                </button>
              </div>

              {/* ── Nav Items Scroll Area ── */}
              <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-2 scrollbar-none">
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
                          className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl transition-all duration-200 group relative ${
                            isGroupActive
                              ? 'bg-gradient-to-r from-[#00D060]/30 via-[#00A848]/40 to-[#00D060]/30 border-2 border-[#00E676] text-white font-extrabold shadow-[0_0_22px_rgba(0,230,118,0.45)]'
                              : 'text-white/95 hover:text-white bg-black/20 hover:bg-black/35 border border-[#00E676]/40 shadow-[0_0_14px_rgba(0,230,118,0.2)] font-bold'
                          }`}
                          title={!sidebarOpen ? group.name : undefined}
                        >
                          <span className="flex-shrink-0 text-white">
                            <GroupIcon className="w-5 h-5 text-white" />
                          </span>
                          {sidebarOpen && (
                            <span className="text-[14px] truncate font-bold">{group.name}</span>
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
                        className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl transition-all group relative ${
                          isGroupActive
                            ? 'text-white font-bold bg-white/[0.08]'
                            : 'text-white/85 hover:text-white hover:bg-white/[0.06] font-semibold'
                        }`}
                        title={!sidebarOpen ? group.name : undefined}
                      >
                        <span className="flex-shrink-0 text-white">
                          <GroupIcon className="w-5 h-5 text-white" />
                        </span>
                        {sidebarOpen && (
                          <>
                            <span className="text-[14px] truncate flex-1 text-left font-bold tracking-wide">{group.name}</span>
                            <span className="flex-shrink-0 text-emerald-300">
                              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                            </span>
                          </>
                        )}
                      </button>

                      {/* Sub-items List */}
                      {isOpen && sidebarOpen && visibleItems.length > 0 && (
                        <div className="space-y-1.5 pt-0.5 pl-1">
                          {visibleItems.map(item => {
                            const isActive = pathname === item.href;
                            const SubIcon  = item.icon;

                            // ── Active Pill (Pharmacy POS) ──
                            if (isActive) {
                              return (
                                <Link
                                  key={item.href}
                                  href={item.href}
                                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-[#00E676] via-[#00C853] to-[#00A848] text-white font-extrabold shadow-[0_4px_20px_rgba(0,230,118,0.55)] border border-emerald-300/40 transition-all active:scale-[0.99]"
                                >
                                  <span className="flex-shrink-0 text-white">
                                    <SubIcon className="w-5 h-5 text-white" />
                                  </span>
                                  <span className="text-[14px] truncate flex-1 font-extrabold tracking-wide">{item.name}</span>
                                  {item.badge && (
                                    <span className="w-5 h-5 rounded-full bg-[#E52538] text-white text-[10px] font-black flex items-center justify-center shadow-md">
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
                                className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-[13.5px] text-white/90 hover:text-white hover:bg-white/[0.08] transition-all font-medium group"
                              >
                                <span className="flex-shrink-0 text-white/80 group-hover:text-white">
                                  <SubIcon className="w-4 h-4 text-white" />
                                </span>
                                <span className="truncate flex-1">{item.name}</span>
                                {item.badge && (
                                  <span className="w-5 h-5 rounded-full bg-[#E52538] text-white text-[10px] font-black flex items-center justify-center shadow-md flex-shrink-0">
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
                    <div className="px-3.5 py-2.5 rounded-2xl bg-black/25 border border-white/20 backdrop-blur-md flex items-center gap-3 shadow-lg">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white shadow-md flex-shrink-0">
                        <ShieldCheck className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[12px] font-extrabold text-white tracking-wide leading-tight">Secure & Compliant</p>
                        <p className="text-[10px] text-emerald-200/80 font-medium truncate mt-0.5">Pharmacy Management System</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Bottom Spacer so items don't cover the background pill & leaves */}
                <div className="h-16" />
              </nav>

              {/* ── User Profile Footer ── */}
              <div className="border-t border-emerald-900/60 px-3.5 py-3 bg-[#011a0c]/90 backdrop-blur-md flex-shrink-0">
                <div className="flex items-center gap-3">
                  {/* Avatar Circle with Generated Photo */}
                  <div className="relative w-9 h-9 rounded-full overflow-hidden border-2 border-emerald-400 flex-shrink-0 shadow-md">
                    <img
                      src="/admin-avatar.png"
                      alt={user.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {sidebarOpen && (
                    <>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <p className="text-[13px] font-extrabold text-white truncate leading-tight">{user.name}</p>
                          <ChevronDown className="w-3 h-3 text-emerald-300" />
                        </div>
                        <p className="text-[10.5px] text-emerald-300/80 font-semibold truncate">{roleBadge.label}</p>
                      </div>

                      {/* Settings Gear */}
                      <button
                        onClick={() => router.push('/dashboard/tax-settings')}
                        title="Settings"
                        className="flex-shrink-0 text-white hover:text-emerald-200 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                      >
                        <Settings className="w-4 h-4 text-white" />
                      </button>

                      {/* Power / Sign out */}
                      <button
                        onClick={handleLogout}
                        title="Sign Out"
                        className="flex-shrink-0 text-white hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/15 transition-colors"
                      >
                        <Power className="w-4 h-4 text-white" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </aside>
          )}

          {/* ── Main Workspace ── */}
          <main className={`flex-1 ${isCashier ? 'ml-0' : sidebarOpen ? 'ml-[264px]' : 'ml-[76px]'} transition-all duration-300 flex flex-col min-h-screen`}>
            {/* Top header */}
            <header className="h-16 bg-white border-b border-emerald-100 flex items-center justify-between px-6 sticky top-0 z-40 shadow-xs">
              <div className="flex items-center gap-3">
                <h2 className="text-[16px] font-bold text-gray-800 flex items-center gap-2">
                  <span>{greeting.emoji}</span>
                  <span>{greeting.text} 👋</span>
                </h2>
                <span className="text-xs text-gray-400 font-medium hidden sm:block">Alpha Pharmacy POS</span>
              </div>
              <div className="flex items-center gap-3">
                <OutletSwitcher />
                <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full shadow-xs">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-xs font-semibold">Online</span>
                </div>
                <button
                  onClick={() => window.location.reload()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00A848] text-white text-xs font-bold rounded-xl hover:bg-[#00923e] transition-colors shadow-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-white" />
                  Refresh
                </button>
                <button className="relative p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-700">
                  <Bell className="w-4 h-4" />
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-extrabold rounded-full flex items-center justify-center">3</span>
                </button>
                <div className="flex items-center gap-2.5 pl-3 border-l border-gray-200">
                  <div className="text-right hidden sm:block">
                    <p className="text-[13px] font-bold text-gray-800 leading-tight">{user.name}</p>
                    <p className="text-[11px] text-gray-400 font-medium">{roleBadge.label}</p>
                  </div>
                  <div className="w-9 h-9 rounded-full bg-[#00A848] text-white font-black text-sm flex items-center justify-center shadow-xs">
                    {avatarLetter}
                  </div>
                </div>
              </div>
            </header>

            <div className="p-4 flex-1 flex flex-col">{children}</div>
          </main>
        </div>
      </OutletProvider>
    </SettingsProvider>
  );
}
