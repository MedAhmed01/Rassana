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
 * Checks credential expiration and enforces single session for students
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
    let preCheckProfile: { user_id: string; username: string; role: string; expires_at: string; session_token?: string; last_login_at?: string } | null = null;
    
    if (isPhone) {
      // Look up profile by phone number
      const { data: profile } = await adminClient
        .from('user_profiles')
        .select('user_id, username, role, expires_at, session_token, last_login_at')
        .eq('phone', usernameOrPhone.trim())
        .single();
      
      if (!profile) {
        return { success: false, error: 'Invalid phone number or password' };
      }
      email = usernameToEmail(profile.username);
      preCheckProfile = profile;
    } else {
      // Look up profile by username
      const { data: profile } = await adminClient
        .from('user_profiles')
        .select('user_id, username, role, expires_at, session_token, last_login_at')
        .eq('username', usernameOrPhone.trim())
        .single();
      
      email = usernameToEmail(usernameOrPhone);
      preCheckProfile = profile;
    }
    
    // Check for existing active session BEFORE authenticating (students only)
    if (preCheckProfile && preCheckProfile.role === 'student' && preCheckProfile.session_token) {
      // There's an active session - block login
      return { 
        success: false, 
        error: 'This account is already logged in on another device. Please logout from the other device first or contact an administrator.' 
      };
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
      console.error('Profile not found for user:', data.user.id, profileError);
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

    // Generate new session token and update profile
    let sessionToken: string | undefined;
    try {
      sessionToken = uuidv4();
      const { error: updateError } = await adminClient
        .from('user_profiles')
        .update({ 
          session_token: sessionToken,
          last_login_at: new Date().toISOString(),
        })
        .eq('user_id', data.user.id);
      
      if (updateError) {
        console.error('Failed to update session token:', updateError);
        sessionToken = undefined;
      }
    } catch (e) {
      console.log('Session columns may not exist yet:', e);
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
      sessionToken,
    };
  } catch (err) {
    console.error('Auth error:', err);
    return { success: false, error: 'Authentication service unavailable' };
  }
}

/**
 * Log out the current user and clear session token
 */
export async function logout(): Promise<{ success: boolean; error?: string }> {
  try {
    const serverSupabase = await createServerSupabaseClient();
    const adminClient = createAdminClient();
    
    // Get current user
    const { data: { user } } = await serverSupabase.auth.getUser();
    
    // Clear session token in profile
    if (user) {
      await adminClient
        .from('user_profiles')
        .update({ session_token: null })
        .eq('user_id', user.id);
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
 * Also checks for force logout
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
    
    // First get basic profile info
    const { data: profile, error: profileError } = await adminClient
      .from('user_profiles')
      .select('role, expires_at')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return { valid: false, reason: 'profile_not_found' };
    }

    // Check if credentials have expired
    const expiresAt = new Date(profile.expires_at);
    if (expiresAt < new Date()) {
      await serverSupabase.auth.signOut();
      return { valid: false, reason: 'expired' };
    }

    // Try to check session columns (may not exist if migrations not applied)
    let sessionToken: string | null = null;
    try {
      const { data: sessionData } = await adminClient
        .from('user_profiles')
        .select('session_token, force_logout_at, last_login_at')
        .eq('user_id', user.id)
        .single();

      if (sessionData) {
        sessionToken = sessionData.session_token;
        
        // Check if user was force logged out (for students)
        if (profile.role === 'student' && sessionData.force_logout_at && sessionData.last_login_at) {
          const forceLogoutAt = new Date(sessionData.force_logout_at);
          const lastLoginAt = new Date(sessionData.last_login_at);
          
          // If force_logout_at is after last_login_at, session is invalid
          if (forceLogoutAt > lastLoginAt) {
            await serverSupabase.auth.signOut();
            return { valid: false, reason: 'force_logout' };
          }
        }

        // Check if session token was cleared (another device logged in or admin force logout)
        if (profile.role === 'student' && !sessionData.session_token) {
          await serverSupabase.auth.signOut();
          return { valid: false, reason: 'session_invalidated' };
        }
      }
    } catch (e) {
      console.log('Session columns may not exist yet:', e);
      // Continue without session validation if columns don't exist
    }

    return {
      valid: true,
      role: profile.role as 'admin' | 'student',
      sessionToken: sessionToken ?? undefined,
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

/**
 * Force logout a user (admin only)
 */
export async function forceLogoutUser(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const adminClient = createAdminClient();
    
    // Update force_logout_at and clear session_token
    const { error } = await adminClient
      .from('user_profiles')
      .update({ 
        force_logout_at: new Date().toISOString(),
        session_token: null,
      })
      .eq('user_id', userId);
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    // Also try to sign out all sessions via Supabase Admin API
    try {
      await adminClient.auth.admin.signOut(userId, 'global');
    } catch (e) {
      console.log('Could not sign out via admin API:', e);
    }
    
    return { success: true };
  } catch (err) {
    return { success: false, error: 'Force logout failed' };
  }
}
