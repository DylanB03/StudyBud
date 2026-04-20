import { useMemo, useState } from 'react';

import type { DocumentKind, SourceDocumentSummary } from '../../../shared/ipc';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { Icon } from '../../components/Icon';
import { useAppState } from '../../state/AppState';
import { useSubjects } from '../../state/SubjectsState';
import { useWorkspace } from '../../state/WorkspaceState';
import { cn } from '../../theme/cn';

type FilterKind = 'all' | DocumentKind;

export const DocumentsView = () => {
  const { setActiveView } = useAppState();
  const { activeSubject } = useSubjects();
  const {
    workspace,
    loading,
    importDocuments,
    importingKind,
    deleteDocument,
  } = useWorkspace();

  const [filter, setFilter] = useState<FilterKind>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const documents = useMemo(
    () => workspace?.documents ?? [],
    [workspace],
  );

  const filtered = useMemo(() => {
    if (filter === 'all') return documents;
    return documents.filter((d) => d.kind === filter);
  }, [documents, filter]);

  const lectureCount = useMemo(
    () => documents.filter((d) => d.kind === 'lecture').length,
    [documents],
  );

  const homeworkCount = useMemo(
    () => documents.filter((d) => d.kind === 'homework').length,
    [documents],
  );

  const handleDelete = async (doc: SourceDocumentSummary) => {
    setDeletingId(doc.id);
    try {
      await deleteDocument(doc.id);
    } finally {
      setDeletingId(null);
    }
  };

  if (!activeSubject) {
    return (
      <main className="flex flex-1 items-center justify-center px-8 py-16">
        <div className="flex flex-col items-center gap-4 text-center">
          <Chip tone="warning">No subject selected</Chip>
          <p className="font-body text-body-md text-on-surface-variant">
            Pick a subject to manage its documents.
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
            Loading documents…
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto bg-surface pt-4">
      <div className="mx-auto max-w-5xl px-8 py-12">
        <header className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-display text-title-lg font-extrabold tracking-tight text-on-surface md:text-[2.75rem]">
              Documents
            </h1>
            <p className="mt-3 max-w-2xl font-body text-body-md leading-relaxed text-on-surface-variant">
              All lecture slides and homework assignments for{' '}
              <strong className="font-semibold text-on-surface">
                {activeSubject.name}
              </strong>
              . Upload more to expand your study material.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="md"
              leadingIcon={<Icon name="upload_file" size="sm" />}
              loading={importingKind === 'lecture'}
              onClick={() => void importDocuments('lecture')}
            >
              Import lectures
            </Button>
            <Button
              variant="secondary"
              size="md"
              leadingIcon={<Icon name="assignment" size="sm" />}
              loading={importingKind === 'homework'}
              onClick={() => void importDocuments('homework')}
            >
              Import homework
            </Button>
          </div>
        </header>

        {documents.length > 0 && (
          <div className="mb-6 flex items-center gap-2">
            <FilterChip
              label={`All (${documents.length})`}
              active={filter === 'all'}
              onClick={() => setFilter('all')}
            />
            <FilterChip
              label={`Lectures (${lectureCount})`}
              active={filter === 'lecture'}
              onClick={() => setFilter('lecture')}
            />
            <FilterChip
              label={`Homework (${homeworkCount})`}
              active={filter === 'homework'}
              onClick={() => setFilter('homework')}
            />
          </div>
        )}

        {documents.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-card border border-dashed border-outline-variant/60 bg-surface-container-lowest px-8 py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Icon name="upload_file" size="xl" className="text-primary" />
            </div>
            <h3 className="font-display text-title-md text-on-surface">
              No documents yet
            </h3>
            <p className="max-w-md font-body text-body-sm text-on-surface-variant">
              Import lecture slides and homework assignments to get started.
              StudyBud will extract text from your PDFs so AI can generate
              units, key concepts, and practice material.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <Button
                variant="primary"
                size="sm"
                leadingIcon={<Icon name="upload_file" size="sm" />}
                loading={importingKind === 'lecture'}
                onClick={() => void importDocuments('lecture')}
              >
                Import lectures
              </Button>
              <Button
                variant="secondary"
                size="sm"
                leadingIcon={<Icon name="assignment" size="sm" />}
                loading={importingKind === 'homework'}
                onClick={() => void importDocuments('homework')}
              >
                Import homework
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((doc) => (
              <DocumentRow
                key={doc.id}
                document={doc}
                deleting={deletingId === doc.id}
                onDelete={() => void handleDelete(doc)}
              />
            ))}
            {filtered.length === 0 && (
              <p className="py-10 text-center font-body text-body-sm text-on-surface-variant">
                No {filter === 'lecture' ? 'lecture' : 'homework'} documents
                found.
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
};

type DocumentRowProps = {
  document: SourceDocumentSummary;
  deleting: boolean;
  onDelete: () => void;
};

const DocumentRow = ({ document: doc, deleting, onDelete }: DocumentRowProps) => {
  const statusTone =
    doc.importStatus === 'ready' ? 'success' : 'error';

  return (
    <article className="group flex items-center gap-4 rounded-card border border-outline-variant/15 bg-surface-container-lowest p-4 shadow-soft transition-all hover:border-primary/20 hover:shadow-elevated">
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
          doc.kind === 'lecture'
            ? 'bg-primary/10 text-primary'
            : 'bg-tertiary/10 text-tertiary',
        )}
      >
        <Icon
          name={doc.kind === 'lecture' ? 'slideshow' : 'assignment'}
          size="md"
        />
      </div>

      <div className="min-w-0 flex-1">
        <h4 className="truncate font-display text-body-md font-semibold text-on-surface">
          {doc.originalFileName}
        </h4>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 font-body text-body-xs text-on-surface-variant">
          <span>
            {doc.pageCount} page{doc.pageCount === 1 ? '' : 's'}
          </span>
          <span aria-hidden className="text-outline-variant">
            ·
          </span>
          <span className="capitalize">{doc.kind}</span>
          {doc.ocrState !== 'not-needed' && (
            <>
              <span aria-hidden className="text-outline-variant">
                ·
              </span>
              <span className="uppercase">OCR {doc.ocrState}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Chip
          tone={statusTone}
          className="px-2 py-0.5 text-body-xs capitalize"
        >
          {doc.importStatus}
        </Chip>
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          aria-label={`Delete ${doc.originalFileName}`}
          className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant/0 transition-all group-hover:text-on-surface-variant hover:!bg-error/10 hover:!text-error focus-visible:text-on-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40 disabled:opacity-50"
        >
          {deleting ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <Icon name="delete" size="sm" />
          )}
        </button>
      </div>
    </article>
  );
};

type FilterChipProps = {
  label: string;
  active: boolean;
  onClick: () => void;
};

const FilterChip = ({ label, active, onClick }: FilterChipProps) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'rounded-full px-4 py-1.5 font-body text-label-md font-medium transition-all',
      active
        ? 'bg-primary text-on-primary shadow-ambient'
        : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high',
    )}
  >
    {label}
  </button>
);
