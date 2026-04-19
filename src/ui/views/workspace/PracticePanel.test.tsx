import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { PracticeSet, SubjectAnalysisDivision } from '../../../shared/ipc';

import { PracticePanel } from './PracticePanel';

const division: SubjectAnalysisDivision = {
  id: 'division-1',
  title: 'Kinematics',
  summary: 'Study of motion with constant acceleration.',
  keyConcepts: ['velocity', 'acceleration'],
  sourcePages: [],
  problemTypes: [
    {
      id: 'problem-type-1',
      title: 'Constant acceleration motion',
      description: 'Apply kinematics equations to straight-line motion.',
    },
  ],
};

const practiceSet: PracticeSet = {
  id: 'practice-set-1',
  subjectId: 'subject-1',
  divisionId: 'division-1',
  problemTypeId: 'problem-type-1',
  problemTypeTitle: 'Constant acceleration motion',
  difficulty: 'medium',
  questionCount: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  sourcePages: [
    {
      pageId: 'page-1',
      documentId: 'document-1',
      documentName: 'lecture.pdf',
      documentKind: 'lecture',
      pageNumber: 3,
      excerptText: 'Acceleration is the rate of change of velocity.',
      highlightText: 'rate of change of velocity',
      thumbnailAssetPath: null,
      textBounds: null,
    },
  ],
  questions: [
    {
      id: 'question-1',
      questionIndex: 1,
      prompt: 'A car starts from rest and accelerates at 2 m/s^2 for 5 s. Find the final velocity.',
      answer: 'v = at = 10 m/s.',
      revealed: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
};

describe('PracticePanel', () => {
  it('renders management controls and persisted source-page metadata', () => {
    const markup = renderToStaticMarkup(
      <PracticePanel
        division={division}
        practiceSets={[practiceSet]}
        selectedProblemTypeId="problem-type-1"
        onSelectedProblemTypeChange={vi.fn()}
        difficulty="medium"
        onDifficultyChange={vi.fn()}
        count={1}
        onCountChange={vi.fn()}
        onGenerate={vi.fn()}
        onRevealAnswer={vi.fn()}
        onDeletePracticeSet={vi.fn()}
        onRegeneratePracticeSet={vi.fn()}
        onExplainQuestion={vi.fn()}
        onExplainAnswer={vi.fn()}
        onQuestionSelection={vi.fn()}
        onAnswerSelection={vi.fn()}
        canGenerate
        generateBusy={false}
        chatBusy={false}
      />,
    );

    expect(markup).toContain('Regenerate');
    expect(markup).toContain('Delete');
    expect(markup).toContain('Based on 1 source page');
    expect(markup).toContain('Hide Answer Key');
  });

  it('renders a retryable warning when practice generation fails', () => {
    const markup = renderToStaticMarkup(
      <PracticePanel
        division={division}
        practiceSets={[practiceSet]}
        selectedProblemTypeId="problem-type-1"
        onSelectedProblemTypeChange={vi.fn()}
        difficulty="medium"
        onDifficultyChange={vi.fn()}
        count={1}
        onCountChange={vi.fn()}
        onGenerate={vi.fn()}
        onRevealAnswer={vi.fn()}
        onDeletePracticeSet={vi.fn()}
        onRegeneratePracticeSet={vi.fn()}
        onExplainQuestion={vi.fn()}
        onExplainAnswer={vi.fn()}
        onQuestionSelection={vi.fn()}
        onAnswerSelection={vi.fn()}
        canGenerate
        generateBusy={false}
        chatBusy={false}
        errorMessage="Could not generate a practice set."
        onRetryGenerate={vi.fn()}
      />,
    );

    expect(markup).toContain('Could not generate a practice set.');
    expect(markup).toContain('Retry');
  });
});
