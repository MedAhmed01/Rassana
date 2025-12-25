import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase';
import type { AuthResult, SessionValidation, UserProfile } from '@/types';
import { v4 as uuidv4 } from 'uuid';

// Email domain used for username-based auth (Supabase requires email format)
const EMAIL_DOMAIN = '@cardgame.local';

/**
 * Convert username to email format for Supabase Auth
 */
export function usernameToEmail(username: string): string {
  return `${username}${EMAIL_DOMAIN}`;
}

/**
 * Extract username from email format
 */
export function emailToUsername(email: string): string {
  return email.replace(EMAIL_DOMAIN, '');
}

/**
 * Authenticate a user with username and password
 * Checks credential expiration after successful auth
 * Blocks login if user already has an active session (prevents account sharing)
 */
export async function authenticateUser(
  username: string,
  password: string
): Promise<AuthResult> {
  try {
    const serverSupabase = await createServerSupabaseClient();
    const adminClient = createAdminClient();
    const email = usernameToEmail(username);
    
    console.log('Attempting login with email:', email);
    
    // First check if user already has an active session
    const { data: existingProfile } = await adminClient
      .from('user_profiles')
      .select('session_token, user_id')
      .eq('username', username)
      .single();
    
    if (existingProfile?.session_token) {
      return { 
        success: false, 
        error: 'This account is already logged in on another device. Please logout first.' 
      };
    }
    
    const { data, error } = await serverSupabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.log('Supabase auth error:', error.message, error.status);
      return { success: false, error: 'Invalid username or password' };
    }

    if (!data.session || !data.user) {
      return { success: false, error: 'Authentication failed' };
    }

    // Check credential expiration
    const { data: profile, error: profileError } = await serverSupabase
      .from('user_profiles')
      .select('role, expires_at')
      .eq('user_id', data.user.id)
      .single();

    if (profileError || !profile) {
      await serverSupabase.auth.signOut();
      return { success: false, error: 'User profile not found' };
    }

    // Check if credentials have expired
    const expiresAt = new Date(profile.expires_at);
    if (expiresAt < new Date()) {
      await serverSupabase.auth.signOut();
      return { 
        success: false, 
        error: 'Your credentials have expired. Please contact an administrator.' 
      };
    }

    // Generate new session token to mark user as logged in
    const newSessionToken = uuidv4();
    const { error: updateError } = await adminClient
      .from('user_profiles')
      .update({ session_token: newSessionToken })
      .eq('user_id', data.user.id);

    if (updateError) {
      console.error('Failed to update session token:', updateError);
    }

    return {
      success: true,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at ?? 0,
        user: {
          id: data.user.id,
          email: data.user.email ?? '',
        },
      },
      role: profile.role as 'admin' | 'student',
      sessionToken: newSessionToken,
    };
  } catch (err) {
    console.error('Auth error:', err);
    return { success: false, error: 'Authentication service unavailable' };
  }
}

/**
 * Log out the current user and invalidate their session
 * Clears the session token to allow login from other devices
 */
export async function logout(): Promise<{ success: boolean; error?: string }> {
  try {
    const serverSupabase = await createServerSupabaseClient();
    const adminClient = createAdminClient();
    
    // Get current user to clear their session token
    const { data: { session } } = await serverSupabase.auth.getSession();
    
    if (session?.user?.id) {
      // Clear session token to allow new logins
      await adminClient
        .from('user_profiles')
        .update({ session_token: null })
        .eq('user_id', session.user.id);
    }
    
    const { error } = await serverSupabase.auth.signOut();
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (err) {
    return { success: false, error: 'Logout failed' };
  }
}

/**
 * Validate the current session and check credential expiration
 * Uses server-side Supabase client for proper cookie handling
 */
export async function validateSession(): Promise<SessionValidation> {
  try {
    const serverSupabase = await createServerSupabaseClient();
    const { data: { session }, error } = await serverSupabase.auth.getSession();

    if (error || !session) {
      return { valid: false, reason: 'no_session' };
    }

    // Check credential expiration and session token
    const { data: profile, error: profileError } = await serverSupabase
      .from('user_profiles')
      .select('role, expires_at, session_token')
      .eq('user_id', session.user.id)
      .single();

    if (profileError || !profile) {
      return { valid: false, reason: 'profile_not_found' };
    }

    // Check if session token is null (user was force logged out)
    if (!profile.session_token) {
      return { valid: false, reason: 'logged_out' };
    }

    const expiresAt = new Date(profile.expires_at);
    if (expiresAt < new Date()) {
      return { valid: false, reason: 'expired' };
    }

    return {
      valid: true,
      role: profile.role as 'admin' | 'student',
    };
  } catch (err) {
    return { valid: false, reason: 'error' };
  }
}

/**
 * Get the current user's profile
 */
export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  try {
    const serverSupabase = await createServerSupabaseClient();
    const { data: { session } } = await serverSupabase.auth.getSession();
    
    if (!session) {
      return null;
    }

    const { data: profile, error } = await serverSupabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', session.user.id)
      .single();

    if (error || !profile) {
      return null;
    }

    return profile as UserProfile;
  } catch (err) {
    return null;
  }
}

/**
 * Check if the current user has admin role
 */
export async function isAdmin(): Promise<boolean> {
  const validation = await validateSession();
  return validation.valid && validation.role === 'admin';
}
