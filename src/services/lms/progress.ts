import { createAdminClient } from '@/lib/supabase';
import type { 
  LMSWatchProgress, 
  UpdateProgressRequest, 
  LMSResult,
  LMSStudentProgress 
} from '@/types/lms';

/**
 * Update watch progress for a lesson
 * Ensures progress never regresses below previous maximum
 */
export async function updateWatchProgress(
  studentId: string, 
  data: UpdateProgressRequest
): Promise<LMSResult<LMSWatchProgress>> {
  try {
    const supabase = createAdminClient();
    
    // Get current progress to ensure non-regression
    const { data: current } = await supabase
      .from('lms_watch_progress')
      .select('*')
      .eq('student_id', studentId)
      .eq('lesson_id', data.lesson_id)
      .single();
    
    // Calculate new percentage
    const newPercentage = data.total_seconds > 0 
      ? Math.min(100, (data.watched_seconds / data.total_seconds) * 100)
      : 0;
    
    // Ensure max_percentage_watched never decreases
    const maxPercentage = current 
      ? Math.max(current.max_percentage_watched, newPercentage)
      : newPercentage;
    
    const progressData = {
      student_id: studentId,
      lesson_id: data.lesson_id,
      watched_seconds: data.watched_seconds,
      total_seconds: data.total_seconds,
      last_position_seconds: data.last_position_seconds,
      max_percentage_watched: maxPercentage,
    };
    
    const { data: progress, error } = await supabase
      .from('lms_watch_progress')
      .upsert(progressData, {
        onConflict: 'student_id,lesson_id',
      })
      .select()
      .single();
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true, data: progress as LMSWatchProgress };
  } catch (err) {
    return { success: false, error: 'Failed to update progress' };
  }
}

/**
 * Get watch progress for a specific lesson
 */
export async function getWatchProgress(
  studentId: string, 
  lessonId: string
): Promise<LMSWatchProgress | null> {
  try {
    const supabase = createAdminClient();
    
    const { data, error } = await supabase
      .from('lms_watch_progress')
      .select('*')
      .eq('student_id', studentId)
      .eq('lesson_id', lessonId)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return data as LMSWatchProgress;
  } catch (err) {
    return null;
  }
}


/**
 * Get all progress for a student within a topic
 */
export async function getProgressByTopic(
  studentId: string, 
  topicId: string
): Promise<LMSWatchProgress[]> {
  try {
    const supabase = createAdminClient();
    
    const { data: lessons } = await supabase
      .from('lms_lessons')
      .select(`
        id,
        chapter:lms_chapters!inner (
          topic_id
        )
      `)
      .eq('chapter.topic_id', topicId);
    
    if (!lessons || lessons.length === 0) {
      return [];
    }
    
    const lessonIds = lessons.map((l: any) => l.id);
    
    const { data, error } = await supabase
      .from('lms_watch_progress')
      .select('*')
      .eq('student_id', studentId)
      .in('lesson_id', lessonIds);
    
    if (error || !data) {
      return [];
    }
    
    return data as LMSWatchProgress[];
  } catch (err) {
    return [];
  }
}

/**
 * Get student progress summary for all their subscribed topics
 */
export async function getStudentProgressSummary(studentId: string): Promise<LMSStudentProgress[]> {
  try {
    const supabase = createAdminClient();
    
    // Get student info
    const { data: student } = await supabase
      .from('lms_students')
      .select('id, username, email, phone')
      .eq('id', studentId)
      .single();
    
    if (!student) {
      return [];
    }
    
    // Get all subscriptions for the student
    const { data: subscriptions } = await supabase
      .from('lms_subscriptions')
      .select(`
        topic_id,
        topic:lms_topics (
          id,
          name
        )
      `)
      .eq('student_id', studentId);
    
    if (!subscriptions || subscriptions.length === 0) {
      return [];
    }
    
    const progressSummaries: LMSStudentProgress[] = [];
    
    for (const sub of subscriptions) {
      const topic = sub.topic as any;
      
      const { data: lessons } = await supabase
        .from('lms_lessons')
        .select(`
          id,
          chapter:lms_chapters!inner (
            topic_id
          )
        `)
        .eq('chapter.topic_id', sub.topic_id);
      
      const totalLessons = lessons?.length || 0;
      
      if (totalLessons === 0) {
        progressSummaries.push({
          student_id: studentId,
          username: student.username,
          email: student.email,
          phone: student.phone,
          topic_id: sub.topic_id,
          topic_name: topic?.name || 'Unknown',
          total_lessons: 0,
          unlocked_lessons: 0,
          completed_lessons: 0,
          overall_percentage: 0,
        });
        continue;
      }
      
      const lessonIds = lessons!.map((l: any) => l.id);
      
      const { data: accessRecords } = await supabase
        .from('lms_lesson_access')
        .select('lesson_id, is_unlocked')
        .eq('student_id', studentId)
        .in('lesson_id', lessonIds)
        .eq('is_unlocked', true);
      
      const unlockedLessons = accessRecords?.length || 0;
      
      const { data: progressRecords } = await supabase
        .from('lms_watch_progress')
        .select('lesson_id, max_percentage_watched')
        .eq('student_id', studentId)
        .in('lesson_id', lessonIds);
      
      const completedLessons = progressRecords?.filter(
        (p: any) => p.max_percentage_watched >= 90
      ).length || 0;
      
      const totalPercentage = progressRecords?.reduce(
        (sum: number, p: any) => sum + (p.max_percentage_watched || 0), 
        0
      ) || 0;
      const overallPercentage = totalLessons > 0 
        ? Math.round(totalPercentage / totalLessons) 
        : 0;
      
      progressSummaries.push({
        student_id: studentId,
        username: student.username,
        email: student.email,
        phone: student.phone,
        topic_id: sub.topic_id,
        topic_name: topic?.name || 'Unknown',
        total_lessons: totalLessons,
        unlocked_lessons: unlockedLessons,
        completed_lessons: completedLessons,
        overall_percentage: overallPercentage,
      });
    }
    
    return progressSummaries;
  } catch (err) {
    return [];
  }
}

/**
 * Get all student progress for a specific topic (admin view)
 */
export async function getAllStudentProgress(topicId: string): Promise<LMSStudentProgress[]> {
  try {
    const supabase = createAdminClient();
    
    const { data: topic } = await supabase
      .from('lms_topics')
      .select('id, name')
      .eq('id', topicId)
      .single();
    
    if (!topic) {
      return [];
    }
    
    const { data: subscriptions } = await supabase
      .from('lms_subscriptions')
      .select(`
        student_id,
        student:lms_students (
          id,
          username,
          email,
          phone
        )
      `)
      .eq('topic_id', topicId);
    
    if (!subscriptions || subscriptions.length === 0) {
      return [];
    }
    
    const { data: lessons } = await supabase
      .from('lms_lessons')
      .select(`
        id,
        chapter:lms_chapters!inner (
          topic_id
        )
      `)
      .eq('chapter.topic_id', topicId);
    
    const totalLessons = lessons?.length || 0;
    const lessonIds = lessons?.map((l: any) => l.id) || [];
    
    const progressSummaries: LMSStudentProgress[] = [];
    
    for (const sub of subscriptions) {
      const student = sub.student as any;
      
      if (totalLessons === 0) {
        progressSummaries.push({
          student_id: sub.student_id,
          username: student?.username || 'Unknown',
          email: student?.email || '',
          phone: student?.phone,
          topic_id: topicId,
          topic_name: topic.name,
          total_lessons: 0,
          unlocked_lessons: 0,
          completed_lessons: 0,
          overall_percentage: 0,
        });
        continue;
      }
      
      const { data: accessRecords } = await supabase
        .from('lms_lesson_access')
        .select('lesson_id')
        .eq('student_id', sub.student_id)
        .in('lesson_id', lessonIds)
        .eq('is_unlocked', true);
      
      const unlockedLessons = accessRecords?.length || 0;
      
      const { data: progressRecords } = await supabase
        .from('lms_watch_progress')
        .select('max_percentage_watched')
        .eq('student_id', sub.student_id)
        .in('lesson_id', lessonIds);
      
      const completedLessons = progressRecords?.filter(
        (p: any) => p.max_percentage_watched >= 90
      ).length || 0;
      
      const totalPercentage = progressRecords?.reduce(
        (sum: number, p: any) => sum + (p.max_percentage_watched || 0), 
        0
      ) || 0;
      const overallPercentage = totalLessons > 0 
        ? Math.round(totalPercentage / totalLessons) 
        : 0;
      
      progressSummaries.push({
        student_id: sub.student_id,
        username: student?.username || 'Unknown',
        email: student?.email || '',
        phone: student?.phone,
        topic_id: topicId,
        topic_name: topic.name,
        total_lessons: totalLessons,
        unlocked_lessons: unlockedLessons,
        completed_lessons: completedLessons,
        overall_percentage: overallPercentage,
      });
    }
    
    return progressSummaries;
  } catch (err) {
    return [];
  }
}

/**
 * Calculate topic completion percentage
 */
export function calculateTopicCompletion(
  progressRecords: LMSWatchProgress[], 
  totalLessons: number
): number {
  if (totalLessons === 0) return 0;
  
  const totalPercentage = progressRecords.reduce(
    (sum, p) => sum + (p.max_percentage_watched || 0), 
    0
  );
  
  return Math.round(totalPercentage / totalLessons);
}
