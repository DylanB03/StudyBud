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
}: DivisionChatPanelProps) => {
  const endRef = useRef<HTMLDivElement | null>(null);
  const [expandedGroundingIds, setExpandedGroundingIds] = useState<
    Record<string, boolean>
  >({});

  const getSelectionLabel = (message: DivisionChatMessage): string => {
    if (!message.selectionContext) {
      return '';
    }

    switch (message.selectionContext.kind) {
      case 'division-summary':
        return 'Analysis selection';
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
    endRef.current?.scrollIntoView({
      block: 'end',
      behavior: messages.length > 0 ? 'smooth' : 'auto',
    });
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
        <h3>Division Chat</h3>
        <span>{messages.length}</span>
      </div>

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

      <div className="chat-message-list">
        {messages.length === 0 ? (
          <div className="empty-state">
            Ask a question about this division, or highlight text in the summary or extracted page text and ask for clarification.
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

        <div ref={endRef} />
      </div>

      <div className="chat-composer">
        <textarea
          value={chatInput}
          onChange={(event) => onChatInputChange(event.target.value)}
          placeholder="Ask a question about this division..."
          rows={4}
          disabled={chatBusy || !aiActionsEnabled}
        />
        <div className="chat-composer-actions">
          <button
            type="button"
            disabled={chatBusy || !chatInput.trim() || !aiActionsEnabled}
            onClick={onSubmit}
          >
            Ask Division Chat
          </button>
        </div>
      </div>
    </section>
  );
};
