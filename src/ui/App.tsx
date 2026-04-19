import { useEffect, useState } from 'react';

import { AppShell } from './AppShell';
import { StateRoot } from './state/StateRoot';
import { ThemeProvider } from './theme/ThemeProvider';
import { DesignSystemPreview } from './views/_dev/DesignSystemPreview';

const useHashView = (): string => {
  const [view, setView] = useState<string>(() => {
    if (typeof window === 'undefined') {
      return '';
    }
    const params = new URLSearchParams(window.location.search);
    return params.get('view') ?? '';
  });

  useEffect(() => {
    const onNavigate = () => {
      const params = new URLSearchParams(window.location.search);
      setView(params.get('view') ?? '');
    };
    window.addEventListener('popstate', onNavigate);
    return () => window.removeEventListener('popstate', onNavigate);
  }, []);

  return view;
};

export const App = () => {
  const view = useHashView();
  if (view === 'ds') {
    return (
      <ThemeProvider>
        <DesignSystemPreview />
      </ThemeProvider>
    );
  }
  return (
    <StateRoot>
      <AppShell />
    </StateRoot>
  );
};
