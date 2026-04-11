import { useEffect, useRef } from 'react';

import type { CitationRef, DivisionChatMessage } from '../shared/ipc';
import { CitationPreviewCard } from './CitationPreviewCard';

const getCitationKey = (citation: CitationRef): string => {
  return `${citation.documentId}:${citation.pageId}`;
};

type DivisionChatPanelProps = {
  messages: DivisionChatMessage[];
  chatInput: string;
  onChatInputChange: (value: string) => void;
  onSubmit: () => void;
  chatBusy: boolean;
  pendingPrompt: string | null;
  onUseFollowup: (value: string) => void;
  onOpenCitation: (citation: CitationRef) => void;
  onSelectCitationText: (citation: CitationRef) => void;
  activeCitationKey: string | null;
  documentBytesCache: Record<string, Uint8Array>;
};

export const DivisionChatPanel = ({
  messages,
  chatInput,
  onChatInputChange,
  onSubmit,
  chatBusy,
  pendingPrompt,
  onUseFollowup,
  onOpenCitation,
  onSelectCitationText,
  activeCitationKey,
  documentBytesCache,
}: DivisionChatPanelProps) => {
  const endRef = useRef<HTMLDivElement | null>(null);

  const getSelectionLabel = (message: DivisionChatMessage): string => {
    if (!message.selectionContext) {
      return '';
    }

    switch (message.selectionContext.kind) {
      case 'division-summary':
        return 'Analysis selection';
      case 'page-text':
        return `Page ${message.selectionContext.pageNumber ?? '?'}`;
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

  return (
    <section className="analysis-panel">
      <div className="sidebar-section-title">
        <h3>Division Chat</h3>
        <span>{messages.length}</span>
      </div>

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

              <div className="chat-message-copy">{message.content}</div>

              {message.role === 'assistant' && message.citations.length > 0 ? (
                <div className="citation-section">
                  <div className="sidebar-section-title">
                    <h4>Grounding</h4>
                    <span>{message.citations.length}</span>
                  </div>
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
                </div>
              ) : null}

              {message.role === 'assistant' && message.followups.length > 0 ? (
                <div className="chat-followups">
                  {message.followups.map((followup) => (
                    <button
                      key={`${message.id}:${followup}`}
                      type="button"
                      className="ghost-button"
                      onClick={() => onUseFollowup(followup)}
                      disabled={chatBusy}
                    >
                      {followup}
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
              <div className="chat-message-copy">{pendingPrompt}</div>
            </article>
            <article className="chat-message-card chat-role-assistant chat-role-pending">
              <div className="chat-message-header">
                <strong>StudyBud AI</strong>
                <span>Thinking...</span>
              </div>
              <div className="chat-message-copy">
                Generating a grounded answer with supporting citations...
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
          disabled={chatBusy}
        />
        <div className="chat-composer-actions">
          <button
            type="button"
            disabled={chatBusy || !chatInput.trim()}
            onClick={onSubmit}
          >
            Ask Division Chat
          </button>
        </div>
      </div>
    </section>
  );
};
