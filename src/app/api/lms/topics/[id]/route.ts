import { NextRequest, NextResponse } from 'next/server';
import { checkSubscriptionActive, getSubscription } from '@/services/lms/subscriptions';
import { getTopicById } from '@/services/lms/topics';
import { getChaptersWithLessons } from '@/services/lms/chapters';
import { getLessonAccessForStudent } from '@/services/lms/access';
import { getProgressByTopic } from '@/services/lms/progress';
import { getStudentById } from '@/services/lms/students';

// Helper to get student ID from cookie or header
function getStudentIdFromRequest(request: NextRequest): string | null {
  return request.cookies.get('lms_student_id')?.value 
    || request.headers.get('x-lms-student-id');
}

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

    const { id: topicId } = await params;

    // Check subscription
    const isActive = await checkSubscriptionActive(studentId, topicId);
    if (!isActive) {
      // Check if subscription exists but expired
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

    // Get topic
    const topic = await getTopicById(topicId);
    if (!topic) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
    }

    // Get chapters with lessons
    const chapters = await getChaptersWithLessons(topicId);

    // Get lesson access for this student
    const lessonAccess = await getLessonAccessForStudent(studentId, topicId);
    const accessMap = new Map(lessonAccess.map((a: any) => [a.lesson_id, a.is_unlocked]));

    // Get progress for this student
    const progressRecords = await getProgressByTopic(studentId, topicId);
    const progressMap = new Map(progressRecords.map(p => [p.lesson_id, p]));

    // Combine data
    const chaptersWithAccess = chapters.map(chapter => ({
      ...chapter,
      lessons: (chapter.lessons || []).map(lesson => ({
        ...lesson,
        is_unlocked: accessMap.get(lesson.id) || false,
        progress: progressMap.get(lesson.id) || null,
      })),
    }));

    return NextResponse.json({ 
      topic: {
        ...topic,
        chapters: chaptersWithAccess,
      }
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch topic' }, { status: 500 });
  }
}
