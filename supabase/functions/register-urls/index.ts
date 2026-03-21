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
        // Get M-Pesa credentials from environment
        const CONSUMER_KEY = Deno.env.get("MPESA_CONSUMER_KEY");
        const CONSUMER_SECRET = Deno.env.get("MPESA_CONSUMER_SECRET");
        const SHORTCODE = Deno.env.get("MPESA_SHORTCODE");
        const TILL_NUMBER = Deno.env.get("MPESA_TILL_NUMBER") || SHORTCODE;
        const CALLBACK_URL = Deno.env.get("MPESA_CALLBACK_URL");
        const ENVIRONMENT = Deno.env.get("MPESA_ENVIRONMENT") || "production";

        if (!CONSUMER_KEY || !CONSUMER_SECRET || !SHORTCODE) {
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
            const errText = await tokenResponse.text();
            console.error("Token request failed:", errText);
            return new Response(
                JSON.stringify({ success: false, error: "Failed to get access token", details: errText }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
            );
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        console.log("✅ Access token obtained for URL registration");

        // Parse request body for optional overrides
        let validationURL = `${CALLBACK_URL}`;
        let confirmationURL = `${CALLBACK_URL}`;
        let responseType = "Completed"; // or "Cancelled"

        try {
            const body = await req.json();
            if (body.validationURL) validationURL = body.validationURL;
            if (body.confirmationURL) confirmationURL = body.confirmationURL;
            if (body.responseType) responseType = body.responseType;
        } catch {
            // Use defaults if no body
        }

        // Step 2: Register C2B URLs (Validation & Confirmation)
        console.log("📡 Registering C2B URLs...");
        console.log(`   ShortCode: ${SHORTCODE}`);
        console.log(`   ValidationURL: ${validationURL}`);
        console.log(`   ConfirmationURL: ${confirmationURL}`);

        const registerPayload = {
            ShortCode: SHORTCODE,
            ResponseType: responseType,
            ConfirmationURL: confirmationURL,
            ValidationURL: validationURL,
        };

        const registerResponse = await fetch(`${BASE_URL}/mpesa/c2b/v1/registerurl`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(registerPayload),
        });

        const registerData = await registerResponse.json();
        console.log("📡 Register URL response:", registerData);

        // Return comprehensive result
        const result = {
            success: true,
            message: "M-Pesa URL Registration Complete",
            environment: ENVIRONMENT,
            credentials: {
                shortcode: SHORTCODE,
                till_number: TILL_NUMBER,
                callback_url: CALLBACK_URL,
            },
            stk_push: {
                status: "✅ Configured",
                note: "STK Push callback URL is sent with each request automatically",
                callback_url: CALLBACK_URL,
                endpoint: "stkpush",
            },
            c2b_registration: {
                response: registerData,
                validation_url: validationURL,
                confirmation_url: confirmationURL,
            },
            oauth: {
                status: "✅ Token generated successfully",
                token_type: tokenData.token_type,
                expires_in: tokenData.expires_in,
            },
        };

        return new Response(
            JSON.stringify(result, null, 2),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("❌ Registration error:", error);
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
    }
});
