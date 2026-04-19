import { useMemo } from 'react';

import { NotificationCenter } from './components/NotificationCenter';
import { ThemeToggleButton } from './components/ThemeToggleButton';
import { TopNav, type TopNavItem } from './components/TopNav';
import { TooltipProvider } from './components/Tooltip';
import { useAppState } from './state/AppState';
import { useSubjects } from './state/SubjectsState';
import { LibraryView } from './views/LibraryView';
import { SettingsView } from './views/SettingsView';
import { FlashcardDecksView } from './views/flashcards/FlashcardDecksView';
import { FlashcardStudyView } from './views/flashcards/FlashcardStudyView';
import { UnitsView } from './views/units/UnitsView';
import { WorkspaceView } from './views/workspace/WorkspaceView';

const OfflineBanner = () => (
  <div className="bg-warning/15 px-4 py-2 text-center font-body text-label-md text-on-surface">
    You are offline. Some AI and research features are disabled until you
    reconnect.
  </div>
);

export const AppShell = () => {
  const { activeView, setActiveView, isOnline } = useAppState();
  const { activeSubject } = useSubjects();

  const subjectScoped = useMemo(
    () => activeView !== 'library' && activeView !== 'settings',
    [activeView],
  );

  const navItems: TopNavItem[] = useMemo(() => {
    const items: TopNavItem[] = [
      {
        id: 'library',
        label: 'Library',
        icon: 'book_5',
        isActive: activeView === 'library',
        onClick: () => setActiveView('library'),
      },
    ];

    if (subjectScoped && activeSubject) {
      items.push(
        {
          id: 'workspace',
          label: 'Workspace',
          icon: 'edit_note',
          isActive: activeView === 'workspace',
          onClick: () => setActiveView('workspace'),
        },
        {
          id: 'units',
          label: 'Units',
          icon: 'dashboard',
          isActive: activeView === 'units',
          onClick: () => setActiveView('units'),
        },
        {
          id: 'flashcards',
          label: 'Flashcards',
          icon: 'style',
          isActive:
            activeView === 'flashcard-decks' ||
            activeView === 'flashcard-study',
          onClick: () => setActiveView('flashcard-decks'),
        },
      );
    }

    items.push({
      id: 'settings',
      label: 'Settings',
      icon: 'settings',
      isActive: activeView === 'settings',
      onClick: () => setActiveView('settings'),
    });

    return items;
  }, [activeView, activeSubject, setActiveView, subjectScoped]);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex h-screen flex-col overflow-hidden bg-surface text-on-surface">
        {!isOnline && <OfflineBanner />}
        <TopNav
          items={navItems}
          subjectName={subjectScoped ? activeSubject?.name ?? null : null}
          trailing={<ThemeToggleButton />}
        />
        <div className="flex min-h-0 flex-1 flex-col">
          {activeView === 'library' && <LibraryView />}
          {activeView === 'workspace' && <WorkspaceView />}
          {activeView === 'units' && <UnitsView />}
          {activeView === 'flashcard-decks' && <FlashcardDecksView />}
          {activeView === 'flashcard-study' && <FlashcardStudyView />}
          {activeView === 'settings' && <SettingsView />}
        </div>
        <NotificationCenter />
      </div>
    </TooltipProvider>
  );
};
