import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase';
import { cookies } from 'next/headers';
import type { AuthResult, SessionValidation, UserProfile } from '@/types';
import { v4 as uuidv4 } from 'uuid';

// Email domain used for username-based auth (Supabase requires email format)
const EMAIL_DOMAIN = '@cardgame.local';

// Cookie name for the app-level session ID (stored in user_sessions table)
export const SESSION_COOKIE = 'app_session_id';

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
 * Get the active global device binding mode from system_settings.
 * Returns 'off' | 'per_user' | 'all'
 */
async function getDeviceBindingMode(adminClient: ReturnType<typeof createAdminClient>): Promise<string> {
  try {
    const { data } = await adminClient
      .from('system_settings')
      .select('value')
      .eq('key', 'device_binding_mode')
      .single();
    // Strip surrounding quotes in case the value was stored with JSON.stringify
    const raw = (data?.value as string) || 'per_user';
    return raw.replace(/^"|"$/g, '') || 'per_user';
  } catch {
    return 'per_user';
  }
}

/**
 * Determine if device binding is active for a given user profile,
 * taking the global mode into account.
 */
function isDeviceBindingActive(
  globalMode: string,
  userEnabled: boolean | undefined | null
): boolean {
  if (globalMode === 'all') return true;
  if (globalMode === 'off') return false;
  // 'per_user'
  return userEnabled === true;
}

/**
 * Authenticate a user with username/phone and password.
 * Creates a tracked session record in user_sessions.
 * Enforces single-device when device binding is active.
 */
export async function authenticateUser(
  usernameOrPhone: string,
  password: string,
  deviceId?: string,
  deviceInfo?: {
    browser?: string;
    os?: string;
    screen?: string;
    platform?: string;
    ip?: string;
    userAgent?: string;
  }
): Promise<AuthResult> {
  try {
    const serverSupabase = await createServerSupabaseClient();
    const adminClient = createAdminClient();

    // Check if input looks like a phone number
    const isPhone = /^[\d+][\d\s-]*$/.test(usernameOrPhone.trim());

    let email: string;
    let preCheckProfile: {
      user_id: string;
      username: string;
      role: string;
      expires_at: string;
      device_id?: string;
      device_binding_enabled?: boolean;
    } | null = null;

    if (isPhone) {
      const { data: profile } = await adminClient
        .from('user_profiles')
        .select('user_id, username, role, expires_at, device_id, device_binding_enabled')
        .eq('phone', usernameOrPhone.trim())
        .single();

      if (!profile) {
        return { success: false, error: 'Invalid phone number or password' };
      }
      email = usernameToEmail(profile.username);
      preCheckProfile = profile;
    } else {
      const { data: profile } = await adminClient
        .from('user_profiles')
        .select('user_id, username, role, expires_at, device_id, device_binding_enabled')
        .eq('username', usernameOrPhone.trim())
        .single();

      email = usernameToEmail(usernameOrPhone);
      preCheckProfile = profile;
    }

    // Device binding pre-check (before Supabase auth to avoid unnecessary auth calls)
    if (preCheckProfile && preCheckProfile.role === 'student') {
      const globalMode = await getDeviceBindingMode(adminClient);
      const bindingActive = isDeviceBindingActive(globalMode, preCheckProfile.device_binding_enabled);

      if (bindingActive && preCheckProfile.device_id && deviceId && preCheckProfile.device_id !== deviceId) {
        return {
          success: false,
          error: 'This account is locked to another device. Please contact an administrator to reset your device.',
        };
      }
    }

    const { data, error } = await serverSupabase.auth.signInWithPassword({ email, password });

    if (error) {
      return { success: false, error: 'Invalid username/phone or password' };
    }

    if (!data.session || !data.user) {
      return { success: false, error: 'Authentication failed' };
    }

    const { data: profile, error: profileError } = await adminClient
      .from('user_profiles')
      .select('role, expires_at, device_binding_enabled, device_id')
      .eq('user_id', data.user.id)
      .single();

    if (profileError || !profile) {
      await serverSupabase.auth.signOut();
      return { success: false, error: 'User profile not found' };
    }

    const expiresAt = new Date(profile.expires_at);
    if (expiresAt < new Date()) {
      await serverSupabase.auth.signOut();
      return { success: false, error: 'Your credentials have expired. Please contact an administrator.' };
    }

    const globalMode = await getDeviceBindingMode(adminClient);
    const bindingActive = profile.role === 'student' &&
      isDeviceBindingActive(globalMode, profile.device_binding_enabled);

    // Update profile: session_token (legacy compat), last_login_at, bind device if first login
    const sessionToken = uuidv4();
    try {
      const updateData: Record<string, unknown> = {
        session_token: sessionToken,
        last_login_at: new Date().toISOString(),
      };
      // Bind device fingerprint on first login when binding is active
      if (bindingActive && deviceId && !profile.device_id) {
        updateData.device_id = deviceId;
        updateData.device_bound_at = new Date().toISOString();
      }
      await adminClient
        .from('user_profiles')
        .update(updateData)
        .eq('user_id', data.user.id);
    } catch {
      // Non-fatal — session_token columns may not exist in older schemas
    }

    // Create a tracked session record
    let sessionId: string | undefined;
    try {
      const { data: sessionRecord, error: sessionError } = await adminClient
        .from('user_sessions')
        .insert({
          user_id: data.user.id,
          device_id: deviceId || null,
          device_info: deviceInfo ? {
            browser: deviceInfo.browser || null,
            os: deviceInfo.os || null,
            screen: deviceInfo.screen || null,
            platform: deviceInfo.platform || null,
          } : {},
          ip_address: deviceInfo?.ip || null,
          user_agent: deviceInfo?.userAgent || null,
        })
        .select('id')
        .single();

      if (!sessionError && sessionRecord) {
        sessionId = sessionRecord.id;

        // Terminate all OTHER active sessions for this user when binding is active
        if (bindingActive) {
          await adminClient
            .from('user_sessions')
            .update({
              terminated_at: new Date().toISOString(),
              terminated_by: 'system',
            })
            .eq('user_id', data.user.id)
            .neq('id', sessionId)
            .is('terminated_at', null);
        }
      }
    } catch {
      // user_sessions table may not exist yet (before migration runs)
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
      sessionId,
    };
  } catch (err) {
    console.error('Auth error:', err);
    return { success: false, error: 'Authentication service unavailable' };
  }
}

/**
 * Log out the current user.
 * Terminates the tracked session record and clears Supabase auth.
 */
export async function logout(): Promise<{ success: boolean; error?: string }> {
  try {
    const serverSupabase = await createServerSupabaseClient();
    const adminClient = createAdminClient();
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(SESSION_COOKIE)?.value;

    const { data: { user } } = await serverSupabase.auth.getUser();

    if (user) {
      // Clear legacy session_token
      await adminClient
        .from('user_profiles')
        .update({ session_token: null })
        .eq('user_id', user.id);

      // Terminate the tracked session if we have its ID
      if (sessionId) {
        try {
          await adminClient
            .from('user_sessions')
            .update({
              terminated_at: new Date().toISOString(),
              terminated_by: 'user',
            })
            .eq('id', sessionId)
            .eq('user_id', user.id)
            .is('terminated_at', null);
        } catch {
          // user_sessions may not exist yet
        }
      }
    }

    const { error } = await serverSupabase.auth.signOut();
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch {
    return { success: false, error: 'Logout failed' };
  }
}

/**
 * Validate the current session.
 * Uses the app_session_id cookie to look up the session in user_sessions.
 * Falls back to the legacy session_token check when the table/cookie isn't available.
 */
export async function validateSession(): Promise<SessionValidation> {
  try {
    const serverSupabase = await createServerSupabaseClient();
    const adminClient = createAdminClient();

    const { data: { user }, error } = await serverSupabase.auth.getUser();
    if (error || !user) {
      return { valid: false, reason: 'no_session' };
    }

    const { data: profile, error: profileError } = await adminClient
      .from('user_profiles')
      .select('role, expires_at, session_token, force_logout_at, last_login_at, device_binding_enabled')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return { valid: false, reason: 'profile_not_found' };
    }

    const expiresAt = new Date(profile.expires_at);
    if (expiresAt < new Date()) {
      await serverSupabase.auth.signOut();
      return { valid: false, reason: 'expired' };
    }

    // Try the new session tracking first
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(SESSION_COOKIE)?.value;

    if (sessionId) {
      try {
        const { data: sessionRecord } = await adminClient
          .from('user_sessions')
          .select('id, terminated_at')
          .eq('id', sessionId)
          .eq('user_id', user.id)
          .single();

        if (!sessionRecord || sessionRecord.terminated_at !== null) {
          // Session was terminated by admin or by a new login (device binding)
          await serverSupabase.auth.signOut();
          return { valid: false, reason: 'session_invalidated' };
        }

        // Update heartbeat
        await adminClient
          .from('user_sessions')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', sessionId);
      } catch {
        // user_sessions table may not exist yet — fall through to legacy check
      }
    } else if (profile.role === 'student' && profile.device_binding_enabled) {
      // Legacy: no session cookie yet, fall back to old checks
      if (profile.force_logout_at && profile.last_login_at) {
        const forceLogoutAt = new Date(profile.force_logout_at);
        const lastLoginAt = new Date(profile.last_login_at);
        if (forceLogoutAt > lastLoginAt) {
          await serverSupabase.auth.signOut();
          return { valid: false, reason: 'force_logout' };
        }
      }

      if (!profile.session_token) {
        await serverSupabase.auth.signOut();
        return { valid: false, reason: 'session_invalidated' };
      }
    }

    return {
      valid: true,
      role: profile.role as 'admin' | 'student',
      sessionToken: profile.session_token ?? undefined,
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
    const adminClient = createAdminClient();

    const { data: { user } } = await serverSupabase.auth.getUser();
    if (!user) return null;

    const { data: profile, error } = await adminClient
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error || !profile) return null;
    return profile as UserProfile;
  } catch {
    return null;
  }
}

/**
 * Check if the current user has admin role and get their profile in one call
 */
export async function getAdminProfile(): Promise<{ isAdmin: boolean; profile: UserProfile | null }> {
  try {
    const serverSupabase = await createServerSupabaseClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await serverSupabase.auth.getUser();
    if (!user) return { isAdmin: false, profile: null };

    const { data: profile, error } = await adminClient
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error || !profile) return { isAdmin: false, profile: null };

    const expiresAt = new Date(profile.expires_at);
    if (expiresAt < new Date()) return { isAdmin: false, profile: null };

    return {
      isAdmin: profile.role === 'admin',
      profile: profile as UserProfile,
    };
  } catch {
    return { isAdmin: false, profile: null };
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
 * Force logout a user (admin only).
 * Terminates all active sessions and clears legacy session_token.
 */
export async function forceLogoutUser(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const adminClient = createAdminClient();

    // Terminate all tracked sessions for this user
    try {
      await adminClient
        .from('user_sessions')
        .update({
          terminated_at: new Date().toISOString(),
          terminated_by: 'admin',
        })
        .eq('user_id', userId)
        .is('terminated_at', null);
    } catch {
      // user_sessions may not exist yet
    }

    // Legacy: clear session_token and set force_logout_at
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

    // Try Supabase admin sign-out
    try {
      await adminClient.auth.admin.signOut(userId, 'global');
    } catch {
      // Non-fatal — Supabase admin API may not support this
    }

    return { success: true };
  } catch {
    return { success: false, error: 'Force logout failed' };
  }
}

/**
 * Terminate a specific session by ID (admin only).
 */
export async function terminateSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from('user_sessions')
      .update({
        terminated_at: new Date().toISOString(),
        terminated_by: 'admin',
      })
      .eq('id', sessionId)
      .is('terminated_at', null);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to terminate session' };
  }
}
