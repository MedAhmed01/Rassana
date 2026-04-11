import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/middleware/auth';
import { createAdminClient } from '@/lib/supabase';

type Ctx = { params: Promise<{ id: string; userId: string }> };

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const auth = await checkAdminAuth();
    if (auth.error) return auth.error;

    const { id: packet_id, userId: user_id } = await params;
    const supabase = createAdminClient();

    const { error } = await supabase
      .from('online_packet_subscriptions')
      .delete()
      .eq('packet_id', packet_id)
      .eq('user_id', user_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
