'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface SaleData {
    receipt_no: string;
    sale_date: string;
    sale_datetime: string;
    customer_name: string;
    total_amount: number;
    payment_method: string;
    mpesa_code: string | null;
    status: string;
}

export default function VerifyReceiptPage() {
    const params = useParams();
    const receiptNo = params?.receiptNo as string;
    const [sale, setSale] = useState<SaleData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (receiptNo) {
            fetchSale();
        }
    }, [receiptNo]);

    const fetchSale = async () => {
        try {
            const { data, error: fetchError } = await supabase
                .from('retail_sales')
                .select('receipt_no, sale_date, sale_datetime, customer_name, total_amount, payment_method, mpesa_code, status')
                .eq('receipt_no', decodeURIComponent(receiptNo))
                .single();

            if (fetchError) throw fetchError;
            setSale(data);
        } catch (err: any) {
            setError('Receipt not found or invalid');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="mt-4 text-gray-600">Verifying receipt...</p>
                </div>
            </div>
        );
    }

    if (error || !sale) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                    <div className="text-6xl mb-4">❌</div>
                    <h1 className="text-2xl font-bold text-red-600 mb-2">Invalid Receipt</h1>
                    <p className="text-gray-600">{error || 'This receipt could not be verified.'}</p>
                    <p className="text-sm text-gray-400 mt-4">Receipt: {receiptNo}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
                {/* Header */}
                <div className="text-center mb-6">
                    <div className="text-6xl mb-4">✅</div>
                    <h1 className="text-2xl font-bold text-green-600">Receipt Verified</h1>
                    <p className="text-gray-500">This is a valid receipt from Alpha Retail</p>
                </div>

                {/* Receipt Details */}
                <div className="bg-gray-50 rounded-xl p-6 space-y-4">
                    <div className="flex justify-between items-center border-b pb-3">
                        <span className="text-gray-500">Receipt No</span>
                        <span className="font-bold text-lg">{sale.receipt_no}</span>
                    </div>

                    <div className="flex justify-between items-center border-b pb-3">
                        <span className="text-gray-500">Date</span>
                        <span className="font-medium">
                            {new Date(sale.sale_datetime).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                        </span>
                    </div>

                    <div className="flex justify-between items-center border-b pb-3">
                        <span className="text-gray-500">Customer</span>
                        <span className="font-medium">{sale.customer_name || 'Walk-in'}</span>
                    </div>

                    <div className="flex justify-between items-center border-b pb-3">
                        <span className="text-gray-500">Payment</span>
                        <span className={`font-medium px-3 py-1 rounded-full text-sm ${sale.payment_method === 'MPESA'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                            {sale.payment_method}
                        </span>
                    </div>

                    {sale.mpesa_code && (
                        <div className="flex justify-between items-center border-b pb-3">
                            <span className="text-gray-500">M-Pesa Code</span>
                            <span className="font-mono font-bold text-green-600">{sale.mpesa_code}</span>
                        </div>
                    )}

                    <div className="flex justify-between items-center pt-2">
                        <span className="text-gray-700 font-medium">Total Amount</span>
                        <span className="text-2xl font-bold text-green-600">
                            Ksh {sale.total_amount.toLocaleString()}
                        </span>
                    </div>
                </div>

                {/* Status Badge */}
                <div className="mt-6 text-center">
                    <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${sale.status === 'Completed'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                        {sale.status === 'Completed' ? '✓' : '⏳'} {sale.status}
                    </span>
                </div>

                {/* Footer */}
                <div className="mt-8 text-center text-xs text-gray-400">
                    <p>Alpha Retail POS</p>
                    <p>Verified at {new Date().toLocaleString()}</p>
                </div>
            </div>
        </div>
    );
}
