import { useEffect } from 'react';

import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { DismissibleBanner } from '../../components/DismissibleBanner';
import { Icon } from '../../components/Icon';
import { useAppState } from '../../state/AppState';
import { useSubjects } from '../../state/SubjectsState';
import { useWorkspace } from '../../state/WorkspaceState';
import { AnalysisCanvas } from './AnalysisCanvas';
import { RightRail } from './RightRail';
import { SelectionOverlay } from './SelectionOverlay';
import { WorkspaceHeader } from './WorkspaceHeader';

export const WorkspaceView = () => {
  const { activeSubject, setActive } = useSubjects();
  const { setActiveView } = useAppState();
  const {
    workspace,
    loading,
    error,
    reload,
    lastImportError,
    rightRailTab,
    researchBrowserState,
    researchHideBrowser,
  } = useWorkspace();

  useEffect(() => {
    if (
      rightRailTab !== 'research' &&
      researchBrowserState.visible
    ) {
      void researchHideBrowser();
    }
  }, [rightRailTab, researchBrowserState.visible, researchHideBrowser]);

  if (!activeSubject) {
    return (
      <main className="flex flex-1 items-center justify-center px-8 py-16">
        <div className="flex flex-col items-center gap-4 text-center">
          <Chip tone="warning">No subject selected</Chip>
          <h1 className="font-display text-title-lg text-on-surface">
            Pick a subject to open its workspace
          </h1>
          <Button
            onClick={() => setActiveView('library')}
            leadingIcon={<Icon name="book_5" size="sm" />}
          >
            Go to Library
          </Button>
        </div>
      </main>
    );
  }

  if (loading && !workspace) {
    return (
      <main className="flex flex-1 items-center justify-center px-8 py-16">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="h-10 w-10 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
          <p className="font-body text-body-sm text-on-surface-variant">
            Loading {activeSubject.name}…
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex flex-1 items-center justify-center px-8 py-16">
        <div className="flex flex-col items-center gap-3 text-center">
          <Chip tone="error">Workspace failed to load</Chip>
          <p className="max-w-md font-body text-body-sm text-on-surface-variant">
            {error}
          </p>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={() => void reload()}>
              Retry
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setActive(null);
                setActiveView('library');
              }}
            >
              Back to Library
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-0 flex-1 overflow-hidden bg-surface">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <WorkspaceHeader subjectName={activeSubject.name} />
        {lastImportError ? (
          <div className="px-8">
            <DismissibleBanner
              dismissKey={`import-error:${lastImportError}`}
              variant="error"
            >
              {lastImportError}
            </DismissibleBanner>
          </div>
        ) : null}
        <AnalysisCanvas />
      </section>
      <RightRail />
      <SelectionOverlay />
    </main>
  );
};
