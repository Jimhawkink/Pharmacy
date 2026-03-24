'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

interface Product {
    pid: number; product_code: string; product_name: string; barcode: string;
    category: string; purchase_unit: string; sales_unit: string;
    purchase_cost: number; sales_cost: number; wholesale_price: number;
    reorder_point: number; margin_per: number; show_in_pos: boolean;
    pieces_per_package: number; active: boolean; photo: string;
    generic_name: string; manufacturer: string; drug_type: string;
    dosage: string; requires_prescription: boolean; storage_conditions: string;
    outlet_id: number;
}
interface Batch {
    batch_id?: number; batch_number: string; expiry_date: string;
    manufacture_date: string; quantity: number; remaining_qty?: number;
    purchase_cost: number; selling_price: number; status?: string;
}
interface Category { category_id: number; category_name: string; icon: string; }
interface Supplier { supplier_id: number; supplier_name: string; supplier_code: string; }

const DRUG_TYPES = ['Tablet','Capsule','Syrup','Suspension','Injection','Cream','Ointment','Drops','Inhaler','Suppository','Powder','Gel','Spray','Patch','Sachet','Other'];

export default function ProductsPage() {
    const { activeOutlet } = useOutlet();
    const outletId = activeOutlet?.outlet_id || 1;
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [catFilter, setCatFilter] = useState('All');
    const [showModal, setShowModal] = useState(false);
    const [editProduct, setEditProduct] = useState<Product | null>(null);
    const [productBatches, setProductBatches] = useState<Record<number, Batch[]>>({});

    // Form state
    const [form, setForm] = useState({
        product_code: '', product_name: '', barcode: '', category: '',
        purchase_unit: 'Piece', sales_unit: 'Piece', purchase_cost: 0,
        sales_cost: 0, wholesale_price: 0, reorder_point: 10,
        pieces_per_package: 1, show_in_pos: true, photo: '',
        generic_name: '', manufacturer: '', drug_type: 'Tablet',
        dosage: '', requires_prescription: false, storage_conditions: '',
    });
    const [batches, setBatches] = useState<Batch[]>([]);
    const [newBatch, setNewBatch] = useState<Batch>({
        batch_number: '', expiry_date: '', manufacture_date: '',
        quantity: 0, purchase_cost: 0, selling_price: 0,
    });

    // Margin calculation
    const margin = form.purchase_cost > 0
        ? ((form.sales_cost - form.purchase_cost) / form.purchase_cost * 100)
        : 0;
    const profit = form.sales_cost - form.purchase_cost;

    const loadData = useCallback(async () => {
        setLoading(true);
        const [{ data: prods }, { data: cats }, { data: supps }] = await Promise.all([
            supabase.from('pharmacy_products').select('*').eq('outlet_id', outletId).eq('active', true).order('product_name'),
            supabase.from('pharmacy_categories').select('*').eq('active', true).order('category_name'),
            supabase.from('pharmacy_suppliers').select('supplier_id, supplier_name, supplier_code').eq('active', true),
        ]);
        setProducts(prods || []);
        setCategories(cats || []);
        setSuppliers(supps || []);

        // Load batches for all products
        if (prods && prods.length > 0) {
            const pids = prods.map((p: Product) => p.pid);
            const { data: allBatches } = await supabase
                .from('pharmacy_batches')
                .select('*')
                .in('product_id', pids)
                .eq('status', 'Active')
                .order('expiry_date', { ascending: true });
            const batchMap: Record<number, Batch[]> = {};
            (allBatches || []).forEach((b: any) => {
                if (!batchMap[b.product_id]) batchMap[b.product_id] = [];
                batchMap[b.product_id].push(b);
            });
            setProductBatches(batchMap);
        }
        setLoading(false);
    }, [outletId]);

    useEffect(() => { loadData(); }, [loadData]);

    const resetForm = () => {
        setForm({
            product_code: '', product_name: '', barcode: '', category: '',
            purchase_unit: 'Piece', sales_unit: 'Piece', purchase_cost: 0,
            sales_cost: 0, wholesale_price: 0, reorder_point: 10,
            pieces_per_package: 1, show_in_pos: true, photo: '',
            generic_name: '', manufacturer: '', drug_type: 'Tablet',
            dosage: '', requires_prescription: false, storage_conditions: '',
        });
        setBatches([]);
        setEditProduct(null);
    };

    const openAdd = async () => {
        resetForm();
        // Auto-generate product code
        const { count } = await supabase.from('pharmacy_products').select('*', { count: 'exact', head: true });
        setForm(f => ({ ...f, product_code: `DRG-${String((count || 0) + 1).padStart(4, '0')}` }));
        setShowModal(true);
    };

    const openEdit = async (p: Product) => {
        setEditProduct(p);
        setForm({
            product_code: p.product_code, product_name: p.product_name,
            barcode: p.barcode || '', category: p.category || '',
            purchase_unit: p.purchase_unit || 'Piece', sales_unit: p.sales_unit || 'Piece',
            purchase_cost: p.purchase_cost, sales_cost: p.sales_cost,
            wholesale_price: p.wholesale_price || 0, reorder_point: p.reorder_point || 10,
            pieces_per_package: p.pieces_per_package || 1, show_in_pos: p.show_in_pos,
            photo: p.photo || '', generic_name: p.generic_name || '',
            manufacturer: p.manufacturer || '', drug_type: p.drug_type || 'Tablet',
            dosage: p.dosage || '', requires_prescription: p.requires_prescription || false,
            storage_conditions: p.storage_conditions || '',
        });
        // Load existing batches
        const { data } = await supabase.from('pharmacy_batches').select('*')
            .eq('product_id', p.pid).eq('status', 'Active').order('expiry_date');
        setBatches((data || []).map((b: any) => ({
            batch_id: b.batch_id, batch_number: b.batch_number,
            expiry_date: b.expiry_date, manufacture_date: b.manufacture_date || '',
            quantity: b.quantity, remaining_qty: b.remaining_qty,
            purchase_cost: b.purchase_cost, selling_price: b.selling_price,
            status: b.status,
        })));
        setShowModal(true);
    };

    const addBatchRow = () => {
        if (!newBatch.batch_number || !newBatch.expiry_date || newBatch.quantity <= 0) {
            toast.error('Batch #, expiry date and qty are required'); return;
        }
        setBatches(prev => [...prev, {
            ...newBatch,
            purchase_cost: newBatch.purchase_cost || form.purchase_cost,
            selling_price: newBatch.selling_price || form.sales_cost,
        }]);
        setNewBatch({ batch_number: '', expiry_date: '', manufacture_date: '', quantity: 0, purchase_cost: 0, selling_price: 0 });
        toast.success('Batch added');
    };

    const removeBatch = (idx: number) => setBatches(prev => prev.filter((_, i) => i !== idx));

    const getDaysUntilExpiry = (date: string) => {
        if (!date) return 999;
        const d = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
        return d;
    };

    const getExpiryBadge = (days: number) => {
        if (days < 0) return <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-bold">EXPIRED</span>;
        if (days <= 7) return <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-xs font-bold">{days}d ⚠️</span>;
        if (days <= 30) return <span className="px-2 py-0.5 bg-orange-100 text-orange-600 rounded-full text-xs font-bold">{days}d</span>;
        if (days <= 90) return <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold">{days}d</span>;
        return <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-bold">{days}d ✓</span>;
    };

    const saveProduct = async () => {
        if (!form.product_name.trim()) { toast.error('Product name required'); return; }
        if (form.purchase_cost <= 0) { toast.error('Purchase cost must be > 0'); return; }
        if (form.sales_cost <= 0) { toast.error('Sales cost must be > 0'); return; }

        const marginPer = form.purchase_cost > 0 ? Math.round(((form.sales_cost - form.purchase_cost) / form.purchase_cost) * 10000) / 100 : 0;
        const productData = { ...form, margin_per: marginPer, outlet_id: outletId, active: true };

        try {
            let pid: number;
            if (editProduct) {
                const { error } = await supabase.from('pharmacy_products').update(productData).eq('pid', editProduct.pid);
                if (error) throw error;
                pid = editProduct.pid;
                toast.success('Product updated');
            } else {
                const { data, error } = await supabase.from('pharmacy_products').insert(productData).select().single();
                if (error) throw error;
                pid = data.pid;
                // Create stock entry
                await supabase.from('pharmacy_stock').insert({ pid, qty: 0, outlet_id: outletId, storage_type: 'Store' });
                toast.success('Product created');
            }

            // Save new batches (ones without batch_id)
            for (const batch of batches) {
                if (!batch.batch_id) {
                    const { data: batchData } = await supabase.from('pharmacy_batches').insert({
                        product_id: pid, batch_number: batch.batch_number,
                        expiry_date: batch.expiry_date, manufacture_date: batch.manufacture_date || null,
                        quantity: batch.quantity, remaining_qty: batch.quantity,
                        purchase_cost: batch.purchase_cost || form.purchase_cost,
                        selling_price: batch.selling_price || form.sales_cost,
                        outlet_id: outletId, status: 'Active',
                    }).select().single();
                    // Add batch stock
                    if (batchData) {
                        const { data: stockRow } = await supabase.from('pharmacy_stock')
                            .select('st_id, qty').eq('pid', pid).eq('outlet_id', outletId).limit(1).single();
                        if (stockRow) {
                            await supabase.from('pharmacy_stock').update({ qty: (stockRow.qty || 0) + batch.quantity }).eq('st_id', stockRow.st_id);
                        }
                    }
                }
            }

            setShowModal(false); resetForm(); loadData();
        } catch (err: any) { toast.error(err.message || 'Save failed'); }
    };

    const deleteProduct = async (pid: number) => {
        if (!confirm('Delete this product?')) return;
        await supabase.from('pharmacy_products').update({ active: false }).eq('pid', pid);
        toast.success('Product deleted'); loadData();
    };

    const filtered = products.filter(p => {
        const q = search.toLowerCase();
        const matchSearch = !search || p.product_name.toLowerCase().includes(q) || p.product_code.toLowerCase().includes(q) || (p.barcode || '').includes(search) || (p.generic_name || '').toLowerCase().includes(q);
        const matchCat = catFilter === 'All' || p.category === catFilter;
        return matchSearch && matchCat;
    });

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-96">
            <div className="w-14 h-14 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
            <p className="mt-4 text-gray-500 text-sm">Loading products...</p>
        </div>
    );

    return (
        <div className="space-y-5" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow-lg">
                        <span className="text-2xl">💊</span>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Products & Drugs</h1>
                        <p className="text-gray-500 text-sm">{products.length} products • Manage drugs, batches & expiry</p>
                    </div>
                </div>
                <button onClick={openAdd} className="px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-xl font-bold hover:shadow-lg transition-all flex items-center gap-2">
                    ➕ Add Product
                </button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-md">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2">🔍</span>
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, code, barcode, generic name..."
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:border-teal-400 outline-none" />
                </div>
                <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm cursor-pointer">
                    <option value="All">All Categories</option>
                    {categories.map(c => <option key={c.category_id} value={c.category_name}>{c.icon} {c.category_name}</option>)}
                </select>
                <span className="text-sm text-gray-400">{filtered.length} results</span>
            </div>

            {/* Products Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full">
                    <thead><tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Product</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Category</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Drug Info</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Buy</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Sell</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Margin</th>
                        <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Batches / Expiry</th>
                        <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase w-24">Actions</th>
                    </tr></thead>
                    <tbody>
                        {filtered.map(p => {
                            const pBatches = productBatches[p.pid] || [];
                            const nearestBatch = pBatches[0];
                            const nearestDays = nearestBatch ? getDaysUntilExpiry(nearestBatch.expiry_date) : null;
                            const calcMargin = p.purchase_cost > 0 ? ((p.sales_cost - p.purchase_cost) / p.purchase_cost * 100).toFixed(1) : '0';
                            return (
                                <tr key={p.pid} className="border-b border-gray-50 hover:bg-teal-50/30 transition-colors">
                                    <td className="px-4 py-3">
                                        <p className="font-semibold text-gray-800 text-sm">{p.product_name}</p>
                                        <p className="text-xs text-gray-400">{p.product_code} {p.barcode ? `• ${p.barcode}` : ''}</p>
                                    </td>
                                    <td className="px-4 py-3"><span className="px-2 py-1 bg-gray-100 rounded-lg text-xs">{p.category || '—'}</span></td>
                                    <td className="px-4 py-3">
                                        <p className="text-xs text-gray-600">{p.drug_type || '—'} {p.dosage ? `• ${p.dosage}` : ''}</p>
                                        {p.generic_name && <p className="text-xs text-teal-600">{p.generic_name}</p>}
                                        {p.requires_prescription && <span className="text-xs text-red-500 font-bold">℞ Rx</span>}
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm text-gray-600">{p.purchase_cost.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-right text-sm font-bold text-green-600">{p.sales_cost.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-right">
                                        <span className={`text-sm font-bold ${Number(calcMargin) >= 20 ? 'text-green-600' : Number(calcMargin) >= 10 ? 'text-yellow-600' : 'text-red-500'}`}>{calcMargin}%</span>
                                        <p className="text-xs text-gray-400">Ksh {(p.sales_cost - p.purchase_cost).toLocaleString()}</p>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {pBatches.length > 0 ? (
                                            <div className="flex flex-col items-center gap-1">
                                                <span className="text-xs text-gray-500">{pBatches.length} batch{pBatches.length > 1 ? 'es' : ''}</span>
                                                {nearestDays !== null && getExpiryBadge(nearestDays)}
                                            </div>
                                        ) : <span className="text-xs text-gray-300">No batches</span>}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <button onClick={() => openEdit(p)} className="p-2 hover:bg-teal-100 rounded-lg text-teal-600" title="Edit">✏️</button>
                                            <button onClick={() => deleteProduct(p.pid)} className="p-2 hover:bg-red-100 rounded-lg text-red-500" title="Delete">🗑️</button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {filtered.length === 0 && (
                            <tr><td colSpan={8} className="text-center py-12 text-gray-400">
                                <span className="text-4xl block mb-2">💊</span>No products found
                            </td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* ADD/EDIT PRODUCT MODAL */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-y-auto">
                        {/* Modal Header */}
                        <div className="bg-gradient-to-r from-teal-500 to-cyan-600 px-6 py-4 text-white rounded-t-3xl flex items-center justify-between sticky top-0 z-10">
                            <h2 className="text-lg font-bold flex items-center gap-2">💊 {editProduct ? 'Edit' : 'Add New'} Product / Drug</h2>
                            <button onClick={() => { setShowModal(false); resetForm(); }} className="p-2 hover:bg-white/20 rounded-lg">✕</button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Basic Info */}
                            <div>
                                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <span className="w-6 h-6 rounded bg-teal-100 flex items-center justify-center text-xs">1</span>
                                    Basic Information
                                </h3>
                                <div className="grid grid-cols-4 gap-3">
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Code</label>
                                        <input type="text" value={form.product_code} onChange={e => setForm(f => ({ ...f, product_code: e.target.value }))}
                                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm" />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Product / Drug Name *</label>
                                        <input type="text" value={form.product_name} onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))}
                                            placeholder="e.g. Paracetamol 500mg" className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Barcode</label>
                                        <input type="text" value={form.barcode} onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))}
                                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm" />
                                    </div>
                                </div>
                            </div>

                            {/* Drug Details */}
                            <div>
                                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <span className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center text-xs">2</span>
                                    Drug Details
                                </h3>
                                <div className="grid grid-cols-4 gap-3">
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Generic Name</label>
                                        <input type="text" value={form.generic_name} onChange={e => setForm(f => ({ ...f, generic_name: e.target.value }))}
                                            placeholder="e.g. Paracetamol" className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Drug Type</label>
                                        <select value={form.drug_type} onChange={e => setForm(f => ({ ...f, drug_type: e.target.value }))}
                                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm cursor-pointer">
                                            {DRUG_TYPES.map(t => <option key={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Dosage</label>
                                        <input type="text" value={form.dosage} onChange={e => setForm(f => ({ ...f, dosage: e.target.value }))}
                                            placeholder="e.g. 500mg" className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Manufacturer</label>
                                        <input type="text" value={form.manufacturer} onChange={e => setForm(f => ({ ...f, manufacturer: e.target.value }))}
                                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Category</label>
                                        <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm cursor-pointer">
                                            <option value="">Select Category</option>
                                            {categories.map(c => <option key={c.category_id} value={c.category_name}>{c.icon} {c.category_name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Storage</label>
                                        <input type="text" value={form.storage_conditions} onChange={e => setForm(f => ({ ...f, storage_conditions: e.target.value }))}
                                            placeholder="e.g. Below 25°C" className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm" />
                                    </div>
                                    <div className="flex items-end gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" checked={form.requires_prescription} onChange={e => setForm(f => ({ ...f, requires_prescription: e.target.checked }))} className="accent-red-500 w-4 h-4" />
                                            <span className="text-sm font-semibold text-red-600">℞ Prescription</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" checked={form.show_in_pos} onChange={e => setForm(f => ({ ...f, show_in_pos: e.target.checked }))} className="accent-teal-500 w-4 h-4" />
                                            <span className="text-sm text-gray-600">POS</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Pricing & Units with ACCURATE MARGIN */}
                            <div>
                                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <span className="w-6 h-6 rounded bg-green-100 flex items-center justify-center text-xs">3</span>
                                    Pricing, Units & Margin
                                </h3>
                                <div className="grid grid-cols-6 gap-3">
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Purchase Unit</label>
                                        <select value={form.purchase_unit} onChange={e => setForm(f => ({ ...f, purchase_unit: e.target.value }))}
                                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm">
                                            {['Piece','Tablet','Capsule','Strip','Box','Pack','Bottle','Tube','Sachet','Vial','Ampoule','Carton','Dozen','Kilogram','Gram','Liter','Milliliter'].map(u => <option key={u}>{u}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Sales Unit</label>
                                        <select value={form.sales_unit} onChange={e => setForm(f => ({ ...f, sales_unit: e.target.value }))}
                                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm">
                                            {['Piece','Tablet','Capsule','Strip','Box','Pack','Bottle','Tube','Sachet','Vial','Ampoule','Carton','Dozen','Kilogram','Gram','Liter','Milliliter'].map(u => <option key={u}>{u}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Purchase Cost *</label>
                                        <input type="number" value={form.purchase_cost} onChange={e => setForm(f => ({ ...f, purchase_cost: Number(e.target.value) }))}
                                            min={0} step={0.01} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Selling Price *</label>
                                        <input type="number" value={form.sales_cost} onChange={e => setForm(f => ({ ...f, sales_cost: Number(e.target.value) }))}
                                            min={0} step={0.01} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Wholesale</label>
                                        <input type="number" value={form.wholesale_price} onChange={e => setForm(f => ({ ...f, wholesale_price: Number(e.target.value) }))}
                                            min={0} step={0.01} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Pcs/Package</label>
                                        <input type="number" value={form.pieces_per_package} onChange={e => setForm(f => ({ ...f, pieces_per_package: Number(e.target.value) }))}
                                            min={1} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm" />
                                    </div>
                                </div>
                                {/* Margin Display */}
                                <div className={`mt-3 p-3 rounded-xl border-2 flex items-center justify-between ${margin >= 20 ? 'bg-green-50 border-green-200' : margin >= 10 ? 'bg-yellow-50 border-yellow-200' : margin > 0 ? 'bg-orange-50 border-orange-200' : 'bg-red-50 border-red-200'}`}>
                                    <div className="flex items-center gap-6">
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase font-bold">Profit per unit</p>
                                            <p className={`text-lg font-black ${profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>Ksh {profit.toLocaleString()}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase font-bold">Margin %</p>
                                            <p className={`text-lg font-black ${margin >= 20 ? 'text-green-700' : margin >= 10 ? 'text-yellow-700' : 'text-red-700'}`}>{margin.toFixed(2)}%</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase font-bold">Markup</p>
                                            <p className="text-lg font-black text-gray-700">{form.sales_cost > 0 && form.purchase_cost > 0 ? ((form.sales_cost / form.purchase_cost)).toFixed(2) : '0'}x</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        {margin < 0 && <p className="text-sm font-bold text-red-600">⚠️ Selling below cost!</p>}
                                        {margin === 0 && form.purchase_cost > 0 && <p className="text-sm font-bold text-orange-600">⚠️ No profit margin</p>}
                                        {margin >= 20 && <p className="text-sm font-bold text-green-600">✅ Good margin</p>}
                                        {margin > 0 && margin < 10 && <p className="text-sm font-bold text-orange-600">⚠️ Low margin</p>}
                                    </div>
                                </div>
                            </div>

                            {/* BATCH DATAGRID */}
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
                                            <input type="text" value={newBatch.batch_number} onChange={e => setNewBatch(b => ({ ...b, batch_number: e.target.value }))}
                                                placeholder="B001" className="w-full px-2 py-2 bg-white border border-gray-200 rounded-lg text-sm" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Expiry Date *</label>
                                            <input type="date" value={newBatch.expiry_date} onChange={e => setNewBatch(b => ({ ...b, expiry_date: e.target.value }))}
                                                className="w-full px-2 py-2 bg-white border border-gray-200 rounded-lg text-sm" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Mfg Date</label>
                                            <input type="date" value={newBatch.manufacture_date} onChange={e => setNewBatch(b => ({ ...b, manufacture_date: e.target.value }))}
                                                className="w-full px-2 py-2 bg-white border border-gray-200 rounded-lg text-sm" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Qty *</label>
                                            <input type="number" value={newBatch.quantity || ''} onChange={e => setNewBatch(b => ({ ...b, quantity: Number(e.target.value) }))}
                                                min={1} className="w-full px-2 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Buy Price</label>
                                            <input type="number" value={newBatch.purchase_cost || ''} onChange={e => setNewBatch(b => ({ ...b, purchase_cost: Number(e.target.value) }))}
                                                placeholder={String(form.purchase_cost)} className="w-full px-2 py-2 bg-white border border-gray-200 rounded-lg text-sm" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Sell Price</label>
                                            <input type="number" value={newBatch.selling_price || ''} onChange={e => setNewBatch(b => ({ ...b, selling_price: Number(e.target.value) }))}
                                                placeholder={String(form.sales_cost)} className="w-full px-2 py-2 bg-white border border-gray-200 rounded-lg text-sm" />
                                        </div>
                                        <button onClick={addBatchRow} className="py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg font-bold hover:shadow-lg transition-all text-sm">
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
                                                    const bCost = b.purchase_cost || form.purchase_cost;
                                                    const bSell = b.selling_price || form.sales_cost;
                                                    const bMargin = bCost > 0 ? ((bSell - bCost) / bCost * 100).toFixed(1) : '0';
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
                                                                        if (!confirm('Delete this saved batch? Stock will no longer be tracked for it.')) return;
                                                                        await supabase.from('pharmacy_batches').update({ status: 'Deleted' }).eq('batch_id', b.batch_id);
                                                                        toast.success('Batch deleted');
                                                                    }
                                                                    removeBatch(idx);
                                                                }} className="p-1 hover:bg-red-100 rounded text-red-400" title="Delete batch">🗑️</button>
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
                                <button onClick={() => { setShowModal(false); resetForm(); }} className="flex-1 py-3 border-2 border-gray-200 rounded-xl text-gray-500 font-bold hover:bg-gray-50">Cancel</button>
                                <button onClick={saveProduct} className="flex-1 py-3 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-xl font-bold hover:shadow-lg transition-all">
                                    {editProduct ? '💾 Update Product' : '💊 Save Product'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
