import { FormEvent, Suspense, lazy, useEffect, useState } from 'react';

import type {
  AnalyzeSubjectResult,
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

const initialSettings: SettingsState = {
  openAiApiKeyConfigured: false,
  encryptionAvailable: false,
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
  const [apiKeyInput, setApiKeyInput] = useState('');
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

  const handleSaveApiKey = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!studybud) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const nextSettings = await studybud.saveSettings({
        openAiApiKey: apiKeyInput,
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

    setBusy(true);
    setError(null);

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
    ? 'Secure storage unavailable'
    : settings.openAiApiKeyConfigured
      ? 'API key configured'
      : 'API key missing';

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
          <h2>AI Settings</h2>
          <p>
            StudyBud uses your API key for model calls. The key is encrypted in
            local storage when OS encryption is available.
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

        {!settings.encryptionAvailable ? (
          <div className="warning-banner">
            This device does not currently expose secure OS key storage, so
            StudyBud will not save API keys until that becomes available.
          </div>
        ) : null}

        <form className="stack-form" onSubmit={handleSaveApiKey}>
          <label htmlFor="open-ai-key">OpenAI API Key</label>
          <input
            id="open-ai-key"
            type="password"
            value={apiKeyInput}
            onChange={(event) => setApiKeyInput(event.target.value)}
            placeholder="sk-..."
            autoComplete="off"
            disabled={busy}
          />
          <div className="form-actions">
            <button
              type="submit"
              disabled={
                busy ||
                apiKeyInput.trim().length === 0 ||
                !settings.encryptionAvailable
              }
            >
              Save Key
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
                !settings.openAiApiKeyConfigured ||
                workspace.documents.every((document) => document.importStatus !== 'ready')
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
                  <strong>{workspace.analysisJobs[0]?.message}</strong>
                  <span className={`pill pill-status-${workspace.analysisJobs[0]?.status ?? 'running'}`}>
                    {workspace.analysisJobs[0]?.status ?? 'running'}
                  </span>
                </div>
              ) : null}

              {!settings.openAiApiKeyConfigured ? (
                <div className="empty-state">
                  Add your OpenAI API key in Settings before running subject analysis.
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
        <p className="subtitle">Phase 1 import pipeline</p>
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
        <header className="status-bar">
          <div>
            <span className="label">Version</span>
            <strong>{appInfo?.version ?? 'Loading...'}</strong>
          </div>
          <div>
            <span className="label">Subjects</span>
            <strong>{subjects.length}</strong>
          </div>
          <div>
            <span className="label">Data Path</span>
            <code>{appInfo?.dataPath ?? 'Loading...'}</code>
          </div>
        </header>

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
