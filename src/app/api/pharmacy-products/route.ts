import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zkamuhvrmazozhudbtuw.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprYW11aHZybWF6b3podWRidHV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDI0MTc5NiwiZXhwIjoyMDk5ODE3Nzk2fQ.1TiRblZHKNcNAJd4j5Oh_xl38Qo0TuaaROIP8iDVpYw';

// Admin client that bypasses RLS
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const outletId = searchParams.get('outlet_id') ? Number(searchParams.get('outlet_id')) : 1;
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    let query = supabaseAdmin
      .from('pharmacy_products')
      .select('*')
      .order('pid', { ascending: true });

    if (category && category !== 'All' && category !== 'All Categories') {
      query = query.eq('category', category);
    }

    if (search && search.trim() !== '') {
      const s = search.trim();
      query = query.or(`product_name.ilike.%${s}%,generic_name.ilike.%${s}%,barcode.ilike.%${s}%,product_code.ilike.%${s}%`);
    }

    const { data: products, error } = await query;
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Also fetch active batches for stock calculations
    const { data: batches } = await supabaseAdmin
      .from('pharmacy_batches')
      .select('*')
      .order('expiry_date', { ascending: true });

    return NextResponse.json({
      success: true,
      count: products ? products.length : 0,
      products: products || [],
      batches: batches || [],
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Determine next pid if not provided
    if (!body.pid) {
      const { data: maxRow } = await supabaseAdmin
        .from('pharmacy_products')
        .select('pid')
        .order('pid', { ascending: false })
        .limit(1)
        .single();
      body.pid = (maxRow?.pid || 0) + 1;
    }

    // Default outlet_id
    if (!body.outlet_id) body.outlet_id = 1;
    if (body.active === undefined) body.active = true;

    const { data: product, error } = await supabaseAdmin
      .from('pharmacy_products')
      .insert([body])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, product });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { pid, ...updateData } = body;

    if (!pid) {
      return NextResponse.json({ success: false, error: 'Product ID (pid) is required for update' }, { status: 400 });
    }

    updateData.updated_at = new Date().toISOString();

    const { data: product, error } = await supabaseAdmin
      .from('pharmacy_products')
      .update(updateData)
      .eq('pid', pid)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, product });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pid = searchParams.get('pid');

    if (!pid) {
      return NextResponse.json({ success: false, error: 'Product ID (pid) is required for deletion' }, { status: 400 });
    }

    // Soft delete or hard delete
    const { error } = await supabaseAdmin
      .from('pharmacy_products')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('pid', Number(pid));

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Product archived successfully' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
