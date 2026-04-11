import { FormEvent, Suspense, lazy, useEffect, useRef, useState } from 'react';

import type {
  AnalyzeSubjectResult,
  AiProvider,
  AppInfo,
  ChatAskResult,
  CitationRef,
  DocumentKind,
  GeneratePracticeResult,
  PracticeDifficulty,
  PracticeQuestion,
  PracticeSet,
  SelectionContext,
  SettingsState,
  SourceDocumentDetail,
  SubjectAnalysisDivision,
  SubjectSummary,
  SubjectWorkspace,
} from '../shared/ipc';
import { CitationPreviewCard } from './CitationPreviewCard';
import { DivisionChatPanel } from './DivisionChatPanel';
import { PracticePanel } from './PracticePanel';
import { SelectionAskChip } from './SelectionAskChip';
import { SelectionQuestionPopup } from './SelectionQuestionPopup';

const PdfViewer = lazy(async () => {
  const module = await import('./PdfViewer');
  return {
    default: module.PdfViewer,
  };
});

type View = 'library' | 'workspace' | 'settings';

type ActiveAnalysisState = {
  provider: string;
  model: string;
  startedAt: number;
};

type SelectionDraft = SelectionContext;
type SelectionPopupPosition = {
  x: number;
  y: number;
};
type SelectionUiMode = 'chip' | 'popup';

const initialSettings: SettingsState = {
  aiProvider: 'openai',
  openAiApiKeyConfigured: false,
  encryptionAvailable: false,
  ollamaBaseUrl: 'http://localhost:11434',
  ollamaModel: 'qwen3:8b',
  dataPath: '',
  defaultDataPath: '',
  usingCustomDataPath: false,
};

const formatDate = (isoString: string): string => {
  return new Date(isoString).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatElapsed = (elapsedMs: number): string => {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return minutes > 0
    ? `${minutes}m ${String(seconds).padStart(2, '0')}s`
    : `${seconds}s`;
};

const getCitationKey = (citation: CitationRef): string => {
  return `${citation.documentId}:${citation.pageId}`;
};

const escapeRegExp = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const renderHighlightedText = (
  text: string,
  highlight: string | null,
) => {
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
    expression.test(part) ? <mark key={`${part}:${index}`}>{part}</mark> : part,
  );
};

const buildCitationTextSnippet = (
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

const getFirstReadyDocumentId = (
  workspace: SubjectWorkspace,
): string | null => {
  const readyDocument = workspace.documents.find(
    (document) => document.importStatus === 'ready',
  );

  return readyDocument?.id ?? workspace.documents[0]?.id ?? null;
};

const getStudyBudApi = () => {
  return window.studybud ?? null;
};

const hasMeaningfulSelection = (): boolean => {
  return (window.getSelection()?.toString().trim().length ?? 0) > 0;
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
  const [activeAnalysis, setActiveAnalysis] = useState<ActiveAnalysisState | null>(
    null,
  );
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
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
  const [busy, setBusy] = useState(false);
  const [pendingChatPrompt, setPendingChatPrompt] = useState<string | null>(null);
  const pendingPageSelectionRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(
    studybud
      ? null
      : 'StudyBud must be launched inside the Electron desktop app. Run `npm start` or open the packaged desktop build instead of opening the renderer in a browser tab.',
  );
  const currentDivision =
    workspace?.analysis?.divisions.find(
      (division) => division.id === selectedDivisionId,
    ) ?? workspace?.analysis?.divisions[0] ?? null;

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
    setAiProviderInput(settings.aiProvider);
    setOllamaBaseUrlInput(settings.ollamaBaseUrl);
    setOllamaModelInput(settings.ollamaModel);
  }, [settings.aiProvider, settings.ollamaBaseUrl, settings.ollamaModel]);

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

  const reloadDashboardState = async () => {
    if (!studybud) {
      return;
    }

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
    setSelectionDraft(null);
    setSelectionUiMode('chip');
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
    const divisions = workspace?.analysis?.divisions ?? [];

    if (divisions.length === 0) {
      setSelectedDivisionId(null);
      return;
    }

    setSelectedDivisionId((previous) => {
      if (previous && divisions.some((division) => division.id === previous)) {
        return previous;
      }

      return divisions[0]?.id ?? null;
    });
  }, [workspace?.analysis]);

  useEffect(() => {
    setChatInput('');
    setSelectionDraft(null);
    setSelectionQuestionInput('');
    setSelectionPopupPosition(null);
    setSelectionUiMode('chip');
  }, [selectedDivisionId]);

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

  const refreshSubjectWorkspace = async (subjectId: string, preferredDocumentId?: string) => {
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
      setActiveView('workspace');
      setSelectedCitationKey(null);

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

  const openCitationSourcePage = (citation: CitationRef) => {
    pendingPageSelectionRef.current = citation.pageNumber;
    setSelectedCitationKey(getCitationKey(citation));
    setSelectedDocumentId(citation.documentId);
    setSelectedPageNumber(citation.pageNumber);
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
      sourcePageIds: currentDivision.sourcePages.map((page) => page.pageId),
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

    if (division.sourcePages.length > 0) {
      openCitationSourcePage(division.sourcePages[0]);
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

      if (result.failures.length > 0 && result.job) {
        setError(result.job.message);
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
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not analyze subject materials.',
      );
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

  const handleGeneratePractice = async () => {
    if (
      !studybud ||
      !workspace ||
      !currentDivision ||
      !selectedPracticeProblemTypeId ||
      practiceCount < 1
    ) {
      return;
    }

    setPracticeBusy(true);
    setError(null);

    try {
      const result: GeneratePracticeResult = await studybud.generatePractice({
        subjectId: workspace.subject.id,
        divisionId: currentDivision.id,
        problemTypeId: selectedPracticeProblemTypeId,
        difficulty: practiceDifficulty,
        count: practiceCount,
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
          : 'Could not generate a practice set.',
      );
    } finally {
      setPracticeBusy(false);
    }
  };

  const handleRevealPracticeAnswer = async (questionId: string) => {
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
          : 'Could not reveal the answer key.',
      );
    } finally {
      setPracticeBusy(false);
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

    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      return;
    }

    setChatBusy(true);
    setPendingChatPrompt(trimmedPrompt);
    setError(null);

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
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not send the division chat request.',
      );
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
      'Explain how to approach this practice question and which division concepts it is testing.',
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
        sourcePageIds: currentDivision.sourcePages.map((page) => page.pageId),
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
        sourcePageIds: currentDivision.sourcePages.map((page) => page.pageId),
      },
    );
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
              homework PDFs.
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
            <div className="warning-banner">
              This device does not currently expose secure OS key storage, so
              StudyBud will keep the OpenAI API key in memory only for this app session.
              It will work until you close the app, but it will not be saved to disk.
            </div>
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
      ) ?? workspace.analysis?.divisions[0] ?? null;
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
    const divisionPracticeSets = (workspace.practiceSets ?? []).filter(
      (practiceSet) => practiceSet.divisionId === selectedDivision?.id,
    );
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
              preview their pages before AI ingestion.
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

        <div className="workspace-grid">
          <aside className="workspace-sidebar">
            <section className="sidebar-section">
              <div className="sidebar-section-title">
                <h3>Divisions</h3>
                <span>{workspace.analysis?.divisions.length ?? 0}</span>
              </div>

              {!workspace.analysis || workspace.analysis.divisions.length === 0 ? (
                <div className="empty-state">
                  Run analysis to create study divisions for this subject.
                </div>
              ) : (
                <div className="division-nav-list">
                  {workspace.analysis.divisions.map((division) => (
                    <button
                      key={division.id}
                      type="button"
                      className={`division-nav-button${
                        selectedDivision?.id === division.id ? ' active' : ''
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
              )}
            </section>

            <section className="sidebar-section">
              <div className="sidebar-section-title">
                <h3>Documents</h3>
                <span>{workspace.documents.length}</span>
              </div>

              {workspace.documents.length === 0 ? (
                <div className="empty-state">
                  No PDFs imported yet. Use the import buttons above to add
                  lecture or homework documents.
                </div>
              ) : (
                <div className="document-list">
                  {workspace.documents.map((document) => (
                    <article
                      key={document.id}
                      className={`document-card-shell${selectedDocumentId === document.id ? ' active' : ''}`}
                    >
                      <button
                        type="button"
                        className="document-card"
                        onClick={() => {
                          pendingPageSelectionRef.current = null;
                          setSelectedDocumentId(document.id);
                        }}
                      >
                        <div className="document-card-header">
                          <strong>{document.originalFileName}</strong>
                          <span className={`pill pill-${document.kind}`}>
                            {document.kind}
                          </span>
                        </div>
                        <span className="document-card-meta">
                          {document.importStatus === 'ready'
                            ? `${document.pageCount} pages`
                            : 'Import failed'}
                        </span>
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
              )}
            </section>
          </aside>

          <section className="workspace-main">
            <section className="analysis-panel">
              <div className="sidebar-section-title">
                <h3>Division Workspace</h3>
                <span>{workspace.analysis?.divisions.length ?? 0}</span>
              </div>

              {workspace.analysisJobs.length > 0 ? (
                <div className="analysis-job-banner">
                  <div className="analysis-job-copy">
                    <strong>{workspace.analysisJobs[0]?.message}</strong>
                    <div className="analysis-job-meta">
                      <span>{workspace.analysisJobs[0]?.provider}</span>
                      <span>{workspace.analysisJobs[0]?.model}</span>
                      <span>
                        Started {formatDate(workspace.analysisJobs[0]?.createdAt ?? new Date().toISOString())}
                      </span>
                    </div>
                  </div>
                  <span className={`pill pill-status-${workspace.analysisJobs[0]?.status ?? 'running'}`}>
                    {workspace.analysisJobs[0]?.status ?? 'running'}
                  </span>
                </div>
              ) : null}

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

              {!analysisReady ? (
                <div className="empty-state">
                  {settings.aiProvider === 'ollama'
                    ? 'Set an Ollama model in Settings before running subject analysis.'
                    : 'Add your OpenAI API key in Settings before running subject analysis.'}
                </div>
              ) : !workspace.analysis ? (
                <div className="empty-state">
                  Analyze this subject to extract divisions, key concepts, and problem types from the imported lecture and homework PDFs.
                </div>
              ) : !selectedDivision ? (
                <div className="empty-state">
                  Select a division from the left to inspect its summary and cited source pages.
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
                            No clear problem types were detected for this division yet.
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
                    onRevealAnswer={(questionId) => void handleRevealPracticeAnswer(questionId)}
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
                        No cited pages were available for this division.
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
                            These pages did not clearly fit a division in the latest pass.
                          </p>
                        </div>
                        <span className="analysis-count-pill">
                          {workspace.analysis.unassignedPages.length}
                        </span>
                      </div>

                      <div className="analysis-source-list">
                        {workspace.analysis.unassignedPages.map((page) => (
                          <span
                            key={page.id}
                            className="analysis-unassigned-row"
                            onMouseUp={() => handleUnassignedPageSelection(page)}
                          >
                            {page.documentName} • page {page.pageNumber}
                            {page.reason ? ` - ${page.reason}` : ''}
                          </span>
                        ))}
                      </div>
                    </article>
                  ) : null}
                </div>
              )}
            </section>

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
                      imported {formatDate(documentDetail.updatedAt)}
                    </p>
                  </div>
                  <span className="pill pill-ready">ready</span>
                </div>

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
                    <span>{documentDetail.pages.length}</span>
                  </div>

                  <div className="page-text-list">
                    {documentDetail.pages.map((page) => (
                      <button
                        key={page.id}
                        type="button"
                        className={`page-text-card${selectedPageNumber === page.pageNumber ? ' active' : ''}`}
                        onClick={() => setSelectedPageNumber(page.pageNumber)}
                      >
                        <strong>Page {page.pageNumber}</strong>
                        <p onMouseUp={() => handlePageTextSelection(page)}>
                          {page.pageNumber === selectedPageNumber &&
                          selectedCitation &&
                          selectedCitation.documentId === documentDetail.id &&
                          selectedCitation.pageNumber === page.pageNumber
                            ? renderHighlightedText(
                                focusedPageSnippet || page.previewText || 'No text extracted on this page.',
                                selectedCitation.highlightText,
                              )
                            : page.previewText || 'No text extracted on this page.'}
                        </p>
                      </button>
                    ))}
                  </div>
                </section>
              </>
            )}
          </section>

          <aside className="workspace-chat">
            <DivisionChatPanel
              messages={divisionChatMessages}
              chatInput={chatInput}
              onChatInputChange={setChatInput}
              onSubmit={() => void handleAskChat()}
              chatBusy={chatBusy}
                    pendingPrompt={pendingChatPrompt}
                    onUseFollowup={(value) => {
                      void submitChatPrompt(value, null);
                    }}
                    onOpenCitation={openCitationSourcePage}
                    onSelectCitationText={handleCitationEvidenceSelection}
                    activeCitationKey={selectedCitationKey}
                    documentBytesCache={documentBytesCache}
                  />
          </aside>
        </div>
      </section>
    );
  };

  return (
    <main className={`app-shell${activeView === 'workspace' ? ' workspace-mode' : ''}`}>
      {activeView !== 'workspace' ? (
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
              onClick={() => setActiveView('workspace')}
              type="button"
              disabled={!workspace}
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
        {error ? <div className="error-banner">{error}</div> : null}

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
            onQuestionChange={setSelectionQuestionInput}
            onSubmit={() => void handleAskSelectionQuestion()}
            onCancel={closeSelectionPopup}
          />
        ) : null}

        {activeView === 'library'
          ? renderLibrary()
          : activeView === 'settings'
            ? renderSettings()
            : renderWorkspace()}
      </section>
    </main>
  );
};
