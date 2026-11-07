'use client';
// =====================================================================
// Alpha Pharmacy - Super Massive Ultra Goods Received Note (GRN) & Purchase Engine v2.0
// Ultra-Detailed Pharmaceutical Procurement, Live Batch & Expiry Tracking,
// Margin & Markup Engine, Dual-Table Database Fallback, Quick Actions & GRN Receipt
// =====================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, logActivity } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

// Unit conversion helpers
const ALL_UNITS = [
    'Box', 'Pack', 'Piece', 'Strip', 'Tablet', 'Capsule', 'Bottle',
    'Carton', 'Sachet', 'Vial', 'Ampoule', 'Tube', 'Dozen', 'Kilogram', 'Gram', 'Liter', 'Milliliter'
];

export interface Supplier {
    supplier_id: number;
    supplier_code: string;
    supplier_name: string;
    phone?: string;
    contact_person?: string;
    current_balance?: number;
    payment_terms?: string;
}

export interface Product {
    pid: number;
    product_code: string;
    product_name: string;
    alias?: string;
    category?: string;
    purchase_unit?: string;
    sales_unit?: string;
    purchase_cost: number;
    sales_cost: number;
    pieces_per_package?: number;
    barcode?: string;
    storage_conditions?: string;
    current_stock?: number;
}

export interface PurchaseItem {
    id: number;
    productId: number;
    productCode: string;
    productName: string;
    category?: string;
    purchaseUnit: string;
    salesUnit: string;
    qty: number;
    piecesPerPackage: number;
    price: number; // Unit Purchase Cost
    total: number; // Line Total Cost
    oldCost: number;
    oldSell: number;
    newSellPrice: number;
    updatePrices: boolean;
    // Pharmacy Batch & Quality Fields
    batchNumber: string;
    expiryDate: string;
    manufactureDate: string;
    storageCondition: string;
}

export interface RecentInvoice {
    purchase_id: number;
    purchase_no: string;
    purchase_date: string;
    supplier_name: string;
    grand_total: number;
    payment_status: string;
    created_at?: string;
}

const escapeXml = (unsafe: any): string => {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
};

export default function PurchaseEntryPage() {
    const { activeOutlet } = useOutlet();
    const outletId = activeOutlet?.outlet_id || 1;
    const outletName = activeOutlet?.outlet_name || 'Alpha Pharmacy Main';

    // Core Data
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [recentInvoices, setRecentInvoices] = useState<RecentInvoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [activeSupplierTable, setActiveSupplierTable] = useState('pharmacy_suppliers');

    // GRN Master Fields
    const [invoiceNo, setInvoiceNo] = useState('');
    const [selectedSupplierId, setSelectedSupplierId] = useState<number>(0);
    const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('');
    const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
    const [paymentStatus, setPaymentStatus] = useState<'Paid' | 'Unpaid' | 'Partial'>('Paid');
    const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
    const [notes, setNotes] = useState('');
    const [discountAmount, setDiscountAmount] = useState<number>(0);
    const [vatPercent, setVatPercent] = useState<number>(0);

    // Cart Line Items
    const [items, setItems] = useState<PurchaseItem[]>([]);

    // Product Search & Selection
    const [productSearch, setProductSearch] = useState('');
    const [showProductDropdown, setShowProductDropdown] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

    // Current Line Item Intake Fields
    const [itemQty, setItemQty] = useState<number>(1);
    const [itemUnit, setItemUnit] = useState<string>('Box');
    const [itemCost, setItemCost] = useState<number>(0);
    const [itemSell, setItemSell] = useState<number>(0);
    const [itemPiecesPerPack, setItemPiecesPerPack] = useState<number>(1);
    const [itemBatchNo, setItemBatchNo] = useState<string>('');
    const [itemExpiryDate, setItemExpiryDate] = useState<string>('');
    const [itemMfgDate, setItemMfgDate] = useState<string>('');
    const [itemStorage, setItemStorage] = useState<string>('Room Temp (15-25°C)');
    const [itemUpdateMasterPrice, setItemUpdateMasterPrice] = useState<boolean>(true);

    // Existing Batches Panel (shown when product is selected)
    const [existingBatches, setExistingBatches] = useState<any[]>([]);
    const [showBatchPanel, setShowBatchPanel] = useState(false);

    // Modals
    const [showAddProductModal, setShowAddProductModal] = useState(false);
    const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
    const [showRecentInvoicesModal, setShowRecentInvoicesModal] = useState(false);
    const [showGrnPrintModal, setShowGrnPrintModal] = useState(false);
    const [completedGrn, setCompletedGrn] = useState<any | null>(null);

    // Quick Add Product Form State
    const [newProdCode, setNewProdCode] = useState('');
    const [newProdName, setNewProdName] = useState('');
    const [newProdCategory, setNewProdCategory] = useState('Tablets & Capsules');
    const [newProdCost, setNewProdCost] = useState<number>(0);
    const [newProdSell, setNewProdSell] = useState<number>(0);
    const [newProdBarcode, setNewProdBarcode] = useState('');
    const [newProdPcs, setNewProdPcs] = useState<number>(1);
    const [isSavingProd, setIsSavingProd] = useState(false);

    // Quick Add Supplier Form State
    const [newSuppName, setNewSuppName] = useState('');
    const [newSuppPhone, setNewSuppPhone] = useState('');
    const [newSuppContact, setNewSuppContact] = useState('');
    const [newSuppTerms, setNewSuppTerms] = useState('Net 30');
    const [newSuppKra, setNewSuppKra] = useState('');
    const [isSavingSupp, setIsSavingSupp] = useState(false);

    // =====================================================================
    // LOAD LIVE DATA WITH DUAL-FALLBACK ARCHITECTURE
    // =====================================================================
    const loadMasterData = useCallback(async () => {
        setIsLoading(true);
        try {
            // 1. Fetch Suppliers (pharmacy_suppliers -> fallback to suppliers)
            let suppList: Supplier[] = [];
            let resolvedSuppTable = 'suppliers';

            const { data: pSupp, error: pSuppErr } = await supabase
                .from('pharmacy_suppliers')
                .select('supplier_id, supplier_code, supplier_name, phone, contact_person, current_balance, payment_terms')
                .order('supplier_name');

            if (!pSuppErr && pSupp) {
                suppList = pSupp;
            }
            setSuppliers(suppList);
            setActiveSupplierTable('pharmacy_suppliers');

            // 2. Fetch Products (pharmacy_products merged with products)
            let prodList: Product[] = [];
            const { data: pProd } = await supabase
                .from('pharmacy_products')
                .select('pid, product_code, product_name, alias, category, purchase_unit, sales_unit, purchase_cost, sales_cost, pieces_per_package, barcode, storage_conditions');

            if (pProd && pProd.length > 0) {
                prodList = pProd.map((p) => ({
                    pid: p.pid,
                    product_code: p.product_code || `PRD-${p.pid}`,
                    product_name: p.product_name,
                    alias: p.alias,
                    category: p.category || 'General Pharma',
                    purchase_unit: p.purchase_unit || 'Box',
                    sales_unit: p.sales_unit || 'Piece',
                    purchase_cost: Number(p.purchase_cost) || 0,
                    sales_cost: Number(p.sales_cost) || 0,
                    pieces_per_package: Number(p.pieces_per_package) || 1,
                    barcode: p.barcode,
                    storage_conditions: p.storage_conditions || 'Room Temp (15-25°C)',
                }));
            }
            setProducts(prodList);

            // 3. Fetch Recent Invoices
            let recents: RecentInvoice[] = [];
            const { data: pRec } = await supabase
                .from('pharmacy_purchases')
                .select('purchase_id, purchase_no, purchase_date, supplier_name, grand_total, payment_status, created_at')
                .order('purchase_id', { ascending: false })
                .limit(10);

            if (pRec && pRec.length > 0) {
                recents = pRec;
            }
            setRecentInvoices(recents);

            // 4. Generate next Purchase / Invoice Number
            await generateNextInvoiceNo();
        } catch (err: any) {
            console.error('Error initializing purchase entry:', err);
            toast.error('Failed to load catalog data');
        } finally {
            setIsLoading(false);
        }
    }, [outletId]);

    useEffect(() => {
        loadMasterData();
    }, [loadMasterData]);

    // Generate Next Sequential Invoice No (e.g. INV-04)
    const generateNextInvoiceNo = async () => {
        try {
            let maxNum = 0;
            // Check pharmacy_purchases
            const { data: pData } = await supabase
                .from('pharmacy_purchases')
                .select('purchase_no')
                .order('purchase_id', { ascending: false })
                .limit(20);

            (pData || []).forEach((row) => {
                const match = (row.purchase_no || '').match(/INV-(\d+)/i);
                if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
            });

            const nextNum = maxNum + 1;
            setInvoiceNo(`INV-${String(nextNum).padStart(2, '0')}`);
        } catch {
            setInvoiceNo(`INV-${Date.now().toString().slice(-4)}`);
        }
    };

    // Auto-generate Batch Number Suggestion
    const generateSuggestedBatch = (prodName: string) => {
        const clean = (prodName || 'LOT').replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();
        const rand = Math.floor(1000 + Math.random() * 9000);
        return `${clean || 'BAT'}-${rand}`;
    };

    // Handle Product Selection
    const handleSelectProduct = async (p: Product) => {
        setSelectedProduct(p);
        setProductSearch(p.product_name);
        setShowProductDropdown(false);

        setItemUnit(p.purchase_unit || 'Box');
        setItemCost(p.purchase_cost || 0);
        setItemSell(p.sales_cost || 0);
        setItemPiecesPerPack(p.pieces_per_package || 1);
        setItemQty(1);

        // Auto generate suggested batch & default 2-year expiry
        setItemBatchNo(generateSuggestedBatch(p.product_name));

        const now = new Date();
        const twoYears = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());
        setItemExpiryDate(twoYears.toISOString().split('T')[0]);

        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, now.getDate());
        setItemMfgDate(sixMonthsAgo.toISOString().split('T')[0]);

        setItemStorage(p.storage_conditions || 'Room Temp (15-25°C)');
        setItemUpdateMasterPrice(true);

        // Fetch existing batches for this product
        setExistingBatches([]);
        setShowBatchPanel(false);
        try {
            const { data: batches } = await supabase
                .from('pharmacy_batches')
                .select('batch_id, batch_number, expiry_date, remaining_qty, quantity, selling_price, supplier_name, status')
                .eq('product_id', p.pid)
                .eq('outlet_id', outletId)
                .order('expiry_date', { ascending: true });
            if (batches && batches.length > 0) {
                setExistingBatches(batches);
                setShowBatchPanel(true);
            }
        } catch {
            // ignore batch fetch errors
        }
    };

    // Auto calculate markup and margin
    const itemMargin = useMemo(() => {
        if (itemSell <= 0) return { profit: 0, marginPct: 0, markupPct: 0 };
        const profit = itemSell - itemCost;
        const marginPct = (profit / itemSell) * 100;
        const markupPct = itemCost > 0 ? (profit / itemCost) * 100 : 0;
        return { profit, marginPct, markupPct };
    }, [itemCost, itemSell]);

    // Quick Markup Suggester
    const applySuggestedMarkup = (markupPercent: number) => {
        if (itemCost <= 0) return;
        const calculatedSell = Math.round(itemCost * (1 + markupPercent / 100));
        setItemSell(calculatedSell);
    };

    // Add Item to Receiving Cart
    const handleAddItem = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!selectedProduct) {
            toast.error('Please search and select a drug / product first');
            return;
        }
        if (itemQty <= 0) {
            toast.error('Quantity must be greater than 0');
            return;
        }
        if (itemCost <= 0) {
            toast.error('Unit purchase cost must be greater than 0');
            return;
        }
        if (!itemBatchNo.trim()) {
            toast.error('Batch / Lot number is required for pharmaceutical tracking');
            return;
        }
        if (!itemExpiryDate) {
            toast.error('Expiry date is mandatory for FEFO compliance');
            return;
        }

        // Check if expiry is in past
        if (new Date(itemExpiryDate).getTime() < new Date().getTime()) {
            toast.error('Cannot receive an expired drug shipment!');
            return;
        }

        const existingIdx = items.findIndex(
            (i) => i.productId === selectedProduct.pid && i.batchNumber.trim().toUpperCase() === itemBatchNo.trim().toUpperCase()
        );

        const totalCost = Number(itemQty) * Number(itemCost);

        if (existingIdx >= 0) {
            setItems((prev) =>
                prev.map((it, idx) =>
                    idx === existingIdx
                        ? {
                              ...it,
                              qty: it.qty + itemQty,
                              price: itemCost,
                              total: (it.qty + itemQty) * itemCost,
                              newSellPrice: itemSell,
                              piecesPerPackage: itemPiecesPerPack,
                              updatePrices: itemUpdateMasterPrice,
                          }
                        : it
                )
            );
            toast.success(`Updated quantity for ${selectedProduct.product_name}`);
        } else {
            const newItem: PurchaseItem = {
                id: Date.now() + Math.random(),
                productId: selectedProduct.pid,
                productCode: selectedProduct.product_code,
                productName: selectedProduct.product_name,
                category: selectedProduct.category,
                purchaseUnit: itemUnit,
                salesUnit: selectedProduct.sales_unit || 'Piece',
                qty: Number(itemQty),
                piecesPerPackage: Number(itemPiecesPerPack) || 1,
                price: Number(itemCost),
                total: totalCost,
                oldCost: selectedProduct.purchase_cost,
                oldSell: selectedProduct.sales_cost,
                newSellPrice: Number(itemSell),
                updatePrices: itemUpdateMasterPrice,
                batchNumber: itemBatchNo.trim().toUpperCase(),
                expiryDate: itemExpiryDate,
                manufactureDate: itemMfgDate,
                storageCondition: itemStorage,
            };
            setItems((prev) => [...prev, newItem]);
            toast.success(`Added ${selectedProduct.product_name} (${newItem.batchNumber})`);
        }

        // Reset form
        setSelectedProduct(null);
        setProductSearch('');
        setItemQty(1);
        setItemCost(0);
        setItemSell(0);
        setItemBatchNo('');
        setItemExpiryDate('');
        setItemMfgDate('');
    };

    // Remove item from cart
    const handleRemoveItem = (id: number) => {
        setItems((prev) => prev.filter((i) => i.id !== id));
    };

    // Financial Totals
    const financials = useMemo(() => {
        const totalItemsCount = items.length;
        const totalUnits = items.reduce((sum, i) => sum + i.qty, 0);
        const subtotal = items.reduce((sum, i) => sum + i.total, 0);

        const discountVal = Math.min(subtotal, Math.max(0, Number(discountAmount) || 0));
        const taxableAmount = Math.max(0, subtotal - discountVal);
        const vatVal = (taxableAmount * (Number(vatPercent) || 0)) / 100;
        const grandTotal = Math.round(taxableAmount + vatVal);

        // Projected profit calculation
        const projectedRevenue = items.reduce((sum, i) => sum + (i.qty * i.newSellPrice), 0);
        const projectedProfit = projectedRevenue - subtotal;
        const marginOverall = projectedRevenue > 0 ? (projectedProfit / projectedRevenue) * 100 : 0;

        return {
            totalItemsCount,
            totalUnits,
            subtotal,
            discountVal,
            vatVal,
            grandTotal,
            projectedRevenue,
            projectedProfit,
            marginOverall,
        };
    }, [items, discountAmount, vatPercent]);

    // =====================================================================
    // SAVE PURCHASE & COMMIT GOODS RECEIVED NOTE (GRN)
    // =====================================================================
    const handleCommitGrn = async () => {
        if (!selectedSupplierId) {
            toast.error('Please select the issuing supplier / distributor');
            return;
        }
        if (items.length === 0) {
            toast.error('Please add at least one drug item to the GRN');
            return;
        }

        const supplier = suppliers.find((s) => Number(s.supplier_id) === Number(selectedSupplierId));
        setIsSaving(true);

        try {
            const userData = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
            const user = userData ? JSON.parse(userData) : null;
            const staffName = user?.name || 'Pharmacist Administrator';

            const invoicePayload = {
                purchase_no: invoiceNo,
                purchase_date: purchaseDate,
                supplier_id: selectedSupplierId,
                supplier_name: supplier?.supplier_name || 'Generic Distributor',
                supplier_invoice: supplierInvoiceNo.trim() || null,
                sub_total: financials.subtotal,
                discount: financials.discountVal,
                vat: financials.vatVal,
                grand_total: financials.grandTotal,
                status: 'Completed',
                payment_status: paymentStatus,
                notes: notes.trim() || `GRN received at ${outletName} by ${staffName}. Storage seals inspected.`,
                created_by: staffName,
                outlet_id: outletId,
                created_at: new Date().toISOString(),
            };

            // 1. Insert Master Purchase Record (multi-table fallback: pharmacy_purchases -> purchases -> retail_purchases)
            let createdPurchaseId: number | null = null;

            // Try 1: pharmacy_purchases
            const { data: pPharm, error: pPharmErr } = await supabase
                .from('pharmacy_purchases')
                .insert({
                    purchase_no: invoiceNo,
                    purchase_date: purchaseDate,
                    supplier_id: selectedSupplierId,
                    supplier_name: supplier?.supplier_name || 'Generic Distributor',
                    supplier_invoice: supplierInvoiceNo.trim() || null,
                    sub_total: financials.subtotal,
                    discount: financials.discountVal,
                    vat: financials.vatVal,
                    grand_total: financials.grandTotal,
                    status: 'Completed',
                    payment_status: paymentStatus,
                    notes: notes.trim() || `GRN received at ${outletName} by ${staffName}. Storage seals inspected.`,
                    created_by: staffName,
                    outlet_id: outletId,
                    created_at: new Date().toISOString(),
                })
                .select('purchase_id')
                .single();

            if (!pPharmErr && pPharm) {
                createdPurchaseId = pPharm.purchase_id;
            } else {
                // Try 2: purchases (the active production table)
                const { data: pReg, error: pRegErr } = await supabase
                    .from('purchases')
                    .insert({
                        purchase_no: invoiceNo,
                        purchase_date: purchaseDate,
                        supplier_id: selectedSupplierId,
                        supplier_name: supplier?.supplier_name || 'Generic Distributor',
                        supplier_invoice: supplierInvoiceNo.trim() || null,
                        sub_total: financials.subtotal,
                        discount: financials.discountVal,
                        vat: financials.vatVal,
                        grand_total: financials.grandTotal,
                        status: 'Completed',
                        payment_status: paymentStatus,
                        notes: notes.trim() || `GRN received at ${outletName} by ${staffName}. Storage seals inspected.`,
                        created_by: staffName,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    })
                    .select('purchase_id')
                    .single();

                if (!pRegErr && pReg) {
                    createdPurchaseId = pReg.purchase_id;
                } else {
                    // Try 3: retail_purchases
                    const { data: pRet, error: pRetErr } = await supabase
                        .from('retail_purchases')
                        .insert({
                            purchase_no: invoiceNo,
                            purchase_date: purchaseDate,
                            supplier_id: selectedSupplierId,
                            supplier_name: supplier?.supplier_name || 'Generic Distributor',
                            supplier_invoice: supplierInvoiceNo.trim() || null,
                            sub_total: financials.subtotal,
                            discount: financials.discountVal,
                            vat: financials.vatVal,
                            grand_total: financials.grandTotal,
                            status: 'Completed',
                            payment_status: paymentStatus,
                            notes: notes.trim() || `GRN received at ${outletName} by ${staffName}. Storage seals inspected.`,
                            created_by: staffName,
                            outlet_id: outletId,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                        })
                        .select('purchase_id')
                        .single();

                    if (!pRetErr && pRet) {
                        createdPurchaseId = pRet.purchase_id;
                    } else {
                        throw pRegErr || pPharmErr || new Error('Failed to save purchase record to database');
                    }
                }
            }

            const pId = createdPurchaseId || Date.now();

            // 2. Insert Line Items (pharmacy_purchase_products -> fallback to retail_purchase_products)
            for (const it of items) {
                const lineItemPayload = {
                    purchase_id: pId,
                    product_id: it.productId,
                    product_code: it.productCode,
                    product_name: it.productName,
                    batch_number: it.batchNumber,
                    expiry_date: it.expiryDate,
                    manufacture_date: it.manufactureDate || null,
                    quantity: it.qty,
                    unit: it.purchaseUnit,
                    rate: it.price,
                    total_amount: it.total,
                    created_at: new Date().toISOString(),
                };

                const { error: ppErr } = await supabase.from('pharmacy_purchase_products').insert(lineItemPayload);
                if (ppErr) {
                    // Fallback to retail_purchase_products
                    try {
                        await supabase.from('retail_purchase_products').insert({
                            purchase_id: pId,
                            product_id: it.productId,
                            product_code: it.productCode,
                            product_name: it.productName,
                            quantity: it.qty,
                            unit: it.purchaseUnit,
                            rate: it.price,
                            sales_cost: it.newSellPrice,
                            total_amount: it.total,
                            created_at: new Date().toISOString(),
                        });
                    } catch {
                        // ignore fallback error
                    }
                }

                // 3. Register lot into pharmacy_batches (FEFO engine)
                const batchPayload = {
                    product_id: it.productId,
                    batch_number: it.batchNumber,
                    expiry_date: it.expiryDate,
                    manufacture_date: it.manufactureDate || null,
                    quantity: it.qty,
                    remaining_qty: it.qty,
                    purchase_cost: it.price,
                    selling_price: it.newSellPrice,
                    supplier_id: selectedSupplierId,
                    supplier_name: supplier?.supplier_name || null,
                    purchase_invoice: invoiceNo,
                    status: 'Active',
                    outlet_id: outletId,
                    notes: `Received via ${invoiceNo} on ${purchaseDate}. Storage: ${it.storageCondition}`,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                };

                let batchId: number | null = null;
                try {
                    const { data: insertedBatch } = await supabase
                        .from('pharmacy_batches')
                        .insert(batchPayload)
                        .select('batch_id')
                        .single();
                    batchId = insertedBatch?.batch_id || null;
                } catch {
                    // ignore if batches table not ready
                }

                // 4. Update Stock in pharmacy_stock & retail_stock
                try {
                    const stockPayload = {
                        pid: it.productId,
                        batch_id: batchId,
                        invoice_no: invoiceNo,
                        qty: it.qty,
                        storage_type: it.storageCondition,
                        expiry_date: it.expiryDate,
                        outlet_id: outletId,
                        notes: `GRN ${invoiceNo}`,
                        created_at: new Date().toISOString(),
                    };
                    await supabase.from('pharmacy_stock').insert(stockPayload);
                } catch {
                    // ignore
                }

                // stock recorded in pharmacy_stock

                // 5. Update Master Catalog Prices if requested
                if (it.updatePrices) {
                    const priceUpdates = {
                        purchase_cost: it.price,
                        sales_cost: it.newSellPrice,
                        updated_at: new Date().toISOString(),
                    };
                    try {
                        await supabase.from('pharmacy_products').update(priceUpdates).eq('pid', it.productId);
                    } catch {
                        // ignore
                    }
                    // pharmacy_products price updated
                }
            }

            // 6. Update Supplier Balance if Unpaid or Partial
            if (paymentStatus === 'Unpaid' || paymentStatus === 'Partial') {
                const addDebt = paymentStatus === 'Unpaid' ? financials.grandTotal : Math.round(financials.grandTotal / 2);
                const currentBal = Number(supplier?.current_balance) || 0;
                const newBal = currentBal + addDebt;

                try {
                    await supabase
                        .from('pharmacy_suppliers')
                        .update({
                            current_balance: newBal,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('supplier_id', selectedSupplierId);
                } catch {
                    // ignore
                }
            }

            // 7. Log Activity
            await logActivity(
                'GRN Purchase Received',
                `Committed ${invoiceNo} from ${supplier?.supplier_name} (${items.length} items, Total: Ksh ${financials.grandTotal.toLocaleString()})`
            );

            toast.success(`GRN ${invoiceNo} committed successfully! Items received into stock.`);

            // Open GRN Print Preview Modal
            setCompletedGrn({
                ...invoicePayload,
                purchase_id: pId,
                supplier_code: supplier?.supplier_code || 'SUP',
                items: [...items],
                financials: { ...financials },
                outlet_name: outletName,
            });
            setShowGrnPrintModal(true);

            // Reset Form & Generate Next ID
            setItems([]);
            setSelectedSupplierId(0);
            setSupplierInvoiceNo('');
            setNotes('');
            setDiscountAmount(0);
            setVatPercent(0);
            loadMasterData();
        } catch (err: any) {
            console.error('Failed to commit GRN:', err);
            toast.error(`GRN commit failed: ${err.message || 'Database error'}`);
        } finally {
            setIsSaving(false);
        }
    };

    // Quick Add New Product directly from modal
    const handleQuickAddProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newProdName.trim()) {
            toast.error('Product name is required');
            return;
        }

        setIsSavingProd(true);
        try {
            const nextPid = Date.now();
            const code = newProdCode.trim() || `DRG-${String(products.length + 1).padStart(4, '0')}`;
            const payload = {
                product_code: code,
                product_name: newProdName.trim(),
                category: newProdCategory,
                purchase_cost: Number(newProdCost) || 0,
                sales_cost: Number(newProdSell) || 0,
                purchase_unit: 'Box',
                sales_unit: 'Piece',
                pieces_per_package: Number(newProdPcs) || 1,
                barcode: newProdBarcode.trim() || null,
                active: true,
                outlet_id: outletId,
                created_at: new Date().toISOString(),
            };

            // Try inserting into pharmacy_products & products
            let createdProduct: any = null;
            const { data: ppData } = await supabase.from('pharmacy_products').insert(payload).select().single();
            if (ppData) createdProduct = ppData;

            // Insert into pharmacy_products only

            const finalProd: Product = {
                pid: createdProduct?.pid || nextPid,
                product_code: code,
                product_name: newProdName.trim(),
                category: newProdCategory,
                purchase_cost: Number(newProdCost) || 0,
                sales_cost: Number(newProdSell) || 0,
                purchase_unit: 'Box',
                sales_unit: 'Piece',
                pieces_per_package: Number(newProdPcs) || 1,
                barcode: newProdBarcode.trim(),
            };

            setProducts((prev) => [finalProd, ...prev]);
            handleSelectProduct(finalProd);

            toast.success(`Registered & selected ${finalProd.product_name}!`);
            setShowAddProductModal(false);

            // Reset
            setNewProdCode('');
            setNewProdName('');
            setNewProdCost(0);
            setNewProdSell(0);
            setNewProdBarcode('');
        } catch (err: any) {
            toast.error(`Failed to add product: ${err.message}`);
        } finally {
            setIsSavingProd(false);
        }
    };

    // Quick Add New Supplier from modal
    const handleQuickAddSupplier = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSuppName.trim()) {
            toast.error('Supplier name is required');
            return;
        }

        setIsSavingSupp(true);
        try {
            const nextCode = `SUP-${String(suppliers.length + 1).padStart(2, '0')}`;
            const payload = {
                supplier_code: nextCode,
                supplier_name: newSuppName.trim(),
                phone: newSuppPhone.trim() || null,
                contact_person: newSuppContact.trim() || null,
                payment_terms: newSuppTerms,
                kra_pin: newSuppKra.trim().toUpperCase() || null,
                opening_balance: 0,
                current_balance: 0,
                active: true,
                created_at: new Date().toISOString(),
            };

            let createdSupplier: any = null;
            const { data: sData } = await supabase.from('pharmacy_suppliers').insert(payload).select().single();
            if (sData) createdSupplier = sData;

            const finalSupp: Supplier = {
                supplier_id: createdSupplier?.supplier_id || Date.now(),
                supplier_code: nextCode,
                supplier_name: newSuppName.trim(),
                phone: newSuppPhone.trim(),
                contact_person: newSuppContact.trim(),
                payment_terms: newSuppTerms,
                current_balance: 0,
            };

            setSuppliers((prev) => [finalSupp, ...prev]);
            setSelectedSupplierId(finalSupp.supplier_id);

            toast.success(`Distributor ${finalSupp.supplier_name} registered!`);
            setShowAddSupplierModal(false);

            // Reset
            setNewSuppName('');
            setNewSuppPhone('');
            setNewSuppContact('');
            setNewSuppKra('');
        } catch (err: any) {
            toast.error(`Failed to add supplier: ${err.message}`);
        } finally {
            setIsSavingSupp(false);
        }
    };

    // Export Draft to Super Bright Excel
    const exportDraftExcel = () => {
        if (items.length === 0) {
            toast.error('Receiving cart is currently empty');
            return;
        }

        const supp = suppliers.find((s) => Number(s.supplier_id) === Number(selectedSupplierId));
        const genDate = new Date().toLocaleString('en-GB');

        const xmlString = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#0f172a"/>
  </Style>
  <Style ss:ID="TitleBanner">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="15" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#00C853" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="Header">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#1E293B" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="CellText">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="CellNumber">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="#,##0"/>
  </Style>
  <Style ss:ID="CellCurrency">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="&quot;Ksh &quot;#,##0.00"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="GRN Draft">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="70"/>
   <Column ss:Width="160"/>
   <Column ss:Width="90"/>
   <Column ss:Width="85"/>
   <Column ss:Width="65"/>
   <Column ss:Width="80"/>
   <Column ss:Width="95"/>
   <Column ss:Width="95"/>
   <Row ss:Height="30">
    <Cell ss:MergeAcross="7" ss:StyleID="TitleBanner"><Data ss:Type="String">ALPHA PHARMACY - GOODS RECEIVED NOTE (GRN ${invoiceNo})</Data></Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:StyleID="Header"><Data ss:Type="String">CODE</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">DRUG NAME</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">BATCH #</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">EXPIRY</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">QTY</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">UNIT</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">UNIT COST</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">LINE TOTAL</Data></Cell>
   </Row>
   ${items
       .map(
           (i) => `<Row>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${escapeXml(i.productCode)}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${escapeXml(i.productName)}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${escapeXml(i.batchNumber)}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${escapeXml(i.expiryDate)}</Data></Cell>
    <Cell ss:StyleID="CellNumber"><Data ss:Type="Number">${i.qty}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${escapeXml(i.purchaseUnit)}</Data></Cell>
    <Cell ss:StyleID="CellCurrency"><Data ss:Type="Number">${i.price}</Data></Cell>
    <Cell ss:StyleID="CellCurrency"><Data ss:Type="Number">${i.total}</Data></Cell>
   </Row>`
       )
       .join('\n')}
   <Row ss:Height="24">
    <Cell ss:MergeAcross="6" ss:StyleID="Header"><Data ss:Type="String">NET GRAND TOTAL (KSH):</Data></Cell>
    <Cell ss:StyleID="CellCurrency"><Data ss:Type="Number">${financials.grandTotal}</Data></Cell>
   </Row>
  </Table>
 </Worksheet>
</Workbook>`;

        const blob = new Blob([xmlString], { type: 'application/vnd.ms-excel;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AlphaPharmacy_GRN_${invoiceNo}_${new Date().toISOString().split('T')[0]}.xls`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Downloaded GRN Draft in Super Bright Excel!');
    };

    // Filter Products for live search dropdown
    const filteredSearchProducts = useMemo(() => {
        if (!productSearch.trim()) return [];
        const q = productSearch.toLowerCase();
        return products
            .filter(
                (p) =>
                    p.product_name.toLowerCase().includes(q) ||
                    p.product_code.toLowerCase().includes(q) ||
                    (p.barcode && p.barcode.includes(q)) ||
                    (p.alias && p.alias.toLowerCase().includes(q))
            )
            .slice(0, 15);
    }, [products, productSearch]);

    // Selected Supplier details
    const activeSupplier = suppliers.find((s) => Number(s.supplier_id) === Number(selectedSupplierId));

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-96" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
                <div className="w-14 h-14 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                <p className="mt-4 text-gray-900 font-bold text-base">Loading Goods Received Note Engine...</p>
                <p className="text-xs text-gray-500 mt-1">Connecting to active drug catalog, batch registries &amp; verified vendors</p>
            </div>
        );
    }

    return (
        <div className="w-full max-w-full space-y-4 px-1 md:px-2 pb-16" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg flex-shrink-0">
                        📥
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Goods Received Note (GRN) &amp; Purchase Entry</h1>
                            <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-900 rounded-full text-xs font-bold border border-emerald-200">
                                FEFO Protected
                            </span>
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-900 rounded-md text-[11px] font-bold border border-blue-200">
                                DB: {activeSupplierTable}
                            </span>
                        </div>
                        <p className="text-gray-600 text-xs mt-0.5">
                            Active Outlet: <span className="font-bold text-gray-900">{outletName}</span> • Receiving pharmaceutical inventory, drug lot numbers, unit costs &amp; margin recalculation
                        </p>
                    </div>
                </div>

                <div className="flex items-center flex-wrap gap-2">
                    {/* Quick Add Product */}
                    <button
                        onClick={() => setShowAddProductModal(true)}
                        className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 rounded-xl font-bold shadow-xs transition-all flex items-center gap-1.5 text-xs"
                    >
                        <span>💊</span> Quick Add Drug
                    </button>

                    {/* Quick Add Supplier */}
                    <button
                        onClick={() => setShowAddSupplierModal(true)}
                        className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 rounded-xl font-bold shadow-xs transition-all flex items-center gap-1.5 text-xs"
                    >
                        <span>🏢</span> New Vendor
                    </button>

                    {/* Recent Invoices */}
                    <button
                        onClick={() => setShowRecentInvoicesModal(true)}
                        className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 rounded-xl font-bold shadow-xs transition-all flex items-center gap-1.5 text-xs"
                    >
                        <span>📋</span> Recent GRNs ({recentInvoices.length})
                    </button>

                    {/* Export Draft to Excel */}
                    <button
                        onClick={exportDraftExcel}
                        className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 rounded-xl font-bold shadow-xs transition-all flex items-center gap-1.5 text-xs"
                    >
                        <span>📊</span> Super Excel
                    </button>

                    {/* Reset Form */}
                    <button
                        onClick={() => {
                            if (items.length > 0 && !confirm('Clear current receiving cart?')) return;
                            setItems([]);
                            generateNextInvoiceNo();
                            toast.success('Form cleared');
                        }}
                        className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-bold text-xs transition-all"
                    >
                        <span>🔄</span> Reset
                    </button>
                </div>
            </div>

            {/* 6 Real-time KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5 w-full">
                {/* Total Lines */}
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-3.5 border border-indigo-100 shadow-xs relative overflow-hidden">
                    <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Receiving Cart</p>
                    <p className="text-xl font-black text-indigo-950 mt-1">{financials.totalItemsCount} Products</p>
                    <p className="text-[10px] text-gray-600 mt-0.5">{financials.totalUnits} Units Total</p>
                </div>

                {/* Gross Amount */}
                <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-2xl p-3.5 border border-cyan-100 shadow-xs relative overflow-hidden">
                    <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Gross Subtotal</p>
                    <p className="text-base font-black text-blue-950 mt-1">Ksh {financials.subtotal.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-600 mt-0.5">Before discount &amp; tax</p>
                </div>

                {/* Trade Discount */}
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-3.5 border border-amber-100 shadow-xs relative overflow-hidden">
                    <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Discounts</p>
                    <p className="text-base font-black text-amber-950 mt-1">Ksh {financials.discountVal.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-600 mt-0.5">Supplier allowance</p>
                </div>

                {/* Estimated VAT */}
                <div className="bg-gradient-to-br from-slate-50 to-gray-100 rounded-2xl p-3.5 border border-gray-200 shadow-xs relative overflow-hidden">
                    <p className="text-[10px] font-bold text-gray-700 uppercase tracking-wider">VAT / Tax</p>
                    <p className="text-base font-black text-gray-950 mt-1">Ksh {financials.vatVal.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-600 mt-0.5">{vatPercent}% VAT Rate</p>
                </div>

                {/* Grand Net Total */}
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-3.5 border border-emerald-200 shadow-xs relative overflow-hidden">
                    <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Net Grand Total</p>
                    <p className="text-xl font-black text-emerald-950 mt-1">Ksh {financials.grandTotal.toLocaleString()}</p>
                    <p className="text-[10px] text-emerald-800 font-bold mt-0.5">Total Shipment Cost</p>
                </div>

                {/* Expected Profit & Margin */}
                <div className="bg-gradient-to-br from-rose-50 to-red-50 rounded-2xl p-3.5 border border-rose-100 shadow-xs relative overflow-hidden">
                    <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">Projected Margin</p>
                    <p className="text-base font-black text-rose-950 mt-1">Ksh {financials.projectedProfit.toLocaleString()}</p>
                    <p className="text-[10px] text-rose-800 font-bold mt-0.5">
                        {financials.marginOverall.toFixed(1)}% Est Margin
                    </p>
                </div>
            </div>

            {/* GRN Master Header Configuration Panel */}
            <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <h2 className="text-xs font-black uppercase tracking-wider text-gray-900 flex items-center gap-2">
                        <span>📋</span> GRN Master Header &amp; Vendor Settlement
                    </h2>
                    <span className="text-[11px] font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                        GRN #{invoiceNo}
                    </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-bold text-gray-900">
                    {/* Supplier Selector */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label>Distributor / Supplier *</label>
                            <button
                                type="button"
                                onClick={() => setShowAddSupplierModal(true)}
                                className="text-[11px] text-blue-600 hover:underline font-bold"
                            >
                                + New
                            </button>
                        </div>
                        <select
                            value={selectedSupplierId}
                            onChange={(e) => setSelectedSupplierId(Number(e.target.value))}
                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:bg-white focus:border-emerald-600 outline-none"
                        >
                            <option value={0}>-- Select Registered Supplier --</option>
                            {suppliers.map((s) => (
                                <option key={s.supplier_id} value={s.supplier_id}>
                                    {s.supplier_name} ({s.supplier_code}) {Number(s.current_balance) > 0 ? `• Debt: Ksh ${Number(s.current_balance).toLocaleString()}` : ''}
                                </option>
                            ))}
                        </select>
                        {activeSupplier && (
                            <p className="text-[11px] text-gray-600 mt-1">
                                Terms: <span className="font-bold text-gray-900">{activeSupplier.payment_terms || 'Cash'}</span> • Phone: {activeSupplier.phone || 'N/A'}
                            </p>
                        )}
                    </div>

                    {/* Supplier's Delivery / Invoice # */}
                    <div>
                        <label className="block mb-1">Supplier Delivery Note / Inv #</label>
                        <input
                            type="text"
                            value={supplierInvoiceNo}
                            onChange={(e) => setSupplierInvoiceNo(e.target.value)}
                            placeholder="e.g. DN-90281 / INV-4821"
                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-mono font-bold text-gray-900 focus:bg-white focus:border-emerald-600 outline-none"
                        />
                    </div>

                    {/* Receiving Date */}
                    <div>
                        <label className="block mb-1">Receiving / Delivery Date</label>
                        <input
                            type="date"
                            value={purchaseDate}
                            onChange={(e) => setPurchaseDate(e.target.value)}
                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:bg-white focus:border-emerald-600 outline-none"
                        />
                    </div>

                    {/* Payment Status */}
                    <div>
                        <label className="block mb-1">Payment &amp; Terms Status</label>
                        <div className="grid grid-cols-3 gap-1">
                            {(['Paid', 'Unpaid', 'Partial'] as const).map((st) => (
                                <button
                                    key={st}
                                    type="button"
                                    onClick={() => setPaymentStatus(st)}
                                    className={`py-2 px-1 rounded-xl text-xs font-bold transition-all border ${
                                        paymentStatus === st
                                            ? st === 'Paid'
                                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                                : st === 'Unpaid'
                                                ? 'bg-red-600 text-white border-red-600 shadow-xs'
                                                : 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                            : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
                                    }`}
                                >
                                    {st === 'Paid' ? 'Paid' : st === 'Unpaid' ? 'Credit' : 'Partial'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Pharmaceutical Item Receiving Suite (Intake Panel) */}
            <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <h2 className="text-xs font-black uppercase tracking-wider text-gray-900 flex items-center gap-2">
                        <span>💊</span> Pharmaceutical Drug Lot Receiving &amp; Margin Engine
                    </h2>
                    {selectedProduct && (
                        <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                            Selected: {selectedProduct.product_name}
                        </span>
                    )}
                </div>

                {/* Omni Product Search Bar */}
                <div className="relative">
                    <label className="block text-xs font-black text-gray-900 mb-1">
                        Search Drug to Receive (by Name, Generic, Code or Barcode) *
                    </label>
                    <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
                        <input
                            type="text"
                            value={productSearch}
                            onChange={(e) => {
                                setProductSearch(e.target.value);
                                setShowProductDropdown(true);
                            }}
                            onFocus={() => setShowProductDropdown(true)}
                            placeholder="Type to search e.g. Panadol, Amoxicillin, Ciprofloxacin, DRG-0001..."
                            className="w-full pl-9 pr-9 py-2.5 bg-gray-50 border border-gray-300 rounded-2xl text-xs font-bold text-gray-900 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none transition-all placeholder:text-gray-500"
                        />
                        {productSearch && (
                            <button
                                onClick={() => {
                                    setProductSearch('');
                                    setShowProductDropdown(false);
                                }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black font-bold text-xs"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Dropdown Suggestions */}
                    {showProductDropdown && filteredSearchProducts.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-2xl shadow-xl z-40 max-h-64 overflow-y-auto divide-y divide-gray-100 animate-fadeIn">
                            {filteredSearchProducts.map((p) => (
                                <div
                                    key={p.pid}
                                    onClick={() => handleSelectProduct(p)}
                                    className="p-3 hover:bg-emerald-50/60 cursor-pointer flex items-center justify-between text-xs transition-colors"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-900 flex items-center justify-center font-bold text-xs">
                                            💊
                                        </div>
                                        <div>
                                            <p className="font-black text-gray-900">{p.product_name}</p>
                                            <p className="text-[10px] text-gray-500">
                                                Code: <span className="font-mono font-bold text-gray-800">{p.product_code}</span> • Cat: {p.category} • Pack: {p.pieces_per_package || 1} pcs
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-gray-900">Cost: Ksh {p.purchase_cost} | Sell: Ksh {p.sales_cost}</p>
                                        <span className="text-[10px] text-blue-600 font-bold">Select ➔</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Line Item Intake Inputs Form */}
                <form onSubmit={handleAddItem} className="space-y-4 pt-2">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs font-bold text-gray-900">
                        {/* Packaging Unit */}
                        <div>
                            <label className="block mb-1">Packaging Unit</label>
                            <select
                                value={itemUnit}
                                onChange={(e) => setItemUnit(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:bg-white focus:border-emerald-600 outline-none"
                            >
                                {ALL_UNITS.map((u) => (
                                    <option key={u} value={u}>{u}</option>
                                ))}
                            </select>
                        </div>

                        {/* Received Quantity */}
                        <div>
                            <label className="block mb-1">Received Qty *</label>
                            <input
                                type="number"
                                min="1"
                                step="any"
                                required
                                value={itemQty}
                                onChange={(e) => setItemQty(parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-mono font-black text-gray-900 focus:bg-white focus:border-emerald-600 outline-none"
                            />
                        </div>

                        {/* Pieces per Package */}
                        <div>
                            <label className="block mb-1">Pieces per Package</label>
                            <input
                                type="number"
                                min="1"
                                value={itemPiecesPerPack}
                                onChange={(e) => setItemPiecesPerPack(parseInt(e.target.value, 10) || 1)}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-mono text-gray-900 focus:bg-white focus:border-emerald-600 outline-none"
                            />
                        </div>

                        {/* Unit Purchase Cost */}
                        <div>
                            <label className="block mb-1">Unit Cost (Ksh) *</label>
                            <input
                                type="number"
                                step="any"
                                required
                                value={itemCost}
                                onChange={(e) => setItemCost(parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-mono font-black text-blue-900 focus:bg-white focus:border-emerald-600 outline-none"
                            />
                        </div>

                        {/* Unit Selling Price */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label>Selling Price (Ksh)</label>
                                <span className="text-[10px] text-emerald-800 font-bold">
                                    +{itemMargin.markupPct.toFixed(0)}%
                                </span>
                            </div>
                            <input
                                type="number"
                                step="any"
                                value={itemSell}
                                onChange={(e) => setItemSell(parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-mono font-black text-emerald-900 focus:bg-white focus:border-emerald-600 outline-none"
                            />
                        </div>

                        {/* Line Total Cost */}
                        <div className="bg-gray-100 p-2 rounded-xl flex flex-col justify-center">
                            <span className="text-[10px] text-gray-600 font-bold uppercase">Total Line Cost</span>
                            <span className="text-sm font-black text-gray-900 font-mono">
                                Ksh {(Number(itemQty) * Number(itemCost)).toLocaleString()}
                            </span>
                        </div>
                    </div>

                    {/* Batch / Expiry / Quality Controls Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-bold text-gray-900 p-3 bg-gray-50 rounded-2xl border border-gray-200">
                        {/* Batch Number */}
                        <div>
                            <label className="block mb-1 text-gray-900">
                                Batch / Lot # * (FEFO)
                            </label>
                            <input
                                type="text"
                                required
                                value={itemBatchNo}
                                onChange={(e) => setItemBatchNo(e.target.value.toUpperCase())}
                                placeholder="e.g. LOT-49821"
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-mono font-black text-gray-900 focus:border-emerald-600 outline-none uppercase"
                            />
                        </div>

                        {/* Expiry Date */}
                        <div>
                            <label className="block mb-1 text-gray-900">
                                Expiry Date * (Mandatory)
                            </label>
                            <input
                                type="date"
                                required
                                value={itemExpiryDate}
                                onChange={(e) => setItemExpiryDate(e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:border-emerald-600 outline-none"
                            />
                        </div>

                        {/* Manufacture Date */}
                        <div>
                            <label className="block mb-1 text-gray-900">Manufacture Date</label>
                            <input
                                type="date"
                                value={itemMfgDate}
                                onChange={(e) => setItemMfgDate(e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:border-emerald-600 outline-none"
                            />
                        </div>

                        {/* Storage Conditions */}
                        <div>
                            <label className="block mb-1 text-gray-900">Storage Specification</label>
                            <select
                                value={itemStorage}
                                onChange={(e) => setItemStorage(e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:border-emerald-600 outline-none"
                            >
                                <option value="Room Temp (15-25°C)">Room Temp (15-25°C)</option>
                                <option value="Cool Storage (8-15°C)">Cool Storage (8-15°C)</option>
                                <option value="Cold Chain / Fridge (2-8°C)">Cold Chain / Fridge (2-8°C)</option>
                                <option value="Controlled Substance Locker">Controlled Substance Locker</option>
                            </select>
                        </div>
                    </div>

                    {/* Quick Markup Presets & Add Line Button */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                            <span className="text-gray-600 font-bold">Markup Presets:</span>
                            {[20, 25, 33, 40, 50].map((pct) => (
                                <button
                                    key={pct}
                                    type="button"
                                    onClick={() => applySuggestedMarkup(pct)}
                                    className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-bold text-[11px]"
                                >
                                    +{pct}%
                                </button>
                            ))}
                            <label className="flex items-center gap-1.5 ml-2 cursor-pointer font-bold text-gray-800">
                                <input
                                    type="checkbox"
                                    checked={itemUpdateMasterPrice}
                                    onChange={(e) => setItemUpdateMasterPrice(e.target.checked)}
                                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                />
                                <span>Update Master Drug Pricing</span>
                            </label>
                        </div>

                        <button
                            type="submit"
                            className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl text-xs font-black shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 active:scale-95"
                        >
                            <span>➕</span> Add Drug to Receiving Cart
                        </button>
                    </div>
                </form>
            </div>

            {/* Existing Batches Panel — shown when product is selected */}
            {showBatchPanel && existingBatches.length > 0 && (
                <div className="bg-white rounded-3xl border border-amber-200 shadow-xs overflow-hidden">
                    <div className="p-4 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-base">📋</span>
                            <h3 className="font-black text-amber-900 text-xs uppercase tracking-wider">
                                Existing Stock Batches — {selectedProduct?.product_name}
                            </h3>
                            <span className="text-xs bg-amber-200 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                                {existingBatches.length} batch{existingBatches.length !== 1 ? 'es' : ''}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowBatchPanel(false)}
                            className="text-amber-500 hover:text-amber-700 text-xs font-bold"
                        >
                            ✕ Hide
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="bg-amber-50/50 border-b border-amber-100">
                                    <th className="text-left p-3 font-black text-amber-900 uppercase tracking-wide">Batch #</th>
                                    <th className="text-left p-3 font-black text-amber-900 uppercase tracking-wide">Expiry</th>
                                    <th className="text-right p-3 font-black text-amber-900 uppercase tracking-wide">Qty In</th>
                                    <th className="text-right p-3 font-black text-amber-900 uppercase tracking-wide">Remaining</th>
                                    <th className="text-right p-3 font-black text-amber-900 uppercase tracking-wide">Sell Price</th>
                                    <th className="text-left p-3 font-black text-amber-900 uppercase tracking-wide">Supplier</th>
                                    <th className="text-center p-3 font-black text-amber-900 uppercase tracking-wide">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {existingBatches.map((b, i) => {
                                    const isExpired = b.expiry_date && new Date(b.expiry_date) < new Date();
                                    const daysLeft = b.expiry_date ? Math.ceil((new Date(b.expiry_date).getTime() - Date.now()) / 86400000) : null;
                                    return (
                                        <tr key={b.batch_id || i} className="border-b border-amber-50 hover:bg-amber-50/40 transition">
                                            <td className="p-3 font-bold text-slate-800">{b.batch_number || '—'}</td>
                                            <td className="p-3">
                                                <span className={`font-bold ${isExpired ? 'text-red-600' : daysLeft !== null && daysLeft < 90 ? 'text-orange-600' : 'text-green-700'}`}>
                                                    {b.expiry_date ? new Date(b.expiry_date).toLocaleDateString('en-KE') : '—'}
                                                </span>
                                                {daysLeft !== null && !isExpired && daysLeft < 90 && (
                                                    <span className="ml-1 text-orange-500 font-bold">({daysLeft}d)</span>
                                                )}
                                                {isExpired && <span className="ml-1 text-red-500 font-bold">(EXPIRED)</span>}
                                            </td>
                                            <td className="p-3 text-right font-bold text-slate-700">{Number(b.quantity || 0).toLocaleString()}</td>
                                            <td className="p-3 text-right font-bold text-slate-900">{Number(b.remaining_qty || 0).toLocaleString()}</td>
                                            <td className="p-3 text-right font-bold text-emerald-700">Ksh {Number(b.selling_price || 0).toLocaleString()}</td>
                                            <td className="p-3 text-slate-600">{b.supplier_name || '—'}</td>
                                            <td className="p-3 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                                    isExpired ? 'bg-red-100 text-red-700' :
                                                    b.status === 'Active' ? 'bg-green-100 text-green-700' :
                                                    'bg-gray-100 text-gray-600'
                                                }`}>
                                                    {isExpired ? 'EXPIRED' : b.status || 'Active'}
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
            <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden space-y-0">
                <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-base">📦</span>
                        <h3 className="font-black text-gray-900 text-xs uppercase tracking-wider">
                            Received Items Cart ({items.length} Lines)
                        </h3>
                    </div>
                    {items.length > 0 && (
                        <button
                            type="button"
                            onClick={() => {
                                if (confirm('Clear all items from this receiving note?')) setItems([]);
                            }}
                            className="text-xs text-red-600 hover:underline font-bold"
                        >
                            Clear All
                        </button>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-gray-50/80 border-b border-gray-200 text-[10px] font-black uppercase text-gray-900 tracking-wider">
                                <th className="p-3 w-8">#</th>
                                <th className="p-3">Drug / Product Name</th>
                                <th className="p-3">Batch # / Lot</th>
                                <th className="p-3">Expiry Date</th>
                                <th className="p-3 text-center">Packaging</th>
                                <th className="p-3 text-right">Received Qty</th>
                                <th className="p-3 text-right">Unit Cost</th>
                                <th className="p-3 text-right">Total Cost</th>
                                <th className="p-3 text-right">Selling Price</th>
                                <th className="p-3 text-center">Catalog Update</th>
                                <th className="p-3 text-center w-16">Remove</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-gray-900 font-medium">
                            {items.length === 0 ? (
                                <tr>
                                    <td colSpan={11} className="p-12 text-center text-gray-500">
                                        <div className="text-4xl mb-2">📥</div>
                                        <p className="font-bold text-gray-800 text-sm">Receiving cart is currently empty</p>
                                        <p className="text-xs text-gray-500 mt-1">Search drugs above, fill quantity and batch lots to begin receiving</p>
                                    </td>
                                </tr>
                            ) : (
                                items.map((it, idx) => {
                                    const daysToExpiry = Math.ceil((new Date(it.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                                    const isExpiryShort = daysToExpiry < 180;

                                    return (
                                        <tr key={it.id} className="hover:bg-emerald-50/30 transition-colors">
                                            <td className="p-3 text-gray-400 font-bold">{idx + 1}</td>
                                            <td className="p-3">
                                                <p className="font-bold text-gray-900">{it.productName}</p>
                                                <span className="text-[10px] font-mono text-gray-500">{it.productCode}</span>
                                            </td>
                                            <td className="p-3 whitespace-nowrap">
                                                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-900 rounded font-mono font-bold text-[11px] border border-indigo-200">
                                                    {it.batchNumber}
                                                </span>
                                            </td>
                                            <td className="p-3 whitespace-nowrap">
                                                <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                                                    isExpiryShort
                                                        ? 'bg-red-50 text-red-800 border-red-200'
                                                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                                }`}>
                                                    {it.expiryDate} ({daysToExpiry}d)
                                                </span>
                                            </td>
                                            <td className="p-3 text-center whitespace-nowrap">
                                                <span className="text-[11px] text-gray-700 font-semibold">
                                                    {it.purchaseUnit} ({it.piecesPerPackage} pcs)
                                                </span>
                                            </td>
                                            <td className="p-3 text-right font-mono font-bold text-gray-900 whitespace-nowrap">
                                                {it.qty} {it.purchaseUnit}
                                            </td>
                                            <td className="p-3 text-right font-mono font-bold text-blue-900 whitespace-nowrap">
                                                Ksh {it.price.toLocaleString()}
                                            </td>
                                            <td className="p-3 text-right font-mono font-black text-gray-900 whitespace-nowrap">
                                                Ksh {it.total.toLocaleString()}
                                            </td>
                                            <td className="p-3 text-right font-mono font-bold text-emerald-900 whitespace-nowrap">
                                                Ksh {it.newSellPrice.toLocaleString()}
                                            </td>
                                            <td className="p-3 text-center whitespace-nowrap">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                    it.updatePrices ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                    {it.updatePrices ? '✓ Master' : 'Lot Only'}
                                                </span>
                                            </td>
                                            <td className="p-3 text-center whitespace-nowrap">
                                                <button
                                                    onClick={() => handleRemoveItem(it.id)}
                                                    className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                                                    title="Remove item"
                                                >
                                                    🗑️
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Bottom Commitment & Settlement Footer Panel */}
            <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                    {/* Notes & Quality Observations */}
                    <div className="space-y-2">
                        <label className="block text-xs font-black text-gray-900">
                            Quality Remarks &amp; Cold Chain Inspection Notes
                        </label>
                        <textarea
                            rows={3}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="e.g. All cartons received sealed and dry. Fridge data logger verified at 4.2°C. Verified against Delivery Note."
                            className="w-full p-3 bg-gray-50 border border-gray-300 rounded-2xl text-xs text-gray-900 focus:bg-white focus:border-emerald-600 outline-none"
                        />
                    </div>

                    {/* Tax & Discounts Controls */}
                    <div className="space-y-3 bg-gray-50 p-4 rounded-2xl border border-gray-200 text-xs font-bold text-gray-900">
                        <div className="flex items-center justify-between">
                            <span>Supplier Trade Discount (Ksh):</span>
                            <input
                                type="number"
                                min="0"
                                value={discountAmount}
                                onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                                className="w-28 px-2 py-1 bg-white border border-gray-300 rounded-lg text-right font-mono"
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <span>VAT Tax Rate (%):</span>
                            <div className="flex items-center gap-1">
                                {[0, 8, 16].map((rate) => (
                                    <button
                                        key={rate}
                                        type="button"
                                        onClick={() => setVatPercent(rate)}
                                        className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                                            vatPercent === rate ? 'bg-blue-600 text-white' : 'bg-white border text-gray-700'
                                        }`}
                                    >
                                        {rate}%
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Grand Total & Final Commit Action */}
                    <div className="text-right space-y-3">
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Payable Commitment</p>
                            <p className="text-3xl font-black text-emerald-950 tracking-tight font-mono">
                                Ksh {financials.grandTotal.toLocaleString()}
                            </p>
                            <p className="text-[11px] text-gray-600 mt-0.5">
                                Terms: <span className="font-bold text-gray-900">{paymentStatus}</span> ({paymentMethod})
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={handleCommitGrn}
                            disabled={isSaving || items.length === 0}
                            className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-2xl font-black text-sm shadow-lg hover:shadow-xl transition-all disabled:opacity-40 active:scale-95 flex items-center justify-center gap-2"
                        >
                            <span>💾</span>
                            <span>{isSaving ? 'Committing to Database...' : 'Confirm & Commit GRN Shipment'}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* =====================================================================
                MODAL 1: QUICK ADD DRUG / PRODUCT
            ===================================================================== */}
            {showAddProductModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
                    <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 w-full max-w-lg overflow-hidden">
                        <div className="p-5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex items-center justify-between">
                            <h3 className="font-black text-base flex items-center gap-2">
                                <span>💊</span> Register New Medicine
                            </h3>
                            <button onClick={() => setShowAddProductModal(false)} className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center font-bold">✕</button>
                        </div>
                        <form onSubmit={handleQuickAddProduct} className="p-6 space-y-3 text-xs font-bold text-gray-900">
                            <div>
                                <label className="block mb-1">Drug / Product Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={newProdName}
                                    onChange={(e) => setNewProdName(e.target.value)}
                                    placeholder="e.g. Paracetamol Extra 500mg"
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block mb-1">Product Code</label>
                                    <input
                                        type="text"
                                        value={newProdCode}
                                        onChange={(e) => setNewProdCode(e.target.value)}
                                        placeholder="Auto (DRG-XXXX)"
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block mb-1">Category</label>
                                    <select
                                        value={newProdCategory}
                                        onChange={(e) => setNewProdCategory(e.target.value)}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl"
                                    >
                                        <option value="Tablets & Capsules">Tablets &amp; Capsules</option>
                                        <option value="Syrups & Suspensions">Syrups &amp; Suspensions</option>
                                        <option value="Injections & Infusions">Injections &amp; Infusions</option>
                                        <option value="Eye & Ear Drops">Eye &amp; Ear Drops</option>
                                        <option value="Creams & Ointments">Creams &amp; Ointments</option>
                                        <option value="General Retail">General Retail</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block mb-1">Purchase Cost</label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={newProdCost}
                                        onChange={(e) => setNewProdCost(parseFloat(e.target.value) || 0)}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block mb-1">Selling Price</label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={newProdSell}
                                        onChange={(e) => setNewProdSell(parseFloat(e.target.value) || 0)}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl font-mono text-emerald-900"
                                    />
                                </div>
                                <div>
                                    <label className="block mb-1">Pieces / Box</label>
                                    <input
                                        type="number"
                                        value={newProdPcs}
                                        onChange={(e) => setNewProdPcs(parseInt(e.target.value, 10) || 1)}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl font-mono"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block mb-1">Barcode (Optional)</label>
                                <input
                                    type="text"
                                    value={newProdBarcode}
                                    onChange={(e) => setNewProdBarcode(e.target.value)}
                                    placeholder="Scan or enter barcode"
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl font-mono"
                                />
                            </div>
                            <div className="pt-3 border-t border-gray-200 flex items-center justify-between">
                                <button type="button" onClick={() => setShowAddProductModal(false)} className="px-4 py-2 bg-gray-100 rounded-xl">Cancel</button>
                                <button type="submit" disabled={isSavingProd} className="px-5 py-2 bg-blue-600 text-white rounded-xl font-bold">
                                    {isSavingProd ? 'Saving...' : 'Register & Select Drug'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* =====================================================================
                MODAL 2: QUICK ADD SUPPLIER
            ===================================================================== */}
            {showAddSupplierModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
                    <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 w-full max-w-lg overflow-hidden">
                        <div className="p-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
                            <h3 className="font-black text-base flex items-center gap-2">
                                <span>🏢</span> Register New Distributor / Vendor
                            </h3>
                            <button onClick={() => setShowAddSupplierModal(false)} className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center font-bold">✕</button>
                        </div>
                        <form onSubmit={handleQuickAddSupplier} className="p-6 space-y-3 text-xs font-bold text-gray-900">
                            <div>
                                <label className="block mb-1">Company / Supplier Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={newSuppName}
                                    onChange={(e) => setNewSuppName(e.target.value)}
                                    placeholder="e.g. Laborex Kenya / Harleys Pharma"
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block mb-1">Primary Phone</label>
                                    <input
                                        type="text"
                                        value={newSuppPhone}
                                        onChange={(e) => setNewSuppPhone(e.target.value)}
                                        placeholder="0712345678"
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block mb-1">Contact Person</label>
                                    <input
                                        type="text"
                                        value={newSuppContact}
                                        onChange={(e) => setNewSuppContact(e.target.value)}
                                        placeholder="Sales Representative"
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block mb-1">Payment Terms</label>
                                    <select
                                        value={newSuppTerms}
                                        onChange={(e) => setNewSuppTerms(e.target.value)}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl"
                                    >
                                        <option value="Cash">Cash on Delivery</option>
                                        <option value="Net 15">Net 15 Days</option>
                                        <option value="Net 30">Net 30 Days</option>
                                        <option value="Net 60">Net 60 Days</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block mb-1">KRA PIN Number</label>
                                    <input
                                        type="text"
                                        value={newSuppKra}
                                        onChange={(e) => setNewSuppKra(e.target.value.toUpperCase())}
                                        placeholder="P051234567X"
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl font-mono uppercase"
                                    />
                                </div>
                            </div>
                            <div className="pt-3 border-t border-gray-200 flex items-center justify-between">
                                <button type="button" onClick={() => setShowAddSupplierModal(false)} className="px-4 py-2 bg-gray-100 rounded-xl">Cancel</button>
                                <button type="submit" disabled={isSavingSupp} className="px-5 py-2 bg-emerald-600 text-white rounded-xl font-bold">
                                    {isSavingSupp ? 'Registering...' : 'Register & Select'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* =====================================================================
                MODAL 3: OFFICIAL GRN PRINT & RECEIPT DOCUMENT
            ===================================================================== */}
            {showGrnPrintModal && completedGrn && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
                    <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
                        <div className="p-4 bg-emerald-600 text-white flex items-center justify-between">
                            <h3 className="font-black text-sm">Official Goods Received Note (GRN) Document</h3>
                            <button onClick={() => setShowGrnPrintModal(false)} className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center font-bold">✕</button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-4 text-xs font-medium text-gray-900" id="printableGrn">
                            <div className="border-b border-gray-200 pb-3 flex items-start justify-between">
                                <div>
                                    <h2 className="text-lg font-black text-gray-900">ALPHA PHARMACY</h2>
                                    <p className="text-[11px] text-gray-600">{completedGrn.outlet_name} • Licensed Pharmacy</p>
                                    <p className="text-[11px] text-gray-600">Goods Received Note / Delivery Inspection</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-mono font-black text-base text-blue-700">{completedGrn.purchase_no}</p>
                                    <p className="text-[11px] text-gray-600">Date: {completedGrn.purchase_date}</p>
                                    <p className="text-[11px] text-gray-600">Status: {completedGrn.payment_status}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded-xl">
                                <div>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase">Distributor / Supplier</p>
                                    <p className="font-black text-gray-900 text-xs">{completedGrn.supplier_name}</p>
                                    <p className="text-[11px] text-gray-600">Supplier Inv: {completedGrn.supplier_invoice || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase">Received By</p>
                                    <p className="font-black text-gray-900 text-xs">{completedGrn.created_by}</p>
                                    <p className="text-[11px] text-gray-600">{completedGrn.notes}</p>
                                </div>
                            </div>
                            <table className="w-full border-collapse border border-gray-200 text-xs">
                                <thead className="bg-gray-100 font-black text-[10px] uppercase">
                                    <tr>
                                        <th className="border p-2 text-left">Item Description</th>
                                        <th className="border p-2 text-left">Batch #</th>
                                        <th className="border p-2 text-left">Expiry</th>
                                        <th className="border p-2 text-right">Qty</th>
                                        <th className="border p-2 text-right">Cost</th>
                                        <th className="border p-2 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {completedGrn.items?.map((it: any, idx: number) => (
                                        <tr key={idx} className="border-b">
                                            <td className="border p-2 font-bold">{it.productName}</td>
                                            <td className="border p-2 font-mono">{it.batchNumber}</td>
                                            <td className="border p-2">{it.expiryDate}</td>
                                            <td className="border p-2 text-right font-mono">{it.qty} {it.purchaseUnit}</td>
                                            <td className="border p-2 text-right font-mono">Ksh {it.price.toLocaleString()}</td>
                                            <td className="border p-2 text-right font-mono font-bold">Ksh {it.total.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-gray-50 font-black">
                                        <td colSpan={5} className="border p-2 text-right">NET GRAND TOTAL:</td>
                                        <td className="border p-2 text-right text-emerald-900 font-mono">
                                            Ksh {completedGrn.financials?.grandTotal?.toLocaleString()}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                            <div className="grid grid-cols-2 gap-8 pt-8 text-[11px] text-gray-600">
                                <div>
                                    <div className="border-t border-gray-400 pt-1 font-bold">Verified &amp; Inspected By</div>
                                    <p>{completedGrn.created_by}</p>
                                </div>
                                <div className="text-right">
                                    <div className="border-t border-gray-400 pt-1 font-bold">Supplier Driver / Agent Signature</div>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                            <button onClick={() => window.print()} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold">
                                🖨️ Print GRN Note
                            </button>
                            <button onClick={() => setShowGrnPrintModal(false)} className="px-6 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold">
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* =====================================================================
                MODAL 4: RECENT INVOICES DRAWER
            ===================================================================== */}
            {showRecentInvoicesModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
                    <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden">
                        <div className="p-4 bg-gray-900 text-white flex items-center justify-between">
                            <h3 className="font-black text-sm">Recent Received Invoices (Live Database)</h3>
                            <button onClick={() => setShowRecentInvoicesModal(false)} className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center font-bold">✕</button>
                        </div>
                        <div className="p-4 overflow-y-auto flex-1 divide-y divide-gray-100 text-xs">
                            {recentInvoices.length === 0 ? (
                                <p className="text-center p-8 text-gray-500 font-bold">No purchase records found in database</p>
                            ) : (
                                recentInvoices.map((inv) => (
                                    <div key={inv.purchase_id} className="py-3 flex items-center justify-between hover:bg-gray-50 px-2 rounded-xl">
                                        <div>
                                            <p className="font-mono font-bold text-blue-700">{inv.purchase_no}</p>
                                            <p className="font-black text-gray-900">{inv.supplier_name}</p>
                                            <p className="text-[10px] text-gray-500">{inv.purchase_date}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-black text-emerald-950 font-mono">Ksh {Number(inv.grand_total).toLocaleString()}</p>
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                                {inv.payment_status || 'Paid'}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="p-4 bg-gray-50 border-t border-gray-200 text-right">
                            <button onClick={() => setShowRecentInvoicesModal(false)} className="px-6 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
