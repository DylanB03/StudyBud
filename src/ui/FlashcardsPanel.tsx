import { useEffect, useMemo, useRef, useState } from 'react';

import type { FlashcardDeck, SubjectAnalysisDivision } from '../shared/ipc';
import { DismissibleBanner } from './DismissibleBanner';
import { RichMessageContent } from './RichMessageContent';

type FlashcardsPanelProps = {
  units: SubjectAnalysisDivision[];
  decks: FlashcardDeck[];
  busy: boolean;
  aiActionsEnabled: boolean;
  disabledReason?: string | null;
  errorMessage?: string | null;
  onGenerate: (input: {
    title: string;
    divisionIds: string[];
    count: number;
  }) => Promise<void> | void;
  onCreateManual: (input: {
    title: string;
    divisionIds: string[];
    cards: Array<{
      front: string;
      back: string;
    }>;
  }) => Promise<void> | void;
  onDeleteDeck: (deck: FlashcardDeck) => void;
};

type FlashcardCardDraft = {
  id: string;
  front: string;
  back: string;
};

type ComposerMode = 'library' | 'chooser' | 'generate' | 'manual' | 'deck';
const MAX_MANUAL_FLASHCARDS = 60;

const createDraftCard = (): FlashcardCardDraft => ({
  id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  front: '',
  back: '',
});

const formatDateTime = (value: string): string => {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const FlashcardsPanel = ({
  units,
  decks,
  busy,
  aiActionsEnabled,
  disabledReason = null,
  errorMessage = null,
  onGenerate,
  onCreateManual,
  onDeleteDeck,
}: FlashcardsPanelProps) => {
  const [mode, setMode] = useState<ComposerMode>('library');
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [generateTitle, setGenerateTitle] = useState('');
  const [generateCount, setGenerateCount] = useState(12);
  const [selectedGenerateUnitIds, setSelectedGenerateUnitIds] = useState<string[]>(
    () => units.slice(0, 3).map((unit) => unit.id),
  );
  const [manualTitle, setManualTitle] = useState('');
  const [selectedManualUnitIds, setSelectedManualUnitIds] = useState<string[]>([]);
  const [manualCards, setManualCards] = useState<FlashcardCardDraft[]>([
    createDraftCard(),
    createDraftCard(),
  ]);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    'generating' | 'saving-manual' | null
  >(null);
  const stageShellRef = useRef<HTMLDivElement | null>(null);

  const selectedDeck =
    decks.find((deck) => deck.id === selectedDeckId) ?? null;

  useEffect(() => {
    if (units.length === 0) {
      setSelectedGenerateUnitIds([]);
      return;
    }

    setSelectedGenerateUnitIds((previous) =>
      previous.length > 0
        ? previous.filter((divisionId) => units.some((unit) => unit.id === divisionId))
        : units.slice(0, Math.min(3, units.length)).map((unit) => unit.id),
    );
  }, [units]);

  useEffect(() => {
    if (!selectedDeckId) {
      return;
    }

    if (!decks.some((deck) => deck.id === selectedDeckId)) {
      setSelectedDeckId(null);
      setMode('library');
      setActiveCardIndex(0);
      setIsFlipped(false);
    }
  }, [decks, selectedDeckId]);

  useEffect(() => {
    if (selectedDeck && mode !== 'deck') {
      setMode('deck');
    }
  }, [mode, selectedDeck]);

  const currentCard = selectedDeck?.cards[activeCardIndex] ?? null;

  const canGenerate =
    aiActionsEnabled &&
    !busy &&
    selectedGenerateUnitIds.length > 0 &&
    generateCount >= 1 &&
    generateCount <= 24;

  const canCreateManual =
    !busy &&
    manualTitle.trim().length > 0 &&
    manualCards.length <= MAX_MANUAL_FLASHCARDS &&
    manualCards.every(
      (card) => card.front.trim().length > 0 && card.back.trim().length > 0,
    );

  const selectedGenerateUnitTitles = useMemo(
    () =>
      units
        .filter((unit) => selectedGenerateUnitIds.includes(unit.id))
        .map((unit) => unit.title),
    [selectedGenerateUnitIds, units],
  );

  const toggleUnitSelection = (
    unitId: string,
    selectedIds: string[],
    setSelectedIds: (next: string[]) => void,
  ) => {
    setSelectedIds(
      selectedIds.includes(unitId)
        ? selectedIds.filter((id) => id !== unitId)
        : [...selectedIds, unitId],
    );
  };

  const resetManualComposer = () => {
    setManualTitle('');
    setSelectedManualUnitIds([]);
    setManualCards([createDraftCard(), createDraftCard()]);
  };

  const handleGenerateSubmit = async () => {
    if (!canGenerate) {
      return;
    }

    setPendingAction('generating');
    try {
      await onGenerate({
        title:
          generateTitle.trim() ||
          `${selectedGenerateUnitTitles[0] ?? 'Subject'} Flashcards`,
        divisionIds: selectedGenerateUnitIds,
        count: generateCount,
      });
      setMode('library');
      setGenerateTitle('');
    } catch {
      // Parent handlers surface the actual message in panel/app state.
    } finally {
      setPendingAction(null);
    }
  };

  const handleManualSubmit = async () => {
    if (!canCreateManual) {
      return;
    }

    setPendingAction('saving-manual');
    try {
      await onCreateManual({
        title: manualTitle.trim(),
        divisionIds: selectedManualUnitIds,
        cards: manualCards.map((card) => ({
          front: card.front.trim(),
          back: card.back.trim(),
        })),
      });
      resetManualComposer();
      setMode('library');
    } catch {
      // Parent handlers surface the actual message in panel/app state.
    } finally {
      setPendingAction(null);
    }
  };

  const handleOpenDeck = (deck: FlashcardDeck) => {
    setSelectedDeckId(deck.id);
    setActiveCardIndex(0);
    setIsFlipped(false);
    setMode('deck');
  };

  const handleMoveCard = (offset: -1 | 1) => {
    if (!selectedDeck) {
      return;
    }

    setActiveCardIndex((previous) => {
      const next = previous + offset;
      if (next < 0 || next >= selectedDeck.cards.length) {
        return previous;
      }

      return next;
    });
    setIsFlipped(false);
  };

  const handleToggleFullscreen = async () => {
    const stageShell = stageShellRef.current;
    if (!stageShell) {
      return;
    }

    if (document.fullscreenElement === stageShell) {
      await document.exitFullscreen();
      return;
    }

    await stageShell.requestFullscreen();
  };

  return (
    <section className="analysis-panel flashcards-panel">
      <div className="sidebar-section-title">
        <h3>Flashcards</h3>
        <span>{decks.length}</span>
      </div>

      {errorMessage ? (
        <DismissibleBanner
          dismissKey={`flashcards-error:${errorMessage}`}
          className="panel-banner"
        >
          <span>{errorMessage}</span>
        </DismissibleBanner>
      ) : null}

      {pendingAction ? (
        <div className="flashcard-status-banner" role="status" aria-live="polite">
          <span className="flashcard-status-dot" aria-hidden="true" />
          <span>
            {pendingAction === 'generating'
              ? 'Generating flashcards from the selected units...'
              : 'Saving your flashcard deck...'}
          </span>
        </div>
      ) : null}

      {mode !== 'deck' ? (
        <div className="flashcards-toolbar">
          <p className="analysis-muted">
            Build manual decks or generate mixed-difficulty cards from any combination
            of units.
          </p>
          <button
            type="button"
            onClick={() => setMode('chooser')}
            disabled={busy}
          >
            Create New Flashcard Deck
          </button>
        </div>
      ) : null}

      {mode === 'chooser' ? (
        <div className="flashcard-chooser">
          <button
            type="button"
            className="flashcard-mode-card"
            onClick={() => setMode('generate')}
            disabled={busy}
          >
            <strong>Generate With AI</strong>
            <p>Create a mixed-difficulty deck from selected units.</p>
          </button>
          <button
            type="button"
            className="flashcard-mode-card"
            onClick={() => setMode('manual')}
            disabled={busy}
          >
            <strong>Create Manually</strong>
            <p>Write your own flashcards and save them as a custom deck.</p>
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => setMode('library')}
          >
            Cancel
          </button>
        </div>
      ) : null}

      {mode === 'generate' ? (
        <div className="flashcard-composer">
          {!aiActionsEnabled && disabledReason ? (
            <div className="warning-banner">{disabledReason}</div>
          ) : null}

          <div className="flashcard-composer-grid">
            <label>
              <span className="label">Deck Title</span>
              <input
                type="text"
                value={generateTitle}
                onChange={(event) => setGenerateTitle(event.target.value)}
                placeholder="Generated flashcards"
                maxLength={120}
              />
            </label>

            <label>
              <span className="label">Card Count</span>
              <input
                type="number"
                min={1}
                max={24}
                value={generateCount}
                onChange={(event) => setGenerateCount(Number(event.target.value) || 1)}
              />
            </label>
          </div>

          <div className="flashcard-unit-picker">
            <span className="label">Include Units</span>
            {units.length === 0 ? (
              <div className="empty-state">
                Analyze this subject first to generate units for AI flashcards.
              </div>
            ) : (
              <div className="flashcard-unit-grid">
                {units.map((unit) => (
                  <label key={unit.id} className="flashcard-unit-option">
                    <input
                      type="checkbox"
                      checked={selectedGenerateUnitIds.includes(unit.id)}
                      onChange={() =>
                        toggleUnitSelection(
                          unit.id,
                          selectedGenerateUnitIds,
                          setSelectedGenerateUnitIds,
                        )
                      }
                    />
                    <div>
                      <strong>{unit.title}</strong>
                      <p>{unit.summary}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flashcard-composer-actions">
            <button
              type="button"
              className="ghost-button"
              onClick={() => setMode('library')}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleGenerateSubmit()}
              disabled={!canGenerate}
            >
              {busy ? 'Generating Flashcards...' : 'Generate Flashcards'}
            </button>
          </div>
        </div>
      ) : null}

      {mode === 'manual' ? (
        <div className="flashcard-composer">
          <div className="flashcard-composer-grid">
            <label>
              <span className="label">Deck Title</span>
              <input
                type="text"
                value={manualTitle}
                onChange={(event) => setManualTitle(event.target.value)}
                placeholder="My flashcard deck"
                maxLength={120}
              />
            </label>
          </div>

          <div className="flashcard-unit-picker">
            <span className="label">Link To Units (Optional)</span>
            {units.length === 0 ? (
              <div className="analysis-muted">
                No units available yet. You can still make a manual deck without them.
              </div>
            ) : (
              <div className="flashcard-unit-grid">
                {units.map((unit) => (
                  <label key={unit.id} className="flashcard-unit-option">
                    <input
                      type="checkbox"
                      checked={selectedManualUnitIds.includes(unit.id)}
                      onChange={() =>
                        toggleUnitSelection(
                          unit.id,
                          selectedManualUnitIds,
                          setSelectedManualUnitIds,
                        )
                      }
                    />
                    <div>
                      <strong>{unit.title}</strong>
                      <p>{unit.summary}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flashcard-manual-list">
            {manualCards.map((card, index) => (
              <article key={card.id} className="flashcard-manual-card">
                <div className="flashcard-manual-card-header">
                  <strong>Card {index + 1}</strong>
                  {manualCards.length > 1 ? (
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() =>
                        setManualCards((previous) =>
                          previous.filter((entry) => entry.id !== card.id),
                        )
                      }
                    >
                      Remove
                    </button>
                  ) : null}
                </div>

                <label>
                  <span className="label">Question / Front</span>
                  <textarea
                    rows={3}
                    value={card.front}
                    onChange={(event) =>
                      setManualCards((previous) =>
                        previous.map((entry) =>
                          entry.id === card.id
                            ? { ...entry, front: event.target.value }
                            : entry,
                        ),
                      )
                    }
                  />
                </label>

                <label>
                  <span className="label">Answer / Back</span>
                  <textarea
                    rows={4}
                    value={card.back}
                    onChange={(event) =>
                      setManualCards((previous) =>
                        previous.map((entry) =>
                          entry.id === card.id
                            ? { ...entry, back: event.target.value }
                            : entry,
                        ),
                      )
                    }
                  />
                </label>
              </article>
            ))}
          </div>

          <p className="analysis-muted">
            {manualCards.length} / {MAX_MANUAL_FLASHCARDS} cards
          </p>

          <div className="flashcard-composer-actions">
            <button
              type="button"
              className="ghost-button"
              onClick={() => setManualCards((previous) => [...previous, createDraftCard()])}
              disabled={manualCards.length >= MAX_MANUAL_FLASHCARDS}
            >
              {manualCards.length >= MAX_MANUAL_FLASHCARDS
                ? 'Card Limit Reached'
                : 'Add Card'}
            </button>
            <div className="flashcard-action-row">
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  resetManualComposer();
                  setMode('library');
                }}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleManualSubmit()}
                disabled={!canCreateManual}
              >
                Save Deck
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {mode === 'deck' && selectedDeck && currentCard ? (
        <div ref={stageShellRef} className="flashcard-stage-shell">
          <div className="flashcard-stage-header">
            <div>
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setMode('library');
                  setSelectedDeckId(null);
                  setIsFlipped(false);
                  setActiveCardIndex(0);
                }}
              >
                Back To Decks
              </button>
              <h4>{selectedDeck.title}</h4>
              <p className="analysis-muted">
                {selectedDeck.creationMode === 'generated' ? 'AI generated' : 'Manual'} •{' '}
                {selectedDeck.cardCount} card
                {selectedDeck.cardCount === 1 ? '' : 's'} • updated{' '}
                {formatDateTime(selectedDeck.updatedAt)}
              </p>
            </div>
            <button type="button" onClick={() => void handleToggleFullscreen()}>
              Full Screen
            </button>
          </div>

          <div className="flashcard-stage">
            <button
              type="button"
              className={`flashcard-viewer${isFlipped ? ' flipped' : ''}`}
              onClick={() => setIsFlipped((previous) => !previous)}
            >
              <span className="flashcard-face-label">
                {isFlipped ? 'Answer' : 'Question'}
              </span>
              <div className="flashcard-viewer-inner">
                <div className="flashcard-face flashcard-face-front">
                  <div className="flashcard-face-copy">
                    <RichMessageContent content={currentCard.front} />
                  </div>
                </div>
                <div className="flashcard-face flashcard-face-back">
                  <div className="flashcard-face-copy">
                    <RichMessageContent content={currentCard.back} />
                  </div>
                </div>
              </div>
            </button>
          </div>

          <div className="flashcard-stage-footer">
            <button
              type="button"
              className="flashcard-nav-button"
              onClick={() => handleMoveCard(-1)}
              disabled={activeCardIndex === 0}
            >
              ←
            </button>
            <span className="analysis-count-pill">
              Card {activeCardIndex + 1} / {selectedDeck.cards.length}
            </span>
            <button
              type="button"
              className="flashcard-nav-button"
              onClick={() => handleMoveCard(1)}
              disabled={activeCardIndex >= selectedDeck.cards.length - 1}
            >
              →
            </button>
          </div>
        </div>
      ) : null}

      {mode === 'library' ? (
        decks.length === 0 ? (
          <div className="empty-state">
            No flashcard decks saved yet. Create one manually or generate a mixed
            deck from your units.
          </div>
        ) : (
          <div className="flashcard-deck-grid">
            {decks.map((deck) => (
              <article key={deck.id} className="flashcard-deck-card">
                <button
                  type="button"
                  className="flashcard-deck-open"
                  onClick={() => handleOpenDeck(deck)}
                >
                  <div className="flashcard-deck-card-header">
                    <strong>{deck.title}</strong>
                    <div className="analysis-chip-list">
                      <span className="analysis-count-pill">
                        {deck.creationMode === 'generated' ? 'AI' : 'Manual'}
                      </span>
                      {deck.difficultyMode === 'mixed' ? (
                        <span className="analysis-count-pill">Mixed</span>
                      ) : null}
                    </div>
                  </div>
                  <p className="flashcard-deck-card-meta">
                    {deck.cardCount} card{deck.cardCount === 1 ? '' : 's'} •{' '}
                    {deck.unitTitles.length > 0
                      ? `${deck.unitTitles.length} unit${
                          deck.unitTitles.length === 1 ? '' : 's'
                        }`
                      : 'standalone deck'}
                  </p>
                  {deck.unitTitles.length > 0 ? (
                    <p className="flashcard-deck-card-units">
                      {deck.unitTitles.join(' • ')}
                    </p>
                  ) : (
                    <p className="flashcard-deck-card-units">No linked units</p>
                  )}
                </button>
                <div className="flashcard-deck-card-actions">
                  <button type="button" onClick={() => handleOpenDeck(deck)}>
                    Open Deck
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => onDeleteDeck(deck)}
                    disabled={busy}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )
      ) : null}
    </section>
  );
};
