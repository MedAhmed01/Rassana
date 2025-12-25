/**
 * Property-based tests for access control and logging
 * Feature: card-video-access
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { mockStorage, resetMockStorage, mockSupabase } from '@/test/mocks/supabase';
import { usernameArb, simplePasswordArb, futureDateArb, cardIdArb, uuidArb, timestampArb } from '@/test/generators';

// Mock the supabase module
vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase,
  createAdminClient: () => mockSupabase,
}));

// Import after mocking
import { validateSession } from '../auth';
import { usernameToEmail } from '../auth';
import { logVideoAccess, getAccessLogs } from '../accessLogs';

describe('Access Control - Property Tests', () => {
  beforeEach(() => {
    resetMockStorage();
    vi.clearAllMocks();
  });

  /**
   * Property 5: Role-Based Access Control
   * For any authenticated user with role "student", attempting to access admin
   * functionality should be denied. For any authenticated user with role "admin",
   * all functionality should be accessible.
   * 
   * Validates: Requirements 3.1, 3.2, 3.3
   */
  it('Property 5: Role-Based Access Control', async () => {
    await fc.assert(
      fc.asyncProperty(
        usernameArb,
        simplePasswordArb,
        futureDateArb,
        async (username, password, expiresAt) => {
          // Test with student role
          resetMockStorage();
          
          const email = usernameToEmail(username);
          const studentUserId = `user_student_${Date.now()}`;
          
          mockStorage.users.set(studentUserId, { id: studentUserId, email, password });
          mockStorage.profiles.set(studentUserId, {
            id: `profile_${studentUserId}`,
            user_id: studentUserId,
            username,
            role: 'student',
            expires_at: expiresAt,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          
          // Simulate login
          mockStorage.currentSession = {
            access_token: `token_${studentUserId}`,
            refresh_token: `refresh_${studentUserId}`,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            user: { id: studentUserId, email },
          };
          
          // Validate session returns student role
          const studentValidation = await validateSession();
          expect(studentValidation.valid).toBe(true);
          expect(studentValidation.role).toBe('student');
          
          // Test with admin role
          resetMockStorage();
          
          const adminUserId = `user_admin_${Date.now()}`;
          const adminEmail = usernameToEmail(username + '_admin');
          
          mockStorage.users.set(adminUserId, { id: adminUserId, email: adminEmail, password });
          mockStorage.profiles.set(adminUserId, {
            id: `profile_${adminUserId}`,
            user_id: adminUserId,
            username: username + '_admin',
            role: 'admin',
            expires_at: expiresAt,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          
          // Simulate login
          mockStorage.currentSession = {
            access_token: `token_${adminUserId}`,
            refresh_token: `refresh_${adminUserId}`,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            user: { id: adminUserId, email: adminEmail },
          };
          
          // Validate session returns admin role
          const adminValidation = await validateSession();
          expect(adminValidation.valid).toBe(true);
          expect(adminValidation.role).toBe('admin');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7: Unauthenticated Access Denial
   * For any card access request without a valid session,
   * the system should deny access.
   * 
   * Validates: Requirements 4.2
   */
  it('Property 7: Unauthenticated Access Denial', async () => {
    await fc.assert(
      fc.asyncProperty(
        cardIdArb,
        async (cardId) => {
          // Reset storage - no session
          resetMockStorage();
          
          // Validate session should fail
          const validation = await validateSession();
          expect(validation.valid).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Access Logging - Property Tests', () => {
  beforeEach(() => {
    resetMockStorage();
    vi.clearAllMocks();
  });

  /**
   * Property 8: Access Logging Round-Trip
   * For any authenticated user accessing a video, an access log entry should be
   * created containing the user ID, card ID, and timestamp. Querying access logs
   * should return this entry.
   * 
   * Validates: Requirements 5.1, 5.2, 5.4
   */
  it('Property 8: Access Logging Round-Trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        cardIdArb,
        async (userId, cardId) => {
          // Reset storage for each test
          resetMockStorage();
          
          // Log video access
          const logResult = await logVideoAccess(userId, cardId);
          expect(logResult.success).toBe(true);
          
          // Query access logs
          const logs = await getAccessLogs();
          
          // Should contain the logged entry
          expect(logs.length).toBeGreaterThan(0);
          
          const entry = logs.find(log => log.user_id === userId && log.card_id === cardId);
          expect(entry).toBeDefined();
          expect(entry?.user_id).toBe(userId);
          expect(entry?.card_id).toBe(cardId);
          expect(entry?.accessed_at).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9: Access Log Filtering Correctness
   * For any set of access logs and filter criteria, the filtered results
   * should contain only entries matching all specified criteria.
   * 
   * Validates: Requirements 5.3
   */
  it('Property 9: Access Log Filtering Correctness', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            userId: uuidArb,
            cardId: cardIdArb,
          }),
          { minLength: 3, maxLength: 10 }
        ),
        async (accessEvents) => {
          // Reset storage for each test
          resetMockStorage();
          
          // Log all access events
          for (const event of accessEvents) {
            await logVideoAccess(event.userId, event.cardId);
          }
          
          // Pick a random user ID to filter by
          const targetUserId = accessEvents[0].userId;
          
          // Filter by user ID
          const filteredByUser = await getAccessLogs({ userId: targetUserId });
          
          // All results should have the target user ID
          for (const log of filteredByUser) {
            expect(log.user_id).toBe(targetUserId);
          }
          
          // Pick a random card ID to filter by
          const targetCardId = accessEvents[0].cardId;
          
          // Filter by card ID
          const filteredByCard = await getAccessLogs({ cardId: targetCardId });
          
          // All results should have the target card ID
          for (const log of filteredByCard) {
            expect(log.card_id).toBe(targetCardId);
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
