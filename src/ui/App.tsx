import { FormEvent, Suspense, lazy, useEffect, useState } from 'react';

import type {
  AnalyzeSubjectResult,
  AiProvider,
  AppInfo,
  DocumentKind,
  SettingsState,
  SourceDocumentDetail,
  SubjectAnalysisDivision,
  SubjectSummary,
  SubjectWorkspace,
} from '../shared/ipc';

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

export const App = () => {
  const studybud = getStudyBudApi();
  const [activeView, setActiveView] = useState<View>('library');
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [settings, setSettings] = useState<SettingsState>(initialSettings);
  const [subjects, setSubjects] = useState<SubjectSummary[]>([]);
  const [workspace, setWorkspace] = useState<SubjectWorkspace | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [selectedPageNumber, setSelectedPageNumber] = useState(1);
  const [documentDetail, setDocumentDetail] = useState<SourceDocumentDetail | null>(
    null,
  );
  const [documentBytes, setDocumentBytes] = useState<Uint8Array | null>(null);
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
  const [analysisElapsedMs, setAnalysisElapsedMs] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    studybud
      ? null
      : 'StudyBud must be launched inside the Electron desktop app. Run `npm start` or open the packaged desktop build instead of opening the renderer in a browser tab.',
  );

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
    setSelectedDocumentId(null);
    setDocumentDetail(null);
    setDocumentBytes(null);
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
            ? await studybud.readDocumentData(selectedDocumentId)
            : null;

        if (cancelled) {
          return;
        }

        setDocumentDetail(nextDetail);
        setDocumentBytes(nextBytes);
        setSelectedPageNumber(nextDetail.pages[0]?.pageNumber ?? 1);
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
  }, [selectedDocumentId, studybud]);

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

  const openAnalysisSourcePage = (division: SubjectAnalysisDivision, pageId: string) => {
    const sourcePage = division.sourcePages.find((page) => page.pageId === pageId);
    if (!sourcePage) {
      return;
    }

    setSelectedDocumentId(sourcePage.documentId);
    setSelectedPageNumber(sourcePage.pageNumber);
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
      }

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
              <button
                key={subject.id}
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
                        onClick={() => setSelectedDocumentId(document.id)}
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
                <h3>Subject Analysis</h3>
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
              ) : (
                <div className="analysis-division-list">
                  {workspace.analysis.divisions.map((division) => (
                    <article key={division.id} className="analysis-division-card">
                      <div className="analysis-division-header">
                        <div>
                          <h4>{division.title}</h4>
                          <p>{division.summary}</p>
                        </div>
                        <span className="analysis-count-pill">
                          {division.problemTypes.length} problem
                          {division.problemTypes.length === 1 ? '' : 's'}
                        </span>
                      </div>

                      <div className="analysis-block">
                        <span className="label">Key Concepts</span>
                        <div className="analysis-chip-list">
                          {division.keyConcepts.map((concept) => (
                            <span key={`${division.id}:${concept}`} className="analysis-chip">
                              {concept}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="analysis-block">
                        <span className="label">Problem Types</span>
                        <div className="analysis-problem-list">
                          {division.problemTypes.length === 0 ? (
                            <p className="analysis-muted">
                              No clear problem types were detected for this division yet.
                            </p>
                          ) : (
                            division.problemTypes.map((problemType) => (
                              <article
                                key={problemType.id}
                                className="analysis-problem-card"
                              >
                                <strong>{problemType.title}</strong>
                                <p>{problemType.description}</p>
                              </article>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="analysis-block">
                        <span className="label">Source Pages</span>
                        <div className="analysis-source-list">
                          {division.sourcePages.map((page) => (
                            <button
                              key={page.pageId}
                              type="button"
                              className="analysis-source-button"
                              onClick={() => openAnalysisSourcePage(division, page.pageId)}
                            >
                              {page.documentName} • page {page.pageNumber}
                            </button>
                          ))}
                        </div>
                      </div>
                    </article>
                  ))}

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
                          <span key={page.id} className="analysis-unassigned-row">
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
                        <p>{page.previewText || 'No text extracted on this page.'}</p>
                      </button>
                    ))}
                  </div>
                </section>
              </>
            )}
          </section>
        </div>
      </section>
    );
  };

  return (
    <main className="app-shell">
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
            className={activeView === 'workspace' ? 'active' : ''}
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

      <section className="content">
        {error ? <div className="error-banner">{error}</div> : null}

        {activeView === 'library'
          ? renderLibrary()
          : activeView === 'settings'
            ? renderSettings()
            : renderWorkspace()}
      </section>
    </main>
  );
};
