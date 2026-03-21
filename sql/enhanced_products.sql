-- Add pieces_per_package column to retail_products
ALTER TABLE retail_products ADD COLUMN IF NOT EXISTS pieces_per_package integer NOT NULL DEFAULT 1;

-- Create retail_price_history table for tracking price changes
CREATE TABLE IF NOT EXISTS retail_price_history (
    id SERIAL PRIMARY KEY,
    pid integer REFERENCES retail_products(pid) ON DELETE CASCADE,
    product_name varchar,
    old_buy double precision DEFAULT 0,
    new_buy double precision DEFAULT 0,
    old_sell double precision DEFAULT 0,
    new_sell double precision DEFAULT 0,
    changed_at timestamptz DEFAULT now()
);

-- Add notes column to retail_stock for adjustment reasons
ALTER TABLE retail_stock ADD COLUMN IF NOT EXISTS notes varchar;
