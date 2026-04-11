import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/middleware/auth';
import { createAdminClient } from '@/lib/supabase';

export async function GET() {
  try {
    const auth = await checkAdminAuth();
    if (auth.error) return auth.error;

    const supabase = createAdminClient();

    const { data: packets, error } = await supabase
      .from('online_packets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Get card and subscriber counts for each packet
    const packetIds = (packets || []).map((p) => p.id);

    const [{ data: cardCounts }, { data: subCounts }] = await Promise.all([
      supabase
        .from('online_cards')
        .select('packet_id')
        .in('packet_id', packetIds.length ? packetIds : ['']),
      supabase
        .from('online_packet_subscriptions')
        .select('packet_id')
        .in('packet_id', packetIds.length ? packetIds : ['']),
    ]);

    const cardMap: Record<string, number> = {};
    for (const r of cardCounts || []) cardMap[r.packet_id] = (cardMap[r.packet_id] || 0) + 1;

    const subMap: Record<string, number> = {};
    for (const r of subCounts || []) subMap[r.packet_id] = (subMap[r.packet_id] || 0) + 1;

    const result = (packets || []).map((p) => ({
      ...p,
      card_count: cardMap[p.id] || 0,
      subscriber_count: subMap[p.id] || 0,
    }));

    return NextResponse.json({ packets: result });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await checkAdminAuth();
    if (auth.error) return auth.error;

    const body = await request.json();
    const { title, thumbnail_url } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('online_packets')
      .insert({ title: title.trim(), thumbnail_url: thumbnail_url || null })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ packet: data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
