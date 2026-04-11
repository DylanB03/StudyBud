const COMMON_DIRECTIVES = [
  "default-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
] as const;

export const buildRendererCsp = (isPackaged: boolean): string => {
  const directives = [
    ...COMMON_DIRECTIVES,
    isPackaged
      ? "script-src 'self'"
      : "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
    isPackaged ? "connect-src 'self'" : "connect-src 'self' ws:",
  ];

  return directives.join('; ');
};

export const RENDERER_CSP = buildRendererCsp(false);
export const PACKAGED_RENDERER_CSP = buildRendererCsp(true);

export const applyContentSecurityPolicy = (
  isPackaged: boolean,
  responseHeaders: Record<string, string[] | undefined> = {},
): Record<string, string[]> => {
  return {
    ...responseHeaders,
    'Content-Security-Policy': [buildRendererCsp(isPackaged)],
  };
};
