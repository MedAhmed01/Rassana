import { NextResponse } from 'next/server';
import { checkAuth } from '@/middleware/auth';
import { validateSession } from '@/services/auth';
import { createAdminClient } from '@/lib/supabase';

export async function GET() {
  try {
    const auth = await checkAuth();
    if (!auth.authenticated) return auth.error!;

    const validation = await validateSession();
    if (!validation.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Get the Supabase user id from session
    const supabase = createAdminClient();
    const { createServerSupabaseClient } = await import('@/lib/supabase');
    const serverClient = await createServerSupabaseClient();
    const { data: { user } } = await serverClient.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Get packets the student is subscribed to
    const { data: subs, error: subsError } = await supabase
      .from('online_packet_subscriptions')
      .select('packet_id')
      .eq('user_id', user.id);

    if (subsError) return NextResponse.json({ error: subsError.message }, { status: 500 });

    const packetIds = (subs || []).map((s) => s.packet_id);

    if (packetIds.length === 0) return NextResponse.json({ packets: [] });

    const { data: packets, error: packetsError } = await supabase
      .from('online_packets')
      .select('*')
      .in('id', packetIds)
      .order('created_at', { ascending: false });

    if (packetsError) return NextResponse.json({ error: packetsError.message }, { status: 500 });

    // Count cards per packet
    const { data: cardRows } = await supabase
      .from('online_cards')
      .select('packet_id')
      .in('packet_id', packetIds);

    const countMap: Record<string, number> = {};
    for (const r of cardRows || []) {
      countMap[r.packet_id] = (countMap[r.packet_id] || 0) + 1;
    }

    const result = (packets || []).map((p) => ({
      ...p,
      card_count: countMap[p.id] || 0,
    }));

    return NextResponse.json({ packets: result });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
