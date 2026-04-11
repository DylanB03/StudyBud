import { useEffect, useRef, useState } from 'react';

// Vite resolves asset URLs through the ?url suffix at build time.
// eslint-disable-next-line import/no-unresolved
import workerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type {
  PDFDocumentProxy,
  PDFPageProxy,
  RenderTask,
} from 'pdfjs-dist/types/src/display/api';

import type { CitationRef } from '../shared/ipc';

GlobalWorkerOptions.workerSrc = new URL(
  workerSrc,
  window.location.href,
).toString();

const isExpectedPdfTearDownError = (error: unknown): boolean => {
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

const renderPreviewPage = async (
  canvas: HTMLCanvasElement,
  page: PDFPageProxy,
): Promise<RenderTask> => {
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = 180 / baseViewport.width;
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

type CitationPreviewCardProps = {
  citation: CitationRef;
  documentBytes: Uint8Array | null;
  active: boolean;
  onClick: () => void;
  onTextSelection?: (citation: CitationRef) => void;
};

const clonePdfBytes = (bytes: Uint8Array): Uint8Array => {
  return bytes.slice();
};

export const CitationPreviewCard = ({
  citation,
  documentBytes,
  active,
  onClick,
  onTextSelection,
}: CitationPreviewCardProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [previewError, setPreviewError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: ReturnType<typeof getDocument> | null = null;
    let renderTask: RenderTask | null = null;
    let pdfDocument: PDFDocumentProxy | null = null;

    const render = async () => {
      const canvas = canvasRef.current;
      if (!canvas || !documentBytes) {
        return;
      }

      try {
        loadingTask = getDocument({
          data: clonePdfBytes(documentBytes),
          isEvalSupported: false,
        });
        pdfDocument = await loadingTask.promise;

        if (cancelled) {
          await pdfDocument.destroy().catch(() => undefined);
          return;
        }

        const page = await pdfDocument.getPage(citation.pageNumber);
        if (cancelled) {
          page.cleanup();
          await pdfDocument.destroy().catch(() => undefined);
          return;
        }

        renderTask = await renderPreviewPage(canvas, page);
        setPreviewError(false);
      } catch (error) {
        if (!cancelled && !isExpectedPdfTearDownError(error)) {
          setPreviewError(true);
        }
      }
    };

    void render();

    return () => {
      cancelled = true;
      renderTask?.cancel();
      void loadingTask?.destroy();
      if (pdfDocument) {
        void pdfDocument.destroy().catch(() => undefined);
      }
    };
  }, [citation.pageNumber, documentBytes]);

  const handleCardClick = () => {
    if ((window.getSelection()?.toString().trim().length ?? 0) > 0) {
      return;
    }

    onClick();
  };

  const handleTextMouseUp = () => {
    if ((window.getSelection()?.toString().trim().length ?? 0) === 0) {
      return;
    }

    onTextSelection?.(citation);
  };

  return (
    <button
      type="button"
      className={`citation-card${active ? ' active' : ''}`}
      onClick={handleCardClick}
    >
      <div className="citation-thumb-shell">
        {documentBytes && !previewError ? (
          <canvas ref={canvasRef} className="citation-preview-canvas" />
        ) : (
          <div className="citation-preview-placeholder">
            {previewError ? 'Preview unavailable' : 'Loading preview...'}
          </div>
        )}
      </div>

      <div className="citation-card-copy" onMouseUp={handleTextMouseUp}>
        <div className="citation-card-meta">
          <span className={`pill pill-${citation.documentKind}`}>
            {citation.documentKind}
          </span>
          {active ? <span className="analysis-count-pill">Focused</span> : null}
          <strong className="citation-doc-name">
            {citation.documentName}
          </strong>
          <span>Page {citation.pageNumber}</span>
        </div>
        <p className="citation-excerpt">
          {citation.excerptText || 'No excerpt available for this page.'}
        </p>
      </div>
    </button>
  );
};
