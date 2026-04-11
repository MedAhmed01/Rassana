import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/middleware/auth';
import { createAdminClient } from '@/lib/supabase';

const BUCKET = 'packet-thumbnails';

export async function POST(request: NextRequest) {
  try {
    const auth = await checkAdminAuth();
    if (auth.error) return auth.error;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: 'Only JPEG, PNG, WebP, or GIF images are allowed' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Ensure the bucket exists (safe to call if it already exists)
    await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => {});

    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filename, buffer, { contentType: file.type, upsert: false });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename);

    return NextResponse.json({ url: data.publicUrl });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
