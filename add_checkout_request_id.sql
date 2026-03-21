-- Add checkout_request_id column to retail_sales table for M-Pesa STK Push tracking
ALTER TABLE public.retail_sales 
ADD COLUMN IF NOT EXISTS checkout_request_id character varying;

-- Optional: Add an index for faster lookups by checkout_request_id
CREATE INDEX IF NOT EXISTS idx_retail_sales_checkout_request_id 
ON public.retail_sales(checkout_request_id);
