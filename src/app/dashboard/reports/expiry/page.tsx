'use client';

// =====================================================================
// Alpha Pharmacy - Super Ultra Massive World-Class Expiry & FEFO Intelligence Hub v5.6
// Realtime Live Database Sync, Multi-tier Retail/Pharmacy Fallback, Full Batches Traceability,
// Intelligent FEFO Risk Stratification, Box-Breaking Stock Breakdown, Visual Chart.js Analytics,
// Full Multi-Tab Pagination (First, Prev, Page Numbers, Next, Last, Rows Per Page),
// Monthly Impending Expiration Horizons, Supplier Return Exposure, Quarantine & Disposal Modal,
// High-Contrast Dark Headers, Super Premium Light Cards, PPB Regulatory PDF Audit & Styled Excel (.xls)
// =====================================================================

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import { useCompanyName } from '@/context/SettingsContext';
import { calculateStockBreakdown } from '@/lib/stockBreakdown';
import toast from 'react-hot-toast';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

// ==================== DATA INTERFACES ====================
export interface ExpiryBatchRow {
    batch_id: number;
    product_id: number;
    batch_number: string;
    expiry_date: string;
    manufacture_date?: string;
    remaining_qty: number;
    initial_qty: number;
    purchase_cost: number;
    unit_cost: number;
    selling_price: number;
    status: string;
    supplier_name: string;
    purchase_invoice?: string;
    outlet_id: number;
    created_at?: string;
    
    // Joined product metadata
    product_name: string;
    product_code: string;
    category: string;
    generic_name: string;
    sales_unit: string;
    purchase_unit: string;
    pieces_per_package: number;
    box_breakdown: string;
    
    // Computed FEFO metrics
    days_until: number;
    risk_level: 'EXPIRED' | 'CRITICAL' | 'HIGH' | 'MODERATE' | 'APPROACHING' | 'SAFE';
    capital_at_risk: number;
    retail_value: number;
}

export interface CategoryRiskAggregate {
    category: string;
    total_batches: number;
    expired_count: number;
    expired_value: number;
    critical_count: number;
    critical_value: number;
    safe_value: number;
    total_capital_at_risk: number;
}

export interface SupplierRiskAggregate {
    supplier_name: string;
    batch_count: number;
    expired_value: number;
    impending_value: number;
    total_exposure: number;
}

const getDaysUntilExpiry = (dateStr: string): number => {
    if (!dateStr) return 9999;
    const target = new Date(dateStr).getTime();
    const now = new Date().setHours(0, 0, 0, 0);
    return Math.ceil((target - now) / 86400000);
};

// ==================== REUSABLE PAGINATION FOOTER ====================
function PaginationFooter({
    currentPage,
    totalItems,
    pageSize,
    onPageChange,
    onPageSizeChange,
    itemLabel = 'items',
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
        <div className="p-4 border-t border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-semibold text-slate-600">
            {/* Left: Rows per page and item count */}
            <div className="flex items-center gap-3 flex-wrap">
                <span className="text-slate-500 font-bold">Rows per page:</span>
                <select
                    value={pageSize}
                    onChange={(e) => {
                        onPageSizeChange(Number(e.target.value));
                        onPageChange(1);
                    }}
                    className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-800 shadow-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                >
                    {[10, 25, 50, 100, 250].map((n) => (
                        <option key={n} value={n}>{n}</option>
                    ))}
                </select>
                <span className="text-slate-300">|</span>
                <span className="text-slate-700">
                    Showing <strong className="text-slate-900 font-mono">{startIdx}</strong> - <strong className="text-slate-900 font-mono">{endIdx}</strong> of <strong className="text-rose-600 font-mono font-extrabold">{totalItems}</strong> {itemLabel}
                </span>
            </div>

            {/* Right: Navigation Controls & Page Numbers */}
            <div className="flex items-center gap-1.5 flex-wrap">
                {/* First Page */}
                <button
                    onClick={() => onPageChange(1)}
                    disabled={currentPage === 1}
                    title="First Page"
                    className="px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed shadow-xs transition-colors font-mono font-bold"
                >
                    «
                </button>

                {/* Previous Page */}
                <button
                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    title="Previous Page"
                    className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed shadow-xs transition-colors font-bold"
                >
                    ‹ Prev
                </button>

                {/* Page Number Pills */}
                <div className="hidden sm:flex items-center gap-1">
                    {getPageNumbers().map((num, i) => {
                        if (num === '...') {
                            return <span key={`dots-${i}`} className="px-2 text-slate-400 font-mono">...</span>;
                        }
                        const pNum = Number(num);
                        const isActive = pNum === currentPage;
                        return (
                            <button
                                key={pNum}
                                onClick={() => onPageChange(pNum)}
                                className={`w-8 h-8 rounded-xl font-mono text-xs font-bold transition-all ${
                                    isActive
                                        ? 'bg-slate-900 text-white shadow-sm'
                                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                                }`}
                            >
                                {pNum}
                            </button>
                        );
                    })}
                </div>

                {/* Mobile Page Indicator */}
                <span className="sm:hidden px-2 font-mono font-bold text-slate-800">
                    {currentPage} / {totalPages}
                </span>

                {/* Next Page */}
                <button
                    onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage >= totalPages}
                    title="Next Page"
                    className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed shadow-xs transition-colors font-bold"
                >
                    Next ›
                </button>

                {/* Last Page */}
                <button
                    onClick={() => onPageChange(totalPages)}
                    disabled={currentPage >= totalPages}
                    title="Last Page"
                    className="px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed shadow-xs transition-colors font-mono font-bold"
                >
                    »
                </button>
            </div>
        </div>
    );
}

export default function ExpiryReportPage() {
    const { activeOutlet } = useOutlet();
    const companyName = useCompanyName() || 'Alpha Pharmacy';
    const outletId = activeOutlet?.outlet_id || 1;

    // Filters and state
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'critical' | 'master' | 'categories' | 'suppliers'>('overview');

    // Filter controls
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedHorizon, setSelectedHorizon] = useState<string>('ALL');
    const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
    const [selectedSupplier, setSelectedSupplier] = useState<string>('ALL');
    const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
    const [sortBy, setSortBy] = useState<'fefo_asc' | 'expiry_desc' | 'risk_val_desc' | 'qty_desc'>('fefo_asc');

    // Multi-tab Pagination States
    const [pageMaster, setPageMaster] = useState(1);
    const [pageSizeMaster, setPageSizeMaster] = useState(25);

    const [pageCritical, setPageCritical] = useState(1);
    const [pageSizeCritical, setPageSizeCritical] = useState(25);

    const [pageCategory, setPageCategory] = useState(1);
    const [pageSizeCategory, setPageSizeCategory] = useState(25);

    const [pageSupplier, setPageSupplier] = useState(1);
    const [pageSizeSupplier, setPageSizeSupplier] = useState(25);

    // Master dataset
    const [batches, setBatches] = useState<ExpiryBatchRow[]>([]);
    const [categoriesList, setCategoriesList] = useState<string[]>([]);
    const [suppliersList, setSuppliersList] = useState<string[]>([]);

    // Quarantine / Action Modal
    const [actionBatch, setActionBatch] = useState<ExpiryBatchRow | null>(null);
    const [actionType, setActionType] = useState<'quarantine' | 'dispose' | 'status'>('quarantine');
    const [actionReason, setActionReason] = useState('Expired medication past regulatory shelf-life');
    const [actionNotes, setActionNotes] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    // Reset pagination when search or filters change
    const handleSearchChange = (val: string) => {
        setSearchQuery(val);
        setPageMaster(1);
        setPageCritical(1);
    };

    const handleHorizonChange = (val: string) => {
        setSelectedHorizon(val);
        setPageMaster(1);
    };

    const handleCategoryChange = (val: string) => {
        setSelectedCategory(val);
        setPageMaster(1);
        setPageCritical(1);
    };

    const handleSupplierChange = (val: string) => {
        setSelectedSupplier(val);
        setPageMaster(1);
        setPageCritical(1);
    };

    const handleStatusChange = (val: string) => {
        setSelectedStatus(val);
        setPageMaster(1);
    };

    // ==================== CORE DATA LOADER ====================
    const loadExpiryData = useCallback(async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        else setRefreshing(true);

        try {
            // Step 1: Fetch product metadata (pharmacy_products with retail_products fallback)
            let prods: any[] = [];
            const { data: pProds } = await supabase
                .from('pharmacy_products')
                .select('pid, product_name, product_code, category, generic_name, purchase_cost, sales_cost, pieces_per_package, purchase_unit, sales_unit');

            if (pProds && pProds.length > 0) {
                prods = pProds;
            } else {
                const { data: rProds } = await supabase
                    .from('retail_products')
                    .select('pid, product_name, product_code, category, generic_name, purchase_cost, sales_cost, pieces_per_package, purchase_unit, sales_unit');
                if (rProds) prods = rProds;
            }

            const pMap: Record<number, any> = {};
            prods.forEach((p) => {
                pMap[p.pid] = p;
            });

            // Step 2: Fetch all batches from pharmacy_batches
            let bQuery = supabase
                .from('pharmacy_batches')
                .select('*')
                .order('expiry_date', { ascending: true });

            if (outletId) {
                bQuery = bQuery.eq('outlet_id', outletId);
            }

            const { data: rawBatches, error: bErr } = await bQuery;
            if (bErr) throw bErr;

            // Step 3: Join and transform batches
            const transformed: ExpiryBatchRow[] = (rawBatches || []).map((b: any) => {
                const prod = pMap[b.product_id] || {};
                const pieces = Number(prod.pieces_per_package) || 1;
                const pUnit = prod.purchase_unit || 'Box';
                const sUnit = prod.sales_unit || 'Piece';

                const rawCost = Number(b.purchase_cost) || Number(prod.purchase_cost) || 0;
                const unitCost = rawCost > 0 ? (pieces > 1 ? rawCost / pieces : rawCost) : 0;
                const sellPrice = Number(b.selling_price) || Number(prod.sales_cost) || 0;
                const remQty = Number(b.remaining_qty) || 0;

                const daysUntil = getDaysUntilExpiry(b.expiry_date);

                let riskLevel: ExpiryBatchRow['risk_level'] = 'SAFE';
                if (daysUntil < 0) riskLevel = 'EXPIRED';
                else if (daysUntil <= 30) riskLevel = 'CRITICAL';
                else if (daysUntil <= 60) riskLevel = 'HIGH';
                else if (daysUntil <= 90) riskLevel = 'MODERATE';
                else if (daysUntil <= 180) riskLevel = 'APPROACHING';
                else riskLevel = 'SAFE';

                const capitalAtRisk = remQty * unitCost;
                const retailValue = remQty * sellPrice;

                const breakdown = calculateStockBreakdown(remQty, pieces, pUnit, sUnit);

                return {
                    batch_id: b.batch_id,
                    product_id: b.product_id,
                    batch_number: b.batch_number || `BATCH-${b.batch_id}`,
                    expiry_date: b.expiry_date || '',
                    manufacture_date: b.manufacture_date,
                    remaining_qty: remQty,
                    initial_qty: Number(b.quantity) || remQty,
                    purchase_cost: rawCost,
                    unit_cost: unitCost,
                    selling_price: sellPrice,
                    status: b.status || (daysUntil < 0 ? 'Expired' : 'Active'),
                    supplier_name: b.supplier_name || 'Direct Wholesale',
                    purchase_invoice: b.purchase_invoice,
                    outlet_id: b.outlet_id || 1,
                    created_at: b.created_at,

                    product_name: prod.product_name || `Drug #${b.product_id}`,
                    product_code: prod.product_code || `DRG-${b.product_id}`,
                    category: prod.category || 'General',
                    generic_name: prod.generic_name || '',
                    sales_unit: sUnit,
                    purchase_unit: pUnit,
                    pieces_per_package: pieces,
                    box_breakdown: breakdown.displayText,

                    days_until: daysUntil,
                    risk_level: riskLevel,
                    capital_at_risk: capitalAtRisk,
                    retail_value: retailValue,
                };
            });

            setBatches(transformed);

            // Extract unique categories & suppliers
            const cats = Array.from(new Set(transformed.map((b) => b.category))).filter(Boolean).sort();
            setCategoriesList(cats);
            const supps = Array.from(new Set(transformed.map((b) => b.supplier_name))).filter(Boolean).sort();
            setSuppliersList(supps);

        } catch (err: any) {
            console.error('Failed to load expiry report batches:', err);
            toast.error(err.message || 'Error compiling expiry report');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [outletId]);

    useEffect(() => {
        loadExpiryData();
    }, [loadExpiryData]);

    // Realtime Supabase Subscription
    useEffect(() => {
        const channel = supabase
            .channel('expiry-report-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pharmacy_batches' }, () => {
                loadExpiryData(true);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [loadExpiryData]);

    // ==================== FILTERING & SORTING ====================
    const filteredBatches = useMemo(() => {
        return batches.filter((b) => {
            // Search filter
            const matchesSearch = !searchQuery ||
                b.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                b.product_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                b.batch_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
                b.supplier_name.toLowerCase().includes(searchQuery.toLowerCase());

            // Horizon filter
            let matchesHorizon = true;
            if (selectedHorizon === 'EXPIRED') matchesHorizon = b.days_until < 0;
            else if (selectedHorizon === '30D') matchesHorizon = b.days_until >= 0 && b.days_until <= 30;
            else if (selectedHorizon === '60D') matchesHorizon = b.days_until > 30 && b.days_until <= 60;
            else if (selectedHorizon === '90D') matchesHorizon = b.days_until > 60 && b.days_until <= 90;
            else if (selectedHorizon === '180D') matchesHorizon = b.days_until > 90 && b.days_until <= 180;
            else if (selectedHorizon === 'SAFE') matchesHorizon = b.days_until > 180;
            else if (selectedHorizon === 'CRITICAL_ALL') matchesHorizon = b.days_until <= 60;

            // Category filter
            const matchesCat = selectedCategory === 'ALL' || b.category === selectedCategory;

            // Supplier filter
            const matchesSupp = selectedSupplier === 'ALL' || b.supplier_name === selectedSupplier;

            // Status filter
            const matchesStatus = selectedStatus === 'ALL' || b.status.toLowerCase() === selectedStatus.toLowerCase();

            return matchesSearch && matchesHorizon && matchesCat && matchesSupp && matchesStatus;
        }).sort((a, b) => {
            if (sortBy === 'fefo_asc') return a.days_until - b.days_until;
            if (sortBy === 'expiry_desc') return b.days_until - a.days_until;
            if (sortBy === 'risk_val_desc') return b.capital_at_risk - a.capital_at_risk;
            if (sortBy === 'qty_desc') return b.remaining_qty - a.remaining_qty;
            return a.days_until - b.days_until;
        });
    }, [batches, searchQuery, selectedHorizon, selectedCategory, selectedSupplier, selectedStatus, sortBy]);

    // Critical Batches (Expired + <= 30 Days)
    const criticalBatches = useMemo(() => {
        return batches.filter((b) => b.days_until <= 30 && b.remaining_qty > 0).sort((a, b) => a.days_until - b.days_until);
    }, [batches]);

    // Paginated Slices
    const paginatedMasterBatches = useMemo(() => {
        return filteredBatches.slice((pageMaster - 1) * pageSizeMaster, pageMaster * pageSizeMaster);
    }, [filteredBatches, pageMaster, pageSizeMaster]);

    const paginatedCriticalBatches = useMemo(() => {
        return criticalBatches.slice((pageCritical - 1) * pageSizeCritical, pageCritical * pageSizeCritical);
    }, [criticalBatches, pageCritical, pageSizeCritical]);

    // Aggregates for Summary Cards
    const summaryMetrics = useMemo(() => {
        let expiredCost = 0;
        let expiredCount = 0;
        let expiredUnits = 0;

        let criticalCost = 0;
        let criticalCount = 0;

        let ninetyDaysCost = 0;
        let safeCost = 0;
        let totalPieces = 0;

        batches.forEach((b) => {
            if (b.remaining_qty > 0) {
                totalPieces += b.remaining_qty;
                if (b.days_until < 0) {
                    expiredCost += b.capital_at_risk;
                    expiredCount += 1;
                    expiredUnits += b.remaining_qty;
                } else if (b.days_until <= 30) {
                    criticalCost += b.capital_at_risk;
                    criticalCount += 1;
                } else if (b.days_until <= 90) {
                    ninetyDaysCost += b.capital_at_risk;
                } else {
                    safeCost += b.capital_at_risk;
                }
            }
        });

        return {
            expiredCost,
            expiredCount,
            expiredUnits,
            criticalCost,
            criticalCount,
            ninetyDaysCost,
            safeCost,
            totalPieces,
            totalActiveBatches: batches.filter((b) => b.remaining_qty > 0).length,
        };
    }, [batches]);

    // ==================== VISUAL CHARTS CONFIGURATION ====================
    // 1. Expiry Horizon Doughnut
    const horizonDoughnutData = useMemo(() => {
        let expired = 0;
        let d30 = 0;
        let d60 = 0;
        let d90 = 0;
        let d180 = 0;
        let safe = 0;

        batches.forEach((b) => {
            if (b.remaining_qty > 0) {
                if (b.days_until < 0) expired += b.capital_at_risk;
                else if (b.days_until <= 30) d30 += b.capital_at_risk;
                else if (b.days_until <= 60) d60 += b.capital_at_risk;
                else if (b.days_until <= 90) d90 += b.capital_at_risk;
                else if (b.days_until <= 180) d180 += b.capital_at_risk;
                else safe += b.capital_at_risk;
            }
        });

        return {
            labels: [
                'Expired (Loss)',
                'Critical (< 30d)',
                'High Risk (31-60d)',
                'Moderate (61-90d)',
                'Approaching (91-180d)',
                'Safe Shelf-Life (> 180d)'
            ],
            datasets: [
                {
                    data: [Math.round(expired), Math.round(d30), Math.round(d60), Math.round(d90), Math.round(d180), Math.round(safe)],
                    backgroundColor: ['#f43f5e', '#f97316', '#eab308', '#06b6d4', '#3b82f6', '#10b981'],
                    borderColor: '#ffffff',
                    borderWidth: 2,
                    hoverOffset: 6,
                },
            ],
        };
    }, [batches]);

    // 2. Monthly Impending Expiration Bar Chart
    const monthlyProjectionData = useMemo(() => {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const now = new Date();
        const next12Months: { key: string; label: string; cost: number; count: number }[] = [];

        for (let i = 0; i < 12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const key = `${y}-${m}`;
            const label = `${monthNames[d.getMonth()]} '${String(y).slice(-2)}`;
            next12Months.push({ key, label, cost: 0, count: 0 });
        }

        batches.forEach((b) => {
            if (b.remaining_qty > 0 && b.expiry_date) {
                const ym = b.expiry_date.slice(0, 7);
                const target = next12Months.find((m) => m.key === ym);
                if (target) {
                    target.cost += b.capital_at_risk;
                    target.count += 1;
                }
            }
        });

        return {
            labels: next12Months.map((m) => m.label),
            datasets: [
                {
                    label: 'Impending Expiry Capital Outlay (KES)',
                    data: next12Months.map((m) => Math.round(m.cost)),
                    backgroundColor: 'rgba(239, 68, 68, 0.75)',
                    borderRadius: 6,
                    hoverBackgroundColor: '#dc2626',
                },
                {
                    label: 'Expiring Batches Count',
                    data: next12Months.map((m) => m.count),
                    backgroundColor: 'rgba(100, 116, 139, 0.45)',
                    borderRadius: 6,
                    yAxisID: 'y1',
                },
            ],
        };
    }, [batches]);

    // 3. Category Risk Matrix Data
    const categoryAggregates: CategoryRiskAggregate[] = useMemo(() => {
        const map = new Map<string, CategoryRiskAggregate>();

        batches.forEach((b) => {
            const cat = b.category || 'General';
            if (!map.has(cat)) {
                map.set(cat, {
                    category: cat,
                    total_batches: 0,
                    expired_count: 0,
                    expired_value: 0,
                    critical_count: 0,
                    critical_value: 0,
                    safe_value: 0,
                    total_capital_at_risk: 0,
                });
            }

            const c = map.get(cat)!;
            c.total_batches += 1;
            c.total_capital_at_risk += b.capital_at_risk;

            if (b.days_until < 0) {
                c.expired_count += 1;
                c.expired_value += b.capital_at_risk;
            } else if (b.days_until <= 30) {
                c.critical_count += 1;
                c.critical_value += b.capital_at_risk;
            } else {
                c.safe_value += b.capital_at_risk;
            }
        });

        return Array.from(map.values()).sort((a, b) => (b.expired_value + b.critical_value) - (a.expired_value + a.critical_value));
    }, [batches]);

    const paginatedCategories = useMemo(() => {
        return categoryAggregates.slice((pageCategory - 1) * pageSizeCategory, pageCategory * pageSizeCategory);
    }, [categoryAggregates, pageCategory, pageSizeCategory]);

    // 4. Supplier Risk Aggregates
    const supplierAggregates: SupplierRiskAggregate[] = useMemo(() => {
        const map = new Map<string, SupplierRiskAggregate>();

        batches.forEach((b) => {
            const sup = b.supplier_name || 'Direct Wholesale';
            if (!map.has(sup)) {
                map.set(sup, {
                    supplier_name: sup,
                    batch_count: 0,
                    expired_value: 0,
                    impending_value: 0,
                    total_exposure: 0,
                });
            }

            const s = map.get(sup)!;
            s.batch_count += 1;
            s.total_exposure += b.capital_at_risk;

            if (b.days_until < 0) {
                s.expired_value += b.capital_at_risk;
            } else if (b.days_until <= 60) {
                s.impending_value += b.capital_at_risk;
            }
        });

        return Array.from(map.values()).sort((a, b) => (b.expired_value + b.impending_value) - (a.expired_value + a.impending_value));
    }, [batches]);

    const paginatedSuppliers = useMemo(() => {
        return supplierAggregates.slice((pageSupplier - 1) * pageSizeSupplier, pageSupplier * pageSizeSupplier);
    }, [supplierAggregates, pageSupplier, pageSizeSupplier]);

    // ==================== QUARANTINE & DISPOSAL HANDLER ====================
    const handleBatchAction = async () => {
        if (!actionBatch) return;
        setActionLoading(true);

        try {
            const newStatus = actionType === 'quarantine' ? 'Quarantined' : actionType === 'dispose' ? 'Disposed' : 'Active';

            const { error: updErr } = await supabase
                .from('pharmacy_batches')
                .update({
                    status: newStatus,
                })
                .eq('batch_id', actionBatch.batch_id);

            if (updErr) throw updErr;

            toast.success(`Batch ${actionBatch.batch_number} marked as ${newStatus}`);
            setActionBatch(null);
            loadExpiryData(true);
        } catch (err: any) {
            console.error('Failed to update batch status:', err);
            toast.error(err.message || 'Error updating batch');
        } finally {
            setActionLoading(false);
        }
    };

    // ==================== EXPORT UTILITIES ====================
    const exportExcelXLS = () => {
        try {
            const tableHeaders = [
                'Batch Number',
                'Product Name',
                'Product Code',
                'Category',
                'Supplier',
                'Expiry Date',
                'Days Remaining',
                'Risk Level',
                'Status',
                'Remaining Qty',
                'Box Breakdown',
                'Unit Cost (KES)',
                'Capital at Risk (KES)',
                'Retail Price (KES)',
                'Potential Revenue (KES)'
            ];

            const rowsXML = filteredBatches.map((b) => `
                <Row>
                    <Cell><Data ss:Type="String">${b.batch_number}</Data></Cell>
                    <Cell><Data ss:Type="String">${b.product_name.replace(/&/g, '&amp;')}</Data></Cell>
                    <Cell><Data ss:Type="String">${b.product_code}</Data></Cell>
                    <Cell><Data ss:Type="String">${b.category.replace(/&/g, '&amp;')}</Data></Cell>
                    <Cell><Data ss:Type="String">${b.supplier_name.replace(/&/g, '&amp;')}</Data></Cell>
                    <Cell><Data ss:Type="String">${b.expiry_date}</Data></Cell>
                    <Cell><Data ss:Type="Number">${b.days_until}</Data></Cell>
                    <Cell><Data ss:Type="String">${b.risk_level}</Data></Cell>
                    <Cell><Data ss:Type="String">${b.status}</Data></Cell>
                    <Cell><Data ss:Type="Number">${b.remaining_qty}</Data></Cell>
                    <Cell><Data ss:Type="String">${b.box_breakdown}</Data></Cell>
                    <Cell><Data ss:Type="Number">${b.unit_cost.toFixed(2)}</Data></Cell>
                    <Cell><Data ss:Type="Number">${b.capital_at_risk.toFixed(2)}</Data></Cell>
                    <Cell><Data ss:Type="Number">${b.selling_price.toFixed(2)}</Data></Cell>
                    <Cell><Data ss:Type="Number">${b.retail_value.toFixed(2)}</Data></Cell>
                </Row>
            `).join('');

            const excelXML = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Header">
   <Font ss:Bold="1" ss:Color="#FFFFFF" ss:Size="11"/>
   <Interior ss:Color="#0F172A" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="Title">
   <Font ss:Bold="1" ss:Size="16" ss:Color="#0F172A"/>
  </Style>
  <Style ss:ID="Summary">
   <Font ss:Bold="1" ss:Color="#0F172A"/>
   <Interior ss:Color="#FEF2F2" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Expiry &amp; FEFO Intelligence">
  <Table>
   <Row>
    <Cell ss:StyleID="Title"><Data ss:Type="String">${companyName} - Official Expiry &amp; FEFO Risk Register</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">Outlet: ${activeOutlet?.outlet_name || 'Main Pharmacy'} | Audited: ${new Date().toLocaleString()}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="Summary"><Data ss:Type="String">Expired Loss: KES ${summaryMetrics.expiredCost.toLocaleString()} (${summaryMetrics.expiredCount} batches)</Data></Cell>
    <Cell ss:StyleID="Summary"><Data ss:Type="String">Critical &lt; 30d: KES ${summaryMetrics.criticalCost.toLocaleString()}</Data></Cell>
    <Cell ss:StyleID="Summary"><Data ss:Type="String">Safe Inventory: KES ${summaryMetrics.safeCost.toLocaleString()}</Data></Cell>
   </Row>
   <Row></Row>
   <Row ss:StyleID="Header">
    ${tableHeaders.map((h) => `<Cell><Data ss:Type="String">${h}</Data></Cell>`).join('')}
   </Row>
   ${rowsXML}
  </Table>
 </Worksheet>
</Workbook>`;

            const blob = new Blob([excelXML], { type: 'application/vnd.ms-excel' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `AlphaPharmacy_Expiry_FEFO_Report_${new Date().toISOString().split('T')[0]}.xls`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success('Executive Expiry Register exported (.xls)!');
        } catch (e: any) {
            toast.error('Failed to export Excel: ' + e.message);
        }
    };

    const printPPBAuditReport = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            toast.error('Please allow popups to print report');
            return;
        }

        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8"/>
    <title>Regulatory Expiry &amp; Disposal Audit Slip - ${companyName}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 15mm; color: #0f172a; font-size: 11px; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #ef4444; padding-bottom: 12px; margin-bottom: 15px; }
        .title { font-size: 20px; font-weight: 800; color: #0f172a; margin: 0; }
        .subtitle { font-size: 11px; color: #64748b; margin-top: 4px; }
        .badge { display: inline-block; background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 10px; text-transform: uppercase; }
        .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px; }
        .card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; background: #f8fafc; }
        .card-lbl { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #64748b; }
        .card-val { font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 3px; font-family: monospace; }
        .red { color: #dc2626; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background: #0f172a; color: #ffffff; text-transform: uppercase; font-size: 9px; padding: 6px 8px; text-align: left; }
        th.r, td.r { text-align: right; }
        td { border-bottom: 1px solid #f1f5f9; padding: 6px 8px; }
        .mono { font-family: monospace; font-weight: 600; }
        .sig-section { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; }
        .sig-box { border-top: 1px solid #0f172a; padding-top: 6px; text-align: center; font-size: 11px; }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <h1 class="title">${companyName}</h1>
            <p class="subtitle">Official Expiry, FEFO Risk &amp; Quarantine Audit Form | Outlet: ${activeOutlet?.outlet_name || 'Main Pharmacy'}</p>
            <span class="badge">Pharmacy and Poisons Board Compliance Form</span>
        </div>
        <div style="text-align: right;">
            <p style="font-size: 12px; font-weight: 700; margin: 0;">Date: ${new Date().toLocaleDateString('en-GB')}</p>
            <p style="font-size: 10px; color: #64748b; margin-top: 2px;">Time: ${new Date().toLocaleTimeString()}</p>
        </div>
    </div>

    <div class="cards">
        <div class="card">
            <div class="card-lbl">Expired Stock Outlay</div>
            <div class="card-val red">KES ${summaryMetrics.expiredCost.toLocaleString()}</div>
        </div>
        <div class="card">
            <div class="card-lbl">Critical &lt; 30 Days</div>
            <div class="card-val" style="color:#d97706;">KES ${summaryMetrics.criticalCost.toLocaleString()}</div>
        </div>
        <div class="card">
            <div class="card-lbl">Impending (31-90 Days)</div>
            <div class="card-val">KES ${summaryMetrics.ninetyDaysCost.toLocaleString()}</div>
        </div>
        <div class="card">
            <div class="card-lbl">Monitored Inventory</div>
            <div class="card-val">${summaryMetrics.totalPieces} pieces (${summaryMetrics.totalActiveBatches} batches)</div>
        </div>
    </div>

    <h3 style="font-size: 12px; font-weight: 800; margin-top: 15px; margin-bottom: 4px; text-transform: uppercase;">
        Priority Action List: Expired &amp; Critical (&lt; 30 Days) Batches
    </h3>

    <table>
        <thead>
            <tr>
                <th>Drug Name</th>
                <th>Batch #</th>
                <th>Supplier</th>
                <th>Expiry Date</th>
                <th>Days</th>
                <th class="r">Stock On Hand</th>
                <th class="r">Unit Cost</th>
                <th class="r">Capital at Risk</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
            ${criticalBatches.slice(0, 100).map((b) => `
                <tr>
                    <td><strong>${b.product_name}</strong> <span style="font-size:9px;color:#64748b;">(${b.product_code})</span></td>
                    <td class="mono"><strong>${b.batch_number}</strong></td>
                    <td>${b.supplier_name}</td>
                    <td class="mono">${b.expiry_date}</td>
                    <td class="mono ${b.days_until < 0 ? 'red' : ''}"><strong>${b.days_until < 0 ? 'EXPIRED (' + Math.abs(b.days_until) + 'd)' : b.days_until + 'd'}</strong></td>
                    <td class="r mono">${b.remaining_qty} ${b.sales_unit} (${b.box_breakdown})</td>
                    <td class="r mono">KES ${b.unit_cost.toFixed(2)}</td>
                    <td class="r mono ${b.days_until < 0 ? 'red' : ''}">KES ${b.capital_at_risk.toLocaleString()}</td>
                    <td><strong>${b.status}</strong></td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <div class="sig-section">
        <div class="sig-box">
            Superintendent Pharmacist Signature &amp; Official Stamp
        </div>
        <div class="sig-box">
            Pharmacy Quality Auditor / Witness Signature
        </div>
    </div>

    <script>window.onload = function() { window.print(); };</script>
</body>
</html>`;

        printWindow.document.write(html);
        printWindow.document.close();
    };

    // ==================== RENDER ====================
    return (
        <div className="space-y-6 pb-20 font-sans">
            {/* Top Command Banner */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-rose-50 via-amber-50/30 to-transparent rounded-full pointer-events-none -mr-20 -mt-20"></div>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-600 flex items-center justify-center text-white shadow-md shadow-rose-500/20">
                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                                    Expiry &amp; FEFO Intelligence Hub
                                </h1>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300">
                                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                                    FEFO REALTIME AUDIT
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 font-medium mt-1">
                                Full batch traceability, countdown lifespans, capital at risk stratification &amp; regulatory disposal safeguards
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                        <button
                            onClick={() => loadExpiryData(true)}
                            disabled={refreshing}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors border border-slate-200"
                        >
                            <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            {refreshing ? 'Syncing...' : 'Sync Live'}
                        </button>
                        <button
                            onClick={exportExcelXLS}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm shadow-emerald-600/20"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Super Excel (.xls)
                        </button>
                        <button
                            onClick={printPPBAuditReport}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-sm"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                            PPB Audit Slip
                        </button>
                    </div>
                </div>
            </div>

            {/* 5 Super Premium Light Luxury Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* 1. Expired Stock Loss */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/90 border-t-4 border-t-rose-500 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Expired Stock Loss</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-rose-100 text-rose-800">
                            {summaryMetrics.expiredCount} batches
                        </span>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl font-black text-rose-600 font-mono tracking-tight">
                            KES {summaryMetrics.expiredCost.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium mt-1">
                            {summaryMetrics.expiredUnits} units expired on shelves
                        </div>
                    </div>
                </div>

                {/* 2. Critical < 30 Days Risk */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/90 border-t-4 border-t-amber-500 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Critical (&lt; 30 Days)</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-100 text-amber-800">
                            {summaryMetrics.criticalCount} batches
                        </span>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl font-black text-amber-600 font-mono tracking-tight">
                            KES {summaryMetrics.criticalCost.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium mt-1">
                            Urgent FEFO dispensing required
                        </div>
                    </div>
                </div>

                {/* 3. 31 - 90 Days Horizon */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/90 border-t-4 border-t-yellow-500 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Horizon (31-90 Days)</span>
                        <span className="w-8 h-8 rounded-lg bg-yellow-50 text-yellow-700 flex items-center justify-center font-bold text-xs">
                            90D
                        </span>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
                            KES {summaryMetrics.ninetyDaysCost.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium mt-1">
                            Mid-term exposure for supplier returns
                        </div>
                    </div>
                </div>

                {/* 4. Safe Shelf-Life (> 90 Days) */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/90 border-t-4 border-t-emerald-500 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Safe Inventory (&gt; 90D)</span>
                        <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
                            SAFE
                        </span>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl font-black text-emerald-700 font-mono tracking-tight">
                            KES {summaryMetrics.safeCost.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium mt-1">
                            Secure capital with healthy shelf-life
                        </div>
                    </div>
                </div>

                {/* 5. Monitored Batches & Integrity */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/90 border-t-4 border-t-cyan-500 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Monitored Batches</span>
                        <span className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center font-bold text-xs">
                            FEFO
                        </span>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
                            {summaryMetrics.totalActiveBatches}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium mt-1">
                            {summaryMetrics.totalPieces.toLocaleString()} pieces tracked live
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter and Control Bar */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm space-y-3">
                {/* Fast Horizon Pills */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-slate-500 mr-1">Risk Horizon:</span>
                        {[
                            { key: 'ALL', label: 'All Batches' },
                            { key: 'EXPIRED', label: '🚨 Expired Only' },
                            { key: '30D', label: '⚠️ Critical (<30d)' },
                            { key: '60D', label: '⏳ 31-60 Days' },
                            { key: '90D', label: '🟡 61-90 Days' },
                            { key: '180D', label: '🟢 91-180 Days' },
                            { key: 'SAFE', label: '🛡️ Safe (>180d)' },
                            { key: 'CRITICAL_ALL', label: '🔥 All At-Risk (<=60d)' },
                        ].map((btn) => (
                            <button
                                key={btn.key}
                                onClick={() => handleHorizonChange(btn.key)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                    selectedHorizon === btn.key
                                        ? 'bg-slate-900 text-white shadow-sm'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                {btn.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="border-t border-slate-100 pt-3 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2.5 flex-1 min-w-[280px]">
                        <div className="relative flex-1">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </span>
                            <input
                                type="text"
                                placeholder="Search by drug name, code, batch #, or supplier..."
                                value={searchQuery}
                                onChange={(e) => handleSearchChange(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
                            />
                        </div>

                        <select
                            value={selectedCategory}
                            onChange={(e) => handleCategoryChange(e.target.value)}
                            className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
                        >
                            <option value="ALL">All Categories ({categoriesList.length})</option>
                            {categoriesList.map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>

                        <select
                            value={selectedSupplier}
                            onChange={(e) => handleSupplierChange(e.target.value)}
                            className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
                        >
                            <option value="ALL">All Suppliers ({suppliersList.length})</option>
                            {suppliersList.map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>

                        <select
                            value={selectedStatus}
                            onChange={(e) => handleStatusChange(e.target.value)}
                            className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
                        >
                            <option value="ALL">All Statuses</option>
                            <option value="active">Active</option>
                            <option value="expired">Expired</option>
                            <option value="quarantined">Quarantined</option>
                            <option value="disposed">Disposed</option>
                        </select>

                        <select
                            value={sortBy}
                            onChange={(e) => {
                                setSortBy(e.target.value as any);
                                setPageMaster(1);
                            }}
                            className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
                        >
                            <option value="fefo_asc">FEFO: Earliest Expiry First</option>
                            <option value="expiry_desc">Latest Expiry First</option>
                            <option value="risk_val_desc">Highest Capital at Risk</option>
                            <option value="qty_desc">Highest Stock Quantity</option>
                        </select>
                    </div>

                    <div className="text-xs font-bold text-slate-500">
                        Showing <span className="text-rose-600 font-extrabold">{filteredBatches.length}</span> matching batches
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
                {[
                    { id: 'overview', label: '📊 Risk Analytics & Forecast', count: null },
                    { id: 'critical', label: '🚨 Immediate Action Center', count: criticalBatches.length },
                    { id: 'master', label: '📋 Master FEFO Expiry Ledger', count: filteredBatches.length },
                    { id: 'categories', label: '🏷️ Category Exposure Matrix', count: categoryAggregates.length },
                    { id: 'suppliers', label: '🏢 Supplier Return Risk', count: supplierAggregates.length },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => {
                            setActiveTab(tab.id as any);
                        }}
                        className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 ${
                            activeTab === tab.id
                                ? 'bg-slate-900 text-white shadow-sm'
                                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                        }`}
                    >
                        {tab.label}
                        {tab.count !== null && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                                activeTab === tab.id ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-700'
                            }`}>
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* ==================== TAB 1: VISUAL RISK INTELLIGENCE ==================== */}
            {activeTab === 'overview' && (
                <div className="space-y-6">
                    {/* Monthly Projected Expiration Bar Chart */}
                    <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm">
                        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                            <div>
                                <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full bg-rose-500"></span>
                                    Impending Expiration Forecast Timeline (Next 12 Months)
                                </h3>
                                <p className="text-xs text-slate-500 font-medium mt-0.5">
                                    Anticipated monthly batch expirations and capital value exposed across upcoming quarters
                                </p>
                            </div>
                            <div className="flex items-center gap-4 text-xs font-bold text-slate-600">
                                <span className="flex items-center gap-1.5">
                                    <span className="w-3 h-3 rounded-full bg-rose-500"></span> Capital at Risk (KES)
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="w-3 h-3 rounded-full bg-slate-500"></span> Batches Count
                                </span>
                            </div>
                        </div>

                        <div className="h-80 w-full">
                            <Bar
                                data={monthlyProjectionData}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                        legend: { display: false },
                                        tooltip: {
                                            backgroundColor: '#0f172a',
                                            titleFont: { size: 12, weight: 'bold' },
                                            bodyFont: { size: 11, family: 'monospace' },
                                            padding: 10,
                                            callbacks: {
                                                label: (ctx) => {
                                                    if (ctx.datasetIndex === 0) return ` Capital: KES ${Number(ctx.parsed.y).toLocaleString()}`;
                                                    return ` Batches: ${ctx.parsed.y} batches`;
                                                },
                                            },
                                        },
                                    },
                                    scales: {
                                        y: {
                                            beginAtZero: true,
                                            grid: { color: '#f1f5f9' },
                                            ticks: {
                                                font: { size: 10, family: 'monospace' },
                                                callback: (val) => `KES ${Number(val).toLocaleString()}`,
                                            },
                                        },
                                        y1: {
                                            position: 'right',
                                            beginAtZero: true,
                                            grid: { display: false },
                                            ticks: { font: { size: 10, family: 'monospace' } },
                                        },
                                        x: {
                                            grid: { display: false },
                                            ticks: { font: { size: 10, weight: 'bold' } },
                                        },
                                    },
                                }}
                            />
                        </div>
                    </div>

                    {/* Mid Charts: Doughnut & Category Breakdown */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Horizon Stratification Doughnut */}
                        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm">
                            <h3 className="text-base font-black text-slate-900 tracking-tight mb-1 flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                                Capital Risk Stratification
                            </h3>
                            <p className="text-xs text-slate-500 font-medium mb-4">
                                Proportional capital outlay by expiration horizon
                            </p>
                            <div className="h-60 w-full relative">
                                <Doughnut
                                    data={horizonDoughnutData}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: {
                                            legend: {
                                                position: 'bottom',
                                                labels: { font: { size: 9, weight: 'bold' }, boxWidth: 10 },
                                            },
                                            tooltip: {
                                                callbacks: {
                                                    label: (ctx) => ` ${ctx.label}: KES ${Number(ctx.parsed).toLocaleString()}`,
                                                },
                                            },
                                        },
                                        cutout: '68%',
                                    }}
                                />
                            </div>
                        </div>

                        {/* Top Categories at Risk Bar */}
                        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm">
                            <h3 className="text-base font-black text-slate-900 tracking-tight mb-1 flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-rose-500"></span>
                                Top Therapeutic Categories with Impending Risk
                            </h3>
                            <p className="text-xs text-slate-500 font-medium mb-4">
                                Categories bearing highest expired and critical stock valuation
                            </p>
                            <div className="h-64 w-full">
                                <Bar
                                    data={{
                                        labels: categoryAggregates.slice(0, 8).map((c) => c.category),
                                        datasets: [
                                            {
                                                label: 'Expired Loss (KES)',
                                                data: categoryAggregates.slice(0, 8).map((c) => Math.round(c.expired_value)),
                                                backgroundColor: 'rgba(239, 68, 68, 0.85)',
                                                borderRadius: 6,
                                            },
                                            {
                                                label: 'Critical < 30d (KES)',
                                                data: categoryAggregates.slice(0, 8).map((c) => Math.round(c.critical_value)),
                                                backgroundColor: 'rgba(245, 158, 11, 0.85)',
                                                borderRadius: 6,
                                            },
                                        ],
                                    }}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: {
                                            legend: {
                                                position: 'top',
                                                labels: { font: { size: 10, weight: 'bold' }, boxWidth: 10 },
                                            },
                                            tooltip: {
                                                callbacks: {
                                                    label: (ctx) => ` ${ctx.dataset.label}: KES ${Number(ctx.parsed.y).toLocaleString()}`,
                                                },
                                            },
                                        },
                                        scales: {
                                            y: {
                                                beginAtZero: true,
                                                grid: { color: '#f1f5f9' },
                                                ticks: {
                                                    font: { size: 10, family: 'monospace' },
                                                    callback: (val) => `KES ${Number(val).toLocaleString()}`,
                                                },
                                            },
                                            x: {
                                                grid: { display: false },
                                                ticks: { font: { size: 10, weight: 'bold' } },
                                            },
                                        },
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ==================== TAB 2: IMMEDIATE ACTION CENTER ==================== */}
            {activeTab === 'critical' && (
                <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-200 bg-rose-50/40 flex items-center justify-between flex-wrap gap-3">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-rose-600 animate-pulse"></span>
                                <h3 className="text-base font-black text-rose-950 tracking-tight">
                                    Priority Action Center: Expired &amp; Imminent (&lt; 30 Days) Batches
                                </h3>
                            </div>
                            <p className="text-xs text-rose-700 font-medium mt-0.5">
                                Batches requiring immediate physical quarantine, fast-dispensing or supplier return credit notes
                            </p>
                        </div>
                        <div className="text-xs font-bold text-rose-800">
                            {criticalBatches.length} critical batches requiring attention
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-900 border-b-2 border-emerald-500 text-white font-black uppercase text-[11px] tracking-wider">
                                    <th className="py-3 px-4">Drug / Pharmaceutical</th>
                                    <th className="py-3 px-3">Batch #</th>
                                    <th className="py-3 px-3">Supplier</th>
                                    <th className="py-3 px-3 text-center">Expiry Date</th>
                                    <th className="py-3 px-3 text-center">Countdown</th>
                                    <th className="py-3 px-3 text-right">In Stock (Pcs / Boxes)</th>
                                    <th className="py-3 px-3 text-right">Capital at Risk</th>
                                    <th className="py-3 px-3 text-center">Status</th>
                                    <th className="py-3 px-4 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                                {criticalBatches.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="py-12 text-center text-slate-400 font-medium">
                                            🎉 Zero batches currently expired or under 30-day critical threshold!
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedCriticalBatches.map((b) => (
                                        <tr key={b.batch_id} className="hover:bg-rose-50/40 transition-colors">
                                            <td className="py-3.5 px-4 font-bold text-slate-900">
                                                <div>
                                                    <span className="font-extrabold text-slate-900">{b.product_name}</span>
                                                    <span className="text-[10px] text-slate-500 font-mono ml-1.5">({b.product_code})</span>
                                                </div>
                                                <div className="text-[10px] text-slate-400 font-normal">{b.category}</div>
                                            </td>
                                            <td className="py-3.5 px-3 font-mono font-bold text-slate-800">
                                                {b.batch_number}
                                            </td>
                                            <td className="py-3.5 px-3 text-slate-600 font-medium">
                                                {b.supplier_name}
                                            </td>
                                            <td className="py-3.5 px-3 text-center font-mono font-bold text-slate-900">
                                                {b.expiry_date}
                                            </td>
                                            <td className="py-3.5 px-3 text-center">
                                                <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black font-mono ${
                                                    b.days_until < 0
                                                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                                                }`}>
                                                    {b.days_until < 0 ? `EXPIRED (${Math.abs(b.days_until)}d ago)` : `${b.days_until} days left`}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-900">
                                                <div>{b.remaining_qty} {b.sales_unit}</div>
                                                <div className="text-[10px] text-slate-500 font-normal">{b.box_breakdown}</div>
                                            </td>
                                            <td className="py-3.5 px-3 text-right font-mono font-black text-rose-600">
                                                KES {b.capital_at_risk.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                            <td className="py-3.5 px-3 text-center">
                                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                    b.status === 'Quarantined' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-700'
                                                }`}>
                                                    {b.status}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4 text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <button
                                                        onClick={() => {
                                                            setActionBatch(b);
                                                            setActionType('quarantine');
                                                        }}
                                                        className="px-2.5 py-1 bg-purple-600 text-white rounded-lg text-[10px] font-black uppercase hover:bg-purple-700 shadow-sm"
                                                    >
                                                        Quarantine
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setActionBatch(b);
                                                            setActionType('dispose');
                                                        }}
                                                        className="px-2.5 py-1 bg-rose-600 text-white rounded-lg text-[10px] font-black uppercase hover:bg-rose-700 shadow-sm"
                                                    >
                                                        Dispose
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Dedicated Pagination for Critical Center */}
                    {criticalBatches.length > 0 && (
                        <PaginationFooter
                            currentPage={pageCritical}
                            totalItems={criticalBatches.length}
                            pageSize={pageSizeCritical}
                            onPageChange={setPageCritical}
                            onPageSizeChange={setPageSizeCritical}
                            itemLabel="critical batches"
                        />
                    )}
                </div>
            )}

            {/* ==================== TAB 3: MASTER FEFO EXPIRY LEDGER ==================== */}
            {activeTab === 'master' && (
                <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between flex-wrap gap-3">
                        <div>
                            <h3 className="text-base font-black text-slate-900 tracking-tight">
                                Master FEFO Expiry &amp; Batch Traceability Ledger
                            </h3>
                            <p className="text-xs text-slate-500 font-medium">
                                Complete inventory batch breakdown prioritized by First-Expired, First-Out sequence
                            </p>
                        </div>
                        <div className="text-xs font-bold text-slate-600">
                            Total Batches Monitored: <span className="text-rose-600 font-extrabold">{filteredBatches.length}</span>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-900 border-b-2 border-emerald-500 text-white font-black uppercase text-[11px] tracking-wider">
                                    <th className="py-3 px-4">Batch #</th>
                                    <th className="py-3 px-3">Drug / Pharmaceutical</th>
                                    <th className="py-3 px-3">Category</th>
                                    <th className="py-3 px-3">Supplier</th>
                                    <th className="py-3 px-3 text-center">Expiry Date</th>
                                    <th className="py-3 px-3 text-center">Lifespan Status</th>
                                    <th className="py-3 px-3 text-right">In Stock (Pcs / Boxes)</th>
                                    <th className="py-3 px-3 text-right">Unit Cost</th>
                                    <th className="py-3 px-3 text-right">Capital at Risk</th>
                                    <th className="py-3 px-4 text-center">Manage</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                                {loading ? (
                                    <tr>
                                        <td colSpan={10} className="py-12 text-center text-slate-400">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
                                                <span>Compiling batch traceability ledger...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredBatches.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className="py-12 text-center text-slate-400 font-medium">
                                            No batches found matching selected filters
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedMasterBatches.map((b) => (
                                        <tr key={b.batch_id} className="hover:bg-emerald-50/30 transition-colors">
                                            <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                                                {b.batch_number}
                                            </td>
                                            <td className="py-3.5 px-3 font-bold text-slate-900">
                                                <div>{b.product_name}</div>
                                                <div className="text-[10px] text-slate-400 font-mono">{b.product_code}</div>
                                            </td>
                                            <td className="py-3.5 px-3">
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                                                    {b.category}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-3 text-slate-600 font-medium">
                                                {b.supplier_name}
                                            </td>
                                            <td className="py-3.5 px-3 text-center font-mono font-bold text-slate-800">
                                                {b.expiry_date}
                                            </td>
                                            <td className="py-3.5 px-3 text-center">
                                                <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black font-mono ${
                                                    b.days_until < 0
                                                        ? 'bg-rose-100 text-rose-800'
                                                        : b.days_until <= 30
                                                        ? 'bg-amber-100 text-amber-800'
                                                        : b.days_until <= 90
                                                        ? 'bg-yellow-100 text-yellow-800'
                                                        : 'bg-emerald-100 text-emerald-800'
                                                }`}>
                                                    {b.days_until < 0 ? `EXPIRED (${Math.abs(b.days_until)}d)` : `${b.days_until}d left`}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-900">
                                                <div>{b.remaining_qty} {b.sales_unit}</div>
                                                <div className="text-[10px] text-slate-500 font-normal">{b.box_breakdown}</div>
                                            </td>
                                            <td className="py-3.5 px-3 text-right font-mono text-slate-700">
                                                KES {b.unit_cost.toFixed(2)}
                                            </td>
                                            <td className={`py-3.5 px-3 text-right font-mono font-black ${
                                                b.days_until < 0 ? 'text-rose-600' : 'text-slate-900'
                                            }`}>
                                                KES {b.capital_at_risk.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                            <td className="py-3.5 px-4 text-center">
                                                <button
                                                    onClick={() => {
                                                        setActionBatch(b);
                                                        setActionType('quarantine');
                                                    }}
                                                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold border border-slate-200 transition-colors"
                                                >
                                                    Manage
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Dedicated Pagination for Master FEFO Ledger */}
                    <PaginationFooter
                        currentPage={pageMaster}
                        totalItems={filteredBatches.length}
                        pageSize={pageSizeMaster}
                        onPageChange={setPageMaster}
                        onPageSizeChange={setPageSizeMaster}
                        itemLabel="batches"
                    />
                </div>
            )}

            {/* ==================== TAB 4: CATEGORY RISK MATRIX ==================== */}
            {activeTab === 'categories' && (
                <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between flex-wrap gap-3">
                        <div>
                            <h3 className="text-base font-black text-slate-900 tracking-tight">
                                Category Expiry &amp; Risk Stratification Matrix
                            </h3>
                            <p className="text-xs text-slate-500 font-medium">
                                Breakdown of expired and critical capital risk grouped by therapeutic category
                            </p>
                        </div>
                        <div className="text-xs font-bold text-slate-600">
                            Total Categories: <span className="text-slate-900 font-extrabold">{categoryAggregates.length}</span>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-900 border-b-2 border-emerald-500 text-white font-black uppercase text-[11px] tracking-wider">
                                    <th className="py-3 px-4">Therapeutic Category</th>
                                    <th className="py-3 px-3 text-right">Total Batches</th>
                                    <th className="py-3 px-3 text-right">Expired Batches</th>
                                    <th className="py-3 px-3 text-right">Expired Loss (KES)</th>
                                    <th className="py-3 px-3 text-right">Critical (&lt; 30d)</th>
                                    <th className="py-3 px-3 text-right">Safe Inventory (KES)</th>
                                    <th className="py-3 px-4 text-right">Total Exposure (KES)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                                {paginatedCategories.map((c) => (
                                    <tr key={c.category} className="hover:bg-slate-50 transition-colors">
                                        <td className="py-3.5 px-4 font-bold text-slate-900">
                                            {c.category}
                                        </td>
                                        <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-700">
                                            {c.total_batches}
                                        </td>
                                        <td className="py-3.5 px-3 text-right font-mono font-bold text-rose-600">
                                            {c.expired_count}
                                        </td>
                                        <td className="py-3.5 px-3 text-right font-mono font-black text-rose-600">
                                            KES {c.expired_value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="py-3.5 px-3 text-right font-mono font-bold text-amber-600">
                                            KES {c.critical_value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="py-3.5 px-3 text-right font-mono text-emerald-700 font-bold">
                                            KES {c.safe_value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="py-3.5 px-4 text-right font-mono font-black text-slate-900">
                                            KES {c.total_capital_at_risk.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Dedicated Pagination for Category Matrix */}
                    <PaginationFooter
                        currentPage={pageCategory}
                        totalItems={categoryAggregates.length}
                        pageSize={pageSizeCategory}
                        onPageChange={setPageCategory}
                        onPageSizeChange={setPageSizeCategory}
                        itemLabel="categories"
                    />
                </div>
            )}

            {/* ==================== TAB 5: SUPPLIER RISK ANALYSIS ==================== */}
            {activeTab === 'suppliers' && (
                <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between flex-wrap gap-3">
                        <div>
                            <h3 className="text-base font-black text-slate-900 tracking-tight">
                                Supplier Expiration Exposure &amp; Return Claims
                            </h3>
                            <p className="text-xs text-slate-500 font-medium">
                                Supplier risk audit to initiate return claims and debit notes for expiring stock
                            </p>
                        </div>
                        <div className="text-xs font-bold text-slate-600">
                            Total Suppliers: <span className="text-slate-900 font-extrabold">{supplierAggregates.length}</span>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-900 border-b-2 border-emerald-500 text-white font-black uppercase text-[11px] tracking-wider">
                                    <th className="py-3 px-4">Supplier Name</th>
                                    <th className="py-3 px-3 text-right">Batches Supplied</th>
                                    <th className="py-3 px-3 text-right">Expired Stock Value</th>
                                    <th className="py-3 px-3 text-right">Impending Risk (&lt; 60d)</th>
                                    <th className="py-3 px-4 text-right">Total Supplier Exposure</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                                {paginatedSuppliers.map((s) => (
                                    <tr key={s.supplier_name} className="hover:bg-slate-50 transition-colors">
                                        <td className="py-3.5 px-4 font-bold text-slate-900">
                                            {s.supplier_name}
                                        </td>
                                        <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-700">
                                            {s.batch_count}
                                        </td>
                                        <td className="py-3.5 px-3 text-right font-mono font-black text-rose-600">
                                            KES {s.expired_value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="py-3.5 px-3 text-right font-mono font-bold text-amber-600">
                                            KES {s.impending_value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="py-3.5 px-4 text-right font-mono font-black text-slate-900">
                                            KES {s.total_exposure.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Dedicated Pagination for Supplier Ledger */}
                    <PaginationFooter
                        currentPage={pageSupplier}
                        totalItems={supplierAggregates.length}
                        pageSize={pageSizeSupplier}
                        onPageChange={setPageSupplier}
                        onPageSizeChange={setPageSizeSupplier}
                        itemLabel="suppliers"
                    />
                </div>
            )}

            {/* ==================== ACTION / QUARANTINE MODAL ==================== */}
            {actionBatch && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xl max-w-lg w-full space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="text-base font-black text-slate-900">
                                Regulatory Action: {actionBatch.batch_number}
                            </h3>
                            <button
                                onClick={() => setActionBatch(null)}
                                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="bg-slate-50 rounded-2xl p-4 text-xs space-y-1.5">
                            <div className="font-extrabold text-slate-900 text-sm">{actionBatch.product_name}</div>
                            <div className="text-slate-500 font-mono">Code: {actionBatch.product_code} • Supplier: {actionBatch.supplier_name}</div>
                            <div className="flex items-center justify-between pt-2 border-t border-slate-200 font-mono">
                                <span>Remaining Stock: <strong>{actionBatch.remaining_qty} {actionBatch.sales_unit}</strong> ({actionBatch.box_breakdown})</span>
                                <span className="text-rose-600 font-bold">Risk: KES {actionBatch.capital_at_risk.toLocaleString()}</span>
                            </div>
                        </div>

                        <div className="space-y-3 text-xs">
                            <div>
                                <label className="font-bold text-slate-700 block mb-1">Select Regulatory Action:</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setActionType('quarantine')}
                                        className={`py-2 px-3 rounded-xl font-bold border text-center ${
                                            actionType === 'quarantine'
                                                ? 'bg-purple-600 text-white border-purple-600'
                                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                        }`}
                                    >
                                        Quarantine Batch
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActionType('dispose')}
                                        className={`py-2 px-3 rounded-xl font-bold border text-center ${
                                            actionType === 'dispose'
                                                ? 'bg-rose-600 text-white border-rose-600'
                                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                        }`}
                                    >
                                        Mark for Disposal
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="font-bold text-slate-700 block mb-1">Reason / Disposal Protocol:</label>
                                <select
                                    value={actionReason}
                                    onChange={(e) => setActionReason(e.target.value)}
                                    className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold text-slate-800 bg-white"
                                >
                                    <option value="Expired medication past regulatory shelf-life">Expired medication past regulatory shelf-life</option>
                                    <option value="Packaging compromised or seal broken">Packaging compromised or seal broken</option>
                                    <option value="Regulatory Pharmacy and Poisons Board Recall">Regulatory Pharmacy and Poisons Board Recall</option>
                                    <option value="Supplier return authorization pending">Supplier return authorization pending</option>
                                    <option value="Temperature excursion / Cold-chain break">Temperature excursion / Cold-chain break</option>
                                </select>
                            </div>

                            <div>
                                <label className="font-bold text-slate-700 block mb-1">Pharmacist Compliance Notes:</label>
                                <textarea
                                    value={actionNotes}
                                    onChange={(e) => setActionNotes(e.target.value)}
                                    placeholder="Enter physical quarantine bin ID, disposal witness, or notes..."
                                    className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold text-slate-800"
                                    rows={2}
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                            <button
                                onClick={() => setActionBatch(null)}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleBatchAction}
                                disabled={actionLoading}
                                className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
                            >
                                {actionLoading ? 'Processing...' : 'Confirm Regulatory Action'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
