import type { SelectionContext } from '../shared/ipc';

type SelectionQuestionPopupProps = {
  selectionDraft: SelectionContext;
  position: {
    x: number;
    y: number;
  };
  question: string;
  busy: boolean;
  onQuestionChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

export const SelectionQuestionPopup = ({
  selectionDraft,
  position,
  question,
  busy,
  onQuestionChange,
  onSubmit,
  onCancel,
}: SelectionQuestionPopupProps) => {
  return (
    <div
      className="selection-popup"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <div className="selection-popup-header">
        <strong>Ask About Selection</strong>
        <button
          type="button"
          className="ghost-button"
          onClick={onCancel}
          disabled={busy}
        >
          Dismiss
        </button>
      </div>
      <p className="selection-popup-context">
        {selectionDraft.kind === 'division-summary'
          ? 'Division analysis selection'
          : `${selectionDraft.documentName ?? 'Document'} • page ${selectionDraft.pageNumber ?? '?'}`
        }
      </p>
      <blockquote className="selection-popup-quote">
        {selectionDraft.selectedText}
      </blockquote>
      <textarea
        value={question}
        onChange={(event) => onQuestionChange(event.target.value)}
        placeholder="Ask a question about this highlighted text..."
        rows={3}
        disabled={busy}
        autoFocus
      />
      <div className="selection-popup-actions">
        <button
          type="button"
          disabled={busy || !question.trim()}
          onClick={onSubmit}
        >
          Ask Question
        </button>
      </div>
    </div>
  );
};
