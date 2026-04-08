import { describe, expect, it } from 'vitest';

import {
  applyContentSecurityPolicy,
  PACKAGED_RENDERER_CSP,
  RENDERER_CSP,
} from './csp';

describe('content security policy', () => {
  it('includes key hardening directives for development', () => {
    expect(RENDERER_CSP).toContain("default-src 'self'");
    expect(RENDERER_CSP).toContain("object-src 'none'");
    expect(RENDERER_CSP).toContain("frame-ancestors 'none'");
    expect(RENDERER_CSP).toContain("script-src 'self' 'unsafe-eval'");
  });

  it('tightens the packaged policy', () => {
    expect(PACKAGED_RENDERER_CSP).toContain("script-src 'self'");
    expect(PACKAGED_RENDERER_CSP).not.toContain("'unsafe-eval'");
    expect(PACKAGED_RENDERER_CSP).toContain("connect-src 'self'");
  });

  it('adds the development CSP header without dropping existing headers', () => {
    const headers = applyContentSecurityPolicy(false, {
      'X-Test': ['ok'],
    });

    expect(headers['X-Test']).toEqual(['ok']);
    expect(headers['Content-Security-Policy']).toEqual([RENDERER_CSP]);
  });

  it('adds the packaged CSP header when production mode is requested', () => {
    const headers = applyContentSecurityPolicy(true);
    expect(headers['Content-Security-Policy']).toEqual([PACKAGED_RENDERER_CSP]);
  });
});
