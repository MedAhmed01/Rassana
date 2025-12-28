import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/services/auth';
import { createAdminClient } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: studentId } = await params;
    const { searchParams } = new URL(request.url);
    const topicId = searchParams.get('topicId');

    // Run admin check and data queries in parallel
    const supabase = createAdminClient();
    
    // Build lessons query
    let lessonsQuery = supabase
      .from('lms_lessons')
      .select(`
        id,
        title,
        chapter:lms_chapters!inner (
          id,
          name,
          topic_id,
          display_order,
          topic:lms_topics (id, name)
        )
      `)
      .order('display_order', { ascending: true });
    
    if (topicId) {
      lessonsQuery = lessonsQuery.eq('chapter.topic_id', topicId);
    }
    
    // Run all queries in parallel
    const [adminCheck, lessonsResult] = await Promise.all([
      isAdmin(),
      lessonsQuery
    ]);

    if (!adminCheck) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const topicLessons = lessonsResult.data;
    let lessons: any[] = [];
    
    if (topicLessons && topicLessons.length > 0) {
      const lessonIds = topicLessons.map((l: any) => l.id);
      
      // Get access and progress records in parallel
      const [accessResult, progressResult] = await Promise.all([
        supabase
          .from('lms_lesson_access')
          .select('lesson_id, is_unlocked')
          .eq('student_id', studentId)
          .in('lesson_id', lessonIds),
        supabase
          .from('lms_watch_progress')
          .select('lesson_id, max_percentage_watched')
          .eq('student_id', studentId)
          .in('lesson_id', lessonIds)
      ]);
      
      const accessMap = new Map(accessResult.data?.map((a: any) => [a.lesson_id, a.is_unlocked]) || []);
      const progressMap = new Map(progressResult.data?.map((p: any) => [p.lesson_id, p.max_percentage_watched]) || []);
      
      lessons = topicLessons.map((lesson: any) => ({
        lesson_id: lesson.id,
        lesson_title: lesson.title,
        chapter_name: lesson.chapter.name,
        topic_name: lesson.chapter.topic?.name || 'Unknown Topic',
        is_unlocked: accessMap.get(lesson.id) || false,
        progress_percentage: Math.round(progressMap.get(lesson.id) || 0),
      }));
    }

    return NextResponse.json({ lessons });
  } catch (error) {
    console.error('Error fetching student progress:', error);
    return NextResponse.json({ error: 'Failed to fetch student progress' }, { status: 500 });
  }
}
