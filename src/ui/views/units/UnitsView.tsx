import { useMemo } from 'react';

import type { SubjectAnalysisDivision } from '../../../shared/ipc';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { DismissibleBanner } from '../../components/DismissibleBanner';
import { Icon } from '../../components/Icon';
import { useAppState } from '../../state/AppState';
import { useSubjects } from '../../state/SubjectsState';
import { useWorkspace } from '../../state/WorkspaceState';
import { cn } from '../../theme/cn';

const UNIT_ICONS = [
  'polymer',
  'science',
  'cyclone',
  'experiment',
  'functions',
  'biotech',
  'bolt',
  'psychology',
  'menu_book',
  'hub',
  'target',
  'route',
];

const unitIcon = (unit: SubjectAnalysisDivision, index: number): string =>
  UNIT_ICONS[index % UNIT_ICONS.length] ?? 'circle';

export const UnitsView = () => {
  const { setActiveView } = useAppState();
  const { activeSubject } = useSubjects();
  const {
    workspace,
    loading,
    error,
    reload,
    selectDivision,
    analysisState,
  } = useWorkspace();

  const units = useMemo(
    () => workspace?.analysis?.divisions ?? [],
    [workspace],
  );

  if (!activeSubject) {
    return (
      <main className="flex flex-1 items-center justify-center px-8 py-16">
        <div className="flex flex-col items-center gap-4 text-center">
          <Chip tone="warning">No subject selected</Chip>
          <p className="font-body text-body-md text-on-surface-variant">
            Pick a subject to see its units.
          </p>
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
            Loading {activeSubject.name}…
          </p>
        </div>
      </main>
    );
  }

  const handleOpenUnit = (unit: SubjectAnalysisDivision) => {
    selectDivision(unit.id);
    setActiveView('workspace');
  };

  return (
    <main className="flex-1 overflow-y-auto bg-surface pt-4">
      <div className="mx-auto max-w-6xl px-8 py-12">
        <header className="mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <button
              type="button"
              onClick={() => setActiveView('workspace')}
              className="mb-3 inline-flex items-center gap-1.5 font-body text-body-sm text-primary hover:opacity-80"
            >
              <Icon name="arrow_back" size="xs" />
              Back to subject
            </button>
            <h1 className="font-display text-title-lg font-extrabold tracking-tight text-on-surface md:text-[2.75rem]">
              {activeSubject.name} units
            </h1>
            <p className="mt-3 max-w-2xl font-body text-body-md leading-relaxed text-on-surface-variant">
              A comprehensive breakdown of this subject. Each unit groups
              related source pages, key concepts, and problem types you can
              study in the workspace.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              size="md"
              leadingIcon={<Icon name="arrow_back" size="sm" />}
              onClick={() => setActiveView('workspace')}
            >
              Back to workspace
            </Button>
            <Button
              variant="tertiary"
              size="md"
              leadingIcon={<Icon name="style" size="sm" filled />}
              onClick={() => setActiveView('flashcard-decks')}
            >
              Flashcards
            </Button>
          </div>
        </header>

        {error ? (
          <div className="mb-6">
            <DismissibleBanner
              dismissKey={`units-load:${error}`}
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

        {analysisState ? (
          <div className="mb-6">
            <DismissibleBanner
              dismissKey={`units-analyzing:${analysisState.startedAt}`}
              variant="info"
            >
              Analysis is still running—this list will refresh once it
              completes.
            </DismissibleBanner>
          </div>
        ) : null}

        {!workspace?.analysis ? (
          <EmptyUnits
            title="This subject hasn't been analyzed yet"
            description="Run subject analysis from the workspace to generate AI units, key concepts, and problem types."
            action={
              <Button
                variant="primary"
                onClick={() => setActiveView('workspace')}
              >
                Open workspace
              </Button>
            }
          />
        ) : units.length === 0 ? (
          <EmptyUnits
            title="No units were produced by the latest analysis"
            description="Try importing more sources or re-running analysis from the workspace."
            action={
              <Button
                variant="secondary"
                onClick={() => setActiveView('workspace')}
                leadingIcon={<Icon name="arrow_back" size="sm" />}
              >
                Back to workspace
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {units.map((unit, index) => (
              <UnitCard
                key={unit.id}
                unit={unit}
                index={index}
                onOpen={() => handleOpenUnit(unit)}
                featured={index === 2 && units.length >= 4}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
};

type UnitCardProps = {
  unit: SubjectAnalysisDivision;
  index: number;
  featured?: boolean;
  onOpen: () => void;
};

const UnitCard = ({ unit, index, featured, onOpen }: UnitCardProps) => {
  const numberLabel = (index + 1).toString().padStart(2, '0');
  if (featured) {
    return (
      <article className="group relative col-span-full overflow-hidden rounded-card shadow-elevated lg:col-span-2">
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Open ${unit.title}`}
          className="relative block w-full overflow-hidden bg-gradient-to-br from-primary to-secondary p-10 text-left text-on-primary transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          <span
            className="pointer-events-none absolute right-6 top-6 font-display text-[5rem] font-black text-on-primary/10"
            aria-hidden
          >
            {numberLabel}
          </span>
          <Icon
            name={unitIcon(unit, index)}
            size="xl"
            className="pointer-events-none absolute -bottom-8 -right-6 text-on-primary/10"
            filled
          />
          <div className="relative z-10 flex flex-col gap-4">
            <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-on-primary/10 px-3 py-1 font-body text-label-sm font-semibold uppercase tracking-widest text-on-primary/90">
              <Icon name="star" size="xs" filled /> Featured unit
            </div>
            <h3 className="font-display text-title-md font-extrabold">
              {unit.title}
            </h3>
            <p className="max-w-xl font-body text-body-md leading-relaxed text-on-primary/85">
              {unit.summary}
            </p>
            <div className="flex flex-wrap items-center gap-2 font-body text-label-sm text-on-primary/80">
              <Chip tone="default" className="bg-on-primary/15 text-on-primary">
                {unit.sourcePages.length} page
                {unit.sourcePages.length === 1 ? '' : 's'}
              </Chip>
              {unit.problemTypes.length > 0 ? (
                <Chip tone="default" className="bg-on-primary/15 text-on-primary">
                  {unit.problemTypes.length} problem type
                  {unit.problemTypes.length === 1 ? '' : 's'}
                </Chip>
              ) : null}
            </div>
            <div className="mt-2 inline-flex w-fit items-center gap-2 font-display text-body-sm font-bold uppercase tracking-wider text-on-primary/90 transition-transform group-hover:translate-x-0.5">
              Open module
              <Icon name="arrow_forward" size="sm" />
            </div>
          </div>
        </button>
      </article>
    );
  }

  return (
    <article
      className={cn(
        'group relative overflow-hidden rounded-card border border-outline-variant/15 bg-surface-container-lowest shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-elevated focus-within:-translate-y-0.5 focus-within:border-primary/40 focus-within:shadow-elevated',
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${unit.title}`}
        className="block w-full rounded-card p-8 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      >
        <span
          className="pointer-events-none absolute right-6 top-6 font-display text-[3rem] font-black text-on-surface-variant/10 transition-colors group-hover:text-primary/15"
          aria-hidden
        >
          {numberLabel}
        </span>
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-container transition group-hover:bg-primary-container">
          <Icon
            name={unitIcon(unit, index)}
            size="lg"
            className="text-primary transition group-hover:text-on-primary-container"
          />
        </div>
        <h3 className="mb-3 font-display text-title-sm font-bold text-on-surface">
          {unit.title}
        </h3>
        <p className="mb-6 line-clamp-4 font-body text-body-sm leading-relaxed text-on-surface-variant">
          {unit.summary}
        </p>
        <div className="mb-5 flex flex-wrap gap-1.5">
          <Chip tone="default" className="px-2 py-0.5 text-body-xs">
            {unit.sourcePages.length} page
            {unit.sourcePages.length === 1 ? '' : 's'}
          </Chip>
          {unit.keyConcepts.length > 0 ? (
            <Chip tone="secondary" className="px-2 py-0.5 text-body-xs">
              {unit.keyConcepts.length} concept
              {unit.keyConcepts.length === 1 ? '' : 's'}
            </Chip>
          ) : null}
          {unit.problemTypes.length > 0 ? (
            <Chip tone="primary" className="px-2 py-0.5 text-body-xs">
              {unit.problemTypes.length} problem type
              {unit.problemTypes.length === 1 ? '' : 's'}
            </Chip>
          ) : null}
        </div>
        <div className="inline-flex items-center gap-2 font-display text-body-sm font-bold uppercase tracking-wider text-primary opacity-60 transition group-hover:opacity-100 group-focus-within:opacity-100">
          Open unit
          <Icon
            name="arrow_forward"
            size="sm"
            className="transition-transform group-hover:translate-x-0.5"
          />
        </div>
      </button>
    </article>
  );
};

type EmptyUnitsProps = {
  title: string;
  description: string;
  action?: React.ReactNode;
};

const EmptyUnits = ({ title, description, action }: EmptyUnitsProps) => (
  <div className="flex flex-col items-center gap-4 rounded-card border border-dashed border-outline-variant/30 bg-surface-container-low px-8 py-16 text-center">
    <Icon name="category" size="xl" className="text-on-surface-variant/40" />
    <h2 className="font-display text-title-sm font-bold text-on-surface">
      {title}
    </h2>
    <p className="max-w-md font-body text-body-sm text-on-surface-variant">
      {description}
    </p>
    {action}
  </div>
);
