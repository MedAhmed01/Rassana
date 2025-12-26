import { createAdminClient } from '@/lib/supabase';

export interface WatchProgress {
  id: string;
  user_id: string;
  card_id: string;
  progress_seconds: number;
  duration_seconds: number;
  last_watched_at: string;
  created_at: string;
  // Joined fields
  card_title?: string;
  video_url?: string;
}

/**
 * Save or update watch progress for a user
 */
export async function saveWatchProgress(
  userId: string,
  cardId: string,
  progressSeconds: number,
  durationSeconds: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createAdminClient();
    
    const { error } = await supabase
      .from('watch_progress')
      .upsert({
        user_id: userId,
        card_id: cardId,
        progress_seconds: progressSeconds,
        duration_seconds: durationSeconds,
        last_watched_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,card_id',
      });
    
    if (error) {
      console.error('Error saving watch progress:', error);
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (err) {
    console.error('Exception saving watch progress:', err);
    return { success: false, error: 'Failed to save progress' };
  }
}

/**
 * Get watch progress for a specific video
 */
export async function getWatchProgress(
  userId: string,
  cardId: string
): Promise<WatchProgress | null> {
  try {
    const supabase = createAdminClient();
    
    const { data, error } = await supabase
      .from('watch_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('card_id', cardId)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return data as WatchProgress;
  } catch (err) {
    return null;
  }
}

/**
 * Get the last watched video for a user (for "Continue Watching")
 * Falls back to access_logs if watch_progress table doesn't exist or is empty
 */
export async function getLastWatchedVideo(
  userId: string
): Promise<WatchProgress | null> {
  try {
    const supabase = createAdminClient();
    
    // First try to get from watch_progress table
    const { data: progressData, error: progressError } = await supabase
      .from('watch_progress')
      .select('*')
      .eq('user_id', userId)
      .order('last_watched_at', { ascending: false })
      .limit(10);
    
    console.log('watch_progress query result:', { progressData, progressError });
    
    // If watch_progress has data, use it
    if (!progressError && progressData && progressData.length > 0) {
      // Find first incomplete video (< 95% watched)
      const incompleteProgress = progressData.find((item: any) => {
        const percent = item.duration_seconds > 0 
          ? (item.progress_seconds / item.duration_seconds) * 100 
          : 0;
        return percent < 95;
      });
      
      const targetProgress = incompleteProgress || progressData[0];
      
      // Fetch card details
      const { data: cardData } = await supabase
        .from('cards')
        .select('title, video_url')
        .eq('card_id', targetProgress.card_id)
        .single();
      
      return {
        ...targetProgress,
        card_title: cardData?.title || null,
        video_url: cardData?.video_url || null,
      } as WatchProgress;
    }
    
    // Fallback: Use access_logs to get last watched video
    console.log('Falling back to access_logs for user:', userId);
    
    // Get ALL recent access logs to debug
    const { data: allLogs, error: allLogsError } = await supabase
      .from('access_logs')
      .select('*')
      .eq('user_id', userId)
      .order('accessed_at', { ascending: false })
      .limit(5);
    
    console.log('All recent access logs:', allLogs);
    console.log('Access logs error:', allLogsError);
    
    if (!allLogs || allLogs.length === 0) {
      console.log('No access logs found for user');
      return null;
    }
    
    // Use the most recent one
    const accessData = allLogs[0];
    console.log('Using most recent access log:', accessData);
    
    // Get card details
    const { data: cardData, error: cardError } = await supabase
      .from('cards')
      .select('title, video_url')
      .eq('card_id', accessData.card_id)
      .single();
    
    console.log('Card data:', cardData, 'Card error:', cardError);
    
    // Return as WatchProgress format (with 0 progress since we don't have that data)
    return {
      id: accessData.id,
      user_id: accessData.user_id,
      card_id: accessData.card_id,
      progress_seconds: 0,
      duration_seconds: 0,
      last_watched_at: accessData.accessed_at,
      created_at: accessData.accessed_at,
      card_title: cardData?.title || null,
      video_url: cardData?.video_url || null,
    } as WatchProgress;
  } catch (err) {
    console.error('Exception getting last watched:', err);
    return null;
  }
}

/**
 * Get all watch progress for a user
 */
export async function getUserWatchHistory(
  userId: string,
  limit: number = 10
): Promise<WatchProgress[]> {
  try {
    const supabase = createAdminClient();
    
    // Get watch progress
    const { data: progressData, error: progressError } = await supabase
      .from('watch_progress')
      .select('*')
      .eq('user_id', userId)
      .order('last_watched_at', { ascending: false })
      .limit(limit);
    
    if (progressError || !progressData) {
      return [];
    }
    
    // Get card details for each progress entry
    const cardIds = progressData.map((p: any) => p.card_id);
    const { data: cardsData } = await supabase
      .from('cards')
      .select('card_id, title, video_url')
      .in('card_id', cardIds);
    
    const cardsMap = new Map(
      (cardsData || []).map((c: any) => [c.card_id, c])
    );
    
    return progressData.map((item: any) => {
      const card = cardsMap.get(item.card_id);
      return {
        ...item,
        card_title: card?.title || null,
        video_url: card?.video_url || null,
      };
    }) as WatchProgress[];
  } catch (err) {
    return [];
  }
}
