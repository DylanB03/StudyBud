import { useEffect, useState } from 'react';

import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Textarea } from '../../components/Input';
import { useAppState } from '../../state/AppState';
import { useSettings } from '../../state/SettingsState';
import { useWorkspace } from '../../state/WorkspaceState';
import { cn } from '../../theme/cn';

export const SelectionOverlay = () => {
  const {
    selectionDraft,
    selectionPopupPosition,
    selectionUiMode,
    setSelection,
    clearSelection,
    askChat,
    chatBusy,
    setRightRailTab,
  } = useWorkspace();
  const { isOnline } = useAppState();
  const { settings } = useSettings();
  const [question, setQuestion] = useState<string>('');

  useEffect(() => {
    if (!selectionDraft) {
      setQuestion('');
    }
  }, [selectionDraft]);

  if (!selectionDraft || !selectionPopupPosition) return null;

  const aiActionsEnabled =
    settings.aiProvider === 'openai'
      ? settings.openAiApiKeyConfigured && isOnline
      : settings.ollamaModel.trim().length > 0;
  const disabledReason = !aiActionsEnabled
    ? settings.aiProvider === 'openai'
      ? 'Add an OpenAI API key in Settings to enable AI actions.'
      : 'Set an Ollama model in Settings to enable AI actions.'
    : null;

  const handleOpen = () => {
    setSelection(selectionDraft, selectionPopupPosition, 'popup');
    setRightRailTab('chat');
  };

  const handleSubmit = async () => {
    const prompt = question.trim();
    if (!prompt) return;
    await askChat(prompt, selectionDraft);
    setQuestion('');
    clearSelection();
  };

  if (selectionUiMode === 'chip') {
    return (
      <div
        className="fixed z-40 flex items-center gap-1 rounded-full bg-surface-container-lowest px-1 py-1 shadow-elevated ring-1 ring-primary/30"
        style={{
          left: `${selectionPopupPosition.x}px`,
          top: `${selectionPopupPosition.y}px`,
        }}
      >
        <Button
          size="sm"
          variant="primary"
          leadingIcon={<Icon name="bolt" size="sm" filled />}
          onClick={handleOpen}
        >
          Ask about this
        </Button>
        <button
          type="button"
          onClick={clearSelection}
          aria-label="Dismiss selection"
          className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-all hover:bg-error/10 hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40"
        >
          <Icon name="close" size="sm" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'fixed z-50 flex w-[360px] flex-col gap-3 rounded-card bg-surface-container-lowest p-4 shadow-elevated ring-1 ring-primary/30',
      )}
      style={{
        left: `${selectionPopupPosition.x}px`,
        top: `${selectionPopupPosition.y}px`,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <strong className="font-display text-body-md text-on-surface">
          Ask about selection
        </strong>
        <button
          type="button"
          onClick={clearSelection}
          disabled={chatBusy}
          aria-label="Dismiss"
          className="flex h-7 w-7 items-center justify-center rounded-full text-on-surface-variant transition-all hover:bg-error/10 hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40 disabled:opacity-50"
        >
          <Icon name="close" size="sm" />
        </button>
      </div>
      <p className="font-body text-body-xs text-on-surface-variant">
        {selectionDraft.kind === 'division-summary'
          ? 'Unit analysis selection'
          : `${selectionDraft.documentName ?? 'Document'} • page ${selectionDraft.pageNumber ?? '?'}`}
      </p>
      <blockquote className="max-h-24 overflow-y-auto rounded-md border-l-4 border-primary bg-surface-container-low px-3 py-2 font-body text-body-xs italic text-on-surface-variant">
        {selectionDraft.selectedText}
      </blockquote>
      <Textarea
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        placeholder="Ask a question about this highlighted text..."
        rows={3}
        disabled={chatBusy || !aiActionsEnabled}
        autoFocus
      />
      {disabledReason ? (
        <p className="font-body text-body-xs text-warning">{disabledReason}</p>
      ) : null}
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="primary"
          onClick={() => void handleSubmit()}
          disabled={chatBusy || !question.trim() || !aiActionsEnabled}
          loading={chatBusy}
        >
          Ask question
        </Button>
      </div>
    </div>
  );
};
