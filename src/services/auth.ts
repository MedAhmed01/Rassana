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
 * Authenticate a user with username/phone and password
 * Checks credential expiration after successful auth
 */
export async function authenticateUser(
  usernameOrPhone: string,
  password: string
): Promise<AuthResult> {
  try {
    const serverSupabase = await createServerSupabaseClient();
    const adminClient = createAdminClient();
    
    // Check if input looks like a phone number (starts with + or contains only digits)
    const isPhone = /^[\d+][\d\s-]*$/.test(usernameOrPhone.trim());
    
    let email: string;
    
    if (isPhone) {
      // Look up username by phone number
      const { data: profile } = await adminClient
        .from('user_profiles')
        .select('username')
        .eq('phone', usernameOrPhone.trim())
        .single();
      
      if (!profile) {
        return { success: false, error: 'Invalid phone number or password' };
      }
      email = usernameToEmail(profile.username);
    } else {
      email = usernameToEmail(usernameOrPhone);
    }
    
    console.log('Attempting login with:', { usernameOrPhone, email, password: '***' });
    
    const { data, error } = await serverSupabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Supabase auth error:', error);
      return { success: false, error: 'Invalid username/phone or password' };
    }

    if (!data.session || !data.user) {
      return { success: false, error: 'Authentication failed' };
    }

    // Use admin client to check profile (bypasses RLS)
    const { data: profile, error: profileError } = await adminClient
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
 * Log out the current user
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
    const { data: { user }, error } = await serverSupabase.auth.getUser();

    if (error || !user) {
      return { valid: false, reason: 'no_session' };
    }

    // Use admin client to check profile (bypasses RLS)
    const adminClient = createAdminClient();
    const { data: profile, error: profileError } = await adminClient
      .from('user_profiles')
      .select('role, expires_at')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return { valid: false, reason: 'profile_not_found' };
    }

    const expiresAt = new Date(profile.expires_at);
    if (expiresAt < new Date()) {
      // Clear session for expired credentials
      await serverSupabase.auth.signOut();
      return { valid: false, reason: 'expired' };
    }

    return {
      valid: true,
      role: profile.role as 'admin' | 'student',
    };
  } catch (err) {
    console.error('Session validation error:', err);
    return { valid: false, reason: 'error' };
  }
}

/**
 * Get the current user's profile
 */
export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  try {
    const serverSupabase = await createServerSupabaseClient();
    const { data: { user } } = await serverSupabase.auth.getUser();
    
    if (!user) {
      return null;
    }

    // Use admin client to get profile (bypasses RLS)
    const adminClient = createAdminClient();
    const { data: profile, error } = await adminClient
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
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
