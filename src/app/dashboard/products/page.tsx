'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, logActivity } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';
import {
    FiPackage, FiPlus, FiEdit2, FiTrash2, FiDownload, FiRefreshCw,
    FiSearch, FiGrid, FiList, FiChevronLeft, FiChevronRight, FiX,
    FiUpload, FiCheck, FiAlertTriangle, FiTag, FiDollarSign, FiLayers,
    FiFilter, FiTrendingUp, FiPrinter, FiZap, FiClock,
    FiSliders, FiEye, FiChevronsLeft, FiChevronsRight, FiFileText,
    FiShield, FiCalendar, FiBox, FiAlertCircle, FiArrowUpRight,
    FiMaximize2, FiMinimize2, FiInfo, FiCopy, FiCheckCircle,
    FiCheckSquare, FiSquare, FiActivity
} from 'react-icons/fi';

// ─── TYPES & INTERFACES ───
interface Product {
    pid: number;
    product_code: string;
    product_name: string;
    alias?: string;
    vat_commodity?: string;
    description?: string;
    barcode?: string;
    category?: string;
    purchase_unit?: string;
    sales_unit?: string;
    purchase_cost: number;
    sales_cost: number;
    wholesale_price?: number;
    reorder_point?: number;
    margin_per?: number;
    show_in_pos?: boolean;
    button_ui_color?: string;
    photo?: string;
    hscode?: string;
    batch_no?: string;
    supplier_name?: string;
    active: boolean;
    pieces_per_package?: number;
    generic_name?: string;
    manufacturer?: string;
    drug_type?: string;
    dosage?: string;
    requires_prescription?: boolean;
    storage_conditions?: string;
    controlled_substance?: boolean;
    shelf_location?: string;
    outlet_id?: number;
    created_at?: string;
    updated_at?: string;
}

interface Batch {
    batch_id?: number;
    product_id?: number;
    batch_number: string;
    expiry_date: string;
    manufacture_date?: string;
    quantity: number;
    remaining_qty?: number;
    purchase_cost?: number;
    selling_price?: number;
    status?: string;
    supplier_id?: number;
    supplier_name?: string;
    purchase_invoice?: string;
}

interface Category {
    category_id: number;
    category_name: string;
    icon?: string;
    color?: string;
}

interface Supplier {
    supplier_id: number;
    supplier_code?: string;
    supplier_name: string;
}

interface Unit {
    unit_id: number;
    unit_name: string;
    abbreviation: string;
}

interface StockHistoryRow {
    id: number;
    date: string;
    ref: string;
    type: string;
    qty_in: number;
    qty_out: number;
    balance: number;
}

interface PriceHistoryRow {
    id: number;
    date: string;
    old_buy: number;
    new_buy: number;
    old_sell: number;
    new_sell: number;
}

// ─── CONSTANTS ───
const DRUG_TYPES = [
    'Tablet', 'Capsule', 'Syrup', 'Suspension', 'Injection', 'Cream', 'Ointment',
    'Drops', 'Inhaler', 'Suppository', 'Powder', 'Gel', 'Spray', 'Patch', 'Sachet',
    'Infusion / IV Fluid', 'Vial', 'Ampoule', 'Elixir', 'Lotion', 'Shampoo', 'Other'
];

const STORAGE_PRESETS = [
    'Room Temperature (15°C – 25°C)',
    'Cool Place (8°C – 15°C)',
    'Refrigerate (2°C – 8°C)',
    'Do Not Freeze',
    'Protect from Direct Light',
    'Store in Dry & Sealed Container',
    'Deep Freeze (-20°C)'
];

const DEFAULT_UNITS: Unit[] = [
    { unit_id: 1, unit_name: 'Piece', abbreviation: 'Pc' },
    { unit_id: 2, unit_name: 'Tablet', abbreviation: 'Tab' },
    { unit_id: 3, unit_name: 'Capsule', abbreviation: 'Cap' },
    { unit_id: 4, unit_name: 'Strip', abbreviation: 'Str' },
    { unit_id: 5, unit_name: 'Box', abbreviation: 'Box' },
    { unit_id: 6, unit_name: 'Pack', abbreviation: 'Pk' },
    { unit_id: 7, unit_name: 'Bottle', abbreviation: 'Btl' },
    { unit_id: 8, unit_name: 'Tube', abbreviation: 'Tube' },
    { unit_id: 9, unit_name: 'Sachet', abbreviation: 'Sachet' },
    { unit_id: 10, unit_name: 'Vial', abbreviation: 'Vial' },
    { unit_id: 11, unit_name: 'Ampoule', abbreviation: 'Amp' },
    { unit_id: 12, unit_name: 'Carton', abbreviation: 'Ctn' },
    { unit_id: 13, unit_name: 'Kilogram', abbreviation: 'Kg' },
    { unit_id: 14, unit_name: 'Gram', abbreviation: 'g' },
    { unit_id: 15, unit_name: 'Liter', abbreviation: 'L' },
    { unit_id: 16, unit_name: 'Milliliter', abbreviation: 'ml' },
    { unit_id: 17, unit_name: 'Dozen', abbreviation: 'Dz' }
];

const COLOR_PRESETS = [
    { name: 'Teal Emerald', gradient: 'from-emerald-500 to-teal-600', hex: '#10B981' },
    { name: 'Electric Cyan', gradient: 'from-cyan-500 to-blue-600', hex: '#06B6D4' },
    { name: 'Royal Indigo', gradient: 'from-blue-500 to-indigo-600', hex: '#3B82F6' },
    { name: 'Violet Purple', gradient: 'from-purple-500 to-purple-600', hex: '#A855F7' },
    { name: 'Crimson Rose', gradient: 'from-rose-500 to-red-600', hex: '#F43F5E' },
    { name: 'Amber Sunset', gradient: 'from-amber-400 to-orange-500', hex: '#F59E0B' },
    { name: 'Slate Steel', gradient: 'from-slate-600 to-slate-800', hex: '#475569' }
];

const VAT_OPTIONS = ['Standard (16%)', 'Zero Rated (0%)', 'Exempt', 'Inclusive'];

const getDaysUntilExpiry = (d?: string) => {
    if (!d) return 999;
    return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
};

const getExpiryBadge = (days: number) => {
    if (days < 0) {
        return <span className="px-2 py-0.5 bg-red-100 text-red-700 border border-red-200 rounded-full text-[10px] font-black">EXPIRED</span>;
    }
    if (days <= 30) {
        return <span className="px-2 py-0.5 bg-orange-100 text-orange-700 border border-orange-200 rounded-full text-[10px] font-black">{days}d ⚠️</span>;
    }
    if (days <= 90) {
        return <span className="px-2 py-0.5 bg-amber-100 text-amber-700 border border-amber-200 rounded-full text-[10px] font-bold">{days}d</span>;
    }
    return <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-bold">{days}d ✓</span>;
};

// Default blank product form
const defaultForm: Omit<Product, 'pid' | 'product_code'> = {
    product_name: '',
    generic_name: '',
    alias: '',
    barcode: '',
    category: '',
    drug_type: 'Tablet',
    dosage: '',
    manufacturer: '',
    storage_conditions: 'Room Temperature (15°C – 25°C)',
    shelf_location: '',
    requires_prescription: false,
    controlled_substance: false,
    purchase_unit: 'Box',
    sales_unit: 'Piece',
    pieces_per_package: 1,
    purchase_cost: 0,
    sales_cost: 0,
    wholesale_price: 0,
    vat_commodity: 'Standard (16%)',
    reorder_point: 10,
    margin_per: 0,
    show_in_pos: true,
    active: true,
    button_ui_color: 'from-emerald-500 to-teal-600',
    photo: '',
    hscode: '',
    batch_no: '',
    supplier_name: '',
    description: ''
};

export default function ProductsPage() {
    const { activeOutlet } = useOutlet();
    const outletId = activeOutlet?.outlet_id || 1;

    // ─── CORE STATE ───
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [units, setUnits] = useState<Unit[]>(DEFAULT_UNITS);
    const [companyName, setCompanyName] = useState('Alpha Pharmacy');
    const [isLoading, setIsLoading] = useState(true);

    // Stock & Batches mappings
    const [stockData, setStockData] = useState<Record<number, number>>({});
    const [bagStockData, setBagStockData] = useState<Record<number, number>>({});
    const [pieceStockData, setPieceStockData] = useState<Record<number, number>>({});
    const [productBatches, setProductBatches] = useState<Record<number, Batch[]>>({});

    // ─── FILTER & DISPLAY STATE ───
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState('All');
    const [filterDrugType, setFilterDrugType] = useState('All');
    const [filterPrescription, setFilterPrescription] = useState('All');
    const [filterStockStatus, setFilterStockStatus] = useState('All');
    const [filterExpiryRisk, setFilterExpiryRisk] = useState('All');
    const [filterMarginTier, setFilterMarginTier] = useState('All');
    const [sortBy, setSortBy] = useState<'name_asc' | 'name_desc' | 'stock_desc' | 'stock_asc' | 'price_desc' | 'price_asc' | 'margin_desc'>('name_asc');
    const [activeFastFilter, setActiveFastFilter] = useState<'all' | 'low_stock' | 'expiring' | 'rx_only' | 'out_of_stock' | 'high_margin'>('all');

    // Layout & Pagination
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const [autoFitScreen, setAutoFitScreen] = useState(true);
    const [showValuation, setShowValuation] = useState(true);
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(25);
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

    // Selection & Bulk
    const [selectedPids, setSelectedPids] = useState<Set<number>>(new Set());

    // ─── SUPER ULTRA MODAL STATE ───
    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [modalTab, setModalTab] = useState<'general' | 'clinical' | 'pricing' | 'batches' | 'media'>('general');
    const [formData, setFormData] = useState<Omit<Product, 'pid' | 'product_code'>>(defaultForm);
    const [modalBatches, setModalBatches] = useState<Batch[]>([]);
    const [newBatchRow, setNewBatchRow] = useState<Batch>({
        batch_number: '',
        expiry_date: '',
        manufacture_date: '',
        quantity: 0,
        purchase_cost: 0,
        selling_price: 0,
        purchase_invoice: ''
    });
    const [isSaving, setIsSaving] = useState(false);

    // ─── OTHER MODALS ───
    // Label Generator
    const [showLabelModal, setShowLabelModal] = useState(false);
    const [labelProducts, setLabelProducts] = useState<number[]>([]);
    const [labelQty, setLabelQty] = useState<Record<number, number>>({});
    const [labelSearch, setLabelSearch] = useState('');
    const [labelSize, setLabelSize] = useState<'small' | 'medium' | 'large'>('medium');

    // Item Fast Lookup
    const [showLookupModal, setShowLookupModal] = useState(false);
    const [lookupQuery, setLookupQuery] = useState('');
    const [lookupResult, setLookupResult] = useState<Product | null>(null);

    // Stock History / Ledger
    const [showStockHistoryModal, setShowStockHistoryModal] = useState(false);
    const [stockHistoryProduct, setStockHistoryProduct] = useState<Product | null>(null);
    const [stockHistory, setStockHistory] = useState<StockHistoryRow[]>([]);

    // Price History
    const [showPriceHistoryModal, setShowPriceHistoryModal] = useState(false);
    const [priceHistoryProduct, setPriceHistoryProduct] = useState<Product | null>(null);
    const [priceHistory, setPriceHistory] = useState<PriceHistoryRow[]>([]);

    // Stock Adjustment
    const [showStockAdjustModal, setShowStockAdjustModal] = useState(false);
    const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
    const [adjustBags, setAdjustBags] = useState(0);
    const [adjustPieces, setAdjustPieces] = useState(0);
    const [adjustType, setAdjustType] = useState<'add' | 'remove'>('add');
    const [adjustReason, setAdjustReason] = useState('');

    // CSV Import
    const [showImportModal, setShowImportModal] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importMode, setImportMode] = useState<'add_new' | 'update' | 'overwrite'>('add_new');
    const [importProgress, setImportProgress] = useState(0);
    const [importTotal, setImportTotal] = useState(0);
    const [importCurrentItem, setImportCurrentItem] = useState('');
    const [importStatus, setImportStatus] = useState<'idle' | 'parsing' | 'importing' | 'success' | 'error'>('idle');
    const [importErrors, setImportErrors] = useState<string[]>([]);
    const [importSuccessCount, setImportSuccessCount] = useState(0);

    // ─── DATA FETCHING ───
    const loadProducts = useCallback(async () => {
        setIsLoading(true);
        try {
            let { data, error } = await supabase
                .from('pharmacy_products')
                .select('*')
                .eq('outlet_id', outletId)
                .order('pid', { ascending: false });

            if (error || !data || data.length === 0) {
                const fb = await supabase.from('pharmacy_products').select('*').order('pid', { ascending: false });
                data = fb.data;
                error = fb.error;
            }

            if (error) throw error;
            setProducts(data || []);

            // Load active batches for all products
            if (data && data.length > 0) {
                const pids = data.map((p: Product) => p.pid);
                const { data: allBatches } = await supabase
                    .from('pharmacy_batches')
                    .select('*')
                    .in('product_id', pids)
                    .neq('status', 'Deleted')
                    .order('expiry_date', { ascending: true });

                const batchMap: Record<number, Batch[]> = {};
                (allBatches || []).forEach((b: Batch) => {
                    if (b.product_id) {
                        if (!batchMap[b.product_id]) batchMap[b.product_id] = [];
                        batchMap[b.product_id].push(b);
                    }
                });
                setProductBatches(batchMap);
            }
        } catch {
            toast.error('Failed to load pharmacy product catalog');
        } finally {
            setIsLoading(false);
        }
    }, [outletId]);

    const loadStockData = useCallback(async () => {
        try {
            let { data, error } = await supabase
                .from('pharmacy_stock')
                .select('pid, qty, storage_type')
                .eq('outlet_id', outletId);

            if (error || !data) {
                const fb = await supabase.from('pharmacy_stock').select('pid, qty, storage_type');
                data = fb.data;
            }

            const total: Record<number, number> = {};
            const bags: Record<number, number> = {};
            const pcs: Record<number, number> = {};

            (data || []).forEach((s: { pid: number; qty?: number; storage_type?: string }) => {
                const q = s.qty || 0;
                if (s.storage_type === 'Bags') {
                    bags[s.pid] = (bags[s.pid] || 0) + q;
                } else {
                    pcs[s.pid] = (pcs[s.pid] || 0) + q;
                }
                total[s.pid] = (total[s.pid] || 0) + q;
            });

            setStockData(total);
            setBagStockData(bags);
            setPieceStockData(pcs);
        } catch {
            // silent catch
        }
    }, [outletId]);

    const loadCategories = useCallback(async () => {
        try {
            let { data, error } = await supabase
                .from('pharmacy_categories')
                .select('*')
                .eq('active', true)
                .order('category_name');

            if (error || !data || data.length === 0) {
                const fb = await supabase.from('product_categories').select('*').order('category_name');
                data = fb.data;
            }
            setCategories(data || []);
        } catch {
            // silent catch
        }
    }, []);

    const loadSuppliers = useCallback(async () => {
        try {
            const { data } = await supabase
                .from('pharmacy_suppliers')
                .select('supplier_id, supplier_code, supplier_name')
                .eq('active', true)
                .order('supplier_name');
            setSuppliers(data || []);
        } catch {
            // silent catch
        }
    }, []);

    const loadUnits = useCallback(async () => {
        try {
            const { data } = await supabase
                .from('product_units')
                .select('unit_id, unit_name, abbreviation')
                .eq('active', true)
                .order('unit_name');
            if (data && data.length > 0) setUnits(data);
        } catch {
            setUnits(DEFAULT_UNITS);
        }
    }, []);

    const loadCompanyName = useCallback(async () => {
        try {
            const { data } = await supabase
                .from('organisation_settings')
                .select('setting_value')
                .eq('setting_key', 'company_name')
                .single();
            if (data?.setting_value) setCompanyName(data.setting_value.trim());
        } catch {
            setCompanyName('Alpha Pharmacy');
        }
    }, []);

    useEffect(() => {
        loadProducts();
        loadStockData();
        loadCategories();
        loadSuppliers();
        loadUnits();
        loadCompanyName();
    }, [loadProducts, loadStockData, loadCategories, loadSuppliers, loadUnits, loadCompanyName]);

    // ─── BARCODE & CODE GENERATORS ───
    const generateBarcode = async (): Promise<string> => {
        try {
            const { data } = await supabase
                .from('pharmacy_products')
                .select('barcode')
                .like('barcode', '1%')
                .order('barcode', { ascending: false })
                .limit(1);
            if (data?.length && data[0].barcode) {
                return String((parseInt(data[0].barcode) || 100) + 1);
            }
            return '101';
        } catch {
            return String(Math.floor(100000 + Math.random() * 900000));
        }
    };

    const generateProductCode = async (): Promise<string> => {
        try {
            const { data } = await supabase
                .from('pharmacy_products')
                .select('pid')
                .order('pid', { ascending: false })
                .limit(1);
            const maxPid = data?.[0]?.pid || products.length;
            const nextNum = maxPid + 1;
            return `DRG-${String(nextNum).padStart(4, '0')}`;
        } catch {
            return `DRG-${Date.now().toString().slice(-4)}`;
        }
    };

    const generateBatchNumber = () => {
        const now = new Date();
        const yy = String(now.getFullYear()).slice(-2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const rnd = Math.floor(1000 + Math.random() * 9000);
        return `BAT-${yy}${mm}-${rnd}`;
    };

    const setQuickExpiry = (months: number) => {
        const d = new Date();
        d.setMonth(d.getMonth() + months);
        setNewBatchRow(prev => ({ ...prev, expiry_date: d.toISOString().split('T')[0] }));
    };

    // ─── MARGIN & FINANCIAL CALCULATIONS ───
    const computedMetrics = useMemo(() => {
        const ppp = formData.pieces_per_package || 1;
        const costPerPkg = formData.purchase_cost || 0;
        const sellPerPiece = formData.sales_cost || 0;
        const isDiffUnit = formData.purchase_unit !== formData.sales_unit && ppp > 1;

        const costPerPiece = isDiffUnit ? costPerPkg / ppp : costPerPkg;
        const sellPerPkg = isDiffUnit ? sellPerPiece * ppp : sellPerPiece;

        const profitPerPiece = sellPerPiece - costPerPiece;
        const profitPerPkg = sellPerPkg - costPerPkg;

        const marginPerPiece = sellPerPiece > 0 ? (profitPerPiece / sellPerPiece) * 100 : 0;
        const markupPerPiece = costPerPiece > 0 ? (profitPerPiece / costPerPiece) * 100 : 0;

        return {
            isDiffUnit,
            costPerPkg,
            sellPerPkg,
            profitPerPkg,
            costPerPiece,
            sellPerPiece,
            profitPerPiece,
            marginPerPiece,
            markupPerPiece
        };
    }, [formData.purchase_cost, formData.sales_cost, formData.pieces_per_package, formData.purchase_unit, formData.sales_unit]);

    // ─── MODAL OPENERS ───
    const openAddModal = async () => {
        setEditingProduct(null);
        setModalTab('general');
        const bc = await generateBarcode();
        setFormData({
            ...defaultForm,
            barcode: bc,
            supplier_name: suppliers[0]?.supplier_name || 'Direct Wholesale'
        });
        setModalBatches([]);
        setNewBatchRow({
            batch_number: generateBatchNumber(),
            expiry_date: '',
            manufacture_date: '',
            quantity: 0,
            purchase_cost: 0,
            selling_price: 0,
            purchase_invoice: ''
        });
        setShowModal(true);
    };

    const openEditModal = async (p: Product) => {
        setEditingProduct(p);
        setModalTab('general');
        setFormData({
            product_name: p.product_name,
            generic_name: p.generic_name || '',
            alias: p.alias || '',
            barcode: p.barcode || '',
            category: p.category || '',
            drug_type: p.drug_type || 'Tablet',
            dosage: p.dosage || '',
            manufacturer: p.manufacturer || '',
            storage_conditions: p.storage_conditions || 'Room Temperature (15°C – 25°C)',
            shelf_location: p.shelf_location || '',
            requires_prescription: !!p.requires_prescription,
            controlled_substance: !!p.controlled_substance,
            purchase_unit: p.purchase_unit || 'Box',
            sales_unit: p.sales_unit || 'Piece',
            pieces_per_package: p.pieces_per_package || 1,
            purchase_cost: p.purchase_cost || 0,
            sales_cost: p.sales_cost || 0,
            wholesale_price: p.wholesale_price || 0,
            vat_commodity: p.vat_commodity || 'Standard (16%)',
            reorder_point: p.reorder_point ?? 10,
            margin_per: p.margin_per || 0,
            show_in_pos: p.show_in_pos !== false,
            active: p.active !== false,
            button_ui_color: p.button_ui_color || 'from-emerald-500 to-teal-600',
            photo: p.photo || '',
            hscode: p.hscode || '',
            batch_no: p.batch_no || '',
            supplier_name: p.supplier_name || '',
            description: p.description || ''
        });

        // Load existing batches for editing
        const { data } = await supabase
            .from('pharmacy_batches')
            .select('*')
            .eq('product_id', p.pid)
            .neq('status', 'Deleted')
            .order('expiry_date', { ascending: true });

        setModalBatches(data || []);
        setNewBatchRow({
            batch_number: generateBatchNumber(),
            expiry_date: '',
            manufacture_date: '',
            quantity: 0,
            purchase_cost: p.purchase_cost || 0,
            selling_price: p.sales_cost || 0,
            purchase_invoice: ''
        });
        setShowModal(true);
    };

    // ─── SAVE PRODUCT ───
    const handleSaveProduct = async () => {
        if (!formData.product_name.trim()) {
            toast.error('Product trade name is required');
            setModalTab('general');
            return;
        }

        setIsSaving(true);
        try {
            const ppp = formData.pieces_per_package || 1;
            const costPerPiece = formData.purchase_cost / ppp;
            const computedMargin = formData.sales_cost > 0
                ? Math.round(((formData.sales_cost - costPerPiece) / formData.sales_cost) * 10000) / 100
                : 0;

            const payload = {
                product_name: formData.product_name.trim(),
                generic_name: formData.generic_name?.trim() || null,
                alias: formData.alias?.trim() || null,
                barcode: formData.barcode?.trim() || null,
                category: formData.category || null,
                drug_type: formData.drug_type || 'Tablet',
                dosage: formData.dosage?.trim() || null,
                manufacturer: formData.manufacturer?.trim() || null,
                storage_conditions: formData.storage_conditions || null,
                shelf_location: formData.shelf_location?.trim() || null,
                requires_prescription: formData.requires_prescription || false,
                controlled_substance: formData.controlled_substance || false,
                purchase_unit: formData.purchase_unit || 'Box',
                sales_unit: formData.sales_unit || 'Piece',
                pieces_per_package: ppp,
                purchase_cost: formData.purchase_cost || 0,
                sales_cost: formData.sales_cost || 0,
                wholesale_price: formData.wholesale_price || 0,
                vat_commodity: formData.vat_commodity || 'Standard (16%)',
                reorder_point: formData.reorder_point ?? 10,
                margin_per: computedMargin,
                show_in_pos: formData.show_in_pos !== false,
                active: formData.active !== false,
                button_ui_color: formData.button_ui_color || 'from-emerald-500 to-teal-600',
                photo: formData.photo?.trim() || null,
                hscode: formData.hscode?.trim() || null,
                batch_no: formData.batch_no?.trim() || null,
                supplier_name: formData.supplier_name?.trim() || null,
                description: formData.description?.trim() || null,
                outlet_id: outletId
            };

            let targetPid: number;

            if (editingProduct) {
                // Log price changes if buy/sell prices changed
                if (
                    editingProduct.purchase_cost !== formData.purchase_cost ||
                    editingProduct.sales_cost !== formData.sales_cost
                ) {
                    try {
                        await supabase.from('pharmacy_price_history').insert({
                            pid: editingProduct.pid,
                            product_name: editingProduct.product_name,
                            old_buy: editingProduct.purchase_cost,
                            new_buy: formData.purchase_cost,
                            old_sell: editingProduct.sales_cost,
                            new_sell: formData.sales_cost,
                            changed_at: new Date().toISOString()
                        });
                    } catch {
                        // ignore if table not present
                    }
                }

                const { error } = await supabase
                    .from('pharmacy_products')
                    .update({ ...payload, updated_at: new Date().toISOString() })
                    .eq('pid', editingProduct.pid);

                if (error) throw error;
                targetPid = editingProduct.pid;
                toast.success(`Updated "${formData.product_name}"`);
                logActivity('Update', `Updated product: ${formData.product_name}`, `PID: ${targetPid}`);
            } else {
                const code = await generateProductCode();
                const { data: created, error } = await supabase
                    .from('pharmacy_products')
                    .insert({
                        ...payload,
                        product_code: code,
                        created_at: new Date().toISOString()
                    })
                    .select()
                    .single();

                if (error) throw error;
                targetPid = created.pid;

                // Ensure initial base stock row
                await supabase.from('pharmacy_stock').insert({
                    pid: targetPid,
                    qty: 0,
                    outlet_id: outletId,
                    storage_type: 'Store'
                });

                toast.success(`Created product ${code}`);
                logActivity('Create', `Created product: ${formData.product_name}`, `Code: ${code}`);
            }

            // Save any newly added batches in the modal
            for (const b of modalBatches) {
                if (!b.batch_id) {
                    const { data: savedBatch } = await supabase
                        .from('pharmacy_batches')
                        .insert({
                            product_id: targetPid,
                            batch_number: b.batch_number,
                            expiry_date: b.expiry_date,
                            manufacture_date: b.manufacture_date || null,
                            quantity: b.quantity,
                            remaining_qty: b.quantity,
                            purchase_cost: b.purchase_cost || formData.purchase_cost,
                            selling_price: b.selling_price || formData.sales_cost,
                            supplier_name: b.supplier_name || formData.supplier_name || null,
                            purchase_invoice: b.purchase_invoice || null,
                            outlet_id: outletId,
                            status: 'Active'
                        })
                        .select()
                        .single();

                    if (savedBatch && b.quantity > 0) {
                        // Sync quantity into pharmacy_stock
                        await supabase.from('pharmacy_stock').insert({
                            pid: targetPid,
                            batch_id: savedBatch.batch_id,
                            invoice_no: b.purchase_invoice || 'INITIAL',
                            qty: b.quantity,
                            storage_type: 'Pieces',
                            expiry_date: b.expiry_date,
                            outlet_id: outletId
                        });
                    }
                }
            }

            setShowModal(false);
            loadProducts();
            loadStockData();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to save product');
        } finally {
            setIsSaving(false);
        }
    };

    // ─── DELETE PRODUCT ───
    const deleteProduct = async (p: Product) => {
        if (!confirm(`Are you sure you want to permanently delete "${p.product_name}" (${p.product_code})?`)) return;
        try {
            const { error } = await supabase.from('pharmacy_products').delete().eq('pid', p.pid);
            if (error) throw error;
            toast.success(`Deleted ${p.product_name}`);
            logActivity('Delete', `Deleted product: ${p.product_name}`, `PID: ${p.pid}`);
            loadProducts();
            loadStockData();
        } catch {
            toast.error('Failed to delete product');
        }
    };

    // ─── STOCK HISTORY MODAL ───
    const openStockHistory = async (p: Product) => {
        setStockHistoryProduct(p);
        setShowStockHistoryModal(true);
        try {
            const rows: StockHistoryRow[] = [];
            const { data: stockRows } = await supabase
                .from('pharmacy_stock')
                .select('*')
                .eq('pid', p.pid)
                .order('created_at', { ascending: true });

            (stockRows || []).forEach((r: { created_at: string; invoice_no?: string; qty?: number }, i: number) => {
                rows.push({
                    id: i,
                    date: new Date(r.created_at).toLocaleDateString('en-GB'),
                    ref: r.invoice_no || 'N/A',
                    type: (r.qty || 0) >= 0 ? 'Stock In / Purchase' : 'Stock Adjustment',
                    qty_in: Math.max(0, r.qty || 0),
                    qty_out: Math.abs(Math.min(0, r.qty || 0)),
                    balance: 0
                });
            });

            const { data: saleRows } = await supabase
                .from('pharmacy_sales_items')
                .select('*, pharmacy_sales!inner(sale_datetime, receipt_no)')
                .eq('product_id', p.pid)
                .order('pharmacy_sales(sale_datetime)', { ascending: true });

            (saleRows || []).forEach((r: { pharmacy_sales?: { sale_datetime?: string; receipt_no?: string }; quantity?: number }, i: number) => {
                rows.push({
                    id: 1000 + i,
                    date: r.pharmacy_sales?.sale_datetime
                        ? new Date(r.pharmacy_sales.sale_datetime).toLocaleDateString('en-GB')
                        : 'N/A',
                    ref: r.pharmacy_sales?.receipt_no || 'POS Sale',
                    type: 'Dispensed Sale',
                    qty_in: 0,
                    qty_out: r.quantity || 0,
                    balance: 0
                });
            });

            rows.sort((a, b) => a.date.localeCompare(b.date));
            let runningBal = 0;
            rows.forEach(r => {
                runningBal += r.qty_in - r.qty_out;
                r.balance = runningBal;
            });
            setStockHistory(rows);
        } catch {
            setStockHistory([]);
        }
    };

    // ─── PRICE HISTORY MODAL ───
    const openPriceHistory = async (p: Product) => {
        setPriceHistoryProduct(p);
        setShowPriceHistoryModal(true);
        try {
            const { data } = await supabase
                .from('pharmacy_price_history')
                .select('*')
                .eq('pid', p.pid)
                .order('changed_at', { ascending: false });

            setPriceHistory(
                (data || []).map((r: { changed_at: string; old_buy: number; new_buy: number; old_sell: number; new_sell: number }, i: number) => ({
                    id: i,
                    date: new Date(r.changed_at).toLocaleString('en-GB'),
                    old_buy: r.old_buy,
                    new_buy: r.new_buy,
                    old_sell: r.old_sell,
                    new_sell: r.new_sell
                }))
            );
        } catch {
            setPriceHistory([]);
        }
    };

    // ─── STOCK ADJUSTMENT ───
    const openStockAdjust = (p: Product) => {
        setAdjustProduct(p);
        setAdjustBags(0);
        setAdjustPieces(0);
        setAdjustType('add');
        setAdjustReason('');
        setShowStockAdjustModal(true);
    };

    const submitStockAdjust = async () => {
        if (!adjustProduct || (adjustBags <= 0 && adjustPieces <= 0)) {
            toast.error('Enter a valid adjustment quantity');
            return;
        }

        try {
            const ref = `ADJ-${Date.now().toString(36).toUpperCase()}`;
            const records: { pid: number; invoice_no: string; qty: number; storage_type: string; notes: string; outlet_id: number }[] = [];

            if (adjustBags > 0) {
                records.push({
                    pid: adjustProduct.pid,
                    invoice_no: ref,
                    qty: adjustType === 'add' ? adjustBags : -adjustBags,
                    storage_type: 'Bags',
                    notes: adjustReason || 'Physical Stock Reconciliation',
                    outlet_id: outletId
                });
            }

            if (adjustPieces > 0) {
                records.push({
                    pid: adjustProduct.pid,
                    invoice_no: ref,
                    qty: adjustType === 'add' ? adjustPieces : -adjustPieces,
                    storage_type: 'Pieces',
                    notes: adjustReason || 'Physical Stock Reconciliation',
                    outlet_id: outletId
                });
            }

            if (records.length > 0) {
                await supabase.from('pharmacy_stock').insert(records);
            }

            toast.success(`Stock adjusted successfully (${adjustType === 'add' ? '+' : '-'}${adjustBags || adjustPieces})`);
            setShowStockAdjustModal(false);
            loadStockData();
        } catch {
            toast.error('Adjustment failed');
        }
    };

    // ─── LABEL GENERATOR ───
    const labelSizes = {
        small: { w: '38mm', h: '25mm', name: 11, barcode: 14, price: 13, code: 8 },
        medium: { w: '50mm', h: '30mm', name: 13, barcode: 18, price: 16, code: 9 },
        large: { w: '62mm', h: '35mm', name: 15, barcode: 22, price: 20, code: 10 }
    };

    const getLabelHTML = () => {
        const selectedProds = products.filter(p => labelProducts.includes(p.pid));
        if (selectedProds.length === 0) return '';
        const labels = selectedProds.flatMap(p => Array.from({ length: labelQty[p.pid] || 1 }, () => p));
        const s = labelSizes[labelSize];

        return `<!DOCTYPE html><html><head><style>
            @page{margin:3mm;}*{box-sizing:border-box;margin:0;padding:0;}
            body{font-family:'Inter','Arial',sans-serif;display:flex;flex-wrap:wrap;gap:2mm;padding:0;background:#fff;}
            .label{width:${s.w};height:${s.h};border:1.5px solid #111;border-radius:3px;padding:2mm;display:flex;flex-direction:column;justify-content:space-between;page-break-inside:avoid;overflow:hidden;}
            .company{font-size:${s.code}px;text-align:center;color:#666;text-transform:uppercase;letter-spacing:1px;font-weight:bold;}
            .name{font-size:${s.name}px;font-weight:900;text-transform:uppercase;text-align:center;line-height:1.1;overflow:hidden;max-height:${s.name * 2.2}px;}
            .barcode{font-size:${s.barcode}px;text-align:center;font-weight:900;letter-spacing:3px;font-family:'Courier New',monospace;}
            .price{font-size:${s.price}px;font-weight:900;text-align:center;background:#000;color:#fff;border-radius:3px;padding:1mm 0;}
            .code{font-size:${s.code}px;text-align:center;color:#333;font-weight:600;}
        </style></head><body>${labels
            .map(
                p => `<div class='label'>
                <div class='company'>${companyName || 'Alpha Pharmacy'}</div>
                <div class='name'>${p.product_name}</div>
                <div class='barcode'>${p.barcode || p.product_code}</div>
                <div class='price'>KES ${(p.sales_cost || 0).toLocaleString()}</div>
                <div class='code'>${p.product_code} • ${p.sales_unit || 'Pc'}</div>
            </div>`
            )
            .join('')}</body></html>`;
    };

    const printLabels = () => {
        const html = getLabelHTML();
        if (!html) {
            toast.error('Select at least one product');
            return;
        }
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;';
        document.body.appendChild(iframe);
        const doc = iframe.contentWindow?.document;
        if (doc) {
            doc.open();
            doc.write(html);
            doc.close();
            setTimeout(() => {
                iframe.contentWindow?.print();
                setTimeout(() => document.body.removeChild(iframe), 2000);
            }, 500);
        }
    };

    const filteredLabelProducts = products.filter(p => {
        if (!p.active) return false;
        if (!labelSearch.trim()) return true;
        const q = labelSearch.toLowerCase();
        return (
            p.product_name.toLowerCase().includes(q) ||
            p.product_code.toLowerCase().includes(q) ||
            (p.barcode && p.barcode.includes(labelSearch))
        );
    });

    // ─── FAST SCANNER / LOOKUP ───
    const doLookup = () => {
        const q = lookupQuery.toLowerCase().trim();
        const found = products.find(
            p =>
                p.barcode === lookupQuery.trim() ||
                p.product_code.toLowerCase() === q ||
                p.product_name.toLowerCase().includes(q) ||
                (p.generic_name && p.generic_name.toLowerCase().includes(q))
        );
        setLookupResult(found || null);
        if (!found) toast.error('No matching drug found in catalog');
    };

    // ─── CSV IMPORT ENGINE ───
    const parseCSV = (text: string): Record<string, string>[] => {
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) return [];
        const headers = lines[0]
            .split(',')
            .map(h => h.trim().replace(/^"(.*)"$/, '$1').toLowerCase().replace(/\s+/g, '_'));
        return lines.slice(1).map(line => {
            const vals: string[] = [];
            let current = '';
            let inQuotes = false;
            for (const ch of line) {
                if (ch === '"') {
                    inQuotes = !inQuotes;
                } else if (ch === ',' && !inQuotes) {
                    vals.push(current.trim());
                    current = '';
                } else {
                    current += ch;
                }
            }
            vals.push(current.trim());
            const row: Record<string, string> = {};
            headers.forEach((h, i) => {
                row[h] = (vals[i] || '').replace(/^"(.*)"$/, '$1');
            });
            return row;
        });
    };

    const importProducts = async () => {
        if (!importFile) {
            toast.error('Select a CSV file to import');
            return;
        }
        setImportStatus('parsing');
        setImportErrors([]);
        setImportSuccessCount(0);
        setImportProgress(0);

        try {
            const text = await importFile.text();
            const rows = parseCSV(text);
            if (rows.length === 0) {
                toast.error('No rows found in file');
                setImportStatus('error');
                return;
            }
            setImportTotal(rows.length);
            setImportStatus('importing');

            if (importMode === 'overwrite') {
                setImportCurrentItem('Clearing existing products...');
                await supabase.from('pharmacy_stock').delete().eq('outlet_id', outletId);
                await supabase.from('pharmacy_products').delete().eq('outlet_id', outletId);
            }

            let success = 0;
            const errs: string[] = [];

            for (let i = 0; i < rows.length; i++) {
                const r = rows[i];
                const name = r.product_name || r.name || r.item_name || r.item || '';
                if (!name) {
                    errs.push(`Row ${i + 2}: Missing product name`);
                    setImportProgress(i + 1);
                    continue;
                }
                setImportCurrentItem(name);

                const prodData = {
                    product_name: name,
                    generic_name: r.generic_name || r.generic || null,
                    alias: r.alias || r.short_name || null,
                    barcode: r.barcode || r.bar_code || r.upc || null,
                    category: r.category || r.group || null,
                    purchase_unit: r.purchase_unit || r.buy_unit || 'Box',
                    sales_unit: r.sales_unit || r.sell_unit || 'Piece',
                    purchase_cost: parseFloat(r.purchase_cost || r.buy_price || r.cost || '0') || 0,
                    sales_cost: parseFloat(r.sales_cost || r.sell_price || r.price || '0') || 0,
                    wholesale_price: parseFloat(r.wholesale_price || r.wholesale || '0') || 0,
                    reorder_point: parseInt(r.reorder_point || r.min_stock || '10') || 10,
                    vat_commodity: r.vat_commodity || 'Standard (16%)',
                    supplier_name: r.supplier_name || r.supplier || null,
                    hscode: r.hscode || null,
                    batch_no: r.batch_no || null,
                    description: r.description || null,
                    active: (r.active || r.status || 'true').toLowerCase() !== 'false',
                    pieces_per_package: parseInt(r.pieces_per_package || r.pcs_per_pack || '1') || 1,
                    margin_per: 0,
                    outlet_id: outletId
                };

                if (prodData.purchase_cost > 0) {
                    const cpp = prodData.purchase_cost / (prodData.pieces_per_package || 1);
                    const sp = prodData.sales_cost;
                    prodData.margin_per = sp > 0 ? Math.round(((sp - cpp) / sp) * 10000) / 100 : 0;
                }

                try {
                    if (importMode === 'update') {
                        const existing = products.find(
                            ep =>
                                ep.product_name.toLowerCase() === name.toLowerCase() ||
                                (ep.barcode && ep.barcode === prodData.barcode)
                        );
                        if (existing) {
                            await supabase.from('pharmacy_products').update(prodData).eq('pid', existing.pid);
                        } else {
                            const code = `DRG-${String(products.length + i + 1).padStart(4, '0')}`;
                            await supabase.from('pharmacy_products').insert({ ...prodData, product_code: code });
                        }
                    } else {
                        const code = `DRG-${String(products.length + i + 1).padStart(4, '0')}`;
                        await supabase.from('pharmacy_products').insert({ ...prodData, product_code: code });
                    }
                    success++;
                } catch (err: unknown) {
                    errs.push(`Row ${i + 2} (${name}): ${err instanceof Error ? err.message : 'Database error'}`);
                }
                setImportProgress(i + 1);
            }

            setImportSuccessCount(success);
            setImportErrors(errs);
            setImportStatus(errs.length > 0 && success === 0 ? 'error' : 'success');
            loadProducts();
            loadStockData();
        } catch (err: unknown) {
            setImportStatus('error');
            setImportErrors([err instanceof Error ? err.message : 'Failed to parse file']);
        }
    };

    // ─── SUPER VIVID BRIGHT COLORS EXCEL EXPORT (SpreadsheetML) ───
    const exportBrightExcel = () => {
        try {
            const rowsXml = filteredProducts
                .map(p => {
                    const stk = stockData[p.pid] || 0;
                    const ppp = p.pieces_per_package || 1;
                    const costVal = (p.purchase_cost / ppp) * stk;
                    const sellVal = p.sales_cost * stk;
                    const profitVal = sellVal - costVal;
                    const margin = p.margin_per || 0;

                    let marginStyle = 'StandardCell';
                    if (margin >= 30) marginStyle = 'SafeCell';
                    else if (margin >= 15) marginStyle = 'AmberCell';
                    else if (margin < 0) marginStyle = 'RedCell';

                    let stockStyle = 'StandardCell';
                    if (stk <= 0) stockStyle = 'RedCell';
                    else if (stk <= (p.reorder_point || 10)) stockStyle = 'AmberCell';

                    return `
                <Row ss:Height="22">
                    <Cell ss:StyleID="CodeCell"><Data ss:Type="String">${p.product_code}</Data></Cell>
                    <Cell ss:StyleID="BoldCell"><Data ss:Type="String">${(p.product_name || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Data></Cell>
                    <Cell ss:StyleID="StandardCell"><Data ss:Type="String">${(p.generic_name || '-').replace(/&/g, '&amp;')}</Data></Cell>
                    <Cell ss:StyleID="CategoryCell"><Data ss:Type="String">${p.category || 'General'}</Data></Cell>
                    <Cell ss:StyleID="StandardCell"><Data ss:Type="String">${p.drug_type || 'Tablet'}</Data></Cell>
                    <Cell ss:StyleID="StandardCell"><Data ss:Type="String">${p.sales_unit || 'Piece'}</Data></Cell>
                    <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${p.purchase_cost || 0}</Data></Cell>
                    <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${p.sales_cost || 0}</Data></Cell>
                    <Cell ss:StyleID="${marginStyle}"><Data ss:Type="Number">${margin.toFixed(1)}</Data></Cell>
                    <Cell ss:StyleID="${stockStyle}"><Data ss:Type="Number">${stk}</Data></Cell>
                    <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${costVal.toFixed(2)}</Data></Cell>
                    <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${sellVal.toFixed(2)}</Data></Cell>
                    <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${profitVal.toFixed(2)}</Data></Cell>
                    <Cell ss:StyleID="StandardCell"><Data ss:Type="String">${p.requires_prescription ? 'YES (Rx)' : 'OTC'}</Data></Cell>
                    <Cell ss:StyleID="StandardCell"><Data ss:Type="String">${p.shelf_location || '-'}</Data></Cell>
                    <Cell ss:StyleID="StandardCell"><Data ss:Type="String">${p.active ? 'ACTIVE' : 'INACTIVE'}</Data></Cell>
                </Row>`;
                })
                .join('');

            const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>${companyName} - Pharmacy Product Catalog</Title>
  <Created>${new Date().toISOString()}</Created>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#1E293B"/>
  </Style>
  <Style ss:ID="TitleHeader">
   <Font ss:FontName="Segoe UI" ss:Size="16" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#00C853" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="SubHeader">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#0091EA" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="ColHeader">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#1E293B" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#00C853"/>
   </Borders>
  </Style>
  <Style ss:ID="StandardCell">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#1E293B"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/></Borders>
  </Style>
  <Style ss:ID="BoldCell">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#0F172A"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/></Borders>
  </Style>
  <Style ss:ID="CodeCell">
   <Font ss:FontName="Consolas" ss:Size="10" ss:Bold="1" ss:Color="#0091EA"/>
   <Alignment ss:Horizontal="Center"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/></Borders>
  </Style>
  <Style ss:ID="CategoryCell">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#7C3AED" ss:Bold="1"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/></Borders>
  </Style>
  <Style ss:ID="CurrencyCell">
   <NumberFormat ss:Format="#,##0.00"/>
   <Alignment ss:Horizontal="Right"/>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#0F172A"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/></Borders>
  </Style>
  <Style ss:ID="SafeCell">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#00796B"/>
   <Interior ss:Color="#E8F5E9" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#C8E6C9"/></Borders>
  </Style>
  <Style ss:ID="AmberCell">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#E65100"/>
   <Interior ss:Color="#FFF3E0" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FFE0B2"/></Borders>
  </Style>
  <Style ss:ID="RedCell">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#C2185B"/>
   <Interior ss:Color="#FFEBEE" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FFCDD2"/></Borders>
  </Style>
 </Styles>
 <Worksheet ss:Name="Product Catalog">
  <Table ss:ExpandedColumnCount="16" ss:DefaultRowHeight="20">
   <Column ss:Width="80"/>
   <Column ss:Width="200"/>
   <Column ss:Width="160"/>
   <Column ss:Width="120"/>
   <Column ss:Width="90"/>
   <Column ss:Width="70"/>
   <Column ss:Width="90"/>
   <Column ss:Width="90"/>
   <Column ss:Width="80"/>
   <Column ss:Width="80"/>
   <Column ss:Width="110"/>
   <Column ss:Width="110"/>
   <Column ss:Width="110"/>
   <Column ss:Width="80"/>
   <Column ss:Width="80"/>
   <Column ss:Width="70"/>

   <Row ss:Height="36">
    <Cell ss:MergeAcross="15" ss:StyleID="TitleHeader"><Data ss:Type="String">🏥 ${companyName.toUpperCase()} — MASTER PHARMACEUTICAL CATALOG</Data></Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:MergeAcross="15" ss:StyleID="SubHeader"><Data ss:Type="String">Exported: ${new Date().toLocaleString('en-GB')} | Total Records: ${filteredProducts.length}</Data></Cell>
   </Row>
   <Row ss:Height="26">
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">CODE</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">PRODUCT NAME</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">GENERIC (INN)</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">CATEGORY</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">FORM</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">UNIT</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">BUY (KES)</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">SELL (KES)</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">MARGIN %</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">STOCK QTY</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">TOTAL COST (KES)</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">TOTAL VALUE (KES)</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">POTENTIAL PROFIT</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">RX STATUS</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">SHELF</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">STATUS</Data></Cell>
   </Row>
   ${rowsXml}
  </Table>
 </Worksheet>
</Workbook>`;

            const blob = new Blob([xmlContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `pharmacy_products_${new Date().toISOString().split('T')[0]}.xls`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success('Downloaded Bright Excel Sheet (.xls)');
        } catch {
            toast.error('Failed to export Excel');
        }
    };

    // ─── PRINT CATALOG / PDF VIEW ───
    const printCatalogReport = () => {
        window.print();
    };

    // ─── FILTERING & SORTING LOGIC ───
    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            // Omni-search
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchName = p.product_name?.toLowerCase().includes(q);
                const matchGeneric = p.generic_name?.toLowerCase().includes(q);
                const matchCode = p.product_code?.toLowerCase().includes(q);
                const matchBarcode = p.barcode?.includes(searchQuery);
                const matchMfg = p.manufacturer?.toLowerCase().includes(q);
                if (!matchName && !matchGeneric && !matchCode && !matchBarcode && !matchMfg) {
                    return false;
                }
            }

            // Category filter
            if (filterCategory !== 'All' && p.category !== filterCategory) {
                return false;
            }

            // Drug Type filter
            if (filterDrugType !== 'All' && p.drug_type !== filterDrugType) {
                return false;
            }

            // Prescription status
            if (filterPrescription === 'rx' && !p.requires_prescription) return false;
            if (filterPrescription === 'otc' && p.requires_prescription) return false;
            if (filterPrescription === 'controlled' && !p.controlled_substance) return false;

            // Stock level filter
            const stk = stockData[p.pid] || 0;
            const reorder = p.reorder_point || 10;
            if (filterStockStatus === 'in_stock' && stk <= reorder) return false;
            if (filterStockStatus === 'low_stock' && (stk > reorder || stk <= 0)) return false;
            if (filterStockStatus === 'out_of_stock' && stk > 0) return false;
            if (filterStockStatus === 'overstocked' && stk <= reorder * 3) return false;

            // Expiry risk filter
            const pBatches = productBatches[p.pid] || [];
            const nearestDays = pBatches.length > 0 ? getDaysUntilExpiry(pBatches[0].expiry_date) : null;
            if (filterExpiryRisk === 'has_batches' && pBatches.length === 0) return false;
            if (filterExpiryRisk === 'expiring_30' && (nearestDays === null || nearestDays > 30 || nearestDays < 0)) return false;
            if (filterExpiryRisk === 'expiring_90' && (nearestDays === null || nearestDays > 90 || nearestDays < 0)) return false;
            if (filterExpiryRisk === 'expired' && (nearestDays === null || nearestDays >= 0)) return false;
            if (filterExpiryRisk === 'no_batches' && pBatches.length > 0) return false;

            // Margin tier filter
            const m = p.margin_per || 0;
            if (filterMarginTier === 'high' && m < 30) return false;
            if (filterMarginTier === 'medium' && (m < 15 || m >= 30)) return false;
            if (filterMarginTier === 'low' && (m < 0 || m >= 15)) return false;
            if (filterMarginTier === 'negative' && m >= 0) return false;

            // Fast pill filters
            if (activeFastFilter === 'low_stock' && (stk > reorder || stk <= 0)) return false;
            if (activeFastFilter === 'out_of_stock' && stk > 0) return false;
            if (activeFastFilter === 'rx_only' && !p.requires_prescription) return false;
            if (activeFastFilter === 'high_margin' && m < 30) return false;
            if (activeFastFilter === 'expiring' && (nearestDays === null || nearestDays > 90)) return false;

            return true;
        }).sort((a, b) => {
            const stkA = stockData[a.pid] || 0;
            const stkB = stockData[b.pid] || 0;
            if (sortBy === 'name_asc') return a.product_name.localeCompare(b.product_name);
            if (sortBy === 'name_desc') return b.product_name.localeCompare(a.product_name);
            if (sortBy === 'stock_desc') return stkB - stkA;
            if (sortBy === 'stock_asc') return stkA - stkB;
            if (sortBy === 'price_desc') return (b.sales_cost || 0) - (a.sales_cost || 0);
            if (sortBy === 'price_asc') return (a.sales_cost || 0) - (b.sales_cost || 0);
            if (sortBy === 'margin_desc') return (b.margin_per || 0) - (a.margin_per || 0);
            return 0;
        });
    }, [
        products,
        searchQuery,
        filterCategory,
        filterDrugType,
        filterPrescription,
        filterStockStatus,
        filterExpiryRisk,
        filterMarginTier,
        activeFastFilter,
        sortBy,
        stockData,
        productBatches
    ]);

    // ─── PORTFOLIO KPI AGGREGATES ───
    const kpiData = useMemo(() => {
        let totalValCost = 0;
        let totalValSales = 0;
        let lowStockCount = 0;
        let outOfStockCount = 0;
        let totalUnits = 0;
        let activeSkus = 0;
        let rxCount = 0;

        products.forEach(p => {
            const stk = stockData[p.pid] || 0;
            const ppp = p.pieces_per_package || 1;
            const costPerPiece = p.purchase_cost / ppp;
            const sellPerPiece = p.sales_cost;

            totalValCost += costPerPiece * stk;
            totalValSales += sellPerPiece * stk;
            totalUnits += stk;

            if (p.active) activeSkus++;
            if (p.requires_prescription) rxCount++;
            if (stk <= 0) outOfStockCount++;
            else if (stk <= (p.reorder_point || 10)) lowStockCount++;
        });

        const potentialProfit = totalValSales - totalValCost;
        const portfolioMargin = totalValSales > 0 ? (potentialProfit / totalValSales) * 100 : 0;

        return {
            totalProducts: products.length,
            activeSkus,
            rxCount,
            totalUnits,
            totalValCost,
            totalValSales,
            potentialProfit,
            portfolioMargin,
            lowStockCount,
            outOfStockCount
        };
    }, [products, stockData]);

    // Pagination
    const totalPages = Math.ceil(filteredProducts.length / perPage);
    const paginatedProducts = filteredProducts.slice((page - 1) * perPage, page * perPage);

    // Bulk selection handlers
    const toggleSelectAll = () => {
        if (selectedPids.size === paginatedProducts.length) {
            setSelectedPids(new Set());
        } else {
            setSelectedPids(new Set(paginatedProducts.map(p => p.pid)));
        }
    };

    const toggleSelectPid = (pid: number) => {
        const next = new Set(selectedPids);
        if (next.has(pid)) next.delete(pid);
        else next.add(pid);
        setSelectedPids(next);
    };

    return (
        <div className={`space-y-5 ${autoFitScreen ? 'max-w-full' : 'max-w-[1700px]'} mx-auto`} style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>

            {/* ━━━ TOP BAR: HEADER & CONTROLS ━━━ */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                    <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 flex-shrink-0">
                        <FiPackage size={26} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Products & Pharmaceutical Formulary</h1>
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                                {products.length} Drugs
                            </span>
                        </div>
                        <p className="text-slate-500 text-xs mt-0.5">
                            Pharmacy stock inventory, batch tracking, prescription governance & profit margins
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => { loadProducts(); loadStockData(); toast.success('Catalog refreshed'); }}
                        className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-emerald-600 hover:border-emerald-300 transition shadow-sm"
                        title="Refresh Catalog"
                    >
                        <FiRefreshCw size={15} />
                    </button>

                    <button
                        onClick={() => setAutoFitScreen(!autoFitScreen)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition shadow-sm ${
                            autoFitScreen
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                        title="Toggle Auto-Fit Layout"
                    >
                        {autoFitScreen ? <FiMinimize2 size={13} /> : <FiMaximize2 size={13} />}
                        <span>{autoFitScreen ? 'Auto-Fit' : 'Expanded'}</span>
                    </button>

                    <button
                        onClick={() => { setShowLabelModal(true); setLabelProducts([]); setLabelQty({}); }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-purple-600 hover:border-purple-300 transition text-xs font-bold shadow-sm"
                    >
                        <FiPrinter size={14} className="text-purple-600" />
                        <span>Labels</span>
                    </button>

                    <button
                        onClick={() => { setShowLookupModal(true); setLookupQuery(''); setLookupResult(null); }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-cyan-600 hover:border-cyan-300 transition text-xs font-bold shadow-sm"
                    >
                        <FiEye size={14} className="text-cyan-600" />
                        <span>Scan / Lookup</span>
                    </button>

                    <button
                        onClick={() => { setShowImportModal(true); setImportFile(null); setImportStatus('idle'); setImportErrors([]); }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-blue-600 hover:border-blue-300 transition text-xs font-bold shadow-sm"
                    >
                        <FiUpload size={14} className="text-blue-600" />
                        <span>Import CSV</span>
                    </button>

                    <button
                        onClick={exportBrightExcel}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition"
                        title="Download Vivid Color Excel Spreadsheet"
                    >
                        <FiDownload size={14} />
                        <span>Super Excel</span>
                    </button>

                    <button
                        onClick={printCatalogReport}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs shadow-sm transition"
                    >
                        <FiPrinter size={14} />
                        <span>Print PDF</span>
                    </button>

                    <button
                        onClick={openAddModal}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm shadow-md shadow-emerald-500/30 transition transform hover:-translate-y-0.5 active:translate-y-0"
                    >
                        <FiPlus size={16} strokeWidth={3} />
                        <span>Add New Product</span>
                    </button>
                </div>
            </div>

            {/* ━━━ EXECUTIVE METRIC TILES (WHITE THEME) ━━━ */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5">
                {/* 1. Total Catalog */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow transition">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Products</span>
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <FiPackage size={16} />
                        </div>
                    </div>
                    <p className="text-2xl font-black text-slate-800 mt-2">{kpiData.totalProducts}</p>
                    <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500 font-medium">
                        <span>Active: <b className="text-emerald-600">{kpiData.activeSkus}</b></span>
                        <span>Off: <b className="text-slate-400">{kpiData.totalProducts - kpiData.activeSkus}</b></span>
                    </div>
                </div>

                {/* 2. Stock Units */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow transition">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-blue-500">Units in Stock</span>
                        <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                            <FiBox size={16} />
                        </div>
                    </div>
                    <p className="text-2xl font-black text-slate-800 mt-2">{kpiData.totalUnits.toLocaleString()}</p>
                    <p className="text-[11px] text-slate-500 mt-1">Dispensing units on shelf</p>
                </div>

                {/* 3. Valuation Cost */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow transition">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-500">Stock Outlay (Cost)</span>
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                            <FiDollarSign size={16} />
                        </div>
                    </div>
                    <p className="text-2xl font-black text-slate-800 mt-2">
                        KES {Math.round(kpiData.totalValCost).toLocaleString()}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">At wholesale purchase rates</p>
                </div>

                {/* 4. Retail Potential */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow transition">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-teal-600">Retail Worth</span>
                        <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                            <FiTrendingUp size={16} />
                        </div>
                    </div>
                    <p className="text-2xl font-black text-teal-700 mt-2">
                        KES {Math.round(kpiData.totalValSales).toLocaleString()}
                    </p>
                    <p className="text-[11px] text-teal-600 mt-1 font-bold">
                        Margin: {kpiData.portfolioMargin.toFixed(1)}%
                    </p>
                </div>

                {/* 5. Projected Profit */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow transition">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-purple-600">Expected Profit</span>
                        <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                            <FiZap size={16} />
                        </div>
                    </div>
                    <p className="text-2xl font-black text-purple-700 mt-2">
                        KES {Math.round(kpiData.potentialProfit).toLocaleString()}
                    </p>
                    <p className="text-[11px] text-purple-600 mt-1 font-medium">When all inventory sells</p>
                </div>

                {/* 6. Stock Level Alerts */}
                <div className={`rounded-2xl border p-4 shadow-sm transition bg-white ${
                    kpiData.lowStockCount > 0 || kpiData.outOfStockCount > 0
                        ? 'border-amber-300'
                        : 'border-slate-200'
                }`}>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-600">Restock Alerts</span>
                        <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                            <FiAlertTriangle size={16} />
                        </div>
                    </div>
                    <div className="flex items-baseline gap-2 mt-2">
                        <p className="text-2xl font-black text-amber-700">{kpiData.lowStockCount}</p>
                        <span className="text-xs text-amber-600 font-bold">low</span>
                        <span className="text-xs text-slate-300">/</span>
                        <p className="text-2xl font-black text-red-600">{kpiData.outOfStockCount}</p>
                        <span className="text-xs text-red-600 font-bold">nil</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">Requires purchase orders</p>
                </div>
            </div>

            {/* ━━━ SUPER MULTI-DIMENSIONAL FILTER PANEL ━━━ */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3.5">
                {/* Search Bar + Primary Controls */}
                <div className="flex flex-col lg:flex-row gap-3">
                    <div className="flex-1 relative">
                        <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                            placeholder="Omni-search by brand name, generic (INN), DRG code, barcode, or manufacturer..."
                            className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                            >
                                <FiX size={14} />
                            </button>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* Category Dropdown */}
                        <div className="relative">
                            <select
                                value={filterCategory}
                                onChange={e => { setFilterCategory(e.target.value); setPage(1); }}
                                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-500 cursor-pointer"
                            >
                                <option value="All">All Categories</option>
                                {categories.map(c => (
                                    <option key={c.category_id} value={c.category_name}>{c.category_name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Drug Form Dropdown */}
                        <div className="relative">
                            <select
                                value={filterDrugType}
                                onChange={e => { setFilterDrugType(e.target.value); setPage(1); }}
                                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-500 cursor-pointer"
                            >
                                <option value="All">All Forms</option>
                                {DRUG_TYPES.map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>

                        {/* Prescription Regulation Dropdown */}
                        <div className="relative">
                            <select
                                value={filterPrescription}
                                onChange={e => { setFilterPrescription(e.target.value); setPage(1); }}
                                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-500 cursor-pointer"
                            >
                                <option value="All">All Regulations</option>
                                <option value="rx">℞ Prescription (POM)</option>
                                <option value="otc">Over The Counter (OTC)</option>
                                <option value="controlled">Controlled Drugs</option>
                            </select>
                        </div>

                        {/* Stock Status Dropdown */}
                        <div className="relative">
                            <select
                                value={filterStockStatus}
                                onChange={e => { setFilterStockStatus(e.target.value); setPage(1); }}
                                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-500 cursor-pointer"
                            >
                                <option value="All">All Stock Levels</option>
                                <option value="in_stock">In Stock (&gt; Reorder)</option>
                                <option value="low_stock">⚠️ Low Stock (≤ Reorder)</option>
                                <option value="out_of_stock">❌ Out of Stock (0)</option>
                                <option value="overstocked">📦 Overstocked</option>
                            </select>
                        </div>

                        {/* Expiry Risk Dropdown */}
                        <div className="relative">
                            <select
                                value={filterExpiryRisk}
                                onChange={e => { setFilterExpiryRisk(e.target.value); setPage(1); }}
                                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-500 cursor-pointer"
                            >
                                <option value="All">All Expiry States</option>
                                <option value="has_batches">Has Active Batches</option>
                                <option value="expiring_30">Expiring in ≤ 30 Days</option>
                                <option value="expiring_90">Expiring in ≤ 90 Days</option>
                                <option value="expired">🚨 Expired Batches</option>
                                <option value="no_batches">No Batches Entered</option>
                            </select>
                        </div>

                        {/* Sort By */}
                        <div className="relative">
                            <select
                                value={sortBy}
                                onChange={e => setSortBy(e.target.value as any)}
                                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-500 cursor-pointer"
                            >
                                <option value="name_asc">Name: A → Z</option>
                                <option value="name_desc">Name: Z → A</option>
                                <option value="stock_desc">Stock: High → Low</option>
                                <option value="stock_asc">Stock: Low → High</option>
                                <option value="price_desc">Price: High → Low</option>
                                <option value="price_asc">Price: Low → High</option>
                                <option value="margin_desc">Margin %: Highest</option>
                            </select>
                        </div>

                        {/* View Mode Toggle */}
                        <div className="flex border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-2 transition ${viewMode === 'list' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                title="List / Table View"
                            >
                                <FiList size={16} />
                            </button>
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-2 transition ${viewMode === 'grid' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                title="Card Grid View"
                            >
                                <FiGrid size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Fast Quick Filter Pills */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Quick Filters:</span>
                        {[
                            { id: 'all', label: 'All Products', count: products.length },
                            { id: 'low_stock', label: '⚠️ Low Stock', count: kpiData.lowStockCount },
                            { id: 'out_of_stock', label: '❌ Nil Stock', count: kpiData.outOfStockCount },
                            { id: 'rx_only', label: '℞ Prescription', count: kpiData.rxCount },
                            { id: 'expiring', label: '⏳ Expiry Risk', count: products.filter(p => (productBatches[p.pid] || []).some(b => getDaysUntilExpiry(b.expiry_date) <= 90)).length },
                            { id: 'high_margin', label: '⭐ High Margin (≥30%)', count: products.filter(p => (p.margin_per || 0) >= 30).length },
                        ].map(f => (
                            <button
                                key={f.id}
                                onClick={() => { setActiveFastFilter(f.id as any); setPage(1); }}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                                    activeFastFilter === f.id
                                        ? 'bg-emerald-600 text-white shadow-sm'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                <span>{f.label}</span>
                                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                                    activeFastFilter === f.id ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-700'
                                }`}>
                                    {f.count}
                                </span>
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                        <span>Showing <b>{filteredProducts.length}</b> of <b>{products.length}</b> items</span>
                        {(filterCategory !== 'All' || filterDrugType !== 'All' || filterPrescription !== 'All' || filterStockStatus !== 'All' || filterExpiryRisk !== 'All' || activeFastFilter !== 'all' || searchQuery) && (
                            <button
                                onClick={() => {
                                    setSearchQuery('');
                                    setFilterCategory('All');
                                    setFilterDrugType('All');
                                    setFilterPrescription('All');
                                    setFilterStockStatus('All');
                                    setFilterExpiryRisk('All');
                                    setActiveFastFilter('all');
                                    setPage(1);
                                }}
                                className="text-red-500 hover:text-red-700 font-bold underline ml-2"
                            >
                                Reset All
                            </button>
                        )}
                    </div>
                </div>

                {/* Bulk Action Toolbar if items selected */}
                {selectedPids.size > 0 && (
                    <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 animate-fadeIn">
                        <div className="flex items-center gap-2">
                            <FiCheckCircle size={15} className="text-emerald-600" />
                            <span>{selectedPids.size} product(s) selected</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => {
                                    setLabelProducts(Array.from(selectedPids));
                                    const qMap: Record<number, number> = {};
                                    selectedPids.forEach(id => qMap[id] = 1);
                                    setLabelQty(qMap);
                                    setShowLabelModal(true);
                                }}
                                className="px-3 py-1 bg-white border border-emerald-300 rounded-lg text-emerald-700 hover:bg-emerald-100 transition"
                            >
                                Print Labels for Selected
                            </button>
                            <button
                                onClick={() => setSelectedPids(new Set())}
                                className="px-2 py-1 text-slate-500 hover:text-slate-800"
                            >
                                Deselect All
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ━━━ MAIN DATA DISPLAY (WHITE THEME TABLE / GRID) ━━━ */}
            {isLoading ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-20 flex flex-col items-center justify-center">
                    <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
                    <p className="mt-4 text-sm font-bold text-slate-600">Loading Pharmaceutical Catalog...</p>
                    <p className="text-xs text-slate-400 mt-1">Fetching active formulas, batches and stock balances</p>
                </div>
            ) : paginatedProducts.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-sm">
                    <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                        <FiPackage size={28} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">No matching drugs found</h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                        Try adjusting your search terms or filters. Alternatively, add a new pharmaceutical product.
                    </p>
                    <button
                        onClick={openAddModal}
                        className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition"
                    >
                        + Add First Drug
                    </button>
                </div>
            ) : viewMode === 'grid' ? (
                /* ─── CARD GRID VIEW ─── */
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
                    {paginatedProducts.map(p => {
                        const stk = stockData[p.pid] || 0;
                        const pBatches = productBatches[p.pid] || [];
                        const nearestDays = pBatches.length > 0 ? getDaysUntilExpiry(pBatches[0].expiry_date) : null;
                        const isSelected = selectedPids.has(p.pid);

                        return (
                            <div
                                key={p.pid}
                                className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-sm hover:shadow-md flex flex-col justify-between ${
                                    isSelected ? 'border-emerald-500 ring-2 ring-emerald-400/20' : 'border-slate-200'
                                }`}
                            >
                                <div className="p-3.5">
                                    {/* Top badges */}
                                    <div className="flex items-start justify-between gap-1 mb-2">
                                        <div className="flex items-center gap-1.5">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleSelectPid(p.pid)}
                                                className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
                                            />
                                            <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                                {p.product_code}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {p.requires_prescription && (
                                                <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 text-[10px] font-black">
                                                    ℞ Rx
                                                </span>
                                            )}
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                                p.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'
                                            }`}>
                                                {p.active ? 'Active' : 'Off'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Product Name & Generic */}
                                    <h4 className="text-sm font-black text-slate-800 line-clamp-1" title={p.product_name}>
                                        {p.product_name}
                                    </h4>
                                    <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5 italic">
                                        {p.generic_name || p.dosage || 'No generic specification'}
                                    </p>

                                    {/* Category & Formulation Tags */}
                                    <div className="flex items-center gap-1 mt-2 flex-wrap">
                                        <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-100 text-[10px] font-bold">
                                            {p.category || 'General'}
                                        </span>
                                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-medium">
                                            {p.drug_type || 'Tablet'}
                                        </span>
                                    </div>

                                    {/* Pricing & Margin Matrix */}
                                    <div className="mt-3.5 p-2 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-slate-400">Sell Price:</span>
                                            <span className="font-black text-slate-800">KES {(p.sales_cost || 0).toLocaleString()}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-slate-400">Buy Cost:</span>
                                            <span className="font-medium text-slate-600">KES {(p.purchase_cost || 0).toLocaleString()}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60 font-bold">
                                            <span className="text-slate-500">Margin:</span>
                                            <span className={(p.margin_per || 0) >= 20 ? 'text-emerald-600' : 'text-amber-600'}>
                                                {(p.margin_per || 0).toFixed(1)}%
                                            </span>
                                        </div>
                                    </div>

                                    {/* Stock & Expiry Indicators */}
                                    <div className="mt-3 flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <span className={`w-2.5 h-2.5 rounded-full ${
                                                stk <= 0 ? 'bg-red-500 animate-pulse' : stk <= (p.reorder_point || 10) ? 'bg-amber-500' : 'bg-emerald-500'
                                            }`} />
                                            <span className="text-xs font-black text-slate-800">
                                                {stk} {p.sales_unit || 'Pcs'}
                                            </span>
                                        </div>
                                        {nearestDays !== null && getExpiryBadge(nearestDays)}
                                    </div>
                                </div>

                                {/* Card Footer Actions */}
                                <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-1">
                                    <button
                                        onClick={() => openEditModal(p)}
                                        className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-white rounded-lg transition"
                                        title="Edit Product"
                                    >
                                        <FiEdit2 size={13} />
                                    </button>
                                    <button
                                        onClick={() => openStockHistory(p)}
                                        className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-white rounded-lg transition"
                                        title="Stock History"
                                    >
                                        <FiClock size={13} />
                                    </button>
                                    <button
                                        onClick={() => openStockAdjust(p)}
                                        className="p-1.5 text-slate-600 hover:text-purple-600 hover:bg-white rounded-lg transition"
                                        title="Adjust Stock"
                                    >
                                        <FiSliders size={13} />
                                    </button>
                                    <button
                                        onClick={() => deleteProduct(p)}
                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg transition"
                                        title="Delete Product"
                                    >
                                        <FiTrash2 size={13} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* ─── DETAILED TABLE / DATAGRID (PURE WHITE THEME) ─── */
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 text-[11px] font-black uppercase tracking-wider">
                                    <th className="py-3 px-3.5 w-10 text-center">
                                        <input
                                            type="checkbox"
                                            checked={selectedPids.size === paginatedProducts.length && paginatedProducts.length > 0}
                                            onChange={toggleSelectAll}
                                            className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
                                        />
                                    </th>
                                    <th className="py-3 px-3.5">Drug / Pharmaceutical</th>
                                    <th className="py-3 px-3.5 hidden md:table-cell">Category</th>
                                    <th className="py-3 px-3.5 hidden lg:table-cell">Form / Strength</th>
                                    <th className="py-3 px-3.5 text-right">Cost Price</th>
                                    <th className="py-3 px-3.5 text-right">Retail Sell</th>
                                    <th className="py-3 px-3.5 text-center">Margin</th>
                                    <th className="py-3 px-3.5 text-center">Current Stock</th>
                                    <th className="py-3 px-3.5 text-center">Batches / Shelf</th>
                                    <th className="py-3 px-3.5 text-center">Reg. Status</th>
                                    <th className="py-3 px-3.5 text-center w-28">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                                {paginatedProducts.map((p, idx) => {
                                    const stk = stockData[p.pid] || 0;
                                    const pBatches = productBatches[p.pid] || [];
                                    const nearestBatch = pBatches[0];
                                    const nearestDays = nearestBatch ? getDaysUntilExpiry(nearestBatch.expiry_date) : null;
                                    const isExpanded = expandedRows.has(p.pid);
                                    const isSelected = selectedPids.has(p.pid);

                                    return (
                                        <>
                                            <tr
                                                key={p.pid}
                                                className={`transition-colors hover:bg-slate-50/70 ${
                                                    isSelected ? 'bg-emerald-50/40' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                                                }`}
                                            >
                                                {/* Checkbox */}
                                                <td className="py-3 px-3.5 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleSelectPid(p.pid)}
                                                        className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
                                                    />
                                                </td>

                                                {/* Name & Generic */}
                                                <td className="py-3 px-3.5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-black text-sm flex-shrink-0">
                                                            {p.photo ? (
                                                                <img
                                                                    src={p.photo}
                                                                    alt=""
                                                                    className="w-full h-full object-cover rounded-xl"
                                                                    onError={e => { (e.target as HTMLElement).style.display = 'none'; }}
                                                                />
                                                            ) : (
                                                                p.product_name.charAt(0)
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-slate-900 hover:text-emerald-700 cursor-pointer" onClick={() => openEditModal(p)}>
                                                                    {p.product_name}
                                                                </span>
                                                                {p.requires_prescription && (
                                                                    <span className="px-1.5 py-0.2 rounded bg-red-50 text-red-600 border border-red-200 text-[10px] font-black">
                                                                        ℞
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                                                                <span className="font-mono text-emerald-600 font-bold">{p.product_code}</span>
                                                                {p.generic_name && (
                                                                    <>
                                                                        <span>•</span>
                                                                        <span className="italic text-slate-500">{p.generic_name}</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Category */}
                                                <td className="py-3 px-3.5 hidden md:table-cell">
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-100 rounded-lg text-[11px] font-bold">
                                                        <FiTag size={10} /> {p.category || 'General'}
                                                    </span>
                                                </td>

                                                {/* Formulation */}
                                                <td className="py-3 px-3.5 hidden lg:table-cell">
                                                    <div className="text-slate-700 font-medium">
                                                        {p.drug_type || 'Tablet'}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400">
                                                        {p.dosage || 'Standard'} • {p.sales_unit || 'Piece'}
                                                    </div>
                                                </td>

                                                {/* Purchase Cost */}
                                                <td className="py-3 px-3.5 text-right font-medium text-slate-600">
                                                    KES {(p.purchase_cost || 0).toLocaleString()}
                                                    {p.pieces_per_package && p.pieces_per_package > 1 && (
                                                        <div className="text-[10px] text-slate-400">
                                                            KES {(p.purchase_cost / p.pieces_per_package).toFixed(1)}/pc
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Selling Price */}
                                                <td className="py-3 px-3.5 text-right font-black text-slate-900">
                                                    KES {(p.sales_cost || 0).toLocaleString()}
                                                </td>

                                                {/* Margin */}
                                                <td className="py-3 px-3.5 text-center">
                                                    <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-black ${
                                                        (p.margin_per || 0) >= 30
                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                            : (p.margin_per || 0) >= 15
                                                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                                            : 'bg-red-50 text-red-700 border border-red-200'
                                                    }`}>
                                                        {(p.margin_per || 0).toFixed(1)}%
                                                    </span>
                                                </td>

                                                {/* Current Stock */}
                                                <td className="py-3 px-3.5 text-center">
                                                    <div className="flex flex-col items-center">
                                                        <span className={`inline-block px-2.5 py-0.5 rounded-lg text-xs font-black ${
                                                            stk <= 0
                                                                ? 'bg-red-100 text-red-700 border border-red-200'
                                                                : stk <= (p.reorder_point || 10)
                                                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                                        }`}>
                                                            {stk} {p.sales_unit || 'Pcs'}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 mt-0.5">
                                                            Min: {p.reorder_point || 10}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Batches / Expiry */}
                                                <td className="py-3 px-3.5 text-center">
                                                    {pBatches.length > 0 ? (
                                                        <button
                                                            onClick={() => {
                                                                const s = new Set(expandedRows);
                                                                if (s.has(p.pid)) s.delete(p.pid);
                                                                else s.add(p.pid);
                                                                setExpandedRows(s);
                                                            }}
                                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition text-[11px] font-bold text-slate-700"
                                                        >
                                                            <span>{pBatches.length} batch{pBatches.length > 1 ? 'es' : ''}</span>
                                                            {nearestDays !== null && getExpiryBadge(nearestDays)}
                                                            <FiChevronRight size={12} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                                        </button>
                                                    ) : (
                                                        <span className="text-[11px] text-slate-400 italic">No batches</span>
                                                    )}
                                                </td>

                                                {/* Regulatory Status */}
                                                <td className="py-3 px-3.5 text-center">
                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                                        p.active
                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                            : 'bg-slate-100 text-slate-500'
                                                    }`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${p.active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                                        {p.active ? 'Active' : 'Disabled'}
                                                    </span>
                                                </td>

                                                {/* Actions */}
                                                <td className="py-3 px-3.5 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button
                                                            onClick={() => openEditModal(p)}
                                                            className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                                                            title="Edit Details"
                                                        >
                                                            <FiEdit2 size={13} />
                                                        </button>
                                                        <button
                                                            onClick={() => openStockHistory(p)}
                                                            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                                            title="Stock Movement Ledger"
                                                        >
                                                            <FiClock size={13} />
                                                        </button>
                                                        <button
                                                            onClick={() => openPriceHistory(p)}
                                                            className="p-1.5 text-slate-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition"
                                                            title="Price History Audit"
                                                        >
                                                            <FiTrendingUp size={13} />
                                                        </button>
                                                        <button
                                                            onClick={() => openStockAdjust(p)}
                                                            className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                                                            title="Adjust Inventory"
                                                        >
                                                            <FiSliders size={13} />
                                                        </button>
                                                        <button
                                                            onClick={() => deleteProduct(p)}
                                                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                                            title="Delete"
                                                        >
                                                            <FiTrash2 size={13} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* Expandable Batches Sub-Table */}
                                            {isExpanded && pBatches.length > 0 && (
                                                <tr key={`batches-${p.pid}`} className="bg-slate-50/60">
                                                    <td colSpan={11} className="py-3 px-6">
                                                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                                            <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 text-xs font-bold text-slate-700 flex items-center justify-between">
                                                                <span className="flex items-center gap-2">
                                                                    <FiBox size={14} className="text-emerald-600" />
                                                                    Batch Registry for {p.product_name}
                                                                </span>
                                                                <span className="text-[11px] text-slate-500 font-normal">
                                                                    Dispensed in FIFO / FEFO sequence
                                                                </span>
                                                            </div>
                                                            <table className="w-full text-xs">
                                                                <thead>
                                                                    <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 text-[10px] uppercase">
                                                                        <th className="py-2 px-3">Batch Number</th>
                                                                        <th className="py-2 px-3 text-center">Expiry Date</th>
                                                                        <th className="py-2 px-3 text-center">Remaining Days</th>
                                                                        <th className="py-2 px-3 text-right">Qty in Batch</th>
                                                                        <th className="py-2 px-3 text-right">Unit Buy</th>
                                                                        <th className="py-2 px-3 text-right">Unit Sell</th>
                                                                        <th className="py-2 px-3">Supplier / Invoice</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-slate-100">
                                                                    {pBatches.map(b => {
                                                                        const d = getDaysUntilExpiry(b.expiry_date);
                                                                        return (
                                                                            <tr key={b.batch_id} className="hover:bg-slate-50">
                                                                                <td className="py-2 px-3 font-mono font-bold text-slate-800">
                                                                                    {b.batch_number}
                                                                                </td>
                                                                                <td className="py-2 px-3 text-center text-slate-600">
                                                                                    {b.expiry_date ? new Date(b.expiry_date).toLocaleDateString('en-GB') : '-'}
                                                                                </td>
                                                                                <td className="py-2 px-3 text-center">
                                                                                    {getExpiryBadge(d)}
                                                                                </td>
                                                                                <td className="py-2 px-3 text-right font-bold text-slate-800">
                                                                                    {b.remaining_qty ?? b.quantity}
                                                                                </td>
                                                                                <td className="py-2 px-3 text-right text-slate-600">
                                                                                    KES {(b.purchase_cost || p.purchase_cost || 0).toLocaleString()}
                                                                                </td>
                                                                                <td className="py-2 px-3 text-right font-black text-slate-900">
                                                                                    KES {(b.selling_price || p.sales_cost || 0).toLocaleString()}
                                                                                </td>
                                                                                <td className="py-2 px-3 text-slate-500">
                                                                                    {b.supplier_name || '-'} {b.purchase_invoice ? `(${b.purchase_invoice})` : ''}
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ━━━ PAGINATION FOOTER ━━━ */}
            <div className="bg-white rounded-2xl border border-slate-200 px-5 py-3 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                    <span>Rows per page:</span>
                    <select
                        value={perPage}
                        onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}
                        className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 outline-none"
                    >
                        {[15, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <span className="text-slate-400">|</span>
                    <span>Total <b>{filteredProducts.length}</b> drugs</span>
                </div>

                <div className="flex items-center gap-1.5">
                    <button
                        onClick={() => setPage(1)}
                        disabled={page === 1}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <FiChevronsLeft size={14} />
                    </button>
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <FiChevronLeft size={14} />
                    </button>

                    <span className="px-3 py-1 font-bold text-slate-800">
                        Page {page} of {totalPages || 1}
                    </span>

                    <button
                        onClick={() => setPage(p => Math.min(totalPages || 1, p + 1))}
                        disabled={page >= totalPages}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <FiChevronRight size={14} />
                    </button>
                    <button
                        onClick={() => setPage(totalPages || 1)}
                        disabled={page >= totalPages}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <FiChevronsRight size={14} />
                    </button>
                </div>
            </div>

            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                SUPER ULTRA MASSIVE PRODUCT CREATION & EDITING MODAL (WHITE THEME)
               ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 md:p-6 overflow-y-auto">
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden animate-scaleUp">
                        {/* Modal Header */}
                        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 px-6 py-4.5 text-white flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-white text-lg">
                                    💊
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-lg font-black tracking-tight">
                                            {editingProduct ? `Edit Pharmaceutical Record` : `Add New Drug Formulation`}
                                        </h2>
                                        {editingProduct && (
                                            <span className="px-2 py-0.5 rounded-md bg-white/20 text-white font-mono text-xs font-bold">
                                                {editingProduct.product_code}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-white/80 text-xs mt-0.5">
                                        Clinical parameters, dual packaging units, live margin engine & batch allocations
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition"
                            >
                                <FiX size={18} />
                            </button>
                        </div>

                        {/* Interactive Tab Navigation */}
                        <div className="bg-slate-50 px-6 py-2 border-b border-slate-200 flex items-center gap-2 overflow-x-auto flex-shrink-0">
                            {[
                                { id: 'general', label: '1. Identification & Classification', icon: FiPackage },
                                { id: 'clinical', label: '2. Clinical & Regulatory', icon: FiShield },
                                { id: 'pricing', label: '3. Packaging, Prices & Margin Engine', icon: FiDollarSign },
                                { id: 'batches', label: `4. Direct Batches (${modalBatches.length})`, icon: FiBox },
                                { id: 'media', label: '5. POS Display & Notes', icon: FiSliders },
                            ].map(tab => {
                                const Icon = tab.icon;
                                const isActive = modalTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setModalTab(tab.id as any)}
                                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                                            isActive
                                                ? 'bg-white text-emerald-700 shadow-sm border border-slate-200'
                                                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                                        }`}
                                    >
                                        <Icon size={14} className={isActive ? 'text-emerald-600' : 'text-slate-400'} />
                                        <span>{tab.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Modal Body Content */}
                        <div className="p-6 overflow-y-auto flex-1 space-y-6">

                            {/* ─── TAB 1: IDENTIFICATION & CLASSIFICATION ─── */}
                            {modalTab === 'general' && (
                                <div className="space-y-4 animate-fadeIn">
                                    <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-center gap-3">
                                        <FiInfo size={18} className="text-emerald-600 flex-shrink-0" />
                                        <p className="text-xs text-emerald-800">
                                            Enter the proprietary brand name, active international nonproprietary name (INN), barcode, and storage shelf coordinates.
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">
                                                Product / Drug Brand Name <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.product_name}
                                                onChange={e => setFormData({ ...formData, product_name: e.target.value })}
                                                placeholder="e.g. Panadol Extra 500mg"
                                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-none transition"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">
                                                Generic Name (INN / Salt)
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.generic_name || ''}
                                                onChange={e => setFormData({ ...formData, generic_name: e.target.value })}
                                                placeholder="e.g. Paracetamol + Caffeine"
                                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-none transition"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5 flex items-center justify-between">
                                                <span>Barcode / EAN / UPC</span>
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        const bc = await generateBarcode();
                                                        setFormData(prev => ({ ...prev, barcode: bc }));
                                                        toast.success(`Generated barcode: ${bc}`);
                                                    }}
                                                    className="text-[10px] text-emerald-600 hover:underline font-bold"
                                                >
                                                    ⚡ Generate
                                                </button>
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.barcode || ''}
                                                onChange={e => setFormData({ ...formData, barcode: e.target.value })}
                                                placeholder="Scan or generate barcode"
                                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-none transition"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">
                                                Category / Formulary Group
                                            </label>
                                            <select
                                                value={formData.category || ''}
                                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-none cursor-pointer"
                                            >
                                                <option value="">Select Category</option>
                                                {categories.map(c => (
                                                    <option key={c.category_id} value={c.category_name}>{c.category_name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">
                                                Primary Manufacturer / Lab
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.manufacturer || ''}
                                                onChange={e => setFormData({ ...formData, manufacturer: e.target.value })}
                                                placeholder="e.g. GlaxoSmithKline, Dawa Ltd"
                                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-none transition"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">
                                                Shelf / Bin Coordinates
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.shelf_location || ''}
                                                onChange={e => setFormData({ ...formData, shelf_location: e.target.value })}
                                                placeholder="e.g. Aisle 3 - Shelf B - Bin 4"
                                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-none transition"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">
                                                Default Supplier
                                            </label>
                                            <select
                                                value={formData.supplier_name || ''}
                                                onChange={e => setFormData({ ...formData, supplier_name: e.target.value })}
                                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-none cursor-pointer"
                                            >
                                                <option value="">Direct Wholesale / Warehouse</option>
                                                {suppliers.map(s => (
                                                    <option key={s.supplier_id} value={s.supplier_name}>{s.supplier_name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">
                                                HS Code / Tax Classification
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.hscode || ''}
                                                onChange={e => setFormData({ ...formData, hscode: e.target.value })}
                                                placeholder="e.g. 3004.90.00"
                                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-none transition"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ─── TAB 2: CLINICAL & REGULATORY ─── */}
                            {modalTab === 'clinical' && (
                                <div className="space-y-4 animate-fadeIn">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">
                                                Dosage Formulation
                                            </label>
                                            <select
                                                value={formData.drug_type}
                                                onChange={e => setFormData({ ...formData, drug_type: e.target.value })}
                                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-none cursor-pointer"
                                            >
                                                {DRUG_TYPES.map(t => (
                                                    <option key={t} value={t}>{t}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">
                                                Strength & Concentration
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.dosage || ''}
                                                onChange={e => setFormData({ ...formData, dosage: e.target.value })}
                                                placeholder="e.g. 500mg, 125mg/5ml, 1% w/w"
                                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-none transition"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">
                                                Storage Condition Requirement
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.storage_conditions || ''}
                                                onChange={e => setFormData({ ...formData, storage_conditions: e.target.value })}
                                                placeholder="e.g. Below 25°C in a dry place"
                                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-none transition"
                                            />
                                        </div>
                                    </div>

                                    {/* Preset Storage Conditions Chips */}
                                    <div>
                                        <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1.5">
                                            Quick Presets for Storage Conditions:
                                        </label>
                                        <div className="flex flex-wrap gap-1.5">
                                            {STORAGE_PRESETS.map(preset => (
                                                <button
                                                    key={preset}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, storage_conditions: preset })}
                                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition border ${
                                                        formData.storage_conditions === preset
                                                            ? 'bg-emerald-600 text-white border-emerald-600'
                                                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                                    }`}
                                                >
                                                    {preset}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Regulatory Governance Toggles */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-200">
                                        <label className={`p-4 rounded-2xl border-2 flex items-start gap-3 cursor-pointer transition ${
                                            formData.requires_prescription ? 'border-red-400 bg-red-50/50' : 'border-slate-200 hover:border-slate-300'
                                        }`}>
                                            <input
                                                type="checkbox"
                                                checked={formData.requires_prescription}
                                                onChange={e => setFormData({ ...formData, requires_prescription: e.target.checked })}
                                                className="mt-1 w-4 h-4 accent-red-600 rounded cursor-pointer"
                                            />
                                            <div>
                                                <p className="text-sm font-black text-red-700">℞ Prescription Only (POM)</p>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    Locks dispensing at POS without a verified patient prescription number.
                                                </p>
                                            </div>
                                        </label>

                                        <label className={`p-4 rounded-2xl border-2 flex items-start gap-3 cursor-pointer transition ${
                                            formData.controlled_substance ? 'border-purple-400 bg-purple-50/50' : 'border-slate-200 hover:border-slate-300'
                                        }`}>
                                            <input
                                                type="checkbox"
                                                checked={formData.controlled_substance}
                                                onChange={e => setFormData({ ...formData, controlled_substance: e.target.checked })}
                                                className="mt-1 w-4 h-4 accent-purple-600 rounded cursor-pointer"
                                            />
                                            <div>
                                                <p className="text-sm font-black text-purple-700">Controlled Substance</p>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    Requires strict ledger tracking and Poison / Dangerous Drug Register sign-off.
                                                </p>
                                            </div>
                                        </label>

                                        <label className={`p-4 rounded-2xl border-2 flex items-start gap-3 cursor-pointer transition ${
                                            formData.show_in_pos ? 'border-emerald-400 bg-emerald-50/50' : 'border-slate-200 hover:border-slate-300'
                                        }`}>
                                            <input
                                                type="checkbox"
                                                checked={formData.show_in_pos}
                                                onChange={e => setFormData({ ...formData, show_in_pos: e.target.checked })}
                                                className="mt-1 w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                                            />
                                            <div>
                                                <p className="text-sm font-black text-emerald-700">POS Cashier Grid</p>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    Show this item on the pharmacy touch POS quick-sell dashboard.
                                                </p>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            )}

                            {/* ─── TAB 3: PACKAGING, PRICING & MARGIN ENGINE ─── */}
                            {modalTab === 'pricing' && (
                                <div className="space-y-5 animate-fadeIn">
                                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3.5">
                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">
                                                Purchase Unit
                                            </label>
                                            <select
                                                value={formData.purchase_unit}
                                                onChange={e => setFormData({ ...formData, purchase_unit: e.target.value })}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800"
                                            >
                                                {units.map(u => (
                                                    <option key={u.unit_id} value={u.unit_name}>{u.unit_name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">
                                                Dispensing Unit
                                            </label>
                                            <select
                                                value={formData.sales_unit}
                                                onChange={e => setFormData({ ...formData, sales_unit: e.target.value })}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800"
                                            >
                                                {units.map(u => (
                                                    <option key={u.unit_id} value={u.unit_name}>{u.unit_name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">
                                                Pieces / Pack
                                            </label>
                                            <input
                                                type="number"
                                                min={1}
                                                value={formData.pieces_per_package}
                                                onChange={e => setFormData({ ...formData, pieces_per_package: Math.max(1, parseInt(e.target.value) || 1) })}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-center text-slate-800"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">
                                                Buying Cost (KES) <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                min={0}
                                                step={0.01}
                                                value={formData.purchase_cost}
                                                onChange={e => setFormData({ ...formData, purchase_cost: Math.max(0, parseFloat(e.target.value) || 0) })}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-800"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">
                                                Selling Price (KES) <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                min={0}
                                                step={0.01}
                                                value={formData.sales_cost}
                                                onChange={e => setFormData({ ...formData, sales_cost: Math.max(0, parseFloat(e.target.value) || 0) })}
                                                className="w-full px-3 py-2 bg-emerald-50 border border-emerald-300 rounded-xl text-sm font-black text-emerald-800"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">
                                                Wholesale Price
                                            </label>
                                            <input
                                                type="number"
                                                min={0}
                                                step={0.01}
                                                value={formData.wholesale_price}
                                                onChange={e => setFormData({ ...formData, wholesale_price: Math.max(0, parseFloat(e.target.value) || 0) })}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800"
                                            />
                                        </div>
                                    </div>

                                    {/* Secondary Parameters: VAT & Reorder Threshold */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">
                                                VAT / Tax Commodity
                                            </label>
                                            <select
                                                value={formData.vat_commodity}
                                                onChange={e => setFormData({ ...formData, vat_commodity: e.target.value })}
                                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800"
                                            >
                                                {VAT_OPTIONS.map(v => (
                                                    <option key={v} value={v}>{v}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">
                                                Minimum Reorder Threshold (Pcs)
                                            </label>
                                            <input
                                                type="number"
                                                min={0}
                                                value={formData.reorder_point}
                                                onChange={e => setFormData({ ...formData, reorder_point: Math.max(0, parseInt(e.target.value) || 0) })}
                                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800"
                                            />
                                        </div>

                                        <div className="flex items-center gap-3 pt-6">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.active}
                                                    onChange={e => setFormData({ ...formData, active: e.target.checked })}
                                                    className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
                                                />
                                                <span className="text-sm font-black text-slate-700">Active Product</span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* ─── LIVE FINANCIAL MARGIN BREAKDOWN MATRIX ─── */}
                                    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                                        <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-xs font-black text-slate-800 uppercase tracking-wider">
                                                <FiTrendingUp className="text-emerald-600" size={14} />
                                                Live Financial Margin Breakdown
                                            </div>
                                            <div className="text-xs font-bold">
                                                {computedMetrics.marginPerPiece >= 25 ? (
                                                    <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                                        ✓ High Profit Margin ({computedMetrics.marginPerPiece.toFixed(1)}%)
                                                    </span>
                                                ) : computedMetrics.marginPerPiece >= 10 ? (
                                                    <span className="text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                                        ⚠️ Standard Margin ({computedMetrics.marginPerPiece.toFixed(1)}%)
                                                    </span>
                                                ) : computedMetrics.marginPerPiece > 0 ? (
                                                    <span className="text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
                                                        ⚠️ Low Margin ({computedMetrics.marginPerPiece.toFixed(1)}%)
                                                    </span>
                                                ) : (
                                                    <span className="text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                                                        ❌ Loss-Making Price ({computedMetrics.marginPerPiece.toFixed(1)}%)
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 text-[10px] uppercase">
                                                    <th className="py-2.5 px-4 text-left">Level</th>
                                                    <th className="py-2.5 px-4 text-right">Cost Price</th>
                                                    <th className="py-2.5 px-4 text-right">Selling Price</th>
                                                    <th className="py-2.5 px-4 text-right">Unit Profit</th>
                                                    <th className="py-2.5 px-4 text-right">Gross Margin %</th>
                                                    <th className="py-2.5 px-4 text-right">Markup %</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                <tr className="hover:bg-slate-50">
                                                    <td className="py-3 px-4 font-bold text-slate-800">
                                                        📦 Per {formData.purchase_unit} (Pack)
                                                    </td>
                                                    <td className="py-3 px-4 text-right font-mono font-medium text-slate-700">
                                                        KES {computedMetrics.costPerPkg.toLocaleString()}
                                                    </td>
                                                    <td className="py-3 px-4 text-right font-mono font-black text-slate-900">
                                                        KES {computedMetrics.sellPerPkg.toLocaleString()}
                                                    </td>
                                                    <td className={`py-3 px-4 text-right font-mono font-black ${
                                                        computedMetrics.profitPerPkg >= 0 ? 'text-emerald-700' : 'text-red-700'
                                                    }`}>
                                                        KES {computedMetrics.profitPerPkg.toLocaleString()}
                                                    </td>
                                                    <td className="py-3 px-4 text-right font-black text-slate-800">
                                                        {computedMetrics.marginPerPiece.toFixed(1)}%
                                                    </td>
                                                    <td className="py-3 px-4 text-right text-slate-600">
                                                        {computedMetrics.markupPerPiece.toFixed(1)}%
                                                    </td>
                                                </tr>

                                                {computedMetrics.isDiffUnit && (
                                                    <tr className="bg-emerald-50/40">
                                                        <td className="py-3 px-4 font-bold text-emerald-800">
                                                            💊 Per {formData.sales_unit} (Dispensed)
                                                        </td>
                                                        <td className="py-3 px-4 text-right font-mono font-medium text-slate-700">
                                                            KES {computedMetrics.costPerPiece.toFixed(2)}
                                                        </td>
                                                        <td className="py-3 px-4 text-right font-mono font-black text-emerald-800">
                                                            KES {computedMetrics.sellPerPiece.toLocaleString()}
                                                        </td>
                                                        <td className={`py-3 px-4 text-right font-mono font-black ${
                                                            computedMetrics.profitPerPiece >= 0 ? 'text-emerald-700' : 'text-red-700'
                                                        }`}>
                                                            KES {computedMetrics.profitPerPiece.toFixed(2)}
                                                        </td>
                                                        <td className="py-3 px-4 text-right font-black text-emerald-800">
                                                            {computedMetrics.marginPerPiece.toFixed(1)}%
                                                        </td>
                                                        <td className="py-3 px-4 text-right text-slate-600">
                                                            {computedMetrics.markupPerPiece.toFixed(1)}%
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* ─── TAB 4: DIRECT OPENING BATCHES ─── */}
                            {modalTab === 'batches' && (
                                <div className="space-y-4 animate-fadeIn">
                                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-2xl flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <FiBox size={18} className="text-purple-600" />
                                            <div>
                                                <p className="text-xs font-black text-purple-900">Direct Batch Allocation</p>
                                                <p className="text-[11px] text-purple-700">
                                                    Assign opening stock directly into batch codes with strict expiry date monitoring.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Add Batch Inline Sub-Form */}
                                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                                            + Add New Batch Record
                                        </h4>
                                        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                                            <div className="col-span-2 md:col-span-1">
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                                    Batch # *
                                                </label>
                                                <input
                                                    type="text"
                                                    value={newBatchRow.batch_number}
                                                    onChange={e => setNewBatchRow({ ...newBatchRow, batch_number: e.target.value })}
                                                    placeholder="e.g. BAT-2611-102"
                                                    className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                                    Expiry Date *
                                                </label>
                                                <input
                                                    type="date"
                                                    value={newBatchRow.expiry_date}
                                                    onChange={e => setNewBatchRow({ ...newBatchRow, expiry_date: e.target.value })}
                                                    className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                                    Quantity (Pcs) *
                                                </label>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    value={newBatchRow.quantity || ''}
                                                    onChange={e => setNewBatchRow({ ...newBatchRow, quantity: Math.max(0, parseInt(e.target.value) || 0) })}
                                                    placeholder="100"
                                                    className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                                    Batch Cost
                                                </label>
                                                <input
                                                    type="number"
                                                    value={newBatchRow.purchase_cost || ''}
                                                    onChange={e => setNewBatchRow({ ...newBatchRow, purchase_cost: parseFloat(e.target.value) || 0 })}
                                                    placeholder={String(formData.purchase_cost)}
                                                    className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-xs"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                                    Batch Sell Price
                                                </label>
                                                <input
                                                    type="number"
                                                    value={newBatchRow.selling_price || ''}
                                                    onChange={e => setNewBatchRow({ ...newBatchRow, selling_price: parseFloat(e.target.value) || 0 })}
                                                    placeholder={String(formData.sales_cost)}
                                                    className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                                                />
                                            </div>

                                            <div className="flex items-end">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (!newBatchRow.batch_number || !newBatchRow.expiry_date || newBatchRow.quantity <= 0) {
                                                            toast.error('Batch #, expiry date and quantity are required');
                                                            return;
                                                        }
                                                        setModalBatches(prev => [
                                                            ...prev,
                                                            {
                                                                ...newBatchRow,
                                                                purchase_cost: newBatchRow.purchase_cost || formData.purchase_cost,
                                                                selling_price: newBatchRow.selling_price || formData.sales_cost,
                                                                status: 'Active'
                                                            }
                                                        ]);
                                                        setNewBatchRow({
                                                            batch_number: generateBatchNumber(),
                                                            expiry_date: '',
                                                            manufacture_date: '',
                                                            quantity: 0,
                                                            purchase_cost: 0,
                                                            selling_price: 0,
                                                            purchase_invoice: ''
                                                        });
                                                        toast.success('Batch added to product');
                                                    }}
                                                    className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-xs transition shadow-sm"
                                                >
                                                    + Add Batch
                                                </button>
                                            </div>
                                        </div>

                                        {/* Quick Expiry Date Chips */}
                                        <div className="flex items-center gap-1.5 pt-1">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Quick Expiry:</span>
                                            {[
                                                { label: '+6 Months', m: 6 },
                                                { label: '+1 Year', m: 12 },
                                                { label: '+2 Years', m: 24 },
                                                { label: '+3 Years', m: 36 },
                                                { label: '+5 Years', m: 60 },
                                            ].map(chip => (
                                                <button
                                                    key={chip.label}
                                                    type="button"
                                                    onClick={() => setQuickExpiry(chip.m)}
                                                    className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600 hover:border-purple-300 hover:text-purple-600 text-[10px] font-bold transition"
                                                >
                                                    {chip.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Batches Table */}
                                    {modalBatches.length > 0 ? (
                                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 text-[10px] uppercase">
                                                        <th className="py-2.5 px-3 text-left">Batch Code</th>
                                                        <th className="py-2.5 px-3 text-center">Expiry Date</th>
                                                        <th className="py-2.5 px-3 text-center">Shelf Life</th>
                                                        <th className="py-2.5 px-3 text-right">Units</th>
                                                        <th className="py-2.5 px-3 text-right">Cost Price</th>
                                                        <th className="py-2.5 px-3 text-right">Selling Price</th>
                                                        <th className="py-2.5 px-3 text-center w-12">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {modalBatches.map((b, bi) => {
                                                        const d = getDaysUntilExpiry(b.expiry_date);
                                                        return (
                                                            <tr key={bi} className="hover:bg-slate-50">
                                                                <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                                                                    {b.batch_number}
                                                                </td>
                                                                <td className="py-2.5 px-3 text-center text-slate-600">
                                                                    {b.expiry_date}
                                                                </td>
                                                                <td className="py-2.5 px-3 text-center">
                                                                    {getExpiryBadge(d)}
                                                                </td>
                                                                <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                                                                    {b.quantity}
                                                                </td>
                                                                <td className="py-2.5 px-3 text-right text-slate-600">
                                                                    KES {(b.purchase_cost || formData.purchase_cost || 0).toLocaleString()}
                                                                </td>
                                                                <td className="py-2.5 px-3 text-right font-black text-slate-900">
                                                                    KES {(b.selling_price || formData.sales_cost || 0).toLocaleString()}
                                                                </td>
                                                                <td className="py-2.5 px-3 text-center">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setModalBatches(prev => prev.filter((_, i) => i !== bi))}
                                                                        className="p-1 text-slate-400 hover:text-red-600 transition"
                                                                        title="Remove batch"
                                                                    >
                                                                        <FiTrash2 size={13} />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="py-8 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
                                            <FiBox size={32} className="mx-auto mb-2 opacity-50" />
                                            <p className="text-xs font-bold text-slate-600">No batches allocated yet</p>
                                            <p className="text-[11px] text-slate-400 mt-0.5">
                                                You can add initial batches above or receive them later via the Batches module.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ─── TAB 5: POS DISPLAY & NOTES ─── */}
                            {modalTab === 'media' && (
                                <div className="space-y-4 animate-fadeIn">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">
                                                Product Photo URL
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.photo || ''}
                                                onChange={e => setFormData({ ...formData, photo: e.target.value })}
                                                placeholder="https://example.com/product-image.jpg"
                                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800"
                                            />
                                            {formData.photo && (
                                                <div className="mt-3 w-28 h-28 rounded-2xl border border-slate-200 overflow-hidden bg-white p-1">
                                                    <img
                                                        src={formData.photo}
                                                        alt="Preview"
                                                        className="w-full h-full object-contain"
                                                        onError={e => { (e.target as HTMLElement).style.display = 'none'; }}
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">
                                                POS Button Theme Gradient
                                            </label>
                                            <div className="grid grid-cols-2 gap-2">
                                                {COLOR_PRESETS.map(preset => (
                                                    <button
                                                        key={preset.name}
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, button_ui_color: preset.gradient })}
                                                        className={`p-2 rounded-xl border flex items-center gap-2 transition ${
                                                            formData.button_ui_color === preset.gradient
                                                                ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-400/20'
                                                                : 'border-slate-200 hover:border-slate-300'
                                                        }`}
                                                    >
                                                        <div className={`w-5 h-5 rounded-lg bg-gradient-to-br ${preset.gradient} shadow-sm`} />
                                                        <span className="text-xs font-bold text-slate-700">{preset.name}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">
                                            Clinical Description & Patient Advisory Notes
                                        </label>
                                        <textarea
                                            rows={4}
                                            value={formData.description || ''}
                                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                                            placeholder="Dosage administration advice, precautions, food interactions, and contraindications..."
                                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-none"
                                        />
                                    </div>
                                </div>
                            )}

                        </div>

                        {/* Modal Sticky Footer */}
                        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-4 text-xs font-bold text-slate-600">
                                <span>Profit/Pc: <b className="text-emerald-700 font-mono">KES {computedMetrics.profitPerPiece.toFixed(2)}</b></span>
                                <span className="text-slate-300">|</span>
                                <span>Margin: <b className="text-emerald-700 font-mono">{computedMetrics.marginPerPiece.toFixed(1)}%</b></span>
                                <span className="text-slate-300">|</span>
                                <span>Batches to save: <b className="text-purple-700">{modalBatches.length}</b></span>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-white transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveProduct}
                                    disabled={isSaving}
                                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-md shadow-emerald-500/20 transition flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isSaving ? (
                                        <>
                                            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>Saving Record...</span>
                                        </>
                                    ) : (
                                        <>
                                            <FiCheck size={14} strokeWidth={3} />
                                            <span>{editingProduct ? 'Save Changes' : 'Create Product'}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ━━━ LABEL GENERATOR MODAL ━━━ */}
            {showLabelModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 text-white flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <FiPrinter size={20} />
                                <div>
                                    <h3 className="font-bold text-base">Barcode & Price Label Generator</h3>
                                    <p className="text-xs text-purple-200">
                                        {labelProducts.length} selected &bull; {labelProducts.reduce((s, id) => s + (labelQty[id] || 1), 0)} total tags
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setShowLabelModal(false)} className="p-1 hover:bg-white/20 rounded-lg">
                                <FiX size={18} />
                            </button>
                        </div>

                        <div className="flex flex-1 overflow-hidden">
                            {/* Product List */}
                            <div className="flex-1 p-4 border-r border-slate-200 overflow-y-auto space-y-2">
                                <div className="relative mb-2">
                                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                    <input
                                        type="text"
                                        value={labelSearch}
                                        onChange={e => setLabelSearch(e.target.value)}
                                        placeholder="Search products for labels..."
                                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                                    />
                                </div>
                                {filteredLabelProducts.map(p => {
                                    const isSel = labelProducts.includes(p.pid);
                                    return (
                                        <div
                                            key={p.pid}
                                            onClick={() => {
                                                if (isSel) setLabelProducts(labelProducts.filter(id => id !== p.pid));
                                                else {
                                                    setLabelProducts([...labelProducts, p.pid]);
                                                    setLabelQty({ ...labelQty, [p.pid]: labelQty[p.pid] || 1 });
                                                }
                                            }}
                                            className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                                                isSel ? 'border-purple-300 bg-purple-50/60' : 'border-slate-100 hover:bg-slate-50'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <input type="checkbox" checked={isSel} readOnly className="accent-purple-600 rounded" />
                                                <div>
                                                    <p className="text-xs font-bold text-slate-800">{p.product_name}</p>
                                                    <p className="text-[10px] text-slate-400 font-mono">{p.product_code} • KES {(p.sales_cost || 0).toLocaleString()}</p>
                                                </div>
                                            </div>
                                            {isSel && (
                                                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                                    <button
                                                        onClick={() => setLabelQty({ ...labelQty, [p.pid]: Math.max(1, (labelQty[p.pid] || 1) - 1) })}
                                                        className="w-6 h-6 rounded bg-purple-200 text-purple-800 font-bold text-xs"
                                                    >
                                                        -
                                                    </button>
                                                    <span className="text-xs font-bold px-2">{labelQty[p.pid] || 1}</span>
                                                    <button
                                                        onClick={() => setLabelQty({ ...labelQty, [p.pid]: (labelQty[p.pid] || 1) + 1 })}
                                                        className="w-6 h-6 rounded bg-purple-200 text-purple-800 font-bold text-xs"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Label Controls & Print Button */}
                            <div className="w-80 p-4 bg-slate-50 flex flex-col justify-between overflow-hidden">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Label Tag Size</label>
                                        <div className="grid grid-cols-3 gap-1 bg-white p-1 rounded-xl border border-slate-200">
                                            {(['small', 'medium', 'large'] as const).map(sz => (
                                                <button
                                                    key={sz}
                                                    onClick={() => setLabelSize(sz)}
                                                    className={`py-1.5 text-xs font-bold rounded-lg capitalize transition ${
                                                        labelSize === sz ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    {sz}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1.5 text-xs">
                                        <div className="flex justify-between text-slate-500">
                                            <span>Dimensions:</span>
                                            <span className="font-bold text-slate-800">{labelSizes[labelSize].w} × {labelSizes[labelSize].h}</span>
                                        </div>
                                        <div className="flex justify-between text-slate-500">
                                            <span>Total Labels:</span>
                                            <span className="font-black text-purple-700">
                                                {labelProducts.reduce((s, id) => s + (labelQty[id] || 1), 0)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2 pt-4">
                                    <button
                                        onClick={printLabels}
                                        disabled={labelProducts.length === 0}
                                        className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition disabled:opacity-40"
                                    >
                                        Print Barcode Labels
                                    </button>
                                    <button
                                        onClick={() => setShowLabelModal(false)}
                                        className="w-full py-2 bg-white border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-50"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ━━━ FAST ITEM LOOKUP / SCANNER MODAL ━━━ */}
            {showLookupModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden">
                        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-4 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <FiEye size={20} />
                                <h3 className="font-bold text-base">Rapid Drug Lookup / Barcode Scan</h3>
                            </div>
                            <button onClick={() => setShowLookupModal(false)} className="p-1 hover:bg-white/20 rounded-lg">
                                <FiX size={18} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={lookupQuery}
                                    onChange={e => setLookupQuery(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && doLookup()}
                                    placeholder="Scan barcode or type drug name/code..."
                                    className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:border-cyan-500 outline-none"
                                    autoFocus
                                />
                                <button
                                    onClick={doLookup}
                                    className="px-5 py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-sm rounded-xl transition"
                                >
                                    Lookup
                                </button>
                            </div>

                            {lookupResult && (
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                                    <div>
                                        <span className="font-mono text-xs font-bold text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded">
                                            {lookupResult.product_code}
                                        </span>
                                        <h4 className="text-base font-black text-slate-800 mt-1">{lookupResult.product_name}</h4>
                                        <p className="text-xs text-slate-500 italic">{lookupResult.generic_name || 'No generic specification'}</p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                                            <span className="text-slate-400 text-[10px] uppercase font-bold">Sell Price</span>
                                            <p className="text-sm font-black text-slate-800 mt-0.5">KES {(lookupResult.sales_cost || 0).toLocaleString()}</p>
                                        </div>
                                        <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                                            <span className="text-slate-400 text-[10px] uppercase font-bold">Stock Available</span>
                                            <p className="text-sm font-black text-emerald-700 mt-0.5">{stockData[lookupResult.pid] || 0} {lookupResult.sales_unit || 'Pcs'}</p>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 pt-2">
                                        <button
                                            onClick={() => { setShowLookupModal(false); openEditModal(lookupResult); }}
                                            className="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700"
                                        >
                                            Edit Full Record
                                        </button>
                                        <button
                                            onClick={() => { setShowLookupModal(false); openStockAdjust(lookupResult); }}
                                            className="flex-1 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold hover:bg-purple-700"
                                        >
                                            Adjust Stock
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ━━━ STOCK HISTORY LEDGER MODAL ━━━ */}
            {showStockHistoryModal && stockHistoryProduct && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-white flex items-center justify-between flex-shrink-0">
                            <div>
                                <h3 className="font-bold text-base flex items-center gap-2">
                                    <FiClock size={16} /> Stock Movement Audit Ledger
                                </h3>
                                <p className="text-xs text-blue-200">
                                    {stockHistoryProduct.product_name} ({stockHistoryProduct.product_code})
                                </p>
                            </div>
                            <button onClick={() => setShowStockHistoryModal(false)} className="p-1 hover:bg-white/20 rounded-lg">
                                <FiX size={18} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            {stockHistory.length === 0 ? (
                                <p className="text-center text-slate-400 py-12 text-xs">No movement history recorded yet</p>
                            ) : (
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 text-[10px] uppercase">
                                            <th className="py-2.5 px-3 text-left">Date</th>
                                            <th className="py-2.5 px-3 text-left">Reference</th>
                                            <th className="py-2.5 px-3 text-left">Type</th>
                                            <th className="py-2.5 px-3 text-right text-emerald-600">Qty In</th>
                                            <th className="py-2.5 px-3 text-right text-red-600">Qty Out</th>
                                            <th className="py-2.5 px-3 text-right">Balance</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {stockHistory.map(r => (
                                            <tr key={r.id} className="hover:bg-slate-50">
                                                <td className="py-2.5 px-3 text-slate-600">{r.date}</td>
                                                <td className="py-2.5 px-3 font-mono font-bold text-blue-600">{r.ref}</td>
                                                <td className="py-2.5 px-3 text-slate-700">{r.type}</td>
                                                <td className="py-2.5 px-3 text-right font-black text-emerald-700">{r.qty_in > 0 ? `+${r.qty_in}` : '-'}</td>
                                                <td className="py-2.5 px-3 text-right font-black text-red-700">{r.qty_out > 0 ? `-${r.qty_out}` : '-'}</td>
                                                <td className="py-2.5 px-3 text-right font-black text-slate-900">{r.balance}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ━━━ PRICE HISTORY AUDIT MODAL ━━━ */}
            {showPriceHistoryModal && priceHistoryProduct && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden">
                        <div className="bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-4 text-white flex items-center justify-between flex-shrink-0">
                            <div>
                                <h3 className="font-bold text-base flex items-center gap-2">
                                    <FiTrendingUp size={16} /> Historical Price Change Audit
                                </h3>
                                <p className="text-xs text-amber-200">{priceHistoryProduct.product_name}</p>
                            </div>
                            <button onClick={() => setShowPriceHistoryModal(false)} className="p-1 hover:bg-white/20 rounded-lg">
                                <FiX size={18} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            {priceHistory.length === 0 ? (
                                <p className="text-center text-slate-400 py-12 text-xs">No price revisions logged yet</p>
                            ) : (
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 text-[10px] uppercase">
                                            <th className="py-2.5 px-3 text-left">Timestamp</th>
                                            <th className="py-2.5 px-3 text-right">Old Buy</th>
                                            <th className="py-2.5 px-3 text-right text-blue-600">New Buy</th>
                                            <th className="py-2.5 px-3 text-right">Old Sell</th>
                                            <th className="py-2.5 px-3 text-right text-emerald-600">New Sell</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {priceHistory.map(r => (
                                            <tr key={r.id} className="hover:bg-slate-50">
                                                <td className="py-2.5 px-3 text-slate-600">{r.date}</td>
                                                <td className="py-2.5 px-3 text-right text-slate-400 line-through">KES {r.old_buy.toLocaleString()}</td>
                                                <td className="py-2.5 px-3 text-right font-bold text-blue-600">KES {r.new_buy.toLocaleString()}</td>
                                                <td className="py-2.5 px-3 text-right text-slate-400 line-through">KES {r.old_sell.toLocaleString()}</td>
                                                <td className="py-2.5 px-3 text-right font-black text-emerald-700">KES {r.new_sell.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ━━━ STOCK ADJUSTMENT MODAL ━━━ */}
            {showStockAdjustModal && adjustProduct && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 text-white flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-base flex items-center gap-2">
                                    <FiSliders size={16} /> Physical Stock Reconciliation
                                </h3>
                                <p className="text-xs text-purple-200">{adjustProduct.product_name}</p>
                            </div>
                            <button onClick={() => setShowStockAdjustModal(false)} className="p-1 hover:bg-white/20 rounded-lg">
                                <FiX size={18} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setAdjustType('add')}
                                    className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition ${
                                        adjustType === 'add' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600'
                                    }`}
                                >
                                    + Add Stock
                                </button>
                                <button
                                    onClick={() => setAdjustType('remove')}
                                    className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition ${
                                        adjustType === 'remove' ? 'bg-red-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600'
                                    }`}
                                >
                                    - Deduct Stock
                                </button>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">
                                    Quantity in {adjustProduct.sales_unit || 'Pieces'}
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    value={adjustPieces || ''}
                                    onChange={e => setAdjustPieces(parseInt(e.target.value) || 0)}
                                    placeholder="Enter units count"
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-center"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">
                                    Audit Reason / Memo
                                </label>
                                <input
                                    type="text"
                                    value={adjustReason}
                                    onChange={e => setAdjustReason(e.target.value)}
                                    placeholder="e.g. Physical count discrepancy, damaged blister pack"
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                                />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={() => setShowStockAdjustModal(false)}
                                    className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={submitStockAdjust}
                                    className={`flex-1 py-2.5 text-white rounded-xl text-xs font-bold shadow-sm ${
                                        adjustType === 'add' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                                    }`}
                                >
                                    Confirm Adjustment
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ━━━ CSV IMPORT MODAL ━━━ */}
            {showImportModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <FiUpload size={18} />
                                <h3 className="font-bold text-base">Bulk Pharmaceutical CSV Import</h3>
                            </div>
                            <button onClick={() => setShowImportModal(false)} className="p-1 hover:bg-white/20 rounded-lg">
                                <FiX size={18} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {importStatus === 'success' ? (
                                <div className="text-center py-6">
                                    <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                                        <FiCheck size={32} />
                                    </div>
                                    <h4 className="text-lg font-black text-slate-800">{importSuccessCount} Products Imported!</h4>
                                    <p className="text-xs text-slate-500 mt-1">Catalog updated successfully.</p>
                                    <button
                                        onClick={() => setShowImportModal(false)}
                                        className="mt-5 px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700"
                                    >
                                        Close
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Select CSV File</label>
                                        <input
                                            type="file"
                                            accept=".csv"
                                            onChange={e => { if (e.target.files?.[0]) setImportFile(e.target.files[0]); }}
                                            className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Import Mode</label>
                                        <div className="space-y-1.5 text-xs">
                                            {[
                                                { id: 'add_new', label: 'Add New Products Only', desc: 'Skips items with duplicate names' },
                                                { id: 'update', label: 'Update & Append', desc: 'Updates matching items, adds new ones' },
                                            ].map(m => (
                                                <label key={m.id} className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="importMode"
                                                        value={m.id}
                                                        checked={importMode === m.id}
                                                        onChange={() => setImportMode(m.id as any)}
                                                        className="accent-blue-600"
                                                    />
                                                    <div>
                                                        <span className="font-bold text-slate-800">{m.label}</span>
                                                        <span className="text-slate-400 block text-[10px]">{m.desc}</span>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {importStatus === 'importing' && (
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-xs text-slate-500">
                                                <span>Importing: {importCurrentItem}</span>
                                                <span>{importProgress} of {importTotal}</span>
                                            </div>
                                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                                <div
                                                    className="bg-blue-600 h-2 transition-all duration-200"
                                                    style={{ width: `${importTotal > 0 ? (importProgress / importTotal) * 100 : 0}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex gap-2 pt-2">
                                        <button
                                            onClick={() => setShowImportModal(false)}
                                            className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={importProducts}
                                            disabled={!importFile || importStatus === 'importing'}
                                            className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 disabled:opacity-40"
                                        >
                                            {importStatus === 'importing' ? 'Importing...' : 'Start Import'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
