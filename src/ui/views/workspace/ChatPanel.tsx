import { useEffect, useRef, useState } from 'react';

import type {
  CitationRef,
  DivisionChatMessage,
} from '../../../shared/ipc';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { DismissibleBanner } from '../../components/DismissibleBanner';
import { Icon } from '../../components/Icon';
import { Textarea } from '../../components/Input';
import { useAppState } from '../../state/AppState';
import { useSettings } from '../../state/SettingsState';
import { getCitationKey } from '../../state/helpers';
import { useWorkspace } from '../../state/WorkspaceState';
import { cn } from '../../theme/cn';
import { CitationPreviewCard } from './CitationPreviewCard';
import { RichMessageContent } from './RichMessageContent';
import { useSelectionCapture } from './useSelectionCapture';

const getSelectionLabel = (message: DivisionChatMessage): string => {
  if (!message.selectionContext) return '';
  switch (message.selectionContext.kind) {
    case 'division-summary':
      return 'Unit selection';
    case 'page-text':
      return `Page ${message.selectionContext.pageNumber ?? '?'}`;
    case 'chat-question':
      return 'Chat question';
    case 'chat-answer':
      return 'Chat answer';
    case 'practice-question':
      return 'Practice question';
    case 'practice-answer':
      return 'Practice answer';
    default:
      return 'Selection';
  }
};

const formatTimestamp = (iso: string): string =>
  new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

export const ChatPanel = () => {
  const {
    workspace,
    selectedDivisionId,
    chatInput,
    setChatInput,
    chatBusy,
    chatError,
    pendingChatPrompt,
    askChat,
    retryChat,
    lastChatRequest,
    selectedCitationKey,
    setSelectedCitationKey,
    selectDocument,
    setSelectedPage,
    documentBytesCache,
  } = useWorkspace();
  const { isOnline } = useAppState();
  const { settings } = useSettings();
  const { capture } = useSelectionCapture();
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const prevCountRef = useRef<number>(0);
  const prevPendingRef = useRef<string | null>(null);
  const [expandedGrounding, setExpandedGrounding] = useState<
    Record<string, boolean>
  >({});

  const divisionMessages: DivisionChatMessage[] = (
    workspace?.chatMessages ?? []
  ).filter((message) => message.divisionId === selectedDivisionId);

  useEffect(() => {
    const list = messageListRef.current;
    if (!list) {
      prevCountRef.current = divisionMessages.length;
      prevPendingRef.current = pendingChatPrompt;
      return;
    }
    const shouldScroll =
      divisionMessages.length > prevCountRef.current ||
      (pendingChatPrompt !== null &&
        prevPendingRef.current !== pendingChatPrompt);
    if (shouldScroll) {
      list.scrollTo({
        top: list.scrollHeight,
        behavior: prevCountRef.current > 0 ? 'smooth' : 'auto',
      });
    }
    prevCountRef.current = divisionMessages.length;
    prevPendingRef.current = pendingChatPrompt;
  }, [divisionMessages.length, pendingChatPrompt]);

  const aiActionsEnabled =
    settings.aiProvider === 'openai'
      ? settings.openAiApiKeyConfigured && isOnline
      : settings.ollamaModel.trim().length > 0;
  const disabledReason = !aiActionsEnabled
    ? settings.aiProvider === 'openai'
      ? 'Add an OpenAI API key in Settings.'
      : 'Set an Ollama model in Settings.'
    : !selectedDivisionId
      ? 'Pick a unit before asking a question.'
      : null;

  const handleSubmit = async () => {
    const prompt = chatInput.trim();
    if (!prompt) return;
    await askChat(prompt, null);
  };

  const handleFollowup = (prompt: string) => {
    void askChat(prompt, null);
  };

  const handleOpenCitation = (citation: CitationRef) => {
    setSelectedCitationKey(getCitationKey(citation));
    selectDocument(citation.documentId, citation.pageNumber);
    setSelectedPage(citation.pageNumber);
  };

  const toggleGrounding = (id: string) =>
    setExpandedGrounding((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-outline-variant/20 px-6 py-4">
        <h3 className="font-display text-body-md font-bold text-on-surface">
          Unit chat
        </h3>
        <p className="font-body text-body-xs text-on-surface-variant">
          Ask about sources or highlight text anywhere to ask for clarification.
        </p>
      </div>

      {chatError ? (
        <div className="px-4 pt-3">
          <DismissibleBanner
            dismissKey={`chat-error:${chatError}`}
            variant="error"
            action={
              lastChatRequest ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void retryChat()}
                  disabled={chatBusy}
                >
                  Retry
                </Button>
              ) : null
            }
          >
            {chatError}
          </DismissibleBanner>
        </div>
      ) : null}

      <div
        ref={messageListRef}
        className="flex-1 overflow-y-auto overscroll-contain px-4 py-4"
      >
        {divisionMessages.length === 0 && !pendingChatPrompt ? (
          <EmptyChatState />
        ) : (
          <div className="flex flex-col gap-4">
            {divisionMessages.map((message) => (
              <ChatBubble
                key={message.id}
                message={message}
                activeCitationKey={selectedCitationKey}
                expanded={Boolean(expandedGrounding[message.id])}
                onToggleGrounding={() => toggleGrounding(message.id)}
                onUseFollowup={handleFollowup}
                onOpenCitation={handleOpenCitation}
                onSelectCitationText={(citation) =>
                  capture({
                    kind: 'division-summary',
                    surroundingText: citation.excerptText,
                    pageId: citation.pageId,
                    documentId: citation.documentId,
                    documentName: citation.documentName,
                    documentKind: citation.documentKind,
                    pageNumber: citation.pageNumber,
                  })
                }
                onSelectBodyText={() =>
                  capture({
                    kind:
                      message.role === 'assistant'
                        ? 'chat-answer'
                        : 'chat-question',
                    surroundingText: message.content,
                    sourcePageIds: message.citations.map((c) => c.pageId),
                    pageId: message.selectionContext?.pageId ?? null,
                    documentId: message.selectionContext?.documentId ?? null,
                    documentName:
                      message.selectionContext?.documentName ?? null,
                    documentKind:
                      message.selectionContext?.documentKind ?? null,
                    pageNumber: message.selectionContext?.pageNumber ?? null,
                  })
                }
                documentBytesCache={documentBytesCache}
                chatBusy={chatBusy}
                aiActionsEnabled={aiActionsEnabled && !disabledReason}
              />
            ))}
            {pendingChatPrompt ? (
              <PendingChatBubbles prompt={pendingChatPrompt} />
            ) : null}
          </div>
        )}
      </div>

      <div className="border-t border-outline-variant/20 bg-surface-container-lowest p-4">
        <div className="relative">
          <Textarea
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            placeholder={
              disabledReason ?? 'Deep dive into this material…'
            }
            rows={3}
            disabled={chatBusy || Boolean(disabledReason)}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                (event.metaKey || event.ctrlKey) &&
                !chatBusy
              ) {
                event.preventDefault();
                void handleSubmit();
              }
            }}
            className="pr-14"
          />
          <button
            type="button"
            disabled={chatBusy || !chatInput.trim() || Boolean(disabledReason)}
            onClick={() => void handleSubmit()}
            aria-label="Send question"
            className={cn(
              'absolute bottom-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-on-primary shadow-ambient transition hover:shadow-elevated active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40',
            )}
          >
            <Icon name="arrow_upward" size="sm" />
          </button>
        </div>
        {disabledReason ? (
          <p className="mt-2 font-body text-body-xs text-warning">
            {disabledReason}
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <QuickPrompt
              label="Explain concept"
              onClick={() => void askChat('Explain this concept simply.', null)}
              disabled={chatBusy || Boolean(disabledReason)}
            />
            <QuickPrompt
              label="List citations"
              onClick={() =>
                void askChat(
                  'List the most important citations for this unit with a short rationale.',
                  null,
                )
              }
              disabled={chatBusy || Boolean(disabledReason)}
            />
            <QuickPrompt
              label="Give me a quiz"
              onClick={() =>
                void askChat(
                  'Give me a short quiz of three questions grounded in the source pages.',
                  null,
                )
              }
              disabled={chatBusy || Boolean(disabledReason)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

const EmptyChatState = () => (
  <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-on-primary shadow-ambient">
      <Icon name="bolt" size="sm" filled />
    </span>
    <p className="max-w-xs font-body text-body-sm text-on-surface-variant">
      Ask a question about this unit, or highlight text anywhere in the canvas
      and StudyBud will pull the relevant context.
    </p>
  </div>
);

type ChatBubbleProps = {
  message: DivisionChatMessage;
  activeCitationKey: string | null;
  expanded: boolean;
  chatBusy: boolean;
  aiActionsEnabled: boolean;
  documentBytesCache: Record<string, Uint8Array>;
  onToggleGrounding: () => void;
  onUseFollowup: (value: string) => void;
  onOpenCitation: (citation: CitationRef) => void;
  onSelectCitationText: (citation: CitationRef) => void;
  onSelectBodyText: () => void;
};

const ChatBubble = ({
  message,
  activeCitationKey,
  expanded,
  chatBusy,
  aiActionsEnabled,
  documentBytesCache,
  onToggleGrounding,
  onUseFollowup,
  onOpenCitation,
  onSelectCitationText,
  onSelectBodyText,
}: ChatBubbleProps) => {
  const isUser = message.role === 'user';
  return (
    <article
      className={cn(
        'flex flex-col gap-2',
        isUser ? 'items-end' : 'items-start',
      )}
    >
      <div className="flex items-center gap-2 px-1 font-body text-body-xs text-on-surface-variant">
        {!isUser ? (
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-tr from-primary to-secondary text-on-primary">
            <Icon name="bolt" size="xs" filled />
          </span>
        ) : null}
        <strong className="font-display text-body-xs font-bold uppercase tracking-wider text-on-surface">
          {isUser ? 'You' : 'StudyBud AI'}
        </strong>
        <span>{formatTimestamp(message.createdAt)}</span>
      </div>

      {message.selectionContext ? (
        <Chip tone="info" className="px-2 py-0.5 text-body-xs">
          {getSelectionLabel(message)}
        </Chip>
      ) : null}

      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-3 text-body-sm shadow-soft',
          isUser
            ? 'rounded-tr-sm bg-gradient-to-br from-primary to-secondary text-on-primary'
            : 'rounded-tl-sm bg-surface-container-lowest text-on-surface-variant ring-1 ring-outline-variant/15',
        )}
        onMouseUp={onSelectBodyText}
      >
        <RichMessageContent content={message.content} />
      </div>

      {!isUser && message.citations.length > 0 ? (
        <div className="w-full max-w-[85%]">
          <button
            type="button"
            onClick={onToggleGrounding}
            className="flex w-full items-center justify-between rounded-md bg-surface-container-low px-3 py-1.5 font-body text-body-xs text-on-surface-variant transition hover:bg-surface-container"
          >
            <span className="flex items-center gap-1.5 font-semibold uppercase tracking-wider">
              <Icon name={expanded ? 'expand_less' : 'expand_more'} size="xs" />
              Grounding
            </span>
            <span>{message.citations.length}</span>
          </button>
          {expanded ? (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {message.citations.map((citation) => (
                <CitationPreviewCard
                  key={`${message.id}:${citation.pageId}`}
                  citation={citation}
                  documentBytes={
                    documentBytesCache[citation.documentId] ?? null
                  }
                  active={activeCitationKey === getCitationKey(citation)}
                  onClick={() => onOpenCitation(citation)}
                  onTextSelection={onSelectCitationText}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {!isUser && message.followups.length > 0 ? (
        <div className="flex w-full max-w-[85%] flex-wrap gap-1.5">
          {message.followups.map((followup) => (
            <button
              key={`${message.id}:${followup}`}
              type="button"
              disabled={chatBusy || !aiActionsEnabled}
              onClick={() => onUseFollowup(followup)}
              className="rounded-md border border-outline-variant/30 bg-surface-container-low px-2 py-1 font-body text-body-xs text-on-surface-variant transition hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {followup}
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
};

const PendingChatBubbles = ({ prompt }: { prompt: string }) => (
  <>
    <article className="flex flex-col gap-2 items-end">
      <div className="flex items-center gap-2 px-1 font-body text-body-xs text-on-surface-variant">
        <strong className="font-display text-body-xs font-bold uppercase tracking-wider text-on-surface">
          You
        </strong>
        <span>Sending…</span>
      </div>
      <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-gradient-to-br from-primary to-secondary px-4 py-3 font-body text-body-sm text-on-primary shadow-soft">
        {prompt}
      </div>
    </article>
    <article className="flex flex-col gap-2 items-start">
      <div className="flex items-center gap-2 px-1 font-body text-body-xs text-on-surface-variant">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-tr from-primary to-secondary text-on-primary">
          <Icon name="bolt" size="xs" filled />
        </span>
        <strong className="font-display text-body-xs font-bold uppercase tracking-wider text-on-surface">
          StudyBud AI
        </strong>
        <span>Thinking…</span>
      </div>
      <div className="flex max-w-[85%] items-center gap-2 rounded-2xl rounded-tl-sm bg-surface-container-lowest px-4 py-3 font-body text-body-sm text-on-surface-variant shadow-soft ring-1 ring-outline-variant/15">
        <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.2s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.1s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-primary" />
      </div>
    </article>
  </>
);

const QuickPrompt = ({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="rounded-md border border-transparent bg-surface-container-low px-2 py-1 font-body text-body-xs font-bold text-on-surface-variant transition hover:border-outline-variant/30 hover:bg-surface-container-lowest disabled:cursor-not-allowed disabled:opacity-50"
  >
    {label}
  </button>
);
