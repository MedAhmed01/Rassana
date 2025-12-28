import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/services/auth';
import { createLesson, reorderLessons } from '@/services/lms/lessons';

export async function POST(request: NextRequest) {
  try {
    const adminCheck = await isAdmin();
    if (!adminCheck) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { chapter_id, title, youtube_url, description, duration_seconds } = body;

    if (!chapter_id) {
      return NextResponse.json({ error: 'Chapter ID is required' }, { status: 400 });
    }

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'Lesson title is required' }, { status: 400 });
    }

    if (!youtube_url) {
      return NextResponse.json({ error: 'YouTube URL is required' }, { status: 400 });
    }

    const result = await createLesson({ 
      chapter_id, 
      title: title.trim(), 
      youtube_url,
      description,
      duration_seconds 
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ lesson: result.data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create lesson' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const adminCheck = await isAdmin();
    if (!adminCheck) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { chapter_id, orderedIds } = body;

    if (!chapter_id) {
      return NextResponse.json({ error: 'Chapter ID is required' }, { status: 400 });
    }

    if (!Array.isArray(orderedIds)) {
      return NextResponse.json({ error: 'orderedIds must be an array' }, { status: 400 });
    }

    const result = await reorderLessons(chapter_id, orderedIds);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to reorder lessons' }, { status: 500 });
  }
}
