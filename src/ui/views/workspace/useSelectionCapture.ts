import { useCallback } from 'react';

import type { DocumentKind, SelectionContext } from '../../../shared/ipc';
import { useSubjects } from '../../state/SubjectsState';
import { useWorkspace } from '../../state/WorkspaceState';

type CaptureInput = {
  kind: SelectionContext['kind'];
  selectedText?: string;
  surroundingText: string;
  divisionId?: string;
  sourcePageIds?: string[];
  pageId?: string | null;
  documentId?: string | null;
  documentName?: string | null;
  documentKind?: DocumentKind | null;
  pageNumber?: number | null;
};

type UseSelectionCaptureResult = {
  capture: (input: CaptureInput) => void;
};

const POPUP_WIDTH = 360;
const VIEWPORT_PADDING = 16;

export const useSelectionCapture = (): UseSelectionCaptureResult => {
  const { activeSubject } = useSubjects();
  const { workspace, selectedDivisionId, setSelection } = useWorkspace();

  const capture = useCallback(
    (input: CaptureInput) => {
      if (!workspace || !activeSubject) return;
      const division =
        workspace.analysis?.divisions.find(
          (d) => d.id === (input.divisionId ?? selectedDivisionId),
        ) ?? null;
      if (!division) return;

      const selection = window.getSelection();
      const selectedText = (
        input.selectedText ?? selection?.toString() ?? ''
      ).trim();
      if (!selectedText || !selection || selection.rangeCount === 0) {
        return;
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const nextX = Math.min(
        Math.max(
          VIEWPORT_PADDING,
          rect.left + rect.width / 2 - POPUP_WIDTH / 2,
        ),
        window.innerWidth - POPUP_WIDTH - VIEWPORT_PADDING,
      );
      const preferredAboveY = rect.top + window.scrollY - 48;
      const fallbackBelowY = rect.bottom + window.scrollY + 8;
      const nextY =
        preferredAboveY > VIEWPORT_PADDING ? preferredAboveY : fallbackBelowY;

      const context: SelectionContext = {
        kind: input.kind,
        subjectId: activeSubject.id,
        divisionId: division.id,
        selectedText,
        surroundingText: input.surroundingText.trim(),
        sourcePageIds:
          input.sourcePageIds ??
          division.sourcePages.map((page) => page.pageId),
        pageId: input.pageId ?? null,
        documentId: input.documentId ?? null,
        documentName: input.documentName ?? null,
        documentKind: input.documentKind ?? null,
        pageNumber: input.pageNumber ?? null,
      };

      setSelection(context, { x: nextX, y: nextY }, 'chip');
    },
    [workspace, activeSubject, selectedDivisionId, setSelection],
  );

  return { capture };
};
