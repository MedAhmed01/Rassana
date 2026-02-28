import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/middleware/auth';
import { createAdminClient } from '@/lib/supabase';

// GET /api/admin/settings/device-binding — get current global mode
export async function GET() {
  const auth = await checkAdminAuth();
  if (auth.error) return auth.error;

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from('system_settings')
    .select('value')
    .eq('key', 'device_binding_mode')
    .single();

  if (error) {
    // Return default if settings table doesn't exist yet
    return NextResponse.json({ mode: 'per_user' });
  }

  return NextResponse.json({ mode: (data?.value as string) || 'per_user' });
}

// POST /api/admin/settings/device-binding — update global mode
export async function POST(request: NextRequest) {
  const auth = await checkAdminAuth();
  if (auth.error) return auth.error;

  const body = await request.json();
  const { mode } = body;

  if (!['off', 'per_user', 'all'].includes(mode)) {
    return NextResponse.json(
      { error: 'mode must be one of: off, per_user, all' },
      { status: 400 }
    );
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from('system_settings')
    .upsert(
      { key: 'device_binding_mode', value: mode, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const labels: Record<string, string> = {
    off: 'Device binding disabled for all users',
    per_user: 'Device binding controlled per user',
    all: 'Device binding enabled for all students',
  };

  return NextResponse.json({ success: true, mode, message: labels[mode] });
}
