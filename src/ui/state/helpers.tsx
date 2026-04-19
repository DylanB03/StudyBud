import type { ReactNode } from 'react';

import type {
  CitationRef,
  PracticeDifficulty,
  ResearchBrowserState,
  SelectionContext,
  SettingsState,
  SourceDocumentDetail,
  SourceDocumentSummary,
  StudyBudApi,
  SubjectWorkspace,
} from '../../shared/ipc';

export type View =
  | 'library'
  | 'workspace'
  | 'units'
  | 'flashcard-decks'
  | 'flashcard-study'
  | 'settings';

export type UnitsSidebarTab = 'units' | 'documents' | 'flashcards';
export type WorkspaceRightTab = 'chat' | 'research';

export type ActiveAnalysisState = {
  provider: string;
  model: string;
  startedAt: number;
};

export type SelectionPopupPosition = {
  x: number;
  y: number;
};

export type SelectionUiMode = 'chip' | 'popup';

export type ChatRetryRequest = {
  prompt: string;
  selectionContext: SelectionContext | null;
};

export type PracticeRetryRequest = {
  problemTypeId: string;
  difficulty: PracticeDifficulty;
  count: number;
};

export type ResearchRetryRequest = {
  query: string;
  videoQuery: string;
};

export const DEFAULT_CHAT_PANEL_WIDTH = 380;
export const CHAT_PANEL_MIN_WIDTH = 280;
export const CHAT_PANEL_MAX_WIDTH = 720;
export const WORKSPACE_SIDEBAR_WIDTH = 280;
export const WORKSPACE_MAIN_MIN_WIDTH = 460;
export const WORKSPACE_RESIZER_WIDTH = 10;
export const WORKSPACE_GAP_TOTAL = 54;
export const LAST_WORKSPACE_SUBJECT_STORAGE_KEY = 'studybud.lastWorkspaceSubjectId';

export const initialSettings: SettingsState = {
  aiProvider: 'openai',
  openAiApiKeyConfigured: false,
  encryptionAvailable: false,
  ollamaBaseUrl: 'http://localhost:11434',
  ollamaModel: 'qwen3:8b',
  braveSearchApiKeyConfigured: false,
  youTubeApiKeyConfigured: false,
  researchSafetyMode: 'balanced',
  dataPath: '',
  defaultDataPath: '',
  usingCustomDataPath: false,
};

export const initialResearchBrowserState: ResearchBrowserState = {
  visible: false,
  url: '',
  title: '',
  canGoBack: false,
  canGoForward: false,
  loading: false,
  sourceUrl: '',
  errorMessage: null,
  contentKind: 'web',
};

export const formatDate = (isoString: string): string => {
  return new Date(isoString).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const formatElapsed = (elapsedMs: number): string => {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return minutes > 0
    ? `${minutes}m ${String(seconds).padStart(2, '0')}s`
    : `${seconds}s`;
};

export const getCitationKey = (citation: CitationRef): string => {
  return `${citation.documentId}:${citation.pageId}`;
};

const escapeRegExp = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

export const renderHighlightedText = (
  text: string,
  highlight: string | null,
): ReactNode => {
  const normalizedHighlight = highlight?.trim();

  if (!normalizedHighlight) {
    return text;
  }

  const expression = new RegExp(`(${escapeRegExp(normalizedHighlight)})`, 'i');
  const parts = text.split(expression);

  if (parts.length === 1) {
    return text;
  }

  return parts.map((part, index) =>
    expression.test(part) ? (
      <mark key={`${part}:${index}`} className="bg-primary/15 text-on-surface">
        {part}
      </mark>
    ) : (
      part
    ),
  );
};

export const buildCitationTextSnippet = (
  text: string,
  highlight: string | null,
): string => {
  const normalizedText = text.trim();
  const normalizedHighlight = highlight?.trim();

  if (!normalizedText) {
    return '';
  }

  if (!normalizedHighlight) {
    return normalizedText.length > 360
      ? `${normalizedText.slice(0, 360).trim()}...`
      : normalizedText;
  }

  const matchIndex = normalizedText
    .toLowerCase()
    .indexOf(normalizedHighlight.toLowerCase());

  if (matchIndex < 0) {
    return normalizedText.length > 360
      ? `${normalizedText.slice(0, 360).trim()}...`
      : normalizedText;
  }

  const start = Math.max(0, matchIndex - 120);
  const end = Math.min(
    normalizedText.length,
    matchIndex + normalizedHighlight.length + 180,
  );
  const prefix = start > 0 ? '...' : '';
  const suffix = end < normalizedText.length ? '...' : '';

  return `${prefix}${normalizedText.slice(start, end).trim()}${suffix}`;
};

export const getExtractionWarningMessage = (
  extractionState: SourceDocumentSummary['extractionState'],
): string | null => {
  if (extractionState === 'image-only') {
    return 'This PDF imported, but StudyBud could not extract selectable text from it. It is likely scanned or image-only, so analysis and chat will be limited.';
  }

  if (extractionState === 'limited') {
    return 'This PDF only produced limited selectable text during import. Some summaries, citations, and practice generation may be incomplete.';
  }

  return null;
};

export const getDocumentOcrBadgeLabel = (
  ocrState: SourceDocumentSummary['ocrState'],
): string | null => {
  if (ocrState === 'used') {
    return 'ocr used';
  }

  if (ocrState === 'partial') {
    return 'ocr partial';
  }

  if (ocrState === 'unavailable') {
    return 'ocr unavailable';
  }

  return null;
};

export const getDocumentOcrWarningMessage = (
  document: Pick<
    SourceDocumentSummary,
    'ocrState' | 'ocrWarning' | 'ocrAttemptedPages'
  >,
): string | null => {
  if (document.ocrWarning) {
    return document.ocrWarning;
  }

  if (document.ocrState === 'unavailable' && document.ocrAttemptedPages > 0) {
    return 'StudyBud detected pages that would benefit from OCR, but the local OCR runtime was unavailable during import.';
  }

  if (document.ocrState === 'partial') {
    return 'StudyBud attempted OCR on flagged pages, but some pages still have limited extracted text.';
  }

  return null;
};

export const getPageTextSourceLabel = (
  page: Pick<
    SourceDocumentDetail['pages'][number],
    'textSource' | 'ocrAttempted'
  >,
): string | null => {
  if (!page.ocrAttempted) {
    return null;
  }

  if (page.textSource === 'ocr') {
    return 'OCR text';
  }

  if (page.textSource === 'merged') {
    return 'Merged text';
  }

  return 'Native text';
};

export const getAnalysisTextSourceLabel = (
  textSource: 'native' | 'ocr' | 'merged',
): string => {
  if (textSource === 'ocr') {
    return 'OCR text';
  }

  if (textSource === 'merged') {
    return 'Merged text';
  }

  return 'Native text';
};

export const getFirstReadyDocumentId = (
  workspace: SubjectWorkspace,
): string | null => {
  const readyDocument = workspace.documents.find(
    (document) => document.importStatus === 'ready',
  );

  return readyDocument?.id ?? workspace.documents[0]?.id ?? null;
};

export const getStudyBudApi = (): StudyBudApi | null => {
  return window.studybud ?? null;
};

export const requireStudyBudApi = (): StudyBudApi => {
  const api = window.studybud;
  if (!api) {
    throw new Error(
      'window.studybud is not available. The preload script may have failed to initialize.',
    );
  }
  return api;
};

export const getNavigatorOnline = (): boolean => {
  if (typeof navigator === 'undefined') {
    return true;
  }

  return navigator.onLine;
};

export const hasMeaningfulSelection = (): boolean => {
  return (window.getSelection()?.toString().trim().length ?? 0) > 0;
};

export const createNotificationId = (): string => {
  return `notification-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};
