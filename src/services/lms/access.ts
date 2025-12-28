import { createAdminClient } from '@/lib/supabase';
import type { LMSLessonAccess, LMSResult } from '@/types/lms';

/**
 * Unlock a lesson for a student
 */
export async function unlockLesson(
  studentId: string, 
  lessonId: string, 
  adminId: string
): Promise<LMSResult<LMSLessonAccess>> {
  try {
    const supabase = createAdminClient();
    
    const { data, error } = await supabase
      .from('lms_lesson_access')
      .upsert({
        student_id: studentId,
        lesson_id: lessonId,
        is_unlocked: true,
        unlocked_at: new Date().toISOString(),
        unlocked_by: adminId,
        was_unlocked_before_expiry: true,
      }, {
        onConflict: 'student_id,lesson_id',
      })
      .select()
      .single();
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true, data: data as LMSLessonAccess };
  } catch (err) {
    return { success: false, error: 'Failed to unlock lesson' };
  }
}

/**
 * Lock a lesson for a student
 */
export async function lockLesson(studentId: string, lessonId: string): Promise<LMSResult<void>> {
  try {
    const supabase = createAdminClient();
    
    const { error } = await supabase
      .from('lms_lesson_access')
      .upsert({
        student_id: studentId,
        lesson_id: lessonId,
        is_unlocked: false,
        unlocked_at: null,
        unlocked_by: null,
      }, {
        onConflict: 'student_id,lesson_id',
      });
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (err) {
    return { success: false, error: 'Failed to lock lesson' };
  }
}

/**
 * Bulk unlock multiple lessons for a student
 */
export async function bulkUnlockLessons(
  studentId: string, 
  lessonIds: string[], 
  adminId: string
): Promise<LMSResult<void>> {
  try {
    const supabase = createAdminClient();
    
    const records = lessonIds.map(lessonId => ({
      student_id: studentId,
      lesson_id: lessonId,
      is_unlocked: true,
      unlocked_at: new Date().toISOString(),
      unlocked_by: adminId,
      was_unlocked_before_expiry: true,
    }));
    
    const { error } = await supabase
      .from('lms_lesson_access')
      .upsert(records, {
        onConflict: 'student_id,lesson_id',
      });
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (err) {
    return { success: false, error: 'Failed to unlock lessons' };
  }
}


/**
 * Bulk lock multiple lessons for a student
 */
export async function bulkLockLessons(studentId: string, lessonIds: string[]): Promise<LMSResult<void>> {
  try {
    const supabase = createAdminClient();
    
    const records = lessonIds.map(lessonId => ({
      student_id: studentId,
      lesson_id: lessonId,
      is_unlocked: false,
      unlocked_at: null,
      unlocked_by: null,
    }));
    
    const { error } = await supabase
      .from('lms_lesson_access')
      .upsert(records, {
        onConflict: 'student_id,lesson_id',
      });
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (err) {
    return { success: false, error: 'Failed to lock lessons' };
  }
}

/**
 * Check if a lesson is unlocked for a student
 */
export async function isLessonUnlocked(studentId: string, lessonId: string): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    
    const { data, error } = await supabase
      .from('lms_lesson_access')
      .select('is_unlocked')
      .eq('student_id', studentId)
      .eq('lesson_id', lessonId)
      .single();
    
    if (error || !data) {
      return false;
    }
    
    return data.is_unlocked;
  } catch (err) {
    return false;
  }
}

/**
 * Get all lesson access records for a student within a topic
 */
export async function getLessonAccessForStudent(
  studentId: string, 
  topicId: string
): Promise<LMSLessonAccess[]> {
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
      .from('lms_lesson_access')
      .select('*')
      .eq('student_id', studentId)
      .in('lesson_id', lessonIds);
    
    if (error || !data) {
      return [];
    }
    
    return data as LMSLessonAccess[];
  } catch (err) {
    return [];
  }
}

/**
 * Initialize first lesson access when a subscription is created
 */
export async function initializeFirstLessonAccess(
  studentId: string, 
  topicId: string,
  adminId: string
): Promise<LMSResult<void>> {
  try {
    const supabase = createAdminClient();
    
    const { data: firstLesson } = await supabase
      .from('lms_lessons')
      .select(`
        id,
        chapter:lms_chapters!inner (
          topic_id,
          display_order
        )
      `)
      .eq('chapter.topic_id', topicId)
      .order('chapter(display_order)', { ascending: true })
      .order('display_order', { ascending: true })
      .limit(1)
      .single();
    
    if (!firstLesson) {
      return { success: true };
    }
    
    const result = await unlockLesson(studentId, firstLesson.id, adminId);
    return { success: result.success, error: result.error };
  } catch (err) {
    return { success: false, error: 'Failed to initialize lesson access' };
  }
}

/**
 * Lock all lessons for a student when their subscription expires
 */
export async function lockAllLessonsForExpiredSubscription(
  studentId: string, 
  topicId: string
): Promise<LMSResult<void>> {
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
      return { success: true };
    }
    
    const lessonIds = lessons.map((l: any) => l.id);
    
    // Save current unlock state before locking
    await supabase
      .from('lms_lesson_access')
      .update({ was_unlocked_before_expiry: true })
      .eq('student_id', studentId)
      .in('lesson_id', lessonIds)
      .eq('is_unlocked', true);
    
    // Lock all lessons
    const { error } = await supabase
      .from('lms_lesson_access')
      .update({ is_unlocked: false })
      .eq('student_id', studentId)
      .in('lesson_id', lessonIds);
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (err) {
    return { success: false, error: 'Failed to lock lessons for expired subscription' };
  }
}

/**
 * Restore lesson access after subscription renewal
 */
export async function restoreLessonAccessAfterRenewal(
  studentId: string, 
  topicId: string,
  adminId: string
): Promise<LMSResult<void>> {
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
      return { success: true };
    }
    
    const lessonIds = lessons.map((l: any) => l.id);
    
    const { error } = await supabase
      .from('lms_lesson_access')
      .update({ 
        is_unlocked: true,
        unlocked_at: new Date().toISOString(),
        unlocked_by: adminId,
      })
      .eq('student_id', studentId)
      .in('lesson_id', lessonIds)
      .eq('was_unlocked_before_expiry', true);
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (err) {
    return { success: false, error: 'Failed to restore lesson access' };
  }
}

/**
 * Get lesson access status for a specific lesson
 */
export async function getLessonAccess(
  studentId: string, 
  lessonId: string
): Promise<LMSLessonAccess | null> {
  try {
    const supabase = createAdminClient();
    
    const { data, error } = await supabase
      .from('lms_lesson_access')
      .select('*')
      .eq('student_id', studentId)
      .eq('lesson_id', lessonId)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return data as LMSLessonAccess;
  } catch (err) {
    return null;
  }
}
