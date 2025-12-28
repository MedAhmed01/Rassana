import { NextRequest, NextResponse } from 'next/server';
import { isAdmin, getCurrentUserProfile } from '@/services/auth';
import { createSubscription } from '@/services/lms/subscriptions';
import { initializeFirstLessonAccess } from '@/services/lms/access';
import { createAdminClient } from '@/lib/supabase';

export async function GET() {
  try {
    const adminCheck = await isAdmin();
    if (!adminCheck) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();
    
    // Single optimized query
    const { data, error } = await supabase
      .from('lms_subscriptions')
      .select(`
        id,
        student_id,
        topic_id,
        starts_at,
        expires_at,
        topic:lms_topics (id, name),
        student:lms_students (id, username, email, phone)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
    }

    const now = new Date();
    const subscriptions = (data || []).map((sub: any) => ({
      ...sub,
      is_active: new Date(sub.expires_at) > now,
    }));

    return NextResponse.json({ subscriptions });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminCheck = await isAdmin();
    if (!adminCheck) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminProfile = await getCurrentUserProfile();
    if (!adminProfile) {
      return NextResponse.json({ error: 'Admin profile not found' }, { status: 401 });
    }

    const body = await request.json();
    const { student_id, topic_id, expires_at, starts_at } = body;

    if (!student_id) {
      return NextResponse.json({ error: 'Student ID is required' }, { status: 400 });
    }

    if (!topic_id) {
      return NextResponse.json({ error: 'Topic ID is required' }, { status: 400 });
    }

    if (!expires_at) {
      return NextResponse.json({ error: 'Expiration date is required' }, { status: 400 });
    }

    const result = await createSubscription({ 
      student_id, 
      topic_id, 
      expires_at,
      starts_at 
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Initialize first lesson access for the new subscription
    await initializeFirstLessonAccess(student_id, topic_id, adminProfile.id);

    return NextResponse.json({ subscription: result.data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 });
  }
}
