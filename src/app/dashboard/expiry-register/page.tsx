'use client';
// =====================================================================
// Alpha Pharmacy - Super Detailed Expiry Register & Audit System v2.0
// Ultra-Premium Edition with FEFO Tracking, Massive Styled Excel,
// Regulatory Print/PDF Engine, Risk Stratification & Disposal Management
// =====================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

export interface ExpiryItem {
    batch_id: number;
    product_id: number;
    batch_number: string;
    expiry_date: string;
    manufacture_date: string;
    remaining_qty: number;
    quantity: number;
    purchase_cost: number;
    selling_price: number;
    supplier_id?: number;
    supplier_name: string;
    purchase_invoice?: string;
    status: string;
    notes?: string;
    product_name: string;
    category: string;
    generic_name: string;
    drug_type: string;
    dosage?: string;
    manufacturer?: string;
    barcode?: string;
    sales_unit?: string;
}

const getDaysUntil = (dateStr: string) => {
    if (!dateStr) return 0;
    const target = new Date(dateStr).getTime();
    const now = new Date().setHours(0, 0, 0, 0);
    return Math.ceil((target - now) / 86400000);
};

const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
        return dateStr;
    }
};

const escapeXml = (unsafe: any): string => {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
};

export default function ExpiryRegisterPage() {
    const { activeOutlet } = useOutlet();
    const outletId = activeOutlet?.outlet_id || 1;
    const outletName = activeOutlet?.outlet_name || 'Alpha Pharmacy Main';

    // Core Data
    const [items, setItems] = useState<ExpiryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);

    // Filters
    const [search, setSearch] = useState('');
    const [filterDays, setFilterDays] = useState<number | 'all' | 'expired'>(90);
    const [filterStatus, setFilterStatus] = useState('All');
    const [filterCategory, setFilterCategory] = useState('All');
    const [filterDrugType, setFilterDrugType] = useState('All');
    const [filterRiskValue, setFilterRiskValue] = useState('All');
    const [filterStockLevel, setFilterStockLevel] = useState('All');
    const [sortBy, setSortBy] = useState<
        'expiry_asc' | 'expiry_desc' | 'loss_desc' | 'retail_desc' | 'qty_desc' | 'qty_asc' | 'name_asc' | 'margin_desc'
    >('expiry_asc');

    // Pagination
    const [pageSize, setPageSize] = useState<number>(50);
    const [currentPage, setCurrentPage] = useState<number>(1);

    // Modals & Drawers
    const [detailItem, setDetailItem] = useState<ExpiryItem | null>(null);
    const [isAutoFit, setIsAutoFit] = useState<boolean>(true);
    const [showDisposeModal, setShowDisposeModal] = useState(false);
    const [disposeTarget, setDisposeTarget] = useState<ExpiryItem | null>(null);
    const [isBulkDispose, setIsBulkDispose] = useState(false);
    const [disposeReason, setDisposeReason] = useState('Expired');
    const [disposeMethod, setDisposeMethod] = useState('Incineration / Regulated Disposal');
    const [disposeOfficer, setDisposeOfficer] = useState('');
    const [disposeNotes, setDisposeNotes] = useState('');

    const [showDiscountModal, setShowDiscountModal] = useState(false);
    const [discountTarget, setDiscountTarget] = useState<ExpiryItem | null>(null);
    const [discountPct, setDiscountPct] = useState<number>(20);
    const [customNewPrice, setCustomNewPrice] = useState<string>('');

    // Load Live Batches from Supabase
    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('pharmacy_batches')
                .select(`
                    *,
                    pharmacy_products!inner(
                        product_name,
                        category,
                        generic_name,
                        drug_type,
                        dosage,
                        manufacturer,
                        supplier_name,
                        barcode,
                        sales_unit,
                        purchase_cost,
                        sales_cost
                    )
                `)
                .eq('outlet_id', outletId)
                .gt('remaining_qty', 0)
                .order('expiry_date', { ascending: true });

            if (error) {
                toast.error(`Failed to load expiry records: ${error.message}`);
                setLoading(false);
                return;
            }

            const mapped: ExpiryItem[] = (data || []).map((b: any) => {
                const prod = b.pharmacy_products || {};
                return {
                    batch_id: b.batch_id,
                    product_id: b.product_id,
                    batch_number: b.batch_number || 'N/A',
                    expiry_date: b.expiry_date,
                    manufacture_date: b.manufacture_date || '',
                    remaining_qty: Number(b.remaining_qty || 0),
                    quantity: Number(b.quantity || b.remaining_qty || 0),
                    purchase_cost: Number(b.purchase_cost ?? prod.purchase_cost ?? 0),
                    selling_price: Number(b.selling_price ?? prod.sales_cost ?? 0),
                    supplier_id: b.supplier_id,
                    supplier_name: b.supplier_name || prod.supplier_name || 'Direct Wholesale',
                    purchase_invoice: b.purchase_invoice || '',
                    status: b.status || 'Active',
                    notes: b.notes || '',
                    product_name: prod.product_name || 'Unknown Product',
                    category: prod.category || 'General',
                    generic_name: prod.generic_name || '',
                    drug_type: prod.drug_type || 'Medicine',
                    dosage: prod.dosage || '',
                    manufacturer: prod.manufacturer || '',
                    barcode: prod.barcode || '',
                    sales_unit: prod.sales_unit || 'Unit',
                };
            });

            setItems(mapped);
            setSelectedIds([]);
        } catch (err: any) {
            toast.error(`Error: ${err?.message || 'Failed to connect'}`);
        } finally {
            setLoading(false);
        }
    }, [outletId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Unique Categories & Drug Formulations
    const categories = useMemo(() => {
        return Array.from(new Set(items.map((i) => i.category).filter(Boolean))).sort();
    }, [items]);

    const drugTypes = useMemo(() => {
        return Array.from(new Set(items.map((i) => i.drug_type).filter(Boolean))).sort();
    }, [items]);

    // The 6 EXACT Summary Metrics Preserved
    const allExpired = useMemo(() => items.filter((i) => getDaysUntil(i.expiry_date) < 0), [items]);
    const expIn7 = useMemo(() => items.filter((i) => {
        const d = getDaysUntil(i.expiry_date);
        return d >= 0 && d <= 7;
    }), [items]);
    const expIn30 = useMemo(() => items.filter((i) => {
        const d = getDaysUntil(i.expiry_date);
        return d >= 0 && d <= 30;
    }), [items]);
    const expIn90 = useMemo(() => items.filter((i) => {
        const d = getDaysUntil(i.expiry_date);
        return d >= 0 && d <= 90;
    }), [items]);

    const sumPurchase = (arr: ExpiryItem[]) => arr.reduce((s, i) => s + (i.purchase_cost * i.remaining_qty), 0);
    const sumRetail = (arr: ExpiryItem[]) => arr.reduce((s, i) => s + (i.selling_price * i.remaining_qty), 0);

    // Multi-Dimensional Filtering & Sorting
    const filtered = useMemo(() => {
        return items
            .filter((item) => {
                const days = getDaysUntil(item.expiry_date);

                // Quick horizon
                if (filterDays === 'expired' && days >= 0) return false;
                if (typeof filterDays === 'number' && days > filterDays && days >= 0) return false;

                // Status Filter
                if (filterStatus === 'Expired' && days >= 0) return false;
                if (filterStatus === 'Active' && days < 0) return false;
                if (filterStatus === 'Critical' && (days < 0 || days > 7)) return false;
                if (filterStatus === 'Urgent' && (days <= 7 || days > 30)) return false;
                if (filterStatus === 'Warning' && (days <= 30 || days > 90)) return false;
                if (filterStatus === 'Safe' && days <= 90) return false;

                // Category
                if (filterCategory !== 'All' && item.category !== filterCategory) return false;

                // Drug Type
                if (filterDrugType !== 'All' && item.drug_type !== filterDrugType) return false;

                // Risk Value (Purchase Loss Exposure)
                const costRisk = item.purchase_cost * item.remaining_qty;
                if (filterRiskValue === 'high' && costRisk < 10000) return false;
                if (filterRiskValue === 'medium' && (costRisk < 2000 || costRisk >= 10000)) return false;
                if (filterRiskValue === 'low' && costRisk >= 2000) return false;

                // Stock Level
                if (filterStockLevel === 'low' && item.remaining_qty > 10) return false;
                if (filterStockLevel === 'medium' && (item.remaining_qty <= 10 || item.remaining_qty > 50)) return false;
                if (filterStockLevel === 'bulk' && item.remaining_qty <= 50) return false;

                // Omni-Search
                if (search.trim()) {
                    const q = search.toLowerCase();
                    const match =
                        item.product_name.toLowerCase().includes(q) ||
                        item.batch_number.toLowerCase().includes(q) ||
                        (item.generic_name || '').toLowerCase().includes(q) ||
                        (item.barcode || '').toLowerCase().includes(q) ||
                        (item.supplier_name || '').toLowerCase().includes(q) ||
                        (item.manufacturer || '').toLowerCase().includes(q);
                    if (!match) return false;
                }

                return true;
            })
            .sort((a, b) => {
                const daysA = getDaysUntil(a.expiry_date);
                const daysB = getDaysUntil(b.expiry_date);
                const costA = a.purchase_cost * a.remaining_qty;
                const costB = b.purchase_cost * b.remaining_qty;
                const retailA = a.selling_price * a.remaining_qty;
                const retailB = b.selling_price * b.remaining_qty;

                if (sortBy === 'expiry_asc') return daysA - daysB;
                if (sortBy === 'expiry_desc') return daysB - daysA;
                if (sortBy === 'loss_desc') return costB - costA;
                if (sortBy === 'retail_desc') return retailB - retailA;
                if (sortBy === 'qty_desc') return b.remaining_qty - a.remaining_qty;
                if (sortBy === 'qty_asc') return a.remaining_qty - b.remaining_qty;
                if (sortBy === 'name_asc') return a.product_name.localeCompare(b.product_name);
                if (sortBy === 'margin_desc') {
                    const margA = a.selling_price > 0 ? ((a.selling_price - a.purchase_cost) / a.selling_price) : 0;
                    const margB = b.selling_price > 0 ? ((b.selling_price - b.purchase_cost) / b.selling_price) : 0;
                    return margB - margA;
                }
                return 0;
            });
    }, [
        items,
        search,
        filterDays,
        filterStatus,
        filterCategory,
        filterDrugType,
        filterRiskValue,
        filterStockLevel,
        sortBy,
    ]);

    // Active Filter Count
    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (search.trim()) count++;
        if (filterDays !== 90) count++;
        if (filterStatus !== 'All') count++;
        if (filterCategory !== 'All') count++;
        if (filterDrugType !== 'All') count++;
        if (filterRiskValue !== 'All') count++;
        if (filterStockLevel !== 'All') count++;
        if (sortBy !== 'expiry_asc') count++;
        return count;
    }, [search, filterDays, filterStatus, filterCategory, filterDrugType, filterRiskValue, filterStockLevel, sortBy]);

    const resetFilters = () => {
        setSearch('');
        setFilterDays(90);
        setFilterStatus('All');
        setFilterCategory('All');
        setFilterDrugType('All');
        setFilterRiskValue('All');
        setFilterStockLevel('All');
        setSortBy('expiry_asc');
        setCurrentPage(1);
    };

    // Pagination slice
    const totalPages = Math.ceil(filtered.length / (pageSize || 50)) || 1;
    const paginatedItems = useMemo(() => {
        if (pageSize === 0) return filtered;
        const start = (currentPage - 1) * pageSize;
        return filtered.slice(start, start + pageSize);
    }, [filtered, currentPage, pageSize]);

    // Selection Handlers
    const isAllSelected = paginatedItems.length > 0 && paginatedItems.every((i) => selectedIds.includes(i.batch_id));

    const toggleSelectAll = () => {
        if (isAllSelected) {
            const pageBatchIds = new Set(paginatedItems.map((i) => i.batch_id));
            setSelectedIds((prev) => prev.filter((id) => !pageBatchIds.has(id)));
        } else {
            const newIds = new Set([...selectedIds, ...paginatedItems.map((i) => i.batch_id)]);
            setSelectedIds(Array.from(newIds));
        }
    };

    const toggleSelectItem = (id: number) => {
        setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };

    // Action Recommendations
    const getRecommendation = (days: number, remainingQty: number, initialQty: number) => {
        if (days < 0) {
            return {
                label: 'Quarantine & Dispose',
                bg: 'bg-red-50 text-red-700 border-red-200',
                action: 'dispose',
                icon: '🚨',
            };
        }
        if (days <= 7) {
            return {
                label: 'Immediate 50% Clear',
                bg: 'bg-orange-50 text-orange-700 border-orange-200',
                action: 'discount',
                icon: '⚡',
            };
        }
        if (days <= 30) {
            return {
                label: 'FEFO Dispense Priority',
                bg: 'bg-amber-50 text-amber-700 border-amber-200',
                action: 'priority',
                icon: '⏳',
            };
        }
        if (days <= 90) {
            return {
                label: 'Monitor / Rotate Stock',
                bg: 'bg-yellow-50 text-yellow-800 border-yellow-200',
                action: 'monitor',
                icon: '👀',
            };
        }
        return {
            label: 'Normal Inventory',
            bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            action: 'ok',
            icon: '✅',
        };
    };

    // Badges
    const getExpiryBadge = (days: number) => {
        if (days < 0) {
            return (
                <span className="px-2.5 py-1 bg-red-600 text-white rounded-full text-xs font-bold shadow-sm inline-flex items-center gap-1 animate-pulse">
                    <span>⚠️</span> EXPIRED ({Math.abs(days)}d ago)
                </span>
            );
        }
        if (days <= 7) {
            return (
                <span className="px-2 py-0.5 bg-red-100 text-red-700 border border-red-200 rounded-full text-xs font-bold inline-flex items-center gap-1">
                    <span>🚨</span> {days}d left
                </span>
            );
        }
        if (days <= 30) {
            return (
                <span className="px-2 py-0.5 bg-orange-100 text-orange-700 border border-orange-200 rounded-full text-xs font-bold inline-flex items-center gap-1">
                    <span>⏳</span> {days}d left
                </span>
            );
        }
        if (days <= 90) {
            return (
                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 border border-yellow-200 rounded-full text-xs font-bold inline-flex items-center gap-1">
                    <span>⚠️</span> {days}d left
                </span>
            );
        }
        return (
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full text-xs font-bold inline-flex items-center gap-1">
                <span>✓</span> {days}d left
            </span>
        );
    };

    // Disposal Execution
    const executeDisposal = async () => {
        const targetIds = isBulkDispose ? selectedIds : disposeTarget ? [disposeTarget.batch_id] : [];
        if (targetIds.length === 0) {
            toast.error('No batches selected for disposal');
            return;
        }

        try {
            const { error } = await supabase
                .from('pharmacy_batches')
                .update({
                    status: 'Disposed',
                    remaining_qty: 0,
                    notes: `Disposed on ${new Date().toISOString()}; Reason: ${disposeReason}; Method: ${disposeMethod}; Officer: ${disposeOfficer || 'Super Admin'}; Notes: ${disposeNotes}`,
                })
                .in('batch_id', targetIds);

            if (error) throw error;

            toast.success(`Successfully recorded disposal of ${targetIds.length} batch(es)`);
            setShowDisposeModal(false);
            setDisposeTarget(null);
            setIsBulkDispose(false);
            loadData();
        } catch (err: any) {
            toast.error(`Disposal failed: ${err.message}`);
        }
    };

    // Discount Application
    const executeApplyDiscount = async () => {
        if (!discountTarget) return;
        const newPrice = customNewPrice ? parseFloat(customNewPrice) : Math.round(discountTarget.selling_price * (1 - discountPct / 100));

        if (isNaN(newPrice) || newPrice <= 0) {
            toast.error('Invalid price entered');
            return;
        }

        try {
            const { error } = await supabase
                .from('pharmacy_batches')
                .update({
                    selling_price: newPrice,
                    notes: `Near-expiry clearance promo set to Ksh ${newPrice} (-${discountPct}%) on ${new Date().toLocaleDateString()}`,
                })
                .eq('batch_id', discountTarget.batch_id);

            if (error) throw error;

            toast.success(`Batch ${discountTarget.batch_number} price updated to Ksh ${newPrice.toLocaleString()}`);
            setShowDiscountModal(false);
            setDiscountTarget(null);
            setCustomNewPrice('');
            loadData();
        } catch (err: any) {
            toast.error(`Update failed: ${err.message}`);
        }
    };

    // Quarantine Toggle
    const toggleQuarantine = async (item: ExpiryItem) => {
        const newStatus = item.status === 'Quarantine' ? 'Active' : 'Quarantine';
        try {
            const { error } = await supabase
                .from('pharmacy_batches')
                .update({ status: newStatus })
                .eq('batch_id', item.batch_id);

            if (error) throw error;
            toast.success(`Batch ${item.batch_number} set to ${newStatus}`);
            loadData();
        } catch (err: any) {
            toast.error(`Failed to update status: ${err.message}`);
        }
    };

    // =====================================================================
    // 1. SUPER MASSIVE ULTRA-PREMIUM EXCEL (.XLS / SpreadsheetML) EXPORTER
    // Generates a fully formatted, styled workbook with auto-column widths,
    // rich palettes, executive KPI dashboard, currency formats, and sign-offs.
    // =====================================================================
    const exportUltraExcel = () => {
        const exportSet = selectedIds.length > 0 ? items.filter((i) => selectedIds.includes(i.batch_id)) : filtered;

        if (exportSet.length === 0) {
            toast.error('No records available to export');
            return;
        }

        const totalRemainingUnits = exportSet.reduce((s, i) => s + i.remaining_qty, 0);
        const totalInitialUnits = exportSet.reduce((s, i) => s + i.quantity, 0);
        const totalPurchaseValue = sumPurchase(exportSet);
        const totalRetailValue = sumRetail(exportSet);
        const totalGrossProfit = totalRetailValue - totalPurchaseValue;
        const avgMargin = totalRetailValue > 0 ? (totalGrossProfit / totalRetailValue) * 100 : 0;
        const expiredCount = exportSet.filter((i) => getDaysUntil(i.expiry_date) < 0).length;
        const criticalCount = exportSet.filter((i) => {
            const d = getDaysUntil(i.expiry_date);
            return d >= 0 && d <= 7;
        }).length;
        const genDate = new Date().toLocaleString('en-GB');

        const xmlString = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>Alpha Pharmacy Official Expiry Register</Title>
  <Subject>Regulatory Drug Expiry &amp; Disposal Audit</Subject>
  <Author>Alpha Pharmacy Management System</Author>
  <Created>${new Date().toISOString()}</Created>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#1e293b"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <!-- Main Banner Header - BRIGHT VIBRANT EMERALD & ELECTRIC CYAN -->
  <Style ss:ID="TitleBanner">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="16" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#00C853" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="MetaBanner">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10.5" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#0091EA" ss:Pattern="Solid"/>
  </Style>

  <!-- BRIGHT VIVID KPI DASHBOARD CARD HEADERS & VALUES -->
  <Style ss:ID="KpiHdrBlue">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="9.5" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#2979FF" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1565C0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1565C0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1565C0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1565C0"/>
   </Borders>
  </Style>
  <Style ss:ID="KpiValBlue">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="13" ss:Bold="1" ss:Color="#0D47A1"/>
   <Interior ss:Color="#E3F2FD" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#90CAF9"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#90CAF9"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#90CAF9"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#90CAF9"/>
   </Borders>
  </Style>

  <Style ss:ID="KpiHdrRed">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="9.5" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#FF1744" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D50000"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D50000"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D50000"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D50000"/>
   </Borders>
  </Style>
  <Style ss:ID="KpiValRed">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="13" ss:Bold="1" ss:Color="#B71C1C"/>
   <Interior ss:Color="#FFEBEE" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EF9A9A"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EF9A9A"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EF9A9A"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EF9A9A"/>
   </Borders>
  </Style>

  <Style ss:ID="KpiHdrOrange">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="9.5" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#FF6D00" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E65100"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E65100"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E65100"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E65100"/>
   </Borders>
  </Style>
  <Style ss:ID="KpiValOrange">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="13" ss:Bold="1" ss:Color="#BF360C"/>
   <Interior ss:Color="#FFF3E0" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FFCC80"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FFCC80"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FFCC80"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FFCC80"/>
   </Borders>
  </Style>

  <Style ss:ID="KpiHdrPurple">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="9.5" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#8E24AA" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#4A148C"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#4A148C"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#4A148C"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#4A148C"/>
   </Borders>
  </Style>
  <Style ss:ID="KpiValPurple">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="13" ss:Bold="1" ss:Color="#4A148C"/>
   <Interior ss:Color="#F3E5F5" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CE93D8"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CE93D8"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CE93D8"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CE93D8"/>
   </Borders>
  </Style>

  <Style ss:ID="KpiHdrRose">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="9.5" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#E91E63" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#880E4F"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#880E4F"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#880E4F"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#880E4F"/>
   </Borders>
  </Style>
  <Style ss:ID="KpiValRose">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="13" ss:Bold="1" ss:Color="#880E4F"/>
   <Interior ss:Color="#FCE4EC" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F48FB1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F48FB1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F48FB1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F48FB1"/>
   </Borders>
  </Style>

  <Style ss:ID="KpiHdrGreen">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="9.5" ss:Bold="1" ss:Color="#003314"/>
   <Interior ss:Color="#00E676" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#00C853"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#00C853"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#00C853"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#00C853"/>
   </Borders>
  </Style>
  <Style ss:ID="KpiValGreen">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="13" ss:Bold="1" ss:Color="#1B5E20"/>
   <Interior ss:Color="#E8F5E9" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A5D6A7"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A5D6A7"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A5D6A7"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A5D6A7"/>
   </Borders>
  </Style>

  <!-- BRIGHT TABLE COLUMN HEADERS -->
  <Style ss:ID="ColHeader">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Calibri" ss:Size="10.5" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#00897B" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#004D40"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#00796B"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#00796B"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#00796B"/>
   </Borders>
  </Style>

  <!-- Data Cell Types -->
  <Style ss:ID="CellText">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
   </Borders>
  </Style>
  <Style ss:ID="CellTextBold">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#0f172a"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
   </Borders>
  </Style>
  <Style ss:ID="CellBatchMono">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Consolas" ss:Size="10" ss:Bold="1" ss:Color="#7E22CE"/>
   <Interior ss:Color="#FAF5FF" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E9D5FF"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E9D5FF"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E9D5FF"/>
   </Borders>
  </Style>
  <Style ss:ID="CellCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
   </Borders>
  </Style>
  <Style ss:ID="CellNumber">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="#,##0"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
   </Borders>
  </Style>
  <Style ss:ID="CellCurrency">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="&quot;Ksh &quot;#,##0.00"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
   </Borders>
  </Style>
  <Style ss:ID="CellCostRisk">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#D50000"/>
   <Interior ss:Color="#FFEBEE" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="&quot;Ksh &quot;#,##0.00"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FFCDD2"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FFCDD2"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FFCDD2"/>
   </Borders>
  </Style>
  <Style ss:ID="CellRetailRisk">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#1B5E20"/>
   <Interior ss:Color="#E8F5E9" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="&quot;Ksh &quot;#,##0.00"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#C8E6C9"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#C8E6C9"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#C8E6C9"/>
   </Borders>
  </Style>
  <Style ss:ID="CellPercent">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="0.0%"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
   </Borders>
  </Style>

  <!-- BRIGHT RISK CATEGORIZATION BADGES -->
  <Style ss:ID="BadgeExpired">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10.5" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#FF1744" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D50000"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D50000"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D50000"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D50000"/>
   </Borders>
  </Style>
  <Style ss:ID="BadgeCritical">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10.5" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#FF6D00" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E65100"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E65100"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E65100"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E65100"/>
   </Borders>
  </Style>
  <Style ss:ID="BadgeWarning">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10.5" ss:Bold="1" ss:Color="#3E2723"/>
   <Interior ss:Color="#FFD600" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F57F17"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F57F17"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F57F17"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F57F17"/>
   </Borders>
  </Style>
  <Style ss:ID="BadgeSafe">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10.5" ss:Bold="1" ss:Color="#003B15"/>
   <Interior ss:Color="#00E676" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#00C853"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#00C853"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#00C853"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#00C853"/>
   </Borders>
  </Style>

  <!-- BRIGHT GOLD GRAND SUMMARY TOTALS ROW -->
  <Style ss:ID="SummaryTotalLabel">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11.5" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#FF9100" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#E65100"/>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#BF360C"/>
   </Borders>
  </Style>
  <Style ss:ID="SummaryTotalNumber">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11.5" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#FF9100" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="#,##0"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#E65100"/>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#BF360C"/>
   </Borders>
  </Style>
  <Style ss:ID="SummaryTotalCurrency">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11.5" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#FF9100" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="&quot;Ksh &quot;#,##0.00"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#E65100"/>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#BF360C"/>
   </Borders>
  </Style>
 </Styles>
 <Worksheet ss:Name="Expiry &amp; Disposal Register">
  <Table>
   <!-- 25 Columns with Exact Fitting Point Widths -->
   <Column ss:Width="35"/>   <!-- 1. # -->
   <Column ss:Width="200"/>  <!-- 2. Product Name -->
   <Column ss:Width="160"/>  <!-- 3. Generic Name -->
   <Column ss:Width="85"/>   <!-- 4. Dosage -->
   <Column ss:Width="95"/>   <!-- 5. Drug Form -->
   <Column ss:Width="110"/>  <!-- 6. Category -->
   <Column ss:Width="105"/>  <!-- 7. Batch # -->
   <Column ss:Width="95"/>   <!-- 8. Barcode -->
   <Column ss:Width="130"/>  <!-- 9. Supplier -->
   <Column ss:Width="130"/>  <!-- 10. Manufacturer -->
   <Column ss:Width="85"/>   <!-- 11. Mfg Date -->
   <Column ss:Width="90"/>   <!-- 12. Expiry Date -->
   <Column ss:Width="75"/>   <!-- 13. Days Left -->
   <Column ss:Width="115"/>  <!-- 14. Risk Level -->
   <Column ss:Width="80"/>   <!-- 15. Initial Qty -->
   <Column ss:Width="85"/>   <!-- 16. Current Stock -->
   <Column ss:Width="80"/>   <!-- 17. Dispensed -->
   <Column ss:Width="75"/>   <!-- 18. Stock % -->
   <Column ss:Width="105"/>  <!-- 19. Unit Cost -->
   <Column ss:Width="105"/>  <!-- 20. Unit Retail -->
   <Column ss:Width="125"/>  <!-- 21. Total Cost Risk -->
   <Column ss:Width="125"/>  <!-- 22. Total Retail Risk -->
   <Column ss:Width="115"/>  <!-- 23. Potential Margin -->
   <Column ss:Width="75"/>   <!-- 24. Margin % -->
   <Column ss:Width="165"/>  <!-- 25. Pharmacy Recommendation -->

   <!-- Row 1: Main Title Banner -->
   <Row ss:Height="30">
    <Cell ss:MergeAcross="24" ss:StyleID="TitleBanner">
     <Data ss:Type="String">ALPHA PHARMACY SYSTEM — REGULATORY DRUG EXPIRY &amp; DISPOSAL AUDIT REGISTER</Data>
    </Cell>
   </Row>

   <!-- Row 2: Sub-Metadata Banner -->
   <Row ss:Height="18">
    <Cell ss:MergeAcross="24" ss:StyleID="MetaBanner">
     <Data ss:Type="String">Outlet: ${escapeXml(outletName)}  |  Generated: ${escapeXml(genDate)}  |  Filter Scope: ${escapeXml(filterStatus)} (${filterDays}d window)  |  Audited Records: ${exportSet.length}</Data>
    </Cell>
   </Row>

   <!-- Row 3: Blank Spacer -->
   <Row ss:Height="8" />

   <!-- Row 4: Executive KPI Summary Header with Bright Colors -->
   <Row ss:Height="20">
    <Cell ss:StyleID="KpiHdrBlue"><Data ss:Type="String">TOTAL BATCHES</Data></Cell>
    <Cell ss:StyleID="KpiHdrRed"><Data ss:Type="String">EXPIRED BATCHES</Data></Cell>
    <Cell ss:StyleID="KpiHdrOrange"><Data ss:Type="String">CRITICAL (≤7D)</Data></Cell>
    <Cell ss:StyleID="KpiHdrPurple"><Data ss:Type="String">TOTAL UNITS AT RISK</Data></Cell>
    <Cell ss:MergeAcross="1" ss:StyleID="KpiHdrRose"><Data ss:Type="String">TOTAL PURCHASE COST AT RISK</Data></Cell>
    <Cell ss:MergeAcross="1" ss:StyleID="KpiHdrGreen"><Data ss:Type="String">TOTAL RETAIL VALUE AT RISK</Data></Cell>
    <Cell ss:MergeAcross="1" ss:StyleID="KpiHdrRed"><Data ss:Type="String">POTENTIAL GROSS LOSS</Data></Cell>
   </Row>

   <!-- Row 5: Executive KPI Summary Values -->
   <Row ss:Height="24">
    <Cell ss:StyleID="KpiValBlue"><Data ss:Type="Number">${exportSet.length}</Data></Cell>
    <Cell ss:StyleID="KpiValRed"><Data ss:Type="Number">${expiredCount}</Data></Cell>
    <Cell ss:StyleID="KpiValOrange"><Data ss:Type="Number">${criticalCount}</Data></Cell>
    <Cell ss:StyleID="KpiValPurple"><Data ss:Type="Number">${totalRemainingUnits}</Data></Cell>
    <Cell ss:MergeAcross="1" ss:StyleID="KpiValRose"><Data ss:Type="Number">${totalPurchaseValue}</Data></Cell>
    <Cell ss:MergeAcross="1" ss:StyleID="KpiValGreen"><Data ss:Type="Number">${totalRetailValue}</Data></Cell>
    <Cell ss:MergeAcross="1" ss:StyleID="KpiValRed"><Data ss:Type="Number">${totalPurchaseValue}</Data></Cell>
   </Row>

   <!-- Row 6: Blank Spacer -->
   <Row ss:Height="10" />

   <!-- Row 7: Main Table Column Headers -->
   <Row ss:Height="26">
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">#</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Product Name</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Generic / Active</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Dosage</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Formulation</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Category</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Batch #</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Barcode / SKU</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Supplier / Vendor</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Manufacturer</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Mfg Date</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Expiry Date</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Days Left</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Risk Level</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Initial Qty</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Remaining Qty</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Dispensed</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">% In Stock</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Unit Cost (KES)</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Unit Retail (KES)</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Total Cost Loss (KES)</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Total Retail Risk (KES)</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Gross Margin (KES)</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Margin %</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Recommended Action</Data></Cell>
   </Row>

   <!-- Data Rows -->
   ${exportSet
       .map((item, idx) => {
           const days = getDaysUntil(item.expiry_date);
           const dispensed = Math.max(0, item.quantity - item.remaining_qty);
           const stockPct = item.quantity > 0 ? (item.remaining_qty / item.quantity) : 0;
           const costRisk = item.purchase_cost * item.remaining_qty;
           const retailRisk = item.selling_price * item.remaining_qty;
           const marginVal = retailRisk - costRisk;
           const marginPct = retailRisk > 0 ? marginVal / retailRisk : 0;

           let badgeStyle = 'BadgeSafe';
           let riskLabel = 'SAFE (>90D)';
           let actionText = 'Normal Dispensing';

           if (days < 0) {
               badgeStyle = 'BadgeExpired';
               riskLabel = `EXPIRED (${Math.abs(days)}d ago)`;
               actionText = '🚨 Immediate Quarantine & Disposal';
           } else if (days <= 7) {
               badgeStyle = 'BadgeCritical';
               riskLabel = `CRITICAL (${days}d left)`;
               actionText = '⚡ 50% Clearance Promo / Return';
           } else if (days <= 30) {
               badgeStyle = 'BadgeWarning';
               riskLabel = `URGENT (${days}d left)`;
               actionText = '⏳ Priority FEFO Dispensing';
           } else if (days <= 90) {
               badgeStyle = 'BadgeWarning';
               riskLabel = `WARNING (${days}d left)`;
               actionText = '👀 Rotate Stock to Front';
           }

           return `<Row ss:Height="20">
    <Cell ss:StyleID="CellCenter"><Data ss:Type="Number">${idx + 1}</Data></Cell>
    <Cell ss:StyleID="CellTextBold"><Data ss:Type="String">${escapeXml(item.product_name)}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${escapeXml(item.generic_name || '—')}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${escapeXml(item.dosage || '—')}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${escapeXml(item.drug_type || 'Medicine')}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${escapeXml(item.category || 'General')}</Data></Cell>
    <Cell ss:StyleID="CellBatchMono"><Data ss:Type="String">${escapeXml(item.batch_number)}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXml(item.barcode || '—')}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${escapeXml(item.supplier_name || '—')}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${escapeXml(item.manufacturer || '—')}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXml(item.manufacture_date || '—')}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXml(item.expiry_date)}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="Number">${days}</Data></Cell>
    <Cell ss:StyleID="${badgeStyle}"><Data ss:Type="String">${escapeXml(riskLabel)}</Data></Cell>
    <Cell ss:StyleID="CellNumber"><Data ss:Type="Number">${item.quantity}</Data></Cell>
    <Cell ss:StyleID="CellNumber"><Data ss:Type="Number">${item.remaining_qty}</Data></Cell>
    <Cell ss:StyleID="CellNumber"><Data ss:Type="Number">${dispensed}</Data></Cell>
    <Cell ss:StyleID="CellPercent"><Data ss:Type="Number">${stockPct.toFixed(3)}</Data></Cell>
    <Cell ss:StyleID="CellCurrency"><Data ss:Type="Number">${item.purchase_cost}</Data></Cell>
    <Cell ss:StyleID="CellCurrency"><Data ss:Type="Number">${item.selling_price}</Data></Cell>
    <Cell ss:StyleID="CellCostRisk"><Data ss:Type="Number">${costRisk}</Data></Cell>
    <Cell ss:StyleID="CellRetailRisk"><Data ss:Type="Number">${retailRisk}</Data></Cell>
    <Cell ss:StyleID="CellCurrency"><Data ss:Type="Number">${marginVal}</Data></Cell>
    <Cell ss:StyleID="CellPercent"><Data ss:Type="Number">${marginPct.toFixed(3)}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${escapeXml(actionText)}</Data></Cell>
   </Row>`;
       })
       .join('\n')}

   <!-- Bottom Grand Totals Row -->
   <Row ss:Height="24">
    <Cell ss:MergeAcross="13" ss:StyleID="SummaryTotalLabel"><Data ss:Type="String">GRAND AUDIT TOTALS:</Data></Cell>
    <Cell ss:StyleID="SummaryTotalNumber"><Data ss:Type="Number">${totalInitialUnits}</Data></Cell>
    <Cell ss:StyleID="SummaryTotalNumber"><Data ss:Type="Number">${totalRemainingUnits}</Data></Cell>
    <Cell ss:StyleID="SummaryTotalNumber"><Data ss:Type="Number">${Math.max(0, totalInitialUnits - totalRemainingUnits)}</Data></Cell>
    <Cell ss:StyleID="SummaryTotalLabel"><Data ss:Type="String">—</Data></Cell>
    <Cell ss:StyleID="SummaryTotalLabel"><Data ss:Type="String">—</Data></Cell>
    <Cell ss:StyleID="SummaryTotalLabel"><Data ss:Type="String">—</Data></Cell>
    <Cell ss:StyleID="SummaryTotalCurrency"><Data ss:Type="Number">${totalPurchaseValue}</Data></Cell>
    <Cell ss:StyleID="SummaryTotalCurrency"><Data ss:Type="Number">${totalRetailValue}</Data></Cell>
    <Cell ss:StyleID="SummaryTotalCurrency"><Data ss:Type="Number">${totalGrossProfit}</Data></Cell>
    <Cell ss:StyleID="SummaryTotalLabel"><Data ss:Type="String">${avgMargin.toFixed(1)}%</Data></Cell>
    <Cell ss:StyleID="SummaryTotalLabel"><Data ss:Type="String">—</Data></Cell>
   </Row>

   <!-- Blank Spacer -->
   <Row ss:Height="14" />

   <!-- Formal Sign-Off Section -->
   <Row ss:Height="18">
    <Cell ss:MergeAcross="5" ss:StyleID="KpiLabel"><Data ss:Type="String">PREPARED BY (PHARMACIST-IN-CHARGE)</Data></Cell>
    <Cell ss:MergeAcross="5" ss:StyleID="KpiLabel"><Data ss:Type="String">VERIFIED BY (SUPERINTENDENT PHARMACIST)</Data></Cell>
    <Cell ss:MergeAcross="6" ss:StyleID="KpiLabel"><Data ss:Type="String">AUTHORIZED DISPOSAL WITNESS</Data></Cell>
   </Row>
   <Row ss:Height="28">
    <Cell ss:MergeAcross="5" ss:StyleID="CellText"><Data ss:Type="String">Sign: ___________________ Date: ________</Data></Cell>
    <Cell ss:MergeAcross="5" ss:StyleID="CellText"><Data ss:Type="String">Sign: ___________________ Date: ________</Data></Cell>
    <Cell ss:MergeAcross="6" ss:StyleID="CellText"><Data ss:Type="String">Sign: ___________________ Date: ________</Data></Cell>
   </Row>
  </Table>
 </Worksheet>
</Workbook>`;

        const blob = new Blob([xmlString], { type: 'application/vnd.ms-excel;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AlphaPharmacy_ExpiryRegister_${new Date().toISOString().split('T')[0]}_SuperPremium.xls`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`Exported ${exportSet.length} items to Super Premium Excel Sheet!`);
    };

    // =====================================================================
    // 2. STANDARD CLEAN CSV EXPORTER
    // =====================================================================
    const exportCleanCsv = () => {
        const exportSet = selectedIds.length > 0 ? items.filter((i) => selectedIds.includes(i.batch_id)) : filtered;
        if (exportSet.length === 0) {
            toast.error('No items to export');
            return;
        }

        const headers = [
            'Product Name',
            'Generic Name',
            'Dosage',
            'Formulation',
            'Category',
            'Batch Number',
            'Barcode',
            'Supplier',
            'Manufacturer',
            'Manufacture Date',
            'Expiry Date',
            'Days Remaining',
            'Risk Status',
            'Initial Quantity',
            'Remaining Quantity',
            'Unit Purchase Cost (KES)',
            'Unit Selling Price (KES)',
            'Total Cost at Risk (KES)',
            'Total Retail Value (KES)',
            'Gross Margin (KES)',
            'Margin %',
            'Disposal Recommendation',
        ];

        const rows = exportSet.map((item) => {
            const days = getDaysUntil(item.expiry_date);
            const costRisk = item.purchase_cost * item.remaining_qty;
            const retailRisk = item.selling_price * item.remaining_qty;
            const marginVal = retailRisk - costRisk;
            const marginPct = retailRisk > 0 ? ((marginVal / retailRisk) * 100).toFixed(1) + '%' : '0%';
            const statusStr = days < 0 ? 'EXPIRED' : days <= 7 ? 'CRITICAL' : days <= 30 ? 'URGENT' : days <= 90 ? 'WARNING' : 'SAFE';

            return [
                `"${item.product_name.replace(/"/g, '""')}"`,
                `"${(item.generic_name || '').replace(/"/g, '""')}"`,
                `"${(item.dosage || '').replace(/"/g, '""')}"`,
                `"${(item.drug_type || '').replace(/"/g, '""')}"`,
                `"${(item.category || '').replace(/"/g, '""')}"`,
                `"${item.batch_number.replace(/"/g, '""')}"`,
                `"${(item.barcode || '').replace(/"/g, '""')}"`,
                `"${(item.supplier_name || '').replace(/"/g, '""')}"`,
                `"${(item.manufacturer || '').replace(/"/g, '""')}"`,
                item.manufacture_date || '',
                item.expiry_date,
                days,
                statusStr,
                item.quantity,
                item.remaining_qty,
                item.purchase_cost.toFixed(2),
                item.selling_price.toFixed(2),
                costRisk.toFixed(2),
                retailRisk.toFixed(2),
                marginVal.toFixed(2),
                marginPct,
                days < 0 ? 'Quarantine & Dispose' : days <= 7 ? '50% Flash Clearance' : days <= 30 ? 'Priority FEFO' : 'Rotate Stock',
            ].join(',');
        });

        const totalCost = sumPurchase(exportSet);
        const totalRetail = sumRetail(exportSet);
        rows.push([
            '"TOTALS"',
            '""',
            '""',
            '""',
            '""',
            '""',
            '""',
            '""',
            '""',
            '""',
            '""',
            '""',
            '""',
            exportSet.reduce((s, i) => s + i.quantity, 0),
            exportSet.reduce((s, i) => s + i.remaining_qty, 0),
            '""',
            '""',
            totalCost.toFixed(2),
            totalRetail.toFixed(2),
            (totalRetail - totalCost).toFixed(2),
            '""',
            '""',
        ].join(','));

        const csvContent = '\uFEFF' + [
            `"ALPHA PHARMACY - OFFICIAL EXPIRY REGISTER"`,
            `"Outlet: ${outletName} | Exported: ${new Date().toLocaleString()}"`,
            `"Filter: ${filterStatus} within ${filterDays} days | Total Records: ${exportSet.length}"`,
            '',
            headers.join(','),
            ...rows,
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AlphaPharmacy_ExpiryRegister_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`Exported ${exportSet.length} records to CSV`);
    };

    // =====================================================================
    // 3. SUPER PRINT & PDF ENGINE
    // =====================================================================
    const handleSuperPrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-96" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
                <div className="w-14 h-14 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                <p className="mt-4 text-gray-600 font-semibold text-sm">Loading regulatory expiry records...</p>
                <p className="text-xs text-gray-400 mt-1">Calculating batch lifespans &amp; FEFO valuation</p>
            </div>
        );
    }

    return (
        <div className="space-y-5" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
            {/* Inline Print Stylesheet */}
            <style jsx global>{`
                @media print {
                    @page {
                        size: landscape;
                        margin: 8mm;
                    }
                    body {
                        background: #ffffff !important;
                        color: #000000 !important;
                        font-size: 8.5pt !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                    .print-only {
                        display: block !important;
                    }
                    .print-table {
                        width: 100% !important;
                        border-collapse: collapse !important;
                    }
                    .print-table th,
                    .print-table td {
                        border: 1px solid #cbd5e1 !important;
                        padding: 3px 5px !important;
                    }
                    .print-break-inside-avoid {
                        page-break-inside: avoid !important;
                    }
                }
                @media screen {
                    .print-only {
                        display: none !important;
                    }
                }
            `}</style>

            {/* PRINT-ONLY FORMAL AUDIT HEADER */}
            <div className="print-only mb-4 border-b-2 border-emerald-700 pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-black text-emerald-900 tracking-tight">ALPHA PHARMACY SYSTEM</h1>
                        <p className="text-xs font-semibold text-gray-700">OFFICIAL REGULATORY DRUG EXPIRY &amp; DISPOSAL AUDIT REGISTER</p>
                        <p className="text-[10px] text-gray-500">
                            Outlet: <span className="font-bold text-gray-800">{outletName}</span> | Date of Audit: <span className="font-bold text-gray-800">{new Date().toLocaleDateString('en-GB')}</span> | Generated: {new Date().toLocaleTimeString()}
                        </p>
                    </div>
                    <div className="text-right text-[10px] text-gray-600">
                        <p className="font-bold text-gray-900">MOH / PPB COMPLIANT AUDIT REGISTER</p>
                        <p>Total Batches Audited: <span className="font-bold">{filtered.length}</span></p>
                        <p>Total Purchase Value at Risk: <span className="font-bold">Ksh {sumPurchase(filtered).toLocaleString()}</span></p>
                    </div>
                </div>
            </div>

            {/* SCREEN HEADER */}
            <div className="no-print flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center shadow-lg text-white font-bold text-2xl flex-shrink-0">
                        ⏰
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold text-gray-800">Expiry Register &amp; Disposal Audit</h1>
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold border border-emerald-200">
                                FEFO Protected
                            </span>
                        </div>
                        <p className="text-gray-500 text-xs">
                            Active Outlet: <span className="font-semibold text-gray-700">{outletName}</span> • Track drug lifespans, quarantine expired inventory, and generate compliance reports
                        </p>
                    </div>
                </div>

                {/* SUPER EXPORT, PRINT & ACTION CONTROLS */}
                <div className="flex items-center flex-wrap gap-2">
                    {/* Super Massive Excel */}
                    <button
                        onClick={exportUltraExcel}
                        className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl font-bold shadow-sm hover:shadow transition-all flex items-center gap-1.5 text-xs active:scale-95"
                        title="Download Massive Styled Microsoft Excel Spreadsheet with executive KPI dashboard, cell formatting, and auto-fit columns"
                    >
                        <span>📊</span> Super Excel
                    </button>

                    {/* Standard CSV */}
                    <button
                        onClick={exportCleanCsv}
                        className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl font-bold shadow-sm transition-all flex items-center gap-1 text-xs"
                        title="Export Clean RFC4180 CSV"
                    >
                        <span>📑</span> CSV
                    </button>

                    {/* Super Print */}
                    <button
                        onClick={handleSuperPrint}
                        className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl font-bold shadow-sm transition-all flex items-center gap-1.5 text-xs"
                        title="Print official landscape audit register (Ctrl+P)"
                    >
                        <span>🖨️</span> Super Print
                    </button>

                    {/* PDF Export */}
                    <button
                        onClick={handleSuperPrint}
                        className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl font-bold shadow-sm transition-all flex items-center gap-1.5 text-xs"
                        title="Export formatted PDF audit report"
                    >
                        <span>📄</span> PDF
                    </button>

                    {/* Refresh */}
                    <button
                        onClick={loadData}
                        className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl font-bold shadow-sm transition-all flex items-center gap-1 text-xs"
                        title="Reload live inventory data"
                    >
                        <span>🔄</span> Refresh
                    </button>
                </div>
            </div>

            {/* 6 SUMMARY CARDS - PRESERVED EXACTLY AS REQUESTED ("the cards dont change or add more") */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                {[
                    {
                        label: 'Expired',
                        count: allExpired.length,
                        value: sumPurchase(allExpired),
                        retail: sumRetail(allExpired),
                        color: 'from-red-500 to-red-600',
                        icon: '🔴',
                        textColor: 'text-red-600',
                    },
                    {
                        label: 'In 7 Days',
                        count: expIn7.length,
                        value: sumPurchase(expIn7),
                        retail: sumRetail(expIn7),
                        color: 'from-orange-500 to-red-500',
                        icon: '🟠',
                        textColor: 'text-orange-600',
                    },
                    {
                        label: 'In 30 Days',
                        count: expIn30.length,
                        value: sumPurchase(expIn30),
                        retail: sumRetail(expIn30),
                        color: 'from-yellow-500 to-orange-500',
                        icon: '🟡',
                        textColor: 'text-yellow-600',
                    },
                    {
                        label: 'In 90 Days',
                        count: expIn90.length,
                        value: sumPurchase(expIn90),
                        retail: sumRetail(expIn90),
                        color: 'from-green-500 to-teal-500',
                        icon: '🟢',
                        textColor: 'text-green-600',
                    },
                    {
                        label: 'At-Risk (Cost)',
                        count: null,
                        value: sumPurchase([...allExpired, ...expIn90]),
                        retail: null,
                        color: 'from-purple-500 to-indigo-600',
                        icon: '💰',
                        textColor: 'text-purple-600',
                    },
                    {
                        label: 'At-Risk (Retail)',
                        count: null,
                        value: null,
                        retail: sumRetail([...allExpired, ...expIn90]),
                        color: 'from-cyan-500 to-blue-600',
                        icon: '💎',
                        textColor: 'text-cyan-600',
                    },
                ].map((card, idx) => (
                    <div
                        key={idx}
                        className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
                    >
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-base">{card.icon}</span>
                            <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center shadow-xs`}>
                                {card.count !== null && <span className="text-white text-xs font-bold">{card.count}</span>}
                                {card.count === null && <span className="text-white text-xs font-bold">$</span>}
                            </div>
                        </div>
                        <p className="text-[10.5px] text-gray-500 font-bold uppercase tracking-wider">{card.label}</p>
                        {card.value !== null && (
                            <p className={`text-base font-black ${card.textColor} tracking-tight`}>
                                Ksh {card.value.toLocaleString()}
                            </p>
                        )}
                        {card.retail !== null && card.value !== null && (
                            <p className="text-[10px] text-gray-400 truncate">Retail: Ksh {card.retail.toLocaleString()}</p>
                        )}
                        {card.value === null && card.retail !== null && (
                            <p className={`text-base font-black ${card.textColor} tracking-tight`}>
                                Ksh {card.retail.toLocaleString()}
                            </p>
                        )}
                    </div>
                ))}
            </div>

            {/* SUPER DETAILED MULTI-DIMENSIONAL FILTERS BAR */}
            <div className="no-print bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3">
                {/* Row 1: Omni-Search & Quick Horizon Buttons */}
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
                    {/* Search Bar */}
                    <div className="relative flex-1 min-w-[240px]">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setCurrentPage(1);
                            }}
                            placeholder="Search product, generic, batch #, supplier, barcode..."
                            className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-gray-800"
                        />
                        {search && (
                            <button
                                onClick={() => setSearch('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Expiry Horizon Pills */}
                    <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0">
                        <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mr-1 shrink-0">
                            Horizon:
                        </span>
                        {[
                            { id: 'expired', label: 'Expired Only', color: 'bg-red-600' },
                            { id: 7, label: '7d', color: 'bg-red-500' },
                            { id: 14, label: '14d', color: 'bg-orange-500' },
                            { id: 30, label: '30d', color: 'bg-amber-500' },
                            { id: 60, label: '60d', color: 'bg-yellow-600' },
                            { id: 90, label: '90d', color: 'bg-emerald-600' },
                            { id: 180, label: '180d', color: 'bg-teal-600' },
                            { id: 365, label: '365d', color: 'bg-cyan-600' },
                            { id: 'all', label: 'All Horizons', color: 'bg-gray-800' },
                        ].map((btn) => {
                            const isSelected = filterDays === btn.id;
                            return (
                                <button
                                    key={String(btn.id)}
                                    onClick={() => {
                                        setFilterDays(btn.id as any);
                                        setCurrentPage(1);
                                    }}
                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                                        isSelected
                                            ? `${btn.color} text-white shadow-xs`
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    {btn.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Row 2: Secondary Dropdown Filters */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1 border-t border-gray-100">
                    {/* Status Filter */}
                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Status</label>
                        <select
                            value={filterStatus}
                            onChange={(e) => {
                                setFilterStatus(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 cursor-pointer outline-none focus:border-emerald-500"
                        >
                            <option value="All">All Statuses</option>
                            <option value="Expired">🔴 Expired Only</option>
                            <option value="Critical">🚨 Critical (≤7d)</option>
                            <option value="Urgent">⏳ Urgent (8-30d)</option>
                            <option value="Warning">⚠️ Warning (31-90d)</option>
                            <option value="Safe">✓ Safe (&gt;90d)</option>
                            <option value="Active">Active Only</option>
                        </select>
                    </div>

                    {/* Category Filter */}
                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Category</label>
                        <select
                            value={filterCategory}
                            onChange={(e) => {
                                setFilterCategory(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 cursor-pointer outline-none focus:border-emerald-500 truncate"
                        >
                            <option value="All">All Categories ({categories.length})</option>
                            {categories.map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>

                    {/* Drug Formulation */}
                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Formulation</label>
                        <select
                            value={filterDrugType}
                            onChange={(e) => {
                                setFilterDrugType(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 cursor-pointer outline-none focus:border-emerald-500 truncate"
                        >
                            <option value="All">All Formulations</option>
                            {drugTypes.map((dt) => (
                                <option key={dt} value={dt}>{dt}</option>
                            ))}
                        </select>
                    </div>

                    {/* Financial Risk Exposure */}
                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Financial Risk</label>
                        <select
                            value={filterRiskValue}
                            onChange={(e) => {
                                setFilterRiskValue(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 cursor-pointer outline-none focus:border-emerald-500"
                        >
                            <option value="All">All Risk Values</option>
                            <option value="high">High Risk (&gt; Ksh 10k)</option>
                            <option value="medium">Medium (Ksh 2k - 10k)</option>
                            <option value="low">Minor Risk (&lt; Ksh 2k)</option>
                        </select>
                    </div>

                    {/* Stock Level Filter */}
                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Stock Level</label>
                        <select
                            value={filterStockLevel}
                            onChange={(e) => {
                                setFilterStockLevel(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 cursor-pointer outline-none focus:border-emerald-500"
                        >
                            <option value="All">All Quantities</option>
                            <option value="low">Low Units (≤10 pcs)</option>
                            <option value="medium">Medium Units (11-50)</option>
                            <option value="bulk">Bulk Units (&gt;50 pcs)</option>
                        </select>
                    </div>

                    {/* Sort Order */}
                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Sort Order</label>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as any)}
                            className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 cursor-pointer outline-none focus:border-emerald-500"
                        >
                            <option value="expiry_asc">⚡ Expiry (Earliest First)</option>
                            <option value="expiry_desc">Expiry (Furthest First)</option>
                            <option value="loss_desc">💰 Cost at Risk (High→Low)</option>
                            <option value="retail_desc">💎 Retail Value (High→Low)</option>
                            <option value="qty_desc">📦 Stock Qty (High→Low)</option>
                            <option value="qty_asc">📦 Stock Qty (Low→High)</option>
                            <option value="name_asc">🔤 Product Name (A→Z)</option>
                            <option value="margin_desc">📈 Margin % (High→Low)</option>
                        </select>
                    </div>
                </div>

                {/* Row 3: Active Filters Summary & Bulk Actions */}
                <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-gray-100 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-700">
                            Showing <span className="text-emerald-700 font-extrabold">{filtered.length}</span> of {items.length} batches
                        </span>
                        {selectedIds.length > 0 && (
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded-md font-bold text-xs border border-purple-200">
                                {selectedIds.length} batch(es) selected
                            </span>
                        )}
                        {activeFilterCount > 0 && (
                            <button
                                onClick={resetFilters}
                                className="text-xs text-red-600 hover:text-red-700 font-bold underline ml-2"
                            >
                                Reset All Filters
                            </button>
                        )}
                    </div>

                    {/* Bulk Selection Bar */}
                    {selectedIds.length > 0 && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => {
                                    setIsBulkDispose(true);
                                    setDisposeTarget(null);
                                    setShowDisposeModal(true);
                                }}
                                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs shadow-xs transition-colors flex items-center gap-1"
                            >
                                <span>🗑️</span> Dispose Selected ({selectedIds.length})
                            </button>
                            <button
                                onClick={exportUltraExcel}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-xs transition-colors flex items-center gap-1"
                            >
                                <span>📊</span> Export Selected
                            </button>
                            <button
                                onClick={() => setSelectedIds([])}
                                className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold"
                            >
                                Clear Selection
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* SUPER DETAILED EXPIRY REGISTER DATA GRID */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Table Header Bar */}
                <div className="no-print px-5 py-3 bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 text-white flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">⏰</span>
                        <h2 className="text-sm font-bold tracking-wide">
                            Itemized Expiry &amp; Disposal Audit Register
                        </h2>
                        <span className="px-2.5 py-0.5 bg-white/20 rounded-full text-xs font-extrabold backdrop-blur-xs">
                            {filtered.length} Records
                        </span>
                    </div>
                    <div className="text-xs text-white/90 flex items-center gap-3">
                        <span>
                            Total Cost at Risk: <strong className="text-white font-black">Ksh {sumPurchase(filtered).toLocaleString()}</strong>
                        </span>
                        <span>•</span>
                        <span>
                            Total Retail: <strong className="text-white font-black">Ksh {sumRetail(filtered).toLocaleString()}</strong>
                        </span>
                        <button
                            onClick={() => setIsAutoFit(!isAutoFit)}
                            className="px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-xs"
                            title="Toggle Auto-Fit view (fits 100% of screen without horizontal scroll) or Expanded view"
                        >
                            <span>{isAutoFit ? '🖥️ Auto-Fit (Active)' : '↔️ Expanded'}</span>
                        </button>
                    </div>
                </div>

                {/* Auto-Fit Responsive Table */}
                <div className={isAutoFit ? 'w-full overflow-hidden' : 'overflow-x-auto'}>
                    <table className="w-full text-left print-table">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                <th className="no-print px-2 py-2.5 text-center w-7">
                                    <input
                                        type="checkbox"
                                        checked={isAllSelected}
                                        onChange={toggleSelectAll}
                                        className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                        title="Select all on this page"
                                    />
                                </th>
                                <th className="px-2 py-2.5">Product &amp; Generic</th>
                                <th className="px-2 py-2.5">Batch &amp; Supplier</th>
                                <th className="px-2 py-2.5">Category</th>
                                <th className="px-2 py-2.5 text-center">Expiry &amp; Lifespan</th>
                                <th className="px-2 py-2.5 text-center">Stock Units</th>
                                <th className="px-2 py-2.5 text-right">Pricing (Unit)</th>
                                <th className="px-2 py-2.5 text-right">Valuation at Risk</th>
                                <th className="px-2 py-2.5 text-center">Action Plan</th>
                                <th className="no-print px-2 py-2.5 text-center w-24">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-xs">
                            {paginatedItems.map((item, idx) => {
                                const days = getDaysUntil(item.expiry_date);
                                const costRisk = item.purchase_cost * item.remaining_qty;
                                const retailRisk = item.selling_price * item.remaining_qty;
                                const marginPct = item.selling_price > 0
                                    ? (((item.selling_price - item.purchase_cost) / item.selling_price) * 100).toFixed(0)
                                    : '0';
                                const stockPct = item.quantity > 0
                                    ? Math.round((item.remaining_qty / item.quantity) * 100)
                                    : 100;
                                const rec = getRecommendation(days, item.remaining_qty, item.quantity);
                                const isSelected = selectedIds.includes(item.batch_id);

                                const rowBg = days < 0
                                    ? 'bg-red-50/70 hover:bg-red-100/60'
                                    : days <= 7
                                    ? 'bg-orange-50/70 hover:bg-orange-100/60'
                                    : days <= 30
                                    ? 'bg-yellow-50/50 hover:bg-yellow-100/50'
                                    : isSelected
                                    ? 'bg-emerald-50/50 hover:bg-emerald-100/50'
                                    : 'hover:bg-gray-50/80';

                                return (
                                    <tr key={item.batch_id} className={`transition-colors print-break-inside-avoid ${rowBg}`}>
                                        {/* Checkbox */}
                                        <td className="no-print px-2 py-2 text-center">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleSelectItem(item.batch_id)}
                                                className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                            />
                                        </td>

                                        {/* Product & Generic */}
                                        <td className="px-2 py-2 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span
                                                    onClick={() => setDetailItem(item)}
                                                    className="font-bold text-gray-900 hover:text-emerald-700 cursor-pointer truncate max-w-[180px]"
                                                    title="Click to view complete batch profile"
                                                >
                                                    {item.product_name}
                                                </span>
                                                {item.dosage && (
                                                    <span className="px-1 py-0.2 bg-gray-100 text-gray-600 rounded text-[8.5px] font-semibold">
                                                        {item.dosage}
                                                    </span>
                                                )}
                                            </div>
                                            {item.generic_name && (
                                                <p className="text-[9.5px] text-teal-700 italic truncate max-w-[170px] mt-0.5">
                                                    {item.generic_name}
                                                </p>
                                            )}
                                        </td>

                                        {/* Batch # & Supplier */}
                                        <td className="px-2 py-2 min-w-0">
                                            <span className="font-mono font-bold text-purple-800 bg-purple-50 border border-purple-100 px-1 py-0.5 rounded text-[10.5px]">
                                                {item.batch_number}
                                            </span>
                                            <p className="text-[9.5px] text-gray-500 truncate max-w-[110px] mt-0.5">
                                                {item.supplier_name || 'Direct'}
                                            </p>
                                        </td>

                                        {/* Category & Drug Form */}
                                        <td className="px-2 py-2 min-w-0">
                                            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded text-[9.5px] font-medium truncate inline-block max-w-[100px]">
                                                {item.category || 'General'}
                                            </span>
                                            {item.drug_type && (
                                                <p className="text-[9px] text-gray-400 truncate max-w-[100px] mt-0.5">{item.drug_type}</p>
                                            )}
                                        </td>

                                        {/* Expiry & Lifespan Stacked */}
                                        <td className="px-2 py-2 text-center whitespace-nowrap">
                                            <p className="font-bold text-gray-800 text-[11px] leading-tight">{formatDate(item.expiry_date)}</p>
                                            <div className="mt-1">
                                                {getExpiryBadge(days)}
                                            </div>
                                        </td>

                                        {/* Stock & Progress */}
                                        <td className="px-2 py-2 text-center whitespace-nowrap">
                                            <p className="font-extrabold text-gray-900 text-xs">
                                                {item.remaining_qty} <span className="text-[9.5px] font-normal text-gray-500">{item.sales_unit}</span>
                                            </p>
                                            {item.quantity > 0 && (
                                                <div className="w-14 mx-auto bg-gray-200 rounded-full h-1 mt-1 overflow-hidden" title={`${stockPct}% in stock`}>
                                                    <div
                                                        className={`h-full ${days < 0 ? 'bg-red-500' : days <= 30 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                                        style={{ width: `${Math.min(100, stockPct)}%` }}
                                                    />
                                                </div>
                                            )}
                                        </td>

                                        {/* Pricing */}
                                        <td className="px-2 py-2 text-right whitespace-nowrap">
                                            <p className="font-bold text-gray-800 text-xs">Ksh {item.selling_price.toLocaleString()}</p>
                                            <p className="text-[9.5px] text-gray-400">Cost: {item.purchase_cost.toLocaleString()} ({marginPct}%)</p>
                                        </td>

                                        {/* Valuation at Risk (Cost Loss & Retail) */}
                                        <td className="px-2 py-2 text-right whitespace-nowrap">
                                            <p className="font-black text-red-600 text-xs leading-tight">
                                                Loss: Ksh {costRisk.toLocaleString()}
                                            </p>
                                            <p className="text-[9.5px] text-gray-500 mt-0.5">
                                                Ret: Ksh {retailRisk.toLocaleString()}
                                            </p>
                                        </td>

                                        {/* Recommendation */}
                                        <td className="px-2 py-2 text-center whitespace-nowrap">
                                            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold border inline-flex items-center gap-1 ${rec.bg}`}>
                                                <span>{rec.icon}</span> {rec.label}
                                            </span>
                                        </td>

                                        {/* Actions */}
                                        <td className="no-print px-2 py-2 text-center whitespace-nowrap">
                                            <div className="flex items-center justify-center gap-1">
                                                {/* Dispose Button */}
                                                <button
                                                    onClick={() => {
                                                        setDisposeTarget(item);
                                                        setIsBulkDispose(false);
                                                        setShowDisposeModal(true);
                                                    }}
                                                    className="p-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-md transition-colors"
                                                    title="Dispose expired batch"
                                                >
                                                    🗑️
                                                </button>

                                                {/* Promo Discount Button */}
                                                <button
                                                    onClick={() => {
                                                        setDiscountTarget(item);
                                                        setShowDiscountModal(true);
                                                    }}
                                                    className="p-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-md transition-colors"
                                                    title="Apply clearance discount"
                                                >
                                                    ⚡
                                                </button>

                                                {/* Quarantine Toggle */}
                                                <button
                                                    onClick={() => toggleQuarantine(item)}
                                                    className={`p-1 rounded-md transition-colors ${
                                                        item.status === 'Quarantine'
                                                            ? 'bg-purple-600 text-white'
                                                            : 'bg-purple-50 hover:bg-purple-100 text-purple-700'
                                                    }`}
                                                    title={item.status === 'Quarantine' ? 'Release from Quarantine' : 'Quarantine Batch'}
                                                >
                                                    🔒
                                                </button>

                                                {/* Detail Drawer */}
                                                <button
                                                    onClick={() => setDetailItem(item)}
                                                    className="p-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md transition-colors"
                                                    title="View batch audit card"
                                                >
                                                    ℹ️
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}

                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={isAutoFit ? 10 : 12} className="text-center py-16 text-gray-400">
                                        <span className="text-5xl block mb-2">✅</span>
                                        <p className="text-base font-bold text-gray-700">No expiring items match current filters</p>
                                        <p className="text-xs text-gray-400 mt-1">Try resetting filters or expanding the expiry window horizon</p>
                                        <button
                                            onClick={resetFilters}
                                            className="mt-3 px-4 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-100"
                                        >
                                            Reset All Filters
                                        </button>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                <div className="no-print px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between flex-wrap gap-2 text-xs">
                    <div className="flex items-center gap-2">
                        <span className="text-gray-500 font-semibold">Rows per page:</span>
                        <select
                            value={pageSize}
                            onChange={(e) => {
                                setPageSize(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="px-2 py-1 bg-white border border-gray-200 rounded-md font-semibold text-gray-700 cursor-pointer"
                        >
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                            <option value={0}>All ({filtered.length})</option>
                        </select>
                        <span className="text-gray-400 ml-2">
                            Page {currentPage} of {totalPages}
                        </span>
                    </div>

                    {pageSize > 0 && totalPages > 1 && (
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1 bg-white border border-gray-200 rounded-md font-bold text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100"
                            >
                                ← Prev
                            </button>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                const pageNum = i + 1;
                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setCurrentPage(pageNum)}
                                        className={`w-7 h-7 rounded-md font-bold text-xs ${
                                            currentPage === pageNum
                                                ? 'bg-emerald-600 text-white'
                                                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                                        }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                            <button
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1 bg-white border border-gray-200 rounded-md font-bold text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100"
                            >
                                Next →
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* PRINT-ONLY FORMAL AUDIT SIGNATURE BLOCK */}
            <div className="print-only mt-8 pt-4 border-t-2 border-gray-300">
                <div className="grid grid-cols-3 gap-6 text-[10px]">
                    <div className="border border-gray-300 p-3 rounded">
                        <p className="font-bold uppercase text-gray-800">1. Pharmacist-In-Charge</p>
                        <p className="text-gray-500 mt-1">Name: ________________________________</p>
                        <p className="text-gray-500 mt-2">PPB Reg No: _________________________</p>
                        <p className="text-gray-500 mt-2">Signature: __________________________</p>
                        <p className="text-gray-500 mt-2">Date: _______________________________</p>
                    </div>
                    <div className="border border-gray-300 p-3 rounded">
                        <p className="font-bold uppercase text-gray-800">2. Inventory / Audit Officer</p>
                        <p className="text-gray-500 mt-1">Name: ________________________________</p>
                        <p className="text-gray-500 mt-2">Designation: ________________________</p>
                        <p className="text-gray-500 mt-2">Signature: __________________________</p>
                        <p className="text-gray-500 mt-2">Date: _______________________________</p>
                    </div>
                    <div className="border border-gray-300 p-3 rounded">
                        <p className="font-bold uppercase text-gray-800">3. Disposal Witness / Authority</p>
                        <p className="text-gray-500 mt-1">Name: ________________________________</p>
                        <p className="text-gray-500 mt-2">Organization: _______________________</p>
                        <p className="text-gray-500 mt-2">Signature: __________________________</p>
                        <p className="text-gray-500 mt-2">Official Stamp: ______________________</p>
                    </div>
                </div>
            </div>

            {/* =====================================================================
                MODALS
            ===================================================================== */}

            {/* 1. DISPOSAL MODAL */}
            {showDisposeModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-100 animate-in fade-in zoom-in-95">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                                <span className="text-red-600">🗑️</span> Confirm Batch Disposal
                            </h3>
                            <button
                                onClick={() => setShowDisposeModal(false)}
                                className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-400 flex items-center justify-center font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="py-4 space-y-3">
                            <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                                <p className="text-xs font-bold text-red-900">
                                    {isBulkDispose
                                        ? `Disposing ${selectedIds.length} Selected Batches`
                                        : `Disposing: ${disposeTarget?.product_name} [${disposeTarget?.batch_number}]`}
                                </p>
                                <p className="text-[11px] text-red-700 mt-0.5">
                                    Remaining stock will be zeroed and marked as disposed in compliance with health regulations.
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Reason for Disposal</label>
                                <select
                                    value={disposeReason}
                                    onChange={(e) => setDisposeReason(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800"
                                >
                                    <option value="Expired">Product Expired</option>
                                    <option value="Damaged Packaging">Damaged / Broken Packaging</option>
                                    <option value="Quality Defect">Manufacturer Recall / Quality Defect</option>
                                    <option value="Cold Chain Failure">Cold Chain Temperature Excursion</option>
                                    <option value="Contamination">Suspected Contamination</option>
                                    <option value="Regulatory Directive">Regulatory Directive</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Disposal Method</label>
                                <select
                                    value={disposeMethod}
                                    onChange={(e) => setDisposeMethod(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800"
                                >
                                    <option value="Incineration / Regulated Disposal">High-Temperature Incineration</option>
                                    <option value="Return to Supplier">Return to Supplier / Vendor Credit</option>
                                    <option value="Chemical Inactivation">Chemical Inactivation / Neutralization</option>
                                    <option value="Encapsulation & Burial">Encapsulation &amp; Engineered Burial</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Authorizing Officer</label>
                                <input
                                    type="text"
                                    value={disposeOfficer}
                                    onChange={(e) => setDisposeOfficer(e.target.value)}
                                    placeholder="Pharmacist Name / Registration No"
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 outline-none focus:border-red-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Disposal Notes</label>
                                <textarea
                                    value={disposeNotes}
                                    onChange={(e) => setDisposeNotes(e.target.value)}
                                    rows={2}
                                    placeholder="Disposal company, witness name, or certificate reference..."
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 outline-none focus:border-red-500"
                                />
                            </div>
                        </div>

                        <div className="flex gap-2 pt-2 border-t border-gray-100">
                            <button
                                onClick={() => setShowDisposeModal(false)}
                                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={executeDisposal}
                                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
                            >
                                Complete Disposal
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 2. CLEARANCE DISCOUNT MODAL */}
            {showDiscountModal && discountTarget && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-100 animate-in fade-in zoom-in-95">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                                <span className="text-amber-500">⚡</span> Near-Expiry Clearance Promo
                            </h3>
                            <button
                                onClick={() => setShowDiscountModal(false)}
                                className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-400 flex items-center justify-center font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="py-4 space-y-3">
                            <p className="text-xs text-gray-600">
                                Set a promotional clearance price for batch <strong className="text-purple-700 font-mono">{discountTarget.batch_number}</strong> to accelerate sales before expiry.
                            </p>

                            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between text-xs">
                                <div>
                                    <p className="text-gray-400 font-bold">Current Retail Price</p>
                                    <p className="text-base font-extrabold text-gray-900">Ksh {discountTarget.selling_price.toLocaleString()}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-gray-400 font-bold">Unit Purchase Cost</p>
                                    <p className="text-sm font-semibold text-gray-600">Ksh {discountTarget.purchase_cost.toLocaleString()}</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5">Quick Discount Percentage</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {[10, 20, 30, 50].map((pct) => (
                                        <button
                                            key={pct}
                                            onClick={() => {
                                                setDiscountPct(pct);
                                                setCustomNewPrice('');
                                            }}
                                            className={`py-2 rounded-xl text-xs font-bold transition-all ${
                                                discountPct === pct && !customNewPrice
                                                    ? 'bg-amber-500 text-white shadow-xs'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            }`}
                                        >
                                            -{pct}%
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Or Set Exact Price (Ksh)</label>
                                <input
                                    type="number"
                                    value={customNewPrice}
                                    onChange={(e) => setCustomNewPrice(e.target.value)}
                                    placeholder={`e.g. ${Math.round(discountTarget.selling_price * 0.7)}`}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:border-amber-500"
                                />
                            </div>

                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex justify-between items-center">
                                <span>New Promotional Price:</span>
                                <strong className="text-base font-black text-amber-800">
                                    Ksh{' '}
                                    {customNewPrice
                                        ? Number(customNewPrice).toLocaleString()
                                        : Math.round(discountTarget.selling_price * (1 - discountPct / 100)).toLocaleString()}
                                </strong>
                            </div>
                        </div>

                        <div className="flex gap-2 pt-2 border-t border-gray-100">
                            <button
                                onClick={() => setShowDiscountModal(false)}
                                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={executeApplyDiscount}
                                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
                            >
                                Apply Clearance Price
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 3. BATCH DETAIL DRAWER */}
            {detailItem && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-end z-50">
                    <div className="bg-white h-full w-full max-w-md shadow-2xl p-6 overflow-y-auto space-y-4 animate-in slide-in-from-right">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                            <div>
                                <h3 className="text-base font-bold text-gray-900">Batch Audit Profile</h3>
                                <p className="text-xs text-gray-500">ID #{detailItem.batch_id} • Outlet: {outletName}</p>
                            </div>
                            <button
                                onClick={() => setDetailItem(null)}
                                className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-400 flex items-center justify-center font-bold text-sm"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-2xl">
                                <h4 className="font-extrabold text-emerald-950 text-sm">{detailItem.product_name}</h4>
                                {detailItem.generic_name && (
                                    <p className="text-xs text-emerald-700 italic mt-0.5">{detailItem.generic_name}</p>
                                )}
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">
                                        {detailItem.category}
                                    </span>
                                    <span className="px-2 py-0.5 bg-white text-gray-700 border border-emerald-200 rounded text-[10px] font-bold">
                                        {detailItem.drug_type}
                                    </span>
                                    {detailItem.dosage && (
                                        <span className="px-2 py-0.5 bg-white text-gray-700 border border-emerald-200 rounded text-[10px] font-bold">
                                            {detailItem.dosage}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                    <span className="text-gray-400 block text-[10px] font-bold uppercase">Batch Number</span>
                                    <span className="font-mono font-bold text-purple-800 text-sm">{detailItem.batch_number}</span>
                                </div>
                                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                    <span className="text-gray-400 block text-[10px] font-bold uppercase">Barcode / SKU</span>
                                    <span className="font-mono font-semibold text-gray-700">{detailItem.barcode || '—'}</span>
                                </div>
                                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                    <span className="text-gray-400 block text-[10px] font-bold uppercase">Expiry Date</span>
                                    <span className="font-bold text-gray-900">{formatDate(detailItem.expiry_date)}</span>
                                </div>
                                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                    <span className="text-gray-400 block text-[10px] font-bold uppercase">Manufacture Date</span>
                                    <span className="font-semibold text-gray-700">{formatDate(detailItem.manufacture_date)}</span>
                                </div>
                            </div>

                            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-1.5 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Days Remaining:</span>
                                    <span>{getExpiryBadge(getDaysUntil(detailItem.expiry_date))}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Stock Remaining:</span>
                                    <span className="font-bold text-gray-900">
                                        {detailItem.remaining_qty} / {detailItem.quantity} {detailItem.sales_unit}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Unit Purchase Cost:</span>
                                    <span className="font-semibold text-gray-700">Ksh {detailItem.purchase_cost.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Unit Retail Price:</span>
                                    <span className="font-bold text-emerald-700">Ksh {detailItem.selling_price.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between border-t border-gray-200 pt-1.5 font-bold">
                                    <span className="text-red-600">Total Purchase Loss at Risk:</span>
                                    <span className="text-red-600">
                                        Ksh {(detailItem.purchase_cost * detailItem.remaining_qty).toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-1 text-xs">
                                <span className="text-gray-400 block text-[10px] font-bold uppercase">Supplier / Vendor</span>
                                <p className="font-semibold text-gray-800">{detailItem.supplier_name || 'Direct Procurement'}</p>
                                {detailItem.purchase_invoice && (
                                    <p className="text-gray-500 text-[11px]">Invoice: {detailItem.purchase_invoice}</p>
                                )}
                            </div>

                            {detailItem.notes && (
                                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-xs text-yellow-900">
                                    <span className="font-bold block text-[10px] uppercase">Audit Notes</span>
                                    <p className="mt-0.5">{detailItem.notes}</p>
                                </div>
                            )}
                        </div>

                        <div className="pt-4 border-t border-gray-100 flex gap-2">
                            <button
                                onClick={() => {
                                    setDisposeTarget(detailItem);
                                    setIsBulkDispose(false);
                                    setDetailItem(null);
                                    setShowDisposeModal(true);
                                }}
                                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                            >
                                Dispose Batch
                            </button>
                            <button
                                onClick={() => {
                                    setDiscountTarget(detailItem);
                                    setDetailItem(null);
                                    setShowDiscountModal(true);
                                }}
                                className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                            >
                                Clearance Promo
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
