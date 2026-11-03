'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { SettingsProvider, useCompanyName } from '@/context/SettingsContext';
import { OutletProvider, useOutlet } from '@/context/OutletContext';
import { logActivity } from '@/lib/supabase';

/* ─── SVG Icon Library ───────────────────────────────────────────── */
const IC = {
  Home: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  Pill: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>
    </svg>
  ),
  Tag: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><path d="M7 7h.01"/>
    </svg>
  ),
  Cart: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>
    </svg>
  ),
  Layers: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
    </svg>
  ),
  Card: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect width="22" height="16" x="1" y="4" rx="2" ry="2"/><line x1="1" x2="23" y1="10" y2="10"/>
    </svg>
  ),
  Users: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  Chart: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/>
    </svg>
  ),
  Shield: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  // small sub-item icons
  Monitor: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>
    </svg>
  ),
  Clock: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  Box: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>
    </svg>
  ),
  File: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/>
    </svg>
  ),
  Refresh: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>
    </svg>
  ),
  Warning: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>
    </svg>
  ),
  Dollar: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  ),
  UserPlus: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/>
    </svg>
  ),
  Trend: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
    </svg>
  ),
  Gear: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  Pin: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
    </svg>
  ),
  Scroll: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  Building: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>
    </svg>
  ),
  Ruler: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.3 8.7 8.7 21.3c-1 1-2.5 1-3.4 0l-2.6-2.6c-1-1-1-2.5 0-3.4L15.3 2.7c1-1 2.5-1 3.4 0l2.6 2.6c1 1 1 2.5 0 3.4Z"/><path d="m7.5 10.5 2 2"/><path d="m10.5 7.5 2 2"/><path d="m13.5 4.5 2 2"/><path d="m4.5 13.5 2 2"/>
    </svg>
  ),
  ChevronDown: ({ rotated }: { rotated?: boolean }) => (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: rotated ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
    >
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  ),
  ChevronLeft: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  ),
  ChevronRight: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  ),
  LogOut: () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>
    </svg>
  ),
  Bell: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  /* ── New Pharmacy Premium Icons ── */
  Heart: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
    </svg>
  ),
  HeartPulse: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
      <path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/>
    </svg>
  ),
  Clipboard: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
      <path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>
    </svg>
  ),
  ShieldLock: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><rect x="9" y="10" width="6" height="5" rx="1"/><path d="M10 10V8a2 2 0 1 1 4 0v2"/>
    </svg>
  ),
  ShieldCheck: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>
    </svg>
  ),
  Star: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  Beaker: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 3h15"/><path d="M6 3v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V3"/><path d="M6 14h12"/>
    </svg>
  ),
  ClipboardCheck: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
      <path d="m9 14 2 2 4-4"/>
    </svg>
  ),
  Stethoscope: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/>
      <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/>
    </svg>
  ),
};

/* ─── Menu Definition ────────────────────────────────────────────── */
type SubItem = { name: string; href: string; icon: () => JSX.Element; badge?: string; adminOnly?: boolean; superAdminOnly?: boolean };
type MenuGroup = { id: string; name: string; icon: () => JSX.Element; href?: string; single?: boolean; items?: SubItem[] };

const menuGroups: MenuGroup[] = [
  {
    id: 'dashboard', name: 'Dashboard', icon: IC.Home,
    href: '/dashboard', single: true,
  },
  {
    id: 'pharmacy', name: 'Pharmacy', icon: IC.Pill,
    items: [
      { name: 'Pharmacy POS',      href: '/dashboard/pos',              icon: IC.Monitor },
      { name: 'Dispensing',         href: '/dashboard/dispensing',       icon: IC.Beaker },
      { name: 'Prescriptions',     href: '/dashboard/prescriptions',    icon: IC.Clipboard },
      { name: 'Expiry Register',   href: '/dashboard/expiry-register',  icon: IC.Clock,  badge: '!' },
      { name: 'Batch Management',  href: '/dashboard/batches',          icon: IC.Box },
    ],
  },
  {
    id: 'clinical', name: 'Clinical', icon: IC.HeartPulse,
    items: [
      { name: 'Patients',          href: '/dashboard/patients',         icon: IC.UserPlus },
      { name: 'Dangerous Drugs',   href: '/dashboard/dangerous-drugs',  icon: IC.ShieldCheck, badge: 'DDR' },
      { name: 'Pharmacovigilance', href: '/dashboard/pharmacovigilance', icon: IC.Heart },
      { name: 'Drug Interactions', href: '/dashboard/drug-interactions', icon: IC.Warning },
      { name: 'Data Protection 🔒', href: '/dashboard/data-protection', icon: IC.ShieldCheck, badge: 'DPA' },
    ],
  },
  {
    id: 'products', name: 'Products & Sales', icon: IC.Tag,
    items: [
      { name: 'Products / Drugs',  href: '/dashboard/products',         icon: IC.Pill },
      { name: 'Categories',        href: '/dashboard/categories',        icon: IC.Tag },
      { name: 'Sales Records',     href: '/dashboard/sales',            icon: IC.File },
      { name: 'Sales Return',      href: '/dashboard/sales-return',     icon: IC.Refresh },
    ],
  },
  {
    id: 'purchases', name: 'Purchases', icon: IC.Cart,
    items: [
      { name: 'Suppliers',              href: '/dashboard/suppliers',        icon: IC.Building },
      { name: 'Purchase Entry',         href: '/dashboard/purchase',         icon: IC.Box },
      { name: 'Purchase Records',       href: '/dashboard/purchases',        icon: IC.File },
      { name: 'Purchase Return',        href: '/dashboard/purchase-return',  icon: IC.Refresh },
      { name: 'Goods Received (GRN)',   href: '/dashboard/grn',              icon: IC.Box,    badge: 'NEW' },
      { name: 'Accounts Payable',       href: '/dashboard/accounts-payable', icon: IC.Dollar, badge: 'NEW' },
    ],
  },
  {
    id: 'inventory', name: 'Inventory', icon: IC.Layers,
    items: [
      { name: 'Stock Movement',    href: '/dashboard/stock-movement',   icon: IC.Refresh },
      { name: 'Stock Take',        href: '/dashboard/stock-take',       icon: IC.ClipboardCheck },
      { name: 'Stock Transfer',    href: '/dashboard/stock-transfer',   icon: IC.Box },
      { name: 'Low Stock',         href: '/dashboard/low-stock',        icon: IC.Warning },
      { name: 'Cold Chain 🌡️',    href: '/dashboard/cold-chain',       icon: IC.Shield,  badge: 'NEW' },
    ],
  },
  {
    id: 'insurance', name: 'Insurance', icon: IC.ShieldLock,
    items: [
      { name: 'Insurance Claims',    href: '/dashboard/insurance-claims',   icon: IC.ShieldCheck },
      { name: 'Credit Customers',    href: '/dashboard/credit-customers',   icon: IC.UserPlus },
      { name: 'Credit Payments',     href: '/dashboard/credit-payments',    icon: IC.Dollar },
      { name: 'Accounts Receivable', href: '/dashboard/accounts-receivable', icon: IC.Chart, badge: 'NEW' },
    ],
  },
  {
    id: 'finance', name: 'Finance', icon: IC.Card,
    items: [
      { name: 'Expenses',              href: '/dashboard/expenses',              icon: IC.Dollar },
      { name: 'Petty Cash',            href: '/dashboard/petty-cash',            icon: IC.Dollar,   badge: 'NEW' },
      { name: 'Split Payment',         href: '/dashboard/split-payment',         icon: IC.Card,     badge: 'NEW' },
      { name: 'Bank Reconciliation',   href: '/dashboard/bank-reconciliation',   icon: IC.Card,     badge: 'NEW' },
      { name: 'M-Pesa Reconciliation', href: '/dashboard/mpesa-reconciliation',  icon: IC.Dollar,   badge: 'NEW' },
      { name: 'Accounts Receivable',   href: '/dashboard/accounts-receivable',   icon: IC.Chart,    badge: 'NEW' },
      { name: 'Loyalty Program',       href: '/dashboard/loyalty',               icon: IC.Star },
    ],
  },
  {
    id: 'hr', name: 'HR & Payroll', icon: IC.Users,
    items: [
      { name: 'Shifts',            href: '/dashboard/shifts',           icon: IC.Clock },
      { name: 'Shift Reports',     href: '/dashboard/shift-reports',    icon: IC.File },
    ],
  },
  {
    id: 'reports', name: 'Reports', icon: IC.Chart,
    items: [
      { name: 'Sales Report',      href: '/dashboard/reports/sales',    icon: IC.Trend },
      { name: 'Profit Report',     href: '/dashboard/reports/profit',   icon: IC.Trend },
      { name: 'Stock Report',      href: '/dashboard/reports/stock',    icon: IC.Chart },
      { name: 'Expiry Report',     href: '/dashboard/reports/expiry',   icon: IC.Clock },
      { name: 'M-Pesa Report',     href: '/dashboard/reports/mpesa',    icon: IC.Dollar },
      { name: 'P&L Statement',     href: '/dashboard/reports/profit-loss', icon: IC.Trend },
      { name: 'Balance Sheet',     href: '/dashboard/reports/balance-sheet', icon: IC.File },
      { name: 'Cash Book',         href: '/dashboard/reports/cash-book', icon: IC.Dollar },
      { name: 'Trial Balance',     href: '/dashboard/reports/trial-balance', icon: IC.Chart },
    ],
  },
  {
    id: 'admin', name: 'Administration', icon: IC.Shield,
    items: [
      { name: 'Outlets',           href: '/dashboard/outlets',          icon: IC.Pin,    superAdminOnly: true },
      { name: 'Users',             href: '/dashboard/users',            icon: IC.Users },
      { name: 'User Roles',        href: '/dashboard/user-roles',       icon: IC.Shield },
      { name: 'Activity Log',      href: '/dashboard/activity-log',     icon: IC.Scroll, adminOnly: true },
      { name: 'Company',           href: '/dashboard/company',          icon: IC.Building },
      { name: 'Units',             href: '/dashboard/units',            icon: IC.Ruler },
      { name: 'Tax Settings',      href: '/dashboard/tax-settings',     icon: IC.Gear },
    ],
  },
];

/* ─── Role badge helper ──────────────────────────────────────────── */
function getRoleBadge(userType: string) {
  const t = (userType || '').toLowerCase();
  if (t.includes('super')) return { label: 'SUPER ADMIN', cls: 'bg-orange-500 text-white' };
  if (t === 'admin')       return { label: 'ADMIN',       cls: 'bg-blue-600 text-white' };
  if (t === 'manager')     return { label: 'MANAGER',     cls: 'bg-green-600 text-white' };
  if (t === 'pharmacist')  return { label: 'PHARMACIST',  cls: 'bg-teal-600 text-white' };
  if (t === 'cashier')     return { label: 'CASHIER',     cls: 'bg-gray-500 text-white' };
  return { label: userType.toUpperCase(), cls: 'bg-gray-500 text-white' };
}

/* ─── Context display helpers ────────────────────────────────────── */
function CompanyNameDisplay() {
  const companyName = useCompanyName();
  const { activeOutlet } = useOutlet();
  return (
    <>
      <span className="font-bold text-gray-900 text-[15px] leading-tight truncate max-w-[140px]">
        {companyName || 'Alpha Pharmacy'}
      </span>
      <span className="text-[11px] text-blue-600 font-medium truncate max-w-[140px]">
        {activeOutlet ? `📍 ${activeOutlet.outlet_name}` : 'Licensed to: Alpha Solutions'}
      </span>
    </>
  );
}

function OutletSwitcher() {
  const { activeOutlet, outlets, switchOutlet } = useOutlet();
  if (outlets.length <= 1) return null;
  return (
    <select
      value={activeOutlet?.outlet_id || ''}
      onChange={e => switchOutlet(Number(e.target.value))}
      className="px-3 py-1.5 bg-teal-50 border border-teal-200 rounded-xl text-sm font-semibold text-teal-700 focus:border-teal-400 outline-none cursor-pointer"
    >
      {outlets.map(o => (
        <option key={o.outlet_id} value={o.outlet_id}>
          {o.is_main ? '⭐ ' : '📍 '}{o.outlet_name}
        </option>
      ))}
    </select>
  );
}

/* ─── Main Layout ────────────────────────────────────────────────── */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [user, setUser]               = useState<{ userId: string; name: string; userType: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [expanded, setExpanded]       = useState<Set<string>>(new Set());

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) { router.push('/'); return; }
    setUser(JSON.parse(userData));
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    // DPA Compliance: Auto-logout on 30 minutes of inactivity
    let timeout: NodeJS.Timeout;
    const resetTimer = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        localStorage.removeItem('user');
        router.push('/?session_expired=1');
      }, 30 * 60 * 1000); // 30 minutes
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

  // Auto-expand the group that owns the current route
  useEffect(() => {
    const active = menuGroups.find(g => !g.single && g.items?.some(i => i.href === pathname));
    if (active) setExpanded(prev => { const s = new Set(prev); s.add(active.id); return s; });
  }, [pathname]);

  const toggleGroup = (id: string) =>
    setExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const getGreeting = () => {
    const h = currentTime.getHours();
    if (h < 12) return { text: 'Good Morning',   emoji: '🌅' };
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
  const avatarLetter = user.name.charAt(0).toUpperCase();

  return (
    <SettingsProvider>
      <OutletProvider>
        <div className="min-h-screen bg-[#f3f4f6] flex">

          {/* ── Sidebar ── */}
          {!isCashier && (
            <aside
              className={`${sidebarOpen ? 'w-[240px]' : 'w-[68px]'} bg-white border-r border-gray-100 flex flex-col fixed h-full z-50 transition-all duration-300 shadow-sm`}
            >
              {/* Logo Header */}
              <div className="relative flex items-center gap-3 px-4 py-[18px] border-b border-gray-100">
                {/* Pill icon */}
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0 shadow">
                  <span className="text-white text-lg">💊</span>
                </div>

                {sidebarOpen && (
                  <div className="flex flex-col min-w-0">
                    <CompanyNameDisplay />
                  </div>
                )}

                {/* Collapse toggle — right edge of sidebar */}
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm hover:bg-gray-50 text-gray-800 transition-colors z-10"
                  title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                >
                  {sidebarOpen ? <IC.ChevronLeft /> : <IC.ChevronRight />}
                </button>
              </div>

              {/* Nav */}
              <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
                {menuGroups.map(group => {
                  const isGroupActive  = group.single
                    ? pathname === group.href
                    : group.items?.some(i => i.href === pathname) ?? false;
                  const isOpen         = expanded.has(group.id);
                  const GroupIcon      = group.icon;

                  // filter sub-items by permission
                  const visibleItems = group.items?.filter(item => {
                    if (item.superAdminOnly && !isSuperAdmin) return false;
                    if (item.adminOnly      && !isAdmin)      return false;
                    return true;
                  }) ?? [];

                  return (
                    <div key={group.id}>
                      {/* Parent row */}
                      {group.single ? (
                        <Link
                          href={group.href!}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group relative
                            ${isGroupActive
                              ? 'bg-blue-50 text-blue-600 font-semibold border-l-[3px] border-blue-600 pl-[9px]'
                              : 'text-gray-900 hover:bg-gray-50 hover:text-black border-l-[3px] border-transparent'
                            }`}
                          title={!sidebarOpen ? group.name : undefined}
                        >
                          <span className={`flex-shrink-0 ${isGroupActive ? 'text-blue-600' : 'text-gray-900 group-hover:text-black'}`}>
                            <GroupIcon />
                          </span>
                          {sidebarOpen && (
                            <span className="text-[13.5px] truncate font-medium">{group.name}</span>
                          )}
                        </Link>
                      ) : (
                        <button
                          onClick={() => toggleGroup(group.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group relative
                            ${isGroupActive
                              ? 'text-blue-600 font-semibold'
                              : 'text-gray-900 hover:bg-gray-50 hover:text-black'
                            } border-l-[3px] border-transparent`}
                          title={!sidebarOpen ? group.name : undefined}
                        >
                          <span className={`flex-shrink-0 ${isGroupActive ? 'text-blue-600' : 'text-gray-900 group-hover:text-black'}`}>
                            <GroupIcon />
                          </span>
                          {sidebarOpen && (
                            <>
                              <span className="text-[13.5px] truncate flex-1 text-left font-medium">{group.name}</span>
                              <span className={`flex-shrink-0 ${isGroupActive ? 'text-blue-600' : 'text-gray-700'}`}>
                                <IC.ChevronDown rotated={isOpen} />
                              </span>
                            </>
                          )}
                        </button>
                      )}

                      {/* Sub-items */}
                      {!group.single && isOpen && sidebarOpen && visibleItems.length > 0 && (
                        <div className="ml-3 pl-3 border-l border-gray-200 mt-0.5 mb-1 space-y-0.5">
                          {visibleItems.map(item => {
                            const isActive = pathname === item.href;
                            const SubIcon  = item.icon;
                            return (
                              <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all group relative
                                  ${isActive
                                    ? 'bg-blue-50 text-blue-600 font-semibold border-l-[3px] border-blue-600 pl-[9px]'
                                    : 'text-gray-800 hover:bg-gray-50 hover:text-black border-l-[3px] border-transparent'
                                  }`}
                              >
                                <span className={`flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-800 group-hover:text-black'}`}>
                                  <SubIcon />
                                </span>
                                <span className="truncate flex-1">{item.name}</span>
                                {item.badge && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-semibold animate-pulse flex-shrink-0">
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
              </nav>

              {/* ── Bottom user card ── */}
              <div className="border-t border-gray-100 px-3 py-3">
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className={`${roleBadge.cls.includes('orange') ? 'bg-orange-500' : roleBadge.cls.includes('blue') ? 'bg-blue-600' : roleBadge.cls.includes('green') ? 'bg-green-600' : 'bg-teal-600'} w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow`}>
                    {avatarLetter}
                  </div>

                  {sidebarOpen && (
                    <>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-gray-800 truncate">{user.name}</p>
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5 ${roleBadge.cls}`}>
                          {roleBadge.label}
                        </span>
                      </div>
                      <button
                        onClick={handleLogout}
                        title="Logout"
                        className="flex-shrink-0 text-gray-700 hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-red-50"
                      >
                        <IC.LogOut />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </aside>
          )}

          {/* ── Main content ── */}
          <main className={`flex-1 ${isCashier ? 'ml-0' : sidebarOpen ? 'ml-[240px]' : 'ml-[68px]'} transition-all duration-300`}>
            {/* Top header */}
            <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-40 shadow-sm">
              <div className="flex items-center gap-3">
                <h2 className="text-[17px] font-semibold text-gray-800 flex items-center gap-2">
                  {greeting.emoji} {greeting.text}
                  <span>👋</span>
                </h2>
                <span className="text-xs text-gray-600 hidden sm:block">Alpha Pharmacy POS</span>
              </div>
              <div className="flex items-center gap-3">
                <OutletSwitcher />
                <div className="flex items-center gap-2 px-3 py-1.5 bg-teal-50 rounded-full border border-teal-100">
                  <span className="w-2 h-2 bg-teal-500 rounded-full animate-pulse" />
                  <span className="text-xs font-medium text-teal-600">Online</span>
                </div>
                <button
                  onClick={() => window.location.reload()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <IC.Refresh />
                  Refresh
                </button>
                <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-800">
                  <IC.Bell />
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
                </button>
                <div className="flex items-center gap-2.5 pl-3 border-l border-gray-200">
                  <div className="text-right hidden sm:block">
                    <p className="text-[13px] font-semibold text-gray-800 leading-tight">{user.name}</p>
                    <p className="text-[11px] text-gray-600">{user.userType || 'Pharmacist'}</p>
                  </div>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shadow ${roleBadge.cls.includes('orange') ? 'bg-orange-500' : 'bg-blue-600'}`}>
                    {avatarLetter}
                  </div>
                </div>
              </div>
            </header>

            <div className="p-6">{children}</div>
          </main>
        </div>
      </OutletProvider>
    </SettingsProvider>
  );
}
