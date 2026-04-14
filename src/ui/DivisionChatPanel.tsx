import { useEffect, useRef, useState } from 'react';

import type { CitationRef, DivisionChatMessage } from '../shared/ipc';
import { CitationPreviewCard } from './CitationPreviewCard';
import { DismissibleBanner } from './DismissibleBanner';
import { RichMessageContent } from './RichMessageContent';

const getCitationKey = (citation: CitationRef): string => {
  return `${citation.documentId}:${citation.pageId}`;
};

type DivisionChatPanelProps = {
  messages: DivisionChatMessage[];
  chatInput: string;
  onChatInputChange: (value: string) => void;
  onSubmit: () => void;
  chatBusy: boolean;
  errorMessage?: string | null;
  onRetry?: (() => void) | null;
  pendingPrompt: string | null;
  aiActionsEnabled?: boolean;
  disabledReason?: string | null;
  onUseFollowup: (value: string) => void;
  onOpenCitation: (citation: CitationRef) => void;
  onSelectCitationText: (citation: CitationRef) => void;
  onSelectMessageText: (message: DivisionChatMessage) => void;
  activeCitationKey: string | null;
  documentBytesCache: Record<string, Uint8Array>;
  heading?: string;
  emptyStateMessage?: string;
  submitLabel?: string;
  placeholder?: string;
};

export const DivisionChatPanel = ({
  messages,
  chatInput,
  onChatInputChange,
  onSubmit,
  chatBusy,
  errorMessage = null,
  onRetry = null,
  pendingPrompt,
  aiActionsEnabled = true,
  disabledReason = null,
  onUseFollowup,
  onOpenCitation,
  onSelectCitationText,
  onSelectMessageText,
  activeCitationKey,
  documentBytesCache,
  heading = 'Division Chat',
  emptyStateMessage = 'Ask a question about this division, or highlight text in the summary or extracted page text and ask for clarification.',
  submitLabel = 'Ask Division Chat',
  placeholder = 'Ask a question about this division...',
}: DivisionChatPanelProps) => {
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const previousMessageCountRef = useRef(messages.length);
  const previousPendingPromptRef = useRef<string | null>(pendingPrompt);
  const [expandedGroundingIds, setExpandedGroundingIds] = useState<
    Record<string, boolean>
  >({});

  const getSelectionLabel = (message: DivisionChatMessage): string => {
    if (!message.selectionContext) {
      return '';
    }

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

  useEffect(() => {
    const messageList = messageListRef.current;
    if (!messageList) {
      previousMessageCountRef.current = messages.length;
      previousPendingPromptRef.current = pendingPrompt;
      return;
    }

    const shouldScroll =
      messages.length > previousMessageCountRef.current ||
      (pendingPrompt !== null && previousPendingPromptRef.current !== pendingPrompt);

    if (shouldScroll) {
      messageList.scrollTo({
        top: messageList.scrollHeight,
        behavior: previousMessageCountRef.current > 0 ? 'smooth' : 'auto',
      });
    }

    previousMessageCountRef.current = messages.length;
    previousPendingPromptRef.current = pendingPrompt;
  }, [messages.length, pendingPrompt]);

  const toggleGrounding = (messageId: string) => {
    setExpandedGroundingIds((previous) => ({
      ...previous,
      [messageId]: !previous[messageId],
    }));
  };

  return (
    <section className="analysis-panel">
      <div className="sidebar-section-title">
        <h3>{heading}</h3>
        <span>{messages.length}</span>
      </div>

      {errorMessage || (!aiActionsEnabled && disabledReason) ? (
        <div className="chat-panel-status">
          {errorMessage ? (
            <DismissibleBanner
              dismissKey={`chat-error:${errorMessage}`}
              className="panel-banner"
              action={
                onRetry ? (
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={onRetry}
                    disabled={chatBusy}
                  >
                    Retry
                  </button>
                ) : null
              }
            >
              <span>{errorMessage}</span>
            </DismissibleBanner>
          ) : null}

          {!aiActionsEnabled && disabledReason ? (
            <div className="warning-banner">{disabledReason}</div>
          ) : null}
        </div>
      ) : null}

      <div ref={messageListRef} className="chat-message-list">
        {messages.length === 0 ? (
          <div className="empty-state">
            {emptyStateMessage}
          </div>
        ) : (
          messages.map((message) => (
            <article
              key={message.id}
              className={`chat-message-card chat-role-${message.role}`}
            >
              <div className="chat-message-header">
                <strong>{message.role === 'assistant' ? 'StudyBud AI' : 'You'}</strong>
                <span>{new Date(message.createdAt).toLocaleTimeString()}</span>
              </div>

              {message.selectionContext ? (
                <div className="chat-selection-pill">
                  {getSelectionLabel(message)}
                </div>
              ) : null}

              <div
                className="chat-message-copy"
                onMouseUp={() => onSelectMessageText(message)}
              >
                <RichMessageContent content={message.content} />
              </div>

              {message.role === 'assistant' && message.citations.length > 0 ? (
                <div className="citation-section">
                  <button
                    type="button"
                    className={`grounding-toggle${
                      expandedGroundingIds[message.id] ? ' expanded' : ''
                    }`}
                    onClick={() => toggleGrounding(message.id)}
                  >
                    <span className="grounding-toggle-label">
                      <span className="grounding-toggle-arrow" aria-hidden="true">
                        {expandedGroundingIds[message.id] ? '▾' : '▸'}
                      </span>
                      <span>Grounding</span>
                    </span>
                    <span>{message.citations.length}</span>
                  </button>

                  {expandedGroundingIds[message.id] ? (
                    <div className="citation-grid">
                      {message.citations.map((citation) => (
                        <CitationPreviewCard
                          key={`${message.id}:${citation.pageId}`}
                          citation={citation}
                          documentBytes={documentBytesCache[citation.documentId] ?? null}
                          active={activeCitationKey === getCitationKey(citation)}
                          onClick={() => onOpenCitation(citation)}
                          onTextSelection={onSelectCitationText}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {message.role === 'assistant' && message.followups.length > 0 ? (
                <div className="chat-followups">
                  {message.followups.map((followup) => (
                    <button
                      key={`${message.id}:${followup}`}
                      type="button"
                      className="ghost-button chat-followup-button"
                      onClick={() => onUseFollowup(followup)}
                      disabled={chatBusy || !aiActionsEnabled}
                    >
                      <RichMessageContent content={followup} compact />
                    </button>
                  ))}
                </div>
              ) : null}
            </article>
          ))
        )}

        {pendingPrompt ? (
          <>
            <article className="chat-message-card chat-role-user">
              <div className="chat-message-header">
                <strong>You</strong>
                <span>Sending...</span>
              </div>
              <div className="chat-message-copy">
                <RichMessageContent content={pendingPrompt} />
              </div>
            </article>
            <article className="chat-message-card chat-role-assistant chat-role-pending">
              <div className="chat-message-header">
                <strong>StudyBud AI</strong>
                <span>Thinking...</span>
              </div>
              <div className="chat-message-copy">
                <RichMessageContent content="Generating a grounded answer with supporting citations..." />
              </div>
            </article>
          </>
        ) : null}
      </div>

      <div className="chat-composer">
        <textarea
          value={chatInput}
          onChange={(event) => onChatInputChange(event.target.value)}
          placeholder={placeholder}
          rows={4}
          disabled={chatBusy || !aiActionsEnabled}
        />
        <div className="chat-composer-actions">
          <button
            type="button"
            disabled={chatBusy || !chatInput.trim() || !aiActionsEnabled}
            onClick={onSubmit}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </section>
  );
};
