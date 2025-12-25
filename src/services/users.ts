import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase';
import { usernameToEmail } from './auth';
import type { CreateUserResult, UserCredentials, UserProfile } from '@/types';

/**
 * Create a new user with credentials, role, and expiration date
 * Only admins can create users (enforced by RLS)
 */
export async function createUser(credentials: UserCredentials): Promise<CreateUserResult> {
  try {
    const { username, password, role, expires_at } = credentials;
    
    // Validate required fields
    if (!username || username.trim().length === 0) {
      return { success: false, error: 'Username is required' };
    }
    
    if (!password || password.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters' };
    }
    
    if (!role || !['admin', 'student'].includes(role)) {
      return { success: false, error: 'Role must be either admin or student' };
    }
    
    if (!expires_at) {
      return { success: false, error: 'Expiration date is required' };
    }
    
    const expirationDate = new Date(expires_at);
    if (isNaN(expirationDate.getTime())) {
      return { success: false, error: 'Invalid expiration date' };
    }
    
    // Use admin client for user creation
    const adminClient = createAdminClient();
    const supabase = await createServerSupabaseClient();
    const email = usernameToEmail(username);
    
    // Create auth user
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role },
    });
    
    if (authError) {
      if (authError.message.includes('already') || authError.message.includes('exists')) {
        return { success: false, error: 'Username already exists' };
      }
      return { success: false, error: authError.message };
    }
    
    if (!authData.user) {
      return { success: false, error: 'Failed to create user' };
    }
    
    // Create user profile
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        user_id: authData.user.id,
        username,
        role,
        expires_at,
      });
    
    if (profileError) {
      // Rollback: delete the auth user if profile creation fails
      await adminClient.auth.admin.deleteUser(authData.user.id);
      
      if (profileError.code === '23505') {
        return { success: false, error: 'Username already exists' };
      }
      return { success: false, error: profileError.message };
    }
    
    return { success: true, userId: authData.user.id };
  } catch (err) {
    return { success: false, error: 'Failed to create user' };
  }
}

/**
 * Get all users (admin only)
 */
export async function getAllUsers(): Promise<UserProfile[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error || !data) {
    return [];
  }
  
  return data as UserProfile[];
}

/**
 * Get a user by ID
 */
export async function getUserById(userId: string): Promise<UserProfile | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (error || !data) {
    return null;
  }
  
  return data as UserProfile;
}

/**
 * Get a user by username
 */
export async function getUserByUsername(username: string): Promise<UserProfile | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('username', username)
    .single();
  
  if (error || !data) {
    return null;
  }
  
  return data as UserProfile;
}

/**
 * Delete a user (admin only)
 */
export async function deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const adminClient = createAdminClient();
    
    // Delete auth user (profile will be cascade deleted)
    const { error } = await adminClient.auth.admin.deleteUser(userId);
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (err) {
    return { success: false, error: 'Failed to delete user' };
  }
}

/**
 * Update user expiration date (admin only)
 */
export async function updateUserExpiration(
  userId: string,
  expiresAt: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from('user_profiles')
    .update({ expires_at: expiresAt })
    .eq('user_id', userId);
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  return { success: true };
}


/**
 * Force logout a user by clearing their session token and invalidating all Supabase sessions (admin only)
 * This allows the user to login again from any device
 */
export async function forceLogoutUser(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const adminClient = createAdminClient();
    
    // Clear the session token in the database
    const { error: updateError } = await adminClient
      .from('user_profiles')
      .update({ session_token: null })
      .eq('user_id', userId);
    
    if (updateError) {
      console.error('Error clearing session token:', updateError);
      return { success: false, error: updateError.message };
    }
    
    // Sign out all sessions for this user using Supabase Admin API
    // This invalidates all refresh tokens and forces re-authentication
    const { error: signOutError } = await adminClient.auth.admin.signOut(userId, 'global');
    
    if (signOutError) {
      console.error('Error signing out user sessions:', signOutError);
      // Continue anyway since we cleared the session token
    }
    
    return { success: true };
  } catch (err) {
    console.error('Force logout error:', err);
    return { success: false, error: 'Failed to logout user' };
  }
}
