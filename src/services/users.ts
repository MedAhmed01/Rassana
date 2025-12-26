import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase';
import { usernameToEmail } from './auth';
import type { CreateUserResult, UserCredentials, UserProfile } from '@/types';

/**
 * Create a new user with credentials, role, and expiration date
 * Only admins can create users (enforced by RLS)
 */
export async function createUser(credentials: UserCredentials): Promise<CreateUserResult> {
  try {
    const { username, password, role, subscriptions, expires_at } = credentials;
    
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
    
    // For students, expiration date is required. For admins, set to far future (100 years)
    let finalExpiresAt: string;
    if (role === 'admin') {
      const farFuture = new Date();
      farFuture.setFullYear(farFuture.getFullYear() + 100);
      finalExpiresAt = farFuture.toISOString();
    } else if (!expires_at) {
      return { success: false, error: 'Expiration date is required for students' };
    } else {
      finalExpiresAt = expires_at;
    }
    
    const expirationDate = new Date(finalExpiresAt);
    if (isNaN(expirationDate.getTime())) {
      return { success: false, error: 'Invalid expiration date' };
    }
    
    // Use admin client for user creation
    const adminClient = createAdminClient();
    if (!adminClient) {
      return { success: false, error: 'Admin client not configured. Check SUPABASE_SERVICE_ROLE_KEY.' };
    }
    
    const supabase = await createServerSupabaseClient();
    const email = usernameToEmail(username);
    
    console.log('Creating auth user with email:', email);
    
    // Create auth user
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role },
    });
    
    if (authError) {
      console.error('Auth user creation error:', authError);
      if (authError.message.includes('already') || authError.message.includes('exists')) {
        return { success: false, error: 'Username already exists' };
      }
      if (authError.message.includes('Database error')) {
        return { success: false, error: 'Database error - please check Supabase configuration and try again' };
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
        subscriptions: role === 'admin' ? [] : (subscriptions || []),
        expires_at: finalExpiresAt,
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
 * Get all users (admin only - bypasses RLS)
 */
export async function getAllUsers(): Promise<UserProfile[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error || !data) {
    console.error('Error fetching users:', error);
    return [];
  }
  
  return data as UserProfile[];
}

/**
 * Get a user by ID (admin operation - bypasses RLS)
 */
export async function getUserById(userId: string): Promise<UserProfile | null> {
  const supabase = createAdminClient();
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
 * Get a user by username (admin operation - bypasses RLS)
 */
export async function getUserByUsername(username: string): Promise<UserProfile | null> {
  const supabase = createAdminClient();
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
 * Update user expiration date (admin only - bypasses RLS)
 */
export async function updateUserExpiration(
  userId: string,
  expiresAt: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();
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
    
    // Set force_logout_at timestamp and clear session token
    const forceLogoutAt = new Date().toISOString();
    
    // Try to update with force_logout_at, fall back to just session_token if column doesn't exist
    let updateError = null;
    const updateResult = await adminClient
      .from('user_profiles')
      .update({ 
        session_token: null,
        force_logout_at: forceLogoutAt
      })
      .eq('user_id', userId);
    
    updateError = updateResult.error;
    
    // If force_logout_at column doesn't exist, try without it
    if (updateError && updateError.message?.includes('column')) {
      const fallbackResult = await adminClient
        .from('user_profiles')
        .update({ session_token: null })
        .eq('user_id', userId);
      updateError = fallbackResult.error;
    }
    
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
