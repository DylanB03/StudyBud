import { describe, expect, it } from 'vitest';

import { summarizeExtractionConfidence } from './extraction-confidence';

describe('summarizeExtractionConfidence', () => {
  it('marks image-only documents when no extracted text is present', () => {
    const result = summarizeExtractionConfidence({
      importStatus: 'ready',
      pageCount: 6,
      pageTextLengths: [0, 0, 0, 0, 0, 0],
    });

    expect(result.extractionState).toBe('image-only');
    expect(result.pagesWithExtractedText).toBe(0);
    expect(result.extractedTextLength).toBe(0);
  });

  it('marks limited documents when only a small amount of text was extracted', () => {
    const result = summarizeExtractionConfidence({
      importStatus: 'ready',
      pageCount: 8,
      pageTextLengths: [40, 0, 0, 0, 0, 0, 0, 0],
    });

    expect(result.extractionState).toBe('limited');
    expect(result.pagesWithExtractedText).toBe(1);
    expect(result.extractedTextLength).toBe(40);
  });

  it('keeps normal documents as normal when enough extracted text is present', () => {
    const result = summarizeExtractionConfidence({
      importStatus: 'ready',
      pageCount: 4,
      pageTextLengths: [300, 220, 180, 260],
    });

    expect(result.extractionState).toBe('normal');
    expect(result.pagesWithExtractedText).toBe(4);
  });
});
