import { useCallback, useEffect, useRef } from 'react';

import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { Icon } from '../../components/Icon';
import { useAppState } from '../../state/AppState';
import { useFlashcards } from '../../state/FlashcardsState';
import { useSubjects } from '../../state/SubjectsState';
import { cn } from '../../theme/cn';
import { RichMessageContent } from '../workspace/RichMessageContent';

export const FlashcardStudyView = () => {
  const { setActiveView } = useAppState();
  const { activeSubject } = useSubjects();
  const {
    studyingDeck,
    currentCardIndex,
    flipped,
    flipCard,
    nextCard,
    prevCard,
    exitStudy,
  } = useFlashcards();
  const stageRef = useRef<HTMLDivElement | null>(null);

  const handleBackToDecks = useCallback(() => {
    exitStudy();
    setActiveView('flashcard-decks');
  }, [exitStudy, setActiveView]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target && (event.target as HTMLElement).closest('input, textarea')) {
        return;
      }
      if (event.key === ' ') {
        event.preventDefault();
        flipCard();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        nextCard();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        prevCard();
      } else if (event.key === 'Escape') {
        handleBackToDecks();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flipCard, nextCard, prevCard, handleBackToDecks]);

  if (!studyingDeck) {
    return (
      <main className="flex flex-1 items-center justify-center px-8 py-16">
        <div className="flex flex-col items-center gap-4 text-center">
          <Chip tone="warning">No deck is being studied</Chip>
          <Button
            variant="primary"
            onClick={() => setActiveView('flashcard-decks')}
            leadingIcon={<Icon name="style" size="sm" filled />}
          >
            Back to decks
          </Button>
        </div>
      </main>
    );
  }

  const card = studyingDeck.cards[currentCardIndex];
  const cardCount = studyingDeck.cards.length;
  const canPrev = currentCardIndex > 0;
  const canNext = currentCardIndex < cardCount - 1;
  const progress =
    cardCount > 0 ? ((currentCardIndex + 1) / cardCount) * 100 : 0;

  const handleFullscreen = async () => {
    const el = stageRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement === el) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    } catch {
      /* ignore */
    }
  };

  return (
    <main className="relative flex flex-1 flex-col overflow-hidden bg-surface">
      <header className="flex items-center justify-between gap-4 border-b border-outline-variant/10 bg-surface/70 px-6 py-4 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleBackToDecks}
            className="group inline-flex items-center gap-1.5 font-body text-body-sm font-medium text-primary transition hover:opacity-80"
          >
            <Icon
              name="arrow_back"
              size="sm"
              className="transition-transform group-hover:-translate-x-0.5"
            />
            Back to flashcards
          </button>
          <span className="h-6 w-px bg-outline-variant/30" />
          <div className="flex flex-col leading-tight">
            <span className="font-display text-label-sm font-semibold uppercase tracking-widest text-on-surface-variant">
              {activeSubject?.name ?? 'StudyBud'}
            </span>
            <span className="font-body text-body-xs text-on-surface-variant/80">
              {studyingDeck.title}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-full bg-surface-container-low px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <span className="font-display text-body-xs font-bold text-on-surface-variant">
              {cardCount === 0
                ? '0 cards'
                : `${currentCardIndex + 1} / ${cardCount} cards`}
            </span>
          </div>
        </div>
      </header>

      <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-8">
        <div className="pointer-events-none absolute -right-20 top-1/4 -z-10 h-96 w-96 rounded-full bg-primary/5 blur-[100px]" />
        <div className="pointer-events-none absolute -left-20 bottom-1/4 -z-10 h-80 w-80 rounded-full bg-secondary/5 blur-[80px]" />

        {!card ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <Chip tone="warning">This deck has no cards yet</Chip>
            <Button variant="primary" onClick={handleBackToDecks}>
              Back to decks
            </Button>
          </div>
        ) : (
          <>
            <div
              ref={stageRef}
              className="relative flex w-full max-w-4xl flex-col gap-8"
            >
              <button
                type="button"
                onClick={flipCard}
                style={{ perspective: '1600px' }}
                className={cn(
                  'group relative aspect-[16/10] w-full overflow-hidden rounded-card bg-surface-container-lowest text-left shadow-ambient transition-shadow duration-500 hover:shadow-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                )}
                aria-label="Flip card"
              >
                <span className="pointer-events-none absolute left-0 top-0 z-20 h-1 w-full bg-surface-container-low">
                  <span
                    className="block h-full bg-primary transition-[width] duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </span>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleFullscreen();
                  }}
                  aria-label="Toggle fullscreen"
                  className="absolute right-6 top-6 z-20 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-surface-container-low text-on-surface-variant opacity-0 transition-opacity hover:bg-surface-container-high group-hover:opacity-100"
                >
                  <Icon name="fullscreen" size="sm" />
                </button>

                <div
                  className={cn(
                    'card-flip-inner relative h-full w-full',
                    flipped && 'is-flipped',
                  )}
                >
                  <CardFace
                    label="Question"
                    content={card.front}
                    side="front"
                  />
                  <CardFace
                    label="Answer"
                    content={card.back}
                    side="back"
                  />
                </div>
              </button>

              <div className="flex items-center justify-center gap-8">
                <NavButton
                  icon="chevron_left"
                  label="Previous"
                  onClick={prevCard}
                  disabled={!canPrev}
                />
                <button
                  type="button"
                  onClick={flipCard}
                  className="inline-flex items-center gap-2 rounded-full bg-on-background px-8 py-4 font-display text-body-sm font-bold tracking-wide text-surface shadow-ambient transition hover:-translate-y-0.5 active:translate-y-0"
                >
                  {flipped ? 'Show question' : 'Reveal answer'}
                </button>
                <NavButton
                  icon="chevron_right"
                  label="Next"
                  onClick={nextCard}
                  disabled={!canNext}
                />
              </div>

              <div className="flex justify-center">
                <div className="hidden gap-2 lg:flex">
                  <Hotkey keys="SPACE" label="Flip" />
                  <Hotkey keys="← / →" label="Navigate" />
                  <Hotkey keys="ESC" label="Back" />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
};

type CardFaceProps = {
  label: 'Question' | 'Answer';
  content: string;
  side: 'front' | 'back';
};

const CardFace = ({ label, content, side }: CardFaceProps) => (
  <div
    className={cn(
      'card-flip-face flex flex-col bg-surface-container-lowest p-10 lg:p-14',
      side === 'back' && 'card-flip-face--back',
    )}
    aria-hidden={side === 'back' ? undefined : undefined}
  >
    <div className="flex items-start justify-between">
      <Chip tone="secondary" className="px-3 py-1 text-label-sm">
        {label}
      </Chip>
      <span className="font-body text-body-xs italic text-outline">
        Click or press space to flip
      </span>
    </div>
    <div className="mx-auto mt-6 flex w-full max-w-2xl flex-1 flex-col justify-center text-center">
      <div className="font-display text-title-md font-extrabold leading-tight text-on-surface lg:text-[2rem]">
        <RichMessageContent content={content} />
      </div>
    </div>
  </div>
);

type NavButtonProps = {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

const NavButton = ({ icon, label, onClick, disabled }: NavButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-surface-container-high text-on-surface shadow-soft transition hover:bg-surface-container-highest active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
  >
    <Icon name={icon} size="md" />
  </button>
);

const Hotkey = ({ keys, label }: { keys: string; label: string }) => (
  <div className="flex items-center gap-2 rounded-lg border border-outline-variant/20 bg-surface-container-low px-3 py-1.5">
    <kbd className="rounded bg-surface-container-highest px-2 py-0.5 font-display text-label-sm font-bold text-on-surface">
      {keys}
    </kbd>
    <span className="font-display text-label-sm font-bold uppercase tracking-wider text-outline">
      {label}
    </span>
  </div>
);
