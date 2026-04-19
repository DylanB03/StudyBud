import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type {
  CreateFlashcardDeckInput,
  FlashcardDeck,
  GenerateFlashcardsInput,
} from '../../shared/ipc';

import { getStudyBudApi } from './helpers';
import { useWorkspace } from './WorkspaceState';

type FlashcardsContextValue = {
  decks: FlashcardDeck[];
  generating: boolean;
  creating: boolean;
  error: string | null;
  studyingDeckId: string | null;
  studyingDeck: FlashcardDeck | null;
  currentCardIndex: number;
  flipped: boolean;
  isFullscreen: boolean;
  generate: (input: GenerateFlashcardsInput) => Promise<FlashcardDeck>;
  createManually: (input: CreateFlashcardDeckInput) => Promise<FlashcardDeck>;
  deleteDeck: (flashcardDeckId: string) => Promise<void>;
  beginStudy: (deckId: string) => void;
  exitStudy: () => void;
  nextCard: () => void;
  prevCard: () => void;
  setCardIndex: (index: number) => void;
  flipCard: () => void;
  setFlipped: (flipped: boolean) => void;
  toggleFullscreen: () => void;
};

const FlashcardsContext = createContext<FlashcardsContextValue | null>(null);

type FlashcardsProviderProps = {
  children: ReactNode;
  onNotify?: (tone: 'info' | 'success' | 'warning' | 'error', message: string) => void;
};

const toErrorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

export const FlashcardsProvider = ({ children, onNotify }: FlashcardsProviderProps) => {
  const { workspace, updateWorkspace } = useWorkspace();

  const [generating, setGenerating] = useState<boolean>(false);
  const [creating, setCreating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [studyingDeckId, setStudyingDeckId] = useState<string | null>(null);
  const [currentCardIndex, setCurrentCardIndex] = useState<number>(0);
  const [flipped, setFlipped] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const decks = useMemo(() => workspace?.flashcardDecks ?? [], [workspace]);
  const studyingDeck = useMemo(
    () => decks.find((deck) => deck.id === studyingDeckId) ?? null,
    [decks, studyingDeckId],
  );

  const notify = useCallback(
    (tone: 'info' | 'success' | 'warning' | 'error', message: string) => {
      onNotify?.(tone, message);
    },
    [onNotify],
  );

  const generate = useCallback(
    async (input: GenerateFlashcardsInput) => {
      const api = getStudyBudApi();
      if (!api) throw new Error('StudyBud runtime is not available.');
      setGenerating(true);
      setError(null);
      try {
        const result = await api.generateFlashcards(input);
        updateWorkspace((prev) =>
          prev
            ? {
                ...prev,
                flashcardDecks: [...prev.flashcardDecks, result.flashcardDeck],
              }
            : prev,
        );
        notify('success', `Generated deck "${result.flashcardDeck.title}".`);
        return result.flashcardDeck;
      } catch (err) {
        const message = toErrorMessage(err);
        setError(message);
        notify('error', message);
        throw err;
      } finally {
        setGenerating(false);
      }
    },
    [notify, updateWorkspace],
  );

  const createManually = useCallback(
    async (input: CreateFlashcardDeckInput) => {
      const api = getStudyBudApi();
      if (!api) throw new Error('StudyBud runtime is not available.');
      setCreating(true);
      setError(null);
      try {
        const result = await api.createFlashcardDeck(input);
        updateWorkspace((prev) =>
          prev
            ? {
                ...prev,
                flashcardDecks: [...prev.flashcardDecks, result.flashcardDeck],
              }
            : prev,
        );
        notify('success', `Created deck "${result.flashcardDeck.title}".`);
        return result.flashcardDeck;
      } catch (err) {
        const message = toErrorMessage(err);
        setError(message);
        notify('error', message);
        throw err;
      } finally {
        setCreating(false);
      }
    },
    [notify, updateWorkspace],
  );

  const deleteDeck = useCallback(
    async (flashcardDeckId: string) => {
      const api = getStudyBudApi();
      if (!api) throw new Error('StudyBud runtime is not available.');
      try {
        await api.deleteFlashcardDeck({ flashcardDeckId });
        updateWorkspace((prev) =>
          prev
            ? {
                ...prev,
                flashcardDecks: prev.flashcardDecks.filter(
                  (deck) => deck.id !== flashcardDeckId,
                ),
              }
            : prev,
        );
        if (studyingDeckId === flashcardDeckId) {
          setStudyingDeckId(null);
        }
      } catch (err) {
        notify('error', toErrorMessage(err));
        throw err;
      }
    },
    [notify, studyingDeckId, updateWorkspace],
  );

  const beginStudy = useCallback((deckId: string) => {
    setStudyingDeckId(deckId);
    setCurrentCardIndex(0);
    setFlipped(false);
  }, []);

  const exitStudy = useCallback(() => {
    setStudyingDeckId(null);
    setCurrentCardIndex(0);
    setFlipped(false);
    setIsFullscreen(false);
  }, []);

  const clampIndex = useCallback(
    (index: number): number => {
      if (!studyingDeck) return 0;
      const length = studyingDeck.cards.length;
      if (length === 0) return 0;
      return Math.max(0, Math.min(length - 1, index));
    },
    [studyingDeck],
  );

  const nextCard = useCallback(() => {
    setCurrentCardIndex((prev) => clampIndex(prev + 1));
    setFlipped(false);
  }, [clampIndex]);

  const prevCard = useCallback(() => {
    setCurrentCardIndex((prev) => clampIndex(prev - 1));
    setFlipped(false);
  }, [clampIndex]);

  const setCardIndex = useCallback(
    (index: number) => {
      setCurrentCardIndex(clampIndex(index));
      setFlipped(false);
    },
    [clampIndex],
  );

  const flipCard = useCallback(() => {
    setFlipped((prev) => !prev);
  }, []);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  const value = useMemo<FlashcardsContextValue>(
    () => ({
      decks,
      generating,
      creating,
      error,
      studyingDeckId,
      studyingDeck,
      currentCardIndex,
      flipped,
      isFullscreen,
      generate,
      createManually,
      deleteDeck,
      beginStudy,
      exitStudy,
      nextCard,
      prevCard,
      setCardIndex,
      flipCard,
      setFlipped,
      toggleFullscreen,
    }),
    [
      decks,
      generating,
      creating,
      error,
      studyingDeckId,
      studyingDeck,
      currentCardIndex,
      flipped,
      isFullscreen,
      generate,
      createManually,
      deleteDeck,
      beginStudy,
      exitStudy,
      nextCard,
      prevCard,
      setCardIndex,
      flipCard,
      toggleFullscreen,
    ],
  );

  return (
    <FlashcardsContext.Provider value={value}>
      {children}
    </FlashcardsContext.Provider>
  );
};

export const useFlashcards = (): FlashcardsContextValue => {
  const ctx = useContext(FlashcardsContext);
  if (!ctx) {
    throw new Error('useFlashcards must be used inside <FlashcardsProvider>');
  }
  return ctx;
};
