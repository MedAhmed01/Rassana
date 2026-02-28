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

  // Save the new mode
  const { error } = await adminClient
    .from('system_settings')
    .upsert(
      { key: 'device_binding_mode', value: mode, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // When switching to 'all', immediately enforce single-session for every student.
  // Keep only the most-recent active session per user; terminate all others.
  let terminatedCount = 0;
  if (mode === 'all') {
    try {
      // Fetch all active sessions ordered by most recent first
      const { data: sessions } = await adminClient
        .from('user_sessions')
        .select('id, user_id, last_seen_at')
        .is('terminated_at', null)
        .order('last_seen_at', { ascending: false });

      if (sessions && sessions.length > 0) {
        // Group by user_id; first occurrence is the most-recent session to keep
        const keepIds = new Set<string>();
        const terminateIds: string[] = [];

        for (const s of sessions) {
          if (!keepIds.has(s.user_id)) {
            keepIds.add(s.user_id);   // keep this one (most recent)
          } else {
            terminateIds.push(s.id);  // terminate all others
          }
        }

        if (terminateIds.length > 0) {
          await adminClient
            .from('user_sessions')
            .update({
              terminated_at: new Date().toISOString(),
              terminated_by: 'system',
            })
            .in('id', terminateIds);
          terminatedCount = terminateIds.length;
        }
      }
    } catch {
      // Non-fatal — user_sessions table may not exist yet
    }
  }

  const labels: Record<string, string> = {
    off: 'Device binding disabled for all users',
    per_user: 'Device binding controlled per user',
    all: 'Device binding enabled for all students',
  };

  return NextResponse.json({
    success: true,
    mode,
    message: labels[mode],
    terminatedCount,
  });
}
