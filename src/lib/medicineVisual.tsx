'use client';

import React from 'react';

interface MedicineVisualProps {
    name?: string;
    category?: string;
    drugType?: string;
    genericName?: string;
    className?: string;
}

export function MedicineVisual({
    name = '',
    category = '',
    drugType = '',
    genericName = '',
    className = 'w-16 h-12',
}: MedicineVisualProps) {
    const text = `${name} ${category} ${drugType} ${genericName}`.toLowerCase();

    // 1. Specific matches based on Alpha Pharmacy inventory
    if (text.includes('amoxicillin suspension') || (text.includes('suspension') && text.includes('amox'))) {
        return <SyrupBottle className={className} liquidColor="#3B82F6" labelText="Amoxicillin" />;
    }
    if (text.includes('amoxicillin') || text.includes('ciprofloxacin')) {
        return <CapsuleRedWhite className={className} />;
    }
    if (text.includes('antifungal')) {
        return <YellowTablets className={className} />;
    }
    if (text.includes('artificial tears') || text.includes('chloramphenicol') || text.includes('eye care') || text.includes('eye drop')) {
        return <DropperBottle className={className} capColor="#0284C7" />;
    }
    if (text.includes('azithromycin')) {
        return <PinkTablets className={className} />;
    }
    if (text.includes('baby diaper') || text.includes('diaper')) {
        return <WhiteTablets className={className} labelText="Care" />;
    }
    if (text.includes('baby lotion') || (text.includes('lotion') && text.includes('baby'))) {
        return <PumpBottleBlue className={className} />;
    }
    if (text.includes('bactifix')) {
        return <MedicineBox className={className} title="BACTIFIX" />;
    }
    if (text.includes('betadine') || text.includes('ointment')) {
        return <OintmentTube className={className} />;
    }
    if (text.includes('calamine') || text.includes('skin care')) {
        return <PumpBottlePink className={className} />;
    }
    if (text.includes('calcium') || text.includes('vitamin') || text.includes('d3') || text.includes('supplement')) {
        return <SupplementJar className={className} />;
    }
    if (text.includes('ceftriaxone') || text.includes('injection') || text.includes(' iv')) {
        return <InjectionVial className={className} />;
    }
    if (text.includes('cetirizine') || text.includes('blister') || text.includes('antihistamine')) {
        return <BlisterPack className={className} />;
    }

    // 2. Form/Type fallbacks
    if (text.includes('syrup') || text.includes('suspension') || text.includes('liquid') || text.includes('mixture')) {
        return <SyrupBottle className={className} liquidColor="#F59E0B" labelText="Syrup" />;
    }
    if (text.includes('cream') || text.includes('gel')) {
        return <OintmentTube className={className} capColor="#10B981" />;
    }
    if (text.includes('capsule') || text.includes('cap')) {
        return <CapsuleGreenWhite className={className} />;
    }
    if (text.includes('drops') || text.includes('ear')) {
        return <DropperBottle className={className} capColor="#059669" />;
    }
    if (text.includes('iv') || text.includes('vial') || text.includes('ampoule')) {
        return <InjectionVial className={className} />;
    }
    if (text.includes('lotion')) {
        return <PumpBottleBlue className={className} />;
    }
    if (text.includes('powder')) {
        return <YellowTablets className={className} />;
    }

    // 3. Deterministic hash fallback to distribute visuals evenly
    let hash = 0;
    for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    const variant = hash % 6;

    switch (variant) {
        case 0: return <CapsuleRedWhite className={className} />;
        case 1: return <CapsuleBlueWhite className={className} />;
        case 2: return <YellowTablets className={className} />;
        case 3: return <PinkTablets className={className} />;
        case 4: return <BlisterPack className={className} />;
        default: return <CapsuleGreenWhite className={className} />;
    }
}

/* ─────────────────────────────────────────────────────────────
   Realistic SVG Medicine Components
   Matching Image 1 (Target Reference)
────────────────────────────────────────────────────────────── */

export function CapsuleRedWhite({ className = 'w-16 h-12' }: { className?: string }) {
    return (
        <svg viewBox="0 0 100 60" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="capRed" x1="20" y1="12" x2="52" y2="48" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#FF4B4B" />
                    <stop offset="60%" stopColor="#E01B24" />
                    <stop offset="100%" stopColor="#9C0A12" />
                </linearGradient>
                <linearGradient id="capWhite" x1="48" y1="12" x2="80" y2="48" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#FFFFFF" />
                    <stop offset="70%" stopColor="#E2E8F0" />
                    <stop offset="100%" stopColor="#CBD5E1" />
                </linearGradient>
                <linearGradient id="capShine" x1="20" y1="14" x2="80" y2="14" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="white" stopOpacity="0.8" />
                    <stop offset="50%" stopColor="white" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="white" stopOpacity="0" />
                </linearGradient>
                <filter id="capShadow" x="10" y="36" width="80" height="20" filterUnits="userSpaceOnUse">
                    <feGaussianBlur stdDeviation="3" />
                </filter>
            </defs>
            {/* Shadow */}
            <ellipse cx="50" cy="46" rx="34" ry="6" fill="#000000" fillOpacity="0.18" filter="url(#capShadow)" />
            {/* Capsule Body with transform angle */}
            <g transform="rotate(-22 50 30)">
                {/* Red Half (Left) */}
                <path d="M26 20C20.4772 20 16 24.4772 16 30C16 35.5228 20.4772 40 26 40H50V20H26Z" fill="url(#capRed)" />
                {/* White Half (Right) */}
                <path d="M50 20H74C79.5228 20 84 24.4772 84 30C84 35.5228 79.5228 40 74 40H50V20Z" fill="url(#capWhite)" />
                {/* Seam Line */}
                <line x1="50" y1="19.5" x2="50" y2="40.5" stroke="#71717A" strokeWidth="0.8" strokeOpacity="0.4" />
                {/* Top Gloss Highlight */}
                <path d="M24 23C20 23 19 25 19 27C19 26 22 23.5 28 23.5H72C78 23.5 81 26 81 27C81 25 80 23 76 23H24Z" fill="url(#capShine)" />
            </g>
        </svg>
    );
}

export function CapsuleBlueWhite({ className = 'w-16 h-12' }: { className?: string }) {
    return (
        <svg viewBox="0 0 100 60" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="capBlue" x1="20" y1="12" x2="52" y2="48" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#38BDF8" />
                    <stop offset="60%" stopColor="#0284C7" />
                    <stop offset="100%" stopColor="#0369A1" />
                </linearGradient>
                <linearGradient id="capWhiteB" x1="48" y1="12" x2="80" y2="48" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#FFFFFF" />
                    <stop offset="70%" stopColor="#E2E8F0" />
                    <stop offset="100%" stopColor="#CBD5E1" />
                </linearGradient>
                <linearGradient id="capShineB" x1="20" y1="14" x2="80" y2="14" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="white" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="white" stopOpacity="0.1" />
                </linearGradient>
            </defs>
            <ellipse cx="50" cy="46" rx="34" ry="6" fill="#000000" fillOpacity="0.16" />
            <g transform="rotate(-22 50 30)">
                <path d="M26 20C20.4772 20 16 24.4772 16 30C16 35.5228 20.4772 40 26 40H50V20H26Z" fill="url(#capBlue)" />
                <path d="M50 20H74C79.5228 20 84 24.4772 84 30C84 35.5228 79.5228 40 74 40H50V20Z" fill="url(#capWhiteB)" />
                <line x1="50" y1="19.5" x2="50" y2="40.5" stroke="#0369A1" strokeWidth="0.8" strokeOpacity="0.3" />
                <path d="M24 23C20 23 19 25 19 27C19 26 22 23.5 28 23.5H72C78 23.5 81 26 81 27C81 25 80 23 76 23H24Z" fill="url(#capShineB)" />
            </g>
        </svg>
    );
}

export function CapsuleGreenWhite({ className = 'w-16 h-12' }: { className?: string }) {
    return (
        <svg viewBox="0 0 100 60" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="capGreen" x1="20" y1="12" x2="52" y2="48" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#34D399" />
                    <stop offset="60%" stopColor="#059669" />
                    <stop offset="100%" stopColor="#065F46" />
                </linearGradient>
                <linearGradient id="capWhiteG" x1="48" y1="12" x2="80" y2="48" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#FFFFFF" />
                    <stop offset="70%" stopColor="#F1F5F9" />
                    <stop offset="100%" stopColor="#CBD5E1" />
                </linearGradient>
            </defs>
            <ellipse cx="50" cy="46" rx="34" ry="6" fill="#000000" fillOpacity="0.16" />
            <g transform="rotate(-22 50 30)">
                <path d="M26 20C20.4772 20 16 24.4772 16 30C16 35.5228 20.4772 40 26 40H50V20H26Z" fill="url(#capGreen)" />
                <path d="M50 20H74C79.5228 20 84 24.4772 84 30C84 35.5228 79.5228 40 74 40H50V20Z" fill="url(#capWhiteG)" />
                <line x1="50" y1="19.5" x2="50" y2="40.5" stroke="#065F46" strokeWidth="0.8" strokeOpacity="0.3" />
                <path d="M24 23C20 23 19 25 19 27C19 26 22 23.5 28 23.5H72C78 23.5 81 26 81 27C81 25 80 23 76 23H24Z" fill="white" fillOpacity="0.75" />
            </g>
        </svg>
    );
}

export function YellowTablets({ className = 'w-16 h-12' }: { className?: string }) {
    return (
        <svg viewBox="0 0 100 60" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="tabYellow" x1="30" y1="18" x2="70" y2="46" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#FDE047" />
                    <stop offset="50%" stopColor="#EAB308" />
                    <stop offset="100%" stopColor="#CA8A04" />
                </linearGradient>
            </defs>
            {/* Tablet 1 (Left) */}
            <ellipse cx="32" cy="38" rx="15" ry="9" fill="#000000" fillOpacity="0.14" />
            <g transform="translate(18, 22)">
                <ellipse cx="14" cy="12" rx="14" ry="7" fill="#A16207" />
                <ellipse cx="14" cy="9" rx="14" ry="7" fill="url(#tabYellow)" />
                <line x1="7" y1="8" x2="21" y2="10" stroke="#CA8A04" strokeWidth="0.9" />
                <ellipse cx="14" cy="7" rx="9" ry="3" fill="white" fillOpacity="0.3" />
            </g>
            {/* Tablet 2 (Right) */}
            <ellipse cx="68" cy="38" rx="15" ry="9" fill="#000000" fillOpacity="0.14" />
            <g transform="translate(54, 22)">
                <ellipse cx="14" cy="12" rx="14" ry="7" fill="#A16207" />
                <ellipse cx="14" cy="9" rx="14" ry="7" fill="url(#tabYellow)" />
                <line x1="7" y1="8" x2="21" y2="10" stroke="#CA8A04" strokeWidth="0.9" />
                <ellipse cx="14" cy="7" rx="9" ry="3" fill="white" fillOpacity="0.3" />
            </g>
            {/* Tablet 3 (Center Top) */}
            <ellipse cx="50" cy="30" rx="16" ry="9" fill="#000000" fillOpacity="0.18" />
            <g transform="translate(35, 12)">
                <ellipse cx="15" cy="13" rx="15" ry="8" fill="#A16207" />
                <ellipse cx="15" cy="10" rx="15" ry="8" fill="url(#tabYellow)" />
                <line x1="8" y1="9" x2="22" y2="11" stroke="#CA8A04" strokeWidth="1" />
                <ellipse cx="15" cy="7.5" rx="10" ry="3.5" fill="white" fillOpacity="0.4" />
            </g>
        </svg>
    );
}

export function PinkTablets({ className = 'w-16 h-12' }: { className?: string }) {
    return (
        <svg viewBox="0 0 100 60" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="tabPink" x1="30" y1="18" x2="70" y2="46" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#F472B6" />
                    <stop offset="50%" stopColor="#EC4899" />
                    <stop offset="100%" stopColor="#DB2777" />
                </linearGradient>
            </defs>
            <ellipse cx="32" cy="38" rx="15" ry="9" fill="#000000" fillOpacity="0.14" />
            <g transform="translate(18, 22)">
                <ellipse cx="14" cy="12" rx="14" ry="7" fill="#9D174D" />
                <ellipse cx="14" cy="9" rx="14" ry="7" fill="url(#tabPink)" />
                <line x1="7" y1="8" x2="21" y2="10" stroke="#BE185D" strokeWidth="0.9" />
                <ellipse cx="14" cy="7" rx="9" ry="3" fill="white" fillOpacity="0.35" />
            </g>
            <ellipse cx="68" cy="38" rx="15" ry="9" fill="#000000" fillOpacity="0.14" />
            <g transform="translate(54, 22)">
                <ellipse cx="14" cy="12" rx="14" ry="7" fill="#9D174D" />
                <ellipse cx="14" cy="9" rx="14" ry="7" fill="url(#tabPink)" />
                <line x1="7" y1="8" x2="21" y2="10" stroke="#BE185D" strokeWidth="0.9" />
                <ellipse cx="14" cy="7" rx="9" ry="3" fill="white" fillOpacity="0.35" />
            </g>
            <ellipse cx="50" cy="30" rx="16" ry="9" fill="#000000" fillOpacity="0.18" />
            <g transform="translate(35, 12)">
                <ellipse cx="15" cy="13" rx="15" ry="8" fill="#9D174D" />
                <ellipse cx="15" cy="10" rx="15" ry="8" fill="url(#tabPink)" />
                <line x1="8" y1="9" x2="22" y2="11" stroke="#BE185D" strokeWidth="1" />
                <ellipse cx="15" cy="7.5" rx="10" ry="3.5" fill="white" fillOpacity="0.4" />
            </g>
        </svg>
    );
}

export function WhiteTablets({ className = 'w-16 h-12', labelText }: { className?: string; labelText?: string }) {
    return (
        <svg viewBox="0 0 100 60" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="tabWhite" x1="30" y1="18" x2="70" y2="46" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#FFFFFF" />
                    <stop offset="60%" stopColor="#F1F5F9" />
                    <stop offset="100%" stopColor="#CBD5E1" />
                </linearGradient>
            </defs>
            <ellipse cx="32" cy="38" rx="15" ry="9" fill="#000000" fillOpacity="0.12" />
            <g transform="translate(18, 22)">
                <ellipse cx="14" cy="12" rx="14" ry="7" fill="#94A3B8" />
                <ellipse cx="14" cy="9" rx="14" ry="7" fill="url(#tabWhite)" />
                <line x1="7" y1="8" x2="21" y2="10" stroke="#94A3B8" strokeWidth="0.8" />
            </g>
            <ellipse cx="68" cy="38" rx="15" ry="9" fill="#000000" fillOpacity="0.12" />
            <g transform="translate(54, 22)">
                <ellipse cx="14" cy="12" rx="14" ry="7" fill="#94A3B8" />
                <ellipse cx="14" cy="9" rx="14" ry="7" fill="url(#tabWhite)" />
                <line x1="7" y1="8" x2="21" y2="10" stroke="#94A3B8" strokeWidth="0.8" />
            </g>
            <ellipse cx="50" cy="30" rx="16" ry="9" fill="#000000" fillOpacity="0.16" />
            <g transform="translate(35, 12)">
                <ellipse cx="15" cy="13" rx="15" ry="8" fill="#94A3B8" />
                <ellipse cx="15" cy="10" rx="15" ry="8" fill="url(#tabWhite)" />
                <line x1="8" y1="9" x2="22" y2="11" stroke="#94A3B8" strokeWidth="0.9" />
                <ellipse cx="15" cy="7.5" rx="10" ry="3.5" fill="white" fillOpacity="0.6" />
            </g>
        </svg>
    );
}

export function BlisterPack({ className = 'w-16 h-12' }: { className?: string }) {
    return (
        <svg viewBox="0 0 100 60" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="foilGrad" x1="15" y1="10" x2="85" y2="50" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#E2E8F0" />
                    <stop offset="35%" stopColor="#CBD5E1" />
                    <stop offset="70%" stopColor="#94A3B8" />
                    <stop offset="100%" stopColor="#CBD5E1" />
                </linearGradient>
                <linearGradient id="blisterBubble" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#FFFFFF" />
                    <stop offset="50%" stopColor="#E2E8F0" />
                    <stop offset="100%" stopColor="#64748B" />
                </linearGradient>
            </defs>
            <rect x="22" y="12" width="56" height="38" rx="4" fill="#000000" fillOpacity="0.18" />
            {/* Foil Base Plate */}
            <rect x="20" y="10" width="60" height="38" rx="4" fill="url(#foilGrad)" stroke="#94A3B8" strokeWidth="0.8" />
            {/* Embossed grid dots */}
            <line x1="20" y1="29" x2="80" y2="29" stroke="#64748B" strokeWidth="0.5" strokeDasharray="1.5 1.5" />
            <line x1="35" y1="10" x2="35" y2="48" stroke="#64748B" strokeWidth="0.5" strokeDasharray="1.5 1.5" />
            <line x1="50" y1="10" x2="50" y2="48" stroke="#64748B" strokeWidth="0.5" strokeDasharray="1.5 1.5" />
            <line x1="65" y1="10" x2="65" y2="48" stroke="#64748B" strokeWidth="0.5" strokeDasharray="1.5 1.5" />
            {/* Blister Pockets (2 rows x 4) */}
            {[27, 42, 57, 72].map((cx, i) => (
                <React.Fragment key={i}>
                    <ellipse cx={cx} cy={19.5} rx="5.2" ry="4.5" fill="url(#blisterBubble)" stroke="#475569" strokeWidth="0.5" />
                    <ellipse cx={cx - 1} cy={18} rx="2" ry="1.2" fill="white" fillOpacity="0.75" />
                    <ellipse cx={cx} cy={38.5} rx="5.2" ry="4.5" fill="url(#blisterBubble)" stroke="#475569" strokeWidth="0.5" />
                    <ellipse cx={cx - 1} cy={37} rx="2" ry="1.2" fill="white" fillOpacity="0.75" />
                </React.Fragment>
            ))}
        </svg>
    );
}

export function OintmentTube({ className = 'w-16 h-12', capColor = '#0284C7' }: { className?: string; capColor?: string }) {
    return (
        <svg viewBox="0 0 100 60" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="tubeGrad" x1="20" y1="20" x2="75" y2="38" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#FFFFFF" />
                    <stop offset="40%" stopColor="#F1F5F9" />
                    <stop offset="80%" stopColor="#CBD5E1" />
                    <stop offset="100%" stopColor="#94A3B8" />
                </linearGradient>
            </defs>
            <ellipse cx="50" cy="42" rx="36" ry="5" fill="#000000" fillOpacity="0.16" />
            {/* Crimped End (Left) */}
            <path d="M16 26L18 25V35L16 34Z" fill="#64748B" />
            {/* Main Tube Body */}
            <path d="M18 25L68 22C72 22 75 25 75 30C75 35 72 38 68 38L18 35Z" fill="url(#tubeGrad)" stroke="#94A3B8" strokeWidth="0.7" />
            {/* Blue Label Stripe */}
            <path d="M35 24L58 23V37L35 36Z" fill="#0284C7" />
            <line x1="38" y1="30" x2="55" y2="30" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
            {/* Ribbed Screw Cap (Right) */}
            <rect x="75" y="24" width="9" height="12" rx="1.5" fill={capColor} stroke="#0369A1" strokeWidth="0.8" />
            <line x1="77" y1="25" x2="77" y2="35" stroke="white" strokeWidth="0.6" strokeOpacity="0.5" />
            <line x1="80" y1="25" x2="80" y2="35" stroke="white" strokeWidth="0.6" strokeOpacity="0.5" />
        </svg>
    );
}

export function PumpBottleBlue({ className = 'w-16 h-12' }: { className?: string }) {
    return (
        <svg viewBox="0 0 100 60" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="pumpBody" x1="40" y1="18" x2="60" y2="52" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#7DD3FC" />
                    <stop offset="50%" stopColor="#0284C7" />
                    <stop offset="100%" stopColor="#0369A1" />
                </linearGradient>
            </defs>
            <ellipse cx="50" cy="51" rx="16" ry="4" fill="#000000" fillOpacity="0.18" />
            {/* Bottle Body */}
            <rect x="38" y="22" width="24" height="28" rx="6" fill="url(#pumpBody)" />
            {/* Label */}
            <rect x="42" y="28" width="16" height="16" rx="2" fill="white" />
            <circle cx="50" cy="34" r="3" fill="#38BDF8" />
            <line x1="45" y1="40" x2="55" y2="40" stroke="#0284C7" strokeWidth="0.8" />
            {/* Bottle Neck */}
            <rect x="47" y="17" width="6" height="5" fill="#E2E8F0" />
            {/* Pump Head */}
            <path d="M46 14H56V17H46V14Z" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="0.6" />
            <path d="M48 14V9H54V14H48Z" fill="#F8FAFC" />
            {/* Spout */}
            <path d="M44 9H55C56 9 57 9.5 57 10.5V11.5H39V10.5C39 9.5 40 9 44 9Z" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="0.6" />
        </svg>
    );
}

export function PumpBottlePink({ className = 'w-16 h-12' }: { className?: string }) {
    return (
        <svg viewBox="0 0 100 60" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="pumpBodyPink" x1="40" y1="18" x2="60" y2="52" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#F472B6" />
                    <stop offset="50%" stopColor="#EC4899" />
                    <stop offset="100%" stopColor="#BE185D" />
                </linearGradient>
            </defs>
            <ellipse cx="50" cy="51" rx="16" ry="4" fill="#000000" fillOpacity="0.18" />
            <rect x="38" y="22" width="24" height="28" rx="6" fill="url(#pumpBodyPink)" />
            <rect x="42" y="28" width="16" height="16" rx="2" fill="white" />
            <line x1="44" y1="33" x2="56" y2="33" stroke="#DB2777" strokeWidth="1" strokeLinecap="round" />
            <line x1="44" y1="38" x2="54" y2="38" stroke="#94A3B8" strokeWidth="0.8" />
            <rect x="47" y="17" width="6" height="5" fill="#E2E8F0" />
            <path d="M46 14H56V17H46V14Z" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="0.6" />
            <path d="M44 9H55C56 9 57 9.5 57 10.5V11.5H39V10.5C39 9.5 40 9 44 9Z" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="0.6" />
        </svg>
    );
}

export function MedicineBox({ className = 'w-16 h-12', title = 'BACTIFIX' }: { className?: string; title?: string }) {
    return (
        <svg viewBox="0 0 100 60" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="50" cy="48" rx="32" ry="5" fill="#000000" fillOpacity="0.18" />
            {/* 3D Box - Front Face */}
            <path d="M22 22L72 20V44L22 46V22Z" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="0.8" />
            {/* Green accent stripe */}
            <path d="M22 27L72 25V33L22 35V27Z" fill="#10B981" />
            {/* Box Typography */}
            <text x="25" y="32" fill="white" fontSize="4.5" fontWeight="bold" fontFamily="sans-serif">
                {title.slice(0, 9)}
            </text>
            <text x="25" y="41" fill="#475569" fontSize="3" fontWeight="bold" fontFamily="sans-serif">
                TABS USP • 500mg
            </text>
            {/* Medical Cross Icon */}
            <rect x="62" y="37" width="5" height="5" fill="#E2E8F0" rx="1" />
            <path d="M64.5 38.5V40.5M63.5 39.5H65.5" stroke="#10B981" strokeWidth="0.8" strokeLinecap="round" />
            {/* 3D Box - Top Face */}
            <path d="M22 22L36 14L86 12L72 20L22 22Z" fill="#F1F5F9" stroke="#CBD5E1" strokeWidth="0.8" />
            {/* 3D Box - Right Face */}
            <path d="M72 20L86 12V36L72 44V20Z" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="0.8" />
        </svg>
    );
}

export function DropperBottle({ className = 'w-16 h-12', capColor = '#0284C7' }: { className?: string; capColor?: string }) {
    return (
        <svg viewBox="0 0 100 60" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="dropBody" x1="40" y1="24" x2="60" y2="52" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#FFFFFF" />
                    <stop offset="70%" stopColor="#F1F5F9" />
                    <stop offset="100%" stopColor="#CBD5E1" />
                </linearGradient>
            </defs>
            <ellipse cx="50" cy="51" rx="14" ry="4" fill="#000000" fillOpacity="0.18" />
            {/* Dropper Tip (Top) */}
            <path d="M48 10C48 9 52 9 52 10V16H48V10Z" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="0.6" />
            {/* Cap */}
            <rect x="44" y="16" width="12" height="12" rx="2" fill={capColor} stroke="#0369A1" strokeWidth="0.7" />
            <line x1="47" y1="17" x2="47" y2="27" stroke="white" strokeWidth="0.6" strokeOpacity="0.5" />
            <line x1="50" y1="17" x2="50" y2="27" stroke="white" strokeWidth="0.6" strokeOpacity="0.5" />
            <line x1="53" y1="17" x2="53" y2="27" stroke="white" strokeWidth="0.6" strokeOpacity="0.5" />
            {/* Bottle Body */}
            <path d="M42 28H58C61 28 62 31 62 34V47C62 50 60 51 57 51H43C40 51 38 50 38 47V34C38 31 39 28 42 28Z" fill="url(#dropBody)" stroke="#94A3B8" strokeWidth="0.8" />
            {/* Eye Care Label */}
            <rect x="42" y="34" width="16" height="12" rx="1.5" fill="#E0F2FE" />
            <circle cx="50" cy="40" r="2.5" fill="#0284C7" />
            <line x1="46" y1="44" x2="54" y2="44" stroke="#0369A1" strokeWidth="0.6" />
        </svg>
    );
}

export function InjectionVial({ className = 'w-16 h-12' }: { className?: string }) {
    return (
        <svg viewBox="0 0 100 60" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="vialGlass" x1="40" y1="22" x2="60" y2="52" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
                    <stop offset="60%" stopColor="#F8FAFC" stopOpacity="0.75" />
                    <stop offset="100%" stopColor="#E2E8F0" stopOpacity="0.9" />
                </linearGradient>
            </defs>
            <ellipse cx="50" cy="51" rx="14" ry="4" fill="#000000" fillOpacity="0.18" />
            {/* Rubber Stopper & Crimp Collar */}
            <rect x="44" y="11" width="12" height="4" rx="1" fill="#475569" />
            <rect x="43" y="15" width="14" height="5" rx="1.5" fill="#3B82F6" stroke="#1D4ED8" strokeWidth="0.6" />
            {/* Glass Neck */}
            <rect x="46" y="20" width="8" height="4" fill="#E2E8F0" />
            {/* Vial Glass Body */}
            <path d="M40 24H60C62 24 63 26 63 29V47C63 50 61 51 58 51H42C39 51 37 50 37 47V29C37 26 38 24 40 24Z" fill="url(#vialGlass)" stroke="#94A3B8" strokeWidth="0.8" />
            {/* Liquid / Powder Inside */}
            <path d="M38.5 35H61.5V47C61.5 49.5 59.5 50.5 57.5 50.5H42.5C40.5 50.5 38.5 49.5 38.5 47V35Z" fill="#EFF6FF" fillOpacity="0.85" />
            {/* Pharmaceutical Label */}
            <rect x="41" y="29" width="18" height="15" rx="1.5" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="0.5" />
            <text x="43" y="35" fill="#1E3A8A" fontSize="3" fontWeight="bold" fontFamily="sans-serif">
                CEFTRI
            </text>
            <text x="43" y="39" fill="#DC2626" fontSize="2.5" fontWeight="bold" fontFamily="sans-serif">
                1g IV/IM
            </text>
            <line x1="43" y1="42" x2="57" y2="42" stroke="#64748B" strokeWidth="0.5" />
        </svg>
    );
}

export function SupplementJar({ className = 'w-16 h-12' }: { className?: string }) {
    return (
        <svg viewBox="0 0 100 60" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="50" cy="51" rx="18" ry="4" fill="#000000" fillOpacity="0.18" />
            {/* White Ribbed Cap */}
            <rect x="38" y="14" width="24" height="8" rx="2" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="0.8" />
            <line x1="42" y1="15" x2="42" y2="21" stroke="#CBD5E1" strokeWidth="0.8" />
            <line x1="46" y1="15" x2="46" y2="21" stroke="#CBD5E1" strokeWidth="0.8" />
            <line x1="50" y1="15" x2="50" y2="21" stroke="#CBD5E1" strokeWidth="0.8" />
            <line x1="54" y1="15" x2="54" y2="21" stroke="#CBD5E1" strokeWidth="0.8" />
            <line x1="58" y1="15" x2="58" y2="21" stroke="#CBD5E1" strokeWidth="0.8" />
            {/* Bottle Body */}
            <rect x="34" y="22" width="32" height="28" rx="4" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="0.8" />
            {/* Blue Label */}
            <rect x="35" y="26" width="30" height="18" rx="2" fill="#0284C7" />
            <circle cx="50" cy="33" r="3.5" fill="#38BDF8" />
            <text x="43" y="42" fill="white" fontSize="2.8" fontWeight="bold" fontFamily="sans-serif">
                CALCIUM+D3
            </text>
        </svg>
    );
}

export function SyrupBottle({ className = 'w-16 h-12', liquidColor = '#F59E0B', labelText = 'Syrup' }: { className?: string; liquidColor?: string; labelText?: string }) {
    return (
        <svg viewBox="0 0 100 60" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="50" cy="51" rx="16" ry="4" fill="#000000" fillOpacity="0.18" />
            {/* Measuring Cap (White) */}
            <path d="M44 12H56L55 18H45L44 12Z" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="0.6" />
            {/* Screw Neck */}
            <rect x="46" y="18" width="8" height="4" fill="#E2E8F0" />
            {/* Amber Glass Body */}
            <rect x="38" y="22" width="24" height="28" rx="5" fill="#78350F" fillOpacity="0.85" stroke="#451A03" strokeWidth="0.8" />
            {/* Liquid Level */}
            <rect x="39" y="30" width="22" height="19" rx="3" fill={liquidColor} fillOpacity="0.8" />
            {/* White Label */}
            <rect x="41" y="29" width="18" height="14" rx="1" fill="#FFFFFF" />
            <text x="43" y="37" fill="#78350F" fontSize="3" fontWeight="bold" fontFamily="sans-serif">
                {labelText.slice(0, 6)}
            </text>
            <line x1="43" y1="40" x2="55" y2="40" stroke="#DC2626" strokeWidth="0.6" />
        </svg>
    );
}


/* ─────────────────────────────────────────────────────────────
   Sidebar Decorative Artwork (Green capsule on fresh leaves)
   Matching bottom left sidebar of Image 1
────────────────────────────────────────────────────────────── */
export function SidebarPillArtwork({ className = 'w-full h-16' }: { className?: string }) {
    return (
        <div className={`relative flex items-center justify-center overflow-hidden py-1 ${className}`}>
            <svg viewBox="0 0 160 54" className="w-full h-full max-h-14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <radialGradient id="pillGlow" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#10B981" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                    </radialGradient>
                    <linearGradient id="artGreen" x1="45" y1="18" x2="70" y2="38" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#34D399" />
                        <stop offset="50%" stopColor="#059669" />
                        <stop offset="100%" stopColor="#024E32" />
                    </linearGradient>
                    <linearGradient id="artWhite" x1="70" y1="18" x2="95" y2="38" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#FFFFFF" />
                        <stop offset="60%" stopColor="#E2E8F0" />
                        <stop offset="100%" stopColor="#94A3B8" />
                    </linearGradient>
                    <linearGradient id="leafGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#34D399" />
                        <stop offset="100%" stopColor="#047857" />
                    </linearGradient>
                </defs>
                {/* Ambient Glow */}
                <ellipse cx="80" cy="28" rx="60" ry="22" fill="url(#pillGlow)" />
                {/* Left Leaf */}
                <path d="M42 38C34 32 30 20 40 14C48 10 58 18 54 30C52 35 48 37 42 38Z" fill="url(#leafGrad)" fillOpacity="0.85" />
                <path d="M38 18C44 22 48 26 50 32" stroke="#A7F3D0" strokeWidth="0.8" strokeLinecap="round" />
                {/* Right Leaf */}
                <path d="M118 36C126 30 130 18 120 12C112 8 102 16 106 28C108 33 112 35 118 36Z" fill="url(#leafGrad)" fillOpacity="0.85" />
                <path d="M122 16C116 20 112 24 110 30" stroke="#A7F3D0" strokeWidth="0.8" strokeLinecap="round" />
                {/* Soft Pill Shadow */}
                <ellipse cx="80" cy="38" rx="28" ry="5" fill="#000000" fillOpacity="0.4" />
                {/* 3D Glossy Capsule */}
                <g transform="rotate(-15 80 27)">
                    <path d="M54 20C49 20 45 24 45 29C45 34 49 38 54 38H76V20H54Z" fill="url(#artWhite)" />
                    <path d="M76 20H98C103 20 107 24 107 29C107 34 103 38 98 38H76V20Z" fill="url(#artGreen)" />
                    <line x1="76" y1="19.5" x2="76" y2="38.5" stroke="#047857" strokeWidth="0.8" />
                    <path d="M52 22C49 22 47 24 47 26C47 25 50 22.5 56 22.5H96C102 22.5 105 25 105 26C105 24 103 22 99 22H52Z" fill="white" fillOpacity="0.8" />
                </g>
            </svg>
        </div>
    );
}
