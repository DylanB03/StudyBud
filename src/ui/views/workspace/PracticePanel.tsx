import { useEffect, useState } from 'react';

import type {
  PracticeDifficulty,
  PracticeQuestion,
  PracticeSet,
  SubjectAnalysisDivision,
} from '../../../shared/ipc';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Chip } from '../../components/Chip';
import { DismissibleBanner } from '../../components/DismissibleBanner';
import { FieldGroup, Input, Select } from '../../components/Input';
import { Icon } from '../../components/Icon';

type PracticePanelProps = {
  division: SubjectAnalysisDivision;
  practiceSets: PracticeSet[];
  selectedProblemTypeId: string;
  onSelectedProblemTypeChange: (value: string) => void;
  difficulty: PracticeDifficulty;
  onDifficultyChange: (value: PracticeDifficulty) => void;
  count: number;
  onCountChange: (value: number) => void;
  onGenerate: () => void;
  onRevealAnswer: (questionId: string) => void;
  onDeletePracticeSet: (practiceSet: PracticeSet) => void;
  onRegeneratePracticeSet: (practiceSet: PracticeSet) => void;
  onExplainQuestion: (practiceSet: PracticeSet, question: PracticeQuestion) => void;
  onExplainAnswer: (practiceSet: PracticeSet, question: PracticeQuestion) => void;
  onQuestionSelection: (practiceSet: PracticeSet, question: PracticeQuestion) => void;
  onAnswerSelection: (practiceSet: PracticeSet, question: PracticeQuestion) => void;
  canGenerate: boolean;
  generateBusy: boolean;
  chatBusy: boolean;
  aiActionsEnabled?: boolean;
  disabledReason?: string | null;
  errorMessage?: string | null;
  onRetryGenerate?: (() => void) | null;
  heading?: string;
  generateHelperText?: string;
  emptyStateWithoutProblemTypes?: string;
  emptyStateWithoutSets?: string;
};

const formatDateTime = (value: string): string => {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const PracticePanel = ({
  division,
  practiceSets,
  selectedProblemTypeId,
  onSelectedProblemTypeChange,
  difficulty,
  onDifficultyChange,
  count,
  onCountChange,
  onGenerate,
  onRevealAnswer,
  onDeletePracticeSet,
  onRegeneratePracticeSet,
  onExplainQuestion,
  onExplainAnswer,
  onQuestionSelection,
  onAnswerSelection,
  canGenerate,
  generateBusy,
  chatBusy,
  aiActionsEnabled = true,
  disabledReason = null,
  errorMessage = null,
  onRetryGenerate = null,
  heading = 'Practice Studio',
  generateHelperText = 'Generated sets stay saved under this division, and each answer key can be revealed only when you want it.',
  emptyStateWithoutProblemTypes = 'Analyze more material or refine this division before generating practice.',
  emptyStateWithoutSets = 'No saved practice sets for this division yet. Generate a set from one of the detected problem types above.',
}: PracticePanelProps) => {
  const [collapsedSets, setCollapsedSets] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setCollapsedSets((previous) => {
      const next: Record<string, boolean> = {};
      for (const practiceSet of practiceSets) {
        next[practiceSet.id] = previous[practiceSet.id] ?? false;
      }
      return next;
    });
  }, [practiceSets]);

  const toggleCollapsed = (practiceSetId: string) => {
    setCollapsedSets((previous) => ({
      ...previous,
      [practiceSetId]: !previous[practiceSetId],
    }));
  };

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h3 className="font-display text-title-md text-on-surface">{heading}</h3>
        <Chip tone="secondary">{practiceSets.length}</Chip>
      </header>

      {errorMessage ? (
        <DismissibleBanner
          dismissKey={`practice-error:${errorMessage}`}
          variant="error"
          action={
            onRetryGenerate ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRetryGenerate}
                disabled={generateBusy}
              >
                Retry
              </Button>
            ) : null
          }
        >
          <span>{errorMessage}</span>
        </DismissibleBanner>
      ) : null}

      {!aiActionsEnabled && disabledReason ? (
        <DismissibleBanner dismissKey={`practice-disabled:${disabledReason}`} variant="warning">
          {disabledReason}
        </DismissibleBanner>
      ) : null}

      <Card tone="lowest" elevated className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <FieldGroup label="Problem Type" htmlFor="practice-problem-type">
            <Select
              id="practice-problem-type"
              value={selectedProblemTypeId}
              onChange={(event) => onSelectedProblemTypeChange(event.target.value)}
              disabled={generateBusy || division.problemTypes.length === 0}
            >
              {division.problemTypes.map((problemType) => (
                <option key={problemType.id} value={problemType.id}>
                  {problemType.title}
                </option>
              ))}
            </Select>
          </FieldGroup>

          <FieldGroup label="Difficulty" htmlFor="practice-difficulty">
            <Select
              id="practice-difficulty"
              value={difficulty}
              onChange={(event) =>
                onDifficultyChange(event.target.value as PracticeDifficulty)
              }
              disabled={generateBusy}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </Select>
          </FieldGroup>

          <FieldGroup label="Question Count" htmlFor="practice-count">
            <Input
              id="practice-count"
              type="number"
              min={1}
              max={8}
              value={count}
              onChange={(event) => onCountChange(Number(event.target.value) || 1)}
              disabled={generateBusy}
            />
          </FieldGroup>
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <Button
            onClick={onGenerate}
            disabled={!canGenerate || !aiActionsEnabled}
            loading={generateBusy}
            leadingIcon={<Icon name="bolt" size="sm" />}
          >
            {generateBusy ? 'Generating Practice...' : 'Generate Practice'}
          </Button>
          <p className="font-body text-label-md text-on-surface-variant">
            {generateHelperText}
          </p>
        </div>
      </Card>

      {division.problemTypes.length === 0 ? (
        <Card tone="default" className="text-center font-body text-body-md text-on-surface-variant">
          {emptyStateWithoutProblemTypes}
        </Card>
      ) : practiceSets.length === 0 ? (
        <Card tone="default" className="text-center font-body text-body-md text-on-surface-variant">
          {emptyStateWithoutSets}
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {practiceSets.map((practiceSet) => (
            <Card
              key={practiceSet.id}
              tone="lowest"
              elevated
              className="flex flex-col gap-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1">
                  <button
                    type="button"
                    onClick={() => toggleCollapsed(practiceSet.id)}
                    className="flex items-center gap-2 font-display text-title-sm text-on-surface"
                  >
                    <Icon
                      name={collapsedSets[practiceSet.id] ? 'chevron_right' : 'expand_more'}
                      size="sm"
                      aria-hidden
                    />
                    <span>{practiceSet.problemTypeTitle}</span>
                  </button>
                  <p className="mt-1 font-body text-label-md text-on-surface-variant">
                    {practiceSet.difficulty} difficulty • {practiceSet.questionCount}{' '}
                    question{practiceSet.questionCount === 1 ? '' : 's'} • generated{' '}
                    {formatDateTime(practiceSet.createdAt)}
                  </p>
                  <p className="font-body text-label-md text-on-surface-variant">
                    Based on {practiceSet.sourcePages.length} source page
                    {practiceSet.sourcePages.length === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone="tertiary">{practiceSet.difficulty}</Chip>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRegeneratePracticeSet(practiceSet)}
                    disabled={generateBusy}
                  >
                    Regenerate
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeletePracticeSet(practiceSet)}
                    disabled={generateBusy}
                  >
                    Delete
                  </Button>
                </div>
              </div>

              {!collapsedSets[practiceSet.id] ? (
                <div className="flex flex-col gap-3">
                  {practiceSet.questions.map((question) => (
                    <article
                      key={question.id}
                      className="rounded-card-sm bg-surface-container-low p-4"
                    >
                      <header className="mb-2 flex items-center justify-between gap-2">
                        <strong className="font-display text-title-sm text-on-surface">
                          Question {question.questionIndex}
                        </strong>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onExplainQuestion(practiceSet, question)}
                          disabled={chatBusy || !aiActionsEnabled}
                        >
                          Explain Question
                        </Button>
                      </header>
                      <p
                        className="font-body text-body-md text-on-surface"
                        onMouseUp={() => onQuestionSelection(practiceSet, question)}
                      >
                        {question.prompt}
                      </p>

                      {!question.revealed ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="mt-3"
                          onClick={() => onRevealAnswer(question.id)}
                          disabled={generateBusy}
                        >
                          Show Answer Key
                        </Button>
                      ) : (
                        <div className="mt-3 rounded-card-sm bg-surface-container p-3">
                          <header className="mb-2 flex items-center justify-between gap-2">
                            <strong className="font-display text-title-sm text-on-surface">
                              Answer Key
                            </strong>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onRevealAnswer(question.id)}
                                disabled={generateBusy}
                              >
                                Hide Answer Key
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onExplainAnswer(practiceSet, question)}
                                disabled={chatBusy || !aiActionsEnabled}
                              >
                                Explain Answer
                              </Button>
                            </div>
                          </header>
                          <p
                            className="font-body text-body-md text-on-surface"
                            onMouseUp={() => onAnswerSelection(practiceSet, question)}
                          >
                            {question.answer}
                          </p>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </section>
  );
};
