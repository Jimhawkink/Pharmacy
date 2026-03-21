import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// M-Pesa API Endpoints
const MPESA_SANDBOX_URL = "https://sandbox.safaricom.co.ke";
const MPESA_LIVE_URL = "https://api.safaricom.co.ke";

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const url = new URL(req.url);
        const checkoutRequestId = url.searchParams.get("checkout_request_id") || url.searchParams.get("checkoutRequestId");

        if (!checkoutRequestId) {
            return new Response(
                JSON.stringify({ success: false, error: "checkoutRequestId is required" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
            );
        }

        console.log("📊 Checking status for:", checkoutRequestId);

        // First, check our database for the result (from callback)
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
            const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

            const { data: transaction } = await supabase
                .from("mpesa_transactions")
                .select("*")
                .eq("checkout_request_id", checkoutRequestId)
                .single();

            if (transaction && transaction.result_code !== null) {
                console.log("✅ Found result in database:", transaction);
                const receiptNumber = transaction.mpesa_receipt_number || transaction.mpesa_receipt;
                return new Response(
                    JSON.stringify({
                        success: transaction.result_code === 0,
                        // Return both formats for compatibility
                        ResultCode: transaction.result_code,
                        resultCode: transaction.result_code,
                        MpesaReceiptNumber: receiptNumber,
                        mpesaReceiptNumber: receiptNumber,
                        mpesa_receipt_number: receiptNumber,
                        Amount: transaction.amount,
                        status: transaction.status,
                        resultDesc: transaction.result_desc || (transaction.result_code === 0 ? "Success" : "Failed"),
                    }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }
        }

        // If not in database, query M-Pesa API directly
        const CONSUMER_KEY = Deno.env.get("MPESA_CONSUMER_KEY");
        const CONSUMER_SECRET = Deno.env.get("MPESA_CONSUMER_SECRET");
        const SHORTCODE = Deno.env.get("MPESA_SHORTCODE");
        const PASSKEY = Deno.env.get("MPESA_PASSKEY");
        const ENVIRONMENT = Deno.env.get("MPESA_ENVIRONMENT") || "production";

        if (!CONSUMER_KEY || !CONSUMER_SECRET || !SHORTCODE || !PASSKEY) {
            return new Response(
                JSON.stringify({ success: false, error: "M-Pesa credentials not configured" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
            );
        }

        const BASE_URL = ENVIRONMENT === "production" ? MPESA_LIVE_URL : MPESA_SANDBOX_URL;

        // Get access token
        const authString = btoa(`${CONSUMER_KEY}:${CONSUMER_SECRET}`);
        const tokenResponse = await fetch(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
            method: "GET",
            headers: {
                Authorization: `Basic ${authString}`,
            },
        });

        if (!tokenResponse.ok) {
            return new Response(
                JSON.stringify({ success: false, error: "Failed to get access token" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
            );
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        // Generate timestamp and password
        const now = new Date();
        const timestamp = now.getFullYear().toString() +
            String(now.getMonth() + 1).padStart(2, "0") +
            String(now.getDate()).padStart(2, "0") +
            String(now.getHours()).padStart(2, "0") +
            String(now.getMinutes()).padStart(2, "0") +
            String(now.getSeconds()).padStart(2, "0");

        const password = btoa(`${SHORTCODE}${PASSKEY}${timestamp}`);

        // Query STK Push status
        const queryPayload = {
            BusinessShortCode: SHORTCODE,
            Password: password,
            Timestamp: timestamp,
            CheckoutRequestID: checkoutRequestId,
        };

        const queryResponse = await fetch(`${BASE_URL}/mpesa/stkpushquery/v1/query`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(queryPayload),
        });

        const queryData = await queryResponse.json();
        console.log("📊 Query response:", queryData);

        // Parse result
        if (queryData.ResultCode !== undefined) {
            return new Response(
                JSON.stringify({
                    success: queryData.ResultCode === "0" || queryData.ResultCode === 0,
                    ResultCode: parseInt(queryData.ResultCode),
                    ResultDesc: queryData.ResultDesc,
                    MpesaReceiptNumber: queryData.ResultCode === "0" ? null : null, // Receipt comes via callback
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        } else {
            return new Response(
                JSON.stringify({
                    success: false,
                    status: "pending",
                    message: "Transaction still pending",
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }
    } catch (error) {
        console.error("❌ Status check error:", error);
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
    }
});
