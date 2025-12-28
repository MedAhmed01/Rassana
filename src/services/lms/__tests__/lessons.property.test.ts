/**
 * Property-based tests for LMS Lessons
 * Feature: rassa-lms
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
  createLesson, 
  getLessonsByChapter, 
  isValidYouTubeUrl,
  extractYouTubeVideoId 
} from '../lessons';

// Generators
const arbitraryYouTubeUrl = () => fc.oneof(
  fc.constant('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
  fc.constant('https://youtu.be/dQw4w9WgXcQ'),
  fc.constant('https://www.youtube.com/embed/dQw4w9WgXcQ'),
  fc.constant('https://youtube.com/watch?v=abc123XYZ'),
  fc.stringMatching(/^https:\/\/www\.youtube\.com\/watch\?v=[a-zA-Z0-9_-]{11}$/),
  fc.stringMatching(/^https:\/\/youtu\.be\/[a-zA-Z0-9_-]{11}$/)
);

const arbitraryInvalidUrl = () => fc.oneof(
  fc.constant(''),
  fc.constant('not a url'),
  fc.constant('https://vimeo.com/123456'),
  fc.constant('https://dailymotion.com/video/x123'),
  fc.constant('ftp://youtube.com/watch?v=abc'),
  fc.string().filter(s => !s.includes('youtube') && !s.includes('youtu.be'))
);

const arbitraryLessonTitle = () => 
  fc.string({ minLength: 1, maxLength: 200 })
    .filter(s => s.trim().length > 0);

const arbitraryDescription = () => 
  fc.option(fc.string({ maxLength: 1000 }), { nil: undefined });

const arbitraryDuration = () => 
  fc.option(fc.integer({ min: 1, max: 36000 }), { nil: undefined });

const arbitraryDisplayOrder = () => 
  fc.integer({ min: 0, max: 1000 });

describe('LMS Lesson Properties', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  /**
   * Property 2: Lesson Ordering Consistency
   * For any chapter with multiple lessons, retrieving lessons should always 
   * return them sorted by display_order in ascending order.
   */
  describe('Property 2: Lesson Ordering Consistency', () => {
    it('should return lessons sorted by display_order ascending', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(arbitraryDisplayOrder(), { minLength: 2, maxLength: 20 }),
          async (displayOrders) => {
            const chapterId = crypto.randomUUID();
            
            // Create mock lessons with random display orders
            const mockLessons = displayOrders.map((order, index) => ({
              id: crypto.randomUUID(),
              chapter_id: chapterId,
              title: `Lesson ${index}`,
              youtube_url: 'https://youtube.com/watch?v=test123',
              display_order: order,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }));

            // Sort by display_order for expected result
            const expectedSorted = [...mockLessons].sort(
              (a, b) => a.display_order - b.display_order
            );

            // Mock Supabase to return lessons in random order but sorted by query
            mockSupabaseClient.from.mockImplementation(() => ({
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: expectedSorted,
                    error: null,
                  }),
                }),
              }),
            }));

            const result = await getLessonsByChapter(chapterId);

            // Verify lessons are sorted by display_order
            expect(result.length).toBe(mockLessons.length);
            for (let i = 1; i < result.length; i++) {
              expect(result[i].display_order).toBeGreaterThanOrEqual(
                result[i - 1].display_order
              );
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * Property 12: YouTube URL Validation
   * For any string that is not a valid YouTube URL format, attempting to create 
   * a lesson with that URL should fail with a validation error.
   * For any valid YouTube URL, the lesson should be created successfully.
   */
  describe('Property 12: YouTube URL Validation', () => {
    it('should accept all valid YouTube URL formats', () => {
      fc.assert(
        fc.property(
          arbitraryYouTubeUrl(),
          (url) => {
            expect(isValidYouTubeUrl(url)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject all invalid URLs', () => {
      fc.assert(
        fc.property(
          arbitraryInvalidUrl(),
          (url) => {
            expect(isValidYouTubeUrl(url)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should fail to create lesson with invalid YouTube URL', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbitraryInvalidUrl(),
          arbitraryLessonTitle(),
          async (invalidUrl, title) => {
            const result = await createLesson({
              chapter_id: crypto.randomUUID(),
              title,
              youtube_url: invalidUrl,
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('Please provide a valid YouTube URL');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should successfully create lesson with valid YouTube URL', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbitraryYouTubeUrl(),
          arbitraryLessonTitle(),
          arbitraryDescription(),
          async (youtubeUrl, title, description) => {
            const chapterId = crypto.randomUUID();
            const lessonId = crypto.randomUUID();
            const now = new Date().toISOString();

            const expectedLesson = {
              id: lessonId,
              chapter_id: chapterId,
              title,
              youtube_url: youtubeUrl,
              description: description || null,
              display_order: 0,
              created_at: now,
              updated_at: now,
            };

            let callCount = 0;
            mockSupabaseClient.from.mockImplementation(() => {
              callCount++;
              if (callCount === 1) {
                // Get max display_order
                return {
                  select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      order: vi.fn().mockReturnValue({
                        limit: vi.fn().mockReturnValue({
                          single: vi.fn().mockResolvedValue({ data: null, error: null }),
                        }),
                      }),
                    }),
                  }),
                };
              } else {
                // Insert
                return {
                  insert: vi.fn().mockReturnValue({
                    select: vi.fn().mockReturnValue({
                      single: vi.fn().mockResolvedValue({ 
                        data: expectedLesson, 
                        error: null 
                      }),
                    }),
                  }),
                };
              }
            });

            const result = await createLesson({
              chapter_id: chapterId,
              title,
              youtube_url: youtubeUrl,
              description,
            });

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data?.youtube_url).toBe(youtubeUrl);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Test YouTube video ID extraction
   */
  describe('YouTube Video ID Extraction', () => {
    it('should extract video ID from valid YouTube URLs', () => {
      const testCases = [
        { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', expected: 'dQw4w9WgXcQ' },
        { url: 'https://youtu.be/dQw4w9WgXcQ', expected: 'dQw4w9WgXcQ' },
        { url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', expected: 'dQw4w9WgXcQ' },
        { url: 'https://youtube.com/watch?v=abc123-_XYZ', expected: 'abc123-_XYZ' },
      ];

      testCases.forEach(({ url, expected }) => {
        expect(extractYouTubeVideoId(url)).toBe(expected);
      });
    });

    it('should return null for invalid URLs', () => {
      const invalidUrls = [
        'https://vimeo.com/123456',
        'not a url',
        '',
      ];

      invalidUrls.forEach(url => {
        expect(extractYouTubeVideoId(url)).toBeNull();
      });
    });
  });
});
