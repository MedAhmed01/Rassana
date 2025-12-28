import { createAdminClient } from '@/lib/supabase';
import type { 
  LMSSubscription, 
  CreateSubscriptionRequest, 
  ExtendSubscriptionRequest,
  LMSResult,
  SubscriptionWithDetails 
} from '@/types/lms';

/**
 * Create a new subscription for a student to a topic
 */
export async function createSubscription(data: CreateSubscriptionRequest): Promise<LMSResult<LMSSubscription>> {
  try {
    const supabase = createAdminClient();
    
    // Validate dates
    const startsAt = data.starts_at ? new Date(data.starts_at) : new Date();
    const expiresAt = new Date(data.expires_at);
    
    if (expiresAt <= startsAt) {
      return { success: false, error: 'End date must be after start date' };
    }
    
    const { data: subscription, error } = await supabase
      .from('lms_subscriptions')
      .insert({
        student_id: data.student_id,
        topic_id: data.topic_id,
        starts_at: startsAt.toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();
    
    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'Student already has a subscription to this topic' };
      }
      if (error.code === '23503') {
        return { success: false, error: 'Student or topic not found' };
      }
      return { success: false, error: error.message };
    }
    
    return { success: true, data: subscription as LMSSubscription };
  } catch (err) {
    return { success: false, error: 'Failed to create subscription' };
  }
}

/**
 * Extend or renew a subscription
 */
export async function extendSubscription(id: string, data: ExtendSubscriptionRequest): Promise<LMSResult<LMSSubscription>> {
  try {
    const supabase = createAdminClient();
    
    const { data: current } = await supabase
      .from('lms_subscriptions')
      .select('*')
      .eq('id', id)
      .single();
    
    if (!current) {
      return { success: false, error: 'Subscription not found' };
    }
    
    const newExpiresAt = new Date(data.expires_at);
    const startsAt = new Date(current.starts_at);
    
    if (newExpiresAt <= startsAt) {
      return { success: false, error: 'End date must be after start date' };
    }
    
    const { data: subscription, error } = await supabase
      .from('lms_subscriptions')
      .update({ expires_at: newExpiresAt.toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true, data: subscription as LMSSubscription };
  } catch (err) {
    return { success: false, error: 'Failed to extend subscription' };
  }
}


/**
 * Get all subscriptions for a student
 */
export async function getSubscriptionsByStudent(studentId: string): Promise<LMSSubscription[]> {
  try {
    const supabase = createAdminClient();
    
    const { data, error } = await supabase
      .from('lms_subscriptions')
      .select(`
        *,
        topic:lms_topics (*)
      `)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });
    
    if (error || !data) {
      return [];
    }
    
    return data as LMSSubscription[];
  } catch (err) {
    return [];
  }
}

/**
 * Get all subscriptions for a topic
 */
export async function getSubscriptionsByTopic(topicId: string): Promise<LMSSubscription[]> {
  try {
    const supabase = createAdminClient();
    
    const { data, error } = await supabase
      .from('lms_subscriptions')
      .select(`
        *,
        student:lms_students (id, username, email, phone)
      `)
      .eq('topic_id', topicId)
      .order('created_at', { ascending: false });
    
    if (error || !data) {
      return [];
    }
    
    return data as LMSSubscription[];
  } catch (err) {
    return [];
  }
}

/**
 * Get all subscriptions with details
 */
export async function getAllSubscriptions(): Promise<SubscriptionWithDetails[]> {
  try {
    const supabase = createAdminClient();
    
    const { data, error } = await supabase
      .from('lms_subscriptions')
      .select(`
        *,
        topic:lms_topics (*),
        student:lms_students (id, username, email, phone, is_active)
      `)
      .order('created_at', { ascending: false });
    
    if (error || !data) {
      return [];
    }
    
    const now = new Date();
    return data.map((sub: any) => ({
      ...sub,
      is_active: new Date(sub.expires_at) > now,
    })) as SubscriptionWithDetails[];
  } catch (err) {
    return [];
  }
}

/**
 * Check if a student has an active subscription to a topic
 */
export async function checkSubscriptionActive(studentId: string, topicId: string): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    
    const { data, error } = await supabase
      .from('lms_subscriptions')
      .select('id, expires_at')
      .eq('student_id', studentId)
      .eq('topic_id', topicId)
      .single();
    
    if (error || !data) {
      return false;
    }
    
    return new Date(data.expires_at) > new Date();
  } catch (err) {
    return false;
  }
}

/**
 * Get a subscription by ID
 */
export async function getSubscriptionById(id: string): Promise<LMSSubscription | null> {
  try {
    const supabase = createAdminClient();
    
    const { data, error } = await supabase
      .from('lms_subscriptions')
      .select(`
        *,
        topic:lms_topics (*),
        student:lms_students (id, username, email, phone)
      `)
      .eq('id', id)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return data as LMSSubscription;
  } catch (err) {
    return null;
  }
}

/**
 * Get subscription for a student and topic
 */
export async function getSubscription(studentId: string, topicId: string): Promise<LMSSubscription | null> {
  try {
    const supabase = createAdminClient();
    
    const { data, error } = await supabase
      .from('lms_subscriptions')
      .select('*')
      .eq('student_id', studentId)
      .eq('topic_id', topicId)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return data as LMSSubscription;
  } catch (err) {
    return null;
  }
}

/**
 * Get active subscriptions for a student (not expired)
 */
export async function getActiveSubscriptionsByStudent(studentId: string): Promise<LMSSubscription[]> {
  try {
    const supabase = createAdminClient();
    
    const { data, error } = await supabase
      .from('lms_subscriptions')
      .select(`
        *,
        topic:lms_topics (*)
      `)
      .eq('student_id', studentId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });
    
    if (error || !data) {
      return [];
    }
    
    return data as LMSSubscription[];
  } catch (err) {
    return [];
  }
}

/**
 * Delete a subscription
 */
export async function deleteSubscription(id: string): Promise<LMSResult<void>> {
  try {
    const supabase = createAdminClient();
    
    const { error } = await supabase
      .from('lms_subscriptions')
      .delete()
      .eq('id', id);
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (err) {
    return { success: false, error: 'Failed to delete subscription' };
  }
}
