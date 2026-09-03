import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateUUID } from '@/lib/uuid';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || '';

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
    const { fullName, email, password, role } = await req.json();

    if (!fullName || !email || !password) {
      return NextResponse.json({ error: { message: 'All fields are required.' } }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: { message: 'Password must be at least 6 characters long.' } }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: { message: 'Server authentication service is unavailable.' } }, { status: 500 });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // 1. Check if user already exists in profiles
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .eq('email', trimmedEmail)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json(
        { error: { message: 'An account with this email address already exists.' } },
        { status: 400 }
      );
    }

    // 2. Create the user in Supabase GoTrue Auth
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: trimmedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName.trim(),
        role: role || 'OPERATOR'
      }
    });

    if (createError) {
      if (
        createError.message.toLowerCase().includes('already') ||
        createError.message.toLowerCase().includes('exists')
      ) {
        return NextResponse.json(
          { error: { message: 'An account with this email address already exists.' } },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: { message: createError.message } }, { status: 400 });
    }

    const newUserId = userData.user.id;

    // 3. Ensure profile is inserted with is_active: false for cross-device visibility
    await supabaseAdmin
      .from('profiles')
      .upsert({
        id: newUserId,
        full_name: fullName.trim(),
        email: trimmedEmail,
        role: role || 'OPERATOR',
        is_active: false,
        assigned_warehouse_ids: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    // 4. Create an admin notification alert
    await supabaseAdmin.from('alerts').insert({
      id: generateUUID(),
      type: 'SYSTEM_ERROR',
      severity: 'WARNING',
      message: `Pending Registration: New user ${fullName.trim()} (${trimmedEmail}) requested ${role} access. Approval required.`,
      is_acknowledged: false
    });

    return NextResponse.json({ success: true, userId: newUserId });
  } catch (err: any) {
    console.error('Error in /api/auth/signup:', err);
    return NextResponse.json(
      { error: { message: err?.message || 'Failed to process registration.' } },
      { status: 500 }
    );
  }
}
