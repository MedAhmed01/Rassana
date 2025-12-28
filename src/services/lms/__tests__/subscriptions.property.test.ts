/**
 * Property-based tests for LMS Subscriptions
 * Feature: rassa-lms, Property 3: Subscription Access Control
 * Validates: Requirements 3.3, 3.5, 4.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn(),
};

vi.mock('@/lib/supabase', () => ({
  createAdminClient: () => mockSupabaseClient,
}));

// Import after mocking
import { 
  createSubscription, 
  checkSubscriptionActive,
  extendSubscription 
} from '../subscriptions';

// Generators
const arbitraryUUID = () => fc.uuid();

// Use integer offsets to generate dates relative to now
const arbitraryFutureDate = () => 
  fc.integer({ min: 1, max: 365 }).map(daysFromNow => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString();
  });

const arbitraryPastDate = () => 
  fc.integer({ min: 1, max: 365 }).map(daysAgo => {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString();
  });

describe('LMS Subscription Properties', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  /**
   * Property 3: Subscription Access Control
   * For any student with an active subscription and an unlocked lesson within that topic,
   * requesting the lesson should grant access.
   * For any student with an expired subscription, requesting any lesson in that topic 
   * should deny access.
   */
  describe('Property 3: Subscription Access Control', () => {
    it('should return true for active subscriptions (future expiry)', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbitraryUUID(),
          arbitraryUUID(),
          arbitraryFutureDate(),
          async (userId, topicId, expiresAt) => {
            const subscriptionId = crypto.randomUUID();
            
            mockSupabaseClient.from.mockImplementation(() => ({
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: { id: subscriptionId, expires_at: expiresAt },
                      error: null,
                    }),
                  }),
                }),
              }),
            }));

            const isActive = await checkSubscriptionActive(userId, topicId);
            expect(isActive).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return false for expired subscriptions (past expiry)', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbitraryUUID(),
          arbitraryUUID(),
          arbitraryPastDate(),
          async (userId, topicId, expiresAt) => {
            const subscriptionId = crypto.randomUUID();
            
            mockSupabaseClient.from.mockImplementation(() => ({
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: { id: subscriptionId, expires_at: expiresAt },
                      error: null,
                    }),
                  }),
                }),
              }),
            }));

            const isActive = await checkSubscriptionActive(userId, topicId);
            expect(isActive).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return false when no subscription exists', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbitraryUUID(),
          arbitraryUUID(),
          async (userId, topicId) => {
            mockSupabaseClient.from.mockImplementation(() => ({
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: null,
                      error: { code: 'PGRST116', message: 'No rows found' },
                    }),
                  }),
                }),
              }),
            }));

            const isActive = await checkSubscriptionActive(userId, topicId);
            expect(isActive).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * Subscription creation validation
   */
  describe('Subscription Creation Validation', () => {
    it('should reject subscriptions where end date is before start date', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbitraryUUID(),
          arbitraryUUID(),
          async (studentId, topicId) => {
            const pastDate = new Date(Date.now() - 86400000).toISOString(); // Yesterday
            const futureDate = new Date(Date.now() + 86400000).toISOString(); // Tomorrow

            // Try to create subscription with end date before start date
            const result = await createSubscription({
              student_id: studentId,
              topic_id: topicId,
              starts_at: futureDate,
              expires_at: pastDate,
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('End date must be after start date');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept subscriptions where end date is after start date', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbitraryUUID(),
          arbitraryUUID(),
          arbitraryFutureDate(),
          async (studentId, topicId, expiresAt) => {
            const subscriptionId = crypto.randomUUID();
            const now = new Date().toISOString();

            const expectedSubscription = {
              id: subscriptionId,
              student_id: studentId,
              topic_id: topicId,
              starts_at: now,
              expires_at: expiresAt,
              created_at: now,
              updated_at: now,
            };

            mockSupabaseClient.from.mockImplementation(() => ({
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: expectedSubscription,
                    error: null,
                  }),
                }),
              }),
            }));

            const result = await createSubscription({
              student_id: studentId,
              topic_id: topicId,
              expires_at: expiresAt,
            });

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Subscription extension validation
   */
  describe('Subscription Extension', () => {
    it('should successfully extend subscription with valid future date', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbitraryUUID(),
          arbitraryFutureDate(),
          async (subscriptionId, newExpiresAt) => {
            const now = new Date();
            const startsAt = new Date(now.getTime() - 30 * 86400000).toISOString(); // 30 days ago
            const currentExpiresAt = new Date(now.getTime() + 7 * 86400000).toISOString(); // 7 days from now

            const currentSubscription = {
              id: subscriptionId,
              starts_at: startsAt,
              expires_at: currentExpiresAt,
            };

            const updatedSubscription = {
              ...currentSubscription,
              expires_at: newExpiresAt,
            };

            let callCount = 0;
            mockSupabaseClient.from.mockImplementation(() => {
              callCount++;
              if (callCount === 1) {
                // Get current subscription
                return {
                  select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      single: vi.fn().mockResolvedValue({
                        data: currentSubscription,
                        error: null,
                      }),
                    }),
                  }),
                };
              } else {
                // Update subscription
                return {
                  update: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      select: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({
                          data: updatedSubscription,
                          error: null,
                        }),
                      }),
                    }),
                  }),
                };
              }
            });

            const result = await extendSubscription(subscriptionId, { expires_at: newExpiresAt });

            expect(result.success).toBe(true);
            expect(result.data?.expires_at).toBe(newExpiresAt);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
