import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

// Helper to get student ID from cookie or header
function getStudentIdFromRequest(request: NextRequest): string | null {
  return request.cookies.get('lms_student_id')?.value 
    || request.headers.get('x-lms-student-id');
}

export async function GET(request: NextRequest) {
  try {
    const studentId = getStudentIdFromRequest(request);
    
    if (!studentId) {
      return NextResponse.json({ error: 'Unauthorized - LMS student login required' }, { status: 401 });
    }

    const supabase = createAdminClient();
    const now = new Date().toISOString();

    // Run all queries in parallel
    const [studentResult, topicsResult, packagesResult, progressResult] = await Promise.all([
      // Verify student
      supabase.from('lms_students').select('id, is_active').eq('id', studentId).single(),
      
      // Get all topics
      supabase.from('lms_topics').select('id, name, description, is_free').order('display_order', { ascending: true }),
      
      // Get student's active packages with topics
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
      
      // Get progress for all lessons
      supabase
        .from('lms_watch_progress')
        .select(`
          lesson_id,
          max_percentage_watched,
          lesson:lms_lessons!inner (
            id,
            chapter:lms_chapters!inner (
              topic_id
            )
          )
        `)
        .eq('student_id', studentId)
    ]);

    // Check student
    if (studentResult.error || !studentResult.data || !studentResult.data.is_active) {
      return NextResponse.json({ error: 'Student not found or inactive' }, { status: 401 });
    }

    // Build package access map
    const packageAccessMap = new Set<string>();
    if (packagesResult.data) {
      for (const pkg of packagesResult.data) {
        const topicIds = (pkg.package as any)?.topics?.map((t: any) => t.topic_id) || [];
        topicIds.forEach((id: string) => packageAccessMap.add(id));
      }
    }

    // Build progress map by topic
    const progressByTopic = new Map<string, { total: number; completed: number; percentage: number }>();
    if (progressResult.data) {
      for (const prog of progressResult.data) {
        const topicId = (prog.lesson as any)?.chapter?.topic_id;
        if (!topicId) continue;
        
        const existing = progressByTopic.get(topicId) || { total: 0, completed: 0, percentage: 0 };
        existing.total++;
        if (prog.max_percentage_watched >= 90) existing.completed++;
        existing.percentage = existing.total > 0 ? (existing.completed / existing.total) * 100 : 0;
        progressByTopic.set(topicId, existing);
      }
    }

    // Combine all data
    const topics = (topicsResult.data || []).map((topic: any) => {
      const hasPackageAccess = packageAccessMap.has(topic.id);
      const isAccessible = topic.is_free || hasPackageAccess;
      const progress = progressByTopic.get(topic.id) || { total: 0, completed: 0, percentage: 0 };
      
      return {
        id: topic.id,
        name: topic.name,
        description: topic.description,
        is_free: topic.is_free || false,
        overall_percentage: Math.round(progress.percentage),
        total_lessons: progress.total,
        completed_lessons: progress.completed,
        is_active: isAccessible,
        has_package_access: hasPackageAccess,
      };
    });

    return NextResponse.json({ topics });
  } catch (error) {
    console.error('Error fetching topics:', error);
    return NextResponse.json({ error: 'Failed to fetch topics' }, { status: 500 });
  }
}
