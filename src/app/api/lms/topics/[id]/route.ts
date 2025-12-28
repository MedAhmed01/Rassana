import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

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
    const studentId = getStudentIdFromRequest(request);
    
    if (!studentId) {
      return NextResponse.json({ error: 'Unauthorized - LMS student login required' }, { status: 401 });
    }

    const { id: topicId } = await params;
    const supabase = createAdminClient();
    const now = new Date().toISOString();

    // Run all queries in parallel
    const [studentResult, topicResult, chaptersResult, packagesResult, accessResult, progressResult] = await Promise.all([
      // Verify student
      supabase.from('lms_students').select('id, is_active').eq('id', studentId).single(),
      
      // Get topic
      supabase.from('lms_topics').select('*').eq('id', topicId).single(),
      
      // Get chapters with lessons
      supabase
        .from('lms_chapters')
        .select(`
          id,
          name,
          description,
          display_order,
          lessons:lms_lessons (
            id,
            title,
            description,
            duration_seconds,
            display_order
          )
        `)
        .eq('topic_id', topicId)
        .order('display_order', { ascending: true }),
      
      // Get student's active packages
      supabase
        .from('lms_student_packages')
        .select(`
          expires_at,
          package:lms_packages (
            topics:lms_package_topics (topic_id)
          )
        `)
        .eq('student_id', studentId)
        .gt('expires_at', now),
      
      // Get lesson access
      supabase
        .from('lms_lesson_access')
        .select('lesson_id, is_unlocked')
        .eq('student_id', studentId),
      
      // Get progress
      supabase
        .from('lms_watch_progress')
        .select('lesson_id, max_percentage_watched')
        .eq('student_id', studentId)
    ]);

    // Check student
    if (studentResult.error || !studentResult.data || !studentResult.data.is_active) {
      return NextResponse.json({ error: 'Student not found or inactive' }, { status: 401 });
    }

    // Check topic
    if (topicResult.error || !topicResult.data) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
    }

    const topic = topicResult.data;
    const isFree = topic.is_free || false;

    // Check package access
    let hasActivePackage = isFree;
    if (!isFree && packagesResult.data) {
      for (const pkg of packagesResult.data) {
        const topicIds = (pkg.package as any)?.topics?.map((t: any) => t.topic_id) || [];
        if (topicIds.includes(topicId)) {
          hasActivePackage = true;
          break;
        }
      }
    }

    // Build access and progress maps
    const accessMap = new Map(accessResult.data?.map((a: any) => [a.lesson_id, a.is_unlocked]) || []);
    const progressMap = new Map(progressResult.data?.map((p: any) => [p.lesson_id, p]) || []);

    // Combine data
    const chaptersWithAccess = (chaptersResult.data || []).map(chapter => ({
      ...chapter,
      lessons: (chapter.lessons || []).map((lesson: any) => ({
        ...lesson,
        is_unlocked: isFree || (hasActivePackage && (accessMap.get(lesson.id) || false)),
        progress: progressMap.get(lesson.id) || null,
      })),
    }));

    return NextResponse.json({ 
      topic: {
        ...topic,
        chapters: chaptersWithAccess,
      },
      subscription: {
        active: hasActivePackage,
        expired: false,
        expires_at: null,
      },
      is_free: isFree,
    });
  } catch (error) {
    console.error('Error fetching topic:', error);
    return NextResponse.json({ error: 'Failed to fetch topic' }, { status: 500 });
  }
}
