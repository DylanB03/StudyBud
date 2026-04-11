import { describe, expect, it } from 'vitest';

import { extractCitationExcerpt } from './citation-excerpts';

describe('extractCitationExcerpt', () => {
  it('prefers the segment that best matches the division keywords', () => {
    const result = extractCitationExcerpt(
      [
        'Announcements and logistics for next week.',
        'Basis vectors determine the coordinate system for the space.',
        'Dimension tells us how many basis vectors are required.',
      ].join(' '),
      ['Basis and Dimension', 'basis', 'dimension'],
    );

    expect(result.excerptText.toLowerCase()).toContain('basis vectors');
    expect(result.highlightText?.toLowerCase()).toContain('basis vectors');
  });

  it('falls back to the start of the page when no keyword match exists', () => {
    const result = extractCitationExcerpt(
      'This page mostly contains an overview and no strong topic keywords.',
      ['eigenvalues', 'diagonalization'],
    );

    expect(result.excerptText).toContain('This page mostly contains');
    expect(result.highlightText).toContain('This page mostly contains');
  });
});
