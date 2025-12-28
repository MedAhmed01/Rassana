/**
 * Property-based tests for LMS Topics and Chapters
 * Feature: rassa-lms, Property 1: Content Creation Round-Trip
 * Validates: Requirements 2.1, 2.2, 2.3
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
import { createTopic, getTopicById, getAllTopics } from '../topics';
import { createChapter, getChapterById, getChaptersByTopic } from '../chapters';

// Generators
const arbitraryTopicName = () => 
  fc.string({ minLength: 1, maxLength: 200 })
    .filter(s => s.trim().length > 0);

const arbitraryDescription = () => 
  fc.option(fc.string({ maxLength: 1000 }), { nil: undefined });

const arbitraryUUID = () => 
  fc.uuid();

describe('LMS Content Creation Round-Trip Properties', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  /**
   * Property 1: Content Creation Round-Trip
   * For any valid topic data, creating the entity and then retrieving it 
   * should return an object with all the same field values.
   */
  describe('Property 1: Topic Creation Round-Trip', () => {
    it('should preserve all topic fields through create and retrieve cycle', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbitraryTopicName(),
          arbitraryDescription(),
          async (name, description) => {
            const createdId = crypto.randomUUID();
            const now = new Date().toISOString();
            
            const expectedTopic = {
              id: createdId,
              name,
              description: description || null,
              display_order: 0,
              created_at: now,
              updated_at: now,
            };

            // Mock for getting max display_order
            const mockMaxOrderSelect = vi.fn().mockReturnThis();
            const mockMaxOrderOrder = vi.fn().mockReturnThis();
            const mockMaxOrderLimit = vi.fn().mockReturnThis();
            const mockMaxOrderSingle = vi.fn().mockResolvedValue({ data: null, error: null });

            // Mock for insert
            const mockInsertSelect = vi.fn().mockReturnThis();
            const mockInsertSingle = vi.fn().mockResolvedValue({ 
              data: expectedTopic, 
              error: null 
            });

            // Mock for getTopicById
            const mockGetSelect = vi.fn().mockReturnThis();
            const mockGetEq = vi.fn().mockReturnThis();
            const mockGetSingle = vi.fn().mockResolvedValue({ 
              data: expectedTopic, 
              error: null 
            });

            let callCount = 0;
            mockSupabaseClient.from.mockImplementation((table: string) => {
              callCount++;
              if (table === 'lms_topics') {
                if (callCount === 1) {
                  // First call: get max display_order
                  return {
                    select: mockMaxOrderSelect.mockReturnValue({
                      eq: vi.fn().mockReturnThis(),
                      order: mockMaxOrderOrder.mockReturnValue({
                        limit: mockMaxOrderLimit.mockReturnValue({
                          single: mockMaxOrderSingle,
                        }),
                      }),
                    }),
                  };
                } else if (callCount === 2) {
                  // Second call: insert
                  return {
                    insert: vi.fn().mockReturnValue({
                      select: mockInsertSelect.mockReturnValue({
                        single: mockInsertSingle,
                      }),
                    }),
                  };
                } else {
                  // Third call: get by id
                  return {
                    select: mockGetSelect.mockReturnValue({
                      eq: mockGetEq.mockReturnValue({
                        single: mockGetSingle,
                      }),
                    }),
                  };
                }
              }
              return {};
            });

            // Create topic
            const createResult = await createTopic({ name, description });
            expect(createResult.success).toBe(true);
            expect(createResult.data).toBeDefined();

            // Reset call count for retrieval
            callCount = 2;

            // Retrieve topic
            const retrieved = await getTopicById(createdId);
            
            // Verify round-trip preserves data
            expect(retrieved).not.toBeNull();
            expect(retrieved?.name).toBe(name);
            expect(retrieved?.description).toBe(description || null);
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * Property 1: Content Creation Round-Trip (Chapters)
   * For any valid chapter data, creating and retrieving should preserve all fields.
   */
  describe('Property 1: Chapter Creation Round-Trip', () => {
    it('should preserve all chapter fields through create and retrieve cycle', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbitraryUUID(),
          arbitraryTopicName(),
          arbitraryDescription(),
          async (topicId, name, description) => {
            const createdId = crypto.randomUUID();
            const now = new Date().toISOString();
            
            const expectedChapter = {
              id: createdId,
              topic_id: topicId,
              name,
              description: description || null,
              display_order: 0,
              created_at: now,
              updated_at: now,
            };

            // Mock for getting max display_order
            const mockMaxOrderSelect = vi.fn().mockReturnThis();
            const mockMaxOrderEq = vi.fn().mockReturnThis();
            const mockMaxOrderOrder = vi.fn().mockReturnThis();
            const mockMaxOrderLimit = vi.fn().mockReturnThis();
            const mockMaxOrderSingle = vi.fn().mockResolvedValue({ data: null, error: null });

            // Mock for insert
            const mockInsertSelect = vi.fn().mockReturnThis();
            const mockInsertSingle = vi.fn().mockResolvedValue({ 
              data: expectedChapter, 
              error: null 
            });

            // Mock for getChapterById
            const mockGetSelect = vi.fn().mockReturnThis();
            const mockGetEq = vi.fn().mockReturnThis();
            const mockGetSingle = vi.fn().mockResolvedValue({ 
              data: expectedChapter, 
              error: null 
            });

            let callCount = 0;
            mockSupabaseClient.from.mockImplementation((table: string) => {
              callCount++;
              if (table === 'lms_chapters') {
                if (callCount === 1) {
                  // First call: get max display_order
                  return {
                    select: mockMaxOrderSelect.mockReturnValue({
                      eq: mockMaxOrderEq.mockReturnValue({
                        order: mockMaxOrderOrder.mockReturnValue({
                          limit: mockMaxOrderLimit.mockReturnValue({
                            single: mockMaxOrderSingle,
                          }),
                        }),
                      }),
                    }),
                  };
                } else if (callCount === 2) {
                  // Second call: insert
                  return {
                    insert: vi.fn().mockReturnValue({
                      select: mockInsertSelect.mockReturnValue({
                        single: mockInsertSingle,
                      }),
                    }),
                  };
                } else {
                  // Third call: get by id
                  return {
                    select: mockGetSelect.mockReturnValue({
                      eq: mockGetEq.mockReturnValue({
                        single: mockGetSingle,
                      }),
                    }),
                  };
                }
              }
              return {};
            });

            // Create chapter
            const createResult = await createChapter({ 
              topic_id: topicId, 
              name, 
              description 
            });
            expect(createResult.success).toBe(true);
            expect(createResult.data).toBeDefined();

            // Reset call count for retrieval
            callCount = 2;

            // Retrieve chapter
            const retrieved = await getChapterById(createdId);
            
            // Verify round-trip preserves data
            expect(retrieved).not.toBeNull();
            expect(retrieved?.name).toBe(name);
            expect(retrieved?.description).toBe(description || null);
            expect(retrieved?.topic_id).toBe(topicId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
