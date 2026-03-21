'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { logActivity } from '@/lib/supabase';

export default function LoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [currentTime, setCurrentTime] = useState('');
    const [currentDate, setCurrentDate] = useState('');
    const [storeName, setStoreName] = useState('Alpha Retail');

    // Outlet selection
    const [showOutletPicker, setShowOutletPicker] = useState(false);
    const [userOutlets, setUserOutlets] = useState<{ outlet_id: number; outlet_name: string; outlet_code: string; is_main: boolean }[]>([]);
    const [pendingUser, setPendingUser] = useState<any>(null);

    useEffect(() => {
        const updateDateTime = () => {
            const now = new Date();
            setCurrentTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }));
            setCurrentDate(now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
        };
        updateDateTime();
        const interval = setInterval(updateDateTime, 1000);

        // Load store name from retail_settings
        const loadStoreName = async () => {
            try {
                const { data } = await supabase
                    .from('retail_settings')
                    .select('setting_value')
                    .eq('setting_key', 'company_name')
                    .single();
                if (data?.setting_value) {
                    setStoreName(data.setting_value);
                }
            } catch (err) {
                console.log('Could not load store name');
            }
        };
        loadStoreName();

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

        try {
            // Query retail_users table (case-insensitive username match)
            const { data, error: dbError } = await supabase
                .from('retail_users')
                .select('*')
                .ilike('user_name', username)
                .eq('active', true)
                .single();

            if (dbError || !data) {
                setError('Invalid username or password');
                logActivity('Login', `Failed login attempt for username: ${username}`, 'Invalid credentials');
                setIsLoading(false);
                return;
            }

            // Check password
            if (data.password_hash === password || data.pin === password) {
                // Load user's outlets
                const { data: outletLinks } = await supabase
                    .from('retail_user_outlets')
                    .select('outlet_id')
                    .eq('user_id', data.user_id);

                let availableOutlets: { outlet_id: number; outlet_name: string; outlet_code: string; is_main: boolean }[] = [];
                if (outletLinks && outletLinks.length > 0) {
                    const outletIds = outletLinks.map(l => l.outlet_id);
                    const { data: outletsData } = await supabase
                        .from('retail_outlets')
                        .select('outlet_id, outlet_name, outlet_code, is_main')
                        .in('outlet_id', outletIds)
                        .eq('active', true);
                    availableOutlets = outletsData || [];
                } else {
                    // No mapping — load all active outlets (legacy)
                    const { data: allOutlets } = await supabase
                        .from('retail_outlets')
                        .select('outlet_id, outlet_name, outlet_code, is_main')
                        .eq('active', true);
                    availableOutlets = allOutlets || [];
                }

                if (availableOutlets.length > 1) {
                    setPendingUser(data);
                    setUserOutlets(availableOutlets);
                    setShowOutletPicker(true);
                } else {
                    const outlet = availableOutlets[0] || { outlet_id: 1, outlet_name: 'Main Outlet' };
                    completeLogin(data, outlet.outlet_id, outlet.outlet_name);
                }
            } else {
                setError('Invalid username or password');
            }
        } catch (err) {
            console.error('Login error:', err);
            setError('Connection error. Please try again.');
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
            {/* Left Panel - Dark Branding */}
            <div className="hidden lg:flex lg:w-[45%] bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 text-white flex-col justify-between p-10 relative overflow-hidden">
                {/* Decorative elements */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl"></div>
                    <div className="absolute bottom-0 left-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl"></div>
                    <div className="absolute top-1/3 left-1/4 w-48 h-48 bg-green-400/5 rounded-full blur-2xl animate-pulse"></div>
                    {/* Grid pattern */}
                    <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>
                </div>

                {/* Top - Logo & Branding */}
                <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-green-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/></svg>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold tracking-tight">{storeName}</h2>
                            <p className="text-emerald-400/70 text-xs font-medium tracking-wider uppercase">Point of Sale System</p>
                        </div>
                    </div>
                </div>

                {/* Middle - Feature Highlights */}
                <div className="relative z-10 space-y-6">
                    <h1 className="text-3xl font-bold leading-tight">
                        Smart Retail<br />
                        <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">Management System</span>
                    </h1>
                    <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
                        Comprehensive point of sale, inventory tracking, and financial reporting — all in one powerful platform.
                    </p>

                    <div className="space-y-4 pt-4">
                        {[
                            { icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>, text: 'Real-time sales & inventory tracking' },
                            { icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>, text: 'Multi-outlet & multi-user support' },
                            { icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>, text: 'M-Pesa & cash payment integration' },
                            { icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>, text: 'Full accounting reports & analytics' },
                        ].map((feature, i) => (
                            <div key={i} className="flex items-center gap-3 text-sm text-slate-300">
                                <div className="text-emerald-400 flex-shrink-0">{feature.icon}</div>
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
                        <p className="text-slate-500 text-xs">Powered by <span className="text-emerald-400 font-semibold">Alpha Solutions</span></p>
                        <p className="text-slate-600 text-[10px] mt-1">Developed by Jimhawkins Korir • 0720316175</p>
                    </div>
                </div>
            </div>

            {/* Right Panel - Login Form */}
            <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 to-emerald-50/30 p-6 relative">
                {/* Subtle background */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <div className="absolute -top-20 -right-20 w-64 h-64 bg-emerald-100/40 rounded-full blur-3xl"></div>
                    <div className="absolute -bottom-20 -left-20 w-52 h-52 bg-teal-100/30 rounded-full blur-3xl"></div>
                </div>

                {/* OUTLET PICKER SCREEN */}
                {showOutletPicker && (
                    <div className="relative z-10 w-full max-w-md">
                        <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
                            <div className="bg-gradient-to-r from-indigo-500 via-purple-600 to-indigo-600 px-8 py-8 text-center relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                                <div className="relative inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl mb-3">
                                    <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/></svg>
                                </div>
                                <h1 className="text-xl font-bold text-white mb-1">Select Outlet</h1>
                                <p className="text-indigo-200 text-sm">Welcome {pendingUser?.name}! Choose your outlet:</p>
                            </div>
                            <div className="p-6 space-y-3">
                                {userOutlets.map(outlet => (
                                    <button key={outlet.outlet_id}
                                        onClick={() => completeLogin(pendingUser, outlet.outlet_id, outlet.outlet_name)}
                                        className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-100 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all group"
                                    >
                                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-md ${outlet.is_main ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-gradient-to-br from-indigo-500 to-purple-600'}`}>
                                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd"/></svg>
                                        </div>
                                        <div className="text-left flex-1">
                                            <p className="font-bold text-gray-800 text-sm group-hover:text-indigo-700">{outlet.outlet_name}</p>
                                            <p className="text-xs text-gray-400 font-mono">{outlet.outlet_code}{outlet.is_main ? ' • Head Office' : ''}</p>
                                        </div>
                                        <svg className="w-5 h-5 text-gray-300 group-hover:text-indigo-500 transition-colors" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/></svg>
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
                            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-emerald-400 to-green-600 rounded-2xl shadow-lg shadow-emerald-500/30 mb-4">
                                <svg className="w-9 h-9 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/></svg>
                            </div>
                            <h1 className="text-2xl font-bold text-gray-800">{storeName}</h1>
                            <p className="text-gray-500 text-sm mt-1">Retail Point of Sale System</p>
                        </div>

                        {/* Login Card */}
                        <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-8">
                            {/* Header */}
                            <div className="mb-8">
                                <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
                                <p className="text-gray-500 text-sm mt-1">Sign in to your account to continue</p>
                            </div>

                            <form onSubmit={handleLogin} className="space-y-5">
                                {/* Username */}
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-700">Username</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            placeholder="Enter your username"
                                            className="w-full px-4 py-3.5 pl-12 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 transition-all text-sm"
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
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="Enter your password"
                                            className="w-full px-4 py-3.5 pl-12 pr-12 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 transition-all text-sm"
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

                                {/* Login Button */}
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full py-4 bg-gradient-to-r from-emerald-500 via-green-600 to-teal-600 hover:from-emerald-600 hover:via-green-700 hover:to-teal-700 text-white text-base font-bold rounded-xl shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-3"
                                >
                                    {isLoading ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            <span>Signing in...</span>
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zm7.707 3.293a1 1 0 010 1.414L9.414 9H17a1 1 0 110 2H9.414l1.293 1.293a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                                            <span>Sign In to POS</span>
                                        </>
                                    )}
                                </button>
                            </form>

                            {/* Security Badge */}
                            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-400">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                                <span>Secure Retail Management System</span>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="mt-6 text-center lg:hidden">
                            <p className="text-gray-500 text-xs">Powered by <span className="font-semibold text-emerald-600">Alpha Solutions</span></p>
                            <p className="text-gray-400 text-[10px] mt-1">Developed by Jimhawkins Korir • 0720316175</p>
                        </div>
                        <p className="text-center text-gray-300 text-xs mt-4">© 2025 Alpha Retail POS • v2.0</p>
                    </div>
                )}
            </div>

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
            `}</style>
        </div>
    );
}
