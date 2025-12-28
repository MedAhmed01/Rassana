import { createAdminClient } from '@/lib/supabase';
import type { 
  LMSTopic, 
  CreateTopicRequest, 
  UpdateTopicRequest, 
  LMSResult,
  TopicWithStats 
} from '@/types/lms';

/**
 * Create a new topic
 */
export async function createTopic(data: CreateTopicRequest): Promise<LMSResult<LMSTopic>> {
  try {
    const supabase = createAdminClient();
    
    // Get the max display_order to add new topic at the end
    const { data: maxOrder } = await supabase
      .from('lms_topics')
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1)
      .single();
    
    const newOrder = (maxOrder?.display_order ?? -1) + 1;
    
    const { data: topic, error } = await supabase
      .from('lms_topics')
      .insert({
        name: data.name,
        description: data.description || null,
        is_free: data.is_free || false,
        display_order: newOrder,
      })
      .select()
      .single();
    
    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'A topic with this name already exists' };
      }
      return { success: false, error: error.message };
    }
    
    return { success: true, data: topic as LMSTopic };
  } catch (err) {
    return { success: false, error: 'Failed to create topic' };
  }
}

/**
 * Update an existing topic
 */
export async function updateTopic(id: string, data: UpdateTopicRequest): Promise<LMSResult<LMSTopic>> {
  try {
    const supabase = createAdminClient();
    
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description || null;
    if (data.display_order !== undefined) updateData.display_order = data.display_order;
    if (data.is_free !== undefined) updateData.is_free = data.is_free;
    
    const { data: topic, error } = await supabase
      .from('lms_topics')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    if (!topic) {
      return { success: false, error: 'Topic not found' };
    }
    
    return { success: true, data: topic as LMSTopic };
  } catch (err) {
    return { success: false, error: 'Failed to update topic' };
  }
}

/**
 * Delete a topic (cascades to chapters and lessons)
 */
export async function deleteTopic(id: string): Promise<LMSResult<void>> {
  try {
    const supabase = createAdminClient();
    
    const { error } = await supabase
      .from('lms_topics')
      .delete()
      .eq('id', id);
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (err) {
    return { success: false, error: 'Failed to delete topic' };
  }
}


/**
 * Get all topics ordered by display_order
 */
export async function getAllTopics(): Promise<LMSTopic[]> {
  try {
    const supabase = createAdminClient();
    
    const { data, error } = await supabase
      .from('lms_topics')
      .select('*')
      .order('display_order', { ascending: true });
    
    if (error || !data) {
      return [];
    }
    
    return data as LMSTopic[];
  } catch (err) {
    return [];
  }
}

/**
 * Get all topics with chapter and lesson counts
 */
export async function getAllTopicsWithStats(): Promise<TopicWithStats[]> {
  try {
    const supabase = createAdminClient();
    
    const { data: topics, error } = await supabase
      .from('lms_topics')
      .select(`
        *,
        lms_chapters (
          id,
          lms_lessons (id)
        )
      `)
      .order('display_order', { ascending: true });
    
    if (error || !topics) {
      return [];
    }
    
    return topics.map((topic: any) => ({
      id: topic.id,
      name: topic.name,
      description: topic.description,
      is_free: topic.is_free,
      display_order: topic.display_order,
      created_at: topic.created_at,
      updated_at: topic.updated_at,
      chapter_count: topic.lms_chapters?.length || 0,
      lesson_count: topic.lms_chapters?.reduce(
        (sum: number, ch: any) => sum + (ch.lms_lessons?.length || 0), 
        0
      ) || 0,
    }));
  } catch (err) {
    return [];
  }
}

/**
 * Get a topic by ID
 */
export async function getTopicById(id: string): Promise<LMSTopic | null> {
  try {
    const supabase = createAdminClient();
    
    const { data, error } = await supabase
      .from('lms_topics')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return data as LMSTopic;
  } catch (err) {
    return null;
  }
}

/**
 * Reorder topics by providing an array of IDs in the desired order
 */
export async function reorderTopics(orderedIds: string[]): Promise<LMSResult<void>> {
  try {
    const supabase = createAdminClient();
    
    // Update each topic's display_order based on its position in the array
    const updates = orderedIds.map((id, index) => 
      supabase
        .from('lms_topics')
        .update({ display_order: index })
        .eq('id', id)
    );
    
    const results = await Promise.all(updates);
    
    const hasError = results.some(r => r.error);
    if (hasError) {
      return { success: false, error: 'Failed to reorder some topics' };
    }
    
    return { success: true };
  } catch (err) {
    return { success: false, error: 'Failed to reorder topics' };
  }
}


/**
 * Get all topics with full chapters and lessons data (for admin UI)
 */
export async function getAllTopicsWithChaptersAndLessons(): Promise<any[]> {
  try {
    const supabase = createAdminClient();
    
    const { data: topics, error } = await supabase
      .from('lms_topics')
      .select(`
        *,
        chapters:lms_chapters (
          id,
          topic_id,
          name,
          description,
          display_order,
          lessons:lms_lessons (
            id,
            chapter_id,
            title,
            description,
            youtube_url,
            duration_seconds,
            display_order
          )
        )
      `)
      .order('display_order', { ascending: true });
    
    if (error || !topics) {
      return [];
    }
    
    // Sort chapters and lessons by display_order
    return topics.map((topic: any) => ({
      ...topic,
      chapters: (topic.chapters || [])
        .sort((a: any, b: any) => a.display_order - b.display_order)
        .map((chapter: any) => ({
          ...chapter,
          lessons: (chapter.lessons || []).sort((a: any, b: any) => a.display_order - b.display_order),
        })),
    }));
  } catch (err) {
    return [];
  }
}
