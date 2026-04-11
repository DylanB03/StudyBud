import type {
  PracticeDifficulty,
  PracticeQuestion,
  PracticeSet,
  SubjectAnalysisDivision,
} from '../shared/ipc';

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
  onExplainQuestion: (practiceSet: PracticeSet, question: PracticeQuestion) => void;
  onExplainAnswer: (practiceSet: PracticeSet, question: PracticeQuestion) => void;
  onQuestionSelection: (practiceSet: PracticeSet, question: PracticeQuestion) => void;
  onAnswerSelection: (practiceSet: PracticeSet, question: PracticeQuestion) => void;
  canGenerate: boolean;
  generateBusy: boolean;
  chatBusy: boolean;
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
  onExplainQuestion,
  onExplainAnswer,
  onQuestionSelection,
  onAnswerSelection,
  canGenerate,
  generateBusy,
  chatBusy,
}: PracticePanelProps) => {
  return (
    <section className="analysis-panel practice-panel">
      <div className="sidebar-section-title">
        <h3>Practice Studio</h3>
        <span>{practiceSets.length}</span>
      </div>

      <div className="practice-generator-card">
        <div className="practice-generator-grid">
          <label>
            <span className="label">Problem Type</span>
            <select
              value={selectedProblemTypeId}
              onChange={(event) => onSelectedProblemTypeChange(event.target.value)}
              disabled={generateBusy || division.problemTypes.length === 0}
            >
              {division.problemTypes.map((problemType) => (
                <option key={problemType.id} value={problemType.id}>
                  {problemType.title}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="label">Difficulty</span>
            <select
              value={difficulty}
              onChange={(event) =>
                onDifficultyChange(event.target.value as PracticeDifficulty)
              }
              disabled={generateBusy}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </label>

          <label>
            <span className="label">Question Count</span>
            <input
              type="number"
              min={1}
              max={8}
              value={count}
              onChange={(event) => onCountChange(Number(event.target.value) || 1)}
              disabled={generateBusy}
            />
          </label>
        </div>

        <div className="practice-generator-actions">
          <button type="button" onClick={onGenerate} disabled={!canGenerate}>
            {generateBusy ? 'Generating Practice...' : 'Generate Practice'}
          </button>
          <p className="analysis-muted">
            Generated sets stay saved under this division, and each answer key can
            be revealed only when you want it.
          </p>
        </div>
      </div>

      {division.problemTypes.length === 0 ? (
        <div className="empty-state">
          Analyze more material or refine this division before generating practice.
        </div>
      ) : practiceSets.length === 0 ? (
        <div className="empty-state">
          No saved practice sets for this division yet. Generate a set from one of
          the detected problem types above.
        </div>
      ) : (
        <div className="practice-set-list">
          {practiceSets.map((practiceSet) => (
            <article key={practiceSet.id} className="practice-set-card">
              <div className="analysis-division-header">
                <div>
                  <h4>{practiceSet.problemTypeTitle}</h4>
                  <p>
                    {practiceSet.difficulty} difficulty • {practiceSet.questionCount}{' '}
                    question{practiceSet.questionCount === 1 ? '' : 's'} • generated{' '}
                    {formatDateTime(practiceSet.createdAt)}
                  </p>
                </div>
                <span className="analysis-count-pill">{practiceSet.difficulty}</span>
              </div>

              <div className="practice-question-list">
                {practiceSet.questions.map((question) => (
                  <article key={question.id} className="practice-question-card">
                    <div className="practice-question-header">
                      <strong>Question {question.questionIndex}</strong>
                      <div className="practice-question-actions">
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => onExplainQuestion(practiceSet, question)}
                          disabled={chatBusy}
                        >
                          Explain Question
                        </button>
                      </div>
                    </div>

                    <p
                      className="practice-question-copy"
                      onMouseUp={() => onQuestionSelection(practiceSet, question)}
                    >
                      {question.prompt}
                    </p>

                    {!question.revealed ? (
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => onRevealAnswer(question.id)}
                        disabled={generateBusy}
                      >
                        Show Answer Key
                      </button>
                    ) : (
                      <div className="practice-answer-panel">
                        <div className="practice-question-header">
                          <strong>Answer Key</strong>
                          <div className="practice-question-actions">
                            <button
                              type="button"
                              className="ghost-button"
                              onClick={() => onExplainAnswer(practiceSet, question)}
                              disabled={chatBusy}
                            >
                              Explain Answer
                            </button>
                          </div>
                        </div>
                        <p
                          className="practice-answer-copy"
                          onMouseUp={() => onAnswerSelection(practiceSet, question)}
                        >
                          {question.answer}
                        </p>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};
