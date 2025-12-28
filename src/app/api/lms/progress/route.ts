import { NextRequest, NextResponse } from 'next/server';
import { getLessonWithContext } from '@/services/lms/lessons';
import { checkSubscriptionActive } from '@/services/lms/subscriptions';
import { isLessonUnlocked } from '@/services/lms/access';
import { updateWatchProgress } from '@/services/lms/progress';
import { getStudentById } from '@/services/lms/students';

// Helper to get student ID from cookie or header
function getStudentIdFromRequest(request: NextRequest): string | null {
  return request.cookies.get('lms_student_id')?.value 
    || request.headers.get('x-lms-student-id');
}

/**
 * POST /api/lms/progress
 * Update watch progress for a lesson
 */
export async function POST(request: NextRequest) {
  try {
    // Get student_id from cookie or header
    const studentId = getStudentIdFromRequest(request);
    
    if (!studentId) {
      return NextResponse.json({ error: 'Unauthorized - LMS student login required' }, { status: 401 });
    }

    // Verify student exists
    const student = await getStudentById(studentId);
    if (!student || !student.is_active) {
      return NextResponse.json({ error: 'Student not found or inactive' }, { status: 401 });
    }

    const body = await request.json();
    const { lesson_id, watched_seconds, total_seconds, last_position_seconds } = body;

    // Validate required fields
    if (!lesson_id) {
      return NextResponse.json({ error: 'lesson_id is required' }, { status: 400 });
    }
    if (typeof watched_seconds !== 'number' || watched_seconds < 0) {
      return NextResponse.json({ error: 'watched_seconds must be a non-negative number' }, { status: 400 });
    }
    if (typeof total_seconds !== 'number' || total_seconds <= 0) {
      return NextResponse.json({ error: 'total_seconds must be a positive number' }, { status: 400 });
    }
    if (typeof last_position_seconds !== 'number' || last_position_seconds < 0) {
      return NextResponse.json({ error: 'last_position_seconds must be a non-negative number' }, { status: 400 });
    }

    // Get lesson with context to verify access
    const lesson = await getLessonWithContext(lesson_id);
    if (!lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    const topicId = lesson.chapter.topic_id;

    // Check subscription
    const isActive = await checkSubscriptionActive(studentId, topicId);
    if (!isActive) {
      return NextResponse.json({ 
        error: 'Subscription expired. Please contact admin to renew.',
        expired: true,
      }, { status: 403 });
    }

    // Check if lesson is unlocked
    const unlocked = await isLessonUnlocked(studentId, lesson_id);
    if (!unlocked) {
      return NextResponse.json({ 
        error: 'This lesson is locked.',
        locked: true,
      }, { status: 403 });
    }

    // Update progress
    const result = await updateWatchProgress(studentId, {
      lesson_id,
      watched_seconds,
      total_seconds,
      last_position_seconds,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ progress: result.data });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update progress' }, { status: 500 });
  }
}
