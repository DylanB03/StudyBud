import { useMemo, useState, type FormEvent } from 'react';

import type { SubjectSummary } from '../../shared/ipc';
import { Button } from '../components/Button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTrigger } from '../components/Dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/DropdownMenu';
import { FieldGroup, Input } from '../components/Input';
import { Icon } from '../components/Icon';
import { useAppState } from '../state/AppState';
import { useSubjects } from '../state/SubjectsState';
import { formatDate } from '../state/helpers';

type SortMode = 'updated' | 'created' | 'name';

const SORT_LABEL: Record<SortMode, string> = {
  updated: 'Last Updated',
  created: 'Date Created',
  name: 'Name',
};

const hashString = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const GRADIENTS: readonly string[] = [
  'from-primary/80 to-secondary/80',
  'from-secondary/80 to-tertiary-fixed-dim/90',
  'from-primary-fixed-dim/80 to-secondary-fixed-dim/90',
  'from-tertiary-fixed-dim/80 to-primary/70',
  'from-secondary-container/80 to-primary-fixed/90',
  'from-primary/70 to-primary-fixed-dim/80',
];

const subjectGradient = (subject: SubjectSummary): string =>
  GRADIENTS[hashString(subject.id) % GRADIENTS.length] ?? GRADIENTS[0] ?? '';

const SUBJECT_ICONS = [
  'experiment',
  'calculate',
  'palette',
  'biotech',
  'history_edu',
  'public',
  'account_balance',
  'school',
] as const;

const subjectIcon = (subject: SubjectSummary): string =>
  SUBJECT_ICONS[hashString(subject.name) % SUBJECT_ICONS.length] ??
  SUBJECT_ICONS[0] ??
  'school';

type SubjectCardProps = {
  subject: SubjectSummary;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
};

const SubjectCard = ({ subject, onOpen, onDelete }: SubjectCardProps) => {
  const iconName = subjectIcon(subject);
  const gradient = subjectGradient(subject);
  return (
    <article
      className="group relative flex flex-col rounded-card border border-outline-variant/10 bg-surface-container-lowest p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-elevated focus-within:-translate-y-1 focus-within:shadow-elevated"
    >
      <button
        type="button"
        onClick={() => onOpen(subject.id)}
        className="flex flex-col items-stretch gap-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-4 focus-visible:ring-offset-surface rounded-card"
      >
        <div
          className={`flex h-40 w-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br ${gradient}`}
        >
          <Icon
            name={iconName}
            size="xl"
            filled
            className="text-6xl text-on-primary drop-shadow-sm"
          />
        </div>
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-title-md text-on-surface">
              {subject.name}
            </h3>
          </div>
          <p className="mt-1 font-body text-label-md text-on-surface-variant">
            Open workspace to import documents and analyze.
          </p>
        </div>
      </button>
      <div className="mt-5 flex items-center justify-between border-t border-outline-variant/30 pt-4">
        <span className="font-body text-label-sm uppercase tracking-wider text-on-surface-variant">
          Last Modified
        </span>
        <span className="font-body text-label-md text-on-surface">
          {formatDate(subject.updatedAt)}
        </span>
      </div>

      <div className="absolute right-4 top-4 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Subject actions"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-high/90 text-on-surface-variant backdrop-blur-sm transition hover:bg-surface-container-highest hover:text-on-surface"
            >
              <Icon name="more_vert" size="sm" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onOpen(subject.id)}>
              <Icon name="open_in_full" size="sm" /> Open workspace
            </DropdownMenuItem>
            <DropdownMenuItem destructive onSelect={() => onDelete(subject.id)}>
              <Icon name="delete" size="sm" /> Delete subject
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  );
};

type CreateSubjectDialogProps = {
  onCreate: (name: string) => Promise<void>;
  busy: boolean;
};

const CreateSubjectDialog = ({ onCreate, busy }: CreateSubjectDialogProps) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please give the subject a name.');
      return;
    }
    setSubmitting(true);
    try {
      await onCreate(trimmed);
      setName('');
      setError(null);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setName('');
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          leadingIcon={<Icon name="add_circle" size="sm" filled />}
          disabled={busy}
        >
          Create New Subject
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader
          title="Create a new subject"
          description="Subjects keep lecture and homework PDFs organized together."
        />
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FieldGroup
            label="Subject name"
            htmlFor="new-subject-name"
            error={error ?? undefined}
          >
            <Input
              id="new-subject-name"
              autoFocus
              placeholder="e.g. Organic Chemistry"
              value={name}
              onChange={(event) => setName(event.target.value)}
              invalid={Boolean(error)}
            />
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Create subject
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

type DeleteConfirmationProps = {
  subject: SubjectSummary | null;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
  busy: boolean;
};

const DeleteConfirmation = ({ subject, onCancel, onConfirm, busy }: DeleteConfirmationProps) => (
  <Dialog open={Boolean(subject)} onOpenChange={(next) => !next && onCancel()}>
    <DialogContent>
      <DialogHeader
        title="Delete this subject?"
        description={
          subject
            ? `All documents, chat history, practice sets, and decks inside "${subject.name}" will be permanently deleted. This cannot be undone.`
            : ''
        }
      />
      <DialogFooter>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={busy}>
          Delete subject
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export const LibraryView = () => {
  const {
    subjects,
    busy,
    error,
    loaded,
    create,
    remove,
    setActive,
  } = useSubjects();
  const { setActiveView } = useAppState();

  const [sortMode, setSortMode] = useState<SortMode>('updated');
  const [deleteTarget, setDeleteTarget] = useState<SubjectSummary | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  const sortedSubjects = useMemo(() => {
    const list = [...subjects];
    list.sort((a, b) => {
      if (sortMode === 'name') return a.name.localeCompare(b.name);
      if (sortMode === 'created') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    return list;
  }, [subjects, sortMode]);

  const openSubject = (subjectId: string) => {
    setActive(subjectId);
    setActiveView('workspace');
  };

  const requestDelete = (subjectId: string) => {
    const match = subjects.find((subject) => subject.id === subjectId);
    if (match) {
      setDeleteTarget(match);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await remove(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      // error surfaces as notification
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main className="relative flex-1 bg-surface text-on-surface overflow-y-auto">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-8 py-12">
        <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-display text-display-md tracking-tight text-on-surface md:text-display-lg">
              Your Library
            </h1>
            <p className="mt-3 max-w-lg font-body text-body-lg text-on-surface-variant">
              Organize your subjects, curate your research, and let StudyBud
              bridge the gaps in your learning journey.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary">
                  Sort by: {SORT_LABEL[sortMode]}
                  <Icon name="expand_more" size="sm" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(Object.keys(SORT_LABEL) as SortMode[]).map((mode) => (
                  <DropdownMenuItem key={mode} onSelect={() => setSortMode(mode)}>
                    {SORT_LABEL[mode]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <CreateSubjectDialog
              busy={busy}
              onCreate={async (name) => {
                const subject = await create({ name });
                setActive(subject.id);
              }}
            />
          </div>
        </header>

        {error && (
          <div className="rounded-card-sm bg-error/10 px-4 py-3 font-body text-body-sm text-error">
            {error}
          </div>
        )}

        {loaded && subjects.length === 0 ? (
          <div className="rounded-card bg-surface-container-low p-16 text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary-container">
              <Icon
                name="auto_awesome"
                size="xl"
                filled
                className="text-on-primary-container"
              />
            </div>
            <h2 className="font-display text-title-lg text-on-surface">
              Start your first subject
            </h2>
            <p className="mx-auto mt-2 max-w-md font-body text-body-md text-on-surface-variant">
              Create a subject to import lecture notes, analyze them into units,
              and generate practice questions, flashcards, and chat.
            </p>
            <div className="mt-6 flex justify-center">
              <CreateSubjectDialog
                busy={busy}
                onCreate={async (name) => {
                  const subject = await create({ name });
                  setActive(subject.id);
                }}
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {sortedSubjects.map((subject) => (
              <SubjectCard
                key={subject.id}
                subject={subject}
                onOpen={openSubject}
                onDelete={requestDelete}
              />
            ))}
          </div>
        )}
      </div>

      <DeleteConfirmation
        subject={deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        busy={deleting}
      />
    </main>
  );
};
