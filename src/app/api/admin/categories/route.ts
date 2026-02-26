import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/middleware/auth';
import { createAdminClient } from '@/lib/supabase';

export async function GET() {
  try {
    const auth = await checkAdminAuth();
    if (auth.error) return auth.error;

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('subscription_categories')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ categories: data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await checkAdminAuth();
    if (auth.error) return auth.error;

    const body = await request.json();
    const { id, label, color } = body;

    if (!id || !label) {
      return NextResponse.json({ error: 'id and label are required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Get current max sort_order
    const { data: existing } = await supabase
      .from('subscription_categories')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1);

    const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 1;

    const { data, error } = await supabase
      .from('subscription_categories')
      .insert({ id, label, color: color || 'slate', sort_order: nextOrder })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ category: data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
