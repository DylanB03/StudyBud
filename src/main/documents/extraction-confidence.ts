export type ExtractionConfidence = {
  extractedTextLength: number;
  pagesWithExtractedText: number;
  extractionState: 'normal' | 'limited' | 'image-only';
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
