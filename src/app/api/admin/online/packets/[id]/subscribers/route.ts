import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/middleware/auth';
import { createAdminClient } from '@/lib/supabase';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const auth = await checkAdminAuth();
    if (auth.error) return auth.error;

    const { id: packet_id } = await params;
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('online_packet_subscriptions')
      .select('user_id, created_at')
      .eq('packet_id', packet_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const userIds = (data || []).map((r) => r.user_id);

    if (userIds.length === 0) return NextResponse.json({ subscribers: [] });

    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('user_id, username, phone')
      .in('user_id', userIds);

    if (profilesError) return NextResponse.json({ error: profilesError.message }, { status: 500 });

    const profileMap = Object.fromEntries((profiles || []).map((p) => [p.user_id, p]));

    const subscribers = (data || []).map((r) => ({
      user_id: r.user_id,
      username: profileMap[r.user_id]?.username || r.user_id,
      phone: profileMap[r.user_id]?.phone || null,
      subscribed_at: r.created_at,
    }));

    return NextResponse.json({ subscribers });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const auth = await checkAdminAuth();
    if (auth.error) return auth.error;

    const { id: packet_id } = await params;
    const body = await request.json();
    const { user_id } = body;

    if (!user_id) return NextResponse.json({ error: 'user_id is required' }, { status: 400 });

    const supabase = createAdminClient();

    const { error } = await supabase
      .from('online_packet_subscriptions')
      .insert({ user_id, packet_id });

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'User is already subscribed' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
