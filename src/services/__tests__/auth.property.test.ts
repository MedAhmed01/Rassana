/**
 * Property-based tests for authentication service
 * Feature: card-video-access
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { mockStorage, resetMockStorage, mockSupabase } from '@/test/mocks/supabase';
import { usernameArb, simplePasswordArb, roleArb, futureDateArb, pastDateArb } from '@/test/generators';

// Mock the supabase module
vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase,
  createAdminClient: () => mockSupabase,
}));

// Import after mocking
import { authenticateUser, logout, validateSession, usernameToEmail } from '../auth';

describe('Authentication Service - Property Tests', () => {
  beforeEach(() => {
    resetMockStorage();
    vi.clearAllMocks();
  });

  /**
   * Property 1: Credential Creation Round-Trip
   * For any valid username, password, role, and future expiration date,
   * creating a user credential and then authenticating with those credentials
   * should succeed and return a session containing the correct role.
   * 
   * Validates: Requirements 1.1, 1.4, 2.2, 2.4
   */
  it('Property 1: Credential Creation Round-Trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        usernameArb,
        simplePasswordArb,
        roleArb,
        futureDateArb,
        async (username, password, role, expiresAt) => {
          // Reset storage for each test
          resetMockStorage();
          
          // Create user in mock storage (simulating admin createUser)
          const email = usernameToEmail(username);
          const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          mockStorage.users.set(userId, { id: userId, email, password });
          mockStorage.profiles.set(userId, {
            id: `profile_${userId}`,
            user_id: userId,
            username,
            role,
            expires_at: expiresAt,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          
          // Authenticate with the created credentials
          const result = await authenticateUser(username, password);
          
          // Should succeed
          expect(result.success).toBe(true);
          expect(result.session).toBeDefined();
          expect(result.role).toBe(role);
          expect(result.error).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3: Expired Credentials Rejection
   * For any user credential with an expiration date in the past,
   * attempting to authenticate should fail with an expiration error message.
   * 
   * Validates: Requirements 2.5
   */
  it('Property 3: Expired Credentials Rejection', async () => {
    await fc.assert(
      fc.asyncProperty(
        usernameArb,
        simplePasswordArb,
        roleArb,
        pastDateArb,
        async (username, password, role, expiresAt) => {
          // Reset storage for each test
          resetMockStorage();
          
          // Create user with expired credentials
          const email = usernameToEmail(username);
          const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          mockStorage.users.set(userId, { id: userId, email, password });
          mockStorage.profiles.set(userId, {
            id: `profile_${userId}`,
            user_id: userId,
            username,
            role,
            expires_at: expiresAt, // Past date
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          
          // Attempt to authenticate
          const result = await authenticateUser(username, password);
          
          // Should fail with expiration error
          expect(result.success).toBe(false);
          expect(result.error).toContain('expired');
          expect(result.session).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4: Invalid Credentials Rejection
   * For any username/password combination that does not match an existing user,
   * authentication should fail with an error.
   * 
   * Validates: Requirements 2.3
   */
  it('Property 4: Invalid Credentials Rejection', async () => {
    await fc.assert(
      fc.asyncProperty(
        usernameArb,
        simplePasswordArb,
        async (username, password) => {
          // Reset storage - no users exist
          resetMockStorage();
          
          // Attempt to authenticate with non-existent credentials
          const result = await authenticateUser(username, password);
          
          // Should fail
          expect(result.success).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.session).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11: Logout Invalidates Session
   * For any authenticated session, after logout,
   * using that session for subsequent requests should fail.
   * 
   * Validates: Requirements 8.2
   */
  it('Property 11: Logout Invalidates Session', async () => {
    await fc.assert(
      fc.asyncProperty(
        usernameArb,
        simplePasswordArb,
        roleArb,
        futureDateArb,
        async (username, password, role, expiresAt) => {
          // Reset storage for each test
          resetMockStorage();
          
          // Create and authenticate user
          const email = usernameToEmail(username);
          const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          mockStorage.users.set(userId, { id: userId, email, password });
          mockStorage.profiles.set(userId, {
            id: `profile_${userId}`,
            user_id: userId,
            username,
            role,
            expires_at: expiresAt,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          
          // Authenticate
          const authResult = await authenticateUser(username, password);
          expect(authResult.success).toBe(true);
          
          // Verify session is valid before logout
          const beforeLogout = await validateSession();
          expect(beforeLogout.valid).toBe(true);
          
          // Logout
          const logoutResult = await logout();
          expect(logoutResult.success).toBe(true);
          
          // Verify session is invalid after logout
          const afterLogout = await validateSession();
          expect(afterLogout.valid).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
