'use client';

import React from 'react';
import {
  LuActivity,
  LuBell,
  LuBox,
  LuCalendarDays,
  LuCheck,
  LuChevronDown,
  LuChevronLeft,
  LuChevronRight,
  LuClock3,
  LuCreditCard,
  LuFileText,
  LuHeartPulse,
  LuHome,
  LuKeyboard,
  LuLayers,
  LuLeaf,
  LuLogOut,
  LuPackage,
  LuPill,
  LuPlus,
  LuSearch,
  LuSettings,
  LuShieldCheck,
  LuShoppingCart,
  LuSlidersHorizontal,
  LuStethoscope,
  LuTag,
  LuTrash2,
  LuTruck,
  LuUser,
  LuUsers,
  LuVolume2,
  LuX,
  LuZap,
  LuMenu,
  LuBarChart3,
} from 'react-icons/lu';

export const Activity = LuActivity;
export const Bell = LuBell;
export const Box = LuBox;
export const CalendarDays = LuCalendarDays;
export const Check = LuCheck;
export const ChevronDown = LuChevronDown;
export const ChevronLeft = LuChevronLeft;
export const ChevronRight = LuChevronRight;
export const Clock3 = LuClock3;
export const CreditCard = LuCreditCard;
export const FileText = LuFileText;
export const HeartPulse = LuHeartPulse;
export const Home = LuHome;
export const Keyboard = LuKeyboard;
export const Layers3 = LuLayers;
export const Leaf = LuLeaf;
export const LogOut = LuLogOut;
export const Package = LuPackage;
export const Pill = LuPill;
export const Plus = LuPlus;
export const Search = LuSearch;
export const Settings = LuSettings;
export const ShieldCheck = LuShieldCheck;
export const ShoppingCart = LuShoppingCart;
export const SlidersHorizontal = LuSlidersHorizontal;
export const Stethoscope = LuStethoscope;
export const Tag = LuTag;
export const Trash2 = LuTrash2;
export const Truck = LuTruck;
export const User = LuUser;
export const Users = LuUsers;
export const Volume2 = LuVolume2;
export const X = LuX;
export const Zap = LuZap;
export const Menu = LuMenu;
export const BarChart3 = LuBarChart3;

export function ScanBarcode(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <path d="M7 8v8" />
      <path d="M12 8v8" />
      <path d="M17 8v8" />
    </svg>
  );
}
