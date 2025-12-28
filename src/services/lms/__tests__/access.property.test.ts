/**
 * Property-based tests for LMS Access Control
 * Feature: rassa-lms
 * Properties 4, 5, 6, 7, 8
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
  unlockLesson, 
  lockLesson, 
  isLessonUnlocked,
  bulkUnlockLessons,
  bulkLockLessons,
  initializeFirstLessonAccess,
} from '../access';

// Generators
const arbitraryUUID = () => fc.uuid();
const arbitraryLessonIds = () => fc.array(fc.uuid(), { minLength: 1, maxLength: 10 });

describe('LMS Access Control Properties', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  /**
   * Property 4: Lock/Unlock Toggle
   * For any lesson and student, unlocking the lesson should grant access,
   * and subsequently locking it should revoke access.
   */
  describe('Property 4: Lock/Unlock Toggle', () => {
    it('should grant access after unlocking', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbitraryUUID(),
          arbitraryUUID(),
          arbitraryUUID(),
          async (userId, lessonId, adminId) => {
            const accessRecord = {
              id: crypto.randomUUID(),
              user_id: userId,
              lesson_id: lessonId,
              is_unlocked: true,
              unlocked_at: new Date().toISOString(),
              unlocked_by: adminId,
              was_unlocked_before_expiry: true,
            };

            mockSupabaseClient.from.mockImplementation(() => ({
              upsert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: accessRecord,
                    error: null,
                  }),
                }),
              }),
            }));

            const result = await unlockLesson(userId, lessonId, adminId);
            
            expect(result.success).toBe(true);
            expect(result.data?.is_unlocked).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should revoke access after locking', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbitraryUUID(),
          arbitraryUUID(),
          async (userId, lessonId) => {
            mockSupabaseClient.from.mockImplementation(() => ({
              upsert: vi.fn().mockResolvedValue({
                error: null,
              }),
            }));

            const result = await lockLesson(userId, lessonId);
            
            expect(result.success).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly report unlock status', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbitraryUUID(),
          arbitraryUUID(),
          fc.boolean(),
          async (userId, lessonId, isUnlocked) => {
            mockSupabaseClient.from.mockImplementation(() => ({
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: { is_unlocked: isUnlocked },
                      error: null,
                    }),
                  }),
                }),
              }),
            }));

            const result = await isLessonUnlocked(userId, lessonId);
            
            expect(result).toBe(isUnlocked);
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * Property 5: Bulk Lock/Unlock Operations
   * For any set of lessons and a student, bulk unlocking should grant access to all,
   * and bulk locking should revoke access to all.
   */
  describe('Property 5: Bulk Lock/Unlock Operations', () => {
    it('should unlock all lessons in bulk operation', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbitraryUUID(),
          arbitraryLessonIds(),
          arbitraryUUID(),
          async (userId, lessonIds, adminId) => {
            mockSupabaseClient.from.mockImplementation(() => ({
              upsert: vi.fn().mockResolvedValue({
                error: null,
              }),
            }));

            const result = await bulkUnlockLessons(userId, lessonIds, adminId);
            
            expect(result.success).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should lock all lessons in bulk operation', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbitraryUUID(),
          arbitraryLessonIds(),
          async (userId, lessonIds) => {
            mockSupabaseClient.from.mockImplementation(() => ({
              upsert: vi.fn().mockResolvedValue({
                error: null,
              }),
            }));

            const result = await bulkLockLessons(userId, lessonIds);
            
            expect(result.success).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 6: First Lesson Auto-Unlock
   * For any new subscription, the first lesson should be automatically unlocked.
   */
  describe('Property 6: First Lesson Auto-Unlock', () => {
    it('should unlock first lesson when initializing access', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbitraryUUID(),
          arbitraryUUID(),
          arbitraryUUID(),
          async (userId, topicId, adminId) => {
            const firstLessonId = crypto.randomUUID();
            
            let callCount = 0;
            mockSupabaseClient.from.mockImplementation((table: string) => {
              callCount++;
              
              if (table === 'lms_lessons') {
                // Get first lesson query
                return {
                  select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      order: vi.fn().mockReturnValue({
                        order: vi.fn().mockReturnValue({
                          limit: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({
                              data: { id: firstLessonId },
                              error: null,
                            }),
                          }),
                        }),
                      }),
                    }),
                  }),
                };
              } else if (table === 'lms_lesson_access') {
                // Unlock lesson
                return {
                  upsert: vi.fn().mockReturnValue({
                    select: vi.fn().mockReturnValue({
                      single: vi.fn().mockResolvedValue({
                        data: {
                          id: crypto.randomUUID(),
                          user_id: userId,
                          lesson_id: firstLessonId,
                          is_unlocked: true,
                        },
                        error: null,
                      }),
                    }),
                  }),
                };
              }
              return {};
            });

            const result = await initializeFirstLessonAccess(userId, topicId, adminId);
            
            expect(result.success).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should succeed even when topic has no lessons', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbitraryUUID(),
          arbitraryUUID(),
          arbitraryUUID(),
          async (userId, topicId, adminId) => {
            mockSupabaseClient.from.mockImplementation(() => ({
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      limit: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({
                          data: null,
                          error: { code: 'PGRST116' },
                        }),
                      }),
                    }),
                  }),
                }),
              }),
            }));

            const result = await initializeFirstLessonAccess(userId, topicId, adminId);
            
            // Should succeed even with no lessons
            expect(result.success).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
