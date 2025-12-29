import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

function getStudentIdFromRequest(request: NextRequest): string | null {
  return request.cookies.get('lms_student_id')?.value 
    || request.headers.get('x-lms-student-id');
}

export async function GET(request: NextRequest) {
  try {
    const studentId = getStudentIdFromRequest(request);
    
    if (!studentId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();
    const now = new Date().toISOString();

    // Get student info with class
    const { data: student, error: studentError } = await supabase
      .from('lms_students')
      .select('id, username, email, class, is_active')
      .eq('id', studentId)
      .single();

    if (studentError || !student || !student.is_active) {
      return NextResponse.json({ error: 'Student not found or inactive' }, { status: 401 });
    }

    // Get active packages with expiry dates
    const { data: packages } = await supabase
      .from('lms_student_packages')
      .select(`
        expires_at,
        package:lms_packages (
          id,
          name,
          topics:lms_package_topics (
            topic:lms_topics (id, name)
          )
        )
      `)
      .eq('student_id', studentId)
      .gt('expires_at', now)
      .order('expires_at', { ascending: true });

    // Get continue watching (lessons with progress > 5% and < 90%)
    const { data: continueWatching } = await supabase
      .from('lms_watch_progress')
      .select(`
        lesson_id,
        max_percentage_watched,
        last_position_seconds,
        updated_at,
        lesson:lms_lessons!inner (
          id,
          title,
          duration_seconds,
          chapter:lms_chapters!inner (
            id,
            name,
            topic:lms_topics!inner (
              id,
              name
            )
          )
        )
      `)
      .eq('student_id', studentId)
      .gt('max_percentage_watched', 5)
      .lt('max_percentage_watched', 90)
      .order('updated_at', { ascending: false })
      .limit(3);

    // Get all topics with progress
    const { data: topics } = await supabase
      .from('lms_topics')
      .select('id, name, description, is_free')
      .order('display_order', { ascending: true });

    // Get progress for all lessons
    const { data: progress } = await supabase
      .from('lms_watch_progress')
      .select(`
        lesson_id,
        max_percentage_watched,
        lesson:lms_lessons!inner (
          chapter:lms_chapters!inner (
            topic_id
          )
        )
      `)
      .eq('student_id', studentId);

    // Build package access map
    const packageAccessMap = new Set<string>();
    if (packages) {
      for (const pkg of packages) {
        const topicIds = (pkg.package as any)?.topics?.map((t: any) => t.topic?.id).filter(Boolean) || [];
        topicIds.forEach((id: string) => packageAccessMap.add(id));
      }
    }

    // Calculate progress by topic
    const progressByTopic = new Map<string, { total: number; completed: number }>();
    if (progress) {
      for (const prog of progress) {
        const topicId = (prog.lesson as any)?.chapter?.topic_id;
        if (!topicId) continue;
        
        const existing = progressByTopic.get(topicId) || { total: 0, completed: 0 };
        existing.total++;
        if (prog.max_percentage_watched >= 90) existing.completed++;
        progressByTopic.set(topicId, existing);
      }
    }

    // Format topics with progress
    const formattedTopics = (topics || []).map((topic: any) => {
      const hasPackageAccess = packageAccessMap.has(topic.id);
      const isAccessible = topic.is_free || hasPackageAccess;
      const prog = progressByTopic.get(topic.id) || { total: 0, completed: 0 };
      const percentage = prog.total > 0 ? Math.round((prog.completed / prog.total) * 100) : 0;
      
      return {
        id: topic.id,
        name: topic.name,
        description: topic.description,
        overall_percentage: percentage,
        total_lessons: prog.total,
        completed_lessons: prog.completed,
        is_active: isAccessible,
      };
    });

    // Format packages
    const formattedPackages = (packages || []).map((pkg: any) => ({
      name: pkg.package?.name,
      expires_at: pkg.expires_at,
      topics: pkg.package?.topics?.map((t: any) => t.topic?.name).filter(Boolean) || [],
    }));

    // Format continue watching
    const formattedContinueWatching = (continueWatching || []).map((item: any) => ({
      lesson_id: item.lesson?.id,
      lesson_title: item.lesson?.title,
      chapter_name: item.lesson?.chapter?.name,
      topic_id: item.lesson?.chapter?.topic?.id,
      topic_name: item.lesson?.chapter?.topic?.name,
      progress: item.max_percentage_watched,
      duration_seconds: item.lesson?.duration_seconds,
    }));

    return NextResponse.json({
      student: {
        username: student.username,
        email: student.email,
        class: student.class,
      },
      packages: formattedPackages,
      continueWatching: formattedContinueWatching,
      topics: formattedTopics,
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard' }, { status: 500 });
  }
}
