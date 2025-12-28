import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/services/auth';
import { lockLesson, bulkLockLessons } from '@/services/lms/access';

export async function POST(request: NextRequest) {
  try {
    const adminCheck = await isAdmin();
    if (!adminCheck) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { student_id, lesson_ids } = body;

    if (!student_id) {
      return NextResponse.json({ error: 'Student ID is required' }, { status: 400 });
    }

    if (!lesson_ids || !Array.isArray(lesson_ids) || lesson_ids.length === 0) {
      return NextResponse.json({ error: 'Lesson IDs are required' }, { status: 400 });
    }

    let result;
    if (lesson_ids.length === 1) {
      result = await lockLesson(student_id, lesson_ids[0]);
    } else {
      result = await bulkLockLessons(student_id, lesson_ids);
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, lockedCount: lesson_ids.length });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to lock lessons' }, { status: 500 });
  }
}
