'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { useOutlet } from '@/context/OutletContext';

interface Category {
    category_id: number;
    category_name: string;
    description: string;
    icon: string;
    color: string;
    active: boolean;
}

const iconOptions = ['💊', '💉', '🩺', '🧪', '🩹', '🧴', '🌡️', '🧬', '🔬', '🚑', '👶', '🌿', '💧', '🫀', '👁️', '🦷', '🧼', '📦', '🍏', '🛡️', '⚡', '✨'];
const colorOptions = [
    { name: 'Red', value: '#EF4444' },
    { name: 'Orange', value: '#F97316' },
    { name: 'Amber', value: '#F59E0B' },
    { name: 'Yellow', value: '#EAB308' },
    { name: 'Lime', value: '#84CC16' },
    { name: 'Green', value: '#22C55E' },
    { name: 'Emerald', value: '#10B981' },
    { name: 'Teal', value: '#14B8A6' },
    { name: 'Cyan', value: '#06B6D4' },
    { name: 'Blue', value: '#3B82F6' },
    { name: 'Indigo', value: '#6366F1' },
    { name: 'Violet', value: '#8B5CF6' },
    { name: 'Purple', value: '#A855F7' },
    { name: 'Pink', value: '#EC4899' },
    { name: 'Rose', value: '#F43F5E' },
];

const defaultCategory = {
    category_name: '',
    description: '',
    icon: '💊',
    color: '#3B82F6',
    active: true,
};

export default function CategoriesPage() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [formData, setFormData] = useState(defaultCategory);
    const [isSaving, setIsSaving] = useState(false);
    const { activeOutlet } = useOutlet();
    const outletId = activeOutlet?.outlet_id || 1;
    const [productCounts, setProductCounts] = useState<Record<string, number>>({});
    const [searchQuery, setSearchQuery] = useState('');
    const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
    const [isSeeding, setIsSeeding] = useState(false);

    const loadCategories = useCallback(async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('pharmacy_categories')
                .select('*')
                .order('category_name', { ascending: true });

            if (error) throw error;
            setCategories(data || []);

            try {
                const { data: prods } = await supabase.from('pharmacy_products').select('category');
                const counts: Record<string, number> = {};
                (prods || []).forEach((p: any) => {
                    if (p.category) counts[p.category] = (counts[p.category] || 0) + 1;
                });
                setProductCounts(counts);
            } catch {
                // non-fatal
            }
        } catch (err) {
            console.error('Error loading categories:', err);
            // silent fallback
        }
        setIsLoading(false);
    }, []);

    useEffect(() => {
        loadCategories();
    }, [loadCategories]);

    const openAddModal = () => {
        setEditingCategory(null);
        setFormData(defaultCategory);
        setShowModal(true);
    };

    const openEditModal = (category: Category) => {
        setEditingCategory(category);
        setFormData({
            category_name: category.category_name || '',
            description: category.description || '',
            icon: category.icon || '📦',
            color: category.color || '#3B82F6',
            active: category.active !== false,
        });
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.category_name.trim()) {
            toast.error('Category name required!');
            return;
        }

        setIsSaving(true);
        try {
            if (editingCategory) {
                const { error } = await supabase
                    .from('pharmacy_categories')
                    .update(formData)
                    .eq('category_id', editingCategory.category_id);

                if (error) throw error;
                toast.success('Category updated! ✓');
            } else {
                const { error } = await supabase
                    .from('pharmacy_categories')
                    .insert({ ...formData, outlet_id: outletId });

                if (error) throw error;
                toast.success('Category created! ✓');
            }

            setShowModal(false);
            loadCategories();
        } catch (err) {
            console.error('Error saving category:', err);
            toast.error('Failed to save category');
        }
        setIsSaving(false);
    };

    const deleteCategory = async (category: Category) => {
        if (!confirm(`Delete "${category.category_name}"?`)) return;

        try {
            const { error } = await supabase
                .from('pharmacy_categories')
                .delete()
                .eq('category_id', category.category_id);

            if (error) throw error;
            toast.success('Category deleted');
            loadCategories();
        } catch (err) {
            console.error('Error deleting category:', err);
            toast.error('Failed to delete');
        }
    };

    const seedStandardCategories = async () => {
        setIsSeeding(true);
        const standardList = [
            { category_name: 'Antibiotics & Anti-infectives', icon: '💊', color: '#10B981', description: 'Oral and injectable antibiotics, antifungals & antivirals', active: true, outlet_id: outletId },
            { category_name: 'Analgesics & Pain Management', icon: '🩹', color: '#6366F1', description: 'Pain relievers, NSAIDs, antipyretics & anti-inflammatories', active: true, outlet_id: outletId },
            { category_name: 'Cardiovascular & Anti-hypertensives', icon: '🫀', color: '#F43F5E', description: 'Blood pressure, cardiac glycosides & cholesterol medications', active: true, outlet_id: outletId },
            { category_name: 'Respiratory & Cough/Cold', icon: '🫁', color: '#06B6D4', description: 'Inhalers, bronchodilators, antihistamines & cough syrups', active: true, outlet_id: outletId },
            { category_name: 'Gastrointestinal & Antacids', icon: '🧪', color: '#F59E0B', description: 'Proton pump inhibitors, antacids, laxatives & anti-diarrheals', active: true, outlet_id: outletId },
            { category_name: 'Vitamins & Dietary Supplements', icon: '🌿', color: '#22C55E', description: 'Multivitamins, minerals, herbal extracts & nutritional formulas', active: true, outlet_id: outletId },
            { category_name: 'Dermatological & Topical Preparations', icon: '🧴', color: '#EC4899', description: 'Creams, ointments, lotions & medicated skin care', active: true, outlet_id: outletId },
            { category_name: 'Pediatric Care & Syrups', icon: '👶', color: '#8B5CF6', description: 'Child-formulated drops, suspensions & oral rehydration', active: true, outlet_id: outletId },
            { category_name: 'Ophthalmic & ENT Preparations', icon: '👁️', color: '#3B82F6', description: 'Eye, ear & nasal drops and medical irrigations', active: true, outlet_id: outletId },
            { category_name: 'First Aid & Surgical Consumables', icon: '🩺', color: '#EF4444', description: 'Dressings, syringes, cannulas, antiseptics & medical supplies', active: true, outlet_id: outletId },
        ];

        try {
            const { error } = await supabase.from('pharmacy_categories').insert(standardList);
            if (error) throw error;
            toast.success('Successfully initialized 10 standard pharmacy categories!');
            await loadCategories();
        } catch (err: any) {
            console.error('Seed error:', err);
            toast.error('Failed to seed categories');
        } finally {
            setIsSeeding(false);
        }
    };

    const filteredCategories = categories.filter((c) => {
        const matchesSearch = c.category_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (c.description || '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFilter = filterActive === 'all' ? true : filterActive === 'active' ? c.active !== false : c.active === false;
        return matchesSearch && matchesFilter;
    });

    const activeCount = categories.filter((c) => c.active !== false).length;
    const totalDrugsCatalogued = Object.values(productCounts).reduce((a, b) => a + b, 0);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-3">
                        <span className="text-3xl">🏷️</span>
                        Product Categories
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">
                        Organize and classify pharmaceuticals, OTC medicines & medical supplies
                    </p>
                </div>

                <button
                    onClick={openAddModal}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-semibold rounded-2xl shadow-lg shadow-indigo-300/40 hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-300"
                >
                    <span className="text-xl">➕</span>
                    Add Category
                </button>
            </div>

            {/* KPI Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-4 shadow-xs">
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-2xl font-bold">
                        🏷️
                    </div>
                    <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Total Categories</span>
                        <span className="text-2xl font-black text-gray-900">{categories.length}</span>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-4 shadow-xs">
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl font-bold">
                        ✅
                    </div>
                    <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Active Categories</span>
                        <span className="text-2xl font-black text-emerald-700">{activeCount}</span>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-4 shadow-xs">
                    <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center text-2xl font-bold">
                        💊
                    </div>
                    <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Linked Products</span>
                        <span className="text-2xl font-black text-teal-800">{totalDrugsCatalogued}</span>
                    </div>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
                <div className="relative w-full sm:w-80">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search category name or description..."
                        className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:border-indigo-500"
                    />
                </div>

                <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-start">
                    <div className="flex items-center bg-gray-100 p-1 rounded-xl text-xs font-bold">
                        <button
                            type="button"
                            onClick={() => setFilterActive('all')}
                            className={`px-3 py-1 rounded-lg transition-all ${filterActive === 'all' ? 'bg-white text-indigo-600 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
                        >
                            All ({categories.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterActive('active')}
                            className={`px-3 py-1 rounded-lg transition-all ${filterActive === 'active' ? 'bg-white text-emerald-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
                        >
                            Active ({activeCount})
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterActive('inactive')}
                            className={`px-3 py-1 rounded-lg transition-all ${filterActive === 'inactive' ? 'bg-white text-gray-800 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
                        >
                            Inactive ({categories.length - activeCount})
                        </button>
                    </div>

                    <button
                        type="button"
                        disabled={isSeeding}
                        onClick={seedStandardCategories}
                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                        title="Auto-populate standard pharmacy categories"
                    >
                        <span>✨</span>
                        {isSeeding ? 'Seeding...' : 'Seed Defaults'}
                    </button>
                </div>
            </div>

            {/* Categories Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {isLoading ? (
                    <div className="col-span-full flex justify-center py-12">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-10 h-10 border-4 border-indigo-400/30 border-t-indigo-500 rounded-full animate-spin"></div>
                            <span className="text-gray-500">Loading categories...</span>
                        </div>
                    </div>
                ) : filteredCategories.length === 0 ? (
                    <div className="col-span-full flex flex-col items-center gap-3 py-12">
                        <span className="text-5xl">🏷️</span>
                        <p className="text-gray-700 font-bold text-base">
                            {categories.length === 0 ? 'No pharmacy categories initialized yet' : 'No categories match your search or filter'}
                        </p>
                        <p className="text-gray-500 text-xs">
                            {categories.length === 0 ? 'Create custom drug categories or seed standard pharmacy classes with one click.' : 'Try adjusting your search query or filter.'}
                        </p>
                        <button
                            onClick={categories.length === 0 ? openAddModal : () => { setSearchQuery(''); setFilterActive('all'); }}
                            className="px-4 py-2 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 transition-colors"
                        >
                            {categories.length === 0 ? '➕ Add First Category' : 'Clear Filters'}
                        </button>
                    </div>
                ) : (
                    filteredCategories.map((category) => (
                        <div
                            key={category.category_id}
                            className={`bg-white rounded-2xl border-2 p-5 transition-all hover:shadow-lg hover:scale-105 ${!category.active ? 'opacity-50' : ''}`}
                            style={{ borderColor: category.color }}
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div
                                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                                    style={{ backgroundColor: `${category.color}20` }}
                                >
                                    {category.icon}
                                </div>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => openEditModal(category)}
                                        className="p-1.5 bg-gray-100 hover:bg-blue-100 text-gray-600 hover:text-blue-600 rounded-lg transition-all text-sm"
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        onClick={() => deleteCategory(category)}
                                        className="p-1.5 bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-600 rounded-lg transition-all text-sm"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                            <h3 className="font-bold text-gray-800">{category.category_name}</h3>
                            {category.description && (
                                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{category.description}</p>
                            )}
                            <div
                                className="w-full h-1 rounded-full mt-3"
                                style={{ backgroundColor: category.color }}
                            />
                            <div className="flex items-center justify-between text-xs text-gray-500 mt-2.5 pt-2 border-t border-gray-100">
                                <span className="font-semibold text-gray-700">
                                    💊 {productCounts[category.category_name] || 0} Products
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${category.active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                                    {category.active ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                            <div className="hidden"
                                style={{ backgroundColor: category.color }}
                            />
                        </div>
                    ))
                )}
            </div>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                        {/* Modal Header */}
                        <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 py-5 text-white sticky top-0">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    {editingCategory ? '✏️ Edit Category' : '➕ Add New Category'}
                                </h2>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="p-2 hover:bg-white/20 rounded-full transition-colors"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        {/* Modal Form */}
                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    🏷️ Category Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.category_name}
                                    onChange={(e) => setFormData({ ...formData, category_name: e.target.value })}
                                    placeholder="e.g., Antibiotics, Analgesics, Pediatrics, Vitamins"
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-400/20"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    📝 Description
                                </label>
                                <input
                                    type="text"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Optional description"
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    😊 Icon
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {iconOptions.map((icon) => (
                                        <button
                                            key={icon}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, icon })}
                                            className={`w-10 h-10 text-xl rounded-xl border-2 transition-all hover:scale-110 ${formData.icon === icon
                                                    ? 'border-indigo-500 bg-indigo-50'
                                                    : 'border-gray-200 bg-gray-50'
                                                }`}
                                        >
                                            {icon}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    🎨 Color
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {colorOptions.map((color) => (
                                        <button
                                            key={color.value}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, color: color.value })}
                                            className={`w-8 h-8 rounded-lg transition-all hover:scale-110 ${formData.color === color.value
                                                    ? 'ring-2 ring-offset-2 ring-gray-400 scale-110'
                                                    : ''
                                                }`}
                                            style={{ backgroundColor: color.value }}
                                            title={color.name}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Preview */}
                            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                                <p className="text-sm text-gray-600 mb-2">Preview:</p>
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                                        style={{ backgroundColor: `${formData.color}20` }}
                                    >
                                        {formData.icon}
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-800">{formData.category_name || 'Category Name'}</p>
                                        <div
                                            className="w-20 h-1 rounded-full mt-1"
                                            style={{ backgroundColor: formData.color }}
                                        />
                                    </div>
                                </div>
                            </div>

                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.active}
                                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                                    className="w-5 h-5 rounded border-gray-300 text-indigo-500 focus:ring-indigo-500"
                                />
                                <span className="font-medium text-gray-700">Active</span>
                            </label>

                            {/* Buttons */}
                            <div className="flex gap-4 pt-4 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-6 py-3 border-2 border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-indigo-300/40 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                                >
                                    {isSaving ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <span>{editingCategory ? '💾' : '➕'}</span>
                                            {editingCategory ? 'Update' : 'Create'}
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

