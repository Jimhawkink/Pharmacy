'use client';
// =====================================================================
// Alpha Pharmacy - Super Premium Supplier & Procurement Management v2.0
// Ultra-Detailed Vendor Registry, 360° Purchase Ledger, KRA Tax Compliance,
// Multi-Tab Modals, Live DB Dual-Fallback & Bright Colors Excel Export
// =====================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, logActivity } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

export interface Supplier {
    supplier_id: number;
    supplier_code: string;
    supplier_name: string;
    address?: string;
    city?: string;
    phone?: string;
    phone2?: string;
    email?: string;
    contact_person?: string;
    kra_pin?: string;
    opening_balance: number;
    balance_type?: string;
    current_balance: number;
    payment_terms?: string;
    notes?: string;
    is_kitchen?: boolean;
    active: boolean;
    created_at?: string;
    updated_at?: string;
    // Computed linked stats
    total_orders?: number;
    total_spend?: number;
    total_batches?: number;
    last_order_date?: string;
}

export interface PurchaseRecord {
    purchase_id: number;
    purchase_no: string;
    purchase_date: string;
    supplier_id: number;
    supplier_name: string;
    supplier_invoice?: string;
    sub_total: number;
    discount: number;
    vat: number;
    grand_total: number;
    status: string;
    payment_status: string;
    notes?: string;
    created_by?: string;
    created_at?: string;
}

export interface BatchRecord {
    batch_id: number;
    batch_number: string;
    product_name?: string;
    generic_name?: string;
    expiry_date: string;
    quantity: number;
    remaining_qty: number;
    purchase_cost: number;
    selling_price: number;
    supplier_id?: number;
    supplier_name?: string;
    purchase_invoice?: string;
    status: string;
}

const defaultFormData = {
    supplier_name: '',
    supplier_code: '',
    address: '',
    city: '',
    phone: '',
    phone2: '',
    email: '',
    contact_person: '',
    kra_pin: '',
    opening_balance: 0,
    balance_type: 'Credit',
    payment_terms: 'Net 30',
    notes: '',
    is_kitchen: false,
    active: true,
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

export default function SuppliersPage() {
    const { activeOutlet } = useOutlet();
    const outletName = activeOutlet?.outlet_name || 'Alpha Pharmacy Main';

    // Core Data
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
    const [batches, setBatches] = useState<BatchRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAutoFit, setIsAutoFit] = useState(true);
    const [activeDbTable, setActiveDbTable] = useState<string>('pharmacy_suppliers');

    // Filters & Sorting
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<'All' | 'Active' | 'Inactive'>('All');
    const [filterPaymentTerms, setFilterPaymentTerms] = useState('All');
    const [filterBalance, setFilterBalance] = useState<'All' | 'HasBalance' | 'ZeroBalance' | 'CreditBalance'>('All');
    const [filterCategory, setFilterCategory] = useState<'All' | 'Pharma' | 'Kitchen' | 'WithKRA'>('All');
    const [sortBy, setSortBy] = useState<'newest' | 'name' | 'code' | 'balance_high' | 'spend_high' | 'orders_high'>('spend_high');

    // Selection & Bulk
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    // Pagination
    const [pageSize, setPageSize] = useState<number>(50);
    const [currentPage, setCurrentPage] = useState<number>(1);

    // Modals
    const [showAddEditModal, setShowAddEditModal] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [formData, setFormData] = useState(defaultFormData);
    const [modalTab, setModalTab] = useState<'general' | 'contact' | 'financial' | 'compliance'>('general');
    const [isSaving, setIsSaving] = useState(false);

    // 360° Dossier & Statement Modal
    const [showDossierModal, setShowDossierModal] = useState(false);
    const [dossierSupplier, setDossierSupplier] = useState<Supplier | null>(null);
    const [dossierTab, setDossierTab] = useState<'invoices' | 'batches' | 'statement' | 'profile'>('invoices');

    // Quick Payment / Balance Adjustment Modal
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentSupplier, setPaymentSupplier] = useState<Supplier | null>(null);
    const [paymentAmount, setPaymentAmount] = useState<string>('');
    const [paymentMethod, setPaymentMethod] = useState<string>('Bank Transfer');
    const [paymentRef, setPaymentRef] = useState<string>('');
    const [paymentType, setPaymentType] = useState<'Payment' | 'CreditNote' | 'Adjustment'>('Payment');
    const [paymentNotes, setPaymentNotes] = useState<string>('');
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);

    // =====================================================================
    // LOAD DATA FROM DATABASE WITH SEAMLESS DUAL-FALLBACK
    // =====================================================================
    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            // 1. Fetch Suppliers — ALWAYS use pharmacy_suppliers (only table in schema)
            let suppliersData: Supplier[] = [];

            const { data: pharmData, error: pharmErr } = await supabase
                .from('pharmacy_suppliers')
                .select('*')
                .order('supplier_id', { ascending: false });

            if (!pharmErr) {
                suppliersData = pharmData || [];
            } else {
                console.error('pharmacy_suppliers fetch error:', pharmErr.message);
            }
            // Lock table name — never use 'suppliers' (does not exist in schema)
            setActiveDbTable('pharmacy_suppliers');

            // 2. Fetch Purchases from pharmacy_purchases
            let purchasesData: PurchaseRecord[] = [];
            const { data: pPharmData, error: pPharmErr } = await supabase
                .from('pharmacy_purchases')
                .select('*')
                .order('purchase_date', { ascending: false });

            if (!pPharmErr && pPharmData) {
                purchasesData = pPharmData;
            }
            setPurchases(purchasesData);

            // 3. Fetch Pharmacy Batches
            let batchesData: BatchRecord[] = [];
            const { data: bData, error: bErr } = await supabase
                .from('pharmacy_batches')
                .select('batch_id, batch_number, expiry_date, quantity, remaining_qty, purchase_cost, selling_price, supplier_id, supplier_name, purchase_invoice, status');
            if (!bErr && bData) {
                batchesData = bData as any;
                setBatches(batchesData);
            }

            // 4. Compute linked metrics per supplier
            const enrichedSuppliers: Supplier[] = suppliersData.map((s) => {
                const supplierPurchases = purchasesData.filter(
                    (p) => Number(p.supplier_id) === Number(s.supplier_id) || (p.supplier_name && p.supplier_name.trim().toLowerCase() === s.supplier_name.trim().toLowerCase())
                );
                const supplierBatches = batchesData.filter(
                    (b) => Number(b.supplier_id) === Number(s.supplier_id) || (b.supplier_name && b.supplier_name.trim().toLowerCase() === s.supplier_name.trim().toLowerCase())
                );

                const totalSpend = supplierPurchases.reduce((acc, p) => acc + (Number(p.grand_total) || 0), 0);
                const lastOrder = supplierPurchases.length > 0 ? supplierPurchases[0].purchase_date : undefined;

                return {
                    ...s,
                    total_orders: supplierPurchases.length,
                    total_spend: totalSpend,
                    total_batches: supplierBatches.length,
                    last_order_date: lastOrder,
                };
            });

            setSuppliers(enrichedSuppliers);
        } catch (err: any) {
            console.error('Failed to load supplier records:', err);
            toast.error(`Database read failed: ${err.message || 'Unknown error'}`);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Generate Next Supplier Code (e.g. SUP-06)
    const generateSupplierCode = (): string => {
        const codes = suppliers
            .map((s) => s.supplier_code)
            .filter((c) => Boolean(c) && c.startsWith('SUP-'))
            .map((c) => parseInt(c.replace('SUP-', ''), 10))
            .filter((n) => !isNaN(n));

        const maxNum = codes.length > 0 ? Math.max(...codes) : 0;
        return `SUP-${String(maxNum + 1).padStart(2, '0')}`;
    };

    // Open Modal for Add
    const openAddModal = () => {
        setEditingSupplier(null);
        setFormData({
            ...defaultFormData,
            supplier_code: generateSupplierCode(),
        });
        setModalTab('general');
        setShowAddEditModal(true);
    };

    // Open Modal for Edit
    const openEditModal = (supplier: Supplier) => {
        setEditingSupplier(supplier);
        setFormData({
            supplier_name: supplier.supplier_name || '',
            supplier_code: supplier.supplier_code || '',
            address: supplier.address || '',
            city: supplier.city || '',
            phone: supplier.phone || '',
            phone2: supplier.phone2 || '',
            email: supplier.email || '',
            contact_person: supplier.contact_person || '',
            kra_pin: supplier.kra_pin || '',
            opening_balance: Number(supplier.opening_balance) || 0,
            balance_type: supplier.balance_type || 'Credit',
            payment_terms: supplier.payment_terms || 'Net 30',
            notes: supplier.notes || '',
            is_kitchen: Boolean(supplier.is_kitchen),
            active: supplier.active !== false,
        });
        setModalTab('general');
        setShowAddEditModal(true);
    };

    // Save or Update Supplier — only uses pharmacy_suppliers (no secondary table sync)
    const handleSaveSupplier = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.supplier_name.trim()) {
            toast.error('Supplier name is required!');
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                supplier_code: formData.supplier_code.trim() || generateSupplierCode(),
                supplier_name: formData.supplier_name.trim(),
                address: formData.address.trim() || null,
                city: formData.city.trim() || null,
                phone: formData.phone.trim() || null,
                phone2: formData.phone2.trim() || null,
                email: formData.email.trim() || null,
                contact_person: formData.contact_person.trim() || null,
                kra_pin: formData.kra_pin.trim().toUpperCase() || null,
                opening_balance: Number(formData.opening_balance) || 0,
                balance_type: formData.balance_type || 'Credit',
                current_balance: editingSupplier
                    ? editingSupplier.current_balance
                    : Number(formData.opening_balance) || 0,
                payment_terms: formData.payment_terms || 'Net 30',
                notes: formData.notes.trim() || null,
                is_kitchen: formData.is_kitchen,
                active: formData.active,
                updated_at: new Date().toISOString(),
            };

            if (editingSupplier) {
                const { error: updErr } = await supabase
                    .from('pharmacy_suppliers')
                    .update(payload)
                    .eq('supplier_id', editingSupplier.supplier_id);
                if (updErr) throw updErr;
                toast.success(`Supplier "${formData.supplier_name}" updated!`);
                await logActivity('Supplier Updated', `Updated vendor ${formData.supplier_name} (${payload.supplier_code})`);
            } else {
                const { error: insErr } = await supabase
                    .from('pharmacy_suppliers')
                    .insert(payload);
                if (insErr) throw insErr;
                toast.success(`Supplier ${payload.supplier_code} successfully registered!`);
                await logActivity('Supplier Created', `Registered new vendor ${formData.supplier_name} (${payload.supplier_code})`);
            }

            setShowAddEditModal(false);
            loadData();
        } catch (err: any) {
            console.error('Error saving supplier:', err);
            toast.error(`Save failed: ${err.message || 'Database error'}`);
        } finally {
            setIsSaving(false);
        }
    };

    // Delete Supplier
    const handleDeleteSupplier = async (s: Supplier) => {
        if (!confirm(`Are you sure you want to delete "${s.supplier_name}" (${s.supplier_code})?`)) return;

        try {
            const { error } = await supabase.from(activeDbTable).delete().eq('supplier_id', s.supplier_id);
            if (error) throw error;

            toast.success(`Supplier "${s.supplier_name}" deleted.`);
            await logActivity('Supplier Deleted', `Deleted vendor ${s.supplier_name} (${s.supplier_code})`);
            loadData();
        } catch (err: any) {
            toast.error(`Delete failed: ${err.message}`);
        }
    };

    // Toggle Active Status
    const handleToggleActive = async (s: Supplier) => {
        const nextActive = !s.active;
        try {
            const { error } = await supabase
                .from(activeDbTable)
                .update({ active: nextActive, updated_at: new Date().toISOString() })
                .eq('supplier_id', s.supplier_id);

            if (error) throw error;
            toast.success(`Vendor marked as ${nextActive ? 'Active' : 'Inactive'}`);
            loadData();
        } catch (err: any) {
            toast.error(`Status change failed: ${err.message}`);
        }
    };

    // Bulk Toggle Active / Inactive
    const handleBulkStatus = async (markActive: boolean) => {
        if (selectedIds.size === 0) return;
        try {
            const ids = Array.from(selectedIds);
            const { error } = await supabase
                .from(activeDbTable)
                .update({ active: markActive, updated_at: new Date().toISOString() })
                .in('supplier_id', ids);

            if (error) throw error;
            toast.success(`${ids.length} suppliers marked as ${markActive ? 'Active' : 'Inactive'}!`);
            setSelectedIds(new Set());
            loadData();
        } catch (err: any) {
            toast.error(`Bulk update failed: ${err.message}`);
        }
    };

    // Open Quick Payment Modal
    const handleOpenPayment = (s: Supplier) => {
        setPaymentSupplier(s);
        setPaymentAmount(s.current_balance > 0 ? String(s.current_balance) : '');
        setPaymentMethod('Bank Transfer');
        setPaymentRef('');
        setPaymentType('Payment');
        setPaymentNotes('');
        setShowPaymentModal(true);
    };

    // Process Supplier Payment / Balance Adjustment
    const handleProcessPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!paymentSupplier) return;

        const amountNum = parseFloat(paymentAmount);
        if (isNaN(amountNum) || amountNum <= 0) {
            toast.error('Please enter a valid positive payment amount');
            return;
        }

        setIsProcessingPayment(true);
        try {
            let newBalance = Number(paymentSupplier.current_balance) || 0;
            if (paymentType === 'Payment') {
                newBalance = Math.max(0, newBalance - amountNum);
            } else if (paymentType === 'CreditNote') {
                newBalance = Math.max(0, newBalance - amountNum);
            } else if (paymentType === 'Adjustment') {
                newBalance = amountNum;
            }

            const { error } = await supabase
                .from(activeDbTable)
                .update({
                    current_balance: newBalance,
                    updated_at: new Date().toISOString(),
                    notes: `${paymentSupplier.notes || ''}\n[${new Date().toLocaleDateString()}] ${paymentType} of Ksh ${amountNum.toLocaleString()} via ${paymentMethod} (Ref: ${paymentRef || 'N/A'})`,
                })
                .eq('supplier_id', paymentSupplier.supplier_id);

            if (error) throw error;

            toast.success(`Payment of Ksh ${amountNum.toLocaleString()} recorded for ${paymentSupplier.supplier_name}! New Balance: Ksh ${newBalance.toLocaleString()}`);
            await logActivity(
                'Supplier Payment',
                `Recorded ${paymentType} Ksh ${amountNum.toLocaleString()} to ${paymentSupplier.supplier_name}. Ref: ${paymentRef || 'None'}`
            );

            setShowPaymentModal(false);
            setPaymentSupplier(null);
            loadData();
        } catch (err: any) {
            toast.error(`Payment processing failed: ${err.message}`);
        } finally {
            setIsProcessingPayment(false);
        }
    };

    // Open 360° Dossier
    const handleOpenDossier = (s: Supplier) => {
        setDossierSupplier(s);
        setDossierTab('invoices');
        setShowDossierModal(true);
    };

    // =====================================================================
    // FILTERED & SORTED DATA
    // =====================================================================
    const filtered = useMemo(() => {
        return suppliers.filter((s) => {
            // Search query
            if (search.trim()) {
                const q = search.toLowerCase();
                const matchName = (s.supplier_name || '').toLowerCase().includes(q);
                const matchCode = (s.supplier_code || '').toLowerCase().includes(q);
                const matchContact = (s.contact_person || '').toLowerCase().includes(q);
                const matchPhone = (s.phone || '').includes(q) || (s.phone2 || '').includes(q);
                const matchEmail = (s.email || '').toLowerCase().includes(q);
                const matchKra = (s.kra_pin || '').toLowerCase().includes(q);
                const matchCity = (s.city || '').toLowerCase().includes(q);
                if (!matchName && !matchCode && !matchContact && !matchPhone && !matchEmail && !matchKra && !matchCity) {
                    return false;
                }
            }

            // Status
            if (filterStatus === 'Active' && !s.active) return false;
            if (filterStatus === 'Inactive' && s.active) return false;

            // Payment Terms
            if (filterPaymentTerms !== 'All') {
                if (filterPaymentTerms === 'Cash' && !(s.payment_terms || '').toLowerCase().includes('cash')) return false;
                if (filterPaymentTerms === 'Credit' && !(s.payment_terms || '').toLowerCase().includes('credit')) return false;
                if (filterPaymentTerms === 'Net 30' && !(s.payment_terms || '').includes('30')) return false;
                if (filterPaymentTerms === 'Net 60' && !(s.payment_terms || '').includes('60')) return false;
            }

            // Balance
            if (filterBalance === 'HasBalance' && (!s.current_balance || s.current_balance <= 0)) return false;
            if (filterBalance === 'ZeroBalance' && s.current_balance > 0) return false;
            if (filterBalance === 'CreditBalance' && s.balance_type !== 'Credit') return false;

            // Category
            if (filterCategory === 'Pharma' && s.is_kitchen) return false;
            if (filterCategory === 'Kitchen' && !s.is_kitchen) return false;
            if (filterCategory === 'WithKRA' && !s.kra_pin) return false;

            return true;
        }).sort((a, b) => {
            if (sortBy === 'newest') return (b.supplier_id || 0) - (a.supplier_id || 0);
            if (sortBy === 'name') return a.supplier_name.localeCompare(b.supplier_name);
            if (sortBy === 'code') return a.supplier_code.localeCompare(b.supplier_code);
            if (sortBy === 'balance_high') return (b.current_balance || 0) - (a.current_balance || 0);
            if (sortBy === 'spend_high') return (b.total_spend || 0) - (a.total_spend || 0);
            if (sortBy === 'orders_high') return (b.total_orders || 0) - (a.total_orders || 0);
            return 0;
        });
    }, [suppliers, search, filterStatus, filterPaymentTerms, filterBalance, filterCategory, sortBy]);

    // Pagination
    const totalPages = pageSize === -1 ? 1 : Math.max(1, Math.ceil(filtered.length / pageSize));
    const paginated = useMemo(() => {
        if (pageSize === -1) return filtered;
        const start = (currentPage - 1) * pageSize;
        return filtered.slice(start, start + pageSize);
    }, [filtered, currentPage, pageSize]);

    // KPI Metrics Computation
    const kpis = useMemo(() => {
        const total = suppliers.length;
        const active = suppliers.filter((s) => s.active).length;
        const inactive = total - active;
        const withKra = suppliers.filter((s) => Boolean(s.kra_pin && s.kra_pin.trim().length > 3)).length;
        const totalPayables = suppliers.reduce((sum, s) => sum + (Number(s.current_balance) || 0), 0);
        const suppliersWithDebt = suppliers.filter((s) => Number(s.current_balance) > 0).length;
        const totalLifetimePurchases = purchases.reduce((sum, p) => sum + (Number(p.grand_total) || 0), 0);
        const totalInvoices = purchases.length;

        // Top supplier
        const sortedBySpend = [...suppliers].sort((a, b) => (b.total_spend || 0) - (a.total_spend || 0));
        const topSupplier = sortedBySpend.length > 0 && (sortedBySpend[0].total_spend || 0) > 0 ? sortedBySpend[0] : null;

        return {
            total,
            active,
            inactive,
            withKra,
            kraRate: total > 0 ? ((withKra / total) * 100).toFixed(0) : '0',
            totalPayables,
            suppliersWithDebt,
            totalLifetimePurchases,
            totalInvoices,
            topSupplierName: topSupplier ? topSupplier.supplier_name : 'None yet',
            topSupplierSpend: topSupplier ? topSupplier.total_spend || 0 : 0,
        };
    }, [suppliers, purchases]);

    // Select All / Deselect
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(new Set(paginated.map((s) => s.supplier_id)));
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleSelectOne = (id: number) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    // =====================================================================
    // BRIGHT COLORS EXCEL EXPORTER (SpreadsheetML XML)
    // Matches the exact high-voltage vivid styling of Batches / Expiry Page
    // =====================================================================
    const exportBrightExcel = () => {
        if (filtered.length === 0) {
            toast.error('No suppliers to export');
            return;
        }

        const genDate = new Date().toLocaleString('en-GB');
        const totalBal = filtered.reduce((acc, s) => acc + (Number(s.current_balance) || 0), 0);
        const totalSpend = filtered.reduce((acc, s) => acc + (Number(s.total_spend) || 0), 0);
        const totalOrders = filtered.reduce((acc, s) => acc + (Number(s.total_orders) || 0), 0);

        const xmlString = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>Alpha Pharmacy Supplier Master Register</Title>
  <Subject>Pharmaceutical Procurement &amp; Vendor Ledger Audit</Subject>
  <Author>Alpha Pharmacy Management System</Author>
  <Created>${new Date().toISOString()}</Created>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#0f172a"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <!-- BRIGHT VIBRANT TITLE & META BANNERS -->
  <Style ss:ID="TitleBanner">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="16" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#00C853" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="MetaBanner">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#0091EA" ss:Pattern="Solid"/>
  </Style>

  <!-- VIVID KPI DASHBOARD CARDS -->
  <Style ss:ID="KpiHdrBlue">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="9" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#2979FF" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="KpiValBlue">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="13" ss:Bold="1" ss:Color="#0D47A1"/>
   <Interior ss:Color="#E3F2FD" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="KpiHdrGreen">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="9" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#00C853" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="KpiValGreen">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="13" ss:Bold="1" ss:Color="#1B5E20"/>
   <Interior ss:Color="#E8F8F5" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="KpiHdrRed">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="9" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#FF1744" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="KpiValRed">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="13" ss:Bold="1" ss:Color="#B71C1C"/>
   <Interior ss:Color="#FFEBEE" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="KpiHdrAmber">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="9" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#FF9100" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="KpiValAmber">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="13" ss:Bold="1" ss:Color="#E65100"/>
   <Interior ss:Color="#FFF8E1" ss:Pattern="Solid"/>
  </Style>

  <!-- TABLE HEADER -->
  <Style ss:ID="ColHeader">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#1E293B" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#00C853"/>
   </Borders>
  </Style>

  <!-- CELL STYLES -->
  <Style ss:ID="CellText">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#0f172a"/>
  </Style>
  <Style ss:ID="CellTextBold">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#0f172a"/>
  </Style>
  <Style ss:ID="CellCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#0f172a"/>
  </Style>
  <Style ss:ID="CellNumber">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#0f172a"/>
   <NumberFormat ss:Format="#,##0"/>
  </Style>
  <Style ss:ID="CellCurrency">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#0D47A1"/>
   <NumberFormat ss:Format="&quot;Ksh &quot;#,##0.00"/>
  </Style>
  <Style ss:ID="CellDebt">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#B71C1C"/>
   <Interior ss:Color="#FFEBEE" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="&quot;Ksh &quot;#,##0.00"/>
  </Style>
  <Style ss:ID="CellClear">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#1B5E20"/>
   <Interior ss:Color="#E8F8F5" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="&quot;Ksh &quot;#,##0.00"/>
  </Style>
  <Style ss:ID="BadgeActive">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="9.5" ss:Bold="1" ss:Color="#1B5E20"/>
   <Interior ss:Color="#C8E6C9" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="BadgeInactive">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="9.5" ss:Bold="1" ss:Color="#757575"/>
   <Interior ss:Color="#EEEEEE" ss:Pattern="Solid"/>
  </Style>

  <!-- SUMMARY TOTALS -->
  <Style ss:ID="SummaryTotalLabel">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#1E293B" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="SummaryTotalCurrency">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#00E676"/>
   <Interior ss:Color="#1E293B" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="&quot;Ksh &quot;#,##0.00"/>
  </Style>
 </Styles>

 <Worksheet ss:Name="Suppliers Master">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="70"/>  <!-- Code -->
   <Column ss:Width="160"/> <!-- Name -->
   <Column ss:Width="110"/> <!-- Contact -->
   <Column ss:Width="95"/>  <!-- Phone -->
   <Column ss:Width="130"/> <!-- Email -->
   <Column ss:Width="90"/>  <!-- City -->
   <Column ss:Width="95"/>  <!-- KRA PIN -->
   <Column ss:Width="90"/>  <!-- Terms -->
   <Column ss:Width="65"/>  <!-- Orders -->
   <Column ss:Width="105"/> <!-- Lifetime Spend -->
   <Column ss:Width="105"/> <!-- Balance -->
   <Column ss:Width="65"/>  <!-- Status -->

   <!-- Title Banner -->
   <Row ss:Height="34">
    <Cell ss:MergeAcross="11" ss:StyleID="TitleBanner"><Data ss:Type="String">ALPHA PHARMACY - SUPERIOR SUPPLIER &amp; PROCUREMENT MASTER</Data></Cell>
   </Row>

   <!-- Meta Banner -->
   <Row ss:Height="20">
    <Cell ss:MergeAcross="11" ss:StyleID="MetaBanner"><Data ss:Type="String">Generated: ${genDate} | Outlet: ${escapeXml(outletName)} | Database: ${escapeXml(activeDbTable)} | Total: ${filtered.length} Vendors</Data></Cell>
   </Row>

   <!-- KPI Cards Row 1 -->
   <Row ss:Height="18">
    <Cell ss:MergeAcross="2" ss:StyleID="KpiHdrBlue"><Data ss:Type="String">TOTAL REGISTERED</Data></Cell>
    <Cell ss:MergeAcross="2" ss:StyleID="KpiHdrGreen"><Data ss:Type="String">LIFETIME PROCUREMENT SPEND</Data></Cell>
    <Cell ss:MergeAcross="2" ss:StyleID="KpiHdrRed"><Data ss:Type="String">OUTSTANDING PAYABLES</Data></Cell>
    <Cell ss:MergeAcross="2" ss:StyleID="KpiHdrAmber"><Data ss:Type="String">TAX COMPLIANCE (KRA PIN)</Data></Cell>
   </Row>
   <Row ss:Height="24">
    <Cell ss:MergeAcross="2" ss:StyleID="KpiValBlue"><Data ss:Type="String">${filtered.length} Vendors (${kpis.active} Active)</Data></Cell>
    <Cell ss:MergeAcross="2" ss:StyleID="KpiValGreen"><Data ss:Type="Number">${totalSpend}</Data></Cell>
    <Cell ss:MergeAcross="2" ss:StyleID="KpiValRed"><Data ss:Type="Number">${totalBal}</Data></Cell>
    <Cell ss:MergeAcross="2" ss:StyleID="KpiValAmber"><Data ss:Type="String">${kpis.withKra} Verified (${kpis.kraRate}%)</Data></Cell>
   </Row>

   <!-- Spacer -->
   <Row ss:Height="10"/>

   <!-- Table Headers -->
   <Row ss:Height="24">
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">SUPPLIER CODE</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">COMPANY NAME</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">CONTACT PERSON</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">PRIMARY PHONE</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">EMAIL ADDRESS</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">CITY / TOWN</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">KRA PIN</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">PAYMENT TERMS</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">ORDERS</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">LIFETIME SPEND</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">CURRENT BALANCE</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">STATUS</Data></Cell>
   </Row>

   <!-- Data Rows -->
   ${filtered
       .map((s) => {
           const bal = Number(s.current_balance) || 0;
           const balStyle = bal > 0 ? 'CellDebt' : 'CellClear';
           return `<Row ss:Height="20">
    <Cell ss:StyleID="CellTextBold"><Data ss:Type="String">${escapeXml(s.supplier_code)}</Data></Cell>
    <Cell ss:StyleID="CellTextBold"><Data ss:Type="String">${escapeXml(s.supplier_name)}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${escapeXml(s.contact_person || '—')}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${escapeXml(s.phone || '—')}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${escapeXml(s.email || '—')}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXml(s.city || '—')}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXml(s.kra_pin || '—')}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${escapeXml(s.payment_terms || 'Cash')}</Data></Cell>
    <Cell ss:StyleID="CellNumber"><Data ss:Type="Number">${s.total_orders || 0}</Data></Cell>
    <Cell ss:StyleID="CellCurrency"><Data ss:Type="Number">${s.total_spend || 0}</Data></Cell>
    <Cell ss:StyleID="${balStyle}"><Data ss:Type="Number">${bal}</Data></Cell>
    <Cell ss:StyleID="${s.active ? 'BadgeActive' : 'BadgeInactive'}"><Data ss:Type="String">${s.active ? 'Active' : 'Inactive'}</Data></Cell>
   </Row>`;
       })
       .join('\n')}

   <!-- Grand Summary Totals -->
   <Row ss:Height="24">
    <Cell ss:MergeAcross="7" ss:StyleID="SummaryTotalLabel"><Data ss:Type="String">GRAND PROCUREMENT TOTALS:</Data></Cell>
    <Cell ss:StyleID="SummaryTotalLabel"><Data ss:Type="Number">${totalOrders}</Data></Cell>
    <Cell ss:StyleID="SummaryTotalCurrency"><Data ss:Type="Number">${totalSpend}</Data></Cell>
    <Cell ss:StyleID="SummaryTotalCurrency"><Data ss:Type="Number">${totalBal}</Data></Cell>
    <Cell ss:StyleID="SummaryTotalLabel"><Data ss:Type="String">—</Data></Cell>
   </Row>
  </Table>
 </Worksheet>
</Workbook>`;

        const blob = new Blob([xmlString], { type: 'application/vnd.ms-excel;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AlphaPharmacy_Suppliers_${new Date().toISOString().split('T')[0]}_SuperPremium.xls`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`Exported ${filtered.length} suppliers to Super Bright Excel!`);
    };

    // Loading State
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-96" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
                <div className="w-14 h-14 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                <p className="mt-4 text-gray-900 font-bold text-base">Connecting to live supplier database...</p>
                <p className="text-xs text-gray-500 mt-1">Reading verified vendor records, purchase ledgers &amp; linked drug batches</p>
            </div>
        );
    }

    return (
        <div className="w-full max-w-full space-y-4 px-1 md:px-2 pb-12" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg flex-shrink-0">
                        🏢
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Suppliers &amp; Procurement Hub</h1>
                            <span className="px-2.5 py-0.5 bg-blue-100 text-blue-900 rounded-full text-xs font-bold border border-blue-200">
                                Enterprise SRM
                            </span>
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded-md text-[11px] font-bold border border-emerald-200 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                DB: {activeDbTable}
                            </span>
                        </div>
                        <p className="text-gray-600 text-xs mt-0.5">
                            Active Outlet: <span className="font-bold text-gray-900">{outletName}</span> • Manage pharmaceutical vendors, drug distributors, procurement orders &amp; KRA compliance
                        </p>
                    </div>
                </div>

                <div className="flex items-center flex-wrap gap-2">
                    {/* Add Supplier Button */}
                    <button
                        onClick={openAddModal}
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white rounded-xl font-bold shadow-sm hover:shadow transition-all flex items-center gap-1.5 text-xs active:scale-95"
                    >
                        <span>➕</span> New Supplier
                    </button>

                    {/* Bright Excel Export */}
                    <button
                        onClick={exportBrightExcel}
                        className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 rounded-xl font-bold shadow-sm transition-all flex items-center gap-1.5 text-xs"
                        title="Download Massive Styled Excel Workbook with bright vivid colors"
                    >
                        <span>📊</span> Super Excel
                    </button>

                    {/* Print */}
                    <button
                        onClick={() => window.print()}
                        className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 rounded-xl font-bold shadow-sm transition-all flex items-center gap-1 text-xs"
                    >
                        <span>🖨️</span> Print
                    </button>

                    {/* Refresh */}
                    <button
                        onClick={() => {
                            loadData();
                            toast.success('Live database reloaded!');
                        }}
                        className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 rounded-xl font-bold shadow-sm transition-all flex items-center gap-1 text-xs"
                    >
                        <span>🔄</span> Refresh
                    </button>
                </div>
            </div>

            {/* Light Gradient Stat KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5 w-full">
                {/* Total Suppliers */}
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-3.5 border border-indigo-100 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xl">🏢</span>
                        <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Vendors</span>
                    </div>
                    <p className="text-xs text-gray-700 font-semibold">Total Suppliers</p>
                    <p className="text-xl font-black text-indigo-950 tracking-tight">{kpis.total}</p>
                    <p className="text-[10px] text-gray-600 font-medium mt-0.5">
                        {kpis.active} Active • {kpis.inactive} Inactive
                    </p>
                </div>

                {/* Total Procurement Spend */}
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-3.5 border border-emerald-100 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xl">💰</span>
                        <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Lifetime Volume</span>
                    </div>
                    <p className="text-xs text-gray-700 font-semibold">Total Purchases</p>
                    <p className="text-base font-black text-emerald-950 tracking-tight">Ksh {kpis.totalLifetimePurchases.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-600 font-medium mt-0.5">{kpis.totalInvoices} Orders in DB</p>
                </div>

                {/* Total Payables Outstanding */}
                <div className="bg-gradient-to-br from-rose-50 to-red-50 rounded-2xl p-3.5 border border-rose-100 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xl">💳</span>
                        <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">Payables Due</span>
                    </div>
                    <p className="text-xs text-gray-700 font-semibold">Outstanding Debt</p>
                    <p className="text-base font-black text-rose-950 tracking-tight">Ksh {kpis.totalPayables.toLocaleString()}</p>
                    <p className="text-[10px] text-red-700 font-bold mt-0.5">{kpis.suppliersWithDebt} Suppliers with Balance</p>
                </div>

                {/* KRA Tax Compliance */}
                <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-2xl p-3.5 border border-cyan-100 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xl">🛡️</span>
                        <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Tax PIN</span>
                    </div>
                    <p className="text-xs text-gray-700 font-semibold">KRA Compliant</p>
                    <p className="text-xl font-black text-blue-950 tracking-tight">{kpis.withKra}</p>
                    <p className="text-[10px] text-blue-800 font-bold mt-0.5">{kpis.kraRate}% Verification Rate</p>
                </div>

                {/* Top Supplier */}
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-3.5 border border-amber-100 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xl">⭐</span>
                        <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Top Partner</span>
                    </div>
                    <p className="text-xs text-gray-700 font-semibold truncate" title={kpis.topSupplierName}>
                        {kpis.topSupplierName}
                    </p>
                    <p className="text-base font-black text-amber-950 tracking-tight">Ksh {kpis.topSupplierSpend.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-600 font-medium mt-0.5">Highest Purchase Vol</p>
                </div>

                {/* Payment Terms Mix */}
                <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl p-3.5 border border-violet-100 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xl">⏱️</span>
                        <span className="text-[10px] font-bold text-violet-700 uppercase tracking-wider">Credit Terms</span>
                    </div>
                    <p className="text-xs text-gray-700 font-semibold">Standard Settlement</p>
                    <p className="text-lg font-black text-violet-950 tracking-tight">Net 30 Days</p>
                    <p className="text-[10px] text-violet-800 font-bold mt-0.5">Flexible Pharma Terms</p>
                </div>
            </div>

            {/* Multi-Dimensional Filter Bar */}
            <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm space-y-3">
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5">
                    {/* Omni-Search */}
                    <div className="relative flex-1 min-w-[240px]">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600 text-sm">🔍</span>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setCurrentPage(1);
                            }}
                            placeholder="Search by code (SUP-01), name, contact, phone, email, KRA PIN, city..."
                            className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-gray-900 placeholder:text-gray-500"
                        />
                        {search && (
                            <button
                                onClick={() => setSearch('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black text-xs font-bold"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Filter Status */}
                    <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
                        {(['All', 'Active', 'Inactive'] as const).map((st) => (
                            <button
                                key={st}
                                onClick={() => {
                                    setFilterStatus(st);
                                    setCurrentPage(1);
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    filterStatus === st
                                        ? 'bg-white text-gray-900 shadow-xs'
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                {st}
                            </button>
                        ))}
                    </div>

                    {/* Filter Balance */}
                    <select
                        value={filterBalance}
                        onChange={(e) => {
                            setFilterBalance(e.target.value as any);
                            setCurrentPage(1);
                        }}
                        className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:border-blue-600 outline-none"
                    >
                        <option value="All">All Balances</option>
                        <option value="HasBalance">Pending Debt (&gt; Ksh 0)</option>
                        <option value="ZeroBalance">Zero Balance / Cleared</option>
                        <option value="CreditBalance">Credit Terms</option>
                    </select>

                    {/* Filter Terms */}
                    <select
                        value={filterPaymentTerms}
                        onChange={(e) => {
                            setFilterPaymentTerms(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:border-blue-600 outline-none"
                    >
                        <option value="All">All Payment Terms</option>
                        <option value="Cash">Cash / Immediate</option>
                        <option value="Credit">Credit Accounts</option>
                        <option value="Net 30">Net 30 Days</option>
                        <option value="Net 60">Net 60 Days</option>
                    </select>

                    {/* Sort By */}
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:border-blue-600 outline-none"
                    >
                        <option value="spend_high">Sort: Purchase Spend (High→Low)</option>
                        <option value="balance_high">Sort: Balance Owed (High→Low)</option>
                        <option value="name">Sort: Company Name (A-Z)</option>
                        <option value="code">Sort: Supplier Code (SUP-01)</option>
                        <option value="orders_high">Sort: Total Orders</option>
                        <option value="newest">Sort: Newest Added</option>
                    </select>

                    {/* Auto-Fit dense toggle */}
                    <button
                        onClick={() => setIsAutoFit(!isAutoFit)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                            isAutoFit
                                ? 'bg-blue-50 border-blue-200 text-blue-900'
                                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                        title="Toggle dense datagrid layout"
                    >
                        <span>⛶</span> {isAutoFit ? 'Dense Grid' : 'Standard'}
                    </button>
                </div>

                {/* Bulk Actions Floating Row if selected */}
                {selectedIds.size > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-2.5 flex items-center justify-between text-xs font-bold text-blue-950 animate-fadeIn">
                        <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                                {selectedIds.size}
                            </span>
                            <span>suppliers selected</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handleBulkStatus(true)}
                                className="px-3 py-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                            >
                                Set Active
                            </button>
                            <button
                                onClick={() => handleBulkStatus(false)}
                                className="px-3 py-1 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors"
                            >
                                Set Inactive
                            </button>
                            <button
                                onClick={() => setSelectedIds(new Set())}
                                className="px-3 py-1 bg-white border border-gray-300 text-gray-800 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                                Deselect All
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Main DataGrid Table */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/80 border-b border-gray-200 text-[11px] font-black uppercase tracking-wider text-gray-900">
                                <th className="p-3 w-8">
                                    <input
                                        type="checkbox"
                                        checked={paginated.length > 0 && selectedIds.size === paginated.length}
                                        onChange={(e) => handleSelectAll(e.target.checked)}
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    />
                                </th>
                                <th className="p-3">Supplier Code</th>
                                <th className="p-3">Vendor / Company Name</th>
                                <th className="p-3">Contact Person &amp; Phone</th>
                                <th className="p-3">Location / City</th>
                                <th className="p-3">KRA PIN</th>
                                <th className="p-3">Payment Terms</th>
                                <th className="p-3 text-right">Orders</th>
                                <th className="p-3 text-right">Lifetime Spend</th>
                                <th className="p-3 text-right">Current Balance</th>
                                <th className="p-3 text-center">Status</th>
                                <th className="p-3 text-center w-36">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-xs text-gray-900 font-medium">
                            {paginated.length === 0 ? (
                                <tr>
                                    <td colSpan={12} className="p-12 text-center text-gray-500">
                                        <div className="text-4xl mb-2">🔍</div>
                                        <p className="font-bold text-gray-800 text-sm">No suppliers match your current filter</p>
                                        <p className="text-xs text-gray-500 mt-1">Try clearing your search or switching filter categories</p>
                                    </td>
                                </tr>
                            ) : (
                                paginated.map((s) => {
                                    const isSelected = selectedIds.has(s.supplier_id);
                                    const bal = Number(s.current_balance) || 0;
                                    const hasDebt = bal > 0;

                                    return (
                                        <tr
                                            key={s.supplier_id}
                                            className={`hover:bg-blue-50/40 transition-colors ${
                                                isSelected ? 'bg-blue-50/70' : ''
                                            }`}
                                        >
                                            <td className="p-3">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => handleSelectOne(s.supplier_id)}
                                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                />
                                            </td>
                                            <td className="p-3 whitespace-nowrap">
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(s.supplier_code);
                                                        toast.success(`Copied ${s.supplier_code}`);
                                                    }}
                                                    className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-900 font-mono font-bold rounded text-[11px] border border-gray-300 inline-flex items-center gap-1 transition-colors"
                                                    title="Click to copy code"
                                                >
                                                    {s.supplier_code}
                                                </button>
                                            </td>
                                            <td className="p-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 font-black flex items-center justify-center text-xs flex-shrink-0">
                                                        {s.supplier_name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-gray-900 text-xs truncate max-w-[200px]" title={s.supplier_name}>
                                                            {s.supplier_name}
                                                        </p>
                                                        {s.email && (
                                                            <a
                                                                href={`mailto:${s.email}`}
                                                                className="text-[10px] text-blue-600 hover:underline truncate block max-w-[200px]"
                                                            >
                                                                {s.email}
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-3 whitespace-nowrap">
                                                <p className="font-semibold text-gray-900">{s.contact_person || '—'}</p>
                                                {s.phone ? (
                                                    <a
                                                        href={`tel:${s.phone}`}
                                                        className="text-[11px] text-gray-700 hover:text-blue-600 font-mono block"
                                                    >
                                                        📞 {s.phone}
                                                    </a>
                                                ) : (
                                                    <span className="text-gray-400 text-[10px]">No phone</span>
                                                )}
                                            </td>
                                            <td className="p-3 whitespace-nowrap">
                                                <p className="text-gray-900 font-semibold">{s.city || '—'}</p>
                                                <p className="text-[10px] text-gray-500 truncate max-w-[140px]" title={s.address}>
                                                    {s.address || '—'}
                                                </p>
                                            </td>
                                            <td className="p-3 whitespace-nowrap">
                                                {s.kra_pin ? (
                                                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded font-mono font-bold text-[10px] border border-emerald-200">
                                                        ✓ {s.kra_pin}
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] text-gray-400 font-medium">None</span>
                                                )}
                                            </td>
                                            <td className="p-3 whitespace-nowrap">
                                                <span className="px-2 py-0.5 bg-purple-50 text-purple-800 rounded-full text-[10px] font-bold border border-purple-200">
                                                    {s.payment_terms || 'Cash'}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right whitespace-nowrap">
                                                <span className="px-2 py-0.5 bg-gray-100 text-gray-900 font-bold rounded-full text-[11px]">
                                                    {s.total_orders || 0}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right whitespace-nowrap font-bold text-gray-900">
                                                Ksh {(s.total_spend || 0).toLocaleString()}
                                            </td>
                                            <td className="p-3 text-right whitespace-nowrap">
                                                {hasDebt ? (
                                                    <span className="px-2 py-1 bg-red-100 text-red-900 rounded-lg font-black text-xs border border-red-200">
                                                        Ksh {bal.toLocaleString()}
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-1 bg-emerald-100 text-emerald-900 rounded-lg font-black text-xs border border-emerald-200">
                                                        Cleared
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3 text-center whitespace-nowrap">
                                                <button
                                                    onClick={() => handleToggleActive(s)}
                                                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all border ${
                                                        s.active
                                                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200'
                                                            : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
                                                    }`}
                                                >
                                                    {s.active ? '● Active' : '○ Inactive'}
                                                </button>
                                            </td>
                                            <td className="p-3 text-center whitespace-nowrap">
                                                <div className="flex items-center justify-center gap-1">
                                                    {/* View 360° Profile */}
                                                    <button
                                                        onClick={() => handleOpenDossier(s)}
                                                        className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                                        title="360° Dossier & Purchase History"
                                                    >
                                                        👁️
                                                    </button>

                                                    {/* Quick Record Payment */}
                                                    <button
                                                        onClick={() => handleOpenPayment(s)}
                                                        className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors"
                                                        title="Record Payout / Adjust Balance"
                                                    >
                                                        💳
                                                    </button>

                                                    {/* Edit */}
                                                    <button
                                                        onClick={() => openEditModal(s)}
                                                        className="p-1.5 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors"
                                                        title="Edit Supplier Profile"
                                                    >
                                                        ✏️
                                                    </button>

                                                    {/* Delete */}
                                                    <button
                                                        onClick={() => handleDeleteSupplier(s)}
                                                        className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                                                        title="Delete Supplier"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                <div className="p-3 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-700 font-semibold">
                    <div className="flex items-center gap-2">
                        <span>Showing {paginated.length} of {filtered.length} suppliers</span>
                        <span>•</span>
                        <select
                            value={pageSize}
                            onChange={(e) => {
                                setPageSize(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="px-2 py-1 bg-white border border-gray-300 rounded-md font-bold text-gray-900"
                        >
                            <option value={25}>25 per page</option>
                            <option value={50}>50 per page</option>
                            <option value={100}>100 per page</option>
                            <option value={-1}>Show All</option>
                        </select>
                    </div>

                    {pageSize !== -1 && totalPages > 1 && (
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1 bg-white border border-gray-300 rounded-md font-bold text-gray-900 disabled:opacity-40 hover:bg-gray-100"
                            >
                                Prev
                            </button>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                const pageNum = i + 1;
                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setCurrentPage(pageNum)}
                                        className={`w-7 h-7 rounded-md font-bold text-xs ${
                                            currentPage === pageNum
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-white border border-gray-300 text-gray-900 hover:bg-gray-100'
                                        }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                            <button
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1 bg-white border border-gray-300 rounded-md font-bold text-gray-900 disabled:opacity-40 hover:bg-gray-100"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* =====================================================================
                SUPER ULTRA ADD / EDIT SUPPLIER MODAL (Multi-Tab)
            ===================================================================== */}
            {showAddEditModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 animate-fadeIn">
                    <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
                        {/* Modal Header */}
                        <div className="p-5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl font-bold">
                                    🏢
                                </div>
                                <div>
                                    <h2 className="text-lg font-black tracking-tight">
                                        {editingSupplier ? 'Edit Supplier Profile' : 'Register New Pharmaceutical Vendor'}
                                    </h2>
                                    <p className="text-xs text-blue-100">
                                        Auto-assigned Code: <span className="font-mono font-bold text-white">{formData.supplier_code || 'SUP-XX'}</span> • Synced with {activeDbTable}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowAddEditModal(false)}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold text-sm"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Tabs */}
                        <div className="flex border-b border-gray-200 px-5 bg-gray-50/70 overflow-x-auto text-xs font-bold text-gray-600">
                            {[
                                { id: 'general', label: 'General & Profile', icon: '🏷️' },
                                { id: 'contact', label: 'Contact & Location', icon: '📞' },
                                { id: 'financial', label: 'Financial & Terms', icon: '💳' },
                                { id: 'compliance', label: 'Tax & Compliance', icon: '📋' },
                            ].map((t) => (
                                <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => setModalTab(t.id as any)}
                                    className={`py-3 px-4 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-all ${
                                        modalTab === t.id
                                            ? 'border-blue-600 text-blue-600 bg-white'
                                            : 'border-transparent hover:text-gray-900'
                                    }`}
                                >
                                    <span>{t.icon}</span>
                                    <span>{t.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* Modal Body Form */}
                        <form onSubmit={handleSaveSupplier} className="p-6 overflow-y-auto space-y-4 flex-1">
                            {/* TAB 1: GENERAL */}
                            {modalTab === 'general' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-xs font-black text-gray-900 mb-1">
                                                Supplier Code *
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                value={formData.supplier_code}
                                                onChange={(e) => setFormData({ ...formData, supplier_code: e.target.value })}
                                                placeholder="SUP-01"
                                                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-mono font-bold text-gray-900 focus:bg-white focus:border-blue-600 outline-none"
                                            />
                                        </div>
                                        <div className="sm:col-span-2">
                                            <label className="block text-xs font-black text-gray-900 mb-1">
                                                Company / Supplier Name *
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                value={formData.supplier_name}
                                                onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                                                placeholder="e.g. Novartis Kenya Ltd / Laborex Pharma"
                                                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:bg-white focus:border-blue-600 outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-black text-gray-900 mb-1">
                                                Key Contact Person
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.contact_person}
                                                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                                                placeholder="e.g. Dr. Jane Smith / Sales Rep"
                                                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-medium text-gray-900 focus:bg-white focus:border-blue-600 outline-none"
                                            />
                                        </div>
                                        <div className="flex items-center gap-6 pt-5">
                                            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-900">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.active}
                                                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                />
                                                <span>Active Vendor</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-900">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.is_kitchen}
                                                    onChange={(e) => setFormData({ ...formData, is_kitchen: e.target.checked })}
                                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                />
                                                <span>Internal / Direct Supply</span>
                                            </label>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black text-gray-900 mb-1">
                                            Internal Procurement Notes
                                        </label>
                                        <textarea
                                            rows={3}
                                            value={formData.notes}
                                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                            placeholder="Special drug discounts, lead times, order delivery conditions..."
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs text-gray-900 focus:bg-white focus:border-blue-600 outline-none"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* TAB 2: CONTACT */}
                            {modalTab === 'contact' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-black text-gray-900 mb-1">
                                                Primary Phone Number *
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.phone}
                                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                                placeholder="e.g. 0712345678"
                                                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-mono font-bold text-gray-900 focus:bg-white focus:border-blue-600 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-gray-900 mb-1">
                                                Alternative Phone / WhatsApp
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.phone2}
                                                onChange={(e) => setFormData({ ...formData, phone2: e.target.value })}
                                                placeholder="e.g. 0798765432"
                                                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-mono text-gray-900 focus:bg-white focus:border-blue-600 outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black text-gray-900 mb-1">
                                            Official Orders Email
                                        </label>
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            placeholder="orders@pharma-distributor.co.ke"
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-medium text-gray-900 focus:bg-white focus:border-blue-600 outline-none"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-black text-gray-900 mb-1">
                                                City / Town
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.city}
                                                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                                placeholder="e.g. Nairobi / Eldoret / Mombasa"
                                                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-medium text-gray-900 focus:bg-white focus:border-blue-600 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-gray-900 mb-1">
                                                Physical Warehouse / Street Address
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.address}
                                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                                placeholder="e.g. Commercial Street, Industrial Area"
                                                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-medium text-gray-900 focus:bg-white focus:border-blue-600 outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB 3: FINANCIAL & TERMS */}
                            {modalTab === 'financial' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-black text-gray-900 mb-1">
                                                Standard Payment Terms
                                            </label>
                                            <select
                                                value={formData.payment_terms}
                                                onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                                                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:bg-white focus:border-blue-600 outline-none"
                                            >
                                                <option value="Cash">Cash on Delivery (COD)</option>
                                                <option value="Net 7">Net 7 Days</option>
                                                <option value="Net 15">Net 15 Days</option>
                                                <option value="Net 30">Net 30 Days (Standard Pharma)</option>
                                                <option value="Net 60">Net 60 Days</option>
                                                <option value="Net 90">Net 90 Days</option>
                                                <option value="Credit">General Credit Account</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-gray-900 mb-1">
                                                Balance Account Type
                                            </label>
                                            <select
                                                value={formData.balance_type}
                                                onChange={(e) => setFormData({ ...formData, balance_type: e.target.value })}
                                                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:bg-white focus:border-blue-600 outline-none"
                                            >
                                                <option value="Credit">Credit (We owe supplier)</option>
                                                <option value="Debit">Debit (Supplier owes us / prepaid)</option>
                                            </select>
                                        </div>
                                    </div>

                                    {!editingSupplier && (
                                        <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200">
                                            <label className="block text-xs font-black text-amber-950 mb-1">
                                                Initial Opening Balance (Ksh)
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={formData.opening_balance}
                                                onChange={(e) => setFormData({ ...formData, opening_balance: parseFloat(e.target.value) || 0 })}
                                                placeholder="0.00"
                                                className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-sm font-mono font-bold text-gray-900 focus:border-amber-600 outline-none"
                                            />
                                            <p className="text-[11px] text-amber-800 mt-1">
                                                Enter any existing debt brought forward from your prior ledger.
                                            </p>
                                        </div>
                                    )}

                                    {editingSupplier && (
                                        <div className="bg-blue-50 p-4 rounded-2xl border border-blue-200 flex items-center justify-between">
                                            <div>
                                                <p className="text-xs font-bold text-blue-900">Current Outstanding Balance</p>
                                                <p className="text-xl font-black text-blue-950 mt-0.5">
                                                    Ksh {Number(editingSupplier.current_balance || 0).toLocaleString()}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setShowAddEditModal(false);
                                                    handleOpenPayment(editingSupplier);
                                                }}
                                                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-xs"
                                            >
                                                Record Payout
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB 4: COMPLIANCE */}
                            {modalTab === 'compliance' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-black text-gray-900 mb-1">
                                            KRA PIN / TIN Number (Kenya Revenue Authority)
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.kra_pin}
                                            onChange={(e) => setFormData({ ...formData, kra_pin: e.target.value.toUpperCase() })}
                                            placeholder="P051234567X"
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-mono font-bold text-gray-900 focus:bg-white focus:border-blue-600 outline-none uppercase"
                                        />
                                        <p className="text-[11px] text-gray-500 mt-1">
                                            Required for electronic tax invoices (eTIMS) and annual corporate tax deduction filings.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Modal Footer Controls */}
                            <div className="pt-4 border-t border-gray-200 flex items-center justify-between">
                                <button
                                    type="button"
                                    onClick={() => setShowAddEditModal(false)}
                                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                                >
                                    {isSaving ? 'Saving to Database...' : editingSupplier ? 'Update Supplier' : 'Save Supplier'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* =====================================================================
                360° SUPPLIER DOSSIER & PURCHASE LEDGER MODAL
            ===================================================================== */}
            {showDossierModal && dossierSupplier && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 animate-fadeIn">
                    <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
                        {/* Header */}
                        <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-xl font-black">
                                    {dossierSupplier.supplier_name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-lg font-black">{dossierSupplier.supplier_name}</h2>
                                        <span className="px-2 py-0.5 bg-white/20 text-white font-mono rounded text-xs font-bold">
                                            {dossierSupplier.supplier_code}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-300 mt-0.5">
                                        {dossierSupplier.city || 'Kenya'} • {dossierSupplier.contact_person ? `Contact: ${dossierSupplier.contact_person}` : ''} • {dossierSupplier.phone || ''}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowDossierModal(false)}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold text-sm"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Dossier KPI Strip */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-4 bg-gray-50 border-b border-gray-200">
                            <div className="bg-white p-3 rounded-xl border border-gray-200">
                                <p className="text-[10px] text-gray-500 font-bold uppercase">Total Purchases</p>
                                <p className="text-base font-black text-gray-900">
                                    Ksh {(dossierSupplier.total_spend || 0).toLocaleString()}
                                </p>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-gray-200">
                                <p className="text-[10px] text-gray-500 font-bold uppercase">Invoices Count</p>
                                <p className="text-base font-black text-gray-900">
                                    {dossierSupplier.total_orders || 0} Orders
                                </p>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-gray-200">
                                <p className="text-[10px] text-gray-500 font-bold uppercase">Batches Received</p>
                                <p className="text-base font-black text-gray-900">
                                    {dossierSupplier.total_batches || 0} Lots
                                </p>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-gray-200">
                                <p className="text-[10px] text-gray-500 font-bold uppercase">Current Debt Due</p>
                                <p className={`text-base font-black ${dossierSupplier.current_balance > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                                    Ksh {(Number(dossierSupplier.current_balance) || 0).toLocaleString()}
                                </p>
                            </div>
                        </div>

                        {/* Dossier Tabs */}
                        <div className="flex border-b border-gray-200 px-5 bg-white text-xs font-bold text-gray-600">
                            {[
                                { id: 'invoices', label: `Purchase Invoices (${purchases.filter((p) => Number(p.supplier_id) === Number(dossierSupplier.supplier_id) || (p.supplier_name && p.supplier_name.trim().toLowerCase() === dossierSupplier.supplier_name.trim().toLowerCase())).length})`, icon: '📋' },
                                { id: 'batches', label: `Supplied Batches (${batches.filter((b) => Number(b.supplier_id) === Number(dossierSupplier.supplier_id) || (b.supplier_name && b.supplier_name.trim().toLowerCase() === dossierSupplier.supplier_name.trim().toLowerCase())).length})`, icon: '📦' },
                                { id: 'profile', label: 'Company Dossier', icon: '🏢' },
                            ].map((t) => (
                                <button
                                    key={t.id}
                                    onClick={() => setDossierTab(t.id as any)}
                                    className={`py-3 px-4 border-b-2 flex items-center gap-1.5 transition-all ${
                                        dossierTab === t.id
                                            ? 'border-blue-600 text-blue-600'
                                            : 'border-transparent hover:text-gray-900'
                                    }`}
                                >
                                    <span>{t.icon}</span>
                                    <span>{t.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* Dossier Content */}
                        <div className="p-5 overflow-y-auto flex-1">
                            {dossierTab === 'invoices' && (
                                <div className="space-y-3">
                                    {purchases.filter(
                                        (p) => Number(p.supplier_id) === Number(dossierSupplier.supplier_id) || (p.supplier_name && p.supplier_name.trim().toLowerCase() === dossierSupplier.supplier_name.trim().toLowerCase())
                                    ).length === 0 ? (
                                        <div className="p-8 text-center text-gray-500">
                                            <p className="font-bold text-gray-800">No purchase invoices on record for this supplier yet</p>
                                            <p className="text-xs text-gray-500 mt-1">Purchases created via Purchase Entry will automatically display here</p>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto border border-gray-200 rounded-xl">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-900 border-b border-gray-200">
                                                    <tr>
                                                        <th className="p-2.5">Invoice / Order #</th>
                                                        <th className="p-2.5">Date</th>
                                                        <th className="p-2.5">Supplier Inv #</th>
                                                        <th className="p-2.5 text-right">Subtotal</th>
                                                        <th className="p-2.5 text-right">Total Amount</th>
                                                        <th className="p-2.5 text-center">Status</th>
                                                        <th className="p-2.5 text-center">Payment</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 text-gray-900 font-medium">
                                                    {purchases
                                                        .filter(
                                                            (p) => Number(p.supplier_id) === Number(dossierSupplier.supplier_id) || (p.supplier_name && p.supplier_name.trim().toLowerCase() === dossierSupplier.supplier_name.trim().toLowerCase())
                                                        )
                                                        .map((p) => (
                                                            <tr key={p.purchase_id} className="hover:bg-gray-50">
                                                                <td className="p-2.5 font-mono font-bold text-blue-700">{p.purchase_no}</td>
                                                                <td className="p-2.5 whitespace-nowrap">{p.purchase_date}</td>
                                                                <td className="p-2.5 font-mono">{p.supplier_invoice || '—'}</td>
                                                                <td className="p-2.5 text-right font-mono">Ksh {(p.sub_total || 0).toLocaleString()}</td>
                                                                <td className="p-2.5 text-right font-black text-gray-900">Ksh {(p.grand_total || 0).toLocaleString()}</td>
                                                                <td className="p-2.5 text-center">
                                                                    <span className="px-2 py-0.5 bg-gray-100 rounded text-[10px] font-bold">
                                                                        {p.status || 'Completed'}
                                                                    </span>
                                                                </td>
                                                                <td className="p-2.5 text-center">
                                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                                        p.payment_status === 'Paid'
                                                                            ? 'bg-emerald-100 text-emerald-800'
                                                                            : 'bg-amber-100 text-amber-800'
                                                                    }`}>
                                                                        {p.payment_status || 'Paid'}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                            {dossierTab === 'batches' && (
                                <div className="space-y-3">
                                    {batches.filter(
                                        (b) => Number(b.supplier_id) === Number(dossierSupplier.supplier_id) || (b.supplier_name && b.supplier_name.trim().toLowerCase() === dossierSupplier.supplier_name.trim().toLowerCase())
                                    ).length === 0 ? (
                                        <div className="p-8 text-center text-gray-500">
                                            <p className="font-bold text-gray-800">No active batches tagged with this supplier</p>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto border border-gray-200 rounded-xl">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-900 border-b border-gray-200">
                                                    <tr>
                                                        <th className="p-2.5">Batch #</th>
                                                        <th className="p-2.5">Expiry Date</th>
                                                        <th className="p-2.5 text-right">Received Qty</th>
                                                        <th className="p-2.5 text-right">Remaining</th>
                                                        <th className="p-2.5 text-right">Unit Cost</th>
                                                        <th className="p-2.5 text-right">Selling Price</th>
                                                        <th className="p-2.5 text-center">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 text-gray-900 font-medium">
                                                    {batches
                                                        .filter(
                                                            (b) => Number(b.supplier_id) === Number(dossierSupplier.supplier_id) || (b.supplier_name && b.supplier_name.trim().toLowerCase() === dossierSupplier.supplier_name.trim().toLowerCase())
                                                        )
                                                        .map((b) => (
                                                            <tr key={b.batch_id} className="hover:bg-gray-50">
                                                                <td className="p-2.5 font-mono font-bold text-indigo-700">{b.batch_number}</td>
                                                                <td className="p-2.5">{b.expiry_date}</td>
                                                                <td className="p-2.5 text-right font-mono">{b.quantity}</td>
                                                                <td className="p-2.5 text-right font-bold text-blue-700">{b.remaining_qty}</td>
                                                                <td className="p-2.5 text-right font-mono">Ksh {b.purchase_cost}</td>
                                                                <td className="p-2.5 text-right font-mono">Ksh {b.selling_price}</td>
                                                                <td className="p-2.5 text-center">
                                                                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">
                                                                        {b.status}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                            {dossierTab === 'profile' && (
                                <div className="space-y-4 text-xs text-gray-800">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                                            <p className="text-[10px] text-gray-500 font-bold uppercase">Primary Phone</p>
                                            <p className="font-bold text-gray-900 mt-0.5">{dossierSupplier.phone || 'None provided'}</p>
                                        </div>
                                        <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                                            <p className="text-[10px] text-gray-500 font-bold uppercase">Official Email</p>
                                            <p className="font-bold text-gray-900 mt-0.5">{dossierSupplier.email || 'None provided'}</p>
                                        </div>
                                        <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                                            <p className="text-[10px] text-gray-500 font-bold uppercase">KRA PIN / TIN</p>
                                            <p className="font-bold text-gray-900 font-mono mt-0.5">{dossierSupplier.kra_pin || 'Not Registered'}</p>
                                        </div>
                                        <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                                            <p className="text-[10px] text-gray-500 font-bold uppercase">Payment Terms</p>
                                            <p className="font-bold text-gray-900 mt-0.5">{dossierSupplier.payment_terms || 'Cash'}</p>
                                        </div>
                                    </div>
                                    {dossierSupplier.notes && (
                                        <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                                            <p className="text-[10px] text-blue-900 font-bold uppercase mb-1">Procurement Notes &amp; History</p>
                                            <p className="text-gray-800 whitespace-pre-wrap">{dossierSupplier.notes}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Dossier Footer */}
                        <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                            <button
                                onClick={() => window.print()}
                                className="px-4 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-800 hover:bg-gray-100 flex items-center gap-1.5"
                            >
                                🖨️ Print Statement
                            </button>
                            <button
                                onClick={() => setShowDossierModal(false)}
                                className="px-6 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-black"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* =====================================================================
                QUICK PAYMENT & BALANCE ADJUSTMENT MODAL
            ===================================================================== */}
            {showPaymentModal && paymentSupplier && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
                    <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 w-full max-w-lg overflow-hidden">
                        <div className="p-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
                            <div>
                                <h3 className="font-black text-base">Record Supplier Payout</h3>
                                <p className="text-xs text-emerald-100 mt-0.5">
                                    Vendor: <span className="font-bold text-white">{paymentSupplier.supplier_name}</span> ({paymentSupplier.supplier_code})
                                </p>
                            </div>
                            <button
                                onClick={() => setShowPaymentModal(false)}
                                className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center font-bold text-sm"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleProcessPayment} className="p-6 space-y-4 text-xs font-bold text-gray-900">
                            <div className="bg-gray-50 p-3 rounded-2xl border border-gray-200 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] text-gray-500 uppercase font-black">Current Balance</p>
                                    <p className="text-lg font-black text-rose-900">
                                        Ksh {(Number(paymentSupplier.current_balance) || 0).toLocaleString()}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-gray-500 uppercase font-black">Resulting Balance</p>
                                    <p className="text-lg font-black text-emerald-900">
                                        Ksh {Math.max(0, (Number(paymentSupplier.current_balance) || 0) - (parseFloat(paymentAmount) || 0)).toLocaleString()}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block mb-1">Transaction Type</label>
                                    <select
                                        value={paymentType}
                                        onChange={(e) => setPaymentType(e.target.value as any)}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900"
                                    >
                                        <option value="Payment">Supplier Payment (Reduces Debt)</option>
                                        <option value="CreditNote">Credit Note Received</option>
                                        <option value="Adjustment">Direct Balance Override</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block mb-1">Payment Method</label>
                                    <select
                                        value={paymentMethod}
                                        onChange={(e) => setPaymentMethod(e.target.value)}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900"
                                    >
                                        <option value="Bank Transfer">Bank Transfer (EFT/RTGS)</option>
                                        <option value="M-Pesa Paybill">M-Pesa Paybill / Till</option>
                                        <option value="Cheque">Cheque Payout</option>
                                        <option value="Cash">Cash at Counter</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block mb-1">Amount to Pay (Ksh) *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        value={paymentAmount}
                                        onChange={(e) => setPaymentAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-mono font-black text-gray-900 focus:bg-white focus:border-emerald-600 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block mb-1">Cheque / M-Pesa / EFT Reference</label>
                                    <input
                                        type="text"
                                        value={paymentRef}
                                        onChange={(e) => setPaymentRef(e.target.value)}
                                        placeholder="e.g. EFT-948274 / CHQ-1049"
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-mono text-gray-900 focus:bg-white focus:border-emerald-600 outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block mb-1">Remarks / Payment Voucher Note</label>
                                <textarea
                                    rows={2}
                                    value={paymentNotes}
                                    onChange={(e) => setPaymentNotes(e.target.value)}
                                    placeholder="e.g. Paid in full for invoice INV-01 via Standard Chartered Bank..."
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs text-gray-900 focus:bg-white focus:border-emerald-600 outline-none"
                                />
                            </div>

                            <div className="pt-3 border-t border-gray-200 flex items-center justify-between">
                                <button
                                    type="button"
                                    onClick={() => setShowPaymentModal(false)}
                                    className="px-4 py-2 bg-gray-100 text-gray-800 rounded-xl font-bold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isProcessingPayment}
                                    className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl font-bold shadow-md disabled:opacity-50"
                                >
                                    {isProcessingPayment ? 'Recording Payment...' : 'Confirm Payout'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
