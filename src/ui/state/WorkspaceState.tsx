import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import type {
  ChatAskInput,
  DeletePracticeSetInput,
  GeneratePracticeInput,
  ImportDocumentsInput,
  PracticeDifficulty,
  PracticeQuestion,
  ResearchBrowserBoundsInput,
  ResearchBrowserState,
  ResearchSearchInput,
  ResearchSearchResult,
  SelectionContext,
  SourceDocumentDetail,
  SubjectWorkspace,
} from '../../shared/ipc';

import {
  CHAT_PANEL_MAX_WIDTH,
  CHAT_PANEL_MIN_WIDTH,
  DEFAULT_CHAT_PANEL_WIDTH,
  formatElapsed,
  getFirstReadyDocumentId,
  getStudyBudApi,
  initialResearchBrowserState,
  type ActiveAnalysisState,
  type ChatRetryRequest,
  type PracticeRetryRequest,
  type ResearchRetryRequest,
  type SelectionPopupPosition,
  type SelectionUiMode,
  type WorkspaceRightTab,
} from './helpers';

type DocumentBytesCache = Record<string, Uint8Array>;

type WorkspaceContextValue = {
  activeSubjectId: string | null;
  workspace: SubjectWorkspace | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  updateWorkspace: (
    updater: (prev: SubjectWorkspace | null) => SubjectWorkspace | null,
  ) => void;

  importingKind: 'lecture' | 'homework' | null;
  lastImportError: string | null;
  importDocuments: (kind: 'lecture' | 'homework') => Promise<void>;

  analysisState: ActiveAnalysisState | null;
  analysisElapsed: string;
  analysisError: string | null;
  analyze: () => Promise<void>;

  deleteDocument: (documentId: string) => Promise<void>;

  selectedDocumentId: string | null;
  selectedPageNumber: number | null;
  documentDetail: SourceDocumentDetail | null;
  documentDetailLoading: boolean;
  documentDetailError: string | null;
  selectDocument: (documentId: string | null, pageNumber?: number | null) => void;
  setSelectedPage: (pageNumber: number | null) => void;
  documentBytes: Uint8Array | null;
  documentBytesCache: DocumentBytesCache;

  selectedDivisionId: string | null;
  selectDivision: (divisionId: string | null) => void;

  selectionDraft: SelectionContext | null;
  selectionPopupPosition: SelectionPopupPosition | null;
  selectionUiMode: SelectionUiMode;
  selectedCitationKey: string | null;
  setSelection: (
    draft: SelectionContext | null,
    position?: SelectionPopupPosition | null,
    mode?: SelectionUiMode,
  ) => void;
  setSelectedCitationKey: (key: string | null) => void;
  clearSelection: () => void;

  rightRailTab: WorkspaceRightTab;
  setRightRailTab: (tab: WorkspaceRightTab) => void;
  chatPanelWidth: number;
  setChatPanelWidth: (width: number) => void;

  chatInput: string;
  setChatInput: (value: string) => void;
  chatBusy: boolean;
  chatError: string | null;
  pendingChatPrompt: string | null;
  lastChatRequest: ChatRetryRequest | null;
  askChat: (
    prompt: string,
    selectionContext?: SelectionContext | null,
    overrideDivisionId?: string | null,
  ) => Promise<void>;
  retryChat: () => Promise<void>;

  practiceProblemTypeId: string | null;
  setPracticeProblemTypeId: (id: string | null) => void;
  practiceDifficulty: PracticeDifficulty;
  setPracticeDifficulty: (difficulty: PracticeDifficulty) => void;
  practiceCount: number;
  setPracticeCount: (count: number) => void;
  practiceBusy: boolean;
  practiceError: string | null;
  lastPracticeRequest: PracticeRetryRequest | null;
  generatePractice: (overrides?: Partial<PracticeRetryRequest>) => Promise<void>;
  retryPractice: () => Promise<void>;
  revealPracticeAnswer: (questionId: string) => Promise<void>;
  deletePracticeSet: (practiceSetId: string) => Promise<void>;

  researchQueryInput: string;
  setResearchQueryInput: (value: string) => void;
  researchVideoQueryInput: string;
  setResearchVideoQueryInput: (value: string) => void;
  researchBusy: boolean;
  researchError: string | null;
  researchResult: ResearchSearchResult | null;
  researchBrowserState: ResearchBrowserState;
  lastResearchRequest: ResearchRetryRequest | null;
  runResearchSearch: (overrides?: Partial<ResearchRetryRequest>) => Promise<void>;
  retryResearch: () => Promise<void>;
  navigateResearchBrowser: (url: string) => Promise<void>;
  researchGoBack: () => Promise<void>;
  researchGoForward: () => Promise<void>;
  researchReload: () => Promise<void>;
  researchHideBrowser: () => Promise<void>;
  setResearchBrowserBounds: (input: ResearchBrowserBoundsInput) => Promise<void>;
  openExternalResearchLink: (url: string) => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const clampWidth = (value: number) =>
  Math.max(CHAT_PANEL_MIN_WIDTH, Math.min(CHAT_PANEL_MAX_WIDTH, value));

const toErrorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

type WorkspaceProviderProps = {
  children: ReactNode;
  activeSubjectId: string | null;
  onNotify?: (tone: 'info' | 'success' | 'warning' | 'error', message: string) => void;
};

export const WorkspaceProvider = ({
  children,
  activeSubjectId,
  onNotify,
}: WorkspaceProviderProps) => {
  const [workspace, setWorkspace] = useState<SubjectWorkspace | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [importingKind, setImportingKind] = useState<'lecture' | 'homework' | null>(
    null,
  );
  const [lastImportError, setLastImportError] = useState<string | null>(null);

  const [analysisState, setAnalysisState] = useState<ActiveAnalysisState | null>(null);
  const [analysisElapsedMs, setAnalysisElapsedMs] = useState<number>(0);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [selectedPageNumber, setSelectedPageNumber] = useState<number | null>(null);
  const [documentDetail, setDocumentDetail] = useState<SourceDocumentDetail | null>(
    null,
  );
  const [documentDetailLoading, setDocumentDetailLoading] = useState<boolean>(false);
  const [documentDetailError, setDocumentDetailError] = useState<string | null>(null);
  const [documentBytesCache, setDocumentBytesCache] = useState<DocumentBytesCache>({});

  const [selectedDivisionId, setSelectedDivisionId] = useState<string | null>(null);
  const [selectionDraft, setSelectionDraft] = useState<SelectionContext | null>(null);
  const [selectionPopupPosition, setSelectionPopupPosition] =
    useState<SelectionPopupPosition | null>(null);
  const [selectionUiMode, setSelectionUiMode] = useState<SelectionUiMode>('chip');
  const [selectedCitationKey, setSelectedCitationKey] = useState<string | null>(null);

  const [rightRailTab, setRightRailTab] = useState<WorkspaceRightTab>('chat');
  const [chatPanelWidth, setChatPanelWidthState] = useState<number>(() => {
    if (typeof window === 'undefined') return DEFAULT_CHAT_PANEL_WIDTH;
    const stored = Number(window.localStorage.getItem('studybud.chatPanelWidth'));
    if (Number.isFinite(stored) && stored > 0) {
      return clampWidth(stored);
    }
    return DEFAULT_CHAT_PANEL_WIDTH;
  });

  const [chatInput, setChatInput] = useState<string>('');
  const [chatBusy, setChatBusy] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [pendingChatPrompt, setPendingChatPrompt] = useState<string | null>(null);
  const [lastChatRequest, setLastChatRequest] = useState<ChatRetryRequest | null>(null);

  const [practiceProblemTypeId, setPracticeProblemTypeId] = useState<string | null>(
    null,
  );
  const [practiceDifficulty, setPracticeDifficulty] = useState<PracticeDifficulty>(
    'medium',
  );
  const [practiceCount, setPracticeCount] = useState<number>(5);
  const [practiceBusy, setPracticeBusy] = useState<boolean>(false);
  const [practiceError, setPracticeError] = useState<string | null>(null);
  const [lastPracticeRequest, setLastPracticeRequest] =
    useState<PracticeRetryRequest | null>(null);

  const [researchQueryInput, setResearchQueryInput] = useState<string>('');
  const [researchVideoQueryInput, setResearchVideoQueryInput] = useState<string>('');
  const [researchBusy, setResearchBusy] = useState<boolean>(false);
  const [researchError, setResearchError] = useState<string | null>(null);
  const [researchResult, setResearchResult] = useState<ResearchSearchResult | null>(
    null,
  );
  const [researchBrowserState, setResearchBrowserState] = useState<
    ResearchBrowserState
  >(initialResearchBrowserState);
  const [lastResearchRequest, setLastResearchRequest] =
    useState<ResearchRetryRequest | null>(null);

  const notifyRef = useRef(onNotify);
  notifyRef.current = onNotify;
  const notify = useCallback(
    (tone: 'info' | 'success' | 'warning' | 'error', message: string) => {
      notifyRef.current?.(tone, message);
    },
    [],
  );

  const resetWorkspaceState = useCallback(() => {
    setWorkspace(null);
    setError(null);
    setImportingKind(null);
    setLastImportError(null);
    setAnalysisState(null);
    setAnalysisElapsedMs(0);
    setAnalysisError(null);
    setSelectedDocumentId(null);
    setSelectedPageNumber(null);
    setDocumentDetail(null);
    setDocumentDetailError(null);
    setDocumentDetailLoading(false);
    setDocumentBytesCache({});
    setSelectedDivisionId(null);
    setSelectionDraft(null);
    setSelectionPopupPosition(null);
    setSelectionUiMode('chip');
    setSelectedCitationKey(null);
    setRightRailTab('chat');
    setChatInput('');
    setChatBusy(false);
    setChatError(null);
    setLastChatRequest(null);
    setPracticeProblemTypeId(null);
    setPracticeDifficulty('medium');
    setPracticeCount(5);
    setPracticeBusy(false);
    setPracticeError(null);
    setLastPracticeRequest(null);
    setResearchQueryInput('');
    setResearchVideoQueryInput('');
    setResearchBusy(false);
    setResearchError(null);
    setResearchResult(null);
    setLastResearchRequest(null);
  }, []);

  const reload = useCallback(async () => {
    const api = getStudyBudApi();
    if (!api || !activeSubjectId) {
      setWorkspace(null);
      return;
    }
    setLoading(true);
    try {
      const next = await api.getSubjectWorkspace(activeSubjectId);
      setWorkspace(next);
      setError(null);
      setSelectedDivisionId((current) => {
        if (current && next.analysis?.divisions.some((d) => d.id === current)) {
          return current;
        }
        return next.analysis?.divisions[0]?.id ?? null;
      });
      setSelectedDocumentId((current) => {
        if (current && next.documents.some((doc) => doc.id === current)) {
          return current;
        }
        return getFirstReadyDocumentId(next);
      });
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [activeSubjectId]);

  useEffect(() => {
    resetWorkspaceState();
    if (activeSubjectId) {
      reload();
    }
  }, [activeSubjectId, resetWorkspaceState, reload]);

  useEffect(() => {
    const api = getStudyBudApi();
    if (!api) {
      return undefined;
    }
    return api.onResearchBrowserState((state) => {
      setResearchBrowserState(state);
    });
  }, []);

  const selectedDivisionRef = useRef<string | null>(selectedDivisionId);
  selectedDivisionRef.current = selectedDivisionId;

  useEffect(() => {
    if (!workspace?.analysis || !selectedDivisionId) return;
    const api = getStudyBudApi();
    if (!api) return;
    const division = workspace.analysis.divisions.find(
      (d) => d.id === selectedDivisionId,
    );
    if (!division) return;
    const uniqueDocIds = Array.from(
      new Set(division.sourcePages.map((page) => page.documentId)),
    ).filter((id) => !documentBytesCacheRef.current[id]);
    if (uniqueDocIds.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const docId of uniqueDocIds) {
        if (cancelled) break;
        try {
          const bytes = await api.readDocumentData(docId);
          if (cancelled) return;
          setDocumentBytesCache((prev) =>
            prev[docId] ? prev : { ...prev, [docId]: bytes },
          );
        } catch {
          /* non-fatal, preview will show placeholder */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspace, selectedDivisionId]);

  useEffect(() => {
    if (!analysisState) {
      setAnalysisElapsedMs(0);
      return undefined;
    }
    const tick = () => setAnalysisElapsedMs(Date.now() - analysisState.startedAt);
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [analysisState]);

  const documentBytesCacheRef = useRef(documentBytesCache);
  documentBytesCacheRef.current = documentBytesCache;

  useEffect(() => {
    if (!selectedDocumentId) {
      setDocumentDetail(null);
      setDocumentDetailError(null);
      return;
    }
    const api = getStudyBudApi();
    if (!api) {
      return;
    }
    let cancelled = false;
    setDocumentDetailLoading(true);
    api
      .getDocumentDetail(selectedDocumentId)
      .then(async (detail) => {
        if (cancelled) return;
        setDocumentDetail(detail);
        setDocumentDetailError(null);
        if (!documentBytesCacheRef.current[selectedDocumentId]) {
          try {
            const bytes = await api.readDocumentData(selectedDocumentId);
            if (!cancelled) {
              setDocumentBytesCache((prev) => ({
                ...prev,
                [selectedDocumentId]: bytes,
              }));
            }
          } catch (err) {
            if (!cancelled) {
              setDocumentDetailError(toErrorMessage(err));
            }
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setDocumentDetailError(toErrorMessage(err));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDocumentDetailLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDocumentId]);

  const selectDocument = useCallback(
    (documentId: string | null, pageNumber: number | null = null) => {
      setSelectedDocumentId(documentId);
      setSelectedPageNumber(pageNumber);
    },
    [],
  );

  const setSelectedPage = useCallback((pageNumber: number | null) => {
    setSelectedPageNumber(pageNumber);
  }, []);

  const selectDivision = useCallback((divisionId: string | null) => {
    setSelectedDivisionId(divisionId);
    setPracticeProblemTypeId(null);
  }, []);

  const setSelection = useCallback(
    (
      draft: SelectionContext | null,
      position: SelectionPopupPosition | null = null,
      mode: SelectionUiMode = 'chip',
    ) => {
      setSelectionDraft(draft);
      setSelectionPopupPosition(position);
      setSelectionUiMode(mode);
    },
    [],
  );

  const clearSelection = useCallback(() => {
    setSelectionDraft(null);
    setSelectionPopupPosition(null);
    setSelectionUiMode('chip');
  }, []);

  const setChatPanelWidth = useCallback((width: number) => {
    const next = clampWidth(width);
    setChatPanelWidthState(next);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(
          'studybud.chatPanelWidth',
          String(next),
        );
      } catch {
        /* storage unavailable */
      }
    }
  }, []);

  const importDocuments = useCallback(
    async (kind: 'lecture' | 'homework') => {
      const api = getStudyBudApi();
      if (!api || !activeSubjectId) return;
      setImportingKind(kind);
      setLastImportError(null);
      try {
        const input: ImportDocumentsInput = { subjectId: activeSubjectId, kind };
        const result = await api.importDocuments(input);
        if (result.canceled) {
          return;
        }
        await reload();
        if (result.failures.length > 0) {
          const message = `${result.failures.length} file(s) failed to import.`;
          setLastImportError(message);
          notify('warning', message);
        } else if (result.importedDocuments.length > 0) {
          notify(
            'success',
            `Imported ${result.importedDocuments.length} ${kind} document${result.importedDocuments.length === 1 ? '' : 's'}.`,
          );
        }
      } catch (err) {
        const message = toErrorMessage(err);
        setLastImportError(message);
        notify('error', message);
      } finally {
        setImportingKind(null);
      }
    },
    [activeSubjectId, notify, reload],
  );

  const analyze = useCallback(async () => {
    const api = getStudyBudApi();
    if (!api || !activeSubjectId) return;
    setAnalysisError(null);
    setAnalysisState({
      provider: 'ai',
      model: 'active',
      startedAt: Date.now(),
    });
    try {
      const result = await api.analyzeSubject({ subjectId: activeSubjectId });
      setAnalysisState(null);
      setAnalysisElapsedMs(0);
      await reload();
      notify(
        'success',
        `Analysis complete in ${formatElapsed(Date.now() - (result.job.createdAt ? new Date(result.job.createdAt).getTime() : Date.now()))}.`,
      );
    } catch (err) {
      setAnalysisState(null);
      setAnalysisError(toErrorMessage(err));
      notify('error', toErrorMessage(err));
    }
  }, [activeSubjectId, notify, reload]);

  const deleteDocument = useCallback(
    async (documentId: string) => {
      const api = getStudyBudApi();
      if (!api) return;
      try {
        await api.deleteDocument(documentId);
        setDocumentBytesCache((prev) => {
          const next = { ...prev };
          delete next[documentId];
          return next;
        });
        if (selectedDocumentId === documentId) {
          setSelectedDocumentId(null);
          setSelectedPageNumber(null);
          setDocumentDetail(null);
        }
        await reload();
        notify('success', 'Document deleted.');
      } catch (err) {
        notify('error', toErrorMessage(err));
        throw err;
      }
    },
    [notify, reload, selectedDocumentId],
  );

  const askChat = useCallback(
    async (
      prompt: string,
      selectionContext: SelectionContext | null = null,
      overrideDivisionId: string | null = null,
    ) => {
      const api = getStudyBudApi();
      if (!api || !activeSubjectId) return;
      const divisionId = overrideDivisionId ?? selectedDivisionId;
      if (!divisionId) {
        const message = 'Pick a unit before asking a question.';
        setChatError(message);
        notify('warning', message);
        return;
      }
      const trimmed = prompt.trim();
      if (!trimmed) return;

      setChatBusy(true);
      setChatError(null);
      setPendingChatPrompt(trimmed);
      setLastChatRequest({ prompt: trimmed, selectionContext });
      try {
        const input: ChatAskInput = {
          subjectId: activeSubjectId,
          divisionId,
          prompt: trimmed,
          selectionContext,
        };
        const result = await api.askChat(input);
        setWorkspace((prev) =>
          prev
            ? {
                ...prev,
                chatMessages: [
                  ...prev.chatMessages,
                  result.userMessage,
                  result.assistantMessage,
                ],
              }
            : prev,
        );
        setChatInput('');
        clearSelection();
      } catch (err) {
        const message = toErrorMessage(err);
        setChatError(message);
        notify('error', message);
      } finally {
        setChatBusy(false);
        setPendingChatPrompt(null);
      }
    },
    [activeSubjectId, clearSelection, notify, selectedDivisionId],
  );

  const retryChat = useCallback(async () => {
    if (!lastChatRequest) return;
    await askChat(lastChatRequest.prompt, lastChatRequest.selectionContext);
  }, [askChat, lastChatRequest]);

  const generatePractice = useCallback(
    async (overrides: Partial<PracticeRetryRequest> = {}) => {
      const api = getStudyBudApi();
      if (!api || !activeSubjectId || !selectedDivisionId) return;
      const request: PracticeRetryRequest = {
        problemTypeId: overrides.problemTypeId ?? practiceProblemTypeId ?? '',
        difficulty: overrides.difficulty ?? practiceDifficulty,
        count: overrides.count ?? practiceCount,
      };
      if (!request.problemTypeId) {
        const message = 'Select a problem type first.';
        setPracticeError(message);
        notify('warning', message);
        return;
      }
      setPracticeBusy(true);
      setPracticeError(null);
      setLastPracticeRequest(request);
      try {
        const input: GeneratePracticeInput = {
          subjectId: activeSubjectId,
          divisionId: selectedDivisionId,
          problemTypeId: request.problemTypeId,
          difficulty: request.difficulty,
          count: request.count,
        };
        const result = await api.generatePractice(input);
        setWorkspace((prev) =>
          prev
            ? { ...prev, practiceSets: [...prev.practiceSets, result.practiceSet] }
            : prev,
        );
        notify(
          'success',
          `Generated ${result.practiceSet.questionCount} practice question${result.practiceSet.questionCount === 1 ? '' : 's'}.`,
        );
      } catch (err) {
        const message = toErrorMessage(err);
        setPracticeError(message);
        notify('error', message);
      } finally {
        setPracticeBusy(false);
      }
    },
    [
      activeSubjectId,
      notify,
      practiceCount,
      practiceDifficulty,
      practiceProblemTypeId,
      selectedDivisionId,
    ],
  );

  const retryPractice = useCallback(async () => {
    if (!lastPracticeRequest) return;
    await generatePractice(lastPracticeRequest);
  }, [generatePractice, lastPracticeRequest]);

  const revealPracticeAnswer = useCallback(
    async (questionId: string) => {
      const api = getStudyBudApi();
      if (!api) return;
      try {
        const result = await api.revealPracticeAnswer({ questionId });
        setWorkspace((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            practiceSets: prev.practiceSets.map((set) =>
              set.id === result.practiceSetId
                ? {
                    ...set,
                    questions: set.questions.map((q) =>
                      q.id === result.question.id
                        ? (result.question as PracticeQuestion)
                        : q,
                    ),
                  }
                : set,
            ),
          };
        });
      } catch (err) {
        notify('error', toErrorMessage(err));
        throw err;
      }
    },
    [notify],
  );

  const deletePracticeSet = useCallback(
    async (practiceSetId: string) => {
      const api = getStudyBudApi();
      if (!api) return;
      try {
        const input: DeletePracticeSetInput = { practiceSetId };
        await api.deletePracticeSet(input);
        setWorkspace((prev) =>
          prev
            ? {
                ...prev,
                practiceSets: prev.practiceSets.filter(
                  (set) => set.id !== practiceSetId,
                ),
              }
            : prev,
        );
      } catch (err) {
        notify('error', toErrorMessage(err));
        throw err;
      }
    },
    [notify],
  );

  const runResearchSearch = useCallback(
    async (overrides: Partial<ResearchRetryRequest> = {}) => {
      const api = getStudyBudApi();
      if (!api) return;
      const request: ResearchRetryRequest = {
        query: overrides.query ?? researchQueryInput.trim(),
        videoQuery: overrides.videoQuery ?? researchVideoQueryInput.trim(),
      };
      if (!request.query && !request.videoQuery) {
        const message = 'Enter a search query to start research.';
        setResearchError(message);
        notify('warning', message);
        return;
      }
      setResearchBusy(true);
      setResearchError(null);
      setLastResearchRequest(request);
      try {
        const input: ResearchSearchInput = {
          query: request.query,
          videoQuery: request.videoQuery || null,
        };
        const result = await api.searchResearch(input);
        setResearchResult(result);
      } catch (err) {
        const message = toErrorMessage(err);
        setResearchError(message);
        notify('error', message);
      } finally {
        setResearchBusy(false);
      }
    },
    [notify, researchQueryInput, researchVideoQueryInput],
  );

  const retryResearch = useCallback(async () => {
    if (!lastResearchRequest) return;
    await runResearchSearch(lastResearchRequest);
  }, [runResearchSearch, lastResearchRequest]);

  const navigateResearchBrowser = useCallback(
    async (url: string) => {
      const api = getStudyBudApi();
      if (!api) return;
      try {
        const state = await api.navigateResearchBrowser({ url });
        setResearchBrowserState(state);
      } catch (err) {
        notify('error', toErrorMessage(err));
      }
    },
    [notify],
  );

  const researchGoBack = useCallback(async () => {
    const api = getStudyBudApi();
    if (!api) return;
    try {
      setResearchBrowserState(await api.goBackResearchBrowser());
    } catch (err) {
      notify('error', toErrorMessage(err));
    }
  }, [notify]);

  const researchGoForward = useCallback(async () => {
    const api = getStudyBudApi();
    if (!api) return;
    try {
      setResearchBrowserState(await api.goForwardResearchBrowser());
    } catch (err) {
      notify('error', toErrorMessage(err));
    }
  }, [notify]);

  const researchReload = useCallback(async () => {
    const api = getStudyBudApi();
    if (!api) return;
    try {
      setResearchBrowserState(await api.reloadResearchBrowser());
    } catch (err) {
      notify('error', toErrorMessage(err));
    }
  }, [notify]);

  const researchHideBrowser = useCallback(async () => {
    const api = getStudyBudApi();
    if (!api) return;
    try {
      setResearchBrowserState(await api.hideResearchBrowser());
    } catch (err) {
      notify('error', toErrorMessage(err));
    }
  }, [notify]);

  const setResearchBrowserBounds = useCallback(
    async (input: ResearchBrowserBoundsInput) => {
      const api = getStudyBudApi();
      if (!api) return;
      try {
        setResearchBrowserState(await api.setResearchBrowserBounds(input));
      } catch (err) {
        notify('error', toErrorMessage(err));
      }
    },
    [notify],
  );

  const openExternalResearchLink = useCallback(
    async (url: string) => {
      const api = getStudyBudApi();
      if (!api) return;
      try {
        await api.openExternalResearchLink({ url });
      } catch (err) {
        notify('error', toErrorMessage(err));
      }
    },
    [notify],
  );

  const documentBytes = useMemo(
    () =>
      selectedDocumentId ? (documentBytesCache[selectedDocumentId] ?? null) : null,
    [documentBytesCache, selectedDocumentId],
  );

  const analysisElapsed = useMemo(
    () => formatElapsed(analysisElapsedMs),
    [analysisElapsedMs],
  );

  const updateWorkspace = useCallback(
    (
      updater: (prev: SubjectWorkspace | null) => SubjectWorkspace | null,
    ) => {
      setWorkspace((prev) => updater(prev));
    },
    [],
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      activeSubjectId,
      workspace,
      loading,
      error,
      reload,
      updateWorkspace,
      importingKind,
      lastImportError,
      importDocuments,
      analysisState,
      analysisElapsed,
      analysisError,
      analyze,
      deleteDocument,
      selectedDocumentId,
      selectedPageNumber,
      documentDetail,
      documentDetailLoading,
      documentDetailError,
      selectDocument,
      setSelectedPage,
      documentBytes,
      documentBytesCache,
      selectedDivisionId,
      selectDivision,
      selectionDraft,
      selectionPopupPosition,
      selectionUiMode,
      selectedCitationKey,
      setSelection,
      setSelectedCitationKey,
      clearSelection,
      rightRailTab,
      setRightRailTab,
      chatPanelWidth,
      setChatPanelWidth,
      chatInput,
      setChatInput,
      chatBusy,
      chatError,
      pendingChatPrompt,
      lastChatRequest,
      askChat,
      retryChat,
      practiceProblemTypeId,
      setPracticeProblemTypeId,
      practiceDifficulty,
      setPracticeDifficulty,
      practiceCount,
      setPracticeCount,
      practiceBusy,
      practiceError,
      lastPracticeRequest,
      generatePractice,
      retryPractice,
      revealPracticeAnswer,
      deletePracticeSet,
      researchQueryInput,
      setResearchQueryInput,
      researchVideoQueryInput,
      setResearchVideoQueryInput,
      researchBusy,
      researchError,
      researchResult,
      researchBrowserState,
      lastResearchRequest,
      runResearchSearch,
      retryResearch,
      navigateResearchBrowser,
      researchGoBack,
      researchGoForward,
      researchReload,
      researchHideBrowser,
      setResearchBrowserBounds,
      openExternalResearchLink,
    }),
    [
      activeSubjectId,
      workspace,
      loading,
      error,
      reload,
      updateWorkspace,
      importingKind,
      lastImportError,
      importDocuments,
      analysisState,
      analysisElapsed,
      analysisError,
      analyze,
      deleteDocument,
      selectedDocumentId,
      selectedPageNumber,
      documentDetail,
      documentDetailLoading,
      documentDetailError,
      selectDocument,
      setSelectedPage,
      documentBytes,
      documentBytesCache,
      selectedDivisionId,
      selectDivision,
      selectionDraft,
      selectionPopupPosition,
      selectionUiMode,
      selectedCitationKey,
      setSelection,
      clearSelection,
      rightRailTab,
      chatPanelWidth,
      setChatPanelWidth,
      chatInput,
      chatBusy,
      chatError,
      pendingChatPrompt,
      lastChatRequest,
      askChat,
      retryChat,
      practiceProblemTypeId,
      practiceDifficulty,
      practiceCount,
      practiceBusy,
      practiceError,
      lastPracticeRequest,
      generatePractice,
      retryPractice,
      revealPracticeAnswer,
      deletePracticeSet,
      researchQueryInput,
      researchVideoQueryInput,
      researchBusy,
      researchError,
      researchResult,
      researchBrowserState,
      lastResearchRequest,
      runResearchSearch,
      retryResearch,
      navigateResearchBrowser,
      researchGoBack,
      researchGoForward,
      researchReload,
      researchHideBrowser,
      setResearchBrowserBounds,
      openExternalResearchLink,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
  );
};

export const useWorkspace = (): WorkspaceContextValue => {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace must be used inside <WorkspaceProvider>');
  }
  return ctx;
};
