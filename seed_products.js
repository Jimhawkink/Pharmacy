// Seed 50 pharmacy products with 2 batches each
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://enlqpifpxuecxxozyiak.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVubHFwaWZweHVlY3h4b3p5aWFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwMjUzNjgsImV4cCI6MjA4MTYwMTM2OH0.-z3-2Mf3SkkZR3ZryOGyG-60jWERX9YLKIee048OziE'
);

const OUTLET_ID = 1;

// 50 realistic pharmacy products across different categories
const products = [
    // ── Tablets & Capsules (Box → Piece) ──
    { name: 'Paracetamol 500mg', category: 'Tablets & Capsules', pu: 'Box', su: 'Piece', ppp: 100, buy: 150, sell: 5, ws: 4, generic: 'Paracetamol', manufacturer: 'GSK' },
    { name: 'Amoxicillin 500mg', category: 'Tablets & Capsules', pu: 'Box', su: 'Piece', ppp: 100, buy: 350, sell: 10, ws: 8, generic: 'Amoxicillin', manufacturer: 'Sandoz' },
    { name: 'Metformin 500mg', category: 'Tablets & Capsules', pu: 'Box', su: 'Piece', ppp: 100, buy: 280, sell: 8, ws: 6, generic: 'Metformin', manufacturer: 'Merck' },
    { name: 'Ibuprofen 400mg', category: 'Tablets & Capsules', pu: 'Box', su: 'Piece', ppp: 100, buy: 200, sell: 5, ws: 4, generic: 'Ibuprofen', manufacturer: 'Pfizer' },
    { name: 'Ciprofloxacin 500mg', category: 'Tablets & Capsules', pu: 'Box', su: 'Piece', ppp: 100, buy: 450, sell: 15, ws: 12, generic: 'Ciprofloxacin', manufacturer: 'Bayer' },
    { name: 'Omeprazole 20mg', category: 'Tablets & Capsules', pu: 'Box', su: 'Piece', ppp: 30, buy: 180, sell: 15, ws: 12, generic: 'Omeprazole', manufacturer: 'AstraZeneca' },
    { name: 'Diclofenac 50mg', category: 'Tablets & Capsules', pu: 'Box', su: 'Piece', ppp: 100, buy: 160, sell: 5, ws: 4, generic: 'Diclofenac', manufacturer: 'Novartis' },
    { name: 'Cetirizine 10mg', category: 'Tablets & Capsules', pu: 'Box', su: 'Piece', ppp: 100, buy: 120, sell: 5, ws: 3, generic: 'Cetirizine', manufacturer: 'UCB' },
    { name: 'Azithromycin 250mg', category: 'Tablets & Capsules', pu: 'Box', su: 'Piece', ppp: 30, buy: 300, sell: 25, ws: 20, generic: 'Azithromycin', manufacturer: 'Pfizer' },
    { name: 'Losartan 50mg', category: 'Tablets & Capsules', pu: 'Box', su: 'Piece', ppp: 30, buy: 250, sell: 20, ws: 15, generic: 'Losartan', manufacturer: 'Merck' },

    // ── Syrups & Suspensions (Bottle → Bottle) ──
    { name: 'Cough Syrup 100ml', category: 'Syrups & Suspensions', pu: 'Bottle', su: 'Bottle', ppp: 1, buy: 120, sell: 200, ws: 180, generic: 'Dextromethorphan', manufacturer: 'Reckitt' },
    { name: 'Amoxicillin Suspension 100ml', category: 'Syrups & Suspensions', pu: 'Bottle', su: 'Bottle', ppp: 1, buy: 180, sell: 300, ws: 250, generic: 'Amoxicillin', manufacturer: 'GSK' },
    { name: 'Paracetamol Syrup 60ml', category: 'Syrups & Suspensions', pu: 'Bottle', su: 'Bottle', ppp: 1, buy: 80, sell: 150, ws: 120, generic: 'Paracetamol', manufacturer: 'GSK' },
    { name: 'Gripe Water 150ml', category: 'Syrups & Suspensions', pu: 'Bottle', su: 'Bottle', ppp: 1, buy: 100, sell: 180, ws: 150, generic: 'Sodium Bicarbonate', manufacturer: 'Woodwards' },
    { name: 'Iron Syrup 200ml', category: 'Syrups & Suspensions', pu: 'Bottle', su: 'Bottle', ppp: 1, buy: 150, sell: 280, ws: 240, generic: 'Ferrous Sulphate', manufacturer: 'Ranbaxy' },
    { name: 'Multivitamin Syrup 100ml', category: 'Syrups & Suspensions', pu: 'Bottle', su: 'Bottle', ppp: 1, buy: 200, sell: 350, ws: 300, generic: 'Multivitamins', manufacturer: 'Roche' },

    // ── Injectables (Box → Piece) ──
    { name: 'Diclofenac Injection 75mg', category: 'Injectables', pu: 'Box', su: 'Piece', ppp: 5, buy: 250, sell: 80, ws: 65, generic: 'Diclofenac', manufacturer: 'Novartis' },
    { name: 'Gentamicin Injection 80mg', category: 'Injectables', pu: 'Box', su: 'Piece', ppp: 10, buy: 400, sell: 60, ws: 50, generic: 'Gentamicin', manufacturer: 'Cipla' },
    { name: 'Dexamethasone Injection 8mg', category: 'Injectables', pu: 'Box', su: 'Piece', ppp: 10, buy: 350, sell: 50, ws: 40, generic: 'Dexamethasone', manufacturer: 'Merck' },
    { name: 'Ceftriaxone IV 1g', category: 'Injectables', pu: 'Box', su: 'Piece', ppp: 10, buy: 1200, sell: 180, ws: 150, generic: 'Ceftriaxone', manufacturer: 'Roche' },

    // ── Topical Creams & Ointments (Carton → Piece) ──
    { name: 'Betadine Ointment 30g', category: 'Topical & Creams', pu: 'Carton', su: 'Piece', ppp: 12, buy: 1200, sell: 150, ws: 120, generic: 'Povidone-Iodine', manufacturer: 'Purdue' },
    { name: 'Clotrimazole Cream 20g', category: 'Topical & Creams', pu: 'Carton', su: 'Piece', ppp: 12, buy: 600, sell: 80, ws: 65, generic: 'Clotrimazole', manufacturer: 'Bayer' },
    { name: 'Hydrocortisone Cream 15g', category: 'Topical & Creams', pu: 'Carton', su: 'Piece', ppp: 12, buy: 960, sell: 120, ws: 100, generic: 'Hydrocortisone', manufacturer: 'Pfizer' },
    { name: 'Calamine Lotion 100ml', category: 'Topical & Creams', pu: 'Carton', su: 'Piece', ppp: 12, buy: 720, sell: 100, ws: 80, generic: 'Calamine', manufacturer: 'J&J' },
    { name: 'Antifungal Powder 50g', category: 'Topical & Creams', pu: 'Carton', su: 'Piece', ppp: 24, buy: 1440, sell: 100, ws: 80, generic: 'Miconazole', manufacturer: 'J&J' },

    // ── Eye/Ear Drops (Box → Piece) ──
    { name: 'Chloramphenicol Eye Drops 10ml', category: 'Eye & Ear Drops', pu: 'Box', su: 'Piece', ppp: 10, buy: 500, sell: 80, ws: 65, generic: 'Chloramphenicol', manufacturer: 'Allergan' },
    { name: 'Ciprofloxacin Eye Drops 5ml', category: 'Eye & Ear Drops', pu: 'Box', su: 'Piece', ppp: 10, buy: 600, sell: 100, ws: 80, generic: 'Ciprofloxacin', manufacturer: 'Alcon' },
    { name: 'Artificial Tears 15ml', category: 'Eye & Ear Drops', pu: 'Box', su: 'Piece', ppp: 10, buy: 800, sell: 120, ws: 100, generic: 'Carboxymethylcellulose', manufacturer: 'Allergan' },

    // ── Medical Supplies (Bag → Piece) ──
    { name: 'Surgical Gloves (Medium)', category: 'Medical Supplies', pu: 'Bag', su: 'Piece', ppp: 100, buy: 500, sell: 10, ws: 8, generic: null, manufacturer: 'Supermax' },
    { name: 'Disposable Syringes 5ml', category: 'Medical Supplies', pu: 'Bag', su: 'Piece', ppp: 100, buy: 600, sell: 12, ws: 10, generic: null, manufacturer: 'BD' },
    { name: 'Cotton Wool 500g', category: 'Medical Supplies', pu: 'Bag', su: 'Bag', ppp: 1, buy: 200, sell: 350, ws: 300, generic: null, manufacturer: 'Johnson' },
    { name: 'Gauze Bandage 4"x4m', category: 'Medical Supplies', pu: 'Carton', su: 'Piece', ppp: 50, buy: 1500, sell: 50, ws: 40, generic: null, manufacturer: 'BSN Medical' },
    { name: 'Surgical Face Masks', category: 'Medical Supplies', pu: 'Bag', su: 'Piece', ppp: 50, buy: 250, sell: 10, ws: 8, generic: null, manufacturer: '3M' },
    { name: 'Hand Sanitizer 500ml', category: 'Medical Supplies', pu: 'Carton', su: 'Piece', ppp: 12, buy: 1800, sell: 200, ws: 180, generic: 'Ethanol 70%', manufacturer: 'Dettol' },

    // ── Baby & Child Care (Carton → Piece) ──
    { name: 'Baby Diapers Size 3 (50pk)', category: 'Baby & Child Care', pu: 'Carton', su: 'Piece', ppp: 4, buy: 2800, sell: 850, ws: 780, generic: null, manufacturer: 'Pampers' },
    { name: 'Baby Lotion 200ml', category: 'Baby & Child Care', pu: 'Carton', su: 'Piece', ppp: 12, buy: 2400, sell: 280, ws: 250, generic: null, manufacturer: 'Johnson Baby' },
    { name: 'Zinc Cream for Babies 50g', category: 'Baby & Child Care', pu: 'Carton', su: 'Piece', ppp: 12, buy: 1440, sell: 180, ws: 150, generic: 'Zinc Oxide', manufacturer: 'Sudocrem' },

    // ── Vitamins & Supplements (Box → Piece) ──
    { name: 'Vitamin C 1000mg', category: 'Vitamins & Supplements', pu: 'Box', su: 'Piece', ppp: 30, buy: 350, sell: 20, ws: 15, generic: 'Ascorbic Acid', manufacturer: 'Nature Made' },
    { name: 'Vitamin D3 2000IU', category: 'Vitamins & Supplements', pu: 'Box', su: 'Piece', ppp: 60, buy: 600, sell: 18, ws: 15, generic: 'Cholecalciferol', manufacturer: 'NOW Foods' },
    { name: 'Calcium + D3 Tablets', category: 'Vitamins & Supplements', pu: 'Box', su: 'Piece', ppp: 60, buy: 450, sell: 15, ws: 12, generic: 'Calcium Carbonate', manufacturer: 'Caltrate' },
    { name: 'Omega-3 Fish Oil 1000mg', category: 'Vitamins & Supplements', pu: 'Box', su: 'Piece', ppp: 30, buy: 500, sell: 30, ws: 25, generic: 'EPA/DHA', manufacturer: 'Nordic Naturals' },
    { name: 'Folic Acid 5mg', category: 'Vitamins & Supplements', pu: 'Box', su: 'Piece', ppp: 100, buy: 180, sell: 5, ws: 4, generic: 'Folic Acid', manufacturer: 'Nature Made' },

    // ── Liquids (Liter → Liter or Bottle) ──
    { name: 'Normal Saline 1L', category: 'IV Fluids', pu: 'Carton', su: 'Piece', ppp: 12, buy: 2400, sell: 300, ws: 250, generic: 'NaCl 0.9%', manufacturer: 'Baxter' },
    { name: 'Dextrose 5% 500ml', category: 'IV Fluids', pu: 'Carton', su: 'Piece', ppp: 12, buy: 1800, sell: 220, ws: 180, generic: 'Dextrose', manufacturer: 'Baxter' },
    { name: 'Ringers Lactate 1L', category: 'IV Fluids', pu: 'Carton', su: 'Piece', ppp: 12, buy: 2640, sell: 320, ws: 280, generic: 'Ringer Lactate', manufacturer: 'Fresenius' },

    // ── Respiratory (Box → Piece) ──
    { name: 'Salbutamol Inhaler 200D', category: 'Respiratory', pu: 'Box', su: 'Piece', ppp: 1, buy: 350, sell: 500, ws: 450, generic: 'Salbutamol', manufacturer: 'GSK' },
    { name: 'Prednisolone 5mg', category: 'Respiratory', pu: 'Box', su: 'Piece', ppp: 100, buy: 200, sell: 5, ws: 4, generic: 'Prednisolone', manufacturer: 'Pfizer' },

    // ── Antiseptics & Disinfectants ──
    { name: 'Dettol Liquid 500ml', category: 'Antiseptics', pu: 'Carton', su: 'Piece', ppp: 12, buy: 3600, sell: 400, ws: 350, generic: 'Chloroxylenol', manufacturer: 'Reckitt' },
    { name: 'Hydrogen Peroxide 500ml', category: 'Antiseptics', pu: 'Carton', su: 'Piece', ppp: 12, buy: 1200, sell: 150, ws: 120, generic: 'H2O2 3%', manufacturer: 'Merck' },
    { name: 'Methylated Spirit 1L', category: 'Antiseptics', pu: 'Carton', su: 'Piece', ppp: 6, buy: 1800, sell: 400, ws: 350, generic: 'Denatured Ethanol', manufacturer: 'Local' },
];

// Generate batches with different expiry dates
function randomDate(startMonths, endMonths) {
    const now = new Date();
    const start = new Date(now);
    start.setMonth(start.getMonth() + startMonths);
    const end = new Date(now);
    end.setMonth(end.getMonth() + endMonths);
    const d = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
    return d.toISOString().split('T')[0];
}
function mfgDate(monthsAgo) {
    const d = new Date();
    d.setMonth(d.getMonth() - monthsAgo);
    return d.toISOString().split('T')[0];
}

async function seed() {
    console.log('🌱 Starting seed: 50 products with 2 batches each...\n');
    let successCount = 0;
    let batchCount = 0;

    for (let i = 0; i < products.length; i++) {
        const p = products[i];
        const costPerPiece = p.buy / p.ppp;
        const margin = p.sell > 0 ? Math.round(((p.sell - costPerPiece) / p.sell) * 10000) / 100 : 0;
        const barcode = `1${String(100 + i).padStart(4, '0')}${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}0`;
        const code = `PH-${String(i + 1).padStart(4, '0')}`;

        // Insert product
        const { data: prod, error: prodErr } = await supabase.from('pharmacy_products').insert({
            product_name: p.name,
            product_code: code,
            barcode: barcode,
            category: p.category,
            purchase_unit: p.pu,
            sales_unit: p.su,
            purchase_cost: p.buy,
            sales_cost: p.sell,
            wholesale_price: p.ws,
            pieces_per_package: p.ppp,
            margin_per: margin,
            reorder_point: 10,
            active: true,
            show_in_pos: true,
            outlet_id: OUTLET_ID,
            generic_name: p.generic || null,
            manufacturer: p.manufacturer || null,
            created_at: new Date().toISOString(),
        }).select('pid').single();

        if (prodErr) {
            console.log(`  ❌ ${p.name}: ${prodErr.message}`);
            continue;
        }

        const pid = prod.pid;
        successCount++;

        // Create 2 batches with different expiry dates
        const batchQty1 = Math.floor(Math.random() * 50) + 20; // 20-70 units
        const batchQty2 = Math.floor(Math.random() * 40) + 10; // 10-50 units
        const totalStock = (batchQty1 + batchQty2) * (p.pu !== p.su && p.ppp > 1 ? 1 : 1);

        const batch1 = {
            product_id: pid,
            batch_number: `BN${String(i * 2 + 1).padStart(4, '0')}`,
            expiry_date: randomDate(3, 18),   // expires 3-18 months from now
            manufacture_date: mfgDate(Math.floor(Math.random() * 12) + 6), // made 6-18 months ago
            quantity: batchQty1,
            remaining_qty: batchQty1,
            purchase_cost: p.buy,
            selling_price: p.sell,
            outlet_id: OUTLET_ID,
            status: 'Active',
        };
        const batch2 = {
            product_id: pid,
            batch_number: `BN${String(i * 2 + 2).padStart(4, '0')}`,
            expiry_date: randomDate(6, 24),   // expires 6-24 months from now
            manufacture_date: mfgDate(Math.floor(Math.random() * 6) + 1), // made 1-6 months ago
            quantity: batchQty2,
            remaining_qty: batchQty2,
            purchase_cost: p.buy,
            selling_price: p.sell,
            outlet_id: OUTLET_ID,
            status: 'Active',
        };

        const { error: b1Err } = await supabase.from('pharmacy_batches').insert(batch1);
        const { error: b2Err } = await supabase.from('pharmacy_batches').insert(batch2);

        if (!b1Err) batchCount++;
        if (!b2Err) batchCount++;

        // Create stock record
        await supabase.from('pharmacy_stock').insert({
            pid: pid,
            invoice_no: 'SEED',
            qty: batchQty1 + batchQty2,
            storage_type: 'Store',
            outlet_id: OUTLET_ID,
        });

        const em = p.pu !== p.su ? `(${p.pu}→${p.su}, ${p.ppp}pcs)` : `(${p.pu})`;
        console.log(`  ✅ ${String(i+1).padStart(2)}. ${p.name.padEnd(35)} ${em.padEnd(22)} Buy:${String(p.buy).padStart(5)} Sell:${String(p.sell).padStart(5)} Margin:${String(margin.toFixed(1)).padStart(6)}%`);
    }

    console.log(`\n🎉 Done! Inserted ${successCount} products with ${batchCount} batches.`);
    console.log(`   Stock records created for each product.`);
}

seed().catch(err => { console.error('Fatal error:', err); process.exit(1); });
