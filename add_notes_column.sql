-- Add missing 'notes' column to pharmacy_sales_items for prescription notes
ALTER TABLE pharmacy_sales_items ADD COLUMN IF NOT EXISTS notes text;

-- Add missing 'notes' column to pharmacy_sales for order-level notes  
ALTER TABLE pharmacy_sales ADD COLUMN IF NOT EXISTS notes text;
