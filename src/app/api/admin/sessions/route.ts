import { NextResponse } from 'next/server';
import { checkAdminAuth } from '@/middleware/auth';
import { createAdminClient } from '@/lib/supabase';

// GET /api/admin/sessions — list all active (or recently terminated) sessions
export async function GET() {
  const auth = await checkAdminAuth();
  if (auth.error) return auth.error;

  const adminClient = createAdminClient();

  // Get active sessions joined with user info
  const { data: sessions, error } = await adminClient
    .from('user_sessions')
    .select(`
      id,
      user_id,
      device_id,
      device_info,
      ip_address,
      user_agent,
      created_at,
      last_seen_at,
      terminated_at,
      terminated_by
    `)
    .is('terminated_at', null)
    .order('last_seen_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!sessions || sessions.length === 0) {
    return NextResponse.json({ sessions: [] });
  }

  // Fetch user info for all active sessions
  const userIds = [...new Set(sessions.map(s => s.user_id))];
  const { data: profiles } = await adminClient
    .from('user_profiles')
    .select('user_id, username, phone, device_binding_enabled')
    .in('user_id', userIds);

  const profileMap = Object.fromEntries(
    (profiles || []).map(p => [p.user_id, p])
  );

  const enriched = sessions.map(s => ({
    ...s,
    username: profileMap[s.user_id]?.username || 'Unknown',
    phone: profileMap[s.user_id]?.phone || null,
    device_binding_enabled: profileMap[s.user_id]?.device_binding_enabled || false,
  }));

  return NextResponse.json({ sessions: enriched });
}
