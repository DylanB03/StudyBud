// Vite resolves asset URLs through the ?url suffix at build time.
// eslint-disable-next-line import/no-unresolved
import workerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';

let workerConfigured = false;

export const ensurePdfJsWorkerConfigured = (): void => {
  if (workerConfigured) {
    return;
  }

  GlobalWorkerOptions.workerSrc = new URL(
    workerSrc,
    window.location.href,
  ).toString();
  workerConfigured = true;
};

export const clonePdfBytes = (bytes: Uint8Array): Uint8Array => {
  return bytes.slice();
};

export const isExpectedPdfTearDownError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes('rendering cancelled') ||
    message.includes('transport destroyed') ||
    message.includes('worker was destroyed') ||
    message.includes('page was destroyed')
  );
};
