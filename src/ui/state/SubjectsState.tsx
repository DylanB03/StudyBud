import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { CreateSubjectInput, SubjectSummary } from '../../shared/ipc';

import {
  LAST_WORKSPACE_SUBJECT_STORAGE_KEY,
  getStudyBudApi,
} from './helpers';

type SubjectsContextValue = {
  subjects: SubjectSummary[];
  activeSubjectId: string | null;
  activeSubject: SubjectSummary | null;
  busy: boolean;
  error: string | null;
  loaded: boolean;
  load: () => Promise<void>;
  create: (input: CreateSubjectInput) => Promise<SubjectSummary>;
  remove: (subjectId: string) => Promise<void>;
  setActive: (subjectId: string | null) => void;
};

const SubjectsContext = createContext<SubjectsContextValue | null>(null);

const readStoredActiveSubjectId = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage.getItem(LAST_WORKSPACE_SUBJECT_STORAGE_KEY);
  } catch {
    return null;
  }
};

const writeStoredActiveSubjectId = (value: string | null): void => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    if (value) {
      window.localStorage.setItem(LAST_WORKSPACE_SUBJECT_STORAGE_KEY, value);
    } else {
      window.localStorage.removeItem(LAST_WORKSPACE_SUBJECT_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
};

export const SubjectsProvider = ({ children }: { children: ReactNode }) => {
  const [subjects, setSubjects] = useState<SubjectSummary[]>([]);
  const [activeSubjectId, setActiveSubjectIdState] = useState<string | null>(
    readStoredActiveSubjectId,
  );
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<boolean>(false);

  const setActive = useCallback((subjectId: string | null) => {
    setActiveSubjectIdState(subjectId);
    writeStoredActiveSubjectId(subjectId);
  }, []);

  const load = useCallback(async () => {
    const api = getStudyBudApi();
    if (!api) {
      setError('StudyBud runtime is not available.');
      return;
    }
    setBusy(true);
    try {
      const next = await api.listSubjects();
      setSubjects(next);
      setError(null);
      setLoaded(true);
      setActiveSubjectIdState((current) => {
        if (current && next.some((subject) => subject.id === current)) {
          return current;
        }
        return current;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, []);

  const create = useCallback(async (input: CreateSubjectInput) => {
    const api = getStudyBudApi();
    if (!api) {
      throw new Error('StudyBud runtime is not available.');
    }
    setBusy(true);
    try {
      const subject = await api.createSubject(input);
      setSubjects((prev) => [...prev, subject].sort((a, b) => a.name.localeCompare(b.name)));
      setError(null);
      return subject;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw err;
    } finally {
      setBusy(false);
    }
  }, []);

  const remove = useCallback(
    async (subjectId: string) => {
      const api = getStudyBudApi();
      if (!api) {
        throw new Error('StudyBud runtime is not available.');
      }
      setBusy(true);
      try {
        await api.deleteSubject(subjectId);
        setSubjects((prev) => prev.filter((subject) => subject.id !== subjectId));
        if (activeSubjectId === subjectId) {
          setActive(null);
        }
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [activeSubjectId, setActive],
  );

  useEffect(() => {
    load();
  }, [load]);

  const activeSubject = useMemo(
    () => subjects.find((subject) => subject.id === activeSubjectId) ?? null,
    [subjects, activeSubjectId],
  );

  const value = useMemo<SubjectsContextValue>(
    () => ({
      subjects,
      activeSubjectId,
      activeSubject,
      busy,
      error,
      loaded,
      load,
      create,
      remove,
      setActive,
    }),
    [
      subjects,
      activeSubjectId,
      activeSubject,
      busy,
      error,
      loaded,
      load,
      create,
      remove,
      setActive,
    ],
  );

  return (
    <SubjectsContext.Provider value={value}>{children}</SubjectsContext.Provider>
  );
};

export const useSubjects = (): SubjectsContextValue => {
  const ctx = useContext(SubjectsContext);
  if (!ctx) {
    throw new Error('useSubjects must be used inside <SubjectsProvider>');
  }
  return ctx;
};
