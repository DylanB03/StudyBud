import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { SaveSettingsInput, SettingsState } from '../../shared/ipc';

import { getStudyBudApi, initialSettings } from './helpers';

type SettingsContextValue = {
  settings: SettingsState;
  busy: boolean;
  error: string | null;
  loaded: boolean;
  load: () => Promise<void>;
  save: (input: SaveSettingsInput) => Promise<void>;
  choosePath: () => Promise<void>;
  resetPath: () => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<SettingsState>(initialSettings);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<boolean>(false);

  const load = useCallback(async () => {
    const api = getStudyBudApi();
    if (!api) {
      setError('StudyBud runtime is not available.');
      return;
    }
    setBusy(true);
    try {
      const next = await api.getSettings();
      setSettings(next);
      setError(null);
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, []);

  const save = useCallback(async (input: SaveSettingsInput) => {
    const api = getStudyBudApi();
    if (!api) {
      setError('StudyBud runtime is not available.');
      return;
    }
    setBusy(true);
    try {
      const next = await api.saveSettings(input);
      setSettings(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      setBusy(false);
    }
  }, []);

  const choosePath = useCallback(async () => {
    const api = getStudyBudApi();
    if (!api) {
      setError('StudyBud runtime is not available.');
      return;
    }
    setBusy(true);
    try {
      const next = await api.chooseDataPath();
      if (next) {
        setSettings(next);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      setBusy(false);
    }
  }, []);

  const resetPath = useCallback(async () => {
    const api = getStudyBudApi();
    if (!api) {
      setError('StudyBud runtime is not available.');
      return;
    }
    setBusy(true);
    try {
      const next = await api.resetDataPath();
      setSettings(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const value = useMemo<SettingsContextValue>(
    () => ({ settings, busy, error, loaded, load, save, choosePath, resetPath }),
    [settings, busy, error, loaded, load, save, choosePath, resetPath],
  );

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextValue => {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used inside <SettingsProvider>');
  }
  return ctx;
};
