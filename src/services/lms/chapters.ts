import { createAdminClient } from '@/lib/supabase';
import type { 
  LMSChapter, 
  CreateChapterRequest, 
  UpdateChapterRequest, 
  LMSResult 
} from '@/types/lms';

/**
 * Create a new chapter within a topic
 */
export async function createChapter(data: CreateChapterRequest): Promise<LMSResult<LMSChapter>> {
  try {
    const supabase = createAdminClient();
    
    // Get the max display_order for this topic
    const { data: maxOrder } = await supabase
      .from('lms_chapters')
      .select('display_order')
      .eq('topic_id', data.topic_id)
      .order('display_order', { ascending: false })
      .limit(1)
      .single();
    
    const newOrder = (maxOrder?.display_order ?? -1) + 1;
    
    const { data: chapter, error } = await supabase
      .from('lms_chapters')
      .insert({
        topic_id: data.topic_id,
        name: data.name,
        description: data.description || null,
        display_order: newOrder,
      })
      .select()
      .single();
    
    if (error) {
      if (error.code === '23503') {
        return { success: false, error: 'Topic not found' };
      }
      return { success: false, error: error.message };
    }
    
    return { success: true, data: chapter as LMSChapter };
  } catch (err) {
    return { success: false, error: 'Failed to create chapter' };
  }
}

/**
 * Update an existing chapter
 */
export async function updateChapter(id: string, data: UpdateChapterRequest): Promise<LMSResult<LMSChapter>> {
  try {
    const supabase = createAdminClient();
    
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description || null;
    if (data.display_order !== undefined) updateData.display_order = data.display_order;
    
    const { data: chapter, error } = await supabase
      .from('lms_chapters')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    if (!chapter) {
      return { success: false, error: 'Chapter not found' };
    }
    
    return { success: true, data: chapter as LMSChapter };
  } catch (err) {
    return { success: false, error: 'Failed to update chapter' };
  }
}

/**
 * Delete a chapter (cascades to lessons)
 */
export async function deleteChapter(id: string): Promise<LMSResult<void>> {
  try {
    const supabase = createAdminClient();
    
    const { error } = await supabase
      .from('lms_chapters')
      .delete()
      .eq('id', id);
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (err) {
    return { success: false, error: 'Failed to delete chapter' };
  }
}


/**
 * Get all chapters for a topic, ordered by display_order
 */
export async function getChaptersByTopic(topicId: string): Promise<LMSChapter[]> {
  try {
    const supabase = createAdminClient();
    
    const { data, error } = await supabase
      .from('lms_chapters')
      .select('*')
      .eq('topic_id', topicId)
      .order('display_order', { ascending: true });
    
    if (error || !data) {
      return [];
    }
    
    return data as LMSChapter[];
  } catch (err) {
    return [];
  }
}

/**
 * Get all chapters for a topic with their lessons
 */
export async function getChaptersWithLessons(topicId: string): Promise<LMSChapter[]> {
  try {
    const supabase = createAdminClient();
    
    const { data, error } = await supabase
      .from('lms_chapters')
      .select(`
        *,
        lessons:lms_lessons (*)
      `)
      .eq('topic_id', topicId)
      .order('display_order', { ascending: true });
    
    if (error || !data) {
      return [];
    }
    
    // Sort lessons within each chapter
    return data.map((chapter: any) => ({
      ...chapter,
      lessons: (chapter.lessons || []).sort(
        (a: any, b: any) => a.display_order - b.display_order
      ),
    })) as LMSChapter[];
  } catch (err) {
    return [];
  }
}

/**
 * Get a chapter by ID
 */
export async function getChapterById(id: string): Promise<LMSChapter | null> {
  try {
    const supabase = createAdminClient();
    
    const { data, error } = await supabase
      .from('lms_chapters')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return data as LMSChapter;
  } catch (err) {
    return null;
  }
}

/**
 * Reorder chapters within a topic
 */
export async function reorderChapters(topicId: string, orderedIds: string[]): Promise<LMSResult<void>> {
  try {
    const supabase = createAdminClient();
    
    // Update each chapter's display_order based on its position in the array
    const updates = orderedIds.map((id, index) => 
      supabase
        .from('lms_chapters')
        .update({ display_order: index })
        .eq('id', id)
        .eq('topic_id', topicId)
    );
    
    const results = await Promise.all(updates);
    
    const hasError = results.some(r => r.error);
    if (hasError) {
      return { success: false, error: 'Failed to reorder some chapters' };
    }
    
    return { success: true };
  } catch (err) {
    return { success: false, error: 'Failed to reorder chapters' };
  }
}
