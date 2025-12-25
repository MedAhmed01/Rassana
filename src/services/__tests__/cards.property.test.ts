/**
 * Property-based tests for card management service
 * Feature: card-video-access
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { mockStorage, resetMockStorage, mockSupabase } from '@/test/mocks/supabase';
import { cardIdArb, youtubeUrlArb, cardTitleArb, subjectArb } from '@/test/generators';

// Mock the supabase module
vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase,
  createAdminClient: () => mockSupabase,
}));

// Import after mocking
import { insertCard, updateCard, queryVideoUrl } from '../cards';

describe('Card Management Service - Property Tests', () => {
  beforeEach(() => {
    resetMockStorage();
    vi.clearAllMocks();
  });

  /**
   * Property 6: Card-Video Mapping Round-Trip
   * For any valid card ID and YouTube URL, creating a card mapping and then
   * querying by card ID should return the same video URL. Updating the video URL
   * and querying again should return the updated URL.
   * 
   * Validates: Requirements 6.1, 6.2, 6.4
   */
  it('Property 6: Card-Video Mapping Round-Trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        cardIdArb,
        youtubeUrlArb,
        youtubeUrlArb,
        fc.option(cardTitleArb, { nil: undefined }),
        fc.option(subjectArb, { nil: undefined }),
        async (cardId, videoUrl1, videoUrl2, title, subject) => {
          // Reset storage for each test
          resetMockStorage();
          
          // Create card mapping
          const createResult = await insertCard({
            card_id: cardId,
            video_url: videoUrl1,
            title,
            subject,
          });
          
          expect(createResult.success).toBe(true);
          expect(createResult.card).toBeDefined();
          
          // Query should return the same video URL
          const queriedUrl1 = await queryVideoUrl(cardId);
          expect(queriedUrl1).toBe(videoUrl1);
          
          // Update the video URL
          const updateResult = await updateCard(cardId, videoUrl2);
          expect(updateResult.success).toBe(true);
          
          // Query should return the updated URL
          const queriedUrl2 = await queryVideoUrl(cardId);
          expect(queriedUrl2).toBe(videoUrl2);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Non-existent card returns null
   */
  it('Non-existent card returns null', async () => {
    await fc.assert(
      fc.asyncProperty(
        cardIdArb,
        async (cardId) => {
          // Reset storage - no cards exist
          resetMockStorage();
          
          // Query should return null
          const result = await queryVideoUrl(cardId);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Additional test: Duplicate card IDs are rejected
   */
  it('Duplicate card IDs are rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        cardIdArb,
        youtubeUrlArb,
        youtubeUrlArb,
        async (cardId, videoUrl1, videoUrl2) => {
          // Reset storage for each test
          resetMockStorage();
          
          // Create first card - should succeed
          const result1 = await insertCard({
            card_id: cardId,
            video_url: videoUrl1,
          });
          expect(result1.success).toBe(true);
          
          // Create second card with same ID - should fail
          const result2 = await insertCard({
            card_id: cardId,
            video_url: videoUrl2,
          });
          expect(result2.success).toBe(false);
          expect(result2.error).toBeDefined();
        }
      ),
      { numRuns: 50 }
    );
  });
});
