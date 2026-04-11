import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/middleware/auth';
import { createAdminClient } from '@/lib/supabase';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const auth = await checkAdminAuth();
    if (auth.error) return auth.error;

    const { id } = await params;
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('online_cards')
      .select('*')
      .eq('packet_id', id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ cards: data || [] });
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
    const { title, image_url, youtube_url } = body;

    if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    if (!youtube_url?.trim()) return NextResponse.json({ error: 'YouTube URL is required' }, { status: 400 });

    const supabase = createAdminClient();

    // Get current max sort_order for this packet
    const { data: existing } = await supabase
      .from('online_cards')
      .select('sort_order')
      .eq('packet_id', packet_id)
      .order('sort_order', { ascending: false })
      .limit(1);

    const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

    const { data, error } = await supabase
      .from('online_cards')
      .insert({
        packet_id,
        title: title.trim(),
        image_url: image_url || null,
        youtube_url: youtube_url.trim(),
        sort_order: nextOrder,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ card: data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
