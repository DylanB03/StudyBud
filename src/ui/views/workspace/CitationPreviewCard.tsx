import { useEffect, useRef, useState } from 'react';

import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type {
  PDFDocumentProxy,
  PDFPageProxy,
  RenderTask,
} from 'pdfjs-dist/types/src/display/api';

import type { CitationRef } from '../../../shared/ipc';
import { Chip } from '../../components/Chip';
import { cn } from '../../theme/cn';
import {
  clonePdfBytes,
  ensurePdfJsWorkerConfigured,
  isExpectedPdfTearDownError,
} from '../../state/pdf-viewer-utils';

ensurePdfJsWorkerConfigured();

const renderPreviewPage = async (
  canvas: HTMLCanvasElement,
  page: PDFPageProxy,
): Promise<RenderTask> => {
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = 220 / baseViewport.width;
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

const kindTone = (kind: CitationRef['documentKind']): 'primary' | 'tertiary' =>
  kind === 'lecture' ? 'primary' : 'tertiary';

export const CitationPreviewCard = ({
  citation,
  documentBytes,
  active,
  onClick,
  onTextSelection,
}: CitationPreviewCardProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [previewError, setPreviewError] = useState<boolean>(false);

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
      } catch (err) {
        if (!cancelled && !isExpectedPdfTearDownError(err)) {
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
      onClick={handleCardClick}
      className={cn(
        'group flex flex-col gap-3 rounded-card border p-3 text-left transition-all duration-200',
        'bg-surface-container-lowest border-outline-variant/40 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-soft',
        active
          ? 'border-primary/80 shadow-elevated ring-2 ring-primary/30'
          : '',
      )}
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-surface-container-high">
        {documentBytes && !previewError ? (
          <canvas
            ref={canvasRef}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-3 text-center font-body text-body-xs text-on-surface-variant">
            {previewError ? 'Preview unavailable' : 'Loading preview...'}
          </div>
        )}
        <span className="absolute right-2 top-2 rounded-full bg-surface-container-lowest/90 px-2 py-0.5 font-display text-body-xs font-bold text-on-surface shadow-soft backdrop-blur">
          p.{citation.pageNumber}
        </span>
      </div>
      <div
        className="flex flex-col gap-2"
        onMouseUp={handleTextMouseUp}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Chip
            tone={kindTone(citation.documentKind)}
            className="px-2 py-0.5 text-body-xs"
          >
            {citation.documentKind}
          </Chip>
          {active ? (
            <Chip tone="secondary" className="px-2 py-0.5 text-body-xs">
              Focused
            </Chip>
          ) : null}
        </div>
        <strong className="font-display text-body-sm text-on-surface">
          {citation.documentName}
        </strong>
        <p className="line-clamp-3 font-body text-body-xs text-on-surface-variant">
          {citation.excerptText || 'No excerpt available for this page.'}
        </p>
      </div>
    </button>
  );
};
