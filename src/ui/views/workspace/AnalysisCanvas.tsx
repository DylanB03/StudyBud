import { useMemo } from 'react';

import type {
  CitationRef,
  PracticeSet,
  SubjectAnalysisDivision,
  SubjectAnalysisSummary,
} from '../../../shared/ipc';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { DismissibleBanner } from '../../components/DismissibleBanner';
import { Icon } from '../../components/Icon';
import { useAppState } from '../../state/AppState';
import { useSettings } from '../../state/SettingsState';
import {
  getAnalysisTextSourceLabel,
  getCitationKey,
  renderHighlightedText,
} from '../../state/helpers';
import { useWorkspace } from '../../state/WorkspaceState';
import { cn } from '../../theme/cn';
import { CitationPreviewCard } from './CitationPreviewCard';
import { PdfViewer } from './PdfViewer';
import { PracticePanel } from './PracticePanel';
import { useSelectionCapture } from './useSelectionCapture';

type AnalysisCanvasProps = {
  /**
   * Optional ref attached to the bottom document viewer section so the
   * workspace can scroll to it when the user jumps to a citation. The real
   * PDF viewer lands in Phase 3c; for now we render a placeholder target.
   */
  documentViewerRef?: React.Ref<HTMLElement>;
};

export const AnalysisCanvas = ({ documentViewerRef }: AnalysisCanvasProps) => {
  const { isOnline } = useAppState();
  const { settings } = useSettings();
  const {
    workspace,
    analysisState,
    analysisElapsed,
    analysisError,
    analyze,
    selectedDivisionId,
    practiceProblemTypeId,
    setPracticeProblemTypeId,
    practiceDifficulty,
    setPracticeDifficulty,
    practiceCount,
    setPracticeCount,
    practiceBusy,
    practiceError,
    lastPracticeRequest,
    generatePractice,
    retryPractice,
    revealPracticeAnswer,
    deletePracticeSet,
    selectedCitationKey,
    setSelectedCitationKey,
    rightRailTab,
    chatBusy,
    importDocuments,
    selectDocument,
    setSelectedPage,
    selectedDocumentId,
    selectedPageNumber,
    documentDetail,
    documentBytes,
    documentBytesCache,
  } = useWorkspace();
  const { capture } = useSelectionCapture();

  const selectedDivision = useMemo<SubjectAnalysisDivision | null>(() => {
    if (!workspace?.analysis || !selectedDivisionId) return null;
    return (
      workspace.analysis.divisions.find((d) => d.id === selectedDivisionId) ??
      null
    );
  }, [workspace, selectedDivisionId]);

  const divisionPracticeSets = useMemo<PracticeSet[]>(() => {
    if (!workspace || !selectedDivision) return [];
    return workspace.practiceSets.filter(
      (set) => set.divisionId === selectedDivision.id,
    );
  }, [workspace, selectedDivision]);

  const selectedCitation = useMemo<CitationRef | null>(() => {
    if (!workspace?.analysis || !selectedCitationKey) return null;
    const allCitations: CitationRef[] = [];
    for (const d of workspace.analysis.divisions) {
      for (const p of d.sourcePages) allCitations.push(p);
    }
    return allCitations.find((c) => getCitationKey(c) === selectedCitationKey) ?? null;
  }, [workspace, selectedCitationKey]);

  const analysisReady =
    settings.aiProvider === 'openai'
      ? settings.openAiApiKeyConfigured && isOnline
      : settings.ollamaModel.trim().length > 0;

  const unitActionBlockedReason = useMemo<string | null>(() => {
    if (!analysisReady) {
      return settings.aiProvider === 'openai'
        ? 'Add an OpenAI API key in Settings to enable AI actions.'
        : 'Set an Ollama model in Settings to enable AI actions.';
    }
    if (!selectedDivision) {
      return 'Select a unit to work with.';
    }
    return null;
  }, [analysisReady, selectedDivision, settings.aiProvider]);

  const handleOpenCitation = (citation: CitationRef) => {
    setSelectedCitationKey(getCitationKey(citation));
    selectDocument(citation.documentId, citation.pageNumber);
    setSelectedPage(citation.pageNumber);
  };

  const isEmptyDocuments = (workspace?.documents.length ?? 0) === 0;
  const anyReady =
    workspace?.documents.some((d) => d.importStatus === 'ready') ?? false;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain px-8 pb-12">
      {analysisState ? (
        <div className="flex items-center justify-between gap-4 rounded-card bg-surface-container-high px-5 py-3">
          <div>
            <strong className="font-display text-body-md text-on-surface">
              Analysis in progress…
            </strong>
            <p className="mt-0.5 font-body text-body-xs text-on-surface-variant">
              {analysisState.provider} • {analysisState.model} • elapsed{' '}
              {analysisElapsed}
            </p>
          </div>
          <Chip tone="primary" className="px-2 py-0.5 text-body-xs">
            running
          </Chip>
        </div>
      ) : null}

      {analysisError ? (
        <DismissibleBanner
          dismissKey={`analysis-error:${analysisError}`}
          variant="error"
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void analyze()}
              disabled={Boolean(analysisState)}
            >
              Retry analysis
            </Button>
          }
        >
          {analysisError}
        </DismissibleBanner>
      ) : null}

      {!isOnline && settings.aiProvider === 'openai' ? (
        <DismissibleBanner
          dismissKey="workspace-offline-openai"
          variant="warning"
        >
          You are offline. OpenAI-powered analysis and chat will not work until
          connectivity returns or you switch to a local Ollama provider in
          Settings.
        </DismissibleBanner>
      ) : null}

      {!isOnline && rightRailTab === 'research' ? (
        <DismissibleBanner
          dismissKey="workspace-offline-research"
          variant="warning"
        >
          Web research, browser loading, and external research links are
          unavailable while offline.
        </DismissibleBanner>
      ) : null}

      {/* Empty states */}
      {isEmptyDocuments ? (
        <div className="flex flex-col items-center gap-4 rounded-card border border-dashed border-outline-variant/60 bg-surface-container-lowest px-8 py-16 text-center">
          <Icon name="upload_file" size="xl" className="text-primary" />
          <h3 className="font-display text-title-md text-on-surface">
            Import your first PDFs
          </h3>
          <p className="max-w-md font-body text-body-sm text-on-surface-variant">
            Bring in lecture slides and homework assignments. StudyBud extracts
            the text, then AI-generates units, key concepts, and practice
            material.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<Icon name="upload_file" size="sm" />}
              onClick={() => void importDocuments('lecture')}
            >
              Import lectures
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<Icon name="assignment" size="sm" />}
              onClick={() => void importDocuments('homework')}
            >
              Import homework
            </Button>
          </div>
        </div>
      ) : !anyReady ? (
        <div className="rounded-card border border-outline-variant/40 bg-surface-container-lowest px-6 py-8 text-center">
          <h3 className="font-display text-title-sm text-on-surface">
            No import-ready documents
          </h3>
          <p className="mt-1 font-body text-body-sm text-on-surface-variant">
            Re-import the PDFs or remove failed files before running analysis.
          </p>
        </div>
      ) : !workspace?.analysis ? (
        <div className="flex flex-col items-center gap-4 rounded-card border border-outline-variant/40 bg-surface-container-lowest px-8 py-12 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-on-primary shadow-ambient">
            <Icon name="bolt" filled />
          </span>
          <h3 className="font-display text-title-md text-on-surface">
            Analyze this subject
          </h3>
          <p className="max-w-md font-body text-body-sm text-on-surface-variant">
            Extract units, key concepts, and problem types from the imported
            PDFs. You can re-run the analysis any time.
          </p>
          <Button
            variant="primary"
            leadingIcon={<Icon name="bolt" size="sm" filled />}
            onClick={() => void analyze()}
            disabled={!analysisReady || Boolean(analysisState)}
            loading={Boolean(analysisState)}
          >
            Analyze subject
          </Button>
        </div>
      ) : !selectedDivision ? (
        <div className="rounded-card border border-outline-variant/40 bg-surface-container-lowest px-6 py-10 text-center">
          <h3 className="font-display text-title-sm text-on-surface">
            Open a unit to continue
          </h3>
          <p className="mt-1 font-body text-body-sm text-on-surface-variant">
            Use the Units tab in the top navigation to pick which unit you want
            to study next.
          </p>
        </div>
      ) : (
        <section className="flex w-full flex-col gap-6">
          <DivisionFocusCard
            division={selectedDivision}
            onSummaryMouseUp={() =>
              capture({
                kind: 'division-summary',
                surroundingText: selectedDivision.summary,
              })
            }
            onKeyConceptMouseUp={(concept) =>
              capture({
                kind: 'division-summary',
                surroundingText: [
                  selectedDivision.title,
                  selectedDivision.summary,
                  concept,
                ]
                  .filter(Boolean)
                  .join(' '),
              })
            }
            onProblemTypeMouseUp={(problemType) =>
              capture({
                kind: 'division-summary',
                surroundingText: [
                  selectedDivision.title,
                  problemType.title,
                  problemType.description,
                ]
                  .filter(Boolean)
                  .join(' '),
              })
            }
          />

          <PracticePanel
            division={selectedDivision}
            practiceSets={divisionPracticeSets}
            selectedProblemTypeId={practiceProblemTypeId ?? ''}
            onSelectedProblemTypeChange={(value) =>
              setPracticeProblemTypeId(value || null)
            }
            difficulty={practiceDifficulty}
            onDifficultyChange={setPracticeDifficulty}
            count={practiceCount}
            onCountChange={(value) => setPracticeCount(Math.min(8, Math.max(1, value)))}
            onGenerate={() => void generatePractice()}
            onRevealAnswer={(questionId) => {
              void revealPracticeAnswer(questionId);
            }}
            onDeletePracticeSet={(set) => {
              void deletePracticeSet(set.id);
            }}
            onRegeneratePracticeSet={() => {
              void generatePractice();
            }}
            onExplainQuestion={() => {
              /* wired in Phase 3d chat */
            }}
            onExplainAnswer={() => {
              /* wired in Phase 3d chat */
            }}
            onQuestionSelection={(practiceSet, question) =>
              capture({
                kind: 'practice-question',
                surroundingText: [
                  selectedDivision.title,
                  practiceSet.problemTypeTitle,
                  practiceSet.difficulty,
                  question.prompt,
                ]
                  .filter(Boolean)
                  .join(' '),
                sourcePageIds:
                  practiceSet.sourcePages.length > 0
                    ? practiceSet.sourcePages.map((p) => p.pageId)
                    : selectedDivision.sourcePages.map((p) => p.pageId),
              })
            }
            onAnswerSelection={(practiceSet, question) =>
              capture({
                kind: 'practice-answer',
                surroundingText: [
                  selectedDivision.title,
                  practiceSet.problemTypeTitle,
                  practiceSet.difficulty,
                  question.prompt,
                  question.answer,
                ]
                  .filter(Boolean)
                  .join(' '),
                sourcePageIds:
                  practiceSet.sourcePages.length > 0
                    ? practiceSet.sourcePages.map((p) => p.pageId)
                    : selectedDivision.sourcePages.map((p) => p.pageId),
              })
            }
            canGenerate={
              !practiceBusy &&
              practiceProblemTypeId !== null &&
              practiceCount >= 1 &&
              practiceCount <= 8 &&
              analysisReady
            }
            generateBusy={practiceBusy}
            chatBusy={chatBusy}
            aiActionsEnabled={!unitActionBlockedReason}
            disabledReason={unitActionBlockedReason}
            errorMessage={practiceError}
            onRetryGenerate={
              lastPracticeRequest ? () => void retryPractice() : null
            }
          />

          {selectedCitation ? (
            <article className="flex flex-col gap-3 rounded-card border border-primary/30 bg-surface-container-lowest p-6 shadow-soft">
              <header className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-display text-title-sm text-on-surface">
                    Focused source evidence
                  </h4>
                  <p className="mt-1 font-body text-body-sm text-on-surface-variant">
                    {selectedCitation.documentName} • page{' '}
                    {selectedCitation.pageNumber}
                  </p>
                </div>
                <Chip
                  tone={selectedCitation.documentKind === 'lecture' ? 'primary' : 'tertiary'}
                  className="px-2 py-0.5 text-body-xs"
                >
                  {selectedCitation.documentKind}
                </Chip>
              </header>
              <p
                className="rounded-md bg-surface-container-low p-4 font-body text-body-sm italic leading-relaxed text-on-surface-variant"
                onMouseUp={() =>
                  capture({
                    kind: 'division-summary',
                    surroundingText: selectedCitation.excerptText,
                    pageId: selectedCitation.pageId,
                    documentId: selectedCitation.documentId,
                    documentName: selectedCitation.documentName,
                    documentKind: selectedCitation.documentKind,
                    pageNumber: selectedCitation.pageNumber,
                  })
                }
              >
                {renderHighlightedText(
                  selectedCitation.excerptText,
                  selectedCitation.highlightText,
                )}
              </p>
            </article>
          ) : null}

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-display text-body-sm font-bold uppercase tracking-widest text-on-surface-variant">
                <Icon name="menu_book" size="sm" /> Referenced pages
              </h3>
              <span className="font-body text-body-sm text-on-surface-variant">
                {selectedDivision.sourcePages.length}
              </span>
            </div>
            {selectedDivision.sourcePages.length === 0 ? (
              <p className="rounded-card border border-outline-variant/40 bg-surface-container-lowest p-6 text-center font-body text-body-sm text-on-surface-variant">
                No cited pages were available for this unit.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                {selectedDivision.sourcePages.map((citation) => (
                  <CitationPreviewCard
                    key={`${selectedDivision.id}:${citation.pageId}`}
                    citation={citation}
                    documentBytes={documentBytesCache[citation.documentId] ?? null}
                    active={
                      selectedCitationKey === getCitationKey(citation)
                    }
                    onClick={() => handleOpenCitation(citation)}
                    onTextSelection={(cit) =>
                      capture({
                        kind: 'division-summary',
                        surroundingText: cit.excerptText,
                        pageId: cit.pageId,
                        documentId: cit.documentId,
                        documentName: cit.documentName,
                        documentKind: cit.documentKind,
                        pageNumber: cit.pageNumber,
                      })
                    }
                  />
                ))}
              </div>
            )}
          </section>

          {workspace.analysis.unassignedPages.length > 0 ? (
            <UnassignedPagesSection
              pages={workspace.analysis.unassignedPages}
              onPageMouseUp={(page) =>
                capture({
                  kind: 'division-summary',
                  surroundingText: `${page.documentName} page ${page.pageNumber} ${page.reason ?? ''}`,
                  pageId: page.pageId,
                  documentId: page.documentId,
                  documentName: page.documentName,
                  documentKind: page.documentKind,
                  pageNumber: page.pageNumber,
                })
              }
            />
          ) : null}
        </section>
      )}

      <section
        ref={documentViewerRef}
        className={cn(
          'mt-6 flex flex-col gap-4 rounded-card border border-outline-variant/20 bg-surface-container-lowest p-4',
        )}
      >
        <header className="flex items-center gap-2 px-2">
          <Icon name="menu_book" size="sm" className="text-primary" />
          <h3 className="font-display text-body-sm font-bold uppercase tracking-widest text-on-surface-variant">
            Source viewer
          </h3>
          {documentDetail ? (
            <span className="font-body text-body-sm text-on-surface-variant">
              {documentDetail.originalFileName}
            </span>
          ) : null}
        </header>

        {!selectedDocumentId || !documentDetail ? (
          <p className="rounded-md border border-dashed border-outline-variant/40 bg-surface-container-low px-6 py-10 text-center font-body text-body-sm text-on-surface-variant">
            Click a cited page above to open the document here.
          </p>
        ) : documentDetail.importStatus !== 'ready' ? (
          <p className="rounded-md border border-error/30 bg-error/5 px-6 py-8 text-center font-body text-body-sm text-on-surface">
            {documentDetail.errorMessage ??
              'This document did not import successfully.'}
          </p>
        ) : (
          <>
            <PdfViewer
              documentBytes={documentBytes}
              pages={documentDetail.pages}
              selectedPageNumber={selectedPageNumber ?? 1}
              onSelectPage={setSelectedPage}
              focusText={
                selectedCitation &&
                selectedCitation.documentId === documentDetail.id &&
                selectedCitation.pageNumber === selectedPageNumber
                  ? selectedCitation.highlightText
                  : null
              }
            />

            <PageTextList
              onPageMouseUp={(page) =>
                capture({
                  kind: 'page-text',
                  surroundingText: page.textContent,
                  pageId: page.id,
                  documentId: documentDetail.id,
                  documentName: documentDetail.originalFileName,
                  documentKind: documentDetail.kind,
                  pageNumber: page.pageNumber,
                })
              }
            />
          </>
        )}
      </section>
    </div>
  );
};

type PageTextListProps = {
  onPageMouseUp: (page: NonNullable<
    ReturnType<typeof useWorkspace>['documentDetail']
  >['pages'][number]) => void;
};

const PageTextList = ({ onPageMouseUp }: PageTextListProps) => {
  const {
    documentDetail,
    selectedPageNumber,
    setSelectedPage,
    selectedCitationKey,
  } = useWorkspace();
  if (!documentDetail) return null;
  return (
    <section className="flex flex-col gap-2 px-2">
      <div className="flex items-center justify-between">
        <h4 className="font-display text-body-sm font-bold uppercase tracking-widest text-on-surface-variant">
          Extracted page text
        </h4>
        <span className="font-body text-body-sm text-on-surface-variant">
          {documentDetail.pages.length} pages
        </span>
      </div>
      <div className="flex max-h-80 flex-col gap-1 overflow-y-auto pr-1">
        {documentDetail.pages.map((page) => (
          <button
            key={page.id}
            type="button"
            onClick={() => setSelectedPage(page.pageNumber)}
            className={cn(
              'flex flex-col gap-1 rounded-md px-3 py-2 text-left transition-colors',
              selectedPageNumber === page.pageNumber
                ? 'bg-primary/10 ring-1 ring-primary/40'
                : 'bg-surface-container-low hover:bg-surface-container',
            )}
          >
            <div className="flex items-center gap-2">
              <strong className="font-display text-body-sm text-on-surface">
                Page {page.pageNumber}
              </strong>
              {selectedCitationKey ? null : null}
            </div>
            <p
              className="line-clamp-3 font-body text-body-xs text-on-surface-variant"
              onMouseUp={() => onPageMouseUp(page)}
            >
              {page.previewText || 'No text extracted on this page.'}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
};

type DivisionFocusCardProps = {
  division: SubjectAnalysisDivision;
  onSummaryMouseUp: () => void;
  onKeyConceptMouseUp: (concept: string) => void;
  onProblemTypeMouseUp: (problemType: {
    title: string;
    description: string;
  }) => void;
};

const DivisionFocusCard = ({
  division,
  onSummaryMouseUp,
  onKeyConceptMouseUp,
  onProblemTypeMouseUp,
}: DivisionFocusCardProps) => {
  return (
    <article className="group relative flex flex-col gap-5 rounded-card border border-outline-variant/20 bg-surface-container-lowest p-8 shadow-soft">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h2
            className="font-display text-title-lg font-bold text-on-surface"
            onMouseUp={onSummaryMouseUp}
          >
            {division.title}
          </h2>
          {division.summary ? (
            <p
              className="font-body text-body-md leading-relaxed text-on-surface-variant"
              onMouseUp={onSummaryMouseUp}
            >
              {division.summary}
            </p>
          ) : null}
        </div>
        <Chip tone="secondary" className="shrink-0">
          {division.problemTypes.length} problem
          {division.problemTypes.length === 1 ? '' : 's'}
        </Chip>
      </header>

      {division.keyConcepts.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="font-display text-body-xs font-bold uppercase tracking-widest text-primary">
            Key concepts
          </span>
          <div className="flex flex-wrap gap-2">
            {division.keyConcepts.map((concept) => (
              <Chip
                key={`${division.id}:${concept}`}
                tone="default"
                className="px-3 py-1 text-body-sm"
                onMouseUp={() => onKeyConceptMouseUp(concept)}
              >
                {concept}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}

      {division.problemTypes.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="font-display text-body-xs font-bold uppercase tracking-widest text-secondary">
            Problem types
          </span>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {division.problemTypes.map((problemType) => (
              <article
                key={problemType.id}
                className="flex flex-col gap-1 rounded-md border border-outline-variant/30 bg-surface-container-low p-4"
                onMouseUp={() => onProblemTypeMouseUp(problemType)}
              >
                <strong className="font-display text-body-md text-on-surface">
                  {problemType.title}
                </strong>
                <p className="font-body text-body-sm text-on-surface-variant">
                  {problemType.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
};

type UnassignedPage = SubjectAnalysisSummary['unassignedPages'][number];

type UnassignedPagesSectionProps = {
  pages: UnassignedPage[];
  onPageMouseUp: (page: UnassignedPage) => void;
};

const UnassignedPagesSection = ({
  pages,
  onPageMouseUp,
}: UnassignedPagesSectionProps) => {
  return (
    <article className="flex flex-col gap-3 rounded-card border border-outline-variant/30 bg-surface-container-low p-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-display text-title-sm text-on-surface">
            Unassigned pages
          </h4>
          <p className="mt-1 font-body text-body-sm text-on-surface-variant">
            These pages did not clearly fit a unit in the latest pass.
          </p>
        </div>
        <Chip tone="warning" className="shrink-0">
          {pages.length}
        </Chip>
      </header>
      <ul className="flex flex-col gap-1">
        {pages.map((page) => (
          <li
            key={page.id}
            className="flex items-center justify-between gap-3 rounded-md bg-surface-container-lowest px-3 py-2 font-body text-body-sm text-on-surface-variant"
            onMouseUp={() => onPageMouseUp(page)}
          >
            <span>
              {page.documentName} • page {page.pageNumber}
              {page.reason ? ` — ${page.reason}` : ''}
            </span>
            <Chip tone="default" className="shrink-0 px-2 py-0.5 text-body-xs">
              {getAnalysisTextSourceLabel(page.textSource)}
            </Chip>
          </li>
        ))}
      </ul>
    </article>
  );
};
