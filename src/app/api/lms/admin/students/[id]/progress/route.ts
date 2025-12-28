import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/services/auth';
import { getStudentProgressSummary } from '@/services/lms/progress';
import { getLessonAccessForStudent } from '@/services/lms/access';
import { getSubscriptionsByStudent } from '@/services/lms/subscriptions';
import { createAdminClient } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminCheck = await isAdmin();
    if (!adminCheck) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: studentId } = await params;
    const { searchParams } = new URL(request.url);
    const topicId = searchParams.get('topicId');

    // Get progress summary
    const progressSummary = await getStudentProgressSummary(studentId);

    // Get subscriptions
    const subscriptions = await getSubscriptionsByStudent(studentId);

    // If topicId specified, get detailed lesson access with lesson info
    let lessons: any[] = [];
    if (topicId) {
      const supabase = createAdminClient();
      
      // Get all lessons for the topic with chapter info
      const { data: topicLessons } = await supabase
        .from('lms_lessons')
        .select(`
          id,
          title,
          chapter:lms_chapters!inner (
            id,
            name,
            topic_id,
            display_order
          )
        `)
        .eq('chapter.topic_id', topicId)
        .order('chapter(display_order)', { ascending: true })
        .order('display_order', { ascending: true });
      
      if (topicLessons) {
        // Get access records
        const lessonAccess = await getLessonAccessForStudent(studentId, topicId);
        const accessMap = new Map(lessonAccess.map((a: any) => [a.lesson_id, a.is_unlocked]));
        
        // Get progress records
        const { data: progressRecords } = await supabase
          .from('lms_watch_progress')
          .select('lesson_id, max_percentage_watched')
          .eq('student_id', studentId)
          .in('lesson_id', topicLessons.map((l: any) => l.id));
        
        const progressMap = new Map(progressRecords?.map((p: any) => [p.lesson_id, p.max_percentage_watched]) || []);
        
        lessons = topicLessons.map((lesson: any) => ({
          lesson_id: lesson.id,
          lesson_title: lesson.title,
          chapter_name: lesson.chapter.name,
          is_unlocked: accessMap.get(lesson.id) || false,
          progress_percentage: Math.round(progressMap.get(lesson.id) || 0),
        }));
      }
    }

    return NextResponse.json({ 
      progress: progressSummary,
      subscriptions,
      lessons,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch student progress' }, { status: 500 });
  }
}
