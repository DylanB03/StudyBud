import { useCallback, type ReactNode } from 'react';

import { ThemeProvider } from '../theme/ThemeProvider';

import { AppStateProvider, useAppState } from './AppState';
import { FlashcardsProvider } from './FlashcardsState';
import { SettingsProvider } from './SettingsState';
import { SubjectsProvider, useSubjects } from './SubjectsState';
import { WorkspaceProvider } from './WorkspaceState';

const SubjectScope = ({ children }: { children: ReactNode }) => {
  const { activeSubjectId } = useSubjects();
  const { pushNotification } = useAppState();

  const onNotify = useCallback(
    (tone: 'info' | 'success' | 'warning' | 'error', message: string) => {
      pushNotification(tone, message);
    },
    [pushNotification],
  );

  return (
    <WorkspaceProvider activeSubjectId={activeSubjectId} onNotify={onNotify}>
      <FlashcardsProvider onNotify={onNotify}>{children}</FlashcardsProvider>
    </WorkspaceProvider>
  );
};

/**
 * Mount every non-theme provider in the correct order. Split out so the
 * App component stays declarative.
 */
export const StateRoot = ({ children }: { children: ReactNode }) => (
  <ThemeProvider>
    <AppStateProvider>
      <SettingsProvider>
        <SubjectsProvider>
          <SubjectScope>{children}</SubjectScope>
        </SubjectsProvider>
      </SettingsProvider>
    </AppStateProvider>
  </ThemeProvider>
);
