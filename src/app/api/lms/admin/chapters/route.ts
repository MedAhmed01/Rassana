import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/services/auth';
import { createChapter, reorderChapters } from '@/services/lms/chapters';

export async function POST(request: NextRequest) {
  try {
    const adminCheck = await isAdmin();
    if (!adminCheck) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { topic_id, name, description } = body;

    if (!topic_id) {
      return NextResponse.json({ error: 'Topic ID is required' }, { status: 400 });
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Chapter name is required' }, { status: 400 });
    }

    const result = await createChapter({ 
      topic_id, 
      name: name.trim(), 
      description 
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ chapter: result.data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create chapter' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const adminCheck = await isAdmin();
    if (!adminCheck) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { topic_id, orderedIds } = body;

    if (!topic_id) {
      return NextResponse.json({ error: 'Topic ID is required' }, { status: 400 });
    }

    if (!Array.isArray(orderedIds)) {
      return NextResponse.json({ error: 'orderedIds must be an array' }, { status: 400 });
    }

    const result = await reorderChapters(topic_id, orderedIds);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to reorder chapters' }, { status: 500 });
  }
}
