const EXCERPT_LIMIT = 280;
const HIGHLIGHT_LIMIT = 180;

const normalizeWhitespace = (value: string): string => {
  return value.replace(/\s+/g, ' ').trim();
};

const clipExcerpt = (value: string, maxLength: number): string => {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trim()}...`;
};

const tokenizeKeywords = (values: string[]): string[] => {
  return [...new Set(
    values
      .flatMap((value) =>
        normalizeWhitespace(value)
          .toLowerCase()
          .split(/[^a-z0-9]+/i)
          .filter((token) => token.length >= 4),
      ),
  )];
};

const scoreSegment = (segment: string, keywords: string[]): number => {
  const normalized = normalizeWhitespace(segment).toLowerCase();

  if (!normalized) {
    return 0;
  }

  return keywords.reduce((score, keyword) => {
    return normalized.includes(keyword) ? score + 1 : score;
  }, 0);
};

export const extractCitationExcerpt = (
  textContent: string,
  candidateKeywords: string[],
): {
  excerptText: string;
  highlightText: string | null;
} => {
  const normalizedText = normalizeWhitespace(textContent);

  if (!normalizedText) {
    return {
      excerptText: '',
      highlightText: null,
    };
  }

  const segments = normalizedText
    .split(/(?<=[.!?])\s+|\s*\n+\s*/)
    .map(normalizeWhitespace)
    .filter(Boolean);

  const keywords = tokenizeKeywords(candidateKeywords);
  const bestSegment = segments.reduce<{
    segment: string | null;
    score: number;
  }>(
    (best, segment) => {
      const score = scoreSegment(segment, keywords);
      if (score > best.score) {
        return {
          segment,
          score,
        };
      }

      if (score === best.score && score > 0 && best.segment && segment.length > best.segment.length) {
        return {
          segment,
          score,
        };
      }

      return best;
    },
    {
      segment: null,
      score: 0,
    },
  );

  const highlightBase = bestSegment.segment ?? segments[0] ?? normalizedText;
  const highlightText = clipExcerpt(highlightBase, HIGHLIGHT_LIMIT);

  if (!bestSegment.segment) {
    return {
      excerptText: clipExcerpt(normalizedText, EXCERPT_LIMIT),
      highlightText,
    };
  }

  const segmentIndex = segments.findIndex((segment) => segment === bestSegment.segment);
  const excerptSegments =
    segmentIndex >= 0
      ? segments.slice(segmentIndex, Math.min(segmentIndex + 2, segments.length))
      : [bestSegment.segment];

  const excerptText = clipExcerpt(excerptSegments.join(' '), EXCERPT_LIMIT);

  return {
    excerptText,
    highlightText,
  };
};
