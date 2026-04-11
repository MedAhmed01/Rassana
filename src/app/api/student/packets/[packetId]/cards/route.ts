import { NextRequest, NextResponse } from 'next/server';
import { checkAuth } from '@/middleware/auth';
import { createAdminClient } from '@/lib/supabase';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ packetId: string }> }
) {
  try {
    const auth = await checkAuth();
    if (!auth.authenticated) return auth.error!;

    const { packetId } = await params;

    // Get the current user
    const { createServerSupabaseClient } = await import('@/lib/supabase');
    const serverClient = await createServerSupabaseClient();
    const { data: { user } } = await serverClient.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createAdminClient();

    // Verify subscription
    const { data: sub } = await supabase
      .from('online_packet_subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .eq('packet_id', packetId)
      .maybeSingle();

    if (!sub) return NextResponse.json({ error: 'Not subscribed to this packet' }, { status: 403 });

    // Get packet info and cards
    const [{ data: packet, error: packetError }, { data: cards, error: cardsError }] =
      await Promise.all([
        supabase.from('online_packets').select('*').eq('id', packetId).single(),
        supabase
          .from('online_cards')
          .select('*')
          .eq('packet_id', packetId)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true }),
      ]);

    if (packetError) return NextResponse.json({ error: 'Packet not found' }, { status: 404 });
    if (cardsError) return NextResponse.json({ error: cardsError.message }, { status: 500 });

    return NextResponse.json({ packet, cards: cards || [] });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
