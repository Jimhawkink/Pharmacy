import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        // Parse the callback data from Safaricom
        const callbackData = await req.json();
        console.log("📥 M-Pesa Callback received:", JSON.stringify(callbackData, null, 2));

        // Extract the STK callback data
        const stkCallback = callbackData.Body?.stkCallback;
        if (!stkCallback) {
            console.error("❌ Invalid callback format - no stkCallback");
            return new Response(
                JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const {
            MerchantRequestID,
            CheckoutRequestID,
            ResultCode,
            ResultDesc
        } = stkCallback;

        console.log(`📊 Processing: CheckoutRequestID=${CheckoutRequestID}, ResultCode=${ResultCode}`);

        // Extract callback metadata if payment was successful
        let mpesaReceiptNumber = null;
        let amount = null;
        let phoneNumber = null;
        let transactionDate = null;

        if (ResultCode === 0 && stkCallback.CallbackMetadata?.Item) {
            const items = stkCallback.CallbackMetadata.Item;
            for (const item of items) {
                switch (item.Name) {
                    case "MpesaReceiptNumber":
                        mpesaReceiptNumber = item.Value;
                        break;
                    case "Amount":
                        amount = item.Value;
                        break;
                    case "PhoneNumber":
                        phoneNumber = item.Value;
                        break;
                    case "TransactionDate":
                        transactionDate = item.Value;
                        break;
                }
            }
        }

        console.log(`✅ Extracted: MpesaReceiptNumber=${mpesaReceiptNumber}, Amount=${amount}`);

        // Update the transaction in the database
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
            const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

            // Update the mpesa_transactions table
            const { error } = await supabase
                .from("mpesa_transactions")
                .update({
                    result_code: ResultCode,
                    result_desc: ResultDesc,
                    mpesa_receipt_number: mpesaReceiptNumber,
                    transaction_date: transactionDate ? new Date(transactionDate.toString().replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, "$1-$2-$3T$4:$5:$6")).toISOString() : null,
                    status: ResultCode === 0 ? "Completed" : "Failed",
                    updated_at: new Date().toISOString()
                })
                .eq("checkout_request_id", CheckoutRequestID);

            if (error) {
                console.error("❌ Database update error:", error);
            } else {
                console.log("✅ Database updated successfully");
            }
        }

        // Always respond with success to Safaricom (they will retry if we don't)
        return new Response(
            JSON.stringify({ ResultCode: 0, ResultDesc: "Callback received successfully" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("❌ Callback processing error:", error);
        // Still return success to Safaricom to prevent retries
        return new Response(
            JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
