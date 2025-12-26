import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase';
import type { Card, CardCreateRequest, CardResult } from '@/types';

/**
 * Validate YouTube URL format
 */
export function isValidYouTubeUrl(url: string): boolean {
  const patterns = [
    /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
    /^https?:\/\/youtu\.be\/[\w-]+/,
    /^https?:\/\/(www\.)?youtube\.com\/embed\/[\w-]+/,
  ];
  return patterns.some(pattern => pattern.test(url));
}

/**
 * Create a new card-video mapping (admin operation - bypasses RLS)
 */
export async function insertCard(request: CardCreateRequest): Promise<CardResult> {
  try {
    const { card_id, video_url, title, subject, required_subscriptions } = request;
    
    // Validate required fields
    if (!card_id || card_id.trim().length === 0) {
      return { success: false, error: 'Card ID is required' };
    }
    
    if (!video_url || video_url.trim().length === 0) {
      return { success: false, error: 'Video URL is required' };
    }
    
    if (!isValidYouTubeUrl(video_url)) {
      return { success: false, error: 'Please provide a valid YouTube URL' };
    }
    
    // Use admin client to bypass RLS
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('cards')
      .insert({
        card_id,
        video_url,
        title: title || null,
        subject: subject || null,
        required_subscriptions: required_subscriptions || [],
      })
      .select()
      .single();
    
    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'Card ID already exists' };
      }
      return { success: false, error: error.message };
    }
    
    return { success: true, card: data as Card };
  } catch (err) {
    return { success: false, error: 'Failed to create card' };
  }
}

/**
 * Update a card (admin operation - bypasses RLS)
 */
export async function updateCard(
  id: string,
  updates: { video_url?: string; title?: string; subject?: string; required_subscriptions?: string[] }
): Promise<CardResult> {
  try {
    if (updates.video_url && !isValidYouTubeUrl(updates.video_url)) {
      return { success: false, error: 'Please provide a valid YouTube URL' };
    }
    
    const updateData: Record<string, any> = {};
    if (updates.video_url) updateData.video_url = updates.video_url;
    if (updates.title !== undefined) updateData.title = updates.title || null;
    if (updates.subject !== undefined) updateData.subject = updates.subject || null;
    if (updates.required_subscriptions !== undefined) updateData.required_subscriptions = updates.required_subscriptions;
    
    // Use admin client to bypass RLS
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('cards')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    if (!data) {
      return { success: false, error: 'Card not found' };
    }
    
    return { success: true, card: data as Card };
  } catch (err) {
    return { success: false, error: 'Failed to update card' };
  }
}

/**
 * Get video URL for a card (uses server client - respects RLS)
 */
export async function queryVideoUrl(cardId: string): Promise<string | null> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('cards')
      .select('video_url')
      .eq('card_id', cardId)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return data.video_url;
  } catch (err) {
    return null;
  }
}

/**
 * Get a card by ID
 */
export async function getCardById(cardId: string): Promise<Card | null> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .eq('card_id', cardId)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return data as Card;
  } catch (err) {
    return null;
  }
}

/**
 * Get all cards (admin operation - bypasses RLS)
 */
export async function getAllCards(): Promise<Card[]> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error || !data) {
      return [];
    }
    
    return data as Card[];
  } catch (err) {
    return [];
  }
}

/**
 * Delete a card (admin operation - bypasses RLS)
 */
export async function deleteCard(cardId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from('cards')
      .delete()
      .eq('id', cardId);
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (err) {
    return { success: false, error: 'Failed to delete card' };
  }
}
