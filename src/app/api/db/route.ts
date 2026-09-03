import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabaseAdmin = (supabaseUrl && serviceRoleKey)
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    })
  : null;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, table, payload, match } = body;

    if (!table) {
      return NextResponse.json({ error: { message: 'Table name is required' } }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: { message: 'Supabase admin client is not configured' } }, { status: 500 });
    }

    if (action === 'insert') {
      const { data, error } = await supabaseAdmin.from(table).insert(payload).select();
      if (error) {
        console.error(`[API /api/db] Insert error on ${table}:`, error);
        return NextResponse.json({ data: null, error: { message: error.message, code: error.code } });
      }
      return NextResponse.json({ data, error: null });
    }

    if (action === 'update') {
      let query = supabaseAdmin.from(table).update(payload);
      if (match && typeof match === 'object') {
        Object.entries(match).forEach(([col, val]) => {
          query = query.eq(col, val);
        });
      }
      const { data, error } = await query.select();
      if (error) {
        console.error(`[API /api/db] Update error on ${table}:`, error);
        return NextResponse.json({ data: null, error: { message: error.message, code: error.code } });
      }
      return NextResponse.json({ data, error: null });
    }

    if (action === 'delete') {
      let query = supabaseAdmin.from(table).delete();
      if (match && typeof match === 'object') {
        Object.entries(match).forEach(([col, val]) => {
          query = query.eq(col, val);
        });
      }
      const { data, error } = await query;
      if (error) {
        console.error(`[API /api/db] Delete error on ${table}:`, error);
        return NextResponse.json({ data: null, error: { message: error.message, code: error.code } });
      }
      return NextResponse.json({ data, error: null });
    }

    if (action === 'select') {
      let query = supabaseAdmin.from(table).select();
      if (match && typeof match === 'object') {
        Object.entries(match).forEach(([col, val]) => {
          query = query.eq(col, val);
        });
      }
      const { data, error } = await query;
      if (error) {
        console.error(`[API /api/db] Select error on ${table}:`, error);
        return NextResponse.json({ data: null, error: { message: error.message, code: error.code } });
      }
      return NextResponse.json({ data, error: null });
    }

    return NextResponse.json({ error: { message: `Unsupported action: ${action}` } }, { status: 400 });
  } catch (err: any) {
    console.error('[API /api/db] Exception:', err);
    return NextResponse.json({ error: { message: err?.message || 'Server database error' } }, { status: 500 });
  }
}
