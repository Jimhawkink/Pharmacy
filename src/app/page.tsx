'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { logActivity } from '@/lib/supabase';

// Pharmacy Cross/Caduceus SVG Logo
function PharmacyLogo({ className = 'w-16 h-16' }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Outer circle */}
            <circle cx="50" cy="50" r="46" stroke="currentColor" strokeWidth="2.5" opacity="0.2"/>
            <circle cx="50" cy="50" r="42" fill="currentColor" opacity="0.1"/>
            {/* Pharmacy Cross */}
            <rect x="38" y="22" width="24" height="56" rx="4" fill="currentColor"/>
            <rect x="22" y="38" width="56" height="24" rx="4" fill="currentColor"/>
            {/* Inner cross highlight */}
            <rect x="42" y="26" width="16" height="48" rx="2" fill="white" opacity="0.3"/>
            <rect x="26" y="42" width="48" height="16" rx="2" fill="white" opacity="0.3"/>
            {/* Rx symbol */}
            <text x="50" y="56" textAnchor="middle" fill="white" fontSize="18" fontWeight="bold" fontFamily="serif">Rx</text>
        </svg>
    );
}

// Floating pill animation elements
function FloatingPills() {
    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* Pill shapes */}
            <div className="absolute top-[15%] left-[10%] w-8 h-4 bg-teal-400/10 rounded-full rotate-45 animate-float1"></div>
            <div className="absolute top-[30%] right-[15%] w-10 h-5 bg-cyan-400/10 rounded-full -rotate-12 animate-float2"></div>
            <div className="absolute top-[60%] left-[20%] w-6 h-3 bg-emerald-400/10 rounded-full rotate-30 animate-float3"></div>
            <div className="absolute bottom-[20%] right-[25%] w-9 h-4 bg-teal-300/10 rounded-full -rotate-45 animate-float1"></div>
            <div className="absolute top-[45%] left-[70%] w-7 h-3 bg-green-400/10 rounded-full rotate-60 animate-float2"></div>
            {/* Cross shapes */}
            <div className="absolute top-[20%] right-[30%] text-teal-500/8 text-3xl font-bold animate-float3">+</div>
            <div className="absolute bottom-[30%] left-[15%] text-cyan-500/8 text-4xl font-bold animate-float1">+</div>
            <div className="absolute top-[70%] right-[10%] text-emerald-500/8 text-2xl font-bold animate-float2">+</div>
        </div>
    );
}

export default function LoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [currentTime, setCurrentTime] = useState('');
    const [currentDate, setCurrentDate] = useState('');
    const [pharmacyName, setPharmacyName] = useState('Alpha Retail Pharmacy');
    const [privacyAccepted, setPrivacyAccepted] = useState(false);
    const [showPrivacyModal, setShowPrivacyModal] = useState(false);

    // Outlet selection
    const [showOutletPicker, setShowOutletPicker] = useState(false);
    const [userOutlets, setUserOutlets] = useState<{ outlet_id: number; outlet_name: string; is_main: boolean }[]>([]);
    const [pendingUser, setPendingUser] = useState<any>(null);

    useEffect(() => {
        const updateDateTime = () => {
            const now = new Date();
            setCurrentTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }));
            setCurrentDate(now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
        };
        updateDateTime();
        const interval = setInterval(updateDateTime, 1000);

        // Load pharmacy name from pharmacy_organisation_settings
        const loadPharmacyName = async () => {
            try {
                const { data } = await supabase
                    .from('pharmacy_organisation_settings')
                    .select('setting_value')
                    .eq('setting_key', 'company_name')
                    .single();
                if (data?.setting_value) {
                    setPharmacyName(data.setting_value);
                }
            } catch {
                // Use default
            }
        };
        loadPharmacyName();

        return () => clearInterval(interval);
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        if (!username || !password) {
            setError('Please enter username and password');
            setIsLoading(false);
            return;
        }

        if (!privacyAccepted) {
            setError('Please accept the Privacy Policy and Terms of Service to continue (DPA 2019 requirement).');
            setIsLoading(false);
            return;
        }

        try {
            // Query pharmacy_users table (case-insensitive username match)
            console.log('Attempting login for:', username);
            const { data, error: dbError } = await supabase
                .from('pharmacy_users')
                .select('*')
                .ilike('user_name', username)
                .eq('active', true)
                .single();

            console.log('DB Response:', { data, dbError });

            if (dbError) {
                setError(`DB Error: ${dbError.message} (Code: ${dbError.code})`);
                setIsLoading(false);
                return;
            }

            if (!data) {
                setError('No user found with that username');
                setIsLoading(false);
                return;
            }

            // Check password
            console.log('Checking password match...');
            console.log('Stored hash:', JSON.stringify(data.password_hash));
            console.log('Entered pw:', JSON.stringify(password));
            if (data.password_hash === password || data.pin === password) {
                // Load user's outlets
                const { data: outletLinks } = await supabase
                    .from('pharmacy_user_outlets')
                    .select('outlet_id')
                    .eq('user_id', data.user_id);

                let availableOutlets: { outlet_id: number; outlet_name: string; is_main: boolean }[] = [];
                if (outletLinks && outletLinks.length > 0) {
                    const outletIds = outletLinks.map(l => l.outlet_id);
                    const { data: outletsData } = await supabase
                        .from('pharmacy_outlets')
                        .select('outlet_id, outlet_name, is_main')
                        .in('outlet_id', outletIds)
                        .eq('active', true);
                    availableOutlets = outletsData || [];
                } else {
                    // No mapping — load all active outlets (legacy)
                    const { data: allOutlets } = await supabase
                        .from('pharmacy_outlets')
                        .select('outlet_id, outlet_name, is_main')
                        .eq('active', true);
                    availableOutlets = allOutlets || [];
                }

                if (availableOutlets.length > 1) {
                    setPendingUser(data);
                    setUserOutlets(availableOutlets);
                    setShowOutletPicker(true);
                } else {
                    const outlet = availableOutlets[0] || { outlet_id: 1, outlet_name: 'Main Pharmacy' };
                    completeLogin(data, outlet.outlet_id, outlet.outlet_name);
                }
            } else {
                setError(`Password mismatch. DB has ${data.password_hash?.length} chars, you entered ${password.length} chars`);
            }
        } catch (err: any) {
            console.error('Login error:', err);
            setError(`Error: ${err?.message || JSON.stringify(err)}`);
        }

        setIsLoading(false);
    };

    const completeLogin = (userData: any, outletId: number, outletName: string) => {
        localStorage.setItem('user', JSON.stringify({
            userId: userData.user_id,
            userName: userData.user_name,
            name: userData.name,
            userType: userData.user_type,
            email: userData.email,
        }));
        localStorage.setItem('activeOutletId', String(outletId));
        localStorage.setItem('activeOutletName', outletName);
        logActivity('Login', `${userData.name} logged in`, `User: ${userData.user_name}, Role: ${userData.user_type}, Outlet: ${outletName}`);
        router.push('/dashboard');
    };

    return (
        <div className="min-h-screen flex relative overflow-hidden">
            {/* Left Panel - Dark Pharmacy Branding */}
            <div className="hidden lg:flex lg:w-[45%] bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 text-white flex-col justify-between p-10 relative overflow-hidden">
                {/* Decorative elements */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-0 right-0 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl"></div>
                    <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl"></div>
                    <div className="absolute top-1/3 left-1/4 w-48 h-48 bg-emerald-400/5 rounded-full blur-2xl animate-pulse"></div>
                    {/* Grid pattern */}
                    <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>
                    {/* DNA helix pattern overlay */}
                    <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }}></div>
                </div>

                <FloatingPills />

                {/* Top - Logo & Branding */}
                <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-14 h-14 bg-gradient-to-br from-teal-400 to-cyan-600 rounded-2xl flex items-center justify-center shadow-lg shadow-teal-500/30 relative">
                            {/* Pharmacy Cross Icon */}
                            <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                                <rect x="9" y="3" width="6" height="18" rx="1.5"/>
                                <rect x="3" y="9" width="18" height="6" rx="1.5"/>
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold tracking-tight">{pharmacyName}</h2>
                            <p className="text-teal-400/70 text-xs font-medium tracking-wider uppercase">Pharmacy Management System</p>
                        </div>
                    </div>
                </div>

                {/* Middle - Feature Highlights */}
                <div className="relative z-10 space-y-6">
                    <h1 className="text-3xl font-bold leading-tight">
                        Smart Pharmacy<br />
                        <span className="bg-gradient-to-r from-teal-400 to-cyan-300 bg-clip-text text-transparent">Management System</span>
                    </h1>
                    <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
                        Complete pharmacy POS, batch tracking with expiry management, prescription handling, and comprehensive financial reporting.
                    </p>

                    <div className="space-y-4 pt-4">
                        {[
                            { emoji: '💊', text: 'Batch tracking & expiry date management (FEFO)' },
                            { emoji: '🏥', text: 'Prescription-aware drug dispensing' },
                            { emoji: '📊', text: 'Real-time inventory & stock alerts' },
                            { emoji: '💳', text: 'M-Pesa, Cash & Credit payment integration' },
                            { emoji: '📋', text: 'Sales, purchase & profit reporting' },
                        ].map((feature, i) => (
                            <div key={i} className="flex items-center gap-3 text-sm text-slate-300">
                                <span className="text-lg flex-shrink-0">{feature.emoji}</span>
                                <span>{feature.text}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Bottom - Date/Time & Credits */}
                <div className="relative z-10 space-y-4">
                    <div className="flex items-center gap-3 text-sm text-slate-500">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/></svg>
                        <span>{currentTime}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                        <span>{currentDate}</span>
                    </div>
                    <div className="border-t border-slate-800 pt-4">
                        <p className="text-slate-500 text-xs">Powered by <span className="text-teal-400 font-semibold">Alpha Solutions</span></p>
                        <p className="text-slate-600 text-[10px] mt-1">Developed by Jimhawkins Korir • 0720316175</p>
                    </div>
                </div>
            </div>

            {/* Right Panel - Login Form */}
            <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 via-teal-50/20 to-cyan-50/30 p-6 relative">
                {/* Subtle background */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <div className="absolute -top-20 -right-20 w-64 h-64 bg-teal-100/40 rounded-full blur-3xl"></div>
                    <div className="absolute -bottom-20 -left-20 w-52 h-52 bg-cyan-100/30 rounded-full blur-3xl"></div>
                    <div className="absolute top-1/2 right-1/4 w-40 h-40 bg-emerald-100/20 rounded-full blur-3xl"></div>
                </div>

                {/* OUTLET PICKER SCREEN */}
                {showOutletPicker && (
                    <div className="relative z-10 w-full max-w-md">
                        <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
                            <div className="bg-gradient-to-r from-teal-500 via-cyan-600 to-teal-600 px-8 py-8 text-center relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                                <div className="relative inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl mb-3">
                                    <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/></svg>
                                </div>
                                <h1 className="text-xl font-bold text-white mb-1">Select Pharmacy Branch</h1>
                                <p className="text-teal-200 text-sm">Welcome {pendingUser?.name}! Choose your branch:</p>
                            </div>
                            <div className="p-6 space-y-3">
                                {userOutlets.map(outlet => (
                                    <button key={outlet.outlet_id}
                                        onClick={() => completeLogin(pendingUser, outlet.outlet_id, outlet.outlet_name)}
                                        className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-100 hover:border-teal-500 hover:bg-teal-50/50 transition-all group"
                                    >
                                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-md ${outlet.is_main ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-gradient-to-br from-teal-500 to-cyan-600'}`}>
                                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                                <rect x="9" y="3" width="6" height="18" rx="1.5"/>
                                                <rect x="3" y="9" width="18" height="6" rx="1.5"/>
                                            </svg>
                                        </div>
                                        <div className="text-left flex-1">
                                            <p className="font-bold text-gray-800 text-sm group-hover:text-teal-700">{outlet.outlet_name}</p>
                                            <p className="text-xs text-gray-400">{outlet.is_main ? '🏥 Main Branch' : '💊 Branch'}</p>
                                        </div>
                                        <svg className="w-5 h-5 text-gray-300 group-hover:text-teal-500 transition-colors" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/></svg>
                                    </button>
                                ))}
                                <button onClick={() => { setShowOutletPicker(false); setPendingUser(null); }}
                                    className="w-full py-3 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl mt-2">
                                    ← Back to Login
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Main Login Form */}
                {!showOutletPicker && (
                    <div className="relative z-10 w-full max-w-md">
                        {/* Mobile-only header */}
                        <div className="lg:hidden text-center mb-8">
                            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-teal-400 to-cyan-600 rounded-2xl shadow-lg shadow-teal-500/30 mb-4 text-white">
                                <svg className="w-11 h-11" viewBox="0 0 24 24" fill="currentColor">
                                    <rect x="9" y="3" width="6" height="18" rx="1.5"/>
                                    <rect x="3" y="9" width="18" height="6" rx="1.5"/>
                                </svg>
                            </div>
                            <h1 className="text-2xl font-bold text-gray-800">{pharmacyName}</h1>
                            <p className="text-gray-500 text-sm mt-1">Pharmacy Management System</p>
                        </div>

                        {/* Login Card */}
                        <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
                            {/* Pharmacy header bar */}
                            <div className="bg-gradient-to-r from-teal-500 via-teal-600 to-cyan-600 px-8 py-5 flex items-center gap-4">
                                <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                                    <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                                        <rect x="9" y="3" width="6" height="18" rx="1.5"/>
                                        <rect x="3" y="9" width="18" height="6" rx="1.5"/>
                                    </svg>
                                </div>
                                <div>
                                    <h2 className="text-white font-bold text-lg">Pharmacy Login</h2>
                                    <p className="text-teal-200 text-xs">Secure access to your pharmacy system</p>
                                </div>
                            </div>

                            <div className="p-8">
                                {/* Welcome text */}
                                <div className="mb-6">
                                    <h3 className="text-xl font-bold text-gray-900">Welcome back</h3>
                                    <p className="text-gray-500 text-sm mt-1">Sign in to manage your pharmacy</p>
                                </div>

                                <form onSubmit={handleLogin} className="space-y-5">
                                    {/* Username */}
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-semibold text-gray-700">Username</label>
                                        <div className="relative">
                                            <input
                                                id="username-input"
                                                type="text"
                                                value={username}
                                                onChange={(e) => setUsername(e.target.value)}
                                                placeholder="Enter your username"
                                                className="w-full px-4 py-3.5 pl-12 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10 transition-all text-sm"
                                            />
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/></svg>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Password */}
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-semibold text-gray-700">Password</label>
                                        <div className="relative">
                                            <input
                                                id="password-input"
                                                type={showPassword ? 'text' : 'password'}
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                placeholder="Enter your password"
                                                className="w-full px-4 py-3.5 pl-12 pr-12 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10 transition-all text-sm"
                                            />
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/></svg>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                            >
                                                {showPassword ? (
                                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd"/><path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z"/></svg>
                                                ) : (
                                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/></svg>
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Error */}
                                    {error && (
                                        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm animate-shake">
                                            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                                            <span className="font-medium">{error}</span>
                                        </div>
                                    )}

                                    {/* Privacy Policy Acceptance (DPA 2019 Compliance) */}
                                    <div className="flex items-start gap-3 p-3 rounded-xl bg-indigo-50 border border-indigo-100">
                                        <input
                                            type="checkbox"
                                            id="privacy-accept"
                                            checked={privacyAccepted}
                                            onChange={e => setPrivacyAccepted(e.target.checked)}
                                            className="mt-0.5 w-4 h-4 accent-teal-600 cursor-pointer flex-shrink-0"
                                        />
                                        <label htmlFor="privacy-accept" className="text-xs text-gray-600 font-medium cursor-pointer leading-relaxed">
                                            I acknowledge that I have read and accept the{' '}
                                            <button type="button" onClick={() => setShowPrivacyModal(true)} className="text-teal-600 font-bold underline hover:text-teal-800">
                                                Privacy Policy
                                            </button>{' '}
                                            and understand my obligations under the{' '}
                                            <span className="font-bold text-indigo-700">Kenya Data Protection Act 2019</span>.
                                            Patient data must be handled with confidentiality.
                                        </label>
                                    </div>

                                    {/* Login Button */}
                                    <button
                                        id="login-button"
                                        type="submit"
                                        disabled={isLoading}
                                        className="w-full py-4 bg-gradient-to-r from-teal-500 via-teal-600 to-cyan-600 hover:from-teal-600 hover:via-teal-700 hover:to-cyan-700 text-white text-base font-bold rounded-xl shadow-lg shadow-teal-500/25 hover:shadow-xl hover:shadow-teal-500/30 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-3"
                                    >
                                        {isLoading ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                <span>Signing in...</span>
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                                    <rect x="9" y="3" width="6" height="18" rx="1.5"/>
                                                    <rect x="3" y="9" width="18" height="6" rx="1.5"/>
                                                </svg>
                                                <span>Sign In to Pharmacy</span>
                                            </>
                                        )}
                                    </button>
                                </form>

                                {/* Security Badge */}
                                <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-400">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                                    <span>Secure Pharmacy Management System</span>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="mt-6 text-center lg:hidden">
                            <p className="text-gray-500 text-xs">Powered by <span className="font-semibold text-teal-600">Alpha Solutions</span></p>
                            <p className="text-gray-400 text-[10px] mt-1">Developed by Jimhawkins Korir • 0720316175</p>
                        </div>
                        <p className="text-center text-gray-300 text-xs mt-4">© 2025 Alpha Retail Pharmacy • v1.0</p>
                    </div>
                )}
            </div>

            {/* Privacy Policy Modal */}
            {showPrivacyModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto">
                        <div className="bg-gradient-to-r from-teal-600 to-cyan-600 px-6 py-4 rounded-t-2xl flex items-center justify-between sticky top-0">
                            <div>
                                <h2 className="text-white font-black text-lg">🔒 Privacy Policy</h2>
                                <p className="text-teal-200 text-xs">Kenya Data Protection Act 2019 Compliance</p>
                            </div>
                            <button onClick={() => setShowPrivacyModal(false)} className="text-white hover:bg-white/20 rounded-lg p-2 text-xl leading-none font-bold">×</button>
                        </div>
                        <div className="p-6 space-y-4">
                            {[
                                { title: '1. Data We Process', content: 'As pharmacy staff, you will access sensitive personal health data including patient prescriptions, medical history, allergies, and payment information. This data is protected under the Kenya Data Protection Act, 2019.' },
                                { title: '2. Your Obligations', content: 'You must: (a) Only access patient data necessary for your role; (b) Never share patient data with unauthorized persons; (c) Report any data breaches immediately to your supervisor; (d) Never use patient data for personal benefit; (e) Log out when leaving your workstation.' },
                                { title: '3. Patient Rights', content: 'Patients have the right to access, correct, and delete their data under DPA 2019. Direct any patient data requests to the Data Protection Officer.' },
                                { title: '4. Security Requirements', content: 'Never share your login credentials. The system auto-logs out after 30 minutes of inactivity. All access is logged and monitored.' },
                                { title: '5. Legal Consequences', content: 'Unauthorized disclosure of patient health data is a criminal offence under DPA 2019 with fines up to KSh 3,000,000 and/or imprisonment.' },
                            ].map((s, i) => (
                                <div key={i} className="border-b border-gray-100 pb-3 last:border-0">
                                    <h3 className="text-sm font-black text-gray-900 mb-1">{s.title}</h3>
                                    <p className="text-xs text-gray-600 font-semibold leading-relaxed">{s.content}</p>
                                </div>
                            ))}
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                                <p className="text-xs font-bold text-amber-800">⚠️ By clicking &quot;I Accept&quot; below and logging in, you confirm that you understand and will comply with these obligations.</p>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setShowPrivacyModal(false)} className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-sm">Close</button>
                                <button onClick={() => { setPrivacyAccepted(true); setShowPrivacyModal(false); }} className="flex-1 px-4 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-sm">✅ I Accept</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Animations */}
            <style jsx>{`
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
                    20%, 40%, 60%, 80% { transform: translateX(4px); }
                }
                .animate-shake {
                    animation: shake 0.5s ease-in-out;
                }
                @keyframes float1 {
                    0%, 100% { transform: translateY(0) rotate(45deg); opacity: 0.6; }
                    50% { transform: translateY(-20px) rotate(50deg); opacity: 0.3; }
                }
                @keyframes float2 {
                    0%, 100% { transform: translateY(0) rotate(-12deg); opacity: 0.5; }
                    50% { transform: translateY(-15px) rotate(-8deg); opacity: 0.2; }
                }
                @keyframes float3 {
                    0%, 100% { transform: translateY(0) rotate(30deg); opacity: 0.4; }
                    50% { transform: translateY(-25px) rotate(35deg); opacity: 0.2; }
                }
                .animate-float1 { animation: float1 6s ease-in-out infinite; }
                .animate-float2 { animation: float2 8s ease-in-out infinite; }
                .animate-float3 { animation: float3 7s ease-in-out infinite; }
            `}</style>
        </div>
    );
}
