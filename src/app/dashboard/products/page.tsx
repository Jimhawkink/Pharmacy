'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { logActivity } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';
import { FiPackage, FiPlus, FiEdit2, FiTrash2, FiShoppingCart, FiDownload, FiRefreshCw, FiSearch, FiGrid, FiList, FiChevronLeft, FiChevronRight, FiX, FiUpload, FiCheck, FiAlertTriangle, FiTag, FiDollarSign, FiLayers, FiFilter, FiTrendingUp, FiImage, FiPrinter, FiZap, FiClock, FiSliders, FiEye, FiChevronsLeft, FiChevronsRight, FiFileText } from 'react-icons/fi';

interface Product {
    pid: number; product_code: string; product_name: string; alias: string;
    vat_commodity: string; description: string; barcode: string; category: string;
    purchase_unit: string; sales_unit: string; purchase_cost: number; sales_cost: number;
    wholesale_price: number; reorder_point: number; margin_per: number; show_ps: boolean; button_ui_color: string;
    photo: string; hscode: string; batch_no: string; supplier_name: string; active: boolean;
    pieces_per_package: number;
}
interface StockHistoryRow { id: number; date: string; ref: string; type: string; qty_in: number; qty_out: number; balance: number; }
interface PriceHistoryRow { id: number; date: string; old_buy: number; new_buy: number; old_sell: number; new_sell: number; }
interface Category { category_id: number; category_name: string; icon: string; color: string; }
interface Supplier { supplier_id: number; supplier_code: string; supplier_name: string; is_kitchen?: boolean; }
interface Unit { unit_id: number; unit_name: string; abbreviation: string; }
interface Batch {
    batch_id?: number; batch_number: string; expiry_date: string;
    manufacture_date: string; quantity: number; remaining_qty?: number;
    purchase_cost: number; selling_price: number; status?: string;
}

const DRUG_TYPES = ['Tablet','Capsule','Syrup','Suspension','Injection','Cream','Ointment','Drops','Inhaler','Suppository','Powder','Gel','Spray','Patch','Sachet','Other'];
const getDaysUntilExpiry = (d: string) => { if (!d) return 999; return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000); };
const getExpiryBadge = (days: number) => {
    if (days < 0) return <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-bold">EXPIRED</span>;
    if (days <= 7) return <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-xs font-bold">{days}d ⚠️</span>;
    if (days <= 30) return <span className="px-2 py-0.5 bg-orange-100 text-orange-600 rounded-full text-xs font-bold">{days}d</span>;
    if (days <= 90) return <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold">{days}d</span>;
    return <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-bold">{days}d ✓</span>;
};

const defaultProduct: Omit<Product, 'pid' | 'product_code'> = {
    product_name: '', alias: '', vat_commodity: 'Standard', description: '', barcode: '',
    category: '', purchase_unit: 'Piece', sales_unit: 'Piece', purchase_cost: 0, sales_cost: 0,
    wholesale_price: 0, reorder_point: 10, margin_per: 0, show_ps: true, button_ui_color: 'from-blue-400 to-blue-600',
    photo: '', hscode: '', batch_no: '', supplier_name: '', active: true, pieces_per_package: 1,
};
const UNIT_CONVERSIONS: Record<string, Record<string, number>> = {
    'Box': { 'Piece': 1, 'Box': 1 }, 'Pack': { 'Piece': 1, 'Pack': 1 },
    'Dozen': { 'Piece': 12, 'Dozen': 1 }, 'Kilogram': { 'Gram': 1000, 'Kilogram': 1 },
    'Liter': { 'Milliliter': 1000, 'Liter': 1 },
};
const vatOptions = ['Standard', 'Zero Rated', 'Exempt', 'Inclusive'];
const colorPresets = [
    { name: 'Orange', gradient: 'from-orange-400 to-orange-600', hex: '#F97316' },
    { name: 'Red', gradient: 'from-red-400 to-red-600', hex: '#EF4444' },
    { name: 'Yellow Orange', gradient: 'from-yellow-500 to-orange-500', hex: '#F59E0B' },
    { name: 'Pink', gradient: 'from-red-500 to-pink-600', hex: '#EC4899' },
    { name: 'Rose', gradient: 'from-rose-500 to-red-600', hex: '#F43F5E' },
    { name: 'Green', gradient: 'from-green-400 to-emerald-600', hex: '#10B981' },
    { name: 'Yellow', gradient: 'from-yellow-400 to-yellow-600', hex: '#EAB308' },
    { name: 'Amber', gradient: 'from-amber-400 to-amber-600', hex: '#F59E0B' },
    { name: 'Blue', gradient: 'from-blue-400 to-blue-600', hex: '#3B82F6' },
    { name: 'Cyan', gradient: 'from-cyan-400 to-cyan-600', hex: '#06B6D4' },
    { name: 'Teal', gradient: 'from-teal-400 to-teal-600', hex: '#14B8A6' },
    { name: 'Purple', gradient: 'from-purple-400 to-purple-600', hex: '#A855F7' },
    { name: 'Brown', gradient: 'from-amber-600 to-amber-800', hex: '#92400E' },
    { name: 'Red Dark', gradient: 'from-red-600 to-red-800', hex: '#DC2626' },
];
const defUnits: Unit[] = [
    { unit_id: 1, unit_name: 'Piece', abbreviation: 'Pc' }, { unit_id: 2, unit_name: 'Kilogram', abbreviation: 'Kg' },
    { unit_id: 3, unit_name: 'Gram', abbreviation: 'g' }, { unit_id: 4, unit_name: 'Liter', abbreviation: 'L' },
    { unit_id: 5, unit_name: 'Milliliter', abbreviation: 'ml' }, { unit_id: 6, unit_name: 'Box', abbreviation: 'Box' },
    { unit_id: 7, unit_name: 'Pack', abbreviation: 'Pk' }, { unit_id: 8, unit_name: 'Dozen', abbreviation: 'Dz' },
    { unit_id: 9, unit_name: 'Bottle', abbreviation: 'Btl' }, { unit_id: 10, unit_name: 'Plate', abbreviation: 'Plt' },
];

export default function ProductsPage() {
    const { activeOutlet } = useOutlet();
    const outletId = activeOutlet?.outlet_id || 1;
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [units, setUnits] = useState<Unit[]>(defUnits);
    const [companyName, setCompanyName] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [formData, setFormData] = useState(defaultProduct);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState('All');
    const [isSaving, setIsSaving] = useState(false);
    const [openingBags, setOpeningBags] = useState(0);
    const [openingPieces, setOpeningPieces] = useState(0);
    const [stockData, setStockData] = useState<Record<number, number>>({});
    const [bagStockData, setBagStockData] = useState<Record<number, number>>({});
    const [pieceStockData, setPieceStockData] = useState<Record<number, number>>({});
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
    const [showValuation, setShowValuation] = useState(true);
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(20);

    // New modal states
    const [showLabelModal, setShowLabelModal] = useState(false);
    const [labelProducts, setLabelProducts] = useState<number[]>([]);
    const [labelQty, setLabelQty] = useState<Record<number, number>>({});
    const [labelSearch, setLabelSearch] = useState('');
    const [labelSize, setLabelSize] = useState<'small' | 'medium' | 'large'>('medium');
    const [showLabelPreview, setShowLabelPreview] = useState(false);
    const [showLookupModal, setShowLookupModal] = useState(false);
    const [lookupQuery, setLookupQuery] = useState('');
    const [lookupResult, setLookupResult] = useState<Product | null>(null);
    const [showStockHistoryModal, setShowStockHistoryModal] = useState(false);
    const [stockHistoryProduct, setStockHistoryProduct] = useState<Product | null>(null);
    const [stockHistory, setStockHistory] = useState<StockHistoryRow[]>([]);
    const [showPriceHistoryModal, setShowPriceHistoryModal] = useState(false);
    const [priceHistoryProduct, setPriceHistoryProduct] = useState<Product | null>(null);
    const [priceHistory, setPriceHistory] = useState<PriceHistoryRow[]>([]);
    const [showStockAdjustModal, setShowStockAdjustModal] = useState(false);
    const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
    const [adjustBags, setAdjustBags] = useState(0);
    const [adjustPieces, setAdjustPieces] = useState(0);
    const [adjustType, setAdjustType] = useState<'add' | 'remove'>('add');
    const [adjustReason, setAdjustReason] = useState('');

    // Import states
    const [showImportModal, setShowImportModal] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importMode, setImportMode] = useState<'overwrite' | 'update' | 'add_new'>('add_new');
    const [importProgress, setImportProgress] = useState(0);
    const [importTotal, setImportTotal] = useState(0);
    const [importCurrentItem, setImportCurrentItem] = useState('');
    const [importStatus, setImportStatus] = useState<'idle' | 'parsing' | 'importing' | 'success' | 'error'>('idle');
    const [importErrors, setImportErrors] = useState<string[]>([]);
    const [importSuccessCount, setImportSuccessCount] = useState(0);

    // Pharmacy-specific states
    const [productBatches, setProductBatches] = useState<Record<number, Batch[]>>({});
    const [batches, setBatches] = useState<Batch[]>([]);
    const [newBatch, setNewBatch] = useState<Batch>({ batch_number: '', expiry_date: '', manufacture_date: '', quantity: 0, purchase_cost: 0, selling_price: 0 });
    const [pharmForm, setPharmForm] = useState({ generic_name: '', manufacturer: '', drug_type: 'Tablet', dosage: '', requires_prescription: false, storage_conditions: '' });
    const [editProduct, setEditProduct] = useState<Product | null>(null);
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

    // ─── DATA LOADING ───
    const loadProducts = useCallback(async () => {
        if (!activeOutlet) return; // Wait for outlet context to load on refresh
        setIsLoading(true);
        try {
            // Try with outlet_id filter first
            let { data, error } = await supabase.from('pharmacy_products').select('*').eq('outlet_id', outletId).order('pid', { ascending: false });
            // Fallback if outlet_id column doesn't exist
            if (error) {
                const fb = await supabase.from('pharmacy_products').select('*').order('pid', { ascending: false });
                data = fb.data; error = fb.error;
            }
            if (error) throw error;
            setProducts(data || []);
            // Load batches for all products
            if (data && data.length > 0) {
                const pids = data.map((p: any) => p.pid);
                const { data: allBatches } = await supabase.from('pharmacy_batches').select('*').in('product_id', pids).eq('status', 'Active').order('expiry_date', { ascending: true });
                const batchMap: Record<number, Batch[]> = {};
                (allBatches || []).forEach((b: any) => { if (!batchMap[b.product_id]) batchMap[b.product_id] = []; batchMap[b.product_id].push(b); });
                setProductBatches(batchMap);
            }
        }
        catch { toast.error('Failed to load products'); }
        setIsLoading(false);
    }, [activeOutlet, outletId]);

    const loadStockData = useCallback(async () => {
        if (!activeOutlet) return;
        try {
            let { data, error } = await supabase.from('pharmacy_stock').select('pid, qty, storage_type').eq('outlet_id', outletId);
            if (error) {
                const fb = await supabase.from('pharmacy_stock').select('pid, qty, storage_type');
                data = fb.data;
            }
            const total: Record<number, number> = {};
            const bags: Record<number, number> = {};
            const pcs: Record<number, number> = {};
            (data || []).forEach((s: any) => {
                const q = s.qty || 0;
                if (s.storage_type === 'Bags') {
                    bags[s.pid] = (bags[s.pid] || 0) + q;
                } else {
                    pcs[s.pid] = (pcs[s.pid] || 0) + q;
                }
                total[s.pid] = (total[s.pid] || 0) + q;
            });
            setStockData(total); setBagStockData(bags); setPieceStockData(pcs);
        } catch { /* silent */ }
    }, [activeOutlet, outletId]);

    const loadCategories = useCallback(async () => {
        if (!activeOutlet) return;
        try {
            let { data, error } = await supabase.from('pharmacy_categories').select('*').eq('active', true).eq('outlet_id', outletId).order('category_name');
            // Fallback: if outlet_id filter fails or returns empty, load ALL categories
            if (error || !data || data.length === 0) {
                const fb = await supabase.from('pharmacy_categories').select('*').eq('active', true).order('category_name');
                data = fb.data;
            }
            setCategories(data || []);
        }
        catch { /* silent */ }
    }, [activeOutlet, outletId]);

    const loadSuppliers = useCallback(async () => {
        try { const { data, error } = await supabase.from('pharmacy_suppliers').select('supplier_id, supplier_code, supplier_name').eq('active', true).order('supplier_name'); if (error) throw error; setSuppliers(data || []); }
        catch { /* silent */ }
    }, []);

    const loadUnits = useCallback(async () => {
        try { const { data, error } = await supabase.from('product_units').select('unit_id, unit_name, abbreviation').eq('active', true).order('unit_name'); if (error) throw error; setUnits(data || []); }
        catch { setUnits(defUnits); }
    }, []);

    const loadCompanyName = useCallback(async () => {
        try {
            const { data } = await supabase.from('organisation_settings').select('setting_value').eq('setting_key', 'company_name').single();
            if (data?.setting_value) setCompanyName(data.setting_value.trim());
        } catch { setCompanyName('Alpha Pharmacy'); }
    }, []);

    useEffect(() => { loadProducts(); loadStockData(); loadCategories(); loadSuppliers(); loadUnits(); loadCompanyName(); },
        [loadProducts, loadStockData, loadCategories, loadSuppliers, loadUnits, loadCompanyName]);

    const getKitchenSupplier = () => companyName || 'Kitchen';

    const generateBarcode = async (): Promise<string> => {
        try {
            const { data } = await supabase.from('pharmacy_products').select('barcode').eq('outlet_id', outletId).like('barcode', '1%').order('barcode', { ascending: false }).limit(1);
            if (data?.length && data[0].barcode) return String((parseInt(data[0].barcode) || 100) + 1); return '101';
        } catch { return '101'; }
    };

    const generateProductCode = async (): Promise<string> => {
        try {
            // Use max pid to generate a unique product code
            const { data } = await supabase.from('pharmacy_products').select('pid').eq('outlet_id', outletId).order('pid', { ascending: false }).limit(1);
            const maxPid = data?.[0]?.pid || 0;
            const nextNum = maxPid + 1;
            return `DRG-${String(nextNum).padStart(4, '0')}`;
        } catch {
            // Fallback: use timestamp to guarantee uniqueness
            return `DRG-${Date.now().toString().slice(-6)}`;
        }
    };

    const calcMargin = (costPerUnit: number, sellPrice: number) => sellPrice <= 0 ? 0 : Math.round(((sellPrice - costPerUnit) / sellPrice) * 10000) / 100;

    const openAddModal = async () => {
        setEditingProduct(null); const bc = await generateBarcode();
        setFormData({ ...defaultProduct, barcode: bc, supplier_name: getKitchenSupplier() });
        setPharmForm({ generic_name: '', manufacturer: '', drug_type: 'Tablet', dosage: '', requires_prescription: false, storage_conditions: '' });
        setBatches([]); setNewBatch({ batch_number: '', expiry_date: '', manufacture_date: '', quantity: 0, purchase_cost: 0, selling_price: 0 });
        setOpeningBags(0); setOpeningPieces(0); setShowModal(true);
    };

    const openEditModal = async (p: Product) => {
        setEditingProduct(p);
        setFormData({
            product_name: p.product_name, alias: p.alias || '', vat_commodity: p.vat_commodity || 'Standard',
            description: p.description || '', barcode: p.barcode || '', category: p.category || '',
            purchase_unit: p.purchase_unit || 'Piece', sales_unit: p.sales_unit || 'Piece',
            purchase_cost: p.purchase_cost || 0, sales_cost: p.sales_cost || 0, wholesale_price: (p as any).wholesale_price || 0, reorder_point: p.reorder_point || 10,
            margin_per: p.margin_per || 0, show_ps: p.show_ps !== false, button_ui_color: p.button_ui_color || 'from-blue-400 to-blue-600',
            photo: p.photo || '', hscode: p.hscode || '', batch_no: p.batch_no || '', supplier_name: p.supplier_name || '', active: p.active !== false,
            pieces_per_package: p.pieces_per_package || 1,
        });
        setPharmForm({
            generic_name: (p as any).generic_name || '', manufacturer: (p as any).manufacturer || '',
            drug_type: (p as any).drug_type || 'Tablet', dosage: (p as any).dosage || '',
            requires_prescription: (p as any).requires_prescription || false, storage_conditions: (p as any).storage_conditions || '',
        });
        // Load existing batches for editing
        const { data } = await supabase.from('pharmacy_batches').select('*').eq('product_id', p.pid).eq('status', 'Active').order('expiry_date');
        setBatches((data || []).map((b: any) => ({
            batch_id: b.batch_id, batch_number: b.batch_number, expiry_date: b.expiry_date,
            manufacture_date: b.manufacture_date || '', quantity: b.quantity, remaining_qty: b.remaining_qty,
            purchase_cost: b.purchase_cost, selling_price: b.selling_price, status: b.status,
        })));
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); if (!formData.product_name.trim()) { toast.error('Product name required!'); return; }
        setIsSaving(true);
        try {
            const costPerPiece = formData.purchase_cost / (formData.pieces_per_package || 1);
            const margin = calcMargin(costPerPiece, formData.wholesale_price || formData.sales_cost);
            const d = {
                product_name: formData.product_name, alias: formData.alias || null, description: formData.description || null,
                barcode: formData.barcode || null, category: formData.category || null, purchase_unit: formData.purchase_unit,
                sales_unit: formData.sales_unit, purchase_cost: formData.purchase_cost || 0, sales_cost: formData.sales_cost || 0,
                wholesale_price: formData.wholesale_price || 0, reorder_point: formData.reorder_point || 10, margin_per: margin, show_in_pos: formData.show_ps !== false,
                button_ui_color: formData.button_ui_color, photo: formData.photo || null, batch_no: formData.batch_no || null,
                supplier_name: formData.supplier_name || null, active: formData.active !== false,
                pieces_per_package: formData.pieces_per_package || 1,
            };
            if (editingProduct) {
                // Log price change if prices changed
                if (editingProduct.purchase_cost !== formData.purchase_cost || editingProduct.sales_cost !== formData.sales_cost) {
                    try {
                        await supabase.from('pharmacy_price_history').insert({
                            pid: editingProduct.pid, product_name: editingProduct.product_name,
                            old_buy: editingProduct.purchase_cost, new_buy: formData.purchase_cost,
                            old_sell: editingProduct.sales_cost, new_sell: formData.sales_cost,
                            changed_at: new Date().toISOString(),
                        });
                    } catch { /* silent if table doesn't exist */ }
                }
                const { error } = await supabase.from('pharmacy_products').update({ ...d, updated_at: new Date().toISOString() }).eq('pid', editingProduct.pid);
                if (error) throw new Error(error.message); toast.success('Product updated!');
                logActivity('Update', `Updated product: ${formData.product_name}`, `PID: ${editingProduct.pid}, Buy: ${formData.purchase_cost}, Sell: ${formData.sales_cost}`);
            } else {
                const code = await generateProductCode();
                const { data: np, error } = await supabase.from('pharmacy_products').insert({ ...d, product_code: code, outlet_id: outletId, created_at: new Date().toISOString() }).select().single();
                if (error) throw new Error(error.message);
                if (np) {
                    const stockRecords: any[] = [];
                    if (openingBags > 0) stockRecords.push({ pid: np.pid, invoice_no: 'OPENING', qty: openingBags, storage_type: 'Bags', outlet_id: outletId });
                    if (openingPieces > 0) stockRecords.push({ pid: np.pid, invoice_no: 'OPENING', qty: openingPieces, storage_type: 'Pieces', outlet_id: outletId });
                    if (stockRecords.length > 0) await supabase.from('pharmacy_stock').insert(stockRecords);
                }
                toast.success(`Product ${code} created!`);
                logActivity('Create', `Created product: ${formData.product_name}`, `Code: ${code}, Buy: ${formData.purchase_cost}, Sell: ${formData.sales_cost}`);
            }
            setShowModal(false); loadProducts(); loadStockData();
        } catch (err: unknown) { toast.error(`Failed: ${err instanceof Error ? err.message : 'Unknown'}`); }
        setIsSaving(false);
    };

    const deleteProduct = async (p: Product) => {
        if (!confirm(`Delete "${p.product_name}"?`)) return;
        try { const { error } = await supabase.from('pharmacy_products').delete().eq('pid', p.pid); if (error) throw error; toast.success('Deleted'); logActivity('Delete', `Deleted product: ${p.product_name}`, `PID: ${p.pid}, Code: ${p.product_code}`); loadProducts(); }
        catch { toast.error('Failed'); }
    };

    const exportCSV = () => {
        const csv = [['Code', 'Name', 'Category', 'Buy', 'Sell', 'Wholesale', 'Stock', 'Margin%', 'Status'].join(','),
        ...filtered.map(p => [p.product_code, `"${p.product_name}"`, p.category || '', p.purchase_cost, p.sales_cost, (p as any).wholesale_price || 0, stockData[p.pid] || 0, p.margin_per?.toFixed(1), p.active ? 'Active' : 'Off'].join(','))].join('\n');
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'products.csv'; a.click();
        toast.success('Exported!');
    };

    // ─── STOCK HISTORY ───
    const openStockHistory = async (p: Product) => {
        setStockHistoryProduct(p); setShowStockHistoryModal(true);
        try {
            const rows: StockHistoryRow[] = [];
            const { data: stockRows } = await supabase.from('pharmacy_stock').select('*').eq('pid', p.pid).order('created_at', { ascending: true });
            (stockRows || []).forEach((r: any, i: number) => rows.push({ id: i, date: new Date(r.created_at).toLocaleDateString('en-GB'), ref: r.invoice_no || 'N/A', type: 'Purchase/Opening', qty_in: r.qty || 0, qty_out: 0, balance: 0 }));
            const { data: saleRows } = await supabase.from('pharmacy_sales_items').select('*, pharmacy_sales!inner(sale_datetime, receipt_no)').eq('product_id', p.pid).order('pharmacy_sales(sale_datetime)', { ascending: true });
            (saleRows || []).forEach((r: any, i: number) => rows.push({ id: 1000 + i, date: new Date(r.pharmacy_sales?.sale_datetime).toLocaleDateString('en-GB'), ref: r.pharmacy_sales?.receipt_no || 'N/A', type: 'Sale', qty_in: 0, qty_out: r.quantity || 0, balance: 0 }));
            rows.sort((a, b) => a.date.localeCompare(b.date));
            let bal = 0; rows.forEach(r => { bal += r.qty_in - r.qty_out; r.balance = bal; });
            setStockHistory(rows);
        } catch { setStockHistory([]); }
    };

    // ─── PRICE HISTORY ───
    const openPriceHistory = async (p: Product) => {
        setPriceHistoryProduct(p); setShowPriceHistoryModal(true);
        try {
            const { data } = await supabase.from('pharmacy_price_history').select('*').eq('pid', p.pid).order('changed_at', { ascending: false });
            setPriceHistory((data || []).map((r: any, i: number) => ({ id: i, date: new Date(r.changed_at).toLocaleString('en-GB'), old_buy: r.old_buy, new_buy: r.new_buy, old_sell: r.old_sell, new_sell: r.new_sell })));
        } catch { setPriceHistory([]); }
    };

    // ─── STOCK ADJUSTMENT ───
    const openStockAdjust = (p: Product) => {
        setAdjustProduct(p); setAdjustBags(0); setAdjustPieces(0); setAdjustType('add'); setAdjustReason(''); setShowStockAdjustModal(true);
    };
    const submitStockAdjust = async () => {
        if (!adjustProduct || (adjustBags <= 0 && adjustPieces <= 0)) { toast.error('Enter valid quantity'); return; }
        try {
            const ref = `ADJ-${Date.now().toString(36).toUpperCase()}`;
            const stockRecords: any[] = [];
            if (adjustBags > 0) {
                stockRecords.push({ pid: adjustProduct.pid, invoice_no: ref, qty: adjustType === 'add' ? adjustBags : -adjustBags, storage_type: 'Bags', notes: adjustReason || 'Stock Adjustment', outlet_id: outletId });
            }
            if (adjustPieces > 0) {
                stockRecords.push({ pid: adjustProduct.pid, invoice_no: ref, qty: adjustType === 'add' ? adjustPieces : -adjustPieces, storage_type: 'Pieces', notes: adjustReason || 'Stock Adjustment', outlet_id: outletId });
            }
            if (stockRecords.length > 0) await supabase.from('pharmacy_stock').insert(stockRecords);
            const parts: string[] = [];
            if (adjustBags > 0) parts.push(`${adjustBags} ${adjustProduct.purchase_unit}(s)`);
            if (adjustPieces > 0) parts.push(`${adjustPieces} ${adjustProduct.sales_unit}(s)`);
            toast.success(`Stock ${adjustType === 'add' ? 'added' : 'removed'}: ${parts.join(' + ')}`);
            setShowStockAdjustModal(false); loadStockData();
        } catch { toast.error('Adjustment failed'); }
    };

    // ─── LABEL GENERATOR ───
    const labelSizes = { small: { w: '38mm', h: '25mm', name: 11, barcode: 14, price: 13, code: 8 }, medium: { w: '50mm', h: '30mm', name: 13, barcode: 18, price: 16, code: 9 }, large: { w: '62mm', h: '35mm', name: 15, barcode: 22, price: 20, code: 10 } };
    const getLabelHTML = () => {
        const selectedProds = products.filter(p => labelProducts.includes(p.pid));
        if (selectedProds.length === 0) return '';
        const labels = selectedProds.flatMap(p => Array.from({ length: labelQty[p.pid] || 1 }, () => p));
        const s = labelSizes[labelSize];
        return `<!DOCTYPE html><html><head><style>
            @page{margin:3mm;}*{box-sizing:border-box;margin:0;padding:0;}
            body{font-family:'Arial',sans-serif;display:flex;flex-wrap:wrap;gap:2mm;padding:0;}
            .label{width:${s.w};height:${s.h};border:1.5px solid #222;border-radius:3px;padding:2mm;display:flex;flex-direction:column;justify-content:space-between;page-break-inside:avoid;overflow:hidden;}
            .company{font-size:${s.code}px;text-align:center;color:#888;text-transform:uppercase;letter-spacing:1px;}
            .name{font-size:${s.name}px;font-weight:bold;text-transform:uppercase;text-align:center;line-height:1.1;overflow:hidden;max-height:${s.name * 2.2}px;}
            .barcode{font-size:${s.barcode}px;text-align:center;font-weight:900;letter-spacing:3px;font-family:'Courier New',monospace;}
            .price{font-size:${s.price}px;font-weight:900;text-align:center;background:#000;color:#fff;border-radius:2px;padding:1mm 0;}
            .code{font-size:${s.code}px;text-align:center;color:#555;}
        </style></head><body>${labels.map(p => `<div class='label'><div class='company'>${companyName || 'Alpha Pharmacy'}</div><div class='name'>${p.product_name}</div><div class='barcode'>${p.barcode || p.product_code}</div><div class='price'>Ksh ${(p.sales_cost || 0).toLocaleString()}</div><div class='code'>${p.product_code} • ${p.sales_unit || 'Pc'}</div></div>`).join('')}</body></html>`;
    };
    const printLabels = () => {
        const html = getLabelHTML();
        if (!html) { toast.error('Select at least one product'); return; }
        const iframe = document.createElement('iframe'); iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;';
        document.body.appendChild(iframe); const doc = iframe.contentWindow?.document;
        if (doc) { doc.open(); doc.write(html); doc.close(); setTimeout(() => { iframe.contentWindow?.print(); setTimeout(() => document.body.removeChild(iframe), 2000); }, 500); }
    };
    const filteredLabelProducts = products.filter(p => {
        if (!p.active) return false;
        if (!labelSearch.trim()) return true;
        const q = labelSearch.toLowerCase();
        return p.product_name.toLowerCase().includes(q) || p.product_code.toLowerCase().includes(q) || (p.barcode && p.barcode.includes(labelSearch));
    });

    // ─── IMPORT PRODUCTS ───
    const parseCSV = (text: string): Record<string, string>[] => {
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) return [];
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"(.*)"$/, '$1').toLowerCase().replace(/\s+/g, '_'));
        return lines.slice(1).map(line => {
            const vals: string[] = []; let current = ''; let inQuotes = false;
            for (const ch of line) {
                if (ch === '"') { inQuotes = !inQuotes; } else if (ch === ',' && !inQuotes) { vals.push(current.trim()); current = ''; } else { current += ch; }
            }
            vals.push(current.trim());
            const row: Record<string, string> = {};
            headers.forEach((h, i) => { row[h] = (vals[i] || '').replace(/^"(.*)"$/, '$1'); });
            return row;
        });
    };

    const importProducts = async () => {
        if (!importFile) { toast.error('Please select a CSV file'); return; }
        setImportStatus('parsing'); setImportErrors([]); setImportSuccessCount(0); setImportProgress(0);
        try {
            const text = await importFile.text();
            const rows = parseCSV(text);
            if (rows.length === 0) { toast.error('No data found in file'); setImportStatus('error'); return; }
            setImportTotal(rows.length); setImportStatus('importing');

            if (importMode === 'overwrite') {
                setImportCurrentItem('Clearing existing products...');
                await supabase.from('pharmacy_stock').delete().eq('outlet_id', outletId);
                await supabase.from('pharmacy_products').delete().eq('outlet_id', outletId);
                setImportProgress(0);
            }

            let success = 0; const errors: string[] = [];
            for (let i = 0; i < rows.length; i++) {
                const r = rows[i];
                const name = r.product_name || r.name || r.item_name || r.item || '';
                if (!name) { errors.push(`Row ${i + 2}: Missing product name`); setImportProgress(i + 1); continue; }
                setImportCurrentItem(name);
                const prodData = {
                    product_name: name,
                    alias: r.alias || r.short_name || '',
                    barcode: r.barcode || r.bar_code || r.upc || '',
                    category: r.category || r.group || r.type || '',
                    purchase_unit: r.purchase_unit || r.buy_unit || 'Piece',
                    sales_unit: r.sales_unit || r.sell_unit || r.unit || 'Piece',
                    purchase_cost: parseFloat(r.purchase_cost || r.buy_price || r.cost_price || r.cost || '0') || 0,
                    sales_cost: parseFloat(r.sales_cost || r.sell_price || r.selling_price || r.price || '0') || 0,
                    reorder_point: parseInt(r.reorder_point || r.reorder || r.min_stock || '10') || 10,
                    vat_commodity: r.vat_commodity || r.vat || r.tax || 'Standard',
                    supplier_name: r.supplier_name || r.supplier || '',
                    hscode: r.hscode || r.hs_code || '',
                    batch_no: r.batch_no || r.batch || '',
                    description: r.description || r.desc || '',
                    active: (r.active || r.status || 'true').toLowerCase() !== 'false',
                    pieces_per_package: parseInt(r.pieces_per_package || r.pcs_per_pack || '1') || 1,
                    wholesale_price: parseFloat(r.wholesale_price || r.wholesale || r.ws_price || '0') || 0,
                    margin_per: 0,
                };
                if (prodData.purchase_cost > 0) {
                    const cpp = prodData.purchase_cost / (prodData.pieces_per_package || 1);
                    const sp = prodData.wholesale_price || prodData.sales_cost;
                    prodData.margin_per = sp > 0 ? Math.round(((sp - cpp) / sp) * 10000) / 100 : 0;
                }

                try {
                    if (importMode === 'update') {
                        const existing = products.find(ep => ep.product_name.toLowerCase() === name.toLowerCase() || (ep.barcode && ep.barcode === prodData.barcode));
                        if (existing) {
                            await supabase.from('pharmacy_products').update(prodData).eq('pid', existing.pid);
                        } else {
                            const code = `DRG-${String(products.length + i + 1).padStart(2, '0')}`;
                            await supabase.from('pharmacy_products').insert({ ...prodData, product_code: code });
                        }
                    } else {
                        const code = `DRG-${String(i + 1).padStart(3, '0')}`;
                        await supabase.from('pharmacy_products').insert({ ...prodData, product_code: code });
                    }
                    const qty = parseFloat(r.quantity || r.stock || r.qty || r.opening_stock || '0');
                    if (qty > 0) {
                        const { data: newP } = await supabase.from('pharmacy_products').select('pid').eq('product_name', name).eq('outlet_id', outletId).order('pid', { ascending: false }).limit(1);
                        if (newP?.[0]) await supabase.from('pharmacy_stock').insert({ pid: newP[0].pid, invoice_no: 'IMPORT', qty, storage_type: 'Store', outlet_id: outletId });
                    }
                    success++;
                } catch (err: any) { errors.push(`Row ${i + 2} (${name}): ${err.message || 'DB error'}`); }
                setImportProgress(i + 1);
                await new Promise(r => setTimeout(r, 50));
            }
            setImportSuccessCount(success); setImportErrors(errors);
            setImportStatus(errors.length > 0 && success === 0 ? 'error' : 'success');
            loadProducts(); loadStockData();
        } catch (err: any) { setImportStatus('error'); setImportErrors([err.message || 'Failed to parse file']); }
    };

    // ─── ITEM LOOKUP ───
    const doLookup = () => {
        const q = lookupQuery.toLowerCase().trim();
        const found = products.find(p => p.barcode === lookupQuery || p.product_code.toLowerCase() === q || p.product_name.toLowerCase().includes(q));
        setLookupResult(found || null);
        if (!found) toast.error('Product not found');
    };

    const filtered = products.filter(p => {
        const q = searchQuery.toLowerCase();
        return (p.product_name.toLowerCase().includes(q) || p.product_code.toLowerCase().includes(q) || (p.barcode && p.barcode.includes(searchQuery)))
            && (filterCategory === 'All' || p.category === filterCategory);
    });
    const totalPages = Math.ceil(filtered.length / perPage);
    const paginated = filtered.slice((page - 1) * perPage, page * perPage);
    const lowStock = products.filter(p => (stockData[p.pid] || 0) <= (p.reorder_point || 10) && p.active).length;
    const stockValCost = products.reduce((s, p) => {
        const b = bagStockData[p.pid] || 0;
        const pc = pieceStockData[p.pid] || 0;
        const ppp = p.pieces_per_package || 1;
        return s + (b * (p.purchase_cost || 0)) + (pc * ((p.purchase_cost || 0) / ppp));
    }, 0);
    const stockValSales = products.reduce((s, p) => {
        const b = bagStockData[p.pid] || 0;
        const pc = pieceStockData[p.pid] || 0;
        const ppp = p.pieces_per_package || 1;
        const wsPrice = (p as any).wholesale_price || p.sales_cost || 0;
        return s + (b * ppp * wsPrice) + (pc * wsPrice);
    }, 0);
    const potentialProfit = stockValSales - stockValCost;

    // ─── UI ───
    return (
        <div className="space-y-5" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>

            {/* ━━━ TOP BAR ━━━ */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-300/40">
                        <FiPackage className="text-white" size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Products & Drugs</h1>
                        <p className="text-gray-500 text-sm mt-1">Manage your pharmacy inventory &bull; Code format: DRG-XX</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => { loadProducts(); loadStockData(); }} className="p-2.5 rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-all shadow-sm" title="Refresh">
                        <FiRefreshCw size={16} />
                    </button>
                    <button onClick={() => { setShowLabelModal(true); setLabelProducts([]); setLabelQty({}); }} className="p-2.5 rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-purple-600 hover:border-purple-300 transition-all shadow-sm" title="Label Generator">
                        <FiPrinter size={16} />
                    </button>
                    <button onClick={() => { setShowLookupModal(true); setLookupQuery(''); setLookupResult(null); }} className="p-2.5 rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-green-600 hover:border-green-300 transition-all shadow-sm" title="Item Lookup">
                        <FiEye size={16} />
                    </button>
                    <button onClick={exportCSV} className="px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-600 hover:text-blue-600 hover:border-blue-300 transition-all text-sm font-semibold flex items-center gap-2 shadow-sm">
                        <FiDownload size={14} /> Export
                    </button>
                    <button onClick={() => { setShowImportModal(true); setImportFile(null); setImportStatus('idle'); setImportErrors([]); setImportProgress(0); setImportMode('add_new'); }} className="px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-600 hover:text-emerald-600 hover:border-emerald-300 transition-all text-sm font-semibold flex items-center gap-2 shadow-sm">
                        <FiUpload size={14} /> Import
                    </button>
                    <button onClick={openAddModal} className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-2xl shadow-lg shadow-blue-300/40 hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-300">
                        <FiPlus size={16} strokeWidth={3} /> Add Product
                    </button>
                </div>
            </div>

            {/* ━━━ PREMIUM STAT CARDS ━━━ */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Products */}
                <div className="relative overflow-hidden rounded-2xl bg-white border border-blue-100 p-5 shadow-sm hover:shadow-xl transition-all group">
                    <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 opacity-60 group-hover:scale-125 transition-transform" />
                    <div className="relative flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-blue-500 uppercase tracking-wider">Total Products</p>
                            <p className="text-3xl font-black text-gray-800 mt-1">{products.length}</p>
                            <p className="text-[10px] text-gray-400 mt-1">All items in database</p>
                        </div>
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-300/30 group-hover:scale-110 transition-transform">
                            <FiPackage className="text-white" size={22} />
                        </div>
                    </div>
                </div>
                {/* Active SKUs */}
                <div className="relative overflow-hidden rounded-2xl bg-white border border-emerald-100 p-5 shadow-sm hover:shadow-xl transition-all group">
                    <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-gradient-to-br from-emerald-100 to-green-50 opacity-60 group-hover:scale-125 transition-transform" />
                    <div className="relative flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Active SKUs</p>
                            <p className="text-3xl font-black text-gray-800 mt-1">{products.filter(p => p.active).length}</p>
                            <p className="text-[10px] text-gray-400 mt-1">Available for sale</p>
                        </div>
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-300/30 group-hover:scale-110 transition-transform">
                            <FiCheck className="text-white" size={22} />
                        </div>
                    </div>
                </div>
                {/* Categories */}
                <div className="relative overflow-hidden rounded-2xl bg-white border border-purple-100 p-5 shadow-sm hover:shadow-xl transition-all group">
                    <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-gradient-to-br from-purple-100 to-violet-50 opacity-60 group-hover:scale-125 transition-transform" />
                    <div className="relative flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-purple-500 uppercase tracking-wider">Categories</p>
                            <p className="text-3xl font-black text-gray-800 mt-1">{categories.length}</p>
                            <p className="text-[10px] text-gray-400 mt-1">Product groups</p>
                        </div>
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-lg shadow-purple-300/30 group-hover:scale-110 transition-transform">
                            <FiLayers className="text-white" size={22} />
                        </div>
                    </div>
                </div>
                {/* Low Inventory */}
                <div className={`relative overflow-hidden rounded-2xl bg-white border p-5 shadow-sm hover:shadow-xl transition-all group ${lowStock > 0 ? 'border-red-100' : 'border-teal-100'}`}>
                    <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-60 group-hover:scale-125 transition-transform ${lowStock > 0 ? 'bg-gradient-to-br from-red-100 to-orange-50' : 'bg-gradient-to-br from-teal-100 to-cyan-50'}`} />
                    <div className="relative flex items-center justify-between">
                        <div>
                            <p className={`text-xs font-bold uppercase tracking-wider ${lowStock > 0 ? 'text-red-500' : 'text-teal-500'}`}>Low Inventory</p>
                            <p className="text-3xl font-black text-gray-800 mt-1">{lowStock}</p>
                            <p className="text-[10px] text-gray-400 mt-1">{lowStock > 0 ? 'Items need restock' : 'All stocked well'}</p>
                        </div>
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform ${lowStock > 0 ? 'bg-gradient-to-br from-red-500 to-orange-600 shadow-red-300/30' : 'bg-gradient-to-br from-teal-500 to-cyan-600 shadow-teal-300/30'}`}>
                            <FiAlertTriangle className="text-white" size={22} />
                        </div>
                    </div>
                </div>
            </div>

            {/* ━━━ STOCK VALUATION CARDS ━━━ */}
            {showValuation && <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Stock Value - Cost */}
                <div className="rounded-2xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 p-5 text-white shadow-lg shadow-blue-400/20 hover:shadow-xl transition-all relative overflow-hidden">
                    <div className="absolute right-3 top-3 w-16 h-16 rounded-full bg-white/10 blur-lg" />
                    <div className="absolute right-8 bottom-2 opacity-10"><FiDollarSign size={70} /></div>
                    <p className="text-xs font-bold text-blue-200 uppercase tracking-wider">Stock Value — Purchase Cost</p>
                    <p className="text-3xl font-black mt-2">Ksh {stockValCost.toLocaleString()}</p>
                    <div className="flex items-center gap-2 mt-2"><FiTrendingUp size={14} className="text-blue-200" /><span className="text-xs text-blue-200">Total cost of all stock at buying price</span></div>
                </div>
                {/* Stock Value - Sales */}
                <div className="rounded-2xl bg-gradient-to-br from-emerald-500 via-green-600 to-teal-700 p-5 text-white shadow-lg shadow-emerald-400/20 hover:shadow-xl transition-all relative overflow-hidden">
                    <div className="absolute right-3 top-3 w-16 h-16 rounded-full bg-white/10 blur-lg" />
                    <div className="absolute right-8 bottom-2 opacity-10"><FiTrendingUp size={70} /></div>
                    <p className="text-xs font-bold text-emerald-200 uppercase tracking-wider">Stock Value — Sales Rate</p>
                    <p className="text-3xl font-black mt-2">Ksh {stockValSales.toLocaleString()}</p>
                    <div className="flex items-center gap-2 mt-2"><FiTrendingUp size={14} className="text-emerald-200" /><span className="text-xs text-emerald-200">Total value if all stock sold at sell price</span></div>
                </div>
                {/* Potential Profit */}
                <div className="rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 p-5 text-white shadow-lg shadow-orange-400/20 hover:shadow-xl transition-all relative overflow-hidden">
                    <div className="absolute right-3 top-3 w-16 h-16 rounded-full bg-white/10 blur-lg" />
                    <div className="absolute right-8 bottom-2 opacity-10"><FiZap size={70} /></div>
                    <p className="text-xs font-bold text-amber-100 uppercase tracking-wider">Potential Profit</p>
                    <p className="text-3xl font-black mt-2">Ksh {potentialProfit.toLocaleString()}</p>
                    <div className="flex items-center gap-2 mt-2"><FiZap size={14} className="text-amber-100" /><span className="text-xs text-amber-100">Profit if all stock sold • Margin: {stockValCost > 0 ? ((potentialProfit / stockValCost) * 100).toFixed(1) : '0'}%</span></div>
                </div>
            </div>}

            {/* ━━━ SEARCH & FILTER BAR ━━━ */}
            <div className="glass-card p-4 flex flex-col lg:flex-row gap-3 items-center">
                <div className="flex-1 relative w-full">
                    <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input type="text" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                        placeholder="Search by name, code, or barcode..."
                        className="w-full px-5 py-3 pl-12 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-400/20 transition-all" />
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <FiFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <select value={filterCategory} onChange={e => { setFilterCategory(e.target.value); setPage(1); }}
                            className="pl-9 pr-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-400/20 text-sm font-medium cursor-pointer min-w-[150px]">
                            <option value="All">All Categories</option>
                            {categories.map(c => <option key={c.category_id} value={c.category_name}>{c.category_name}</option>)}
                        </select>
                    </div>
                    <div className="flex rounded-xl overflow-hidden border-2 border-gray-200 bg-white">
                        <button onClick={() => setViewMode('list')} className={`p-3 transition-all ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-blue-500'}`}><FiList size={16} /></button>
                        <button onClick={() => setViewMode('grid')} className={`p-3 transition-all ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-blue-500'}`}><FiGrid size={16} /></button>
                    </div>
                    <button
                        onClick={() => setShowValuation(!showValuation)}
                        className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 font-semibold text-sm transition-all ${showValuation ? 'bg-indigo-500 text-white border-indigo-500 shadow-md shadow-indigo-300/30' : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-400 hover:text-indigo-600'}`}
                        title={showValuation ? 'Hide Valuation Columns' : 'Show Valuation Columns'}
                    >
                        <FiEye size={16} />
                        {showValuation ? 'Hide Valuation' : 'Show Valuation'}
                    </button>
                </div>
            </div>

            {/* ━━━ CONTENT ━━━ */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-14 h-14 border-4 border-blue-200 border-t-indigo-600 rounded-full animate-spin" />
                    <p className="mt-4 text-gray-500 font-medium text-sm">Loading products...</p>
                </div>
            ) : paginated.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 glass-card">
                    <FiPackage className="text-gray-300" size={64} />
                    <p className="mt-4 text-gray-500 font-semibold">No products found</p>
                    <button onClick={openAddModal} className="mt-3 px-5 py-2 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 transition-all text-sm">Add First Product</button>
                </div>
            ) : viewMode === 'grid' ? (
                /* ── CARD GRID VIEW ── */
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {paginated.map(p => {
                        const stk = stockData[p.pid] || 0;
                        return (
                            <div key={p.pid} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                                {/* Card image/color */}
                                <div className={`h-32 bg-gradient-to-br ${p.button_ui_color || 'from-blue-400 to-blue-600'} relative flex items-center justify-center`}>
                                    {p.photo ? (
                                        <img src={p.photo} alt={p.product_name} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).src = '/no-image.png'; }} />
                                    ) : (
                                        <img src="/no-image.png" alt="No image" className="h-[110px] w-[110px] object-contain" />
                                    )}
                                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => openEditModal(p)} className="p-1.5 bg-white/90 rounded-lg text-blue-600 hover:bg-white shadow-sm"><FiEdit2 size={12} /></button>
                                        <button onClick={() => deleteProduct(p)} className="p-1.5 bg-white/90 rounded-lg text-red-500 hover:bg-white shadow-sm"><FiTrash2 size={12} /></button>
                                    </div>
                                    <span className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${p.active ? 'bg-emerald-500 text-white' : 'bg-gray-500 text-white'}`}>{p.active ? 'ACTIVE' : 'OFF'}</span>
                                </div>
                                <div className="p-3">
                                    <p className="text-sm font-bold text-gray-900 truncate">{p.product_name}</p>
                                    <div className="flex items-center justify-between mt-1">
                                        <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{p.product_code}</span>
                                        <span className="text-[10px] font-medium text-gray-400">{p.category || 'N/A'}</span>
                                    </div>
                                    <div className="flex items-center justify-between mt-3">
                                        <p className="text-base font-bold text-gray-900">Ksh {(p.sales_cost || 0).toLocaleString()}</p>
                                        <div className="flex flex-col items-end gap-0.5">
                                            {(bagStockData[p.pid] || 0) > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">📦 {bagStockData[p.pid]} {p.purchase_unit}</span>}
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${(pieceStockData[p.pid] || 0) > 0 ? 'bg-emerald-100 text-emerald-700' : stk <= 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>🔢 {pieceStockData[p.pid] || 0} {p.sales_unit}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* ── LIST/TABLE VIEW ── */
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gradient-to-r from-blue-500 to-blue-600">
                                    <th className="px-4 py-3.5 text-left text-[11px] font-bold text-indigo-100 uppercase tracking-wider">Product</th>
                                    <th className="px-4 py-3.5 text-left text-[11px] font-bold text-indigo-100 uppercase tracking-wider hidden md:table-cell">Category</th>
                                    <th className="px-4 py-3.5 text-right text-[11px] font-bold text-indigo-100 uppercase tracking-wider">Buy Price</th>
                                    <th className="px-4 py-3.5 text-right text-[11px] font-bold text-indigo-100 uppercase tracking-wider">Sell Price</th>
                                    <th className="px-4 py-3.5 text-right text-[11px] font-bold text-indigo-100 uppercase tracking-wider hidden lg:table-cell">Wholesale</th>
                                    <th className="px-4 py-3.5 text-center text-[11px] font-bold text-indigo-100 uppercase tracking-wider">Stock</th>
                                    <th className="px-4 py-3.5 text-center text-[11px] font-bold text-indigo-100 uppercase tracking-wider hidden lg:table-cell">Margin</th>
                                    <th className="px-4 py-3.5 text-center text-[11px] font-bold text-indigo-100 uppercase tracking-wider">Batches / Expiry</th>
                                    <th className="px-4 py-3.5 text-center text-[11px] font-bold text-indigo-100 uppercase tracking-wider">Status</th>
                                    <th className="px-4 py-3.5 text-center text-[11px] font-bold text-indigo-100 uppercase tracking-wider w-28">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginated.map((p, idx) => {
                                    const stk = stockData[p.pid] || 0;
                                    const pBatches = productBatches[p.pid] || [];
                                    const nearestBatch = pBatches[0];
                                    const nearestDays = nearestBatch ? getDaysUntilExpiry(nearestBatch.expiry_date) : null;
                                    return (
                                        <>
                                        <tr key={p.pid} className={`border-b border-gray-50 hover:bg-blue-50/40 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    {p.photo ? (
                                                        <div className="w-10 h-10 rounded-xl overflow-hidden border border-gray-200 flex-shrink-0 shadow-sm">
                                                            <img src={p.photo} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).src = '/no-image.png'; }} />
                                                        </div>
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-xl overflow-hidden border border-gray-200 flex-shrink-0 bg-gray-50">
                                                            <img src="/no-image.png" alt="No image" className="w-full h-full object-contain" />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="text-sm font-semibold text-gray-900">{p.product_name}</p>
                                                        <p className="text-[11px] text-blue-600 font-medium">{p.product_code}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 hidden md:table-cell">
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-700 rounded-lg text-[11px] font-semibold">
                                                    <FiTag size={10} /> {p.category || 'N/A'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right text-xs text-gray-500 font-medium">Ksh {(p.purchase_cost || 0).toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">Ksh {(p.sales_cost || 0).toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right text-xs text-purple-600 font-semibold hidden lg:table-cell">{(p as any).wholesale_price ? `Ksh ${((p as any).wholesale_price || 0).toLocaleString()}` : '-'}</td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex flex-col items-center gap-0.5">
                                                    {(bagStockData[p.pid] || 0) > 0 && (
                                                        <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-700">📦 {bagStockData[p.pid]} {p.purchase_unit}</span>
                                                    )}
                                                    <span className={`inline-block min-w-[36px] px-2 py-0.5 rounded-md text-[10px] font-bold ${(pieceStockData[p.pid] || 0) > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>🔢 {pieceStockData[p.pid] || 0} {p.sales_unit}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center hidden lg:table-cell">
                                                <div className="flex items-center justify-center gap-1">
                                                    <FiTrendingUp size={11} className={(p.margin_per || 0) >= 20 ? 'text-emerald-500' : 'text-red-400'} />
                                                    <span className={`text-xs font-bold ${(p.margin_per || 0) >= 30 ? 'text-emerald-600' : (p.margin_per || 0) >= 15 ? 'text-amber-600' : 'text-red-600'}`}>{p.margin_per?.toFixed(1) || '0'}%</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {pBatches.length > 0 ? (
                                                    <button onClick={() => { const s = new Set(expandedRows); if (s.has(p.pid)) s.delete(p.pid); else s.add(p.pid); setExpandedRows(s); }}
                                                        className="flex items-center gap-1.5 mx-auto px-2.5 py-1 rounded-lg hover:bg-blue-50 transition-all group">
                                                        <div className="flex flex-col items-center gap-0.5">
                                                            <span className="text-xs font-semibold text-gray-600 group-hover:text-blue-600">{pBatches.length} batch{pBatches.length > 1 ? 'es' : ''}</span>
                                                            {nearestDays !== null && getExpiryBadge(nearestDays)}
                                                        </div>
                                                        <FiChevronRight size={14} className={`text-gray-400 transition-transform duration-200 ${expandedRows.has(p.pid) ? 'rotate-90' : ''}`} />
                                                    </button>
                                                ) : <span className="text-xs text-gray-300">No batches</span>}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${p.active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${p.active ? 'bg-emerald-500' : 'bg-gray-400'}`} />{p.active ? 'Live' : 'Off'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-center gap-1 flex-wrap">
                                                    <button onClick={() => openEditModal(p)} className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all" title="Edit"><FiEdit2 size={12} /></button>
                                                    <button onClick={() => openStockHistory(p)} className="p-1.5 rounded-lg bg-cyan-50 text-cyan-600 hover:bg-cyan-100 transition-all" title="Stock History"><FiClock size={12} /></button>
                                                    <button onClick={() => openPriceHistory(p)} className="p-1.5 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition-all" title="Price History"><FiTrendingUp size={12} /></button>
                                                    <button onClick={() => openStockAdjust(p)} className="p-1.5 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 transition-all" title="Stock Adjust"><FiSliders size={12} /></button>
                                                    <button onClick={() => deleteProduct(p)} className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-all" title="Delete"><FiTrash2 size={12} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                        {/* ── EXPANDED BATCH DETAILS ROW ── */}
                                        {expandedRows.has(p.pid) && pBatches.length > 0 && (
                                            <tr key={`batch-${p.pid}`} className="bg-blue-50/40">
                                                <td colSpan={10} className="px-6 py-3">
                                                    <div className="bg-white rounded-xl border border-blue-200 shadow-sm overflow-hidden">
                                                        <div className="bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-2 text-white text-xs font-bold flex items-center gap-2">
                                                            <FiPackage size={12} /> Batches for {p.product_name}
                                                        </div>
                                                        <table className="w-full text-sm">
                                                            <thead>
                                                                <tr className="bg-gray-50 border-b border-gray-100">
                                                                    <th className="px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">Batch #</th>
                                                                    <th className="px-4 py-2 text-right text-[10px] font-bold text-gray-500 uppercase">Qty</th>
                                                                    <th className="px-4 py-2 text-right text-[10px] font-bold text-gray-500 uppercase">Buy Price</th>
                                                                    <th className="px-4 py-2 text-right text-[10px] font-bold text-gray-500 uppercase">Sell Price</th>
                                                                    <th className="px-4 py-2 text-center text-[10px] font-bold text-gray-500 uppercase">Expiry Date</th>
                                                                    <th className="px-4 py-2 text-center text-[10px] font-bold text-gray-500 uppercase">Days Left</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {pBatches.map((b, bi) => {
                                                                    const daysLeft = getDaysUntilExpiry(b.expiry_date);
                                                                    return (
                                                                        <tr key={bi} className={`border-b border-gray-50 ${daysLeft < 0 ? 'bg-red-50/50' : daysLeft <= 30 ? 'bg-orange-50/30' : ''}`}>
                                                                            <td className="px-4 py-2 text-xs font-semibold text-gray-800">{b.batch_number || 'N/A'}</td>
                                                                            <td className="px-4 py-2 text-right text-xs font-bold text-gray-700">{b.remaining_qty ?? b.quantity}</td>
                                                                            <td className="px-4 py-2 text-right text-xs text-gray-500">Ksh {(b.purchase_cost || 0).toLocaleString()}</td>
                                                                            <td className="px-4 py-2 text-right text-xs font-semibold text-gray-700">Ksh {(b.selling_price || 0).toLocaleString()}</td>
                                                                            <td className="px-4 py-2 text-center text-xs text-gray-600">{b.expiry_date ? new Date(b.expiry_date).toLocaleDateString('en-GB') : 'N/A'}</td>
                                                                            <td className="px-4 py-2 text-center">{getExpiryBadge(daysLeft)}</td>
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

            {/* ━━━ FLOATING PAGINATION FOOTER ━━━ */}
            <div className="sticky bottom-0 z-30 bg-white/95 backdrop-blur-md border-t border-gray-200 rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-5 py-3 -mx-5 mt-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500">Showing</span>
                        <select value={perPage} onChange={e => { setPerPage(parseInt(e.target.value)); setPage(1); }} className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold focus:border-blue-500 outline-none">
                            {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                        <span className="text-sm text-gray-500">of <span className="font-bold text-gray-800">{filtered.length}</span> products</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button onClick={() => setPage(1)} disabled={page === 1} className="p-2 rounded-lg bg-gray-50 border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-300 disabled:opacity-30 transition-all" title="First"><FiChevronsLeft size={14} /></button>
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg bg-gray-50 border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-300 disabled:opacity-30 transition-all" title="Previous"><FiChevronLeft size={14} /></button>
                        {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                            const start = Math.max(1, Math.min(page - 3, totalPages - 6));
                            const pg = start + i; if (pg > totalPages) return null;
                            return (
                                <button key={pg} onClick={() => setPage(pg)}
                                    className={`w-9 h-9 rounded-lg text-xs font-bold transition-all ${pg === page ? 'bg-blue-500 text-white shadow-md shadow-blue-300/30' : 'bg-gray-50 border border-gray-200 text-gray-600 hover:text-blue-600 hover:border-blue-300'}`}>{pg}</button>
                            );
                        })}
                        <button onClick={() => setPage(p => Math.min(totalPages || 1, p + 1))} disabled={page >= totalPages} className="p-2 rounded-lg bg-gray-50 border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-300 disabled:opacity-30 transition-all" title="Next"><FiChevronRight size={14} /></button>
                        <button onClick={() => setPage(totalPages || 1)} disabled={page >= totalPages} className="p-2 rounded-lg bg-gray-50 border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-300 disabled:opacity-30 transition-all" title="Last"><FiChevronsRight size={14} /></button>
                    </div>
                    <span className="text-sm text-gray-400">Page <span className="font-bold text-gray-700">{page}</span> of <span className="font-bold text-gray-700">{totalPages || 1}</span></span>
                </div>
            </div>

            {/* ━━━ ADD/EDIT PRODUCT MODAL (Original Pharmacy) ━━━ */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-y-auto">
                        {/* Modal Header */}
                        <div className="bg-gradient-to-r from-teal-500 to-cyan-600 px-6 py-4 text-white rounded-t-3xl flex items-center justify-between sticky top-0 z-10">
                            <h2 className="text-lg font-bold flex items-center gap-2">💊 {editingProduct ? 'Edit' : 'Add New'} Product / Drug</h2>
                            <button onClick={() => { setShowModal(false); }} className="p-2 hover:bg-white/20 rounded-lg"><FiX size={18} /></button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* 1. Basic Info */}
                            <div>
                                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <span className="w-6 h-6 rounded bg-teal-100 flex items-center justify-center text-xs">1</span>
                                    Basic Information
                                </h3>
                                <div className="grid grid-cols-4 gap-3">
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Code</label>
                                        <input type="text" value={formData.barcode} readOnly
                                            className="w-full px-3 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm" />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Product / Drug Name *</label>
                                        <input type="text" value={formData.product_name} onChange={e => setFormData({ ...formData, product_name: e.target.value })}
                                            placeholder="e.g. Paracetamol 500mg" className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Barcode</label>
                                        <input type="text" value={formData.barcode} onChange={e => setFormData({ ...formData, barcode: e.target.value })}
                                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm" />
                                    </div>
                                </div>
                            </div>

                            {/* 2. Drug Details */}
                            <div>
                                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <span className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center text-xs">2</span>
                                    Drug Details
                                </h3>
                                <div className="grid grid-cols-4 gap-3">
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Generic Name</label>
                                        <input type="text" value={pharmForm.generic_name} onChange={e => setPharmForm({ ...pharmForm, generic_name: e.target.value })}
                                            placeholder="e.g. Paracetamol" className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Drug Type</label>
                                        <select value={pharmForm.drug_type} onChange={e => setPharmForm({ ...pharmForm, drug_type: e.target.value })}
                                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm cursor-pointer">
                                            {DRUG_TYPES.map(t => <option key={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Dosage</label>
                                        <input type="text" value={pharmForm.dosage} onChange={e => setPharmForm({ ...pharmForm, dosage: e.target.value })}
                                            placeholder="e.g. 500mg" className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Manufacturer</label>
                                        <input type="text" value={pharmForm.manufacturer} onChange={e => setPharmForm({ ...pharmForm, manufacturer: e.target.value })}
                                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Category</label>
                                        <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}
                                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm cursor-pointer">
                                            <option value="">Select Category</option>
                                            {categories.map(c => <option key={c.category_id} value={c.category_name}>{c.category_name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Storage</label>
                                        <input type="text" value={pharmForm.storage_conditions} onChange={e => setPharmForm({ ...pharmForm, storage_conditions: e.target.value })}
                                            placeholder="e.g. Below 25°C" className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm" />
                                    </div>
                                    <div className="flex items-end gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" checked={pharmForm.requires_prescription} onChange={e => setPharmForm({ ...pharmForm, requires_prescription: e.target.checked })} className="accent-red-500 w-4 h-4" />
                                            <span className="text-sm font-semibold text-red-600">℞ Prescription</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" checked={formData.show_ps} onChange={e => setFormData({ ...formData, show_ps: e.target.checked })} className="accent-teal-500 w-4 h-4" />
                                            <span className="text-sm text-gray-600">POS</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* 3. Pricing, Units & Margin */}
                            <div>
                                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <span className="w-6 h-6 rounded bg-green-100 flex items-center justify-center text-xs">3</span>
                                    Pricing, Units & Margin
                                </h3>
                                <div className="grid grid-cols-6 gap-3">
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Purchase Unit</label>
                                        <select value={formData.purchase_unit} onChange={e => setFormData({ ...formData, purchase_unit: e.target.value })}
                                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm">
                                            {['Piece','Tablet','Capsule','Strip','Box','Pack','Bottle','Tube','Sachet','Vial','Ampoule','Carton','Dozen','Kilogram','Gram','Liter','Milliliter'].map(u => <option key={u}>{u}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Sales Unit</label>
                                        <select value={formData.sales_unit} onChange={e => setFormData({ ...formData, sales_unit: e.target.value })}
                                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm">
                                            {['Piece','Tablet','Capsule','Strip','Box','Pack','Bottle','Tube','Sachet','Vial','Ampoule','Carton','Dozen','Kilogram','Gram','Liter','Milliliter'].map(u => <option key={u}>{u}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Purchase Cost *</label>
                                        <input type="number" value={formData.purchase_cost} onChange={e => setFormData({ ...formData, purchase_cost: Number(e.target.value) })}
                                            min={0} step={0.01} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Selling Price *</label>
                                        <input type="number" value={formData.sales_cost} onChange={e => setFormData({ ...formData, sales_cost: Number(e.target.value) })}
                                            min={0} step={0.01} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Wholesale</label>
                                        <input type="number" value={formData.wholesale_price} onChange={e => setFormData({ ...formData, wholesale_price: Number(e.target.value) })}
                                            min={0} step={0.01} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Pcs/Package</label>
                                        <input type="number" value={formData.pieces_per_package} onChange={e => setFormData({ ...formData, pieces_per_package: Number(e.target.value) })}
                                            min={1} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm" />
                                    </div>
                                </div>
                                {/* Comprehensive Profit & Margin Breakdown */}
                                {formData.purchase_cost > 0 && (() => {
                                    const ppp = formData.pieces_per_package || 1;
                                    const pkgLabel = formData.purchase_unit || 'Box';
                                    const pieceLabel = formData.sales_unit || 'Piece';
                                    const isDiffUnit = formData.purchase_unit !== formData.sales_unit && ppp > 1;

                                    // Per Package (Box/Bag/Carton)
                                    const costPerPkg = formData.purchase_cost;
                                    const sellPerPkg = isDiffUnit ? formData.sales_cost * ppp : formData.sales_cost;
                                    const profitPerPkg = sellPerPkg - costPerPkg;
                                    const marginPkg = sellPerPkg > 0 ? (profitPerPkg / sellPerPkg) * 100 : 0;
                                    const markupPkg = costPerPkg > 0 ? (profitPerPkg / costPerPkg) * 100 : 0;

                                    // Per Piece
                                    const costPerPiece = isDiffUnit ? formData.purchase_cost / ppp : formData.purchase_cost;
                                    const sellPerPiece = formData.sales_cost;
                                    const profitPerPiece = sellPerPiece - costPerPiece;
                                    const marginPiece = sellPerPiece > 0 ? (profitPerPiece / sellPerPiece) * 100 : 0;
                                    const markupPiece = costPerPiece > 0 ? (profitPerPiece / costPerPiece) * 100 : 0;

                                    const overallMargin = isDiffUnit ? marginPiece : marginPkg;

                                    return (
                                        <div className={`mt-3 rounded-xl border-2 overflow-hidden ${overallMargin >= 20 ? 'border-green-200' : overallMargin >= 10 ? 'border-yellow-200' : overallMargin > 0 ? 'border-orange-200' : 'border-red-200'}`}>
                                            {/* Header */}
                                            <div className={`px-4 py-2 flex items-center justify-between ${overallMargin >= 20 ? 'bg-green-600' : overallMargin >= 10 ? 'bg-yellow-500' : overallMargin > 0 ? 'bg-orange-500' : 'bg-red-500'}`}>
                                                <span className="text-white text-xs font-bold uppercase tracking-wider">📊 Profit & Margin Breakdown</span>
                                                <span className="text-white text-xs font-bold">
                                                    {overallMargin < 0 ? '⚠️ Selling below cost!' : overallMargin >= 20 ? '✅ Good margin' : overallMargin > 0 ? '⚠️ Low margin' : '⚠️ No profit'}
                                                </span>
                                            </div>
                                            {/* Table */}
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="bg-gray-50 border-b border-gray-100">
                                                        <th className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase">Level</th>
                                                        <th className="px-3 py-2.5 text-right text-[10px] font-bold text-gray-500 uppercase">Cost</th>
                                                        <th className="px-3 py-2.5 text-right text-[10px] font-bold text-gray-500 uppercase">Selling</th>
                                                        <th className="px-3 py-2.5 text-right text-[10px] font-bold text-gray-500 uppercase">Profit</th>
                                                        <th className="px-3 py-2.5 text-right text-[10px] font-bold text-gray-500 uppercase">Margin %</th>
                                                        <th className="px-3 py-2.5 text-right text-[10px] font-bold text-gray-500 uppercase">Markup %</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {/* Per Package Row */}
                                                    <tr className={`border-b border-gray-50 ${isDiffUnit ? '' : 'bg-blue-50/50'}`}>
                                                        <td className="px-4 py-2.5">
                                                            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-lg">📦 Per {pkgLabel}</span>
                                                        </td>
                                                        <td className="px-3 py-2.5 text-right font-mono font-bold text-gray-700">KES {costPerPkg.toLocaleString()}</td>
                                                        <td className="px-3 py-2.5 text-right font-mono font-bold text-blue-700">KES {sellPerPkg.toLocaleString()}</td>
                                                        <td className={`px-3 py-2.5 text-right font-mono font-black ${profitPerPkg >= 0 ? 'text-green-700' : 'text-red-700'}`}>KES {profitPerPkg.toLocaleString()}</td>
                                                        <td className={`px-3 py-2.5 text-right font-bold ${marginPkg >= 20 ? 'text-green-700' : marginPkg > 0 ? 'text-orange-600' : 'text-red-700'}`}>{marginPkg.toFixed(1)}%</td>
                                                        <td className="px-3 py-2.5 text-right font-bold text-gray-600">{markupPkg.toFixed(1)}%</td>
                                                    </tr>
                                                    {/* Per Piece Row - only show if different units */}
                                                    {isDiffUnit && (
                                                        <tr className="bg-emerald-50/50">
                                                            <td className="px-4 py-2.5">
                                                                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg">💊 Per {pieceLabel}</span>
                                                            </td>
                                                            <td className="px-3 py-2.5 text-right font-mono font-bold text-gray-700">KES {costPerPiece.toFixed(2)}</td>
                                                            <td className="px-3 py-2.5 text-right font-mono font-bold text-blue-700">KES {sellPerPiece.toLocaleString()}</td>
                                                            <td className={`px-3 py-2.5 text-right font-mono font-black ${profitPerPiece >= 0 ? 'text-green-700' : 'text-red-700'}`}>KES {profitPerPiece.toFixed(2)}</td>
                                                            <td className={`px-3 py-2.5 text-right font-bold ${marginPiece >= 20 ? 'text-green-700' : marginPiece > 0 ? 'text-orange-600' : 'text-red-700'}`}>{marginPiece.toFixed(1)}%</td>
                                                            <td className="px-3 py-2.5 text-right font-bold text-gray-600">{markupPiece.toFixed(1)}%</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                            {/* Summary Footer */}
                                            {isDiffUnit && (
                                                <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                                                    <span>💡 1 {pkgLabel} = {ppp} {pieceLabel}s | Cost/piece = {costPerPkg.toLocaleString()} ÷ {ppp} = KES {costPerPiece.toFixed(2)}</span>
                                                    <span className={`font-bold ${overallMargin >= 20 ? 'text-green-600' : 'text-orange-600'}`}>
                                                        Overall: {overallMargin.toFixed(1)}% margin
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* 4. Batch Datagrid */}
                            <div>
                                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <span className="w-6 h-6 rounded bg-purple-100 flex items-center justify-center text-xs">4</span>
                                    Batches & Expiry Dates
                                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs ml-2">{batches.length} batch{batches.length !== 1 ? 'es' : ''}</span>
                                </h3>

                                {/* Add Batch Row */}
                                <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 mb-3">
                                    <div className="grid grid-cols-7 gap-2 items-end">
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Batch # *</label>
                                            <input type="text" value={newBatch.batch_number} onChange={e => setNewBatch({ ...newBatch, batch_number: e.target.value })}
                                                placeholder="B001" className="w-full px-2 py-2 bg-white border border-gray-200 rounded-lg text-sm" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Expiry Date *</label>
                                            <input type="date" value={newBatch.expiry_date} onChange={e => setNewBatch({ ...newBatch, expiry_date: e.target.value })}
                                                className="w-full px-2 py-2 bg-white border border-gray-200 rounded-lg text-sm" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Mfg Date</label>
                                            <input type="date" value={newBatch.manufacture_date} onChange={e => setNewBatch({ ...newBatch, manufacture_date: e.target.value })}
                                                className="w-full px-2 py-2 bg-white border border-gray-200 rounded-lg text-sm" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Qty *</label>
                                            <input type="number" value={newBatch.quantity || ''} onChange={e => setNewBatch({ ...newBatch, quantity: Number(e.target.value) })}
                                                min={1} className="w-full px-2 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Buy Price</label>
                                            <input type="number" value={newBatch.purchase_cost || ''} onChange={e => setNewBatch({ ...newBatch, purchase_cost: Number(e.target.value) })}
                                                placeholder={String(formData.purchase_cost)} className="w-full px-2 py-2 bg-white border border-gray-200 rounded-lg text-sm" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Sell Price</label>
                                            <input type="number" value={newBatch.selling_price || ''} onChange={e => setNewBatch({ ...newBatch, selling_price: Number(e.target.value) })}
                                                placeholder={String(formData.sales_cost)} className="w-full px-2 py-2 bg-white border border-gray-200 rounded-lg text-sm" />
                                        </div>
                                        <button onClick={() => {
                                            if (!newBatch.batch_number || !newBatch.expiry_date || newBatch.quantity <= 0) { toast.error('Batch #, expiry date and qty required'); return; }
                                            setBatches(prev => [...prev, { ...newBatch, purchase_cost: newBatch.purchase_cost || formData.purchase_cost, selling_price: newBatch.selling_price || formData.sales_cost }]);
                                            setNewBatch({ batch_number: '', expiry_date: '', manufacture_date: '', quantity: 0, purchase_cost: 0, selling_price: 0 });
                                            toast.success('Batch added');
                                        }} className="py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg font-bold hover:shadow-lg transition-all text-sm">
                                            + Add Batch
                                        </button>
                                    </div>
                                </div>

                                {/* Batch Table */}
                                {batches.length > 0 && (
                                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                                        <table className="w-full">
                                            <thead><tr className="bg-gray-50">
                                                <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">Batch #</th>
                                                <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">Expiry Date</th>
                                                <th className="px-3 py-2 text-center text-[10px] font-bold text-gray-500 uppercase">Expiring In</th>
                                                <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">Mfg Date</th>
                                                <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-500 uppercase">Qty</th>
                                                <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-500 uppercase">Buy</th>
                                                <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-500 uppercase">Sell</th>
                                                <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-500 uppercase">Batch Margin</th>
                                                <th className="px-3 py-2 w-10"></th>
                                            </tr></thead>
                                            <tbody>
                                                {batches.map((b, idx) => {
                                                    const days = getDaysUntilExpiry(b.expiry_date);
                                                    const bCostRaw = b.purchase_cost || formData.purchase_cost;
                                                    const bPpp = formData.pieces_per_package || 1;
                                                    const bCost = formData.purchase_unit !== formData.sales_unit && bPpp > 1 ? bCostRaw / bPpp : bCostRaw;
                                                    const bSell = b.selling_price || formData.sales_cost;
                                                    const bMargin = bSell > 0 ? ((bSell - bCost) / bSell * 100).toFixed(1) : '0';
                                                    const bProfit = bSell - bCost;
                                                    return (
                                                        <tr key={idx} className={`border-b border-gray-50 ${days < 0 ? 'bg-red-50' : days <= 30 ? 'bg-orange-50' : ''}`}>
                                                            <td className="px-3 py-2 font-mono text-sm font-bold text-gray-800">{b.batch_number}</td>
                                                            <td className="px-3 py-2 text-sm text-gray-600">{b.expiry_date}</td>
                                                            <td className="px-3 py-2 text-center">{getExpiryBadge(days)}</td>
                                                            <td className="px-3 py-2 text-sm text-gray-400">{b.manufacture_date || '—'}</td>
                                                            <td className="px-3 py-2 text-right text-sm font-bold">{b.remaining_qty !== undefined ? `${b.remaining_qty}/${b.quantity}` : b.quantity}</td>
                                                            <td className="px-3 py-2 text-right text-sm text-gray-600">{bCost.toLocaleString()}</td>
                                                            <td className="px-3 py-2 text-right text-sm font-bold text-green-600">{bSell.toLocaleString()}</td>
                                                            <td className="px-3 py-2 text-right">
                                                                <span className={`text-xs font-bold ${Number(bMargin) >= 20 ? 'text-green-600' : 'text-orange-600'}`}>{bMargin}%</span>
                                                                <span className="text-xs text-gray-400 ml-1">(Ksh {bProfit.toLocaleString()})</span>
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <button onClick={async () => {
                                                                    if (b.batch_id) {
                                                                        if (!confirm('Delete this saved batch?')) return;
                                                                        await supabase.from('pharmacy_batches').update({ status: 'Deleted' }).eq('batch_id', b.batch_id);
                                                                        toast.success('Batch deleted');
                                                                    }
                                                                    setBatches(prev => prev.filter((_, i) => i !== idx));
                                                                }} className="p-1 hover:bg-red-100 rounded text-red-400" title="Delete batch"><FiTrash2 size={14} /></button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                                {batches.length === 0 && (
                                    <div className="text-center py-6 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                                        <p className="text-sm">📦 No batches added yet</p>
                                        <p className="text-xs mt-1">Add batches above with expiry dates for proper tracking</p>
                                    </div>
                                )}
                            </div>

                            {/* Save / Cancel */}
                            <div className="flex gap-3 pt-4 border-t border-gray-100">
                                <button onClick={() => { setShowModal(false); }} className="flex-1 py-3 border-2 border-gray-200 rounded-xl text-gray-500 font-bold hover:bg-gray-50">Cancel</button>
                                <button onClick={async () => {
                                    if (!formData.product_name.trim()) { toast.error('Product name required'); return; }
                                    setIsSaving(true);
                                    try {
                                        const costPerPiece = formData.purchase_cost / (formData.pieces_per_package || 1);
                                        const marginPer = formData.sales_cost > 0 ? Math.round(((formData.sales_cost - costPerPiece) / formData.sales_cost) * 10000) / 100 : 0;
                                        const d = {
                                            product_name: formData.product_name, barcode: formData.barcode || null,
                                            category: formData.category || null, purchase_unit: formData.purchase_unit,
                                            sales_unit: formData.sales_unit, purchase_cost: formData.purchase_cost || 0,
                                            sales_cost: formData.sales_cost || 0, wholesale_price: formData.wholesale_price || 0,
                                            reorder_point: formData.reorder_point || 10, margin_per: marginPer,
                                            show_in_pos: formData.show_ps !== false, active: formData.active !== false,
                                            pieces_per_package: formData.pieces_per_package || 1,
                                            generic_name: pharmForm.generic_name || null, manufacturer: pharmForm.manufacturer || null,
                                            drug_type: pharmForm.drug_type || 'Tablet', dosage: pharmForm.dosage || null,
                                            requires_prescription: pharmForm.requires_prescription || false,
                                            storage_conditions: pharmForm.storage_conditions || null,
                                        };
                                        let pid: number;
                                        if (editingProduct) {
                                            const { error } = await supabase.from('pharmacy_products').update({ ...d, updated_at: new Date().toISOString() }).eq('pid', editingProduct.pid);
                                            if (error) throw error;
                                            pid = editingProduct.pid;
                                            toast.success('Product updated!');
                                        } else {
                                            const code = await generateProductCode();
                                            const { data: np, error } = await supabase.from('pharmacy_products').insert({ ...d, product_code: code, outlet_id: outletId, created_at: new Date().toISOString() }).select().single();
                                            if (error) throw error;
                                            pid = np.pid;
                                            await supabase.from('pharmacy_stock').insert({ pid, qty: 0, outlet_id: outletId, storage_type: 'Store' });
                                            toast.success(`Product ${code} created!`);
                                        }
                                        // Save new batches
                                        for (const batch of batches) {
                                            if (!batch.batch_id) {
                                                const { data: batchData } = await supabase.from('pharmacy_batches').insert({
                                                    product_id: pid, batch_number: batch.batch_number,
                                                    expiry_date: batch.expiry_date, manufacture_date: batch.manufacture_date || null,
                                                    quantity: batch.quantity, remaining_qty: batch.quantity,
                                                    purchase_cost: batch.purchase_cost || formData.purchase_cost,
                                                    selling_price: batch.selling_price || formData.sales_cost,
                                                    outlet_id: outletId, status: 'Active',
                                                }).select().single();
                                                if (batchData) {
                                                    const { data: stockRow } = await supabase.from('pharmacy_stock')
                                                        .select('st_id, qty').eq('pid', pid).eq('outlet_id', outletId).limit(1).single();
                                                    if (stockRow) {
                                                        await supabase.from('pharmacy_stock').update({ qty: (stockRow.qty || 0) + batch.quantity }).eq('st_id', stockRow.st_id);
                                                    }
                                                }
                                            }
                                        }
                                        setShowModal(false); loadProducts(); loadStockData();
                                    } catch (err: any) { toast.error(err.message || 'Save failed'); }
                                    setIsSaving(false);
                                }} disabled={isSaving} className="flex-1 py-3 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-xl font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                                    {isSaving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</> : <>{editingProduct ? '💾 Update Product' : '💊 Save Product'}</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ━━━ LABEL GENERATOR MODAL ━━━ */}
            {showLabelModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center p-4 z-50" onClick={() => setShowLabelModal(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4 text-white flex items-center justify-between rounded-t-3xl flex-shrink-0">
                            <div className="flex items-center gap-3"><FiPrinter size={20} /><div><h2 className="text-lg font-bold">Label Generator</h2><p className="text-purple-100 text-xs">{labelProducts.length} selected • {labelProducts.reduce((s, id) => s + (labelQty[id] || 1), 0)} total labels</p></div></div>
                            <button onClick={() => setShowLabelModal(false)} className="p-2 hover:bg-white/20 rounded-xl"><FiX size={18} /></button>
                        </div>
                        <div className="flex flex-1 overflow-hidden">
                            {/* LEFT: Product Selection */}
                            <div className="flex-1 p-4 flex flex-col overflow-hidden border-r border-gray-200">
                                {/* Search */}
                                <div className="relative mb-3 flex-shrink-0">
                                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                    <input type="text" value={labelSearch} onChange={e => setLabelSearch(e.target.value)} placeholder="Search or scan barcode..." autoFocus
                                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-purple-500 outline-none" />
                                </div>
                                {/* Size + Select All */}
                                <div className="flex items-center justify-between mb-3 flex-shrink-0">
                                    <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
                                        {(['small', 'medium', 'large'] as const).map(sz => (
                                            <button key={sz} onClick={() => setLabelSize(sz)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${labelSize === sz ? 'bg-purple-500 text-white shadow' : 'text-gray-500 hover:text-purple-600'}`}>{sz.charAt(0).toUpperCase() + sz.slice(1)}</button>
                                        ))}
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => { const ids = filteredLabelProducts.map(p => p.pid); setLabelProducts(ids); const q: Record<number, number> = {}; ids.forEach(id => q[id] = labelQty[id] || 1); setLabelQty(q); }} className="px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg text-xs font-bold">Select All</button>
                                        <button onClick={() => setLabelProducts([])} className="px-3 py-1.5 bg-gray-100 text-gray-500 rounded-lg text-xs font-bold">Clear</button>
                                    </div>
                                </div>
                                {/* Product List */}
                                <div className="flex-1 overflow-y-auto space-y-1.5">
                                    {filteredLabelProducts.map(p => (
                                        <div key={p.pid} className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${labelProducts.includes(p.pid) ? 'border-purple-400 bg-purple-50' : 'border-gray-100 hover:border-purple-200'}`}
                                            onClick={() => { if (labelProducts.includes(p.pid)) { setLabelProducts(labelProducts.filter(id => id !== p.pid)); } else { setLabelProducts([...labelProducts, p.pid]); setLabelQty({ ...labelQty, [p.pid]: labelQty[p.pid] || 1 }); } }}>
                                            <input type="checkbox" checked={labelProducts.includes(p.pid)} readOnly className="w-4 h-4 accent-purple-500 pointer-events-none" />
                                            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${p.button_ui_color || 'from-blue-400 to-blue-600'} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>{p.product_name.charAt(0)}</div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold truncate">{p.product_name}</p>
                                                <p className="text-[10px] text-gray-400">{p.product_code} • {p.barcode || 'No barcode'} • Ksh {(p.sales_cost || 0).toLocaleString()}</p>
                                            </div>
                                            {labelProducts.includes(p.pid) && (
                                                <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                                                    <button onClick={() => setLabelQty({ ...labelQty, [p.pid]: Math.max(1, (labelQty[p.pid] || 1) - 1) })} className="w-7 h-7 rounded-lg bg-purple-200 text-purple-700 font-bold flex items-center justify-center">−</button>
                                                    <input type="number" value={labelQty[p.pid] || 1} onChange={e => setLabelQty({ ...labelQty, [p.pid]: parseInt(e.target.value) || 1 })} min="1" max="200" className="w-12 px-1 py-1 border border-purple-300 rounded-lg text-sm text-center font-bold" />
                                                    <button onClick={() => setLabelQty({ ...labelQty, [p.pid]: (labelQty[p.pid] || 1) + 1 })} className="w-7 h-7 rounded-lg bg-purple-200 text-purple-700 font-bold flex items-center justify-center">+</button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {filteredLabelProducts.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">No products match &quot;{labelSearch}&quot;</p>}
                                </div>
                            </div>
                            {/* RIGHT: Preview */}
                            <div className="w-[340px] p-4 bg-gray-50 flex flex-col flex-shrink-0 overflow-hidden">
                                <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><FiEye size={14} /> Live Preview</h3>
                                <div className="flex-1 overflow-y-auto bg-white rounded-xl border border-gray-200 p-3">
                                    {labelProducts.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-full text-gray-300">
                                            <FiPrinter size={40} />
                                            <p className="mt-2 text-sm">Select products to preview labels</p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap gap-2 justify-center">
                                            {products.filter(p => labelProducts.includes(p.pid)).slice(0, 8).map(p => {
                                                const s = labelSizes[labelSize];
                                                return (
                                                    <div key={p.pid} className="border-2 border-gray-800 rounded-sm flex flex-col justify-between overflow-hidden" style={{ width: '140px', height: labelSize === 'small' ? '80px' : labelSize === 'medium' ? '95px' : '110px', padding: '4px' }}>
                                                        <p className="text-center text-gray-400" style={{ fontSize: `${s.code - 1}px`, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{companyName || 'Alpha Pharmacy'}</p>
                                                        <p className="text-center font-bold leading-tight" style={{ fontSize: `${Math.min(s.name, 11)}px`, textTransform: 'uppercase', overflow: 'hidden', maxHeight: '22px' }}>{p.product_name}</p>
                                                        <p className="text-center font-black font-mono" style={{ fontSize: `${Math.min(s.barcode, 14)}px`, letterSpacing: '2px' }}>{p.barcode || p.product_code}</p>
                                                        <p className="text-center font-black bg-black text-white text-xs rounded-sm" style={{ fontSize: `${Math.min(s.price, 12)}px`, padding: '1px 0' }}>Ksh {(p.sales_cost || 0).toLocaleString()}</p>
                                                        <p className="text-center text-gray-500" style={{ fontSize: '7px' }}>{p.product_code} • ×{labelQty[p.pid] || 1}</p>
                                                    </div>
                                                );
                                            })}
                                            {labelProducts.length > 8 && <p className="text-xs text-gray-400 w-full text-center mt-1">+{labelProducts.length - 8} more...</p>}
                                        </div>
                                    )}
                                </div>
                                <div className="mt-3 space-y-2 flex-shrink-0">
                                    <div className="text-xs text-gray-500 flex justify-between"><span>Label size:</span><span className="font-bold text-purple-600">{labelSizes[labelSize].w} × {labelSizes[labelSize].h}</span></div>
                                    <div className="text-xs text-gray-500 flex justify-between"><span>Total labels:</span><span className="font-bold text-purple-600">{labelProducts.reduce((s, id) => s + (labelQty[id] || 1), 0)}</span></div>
                                    <button onClick={printLabels} disabled={labelProducts.length === 0}
                                        className="w-full py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 hover:shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                                        <FiPrinter size={16} /> Print Labels
                                    </button>
                                    <button onClick={() => setShowLabelModal(false)} className="w-full py-2.5 border-2 border-gray-200 text-gray-600 font-bold rounded-xl text-sm">Close</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ━━━ ITEM LOOKUP MODAL ━━━ */}
            {showLookupModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center p-4 z-50" onClick={() => setShowLookupModal(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-4 text-white flex items-center justify-between rounded-t-3xl">
                            <div className="flex items-center gap-3"><FiEye size={20} /><h2 className="text-lg font-bold">Item Lookup</h2></div>
                            <button onClick={() => setShowLookupModal(false)} className="p-2 hover:bg-white/20 rounded-xl"><FiX size={18} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="flex gap-2">
                                <input type="text" value={lookupQuery} onChange={e => setLookupQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && doLookup()} placeholder="Scan barcode or type name/code..."
                                    className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-green-500 outline-none" autoFocus />
                                <button onClick={doLookup} className="px-5 py-3 bg-green-500 text-white rounded-xl font-bold text-sm"><FiSearch size={16} /></button>
                            </div>
                            {lookupResult && (
                                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
                                    <div className="flex items-start gap-4">
                                        <div className={`w-16 h-16 rounded-xl flex items-center justify-center text-white text-xl font-bold bg-gradient-to-br ${lookupResult.button_ui_color || 'from-blue-400 to-blue-600'} shadow-md`}>
                                            {lookupResult.photo ? <img src={lookupResult.photo} alt="" className="w-full h-full object-cover rounded-xl" /> : lookupResult.product_name.charAt(0)}
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-bold text-gray-900">{lookupResult.product_name}</p>
                                            <p className="text-xs text-blue-600 font-medium">{lookupResult.product_code} • Barcode: {lookupResult.barcode || 'N/A'}</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 mt-4">
                                        <div className="bg-white p-3 rounded-xl border"><p className="text-[10px] text-gray-400 uppercase">Category</p><p className="font-bold text-sm">{lookupResult.category || 'N/A'}</p></div>
                                        <div className="bg-white p-3 rounded-xl border"><p className="text-[10px] text-gray-400 uppercase">Stock</p><div className="space-y-0.5">{(bagStockData[lookupResult.pid] || 0) > 0 && <p className="font-bold text-xs text-indigo-700">📦 {bagStockData[lookupResult.pid]} {lookupResult.purchase_unit}(s)</p>}<p className="font-bold text-xs text-emerald-700">🔢 {pieceStockData[lookupResult.pid] || 0} {lookupResult.sales_unit}(s)</p></div></div>
                                        <div className="bg-white p-3 rounded-xl border"><p className="text-[10px] text-gray-400 uppercase">Buy Price</p><p className="font-bold text-sm">Ksh {(lookupResult.purchase_cost || 0).toLocaleString()} / {lookupResult.purchase_unit}</p></div>
                                        <div className="bg-white p-3 rounded-xl border"><p className="text-[10px] text-gray-400 uppercase">Sell Price</p><p className="font-bold text-sm text-green-700">Ksh {(lookupResult.sales_cost || 0).toLocaleString()} / {lookupResult.sales_unit}</p></div>
                                        <div className="bg-white p-3 rounded-xl border border-purple-100"><p className="text-[10px] text-purple-500 uppercase">Wholesale</p><p className="font-bold text-sm text-purple-700">{(lookupResult as any).wholesale_price ? `Ksh ${((lookupResult as any).wholesale_price || 0).toLocaleString()}` : 'N/A'}</p></div>
                                        <div className="bg-white p-3 rounded-xl border"><p className="text-[10px] text-gray-400 uppercase">Pcs/Package</p><p className="font-bold text-sm">{lookupResult.pieces_per_package || 1}</p></div>
                                        <div className="bg-white p-3 rounded-xl border"><p className="text-[10px] text-gray-400 uppercase">Margin</p><p className="font-bold text-sm">{lookupResult.margin_per?.toFixed(1) || '0'}%</p></div>
                                    </div>
                                    <div className="flex gap-2 mt-4">
                                        <button onClick={() => { setShowLookupModal(false); openEditModal(lookupResult); }} className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold flex items-center justify-center gap-1"><FiEdit2 size={12} /> Edit</button>
                                        <button onClick={() => { setShowLookupModal(false); openStockHistory(lookupResult); }} className="flex-1 px-3 py-2 bg-cyan-50 text-cyan-600 rounded-xl text-xs font-bold flex items-center justify-center gap-1"><FiClock size={12} /> Stock Hx</button>
                                        <button onClick={() => { setShowLookupModal(false); openStockAdjust(lookupResult); }} className="flex-1 px-3 py-2 bg-purple-50 text-purple-600 rounded-xl text-xs font-bold flex items-center justify-center gap-1"><FiSliders size={12} /> Adjust</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ━━━ STOCK HISTORY MODAL ━━━ */}
            {showStockHistoryModal && stockHistoryProduct && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center p-4 z-50" onClick={() => setShowStockHistoryModal(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-4 text-white sticky top-0 z-10 flex items-center justify-between rounded-t-3xl">
                            <div><h2 className="text-lg font-bold flex items-center gap-2"><FiClock size={18} /> Stock History</h2><p className="text-cyan-100 text-xs">{stockHistoryProduct.product_name} ({stockHistoryProduct.product_code})</p></div>
                            <button onClick={() => setShowStockHistoryModal(false)} className="p-2 hover:bg-white/20 rounded-xl"><FiX size={18} /></button>
                        </div>
                        <div className="p-5">
                            {stockHistory.length === 0 ? <p className="text-center text-gray-400 py-10">No stock movements found</p> : (
                                <table className="w-full text-sm">
                                    <thead><tr className="bg-gray-100"><th className="px-3 py-2 text-left text-xs font-bold">Date</th><th className="px-3 py-2 text-left text-xs font-bold">Reference</th><th className="px-3 py-2 text-left text-xs font-bold">Type</th><th className="px-3 py-2 text-right text-xs font-bold text-green-600">In</th><th className="px-3 py-2 text-right text-xs font-bold text-red-600">Out</th><th className="px-3 py-2 text-right text-xs font-bold">Balance</th></tr></thead>
                                    <tbody>{stockHistory.map(r => (
                                        <tr key={r.id} className="border-b border-gray-50 hover:bg-blue-50/30">
                                            <td className="px-3 py-2 text-xs">{r.date}</td><td className="px-3 py-2 text-xs font-medium text-blue-600">{r.ref}</td><td className="px-3 py-2 text-xs">{r.type}</td>
                                            <td className="px-3 py-2 text-right text-xs font-bold text-green-600">{r.qty_in > 0 ? `+${r.qty_in}` : ''}</td>
                                            <td className="px-3 py-2 text-right text-xs font-bold text-red-600">{r.qty_out > 0 ? `-${r.qty_out}` : ''}</td>
                                            <td className="px-3 py-2 text-right text-xs font-bold">{r.balance}</td>
                                        </tr>
                                    ))}</tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ━━━ PRICE HISTORY MODAL ━━━ */}
            {showPriceHistoryModal && priceHistoryProduct && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center p-4 z-50" onClick={() => setShowPriceHistoryModal(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-4 text-white sticky top-0 z-10 flex items-center justify-between rounded-t-3xl">
                            <div><h2 className="text-lg font-bold flex items-center gap-2"><FiTrendingUp size={18} /> Price History</h2><p className="text-amber-100 text-xs">{priceHistoryProduct.product_name}</p></div>
                            <button onClick={() => setShowPriceHistoryModal(false)} className="p-2 hover:bg-white/20 rounded-xl"><FiX size={18} /></button>
                        </div>
                        <div className="p-5">
                            {priceHistory.length === 0 ? <p className="text-center text-gray-400 py-10">No price changes recorded yet</p> : (
                                <table className="w-full text-sm">
                                    <thead><tr className="bg-gray-100"><th className="px-3 py-2 text-left text-xs font-bold">Date</th><th className="px-3 py-2 text-right text-xs font-bold">Old Buy</th><th className="px-3 py-2 text-right text-xs font-bold">New Buy</th><th className="px-3 py-2 text-right text-xs font-bold">Old Sell</th><th className="px-3 py-2 text-right text-xs font-bold">New Sell</th></tr></thead>
                                    <tbody>{priceHistory.map(r => (
                                        <tr key={r.id} className="border-b border-gray-50 hover:bg-amber-50/30">
                                            <td className="px-3 py-2 text-xs">{r.date}</td>
                                            <td className="px-3 py-2 text-right text-xs text-gray-400 line-through">{r.old_buy.toLocaleString()}</td>
                                            <td className="px-3 py-2 text-right text-xs font-bold text-blue-600">{r.new_buy.toLocaleString()}</td>
                                            <td className="px-3 py-2 text-right text-xs text-gray-400 line-through">{r.old_sell.toLocaleString()}</td>
                                            <td className="px-3 py-2 text-right text-xs font-bold text-green-600">{r.new_sell.toLocaleString()}</td>
                                        </tr>
                                    ))}</tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ━━━ STOCK ADJUSTMENT MODAL ━━━ */}
            {showStockAdjustModal && adjustProduct && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center p-4 z-50" onClick={() => setShowStockAdjustModal(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-purple-500 to-indigo-600 px-6 py-4 text-white flex items-center justify-between rounded-t-3xl">
                            <div><h2 className="text-lg font-bold flex items-center gap-2"><FiSliders size={18} /> Stock Adjustment</h2><p className="text-purple-100 text-xs">{adjustProduct.product_name} — 📦 {bagStockData[adjustProduct.pid] || 0} {adjustProduct.purchase_unit}(s) • 🔢 {pieceStockData[adjustProduct.pid] || 0} {adjustProduct.sales_unit}(s)</p></div>
                            <button onClick={() => setShowStockAdjustModal(false)} className="p-2 hover:bg-white/20 rounded-xl"><FiX size={18} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="flex gap-2">
                                <button onClick={() => setAdjustType('add')} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${adjustType === 'add' ? 'bg-green-500 text-white shadow-lg' : 'bg-gray-100 text-gray-500'}`}>➕ Add Stock</button>
                                <button onClick={() => setAdjustType('remove')} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${adjustType === 'remove' ? 'bg-red-500 text-white shadow-lg' : 'bg-gray-100 text-gray-500'}`}>➖ Remove Stock</button>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-indigo-600 mb-1 uppercase">📦 {adjustProduct.purchase_unit}s (Big Qty)</label>
                                    <input type="number" value={adjustBags} onChange={e => setAdjustBags(parseFloat(e.target.value) || 0)} min="0" step="1" placeholder="0"
                                        className="w-full px-4 py-3 bg-indigo-50 border-2 border-indigo-200 rounded-xl text-lg font-bold text-center text-indigo-700 focus:border-indigo-500 outline-none" autoFocus />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-emerald-600 mb-1 uppercase">🔢 {adjustProduct.sales_unit}s (Pieces)</label>
                                    <input type="number" value={adjustPieces} onChange={e => setAdjustPieces(parseFloat(e.target.value) || 0)} min="0" step="1" placeholder="0"
                                        className="w-full px-4 py-3 bg-emerald-50 border-2 border-emerald-200 rounded-xl text-lg font-bold text-center text-emerald-700 focus:border-emerald-500 outline-none" />
                                </div>
                            </div>
                            {(adjustBags > 0 || adjustPieces > 0) && (
                                <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-sm">
                                    {adjustType === 'add' ? '➕' : '➖'}{' '}
                                    {adjustBags > 0 && <><span className="font-bold text-indigo-700">{adjustBags}</span> {adjustProduct.purchase_unit}(s) </>}
                                    {adjustBags > 0 && adjustPieces > 0 && <span className="text-gray-400">+ </span>}
                                    {adjustPieces > 0 && <><span className="font-bold text-emerald-700">{adjustPieces}</span> {adjustProduct.sales_unit}(s)</>}
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Reason (optional)</label>
                                <input type="text" value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="e.g., Damaged goods, Recount..."
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-purple-500 outline-none" />
                            </div>
                            <div className="flex gap-3 pt-3 border-t">
                                <button onClick={() => setShowStockAdjustModal(false)} className="flex-1 px-4 py-3 border-2 border-gray-200 text-gray-600 font-bold rounded-xl text-sm">Cancel</button>
                                <button onClick={submitStockAdjust} className={`flex-1 px-4 py-3 text-white font-bold rounded-xl text-sm ${adjustType === 'add' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}>
                                    {adjustType === 'add' ? '➕ Add Stock' : '➖ Remove Stock'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ━━━ IMPORT PRODUCTS MODAL ━━━ */}
            {showImportModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center p-4 z-50" onClick={() => importStatus !== 'importing' && setShowImportModal(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className={`px-6 py-4 text-white flex items-center justify-between rounded-t-3xl transition-all duration-700 ${importStatus === 'success' ? 'bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 animate-pulse' : importStatus === 'error' ? 'bg-gradient-to-r from-red-500 to-red-600' : 'bg-gradient-to-r from-blue-500 to-indigo-600'}`}>
                            <div className="flex items-center gap-3"><FiUpload size={20} /><h2 className="text-lg font-bold">{importStatus === 'success' ? '🎉 Import Complete!' : importStatus === 'error' ? '❌ Import Failed' : 'Import Products'}</h2></div>
                            {importStatus !== 'importing' && <button onClick={() => setShowImportModal(false)} className="p-2 hover:bg-white/20 rounded-xl"><FiX size={18} /></button>}
                        </div>
                        <div className="p-6 space-y-5">
                            {/* Success State */}
                            {importStatus === 'success' && (
                                <div className="text-center py-4">
                                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-emerald-300/40 animate-bounce">
                                        <FiCheck className="text-white" size={36} />
                                    </div>
                                    <p className="text-2xl font-black text-gray-800">{importSuccessCount} Products Imported!</p>
                                    {importErrors.length > 0 && <p className="text-sm text-amber-600 mt-2">{importErrors.length} items had errors</p>}
                                    <div className="flex gap-3 mt-6">
                                        <button onClick={() => { setShowImportModal(false); }} className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold rounded-xl text-sm">Done</button>
                                    </div>
                                    {importErrors.length > 0 && (
                                        <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3 text-left max-h-32 overflow-y-auto">
                                            <p className="text-xs font-bold text-red-600 mb-1">Errors:</p>
                                            {importErrors.map((e, i) => <p key={i} className="text-xs text-red-500">{e}</p>)}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Error State */}
                            {importStatus === 'error' && importSuccessCount === 0 && (
                                <div className="text-center py-4">
                                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-red-300/40">
                                        <FiX className="text-white" size={36} />
                                    </div>
                                    <p className="text-xl font-bold text-gray-800">Import Failed</p>
                                    <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3 text-left max-h-40 overflow-y-auto">
                                        {importErrors.map((e, i) => <p key={i} className="text-xs text-red-500">{e}</p>)}
                                    </div>
                                    <button onClick={() => setImportStatus('idle')} className="mt-4 px-6 py-3 bg-blue-500 text-white font-bold rounded-xl text-sm">Try Again</button>
                                </div>
                            )}

                            {/* Importing State */}
                            {importStatus === 'importing' && (
                                <div className="py-4">
                                    <div className="text-center mb-4">
                                        <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
                                        <p className="text-lg font-bold text-gray-800 mt-3">Importing Products...</p>
                                        <p className="text-sm text-gray-500 mt-1">{importProgress} of {importTotal}</p>
                                    </div>
                                    <div className="bg-gray-100 rounded-full h-4 overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300 relative"
                                            style={{ width: `${importTotal > 0 ? (importProgress / importTotal) * 100 : 0}%` }}>
                                            <div className="absolute inset-0 bg-white/30 animate-pulse" />
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-2 text-center">{Math.round(importTotal > 0 ? (importProgress / importTotal) * 100 : 0)}%</p>
                                    <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2">
                                        <FiPackage className="text-blue-500 flex-shrink-0" size={14} />
                                        <p className="text-xs text-blue-700 font-medium truncate">Current: <span className="font-bold">{importCurrentItem}</span></p>
                                    </div>
                                </div>
                            )}

                            {/* Idle / Parsing State */}
                            {(importStatus === 'idle' || importStatus === 'parsing') && (
                                <>
                                    {/* File Upload */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">Upload CSV File</label>
                                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-blue-300 rounded-2xl bg-blue-50/50 hover:bg-blue-50 cursor-pointer transition-all group">
                                            <FiFileText className="text-blue-400 group-hover:text-blue-600 transition-colors" size={32} />
                                            <p className="text-sm font-semibold text-blue-500 mt-2">{importFile ? importFile.name : 'Click to select CSV file'}</p>
                                            <p className="text-[10px] text-gray-400 mt-1">Supports .csv format</p>
                                            <input type="file" accept=".csv,.txt" className="hidden" onChange={e => { if (e.target.files?.[0]) setImportFile(e.target.files[0]); }} />
                                        </label>
                                    </div>

                                    {/* Import Mode */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">Import Mode</label>
                                        <div className="space-y-2">
                                            {([
                                                { value: 'add_new' as const, label: 'Add New Items Only', desc: 'Imports only new products, skips existing ones', color: 'border-green-300 bg-green-50', icon: '➕' },
                                                { value: 'update' as const, label: 'Update & Add', desc: 'Updates existing products by name/barcode match, adds new ones', color: 'border-blue-300 bg-blue-50', icon: '🔄' },
                                                { value: 'overwrite' as const, label: 'Full Overwrite', desc: '⚠️ Deletes ALL existing products and imports fresh', color: 'border-red-300 bg-red-50', icon: '🗑️' },
                                            ]).map(m => (
                                                <label key={m.value} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${importMode === m.value ? m.color + ' shadow-sm' : 'border-gray-200 hover:border-gray-300'}`}>
                                                    <input type="radio" name="importMode" value={m.value} checked={importMode === m.value} onChange={() => setImportMode(m.value)} className="mt-0.5 accent-blue-500" />
                                                    <div>
                                                        <p className="text-sm font-bold text-gray-800">{m.icon} {m.label}</p>
                                                        <p className="text-[11px] text-gray-500">{m.desc}</p>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* CSV Template */}
                                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                                        <p className="text-xs font-bold text-gray-600 mb-1">📄 Required CSV Columns:</p>
                                        <div className="flex flex-wrap gap-1 mt-1 mb-2">
                                            {['product_name', 'barcode', 'category', 'purchase_cost', 'sales_cost', 'wholesale_price', 'purchase_unit', 'sales_unit', 'quantity', 'reorder_point', 'pieces_per_package', 'supplier_name', 'description'].map(col => (
                                                <span key={col} className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold ${col === 'wholesale_price' ? 'bg-purple-100 text-purple-700 border border-purple-200' : col === 'product_name' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>{col}{col === 'product_name' && ' *'}</span>
                                            ))}
                                        </div>
                                        <button onClick={() => {
                                            const tpl = 'product_name,barcode,category,purchase_cost,sales_cost,wholesale_price,purchase_unit,sales_unit,quantity,reorder_point,pieces_per_package,supplier_name,description\n'
                                                + '"Paracetamol 500mg",10001,Painkillers,15,30,25,Box,Tablet,500,50,100,Cosmos Pharma,Paracetamol 500mg tablets\n'
                                                + '"Amoxicillin 250mg",10002,Antibiotics,80,150,120,Box,Capsule,200,20,50,Dawa Ltd,Amoxicillin 250mg capsules\n'
                                                + '"Metformin 500mg",10003,Diabetes,45,90,75,Box,Tablet,300,30,60,Beta Healthcare,Metformin hydrochloride 500mg\n'
                                                + '"Cough Syrup 100ml",10004,Cough & Cold,120,200,180,Carton,Bottle,100,15,24,GlaxoSmithKline,Cough suppressant syrup 100ml\n'
                                                + '"Cetrizine 10mg",10005,Allergy,10,25,20,Strip,Tablet,400,40,10,Cosmos Pharma,Antihistamine tablets 10mg\n';
                                            const blob = new Blob([tpl], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'alpha_pharmacy_import_template.csv'; a.click(); URL.revokeObjectURL(url);
                                        }} className="text-xs text-blue-600 font-bold mt-2 hover:underline flex items-center gap-1">⬇️ Download Template CSV (with 5 sample products)</button>
                                    </div>

                                    {/* Overwrite Warning */}
                                    {importMode === 'overwrite' && (
                                        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-3 flex items-start gap-2">
                                            <FiAlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={16} />
                                            <div>
                                                <p className="text-xs font-bold text-red-700">⚠️ Full Overwrite Mode</p>
                                                <p className="text-[11px] text-red-500">This will permanently DELETE all existing products and stock data before importing. This action cannot be undone.</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Action Buttons */}
                                    <div className="flex gap-3 pt-3 border-t">
                                        <button onClick={() => setShowImportModal(false)} className="flex-1 px-4 py-3 border-2 border-gray-200 text-gray-600 font-bold rounded-xl text-sm">Cancel</button>
                                        <button onClick={importProducts} disabled={!importFile || importStatus === 'parsing'}
                                            className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 hover:shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                                            <FiUpload size={14} /> {importStatus === 'parsing' ? 'Parsing...' : 'Start Import'}
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
