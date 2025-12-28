import { NextRequest, NextResponse } from 'next/server';
import { validateSession, getCurrentUserProfile } from '@/services/auth';
import { getLessonWithContext } from '@/services/lms/lessons';
import { checkSubscriptionActive } from '@/services/lms/subscriptions';
import { getWatchProgress } from '@/services/lms/progress';

/**
 * GET /api/lms/progress/[lessonId]
 * Get watch progress for a specific lesson
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    const session = await validateSession();
    if (!session.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await getCurrentUserProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 401 });
    }

    const { lessonId } = await params;

    // Get lesson with context to verify access
    const lesson = await getLessonWithContext(lessonId);
    if (!lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    const topicId = lesson.chapter.topic_id;

    // Check subscription
    const isActive = await checkSubscriptionActive(profile.user_id, topicId);
    if (!isActive) {
      return NextResponse.json({ 
        error: 'Subscription expired. Please contact admin to renew.',
        expired: true,
      }, { status: 403 });
    }

    // Get progress
    const progress = await getWatchProgress(profile.user_id, lessonId);

    return NextResponse.json({ 
      progress: progress || {
        lesson_id: lessonId,
        watched_seconds: 0,
        total_seconds: lesson.duration_seconds || 0,
        last_position_seconds: 0,
        max_percentage_watched: 0,
      }
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch progress' }, { status: 500 });
  }
}
