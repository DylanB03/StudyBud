export type ExtractionConfidence = {
  extractedTextLength: number;
  pagesWithExtractedText: number;
  extractionState: 'normal' | 'limited' | 'image-only';
};

export type PageOcrAssessment = {
  shouldAttemptOcr: boolean;
  reason: 'no-text' | 'low-text' | 'low-quality' | null;
  nativeQualityScore: number;
};

export type PageTextMergeResult = {
  textContent: string;
  textSource: 'native' | 'ocr' | 'merged';
  improved: boolean;
};

const cleanText = (value: string): string => {
  return value.replace(/\s+/g, ' ').trim();
};

const getTextQualityScore = (value: string): number => {
  const cleaned = cleanText(value);

  if (cleaned.length === 0) {
    return 0;
  }

  const alphaNumericCharacters = Array.from(cleaned).filter((character) =>
    /[A-Za-z0-9]/.test(character),
  ).length;
  const weirdCharacters = Array.from(cleaned).filter((character) =>
    /[^A-Za-z0-9\s.,;:()\-+=[\]{}<>/\\%$^_*]/.test(character),
  ).length;

  return cleaned.length + alphaNumericCharacters * 2 - weirdCharacters * 3;
};

export const assessPageForOcr = (textContent: string): PageOcrAssessment => {
  const cleaned = cleanText(textContent);
  const qualityScore = getTextQualityScore(cleaned);

  if (cleaned.length === 0) {
    return {
      shouldAttemptOcr: true,
      reason: 'no-text',
      nativeQualityScore: qualityScore,
    };
  }

  if (cleaned.length < 24) {
    return {
      shouldAttemptOcr: true,
      reason: 'low-text',
      nativeQualityScore: qualityScore,
    };
  }

  if (qualityScore < Math.max(45, cleaned.length * 0.8)) {
    return {
      shouldAttemptOcr: true,
      reason: 'low-quality',
      nativeQualityScore: qualityScore,
    };
  }

  return {
    shouldAttemptOcr: false,
    reason: null,
    nativeQualityScore: qualityScore,
  };
};

export const mergePreferredPageText = (
  nativeText: string,
  ocrText: string,
): PageTextMergeResult => {
  const cleanedNative = cleanText(nativeText);
  const cleanedOcr = cleanText(ocrText);

  if (cleanedOcr.length === 0) {
    return {
      textContent: cleanedNative,
      textSource: 'native',
      improved: false,
    };
  }

  if (cleanedNative.length === 0) {
    return {
      textContent: cleanedOcr,
      textSource: 'ocr',
      improved: true,
    };
  }

  const nativeScore = getTextQualityScore(cleanedNative);
  const ocrScore = getTextQualityScore(cleanedOcr);

  if (cleanedNative === cleanedOcr) {
    return {
      textContent: cleanedOcr,
      textSource: 'ocr',
      improved: ocrScore > nativeScore,
    };
  }

  if (cleanedOcr.includes(cleanedNative)) {
    return {
      textContent: cleanedOcr,
      textSource: 'ocr',
      improved: true,
    };
  }

  if (cleanedNative.includes(cleanedOcr)) {
    return {
      textContent: cleanedNative,
      textSource: 'native',
      improved: false,
    };
  }

  if (cleanedNative.length < 12 && ocrScore > nativeScore) {
    return {
      textContent: cleanedOcr,
      textSource: 'ocr',
      improved: true,
    };
  }

  if (nativeScore > ocrScore + 30 && cleanedNative.length >= cleanedOcr.length) {
    return {
      textContent: cleanedNative,
      textSource: 'native',
      improved: false,
    };
  }

  return {
    textContent: `${cleanedNative}\n\n${cleanedOcr}`,
    textSource: 'merged',
    improved: true,
  };
};

export const summarizeExtractionConfidence = ({
  importStatus,
  pageCount,
  pageTextLengths,
}: {
  importStatus: string;
  pageCount: number;
  pageTextLengths: number[];
}): ExtractionConfidence => {
  const extractedTextLength = pageTextLengths.reduce(
    (total, textLength) => total + textLength,
    0,
  );
  const pagesWithExtractedText = pageTextLengths.filter(
    (textLength) => textLength > 0,
  ).length;

  const extractionState: ExtractionConfidence['extractionState'] =
    importStatus !== 'ready' || pageCount === 0
      ? 'normal'
      : pagesWithExtractedText === 0
        ? 'image-only'
        : pagesWithExtractedText <= Math.max(1, Math.floor(pageCount * 0.25)) &&
            extractedTextLength < Math.max(200, pageCount * 60)
          ? 'limited'
          : 'normal';

  return {
    extractedTextLength,
    pagesWithExtractedText,
    extractionState,
  };
};
