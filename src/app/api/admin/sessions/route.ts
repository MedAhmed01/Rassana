import { NextResponse } from 'next/server';
import { checkAdminAuth } from '@/middleware/auth';
import { createAdminClient } from '@/lib/supabase';

// GET /api/admin/sessions — active sessions + global binding mode in one call
export async function GET() {
  const auth = await checkAdminAuth();
  if (auth.error) return auth.error;

  const adminClient = createAdminClient();

  // Run all three queries in parallel
  const [sessionsResult, settingResult] = await Promise.all([
    adminClient
      .from('user_sessions')
      .select('id, user_id, device_id, device_info, ip_address, user_agent, created_at, last_seen_at')
      .is('terminated_at', null)
      .order('last_seen_at', { ascending: false }),
    adminClient
      .from('system_settings')
      .select('value')
      .eq('key', 'device_binding_mode')
      .single(),
  ]);

  // Strip surrounding quotes in case old rows were stored with JSON.stringify
  const rawMode = (settingResult.data?.value as string) || 'per_user';
  const bindingMode = rawMode.replace(/^"|"$/g, '') || 'per_user';

  const sessions = sessionsResult.data || [];

  if (sessions.length === 0) {
    return NextResponse.json({ sessions: [], bindingMode });
  }

  // Fetch profiles for the distinct users in the active sessions
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

  return NextResponse.json({ sessions: enriched, bindingMode });
}
