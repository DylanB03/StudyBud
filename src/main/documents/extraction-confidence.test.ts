import { describe, expect, it } from 'vitest';

import {
  assessPageForOcr,
  mergePreferredPageText,
  summarizeExtractionConfidence,
} from './extraction-confidence';

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

describe('assessPageForOcr', () => {
  it('flags empty pages for OCR', () => {
    expect(assessPageForOcr('   ')).toMatchObject({
      shouldAttemptOcr: true,
      reason: 'no-text',
    });
  });

  it('does not flag strong native text for OCR', () => {
    expect(
      assessPageForOcr(
        'Linear transformations preserve vector addition and scalar multiplication.',
      ),
    ).toMatchObject({
      shouldAttemptOcr: false,
      reason: null,
    });
  });
});

describe('mergePreferredPageText', () => {
  it('prefers OCR when native text is empty', () => {
    expect(mergePreferredPageText('', 'N_1 x N_2 product space')).toEqual({
      textContent: 'N_1 x N_2 product space',
      textSource: 'ocr',
      improved: true,
    });
  });

  it('merges distinct native and OCR text when both provide value', () => {
    const result = mergePreferredPageText(
      'Span of vectors',
      'A span is the set of all linear combinations.',
    );

    expect(result.textSource).toBe('merged');
    expect(result.improved).toBe(true);
    expect(result.textContent).toContain('Span of vectors');
    expect(result.textContent).toContain('linear combinations');
  });
});
