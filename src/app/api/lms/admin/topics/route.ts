import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/services/auth';
import { createTopic, reorderTopics } from '@/services/lms/topics';
import { createAdminClient } from '@/lib/supabase';

export async function GET() {
  try {
    const adminCheck = await isAdmin();
    if (!adminCheck) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();
    
    // Optimized single query with all nested data
    const { data: topics, error } = await supabase
      .from('lms_topics')
      .select(`
        id,
        name,
        description,
        is_free,
        display_order,
        chapters:lms_chapters (
          id,
          topic_id,
          name,
          description,
          display_order,
          lessons:lms_lessons (
            id,
            chapter_id,
            title,
            description,
            youtube_url,
            duration_seconds,
            display_order
          )
        )
      `)
      .order('display_order', { ascending: true });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch topics' }, { status: 500 });
    }

    // Sort chapters and lessons by display_order in memory (faster than multiple queries)
    const sortedTopics = (topics || []).map((topic: any) => ({
      ...topic,
      chapters: (topic.chapters || [])
        .sort((a: any, b: any) => a.display_order - b.display_order)
        .map((chapter: any) => ({
          ...chapter,
          lessons: (chapter.lessons || []).sort((a: any, b: any) => a.display_order - b.display_order),
        })),
    }));

    return NextResponse.json({ topics: sortedTopics });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch topics' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminCheck = await isAdmin();
    if (!adminCheck) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, is_free } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Topic name is required' }, { status: 400 });
    }

    const result = await createTopic({ name: name.trim(), description, is_free });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ topic: result.data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create topic' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const adminCheck = await isAdmin();
    if (!adminCheck) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { orderedIds } = body;

    if (!Array.isArray(orderedIds)) {
      return NextResponse.json({ error: 'orderedIds must be an array' }, { status: 400 });
    }

    const result = await reorderTopics(orderedIds);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to reorder topics' }, { status: 500 });
  }
}
