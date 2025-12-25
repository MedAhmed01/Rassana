/**
 * Property-based tests for QR code generation service
 * Feature: card-video-access
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { cardIdArb } from '@/test/generators';

// Import the QR code service
import { generateAccessUrl, generateQRCodeDataUrl, extractCardIdFromUrl } from '../qrcode';

describe('QR Code Service - Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set base URL for tests
    process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3000';
  });

  /**
   * Property 10: QR Code Generation Correctness
   * For any card ID, generating a QR code should produce an image that,
   * when decoded, contains a URL with the card ID embedded in the path.
   * 
   * Validates: Requirements 7.1, 7.2
   */
  it('Property 10: QR Code Generation Correctness', async () => {
    await fc.assert(
      fc.asyncProperty(
        cardIdArb,
        async (cardId) => {
          // Generate access URL
          const accessUrl = generateAccessUrl(cardId);
          
          // URL should contain the card ID
          expect(accessUrl).toContain(cardId);
          expect(accessUrl).toContain('/access/');
          
          // Generate QR code data URL
          const dataUrl = await generateQRCodeDataUrl(cardId);
          
          // Should be a valid data URL
          expect(dataUrl).toMatch(/^data:image\/png;base64,/);
          
          // Should be a non-empty base64 string
          const base64Part = dataUrl.replace('data:image/png;base64,', '');
          expect(base64Part.length).toBeGreaterThan(0);
          
          // Extract card ID from URL should return the original card ID
          const extractedCardId = extractCardIdFromUrl(accessUrl);
          expect(extractedCardId).toBe(cardId);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: URL structure is correct
   */
  it('Access URL has correct structure', async () => {
    await fc.assert(
      fc.asyncProperty(
        cardIdArb,
        async (cardId) => {
          const accessUrl = generateAccessUrl(cardId);
          
          // Should be a valid URL
          const url = new URL(accessUrl);
          
          // Should have correct path structure
          expect(url.pathname).toBe(`/access/${encodeURIComponent(cardId)}`);
          
          // Should use the base URL
          expect(url.origin).toBe('http://localhost:3000');
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Additional test: Different card IDs produce different URLs
   */
  it('Different card IDs produce different URLs', async () => {
    await fc.assert(
      fc.asyncProperty(
        cardIdArb,
        cardIdArb,
        async (cardId1, cardId2) => {
          // Skip if card IDs are the same
          fc.pre(cardId1 !== cardId2);
          
          const url1 = generateAccessUrl(cardId1);
          const url2 = generateAccessUrl(cardId2);
          
          // URLs should be different
          expect(url1).not.toBe(url2);
        }
      ),
      { numRuns: 50 }
    );
  });
});
