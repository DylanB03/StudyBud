import { FormEvent, Suspense, lazy, useEffect, useRef, useState } from 'react';

import type {
  AnalyzeSubjectResult,
  AiProvider,
  AppInfo,
  ChatAskResult,
  CitationRef,
  FlashcardDeck,
  DocumentKind,
  GenerateFlashcardsResult,
  GeneratePracticeResult,
  PracticeDifficulty,
  PracticeQuestion,
  PracticeSet,
  ResearchBrowserState,
  ResearchSearchResult,
  SelectionContext,
  SettingsState,
  SourceDocumentDetail,
  SubjectAnalysisDivision,
  SubjectSummary,
  SubjectWorkspace,
} from '../shared/ipc';
import { CitationPreviewCard } from './CitationPreviewCard';
import { DivisionChatPanel } from './DivisionChatPanel';
import { DismissibleBanner } from './DismissibleBanner';
import { FlashcardsPanel } from './FlashcardsPanel';
import { NotificationCenter } from './NotificationCenter';
import type { AppNotification } from './NotificationCenter';
import { PracticePanel } from './PracticePanel';
import { ResearchPanel } from './ResearchPanel';
import { SelectionAskChip } from './SelectionAskChip';
import { SelectionQuestionPopup } from './SelectionQuestionPopup';
import {
  CHAT_PANEL_MAX_WIDTH,
  CHAT_PANEL_MIN_WIDTH,
  DEFAULT_CHAT_PANEL_WIDTH,
  LAST_WORKSPACE_SUBJECT_STORAGE_KEY,
  WORKSPACE_GAP_TOTAL,
  WORKSPACE_MAIN_MIN_WIDTH,
  WORKSPACE_RESIZER_WIDTH,
  WORKSPACE_SIDEBAR_WIDTH,
  buildCitationTextSnippet,
  formatDate,
  formatElapsed,
  getAnalysisTextSourceLabel,
  getCitationKey,
  getDocumentOcrBadgeLabel,
  getDocumentOcrWarningMessage,
  getExtractionWarningMessage,
  getFirstReadyDocumentId,
  getNavigatorOnline,
  getPageTextSourceLabel,
  getStudyBudApi,
  hasMeaningfulSelection,
  initialResearchBrowserState,
  initialSettings,
  renderHighlightedText,
  type ActiveAnalysisState,
  type ChatRetryRequest,
  type PracticeRetryRequest,
  type ResearchRetryRequest,
  type SelectionPopupPosition,
  type SelectionUiMode,
  type UnitsSidebarTab,
  type View,
  type WorkspaceRightTab,
} from './app-helpers';

const PdfViewer = lazy(async () => {
  const module = await import('./PdfViewer');
  return {
    default: module.PdfViewer,
  };
});

type SelectionDraft = SelectionContext;
const createNotificationId = (): string => {
  return `notification-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

export const App = () => {
  const studybud = getStudyBudApi();
  const [activeView, setActiveView] = useState<View>('library');
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [settings, setSettings] = useState<SettingsState>(initialSettings);
  const [subjects, setSubjects] = useState<SubjectSummary[]>([]);
  const [workspace, setWorkspace] = useState<SubjectWorkspace | null>(null);
  const [selectedDivisionId, setSelectedDivisionId] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [selectedPageNumber, setSelectedPageNumber] = useState(1);
  const [documentDetail, setDocumentDetail] = useState<SourceDocumentDetail | null>(
    null,
  );
  const [documentBytes, setDocumentBytes] = useState<Uint8Array | null>(null);
  const [documentBytesCache, setDocumentBytesCache] = useState<
    Record<string, Uint8Array>
  >({});
  const [subjectName, setSubjectName] = useState('');
  const [aiProviderInput, setAiProviderInput] = useState<AiProvider>('openai');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [ollamaBaseUrlInput, setOllamaBaseUrlInput] = useState(
    'http://localhost:11434',
  );
  const [ollamaModelInput, setOllamaModelInput] = useState('qwen3:8b');
  const [braveSearchApiKeyInput, setBraveSearchApiKeyInput] = useState('');
  const [youTubeApiKeyInput, setYouTubeApiKeyInput] = useState('');
  const [researchSafetyModeInput, setResearchSafetyModeInput] = useState<
    'balanced' | 'education'
  >('balanced');
  const [activeAnalysis, setActiveAnalysis] = useState<ActiveAnalysisState | null>(
    null,
  );
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [lastChatRequest, setLastChatRequest] = useState<ChatRetryRequest | null>(
    null,
  );
  const [selectionDraft, setSelectionDraft] = useState<SelectionDraft | null>(null);
  const [selectionQuestionInput, setSelectionQuestionInput] = useState('');
  const [selectionPopupPosition, setSelectionPopupPosition] =
    useState<SelectionPopupPosition | null>(null);
  const [selectionUiMode, setSelectionUiMode] = useState<SelectionUiMode>('chip');
  const [selectedCitationKey, setSelectedCitationKey] = useState<string | null>(null);
  const [analysisElapsedMs, setAnalysisElapsedMs] = useState(0);
  const [selectedPracticeProblemTypeId, setSelectedPracticeProblemTypeId] =
    useState<string>('');
  const [practiceDifficulty, setPracticeDifficulty] =
    useState<PracticeDifficulty>('medium');
  const [practiceCount, setPracticeCount] = useState(3);
  const [practiceBusy, setPracticeBusy] = useState(false);
  const [practiceError, setPracticeError] = useState<string | null>(null);
  const [flashcardsBusy, setFlashcardsBusy] = useState(false);
  const [flashcardsError, setFlashcardsError] = useState<string | null>(null);
  const [lastPracticeRequest, setLastPracticeRequest] =
    useState<PracticeRetryRequest | null>(null);
  const [rightRailTab, setRightRailTab] = useState<WorkspaceRightTab>('chat');
  const [researchQueryInput, setResearchQueryInput] = useState('');
  const [researchVideoQueryInput, setResearchVideoQueryInput] = useState('');
  const [researchBusy, setResearchBusy] = useState(false);
  const [researchError, setResearchError] = useState<string | null>(null);
  const [lastResearchRequest, setLastResearchRequest] =
    useState<ResearchRetryRequest | null>(null);
  const [researchResult, setResearchResult] = useState<ResearchSearchResult | null>(
    null,
  );
  const [researchBrowserState, setResearchBrowserState] =
    useState<ResearchBrowserState>(initialResearchBrowserState);
  const [researchBrowserUrlInput, setResearchBrowserUrlInput] = useState('');
  const [isOnline, setIsOnline] = useState<boolean>(getNavigatorOnline);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isUnassignedPagesExpanded, setIsUnassignedPagesExpanded] = useState(false);
  const [isPageTextExpanded, setIsPageTextExpanded] = useState(false);
  const [unitsSidebarTab, setUnitsSidebarTab] = useState<UnitsSidebarTab>('units');
  const [chatPanelWidth, setChatPanelWidth] = useState<number>(() => {
    if (typeof window === 'undefined') {
      return DEFAULT_CHAT_PANEL_WIDTH;
    }

    const stored = Number(window.localStorage.getItem('studybud.chatPanelWidth'));
    if (!Number.isFinite(stored)) {
      return DEFAULT_CHAT_PANEL_WIDTH;
    }

    return Math.min(
      CHAT_PANEL_MAX_WIDTH,
      Math.max(CHAT_PANEL_MIN_WIDTH, stored),
    );
  });
  const [lastWorkspaceSubjectId, setLastWorkspaceSubjectId] = useState<string | null>(
    () => {
      if (typeof window === 'undefined') {
        return null;
      }

      return window.localStorage.getItem(LAST_WORKSPACE_SUBJECT_STORAGE_KEY);
    },
  );
  const [lastUnitBySubject, setLastUnitBySubject] = useState<Record<string, string>>(
    {},
  );
  const [isResizingChatPanel, setIsResizingChatPanel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingChatPrompt, setPendingChatPrompt] = useState<string | null>(null);
  const pendingPageSelectionRef = useRef<number | null>(null);
  const workspaceGridRef = useRef<HTMLDivElement | null>(null);
  const pdfViewerSectionRef = useRef<HTMLElement | null>(null);
  const researchBrowserHostRef = useRef<HTMLDivElement | null>(null);
  const researchPanelRef = useRef<HTMLElement | null>(null);
  const [error, setError] = useState<string | null>(
    studybud
      ? null
      : 'StudyBud must be launched inside the Electron desktop app. Run `npm start` or open the packaged desktop build instead of opening the renderer in a browser tab.',
  );
  const currentDivision =
    workspace?.analysis?.divisions.find(
      (division) => division.id === selectedDivisionId,
    ) ?? null;

  useEffect(() => {
    if (!studybud) {
      return;
    }

    let cancelled = false;

    const loadDashboard = async () => {
      setBusy(true);
      setError(null);

      try {
        const [nextInfo, nextSettings, nextSubjects] = await Promise.all([
          studybud.getAppInfo(),
          studybud.getSettings(),
          studybud.listSubjects(),
        ]);

        if (cancelled) {
          return;
        }

        setAppInfo(nextInfo);
        setSettings(nextSettings);
        setSubjects(nextSubjects);
      } catch (caughtError) {
        if (!cancelled) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : 'Could not load application data.',
          );
        }
      } finally {
        if (!cancelled) {
          setBusy(false);
        }
      }
    };

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [studybud]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    setAiProviderInput(settings.aiProvider);
    setOllamaBaseUrlInput(settings.ollamaBaseUrl);
    setOllamaModelInput(settings.ollamaModel);
    setResearchSafetyModeInput(settings.researchSafetyMode);
  }, [
    settings.aiProvider,
    settings.ollamaBaseUrl,
    settings.ollamaModel,
    settings.researchSafetyMode,
  ]);

  useEffect(() => {
    if (!activeAnalysis) {
      setAnalysisElapsedMs(0);
      return;
    }

    setAnalysisElapsedMs(Date.now() - activeAnalysis.startedAt);

    const intervalId = window.setInterval(() => {
      setAnalysisElapsedMs(Date.now() - activeAnalysis.startedAt);
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeAnalysis]);

  useEffect(() => {
    if (!studybud) {
      return;
    }

    return studybud.onResearchBrowserState((state) => {
      setResearchBrowserState(state);
    });
  }, [studybud]);

  useEffect(() => {
    setResearchBrowserUrlInput(researchBrowserState.url);
  }, [researchBrowserState.url]);

  useEffect(() => {
    window.localStorage.setItem(
      'studybud.chatPanelWidth',
      String(chatPanelWidth),
    );
  }, [chatPanelWidth]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (lastWorkspaceSubjectId) {
      window.localStorage.setItem(
        LAST_WORKSPACE_SUBJECT_STORAGE_KEY,
        lastWorkspaceSubjectId,
      );
      return;
    }

    window.localStorage.removeItem(LAST_WORKSPACE_SUBJECT_STORAGE_KEY);
  }, [lastWorkspaceSubjectId]);

  useEffect(() => {
    const activeWorkspaceSubjectId = workspace?.subject.id ?? null;

    if (activeWorkspaceSubjectId && activeWorkspaceSubjectId !== lastWorkspaceSubjectId) {
      setLastWorkspaceSubjectId(activeWorkspaceSubjectId);
    }
  }, [lastWorkspaceSubjectId, workspace?.subject.id]);

  useEffect(() => {
    if (
      lastWorkspaceSubjectId &&
      subjects.length > 0 &&
      !subjects.some((subject) => subject.id === lastWorkspaceSubjectId)
    ) {
      setLastWorkspaceSubjectId(null);
    }
  }, [lastWorkspaceSubjectId, subjects]);

  useEffect(() => {
    if (!studybud) {
      return;
    }

    const host = researchBrowserHostRef.current;
    const shouldShowBrowser =
      activeView === 'workspace' &&
      rightRailTab === 'research' &&
      researchBrowserState.visible &&
      Boolean(host);

    if (!shouldShowBrowser) {
      if (researchBrowserState.visible) {
        void studybud.hideResearchBrowser().catch(() => undefined);
      }
      return;
    }

    if (!host) {
      return;
    }

    const syncBounds = () => {
      const target = researchBrowserHostRef.current;
      if (!target) {
        return;
      }

      const rect = target.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) {
        return;
      }

      void studybud
        .setResearchBrowserBounds({
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
          visible: true,
        })
        .catch(() => undefined);
    };

    syncBounds();

    const resizeObserver = new ResizeObserver(() => {
      syncBounds();
    });
    resizeObserver.observe(host);

    const scrollContainer = researchPanelRef.current;

    window.addEventListener('resize', syncBounds);
    window.addEventListener('scroll', syncBounds, true);
    scrollContainer?.addEventListener('scroll', syncBounds, {
      passive: true,
    });

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', syncBounds);
      window.removeEventListener('scroll', syncBounds, true);
      scrollContainer?.removeEventListener('scroll', syncBounds);
    };
  }, [
    activeView,
    chatPanelWidth,
    researchBrowserState.visible,
    rightRailTab,
    studybud,
    workspace,
  ]);

  useEffect(() => {
    if (!isResizingChatPanel) {
      document.body.classList.remove('is-resizing-panels');
      return;
    }

    document.body.classList.add('is-resizing-panels');

    const handlePointerMove = (event: MouseEvent) => {
      const grid = workspaceGridRef.current;
      if (!grid) {
        return;
      }

      const bounds = grid.getBoundingClientRect();
      const computedWidth = bounds.right - event.clientX;
      const maxChatWidth = Math.min(
        CHAT_PANEL_MAX_WIDTH,
        Math.max(
          CHAT_PANEL_MIN_WIDTH,
          bounds.width -
            WORKSPACE_SIDEBAR_WIDTH -
            WORKSPACE_MAIN_MIN_WIDTH -
            WORKSPACE_RESIZER_WIDTH -
            WORKSPACE_GAP_TOTAL,
        ),
      );
      const nextWidth = Math.min(
        maxChatWidth,
        Math.max(CHAT_PANEL_MIN_WIDTH, computedWidth),
      );

      setChatPanelWidth(nextWidth);
    };

    const stopResizing = () => {
      setIsResizingChatPanel(false);
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', stopResizing);

    return () => {
      document.body.classList.remove('is-resizing-panels');
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizingChatPanel]);

  const reloadDashboardState = async () => {
    if (!studybud) {
      return;
    }

    await studybud.hideResearchBrowser().catch(() => undefined);

    const [nextInfo, nextSettings, nextSubjects] = await Promise.all([
      studybud.getAppInfo(),
      studybud.getSettings(),
      studybud.listSubjects(),
    ]);

    setAppInfo(nextInfo);
    setSettings(nextSettings);
    setSubjects(nextSubjects);
    setWorkspace(null);
    setSelectedDivisionId(null);
    setSelectedDocumentId(null);
    setSelectedCitationKey(null);
    setDocumentDetail(null);
    setDocumentBytes(null);
    setDocumentBytesCache({});
    setChatInput('');
    setChatError(null);
    setSelectionDraft(null);
    setSelectionUiMode('chip');
    setRightRailTab('chat');
    setResearchQueryInput('');
    setResearchVideoQueryInput('');
    setResearchError(null);
    setAnalysisError(null);
    setPracticeError(null);
    setResearchResult(null);
    setResearchBrowserState(initialResearchBrowserState);
    setResearchBrowserUrlInput('');
    setActiveView('library');
  };

  useEffect(() => {
    if (!studybud) {
      return;
    }

    let cancelled = false;

    const loadSelectedDocument = async () => {
      if (!selectedDocumentId) {
        setDocumentDetail(null);
        setDocumentBytes(null);
        return;
      }

      setBusy(true);
      setError(null);

      try {
        const nextDetail = await studybud.getDocumentDetail(selectedDocumentId);
        const nextBytes =
          nextDetail.importStatus === 'ready'
            ? documentBytesCache[selectedDocumentId] ??
              (await studybud.readDocumentData(selectedDocumentId))
            : null;

        if (cancelled) {
          return;
        }

        setDocumentDetail(nextDetail);
        setDocumentBytes(nextBytes);
        if (nextBytes && !documentBytesCache[selectedDocumentId]) {
          setDocumentBytesCache((previous) => ({
            ...previous,
            [selectedDocumentId]: nextBytes,
          }));
        }
        const pendingPageNumber = pendingPageSelectionRef.current;
        const nextPageNumber =
          pendingPageNumber &&
          nextDetail.pages.some((page) => page.pageNumber === pendingPageNumber)
            ? pendingPageNumber
            : nextDetail.pages[0]?.pageNumber ?? 1;
        setSelectedPageNumber(nextPageNumber);
        pendingPageSelectionRef.current = null;
      } catch (caughtError) {
        if (!cancelled) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : 'Could not load document.',
          );
          setDocumentDetail(null);
          setDocumentBytes(null);
        }
      } finally {
        if (!cancelled) {
          setBusy(false);
        }
      }
    };

    void loadSelectedDocument();

    return () => {
      cancelled = true;
    };
  }, [documentBytesCache, selectedDocumentId, studybud]);

  useEffect(() => {
    setIsPageTextExpanded(false);
  }, [selectedDocumentId]);

  useEffect(() => {
    setIsUnassignedPagesExpanded(false);
  }, [workspace?.subject.id, workspace?.analysis]);

  useEffect(() => {
    const divisions = workspace?.analysis?.divisions ?? [];

    if (divisions.length === 0) {
      setSelectedDivisionId(null);
      return;
    }

    setSelectedDivisionId((previous) => {
      if (previous && divisions.some((division) => division.id === previous)) {
        return previous;
      }

      return null;
    });
  }, [workspace?.analysis]);

  const pushNotification = (input: {
    title: string;
    message: string;
    variant: AppNotification['variant'];
    id?: string;
    actionLabel?: string;
    onAction?: (() => void) | null;
  }) => {
    const nextNotification: AppNotification = {
      id: input.id ?? createNotificationId(),
      title: input.title,
      message: input.message,
      variant: input.variant,
      createdAt: Date.now(),
      actionLabel: input.actionLabel,
      onAction: input.onAction ?? null,
    };

    setNotifications((previous) => {
      const filtered = input.id
        ? previous.filter((notification) => notification.id !== input.id)
        : previous;
      return [nextNotification, ...filtered];
    });
  };

  const dismissNotification = (id: string) => {
    setNotifications((previous) =>
      previous.filter((notification) => notification.id !== id),
    );
  };

  useEffect(() => {
    if (!error) {
      return;
    }

    const notification: AppNotification = {
      id: `app-error:${error}`,
      title: 'Action failed',
      message: error,
      variant: 'error',
      createdAt: Date.now(),
      onAction: null,
    };

    setNotifications((previous) => [
      notification,
      ...previous.filter((item) => item.id !== notification.id),
    ]);
  }, [error]);

  useEffect(() => {
    setChatInput('');
    setSelectionDraft(null);
    setSelectionQuestionInput('');
    setSelectionPopupPosition(null);
    setSelectionUiMode('chip');
  }, [selectedDivisionId]);

  useEffect(() => {
    const latestAssistantMessage = [...(workspace?.chatMessages ?? [])]
      .reverse()
      .find(
        (message) =>
          message.divisionId === selectedDivisionId && message.role === 'assistant',
      );

    if (!latestAssistantMessage) {
      return;
    }

    if (
      latestAssistantMessage.suggestedSearchQueries.length > 0 &&
      researchQueryInput.trim().length === 0
    ) {
      setResearchQueryInput(latestAssistantMessage.suggestedSearchQueries[0] ?? '');
    }

    if (
      latestAssistantMessage.suggestedVideoQueries.length > 0 &&
      researchVideoQueryInput.trim().length === 0
    ) {
      setResearchVideoQueryInput(latestAssistantMessage.suggestedVideoQueries[0] ?? '');
    }
  }, [
    researchQueryInput,
    researchVideoQueryInput,
    selectedDivisionId,
    workspace?.chatMessages,
  ]);

  useEffect(() => {
    if (!currentDivision) {
      setSelectedPracticeProblemTypeId('');
      return;
    }

    setSelectedPracticeProblemTypeId((previous) => {
      if (
        previous &&
        currentDivision.problemTypes.some((problemType) => problemType.id === previous)
      ) {
        return previous;
      }

      return currentDivision.problemTypes[0]?.id ?? '';
    });
  }, [currentDivision]);

  useEffect(() => {
    const selectedDivision =
      workspace?.analysis?.divisions.find(
        (division) => division.id === selectedDivisionId,
      ) ?? null;

    if (!selectedDivision) {
      setSelectedCitationKey(null);
      return;
    }

    if (selectedDivision.sourcePages.length === 0) {
      setSelectedCitationKey(null);
      return;
    }

    setSelectedCitationKey((previous) => {
      if (
        previous &&
        selectedDivision.sourcePages.some(
          (citation) => getCitationKey(citation) === previous,
        )
      ) {
        return previous;
      }

      return getCitationKey(selectedDivision.sourcePages[0]);
    });

    if (
      !selectedDocumentId ||
      !selectedDivision.sourcePages.some(
        (citation) => citation.documentId === selectedDocumentId,
      )
    ) {
      const firstCitation = selectedDivision.sourcePages[0];
      if (firstCitation) {
        pendingPageSelectionRef.current = firstCitation.pageNumber;
        setSelectedDocumentId(firstCitation.documentId);
        setSelectedPageNumber(firstCitation.pageNumber);
      }
    }
  }, [selectedDivisionId, workspace?.analysis]);

  useEffect(() => {
    if (!studybud || !workspace?.analysis || !selectedDivisionId) {
      return;
    }

    const selectedDivision = workspace.analysis.divisions.find(
      (division) => division.id === selectedDivisionId,
    );

    if (!selectedDivision) {
      return;
    }

    const readyDocumentIds = new Set(
      workspace.documents
        .filter((document) => document.importStatus === 'ready')
        .map((document) => document.id),
    );

    const missingDocumentIds = [
      ...new Set(selectedDivision.sourcePages.map((page) => page.documentId)),
    ].filter(
      (documentId) =>
        readyDocumentIds.has(documentId) &&
        typeof documentBytesCache[documentId] === 'undefined',
    );

    if (missingDocumentIds.length === 0) {
      return;
    }

    let cancelled = false;

    const loadCitationDocuments = async () => {
      const results = await Promise.allSettled(
        missingDocumentIds.map(async (documentId) => ({
          documentId,
          bytes: await studybud.readDocumentData(documentId),
        })),
      );

      if (cancelled) {
        return;
      }

      setDocumentBytesCache((previous) => {
        const next = { ...previous };
        let changed = false;

        for (const result of results) {
          if (result.status !== 'fulfilled') {
            continue;
          }

          next[result.value.documentId] = result.value.bytes;
          changed = true;
        }

        return changed ? next : previous;
      });
    };

    void loadCitationDocuments();

    return () => {
      cancelled = true;
    };
  }, [documentBytesCache, selectedDivisionId, studybud, workspace]);

  const refreshSubjectWorkspace = async (
    subjectId: string,
    preferredDocumentId?: string,
    options?: {
      view?: 'auto' | 'workspace' | 'units';
    },
  ) => {
    if (!studybud) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const nextWorkspace = await studybud.getSubjectWorkspace(subjectId);
      setWorkspace(nextWorkspace);
      setSubjects((previous) =>
        previous.map((subject) =>
          subject.id === nextWorkspace.subject.id ? nextWorkspace.subject : subject,
        ),
      );
      setLastWorkspaceSubjectId(nextWorkspace.subject.id);
      setSelectedCitationKey(null);
      setResearchError(null);

      const rememberedUnitId = lastUnitBySubject[nextWorkspace.subject.id] ?? null;
      const nextSelectedUnitId =
        rememberedUnitId &&
        nextWorkspace.analysis?.divisions.some((division) => division.id === rememberedUnitId)
          ? rememberedUnitId
          : null;
      const hasUnits = (nextWorkspace.analysis?.divisions.length ?? 0) > 0;

      setSelectedDivisionId(nextSelectedUnitId);
      setActiveView(
        options?.view === 'workspace'
          ? 'workspace'
          : options?.view === 'units'
            ? 'units'
            : nextSelectedUnitId
              ? 'workspace'
              : hasUnits
                ? 'units'
                : 'workspace',
      );

      const nextDocumentId =
        preferredDocumentId && nextWorkspace.documents.some((document) => document.id === preferredDocumentId)
          ? preferredDocumentId
          : getFirstReadyDocumentId(nextWorkspace);

      setSelectedDocumentId(nextDocumentId);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not open subject workspace.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleOpenWorkspace = async () => {
    const subjectId = workspace?.subject.id ?? lastWorkspaceSubjectId;

    if (!subjectId) {
      return;
    }

    if (workspace?.subject.id === subjectId) {
      setActiveView('workspace');
      return;
    }

    await refreshSubjectWorkspace(subjectId, undefined, { view: 'auto' });
  };

  const handleOpenUnitsPage = () => {
    if (!workspace) {
      return;
    }

    setUnitsSidebarTab('units');
    setActiveView('units');
  };

  const selectCitationSourcePage = (
    citation: CitationRef,
    options?: {
      scrollToViewer?: boolean;
    },
  ) => {
    pendingPageSelectionRef.current = citation.pageNumber;
    setSelectedCitationKey(getCitationKey(citation));
    setSelectedDocumentId(citation.documentId);
    setSelectedPageNumber(citation.pageNumber);

    if (options?.scrollToViewer ?? true) {
      requestAnimationFrame(() => {
        const viewerSection = pdfViewerSectionRef.current;
        if (!viewerSection) {
          return;
        }

        viewerSection.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      });
    }
  };

  const openCitationSourcePage = (citation: CitationRef) => {
    selectCitationSourcePage(citation, {
      scrollToViewer: true,
    });
  };

  const captureSelectionDraft = (input: {
    kind: SelectionContext['kind'];
    selectedText: string;
    surroundingText: string;
    divisionId?: string;
    sourcePageIds?: string[];
    pageId?: string | null;
    documentId?: string | null;
    documentName?: string | null;
    documentKind?: DocumentKind | null;
    pageNumber?: number | null;
  }) => {
    if (!workspace || !currentDivision) {
      return;
    }

    const selection = window.getSelection();
    const selectedText = input.selectedText.trim();
    if (!selectedText || !selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const popupWidth = 360;
    const viewportPadding = 16;
    const nextX = Math.min(
      Math.max(viewportPadding, rect.left + rect.width / 2 - popupWidth / 2),
      window.innerWidth - popupWidth - viewportPadding,
    );
    const preferredAboveY = rect.top + window.scrollY - 188;
    const fallbackBelowY = rect.bottom + window.scrollY + 12;
    const nextY =
      preferredAboveY > viewportPadding ? preferredAboveY : fallbackBelowY;

    setSelectionDraft({
      kind: input.kind,
      subjectId: workspace.subject.id,
      divisionId: input.divisionId ?? currentDivision.id,
      selectedText,
      surroundingText: input.surroundingText.trim(),
      sourcePageIds:
        input.sourcePageIds ?? currentDivision.sourcePages.map((page) => page.pageId),
      pageId: input.pageId ?? null,
      documentId: input.documentId ?? null,
      documentName: input.documentName ?? null,
      documentKind: input.documentKind ?? null,
      pageNumber: input.pageNumber ?? null,
    });
    setSelectionQuestionInput('');
    setSelectionPopupPosition({
      x: nextX,
      y: nextY,
    });
    setSelectionUiMode('chip');
  };

  const handleSummarySelection = () => {
    if (!currentDivision) {
      return;
    }

    const selectedText = window.getSelection()?.toString() ?? '';
    captureSelectionDraft({
      kind: 'division-summary',
      selectedText,
      surroundingText: currentDivision.summary,
    });
  };

  const handleDivisionListSelection = (division: SubjectAnalysisDivision) => {
    const selectedText = window.getSelection()?.toString() ?? '';
    captureSelectionDraft({
      kind: 'division-summary',
      selectedText,
      surroundingText: [
        division.title,
        division.summary,
        division.keyConcepts.join(', '),
      ]
        .filter(Boolean)
        .join(' '),
      divisionId: division.id,
      sourcePageIds: division.sourcePages.map((page) => page.pageId),
    });
  };

  const handleKeyConceptSelection = (concept: string) => {
    if (!currentDivision) {
      return;
    }

    const selectedText = window.getSelection()?.toString() ?? '';
    captureSelectionDraft({
      kind: 'division-summary',
      selectedText,
      surroundingText: [
        currentDivision.title,
        currentDivision.summary,
        currentDivision.keyConcepts.join(', '),
        concept,
      ]
        .filter(Boolean)
        .join(' '),
    });
  };

  const handleProblemTypeSelection = (problemType: {
    title: string;
    description: string;
  }) => {
    if (!currentDivision) {
      return;
    }

    const selectedText = window.getSelection()?.toString() ?? '';
    captureSelectionDraft({
      kind: 'division-summary',
      selectedText,
      surroundingText: [
        currentDivision.title,
        problemType.title,
        problemType.description,
      ]
        .filter(Boolean)
        .join(' '),
    });
  };

  const buildPracticeSelectionContext = (
    kind: SelectionContext['kind'],
    practiceSet: PracticeSet,
    question: PracticeQuestion,
    selectedText: string,
  ) => {
    if (!currentDivision) {
      return;
    }

    const surroundingText =
      kind === 'practice-answer'
        ? [
            currentDivision.title,
            practiceSet.problemTypeTitle,
            practiceSet.difficulty,
            question.prompt,
            question.answer,
          ]
            .filter(Boolean)
            .join(' ')
        : [
            currentDivision.title,
            practiceSet.problemTypeTitle,
            practiceSet.difficulty,
            question.prompt,
          ]
            .filter(Boolean)
            .join(' ');

    captureSelectionDraft({
      kind,
      selectedText,
      surroundingText,
      sourcePageIds:
        practiceSet.sourcePages.length > 0
          ? practiceSet.sourcePages.map((page) => page.pageId)
          : currentDivision.sourcePages.map((page) => page.pageId),
    });
  };

  const handlePracticeQuestionSelection = (
    practiceSet: PracticeSet,
    question: PracticeQuestion,
  ) => {
    buildPracticeSelectionContext(
      'practice-question',
      practiceSet,
      question,
      window.getSelection()?.toString() ?? '',
    );
  };

  const handlePracticeAnswerSelection = (
    practiceSet: PracticeSet,
    question: PracticeQuestion,
  ) => {
    buildPracticeSelectionContext(
      'practice-answer',
      practiceSet,
      question,
      window.getSelection()?.toString() ?? '',
    );
  };

  const handleChatMessageSelection = (message: {
    role: 'user' | 'assistant';
    content: string;
    citations: CitationRef[];
    selectionContext: SelectionContext | null;
  }) => {
    if (!workspace || !currentDivision) {
      return;
    }

    const selectedText = window.getSelection()?.toString() ?? '';
    const sourcePageIds =
      message.citations.length > 0
        ? message.citations.map((citation) => citation.pageId)
        : message.selectionContext?.sourcePageIds?.length
          ? message.selectionContext.sourcePageIds
          : currentDivision.sourcePages.map((page) => page.pageId);

    captureSelectionDraft({
      kind: message.role === 'assistant' ? 'chat-answer' : 'chat-question',
      selectedText,
      surroundingText: message.content,
      sourcePageIds,
      pageId: message.selectionContext?.pageId ?? null,
      documentId: message.selectionContext?.documentId ?? null,
      documentName: message.selectionContext?.documentName ?? null,
      documentKind: message.selectionContext?.documentKind ?? null,
      pageNumber: message.selectionContext?.pageNumber ?? null,
    });
  };

  const handleCitationEvidenceSelection = (citation: CitationRef) => {
    const selectedText = window.getSelection()?.toString() ?? '';
    captureSelectionDraft({
      kind: 'division-summary',
      selectedText,
      surroundingText: citation.excerptText,
      pageId: citation.pageId,
      documentId: citation.documentId,
      documentName: citation.documentName,
      documentKind: citation.documentKind,
      pageNumber: citation.pageNumber,
    });
  };

  const handleUnassignedPageSelection = (page: {
    id: string;
    reason: string | null;
    pageId: string;
    documentId: string;
    documentName: string;
    documentKind: DocumentKind;
    pageNumber: number;
  }) => {
    const selectedText = window.getSelection()?.toString() ?? '';
    captureSelectionDraft({
      kind: 'division-summary',
      selectedText,
      surroundingText: `${page.documentName} page ${page.pageNumber} ${page.reason ?? ''}`,
      pageId: page.pageId,
      documentId: page.documentId,
      documentName: page.documentName,
      documentKind: page.documentKind,
      pageNumber: page.pageNumber,
    });
  };

  const handlePageTextSelection = (page: NonNullable<SourceDocumentDetail['pages'][number]>) => {
    if (!documentDetail) {
      return;
    }

    const selectedText = window.getSelection()?.toString() ?? '';
    captureSelectionDraft({
      kind: 'page-text',
      selectedText,
      surroundingText: page.textContent,
      pageId: page.id,
      documentId: documentDetail.id,
      documentName: documentDetail.originalFileName,
      documentKind: documentDetail.kind,
      pageNumber: page.pageNumber,
    });
  };

  const handleSelectDivision = (division: SubjectAnalysisDivision) => {
    if (hasMeaningfulSelection()) {
      return;
    }

    setSelectedDivisionId(division.id);
    setLastUnitBySubject((previous) => {
      if (workspace?.subject.id && previous[workspace.subject.id] === division.id) {
        return previous;
      }

      return workspace?.subject.id
        ? {
            ...previous,
            [workspace.subject.id]: division.id,
          }
        : previous;
    });
    setActiveView('workspace');

    if (division.sourcePages.length > 0) {
      selectCitationSourcePage(division.sourcePages[0], {
        scrollToViewer: false,
      });
    }
  };

  const handleCreateSubject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!studybud) {
      return;
    }

    const trimmed = subjectName.trim();

    if (!trimmed) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const created = await studybud.createSubject({ name: trimmed });
      setSubjects((previous) => [created, ...previous]);
      setSubjectName('');
      await refreshSubjectWorkspace(created.id);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not create subject.',
      );
      setBusy(false);
    }
  };

  const handleDeleteSubject = async (subject: SubjectSummary) => {
    if (!studybud) {
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you would like to delete subject "${subject.name}"`,
    );

    if (!confirmed) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await studybud.deleteSubject(subject.id);

      setSubjects((previous) =>
        previous.filter((item) => item.id !== subject.id),
      );

      if (lastWorkspaceSubjectId === subject.id) {
        setLastWorkspaceSubjectId(null);
      }

      setLastUnitBySubject((previous) => {
        if (!(subject.id in previous)) {
          return previous;
        }

        const next = { ...previous };
        delete next[subject.id];
        return next;
      });

      if (workspace?.subject.id === subject.id) {
        setWorkspace(null);
        setSelectedDivisionId(null);
        setSelectedDocumentId(null);
        setSelectedCitationKey(null);
        setDocumentDetail(null);
        setDocumentBytes(null);
        setDocumentBytesCache({});
        setActiveView('library');
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not delete subject.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSaveAiSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!studybud) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const nextSettings = await studybud.saveSettings({
        aiProvider: aiProviderInput,
        ...(apiKeyInput.trim().length > 0 ? { openAiApiKey: apiKeyInput } : {}),
        ollamaBaseUrl: ollamaBaseUrlInput,
        ollamaModel: ollamaModelInput,
      });
      setSettings(nextSettings);
      setApiKeyInput('');
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not save settings.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleClearApiKey = async () => {
    if (!studybud) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const nextSettings = await studybud.saveSettings({
        openAiApiKey: '',
      });
      setSettings(nextSettings);
      setApiKeyInput('');
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not clear API key.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSaveResearchSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!studybud) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const nextSettings = await studybud.saveSettings({
        ...(braveSearchApiKeyInput.trim().length > 0
          ? { braveSearchApiKey: braveSearchApiKeyInput }
          : {}),
        ...(youTubeApiKeyInput.trim().length > 0
          ? { youTubeApiKey: youTubeApiKeyInput }
          : {}),
        researchSafetyMode: researchSafetyModeInput,
      });
      setSettings(nextSettings);
      setBraveSearchApiKeyInput('');
      setYouTubeApiKeyInput('');
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not save research settings.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleClearResearchKeys = async () => {
    if (!studybud) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const nextSettings = await studybud.saveSettings({
        braveSearchApiKey: '',
        youTubeApiKey: '',
      });
      setSettings(nextSettings);
      setBraveSearchApiKeyInput('');
      setYouTubeApiKeyInput('');
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not clear research API keys.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleChooseDataPath = async () => {
    if (!studybud) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const nextSettings = await studybud.chooseDataPath();
      if (!nextSettings) {
        return;
      }

      setSettings(nextSettings);
      await reloadDashboardState();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not change the data directory.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleResetDataPath = async () => {
    if (!studybud) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const nextSettings = await studybud.resetDataPath();
      setSettings(nextSettings);
      await reloadDashboardState();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not reset the data directory.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleImportDocuments = async (kind: DocumentKind) => {
    if (!workspace || !studybud) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const result = await studybud.importDocuments({
        subjectId: workspace.subject.id,
        kind,
      });

      if (result.canceled) {
        return;
      }

      const preferredDocument = result.importedDocuments.find(
        (document) => document.importStatus === 'ready',
      );

      await refreshSubjectWorkspace(workspace.subject.id, preferredDocument?.id);

      if (result.job) {
        const importedCount = result.importedDocuments.filter(
          (document) => document.importStatus === 'ready',
        ).length;
        const hasFailures = result.failures.length > 0;
        pushNotification({
          id: `import-job:${result.job.id}`,
          title: hasFailures ? 'Import completed with issues' : 'Import complete',
          message:
            result.job.message ||
            (hasFailures
              ? `${result.failures.length} document${result.failures.length === 1 ? '' : 's'} failed to import.`
              : `${importedCount} document${importedCount === 1 ? '' : 's'} imported successfully.`),
          variant: hasFailures ? 'warning' : 'success',
        });
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not import PDFs.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleAnalyzeSubject = async () => {
    if (!studybud || !workspace) {
      return;
    }

    if (!analysisReady) {
      setAnalysisError(aiActionBlockedReason);
      setError(aiActionBlockedReason);
      return;
    }

    const provider =
      settings.aiProvider === 'ollama'
        ? `Ollama (${settings.ollamaBaseUrl})`
        : 'OpenAI';
    const model =
      settings.aiProvider === 'ollama'
        ? settings.ollamaModel
        : 'gpt-5.4-mini';

    setBusy(true);
    setError(null);
    setAnalysisError(null);
    setActiveAnalysis({
      provider,
      model,
      startedAt: Date.now(),
    });

    try {
      const result: AnalyzeSubjectResult = await studybud.analyzeSubject({
        subjectId: workspace.subject.id,
      });

      setWorkspace((previous) =>
        previous
          ? {
              ...previous,
              analysis: result.analysis,
              analysisJobs: [result.job, ...previous.analysisJobs.filter((job) => job.id !== result.job.id)],
            }
          : previous,
      );

      await refreshSubjectWorkspace(workspace.subject.id, selectedDocumentId ?? undefined);
      pushNotification({
        id: `analysis-job:${result.job.id}`,
        title: 'Analysis successful',
        message: result.job.message,
        variant: 'success',
      });
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not analyze subject materials.';
      setAnalysisError(message);
      setError(message);
    } finally {
      setActiveAnalysis(null);
      setBusy(false);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!studybud || !workspace) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await studybud.deleteDocument(documentId);

      if (selectedDocumentId === documentId) {
        setSelectedDocumentId(null);
        setDocumentDetail(null);
        setDocumentBytes(null);
        setSelectedCitationKey(null);
      }

      setDocumentBytesCache((previous) => {
        if (!(documentId in previous)) {
          return previous;
        }

        const next = { ...previous };
        delete next[documentId];
        return next;
      });

      await refreshSubjectWorkspace(workspace.subject.id);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not delete document.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleGeneratePractice = async (
    requestOverride?: PracticeRetryRequest,
  ) => {
    if (
      !studybud ||
      !workspace ||
      !currentDivision ||
      !(requestOverride?.problemTypeId ?? selectedPracticeProblemTypeId) ||
      (requestOverride?.count ?? practiceCount) < 1
    ) {
      return;
    }

    if (!analysisReady) {
      setPracticeError(aiActionBlockedReason);
      setError(aiActionBlockedReason);
      return;
    }

    const nextProblemTypeId =
      requestOverride?.problemTypeId ?? selectedPracticeProblemTypeId;
    const nextDifficulty = requestOverride?.difficulty ?? practiceDifficulty;
    const nextCount = requestOverride?.count ?? practiceCount;

    setPracticeBusy(true);
    setError(null);
    setPracticeError(null);
    setLastPracticeRequest({
      problemTypeId: nextProblemTypeId,
      difficulty: nextDifficulty,
      count: nextCount,
    });

    try {
      const result: GeneratePracticeResult = await studybud.generatePractice({
        subjectId: workspace.subject.id,
        divisionId: currentDivision.id,
        problemTypeId: nextProblemTypeId,
        difficulty: nextDifficulty,
        count: nextCount,
      });

      setWorkspace((previous) =>
        previous
          ? {
              ...previous,
              practiceSets: [result.practiceSet, ...previous.practiceSets],
            }
          : previous,
      );
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not generate a practice set.';
      setPracticeError(message);
      setError(message);
    } finally {
      setPracticeBusy(false);
    }
  };

  const handleTogglePracticeAnswer = async (questionId: string) => {
    if (!studybud) {
      return;
    }

    setPracticeBusy(true);
    setError(null);

    try {
      const result = await studybud.revealPracticeAnswer({ questionId });

      setWorkspace((previous) => {
        if (!previous) {
          return previous;
        }

        return {
          ...previous,
          practiceSets: previous.practiceSets.map((practiceSet) => {
            if (practiceSet.id !== result.practiceSetId) {
              return practiceSet;
            }

            return {
              ...practiceSet,
              questions: practiceSet.questions.map((question) =>
                question.id === result.question.id ? result.question : question,
              ),
              updatedAt: result.question.updatedAt,
            };
          }),
        };
      });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not update the answer key visibility.',
      );
    } finally {
      setPracticeBusy(false);
    }
  };

  const handleDeletePracticeSet = async (practiceSet: PracticeSet) => {
    if (!studybud) {
      return;
    }

    const confirmed = window.confirm(
      `Delete the practice set "${practiceSet.problemTypeTitle}" (${practiceSet.difficulty})?`,
    );

    if (!confirmed) {
      return;
    }

    setPracticeBusy(true);
    setError(null);

    try {
      await studybud.deletePracticeSet({
        practiceSetId: practiceSet.id,
      });

      setWorkspace((previous) =>
        previous
          ? {
              ...previous,
              practiceSets: previous.practiceSets.filter(
                (item) => item.id !== practiceSet.id,
              ),
            }
          : previous,
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not delete the practice set.',
      );
    } finally {
      setPracticeBusy(false);
    }
  };

  const handleRegeneratePracticeSet = async (practiceSet: PracticeSet) => {
    if (!studybud || !workspace) {
      return;
    }

    setPracticeBusy(true);
    setError(null);

    try {
      const result: GeneratePracticeResult = await studybud.generatePractice({
        subjectId: workspace.subject.id,
        divisionId: practiceSet.divisionId,
        problemTypeId: practiceSet.problemTypeId,
        difficulty: practiceSet.difficulty,
        count: practiceSet.questionCount,
      });

      setWorkspace((previous) =>
        previous
          ? {
              ...previous,
              practiceSets: [result.practiceSet, ...previous.practiceSets],
            }
          : previous,
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not regenerate the practice set.',
      );
    } finally {
      setPracticeBusy(false);
    }
  };

  const handleGenerateFlashcards = async (input: {
    title: string;
    divisionIds: string[];
    count: number;
  }) => {
    if (!studybud || !workspace) {
      return;
    }

    if (!analysisReady) {
      setFlashcardsError(aiActionBlockedReason);
      setError(aiActionBlockedReason);
      return;
    }

    setFlashcardsBusy(true);
    setFlashcardsError(null);
    setError(null);

    try {
      const result: GenerateFlashcardsResult = await studybud.generateFlashcards({
        subjectId: workspace.subject.id,
        divisionIds: input.divisionIds,
        count: input.count,
        title: input.title.trim() || undefined,
      });

      setWorkspace((previous) =>
        previous
          ? {
              ...previous,
              flashcardDecks: [result.flashcardDeck, ...previous.flashcardDecks],
            }
          : previous,
      );
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not generate the flashcard deck.';
      setFlashcardsError(message);
      setError(message);
      throw caughtError instanceof Error ? caughtError : new Error(message);
    } finally {
      setFlashcardsBusy(false);
    }
  };

  const handleCreateManualFlashcardDeck = async (input: {
    title: string;
    divisionIds: string[];
    cards: Array<{
      front: string;
      back: string;
    }>;
  }) => {
    if (!studybud || !workspace) {
      return;
    }

    setFlashcardsBusy(true);
    setFlashcardsError(null);
    setError(null);

    try {
      const result = await studybud.createFlashcardDeck({
        subjectId: workspace.subject.id,
        title: input.title,
        divisionIds: input.divisionIds,
        cards: input.cards,
      });

      setWorkspace((previous) =>
        previous
          ? {
              ...previous,
              flashcardDecks: [result.flashcardDeck, ...previous.flashcardDecks],
            }
          : previous,
      );
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not create the flashcard deck.';
      setFlashcardsError(message);
      setError(message);
      throw caughtError instanceof Error ? caughtError : new Error(message);
    } finally {
      setFlashcardsBusy(false);
    }
  };

  const handleDeleteFlashcardDeck = async (deck: FlashcardDeck) => {
    if (!studybud) {
      return;
    }

    const confirmed = window.confirm(`Delete the flashcard deck "${deck.title}"?`);

    if (!confirmed) {
      return;
    }

    setFlashcardsBusy(true);
    setFlashcardsError(null);
    setError(null);

    try {
      await studybud.deleteFlashcardDeck({
        flashcardDeckId: deck.id,
      });

      setWorkspace((previous) =>
        previous
          ? {
              ...previous,
              flashcardDecks: previous.flashcardDecks.filter(
                (item) => item.id !== deck.id,
              ),
            }
          : previous,
      );
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not delete the flashcard deck.';
      setFlashcardsError(message);
      setError(message);
    } finally {
      setFlashcardsBusy(false);
    }
  };

  const submitChatPrompt = async (
    prompt: string,
    selectionContext: SelectionContext | null,
    options?: {
      clearInput?: boolean;
      closeSelection?: boolean;
    },
  ) => {
    if (!studybud || !workspace || !currentDivision) {
      return;
    }

    if (!analysisReady) {
      setChatError(aiActionBlockedReason);
      setError(aiActionBlockedReason);
      return;
    }

    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      return;
    }

    setChatBusy(true);
    setPendingChatPrompt(trimmedPrompt);
    setError(null);
    setChatError(null);
    setLastChatRequest({
      prompt: trimmedPrompt,
      selectionContext,
    });

    try {
      const result: ChatAskResult = await studybud.askChat({
        subjectId: workspace.subject.id,
        divisionId: currentDivision.id,
        prompt: trimmedPrompt,
        selectionContext,
      });

      setWorkspace((previous) =>
        previous
          ? {
              ...previous,
              chatMessages: [
                ...previous.chatMessages,
                result.userMessage,
                result.assistantMessage,
              ],
            }
          : previous,
      );
      if (options?.clearInput) {
        setChatInput('');
      }
      if (options?.closeSelection) {
        closeSelectionPopup();
      }
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not send the unit chat request.';
      setChatError(message);
      setError(message);
    } finally {
      setPendingChatPrompt(null);
      setChatBusy(false);
    }
  };

  const handleAskChat = async () => {
    await submitChatPrompt(chatInput, null, {
      clearInput: true,
    });
  };

  const handleExplainPracticeQuestion = async (
    practiceSet: PracticeSet,
    question: PracticeQuestion,
  ) => {
    if (!workspace || !currentDivision) {
      return;
    }

    await submitChatPrompt(
      'Explain how to approach this practice question and which unit concepts it is testing.',
      {
        kind: 'practice-question',
        subjectId: workspace.subject.id,
        divisionId: currentDivision.id,
        selectedText: question.prompt,
        surroundingText: [
          currentDivision.title,
          practiceSet.problemTypeTitle,
          practiceSet.difficulty,
          question.prompt,
        ]
          .filter(Boolean)
          .join(' '),
        sourcePageIds:
          practiceSet.sourcePages.length > 0
            ? practiceSet.sourcePages.map((page) => page.pageId)
            : currentDivision.sourcePages.map((page) => page.pageId),
      },
    );
  };

  const handleExplainPracticeAnswer = async (
    practiceSet: PracticeSet,
    question: PracticeQuestion,
  ) => {
    if (!workspace || !currentDivision) {
      return;
    }

    await submitChatPrompt(
      'Explain why this answer is correct and walk through the reasoning step by step.',
      {
        kind: 'practice-answer',
        subjectId: workspace.subject.id,
        divisionId: currentDivision.id,
        selectedText: question.answer,
        surroundingText: [
          currentDivision.title,
          practiceSet.problemTypeTitle,
          practiceSet.difficulty,
          question.prompt,
          question.answer,
        ]
          .filter(Boolean)
          .join(' '),
        sourcePageIds:
          practiceSet.sourcePages.length > 0
            ? practiceSet.sourcePages.map((page) => page.pageId)
            : currentDivision.sourcePages.map((page) => page.pageId),
      },
    );
  };

  const handleSearchResearch = async (
    queryOverride?: string,
    videoQueryOverride?: string,
  ) => {
    if (!studybud) {
      return;
    }

    const nextQuery = (queryOverride ?? researchQueryInput).trim();
    const nextVideoQuery = (videoQueryOverride ?? researchVideoQueryInput).trim();

    if (!nextQuery) {
      return;
    }

    setResearchBusy(true);
    setResearchError(null);
    setRightRailTab('research');
    setLastResearchRequest({
      query: nextQuery,
      videoQuery: nextVideoQuery,
    });

    try {
      const result = await studybud.searchResearch({
        query: nextQuery,
        videoQuery: nextVideoQuery.length > 0 ? nextVideoQuery : null,
      });

      setResearchResult(result);
      setResearchQueryInput(result.query);
      setResearchVideoQueryInput(result.videoQuery);
    } catch (caughtError) {
      setResearchError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not run the research search.',
      );
    } finally {
      setResearchBusy(false);
    }
  };

  const handleOpenResearchWebResult = async (url: string) => {
    if (!studybud) {
      return;
    }

    setResearchError(null);
    setRightRailTab('research');

    const scrollResearchViewerIntoView = () => {
      const panel = researchPanelRef.current;
      const host = researchBrowserHostRef.current;

      if (!panel || !host) {
        return;
      }

      const nextTop = Math.max(
        0,
        host.offsetTop - panel.offsetTop - 12,
      );

      panel.scrollTo({
        top: nextTop,
        behavior: 'smooth',
      });
    };

    scrollResearchViewerIntoView();

    try {
      await studybud.navigateResearchBrowser({ url });
      requestAnimationFrame(() => {
        scrollResearchViewerIntoView();
      });
    } catch (caughtError) {
      setResearchError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not open the research browser.',
      );
    }
  };

  const handleNavigateResearchBrowser = async () => {
    await handleOpenResearchWebResult(researchBrowserUrlInput);
  };

  const handleHideResearchBrowser = async () => {
    if (!studybud) {
      return;
    }

    try {
      await studybud.hideResearchBrowser();
    } catch (caughtError) {
      setResearchError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not hide the research browser.',
      );
    }
  };

  const handleResearchBrowserBack = async () => {
    if (!studybud) {
      return;
    }

    try {
      await studybud.goBackResearchBrowser();
    } catch (caughtError) {
      setResearchError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not navigate back in the research browser.',
      );
    }
  };

  const handleResearchBrowserForward = async () => {
    if (!studybud) {
      return;
    }

    try {
      await studybud.goForwardResearchBrowser();
    } catch (caughtError) {
      setResearchError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not navigate forward in the research browser.',
      );
    }
  };

  const handleResearchBrowserReload = async () => {
    if (!studybud) {
      return;
    }

    try {
      await studybud.reloadResearchBrowser();
    } catch (caughtError) {
      setResearchError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not reload the research browser.',
      );
    }
  };

  const handleOpenResearchVideoResult = async (url: string) => {
    if (!studybud) {
      return;
    }

    try {
      await studybud.openExternalResearchLink({ url });
    } catch (caughtError) {
      setResearchError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not open the video in your default browser.',
      );
    }
  };

  const handleRetryChat = async () => {
    if (!lastChatRequest) {
      return;
    }

    await submitChatPrompt(
      lastChatRequest.prompt,
      lastChatRequest.selectionContext,
    );
  };

  const handleRetryPractice = async () => {
    if (!lastPracticeRequest) {
      return;
    }

    setSelectedPracticeProblemTypeId(lastPracticeRequest.problemTypeId);
    setPracticeDifficulty(lastPracticeRequest.difficulty);
    setPracticeCount(lastPracticeRequest.count);
    await handleGeneratePractice(lastPracticeRequest);
  };

  const handleRetryResearch = async () => {
    if (!lastResearchRequest) {
      return;
    }

    await handleSearchResearch(
      lastResearchRequest.query,
      lastResearchRequest.videoQuery,
    );
  };

  const handleOpenResearchWebResultExternally = async (url: string) => {
    if (!studybud) {
      return;
    }

    try {
      await studybud.openExternalResearchLink({ url });
    } catch (caughtError) {
      setResearchError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not open this source in your default browser.',
      );
    }
  };

  const handleOpenCurrentResearchBrowserExternally = async () => {
    const url =
      researchBrowserState.sourceUrl.trim() || researchBrowserUrlInput.trim();

    if (!url) {
      return;
    }

    await handleOpenResearchWebResultExternally(url);
  };

  const closeSelectionPopup = () => {
    setSelectionDraft(null);
    setSelectionQuestionInput('');
    setSelectionPopupPosition(null);
    setSelectionUiMode('chip');
    window.getSelection()?.removeAllRanges();
  };

  const handleAskSelectionQuestion = async () => {
    if (!selectionDraft) {
      return;
    }

    if (!analysisReady) {
      setChatError(aiActionBlockedReason);
      setError(aiActionBlockedReason);
      return;
    }

    const prompt = selectionQuestionInput.trim();
    if (!prompt) {
      return;
    }

    await submitChatPrompt(prompt, selectionDraft, {
      closeSelection: true,
    });
  };

  const settingsBadge = !settings.encryptionAvailable
    ? settings.aiProvider === 'openai'
      ? settings.openAiApiKeyConfigured
        ? 'Session key active'
        : 'Session-only key mode'
      : 'Ollama local provider'
    : settings.aiProvider === 'openai'
      ? settings.openAiApiKeyConfigured
        ? 'API key configured'
        : 'API key missing'
      : 'Ollama local provider';

  const analysisReady =
    settings.aiProvider === 'ollama'
      ? settings.ollamaModel.trim().length > 0
      : settings.openAiApiKeyConfigured;
  const aiActionBlockedReason =
    settings.aiProvider === 'ollama'
      ? 'Configure an Ollama model in Settings before running analysis, chat, or practice generation.'
      : 'Add your OpenAI API key in Settings before running analysis, chat, or practice generation.';
  const unitSelectionBlockedReason = !analysisReady
    ? aiActionBlockedReason
    : !currentDivision
      ? 'Open a unit from the Units page before asking questions about selected text.'
      : null;
  const aiDiagnosticsStatus =
    settings.aiProvider === 'ollama'
      ? `${settings.ollamaModel.trim() || 'No model set'} @ ${
          settings.ollamaBaseUrl.trim() || 'no base URL'
        }`
      : settings.openAiApiKeyConfigured
        ? 'OpenAI key configured'
        : 'OpenAI key missing';
  const researchDiagnosticsStatus =
    settings.braveSearchApiKeyConfigured || settings.youTubeApiKeyConfigured
      ? [
          settings.braveSearchApiKeyConfigured ? 'Brave API' : null,
          settings.youTubeApiKeyConfigured ? 'YouTube API' : null,
        ]
          .filter(Boolean)
          .join(' + ')
      : 'Fallback scraping mode';
  const ocrDiagnosticsStatus = appInfo
    ? appInfo.ocrRuntimeAvailable
      ? `${appInfo.ocrEngine ?? 'OCR runtime ready'} (${appInfo.ocrRuntimeMode})`
      : appInfo.ocrRuntimeMessage ?? 'OCR runtime unavailable'
    : 'Loading...';
  const contextualNotifications: AppNotification[] = [];

  if (workspace) {
    const extractionLimitedDocuments = workspace.documents.filter(
      (document) =>
        document.importStatus === 'ready' && document.extractionState !== 'normal',
    );

    if (extractionLimitedDocuments.length > 0) {
      const extractionNotificationCreatedAt = extractionLimitedDocuments.reduce(
        (latest, document) =>
          Math.max(latest, new Date(document.updatedAt).getTime()),
        0,
      );
      contextualNotifications.push({
        id: `workspace-extraction-limited:${workspace.subject.id}:${extractionLimitedDocuments
          .map((document) => `${document.id}:${document.extractionState}`)
          .join('|')}`,
        title: 'Documents imported with limited text',
        message:
          extractionLimitedDocuments.length === 1
            ? `${extractionLimitedDocuments[0]?.originalFileName} imported with ${extractionLimitedDocuments[0]?.extractionState === 'image-only' ? 'no extracted text' : 'limited extracted text'}. StudyBud will keep the file, but AI features may be incomplete for that document.`
            : `${extractionLimitedDocuments.length} imported documents have limited or missing extracted text. These are often scanned or image-only PDFs, so AI features may be incomplete for those files.`,
        variant: 'warning',
        createdAt: extractionNotificationCreatedAt || Date.now(),
        onAction: null,
      });
    }

    if (workspace.analysis?.unassignedPages.length) {
      const latestAnalysisTimestamp =
        workspace.analysisJobs[0]?.updatedAt ?? workspace.analysisJobs[0]?.createdAt ?? null;
      contextualNotifications.push({
        id: `workspace-unassigned-pages:${workspace.subject.id}:${workspace.analysis.unassignedPages.length}`,
        title: 'Analysis left pages unassigned',
        message: `The latest analysis left ${workspace.analysis.unassignedPages.length} page${workspace.analysis.unassignedPages.length === 1 ? '' : 's'} unassigned, so some unit coverage may still be incomplete.`,
        variant: 'warning',
        createdAt: latestAnalysisTimestamp ? new Date(latestAnalysisTimestamp).getTime() : Date.now(),
        onAction: null,
      });
    }
  }

  const renderLibrary = () => {
    return (
      <section className="panel">
        <header className="panel-header">
          <h2>Subject Library</h2>
          <p>
            Build your first class workspace, then import lecture and homework
            PDFs into the subject viewer.
          </p>
        </header>

        <form className="form-row" onSubmit={handleCreateSubject}>
          <input
            type="text"
            placeholder="Example: MATH 251 - Linear Algebra"
            value={subjectName}
            onChange={(event) => setSubjectName(event.target.value)}
            maxLength={120}
            disabled={busy}
          />
          <button type="submit" disabled={busy || !subjectName.trim()}>
            Create Subject
          </button>
        </form>

        <div className="subjects-list">
          {subjects.length === 0 ? (
            <div className="empty-state">
              No subjects yet. Create one to start importing lecture and
              homework PDFs. If you plan to analyze right away, confirm your AI
              provider settings first.
            </div>
          ) : (
            subjects.map((subject) => (
              <article
                key={subject.id}
                className="subject-card-shell"
              >
                <button
                  type="button"
                  className="subject-card subject-open-button"
                  onClick={() => {
                    void refreshSubjectWorkspace(subject.id);
                  }}
                >
                  <div>
                    <h3>{subject.name}</h3>
                    <p>Created {formatDate(subject.createdAt)}</p>
                  </div>
                  <span className="subject-meta">
                    Updated {formatDate(subject.updatedAt)}
                  </span>
                </button>
                <button
                  type="button"
                  className="subject-delete-button"
                  disabled={busy}
                  onClick={() => void handleDeleteSubject(subject)}
                >
                  Delete Subject
                </button>
              </article>
            ))
          )}
        </div>
      </section>
    );
  };

  const renderSettings = () => {
    return (
      <section className="panel">
        <header className="panel-header">
          <h2>Settings</h2>
          <p>
            Configure how StudyBud stores class data and how it connects to AI services.
          </p>
        </header>

        {!isOnline ? (
          <DismissibleBanner dismissKey="settings-offline">
            This device currently appears offline. Cloud AI and web research providers
            will stay unavailable until connectivity returns.
          </DismissibleBanner>
        ) : null}

        <section className="settings-card">
          <header className="settings-card-header">
            <h3>AI Settings</h3>
            <p>
              Choose whether analysis runs through OpenAI or your local Ollama server.
              Ollama defaults to `localhost:11434` with a local model name you can change.
            </p>
          </header>

          <div className="info-grid">
            <div>
              <span className="label">Status</span>
              <strong>{settingsBadge}</strong>
            </div>
            <div>
              <span className="label">OS Encryption</span>
              <strong>
                {settings.encryptionAvailable ? 'Available' : 'Unavailable'}
              </strong>
            </div>
          </div>

          {settings.aiProvider === 'openai' && !settings.encryptionAvailable ? (
            <DismissibleBanner dismissKey="settings-openai-session-only">
              This device does not currently expose secure OS key storage, so
              StudyBud will keep the OpenAI API key in memory only for this app session.
              It will work until you close the app, but it will not be saved to disk.
            </DismissibleBanner>
          ) : null}

          <form className="stack-form" onSubmit={handleSaveAiSettings}>
            <label htmlFor="ai-provider">AI Provider</label>
            <select
              id="ai-provider"
              value={aiProviderInput}
              onChange={(event) => setAiProviderInput(event.target.value as AiProvider)}
              disabled={busy}
            >
              <option value="openai">OpenAI</option>
              <option value="ollama">Ollama (local)</option>
            </select>

            <div className="hint-text">
              {aiProviderInput === 'ollama'
                ? 'Local Ollama is used over HTTP and does not require an OpenAI key.'
                : 'OpenAI uses your stored API key and the default cloud model for analysis.'}
            </div>

            <label htmlFor="open-ai-key">OpenAI API Key</label>
            <input
              id="open-ai-key"
              type="password"
              value={apiKeyInput}
              onChange={(event) => setApiKeyInput(event.target.value)}
              placeholder="sk-..."
              autoComplete="off"
              disabled={busy || aiProviderInput !== 'openai'}
            />
            <label htmlFor="ollama-base-url">Ollama Base URL</label>
            <input
              id="ollama-base-url"
              type="text"
              value={ollamaBaseUrlInput}
              onChange={(event) => setOllamaBaseUrlInput(event.target.value)}
              placeholder="http://localhost:11434"
              autoComplete="off"
              disabled={busy || aiProviderInput !== 'ollama'}
            />
            <label htmlFor="ollama-model">Ollama Model</label>
            <input
              id="ollama-model"
              type="text"
              value={ollamaModelInput}
              onChange={(event) => setOllamaModelInput(event.target.value)}
              placeholder="qwen3:8b"
              autoComplete="off"
              disabled={busy || aiProviderInput !== 'ollama'}
            />
            <div className="form-actions">
              <button
                type="submit"
                disabled={
                  busy ||
                  (aiProviderInput === 'openai' &&
                    apiKeyInput.trim().length === 0 &&
                    !settings.openAiApiKeyConfigured) ||
                  (aiProviderInput === 'ollama' &&
                    (ollamaBaseUrlInput.trim().length === 0 ||
                      ollamaModelInput.trim().length === 0))
                }
              >
                Save AI Settings
              </button>
              <button
                type="button"
                className="ghost-button"
                disabled={busy || !settings.openAiApiKeyConfigured}
                onClick={handleClearApiKey}
              >
                Clear Stored Key
              </button>
            </div>
          </form>
        </section>

        <section className="settings-card">
          <header className="settings-card-header">
            <h3>Research Settings</h3>
            <p>
              Add optional Brave Search and YouTube Data API keys for more stable
              research results. If keys are missing, StudyBud falls back to built-in
              search scraping.
            </p>
          </header>

          <div className="info-grid">
            <div>
              <span className="label">Web Provider</span>
              <strong>
                {settings.braveSearchApiKeyConfigured
                  ? 'Brave Search API'
                  : 'Fallback web scraping'}
              </strong>
            </div>
            <div>
              <span className="label">Video Provider</span>
              <strong>
                {settings.youTubeApiKeyConfigured
                  ? 'YouTube Data API'
                  : 'Fallback video scraping'}
              </strong>
            </div>
            <div>
              <span className="label">Safety Mode</span>
              <strong>{settings.researchSafetyMode}</strong>
            </div>
          </div>

          {!settings.encryptionAvailable ? (
            <DismissibleBanner dismissKey="settings-research-session-only">
              This device does not currently expose secure OS key storage, so research
              API keys will be kept in memory only for this app session.
            </DismissibleBanner>
          ) : null}

          <form className="stack-form" onSubmit={handleSaveResearchSettings}>
            <label htmlFor="research-safety-mode">Research Safety Mode</label>
            <select
              id="research-safety-mode"
              value={researchSafetyModeInput}
              onChange={(event) =>
                setResearchSafetyModeInput(
                  event.target.value as 'balanced' | 'education',
                )
              }
              disabled={busy}
            >
              <option value="balanced">Balanced</option>
              <option value="education">Education Focused</option>
            </select>

            <div className="hint-text">
              Education mode prioritizes educational domains and learning-oriented
              results when StudyBud ranks research sources.
            </div>

            <label htmlFor="brave-search-api-key">Brave Search API Key</label>
            <input
              id="brave-search-api-key"
              type="password"
              value={braveSearchApiKeyInput}
              onChange={(event) => setBraveSearchApiKeyInput(event.target.value)}
              placeholder="BSA..."
              autoComplete="off"
              disabled={busy}
            />

            <label htmlFor="youtube-api-key">YouTube Data API Key</label>
            <input
              id="youtube-api-key"
              type="password"
              value={youTubeApiKeyInput}
              onChange={(event) => setYouTubeApiKeyInput(event.target.value)}
              placeholder="AIza..."
              autoComplete="off"
              disabled={busy}
            />

            <div className="form-actions">
              <button type="submit" disabled={busy}>
                Save Research Settings
              </button>
              <button
                type="button"
                className="ghost-button"
                disabled={
                  busy ||
                  (!settings.braveSearchApiKeyConfigured &&
                    !settings.youTubeApiKeyConfigured)
                }
                onClick={handleClearResearchKeys}
              >
                Clear Stored Research Keys
              </button>
            </div>
          </form>
        </section>

        <section className="settings-card">
          <header className="settings-card-header">
            <h3>Diagnostics</h3>
            <p>
              Quick runtime health details for support, demos, and environment troubleshooting.
            </p>
          </header>

          <div className="info-grid">
            <div>
              <span className="label">Connectivity</span>
              <strong>{isOnline ? 'Online' : 'Offline'}</strong>
            </div>
            <div>
              <span className="label">Platform</span>
              <strong>
                {appInfo
                  ? `${appInfo.platform}${appInfo.runningInWsl ? ' (WSL)' : ''}`
                  : 'Loading...'}
              </strong>
            </div>
            <div>
              <span className="label">Electron</span>
              <strong>{appInfo?.electronVersion ?? 'Loading...'}</strong>
            </div>
            <div>
              <span className="label">Node</span>
              <strong>{appInfo?.nodeVersion ?? 'Loading...'}</strong>
            </div>
            <div>
              <span className="label">Native DB</span>
              <strong>
                {appInfo?.nativeDatabaseReady ? 'Ready' : 'Not ready'}
              </strong>
            </div>
            <div>
              <span className="label">AI Status</span>
              <strong>{aiDiagnosticsStatus}</strong>
            </div>
            <div>
              <span className="label">OCR Runtime</span>
              <strong>{ocrDiagnosticsStatus}</strong>
            </div>
            <div>
              <span className="label">OCR Mode</span>
              <strong>{appInfo?.ocrRuntimeMode ?? 'Loading...'}</strong>
            </div>
            <div>
              <span className="label">Research Status</span>
              <strong>{researchDiagnosticsStatus}</strong>
            </div>
            <div>
              <span className="label">Safety Mode</span>
              <strong>{settings.researchSafetyMode}</strong>
            </div>
          </div>

          <div className="info-grid">
            <div>
              <span className="label">Data Path</span>
              <code>{settings.dataPath || 'Loading...'}</code>
            </div>
            <div>
              <span className="label">User Data Path</span>
              <code>{appInfo?.userDataPath ?? 'Loading...'}</code>
            </div>
            <div>
              <span className="label">OCR Runtime Path</span>
              <code>{appInfo?.ocrRuntimePath ?? 'Not resolved'}</code>
            </div>
          </div>
        </section>

        <section className="settings-card">
          <header className="settings-card-header">
            <h3>Data Path</h3>
            <p>
              Choose where StudyBud stores its database, imported documents, and subject workspaces.
            </p>
          </header>

          <div className="info-grid">
            <div>
              <span className="label">Current Path</span>
              <code>{settings.dataPath || 'Loading...'}</code>
            </div>
            <div>
              <span className="label">Default Path</span>
              <code>{settings.defaultDataPath || 'Loading...'}</code>
            </div>
          </div>

          <div className="info-grid">
            <div>
              <span className="label">Mode</span>
              <strong>{settings.usingCustomDataPath ? 'Custom Directory' : 'Default Directory'}</strong>
            </div>
            <div>
              <span className="label">Effect</span>
              <strong>Used for new and reopened StudyBud data</strong>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" disabled={busy} onClick={handleChooseDataPath}>
              Choose Folder
            </button>
            <button
              type="button"
              className="ghost-button"
              disabled={busy || !settings.usingCustomDataPath}
              onClick={handleResetDataPath}
            >
              Reset To Default
            </button>
          </div>
        </section>
      </section>
    );
  };

  const renderWorkspace = () => {
    if (!workspace) {
      return (
        <section className="panel">
          <div className="empty-state">Select a subject to open its workspace.</div>
        </section>
      );
    }

    const selectedDivision =
      workspace.analysis?.divisions.find(
        (division) => division.id === selectedDivisionId,
      ) ?? null;
    const selectedCitation =
      selectedDivision?.sourcePages.find(
        (citation) => getCitationKey(citation) === selectedCitationKey,
      ) ?? selectedDivision?.sourcePages[0] ?? null;
    const activeCitationPage =
      selectedCitation &&
      selectedDocumentId === selectedCitation.documentId &&
      selectedPageNumber === selectedCitation.pageNumber
        ? documentDetail?.pages.find((page) => page.pageNumber === selectedCitation.pageNumber) ?? null
        : null;
    const focusedPageSnippet = activeCitationPage && selectedCitation
      ? buildCitationTextSnippet(
          activeCitationPage.textContent,
          selectedCitation.highlightText,
        )
      : '';
    const divisionChatMessages = (workspace.chatMessages ?? []).filter(
      (message) => message.divisionId === selectedDivision?.id,
    );
    const latestAssistantMessage =
      [...divisionChatMessages]
        .reverse()
        .find((message) => message.role === 'assistant') ?? null;
    const divisionPracticeSets = (workspace.practiceSets ?? []).filter(
      (practiceSet) => practiceSet.divisionId === selectedDivision?.id,
    );
    const unitActionBlockedReason = !analysisReady
      ? aiActionBlockedReason
      : !selectedDivision
        ? 'Open a unit from the Units page before using chat or practice tools.'
        : null;
    const practiceGenerationReady =
      analysisReady &&
      Boolean(selectedDivision) &&
      (selectedDivision?.problemTypes.length ?? 0) > 0 &&
      selectedPracticeProblemTypeId.trim().length > 0 &&
      practiceCount >= 1 &&
      practiceCount <= 8;

    return (
      <section className="panel workspace-panel">
        <header className="workspace-header">
          <div>
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                setActiveView('library');
                setWorkspace(null);
                setSelectedDivisionId(null);
                setSelectedDocumentId(null);
              }}
            >
              Back To Library
            </button>
            <h2>{workspace.subject.name}</h2>
            <p>
              Import lecture or homework PDFs, inspect extracted documents, and
              preview their pages before AI ingestion. Reopen this workspace any
              time to continue from the same saved study state.
            </p>
          </div>
          <div className="workspace-actions">
            <button type="button" onClick={() => void handleImportDocuments('lecture')}>
              Import Lecture PDFs
            </button>
            <button type="button" onClick={() => void handleImportDocuments('homework')}>
              Import Homework PDFs
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={handleOpenUnitsPage}
            >
              See Units
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => void handleAnalyzeSubject()}
              disabled={
                busy ||
                workspace.documents.every((document) => document.importStatus !== 'ready')
                || !analysisReady
              }
            >
              Analyze Subject
            </button>
          </div>
        </header>

        <div
          ref={workspaceGridRef}
          className="workspace-grid workspace-grid-resizable"
          style={{
            gridTemplateColumns: `minmax(0, 1fr) ${WORKSPACE_RESIZER_WIDTH}px ${chatPanelWidth}px`,
          }}
        >
          <section className="workspace-main">
            <section className="analysis-panel">
              <div className="sidebar-section-title">
                <h3>Subject Workspace</h3>
                <span>{workspace.analysis?.divisions.length ?? 0} units</span>
              </div>

              {activeAnalysis ? (
                <div className="analysis-job-banner">
                  <div className="analysis-job-copy">
                    <strong>Analysis request in progress...</strong>
                    <div className="analysis-job-meta">
                      <span>{activeAnalysis.provider}</span>
                      <span>{activeAnalysis.model}</span>
                      <span>Elapsed {formatElapsed(analysisElapsedMs)}</span>
                    </div>
                  </div>
                  <span className="pill pill-status-running">running</span>
                </div>
              ) : null}

              {analysisError ? (
                <DismissibleBanner
                  dismissKey={`analysis-error:${analysisError}`}
                  className="panel-banner"
                  action={
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => void handleAnalyzeSubject()}
                      disabled={busy}
                    >
                      Retry Analysis
                    </button>
                  }
                >
                  <span>{analysisError}</span>
                </DismissibleBanner>
              ) : null}

              {!isOnline && settings.aiProvider === 'openai' ? (
                <DismissibleBanner dismissKey="workspace-offline-openai">
                  You are currently offline. OpenAI-powered analysis and chat will not
                  work until connectivity returns or you switch to a local Ollama
                  provider in Settings.
                </DismissibleBanner>
              ) : null}

              {!isOnline && rightRailTab === 'research' ? (
                <DismissibleBanner dismissKey="workspace-offline-research">
                  You are currently offline. Web research, browser loading, and
                  external research links will be unavailable until connectivity
                  returns.
                </DismissibleBanner>
              ) : null}

              {settings.aiProvider === 'ollama' && !activeAnalysis ? (
                <div className="analysis-muted">
                  Ollama mode expects a reachable local server at{' '}
                  <code>{settings.ollamaBaseUrl}</code> using model{' '}
                  <code>{settings.ollamaModel}</code>.
                </div>
              ) : null}

              {!analysisReady && !workspace.analysis ? (
                <div className="empty-state">
                  {settings.aiProvider === 'ollama'
                    ? 'Set an Ollama model in Settings before running subject analysis.'
                    : 'Add your OpenAI API key in Settings before running subject analysis.'}
                </div>
              ) : workspace.documents.length > 0 &&
                workspace.documents.every((document) => document.importStatus !== 'ready') ? (
                <div className="empty-state">
                  No import-ready documents are available yet. Re-import the PDFs or
                  remove failed files before running analysis.
                </div>
              ) : !workspace.analysis ? (
                <div className="empty-state">
                  Analyze this subject to extract units, key concepts, and problem types from the imported lecture and homework PDFs.
                </div>
              ) : !selectedDivision ? (
                <div className="empty-state">
                  Open `See Units` to choose a unit, then return here to study it in depth.
                </div>
              ) : (
                <div className="division-workspace">
                  <article className="analysis-division-card division-focus-card">
                    <div className="analysis-division-header">
                      <div>
                        <h4 onMouseUp={handleSummarySelection}>{selectedDivision.title}</h4>
                        <p onMouseUp={handleSummarySelection}>{selectedDivision.summary}</p>
                      </div>
                      <span className="analysis-count-pill">
                        {selectedDivision.problemTypes.length} problem
                        {selectedDivision.problemTypes.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    <div className="analysis-block">
                      <span className="label">Key Concepts</span>
                      <div className="analysis-chip-list">
                        {selectedDivision.keyConcepts.map((concept) => (
                          <span
                            key={`${selectedDivision.id}:${concept}`}
                            className="analysis-chip"
                            onMouseUp={() => handleKeyConceptSelection(concept)}
                          >
                            {concept}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="analysis-block">
                      <span className="label">Problem Types</span>
                      <div className="analysis-problem-list">
                        {selectedDivision.problemTypes.length === 0 ? (
                          <p className="analysis-muted">
                            No clear problem types were detected for this unit yet.
                          </p>
                        ) : (
                          selectedDivision.problemTypes.map((problemType) => (
                            <article
                              key={problemType.id}
                              className="analysis-problem-card"
                              onMouseUp={() => handleProblemTypeSelection(problemType)}
                            >
                              <strong>{problemType.title}</strong>
                              <p>{problemType.description}</p>
                            </article>
                          ))
                        )}
                      </div>
                    </div>
                  </article>

                  <PracticePanel
                    division={selectedDivision}
                    practiceSets={divisionPracticeSets}
                    selectedProblemTypeId={selectedPracticeProblemTypeId}
                    onSelectedProblemTypeChange={setSelectedPracticeProblemTypeId}
                    difficulty={practiceDifficulty}
                    onDifficultyChange={setPracticeDifficulty}
                    count={practiceCount}
                    onCountChange={(value) =>
                      setPracticeCount(Math.min(8, Math.max(1, value)))
                    }
                    onGenerate={() => void handleGeneratePractice()}
                    onRevealAnswer={(questionId) => void handleTogglePracticeAnswer(questionId)}
                    onDeletePracticeSet={(practiceSet) => {
                      void handleDeletePracticeSet(practiceSet);
                    }}
                    onRegeneratePracticeSet={(practiceSet) => {
                      void handleRegeneratePracticeSet(practiceSet);
                    }}
                    onExplainQuestion={(practiceSet, question) => {
                      void handleExplainPracticeQuestion(practiceSet, question);
                    }}
                    onExplainAnswer={(practiceSet, question) => {
                      void handleExplainPracticeAnswer(practiceSet, question);
                    }}
                    onQuestionSelection={handlePracticeQuestionSelection}
                    onAnswerSelection={handlePracticeAnswerSelection}
                    canGenerate={!practiceBusy && !busy && practiceGenerationReady}
                    generateBusy={practiceBusy}
                    chatBusy={chatBusy}
                    aiActionsEnabled={!unitActionBlockedReason}
                    disabledReason={unitActionBlockedReason}
                    errorMessage={practiceError}
                    onRetryGenerate={
                      lastPracticeRequest ? () => void handleRetryPractice() : null
                    }
                    heading="Practice Studio"
                    generateHelperText="Generated sets stay saved under this unit, and each answer key can be revealed only when you want it."
                    emptyStateWithoutProblemTypes="Analyze more material or refine this unit before generating practice."
                    emptyStateWithoutSets="No saved practice sets for this unit yet. Generate a set from one of the detected problem types above."
                  />

                  {selectedCitation ? (
                    <article className="analysis-division-card citation-focus-panel">
                      <div className="analysis-division-header">
                        <div>
                          <h4>Focused Source Evidence</h4>
                          <p>
                            {selectedCitation.documentName} • page {selectedCitation.pageNumber}
                          </p>
                        </div>
                        <span className={`pill pill-${selectedCitation.documentKind}`}>
                          {selectedCitation.documentKind}
                        </span>
                      </div>
                      <p
                        className="citation-focus-excerpt"
                        onMouseUp={() => handleCitationEvidenceSelection(selectedCitation)}
                      >
                        {renderHighlightedText(
                          selectedCitation.excerptText,
                          selectedCitation.highlightText,
                        )}
                      </p>
                    </article>
                  ) : null}

                  <section className="citation-section">
                    <div className="sidebar-section-title">
                      <h3>Referenced Slides And Pages</h3>
                      <span>{selectedDivision.sourcePages.length}</span>
                    </div>

                    {selectedDivision.sourcePages.length === 0 ? (
                      <div className="empty-state">
                        No cited pages were available for this unit.
                      </div>
                    ) : (
                      <div className="citation-grid">
                        {selectedDivision.sourcePages.map((citation) => (
                          <CitationPreviewCard
                            key={`${selectedDivision.id}:${citation.pageId}`}
                            citation={citation}
                            documentBytes={
                              documentBytesCache[citation.documentId] ?? null
                            }
                            active={selectedCitationKey === getCitationKey(citation)}
                            onClick={() => openCitationSourcePage(citation)}
                            onTextSelection={handleCitationEvidenceSelection}
                          />
                        ))}
                      </div>
                    )}
                  </section>

                  {workspace.analysis.unassignedPages.length > 0 ? (
                    <article className="analysis-division-card analysis-unassigned-card">
                      <div className="analysis-division-header">
                        <div>
                          <h4>Unassigned Pages</h4>
                          <p>
                            These pages did not clearly fit a unit in the latest pass.
                          </p>
                        </div>
                        <span className="analysis-count-pill">
                          {workspace.analysis.unassignedPages.length}
                        </span>
                      </div>

                      <div className="page-text-panel-actions analysis-unassigned-actions">
                        <button
                          type="button"
                          className="page-text-toggle"
                          onClick={() =>
                            setIsUnassignedPagesExpanded((current) => !current)
                          }
                          aria-expanded={isUnassignedPagesExpanded}
                        >
                          <span className="page-text-toggle-arrow" aria-hidden="true">
                            {isUnassignedPagesExpanded ? '▾' : '▸'}
                          </span>
                          {isUnassignedPagesExpanded ? 'Hide pages' : 'Show pages'}
                        </button>
                      </div>

                      {isUnassignedPagesExpanded ? (
                        <div className="analysis-source-list">
                          {workspace.analysis.unassignedPages.map((page) => (
                            <span
                              key={page.id}
                              className="analysis-unassigned-row"
                              onMouseUp={() => handleUnassignedPageSelection(page)}
                            >
                              <span>
                                {page.documentName} • page {page.pageNumber}
                                {page.reason ? ` - ${page.reason}` : ''}
                              </span>
                              <span className="page-text-source-pill">
                                {getAnalysisTextSourceLabel(page.textSource)}
                              </span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="empty-state page-text-collapsed-state">
                          Expand this section to inspect which pages were left
                          unassigned and whether their analyzed text came from
                          native extraction, OCR, or a merged result.
                        </div>
                      )}
                    </article>
                  ) : null}
                </div>
              )}
            </section>

            <section ref={pdfViewerSectionRef} className="document-viewer-section">
              {!documentDetail ? (
                <div className="empty-state">
                  Select a document to inspect its pages and extracted text.
                </div>
              ) : documentDetail.importStatus !== 'ready' ? (
                <div className="empty-state">
                  {documentDetail.errorMessage ??
                    'This document did not import successfully.'}
                </div>
              ) : (
                <>
                  <div className="document-inspector-header">
                    <div>
                      <h3>{documentDetail.originalFileName}</h3>
                      <p>
                        {documentDetail.kind} • {documentDetail.pageCount} pages •
                        {documentDetail.pagesWithExtractedText}/{documentDetail.pageCount} with text •
                        imported {formatDate(documentDetail.updatedAt)}
                      </p>
                    </div>
                    <div className="analysis-chip-list">
                      <span className="pill pill-ready">ready</span>
                      <span className={`pill pill-${documentDetail.kind}`}>
                        {documentDetail.kind}
                      </span>
                      {getDocumentOcrBadgeLabel(documentDetail.ocrState) ? (
                        <span className="pill pill-ocr">
                          {getDocumentOcrBadgeLabel(documentDetail.ocrState)}
                        </span>
                      ) : null}
                      {documentDetail.extractionState !== 'normal' ? (
                        <span
                          className={`pill pill-${
                            documentDetail.extractionState === 'image-only'
                              ? 'image-only'
                              : 'limited'
                          }`}
                        >
                          {documentDetail.extractionState === 'image-only'
                            ? 'image-only'
                            : 'limited text'}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {getDocumentOcrWarningMessage(documentDetail) ? (
                    <DismissibleBanner
                      dismissKey={`document-ocr-warning:${documentDetail.id}:${documentDetail.ocrState}:${documentDetail.ocrWarning ?? ''}`}
                    >
                      {getDocumentOcrWarningMessage(documentDetail)}
                    </DismissibleBanner>
                  ) : null}

                  {getExtractionWarningMessage(documentDetail.extractionState) ? (
                    <DismissibleBanner
                      dismissKey={`document-extraction-warning:${documentDetail.id}:${documentDetail.extractionState}`}
                    >
                      {getExtractionWarningMessage(documentDetail.extractionState)}
                    </DismissibleBanner>
                  ) : null}

                  <Suspense fallback={<div className="empty-state">Loading PDF viewer...</div>}>
                    <PdfViewer
                      documentBytes={documentBytes}
                      pages={documentDetail.pages}
                      selectedPageNumber={selectedPageNumber}
                      onSelectPage={setSelectedPageNumber}
                      focusText={
                        selectedCitation &&
                        selectedCitation.documentId === documentDetail.id &&
                        selectedCitation.pageNumber === selectedPageNumber
                          ? selectedCitation.highlightText
                          : null
                      }
                    />
                  </Suspense>

                  <section className="page-text-panel">
                    <div className="sidebar-section-title">
                      <h3>Extracted Page Text</h3>
                      <div className="page-text-panel-actions">
                        <span>{documentDetail.pages.length}</span>
                        <button
                          type="button"
                          className="page-text-toggle"
                          onClick={() => setIsPageTextExpanded((current) => !current)}
                          aria-expanded={isPageTextExpanded}
                        >
                          <span className="page-text-toggle-arrow" aria-hidden="true">
                            {isPageTextExpanded ? '▾' : '▸'}
                          </span>
                          {isPageTextExpanded ? 'Hide pages' : 'Show pages'}
                        </button>
                      </div>
                    </div>

                    {isPageTextExpanded ? (
                      <div className="page-text-list">
                        {documentDetail.pages.map((page) => (
                          <button
                            key={page.id}
                            type="button"
                            className={`page-text-card${selectedPageNumber === page.pageNumber ? ' active' : ''}`}
                            onClick={() => setSelectedPageNumber(page.pageNumber)}
                          >
                            <div className="page-text-card-header">
                              <strong>Page {page.pageNumber}</strong>
                              {getPageTextSourceLabel(page) ? (
                                <span className="page-text-source-pill">
                                  {getPageTextSourceLabel(page)}
                                </span>
                              ) : null}
                            </div>
                            <p onMouseUp={() => handlePageTextSelection(page)}>
                              {page.pageNumber === selectedPageNumber &&
                              selectedCitation &&
                              selectedCitation.documentId === documentDetail.id &&
                              selectedCitation.pageNumber === page.pageNumber
                                ? renderHighlightedText(
                                    focusedPageSnippet ||
                                      page.previewText ||
                                      'No text extracted on this page.',
                                    selectedCitation.highlightText,
                                  )
                                : page.previewText || 'No text extracted on this page.'}
                            </p>
                            {page.ocrWarning ? (
                              <span className="page-text-warning">{page.ocrWarning}</span>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="empty-state page-text-collapsed-state">
                        Expand this section to inspect the extracted text preview for each page.
                      </div>
                    )}
                  </section>
                </>
              )}
            </section>
          </section>

          <div
            className={`workspace-resizer${isResizingChatPanel ? ' active' : ''}`}
            role="separator"
            aria-label="Resize chat panel"
            aria-orientation="vertical"
            onMouseDown={() => setIsResizingChatPanel(true)}
          />

          <aside className="workspace-chat">
            <div className="workspace-rail-tabs" role="tablist" aria-label="Workspace rail">
              <button
                type="button"
                className={`workspace-rail-tab${
                  rightRailTab === 'chat' ? ' active' : ''
                }`}
                onClick={() => setRightRailTab('chat')}
              >
                Chat
              </button>
              <button
                type="button"
                className={`workspace-rail-tab${
                  rightRailTab === 'research' ? ' active' : ''
                }`}
                onClick={() => setRightRailTab('research')}
              >
                Research
              </button>
            </div>

            {rightRailTab === 'chat' ? (
              <DivisionChatPanel
                messages={divisionChatMessages}
                chatInput={chatInput}
                onChatInputChange={setChatInput}
                onSubmit={() => void handleAskChat()}
                chatBusy={chatBusy}
                errorMessage={chatError}
                onRetry={lastChatRequest ? () => void handleRetryChat() : null}
                pendingPrompt={pendingChatPrompt}
                onUseFollowup={(value) => {
                  void submitChatPrompt(value, null);
                }}
                onOpenCitation={openCitationSourcePage}
                onSelectCitationText={handleCitationEvidenceSelection}
                onSelectMessageText={handleChatMessageSelection}
                activeCitationKey={selectedCitationKey}
                documentBytesCache={documentBytesCache}
                heading="Unit Chat"
                emptyStateMessage="Ask a question about this unit, or highlight text in the summary or extracted page text and ask for clarification."
                submitLabel="Ask Unit Chat"
                placeholder="Ask a question about this unit..."
                disabledReason={unitActionBlockedReason}
                aiActionsEnabled={!unitActionBlockedReason}
              />
            ) : (
              <ResearchPanel
                panelRef={researchPanelRef}
                searchQuery={researchQueryInput}
                onSearchQueryChange={setResearchQueryInput}
                videoQuery={researchVideoQueryInput}
                onVideoQueryChange={setResearchVideoQueryInput}
                onSearch={() => void handleSearchResearch()}
                onRetrySearch={
                  lastResearchRequest ? () => void handleRetryResearch() : null
                }
                searchBusy={researchBusy}
                searchError={researchError}
                searchResult={researchResult}
                suggestedSearchQueries={
                  latestAssistantMessage?.suggestedSearchQueries ?? []
                }
                suggestedVideoQueries={
                  latestAssistantMessage?.suggestedVideoQueries ?? []
                }
                suggestionSourceContent={latestAssistantMessage?.content ?? null}
                suggestionSourceCreatedAt={
                  latestAssistantMessage?.createdAt ?? null
                }
                onUseSuggestedSearch={(query) => {
                  void handleSearchResearch(query, researchVideoQueryInput);
                }}
                onUseSuggestedVideoQuery={(query) => {
                  const nextQuery = researchQueryInput.trim() || query;
                  void handleSearchResearch(nextQuery, query);
                }}
                onOpenWebResult={(result) => {
                  void handleOpenResearchWebResult(result.url);
                }}
                onOpenWebResultExternally={(result) => {
                  void handleOpenResearchWebResultExternally(result.url);
                }}
                onOpenVideoResult={(result) => {
                  void handleOpenResearchVideoResult(result.url);
                }}
                browserState={researchBrowserState}
                browserUrlInput={researchBrowserUrlInput}
                onBrowserUrlInputChange={setResearchBrowserUrlInput}
                onNavigateBrowser={() => void handleNavigateResearchBrowser()}
                onBackBrowser={() => void handleResearchBrowserBack()}
                onForwardBrowser={() => void handleResearchBrowserForward()}
                onReloadBrowser={() => void handleResearchBrowserReload()}
                onHideBrowser={() => void handleHideResearchBrowser()}
                onOpenBrowserExternally={() =>
                  void handleOpenCurrentResearchBrowserExternally()
                }
                browserHostRef={researchBrowserHostRef}
              />
            )}
          </aside>
        </div>
      </section>
    );
  };

  const renderUnitsPage = () => {
    if (!workspace) {
      return (
        <section className="panel">
          <div className="empty-state">Open a subject to view its units.</div>
        </section>
      );
    }

    const units = workspace.analysis?.divisions ?? [];
    const selectedUnit =
      units.find((division) => division.id === selectedDivisionId) ?? null;

    return (
      <section className="panel subject-page-panel">
        <div className="subject-page-shell">
          <aside className="subject-page-sidebar">
            <h2>{workspace.subject.name}</h2>
            <p className="subtitle">Subject navigation</p>

            <nav className="nav-list subject-page-nav">
              <button
                type="button"
                className={unitsSidebarTab === 'units' ? 'active' : ''}
                onClick={() => setUnitsSidebarTab('units')}
              >
                Units
              </button>
              <button
                type="button"
                className={unitsSidebarTab === 'documents' ? 'active' : ''}
                onClick={() => setUnitsSidebarTab('documents')}
              >
                Documents
              </button>
              <button
                type="button"
                className={unitsSidebarTab === 'flashcards' ? 'active' : ''}
                onClick={() => setUnitsSidebarTab('flashcards')}
              >
                Flashcards
              </button>
              <button
                type="button"
                className="ghost-button"
                disabled={!selectedDivisionId}
                onClick={() => setActiveView('workspace')}
              >
                Back To Subject
              </button>
            </nav>
          </aside>

          <section className="subject-page-content">
            <header className="workspace-header">
              <div>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    setActiveView('library');
                  }}
                >
                  Back To Library
                </button>
                <h2>{workspace.subject.name}</h2>
                <p>
                  Review all analyzed units for this subject and open one to enter the
                  study workspace.
                </p>
              </div>
            </header>

            {unitsSidebarTab === 'documents' ? (
              <section className="analysis-panel">
                <div className="sidebar-section-title">
                  <h3>Documents</h3>
                  <span>{workspace.documents.length}</span>
                </div>
                <p className="analysis-muted">
                  Open a document to bring it into the subject workspace, or delete
                  documents you no longer want attached to this subject.
                </p>

                {workspace.documents.length === 0 ? (
                  <div className="empty-state">
                    No PDFs imported yet. Use the import buttons from the subject
                    workspace to add lecture or homework documents.
                  </div>
                ) : (
                  <div className="document-list document-groups">
                    {(['lecture', 'homework'] as const).map((kind) => {
                      const groupedDocuments = workspace.documents.filter(
                        (document) => document.kind === kind,
                      );

                      if (groupedDocuments.length === 0) {
                        return null;
                      }

                      return (
                        <section key={kind} className="document-group">
                          <div className="document-group-header">
                            <h4>{kind === 'lecture' ? 'Lectures' : 'Homework'}</h4>
                            <span>{groupedDocuments.length}</span>
                          </div>

                          <div className="document-group-list">
                            {groupedDocuments.map((document) => (
                              <article
                                key={document.id}
                                className={`document-card-shell${
                                  selectedDocumentId === document.id ? ' active' : ''
                                }`}
                              >
                                <button
                                  type="button"
                                  className="document-card"
                                  onClick={() => {
                                    pendingPageSelectionRef.current = null;
                                    setSelectedDocumentId(document.id);
                                    setActiveView('workspace');
                                  }}
                                >
                                  <div className="document-card-header">
                                    <strong>{document.originalFileName}</strong>
                                    <div className="analysis-chip-list">
                                      <span className={`pill pill-${document.kind}`}>
                                        {document.kind}
                                      </span>
                                      {getDocumentOcrBadgeLabel(document.ocrState) ? (
                                        <span className="pill pill-ocr">
                                          {getDocumentOcrBadgeLabel(document.ocrState)}
                                        </span>
                                      ) : null}
                                      {document.importStatus === 'ready' &&
                                      document.extractionState !== 'normal' ? (
                                        <span
                                          className={`pill pill-${
                                            document.extractionState === 'image-only'
                                              ? 'image-only'
                                              : 'limited'
                                          }`}
                                        >
                                          {document.extractionState === 'image-only'
                                            ? 'image-only'
                                            : 'limited text'}
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                  <span className="document-card-meta">
                                    {document.importStatus === 'ready'
                                      ? `${document.pageCount} pages • ${document.pagesWithExtractedText}/${document.pageCount} with text${
                                          document.ocrImprovedPages > 0
                                            ? ` • OCR improved ${document.ocrImprovedPages}`
                                            : ''
                                        }`
                                      : 'Import failed'}
                                  </span>
                                  {document.importStatus === 'ready' &&
                                  getDocumentOcrWarningMessage(document) ? (
                                    <span className="document-card-error">
                                      {getDocumentOcrWarningMessage(document)}
                                    </span>
                                  ) : null}
                                  {document.importStatus === 'ready' &&
                                  document.extractionState !== 'normal' ? (
                                    <span className="document-card-error">
                                      {document.extractionState === 'image-only'
                                        ? 'Scanned/image-only PDF likely'
                                        : 'Only limited text was extracted'}
                                    </span>
                                  ) : null}
                                  {document.errorMessage ? (
                                    <span className="document-card-error">
                                      {document.errorMessage}
                                    </span>
                                  ) : null}
                                </button>
                                <button
                                  type="button"
                                  className="document-delete-button"
                                  disabled={busy}
                                  onClick={() => void handleDeleteDocument(document.id)}
                                >
                                  Delete
                                </button>
                              </article>
                            ))}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                )}
              </section>
            ) : unitsSidebarTab === 'flashcards' ? (
              <FlashcardsPanel
                key={`${workspace.subject.id}:flashcards`}
                units={units}
                decks={workspace.flashcardDecks}
                busy={flashcardsBusy}
                aiActionsEnabled={analysisReady}
                disabledReason={aiActionBlockedReason}
                errorMessage={flashcardsError}
                onGenerate={(input) => {
                  void handleGenerateFlashcards(input);
                }}
                onCreateManual={(input) => {
                  void handleCreateManualFlashcardDeck(input);
                }}
                onDeleteDeck={(deck) => {
                  void handleDeleteFlashcardDeck(deck);
                }}
              />
            ) : !workspace.analysis ? (
              <section className="analysis-panel">
                <div className="sidebar-section-title">
                  <h3>Units</h3>
                  <span>0</span>
                </div>
                <div className="empty-state">
                  Analyze this subject first to generate its units.
                </div>
              </section>
            ) : units.length === 0 ? (
              <section className="analysis-panel">
                <div className="sidebar-section-title">
                  <h3>Units</h3>
                  <span>0</span>
                </div>
                <div className="empty-state">
                  No units were produced by the latest analysis yet.
                </div>
              </section>
            ) : (
              <section className="analysis-panel">
                <div className="sidebar-section-title">
                  <h3>Units</h3>
                  <span>{units.length}</span>
                </div>

                <div className="division-nav-list units-page-list">
                  {units.map((division) => (
                    <button
                      key={division.id}
                      type="button"
                      className={`division-nav-button units-page-button${
                        selectedUnit?.id === division.id ? ' active' : ''
                      }`}
                      onClick={() => handleSelectDivision(division)}
                    >
                      <div className="division-nav-copy">
                        <strong onMouseUp={() => handleDivisionListSelection(division)}>
                          {division.title}
                        </strong>
                        <p
                          className="division-nav-summary"
                          onMouseUp={() => handleDivisionListSelection(division)}
                        >
                          {division.summary}
                        </p>
                      </div>
                      <span className="division-nav-count">
                        {division.sourcePages.length} page
                        {division.sourcePages.length === 1 ? '' : 's'}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </section>
        </div>
      </section>
    );
  };

  return (
    <main className={`app-shell${activeView === 'workspace' || activeView === 'units' ? ' workspace-mode' : ''}`}>
      {activeView !== 'workspace' && activeView !== 'units' ? (
        <aside className="sidebar">
          <h1>StudyBud</h1>
          <p className="sidebar-version">v{appInfo?.version ?? '...'}</p>
          <p className="subtitle">Desktop study workspace</p>
          <nav className="nav-list">
            <button
              className={activeView === 'library' ? 'active' : ''}
              onClick={() => setActiveView('library')}
              type="button"
            >
              Library
            </button>
            <button
              className=""
              onClick={() => {
                void handleOpenWorkspace();
              }}
              type="button"
              disabled={!(workspace?.subject.id ?? lastWorkspaceSubjectId)}
            >
              Workspace
            </button>
            <button
              className={activeView === 'settings' ? 'active' : ''}
              onClick={() => setActiveView('settings')}
              type="button"
            >
              Settings
            </button>
          </nav>
        </aside>
      ) : null}

      <section className="content">
        <div className="content-topbar">
          <div />
          <NotificationCenter
            notifications={[...contextualNotifications, ...notifications]}
            onDismiss={dismissNotification}
            onClearAll={() => setNotifications([])}
          />
        </div>

        {selectionDraft && selectionPopupPosition && selectionUiMode === 'chip' ? (
          <SelectionAskChip
            position={selectionPopupPosition}
            onOpen={() => setSelectionUiMode('popup')}
            onDismiss={closeSelectionPopup}
          />
        ) : null}

        {selectionDraft && selectionPopupPosition && selectionUiMode === 'popup' ? (
          <SelectionQuestionPopup
            selectionDraft={selectionDraft}
            position={selectionPopupPosition}
            question={selectionQuestionInput}
            busy={chatBusy}
            aiActionsEnabled={!unitSelectionBlockedReason}
            disabledReason={unitSelectionBlockedReason}
            onQuestionChange={setSelectionQuestionInput}
            onSubmit={() => void handleAskSelectionQuestion()}
            onCancel={closeSelectionPopup}
          />
        ) : null}

        {activeView === 'library'
          ? renderLibrary()
          : activeView === 'settings'
            ? renderSettings()
            : activeView === 'units'
              ? renderUnitsPage()
              : renderWorkspace()}
      </section>
    </main>
  );
};
