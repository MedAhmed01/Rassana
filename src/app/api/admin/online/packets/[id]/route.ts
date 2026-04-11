import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/middleware/auth';
import { createAdminClient } from '@/lib/supabase';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Ctx) {
  try {
    const auth = await checkAdminAuth();
    if (auth.error) return auth.error;

    const { id } = await params;
    const body = await request.json();

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('online_packets')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ packet: data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const auth = await checkAdminAuth();
    if (auth.error) return auth.error;

    const { id } = await params;
    const supabase = createAdminClient();

    const { error } = await supabase.from('online_packets').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
