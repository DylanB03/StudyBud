import { useMemo, useState, type FormEvent } from 'react';

import type {
  FlashcardDeck,
  SubjectAnalysisDivision,
} from '../../../shared/ipc';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { DismissibleBanner } from '../../components/DismissibleBanner';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from '../../components/Dialog';
import { Icon } from '../../components/Icon';
import {
  FieldGroup,
  FieldLabel,
  Input,
  Textarea,
} from '../../components/Input';
import { useAppState } from '../../state/AppState';
import { useFlashcards } from '../../state/FlashcardsState';
import { useSettings } from '../../state/SettingsState';
import { useSubjects } from '../../state/SubjectsState';
import { useWorkspace } from '../../state/WorkspaceState';
import { cn } from '../../theme/cn';

type ComposerMode = 'hidden' | 'chooser' | 'generate' | 'manual';

const MAX_MANUAL_CARDS = 60;
const MIN_GEN_COUNT = 1;
const MAX_GEN_COUNT = 24;

type ManualDraft = {
  id: string;
  front: string;
  back: string;
};

const newDraft = (): ManualDraft => ({
  id: `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
  front: '',
  back: '',
});

const formatDateTime = (value: string): string =>
  new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

const DECK_ICONS = [
  'hexagon',
  'dynamic_form',
  'rotate_90_degrees_ccw',
  'science',
  'polymer',
  'functions',
  'style',
  'psychology',
  'spa',
];

const deckIcon = (deck: FlashcardDeck): string => {
  const hash = [...deck.id].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return DECK_ICONS[hash % DECK_ICONS.length] ?? 'style';
};

export const FlashcardDecksView = () => {
  const { setActiveView, isOnline } = useAppState();
  const { activeSubject } = useSubjects();
  const { settings } = useSettings();
  const { workspace, loading, error, reload } = useWorkspace();
  const {
    decks,
    generating,
    creating,
    error: flashcardsError,
    generate,
    createManually,
    deleteDeck,
    beginStudy,
  } = useFlashcards();

  const [mode, setMode] = useState<ComposerMode>('hidden');
  const [confirmDelete, setConfirmDelete] = useState<FlashcardDeck | null>(null);

  const units = useMemo<SubjectAnalysisDivision[]>(
    () => workspace?.analysis?.divisions ?? [],
    [workspace],
  );

  const aiActionsEnabled =
    settings.aiProvider === 'openai'
      ? settings.openAiApiKeyConfigured && isOnline
      : settings.ollamaModel.trim().length > 0;
  const aiDisabledReason = !aiActionsEnabled
    ? settings.aiProvider === 'openai'
      ? 'Add an OpenAI API key in Settings.'
      : 'Set an Ollama model in Settings.'
    : null;

  if (!activeSubject) {
    return (
      <main className="flex flex-1 items-center justify-center px-8 py-16">
        <div className="flex flex-col items-center gap-4 text-center">
          <Chip tone="warning">No subject selected</Chip>
          <Button
            variant="primary"
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
            Loading decks…
          </p>
        </div>
      </main>
    );
  }

  const handleOpenDeck = (deck: FlashcardDeck) => {
    beginStudy(deck.id);
    setActiveView('flashcard-study');
  };

  return (
    <main className="flex-1 overflow-y-auto bg-surface pt-4">
      <div className="mx-auto max-w-6xl px-8 py-12">
        <header className="mb-10">
          <h1 className="font-display text-title-lg font-extrabold tracking-tight text-on-surface md:text-[2.5rem]">
            {activeSubject.name} flashcards
          </h1>
          <p className="mt-2 max-w-2xl font-body text-body-md text-on-surface-variant">
            Build your own cards, or generate a mixed-difficulty deck from
            any combination of units.
          </p>
        </header>

        {error ? (
          <div className="mb-6">
            <DismissibleBanner
              dismissKey={`decks-load:${error}`}
              variant="error"
              action={
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void reload()}
                >
                  Retry
                </Button>
              }
            >
              {error}
            </DismissibleBanner>
          </div>
        ) : null}

        {flashcardsError ? (
          <div className="mb-6">
            <DismissibleBanner
              dismissKey={`decks-op:${flashcardsError}`}
              variant="error"
            >
              {flashcardsError}
            </DismissibleBanner>
          </div>
        ) : null}

        <div className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-2">
          <ActionCard
            tone="primary"
            title="Generate with AI"
            description="Convert your lecture notes into active recall cards instantly."
            icon="bolt"
            badge="Recommended"
            onClick={() => setMode('generate')}
            disabled={generating || creating}
            disabledReason={aiDisabledReason}
          />
          <ActionCard
            tone="surface"
            title="Create manually"
            description="Build custom decks for specific exam prep or focus areas."
            icon="add_circle"
            onClick={() => setMode('manual')}
            disabled={generating || creating}
          />
        </div>

        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-title-sm font-bold text-on-surface">
            Recent decks
          </h2>
          <Chip tone="default" className="px-2 py-0.5 text-body-xs">
            {decks.length} deck{decks.length === 1 ? '' : 's'}
          </Chip>
        </div>

        {decks.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-outline-variant/30 bg-surface-container-low px-8 py-16 text-center">
            <Icon
              name="style"
              size="xl"
              className="text-on-surface-variant/40"
              filled
            />
            <p className="max-w-md font-body text-body-sm text-on-surface-variant">
              No flashcard decks saved yet. Create one manually or generate a
              mixed deck from your units.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {decks.map((deck) => (
              <DeckCard
                key={deck.id}
                deck={deck}
                onOpen={() => handleOpenDeck(deck)}
                onDelete={() => setConfirmDelete(deck)}
              />
            ))}
          </div>
        )}
      </div>

      <GenerateDialog
        open={mode === 'generate'}
        onOpenChange={(open) => setMode(open ? 'generate' : 'hidden')}
        units={units}
        busy={generating}
        aiActionsEnabled={aiActionsEnabled}
        aiDisabledReason={aiDisabledReason}
        onSubmit={async (input) => {
          await generate({
            subjectId: activeSubject.id,
            divisionIds: input.divisionIds,
            count: input.count,
            title: input.title,
          });
          setMode('hidden');
        }}
      />

      <ManualDialog
        open={mode === 'manual'}
        onOpenChange={(open) => setMode(open ? 'manual' : 'hidden')}
        units={units}
        busy={creating}
        onSubmit={async (input) => {
          await createManually({
            subjectId: activeSubject.id,
            title: input.title,
            divisionIds: input.divisionIds,
            cards: input.cards,
          });
          setMode('hidden');
        }}
      />

      <Dialog
        open={Boolean(confirmDelete)}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader
            title="Delete flashcard deck?"
            description={
              confirmDelete
                ? `"${confirmDelete.title}" will be permanently removed, along with ${confirmDelete.cardCount} card${confirmDelete.cardCount === 1 ? '' : 's'}.`
                : undefined
            }
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button
              variant="danger"
              onClick={async () => {
                if (!confirmDelete) return;
                await deleteDeck(confirmDelete.id);
                setConfirmDelete(null);
              }}
            >
              Delete deck
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
};

type ActionCardProps = {
  tone: 'primary' | 'surface';
  title: string;
  description: string;
  icon: string;
  badge?: string;
  onClick: () => void;
  disabled?: boolean;
  disabledReason?: string | null;
};

const ActionCard = ({
  tone,
  title,
  description,
  icon,
  badge,
  onClick,
  disabled,
  disabledReason,
}: ActionCardProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={cn(
      'group relative flex aspect-[16/7] flex-col justify-between overflow-hidden rounded-card p-8 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60',
      tone === 'primary'
        ? 'bg-gradient-to-br from-primary to-secondary text-on-primary shadow-soft hover:shadow-elevated'
        : 'border border-outline-variant/20 bg-surface-container-lowest text-on-surface hover:border-outline-variant/40 hover:bg-surface-container',
    )}
  >
    <div className="flex items-start justify-between">
      <span
        className={cn(
          'inline-flex h-12 w-12 items-center justify-center rounded-full backdrop-blur-md',
          tone === 'primary'
            ? 'bg-on-primary/20 text-on-primary'
            : 'bg-surface-container-high text-on-surface-variant',
        )}
      >
        <Icon name={icon} size="md" filled={tone === 'primary'} />
      </span>
      {badge ? (
        <span className="rounded-full bg-tertiary-fixed px-3 py-1 font-display text-label-sm font-bold uppercase tracking-widest text-on-tertiary-fixed">
          {badge}
        </span>
      ) : null}
    </div>
    <div>
      <h3
        className={cn(
          'mb-1 font-display text-title-sm font-bold',
          tone === 'primary' ? 'text-on-primary' : 'text-on-surface',
        )}
      >
        {title}
      </h3>
      <p
        className={cn(
          'font-body text-body-sm',
          tone === 'primary'
            ? 'text-on-primary/85'
            : 'text-on-surface-variant',
        )}
      >
        {description}
      </p>
      {disabledReason && disabled ? (
        <p
          className={cn(
            'mt-2 font-body text-body-xs',
            tone === 'primary' ? 'text-on-primary/80' : 'text-warning',
          )}
        >
          {disabledReason}
        </p>
      ) : null}
    </div>
    <Icon
      name={icon}
      size="xl"
      className={cn(
        'pointer-events-none absolute -bottom-6 -right-6 transition-transform group-hover:scale-105',
        tone === 'primary'
          ? 'text-on-primary/10'
          : 'text-on-surface-variant/10',
      )}
      filled
    />
  </button>
);

type DeckCardProps = {
  deck: FlashcardDeck;
  onOpen: () => void;
  onDelete: () => void;
};

const DeckCard = ({ deck, onOpen, onDelete }: DeckCardProps) => (
  <article className="group relative flex flex-col rounded-card border border-outline-variant/15 bg-surface-container-lowest transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-elevated focus-within:-translate-y-0.5 focus-within:border-primary/40 focus-within:shadow-elevated">
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Study ${deck.title}`}
      className="flex flex-1 flex-col gap-4 rounded-card p-6 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
    >
      <div className="flex items-start justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-container-low text-primary transition group-hover:bg-primary-container group-hover:text-on-primary-container">
          <Icon name={deckIcon(deck)} size="lg" />
        </div>
        <span className="font-display text-label-sm font-bold uppercase tracking-widest text-on-surface-variant">
          {deck.cardCount} cards
        </span>
      </div>
      <div className="flex-1">
        <h4 className="mb-2 font-display text-body-lg font-bold text-on-surface">
          {deck.title}
        </h4>
        <p className="line-clamp-2 font-body text-body-sm text-on-surface-variant">
          {deck.unitTitles.length > 0
            ? deck.unitTitles.join(' • ')
            : 'Standalone deck (no linked units)'}
        </p>
        <p className="mt-2 font-body text-body-xs text-on-surface-variant/70">
          Updated {formatDateTime(deck.updatedAt)}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip tone="secondary" className="px-2 py-0.5 text-body-xs">
          {deck.creationMode === 'generated' ? 'AI' : 'Manual'}
        </Chip>
        {deck.difficultyMode === 'mixed' ? (
          <Chip tone="primary" className="px-2 py-0.5 text-body-xs">
            Mixed difficulty
          </Chip>
        ) : null}
        <span className="ml-auto inline-flex items-center gap-1 font-display text-label-sm font-bold uppercase tracking-widest text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          Study
          <Icon name="play_arrow" size="sm" filled />
        </span>
      </div>
    </button>
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onDelete();
      }}
      aria-label={`Delete ${deck.title}`}
      className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface-container-high/80 text-on-surface-variant opacity-0 backdrop-blur-sm transition hover:bg-error/15 hover:text-error focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 group-hover:opacity-100"
    >
      <Icon name="delete" size="sm" />
    </button>
  </article>
);

type GenerateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  units: SubjectAnalysisDivision[];
  busy: boolean;
  aiActionsEnabled: boolean;
  aiDisabledReason: string | null;
  onSubmit: (input: {
    title: string;
    divisionIds: string[];
    count: number;
  }) => Promise<void>;
};

const GenerateDialog = ({
  open,
  onOpenChange,
  units,
  busy,
  aiActionsEnabled,
  aiDisabledReason,
  onSubmit,
}: GenerateDialogProps) => {
  const [title, setTitle] = useState('');
  const [count, setCount] = useState(12);
  const [unitIds, setUnitIds] = useState<string[]>([]);

  const initialIds = useMemo(
    () => units.slice(0, Math.min(3, units.length)).map((u) => u.id),
    [units],
  );

  const effectiveUnitIds = unitIds.length > 0 ? unitIds : initialIds;
  const canSubmit =
    aiActionsEnabled &&
    !busy &&
    effectiveUnitIds.length > 0 &&
    count >= MIN_GEN_COUNT &&
    count <= MAX_GEN_COUNT;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    const firstUnit = units.find((u) => u.id === effectiveUnitIds[0]);
    await onSubmit({
      title: title.trim() || `${firstUnit?.title ?? 'Subject'} Flashcards`,
      divisionIds: effectiveUnitIds,
      count,
    });
    setTitle('');
    setCount(12);
    setUnitIds([]);
  };

  const toggleUnit = (id: string) => {
    setUnitIds((prev) => {
      const base = prev.length === 0 ? initialIds : prev;
      return base.includes(id)
        ? base.filter((x) => x !== id)
        : [...base, id];
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader
          title="Generate flashcards with AI"
          description="Generate a mixed-difficulty deck from the units you select."
        />
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {!aiActionsEnabled && aiDisabledReason ? (
            <DismissibleBanner
              dismissKey={`decks-ai:${aiDisabledReason}`}
              variant="warning"
            >
              {aiDisabledReason}
            </DismissibleBanner>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FieldGroup label="Deck title">
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Generated flashcards"
                maxLength={120}
              />
            </FieldGroup>
            <FieldGroup
              label="Card count"
              description={`${MIN_GEN_COUNT}–${MAX_GEN_COUNT}`}
            >
              <Input
                type="number"
                min={MIN_GEN_COUNT}
                max={MAX_GEN_COUNT}
                value={count}
                onChange={(event) =>
                  setCount(Number(event.target.value) || MIN_GEN_COUNT)
                }
              />
            </FieldGroup>
          </div>

          <FieldGroup label="Include units">
            {units.length === 0 ? (
              <p className="rounded-md border border-dashed border-outline-variant/40 px-4 py-6 text-center font-body text-body-sm text-on-surface-variant">
                Analyze this subject first to generate units.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {units.map((unit) => {
                  const checked = effectiveUnitIds.includes(unit.id);
                  return (
                    <label
                      key={unit.id}
                      className={cn(
                        'flex cursor-pointer items-start gap-2 rounded-md border border-outline-variant/20 bg-surface-container-lowest p-3 transition hover:border-primary/30',
                        checked && 'border-primary/50 bg-primary/5',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleUnit(unit.id)}
                        className="mt-1"
                      />
                      <div className="min-w-0">
                        <strong className="block font-display text-body-sm font-bold text-on-surface">
                          {unit.title}
                        </strong>
                        <p className="line-clamp-2 font-body text-body-xs text-on-surface-variant">
                          {unit.summary}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </FieldGroup>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary" type="button" disabled={busy}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="primary"
              type="submit"
              disabled={!canSubmit}
              loading={busy}
              leadingIcon={<Icon name="bolt" size="sm" filled />}
            >
              Generate flashcards
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

type ManualDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  units: SubjectAnalysisDivision[];
  busy: boolean;
  onSubmit: (input: {
    title: string;
    divisionIds: string[];
    cards: Array<{ front: string; back: string }>;
  }) => Promise<void>;
};

const ManualDialog = ({
  open,
  onOpenChange,
  units,
  busy,
  onSubmit,
}: ManualDialogProps) => {
  const [title, setTitle] = useState('');
  const [unitIds, setUnitIds] = useState<string[]>([]);
  const [cards, setCards] = useState<ManualDraft[]>([newDraft(), newDraft()]);

  const canSubmit =
    !busy &&
    title.trim().length > 0 &&
    cards.length <= MAX_MANUAL_CARDS &&
    cards.every(
      (card) => card.front.trim().length > 0 && card.back.trim().length > 0,
    );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    await onSubmit({
      title: title.trim(),
      divisionIds: unitIds,
      cards: cards.map((card) => ({
        front: card.front.trim(),
        back: card.back.trim(),
      })),
    });
    setTitle('');
    setUnitIds([]);
    setCards([newDraft(), newDraft()]);
  };

  const toggleUnit = (id: string) => {
    setUnitIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader
          title="Create a manual deck"
          description="Write your own flashcards and (optionally) link them to units in this subject."
        />

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FieldGroup label="Deck title">
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="My flashcard deck"
              maxLength={120}
            />
          </FieldGroup>

          {units.length > 0 ? (
            <FieldGroup
              label="Link to units (optional)"
              description="Attach this deck to one or more units for easier navigation."
            >
              <div className="flex flex-wrap gap-1.5">
                {units.map((unit) => {
                  const checked = unitIds.includes(unit.id);
                  return (
                    <button
                      key={unit.id}
                      type="button"
                      onClick={() => toggleUnit(unit.id)}
                      className={cn(
                        'rounded-full border px-3 py-1 font-body text-body-xs transition',
                        checked
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-outline-variant/30 text-on-surface-variant hover:border-primary/30',
                      )}
                    >
                      {unit.title}
                    </button>
                  );
                })}
              </div>
            </FieldGroup>
          ) : null}

          <FieldGroup
            label={`Cards (${cards.length} / ${MAX_MANUAL_CARDS})`}
          >
            <div className="flex max-h-[320px] flex-col gap-3 overflow-y-auto pr-1">
              {cards.map((card, index) => (
                <article
                  key={card.id}
                  className="flex flex-col gap-2 rounded-md border border-outline-variant/20 bg-surface-container-lowest p-3"
                >
                  <div className="flex items-center justify-between">
                    <strong className="font-display text-body-sm font-bold text-on-surface">
                      Card {index + 1}
                    </strong>
                    {cards.length > 1 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setCards((prev) =>
                            prev.filter((entry) => entry.id !== card.id),
                          )
                        }
                        className="font-body text-body-xs text-on-surface-variant hover:text-error"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <div>
                    <FieldLabel>Front</FieldLabel>
                    <Textarea
                      rows={2}
                      value={card.front}
                      onChange={(event) =>
                        setCards((prev) =>
                          prev.map((entry) =>
                            entry.id === card.id
                              ? { ...entry, front: event.target.value }
                              : entry,
                          ),
                        )
                      }
                    />
                  </div>
                  <div>
                    <FieldLabel>Back</FieldLabel>
                    <Textarea
                      rows={3}
                      value={card.back}
                      onChange={(event) =>
                        setCards((prev) =>
                          prev.map((entry) =>
                            entry.id === card.id
                              ? { ...entry, back: event.target.value }
                              : entry,
                          ),
                        )
                      }
                    />
                  </div>
                </article>
              ))}
            </div>
            <div className="mt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setCards((prev) => [...prev, newDraft()])}
                disabled={cards.length >= MAX_MANUAL_CARDS}
                leadingIcon={<Icon name="add" size="sm" />}
              >
                {cards.length >= MAX_MANUAL_CARDS
                  ? 'Card limit reached'
                  : 'Add card'}
              </Button>
            </div>
          </FieldGroup>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary" type="button" disabled={busy}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="primary"
              type="submit"
              disabled={!canSubmit}
              loading={busy}
              leadingIcon={<Icon name="save" size="sm" />}
            >
              Save deck
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
