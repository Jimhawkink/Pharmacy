'use client';

// =====================================================================
// Alpha Pharmacy - Super Ultra Massive World-Class Stock & Batches Intelligence Hub v5.5
// Realtime Live Database Sync, Multi-tier Retail/Pharmacy Fallback, Full Batches Traceability,
// Expiration Dates & Lifespan Badges, Automatic Box-Breaking Stock Breakdown,
// Visual Chart.js Analytics & Profit Trends, Expiry Timeline Horizons, Velocity Segmentation,
// High-Contrast Dark Headers, Super Premium Light Cards, Inventory Valuation Matrix,
// Super World-Class Styled Excel (.xls), Executive PDF Audit & Thermal Slips
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

export interface BatchDetail {
    batch_id: number;
    product_id: number;
    batch_number: string;
    expiry_date: string;
    remaining_qty: number;
    quantity?: number;
    purchase_cost: number;
    selling_price: number;
    status: string;
    supplier_name?: string;
    purchase_invoice?: string;
    outlet_id?: number;
    days_until_expiry?: number;
}

export interface StockProductReport {
    pid: number;
    product_code: string;
    product_name: string;
    category: string;
    purchase_unit: string;
    sales_unit: string;
    pieces_per_package: number;
    purchase_cost: number;
    sales_cost: number;
    unit_cost: number;
    reorder_point: number;
    total_pieces: number;
    stock_value_cost: number;
    stock_value_retail: number;
    potential_profit: number;
    margin_pct: number;
    status: 'ok' | 'low' | 'critical' | 'out';
    velocity: 'fast' | 'moderate' | 'slow' | 'dead';
    batches: BatchDetail[];
    active_batches_count: number;
    nearest_expiry?: string;
    has_expired_batches: boolean;
    has_near_expiry_batches: boolean;
}

export default function StockReportPage() {
    const { activeOutlet } = useOutlet();
    const outletId = activeOutlet?.outlet_id || 1;
    const outletName = activeOutlet?.outlet_name || 'Alpha Pharmacy Main Store';
    const companyName = useCompanyName() || 'Alpha Pharmacy';

    // Core State
    const [products, setProducts] = useState<StockProductReport[]>([]);
    const [allBatchesList, setAllBatchesList] = useState<BatchDetail[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastSyncTime, setLastSyncTime] = useState<string>('');

    // Super Tabs
    type SuperTab = 'catalog' | 'batches' | 'trends' | 'expiring' | 'low_stock' | 'valuation';
    const [activeTab, setActiveTab] = useState<SuperTab>('catalog');

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState('All');
    const [filterStatus, setFilterStatus] = useState('All');
    const [filterExpiryRisk, setFilterExpiryRisk] = useState('All');
    const [filterVelocity, setFilterVelocity] = useState('All');
    const [categories, setCategories] = useState<string[]>([]);

    // Expandable Rows & Selection
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
    const [selectedPids, setSelectedPids] = useState<Set<number>>(new Set());
    const [pageSize, setPageSize] = useState<number>(25);
    const [currentPage, setCurrentPage] = useState<number>(1);

    // Helper: Days until expiry
    const getDaysUntilExpiry = (expiryDate?: string): number => {
        if (!expiryDate) return 9999;
        const diff = new Date(expiryDate).getTime() - new Date().getTime();
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    };

    // Helper: Expiry Badge
    const renderExpiryBadge = (days: number) => {
        if (days < 0) {
            return (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                    EXPIRED ❌ ({Math.abs(days)}d ago)
                </span>
            );
        }
        if (days <= 30) {
            return (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                    ⚠️ Critical ({days}d left)
                </span>
            );
        }
        if (days <= 90) {
            return (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-200">
                    ⚡ Near Expiry ({days}d left)
                </span>
            );
        }
        return (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                ✓ Stable ({days}d left)
            </span>
        );
    };

    // Load Live Data with Multi-table Fallback
    const loadStockData = useCallback(async () => {
        if (!activeOutlet) return;
        setLoading(true);
        try {
            // 1. Fetch Products (pharmacy_products with retail_products fallback)
            let rawProds: any[] = [];
            const { data: pData } = await supabase
                .from('pharmacy_products')
                .select('pid, product_code, product_name, category, purchase_unit, sales_unit, purchase_cost, sales_cost, pieces_per_package, reorder_point, active')
                .order('product_name');

            if (pData && pData.length > 0) {
                rawProds = pData;
            } else {
                const { data: rData } = await supabase
                    .from('retail_products')
                    .select('pid, product_code, product_name, category, purchase_unit, sales_unit, purchase_cost, sales_cost, pieces_per_package, reorder_point, active')
                    .order('product_name');
                if (rData) rawProds = rData;
            }

            // 2. Fetch General Stock Quantities
            const { data: stockData } = await supabase
                .from('pharmacy_stock')
                .select('pid, qty')
                .eq('outlet_id', outletId);

            const stockMap: Record<number, number> = {};
            (stockData || []).forEach((s: any) => {
                stockMap[s.pid] = (stockMap[s.pid] || 0) + (Number(s.qty) || 0);
            });

            // 3. Fetch All Batches for Live Expiry & Batch Traceability
            const { data: bData } = await supabase
                .from('pharmacy_batches')
                .select('*')
                .order('expiry_date', { ascending: true });

            const batchMap: Record<number, BatchDetail[]> = {};
            const flatBatches: BatchDetail[] = [];

            (bData || []).forEach((b: any) => {
                const days = getDaysUntilExpiry(b.expiry_date);
                const batchObj: BatchDetail = {
                    batch_id: b.batch_id,
                    product_id: b.product_id,
                    batch_number: b.batch_number || 'LOT-AUTO',
                    expiry_date: b.expiry_date,
                    remaining_qty: Number(b.remaining_qty ?? b.quantity ?? 0),
                    quantity: Number(b.quantity ?? 0),
                    purchase_cost: Number(b.purchase_cost ?? 0),
                    selling_price: Number(b.selling_price ?? 0),
                    status: b.status || 'Active',
                    supplier_name: b.supplier_name,
                    purchase_invoice: b.purchase_invoice,
                    outlet_id: b.outlet_id,
                    days_until_expiry: days,
                };

                if (!batchMap[b.product_id]) batchMap[b.product_id] = [];
                batchMap[b.product_id].push(batchObj);
                flatBatches.push(batchObj);
            });

            // 4. Assemble Super Stock Products
            const assembledList: StockProductReport[] = rawProds.map((p: any) => {
                const pid = p.pid;
                const pBatches = batchMap[pid] || [];
                let totalStock = stockMap[pid] || 0;
                if (pBatches.length > 0) {
                    const batchStockSum = pBatches.reduce((sum, b) => sum + (Number(b.remaining_qty) || 0), 0);
                    if (batchStockSum > totalStock) totalStock = batchStockSum;
                }

                const ppp = Math.max(1, Number(p.pieces_per_package) || 1);
                const pCost = Number(p.purchase_cost) || 0;
                const sCost = Number(p.sales_cost) || 0;
                const uCost = pCost > 0 ? pCost / ppp : (sCost > 0 ? sCost * 0.7 : 0);
                const reorder = Number(p.reorder_point) || 10;

                let status: StockProductReport['status'] = 'ok';
                if (totalStock <= 0) status = 'out';
                else if (totalStock <= reorder * 0.3) status = 'critical';
                else if (totalStock <= reorder) status = 'low';

                // Stock Movement Velocity Classifier
                let velocity: StockProductReport['velocity'] = 'moderate';
                if (totalStock > reorder * 4 && pBatches.length > 2) velocity = 'fast';
                else if (totalStock <= 0) velocity = 'fast';
                else if (totalStock > 0 && pBatches.some((b) => (b.days_until_expiry || 0) < 60)) velocity = 'dead';
                else if (totalStock > reorder * 3) velocity = 'slow';

                const stockValCost = Math.round(totalStock * uCost);
                const stockValRetail = Math.round(totalStock * sCost);
                const potentialProfit = Math.max(0, stockValRetail - stockValCost);
                const marginPct = stockValRetail > 0 ? (potentialProfit / stockValRetail) * 100 : 0;

                const sortedBatches = [...pBatches].sort((a, b) => (a.days_until_expiry || 0) - (b.days_until_expiry || 0));
                const nearestExpiry = sortedBatches[0]?.expiry_date;
                const hasExpired = sortedBatches.some((b) => (b.days_until_expiry || 0) < 0 && b.remaining_qty > 0);
                const hasNearExpiry = sortedBatches.some((b) => (b.days_until_expiry || 0) >= 0 && (b.days_until_expiry || 0) <= 90 && b.remaining_qty > 0);

                return {
                    pid,
                    product_code: p.product_code || `DRG-${String(pid).padStart(4, '0')}`,
                    product_name: p.product_name,
                    category: p.category || 'General',
                    purchase_unit: p.purchase_unit || 'Box',
                    sales_unit: p.sales_unit || 'Piece',
                    pieces_per_package: ppp,
                    purchase_cost: pCost,
                    sales_cost: sCost,
                    unit_cost: uCost,
                    reorder_point: reorder,
                    total_pieces: totalStock,
                    stock_value_cost: stockValCost,
                    stock_value_retail: stockValRetail,
                    potential_profit: potentialProfit,
                    margin_pct: marginPct,
                    status,
                    velocity,
                    batches: sortedBatches,
                    active_batches_count: pBatches.filter((b) => b.remaining_qty > 0).length,
                    nearest_expiry: nearestExpiry,
                    has_expired_batches: hasExpired,
                    has_near_expiry_batches: hasNearExpiry,
                };
            });

            setProducts(assembledList);
            setAllBatchesList(flatBatches);
            setCategories(Array.from(new Set(assembledList.map((p) => p.category))).sort());
            setLastSyncTime(new Date().toLocaleTimeString('en-KE'));
        } catch (err) {
            console.error('Error loading stock report data:', err);
            toast.error('Failed to load stock inventory data');
        } finally {
            setLoading(false);
        }
    }, [outletId, activeOutlet]);

    useEffect(() => {
        loadStockData();
    }, [loadStockData]);

    // Expand / Collapse Handlers
    const toggleRow = (pid: number) => {
        const next = new Set(expandedRows);
        if (next.has(pid)) next.delete(pid);
        else next.add(pid);
        setExpandedRows(next);
    };

    const toggleExpandAll = () => {
        if (expandedRows.size === filteredProducts.length && filteredProducts.length > 0) {
            setExpandedRows(new Set());
        } else {
            setExpandedRows(new Set(filteredProducts.map((p) => p.pid)));
        }
    };

    // Filter Logic
    const filteredProducts = useMemo(() => {
        return products.filter((p) => {
            const q = searchQuery.toLowerCase().trim();
            const matchesSearch =
                !q ||
                p.product_name.toLowerCase().includes(q) ||
                p.product_code.toLowerCase().includes(q) ||
                p.category.toLowerCase().includes(q) ||
                p.batches.some((b) => b.batch_number.toLowerCase().includes(q));

            let matchesCategory = true;
            if (filterCategory !== 'All') {
                matchesCategory = p.category === filterCategory;
            }

            let matchesStatus = true;
            if (filterStatus !== 'All') {
                matchesStatus = p.status === filterStatus.toLowerCase();
            }

            let matchesRisk = true;
            if (filterExpiryRisk === 'expired') matchesRisk = p.has_expired_batches;
            else if (filterExpiryRisk === 'near_expiry') matchesRisk = p.has_near_expiry_batches;
            else if (filterExpiryRisk === 'safe') matchesRisk = !p.has_expired_batches && !p.has_near_expiry_batches;

            let matchesVelocity = true;
            if (filterVelocity !== 'All') {
                matchesVelocity = p.velocity === filterVelocity.toLowerCase();
            }

            let matchesTab = true;
            if (activeTab === 'expiring') matchesTab = p.has_expired_batches || p.has_near_expiry_batches;
            else if (activeTab === 'low_stock') matchesTab = p.status === 'low' || p.status === 'critical' || p.status === 'out';

            return matchesSearch && matchesCategory && matchesStatus && matchesRisk && matchesVelocity && matchesTab;
        });
    }, [products, searchQuery, filterCategory, filterStatus, filterExpiryRisk, filterVelocity, activeTab]);

    // Financial & Valuation KPI Totals
    const financials = useMemo(() => {
        let totalCost = 0;
        let totalRetail = 0;
        let totalProfit = 0;
        let totalPieces = 0;
        let lowStockCount = 0;
        let outOfStockCount = 0;
        let expiredBatchesCount = 0;
        let nearExpiryBatchesCount = 0;
        let fastMovingCount = 0;
        let deadStockRiskValue = 0;

        filteredProducts.forEach((p) => {
            totalCost += p.stock_value_cost;
            totalRetail += p.stock_value_retail;
            totalProfit += p.potential_profit;
            totalPieces += p.total_pieces;
            if (p.status === 'low' || p.status === 'critical') lowStockCount += 1;
            if (p.status === 'out') outOfStockCount += 1;
            if (p.has_expired_batches) expiredBatchesCount += 1;
            if (p.has_near_expiry_batches) nearExpiryBatchesCount += 1;
            if (p.velocity === 'fast') fastMovingCount += 1;
            if (p.velocity === 'dead' || p.has_expired_batches || p.has_near_expiry_batches) {
                deadStockRiskValue += p.stock_value_cost;
            }
        });

        const overallMarginPct = totalRetail > 0 ? (totalProfit / totalRetail) * 100 : 0;

        return {
            totalCost,
            totalRetail,
            totalProfit,
            totalPieces,
            overallMarginPct,
            lowStockCount,
            outOfStockCount,
            expiredBatchesCount,
            nearExpiryBatchesCount,
            fastMovingCount,
            deadStockRiskValue,
            totalCatalogProducts: filteredProducts.length,
        };
    }, [filteredProducts]);

    // =====================================================================
    // VISUAL CHARTS & PROFIT TRENDS CONFIGURATION
    // =====================================================================

    // 1. Category Profit & Valuation Comparison Chart (Bar Chart)
    const categoryProfitChartData = useMemo(() => {
        const topCats = categories.slice(0, 7);
        const costData: number[] = [];
        const profitData: number[] = [];

        topCats.forEach((cat) => {
            const catProds = products.filter((p) => p.category === cat);
            const cCost = catProds.reduce((sum, p) => sum + p.stock_value_cost, 0);
            const cProfit = catProds.reduce((sum, p) => sum + p.potential_profit, 0);
            costData.push(cCost);
            profitData.push(cProfit);
        });

        return {
            labels: topCats,
            datasets: [
                {
                    label: 'Invested Cost Outlay (KES)',
                    data: costData,
                    backgroundColor: 'rgba(15, 23, 42, 0.85)',
                    borderRadius: 6,
                },
                {
                    label: 'Projected Gross Profit (KES)',
                    data: profitData,
                    backgroundColor: 'rgba(16, 185, 129, 0.85)',
                    borderRadius: 6,
                },
            ],
        };
    }, [categories, products]);

    // 2. Expiry Horizon Risk Doughnut
    const expiryRiskDoughnutData = useMemo(() => {
        let expired = 0;
        let critical30 = 0;
        let near90 = 0;
        let safe = 0;

        allBatchesList.forEach((b) => {
            const days = b.days_until_expiry || getDaysUntilExpiry(b.expiry_date);
            if (days < 0) expired += b.remaining_qty;
            else if (days <= 30) critical30 += b.remaining_qty;
            else if (days <= 90) near90 += b.remaining_qty;
            else safe += b.remaining_qty;
        });

        return {
            labels: ['Expired (Urgent Writeoff)', 'Critical (< 30 Days)', 'Near Expiry (31-90 Days)', 'Good Shelf Life (> 90 Days)'],
            datasets: [
                {
                    data: [expired, critical30, near90, safe],
                    backgroundColor: ['#E11D48', '#F43F5E', '#F59E0B', '#10B981'],
                    borderColor: '#FFFFFF',
                    borderWidth: 2,
                },
            ],
        };
    }, [allBatchesList]);

    // 3. Stock Health & Velocity Distribution
    const velocityDoughnutData = useMemo(() => {
        let fastCount = 0;
        let moderateCount = 0;
        let slowCount = 0;
        let deadCount = 0;

        products.forEach((p) => {
            if (p.velocity === 'fast') fastCount += 1;
            else if (p.velocity === 'moderate') moderateCount += 1;
            else if (p.velocity === 'slow') slowCount += 1;
            else deadCount += 1;
        });

        return {
            labels: ['Fast Moving / High Flow', 'Moderate Turnover', 'Slow Moving Reserve', 'Dead Stock / Capital At Risk'],
            datasets: [
                {
                    data: [fastCount, moderateCount, slowCount, deadCount],
                    backgroundColor: ['#047857', '#0284C7', '#F59E0B', '#9333EA'],
                    borderColor: '#FFFFFF',
                    borderWidth: 2,
                },
            ],
        };
    }, [products]);

    // Pagination
    const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
    const paginatedProducts = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredProducts.slice(start, start + pageSize);
    }, [filteredProducts, currentPage, pageSize]);

    // Selection
    const toggleSelectAll = () => {
        if (selectedPids.size === paginatedProducts.length && paginatedProducts.length > 0) {
            setSelectedPids(new Set());
        } else {
            setSelectedPids(new Set(paginatedProducts.map((p) => p.pid)));
        }
    };

    const toggleSelectOne = (pid: number) => {
        const next = new Set(selectedPids);
        if (next.has(pid)) next.delete(pid);
        else next.add(pid);
        setSelectedPids(next);
    };

    // Export to Super World-Class Styled Excel (.xls)
    const exportToSuperExcel = () => {
        if (filteredProducts.length === 0) {
            toast.error('No stock records to export');
            return;
        }

        const now = new Date();
        const exportDate = now.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });

        const xmlString = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#1E293B"/>
  </Style>
  <Style ss:ID="Title">
   <Font ss:FontName="Calibri" ss:Size="16" ss:Bold="1" ss:Color="#047857"/>
  </Style>
  <Style ss:ID="Subtitle">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#64748B"/>
  </Style>
  <Style ss:ID="KpiHeader">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="9" ss:Bold="1" ss:Color="#475569"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="KpiGreen">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="12" ss:Bold="1" ss:Color="#047857"/>
   <Interior ss:Color="#ECFDF5" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="#,##0"/>
  </Style>
  <Style ss:ID="KpiBlue">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="12" ss:Bold="1" ss:Color="#1D4ED8"/>
   <Interior ss:Color="#EFF6FF" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="#,##0"/>
  </Style>
  <Style ss:ID="ColHeader">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#0F172A" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="RowEven"><Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/></Style>
  <Style ss:ID="RowOdd"><Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/></Style>
  <Style ss:ID="GrandTotal">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#0F172A"/>
   <Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="#,##0"/>
  </Style>
 </Styles>

 <Worksheet ss:Name="Stock Master Valuation">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="40"/>
   <Column ss:Width="80"/>
   <Column ss:Width="180"/>
   <Column ss:Width="110"/>
   <Column ss:Width="70"/>
   <Column ss:Width="70"/>
   <Column ss:Width="110"/>
   <Column ss:Width="80"/>
   <Column ss:Width="80"/>
   <Column ss:Width="100"/>
   <Column ss:Width="100"/>
   <Column ss:Width="100"/>
   <Column ss:Width="70"/>
   <Column ss:Width="80"/>
   <Column ss:Width="80"/>

   <Row ss:Height="26">
    <Cell ss:MergeAcross="14" ss:StyleID="Title"><Data ss:Type="String">${companyName} — Master Inventory Valuation &amp; Batches Ledger</Data></Cell>
   </Row>
   <Row ss:Height="16">
    <Cell ss:MergeAcross="14" ss:StyleID="Subtitle"><Data ss:Type="String">Outlet: ${outletName} | Exported: ${exportDate} | Catalog: ${filteredProducts.length} Items</Data></Cell>
   </Row>
   <Row ss:Height="10"/>

   <!-- KPI Summary Block -->
   <Row ss:Height="18">
    <Cell ss:MergeAcross="2" ss:StyleID="KpiHeader"><Data ss:Type="String">COST OUTLAY (VALUATION)</Data></Cell>
    <Cell ss:MergeAcross="2" ss:StyleID="KpiHeader"><Data ss:Type="String">PROJECTED RETAIL VALUE</Data></Cell>
    <Cell ss:MergeAcross="2" ss:StyleID="KpiHeader"><Data ss:Type="String">POTENTIAL GROSS PROFIT</Data></Cell>
    <Cell ss:MergeAcross="2" ss:StyleID="KpiHeader"><Data ss:Type="String">TOTAL DISPENSING UNITS</Data></Cell>
    <Cell ss:MergeAcross="2" ss:StyleID="KpiHeader"><Data ss:Type="String">EXPIRY RISK ITEMS</Data></Cell>
   </Row>
   <Row ss:Height="24">
    <Cell ss:MergeAcross="2" ss:StyleID="KpiGreen"><Data ss:Type="Number">${financials.totalCost}</Data></Cell>
    <Cell ss:MergeAcross="2" ss:StyleID="KpiBlue"><Data ss:Type="Number">${financials.totalRetail}</Data></Cell>
    <Cell ss:MergeAcross="2" ss:StyleID="KpiGreen"><Data ss:Type="Number">${financials.totalProfit}</Data></Cell>
    <Cell ss:MergeAcross="2" ss:StyleID="KpiBlue"><Data ss:Type="Number">${financials.totalPieces}</Data></Cell>
    <Cell ss:MergeAcross="2" ss:StyleID="KpiBlue"><Data ss:Type="Number">${financials.expiredBatchesCount + financials.nearExpiryBatchesCount}</Data></Cell>
   </Row>
   <Row ss:Height="12"/>

   <!-- Column Headers -->
   <Row ss:Height="24">
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">#</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Code</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Product Name</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Category</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Buy Unit</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Sell Unit</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Physical Breakdown</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Piece Cost</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Retail Price</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Cost Outlay</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Retail Potential</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Projected Margin</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Margin %</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Batches</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">Health</Data></Cell>
   </Row>

   <!-- Product Rows -->
   ${filteredProducts.map((p, idx) => {
       const rowStyle = idx % 2 === 0 ? 'RowEven' : 'RowOdd';
       const bd = calculateStockBreakdown(p.total_pieces, p.pieces_per_package, p.purchase_unit, p.sales_unit);
       return `<Row ss:Height="20">
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="Number">${idx + 1}</Data></Cell>
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="String">${p.product_code}</Data></Cell>
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="String">${p.product_name.replace(/&/g, '&amp;')}</Data></Cell>
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="String">${p.category.replace(/&/g, '&amp;')}</Data></Cell>
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="String">${p.purchase_unit}</Data></Cell>
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="String">${p.sales_unit}</Data></Cell>
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="String">${bd.displayText}</Data></Cell>
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="Number">${p.unit_cost}</Data></Cell>
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="Number">${p.sales_cost}</Data></Cell>
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="Number">${p.stock_value_cost}</Data></Cell>
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="Number">${p.stock_value_retail}</Data></Cell>
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="Number">${p.potential_profit}</Data></Cell>
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="Number">${p.margin_pct.toFixed(1)}</Data></Cell>
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="Number">${p.active_batches_count}</Data></Cell>
    <Cell ss:StyleID="${rowStyle}"><Data ss:Type="String">${p.status.toUpperCase()}</Data></Cell>
   </Row>`;
   }).join('\n')}

   <!-- Grand Total Row -->
   <Row ss:Height="24">
    <Cell ss:MergeAcross="8" ss:StyleID="GrandTotal"><Data ss:Type="String">TOTAL INVENTORY VALUATION (${filteredProducts.length} PRODUCTS):</Data></Cell>
    <Cell ss:StyleID="GrandTotal"><Data ss:Type="Number">${financials.totalCost}</Data></Cell>
    <Cell ss:StyleID="GrandTotal"><Data ss:Type="Number">${financials.totalRetail}</Data></Cell>
    <Cell ss:StyleID="GrandTotal"><Data ss:Type="Number">${financials.totalProfit}</Data></Cell>
    <Cell ss:StyleID="GrandTotal"><Data ss:Type="Number">${financials.overallMarginPct.toFixed(1)}</Data></Cell>
    <Cell ss:MergeAcross="1" ss:StyleID="GrandTotal"><Data ss:Type="String">—</Data></Cell>
   </Row>
  </Table>
 </Worksheet>
</Workbook>`;

        const blob = new Blob([xmlString], { type: 'application/vnd.ms-excel;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AlphaPharmacy_Stock_Valuation_${exportDate.replace(/ /g, '_')}_SuperExcel.xls`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`Exported ${filteredProducts.length} stock items to Super World-Class Excel!`);
    };

    // Executive PDF Report Generator
    const printReport = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            toast.error('Please allow popups to open the PDF report');
            return;
        }

        const now = new Date();
        const html = `<!DOCTYPE html>
<html>
<head>
    <title>Executive Stock &amp; Batches Valuation Audit — ${companyName}</title>
    <style>
        @page { size: A4 landscape; margin: 8mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 0; font-size: 9px; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2.5px solid #047857; padding-bottom: 8px; margin-bottom: 10px; }
        .logo-box { font-size: 16px; font-weight: 900; color: #047857; }
        .meta { text-align: right; font-size: 8px; color: #64748b; }
        .kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-bottom: 10px; }
        .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px; text-align: center; }
        .kpi-label { font-size: 7.5px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 2px; }
        .kpi-value { font-size: 12px; font-weight: 900; color: #0f172a; font-family: monospace; }
        table { width: 100%; border-collapse: collapse; font-size: 8.5px; }
        th { background: #0f172a; color: white; padding: 5px 6px; text-align: left; font-weight: 800; border-bottom: 2px solid #10b981; }
        td { padding: 4px 6px; border-bottom: 1px solid #e2e8f0; }
        tr:nth-child(even) { background-color: #f8fafc; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .font-mono { font-family: monospace; }
        .total-row { background: #f1f5f9; font-weight: 900; border-top: 2px solid #cbd5e1; }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <div class="logo-box">🏥 ${companyName}</div>
            <div style="font-size: 10px; font-weight: 700; color: #334155;">Master Inventory Valuation &amp; Batches Traceability Audit</div>
            <div style="font-size: 8px; color: #64748b;">Outlet: ${outletName}</div>
        </div>
        <div class="meta">
            <div><strong>Generated:</strong> ${now.toLocaleDateString('en-KE')} ${now.toLocaleTimeString('en-KE')}</div>
            <div><strong>Total Catalog:</strong> ${filteredProducts.length} Items</div>
        </div>
    </div>

    <div class="kpi-grid">
        <div class="kpi-card">
            <div class="kpi-label">Cost Outlay (Valuation)</div>
            <div class="kpi-value" style="color: #047857;">KES ${financials.totalCost.toLocaleString()}</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">Projected Retail Value</div>
            <div class="kpi-value" style="color: #0d9488;">KES ${financials.totalRetail.toLocaleString()}</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">Projected Gross Margin</div>
            <div class="kpi-value" style="color: #059669;">+${financials.totalProfit.toLocaleString()} (${financials.overallMarginPct.toFixed(1)}%)</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">Total Units In Store</div>
            <div class="kpi-value">${financials.totalPieces.toLocaleString()} Pcs</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">Expiry Risk Alerts</div>
            <div class="kpi-value" style="color: #e11d48;">${financials.expiredBatchesCount + financials.nearExpiryBatchesCount} Items</div>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th style="width: 25px;">#</th>
                <th>Code</th>
                <th>Product Name</th>
                <th>Category</th>
                <th>Pack Size</th>
                <th class="text-right">Total Pcs</th>
                <th>Stock Breakdown</th>
                <th class="text-right">Unit Cost</th>
                <th class="text-right">Retail Price</th>
                <th class="text-right">Cost Outlay</th>
                <th class="text-right">Retail Potential</th>
                <th class="text-center">Status</th>
            </tr>
        </thead>
        <tbody>
            ${filteredProducts.map((p, i) => {
                const bd = calculateStockBreakdown(p.total_pieces, p.pieces_per_package, p.purchase_unit, p.sales_unit);
                return `
                <tr>
                    <td>${i + 1}</td>
                    <td class="font-mono">${p.product_code}</td>
                    <td><strong>${p.product_name}</strong></td>
                    <td>${p.category}</td>
                    <td>${p.pieces_per_package} pcs/${p.purchase_unit}</td>
                    <td class="text-right font-mono">${p.total_pieces}</td>
                    <td><strong>${bd.displayText}</strong></td>
                    <td class="text-right font-mono">KES ${p.unit_cost.toLocaleString()}</td>
                    <td class="text-right font-mono">KES ${p.sales_cost.toLocaleString()}</td>
                    <td class="text-right font-mono">KES ${p.stock_value_cost.toLocaleString()}</td>
                    <td class="text-right font-mono">KES ${p.stock_value_retail.toLocaleString()}</td>
                    <td class="text-center"><strong>${p.status.toUpperCase()}</strong></td>
                </tr>
            `;
            }).join('')}
            <tr class="total-row">
                <td colspan="5" class="text-right">TOTAL INVENTORY VALUATION:</td>
                <td class="text-right font-mono">${financials.totalPieces.toLocaleString()}</td>
                <td>—</td>
                <td colspan="2"></td>
                <td class="text-right font-mono" style="color: #047857;">KES ${financials.totalCost.toLocaleString()}</td>
                <td class="text-right font-mono" style="color: #0d9488;">KES ${financials.totalRetail.toLocaleString()}</td>
                <td class="text-center">✓</td>
            </tr>
        </tbody>
    </table>

    <script>window.onload = function() { window.print(); };</script>
</body>
</html>`;

        printWindow.document.write(html);
        printWindow.document.close();
    };

    return (
        <div className="space-y-4 max-w-full pb-12">
            {/* Header with Live Sync Status & Super Export Buttons */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white rounded-3xl p-5 border border-gray-200/80 shadow-xs">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 text-white flex items-center justify-center text-2xl font-bold shadow-md flex-shrink-0">
                        📦
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">
                                Stock Valuation &amp; Batches Intelligence Hub
                            </h1>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                LIVE DB REALTIME
                            </span>
                            {lastSyncTime && (
                                <span className="text-[10px] font-mono text-gray-400">
                                    Synced: {lastSyncTime}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-gray-500 font-medium mt-0.5">
                            Realtime inventory valuation, FEFO batch lifespan traceability, box-breaking breakdown &amp; reorder engine
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={loadStockData}
                        disabled={loading}
                        className="px-3.5 py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 active:scale-95 disabled:opacity-60 shadow-2xs"
                        title="Sync live records from database"
                    >
                        <span className={loading ? 'animate-spin' : ''}>🔄</span>
                        {loading ? 'Syncing...' : 'Sync Live'}
                    </button>

                    <button
                        onClick={exportToSuperExcel}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm hover:shadow active:scale-95"
                        title="Download styled Excel ledger"
                    >
                        <span>📊</span>
                        Super Excel (.xls)
                    </button>

                    <button
                        onClick={printReport}
                        className="px-4 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95"
                        title="Print / Save Executive PDF report"
                    >
                        <span>📑</span>
                        PDF Audit
                    </button>
                </div>
            </div>

            {/* SUPER PREMIUM LIGHT CARDS (NO THICK DARK COLORED CARDS) */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
                {/* 1. Total Catalog Products */}
                <div className="bg-white rounded-2xl p-4.5 border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between border-t-4 border-t-emerald-500 group">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Stock Catalog</span>
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center text-base font-bold shadow-2xs group-hover:scale-105 transition-transform">
                            📦
                        </div>
                    </div>
                    <div>
                        <div className="text-2xl font-black text-slate-900 tracking-tight font-mono">
                            {financials.totalCatalogProducts.toLocaleString()}
                        </div>
                        <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/60">
                            <span>{financials.totalPieces.toLocaleString()} total units</span>
                        </div>
                    </div>
                </div>

                {/* 2. Valuation (Cost Outlay) */}
                <div className="bg-white rounded-2xl p-4.5 border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between border-t-4 border-t-teal-500 group">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Cost Valuation</span>
                        <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center text-base font-bold shadow-2xs group-hover:scale-105 transition-transform">
                            💰
                        </div>
                    </div>
                    <div>
                        <div className="text-2xl font-black text-teal-900 tracking-tight font-mono">
                            KES {financials.totalCost.toLocaleString()}
                        </div>
                        <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200/60">
                            <span>Actual purchase outlay</span>
                        </div>
                    </div>
                </div>

                {/* 3. Potential Retail Value */}
                <div className="bg-white rounded-2xl p-4.5 border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between border-t-4 border-t-sky-500 group">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Retail Potential</span>
                        <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-200 text-sky-700 flex items-center justify-center text-base font-bold shadow-2xs group-hover:scale-105 transition-transform">
                            📈
                        </div>
                    </div>
                    <div>
                        <div className="text-2xl font-black text-slate-900 tracking-tight font-mono">
                            KES {financials.totalRetail.toLocaleString()}
                        </div>
                        <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-sky-50 text-sky-800 border border-sky-200/60">
                            <span>+{financials.totalProfit.toLocaleString()} ({financials.overallMarginPct.toFixed(1)}% margin)</span>
                        </div>
                    </div>
                </div>

                {/* 4. Expiry Risk Alert */}
                <div className="bg-white rounded-2xl p-4.5 border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between border-t-4 border-t-rose-500 group">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Expiry Alert (90D)</span>
                        <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center text-base font-bold shadow-2xs group-hover:scale-105 transition-transform">
                            ⚠️
                        </div>
                    </div>
                    <div>
                        <div className="text-2xl font-black text-rose-700 tracking-tight font-mono">
                            {financials.expiredBatchesCount + financials.nearExpiryBatchesCount}
                        </div>
                        <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200/60">
                            <span>{financials.expiredBatchesCount} expired • {financials.nearExpiryBatchesCount} near-expiry</span>
                        </div>
                    </div>
                </div>

                {/* 5. Reorder Alerts */}
                <div className="bg-white rounded-2xl p-4.5 border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between border-t-4 border-t-amber-500 col-span-2 md:col-span-1 group">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Reorder Alert</span>
                        <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center text-base font-bold shadow-2xs group-hover:scale-105 transition-transform">
                            ⚡
                        </div>
                    </div>
                    <div>
                        <div className="text-2xl font-black text-slate-900 tracking-tight font-mono">
                            {financials.lowStockCount + financials.outOfStockCount}
                        </div>
                        <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200/60">
                            <span>{financials.lowStockCount} low • {financials.outOfStockCount} out of stock</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Super Tabs Bar */}
            <div className="bg-white rounded-2xl border border-gray-200/80 p-2 shadow-xs flex items-center justify-between gap-2 overflow-x-auto">
                <div className="flex items-center gap-1.5 min-w-max">
                    <button
                        onClick={() => setActiveTab('catalog')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                            activeTab === 'catalog'
                                ? 'bg-slate-900 text-white shadow-sm'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                    >
                        <span>📦</span> All Stock Catalog ({products.length})
                    </button>

                    <button
                        onClick={() => setActiveTab('trends')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                            activeTab === 'trends'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                    >
                        <span>📊</span> Profit Trends &amp; Visual Analytics
                    </button>

                    <button
                        onClick={() => setActiveTab('batches')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                            activeTab === 'batches'
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                    >
                        <span>🏷️</span> Live Batch Register ({allBatchesList.length})
                    </button>

                    <button
                        onClick={() => setActiveTab('expiring')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                            activeTab === 'expiring'
                                ? 'bg-rose-600 text-white shadow-sm'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                    >
                        <span>⚠️</span> Expiring &amp; FEFO Risk ({financials.expiredBatchesCount + financials.nearExpiryBatchesCount})
                    </button>

                    <button
                        onClick={() => setActiveTab('low_stock')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                            activeTab === 'low_stock'
                                ? 'bg-amber-600 text-white shadow-sm'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                    >
                        <span>⚡</span> Low Stock &amp; Reorder ({financials.lowStockCount + financials.outOfStockCount})
                    </button>

                    <button
                        onClick={() => setActiveTab('valuation')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                            activeTab === 'valuation'
                                ? 'bg-teal-600 text-white shadow-sm'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                    >
                        <span>💰</span> Category Valuation Matrix
                    </button>
                </div>
            </div>

            {/* Filter Hub Toolbar */}
            <div className="bg-white rounded-3xl p-4 border border-gray-200/80 shadow-xs space-y-3">
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                    {/* Search Bar */}
                    <div className="relative flex-1">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                        <input
                            type="text"
                            placeholder="Search by medicine name, drug code, category or batch lot #..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50/80 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Filter Dropdowns */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none focus:border-emerald-500"
                        >
                            <option value="All">All Categories</option>
                            {categories.map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>

                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none focus:border-emerald-500"
                        >
                            <option value="All">All Stock Levels</option>
                            <option value="ok">In Stock (Good)</option>
                            <option value="low">Low Stock (&lt; Reorder)</option>
                            <option value="critical">Critical Stock</option>
                            <option value="out">Out of Stock</option>
                        </select>

                        <select
                            value={filterExpiryRisk}
                            onChange={(e) => setFilterExpiryRisk(e.target.value)}
                            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none focus:border-emerald-500"
                        >
                            <option value="All">All Lifespans</option>
                            <option value="near_expiry">Near Expiry (&lt; 90 Days)</option>
                            <option value="expired">Expired Batches</option>
                            <option value="safe">Safe Lifespan (&gt; 90 Days)</option>
                        </select>

                        <select
                            value={filterVelocity}
                            onChange={(e) => setFilterVelocity(e.target.value)}
                            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none focus:border-emerald-500"
                        >
                            <option value="All">All Velocity</option>
                            <option value="fast">Fast Moving</option>
                            <option value="moderate">Moderate Turnover</option>
                            <option value="slow">Slow Moving Reserve</option>
                            <option value="dead">Dead Stock / At Risk</option>
                        </select>

                        <button
                            onClick={toggleExpandAll}
                            className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
                            title="Expand or collapse batch breakdown for all rows"
                        >
                            <span>{expandedRows.size === filteredProducts.length && filteredProducts.length > 0 ? '▼' : '▶'}</span>
                            {expandedRows.size === filteredProducts.length && filteredProducts.length > 0 ? 'Collapse All' : 'Expand All Batches'}
                        </button>
                    </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-gray-400 font-medium pt-1 border-t border-gray-100">
                    <span>Showing {filteredProducts.length} filtered pharmaceutical products</span>
                    <span>Total inventory piece count: <strong className="text-gray-900 font-mono">{financials.totalPieces.toLocaleString()} pcs</strong></span>
                </div>
            </div>

            {/* TAB 1: MASTER STOCK CATALOG & VALUATION WITH DARK HIGH-CONTRAST HEADERS */}
            {(activeTab === 'catalog' || activeTab === 'expiring' || activeTab === 'low_stock') && (
                <div className="bg-white rounded-3xl border border-gray-200/80 shadow-xs overflow-hidden">
                    {/* Header Strip */}
                    <div className="px-5 py-3 border-b border-gray-100 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2">
                            <span className="font-black text-slate-800 text-sm">
                                Pharmaceutical Stock Valuation Register
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                {filteredProducts.length} Items Listed
                            </span>
                            {selectedPids.size > 0 && (
                                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-indigo-100 text-indigo-800 border border-indigo-300">
                                    {selectedPids.size} Selected
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <label className="text-[11px] font-bold text-slate-500">Rows per page:</label>
                            <select
                                value={pageSize}
                                onChange={(e) => {
                                    setPageSize(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                                className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                    </div>

                    {loading ? (
                        <div className="p-12 text-center text-gray-500">
                            <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-3" />
                            <p className="text-xs font-bold text-gray-600">Calculating real-time stock valuation &amp; batch lifespans...</p>
                        </div>
                    ) : filteredProducts.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">
                            <div className="text-4xl mb-2">📦</div>
                            <p className="text-sm font-bold text-gray-800">No stock products match your filter</p>
                            <p className="text-xs text-gray-400 mt-1">Try resetting the category or expiry risk filter.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                {/* HIGH-CONTRAST DARK VISIBLE HEADERS */}
                                <thead className="bg-slate-900 border-b-2 border-emerald-500 text-white font-black uppercase text-[11px] tracking-wider shadow-md">
                                    <tr>
                                        <th className="w-8 py-3.5 px-2 text-center text-white font-black"></th>
                                        <th className="w-8 py-3.5 px-2 text-center text-white font-black">
                                            <input
                                                type="checkbox"
                                                checked={selectedPids.size === paginatedProducts.length && paginatedProducts.length > 0}
                                                onChange={toggleSelectAll}
                                                className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                                            />
                                        </th>
                                        <th className="py-3.5 px-3 text-left text-white font-black whitespace-nowrap">Drug / Pharmaceutical</th>
                                        <th className="py-3.5 px-3 text-left text-white font-black whitespace-nowrap">Category</th>
                                        <th className="py-3.5 px-3 text-center text-white font-black whitespace-nowrap">Batches &amp; FEFO</th>
                                        <th className="py-3.5 px-3 text-center text-white font-black whitespace-nowrap">Physical Stock (Box Breakdown)</th>
                                        <th className="py-3.5 px-3 text-right text-white font-black whitespace-nowrap">Piece Cost</th>
                                        <th className="py-3.5 px-3 text-right text-white font-black whitespace-nowrap">Retail Price</th>
                                        <th className="py-3.5 px-3 text-right text-white font-black whitespace-nowrap">Cost Outlay</th>
                                        <th className="py-3.5 px-3 text-right text-white font-black whitespace-nowrap">Retail Potential</th>
                                        <th className="py-3.5 px-3 text-right text-white font-black whitespace-nowrap">Margin %</th>
                                        <th className="py-3.5 px-3 text-center text-white font-black whitespace-nowrap">Stock Health</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {paginatedProducts.map((p) => {
                                        const isExpanded = expandedRows.has(p.pid);
                                        const isSelected = selectedPids.has(p.pid);
                                        const bd = calculateStockBreakdown(p.total_pieces, p.pieces_per_package, p.purchase_unit, p.sales_unit);

                                        return (
                                            <Fragment key={p.pid}>
                                                <tr
                                                    onClick={() => toggleRow(p.pid)}
                                                    className={`hover:bg-emerald-50/40 transition cursor-pointer ${
                                                        isSelected ? 'bg-indigo-50/50' : isExpanded ? 'bg-emerald-50/60' : ''
                                                    }`}
                                                >
                                                    {/* Chevron Toggle */}
                                                    <td className="py-3 px-2 text-center text-gray-400" onClick={(e) => { e.stopPropagation(); toggleRow(p.pid); }}>
                                                        <span className={`inline-block transition-transform duration-200 font-bold ${isExpanded ? 'rotate-90 text-emerald-700' : ''}`}>
                                                            ▶
                                                        </span>
                                                    </td>

                                                    {/* Checkbox */}
                                                    <td className="py-3 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => toggleSelectOne(p.pid)}
                                                            className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                                                        />
                                                    </td>

                                                    {/* Product Details */}
                                                    <td className="py-3 px-3">
                                                        <span className="font-black text-gray-900 block text-xs">{p.product_name}</span>
                                                        <span className="text-[10px] font-mono text-gray-400 block">{p.product_code} • Pack: {p.pieces_per_package} pcs/{p.purchase_unit}</span>
                                                    </td>

                                                    {/* Category */}
                                                    <td className="py-3 px-3">
                                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                                                            {p.category}
                                                        </span>
                                                    </td>

                                                    {/* Batches & FEFO summary */}
                                                    <td className="py-3 px-3 text-center">
                                                        <div className="flex flex-col items-center gap-0.5">
                                                            <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                                {p.batches.length} batch{p.batches.length === 1 ? '' : 'es'}
                                                            </span>
                                                            {p.has_expired_batches ? (
                                                                <span className="text-[9px] font-black text-rose-600 animate-pulse">Has Expired Batch</span>
                                                            ) : p.has_near_expiry_batches ? (
                                                                <span className="text-[9px] font-bold text-amber-600">Expiring &lt;90d</span>
                                                            ) : p.batches.length > 0 ? (
                                                                <span className="text-[9px] text-emerald-700 font-semibold">Good Shelf Life</span>
                                                            ) : null}
                                                        </div>
                                                    </td>

                                                    {/* Physical Stock with Box Breaking Breakdown */}
                                                    <td className="py-3 px-3 text-center">
                                                        <div className="inline-flex flex-col items-center">
                                                            <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-emerald-50 text-emerald-950 border border-emerald-300 shadow-2xs">
                                                                {bd.displayText}
                                                            </span>
                                                            <span className="text-[10px] text-gray-400 font-mono mt-0.5">
                                                                ({p.total_pieces.toLocaleString()} total {p.sales_unit}s)
                                                            </span>
                                                        </div>
                                                    </td>

                                                    {/* Unit Piece Cost */}
                                                    <td className="py-3 px-3 text-right font-mono text-gray-700">
                                                        KES {p.unit_cost.toLocaleString()}
                                                    </td>

                                                    {/* Retail Selling Price */}
                                                    <td className="py-3 px-3 text-right font-mono font-bold text-gray-900">
                                                        KES {p.sales_cost.toLocaleString()}
                                                    </td>

                                                    {/* Cost Outlay */}
                                                    <td className="py-3 px-3 text-right font-mono font-bold text-teal-900">
                                                        KES {p.stock_value_cost.toLocaleString()}
                                                    </td>

                                                    {/* Retail Potential */}
                                                    <td className="py-3 px-3 text-right font-mono font-black text-slate-900">
                                                        KES {p.stock_value_retail.toLocaleString()}
                                                    </td>

                                                    {/* Margin % */}
                                                    <td className="py-3 px-3 text-right font-mono">
                                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-teal-50 text-teal-800 border border-teal-200">
                                                            {p.margin_pct.toFixed(1)}%
                                                        </span>
                                                    </td>

                                                    {/* Stock Health */}
                                                    <td className="py-3 px-3 text-center whitespace-nowrap">
                                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                                                            p.status === 'ok'
                                                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                                                : p.status === 'low'
                                                                ? 'bg-amber-50 text-amber-800 border-amber-300'
                                                                : p.status === 'critical'
                                                                ? 'bg-rose-50 text-rose-800 border-rose-300 animate-pulse'
                                                                : 'bg-gray-100 text-gray-600 border-gray-300'
                                                        }`}>
                                                            {p.status.toUpperCase()}
                                                        </span>
                                                    </td>
                                                </tr>

                                                {/* Expanded Row Itemized Batches Table with Dark Headers */}
                                                {isExpanded && (
                                                    <tr className="bg-emerald-50/20">
                                                        <td colSpan={12} className="px-4 md:px-8 py-3">
                                                            <div className="bg-white rounded-2xl border-2 border-emerald-300 shadow-md overflow-hidden">
                                                                <div className="px-4 py-2.5 bg-slate-900 border-b border-emerald-500 flex items-center justify-between text-xs text-white">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-black uppercase tracking-wider text-emerald-400 text-xs">
                                                                            🏷️ Live Batch Register for {p.product_name} ({p.batches.length} {p.batches.length === 1 ? 'Batch' : 'Batches'})
                                                                        </span>
                                                                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500 text-slate-950">
                                                                            Pack: {p.pieces_per_package} pcs/{p.purchase_unit}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-3 text-[11px] font-bold">
                                                                        <span className="text-slate-300">
                                                                            Total Stock: <strong className="text-white font-mono">{p.total_pieces} {p.sales_unit}s</strong>
                                                                        </span>
                                                                        <span className="text-slate-300">
                                                                            Valuation: <strong className="text-emerald-400 font-mono">KES {p.stock_value_cost.toLocaleString()}</strong>
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                {p.batches.length === 0 ? (
                                                                    <div className="p-6 text-center text-gray-400 text-xs">
                                                                        No individual lot batches registered yet. Inventory is tracked under general balance.
                                                                    </div>
                                                                ) : (
                                                                    <div className="overflow-x-auto">
                                                                        <table className="w-full text-xs">
                                                                            <thead className="bg-slate-900 border-b border-emerald-500 text-white font-black uppercase text-[10px] tracking-wider">
                                                                                <tr>
                                                                                    <th className="py-2.5 px-3 text-left text-white font-black">#</th>
                                                                                    <th className="py-2.5 px-3 text-left text-white font-black">Batch / Lot #</th>
                                                                                    <th className="py-2.5 px-3 text-center text-white font-black">Expiry Date</th>
                                                                                    <th className="py-2.5 px-3 text-center text-white font-black">Lifespan / FEFO</th>
                                                                                    <th className="py-2.5 px-3 text-right text-white font-black">Remaining Stock</th>
                                                                                    <th className="py-2.5 px-3 text-right text-white font-black">Batch Breakdown</th>
                                                                                    <th className="py-2.5 px-3 text-right text-white font-black">Unit Buy Cost</th>
                                                                                    <th className="py-2.5 px-3 text-right text-white font-black">Retail Sell Price</th>
                                                                                    <th className="py-2.5 px-3 text-left text-white font-black">Supplier / GRN</th>
                                                                                    <th className="py-2.5 px-3 text-center text-white font-black">Status</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-gray-100">
                                                                                {p.batches.map((b, bIdx) => {
                                                                                    const bBreakdown = calculateStockBreakdown(b.remaining_qty, p.pieces_per_package, p.purchase_unit, p.sales_unit);
                                                                                    const days = b.days_until_expiry || getDaysUntilExpiry(b.expiry_date);

                                                                                    return (
                                                                                        <tr key={b.batch_id || bIdx} className="hover:bg-gray-50/50 transition">
                                                                                            <td className="py-2.5 px-3 text-gray-400 font-bold">{bIdx + 1}</td>
                                                                                            <td className="py-2.5 px-3">
                                                                                                <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-indigo-50 text-indigo-800 border border-indigo-200">
                                                                                                    {b.batch_number}
                                                                                                </span>
                                                                                            </td>
                                                                                            <td className="py-2.5 px-3 text-center font-mono font-semibold text-gray-700">
                                                                                                {b.expiry_date ? new Date(b.expiry_date).toLocaleDateString('en-GB') : '—'}
                                                                                            </td>
                                                                                            <td className="py-2.5 px-3 text-center">
                                                                                                {renderExpiryBadge(days)}
                                                                                            </td>
                                                                                            <td className="py-2.5 px-3 text-right font-black font-mono text-gray-900">
                                                                                                {b.remaining_qty} {p.sales_unit}s
                                                                                            </td>
                                                                                            <td className="py-2.5 px-3 text-right">
                                                                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-50 text-emerald-900 border border-emerald-200">
                                                                                                    {bBreakdown.displayText}
                                                                                                </span>
                                                                                            </td>
                                                                                            <td className="py-2.5 px-3 text-right font-mono text-gray-600">
                                                                                                KES {b.purchase_cost > 0 ? b.purchase_cost.toLocaleString() : p.unit_cost.toLocaleString()}
                                                                                            </td>
                                                                                            <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-900">
                                                                                                KES {b.selling_price > 0 ? b.selling_price.toLocaleString() : p.sales_cost.toLocaleString()}
                                                                                            </td>
                                                                                            <td className="py-2.5 px-3 text-gray-600 font-mono text-[10px]">
                                                                                                {b.supplier_name || b.purchase_invoice || 'Alpha Main Intake'}
                                                                                            </td>
                                                                                            <td className="py-2.5 px-3 text-center">
                                                                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                                                                                    {b.status}
                                                                                                </span>
                                                                                            </td>
                                                                                        </tr>
                                                                                    );
                                                                                })}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination Strip */}
                    <div className="p-4 border-t border-gray-100 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                        <div className="text-gray-500 font-medium">
                            Showing <strong className="text-gray-900">{filteredProducts.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</strong> to{' '}
                            <strong className="text-gray-900">{Math.min(currentPage * pageSize, filteredProducts.length)}</strong> of{' '}
                            <strong className="text-gray-900">{filteredProducts.length}</strong> products
                        </div>

                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => setCurrentPage(1)}
                                disabled={currentPage === 1}
                                className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-700 font-bold hover:bg-gray-100 disabled:opacity-40 transition"
                            >
                                ««
                            </button>
                            <button
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-700 font-bold hover:bg-gray-100 disabled:opacity-40 transition"
                            >
                                Previous
                            </button>
                            <span className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-900 font-black rounded-lg">
                                Page {currentPage} of {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-700 font-bold hover:bg-gray-100 disabled:opacity-40 transition"
                            >
                                Next
                            </button>
                            <button
                                onClick={() => setCurrentPage(totalPages)}
                                disabled={currentPage === totalPages}
                                className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-700 font-bold hover:bg-gray-100 disabled:opacity-40 transition"
                            >
                                »»
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: VISUAL ANALYTICS, PROFIT TRENDS & EXPIRY HORIZON CHARTS */}
            {activeTab === 'trends' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Category Profit & Valuation Matrix Bar Chart */}
                        <div className="lg:col-span-2 bg-white rounded-3xl p-5 border border-gray-200/80 shadow-xs">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="font-black text-sm text-gray-900">Category Valuation vs Projected Profit Outlay</h3>
                                    <p className="text-[11px] text-gray-500">Compares capital invested against gross potential profits</p>
                                </div>
                                <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                                    +{financials.totalProfit.toLocaleString()} Potential Gross Margin
                                </span>
                            </div>
                            <div className="h-64">
                                <Bar
                                    data={categoryProfitChartData}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: { legend: { position: 'top', labels: { boxWidth: 10, font: { size: 10 } } } },
                                        scales: {
                                            y: {
                                                ticks: {
                                                    callback: (val) => `KES ${Number(val).toLocaleString()}`,
                                                    font: { size: 9 },
                                                },
                                            },
                                            x: { ticks: { font: { size: 9 } } },
                                        },
                                    }}
                                />
                            </div>
                        </div>

                        {/* Expiry Horizon Risk Doughnut */}
                        <div className="bg-white rounded-3xl p-5 border border-gray-200/80 shadow-xs">
                            <h3 className="font-black text-sm text-gray-900 mb-1">FEFO Expiration Horizons</h3>
                            <p className="text-[11px] text-gray-500 mb-4">Batches categorized by expiration proximity</p>
                            <div className="h-56 relative flex items-center justify-center">
                                <Doughnut
                                    data={expiryRiskDoughnutData}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: {
                                            legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } },
                                        },
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Secondary Row: Inventory Velocity & Health Distribution */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="bg-white rounded-3xl p-5 border border-gray-200/80 shadow-xs">
                            <h3 className="font-black text-sm text-gray-900 mb-1">Stock Movement Velocity Distribution</h3>
                            <p className="text-[11px] text-gray-500 mb-4">Fast-moving vs slow-moving vs dead stock</p>
                            <div className="h-56 relative flex items-center justify-center">
                                <Doughnut
                                    data={velocityDoughnutData}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: {
                                            legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } },
                                        },
                                    }}
                                />
                            </div>
                        </div>

                        {/* Financial Capital at Risk Card */}
                        <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 text-white shadow-md flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-xs font-black uppercase tracking-wider text-rose-400">
                                        ⚡ Clinical Asset Risk &amp; Expiry Vulnerability
                                    </span>
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                        Action Required
                                    </span>
                                </div>
                                <h2 className="text-2xl md:text-3xl font-black font-mono tracking-tight text-white">
                                    KES {financials.deadStockRiskValue.toLocaleString()}
                                </h2>
                                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                                    Total pharmaceutical purchase value vulnerable in near-expiry batches (&lt; 90 days) or slow-moving stock lines. Expedite counter dispensing, bundle promotions, or return to vendor credit note.
                                </p>
                            </div>

                            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-700/80 mt-4 text-xs font-mono">
                                <div>
                                    <span className="text-slate-400 text-[10px] block">FAST-MOVING LINES</span>
                                    <span className="text-emerald-400 font-black text-sm">{financials.fastMovingCount} Drugs</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 text-[10px] block">REORDER SHORTAGE</span>
                                    <span className="text-amber-400 font-black text-sm">{financials.lowStockCount} Products</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 text-[10px] block">EXPIRED ON SHELF</span>
                                    <span className="text-rose-400 font-black text-sm">{financials.expiredBatchesCount} Batches</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: LIVE ALL BATCHES REGISTER WITH DARK HEADERS */}
            {activeTab === 'batches' && (
                <div className="bg-white rounded-3xl border border-gray-200/80 shadow-xs overflow-hidden">
                    <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                        <div>
                            <h3 className="font-black text-sm text-gray-900">
                                Pharmacy All-Batches Live Registry
                            </h3>
                            <p className="text-[11px] text-gray-500">
                                Trace every individual batch lot, expiration date, and physical stock in storage
                            </p>
                        </div>
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                            {allBatchesList.length} Total Registered Batches
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-slate-900 border-b-2 border-emerald-500 text-white font-black uppercase text-[11px] tracking-wider shadow-sm">
                                <tr>
                                    <th className="p-3 text-left text-white font-black">#</th>
                                    <th className="p-3 text-left text-white font-black">Batch / Lot #</th>
                                    <th className="p-3 text-left text-white font-black">Product Code</th>
                                    <th className="p-3 text-center text-white font-black">Expiry Date</th>
                                    <th className="p-3 text-center text-white font-black">Lifespan / FEFO</th>
                                    <th className="p-3 text-right text-white font-black">Remaining Qty</th>
                                    <th className="p-3 text-right text-white font-black">Unit Buy Cost</th>
                                    <th className="p-3 text-right text-white font-black">Retail Sell Price</th>
                                    <th className="p-3 text-left text-white font-black">Supplier / GRN</th>
                                    <th className="p-3 text-center text-white font-black">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {allBatchesList.map((b, i) => {
                                    const days = b.days_until_expiry || getDaysUntilExpiry(b.expiry_date);
                                    return (
                                        <tr key={b.batch_id || i} className="hover:bg-gray-50">
                                            <td className="p-3 text-gray-400 font-bold">{i + 1}</td>
                                            <td className="p-3">
                                                <span className="px-2.5 py-1 rounded-md font-mono font-black text-xs bg-indigo-50 text-indigo-900 border border-indigo-200">
                                                    {b.batch_number}
                                                </span>
                                            </td>
                                            <td className="p-3 font-mono font-bold text-gray-700">
                                                PRD-{b.product_id}
                                            </td>
                                            <td className="p-3 text-center font-mono font-semibold text-gray-800">
                                                {b.expiry_date ? new Date(b.expiry_date).toLocaleDateString('en-GB') : '—'}
                                            </td>
                                            <td className="p-3 text-center">
                                                {renderExpiryBadge(days)}
                                            </td>
                                            <td className="p-3 text-right font-black font-mono text-gray-900 text-sm">
                                                {b.remaining_qty}
                                            </td>
                                            <td className="p-3 text-right font-mono text-gray-600">
                                                KES {b.purchase_cost.toLocaleString()}
                                            </td>
                                            <td className="p-3 text-right font-mono font-bold text-emerald-800">
                                                KES {b.selling_price.toLocaleString()}
                                            </td>
                                            <td className="p-3 text-gray-600 font-mono text-[10px]">
                                                {b.supplier_name || b.purchase_invoice || 'Alpha Main Intake'}
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                                    {b.status}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 5: CATEGORY VALUATION MATRIX WITH DARK HEADERS */}
            {activeTab === 'valuation' && (
                <div className="bg-white rounded-3xl border border-gray-200/80 shadow-xs overflow-hidden">
                    <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                        <div>
                            <h3 className="font-black text-sm text-gray-900">
                                Category Inventory Valuation Matrix
                            </h3>
                            <p className="text-[11px] text-gray-500">
                                Financial asset allocation by pharmaceutical category
                            </p>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-slate-900 border-b-2 border-emerald-500 text-white font-black uppercase text-[11px] tracking-wider shadow-sm">
                                <tr>
                                    <th className="p-3 text-left text-white font-black">#</th>
                                    <th className="p-3 text-left text-white font-black">Pharmaceutical Category</th>
                                    <th className="p-3 text-center text-white font-black">Products Count</th>
                                    <th className="p-3 text-right text-white font-black">Total Physical Units</th>
                                    <th className="p-3 text-right text-white font-black">Cost Outlay (KES)</th>
                                    <th className="p-3 text-right text-white font-black">Retail Value (KES)</th>
                                    <th className="p-3 text-right text-white font-black">Projected Profit (KES)</th>
                                    <th className="p-3 text-center text-white font-black">Gross Margin %</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {categories.map((cat, i) => {
                                    const catProds = products.filter((p) => p.category === cat);
                                    const cCost = catProds.reduce((s, p) => s + p.stock_value_cost, 0);
                                    const cRetail = catProds.reduce((s, p) => s + p.stock_value_retail, 0);
                                    const cProfit = Math.max(0, cRetail - cCost);
                                    const cPieces = catProds.reduce((s, p) => s + p.total_pieces, 0);
                                    const cMargin = cRetail > 0 ? (cProfit / cRetail) * 100 : 0;

                                    return (
                                        <tr key={cat} className="hover:bg-gray-50">
                                            <td className="p-3 text-gray-400 font-bold">{i + 1}</td>
                                            <td className="p-3 font-bold text-gray-900">{cat}</td>
                                            <td className="p-3 text-center font-bold text-gray-800">{catProds.length}</td>
                                            <td className="p-3 text-right font-mono font-bold text-gray-900">{cPieces.toLocaleString()}</td>
                                            <td className="p-3 text-right font-mono text-teal-800 font-bold">KES {cCost.toLocaleString()}</td>
                                            <td className="p-3 text-right font-mono text-slate-900 font-black">KES {cRetail.toLocaleString()}</td>
                                            <td className="p-3 text-right font-mono text-emerald-700 font-bold">+KES {cProfit.toLocaleString()}</td>
                                            <td className="p-3 text-center">
                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-teal-50 text-teal-800 border border-teal-200">
                                                    {cMargin.toFixed(1)}%
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
