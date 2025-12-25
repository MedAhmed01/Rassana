import { createServerSupabaseClient } from '@/lib/supabase';
import type { AccessLog, AccessLogFilters } from '@/types';

/**
 * Log a video access event
 */
export async function logVideoAccess(
  userId: string,
  cardId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from('access_logs')
      .insert({
        user_id: userId,
        card_id: cardId,
        accessed_at: new Date().toISOString(),
      });
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (err) {
    return { success: false, error: 'Failed to log access' };
  }
}

/**
 * Get access logs with optional filtering
 * Admin only - enforced by RLS
 */
export async function getAccessLogs(filters?: AccessLogFilters): Promise<AccessLog[]> {
  try {
    const supabase = await createServerSupabaseClient();
    let query = supabase
      .from('access_logs')
      .select('*');
    
    if (filters?.userId) {
      query = query.eq('user_id', filters.userId);
    }
    
    if (filters?.cardId) {
      query = query.eq('card_id', filters.cardId);
    }
    
    if (filters?.startDate) {
      query = query.gte('accessed_at', filters.startDate);
    }
    
    if (filters?.endDate) {
      query = query.lte('accessed_at', filters.endDate);
    }
    
    query = query.order('accessed_at', { ascending: false });
    
    const { data, error } = await query;
    
    if (error || !data) {
      return [];
    }
    
    return data as AccessLog[];
  } catch (err) {
    return [];
  }
}

/**
 * Get access logs with user and card details
 * Admin only - enforced by RLS
 */
export async function getAccessLogsWithDetails(filters?: AccessLogFilters): Promise<AccessLog[]> {
  try {
    const supabase = await createServerSupabaseClient();
    let query = supabase
      .from('access_logs')
      .select(`
        *,
        user_profiles!inner(username),
        cards!inner(title)
      `);
    
    if (filters?.userId) {
      query = query.eq('user_id', filters.userId);
    }
    
    if (filters?.cardId) {
      query = query.eq('card_id', filters.cardId);
    }
    
    if (filters?.startDate) {
      query = query.gte('accessed_at', filters.startDate);
    }
    
    if (filters?.endDate) {
      query = query.lte('accessed_at', filters.endDate);
    }
    
    query = query.order('accessed_at', { ascending: false });
    
    const { data, error } = await query;
    
    if (error || !data) {
      console.error('Error fetching access logs:', error);
      return [];
    }
    
    // Transform the data to flatten the joined fields
    return data.map((log: any) => ({
      id: log.id,
      user_id: log.user_id,
      card_id: log.card_id,
      accessed_at: log.accessed_at,
      username: log.user_profiles?.username || 'Unknown',
      card_title: log.cards?.title || log.card_id,
    })) as AccessLog[];
  } catch (err) {
    console.error('Exception fetching access logs:', err);
    return [];
  }
}

/**
 * Get access count for a specific card
 */
export async function getCardAccessCount(cardId: string): Promise<number> {
  try {
    const logs = await getAccessLogs({ cardId });
    return logs.length;
  } catch (err) {
    return 0;
  }
}

/**
 * Get access count for a specific user
 */
export async function getUserAccessCount(userId: string): Promise<number> {
  try {
    const logs = await getAccessLogs({ userId });
    return logs.length;
  } catch (err) {
    return 0;
  }
}
