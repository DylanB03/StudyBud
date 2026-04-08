import { describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';

import {
  chunkPageText,
  ensurePdfJsNodeGlobals,
  extractPdfDocument,
} from './extraction';

const createTestPdf = async (): Promise<Uint8Array> => {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  const firstPage = pdf.addPage([600, 800]);
  firstPage.drawText('Vectors and span', {
    x: 50,
    y: 720,
    size: 24,
    font,
  });
  firstPage.drawText('A set of vectors spans a space.', {
    x: 50,
    y: 680,
    size: 16,
    font,
  });

  const secondPage = pdf.addPage([600, 800]);
  secondPage.drawText('Basis and dimension', {
    x: 50,
    y: 720,
    size: 24,
    font,
  });

  const bytes = await pdf.save();
  return new Uint8Array(bytes);
};

describe('extractPdfDocument', () => {
  it('installs the PDF.js DOM polyfills for Node runtimes', async () => {
    const mutableGlobal = globalThis as unknown as {
      DOMMatrix?: typeof DOMMatrix;
      ImageData?: typeof ImageData;
      Path2D?: typeof Path2D;
    };
    const originalDOMMatrix = globalThis.DOMMatrix;
    const originalImageData = globalThis.ImageData;
    const originalPath2D = globalThis.Path2D;

    // Simulate the utility-process environment where these globals may be absent.
    delete mutableGlobal.DOMMatrix;
    delete mutableGlobal.ImageData;
    delete mutableGlobal.Path2D;

    await ensurePdfJsNodeGlobals();

    expect(globalThis.DOMMatrix).toBeDefined();
    expect(globalThis.ImageData).toBeDefined();
    expect(globalThis.Path2D).toBeDefined();

    if (typeof originalDOMMatrix !== 'undefined') {
      globalThis.DOMMatrix = originalDOMMatrix;
    }
    if (typeof originalImageData !== 'undefined') {
      globalThis.ImageData = originalImageData;
    }
    if (typeof originalPath2D !== 'undefined') {
      globalThis.Path2D = originalPath2D;
    }
  });

  it('configures PDF.js to use a resolvable worker module in Node-like runtimes', async () => {
    const pdfJs = await (await import('./extraction')).extractPdfDocument(
      await createTestPdf(),
    ).then(async () => import('pdfjs-dist/legacy/build/pdf.mjs'));

    expect(pdfJs.GlobalWorkerOptions.workerSrc).toContain('pdf.worker.mjs');
  });

  it('extracts per-page text from PDFs', async () => {
    const pdfBytes = await createTestPdf();
    const extracted = await extractPdfDocument(pdfBytes);

    expect(extracted.pageCount).toBe(2);
    expect(extracted.pages[0]?.textContent).toContain('Vectors and span');
    expect(extracted.pages[1]?.textContent).toContain('Basis and dimension');
  });
});

describe('chunkPageText', () => {
  it('splits long text into stable chunks', () => {
    const repeated = Array.from({ length: 40 }, () => 'linear algebra').join(' ');
    const chunks = chunkPageText('page-1', repeated, 80);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]?.pageId).toBe('page-1');
    expect(chunks[0]?.chunkIndex).toBe(0);
  });
});
