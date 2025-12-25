import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase';
import type { AuthResult, SessionValidation, UserProfile } from '@/types';

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
 */
export async function authenticateUser(
  username: string,
  password: string
): Promise<AuthResult> {
  try {
    const serverSupabase = await createServerSupabaseClient();
    const email = usernameToEmail(username);
    
    console.log('Attempting login with email:', email);
    
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
    };
  } catch (err) {
    console.error('Auth error:', err);
    return { success: false, error: 'Authentication service unavailable' };
  }
}

/**
 * Log out the current user and invalidate their session
 */
export async function logout(): Promise<{ success: boolean; error?: string }> {
  try {
    const serverSupabase = await createServerSupabaseClient();
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

    // Check credential expiration
    const { data: profile, error: profileError } = await serverSupabase
      .from('user_profiles')
      .select('role, expires_at')
      .eq('user_id', session.user.id)
      .single();

    if (profileError || !profile) {
      return { valid: false, reason: 'profile_not_found' };
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
