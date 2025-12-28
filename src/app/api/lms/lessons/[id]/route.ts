import { NextRequest, NextResponse } from 'next/server';
import { getLessonWithContext } from '@/services/lms/lessons';
import { checkSubscriptionActive, getSubscription } from '@/services/lms/subscriptions';
import { isLessonUnlocked } from '@/services/lms/access';
import { getWatchProgress } from '@/services/lms/progress';
import { getStudentById } from '@/services/lms/students';

// Helper to get student ID from cookie or header
function getStudentIdFromRequest(request: NextRequest): string | null {
  return request.cookies.get('lms_student_id')?.value 
    || request.headers.get('x-lms-student-id');
}

/**
 * GET /api/lms/lessons/[id]
 * Get lesson details for a student (if unlocked and subscribed)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: lessonId } = await params;

    // Get lesson with chapter and topic context
    const lesson = await getLessonWithContext(lessonId);
    if (!lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    const topicId = lesson.chapter.topic_id;

    // Check subscription
    const isActive = await checkSubscriptionActive(studentId, topicId);
    if (!isActive) {
      const subscription = await getSubscription(studentId, topicId);
      if (subscription) {
        return NextResponse.json({ 
          error: 'Subscription expired. Please contact admin to renew.',
          expired: true,
          expires_at: subscription.expires_at,
        }, { status: 403 });
      }
      return NextResponse.json({ error: 'No subscription found for this topic' }, { status: 403 });
    }

    // Check if lesson is unlocked
    const unlocked = await isLessonUnlocked(studentId, lessonId);
    if (!unlocked) {
      return NextResponse.json({ 
        error: 'This lesson is locked. Complete previous lessons first.',
        locked: true,
      }, { status: 403 });
    }

    // Get watch progress
    const progress = await getWatchProgress(studentId, lessonId);

    return NextResponse.json({ 
      lesson: {
        ...lesson,
        is_unlocked: true,
        progress: progress || null,
      }
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch lesson' }, { status: 500 });
  }
}
