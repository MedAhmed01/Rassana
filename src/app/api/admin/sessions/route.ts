import { NextResponse } from 'next/server';
import { checkAdminAuth } from '@/middleware/auth';
import { createAdminClient } from '@/lib/supabase';

// GET /api/admin/sessions — active sessions + all students + global binding mode in one call
export async function GET() {
  const auth = await checkAdminAuth();
  if (auth.error) return auth.error;

  const adminClient = createAdminClient();

  // Run all queries in parallel
  const [sessionsResult, settingResult, allStudentsResult] = await Promise.all([
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
    adminClient
      .from('user_profiles')
      .select('user_id, username, phone, device_id, device_binding_enabled, last_login_at, expires_at')
      .eq('role', 'student')
      .order('username', { ascending: true }),
  ]);

  // Strip surrounding quotes in case old rows were stored with JSON.stringify
  const rawMode = (settingResult.data?.value as string) || 'per_user';
  const bindingMode = rawMode.replace(/^"|"$/g, '') || 'per_user';

  const sessions = sessionsResult.data || [];

  // Build a map of profile data for session enrichment
  const profileMap = Object.fromEntries(
    (allStudentsResult.data || []).map(p => [p.user_id, p])
  );

  // Count active sessions per user
  const sessionCountMap: Record<string, number> = {};
  for (const s of sessions) {
    sessionCountMap[s.user_id] = (sessionCountMap[s.user_id] || 0) + 1;
  }

  // Enrich active sessions with profile info
  const enriched = sessions.map(s => ({
    ...s,
    username: profileMap[s.user_id]?.username || 'Unknown',
    phone: profileMap[s.user_id]?.phone || null,
    device_binding_enabled: profileMap[s.user_id]?.device_binding_enabled || false,
  }));

  // Build the all-students list with live session count
  const allStudents = (allStudentsResult.data || []).map(p => ({
    user_id: p.user_id,
    username: p.username,
    phone: p.phone || null,
    device_id: p.device_id || null,
    device_binding_enabled: p.device_binding_enabled || false,
    last_login_at: p.last_login_at || null,
    expires_at: p.expires_at,
    active_session_count: sessionCountMap[p.user_id] || 0,
  }));

  return NextResponse.json({ sessions: enriched, bindingMode, allStudents });
}
