import { createAdminClient } from '@/lib/supabase';
import type { 
  LMSLesson, 
  CreateLessonRequest, 
  UpdateLessonRequest, 
  LMSResult 
} from '@/types/lms';

/**
 * Validate YouTube URL format
 */
export function isValidYouTubeUrl(url: string): boolean {
  const patterns = [
    /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
    /^https?:\/\/youtu\.be\/[\w-]+/,
    /^https?:\/\/(www\.)?youtube\.com\/embed\/[\w-]+/,
    /^https?:\/\/(www\.)?youtube\.com\/v\/[\w-]+/,
  ];
  return patterns.some(pattern => pattern.test(url));
}

/**
 * Extract YouTube video ID from URL
 */
export function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([\w-]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

/**
 * Create a new lesson within a chapter
 */
export async function createLesson(data: CreateLessonRequest): Promise<LMSResult<LMSLesson>> {
  try {
    // Validate YouTube URL
    if (!isValidYouTubeUrl(data.youtube_url)) {
      return { success: false, error: 'Please provide a valid YouTube URL' };
    }
    
    const supabase = createAdminClient();
    
    // Get the max display_order for this chapter
    const { data: maxOrder } = await supabase
      .from('lms_lessons')
      .select('display_order')
      .eq('chapter_id', data.chapter_id)
      .order('display_order', { ascending: false })
      .limit(1)
      .single();
    
    const newOrder = (maxOrder?.display_order ?? -1) + 1;
    
    const { data: lesson, error } = await supabase
      .from('lms_lessons')
      .insert({
        chapter_id: data.chapter_id,
        title: data.title,
        youtube_url: data.youtube_url,
        description: data.description || null,
        duration_seconds: data.duration_seconds || null,
        display_order: newOrder,
      })
      .select()
      .single();
    
    if (error) {
      if (error.code === '23503') {
        return { success: false, error: 'Chapter not found' };
      }
      return { success: false, error: error.message };
    }
    
    return { success: true, data: lesson as LMSLesson };
  } catch (err) {
    return { success: false, error: 'Failed to create lesson' };
  }
}

/**
 * Update an existing lesson
 */
export async function updateLesson(id: string, data: UpdateLessonRequest): Promise<LMSResult<LMSLesson>> {
  try {
    // Validate YouTube URL if provided
    if (data.youtube_url && !isValidYouTubeUrl(data.youtube_url)) {
      return { success: false, error: 'Please provide a valid YouTube URL' };
    }
    
    const supabase = createAdminClient();
    
    const updateData: Record<string, unknown> = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.youtube_url !== undefined) updateData.youtube_url = data.youtube_url;
    if (data.description !== undefined) updateData.description = data.description || null;
    if (data.duration_seconds !== undefined) updateData.duration_seconds = data.duration_seconds;
    if (data.display_order !== undefined) updateData.display_order = data.display_order;
    
    const { data: lesson, error } = await supabase
      .from('lms_lessons')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    if (!lesson) {
      return { success: false, error: 'Lesson not found' };
    }
    
    return { success: true, data: lesson as LMSLesson };
  } catch (err) {
    return { success: false, error: 'Failed to update lesson' };
  }
}


/**
 * Delete a lesson
 */
export async function deleteLesson(id: string): Promise<LMSResult<void>> {
  try {
    const supabase = createAdminClient();
    
    const { error } = await supabase
      .from('lms_lessons')
      .delete()
      .eq('id', id);
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (err) {
    return { success: false, error: 'Failed to delete lesson' };
  }
}

/**
 * Get all lessons for a chapter, ordered by display_order
 */
export async function getLessonsByChapter(chapterId: string): Promise<LMSLesson[]> {
  try {
    const supabase = createAdminClient();
    
    const { data, error } = await supabase
      .from('lms_lessons')
      .select('*')
      .eq('chapter_id', chapterId)
      .order('display_order', { ascending: true });
    
    if (error || !data) {
      return [];
    }
    
    return data as LMSLesson[];
  } catch (err) {
    return [];
  }
}

/**
 * Get a lesson by ID
 */
export async function getLessonById(id: string): Promise<LMSLesson | null> {
  try {
    const supabase = createAdminClient();
    
    const { data, error } = await supabase
      .from('lms_lessons')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return data as LMSLesson;
  } catch (err) {
    return null;
  }
}

/**
 * Get a lesson with its chapter and topic info
 */
export async function getLessonWithContext(id: string): Promise<(LMSLesson & { chapter: { id: string; name: string; topic_id: string; topic: { id: string; name: string } } }) | null> {
  try {
    const supabase = createAdminClient();
    
    const { data, error } = await supabase
      .from('lms_lessons')
      .select(`
        *,
        chapter:lms_chapters (
          id,
          name,
          topic_id,
          topic:lms_topics (
            id,
            name
          )
        )
      `)
      .eq('id', id)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return data as any;
  } catch (err) {
    return null;
  }
}

/**
 * Reorder lessons within a chapter
 */
export async function reorderLessons(chapterId: string, orderedIds: string[]): Promise<LMSResult<void>> {
  try {
    const supabase = createAdminClient();
    
    // Update each lesson's display_order based on its position in the array
    const updates = orderedIds.map((id, index) => 
      supabase
        .from('lms_lessons')
        .update({ display_order: index })
        .eq('id', id)
        .eq('chapter_id', chapterId)
    );
    
    const results = await Promise.all(updates);
    
    const hasError = results.some(r => r.error);
    if (hasError) {
      return { success: false, error: 'Failed to reorder some lessons' };
    }
    
    return { success: true };
  } catch (err) {
    return { success: false, error: 'Failed to reorder lessons' };
  }
}

/**
 * Get all lessons for a topic (across all chapters)
 */
export async function getLessonsByTopic(topicId: string): Promise<LMSLesson[]> {
  try {
    const supabase = createAdminClient();
    
    const { data, error } = await supabase
      .from('lms_lessons')
      .select(`
        *,
        chapter:lms_chapters!inner (
          topic_id,
          display_order
        )
      `)
      .eq('chapter.topic_id', topicId)
      .order('chapter(display_order)', { ascending: true })
      .order('display_order', { ascending: true });
    
    if (error || !data) {
      return [];
    }
    
    return data as LMSLesson[];
  } catch (err) {
    return [];
  }
}
