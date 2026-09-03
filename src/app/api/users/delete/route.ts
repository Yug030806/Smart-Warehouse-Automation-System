import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = (supabaseUrl && serviceRoleKey)
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: { message: 'User ID is required' } }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: { message: 'Server database client is not configured' } }, { status: 500 });
    }

    // 1. Unlink any boxes, tasks, or scans created by this user
    await supabaseAdmin.from('boxes').update({ created_by: null }).eq('created_by', userId);
    await supabaseAdmin.from('tasks').update({ created_by: null }).eq('created_by', userId);
    await supabaseAdmin.from('scan_events').update({ scanned_by: null }).eq('scanned_by', userId);

    // 2. Delete user from auth.users (if present)
    try {
      await supabaseAdmin.auth.admin.deleteUser(userId);
    } catch (authErr: any) {
      console.warn('Could not delete from auth.users:', authErr?.message);
    }

    // 3. Delete user from public.profiles
    const { error: profileErr } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (profileErr) {
      return NextResponse.json({ error: { message: profileErr.message } }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error in /api/users/delete:', err);
    return NextResponse.json({ error: { message: err?.message || 'Failed to delete user' } }, { status: 500 });
  }
}
