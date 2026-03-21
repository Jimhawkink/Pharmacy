import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
        const { phone, amount, accountReference, transactionDesc } = await req.json();

        console.log("📱 STK Push request:", { phone, amount, accountReference });

        // Get M-Pesa credentials from environment
        const CONSUMER_KEY = Deno.env.get("MPESA_CONSUMER_KEY");
        const CONSUMER_SECRET = Deno.env.get("MPESA_CONSUMER_SECRET");
        const SHORTCODE = Deno.env.get("MPESA_SHORTCODE");
        const PASSKEY = Deno.env.get("MPESA_PASSKEY");
        const CALLBACK_URL = Deno.env.get("MPESA_CALLBACK_URL");
        const ENVIRONMENT = Deno.env.get("MPESA_ENVIRONMENT") || "production";

        if (!CONSUMER_KEY || !CONSUMER_SECRET || !SHORTCODE || !PASSKEY) {
            console.error("Missing M-Pesa credentials");
            return new Response(
                JSON.stringify({ success: false, error: "M-Pesa credentials not configured" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
            );
        }

        const BASE_URL = ENVIRONMENT === "production" ? MPESA_LIVE_URL : MPESA_SANDBOX_URL;

        // Step 1: Get access token
        const authString = btoa(`${CONSUMER_KEY}:${CONSUMER_SECRET}`);
        const tokenResponse = await fetch(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
            method: "GET",
            headers: {
                Authorization: `Basic ${authString}`,
            },
        });

        if (!tokenResponse.ok) {
            console.error("Token request failed:", await tokenResponse.text());
            return new Response(
                JSON.stringify({ success: false, error: "Failed to get access token" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
            );
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        console.log("✅ Access token obtained");

        // Step 2: Generate timestamp and password
        const now = new Date();
        const timestamp = now.getFullYear().toString() +
            String(now.getMonth() + 1).padStart(2, "0") +
            String(now.getDate()).padStart(2, "0") +
            String(now.getHours()).padStart(2, "0") +
            String(now.getMinutes()).padStart(2, "0") +
            String(now.getSeconds()).padStart(2, "0");

        const password = btoa(`${SHORTCODE}${PASSKEY}${timestamp}`);

        // Get Till Number (for Buy Goods) - defaults to shortcode if not set
        const TILL_NUMBER = Deno.env.get("MPESA_TILL_NUMBER") || SHORTCODE;

        // Step 3: Initiate STK Push (Buy Goods / Till)
        const stkPayload = {
            BusinessShortCode: SHORTCODE,
            Password: password,
            Timestamp: timestamp,
            TransactionType: "CustomerBuyGoodsOnline",  // For Till numbers
            Amount: Math.ceil(amount),
            PartyA: phone,
            PartyB: TILL_NUMBER,  // Till number for Buy Goods
            PhoneNumber: phone,
            CallBackURL: CALLBACK_URL || `${BASE_URL}/callback`,
            AccountReference: accountReference || "Payment",
            TransactionDesc: transactionDesc || "Payment",
        };

        console.log("📤 Sending STK Push with CallBackURL:", CALLBACK_URL);

        const stkResponse = await fetch(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(stkPayload),
        });

        const stkData = await stkResponse.json();
        console.log("📱 STK Push response:", stkData);

        if (stkData.ResponseCode === "0") {
            return new Response(
                JSON.stringify({
                    success: true,
                    message: "STK Push sent successfully",
                    CheckoutRequestID: stkData.CheckoutRequestID,
                    checkout_request_id: stkData.CheckoutRequestID, // Also return underscore version
                    MerchantRequestID: stkData.MerchantRequestID,
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        } else {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: stkData.errorMessage || stkData.ResponseDescription || "STK Push failed",
                    details: stkData,
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
            );
        }
    } catch (error) {
        console.error("❌ STK Push error:", error);
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
    }
});
