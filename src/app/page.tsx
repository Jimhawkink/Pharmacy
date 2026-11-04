'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, logActivity } from '@/lib/supabase';

// ── Hybrid PBKDF2 / plain-text password verification ─────────────────
async function verifyPassword(entered: string, stored: string): Promise<boolean> {
    if (!stored) return false;
    if (stored.includes(':')) {
        try {
            const [saltHex, expectedHex] = stored.split(':');
            const enc = new TextEncoder();
            const key = await crypto.subtle.importKey('raw', enc.encode(entered), 'PBKDF2', false, ['deriveBits']);
            const bits = await crypto.subtle.deriveBits(
                { name: 'PBKDF2', salt: enc.encode(saltHex), iterations: 210000, hash: 'SHA-512' }, key, 512
            );
            const derived = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
            return derived === expectedHex;
        } catch { return false; }
    }
    return stored === entered;
}

export default function LoginPage() {
    const router = useRouter();

    // ── Login state
    const [username, setUsername]         = useState('');
    const [password, setPassword]         = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading]       = useState(false);
    const [error, setError]               = useState('');
    const [pharmacyName, setPharmacyName] = useState('AlphaPharmacy');
    const [currentTime, setCurrentTime]   = useState('');
    const [currentDate, setCurrentDate]   = useState('');

    // ── Outlet picker
    const [showOutletPicker, setShowOutletPicker]     = useState(false);
    const [userOutlets, setUserOutlets]               = useState<any[]>([]);
    const [pendingUser, setPendingUser]               = useState<any>(null);
    const [outletPickerError, setOutletPickerError]   = useState('');

    // ── Forgot password & recovery
    const [view, setView]             = useState<'login' | 'forgot' | 'sent'>('login');
    const [fpUsername, setFpUsername] = useState('');
    const [fpLoading, setFpLoading]   = useState(false);
    const [fpError, setFpError]       = useState('');
    const [showHelpModal, setShowHelpModal] = useState(false);

    useEffect(() => {
        const tick = () => {
            const n = new Date();
            setCurrentTime(n.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }));
            setCurrentDate(n.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }));
        };
        tick();
        const iv = setInterval(tick, 1000);

        // Fetch custom pharmacy name if configured
        supabase.from('pharmacy_organisation_settings')
            .select('setting_value')
            .eq('setting_key', 'company_name')
            .maybeSingle()
            .then(
                ({ data }: any) => {
                    if (data?.setting_value) setPharmacyName(data.setting_value);
                },
                () => {}
            );

        return () => clearInterval(iv);
    }, []);

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
        logActivity('Login', `${userData.name} logged in`, `User: ${userData.user_name}, Outlet: ${outletName}`);
        router.push('/dashboard');
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!username.trim() || !password.trim()) {
            setError('Enter your username and password.');
            return;
        }
        setIsLoading(true);

        try {
            // 1. Query pharmacy_users table (case-insensitive username match)
            const { data, error: dbError } = await supabase
                .from('pharmacy_users')
                .select('*')
                .ilike('user_name', username.trim())
                .eq('active', true)
                .maybeSingle();

            if (dbError) throw dbError;
            if (!data) {
                setError('Invalid username or password.');
                logActivity('Login Failed', `User not found: ${username.trim()}`);
                setIsLoading(false);
                return;
            }

            // 2. Verify password (PBKDF2 hash, plain text, or PIN)
            const ok = await verifyPassword(password, data.password_hash || '');
            const pinMatch = data.pin != null && String(data.pin).trim() === String(password).trim();

            if (!ok && !pinMatch) {
                setError('Invalid username or password.');
                logActivity('Login Failed', `Wrong password for: ${username.trim()}`);
                setIsLoading(false);
                return;
            }

            // 3. Load assigned outlets
            const isSuperAdmin =
                data.is_super_admin === true ||
                ['superadmin', 'super admin', 'superuser', 'super user', 'admin', 'manager']
                    .includes((data.user_type || '').toLowerCase()) ||
                ['superadmin', 'superuser', 'admin']
                    .includes((data.user_name || '').toLowerCase());

            const { data: links } = await supabase
                .from('pharmacy_user_outlets')
                .select('outlet_id')
                .eq('user_id', data.user_id);

            let available: any[] = [];
            if (links && links.length > 0) {
                const ids = links.map((l: any) => l.outlet_id);
                const { data: od } = await supabase
                    .from('pharmacy_outlets')
                    .select('outlet_id,outlet_name,is_main')
                    .in('outlet_id', ids)
                    .eq('active', true)
                    .order('is_main', { ascending: false })
                    .order('outlet_name');
                available = od || [];
            } else if (isSuperAdmin) {
                const { data: od } = await supabase
                    .from('pharmacy_outlets')
                    .select('outlet_id,outlet_name,is_main')
                    .eq('active', true)
                    .order('is_main', { ascending: false })
                    .order('outlet_name');
                available = od || [];
            } else {
                const { data: allOutlets } = await supabase
                    .from('pharmacy_outlets')
                    .select('outlet_id,outlet_name,is_main')
                    .eq('active', true)
                    .order('outlet_id')
                    .limit(1);
                available = allOutlets || [];
            }

            // Fallback default outlet
            if (available.length === 0) {
                available = [{ outlet_id: 1, outlet_name: 'Main Pharmacy', is_main: true }];
            }

            // 4. Single outlet → auto-login; Multiple → show picker
            if (available.length > 1) {
                setPendingUser({ ...data, isSuperAdmin });
                setUserOutlets(available);
                setOutletPickerError('');
                setShowOutletPicker(true);
            } else {
                const o = available[0];
                completeLogin(data, o.outlet_id, o.outlet_name);
            }
        } catch (err: any) {
            console.error('Login error:', err);
            setError('Connection error. Please check your network and try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fpUsername.trim()) { setFpError('Enter your username.'); return; }
        setFpLoading(true); setFpError('');

        try {
            const { data } = await supabase
                .from('pharmacy_users')
                .select('user_name, name')
                .ilike('user_name', fpUsername.trim())
                .maybeSingle();

            if (!data) {
                setFpError('No user found with that username.');
                setFpLoading(false);
                return;
            }
            setView('sent');
        } catch {
            setFpError('Network error. Please contact your system administrator.');
        } finally {
            setFpLoading(false);
        }
    };

    // ── Outlet picker screen ─────────────────────────────────────────────
    if (showOutletPicker) return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-cover bg-center"
            style={{
                backgroundImage: `url('/login-bg.jpg')`,
                backgroundColor: '#041226',
            }}>
            {/* Dark glass backdrop overlay */}
            <div className="absolute inset-0 bg-[#041226]/85 backdrop-blur-md pointer-events-none" />

            <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden relative z-10 border-2 border-emerald-400/80"
                style={{ boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.6), 0 0 40px rgba(16, 185, 129, 0.25)' }}>

                {/* Header */}
                <div className="p-7 text-center bg-gradient-to-br from-[#091D3E] via-[#0E2852] to-[#12356B] relative">
                    <div className="w-13 h-13 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center mx-auto mb-2 text-2xl shadow-lg">
                        💊
                    </div>
                    <h1 className="text-2xl font-black text-white tracking-tight">Select Pharmacy Branch</h1>
                    <p className="text-slate-300 text-xs mt-1">
                        Welcome <span className="text-emerald-400 font-bold">{pendingUser?.name}</span>! Choose your terminal location
                    </p>
                    <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-0.5 rounded-full text-[11px] font-bold bg-white/10 text-emerald-300 border border-emerald-400/30">
                        {pendingUser?.isSuperAdmin ? '👑 Super Admin Access' : '👤 Licensed Pharmacist'}
                    </div>
                </div>

                {/* Outlets list */}
                <div className="p-6 space-y-3 bg-white">
                    {outletPickerError && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold leading-relaxed flex items-start gap-2">
                            <span className="text-base shrink-0">⚠️</span>
                            <span>{outletPickerError}</span>
                        </div>
                    )}

                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                        {userOutlets.map(outlet => (
                            <button
                                key={outlet.outlet_id}
                                onClick={() => completeLogin(pendingUser, outlet.outlet_id, outlet.outlet_name)}
                                className="w-full flex items-center gap-3.5 p-3 rounded-2xl border-2 border-slate-100 bg-slate-50/50 hover:border-emerald-400 hover:bg-emerald-50/40 hover:shadow-md transition-all text-left group"
                            >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 shadow-sm ${
                                    outlet.is_main
                                        ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white'
                                        : 'bg-gradient-to-br from-[#091D3E] to-[#12356B] text-emerald-400'
                                }`}>
                                    {outlet.is_main ? '⭐' : '💊'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="font-black text-sm truncate text-slate-800 group-hover:text-emerald-700">
                                            {outlet.outlet_name}
                                        </p>
                                        {outlet.is_main && (
                                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                                MAIN BRANCH
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                                        Active Pharmacy Terminal
                                    </p>
                                </div>
                                <svg className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-1 text-slate-300 group-hover:text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={() => { setShowOutletPicker(false); setPendingUser(null); setOutletPickerError(''); }}
                        className="w-full py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all mt-2"
                    >
                        ← Back to Login Credentials
                    </button>
                </div>
            </div>
        </div>
    );

    // ── Main Layout: Perfectly Contained Wallpaper + Visible Footer ─────
    return (
        <div className="h-screen w-full flex flex-col justify-between overflow-hidden font-sans bg-[#041226]">
            <style>{`
                html, body { height: 100%; overflow: hidden; margin: 0; padding: 0; background-color: #041226; }
                @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&display=swap');
                .cursive-highlight { font-family: 'Caveat', cursive; }
            `}</style>

            {/* ═══════════════════════════════════════════════════
                MAIN AREA: Background Image Fits Proportionally
            ═══════════════════════════════════════════════════ */}
            <div
                className="flex-1 w-full flex flex-col lg:flex-row items-center justify-between px-6 sm:px-10 lg:px-14 xl:px-20 py-2 relative overflow-hidden bg-no-repeat bg-[#041226]"
                style={{
                    backgroundImage: `url('/login-bg.jpg')`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'right 30% center',
                }}
            >
                {/* ── SOLID-TO-TRANSPARENT BACKDROP OVERLAY ──
                    Guarantees 100% solid, crisp dark navy behind all left text (zero background bleed/artifacts),
                    while smoothly revealing the real pharmacy dispensary & pharmacists in the center-right. ── */}
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        background: 'linear-gradient(to right, #041226 0%, #041226 38%, rgba(4, 18, 38, 0.75) 55%, rgba(4, 18, 38, 0.15) 80%, rgba(4, 18, 38, 0.4) 100%)',
                    }}
                />

                {/* ── LEFT HERO BRANDING (Crystal Clear Vector Typography) ── */}
                <div className="hidden lg:flex flex-col justify-center max-w-[500px] xl:max-w-[540px] relative z-10 text-white space-y-3 py-1 select-none">
                    {/* Logo & Brand Pill — Explicit fixed size so it never balloons */}
                    <div className="flex items-center gap-3.5">
                        <div
                            className="rounded-2xl bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-700 flex items-center justify-center shadow-xl shadow-emerald-500/25 p-2.5 shrink-0 border border-emerald-300/40"
                            style={{ width: '54px', height: '54px', minWidth: '54px', minHeight: '54px' }}
                        >
                            <svg style={{ width: '30px', height: '30px' }} className="text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                                <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/>
                                <path d="m8.5 8.5 7 7"/>
                            </svg>
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-2xl xl:text-3xl font-black tracking-tight text-white leading-none">
                                    Alpha<span className="text-[#00E676]">Pharmacy</span>
                                </span>
                            </div>
                            <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest leading-none mt-1">
                                ENTERPRISE POS SYSTEM
                            </div>
                        </div>
                    </div>

                    {/* Headline */}
                    <h1 className="text-3xl xl:text-[38px] font-black text-white leading-tight tracking-tight pt-0.5">
                        Everything You Need<br />
                        <span className="text-white">to Run Your Pharmacy.</span>
                    </h1>

                    {/* Feature Checklist */}
                    <div className="space-y-1.5 pt-0.5">
                        {[
                            'Retail & Community Pharmacy',
                            'Hospital & Clinical Dispensing',
                            'Controlled Substances (DDR)',
                            'SHA/SHIF & Insurance Claims',
                            'And More...',
                        ].map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2.5 text-slate-200 text-sm xl:text-[15px] font-bold">
                                <span className="text-[#00E676] text-base font-black">✓</span>
                                <span>{item}</span>
                            </div>
                        ))}
                    </div>

                    {/* Luminous Cursive Script Accent (Properly spaced, never clips) */}
                    <div className="pt-1">
                        <p className="cursive-highlight text-2xl xl:text-3xl text-[#00E676] font-bold tracking-wide -rotate-1 drop-shadow-[0_2px_10px_rgba(0,230,118,0.45)] leading-tight">
                            Smart Pharmacy... Better Healthcare!
                        </p>
                    </div>

                    {/* Feature Capsule Badges */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                        {[
                            'Dispensing & FEFO',
                            'Prescription Master',
                            'Controlled Drugs DDR',
                            'Cold Chain 2-8°C',
                            'SHA & Insurance',
                            'Cloud Backup',
                        ].map((badge, idx) => (
                            <span
                                key={idx}
                                className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-slate-200 bg-white/10 backdrop-blur-md border border-white/20 shadow-xs hover:border-emerald-400/60 transition-colors"
                            >
                                {badge}
                            </span>
                        ))}
                    </div>
                </div>

                {/* ── RIGHT LOGIN CARD ── */}
                <div className="w-full max-w-[400px] relative z-10 py-1">
                    <div
                        className="w-full bg-white/98 lg:bg-white rounded-2xl p-5 sm:p-6 shadow-2xl relative border-2 border-emerald-400/90 backdrop-blur-xl"
                        style={{
                            boxShadow: '0 25px 65px -12px rgba(0, 0, 0, 0.7), 0 0 35px rgba(16, 185, 129, 0.25)'
                        }}
                    >
                        {/* Top Badge: Shield Icon + Secure Access */}
                        <div className="flex items-center gap-2.5 mb-3">
                            <div className="w-9 h-9 rounded-xl bg-[#091D3E] text-white flex items-center justify-center shadow-md shrink-0">
                                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                            <div>
                                <div className="text-[10px] font-black text-emerald-600 uppercase tracking-wide leading-none">
                                    SECURE ACCESS
                                </div>
                                <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                                    Sign in to your AlphaPharmacy account
                                </div>
                            </div>
                        </div>

                        {/* Heading */}
                        <div className="mb-3.5">
                            {view === 'login' && (
                                <>
                                    <h2 className="text-2xl sm:text-[25px] font-black text-[#091D3E] tracking-tight leading-tight">
                                        Welcome back
                                    </h2>
                                    <p className="text-xs text-slate-500 mt-0.5 font-medium">
                                        Sign in to continue to <span className="font-bold text-[#091D3E]">{pharmacyName.replace(/ /g, '')} POS</span>
                                    </p>
                                </>
                            )}
                            {view === 'forgot' && (
                                <>
                                    <button
                                        onClick={() => { setView('login'); setFpError(''); setFpUsername(''); }}
                                        className="flex items-center gap-1.5 text-slate-400 hover:text-emerald-600 text-xs mb-2 font-semibold transition-colors"
                                    >
                                        ← Back to login
                                    </button>
                                    <h2 className="text-xl font-black text-[#091D3E] tracking-tight">
                                        Forgot Password?
                                    </h2>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Enter your username to verify your account.
                                    </p>
                                </>
                            )}
                            {view === 'sent' && (
                                <div className="text-center py-2">
                                    <div className="text-3xl mb-1.5">💊</div>
                                    <h2 className="text-lg font-black text-[#091D3E]">Account Verified</h2>
                                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                                        Username <span className="font-bold text-emerald-600">{fpUsername}</span> confirmed. Please ask your Head Pharmacist or Super Admin to reset your password or PIN.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* ── LOGIN FORM ── */}
                        {view === 'login' && (
                            <form onSubmit={handleLogin} className="space-y-3">
                                {/* Username */}
                                <div>
                                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1">
                                        <svg className="w-3.5 h-3.5 text-slate-500" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
                                        </svg>
                                        Username
                                    </label>
                                    <div className="relative">
                                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
                                            </svg>
                                        </div>
                                        <input
                                            id="username"
                                            type="text"
                                            value={username}
                                            onChange={e => setUsername(e.target.value)}
                                            placeholder="Enter your username"
                                            autoComplete="username"
                                            className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm font-medium focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/10 outline-none transition-all placeholder:text-slate-400"
                                        />
                                    </div>
                                </div>

                                {/* Password or PIN */}
                                <div>
                                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1">
                                        <svg className="w-3.5 h-3.5 text-slate-500" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
                                        </svg>
                                        Password or PIN
                                    </label>
                                    <div className="relative">
                                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
                                            </svg>
                                        </div>
                                        <input
                                            id="password"
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                            placeholder="Enter your password or PIN"
                                            autoComplete="current-password"
                                            className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm font-medium focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/10 outline-none transition-all placeholder:text-slate-400"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-0.5"
                                        >
                                            {showPassword ? (
                                                <svg style={{width:'18px',height:'18px'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                                                </svg>
                                            ) : (
                                                <svg style={{width:'18px',height:'18px'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Error alert */}
                                {error && (
                                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                                        <svg className="w-3.5 h-3.5 shrink-0 text-rose-500" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                                        </svg>
                                        <span>{error}</span>
                                    </div>
                                )}

                                {/* Forgot Password Link */}
                                <div className="flex justify-between items-center text-xs">
                                    <button
                                        type="button"
                                        onClick={() => setShowHelpModal(true)}
                                        className="text-slate-500 hover:text-slate-700 transition-colors"
                                    >
                                        Need help?
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setView('forgot'); setError(''); }}
                                        className="text-[#1E40AF] hover:text-[#1D4ED8] font-bold hover:underline transition-colors"
                                    >
                                        Forgot password?
                                    </button>
                                </div>

                                {/* Sign In Button (Deep Midnight Navy with clean SVG Arrow) */}
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full py-2.5 rounded-xl text-white font-bold text-sm tracking-wide bg-gradient-to-r from-[#091D3E] via-[#0E2852] to-[#12356B] hover:from-[#0B2349] hover:to-[#174384] active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-900/40 disabled:opacity-60 cursor-pointer"
                                >
                                    {isLoading ? (
                                        <>
                                            <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                                            <span>Signing in...</span>
                                        </>
                                    ) : (
                                        <>
                                            <svg style={{width:'18px',height:'18px',flexShrink:0}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                            </svg>
                                            <span>Sign In</span>
                                        </>
                                    )}
                                </button>

                                {/* Protected Note */}
                                <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 pt-1">
                                    <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                                    </svg>
                                    <span>Your data is protected and secure</span>
                                </div>
                            </form>
                        )}

                        {/* ── FORGOT PASSWORD FORM ── */}
                        {view === 'forgot' && (
                            <form onSubmit={handleForgotPassword} className="space-y-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Your Username</label>
                                    <input
                                        type="text"
                                        value={fpUsername}
                                        onChange={e => setFpUsername(e.target.value)}
                                        placeholder="Enter your username"
                                        autoFocus
                                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm font-medium focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/10 outline-none"
                                    />
                                </div>

                                {fpError && (
                                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                                        {fpError}
                                    </div>
                                )}

                                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 leading-relaxed">
                                    🔒 If you forgot your password or PIN, your Head Pharmacist or Super Admin can reset it immediately in <strong>Administration → Users</strong>.
                                </div>

                                <button
                                    type="submit"
                                    disabled={fpLoading}
                                    className="w-full py-2.5 rounded-xl text-white font-bold text-sm bg-gradient-to-r from-[#091D3E] via-[#0E2852] to-[#12356B] flex items-center justify-center gap-2 shadow-lg disabled:opacity-60"
                                >
                                    {fpLoading ? 'Verifying account...' : '🔍 Verify Username'}
                                </button>
                            </form>
                        )}

                        {/* ── RECOVERY INSTRUCTIONS ── */}
                        {view === 'sent' && (
                            <div className="space-y-2.5 mt-3">
                                <button
                                    onClick={() => { setView('login'); setFpUsername(''); setFpError(''); }}
                                    className="w-full py-2.5 rounded-xl text-white font-bold text-sm bg-gradient-to-r from-[#091D3E] via-[#0E2852] to-[#12356B] shadow-lg"
                                >
                                    ← Back to Login
                                </button>
                            </div>
                        )}

                        {/* Card Bottom Footer */}
                        <div className="pt-2.5 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                            <span>© {new Date().getFullYear()} AlphaPharmacy POS v2.0</span>
                            <div className="flex items-center gap-2">
                                <span className="flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                                    <span className="text-slate-600 font-semibold">Online</span>
                                </span>
                                <span className="text-slate-300">|</span>
                                <span>Enterprise Ready</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════
                BOTTOM FULL-WIDTH FOOTER BAR (MATCHING ALPHARETAIL)
            ═══════════════════════════════════════════════════ */}
            <div
                className="shrink-0 h-10 w-full px-6 lg:px-12 flex items-center justify-between text-xs text-slate-300 relative z-20"
                style={{ background: 'rgba(2, 8, 20, 0.98)', borderTop: '1px solid rgba(30, 58, 138, 0.4)' }}
            >
                <div className="flex items-center gap-5 sm:gap-7 flex-wrap">
                    <div className="flex items-center gap-1.5">
                        <span>🎧</span>
                        <span className="font-semibold text-[11px]">24/7 Support</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span>⚡</span>
                        <span className="font-semibold text-[11px]">High Performance</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span>🛡️</span>
                        <span className="font-semibold text-[11px]">Enterprise Security</span>
                    </div>
                    {/* Live Clock Placed Cleanly In Footer */}
                    <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-slate-700/60 text-emerald-400 font-mono text-[11px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>{currentTime}</span>
                        <span className="text-slate-500">·</span>
                        <span className="text-slate-400 font-sans">{currentDate}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-xs tracking-wide">
                        Alpha<span className="text-[#00E676]">Pharmacy</span>
                    </span>
                    <span className="text-slate-600">|</span>
                    <span className="italic text-[11px] text-slate-400">Retail Smarter. Care Better.</span>
                </div>
            </div>

            {/* ── HELP / DEFAULT CREDENTIALS MODAL ── */}
            {showHelpModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 relative border-2 border-emerald-400/80">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg">
                                🔑
                            </div>
                            <div>
                                <h3 className="font-black text-slate-800 text-base">Pharmacy Login Help</h3>
                                <p className="text-xs text-slate-500">AlphaPharmacy POS credentials</p>
                            </div>
                        </div>
                        <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
                            <p>
                                Staff accounts are managed by your pharmacy administrator. If you forgot your password or are locked out:
                            </p>
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 font-mono text-[11px]">
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Default Admin:</span>
                                    <span className="font-bold text-slate-800">admin</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Default PIN:</span>
                                    <span className="font-bold text-slate-800">1234</span>
                                </div>
                            </div>
                            <p className="text-[11px] text-slate-500">
                                You can update credentials anytime in <strong>Administration → Users</strong> after signing in.
                            </p>
                        </div>
                        <button
                            onClick={() => setShowHelpModal(false)}
                            className="mt-4 w-full py-2.5 bg-gradient-to-r from-[#091D3E] to-[#12356B] text-white rounded-xl font-bold text-xs shadow-md"
                        >
                            Got It
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
