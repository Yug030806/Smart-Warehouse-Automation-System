import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateUUID } from '@/lib/uuid';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = (supabaseUrl && serviceRoleKey)
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;

export async function POST(req: NextRequest) {
  try {
    const { userId, updates, adminEmail } = await req.json();

    if (!userId || !updates) {
      return NextResponse.json({ error: { message: 'User ID and updates payload are required' } }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: { message: 'Server database client is not configured' } }, { status: 500 });
    }

    // 1. Update public.profiles
    const profilePayload: any = {
      ...updates,
      updated_at: new Date().toISOString()
    };

    const { data: updatedProfile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .update(profilePayload)
      .eq('id', userId)
      .select()
      .single();

    if (profileErr) {
      console.error('[API /api/users/update] Profile update error:', profileErr);
      return NextResponse.json({ error: { message: profileErr.message } }, { status: 400 });
    }

    // 2. Sync to Supabase GoTrue Auth metadata
    try {
      const authUpdates: any = {};
      if (updates.is_active !== undefined) authUpdates.is_active = updates.is_active;
      if (updates.role) authUpdates.role = updates.role;
      if (updates.full_name) authUpdates.full_name = updates.full_name;

      await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: authUpdates
      });
    } catch (authErr: any) {
      console.warn('[API /api/users/update] Auth update warning:', authErr?.message);
    }

    // 3. If approving user, acknowledge pending registration alert
    if (updates.is_active === true) {
      try {
        await supabaseAdmin
          .from('alerts')
          .update({ is_acknowledged: true, resolved_at: new Date().toISOString() })
          .ilike('message', `%${updatedProfile.email}%`)
          .eq('is_acknowledged', false);
      } catch (alertErr) {
        console.warn('Could not auto-acknowledge signup alert:', alertErr);
      }
    }

    // 4. Record audit log entry
    try {
      await supabaseAdmin.from('audit_logs').insert({
        id: generateUUID(),
        user_email: adminEmail || 'admin@demo.com',
        action: updates.is_active !== undefined ? (updates.is_active ? 'USER_APPROVED' : 'USER_DEACTIVATED') : 'USER_UPDATED',
        object_type: 'USER',
        object_id: userId,
        new_state: profilePayload,
        timestamp: new Date().toISOString()
      });
    } catch (auditErr) {
      console.warn('Audit log insert warning:', auditErr);
    }

    return NextResponse.json({ success: true, profile: updatedProfile });
  } catch (err: any) {
    console.error('Error in /api/users/update:', err);
    return NextResponse.json({ error: { message: err?.message || 'Failed to update user' } }, { status: 500 });
  }
}
