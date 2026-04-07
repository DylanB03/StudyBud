import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import type { AppInfo, SettingsState, SubjectSummary } from '../shared/ipc';

type View = 'library' | 'settings';

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

export const App = () => {
  const [activeView, setActiveView] = useState<View>('library');
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [settings, setSettings] = useState<SettingsState>(initialSettings);
  const [subjects, setSubjects] = useState<SubjectSummary[]>([]);
  const [subjectName, setSubjectName] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const [nextInfo, nextSettings, nextSubjects] = await Promise.all([
        window.studybud.getAppInfo(),
        window.studybud.getSettings(),
        window.studybud.listSubjects(),
      ]);

      setAppInfo(nextInfo);
      setSettings(nextSettings);
      setSubjects(nextSubjects);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not load application data.';
      setError(message);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const handleCreateSubject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = subjectName.trim();

    if (!trimmed) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const created = await window.studybud.createSubject({ name: trimmed });
      setSubjects((previous) => [created, ...previous]);
      setSubjectName('');
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not create subject.';
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveApiKey = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setBusy(true);
    setError(null);
    try {
      const nextSettings = await window.studybud.saveSettings({
        openAiApiKey: apiKeyInput,
      });
      setSettings(nextSettings);
      setApiKeyInput('');
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not save settings.';
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const handleClearApiKey = async () => {
    setBusy(true);
    setError(null);
    try {
      const nextSettings = await window.studybud.saveSettings({
        openAiApiKey: '',
      });
      setSettings(nextSettings);
      setApiKeyInput('');
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not clear API key.';
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const settingsBadge = useMemo(() => {
    if (settings.openAiApiKeyConfigured) {
      return 'API key configured';
    }
    return 'API key missing';
  }, [settings.openAiApiKeyConfigured]);

  const renderLibrary = () => {
    return (
      <section className="panel">
        <header className="panel-header">
          <h2>Subject Library</h2>
          <p>
            Build your first class workspace. PDFs and generated content will be
            stored under your app data directory.
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
              <article key={subject.id} className="subject-card">
                <div>
                  <h3>{subject.name}</h3>
                  <p>Created {formatDate(subject.createdAt)}</p>
                </div>
                <span className="subject-meta">
                  Updated {formatDate(subject.updatedAt)}
                </span>
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
            <button type="submit" disabled={busy || apiKeyInput.trim().length === 0}>
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

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <h1>StudyBud</h1>
        <p className="subtitle">Phase 0 foundation</p>
        <nav className="nav-list">
          <button
            className={activeView === 'library' ? 'active' : ''}
            onClick={() => setActiveView('library')}
            type="button"
          >
            Library
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

        {activeView === 'library' ? renderLibrary() : renderSettings()}
      </section>
    </main>
  );
};
