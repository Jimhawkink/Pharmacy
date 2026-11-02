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
    FiMaximize2, FiMinimize2, FiMinus, FiInfo, FiCopy, FiCheckCircle,
    FiCheckSquare, FiSquare, FiActivity, FiChevronDown, FiChevronUp
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

// Interface for Parsed Import Row
interface ImportRow {
    _id: number;
    selected: boolean;
    valid: boolean;
    errors: string[];
    product_name: string;
    generic_name?: string;
    barcode?: string;
    category?: string;
    drug_type?: string;
    dosage?: string;
    purchase_unit?: string;
    sales_unit?: string;
    pieces_per_package?: number;
    purchase_cost: number;
    sales_cost: number;
    wholesale_price?: number;
    reorder_point?: number;
    quantity: number;
    batch_number?: string;
    expiry_date?: string;
    manufacture_date?: string;
    supplier_name?: string;
    storage_conditions?: string;
    shelf_location?: string;
    requires_prescription?: boolean;
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
    { name: 'Electric Sky', gradient: 'from-sky-500 to-blue-600', hex: '#0284C7' },
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
        return <span className="px-2 py-0.5 bg-red-100/90 text-red-700 border border-red-200 rounded-full text-[10px] font-black shadow-xs">EXPIRED</span>;
    }
    if (days <= 30) {
        return <span className="px-2 py-0.5 bg-orange-100/90 text-orange-700 border border-orange-200 rounded-full text-[10px] font-black shadow-xs">{days}d ⚠️</span>;
    }
    if (days <= 90) {
        return <span className="px-2 py-0.5 bg-amber-100/90 text-amber-700 border border-amber-200 rounded-full text-[10px] font-bold shadow-xs">{days}d</span>;
    }
    return <span className="px-2 py-0.5 bg-sky-100/90 text-sky-700 border border-sky-200 rounded-full text-[10px] font-bold shadow-xs">{days}d ✓</span>;
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
    button_ui_color: 'from-blue-600 to-indigo-600',
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

    // Layout & View Options
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const [autoFitScreen, setAutoFitScreen] = useState(true);
    const [showAnalyticsCards, setShowAnalyticsCards] = useState(true); // Toggle to collapse cards and bring table right to top!
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(25);
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

    // Selection & Bulk
    const [selectedPids, setSelectedPids] = useState<Set<number>>(new Set());

    // ─── ADD/EDIT PRODUCT MODAL STATE ───
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

    // ─── SUPER MASSIVE ULTRA IMPORT STATE ───
    const [showImportModal, setShowImportModal] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importMode, setImportMode] = useState<'add_new' | 'update' | 'overwrite_all'>('add_new');
    const [importQtyHandling, setImportQtyHandling] = useState<'with_qty' | 'zero_qty'>('with_qty');
    const [importBatchesOption, setImportBatchesOption] = useState<'import_batches' | 'no_batches'>('import_batches');
    const [importParsedRows, setImportParsedRows] = useState<ImportRow[]>([]);
    const [importSearch, setImportSearch] = useState('');
    const [confirmOverwrite, setConfirmOverwrite] = useState(false);
    const [importProgress, setImportProgress] = useState(0);
    const [importTotal, setImportTotal] = useState(0);
    const [importCurrentItem, setImportCurrentItem] = useState('');
    const [importStatus, setImportStatus] = useState<'idle' | 'parsing' | 'parsed' | 'importing' | 'success' | 'error'>('idle');
    const [importSuccessCount, setImportSuccessCount] = useState(0);
    const [importUpdatedCount, setImportUpdatedCount] = useState(0);
    const [importBatchCount, setImportBatchCount] = useState(0);
    const [importSkippedCount, setImportSkippedCount] = useState(0);
    const [importErrors, setImportErrors] = useState<{ row: number; item: string; error: string }[]>([]);

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
            button_ui_color: p.button_ui_color || 'from-blue-600 to-indigo-600',
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
                button_ui_color: formData.button_ui_color || 'from-blue-600 to-indigo-600',
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

    // ─── SUPER MASSIVE ULTRA CSV/FILE PARSER ───
    const parseCSVFile = async (file: File) => {
        setImportFile(file);
        setImportStatus('parsing');
        try {
            const text = await file.text();
            const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
            if (lines.length < 2) {
                toast.error('CSV file has no data rows');
                setImportStatus('error');
                return;
            }

            const headers = lines[0]
                .split(',')
                .map(h => h.trim().replace(/^"(.*)"$/, '$1').toLowerCase().replace(/\s+/g, '_'));

            const parsedRows: ImportRow[] = [];

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i];
                const vals: string[] = [];
                let current = '';
                let inQuotes = false;
                for (const ch of line) {
                    if (ch === '"') inQuotes = !inQuotes;
                    else if (ch === ',' && !inQuotes) { vals.push(current.trim()); current = ''; }
                    else current += ch;
                }
                vals.push(current.trim());

                const r: Record<string, string> = {};
                headers.forEach((h, idx) => {
                    r[h] = (vals[idx] || '').replace(/^"(.*)"$/, '$1');
                });

                const name = r.product_name || r.name || r.item_name || r.item || '';
                const errors: string[] = [];
                if (!name) errors.push('Missing drug name');

                const buyCost = parseFloat(r.purchase_cost || r.buy_price || r.cost || '0') || 0;
                const sellCost = parseFloat(r.sales_cost || r.sell_price || r.price || '0') || 0;
                if (sellCost < buyCost && sellCost > 0) errors.push('Sell price below cost');

                parsedRows.push({
                    _id: i,
                    selected: errors.length === 0, // Auto-select valid rows by default
                    valid: errors.length === 0,
                    errors,
                    product_name: name,
                    generic_name: r.generic_name || r.generic || r.inn || undefined,
                    barcode: r.barcode || r.bar_code || r.upc || undefined,
                    category: r.category || r.group || 'General',
                    drug_type: r.drug_type || r.form || 'Tablet',
                    dosage: r.dosage || r.strength || undefined,
                    purchase_unit: r.purchase_unit || r.buy_unit || 'Box',
                    sales_unit: r.sales_unit || r.sell_unit || 'Piece',
                    pieces_per_package: parseInt(r.pieces_per_package || r.pcs_per_pack || '1') || 1,
                    purchase_cost: buyCost,
                    sales_cost: sellCost,
                    wholesale_price: parseFloat(r.wholesale_price || r.wholesale || '0') || 0,
                    reorder_point: parseInt(r.reorder_point || r.min_stock || '10') || 10,
                    quantity: parseFloat(r.quantity || r.stock || r.qty || '0') || 0,
                    batch_number: r.batch_number || r.batch_no || r.batch || undefined,
                    expiry_date: r.expiry_date || r.expiry || r.exp || undefined,
                    manufacture_date: r.manufacture_date || r.mfg_date || undefined,
                    supplier_name: r.supplier_name || r.supplier || undefined,
                    storage_conditions: r.storage_conditions || r.storage || undefined,
                    shelf_location: r.shelf_location || r.shelf || undefined,
                    requires_prescription: (r.requires_prescription || r.prescription || r.rx || 'false').toLowerCase() === 'true'
                });
            }

            setImportParsedRows(parsedRows);
            setImportTotal(parsedRows.length);
            setImportStatus('parsed');
            toast.success(`Parsed ${parsedRows.length} items from CSV`);
        } catch (err: unknown) {
            setImportStatus('error');
            toast.error(err instanceof Error ? err.message : 'Failed to parse file');
        }
    };

    // ─── EXECUTE SUPER MASSIVE IMPORT ───
    const executeImport = async (targetRows: ImportRow[]) => {
        if (targetRows.length === 0) {
            toast.error('No rows selected for import');
            return;
        }

        if (importMode === 'overwrite_all' && !confirmOverwrite) {
            toast.error('Please confirm overwrite before proceeding with wiping catalog');
            return;
        }

        setImportStatus('importing');
        setImportProgress(0);
        setImportTotal(targetRows.length);
        setImportSuccessCount(0);
        setImportUpdatedCount(0);
        setImportBatchCount(0);
        setImportSkippedCount(0);
        setImportErrors([]);

        let success = 0;
        let updated = 0;
        let batchCreated = 0;
        let skipped = 0;
        const errLog: { row: number; item: string; error: string }[] = [];

        try {
            // Overwrite all handling
            if (importMode === 'overwrite_all') {
                setImportCurrentItem('Clearing current outlet catalog and inventory...');
                await supabase.from('pharmacy_stock').delete().eq('outlet_id', outletId);
                await supabase.from('pharmacy_batches').delete().eq('outlet_id', outletId);
                await supabase.from('pharmacy_products').delete().eq('outlet_id', outletId);
            }

            for (let i = 0; i < targetRows.length; i++) {
                const r = targetRows[i];
                setImportCurrentItem(r.product_name);
                setImportProgress(i + 1);

                if (!r.product_name.trim()) {
                    skipped++;
                    errLog.push({ row: r._id, item: 'Unnamed', error: 'Missing product name' });
                    continue;
                }

                const ppp = r.pieces_per_package || 1;
                const costPerPiece = r.purchase_cost > 0 ? r.purchase_cost / ppp : 0;
                const margin = r.sales_cost > 0
                    ? Math.round(((r.sales_cost - costPerPiece) / r.sales_cost) * 10000) / 100
                    : 0;

                const payload = {
                    product_name: r.product_name.trim(),
                    generic_name: r.generic_name?.trim() || null,
                    barcode: r.barcode?.trim() || null,
                    category: r.category || 'General',
                    drug_type: r.drug_type || 'Tablet',
                    dosage: r.dosage?.trim() || null,
                    purchase_unit: r.purchase_unit || 'Box',
                    sales_unit: r.sales_unit || 'Piece',
                    pieces_per_package: ppp,
                    purchase_cost: r.purchase_cost || 0,
                    sales_cost: r.sales_cost || 0,
                    wholesale_price: r.wholesale_price || 0,
                    reorder_point: r.reorder_point || 10,
                    vat_commodity: 'Standard (16%)',
                    supplier_name: r.supplier_name || null,
                    shelf_location: r.shelf_location || null,
                    storage_conditions: r.storage_conditions || 'Room Temperature (15°C – 25°C)',
                    requires_prescription: !!r.requires_prescription,
                    active: true,
                    margin_per: margin,
                    outlet_id: outletId
                };

                try {
                    let targetPid: number | null = null;
                    const existing = products.find(
                        ep =>
                            ep.product_name.toLowerCase() === r.product_name.toLowerCase() ||
                            (r.barcode && ep.barcode === r.barcode)
                    );

                    if (importMode === 'update' && existing) {
                        await supabase
                            .from('pharmacy_products')
                            .update({ ...payload, updated_at: new Date().toISOString() })
                            .eq('pid', existing.pid);
                        targetPid = existing.pid;
                        updated++;
                    } else if (importMode === 'add_new' && existing) {
                        skipped++;
                        continue;
                    } else {
                        const code = `DRG-${String(products.length + i + 1).padStart(4, '0')}`;
                        const { data: newP, error } = await supabase
                            .from('pharmacy_products')
                            .insert({ ...payload, product_code: code, created_at: new Date().toISOString() })
                            .select()
                            .single();
                        if (error) throw error;
                        targetPid = newP.pid;
                        success++;
                    }

                    // Stock Quantity & Batches Handling
                    if (targetPid) {
                        const finalQty = importQtyHandling === 'zero_qty' ? 0 : Math.max(0, r.quantity || 0);

                        if (importBatchesOption === 'import_batches' && (r.batch_number || r.expiry_date || finalQty > 0)) {
                            const bNum = r.batch_number || generateBatchNumber();
                            const expDate = r.expiry_date || new Date(Date.now() + 365 * 24 * 3600000 * 2).toISOString().split('T')[0];

                            const { data: savedBatch } = await supabase
                                .from('pharmacy_batches')
                                .insert({
                                    product_id: targetPid,
                                    batch_number: bNum,
                                    expiry_date: expDate,
                                    manufacture_date: r.manufacture_date || null,
                                    quantity: finalQty,
                                    remaining_qty: finalQty,
                                    purchase_cost: r.purchase_cost,
                                    selling_price: r.sales_cost,
                                    supplier_name: r.supplier_name || null,
                                    purchase_invoice: 'CSV-IMPORT',
                                    outlet_id: outletId,
                                    status: 'Active'
                                })
                                .select()
                                .single();

                            if (savedBatch) {
                                batchCreated++;
                                if (finalQty > 0) {
                                    await supabase.from('pharmacy_stock').insert({
                                        pid: targetPid,
                                        batch_id: savedBatch.batch_id,
                                        invoice_no: 'CSV-IMPORT',
                                        qty: finalQty,
                                        storage_type: 'Pieces',
                                        expiry_date: expDate,
                                        outlet_id: outletId
                                    });
                                }
                            }
                        } else {
                            if (finalQty > 0) {
                                await supabase.from('pharmacy_stock').insert({
                                    pid: targetPid,
                                    invoice_no: 'CSV-IMPORT',
                                    qty: finalQty,
                                    storage_type: 'Pieces',
                                    outlet_id: outletId
                                });
                            }
                        }
                    }
                } catch (rowErr: unknown) {
                    errLog.push({
                        row: r._id,
                        item: r.product_name,
                        error: rowErr instanceof Error ? rowErr.message : 'DB error'
                    });
                }
            }

            setImportSuccessCount(success);
            setImportUpdatedCount(updated);
            setImportBatchCount(batchCreated);
            setImportSkippedCount(skipped);
            setImportErrors(errLog);
            setImportStatus('success');

            toast.success(`Import complete! ${success} added, ${updated} updated, ${batchCreated} batches`);
            loadProducts();
            loadStockData();
        } catch (err: unknown) {
            setImportStatus('error');
            toast.error(err instanceof Error ? err.message : 'Import failed');
        }
    };

    // Download Sample Detailed Pharmacy Template
    const downloadPharmacyCSVTemplate = () => {
        const sampleCSV = `product_name,generic_name,barcode,category,drug_type,dosage,purchase_unit,sales_unit,pieces_per_package,purchase_cost,sales_cost,wholesale_price,reorder_point,quantity,batch_number,expiry_date,supplier_name,storage_conditions,requires_prescription
"Augmentin 625mg","Amoxicillin + Clavulanic Acid","616110123001","Antibiotics","Tablet","625mg","Box","Tablet",14,850,1400,1200,20,100,"AUG-2401","2026-11-30","GlaxoSmithKline","Room Temperature (15°C – 25°C)",true
"Panadol Extra 500mg","Paracetamol + Caffeine","616110123002","Analgesics & Pain","Tablet","500mg","Box","Tablet",100,600,1000,900,50,500,"PAN-2405","2027-06-30","Haleon Kenya","Room Temperature (15°C – 25°C)",false
"Amoxil 500mg","Amoxicillin Trihydrate","616110123003","Antibiotics","Capsule","500mg","Pack","Capsule",20,320,600,500,25,200,"AMX-2409","2026-08-31","Dawa Pharmaceuticals","Room Temperature (15°C – 25°C)",true
"Ventolin Inhaler 100mcg","Salbutamol Sulfate","616110123004","Respiratory","Inhaler","100mcg","Piece","Piece",1,450,750,650,15,50,"VEN-2412","2027-02-28","GlaxoSmithKline","Cool Place (8°C – 15°C)",true
"Cetirizine 10mg","Cetirizine Dihydrochloride","616110123005","Antihistamines","Tablet","10mg","Box","Tablet",30,180,350,300,30,150,"CET-2403","2026-12-31","Cosmos Ltd","Room Temperature (15°C – 25°C)",false
"Metformin 500mg","Metformin HCl","616110123006","Diabetes Care","Tablet","500mg","Box","Tablet",100,500,900,800,40,300,"MET-2408","2027-04-30","Beta Healthcare","Room Temperature (15°C – 25°C)",true
"Cough Syrup Adult 100ml","Guaifenesin + Menthol","616110123007","Cough & Cold","Syrup","100ml","Bottle","Bottle",1,220,400,350,20,80,"CSY-2410","2026-09-30","Regal Pharmaceuticals","Room Temperature (15°C – 25°C)",false
"Insulin Mixtard 100IU/ml","Human Insulin","616110123008","Diabetes Care","Injection","100IU/ml","Vial","Vial",1,1200,1850,1650,10,30,"INS-2411","2026-05-31","Novo Nordisk","Refrigerate (2°C – 8°C)",true`;

        const blob = new Blob([sampleCSV], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'alpha_pharmacy_master_import_template.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Downloaded master pharmacy template CSV');
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
   <Interior ss:Color="#2563EB" ss:Pattern="Solid"/>
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
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#2563EB"/>
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
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#0369A1"/>
   <Interior ss:Color="#E0F2FE" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BAE6FD"/></Borders>
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
        let expiringIn90Days = 0;

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

            const pB = productBatches[p.pid] || [];
            if (pB.some(b => getDaysUntilExpiry(b.expiry_date) <= 90)) {
                expiringIn90Days++;
            }
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
            outOfStockCount,
            expiringIn90Days
        };
    }, [products, stockData, productBatches]);

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

    // Filtered Parsed Import Rows (inside Import Modal)
    const filteredImportRows = useMemo(() => {
        if (!importSearch.trim()) return importParsedRows;
        const q = importSearch.toLowerCase().trim();
        return importParsedRows.filter(
            r =>
                r.product_name.toLowerCase().includes(q) ||
                (r.generic_name && r.generic_name.toLowerCase().includes(q)) ||
                (r.barcode && r.barcode.includes(q)) ||
                (r.batch_number && r.batch_number.toLowerCase().includes(q))
        );
    }, [importParsedRows, importSearch]);

    const selectedImportCount = useMemo(() => {
        return importParsedRows.filter(r => r.selected).length;
    }, [importParsedRows]);

    return (
        <div className={`space-y-4 ${autoFitScreen ? 'max-w-full' : 'max-w-[1700px]'} mx-auto`} style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>

            {/* ━━━ COMPACT SLEEK TOP BAR (LOW HEIGHT, MAX VISIBILITY) ━━━ */}
            <div className="glass-card px-4 py-2.5 shadow-sm border border-white/80 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-sm flex-shrink-0">
                        <FiPackage size={16} />
                    </div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-base sm:text-lg font-black text-slate-800 tracking-tight">Products Formulary</h1>
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-black">
                            {products.length} Drugs
                        </span>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <button
                        onClick={() => { loadProducts(); loadStockData(); toast.success('Formulary refreshed'); }}
                        className="p-1.5 rounded-lg bg-white/90 border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 transition shadow-2xs"
                        title="Refresh Catalog"
                    >
                        <FiRefreshCw size={13} />
                    </button>

                    <button
                        onClick={() => setShowAnalyticsCards(!showAnalyticsCards)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition shadow-2xs ${
                            showAnalyticsCards
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                : 'bg-white/90 border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                        title="Toggle Metric Cards"
                    >
                        <FiActivity size={12} className="text-indigo-600" />
                        <span>{showAnalyticsCards ? 'Hide Cards' : 'Show Cards'}</span>
                        {showAnalyticsCards ? <FiChevronUp size={11} /> : <FiChevronDown size={11} />}
                    </button>

                    <button
                        onClick={() => setAutoFitScreen(!autoFitScreen)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition shadow-2xs ${
                            autoFitScreen
                                ? 'bg-blue-50 border-blue-300 text-blue-700'
                                : 'bg-white/90 border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                        title="Toggle Screen Fit"
                    >
                        {autoFitScreen ? <FiMinimize2 size={12} /> : <FiMaximize2 size={12} />}
                        <span>{autoFitScreen ? 'Auto-Fit' : 'Wide'}</span>
                    </button>

                    <button
                        onClick={() => {
                            setShowLabelModal(true);
                            setLabelProducts(paginatedProducts.slice(0, 10).map(p => p.pid));
                            const qMap: Record<number, number> = {};
                            paginatedProducts.slice(0, 10).forEach(p => qMap[p.pid] = 1);
                            setLabelQty(qMap);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100 transition text-xs font-bold shadow-2xs"
                        title="Print Barcode Labels"
                    >
                        <FiPrinter size={13} />
                        <span>Labels</span>
                    </button>

                    <button
                        onClick={() => { setShowLookupModal(true); setLookupQuery(''); setLookupResult(null); }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-50 border border-sky-200 text-sky-700 hover:bg-sky-100 transition text-xs font-bold shadow-2xs"
                        title="Scan Barcode / Fast Lookup"
                    >
                        <FiEye size={13} />
                        <span>Scan / Lookup</span>
                    </button>

                    <button
                        onClick={() => {
                            setShowImportModal(true);
                            setImportFile(null);
                            setImportParsedRows([]);
                            setImportStatus('idle');
                            setImportErrors([]);
                            setConfirmOverwrite(false);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition text-xs font-bold shadow-2xs"
                        title="Advanced Import"
                    >
                        <FiUpload size={13} />
                        <span>Import</span>
                    </button>

                    <button
                        onClick={exportBrightExcel}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 font-bold text-xs shadow-2xs transition"
                        title="Download Vivid Color Excel Spreadsheet"
                    >
                        <FiDownload size={13} />
                        <span>Excel</span>
                    </button>

                    <button
                        onClick={printCatalogReport}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs shadow-2xs transition"
                        title="Print Catalog PDF"
                    >
                        <FiPrinter size={13} />
                        <span>PDF</span>
                    </button>

                    <button
                        onClick={openAddModal}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs shadow-md shadow-blue-500/20 transition transform hover:-translate-y-0.5 active:translate-y-0"
                    >
                        <FiPlus size={14} strokeWidth={2.5} />
                        <span>+ Add Drug</span>
                    </button>
                </div>
            </div>

            {/* ━━━ HIGH-VISIBILITY BRIGHT QUICK ACTIONS TOOLBAR ━━━ */}
            <div className="glass-card px-3.5 py-2 border border-white/80 shadow-xs flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1">Quick Actions:</span>
                    <button
                        onClick={openAddModal}
                        className="px-2.5 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-xs font-bold shadow-xs transition flex items-center gap-1"
                    >
                        <FiPlus size={12} /> New Drug
                    </button>
                    <button
                        onClick={() => { setShowLookupModal(true); setLookupQuery(''); setLookupResult(null); }}
                        className="px-2.5 py-1 rounded-lg bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 text-xs font-bold transition flex items-center gap-1"
                    >
                        <FiEye size={12} /> Barcode Scanner
                    </button>
                    <button
                        onClick={() => {
                            if (paginatedProducts.length > 0) openStockAdjust(paginatedProducts[0]);
                            else toast('No products available to adjust');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 text-xs font-bold transition flex items-center gap-1"
                    >
                        <FiSliders size={12} /> Fast Adjust
                    </button>
                    <button
                        onClick={() => {
                            if (paginatedProducts.length > 0) openStockHistory(paginatedProducts[0]);
                            else toast('No products available');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 text-xs font-bold transition flex items-center gap-1"
                    >
                        <FiClock size={12} /> Stock Ledger
                    </button>
                    <button
                        onClick={() => {
                            if (paginatedProducts.length > 0) openPriceHistory(paginatedProducts[0]);
                            else toast('No products available');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 text-xs font-bold transition flex items-center gap-1"
                    >
                        <FiTrendingUp size={12} /> Price History
                    </button>
                    <button
                        onClick={() => {
                            setShowLabelModal(true);
                            setLabelProducts(paginatedProducts.slice(0, 8).map(p => p.pid));
                            const qMap: Record<number, number> = {};
                            paginatedProducts.slice(0, 8).forEach(p => qMap[p.pid] = 1);
                            setLabelQty(qMap);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 text-xs font-bold transition flex items-center gap-1"
                    >
                        <FiPrinter size={12} /> Barcode Labels
                    </button>
                    <button
                        onClick={() => setShowImportModal(true)}
                        className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 text-xs font-bold transition flex items-center gap-1"
                    >
                        <FiUpload size={12} /> Bulk Import
                    </button>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                    <button
                        onClick={exportBrightExcel}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-bold transition flex items-center gap-1"
                    >
                        <FiDownload size={12} /> Excel
                    </button>
                    <button
                        onClick={printCatalogReport}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 text-white hover:bg-slate-900 font-bold transition flex items-center gap-1"
                    >
                        <FiPrinter size={12} /> Print
                    </button>
                </div>
            </div>

            {/* ━━━ GLASSMORPHIC KPI SUMMARY CARDS DECK (COLLAPSIBLE TO BRING TABLE TO TOP) ━━━ */}
            {showAnalyticsCards && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 animate-fadeIn">
                    {/* Card 1: Total Catalog */}
                    <div className="glass-card p-3.5 border border-white/80 shadow-md shadow-slate-200/30 hover:shadow-xl hover:-translate-y-0.5 transition-all relative overflow-hidden group">
                        <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-gradient-to-br from-blue-400/20 to-cyan-400/10 blur-xl group-hover:scale-150 transition-transform" />
                        <div className="relative flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-blue-600">Total Formulary</span>
                            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-xs">
                                <FiPackage size={16} />
                            </div>
                        </div>
                        <p className="text-2xl font-black text-slate-800 mt-1.5 tracking-tight">{kpiData.totalProducts}</p>
                        <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500 font-semibold">
                            <span>Active: <b className="text-blue-600">{kpiData.activeSkus}</b></span>
                            <span>Disabled: <b className="text-slate-400">{kpiData.totalProducts - kpiData.activeSkus}</b></span>
                        </div>
                    </div>

                    {/* Card 2: Units in Stock */}
                    <div className="glass-card p-3.5 border border-white/80 shadow-md shadow-slate-200/30 hover:shadow-xl hover:-translate-y-0.5 transition-all relative overflow-hidden group">
                        <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-gradient-to-br from-cyan-400/20 to-blue-400/10 blur-xl group-hover:scale-150 transition-transform" />
                        <div className="relative flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-cyan-600">Stock on Shelf</span>
                            <div className="w-8 h-8 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center shadow-xs">
                                <FiBox size={16} />
                            </div>
                        </div>
                        <p className="text-2xl font-black text-slate-800 mt-1.5 tracking-tight">{kpiData.totalUnits.toLocaleString()}</p>
                        <p className="text-[11px] text-slate-500 mt-1 font-medium">Dispensing units in store</p>
                    </div>

                    {/* Card 3: Stock Value (Cost) */}
                    <div className="glass-card p-3.5 border border-white/80 shadow-md shadow-slate-200/30 hover:shadow-xl hover:-translate-y-0.5 transition-all relative overflow-hidden group">
                        <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-gradient-to-br from-indigo-400/20 to-purple-400/10 blur-xl group-hover:scale-150 transition-transform" />
                        <div className="relative flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600">Outlay (Buy Cost)</span>
                            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-xs">
                                <FiDollarSign size={16} />
                            </div>
                        </div>
                        <p className="text-2xl font-black text-slate-800 mt-1.5 tracking-tight">
                            KES {Math.round(kpiData.totalValCost).toLocaleString()}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1 font-medium">Inventory purchase outlay</p>
                    </div>

                    {/* Card 4: Retail Sales Value */}
                    <div className="glass-card p-3.5 border border-white/80 shadow-md shadow-slate-200/30 hover:shadow-xl hover:-translate-y-0.5 transition-all relative overflow-hidden group">
                        <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-gradient-to-br from-violet-400/20 to-purple-400/10 blur-xl group-hover:scale-150 transition-transform" />
                        <div className="relative flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-violet-600">Retail Worth</span>
                            <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shadow-xs">
                                <FiTrendingUp size={16} />
                            </div>
                        </div>
                        <p className="text-2xl font-black text-violet-800 mt-1.5 tracking-tight">
                            KES {Math.round(kpiData.totalValSales).toLocaleString()}
                        </p>
                        <p className="text-[11px] text-violet-700 mt-1 font-bold">
                            Avg Margin: {kpiData.portfolioMargin.toFixed(1)}%
                        </p>
                    </div>

                    {/* Card 5: Potential Gross Profit */}
                    <div className="glass-card p-3.5 border border-white/80 shadow-md shadow-slate-200/30 hover:shadow-xl hover:-translate-y-0.5 transition-all relative overflow-hidden group">
                        <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-gradient-to-br from-purple-400/20 to-pink-400/10 blur-xl group-hover:scale-150 transition-transform" />
                        <div className="relative flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-purple-600">Potential Profit</span>
                            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shadow-xs">
                                <FiZap size={16} />
                            </div>
                        </div>
                        <p className="text-2xl font-black text-purple-800 mt-1.5 tracking-tight">
                            KES {Math.round(kpiData.potentialProfit).toLocaleString()}
                        </p>
                        <p className="text-[11px] text-purple-700 mt-1 font-medium">Projected net earnings</p>
                    </div>

                    {/* Card 6: Restock & Nil Alerts */}
                    <div className={`glass-card p-3.5 border shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all relative overflow-hidden group ${
                        kpiData.lowStockCount > 0 || kpiData.outOfStockCount > 0 ? 'border-amber-300' : 'border-white/80'
                    }`}>
                        <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-gradient-to-br from-amber-400/20 to-rose-400/10 blur-xl group-hover:scale-150 transition-transform" />
                        <div className="relative flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-600">Restock Urgency</span>
                            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-xs">
                                <FiAlertTriangle size={16} />
                            </div>
                        </div>
                        <div className="flex items-baseline gap-1.5 mt-1.5">
                            <p className="text-2xl font-black text-amber-700">{kpiData.lowStockCount}</p>
                            <span className="text-[11px] text-amber-600 font-bold">low</span>
                            <span className="text-xs text-slate-300">/</span>
                            <p className="text-2xl font-black text-red-600">{kpiData.outOfStockCount}</p>
                            <span className="text-[11px] text-red-600 font-bold">nil</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 font-medium">Items need purchase orders</p>
                    </div>
                </div>
            )}

            {/* ━━━ EXPANSIVE PROMINENT OMNI-SEARCH & FILTER BAR ━━━ */}
            <div className="glass-card p-4 shadow-md shadow-slate-200/30 border border-white/80 space-y-3">
                {/* 1. Generous, Prominent, Wide Search Bar */}
                <div className="relative w-full">
                    <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-600" size={20} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                        placeholder="Search products by brand name, generic (INN), DRG code, barcode, or manufacturer..."
                        className="w-full pl-12 pr-12 py-3.5 bg-white/95 backdrop-blur-md border border-slate-200 hover:border-blue-400 focus:border-blue-500 rounded-2xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/15 shadow-sm transition"
                        autoComplete="off"
                    />
                    {searchQuery ? (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition"
                            title="Clear search"
                        >
                            <FiX size={16} />
                        </button>
                    ) : (
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 hidden sm:inline">
                            Instant Filter
                        </span>
                    )}
                </div>

                {/* 2. Secondary Dropdown Filters + View Mode Controls */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Category */}
                        <select
                            value={filterCategory}
                            onChange={e => { setFilterCategory(e.target.value); setPage(1); }}
                            className="px-3 py-2 bg-white/90 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer shadow-xs"
                        >
                            <option value="All">All Categories</option>
                            {categories.map(c => (
                                <option key={c.category_id} value={c.category_name}>{c.category_name}</option>
                            ))}
                        </select>

                        {/* Formulation */}
                        <select
                            value={filterDrugType}
                            onChange={e => { setFilterDrugType(e.target.value); setPage(1); }}
                            className="px-3 py-2 bg-white/90 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer shadow-xs"
                        >
                            <option value="All">All Forms</option>
                            {DRUG_TYPES.map(t => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>

                        {/* Prescription Regulation */}
                        <select
                            value={filterPrescription}
                            onChange={e => { setFilterPrescription(e.target.value); setPage(1); }}
                            className="px-3 py-2 bg-white/90 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer shadow-xs"
                        >
                            <option value="All">All Regulations</option>
                            <option value="rx">℞ Prescription (POM)</option>
                            <option value="otc">Over The Counter (OTC)</option>
                            <option value="controlled">Controlled Drugs</option>
                        </select>

                        {/* Stock Level */}
                        <select
                            value={filterStockStatus}
                            onChange={e => { setFilterStockStatus(e.target.value); setPage(1); }}
                            className="px-3 py-2 bg-white/90 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer shadow-xs"
                        >
                            <option value="All">All Stock Levels</option>
                            <option value="in_stock">In Stock (&gt; Min)</option>
                            <option value="low_stock">⚠️ Low Stock (≤ Min)</option>
                            <option value="out_of_stock">❌ Out of Stock (0)</option>
                            <option value="overstocked">📦 Overstocked</option>
                        </select>

                        {/* Expiry Risk */}
                        <select
                            value={filterExpiryRisk}
                            onChange={e => { setFilterExpiryRisk(e.target.value); setPage(1); }}
                            className="px-3 py-2 bg-white/90 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer shadow-xs"
                        >
                            <option value="All">All Expiry States</option>
                            <option value="has_batches">Has Batches</option>
                            <option value="expiring_30">Expiring ≤ 30 Days</option>
                            <option value="expiring_90">Expiring ≤ 90 Days</option>
                            <option value="expired">🚨 Expired</option>
                        </select>

                        {/* Sort */}
                        <select
                            value={sortBy}
                            onChange={e => setSortBy(e.target.value as any)}
                            className="px-3 py-2 bg-white/90 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer shadow-xs"
                        >
                            <option value="name_asc">Name: A → Z</option>
                            <option value="name_desc">Name: Z → A</option>
                            <option value="stock_desc">Stock: High → Low</option>
                            <option value="stock_asc">Stock: Low → High</option>
                            <option value="price_desc">Price: High → Low</option>
                            <option value="margin_desc">Margin %: High → Low</option>
                        </select>
                    </div>

                    {/* View Switcher */}
                    <div className="flex border border-slate-200 rounded-xl overflow-hidden bg-white/90 shadow-xs">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 transition ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}
                            title="Table View"
                        >
                            <FiList size={16} />
                        </button>
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 transition ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}
                            title="Grid View"
                        >
                            <FiGrid size={16} />
                        </button>
                    </div>
                </div>

                {/* 3. Fast Quick Filter Pills Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mr-1">Fast Filters:</span>
                        {[
                            { id: 'all', label: 'All Items', count: products.length },
                            { id: 'low_stock', label: '⚠️ Low Stock', count: kpiData.lowStockCount },
                            { id: 'out_of_stock', label: '❌ Nil Stock', count: kpiData.outOfStockCount },
                            { id: 'rx_only', label: '℞ Prescription', count: kpiData.rxCount },
                            { id: 'expiring', label: '⏳ Expiry Risk', count: kpiData.expiringIn90Days },
                            { id: 'high_margin', label: '⭐ High Margin', count: products.filter(p => (p.margin_per || 0) >= 30).length },
                        ].map(f => (
                            <button
                                key={f.id}
                                onClick={() => { setActiveFastFilter(f.id as any); setPage(1); }}
                                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs ${
                                    activeFastFilter === f.id
                                        ? 'bg-blue-600 text-white shadow-blue-500/20'
                                        : 'bg-white/80 text-slate-600 border border-slate-200 hover:bg-slate-100'
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
                        <span>Showing <b>{filteredProducts.length}</b> of <b>{products.length}</b></span>
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
                                className="text-red-500 hover:text-red-700 font-bold underline ml-1"
                            >
                                Reset All
                            </button>
                        )}
                    </div>
                </div>

                {/* Bulk Actions Toolbar */}
                {selectedPids.size > 0 && (
                    <div className="flex items-center justify-between p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-xs font-bold text-blue-900 animate-fadeIn">
                        <div className="flex items-center gap-2">
                            <FiCheckCircle size={15} className="text-blue-600" />
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
                                className="px-3 py-1 bg-white border border-blue-300 rounded-lg text-blue-700 hover:bg-blue-100 transition"
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

            {/* ━━━ PRODUCTS DATAGRID / CARD GRID (IMMEDIATELY VISIBLE & ACCESSIBLE) ━━━ */}
            {isLoading ? (
                <div className="glass-card p-16 flex flex-col items-center justify-center border border-white/80">
                    <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                    <p className="mt-4 text-sm font-bold text-slate-700">Loading Pharmaceutical Formulary...</p>
                    <p className="text-xs text-slate-400 mt-1">Connecting to live inventory balances and batch records</p>
                </div>
            ) : paginatedProducts.length === 0 ? (
                <div className="glass-card p-16 text-center border border-white/80 shadow-md">
                    <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                        <FiPackage size={28} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">No matching drugs found</h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                        Try clearing search terms or resetting filters to show all formulary items.
                    </p>
                    <button
                        onClick={openAddModal}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition"
                    >
                        + Add New Drug
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
                                className={`glass-card transition-all duration-200 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-0.5 flex flex-col justify-between border ${
                                    isSelected ? 'border-blue-500 ring-2 ring-blue-400/20' : 'border-white/80'
                                }`}
                            >
                                <div className="p-3.5">
                                    <div className="flex items-start justify-between gap-1 mb-2">
                                        <div className="flex items-center gap-1.5">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleSelectPid(p.pid)}
                                                className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
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
                                                p.active ? 'bg-sky-50 text-sky-700 border border-sky-200' : 'bg-slate-100 text-slate-400'
                                            }`}>
                                                {p.active ? 'Active' : 'Off'}
                                            </span>
                                        </div>
                                    </div>

                                    <h4 className="text-sm font-black text-slate-800 line-clamp-1" title={p.product_name}>
                                        {p.product_name}
                                    </h4>
                                    <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5 italic">
                                        {p.generic_name || p.dosage || 'No generic specified'}
                                    </p>

                                    <div className="flex items-center gap-1 mt-2 flex-wrap">
                                        <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-100 text-[10px] font-bold">
                                            {p.category || 'General'}
                                        </span>
                                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-medium">
                                            {p.drug_type || 'Tablet'}
                                        </span>
                                    </div>

                                    <div className="mt-3.5 p-2 bg-slate-50/70 rounded-xl border border-slate-100 space-y-1">
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
                                            <span className={(p.margin_per || 0) >= 20 ? 'text-sky-700' : 'text-amber-600'}>
                                                {(p.margin_per || 0).toFixed(1)}%
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mt-3 flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <span className={`w-2.5 h-2.5 rounded-full ${
                                                stk <= 0 ? 'bg-red-500 animate-pulse' : stk <= (p.reorder_point || 10) ? 'bg-amber-500' : 'bg-sky-500'
                                            }`} />
                                            <span className="text-xs font-black text-slate-800">
                                                {stk} {p.sales_unit || 'Pcs'}
                                            </span>
                                        </div>
                                        {nearestDays !== null && getExpiryBadge(nearestDays)}
                                    </div>
                                </div>

                                <div className="p-2.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-1">
                                    <button
                                        onClick={() => openEditModal(p)}
                                        className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-white rounded-lg transition"
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
                /* ─── DETAILED TABLE / DATAGRID (GLASSMORPHIC THEME) ─── */
                <div className="glass-card border border-white/80 overflow-hidden shadow-lg shadow-slate-200/40">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 text-[11px] font-black uppercase tracking-wider backdrop-blur-md">
                                    <th className="py-3 px-3.5 w-10 text-center">
                                        <input
                                            type="checkbox"
                                            checked={selectedPids.size === paginatedProducts.length && paginatedProducts.length > 0}
                                            onChange={toggleSelectAll}
                                            className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
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
                                                className={`transition-colors hover:bg-blue-50/30 ${
                                                    isSelected ? 'bg-blue-50/50' : idx % 2 === 0 ? 'bg-white/60' : 'bg-slate-50/30'
                                                }`}
                                            >
                                                {/* Checkbox */}
                                                <td className="py-3 px-3.5 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleSelectPid(p.pid)}
                                                        className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                                                    />
                                                </td>

                                                {/* Name & Generic */}
                                                <td className="py-3 px-3.5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-black text-sm flex-shrink-0 shadow-xs">
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
                                                                <span className="font-bold text-slate-900 hover:text-blue-700 cursor-pointer" onClick={() => openEditModal(p)}>
                                                                    {p.product_name}
                                                                </span>
                                                                {p.requires_prescription && (
                                                                    <span className="px-1.5 py-0.2 rounded bg-red-50 text-red-600 border border-red-200 text-[10px] font-black">
                                                                        ℞
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                                                                <span className="font-mono text-blue-600 font-bold">{p.product_code}</span>
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
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-100 rounded-lg text-[11px] font-bold shadow-2xs">
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
                                                            ? 'bg-sky-50 text-sky-700 border border-sky-200'
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
                                                                : 'bg-sky-50 text-sky-800 border border-sky-200'
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
                                                            ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                                            : 'bg-slate-100 text-slate-500'
                                                    }`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${p.active ? 'bg-sky-500' : 'bg-slate-400'}`} />
                                                        {p.active ? 'Active' : 'Disabled'}
                                                    </span>
                                                </td>

                                                {/* Actions */}
                                                <td className="py-3 px-3.5 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button
                                                            onClick={() => openEditModal(p)}
                                                            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
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
                                                                    <FiBox size={14} className="text-blue-600" />
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
            <div className="glass-card border border-white/80 px-5 py-3 shadow-md shadow-slate-200/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                    <span>Rows per page:</span>
                    <select
                        value={perPage}
                        onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}
                        className="px-2.5 py-1 bg-white/90 border border-slate-200 rounded-lg font-bold text-slate-700 outline-none shadow-2xs"
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
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed shadow-2xs"
                    >
                        <FiChevronsLeft size={14} />
                    </button>
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed shadow-2xs"
                    >
                        <FiChevronLeft size={14} />
                    </button>

                    <span className="px-3 py-1 font-bold text-slate-800">
                        Page {page} of {totalPages || 1}
                    </span>

                    <button
                        onClick={() => setPage(p => Math.min(totalPages || 1, p + 1))}
                        disabled={page >= totalPages}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed shadow-2xs"
                    >
                        <FiChevronRight size={14} />
                    </button>
                    <button
                        onClick={() => setPage(totalPages || 1)}
                        disabled={page >= totalPages}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed shadow-2xs"
                    >
                        <FiChevronsRight size={14} />
                    </button>
                </div>
            </div>

            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                ADD/EDIT PRODUCT MODAL (COMPACT BALANCED WIDTH: max-w-3xl)
               ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 md:p-6 overflow-y-auto">
                    {/* Modal container: REDUCED WIDTH TO max-w-3xl to ensure clean, balanced proportions without being too long */}
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-scaleUp">
                        {/* Modal Header */}
                        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-5 py-4 text-white flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center text-white text-base">
                                    💊
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-base font-black tracking-tight">
                                            {editingProduct ? `Edit Pharmaceutical Record` : `Add New Drug Formulation`}
                                        </h2>
                                        {editingProduct && (
                                            <span className="px-2 py-0.5 rounded-md bg-white/20 text-white font-mono text-[11px] font-bold">
                                                {editingProduct.product_code}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-white/80 text-xs mt-0.5">
                                        Formulary parameters, packaging units, margin engine & batch allocations
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
                        <div className="bg-slate-50 px-5 py-2 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto flex-shrink-0">
                            {[
                                { id: 'general', label: '1. Identity', icon: FiPackage },
                                { id: 'clinical', label: '2. Clinical & Rx', icon: FiShield },
                                { id: 'pricing', label: '3. Pricing & Margins', icon: FiDollarSign },
                                { id: 'batches', label: `4. Batches (${modalBatches.length})`, icon: FiBox },
                                { id: 'media', label: '5. POS Display', icon: FiSliders },
                            ].map(tab => {
                                const Icon = tab.icon;
                                const isActive = modalTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setModalTab(tab.id as any)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                                            isActive
                                                ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                                                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                                        }`}
                                    >
                                        <Icon size={13} className={isActive ? 'text-blue-600' : 'text-slate-400'} />
                                        <span>{tab.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Modal Body Content (Comfortable 2-Column Responsive Form) */}
                        <div className="p-5 overflow-y-auto flex-1 space-y-4">

                            {/* ─── TAB 1: IDENTIFICATION & CLASSIFICATION ─── */}
                            {modalTab === 'general' && (
                                <div className="space-y-3.5 animate-fadeIn">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                        <div className="sm:col-span-2">
                                            <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">
                                                Brand Trade Name <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.product_name}
                                                onChange={e => setFormData({ ...formData, product_name: e.target.value })}
                                                placeholder="e.g. Panadol Extra 500mg"
                                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none transition"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">
                                                Generic Name (INN / Salt)
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.generic_name || ''}
                                                onChange={e => setFormData({ ...formData, generic_name: e.target.value })}
                                                placeholder="e.g. Paracetamol + Caffeine"
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none transition"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1 flex items-center justify-between">
                                                <span>Barcode / EAN</span>
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        const bc = await generateBarcode();
                                                        setFormData(prev => ({ ...prev, barcode: bc }));
                                                        toast.success(`Generated: ${bc}`);
                                                    }}
                                                    className="text-[10px] text-blue-600 hover:underline font-bold"
                                                >
                                                    ⚡ Generate
                                                </button>
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.barcode || ''}
                                                onChange={e => setFormData({ ...formData, barcode: e.target.value })}
                                                placeholder="Barcode code"
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none transition"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">
                                                Formulary Category
                                            </label>
                                            <select
                                                value={formData.category || ''}
                                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none cursor-pointer"
                                            >
                                                <option value="">Select Category</option>
                                                {categories.map(c => (
                                                    <option key={c.category_id} value={c.category_name}>{c.category_name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">
                                                Manufacturer / Lab
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.manufacturer || ''}
                                                onChange={e => setFormData({ ...formData, manufacturer: e.target.value })}
                                                placeholder="e.g. GlaxoSmithKline"
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none transition"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">
                                                Shelf / Bin Coordinates
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.shelf_location || ''}
                                                onChange={e => setFormData({ ...formData, shelf_location: e.target.value })}
                                                placeholder="e.g. Aisle 2 - Shelf B"
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none transition"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">
                                                Default Supplier
                                            </label>
                                            <select
                                                value={formData.supplier_name || ''}
                                                onChange={e => setFormData({ ...formData, supplier_name: e.target.value })}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none cursor-pointer"
                                            >
                                                <option value="">Direct Wholesale / Warehouse</option>
                                                {suppliers.map(s => (
                                                    <option key={s.supplier_id} value={s.supplier_name}>{s.supplier_name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ─── TAB 2: CLINICAL & REGULATORY ─── */}
                            {modalTab === 'clinical' && (
                                <div className="space-y-4 animate-fadeIn">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">
                                                Formulation
                                            </label>
                                            <select
                                                value={formData.drug_type}
                                                onChange={e => setFormData({ ...formData, drug_type: e.target.value })}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 cursor-pointer"
                                            >
                                                {DRUG_TYPES.map(t => (
                                                    <option key={t} value={t}>{t}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">
                                                Strength / Concentration
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.dosage || ''}
                                                onChange={e => setFormData({ ...formData, dosage: e.target.value })}
                                                placeholder="e.g. 500mg, 125mg/5ml"
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                                            />
                                        </div>

                                        <div className="sm:col-span-2">
                                            <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">
                                                Storage Condition
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.storage_conditions || ''}
                                                onChange={e => setFormData({ ...formData, storage_conditions: e.target.value })}
                                                placeholder="e.g. Below 25°C in a dry place"
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                                            />
                                            {/* Preset Chips */}
                                            <div className="flex flex-wrap gap-1 mt-1.5">
                                                {STORAGE_PRESETS.slice(0, 4).map(preset => (
                                                    <button
                                                        key={preset}
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, storage_conditions: preset })}
                                                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                                            formData.storage_conditions === preset
                                                                ? 'bg-blue-600 text-white border-blue-600'
                                                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                                        }`}
                                                    >
                                                        {preset}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Regulatory Governance Toggles */}
                                    <div className="space-y-2 pt-2 border-t border-slate-100">
                                        <label className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition ${
                                            formData.requires_prescription ? 'border-red-400 bg-red-50/50' : 'border-slate-200 hover:bg-slate-50'
                                        }`}>
                                            <input
                                                type="checkbox"
                                                checked={formData.requires_prescription}
                                                onChange={e => setFormData({ ...formData, requires_prescription: e.target.checked })}
                                                className="w-4 h-4 accent-red-600 rounded cursor-pointer"
                                            />
                                            <div>
                                                <p className="text-xs font-black text-red-700">℞ Prescription Only (POM)</p>
                                                <p className="text-[10px] text-slate-500">Requires verified doctor prescription at POS</p>
                                            </div>
                                        </label>

                                        <label className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition ${
                                            formData.controlled_substance ? 'border-purple-400 bg-purple-50/50' : 'border-slate-200 hover:bg-slate-50'
                                        }`}>
                                            <input
                                                type="checkbox"
                                                checked={formData.controlled_substance}
                                                onChange={e => setFormData({ ...formData, controlled_substance: e.target.checked })}
                                                className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
                                            />
                                            <div>
                                                <p className="text-xs font-black text-purple-700">Controlled Substance</p>
                                                <p className="text-[10px] text-slate-500">Subject to poison book auditing and lock-box storage</p>
                                            </div>
                                        </label>

                                        <label className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition ${
                                            formData.show_in_pos ? 'border-blue-400 bg-sky-50/50' : 'border-slate-200 hover:bg-slate-50'
                                        }`}>
                                            <input
                                                type="checkbox"
                                                checked={formData.show_in_pos}
                                                onChange={e => setFormData({ ...formData, show_in_pos: e.target.checked })}
                                                className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                                            />
                                            <div>
                                                <p className="text-xs font-black text-sky-700">Display on POS Cashier Screen</p>
                                                <p className="text-[10px] text-slate-500">Quick-sell button enabled in cashier register</p>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            )}

                            {/* ─── TAB 3: PACKAGING, PRICING & MARGIN ENGINE ─── */}
                            {modalTab === 'pricing' && (
                                <div className="space-y-4 animate-fadeIn">
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                                                Purchase Unit
                                            </label>
                                            <select
                                                value={formData.purchase_unit}
                                                onChange={e => setFormData({ ...formData, purchase_unit: e.target.value })}
                                                className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                                            >
                                                {units.map(u => (
                                                    <option key={u.unit_id} value={u.unit_name}>{u.unit_name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                                                Dispensing Unit
                                            </label>
                                            <select
                                                value={formData.sales_unit}
                                                onChange={e => setFormData({ ...formData, sales_unit: e.target.value })}
                                                className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                                            >
                                                {units.map(u => (
                                                    <option key={u.unit_id} value={u.unit_name}>{u.unit_name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                                                Pieces / Pack
                                            </label>
                                            <input
                                                type="number"
                                                min={1}
                                                value={formData.pieces_per_package}
                                                onChange={e => setFormData({ ...formData, pieces_per_package: Math.max(1, parseInt(e.target.value) || 1) })}
                                                className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-center"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                                                Buying Cost (KES) *
                                            </label>
                                            <input
                                                type="number"
                                                min={0}
                                                step={0.01}
                                                value={formData.purchase_cost}
                                                onChange={e => setFormData({ ...formData, purchase_cost: Math.max(0, parseFloat(e.target.value) || 0) })}
                                                className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                                                Retail Price (KES) *
                                            </label>
                                            <input
                                                type="number"
                                                min={0}
                                                step={0.01}
                                                value={formData.sales_cost}
                                                onChange={e => setFormData({ ...formData, sales_cost: Math.max(0, parseFloat(e.target.value) || 0) })}
                                                className="w-full px-2.5 py-2 bg-sky-50 border border-sky-300 rounded-xl text-xs font-black text-blue-900"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                                                Wholesale Price
                                            </label>
                                            <input
                                                type="number"
                                                min={0}
                                                step={0.01}
                                                value={formData.wholesale_price}
                                                onChange={e => setFormData({ ...formData, wholesale_price: Math.max(0, parseFloat(e.target.value) || 0) })}
                                                className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                                            />
                                        </div>
                                    </div>

                                    {/* Live Financial Margin Breakdown Table */}
                                    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                                        <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs">
                                            <span className="font-bold text-slate-800">Financial Calculations</span>
                                            <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                                computedMetrics.marginPerPiece >= 20 ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'
                                            }`}>
                                                {computedMetrics.marginPerPiece.toFixed(1)}% Gross Margin
                                            </span>
                                        </div>
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 text-[10px] uppercase">
                                                    <th className="py-2 px-3 text-left">Level</th>
                                                    <th className="py-2 px-3 text-right">Cost</th>
                                                    <th className="py-2 px-3 text-right">Sell</th>
                                                    <th className="py-2 px-3 text-right">Unit Profit</th>
                                                    <th className="py-2 px-3 text-right">Markup</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                <tr>
                                                    <td className="py-2 px-3 font-bold text-slate-800">Per {formData.purchase_unit}</td>
                                                    <td className="py-2 px-3 text-right font-mono">KES {computedMetrics.costPerPkg.toLocaleString()}</td>
                                                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">KES {computedMetrics.sellPerPkg.toLocaleString()}</td>
                                                    <td className="py-2 px-3 text-right font-mono font-bold text-sky-700">KES {computedMetrics.profitPerPkg.toLocaleString()}</td>
                                                    <td className="py-2 px-3 text-right text-slate-600">{computedMetrics.markupPerPiece.toFixed(1)}%</td>
                                                </tr>
                                                {computedMetrics.isDiffUnit && (
                                                    <tr className="bg-sky-50/30">
                                                        <td className="py-2 px-3 font-bold text-blue-900">Per {formData.sales_unit}</td>
                                                        <td className="py-2 px-3 text-right font-mono">KES {computedMetrics.costPerPiece.toFixed(2)}</td>
                                                        <td className="py-2 px-3 text-right font-mono font-bold text-blue-900">KES {computedMetrics.sellPerPiece.toLocaleString()}</td>
                                                        <td className="py-2 px-3 text-right font-mono font-bold text-sky-700">KES {computedMetrics.profitPerPiece.toFixed(2)}</td>
                                                        <td className="py-2 px-3 text-right text-slate-600">{computedMetrics.markupPerPiece.toFixed(1)}%</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* ─── TAB 4: DIRECT OPENING BATCHES ─── */}
                            {modalTab === 'batches' && (
                                <div className="space-y-3.5 animate-fadeIn">
                                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2.5">
                                        <h4 className="text-[11px] font-black uppercase text-slate-700">+ Add Batch Item</h4>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Batch # *</label>
                                                <input
                                                    type="text"
                                                    value={newBatchRow.batch_number}
                                                    onChange={e => setNewBatchRow({ ...newBatchRow, batch_number: e.target.value })}
                                                    placeholder="e.g. BAT-2611"
                                                    className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Expiry Date *</label>
                                                <input
                                                    type="date"
                                                    value={newBatchRow.expiry_date}
                                                    onChange={e => setNewBatchRow({ ...newBatchRow, expiry_date: e.target.value })}
                                                    className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Quantity (Pcs) *</label>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    value={newBatchRow.quantity || ''}
                                                    onChange={e => setNewBatchRow({ ...newBatchRow, quantity: Math.max(0, parseInt(e.target.value) || 0) })}
                                                    placeholder="100"
                                                    className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-1">
                                            <div className="flex gap-1">
                                                {[
                                                    { label: '+1Y', m: 12 },
                                                    { label: '+2Y', m: 24 },
                                                    { label: '+3Y', m: 36 }
                                                ].map(chip => (
                                                    <button
                                                        key={chip.label}
                                                        type="button"
                                                        onClick={() => setQuickExpiry(chip.m)}
                                                        className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600 hover:text-purple-600 text-[10px] font-bold"
                                                    >
                                                        {chip.label}
                                                    </button>
                                                ))}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (!newBatchRow.batch_number || !newBatchRow.expiry_date || newBatchRow.quantity <= 0) {
                                                        toast.error('Batch #, expiry date and quantity required');
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
                                                    toast.success('Batch added');
                                                }}
                                                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-xs shadow-sm"
                                            >
                                                + Add Batch
                                            </button>
                                        </div>
                                    </div>

                                    {modalBatches.length > 0 && (
                                        <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                                            <table className="w-full">
                                                <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase">
                                                    <tr>
                                                        <th className="py-2 px-2.5 text-left">Batch #</th>
                                                        <th className="py-2 px-2.5 text-center">Expiry</th>
                                                        <th className="py-2 px-2.5 text-right">Qty</th>
                                                        <th className="py-2 px-2.5 text-center w-8"></th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {modalBatches.map((b, bi) => (
                                                        <tr key={bi} className="hover:bg-slate-50">
                                                            <td className="py-2 px-2.5 font-mono font-bold text-slate-800">{b.batch_number}</td>
                                                            <td className="py-2 px-2.5 text-center text-slate-600">{b.expiry_date}</td>
                                                            <td className="py-2 px-2.5 text-right font-bold text-slate-800">{b.quantity}</td>
                                                            <td className="py-2 px-2.5 text-center">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setModalBatches(prev => prev.filter((_, i) => i !== bi))}
                                                                    className="text-slate-400 hover:text-red-600"
                                                                >
                                                                    <FiTrash2 size={12} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ─── TAB 5: POS DISPLAY ─── */}
                            {modalTab === 'media' && (
                                <div className="space-y-3.5 animate-fadeIn">
                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">
                                            Product Photo URL
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.photo || ''}
                                            onChange={e => setFormData({ ...formData, photo: e.target.value })}
                                            placeholder="https://example.com/product.jpg"
                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">
                                            Clinical Description & Patient Advisory
                                        </label>
                                        <textarea
                                            rows={3}
                                            value={formData.description || ''}
                                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                                            placeholder="Dosage administration advice, precautions, contraindications..."
                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                                        />
                                    </div>
                                </div>
                            )}

                        </div>

                        {/* Modal Sticky Footer */}
                        <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
                                <span>Profit/Pc: <b className="text-blue-700 font-mono">KES {computedMetrics.profitPerPiece.toFixed(2)}</b></span>
                                <span className="text-slate-300">|</span>
                                <span>Margin: <b className="text-blue-700 font-mono">{computedMetrics.marginPerPiece.toFixed(1)}%</b></span>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-white transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveProduct}
                                    disabled={isSaving}
                                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition flex items-center gap-1.5 disabled:opacity-50"
                                >
                                    {isSaving ? (
                                        <>
                                            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>Saving...</span>
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

            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                SUPER MASSIVE ULTRA IMPORT MODAL (SELECT IMPORT, BATCHES, 0 QTY, OVERWRITE)
               ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {showImportModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 md:p-6 overflow-y-auto">
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden animate-scaleUp">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-6 py-4.5 text-white flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-white text-lg">
                                    <FiUpload size={20} />
                                </div>
                                <div>
                                    <h3 className="font-black text-base tracking-tight">Super Ultra Pharmaceutical Import Suite</h3>
                                    <p className="text-blue-100 text-xs mt-0.5">
                                        Batch creation, selective import, 0 quantity catalog mode & overwrite protection
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowImportModal(false)}
                                className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition"
                            >
                                <FiX size={18} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto flex-1 space-y-5">

                            {/* ─── STATUS: SUCCESS AUDIT ─── */}
                            {importStatus === 'success' && (
                                <div className="text-center py-6 space-y-4">
                                    <div className="w-16 h-16 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center mx-auto shadow-md">
                                        <FiCheck size={32} />
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-black text-slate-800">Pharmaceutical Import Complete!</h4>
                                        <p className="text-xs text-slate-500 mt-1">Catalog and inventory registries have been updated.</p>
                                    </div>

                                    {/* Summary Stats Grid */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl mx-auto pt-2">
                                        <div className="bg-sky-50 border border-sky-200 p-3 rounded-2xl">
                                            <p className="text-[10px] font-bold text-sky-700 uppercase">New Items Created</p>
                                            <p className="text-2xl font-black text-sky-900 mt-1">{importSuccessCount}</p>
                                        </div>
                                        <div className="bg-blue-50 border border-blue-200 p-3 rounded-2xl">
                                            <p className="text-[10px] font-bold text-blue-600 uppercase">Existing Updated</p>
                                            <p className="text-2xl font-black text-blue-800 mt-1">{importUpdatedCount}</p>
                                        </div>
                                        <div className="bg-purple-50 border border-purple-200 p-3 rounded-2xl">
                                            <p className="text-[10px] font-bold text-purple-600 uppercase">Batches Created</p>
                                            <p className="text-2xl font-black text-purple-800 mt-1">{importBatchCount}</p>
                                        </div>
                                        <div className="bg-slate-100 border border-slate-200 p-3 rounded-2xl">
                                            <p className="text-[10px] font-bold text-slate-500 uppercase">Skipped / Unchanged</p>
                                            <p className="text-2xl font-black text-slate-700 mt-1">{importSkippedCount}</p>
                                        </div>
                                    </div>

                                    {/* Error log if any */}
                                    {importErrors.length > 0 && (
                                        <div className="max-w-2xl mx-auto bg-red-50 border border-red-200 rounded-2xl p-4 text-left max-h-40 overflow-y-auto">
                                            <p className="text-xs font-bold text-red-700 mb-1">
                                                {importErrors.length} Item(s) with Issues:
                                            </p>
                                            <div className="space-y-1">
                                                {importErrors.map((e, idx) => (
                                                    <p key={idx} className="text-[11px] text-red-600 font-medium">
                                                        • Row {e.row} ({e.item}): {e.error}
                                                    </p>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="pt-4">
                                        <button
                                            onClick={() => setShowImportModal(false)}
                                            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition"
                                        >
                                            Done & View Updated Formulary
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* ─── STATUS: IMPORTING IN PROGRESS ─── */}
                            {importStatus === 'importing' && (
                                <div className="py-12 text-center space-y-4">
                                    <div className="w-14 h-14 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mx-auto" />
                                    <div>
                                        <h4 className="text-base font-black text-slate-800">Processing Pharmaceutical Import...</h4>
                                        <p className="text-xs text-slate-500 mt-1">
                                            {importProgress} of {importTotal} records processed
                                        </p>
                                    </div>
                                    <div className="max-w-md mx-auto bg-slate-100 rounded-full h-3 overflow-hidden">
                                        <div
                                            className="bg-gradient-to-r from-blue-600 to-indigo-500 h-full transition-all duration-200"
                                            style={{ width: `${importTotal > 0 ? (importProgress / importTotal) * 100 : 0}%` }}
                                        />
                                    </div>
                                    <p className="text-xs font-mono font-bold text-blue-600 truncate max-w-sm mx-auto">
                                        Current: {importCurrentItem || 'Initializing...'}
                                    </p>
                                </div>
                            )}

                            {/* ─── STATUS: IDLE (FILE PICKER & CONTROLS) ─── */}
                            {importStatus === 'idle' && (
                                <div className="space-y-5">
                                    {/* Upload Dropzone */}
                                    <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-3xl p-8 text-center bg-slate-50/50 hover:bg-blue-50/20 transition cursor-pointer relative">
                                        <input
                                            type="file"
                                            accept=".csv,.txt"
                                            onChange={e => {
                                                if (e.target.files?.[0]) parseCSVFile(e.target.files[0]);
                                            }}
                                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                        />
                                        <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-3">
                                            <FiUpload size={24} />
                                        </div>
                                        <h4 className="text-sm font-black text-slate-800">Click to upload or drag & drop CSV file</h4>
                                        <p className="text-xs text-slate-400 mt-1">
                                            Supports standard comma-separated pharmaceutical formulary files (.csv)
                                        </p>
                                    </div>

                                    {/* Configuration Options Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                                        {/* 1. Mode */}
                                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                                            <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                                <FiLayers size={13} className="text-blue-600" /> 1. Import Mode
                                            </span>
                                            <div className="space-y-1.5 text-xs">
                                                {[
                                                    { id: 'add_new', label: 'Append New Items Only', desc: 'Skip existing products by name/barcode' },
                                                    { id: 'update', label: 'Update & Append', desc: 'Update prices of existing, add new' },
                                                    { id: 'overwrite_all', label: '⚠️ Overwrite All', desc: 'Wipe catalog & re-import from fresh' }
                                                ].map(m => (
                                                    <label key={m.id} className={`flex items-start gap-2 p-2 rounded-xl border cursor-pointer transition ${
                                                        importMode === m.id ? 'bg-white border-blue-400 shadow-xs' : 'border-transparent hover:bg-slate-100'
                                                    }`}>
                                                        <input
                                                            type="radio"
                                                            name="importMode"
                                                            value={m.id}
                                                            checked={importMode === m.id}
                                                            onChange={() => setImportMode(m.id as any)}
                                                            className="mt-0.5 accent-blue-600"
                                                        />
                                                        <div>
                                                            <p className="font-bold text-slate-800">{m.label}</p>
                                                            <p className="text-[10px] text-slate-400">{m.desc}</p>
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                        {/* 2. Stock Quantity Option */}
                                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                                            <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                                <FiBox size={13} className="text-blue-600" /> 2. Quantity Handling
                                            </span>
                                            <div className="space-y-1.5 text-xs">
                                                {[
                                                    { id: 'with_qty', label: 'Import with Stock Quantities', desc: 'Adds on-shelf stock counts from CSV' },
                                                    { id: 'zero_qty', label: 'Import as 0 Stock (Catalog Only)', desc: 'Formulary master only, recount later' }
                                                ].map(q => (
                                                    <label key={q.id} className={`flex items-start gap-2 p-2 rounded-xl border cursor-pointer transition ${
                                                        importQtyHandling === q.id ? 'bg-white border-blue-400 shadow-xs' : 'border-transparent hover:bg-slate-100'
                                                    }`}>
                                                        <input
                                                            type="radio"
                                                            name="importQty"
                                                            value={q.id}
                                                            checked={importQtyHandling === q.id}
                                                            onChange={() => setImportQtyHandling(q.id as any)}
                                                            className="mt-0.5 accent-blue-600"
                                                        />
                                                        <div>
                                                            <p className="font-bold text-slate-800">{q.label}</p>
                                                            <p className="text-[10px] text-slate-400">{q.desc}</p>
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                        {/* 3. Batch Option */}
                                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                                            <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                                <FiCalendar size={13} className="text-purple-600" /> 3. Batch Registration
                                            </span>
                                            <div className="space-y-1.5 text-xs">
                                                {[
                                                    { id: 'import_batches', label: 'Register Batches & Expiry', desc: 'Create batch records from CSV' },
                                                    { id: 'no_batches', label: 'Skip Batch Records', desc: 'Do not generate batches on import' }
                                                ].map(b => (
                                                    <label key={b.id} className={`flex items-start gap-2 p-2 rounded-xl border cursor-pointer transition ${
                                                        importBatchesOption === b.id ? 'bg-white border-purple-400 shadow-xs' : 'border-transparent hover:bg-slate-100'
                                                    }`}>
                                                        <input
                                                            type="radio"
                                                            name="importBatches"
                                                            value={b.id}
                                                            checked={importBatchesOption === b.id}
                                                            onChange={() => setImportBatchesOption(b.id as any)}
                                                            className="mt-0.5 accent-purple-600"
                                                        />
                                                        <div>
                                                            <p className="font-bold text-slate-800">{b.label}</p>
                                                            <p className="text-[10px] text-slate-400">{b.desc}</p>
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Template Downloader Bar */}
                                    <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                                        <div className="flex items-center gap-2.5">
                                            <FiFileText size={20} className="text-sky-600 flex-shrink-0" />
                                            <div>
                                                <p className="text-xs font-black text-sky-900">Need the Standard Pharmacy CSV Template?</p>
                                                <p className="text-[11px] text-sky-700">Pre-populated with 8 real drug examples, batches, expiries & units</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={downloadPharmacyCSVTemplate}
                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition whitespace-nowrap"
                                        >
                                            Download Master Template
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* ─── STATUS: PARSED (DATA GRID PREVIEW & SELECTIVE IMPORT) ─── */}
                            {importStatus === 'parsed' && (
                                <div className="space-y-4">
                                    {/* Preview Header & Stats */}
                                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div className="flex flex-wrap items-center gap-3 text-xs">
                                            <span className="font-bold text-slate-700">
                                                Total Parsed: <b className="text-blue-600">{importParsedRows.length}</b>
                                            </span>
                                            <span className="text-slate-300">|</span>
                                            <span className="font-bold text-slate-700">
                                                Selected: <b className="text-sky-700">{selectedImportCount}</b>
                                            </span>
                                            <span className="text-slate-300">|</span>
                                            <span className="font-bold text-slate-700">
                                                Valid: <b className="text-sky-600">{importParsedRows.filter(r => r.valid).length}</b>
                                            </span>
                                            {importParsedRows.some(r => !r.valid) && (
                                                <span className="font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                                                    {importParsedRows.filter(r => !r.valid).length} with issues
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => {
                                                    setImportParsedRows(prev => prev.map(r => ({ ...r, selected: true })));
                                                }}
                                                className="px-2.5 py-1 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50"
                                            >
                                                Select All
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setImportParsedRows(prev => prev.map(r => ({ ...r, selected: false })));
                                                }}
                                                className="px-2.5 py-1 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50"
                                            >
                                                Deselect All
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setImportParsedRows(prev => prev.map(r => ({ ...r, selected: r.valid })));
                                                }}
                                                className="px-2.5 py-1 bg-white border border-sky-300 text-sky-700 rounded-lg text-xs font-bold hover:bg-sky-50"
                                            >
                                                Valid Only
                                            </button>
                                        </div>
                                    </div>

                                    {/* Search within parsed rows */}
                                    <div className="relative">
                                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                        <input
                                            type="text"
                                            value={importSearch}
                                            onChange={e => setImportSearch(e.target.value)}
                                            placeholder="Search within parsed import rows..."
                                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                                        />
                                    </div>

                                    {/* Data Grid Preview Table */}
                                    <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs max-h-[38vh] overflow-y-auto">
                                        <table className="w-full text-xs text-left">
                                            <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase sticky top-0 z-10 border-b border-slate-200">
                                                <tr>
                                                    <th className="py-2.5 px-3 w-8 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedImportCount === importParsedRows.length && importParsedRows.length > 0}
                                                            onChange={() => {
                                                                const allSel = selectedImportCount === importParsedRows.length;
                                                                setImportParsedRows(prev => prev.map(r => ({ ...r, selected: !allSel })));
                                                            }}
                                                            className="w-4 h-4 rounded accent-blue-600"
                                                        />
                                                    </th>
                                                    <th className="py-2.5 px-3">Status</th>
                                                    <th className="py-2.5 px-3">Product Name</th>
                                                    <th className="py-2.5 px-3">Generic (INN)</th>
                                                    <th className="py-2.5 px-3">Category</th>
                                                    <th className="py-2.5 px-3 text-right">Cost</th>
                                                    <th className="py-2.5 px-3 text-right">Sell</th>
                                                    <th className="py-2.5 px-3 text-right">Qty</th>
                                                    <th className="py-2.5 px-3">Batch & Expiry</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {filteredImportRows.map(r => (
                                                    <tr
                                                        key={r._id}
                                                        className={`hover:bg-slate-50 ${
                                                            r.selected ? 'bg-sky-50/20' : !r.valid ? 'bg-red-50/20' : ''
                                                        }`}
                                                    >
                                                        <td className="py-2 px-3 text-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={r.selected}
                                                                onChange={() => {
                                                                    setImportParsedRows(prev =>
                                                                        prev.map(item =>
                                                                            item._id === r._id ? { ...item, selected: !item.selected } : item
                                                                        )
                                                                    );
                                                                }}
                                                                className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                                                            />
                                                        </td>
                                                        <td className="py-2 px-3">
                                                            {r.valid ? (
                                                                <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
                                                                    Ready ✓
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200" title={r.errors.join(', ')}>
                                                                    ⚠️ {r.errors[0]}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="py-2 px-3 font-bold text-slate-800">{r.product_name}</td>
                                                        <td className="py-2 px-3 text-slate-500 italic">{r.generic_name || '-'}</td>
                                                        <td className="py-2 px-3 text-slate-600">{r.category || 'General'}</td>
                                                        <td className="py-2 px-3 text-right text-slate-700 font-mono">KES {r.purchase_cost}</td>
                                                        <td className="py-2 px-3 text-right font-bold text-slate-900 font-mono">KES {r.sales_cost}</td>
                                                        <td className="py-2 px-3 text-right font-bold text-sky-700">{r.quantity} {r.sales_unit}</td>
                                                        <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">
                                                            {r.batch_number || 'Auto'} {r.expiry_date ? `(${r.expiry_date})` : ''}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Overwrite Confirmation Checkbox */}
                                    {importMode === 'overwrite_all' && (
                                        <div className="p-3 bg-red-50 border border-red-300 rounded-2xl flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                id="confirmOverwrite"
                                                checked={confirmOverwrite}
                                                onChange={e => setConfirmOverwrite(e.target.checked)}
                                                className="w-5 h-5 accent-red-600 rounded cursor-pointer"
                                            />
                                            <label htmlFor="confirmOverwrite" className="text-xs font-black text-red-800 cursor-pointer">
                                                I understand that &quot;Overwrite All&quot; will permanently delete existing catalog products and replace them with this import.
                                            </label>
                                        </div>
                                    )}
                                </div>
                            )}

                        </div>

                        {/* Modal Footer Actions */}
                        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
                            {importStatus === 'parsed' ? (
                                <>
                                    <button
                                        onClick={() => {
                                            setImportFile(null);
                                            setImportParsedRows([]);
                                            setImportStatus('idle');
                                        }}
                                        className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100"
                                    >
                                        Choose Another File
                                    </button>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => executeImport(importParsedRows.filter(r => r.selected))}
                                            disabled={selectedImportCount === 0 || (importMode === 'overwrite_all' && !confirmOverwrite)}
                                            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-xs rounded-xl shadow-md hover:from-blue-700 hover:to-indigo-700 transition disabled:opacity-40"
                                        >
                                            Import Selected ({selectedImportCount})
                                        </button>
                                        <button
                                            onClick={() => executeImport(importParsedRows)}
                                            disabled={importParsedRows.length === 0 || (importMode === 'overwrite_all' && !confirmOverwrite)}
                                            className="px-5 py-2.5 bg-blue-600 text-white font-bold text-xs rounded-xl shadow-md hover:bg-blue-700 transition disabled:opacity-40"
                                        >
                                            Import All ({importParsedRows.length})
                                        </button>
                                    </div>
                                </>
                            ) : importStatus === 'idle' ? (
                                <>
                                    <span className="text-xs text-slate-400">Select a CSV file to inspect and select rows</span>
                                    <button
                                        onClick={() => setShowImportModal(false)}
                                        className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-white"
                                    >
                                        Close
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => setShowImportModal(false)}
                                    className="px-5 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold ml-auto"
                                >
                                    Close Window
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}


            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                1. STOCK MOVEMENT LEDGER MODAL (QUICK ACTION)
               ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {showStockHistoryModal && stockHistoryProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 md:p-6 animate-fadeIn">
                    <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[88vh] flex flex-col overflow-hidden animate-scaleUp">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-6 py-4 text-white flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                                    <FiClock size={18} />
                                </div>
                                <div>
                                    <h3 className="text-base font-black tracking-tight">{stockHistoryProduct.product_name}</h3>
                                    <p className="text-xs text-blue-100 font-mono">Stock Movement Ledger • Code: {stockHistoryProduct.product_code}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowStockHistoryModal(false)}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
                            >
                                <FiX size={18} />
                            </button>
                        </div>

                        {/* Quick KPI Stats Bar */}
                        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 grid grid-cols-3 gap-3 flex-shrink-0">
                            <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center shadow-2xs">
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Total Inflow (+)</p>
                                <p className="text-sm font-black text-blue-600 mt-0.5">
                                    +{stockHistory.reduce((acc, r) => acc + (r.qty_in || 0), 0)} {stockHistoryProduct.sales_unit || 'Pcs'}
                                </p>
                            </div>
                            <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center shadow-2xs">
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Total Dispensed (-)</p>
                                <p className="text-sm font-black text-rose-600 mt-0.5">
                                    -{stockHistory.reduce((acc, r) => acc + (r.qty_out || 0), 0)} {stockHistoryProduct.sales_unit || 'Pcs'}
                                </p>
                            </div>
                            <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center shadow-2xs">
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Current Balance</p>
                                <p className="text-sm font-black text-sky-700 mt-0.5">
                                    {stockData[stockHistoryProduct.pid] || 0} {stockHistoryProduct.sales_unit || 'Pcs'}
                                </p>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="p-4 overflow-y-auto flex-1">
                            {stockHistory.length === 0 ? (
                                <div className="text-center py-12 text-slate-400 text-xs">
                                    <FiClock size={28} className="mx-auto mb-2 text-slate-300" />
                                    No recorded stock transactions found for this drug yet.
                                </div>
                            ) : (
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px]">
                                            <th className="py-2.5 px-3 text-left">Date</th>
                                            <th className="py-2.5 px-3 text-left">Ref / Invoice</th>
                                            <th className="py-2.5 px-3 text-left">Movement Type</th>
                                            <th className="py-2.5 px-3 text-right">In (+)</th>
                                            <th className="py-2.5 px-3 text-right">Out (-)</th>
                                            <th className="py-2.5 px-3 text-right font-black">Balance</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {stockHistory.map(r => (
                                            <tr key={r.id} className="hover:bg-slate-50 transition">
                                                <td className="py-2.5 px-3 text-slate-600 font-medium">{r.date}</td>
                                                <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{r.ref}</td>
                                                <td className="py-2.5 px-3">
                                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                                        r.type.includes('In')
                                                            ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                                            : r.type.includes('Sale')
                                                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                    }`}>
                                                        {r.type}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-3 text-right font-bold text-sky-700">{r.qty_in > 0 ? `+${r.qty_in}` : '-'}</td>
                                                <td className="py-2.5 px-3 text-right font-bold text-rose-600">{r.qty_out > 0 ? `-${r.qty_out}` : '-'}</td>
                                                <td className="py-2.5 px-3 text-right font-black text-slate-900">{r.balance}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end flex-shrink-0">
                            <button
                                onClick={() => setShowStockHistoryModal(false)}
                                className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 transition"
                            >
                                Close Ledger
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                2. PRICE HISTORY AUDIT MODAL (QUICK ACTION)
               ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {showPriceHistoryModal && priceHistoryProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 md:p-6 animate-fadeIn">
                    <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-scaleUp">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 px-6 py-4 text-white flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                                    <FiTrendingUp size={18} />
                                </div>
                                <div>
                                    <h3 className="text-base font-black tracking-tight">{priceHistoryProduct.product_name}</h3>
                                    <p className="text-xs text-purple-100 font-mono">Price Audit Trail • Code: {priceHistoryProduct.product_code}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowPriceHistoryModal(false)}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
                            >
                                <FiX size={18} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-5 overflow-y-auto flex-1">
                            {priceHistory.length === 0 ? (
                                <div className="text-center py-12 text-slate-400 text-xs">
                                    <FiTrendingUp size={28} className="mx-auto mb-2 text-slate-300" />
                                    No historical price changes recorded for this drug.
                                </div>
                            ) : (
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px]">
                                            <th className="py-2.5 px-3 text-left">Date & Time</th>
                                            <th className="py-2.5 px-3 text-right">Old Buy</th>
                                            <th className="py-2.5 px-3 text-right text-blue-600 font-bold">New Buy</th>
                                            <th className="py-2.5 px-3 text-right">Old Sell</th>
                                            <th className="py-2.5 px-3 text-right text-purple-600 font-bold">New Sell</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {priceHistory.map(r => (
                                            <tr key={r.id} className="hover:bg-slate-50 transition">
                                                <td className="py-2.5 px-3 text-slate-600 font-medium">{r.date}</td>
                                                <td className="py-2.5 px-3 text-right text-slate-400 font-mono">KES {r.old_buy}</td>
                                                <td className="py-2.5 px-3 text-right font-black text-blue-600 font-mono">KES {r.new_buy}</td>
                                                <td className="py-2.5 px-3 text-right text-slate-400 font-mono">KES {r.old_sell}</td>
                                                <td className="py-2.5 px-3 text-right font-black text-purple-600 font-mono">KES {r.new_sell}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end flex-shrink-0">
                            <button
                                onClick={() => setShowPriceHistoryModal(false)}
                                className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 transition"
                            >
                                Close Audit
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                3. STOCK ADJUSTMENT MODAL (QUICK ACTION)
               ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {showStockAdjustModal && adjustProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 md:p-6 animate-fadeIn">
                    <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full flex flex-col overflow-hidden animate-scaleUp">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 px-6 py-4 text-white flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                                    <FiSliders size={18} />
                                </div>
                                <div>
                                    <h3 className="text-base font-black tracking-tight">Stock Adjustment</h3>
                                    <p className="text-xs text-blue-100">{adjustProduct.product_name}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowStockAdjustModal(false)}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
                            >
                                <FiX size={18} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-5 space-y-4">
                            <div className="flex items-center justify-between p-3 bg-blue-50/70 border border-blue-200/60 rounded-2xl">
                                <span className="text-xs font-bold text-slate-600">Current Shelf Stock:</span>
                                <span className="text-sm font-black text-blue-700">
                                    {stockData[adjustProduct.pid] || 0} {adjustProduct.sales_unit || 'Pcs'}
                                </span>
                            </div>

                            {/* Adjustment Action */}
                            <div>
                                <label className="block text-xs font-black text-slate-700 mb-1.5 uppercase tracking-wider">Adjustment Action</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setAdjustType('add')}
                                        className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
                                            adjustType === 'add'
                                                ? 'bg-sky-600 text-white border-sky-600 shadow-md shadow-sky-500/20'
                                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                        }`}
                                    >
                                        <FiPlus size={14} /> Add Stock (+)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAdjustType('remove')}
                                        className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
                                            adjustType === 'remove'
                                                ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-500/20'
                                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                        }`}
                                    >
                                        <FiMinus size={14} /> Deduct / Loss (-)
                                    </button>
                                </div>
                            </div>

                            {/* Quantities */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        {adjustProduct.purchase_unit || 'Boxes'} Qty
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={adjustBags || ''}
                                        onChange={e => setAdjustBags(parseInt(e.target.value) || 0)}
                                        placeholder="0"
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        {adjustProduct.sales_unit || 'Pieces'} Qty
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={adjustPieces || ''}
                                        onChange={e => setAdjustPieces(parseInt(e.target.value) || 0)}
                                        placeholder="0"
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            {/* Reason */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Adjustment Reason / Notes</label>
                                <select
                                    onChange={e => setAdjustReason(e.target.value)}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 mb-2 cursor-pointer"
                                >
                                    <option value="">Select Pre-Set Reason...</option>
                                    <option value="Physical Inventory Count Reconciliation">Physical Inventory Count Reconciliation</option>
                                    <option value="Damaged / Broken in Shelf">Damaged / Broken in Shelf</option>
                                    <option value="Expired Stock Quarantine">Expired Stock Quarantine</option>
                                    <option value="Supplier Free Sample / Bonus">Supplier Free Sample / Bonus</option>
                                    <option value="Clinical Dispense Correction">Clinical Dispense Correction</option>
                                </select>
                                <input
                                    type="text"
                                    value={adjustReason}
                                    onChange={e => setAdjustReason(e.target.value)}
                                    placeholder="Or enter custom reason notes..."
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                                />
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
                            <button
                                onClick={() => setShowStockAdjustModal(false)}
                                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-white"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitStockAdjust}
                                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-blue-500/20"
                            >
                                Apply Adjustment
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                4. BARCODE & SHELF LABEL GENERATOR MODAL (QUICK ACTION)
               ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {showLabelModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 md:p-6 animate-fadeIn">
                    <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-scaleUp">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 px-6 py-4 text-white flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                                    <FiPrinter size={18} />
                                </div>
                                <div>
                                    <h3 className="text-base font-black tracking-tight">Barcode & Shelf Label Generator</h3>
                                    <p className="text-xs text-purple-100">Thermal sticker printing & regulatory shelf price tags</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowLabelModal(false)}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
                            >
                                <FiX size={18} />
                            </button>
                        </div>

                        {/* Controls Bar */}
                        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={labelSearch}
                                    onChange={e => setLabelSearch(e.target.value)}
                                    placeholder="Filter drugs..."
                                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-purple-500 w-48"
                                />
                                <select
                                    value={labelSize}
                                    onChange={e => setLabelSize(e.target.value as any)}
                                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                                >
                                    <option value="small">Small (38 x 25 mm Thermal)</option>
                                    <option value="medium">Medium (50 x 25 mm Shelf)</option>
                                    <option value="large">Large (A4 40-Up Sheet)</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        setLabelProducts(paginatedProducts.map(p => p.pid));
                                        const qMap: Record<number, number> = {};
                                        paginatedProducts.forEach(p => qMap[p.pid] = 1);
                                        setLabelQty(qMap);
                                    }}
                                    className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-100"
                                >
                                    + Add Current Page
                                </button>
                                <button
                                    onClick={() => { setLabelProducts([]); setLabelQty({}); }}
                                    className="px-2.5 py-1.5 text-xs text-rose-600 hover:text-rose-800 font-bold"
                                >
                                    Clear All
                                </button>
                            </div>
                        </div>

                        {/* Label Preview Grid */}
                        <div className="p-6 overflow-y-auto flex-1 space-y-4">
                            {labelProducts.length === 0 ? (
                                <div className="text-center py-12 text-slate-400 text-xs">
                                    <FiPrinter size={32} className="mx-auto mb-2 text-slate-300" />
                                    No drugs selected for printing. Click &quot;+ Add Current Page&quot; or select drugs from the catalog table.
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 print:grid-cols-3">
                                    {labelProducts.map(pid => {
                                        const p = products.find(x => x.pid === pid);
                                        if (!p) return null;
                                        const qty = labelQty[pid] || 1;
                                        const batches = productBatches[p.pid] || [];
                                        const nearestExp = batches.length > 0 ? batches[0].expiry_date : null;

                                        return (
                                            <div key={pid} className="border-2 border-dashed border-slate-300 rounded-2xl p-3 bg-white flex flex-col justify-between text-center relative group shadow-2xs">
                                                <button
                                                    onClick={() => {
                                                        setLabelProducts(labelProducts.filter(id => id !== pid));
                                                    }}
                                                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-rose-500 text-white text-xs font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-sm"
                                                >
                                                    ×
                                                </button>
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Alpha Pharmacy</p>
                                                    <h4 className="text-xs font-black text-slate-900 line-clamp-2 mt-0.5 leading-snug">{p.product_name}</h4>
                                                    <p className="text-[10px] text-slate-500 italic mt-0.5">{p.dosage || p.drug_type || 'Standard'}</p>
                                                </div>
                                                <div className="my-2 py-1 px-2 bg-slate-50 rounded-lg">
                                                    <div className="font-mono text-xs tracking-widest font-black text-slate-800">
                                                        ||||||||||||||||||||
                                                    </div>
                                                    <p className="font-mono text-[9px] text-slate-500">{p.barcode || p.product_code}</p>
                                                </div>
                                                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100">
                                                    <span className="font-black text-blue-700">KES {p.sales_cost}</span>
                                                    <span className="text-[9px] text-slate-400">{nearestExp ? `Exp: ${nearestExp}` : 'Rx Only'}</span>
                                                </div>
                                                <div className="mt-2 flex items-center justify-center gap-1.5 print:hidden">
                                                    <span className="text-[10px] text-slate-400 font-bold">Qty:</span>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="500"
                                                        value={qty}
                                                        onChange={e => setLabelQty({ ...labelQty, [pid]: parseInt(e.target.value) || 1 })}
                                                        className="w-12 text-center text-xs font-bold border border-slate-200 rounded-md py-0.5"
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
                            <button
                                onClick={() => setShowLabelModal(false)}
                                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-white"
                            >
                                Close
                            </button>
                            <button
                                onClick={() => window.print()}
                                disabled={labelProducts.length === 0}
                                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white rounded-xl text-xs font-black shadow-md hover:opacity-95 transition disabled:opacity-40"
                            >
                                <FiPrinter size={15} />
                                <span>Print Labels ({labelProducts.reduce((acc, pid) => acc + (labelQty[pid] || 1), 0)} pcs)</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                5. FAST BARCODE SCANNER & FORMULARY LOOKUP MODAL (QUICK ACTION)
               ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {showLookupModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 md:p-6 animate-fadeIn">
                    <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-xl w-full flex flex-col overflow-hidden animate-scaleUp">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 px-6 py-4 text-white flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                                    <FiEye size={18} />
                                </div>
                                <div>
                                    <h3 className="text-base font-black tracking-tight">Fast Drug Scanner & Lookup</h3>
                                    <p className="text-xs text-blue-100">Scan barcode gun or type DRG code / name</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowLookupModal(false)}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
                            >
                                <FiX size={18} />
                            </button>
                        </div>

                        {/* Input Bar */}
                        <div className="p-6 space-y-4">
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-600" size={18} />
                                    <input
                                        type="text"
                                        autoFocus
                                        value={lookupQuery}
                                        onChange={e => setLookupQuery(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') doLookup(); }}
                                        placeholder="Scan barcode or type drug name / code..."
                                        className="w-full pl-10 pr-4 py-3 bg-white border-2 border-blue-400 focus:border-blue-600 rounded-2xl text-sm font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/15"
                                    />
                                </div>
                                <button
                                    onClick={doLookup}
                                    className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-2xl shadow-md transition"
                                >
                                    Lookup
                                </button>
                            </div>

                            {/* Result Card */}
                            {lookupResult ? (
                                <div className="bg-gradient-to-br from-slate-50 to-blue-50/40 border border-blue-200/80 rounded-2xl p-4 space-y-3 shadow-2xs">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <span className="font-mono text-xs font-bold text-blue-600 bg-blue-100/60 px-2 py-0.5 rounded-md">
                                                {lookupResult.product_code}
                                            </span>
                                            <h4 className="text-base font-black text-slate-900 mt-1">{lookupResult.product_name}</h4>
                                            <p className="text-xs text-slate-500 italic">{lookupResult.generic_name || 'No generic INN specified'}</p>
                                        </div>
                                        <span className="px-2.5 py-1 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 text-xs font-bold">
                                            {lookupResult.category || 'General'}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/60 text-center">
                                        <div className="bg-white p-2 rounded-xl border border-slate-200">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold">Retail Price</span>
                                            <p className="text-sm font-black text-slate-900 mt-0.5">KES {lookupResult.sales_cost}</p>
                                        </div>
                                        <div className="bg-white p-2 rounded-xl border border-slate-200">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold">Cost Outlay</span>
                                            <p className="text-sm font-medium text-slate-600 mt-0.5">KES {lookupResult.purchase_cost}</p>
                                        </div>
                                        <div className="bg-white p-2 rounded-xl border border-slate-200">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold">Available Stock</span>
                                            <p className="text-sm font-black text-sky-700 mt-0.5">
                                                {stockData[lookupResult.pid] || 0} {lookupResult.sales_unit || 'Pcs'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-slate-600 bg-white/80 p-2.5 rounded-xl border border-slate-200">
                                        <span>Shelf Location: <b>{lookupResult.shelf_location || 'Not Assigned'}</b></span>
                                        <span>Storage: <b>{lookupResult.storage_conditions || 'Room Temp'}</b></span>
                                    </div>
                                    {/* Action Shortcuts */}
                                    <div className="flex items-center gap-2 pt-1">
                                        <button
                                            onClick={() => { setShowLookupModal(false); openEditModal(lookupResult); }}
                                            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                                        >
                                            <FiEdit2 size={13} /> Edit
                                        </button>
                                        <button
                                            onClick={() => { setShowLookupModal(false); openStockAdjust(lookupResult); }}
                                            className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                                        >
                                            <FiSliders size={13} /> Adjust Stock
                                        </button>
                                        <button
                                            onClick={() => { setShowLookupModal(false); openStockHistory(lookupResult); }}
                                            className="flex-1 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                                        >
                                            <FiClock size={13} /> History
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-slate-400 text-xs">
                                    Scan a barcode or enter search query above to view drug details.
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end flex-shrink-0">
                            <button
                                onClick={() => setShowLookupModal(false)}
                                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-white"
                            >
                                Close Scanner
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
