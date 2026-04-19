import { useEffect, useRef, useState } from 'react';

import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type {
  PDFDocumentProxy,
  PDFPageProxy,
  RenderTask,
} from 'pdfjs-dist/types/src/display/api';

import type { DocumentPageSummary } from '../../../shared/ipc';
import { Chip } from '../../components/Chip';
import { Icon } from '../../components/Icon';
import {
  clonePdfBytes,
  ensurePdfJsWorkerConfigured,
  isExpectedPdfTearDownError,
} from '../../state/pdf-viewer-utils';
import { cn } from '../../theme/cn';

ensurePdfJsWorkerConfigured();

type PdfViewerProps = {
  documentBytes: Uint8Array | null;
  pages: DocumentPageSummary[];
  selectedPageNumber: number;
  onSelectPage: (pageNumber: number) => void;
  focusText?: string | null;
};

const renderPageToCanvas = async (
  canvas: HTMLCanvasElement,
  page: PDFPageProxy,
  maxWidth: number,
): Promise<RenderTask> => {
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = maxWidth / baseViewport.width;
  const viewport = page.getViewport({ scale });
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas rendering context is unavailable');
  }
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const renderTask = page.render({
    canvas,
    canvasContext: context,
    viewport,
  });
  await renderTask.promise;
  return renderTask;
};

type ThumbnailProps = {
  pdfDocument: PDFDocumentProxy;
  pageNumber: number;
  active: boolean;
  onClick: () => void;
};

const Thumbnail = ({
  pdfDocument,
  pageNumber,
  active,
  onClick,
}: ThumbnailProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask: RenderTask | null = null;

    const run = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      try {
        const page = await pdfDocument.getPage(pageNumber);
        if (cancelled) {
          page.cleanup();
          return;
        }
        renderTask = await renderPageToCanvas(canvas, page, 120);
      } catch (err) {
        if (!cancelled && !isExpectedPdfTearDownError(err)) {
          // eslint-disable-next-line no-console
          console.warn('StudyBud thumbnail render failed.', err);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pageNumber, pdfDocument]);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex shrink-0 flex-col items-center gap-1 rounded-md border p-2 transition-all',
        'bg-surface-container-lowest hover:border-primary/60',
        active
          ? 'border-primary shadow-soft ring-2 ring-primary/30'
          : 'border-outline-variant/30',
      )}
    >
      <canvas
        ref={canvasRef}
        className="w-[100px] rounded bg-surface-container-high object-contain"
      />
      <span className="font-body text-body-xs text-on-surface-variant">
        Page {pageNumber}
      </span>
    </button>
  );
};

export const PdfViewer = ({
  documentBytes,
  pages,
  selectedPageNumber,
  onSelectPage,
  focusText = null,
}: PdfViewerProps) => {
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const pageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeDocumentRef = useRef<PDFDocumentProxy | null>(null);

  useEffect(() => {
    return () => {
      if (activeDocumentRef.current) {
        void activeDocumentRef.current.destroy().catch(() => undefined);
        activeDocumentRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: ReturnType<typeof getDocument> | null = null;
    let nextDocument: PDFDocumentProxy | null = null;

    const load = async () => {
      if (activeDocumentRef.current) {
        const previousDocument = activeDocumentRef.current;
        activeDocumentRef.current = null;
        setPdfDocument(null);
        await previousDocument.destroy().catch(() => undefined);
      }

      if (!documentBytes) {
        setPdfDocument(null);
        return;
      }

      setIsLoading(true);
      setViewerError(null);

      try {
        loadingTask = getDocument({
          data: clonePdfBytes(documentBytes),
          isEvalSupported: false,
        });
        nextDocument = await loadingTask.promise;
        if (cancelled) {
          await nextDocument.destroy().catch(() => undefined);
          return;
        }
        activeDocumentRef.current = nextDocument;
        setPdfDocument(nextDocument);
      } catch (err) {
        if (!cancelled && !isExpectedPdfTearDownError(err)) {
          setViewerError(
            err instanceof Error ? err.message : 'Could not load PDF viewer.',
          );
          setPdfDocument(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
      void loadingTask?.destroy();
      if (nextDocument && activeDocumentRef.current !== nextDocument) {
        void nextDocument.destroy().catch(() => undefined);
      }
    };
  }, [documentBytes]);

  useEffect(() => {
    let cancelled = false;
    let renderTask: RenderTask | null = null;

    const renderActivePage = async () => {
      const canvas = pageCanvasRef.current;
      if (!canvas || !pdfDocument) return;
      try {
        const page = await pdfDocument.getPage(selectedPageNumber);
        if (cancelled) {
          page.cleanup();
          return;
        }
        const maxWidth = Math.min(window.innerWidth * 0.48, 920);
        renderTask = await renderPageToCanvas(canvas, page, maxWidth);
      } catch (err) {
        if (!cancelled && !isExpectedPdfTearDownError(err)) {
          setViewerError(
            err instanceof Error
              ? err.message
              : 'Could not render the selected PDF page.',
          );
        }
      }
    };

    void renderActivePage();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdfDocument, selectedPageNumber]);

  if (viewerError) {
    return (
      <div className="rounded-card border border-error/40 bg-error/10 p-6 text-center font-body text-body-sm text-on-surface">
        {viewerError}
      </div>
    );
  }

  if (isLoading || !pdfDocument) {
    return (
      <div className="flex items-center justify-center rounded-card border border-dashed border-outline-variant/40 bg-surface-container-lowest px-6 py-12">
        <div className="flex flex-col items-center gap-3">
          <span className="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
          <p className="font-body text-body-sm text-on-surface-variant">
            Loading PDF preview…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-4 rounded-card border border-outline-variant/20 bg-surface-container-lowest p-3">
      <aside className="flex max-h-[520px] w-[140px] shrink-0 flex-col gap-2 overflow-y-auto pr-1">
        {pages.map((page) => (
          <Thumbnail
            key={page.id}
            pdfDocument={pdfDocument}
            pageNumber={page.pageNumber}
            active={page.pageNumber === selectedPageNumber}
            onClick={() => onSelectPage(page.pageNumber)}
          />
        ))}
      </aside>

      <section className="relative flex flex-1 flex-col gap-3 overflow-hidden">
        <div className="flex items-center justify-between gap-3 rounded-md bg-surface-container-low px-3 py-2">
          <div className="flex items-center gap-2">
            <Icon name="description" size="sm" className="text-primary" />
            <strong className="font-display text-body-md text-on-surface">
              Page {selectedPageNumber}
            </strong>
          </div>
          <Chip tone="default" className="px-2 py-0.5 text-body-xs">
            {pages.length} total pages
          </Chip>
        </div>
        {focusText ? (
          <div className="rounded-md border-l-4 border-primary bg-primary/5 px-3 py-2 font-body text-body-sm italic text-on-surface-variant">
            Focused citation: {focusText}
          </div>
        ) : null}
        <div className="flex max-h-[640px] flex-1 justify-center overflow-auto rounded-md bg-surface-container-high p-3">
          <canvas
            ref={pageCanvasRef}
            className="h-fit max-w-full rounded shadow-soft"
          />
        </div>
      </section>
    </div>
  );
};
