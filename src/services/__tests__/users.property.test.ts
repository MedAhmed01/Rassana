/**
 * Property-based tests for user management service
 * Feature: card-video-access
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { mockStorage, resetMockStorage, mockSupabase } from '@/test/mocks/supabase';
import { usernameArb, simplePasswordArb, roleArb, futureDateArb } from '@/test/generators';

// Mock the supabase module
vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase,
  createAdminClient: () => mockSupabase,
}));

// Import after mocking
import { createUser } from '../users';
import { usernameToEmail } from '../auth';

describe('User Management Service - Property Tests', () => {
  beforeEach(() => {
    resetMockStorage();
    vi.clearAllMocks();
  });

  /**
   * Property 2: Username Uniqueness Constraint
   * For any existing username in the system, attempting to create another user
   * with the same username should fail with an error.
   * 
   * Validates: Requirements 1.2, 1.3
   */
  it('Property 2: Username Uniqueness Constraint', async () => {
    await fc.assert(
      fc.asyncProperty(
        usernameArb,
        simplePasswordArb,
        simplePasswordArb,
        roleArb,
        roleArb,
        futureDateArb,
        futureDateArb,
        async (username, password1, password2, role1, role2, expires1, expires2) => {
          // Reset storage for each test
          resetMockStorage();
          
          // Create first user - should succeed
          const result1 = await createUser({
            username,
            password: password1,
            role: role1,
            expires_at: expires1,
          });
          
          expect(result1.success).toBe(true);
          expect(result1.userId).toBeDefined();
          
          // Attempt to create second user with same username - should fail
          const result2 = await createUser({
            username,
            password: password2,
            role: role2,
            expires_at: expires2,
          });
          
          expect(result2.success).toBe(false);
          expect(result2.error).toBeDefined();
          expect(result2.error?.toLowerCase()).toContain('exists');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Different usernames should all succeed
   */
  it('Different usernames can all be created', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(usernameArb, { minLength: 2, maxLength: 5 }),
        simplePasswordArb,
        roleArb,
        futureDateArb,
        async (usernames, password, role, expiresAt) => {
          // Reset storage for each test
          resetMockStorage();
          
          // Get unique usernames
          const uniqueUsernames = [...new Set(usernames)];
          
          // Create all users - all should succeed
          for (const username of uniqueUsernames) {
            const result = await createUser({
              username,
              password,
              role,
              expires_at: expiresAt,
            });
            
            expect(result.success).toBe(true);
            expect(result.userId).toBeDefined();
          }
          
          // Verify all users were created
          expect(mockStorage.profiles.size).toBe(uniqueUsernames.length);
        }
      ),
      { numRuns: 50 }
    );
  });
});
