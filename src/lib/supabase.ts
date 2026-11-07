import { createClient } from '@supabase/supabase-js';

// ============================================
// ALPHA PHARMACY - SUPABASE CONFIGURATION
// ============================================
// Same Supabase project as AlphaRetail
// All tables use pharmacy_ prefix
// ============================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// C2B/M-Pesa Supabase Client — Live Safaricom Daraja Registered C2B
const c2bSupabaseUrl = 'https://pxcdaivlvltmdifxietb.supabase.co';
const c2bSupabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4Y2RhaXZsdmx0bWRpZnhpZXRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NDI3NDIsImV4cCI6MjA4MTMxODc0Mn0.s6nv24s6M83gAcW_nSKCBfcXcqJ_7owwqdObPDT7Ky0';
export const c2bSupabase = createClient(c2bSupabaseUrl, c2bSupabaseAnonKey);

// ==================== AUTHENTICATION ====================
export async function loginUser(userId: string, password: string) {
    const { data, error } = await supabase
        .from('registration')
        .select('*')
        .eq('user_id', userId)
        .eq('password', password)
        .single();
    if (error) throw error;
    return data;
}

// ==================== ACTIVITY LOG ====================
export async function logActivity(actionType: string, description: string, details?: string) {
    try {
        const userData = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
        const user = userData ? JSON.parse(userData) : null;
        const logEntry = {
            action_type: actionType,
            description,
            details: details || null,
            user_name: user?.name || user?.userName || 'System',
            user_type: user?.userType || 'Staff',
            created_at: new Date().toISOString()
        };

        // Dual-log: Primary to live retail_activity_log, and secondary to pharmacy_activity_log
        try {
            await supabase.from('retail_activity_log').insert([logEntry]);
        } catch { /* silent */ }

        try {
            await supabase.from('pharmacy_activity_log').insert([{
                action_type: actionType,
                description,
                details: details || null,
                user_name: user?.name || user?.userName || 'System',
            }]);
        } catch { /* silent */ }
    } catch { /* silent */ }
}

// ==================== BATCH FUNCTIONS ====================

export async function getBatchesForProduct(productId: number, outletId: number = 1) {
    const { data, error } = await supabase
        .from('pharmacy_batches')
        .select('*')
        .eq('product_id', productId)
        .eq('outlet_id', outletId)
        .eq('status', 'Active')
        .gt('remaining_qty', 0)
        .order('expiry_date', { ascending: true }); // FEFO: earliest expiry first
    if (error) throw error;
    return data || [];
}

export async function getNearExpiryBatches(daysAhead: number = 90, outletId: number = 1) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);
    
    const { data, error } = await supabase
        .from('pharmacy_batches')
        .select('*, pharmacy_products!inner(product_name, category, purchase_cost, sales_cost)')
        .eq('outlet_id', outletId)
        .eq('status', 'Active')
        .gt('remaining_qty', 0)
        .lte('expiry_date', futureDate.toISOString().split('T')[0])
        .order('expiry_date', { ascending: true });
    if (error) throw error;
    return data || [];
}

export async function getExpiredBatches(outletId: number = 1) {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
        .from('pharmacy_batches')
        .select('*, pharmacy_products!inner(product_name, category, purchase_cost, sales_cost)')
        .eq('outlet_id', outletId)
        .eq('status', 'Active')
        .gt('remaining_qty', 0)
        .lt('expiry_date', today)
        .order('expiry_date', { ascending: true });
    if (error) throw error;
    return data || [];
}

export async function deductFromBatch(batchId: number, qty: number) {
    const { data: batch, error: fetchError } = await supabase
        .from('pharmacy_batches')
        .select('remaining_qty')
        .eq('batch_id', batchId)
        .single();
    if (fetchError) throw fetchError;
    const newQty = Math.max(0, (batch?.remaining_qty || 0) - qty);
    const { error } = await supabase
        .from('pharmacy_batches')
        .update({ remaining_qty: newQty, updated_at: new Date().toISOString() })
        .eq('batch_id', batchId);
    if (error) throw error;
}

export async function createBatch(batch: {
    product_id: number;
    batch_number: string;
    expiry_date: string;
    manufacture_date?: string;
    quantity: number;
    purchase_cost: number;
    selling_price: number;
    supplier_id?: number;
    supplier_name?: string;
    purchase_invoice?: string;
    outlet_id?: number;
}) {
    const { data, error } = await supabase
        .from('pharmacy_batches')
        .insert({
            ...batch,
            remaining_qty: batch.quantity,
            status: 'Active',
        })
        .select()
        .single();
    if (error) throw error;
    return data;
}

// ==================== COMPLETE SALE (Batch-Aware) ====================

export async function getNextReceiptNumber(outletId: number = 1): Promise<string> {
    const { data } = await supabase
        .from('pharmacy_sales')
        .select('receipt_no')
        .eq('outlet_id', outletId)
        .order('sale_id', { ascending: false })
        .limit(1)
        .single();
    if (data?.receipt_no) {
        const match = data.receipt_no.match(/RX-(\d+)/);
        if (match) return `RX-${String(parseInt(match[1]) + 1).padStart(4, '0')}`;
    }
    return 'RX-0001';
}

export async function completeSaleTransaction(sale: {
    receiptNo: string;
    items: Array<{
        productId: number;
        productName: string;
        qty: number;
        price: number;
        purchasePrice: number;
        discount: number;
        batchId?: number;
        batchNumber?: string;
        expiryDate?: string;
        notes?: string;
    }>;
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    paymentMethod: string;
    amountPaid: number;
    change: number;
    cashierName: string;
    shiftInstanceId?: number;
    customerName?: string;
    mpesaReceipt?: string;
    checkoutRequestId?: string;
    customerPhone?: string;
    outletId?: number;
}) {
    const outletId = sale.outletId || 1;

    // 1. Create sale record
    console.log('📝 Step 1: Creating sale record...', sale.receiptNo);
    const { data: saleRecord, error: saleError } = await supabase
        .from('pharmacy_sales')
        .insert({
            receipt_no: sale.receiptNo,
            sale_datetime: new Date().toISOString(),
            subtotal: sale.subtotal,
            discount: sale.discount,
            tax: sale.tax,
            total: sale.total,
            payment_method: sale.paymentMethod,
            amount_paid: sale.amountPaid,
            change_amount: sale.change,
            customer_name: sale.customerName || null,
            cashier_name: sale.cashierName,
            mpesa_receipt: sale.mpesaReceipt || null,
            shift_instance_id: sale.shiftInstanceId || null,
            checkout_request_id: sale.checkoutRequestId || null,
            customer_phone: sale.customerPhone || null,
            outlet_id: outletId,
        })
        .select()
        .single();
    if (saleError) {
        console.error('❌ Step 1 FAILED - pharmacy_sales insert:', saleError);
        throw new Error(`Sale header failed: ${saleError.message} (${saleError.code})`);
    }
    console.log('✅ Step 1 done, sale_id:', saleRecord.sale_id);

    // 2. Add sale items (try with notes first, fallback without)
    console.log('📝 Step 2: Adding sale items...');
    const saleItemsWithNotes = sale.items.map(item => ({
        sale_id: saleRecord.sale_id,
        product_id: item.productId,
        product_name: item.productName,
        batch_id: item.batchId || null,
        batch_number: item.batchNumber || null,
        expiry_date: item.expiryDate || null,
        quantity: item.qty,
        unit_price: item.price,
        discount: item.discount,
        total: (item.price * item.qty) - item.discount,
        purchase_price: item.purchasePrice,
        notes: item.notes || null,
    }));

    let { error: itemsError } = await supabase
        .from('pharmacy_sales_items')
        .insert(saleItemsWithNotes);

    // If notes column doesn't exist, retry without it
    if (itemsError) {
        console.warn('⚠️ Items insert with notes failed, retrying without notes...', itemsError.message);
        const saleItemsNoNotes = sale.items.map(item => ({
            sale_id: saleRecord.sale_id,
            product_id: item.productId,
            product_name: item.productName,
            batch_id: item.batchId || null,
            batch_number: item.batchNumber || null,
            expiry_date: item.expiryDate || null,
            quantity: item.qty,
            unit_price: item.price,
            discount: item.discount,
            total: (item.price * item.qty) - item.discount,
            purchase_price: item.purchasePrice,
        }));
        const retry = await supabase
            .from('pharmacy_sales_items')
            .insert(saleItemsNoNotes);
        if (retry.error) {
            console.error('❌ Step 2 FAILED - pharmacy_sales_items insert:', retry.error);
            throw new Error(`Sale items failed: ${retry.error.message} (${retry.error.code})`);
        }
    }
    console.log('✅ Step 2 done, items saved');

    // 3. Deduct stock from batches
    console.log('📝 Step 3: Deducting stock...');
    for (const item of sale.items) {
        try {
            if (item.batchId) {
                await deductFromBatch(item.batchId, item.qty);
            }
            // Also update general stock
            const { data: stockRow } = await supabase
                .from('pharmacy_stock')
                .select('st_id, qty')
                .eq('pid', item.productId)
                .eq('outlet_id', outletId)
                .limit(1)
                .single();
            if (stockRow) {
                await supabase
                    .from('pharmacy_stock')
                    .update({ qty: Math.max(0, (stockRow.qty || 0) - item.qty) })
                    .eq('st_id', stockRow.st_id);
            }
        } catch (stockErr) {
            console.warn('⚠️ Stock deduction warning for', item.productName, stockErr);
            // Don't fail the sale for stock issues
        }
    }
    console.log('✅ Step 3 done, stock updated');

    // 4. Handle credit sale
    if (sale.paymentMethod === 'CREDIT' && sale.customerName) {
        try {
            await supabase.rpc('increment_credit_balance', {
                p_customer_name: sale.customerName,
                p_amount: sale.total,
            });
        } catch {
            // Fallback: manual update
            try {
                const { data: cust } = await supabase
                    .from('pharmacy_credit_customers')
                    .select('customer_id, current_balance')
                    .eq('customer_name', sale.customerName as string)
                    .single();
                if (cust) {
                    await supabase
                        .from('pharmacy_credit_customers')
                        .update({ current_balance: (cust.current_balance || 0) + sale.total })
                        .eq('customer_id', cust.customer_id);
                }
            } catch { /* silent fallback */ }
        }
    }

    console.log('✅ Sale complete:', sale.receiptNo);
    return saleRecord;
}

// ==================== DASHBOARD STATS ====================
export async function getDashboardStats(outletId: number = 1) {
    const today = new Date().toISOString().split('T')[0];
    const { data: todaySales } = await supabase
        .from('pharmacy_sales')
        .select('total, payment_method')
        .eq('outlet_id', outletId)
        .gte('sale_datetime', `${today}T00:00:00`)
        .lte('sale_datetime', `${today}T23:59:59`);

    const { count: productsCount } = await supabase
        .from('pharmacy_products')
        .select('*', { count: 'exact', head: true })
        .eq('outlet_id', outletId)
        .eq('active', true);

    // Expiring in 30 days
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const { count: expiringCount } = await supabase
        .from('pharmacy_batches')
        .select('*', { count: 'exact', head: true })
        .eq('outlet_id', outletId)
        .eq('status', 'Active')
        .gt('remaining_qty', 0)
        .lte('expiry_date', futureDate.toISOString().split('T')[0]);

    // Expired
    const { count: expiredCount } = await supabase
        .from('pharmacy_batches')
        .select('*', { count: 'exact', head: true })
        .eq('outlet_id', outletId)
        .eq('status', 'Active')
        .gt('remaining_qty', 0)
        .lt('expiry_date', today);

    const totalRevenue = todaySales?.reduce((sum, s) => sum + (s.total || 0), 0) || 0;

    return {
        todayRevenue: totalRevenue,
        transactions: todaySales?.length || 0,
        products: productsCount || 0,
        expiringSoon: expiringCount || 0,
        expired: expiredCount || 0,
    };
}
