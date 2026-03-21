'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { FiDollarSign, FiSearch, FiFilter, FiCalendar, FiUsers, FiCreditCard, FiCheck, FiX, FiChevronLeft, FiChevronRight, FiRefreshCw, FiPhone, FiFileText } from 'react-icons/fi';

interface Customer {
    customer_id: number;
    customer_code: string;
    customer_name: string;
    phone: string;
    current_balance: number;
    credit_limit: number;
}

interface Sale {
    sale_id: number;
    receipt_no: string;
    sale_datetime: string;
    total_amount: number;
    amount_paid: number;
    payment_method: string;
    status: string;
}

interface Payment {
    payment_id: number;
    customer_id: number;
    sale_id: number | null;
    receipt_no: string;
    payment_date: string;
    payment_datetime: string;
    amount_paid: number;
    balance_before: number;
    balance_after: number;
    payment_method: string;
    mpesa_code: string;
    reference_no: string;
    payment_note: string;
    received_by: string;
    created_at: string;
    // joined
    customer_name?: string;
    customer_phone?: string;
}

export default function CreditPaymentsPage() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [customerSearch, setCustomerSearch] = useState('');
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const [outstandingSales, setOutstandingSales] = useState<Sale[]>([]);
    const [selectedSales, setSelectedSales] = useState<number[]>([]);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [mpesaCode, setMpesaCode] = useState('');
    const [paymentNote, setPaymentNote] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [paymentMode, setPaymentMode] = useState<'invoice' | 'general'>('general');

    // Payment History
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loadingPayments, setLoadingPayments] = useState(false);
    const [historySearch, setHistorySearch] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [amountFrom, setAmountFrom] = useState('');
    const [amountTo, setAmountTo] = useState('');
    const [historyCustomerFilter, setHistoryCustomerFilter] = useState('');
    const [historyPhoneFilter, setHistoryPhoneFilter] = useState('');
    const [historyPage, setHistoryPage] = useState(1);
    const historyPerPage = 15;

    // Tab
    const [activeTab, setActiveTab] = useState<'receive' | 'history'>('receive');

    useEffect(() => {
        loadCustomers();
        loadPaymentHistory();
    }, []);

    const loadCustomers = async () => {
        const { data } = await supabase
            .from('retail_credit_customers')
            .select('customer_id, customer_code, customer_name, phone, current_balance, credit_limit')
            .eq('active', true)
            .order('customer_name');
        setCustomers(data || []);
    };

    const loadOutstandingSales = async (customerId: number) => {
        const { data } = await supabase
            .from('retail_sales')
            .select('*')
            .eq('customer_id', customerId)
            .eq('payment_method', 'CREDIT')
            .order('sale_datetime', { ascending: true });
        setOutstandingSales(data || []);
    };

    const loadPaymentHistory = async () => {
        setLoadingPayments(true);
        const { data } = await supabase
            .from('retail_credit_payments')
            .select('*')
            .order('payment_datetime', { ascending: false })
            .limit(500);

        // Enrich with customer names
        if (data && data.length > 0) {
            const customerIds = Array.from(new Set(data.map(p => p.customer_id)));
            const { data: custData } = await supabase
                .from('retail_credit_customers')
                .select('customer_id, customer_name, phone')
                .in('customer_id', customerIds);

            const custMap = new Map((custData || []).map(c => [c.customer_id, c]));
            const enriched = data.map(p => ({
                ...p,
                customer_name: custMap.get(p.customer_id)?.customer_name || 'Unknown',
                customer_phone: custMap.get(p.customer_id)?.phone || ''
            }));
            setPayments(enriched);
        } else {
            setPayments([]);
        }
        setLoadingPayments(false);
    };

    const selectCustomer = (c: Customer) => {
        setSelectedCustomer(c);
        setCustomerSearch(c.customer_name);
        setShowCustomerDropdown(false);
        setSelectedSales([]);
        setPaymentAmount('');
        loadOutstandingSales(c.customer_id);
    };

    const filteredCustomers = customers.filter(c => {
        const q = customerSearch.toLowerCase();
        return c.customer_name?.toLowerCase().includes(q) || c.phone?.includes(q) || c.customer_code?.toLowerCase().includes(q);
    });

    const toggleSaleSelection = (saleId: number) => {
        setSelectedSales(prev =>
            prev.includes(saleId) ? prev.filter(id => id !== saleId) : [...prev, saleId]
        );
    };

    const selectedTotal = useMemo(() => {
        return outstandingSales
            .filter(s => selectedSales.includes(s.sale_id))
            .reduce((sum, s) => sum + (s.total_amount - (s.amount_paid || 0)), 0);
    }, [selectedSales, outstandingSales]);

    const handleReceivePayment = async () => {
        if (!selectedCustomer) { toast.error('Please select a customer'); return; }
        const amount = Number(paymentAmount);
        if (!amount || amount <= 0) { toast.error('Enter a valid payment amount'); return; }
        if (paymentMethod === 'MPESA' && !mpesaCode.trim()) { toast.error('Enter M-Pesa receipt code'); return; }

        setIsProcessing(true);
        try {
            const balanceBefore = selectedCustomer.current_balance;
            const balanceAfter = Math.max(0, balanceBefore - amount);

            if (paymentMode === 'invoice' && selectedSales.length > 0) {
                // Invoice-wise clearing
                let remaining = amount;
                for (const saleId of selectedSales) {
                    const sale = outstandingSales.find(s => s.sale_id === saleId);
                    if (!sale || remaining <= 0) continue;
                    const owed = sale.total_amount - (sale.amount_paid || 0);
                    const payForThis = Math.min(remaining, owed);

                    // Record payment for this invoice
                    await supabase.from('retail_credit_payments').insert({
                        customer_id: selectedCustomer.customer_id,
                        sale_id: saleId,
                        receipt_no: sale.receipt_no,
                        amount_paid: payForThis,
                        balance_before: balanceBefore,
                        balance_after: balanceAfter,
                        payment_method: paymentMethod,
                        mpesa_code: mpesaCode || null,
                        payment_note: paymentNote || null,
                    });

                    // Update sale amount_paid
                    await supabase.from('retail_sales')
                        .update({ amount_paid: (sale.amount_paid || 0) + payForThis })
                        .eq('sale_id', saleId);

                    remaining -= payForThis;
                }
            } else {
                // General payment — apply to oldest invoices first (FIFO)
                let remaining = amount;
                for (const sale of outstandingSales) {
                    if (remaining <= 0) break;
                    const owed = sale.total_amount - (sale.amount_paid || 0);
                    if (owed <= 0) continue;
                    const payForThis = Math.min(remaining, owed);

                    await supabase.from('retail_credit_payments').insert({
                        customer_id: selectedCustomer.customer_id,
                        sale_id: sale.sale_id,
                        receipt_no: sale.receipt_no,
                        amount_paid: payForThis,
                        balance_before: balanceBefore,
                        balance_after: balanceAfter,
                        payment_method: paymentMethod,
                        mpesa_code: mpesaCode || null,
                        payment_note: paymentNote || null,
                    });

                    await supabase.from('retail_sales')
                        .update({ amount_paid: (sale.amount_paid || 0) + payForThis })
                        .eq('sale_id', sale.sale_id);

                    remaining -= payForThis;
                }

                // If there's remaining amount (overpayment or no invoices), record general payment
                if (remaining > 0 || outstandingSales.length === 0) {
                    await supabase.from('retail_credit_payments').insert({
                        customer_id: selectedCustomer.customer_id,
                        sale_id: null,
                        receipt_no: null,
                        amount_paid: remaining > 0 ? remaining : amount,
                        balance_before: balanceBefore,
                        balance_after: balanceAfter,
                        payment_method: paymentMethod,
                        mpesa_code: mpesaCode || null,
                        payment_note: paymentNote || `General payment${remaining > 0 ? ' (includes overpayment)' : ''}`,
                    });
                }
            }

            // Update customer balance
            await supabase.from('retail_credit_customers')
                .update({ current_balance: balanceAfter })
                .eq('customer_id', selectedCustomer.customer_id);

            toast.success(`✅ Payment of Ksh ${amount.toLocaleString()} received! Balance: Ksh ${balanceAfter.toLocaleString()}`);

            // Refresh
            setSelectedCustomer({ ...selectedCustomer, current_balance: balanceAfter });
            setPaymentAmount('');
            setMpesaCode('');
            setPaymentNote('');
            setSelectedSales([]);
            loadOutstandingSales(selectedCustomer.customer_id);
            loadCustomers();
            loadPaymentHistory();
        } catch (err: any) {
            toast.error(err.message || 'Failed to process payment');
            console.error(err);
        } finally {
            setIsProcessing(false);
        }
    };

    // Filtered payment history
    const filteredPayments = useMemo(() => {
        let list = payments;
        if (historyCustomerFilter) {
            const q = historyCustomerFilter.toLowerCase();
            list = list.filter(p => p.customer_name?.toLowerCase().includes(q));
        }
        if (historyPhoneFilter) {
            list = list.filter(p => p.customer_phone?.includes(historyPhoneFilter));
        }
        if (dateFrom) list = list.filter(p => p.payment_date >= dateFrom);
        if (dateTo) list = list.filter(p => p.payment_date <= dateTo);
        if (amountFrom) list = list.filter(p => p.amount_paid >= Number(amountFrom));
        if (amountTo) list = list.filter(p => p.amount_paid <= Number(amountTo));
        return list;
    }, [payments, historyCustomerFilter, historyPhoneFilter, dateFrom, dateTo, amountFrom, amountTo]);

    const historyTotalPages = Math.ceil(filteredPayments.length / historyPerPage);
    const paginatedPayments = filteredPayments.slice((historyPage - 1) * historyPerPage, historyPage * historyPerPage);
    const totalReceived = filteredPayments.reduce((s, p) => s + p.amount_paid, 0);

    return (
        <div className="space-y-5" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>

            {/* ━━━ TOP BAR ━━━ */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-300/40">
                        <FiCreditCard className="text-white" size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Credit Payments</h1>
                        <p className="text-gray-500 text-sm mt-1">Receive payments &bull; Clear debts &bull; Payment history</p>
                    </div>
                </div>
                <button onClick={() => { loadPaymentHistory(); loadCustomers(); }} className="p-2.5 rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-all shadow-sm" title="Refresh">
                    <FiRefreshCw size={16} />
                </button>
            </div>

            {/* ━━━ TABS ━━━ */}
            <div className="flex gap-2">
                <button onClick={() => setActiveTab('receive')}
                    className={`px-6 py-3 rounded-xl font-semibold text-sm transition-all ${activeTab === 'receive' ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-300/40' : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'}`}>
                    <FiDollarSign className="inline mr-2" size={16} /> Receive Payment
                </button>
                <button onClick={() => setActiveTab('history')}
                    className={`px-6 py-3 rounded-xl font-semibold text-sm transition-all ${activeTab === 'history' ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-300/40' : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'}`}>
                    <FiFileText className="inline mr-2" size={16} /> Payment History ({payments.length})
                </button>
            </div>

            {/* ━━━ RECEIVE PAYMENT TAB ━━━ */}
            {activeTab === 'receive' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                    {/* Left: Customer Selection + Payment Form */}
                    <div className="lg:col-span-1 space-y-4">
                        {/* Customer Search */}
                        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><FiSearch size={16} /> Select Customer</h3>
                            <div className="relative">
                                <input
                                    value={customerSearch}
                                    onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDropdown(true); if (!e.target.value) setSelectedCustomer(null); }}
                                    onFocus={() => setShowCustomerDropdown(true)}
                                    placeholder="Search by name or phone..."
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-400/20 transition-all"
                                />
                                {showCustomerDropdown && customerSearch && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 max-h-48 overflow-y-auto">
                                        {filteredCustomers.length === 0 ? (
                                            <p className="p-3 text-sm text-gray-400">No customers found</p>
                                        ) : (
                                            filteredCustomers.slice(0, 10).map(c => (
                                                <button key={c.customer_id} onClick={() => selectCustomer(c)}
                                                    className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0">
                                                    <p className="font-semibold text-gray-800 text-sm">{c.customer_name}</p>
                                                    <p className="text-xs text-gray-500">{c.phone} &bull; Balance: Ksh {(c.current_balance || 0).toLocaleString()}</p>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Selected Customer Summary */}
                        {selectedCustomer && (
                            <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-2xl p-5">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="font-bold text-blue-800">{selectedCustomer.customer_name}</h3>
                                    <span className="text-xs text-blue-600 bg-blue-200/50 px-2 py-1 rounded-lg">{selectedCustomer.customer_code}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-white/70 p-3 rounded-xl text-center">
                                        <p className="text-xs text-gray-500">Current Balance</p>
                                        <p className={`text-xl font-bold ${selectedCustomer.current_balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                            Ksh {(selectedCustomer.current_balance || 0).toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="bg-white/70 p-3 rounded-xl text-center">
                                        <p className="text-xs text-gray-500">Credit Limit</p>
                                        <p className="text-xl font-bold text-blue-700">Ksh {(selectedCustomer.credit_limit || 0).toLocaleString()}</p>
                                    </div>
                                </div>
                                {selectedCustomer.phone && <p className="text-sm text-blue-700 mt-2 flex items-center gap-1"><FiPhone size={12} /> {selectedCustomer.phone}</p>}
                            </div>
                        )}

                        {/* Payment Form */}
                        {selectedCustomer && (
                            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2"><FiDollarSign size={16} /> Payment Details</h3>

                                {/* Payment Mode */}
                                <div className="flex gap-2">
                                    <button onClick={() => setPaymentMode('general')}
                                        className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${paymentMode === 'general' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                        General Payment
                                    </button>
                                    <button onClick={() => setPaymentMode('invoice')}
                                        className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${paymentMode === 'invoice' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                        Invoice-wise
                                    </button>
                                </div>

                                {/* Amount */}
                                <div>
                                    <label className="text-sm font-semibold text-gray-700 mb-1 block">Amount Received</label>
                                    <input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)}
                                        placeholder="Enter amount..."
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-400/20 text-lg font-bold transition-all" />
                                    {selectedCustomer.current_balance > 0 && (
                                        <button onClick={() => setPaymentAmount(selectedCustomer.current_balance.toString())}
                                            className="mt-2 w-full py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-sm font-medium transition-colors">
                                            Clear Full Balance (Ksh {selectedCustomer.current_balance.toLocaleString()})
                                        </button>
                                    )}
                                    {paymentMode === 'invoice' && selectedTotal > 0 && (
                                        <button onClick={() => setPaymentAmount(selectedTotal.toString())}
                                            className="mt-1 w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-sm font-medium transition-colors">
                                            Pay Selected Invoices (Ksh {selectedTotal.toLocaleString()})
                                        </button>
                                    )}
                                </div>

                                {/* Payment Method */}
                                <div>
                                    <label className="text-sm font-semibold text-gray-700 mb-1 block">Payment Method</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['Cash', 'MPESA'].map(m => (
                                            <button key={m} onClick={() => setPaymentMethod(m)}
                                                className={`py-3 rounded-xl text-sm font-semibold transition-all ${paymentMethod === m ? 'bg-blue-500 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                                {m === 'Cash' ? '💵' : '📱'} {m}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {paymentMethod === 'MPESA' && (
                                    <div>
                                        <label className="text-sm font-semibold text-gray-700 mb-1 block">M-Pesa Receipt Code</label>
                                        <input value={mpesaCode} onChange={e => setMpesaCode(e.target.value.toUpperCase())}
                                            placeholder="e.g., RLJ5XXXXXX"
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-400/20 transition-all" />
                                    </div>
                                )}

                                <div>
                                    <label className="text-sm font-semibold text-gray-700 mb-1 block">Note (Optional)</label>
                                    <input value={paymentNote} onChange={e => setPaymentNote(e.target.value)}
                                        placeholder="Payment note..."
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-400/20 transition-all" />
                                </div>

                                <button onClick={handleReceivePayment} disabled={isProcessing}
                                    className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold text-lg rounded-2xl shadow-lg shadow-green-300/40 hover:shadow-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                                    {isProcessing ? (
                                        <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Processing...</>
                                    ) : (
                                        <><FiCheck size={20} /> Receive Payment</>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Right: Outstanding Invoices */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-5 py-4 text-white">
                                <h3 className="font-bold">Outstanding Invoices</h3>
                                <p className="text-blue-100 text-sm">{selectedCustomer ? `${outstandingSales.length} credit invoices` : 'Select a customer to view invoices'}</p>
                            </div>

                            {!selectedCustomer ? (
                                <div className="p-10 text-center">
                                    <FiUsers size={48} className="mx-auto text-gray-300 mb-3" />
                                    <p className="text-gray-400">Select a customer to view outstanding invoices</p>
                                </div>
                            ) : outstandingSales.length === 0 ? (
                                <div className="p-10 text-center">
                                    <FiCheck size={48} className="mx-auto text-green-400 mb-3" />
                                    <p className="text-gray-500 font-medium">No outstanding credit invoices</p>
                                    <p className="text-gray-400 text-sm">This customer has no pending credit sales</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100">
                                    {outstandingSales.map(s => {
                                        const owed = s.total_amount - (s.amount_paid || 0);
                                        const isSelected = selectedSales.includes(s.sale_id);
                                        return (
                                            <div key={s.sale_id}
                                                onClick={() => paymentMode === 'invoice' && toggleSaleSelection(s.sale_id)}
                                                className={`flex items-center gap-4 px-5 py-4 transition-all ${paymentMode === 'invoice' ? 'cursor-pointer hover:bg-blue-50' : ''} ${isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}>
                                                {paymentMode === 'invoice' && (
                                                    <input type="checkbox" checked={isSelected} readOnly
                                                        className="w-5 h-5 rounded accent-blue-500 pointer-events-none" />
                                                )}
                                                <div className="flex-1">
                                                    <p className="font-semibold text-gray-800 text-sm">{s.receipt_no}</p>
                                                    <p className="text-xs text-gray-500">{new Date(s.sale_datetime).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm text-gray-500">Total: Ksh {(s.total_amount || 0).toLocaleString()}</p>
                                                    <p className="font-bold text-red-600">Owed: Ksh {owed.toLocaleString()}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {paymentMode === 'invoice' && selectedSales.length > 0 && (
                                <div className="px-5 py-3 bg-blue-50 border-t border-blue-200 flex items-center justify-between">
                                    <span className="text-sm text-blue-700 font-medium">{selectedSales.length} invoice(s) selected</span>
                                    <span className="font-bold text-blue-800">Total: Ksh {selectedTotal.toLocaleString()}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ━━━ PAYMENT HISTORY TAB ━━━ */}
            {activeTab === 'history' && (
                <div className="space-y-4">
                    {/* Filters */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><FiFilter size={16} /> Filters</h3>
                        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                            <div>
                                <label className="text-xs font-semibold text-gray-500 mb-1 block">Customer Name</label>
                                <input value={historyCustomerFilter} onChange={e => { setHistoryCustomerFilter(e.target.value); setHistoryPage(1); }}
                                    placeholder="Search customer..."
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-400/20 transition-all" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-500 mb-1 block">Phone Number</label>
                                <input value={historyPhoneFilter} onChange={e => { setHistoryPhoneFilter(e.target.value); setHistoryPage(1); }}
                                    placeholder="07XX..."
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-400/20 transition-all" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-500 mb-1 block">Date From</label>
                                <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setHistoryPage(1); }}
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-400/20 transition-all" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-500 mb-1 block">Date To</label>
                                <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setHistoryPage(1); }}
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-400/20 transition-all" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-500 mb-1 block">Amount From</label>
                                <input type="number" value={amountFrom} onChange={e => { setAmountFrom(e.target.value); setHistoryPage(1); }}
                                    placeholder="Min..."
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-400/20 transition-all" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-500 mb-1 block">Amount To</label>
                                <input type="number" value={amountTo} onChange={e => { setAmountTo(e.target.value); setHistoryPage(1); }}
                                    placeholder="Max..."
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-400/20 transition-all" />
                            </div>
                        </div>
                        {(historyCustomerFilter || historyPhoneFilter || dateFrom || dateTo || amountFrom || amountTo) && (
                            <button onClick={() => { setHistoryCustomerFilter(''); setHistoryPhoneFilter(''); setDateFrom(''); setDateTo(''); setAmountFrom(''); setAmountTo(''); setHistoryPage(1); }}
                                className="mt-3 px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200 transition-all flex items-center gap-1">
                                <FiX size={14} /> Clear Filters
                            </button>
                        )}
                    </div>

                    {/* Summary Bar */}
                    <div className="flex items-center justify-between px-5 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                            <FiDollarSign size={16} />
                            <span className="text-blue-100">Total Received:</span>
                            <span className="text-lg font-bold">Ksh {totalReceived.toLocaleString()}</span>
                        </div>
                        <span className="text-xs text-blue-100">{filteredPayments.length} payments found</span>
                    </div>

                    {/* Payment History Table */}
                    {loadingPayments ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <div className="w-14 h-14 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                            <p className="mt-4 text-gray-500 font-medium">Loading payments...</p>
                        </div>
                    ) : filteredPayments.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-2xl border border-gray-200">
                            <FiCreditCard size={48} className="mx-auto text-gray-300 mb-4" />
                            <p className="text-gray-500 font-medium">No payment records found</p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-gradient-to-r from-blue-500 to-blue-600">
                                            <th className="px-4 py-3 text-left text-[11px] font-bold text-blue-100 uppercase tracking-wider">Date</th>
                                            <th className="px-4 py-3 text-left text-[11px] font-bold text-blue-100 uppercase tracking-wider">Customer</th>
                                            <th className="px-4 py-3 text-left text-[11px] font-bold text-blue-100 uppercase tracking-wider">Phone</th>
                                            <th className="px-4 py-3 text-left text-[11px] font-bold text-blue-100 uppercase tracking-wider">Invoice</th>
                                            <th className="px-4 py-3 text-right text-[11px] font-bold text-blue-100 uppercase tracking-wider">Amount</th>
                                            <th className="px-4 py-3 text-center text-[11px] font-bold text-blue-100 uppercase tracking-wider">Method</th>
                                            <th className="px-4 py-3 text-right text-[11px] font-bold text-blue-100 uppercase tracking-wider">Bal After</th>
                                            <th className="px-4 py-3 text-left text-[11px] font-bold text-blue-100 uppercase tracking-wider">Note</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedPayments.map(p => (
                                            <tr key={p.payment_id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                                                <td className="px-4 py-3 text-sm text-gray-600">{new Date(p.payment_datetime || p.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                                <td className="px-4 py-3">
                                                    <p className="font-semibold text-gray-800 text-sm">{p.customer_name}</p>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-600">{p.customer_phone || '-'}</td>
                                                <td className="px-4 py-3">
                                                    <span className="text-xs font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">{p.receipt_no || 'General'}</span>
                                                </td>
                                                <td className="px-4 py-3 text-right font-bold text-green-600 text-sm">Ksh {(p.amount_paid || 0).toLocaleString()}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold ${p.payment_method === 'MPESA' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                                        {p.payment_method}
                                                    </span>
                                                    {p.mpesa_code && <p className="text-[10px] text-gray-400 mt-0.5">{p.mpesa_code}</p>}
                                                </td>
                                                <td className="px-4 py-3 text-right text-sm text-gray-600">Ksh {(p.balance_after || 0).toLocaleString()}</td>
                                                <td className="px-4 py-3 text-sm text-gray-500 truncate max-w-[150px]">{p.payment_note || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {historyTotalPages > 1 && (
                                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                                    <span className="text-xs text-gray-500">Showing {(historyPage - 1) * historyPerPage + 1}-{Math.min(historyPage * historyPerPage, filteredPayments.length)} of {filteredPayments.length}</span>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => setHistoryPage(p => Math.max(1, p - 1))} disabled={historyPage === 1} className="p-2 rounded-lg disabled:opacity-30 hover:bg-gray-100 transition-all">
                                            <FiChevronLeft size={16} />
                                        </button>
                                        {Array.from({ length: Math.min(historyTotalPages, 5) }, (_, i) => {
                                            const pg = i + 1;
                                            return (
                                                <button key={pg} onClick={() => setHistoryPage(pg)}
                                                    className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${pg === historyPage ? 'bg-blue-500 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}>
                                                    {pg}
                                                </button>
                                            );
                                        })}
                                        <button onClick={() => setHistoryPage(p => Math.min(historyTotalPages, p + 1))} disabled={historyPage === historyTotalPages} className="p-2 rounded-lg disabled:opacity-30 hover:bg-gray-100 transition-all">
                                            <FiChevronRight size={16} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
