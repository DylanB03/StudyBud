import { useEffect, useRef, useState } from 'react';

import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type {
  PDFDocumentProxy,
  PDFPageProxy,
  RenderTask,
} from 'pdfjs-dist/types/src/display/api';

import type { DocumentPageSummary } from '../shared/ipc';
import {
  clonePdfBytes,
  ensurePdfJsWorkerConfigured,
  isExpectedPdfTearDownError,
} from './pdf-viewer-utils';

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

const Thumbnail = ({
  pdfDocument,
  pageNumber,
  active,
  onClick,
}: {
  pdfDocument: PDFDocumentProxy;
  pageNumber: number;
  active: boolean;
  onClick: () => void;
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask: RenderTask | null = null;

    const run = async () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      try {
        const page = await pdfDocument.getPage(pageNumber);
        if (cancelled) {
          page.cleanup();
          return;
        }

        renderTask = await renderPageToCanvas(canvas, page, 120);
      } catch (error) {
        if (!cancelled && !isExpectedPdfTearDownError(error)) {
          // Thumbnail failures should stay local so the main document viewer can continue.
          console.warn('StudyBud thumbnail render failed.', error);
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
      className={`thumbnail-card${active ? ' active' : ''}`}
      onClick={onClick}
    >
      <canvas ref={canvasRef} className="thumbnail-canvas" />
      <span>Page {pageNumber}</span>
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
  const [isLoading, setIsLoading] = useState(false);
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
      } catch (error) {
        if (!cancelled && !isExpectedPdfTearDownError(error)) {
          setViewerError(
            error instanceof Error ? error.message : 'Could not load PDF viewer.',
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
      if (!canvas || !pdfDocument) {
        return;
      }

      try {
        const page = await pdfDocument.getPage(selectedPageNumber);
        if (cancelled) {
          page.cleanup();
          return;
        }

        const maxWidth = Math.min(window.innerWidth * 0.48, 920);
        renderTask = await renderPageToCanvas(canvas, page, maxWidth);
      } catch (error) {
        if (!cancelled && !isExpectedPdfTearDownError(error)) {
          setViewerError(
            error instanceof Error
              ? error.message
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
    return <div className="empty-state">{viewerError}</div>;
  }

  if (isLoading || !pdfDocument) {
    return <div className="empty-state">Loading PDF preview...</div>;
  }

  return (
    <div className="pdf-viewer-grid">
      <aside className="thumbnail-strip">
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

      <section className="pdf-stage">
        <div className="pdf-stage-toolbar">
          <strong>Page {selectedPageNumber}</strong>
          <span>{pages.length} total pages</span>
        </div>
        {focusText ? (
          <div className="pdf-focus-banner">
            Focused citation: {focusText}
          </div>
        ) : null}
        <canvas ref={pageCanvasRef} className="pdf-page-canvas" />
      </section>
    </div>
  );
};
