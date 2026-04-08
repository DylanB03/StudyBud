import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

export type ExtractedPdfPage = {
  pageNumber: number;
  textContent: string;
};

export type ExtractedPdfDocument = {
  pageCount: number;
  pages: ExtractedPdfPage[];
};

let pdfJsNodeGlobalsReady = false;
let pdfJsModulePromise:
  | Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs')>
  | null = null;

const runtimeRequire = createRequire(__filename);

class MinimalDOMMatrix {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;
  m11 = 1;
  m12 = 0;
  m13 = 0;
  m14 = 0;
  m21 = 0;
  m22 = 1;
  m23 = 0;
  m24 = 0;
  m31 = 0;
  m32 = 0;
  m33 = 1;
  m34 = 0;
  m41 = 0;
  m42 = 0;
  m43 = 0;
  m44 = 1;
  is2D = true;
  isIdentity = true;

  constructor(
    _init?:
      | string
      | number[]
      | Float32Array
      | Float64Array
      | MinimalDOMMatrix
      | null,
  ) {
    void _init;
  }

  multiplySelf(): this {
    return this;
  }

  preMultiplySelf(): this {
    return this;
  }

  translateSelf(): this {
    return this;
  }

  scaleSelf(): this {
    return this;
  }

  rotateSelf(): this {
    return this;
  }

  invertSelf(): this {
    return this;
  }

  transformPoint<
    Point extends {
      x?: number;
      y?: number;
      z?: number;
      w?: number;
    },
  >(point: Point): Point & { x: number; y: number; z: number; w: number } {
    return {
      x: point.x ?? 0,
      y: point.y ?? 0,
      z: point.z ?? 0,
      w: point.w ?? 1,
      ...point,
    };
  }

  toFloat32Array(): Float32Array {
    return Float32Array.from([1, 0, 0, 1, 0, 0]);
  }

  toFloat64Array(): Float64Array {
    return Float64Array.from([1, 0, 0, 1, 0, 0]);
  }

  static fromMatrix(): MinimalDOMMatrix {
    return new MinimalDOMMatrix();
  }
}

class MinimalImageData {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;

  constructor(widthOrData: number | Uint8ClampedArray, width?: number, height?: number) {
    if (typeof widthOrData === 'number') {
      this.width = widthOrData;
      this.height = width ?? 0;
      this.data = new Uint8ClampedArray(this.width * this.height * 4);
      return;
    }

    this.data = widthOrData;
    this.width = width ?? 0;
    this.height = height ?? 0;
  }
}

class MinimalPath2D {
  addPath(): void {
    return;
  }
}

const normalizeText = (value: string): string => {
  return value.replaceAll(String.fromCharCode(0), '').replace(/[ \t]+/g, ' ').trim();
};

const buildPageText = (
  items: Array<{
    str?: string;
    transform?: number[];
    hasEOL?: boolean;
  }>,
): string => {
  const output: string[] = [];
  let previousY: number | null = null;

  for (const item of items) {
    const rawText = typeof item.str === 'string' ? normalizeText(item.str) : '';

    if (!rawText) {
      continue;
    }

    const currentY = Array.isArray(item.transform) ? item.transform[5] : null;

    if (
      previousY !== null &&
      currentY !== null &&
      Math.abs(previousY - currentY) > 4
    ) {
      output.push('\n');
    } else if (output.length > 0 && output[output.length - 1] !== '\n') {
      output.push(' ');
    }

    output.push(rawText);

    if (item.hasEOL) {
      output.push('\n');
    }

    previousY = currentY;
  }

  return output
    .join('')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

export const ensurePdfJsNodeGlobals = async (): Promise<void> => {
  if (pdfJsNodeGlobalsReady) {
    return;
  }

  if (typeof globalThis.DOMMatrix === 'undefined') {
    globalThis.DOMMatrix = MinimalDOMMatrix as unknown as typeof DOMMatrix;
  }

  if (typeof globalThis.ImageData === 'undefined') {
    globalThis.ImageData = MinimalImageData as unknown as typeof ImageData;
  }

  if (typeof globalThis.Path2D === 'undefined') {
    globalThis.Path2D = MinimalPath2D as unknown as typeof Path2D;
  }

  pdfJsNodeGlobalsReady = true;
};

const loadPdfJs = async (): Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs')> => {
  if (pdfJsModulePromise) {
    return pdfJsModulePromise;
  }

  pdfJsModulePromise = (async () => {
    await ensurePdfJsNodeGlobals();

    const [pdfJs, pdfWorker] = await Promise.all([
      import('pdfjs-dist/legacy/build/pdf.mjs'),
      import(
        /* @vite-ignore */
        pathToFileURL(
          runtimeRequire.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs'),
        ).href
      ),
    ]);

    // Electron utility processes can look browser-like enough that PDF.js
    // attempts to bootstrap a real Worker. Preloading the worker module forces
    // the fake-worker path with a concrete module available.
    (globalThis as typeof globalThis & { pdfjsWorker?: unknown }).pdfjsWorker = pdfWorker;
    pdfJs.GlobalWorkerOptions.workerSrc = pathToFileURL(
      runtimeRequire.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs'),
    ).href;

    return pdfJs;
  })();

  return pdfJsModulePromise;
};

export const extractPdfDocument = async (
  pdfBytes: Uint8Array,
): Promise<ExtractedPdfDocument> => {
  const pdfJs = await loadPdfJs();
  const loadingTask = pdfJs.getDocument({
    data: pdfBytes,
    isEvalSupported: false,
    useSystemFonts: true,
    useWorkerFetch: false,
  });

  const pdfDocument = await loadingTask.promise;
  const pages: ExtractedPdfPage[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = buildPageText(
        textContent.items as Array<{
          str?: string;
          transform?: number[];
          hasEOL?: boolean;
        }>,
      );

      pages.push({
        pageNumber,
        textContent: pageText,
      });

      page.cleanup();
    }
  } finally {
    await pdfDocument.destroy();
    await loadingTask.destroy();
  }

  return {
    pageCount: pages.length,
    pages,
  };
};

export const chunkPageText = (
  pageId: string,
  textContent: string,
  maxCharacters = 1200,
): Array<{
  pageId: string;
  chunkIndex: number;
  textContent: string;
}> => {
  const normalized = textContent.trim();

  if (!normalized) {
    return [];
  }

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const chunks: Array<{
    pageId: string;
    chunkIndex: number;
    textContent: string;
  }> = [];

  let currentChunk = '';

  const pushChunk = () => {
    const text = currentChunk.trim();
    if (!text) {
      return;
    }

    chunks.push({
      pageId,
      chunkIndex: chunks.length,
      textContent: text,
    });

    currentChunk = '';
  };

  for (const paragraph of paragraphs) {
    const separator = currentChunk.length === 0 ? '' : '\n\n';
    const nextValue = `${currentChunk}${separator}${paragraph}`;

    if (nextValue.length <= maxCharacters) {
      currentChunk = nextValue;
      continue;
    }

    if (currentChunk.length > 0) {
      pushChunk();
    }

    if (paragraph.length <= maxCharacters) {
      currentChunk = paragraph;
      continue;
    }

    let start = 0;
    while (start < paragraph.length) {
      const slice = paragraph.slice(start, start + maxCharacters).trim();
      if (slice.length > 0) {
        chunks.push({
          pageId,
          chunkIndex: chunks.length,
          textContent: slice,
        });
      }
      start += maxCharacters;
    }
  }

  pushChunk();
  return chunks;
};
