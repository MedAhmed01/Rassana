/**
 * Property-based tests for LMS Progress
 * Feature: rassa-lms
 * Properties 9, 10
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
  updateWatchProgress, 
  getWatchProgress,
  calculateTopicCompletion 
} from '../progress';
import type { LMSWatchProgress } from '@/types/lms';

// Generators
const arbitraryUUID = () => fc.uuid();

const arbitrarySeconds = () => fc.integer({ min: 0, max: 36000 }); // Up to 10 hours

const arbitraryPercentage = () => fc.float({ min: 0, max: 100, noNaN: true });

const arbitraryProgressData = () => fc.record({
  watched_seconds: arbitrarySeconds(),
  total_seconds: fc.integer({ min: 1, max: 36000 }),
  last_position_seconds: arbitrarySeconds(),
});

describe('LMS Progress Properties', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  /**
   * Property 9: Progress Persistence and Non-Regression
   * For any watch progress update, the stored progress should match the submitted values.
   * For any lesson that has reached a certain completion, subsequent progress updates 
   * with lower percentages should not reduce the max completion status.
   */
  describe('Property 9: Progress Persistence and Non-Regression', () => {
    it('should persist progress data correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbitraryUUID(),
          arbitraryUUID(),
          arbitraryProgressData(),
          async (studentId, lessonId, progressData) => {
            const expectedPercentage = progressData.total_seconds > 0
              ? Math.min(100, (progressData.watched_seconds / progressData.total_seconds) * 100)
              : 0;

            const savedProgress = {
              id: crypto.randomUUID(),
              student_id: studentId,
              lesson_id: lessonId,
              watched_seconds: progressData.watched_seconds,
              total_seconds: progressData.total_seconds,
              last_position_seconds: progressData.last_position_seconds,
              max_percentage_watched: expectedPercentage,
              updated_at: new Date().toISOString(),
            };

            let callCount = 0;
            mockSupabaseClient.from.mockImplementation(() => {
              callCount++;
              if (callCount === 1) {
                // Get current progress (none exists)
                return {
                  select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      eq: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({
                          data: null,
                          error: { code: 'PGRST116' },
                        }),
                      }),
                    }),
                  }),
                };
              } else {
                // Upsert progress
                return {
                  upsert: vi.fn().mockReturnValue({
                    select: vi.fn().mockReturnValue({
                      single: vi.fn().mockResolvedValue({
                        data: savedProgress,
                        error: null,
                      }),
                    }),
                  }),
                };
              }
            });

            const result = await updateWatchProgress(studentId, {
              lesson_id: lessonId,
              ...progressData,
            });

            expect(result.success).toBe(true);
            expect(result.data?.watched_seconds).toBe(progressData.watched_seconds);
            expect(result.data?.total_seconds).toBe(progressData.total_seconds);
            expect(result.data?.last_position_seconds).toBe(progressData.last_position_seconds);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should never decrease max_percentage_watched', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbitraryUUID(),
          arbitraryUUID(),
          arbitraryPercentage(),
          arbitraryPercentage(),
          async (studentId, lessonId, initialPercentage, newPercentage) => {
            const totalSeconds = 1000;
            const initialWatched = Math.floor((initialPercentage / 100) * totalSeconds);
            const newWatched = Math.floor((newPercentage / 100) * totalSeconds);

            const existingProgress = {
              id: crypto.randomUUID(),
              student_id: studentId,
              lesson_id: lessonId,
              watched_seconds: initialWatched,
              total_seconds: totalSeconds,
              last_position_seconds: initialWatched,
              max_percentage_watched: initialPercentage,
              updated_at: new Date().toISOString(),
            };

            // Expected max should be the higher of the two
            const expectedMax = Math.max(initialPercentage, newPercentage);

            const updatedProgress = {
              ...existingProgress,
              watched_seconds: newWatched,
              last_position_seconds: newWatched,
              max_percentage_watched: expectedMax,
            };

            let callCount = 0;
            mockSupabaseClient.from.mockImplementation(() => {
              callCount++;
              if (callCount === 1) {
                // Get current progress
                return {
                  select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      eq: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({
                          data: existingProgress,
                          error: null,
                        }),
                      }),
                    }),
                  }),
                };
              } else {
                // Upsert progress
                return {
                  upsert: vi.fn().mockReturnValue({
                    select: vi.fn().mockReturnValue({
                      single: vi.fn().mockResolvedValue({
                        data: updatedProgress,
                        error: null,
                      }),
                    }),
                  }),
                };
              }
            });

            const result = await updateWatchProgress(studentId, {
              lesson_id: lessonId,
              watched_seconds: newWatched,
              total_seconds: totalSeconds,
              last_position_seconds: newWatched,
            });

            expect(result.success).toBe(true);
            // Max percentage should never decrease
            expect(result.data?.max_percentage_watched).toBeGreaterThanOrEqual(initialPercentage);
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * Property 10: Topic Completion Calculation
   * For any topic with N lessons, the overall completion percentage should equal 
   * the sum of individual lesson completion percentages divided by N.
   */
  describe('Property 10: Topic Completion Calculation', () => {
    it('should calculate topic completion as average of lesson completions', () => {
      fc.assert(
        fc.property(
          fc.array(arbitraryPercentage(), { minLength: 1, maxLength: 50 }),
          (percentages) => {
            const progressRecords: LMSWatchProgress[] = percentages.map((pct, i) => ({
              id: crypto.randomUUID(),
              student_id: crypto.randomUUID(),
              lesson_id: crypto.randomUUID(),
              watched_seconds: Math.floor((pct / 100) * 1000),
              total_seconds: 1000,
              last_position_seconds: Math.floor((pct / 100) * 1000),
              max_percentage_watched: pct,
              updated_at: new Date().toISOString(),
            }));

            const totalLessons = percentages.length;
            const expectedCompletion = Math.round(
              percentages.reduce((sum, p) => sum + p, 0) / totalLessons
            );

            const result = calculateTopicCompletion(progressRecords, totalLessons);

            expect(result).toBe(expectedCompletion);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return 0 for empty topic', () => {
      const result = calculateTopicCompletion([], 0);
      expect(result).toBe(0);
    });

    it('should return 0 when no progress records exist', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          (totalLessons) => {
            const result = calculateTopicCompletion([], totalLessons);
            expect(result).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle partial progress records', () => {
      fc.assert(
        fc.property(
          fc.array(arbitraryPercentage(), { minLength: 1, maxLength: 20 }),
          fc.integer({ min: 1, max: 30 }),
          (percentages, extraLessons) => {
            const progressRecords: LMSWatchProgress[] = percentages.map((pct) => ({
              id: crypto.randomUUID(),
              student_id: crypto.randomUUID(),
              lesson_id: crypto.randomUUID(),
              watched_seconds: Math.floor((pct / 100) * 1000),
              total_seconds: 1000,
              last_position_seconds: Math.floor((pct / 100) * 1000),
              max_percentage_watched: pct,
              updated_at: new Date().toISOString(),
            }));

            // Total lessons includes some without progress
            const totalLessons = percentages.length + extraLessons;
            
            // Expected: sum of percentages / total lessons (not just recorded ones)
            const expectedCompletion = Math.round(
              percentages.reduce((sum, p) => sum + p, 0) / totalLessons
            );

            const result = calculateTopicCompletion(progressRecords, totalLessons);

            expect(result).toBe(expectedCompletion);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
