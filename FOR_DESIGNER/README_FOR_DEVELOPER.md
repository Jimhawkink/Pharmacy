# Alpha Pharmacy POS — Developer & Designer Reference

This folder contains the complete actual source code for Alpha Pharmacy POS.

## Included Files:
1. `1_pos_page.tsx` — The live POS page (`src/app/dashboard/pos/page.tsx`).
   - Contains all state: `products`, `cart`, `displayProducts`, `activeShift`, `heldSales`, search, categories.
   - Contains all modals: FEFO Batch Picker, Checkout / Payment Modal (Cash, M-Pesa STK Push, Card, Split), Register Opening/Closing drawers, Held sales parking, Keyboard shortcuts.
2. `2_medicineVisual.tsx` — Realistic 3D SVG packaging visuals (`src/lib/medicineVisual.tsx`).
3. `3_supabase_client.ts` — Database queries & functions (`src/lib/supabase.ts`).
   - Tables used: `pharmacy_products`, `pharmacy_stock`, `pharmacy_batches`, `pharmacy_sales`, `pharmacy_sales_items`, `pharmacy_shift_instances`, `pharmacy_credit_customers`.
4. `4_receiptPrinter.ts` — 80mm/58mm thermal receipt printing generator (`src/lib/receiptPrinter.ts`).
5. `5_dashboard_layout.tsx` — Global Dashboard Shell (`src/app/dashboard/layout.tsx`).
   - Renders the Left Sidebar (logo, collapsible navigation, compliance badge, user footer).
   - Renders the Top Floating Header Bar (Good morning greeting, global search, online status, date & time pill, user avatar).
   - **Crucial:** The POS page is rendered inside this layout as `{children}`. Therefore, the POS component should NOT render another outer sidebar or top header, or it will create duplicates.

## Critical Layout Guidelines:
- **Dispensing Cart Position:** Please ensure the dispensing cart sidebar is visible on standard laptop displays (1366px - 1440px) using `xl:grid-cols-[minmax(0,1fr)_380px]` or a fixed-width sticky sidebar (`w-[380px]` to `w-[410px]`), rather than `2xl:grid-cols`, so it doesn't drop beneath the catalog fold on regular screens.
- **Product Card Dimensions:** Responsive grid (`grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`) with card height ~210-230px.
