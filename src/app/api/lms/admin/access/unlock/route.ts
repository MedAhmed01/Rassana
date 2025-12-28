import { NextRequest, NextResponse } from 'next/server';
import { getAdminProfile } from '@/services/auth';
import { unlockLesson, bulkUnlockLessons } from '@/services/lms/access';

export async function POST(request: NextRequest) {
  try {
    const { isAdmin, profile } = await getAdminProfile();
    if (!isAdmin || !profile) {
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
      result = await unlockLesson(student_id, lesson_ids[0], profile.id);
    } else {
      result = await bulkUnlockLessons(student_id, lesson_ids, profile.id);
    }

    if (!result.success) {
      console.error('Unlock failed:', { error: result.error, profileId: profile.id, studentId: student_id });
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, unlockedCount: lesson_ids.length });
  } catch (error) {
    console.error('Unlock error:', error);
    return NextResponse.json({ error: 'Failed to unlock lessons' }, { status: 500 });
  }
}
