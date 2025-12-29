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

    // Get all lessons from the same topic for playlist
    const { createAdminClient } = require('@/lib/supabase');
    const supabase = createAdminClient();
    
    const { data: allChapters } = await supabase
      .from('lms_chapters')
      .select(`
        id,
        name,
        display_order,
        lessons:lms_lessons (
          id,
          title,
          duration_seconds,
          display_order
        )
      `)
      .eq('topic_id', topicId)
      .order('display_order', { ascending: true });

    // Get access and progress for all lessons
    const { data: allAccess } = await supabase
      .from('lms_lesson_access')
      .select('lesson_id, is_unlocked')
      .eq('student_id', studentId);

    const { data: allProgress } = await supabase
      .from('lms_watch_progress')
      .select('lesson_id, max_percentage_watched')
      .eq('student_id', studentId);

    const accessMap = new Map(allAccess?.map((a: any) => [a.lesson_id, a.is_unlocked]) || []);
    const progressMap = new Map(allProgress?.map((p: any) => [p.lesson_id, p.max_percentage_watched]) || []);

    const playlist = (allChapters || []).map(chapter => ({
      id: chapter.id,
      name: chapter.name,
      display_order: chapter.display_order,
      lessons: (chapter.lessons || []).map((l: any) => ({
        id: l.id,
        title: l.title,
        duration_seconds: l.duration_seconds,
        display_order: l.display_order,
        is_unlocked: accessMap.get(l.id) || false,
        progress: progressMap.get(l.id) || 0,
      })),
    }));

    return NextResponse.json({ 
      lesson: {
        ...lesson,
        is_unlocked: true,
        progress: progress || null,
      },
      playlist,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch lesson' }, { status: 500 });
  }
}
