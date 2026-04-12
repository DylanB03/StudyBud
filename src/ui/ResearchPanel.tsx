import { useRef } from 'react';
import type { FormEvent, RefObject } from 'react';

import type {
  ResearchBrowserState,
  ResearchSearchResult,
  ResearchVideoResult,
  ResearchWebResult,
} from '../shared/ipc';
import { RichMessageContent } from './RichMessageContent';

type ResearchPanelProps = {
  panelRef: RefObject<HTMLElement | null>;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  videoQuery: string;
  onVideoQueryChange: (value: string) => void;
  onSearch: () => void;
  searchBusy: boolean;
  searchError: string | null;
  searchResult: ResearchSearchResult | null;
  suggestedSearchQueries: string[];
  suggestedVideoQueries: string[];
  suggestionSourceContent: string | null;
  suggestionSourceCreatedAt: string | null;
  onUseSuggestedSearch: (query: string) => void;
  onUseSuggestedVideoQuery: (query: string) => void;
  onOpenWebResult: (result: ResearchWebResult) => void;
  onOpenWebResultExternally: (result: ResearchWebResult) => void;
  onOpenVideoResult: (result: ResearchVideoResult) => void;
  browserState: ResearchBrowserState;
  browserUrlInput: string;
  onBrowserUrlInputChange: (value: string) => void;
  onNavigateBrowser: () => void;
  onBackBrowser: () => void;
  onForwardBrowser: () => void;
  onReloadBrowser: () => void;
  onHideBrowser: () => void;
  onOpenBrowserExternally: () => void;
  browserHostRef: RefObject<HTMLDivElement | null>;
};

export const ResearchPanel = ({
  panelRef,
  searchQuery,
  onSearchQueryChange,
  videoQuery,
  onVideoQueryChange,
  onSearch,
  searchBusy,
  searchError,
  searchResult,
  suggestedSearchQueries,
  suggestedVideoQueries,
  suggestionSourceContent,
  suggestionSourceCreatedAt,
  onUseSuggestedSearch,
  onUseSuggestedVideoQuery,
  onOpenWebResult,
  onOpenWebResultExternally,
  onOpenVideoResult,
  browserState,
  browserUrlInput,
  onBrowserUrlInputChange,
  onNavigateBrowser,
  onBackBrowser,
  onForwardBrowser,
  onReloadBrowser,
  onHideBrowser,
  onOpenBrowserExternally,
  browserHostRef,
}: ResearchPanelProps) => {
  const resultSectionRef = useRef<HTMLDivElement | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearch();
  };

  const handleBrowserSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onNavigateBrowser();
  };

  const jumpToResults = () => {
    const panel = panelRef.current;
    const resultsSection = resultSectionRef.current;

    if (!panel || !resultsSection) {
      return;
    }

    const nextTop = Math.max(0, resultsSection.offsetTop - panel.offsetTop - 12);
    panel.scrollTo({
      top: nextTop,
      behavior: 'smooth',
    });
  };

  return (
    <section ref={panelRef} className="analysis-panel research-panel">
      <div className="sidebar-section-title">
        <h3>Research</h3>
        <span>{searchResult?.results.length ?? 0}</span>
      </div>

      <form className="research-search-form" onSubmit={handleSubmit}>
        <label>
          <span className="label">Web Search Query</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Search for an explanation or reference..."
            disabled={searchBusy}
          />
        </label>
        <label>
          <span className="label">Video Query</span>
          <input
            type="text"
            value={videoQuery}
            onChange={(event) => onVideoQueryChange(event.target.value)}
            placeholder="Optional YouTube query override"
            disabled={searchBusy}
          />
        </label>
        <div className="research-actions">
          <button
            type="submit"
            disabled={searchBusy || searchQuery.trim().length === 0}
          >
            {searchBusy ? 'Searching...' : 'Search Research'}
          </button>
        </div>
      </form>

      {(suggestedSearchQueries.length > 0 || suggestedVideoQueries.length > 0) && (
        <section className="research-suggestions">
          {suggestionSourceContent ? (
            <div className="research-suggestion-source">
              <strong>Suggestions From The Latest Answer</strong>
              <div className="research-suggestion-source-copy">
                <RichMessageContent content={suggestionSourceContent} />
              </div>
              {suggestionSourceCreatedAt ? (
                <span>
                  {new Date(suggestionSourceCreatedAt).toLocaleTimeString()}
                </span>
              ) : null}
            </div>
          ) : null}

          {suggestedSearchQueries.length > 0 ? (
            <div className="analysis-block">
              <span className="label">Suggested Web Queries</span>
              <div className="chat-followups">
                {suggestedSearchQueries.map((query) => (
                  <button
                    key={`web:${query}`}
                    type="button"
                    className="ghost-button"
                    onClick={() => onUseSuggestedSearch(query)}
                    disabled={searchBusy}
                  >
                    {query}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {suggestedVideoQueries.length > 0 ? (
            <div className="analysis-block">
              <span className="label">Suggested Video Queries</span>
              <div className="chat-followups">
                {suggestedVideoQueries.map((query) => (
                  <button
                    key={`video:${query}`}
                    type="button"
                    className="ghost-button"
                    onClick={() => onUseSuggestedVideoQuery(query)}
                    disabled={searchBusy}
                  >
                    {query}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      )}

      {searchError ? <div className="warning-banner">{searchError}</div> : null}

      {searchResult ? (
        <div ref={resultSectionRef} className="research-results">
          <section className="analysis-block">
            <div className="sidebar-section-title">
              <h3>Web Results</h3>
              <span>
                {searchResult.results.length} • {searchResult.provider} •{' '}
                {searchResult.safetyMode}
              </span>
            </div>
            {searchResult.results.length === 0 ? (
              <div className="empty-state">
                No web results were found for this query.
              </div>
            ) : (
              <div className="research-result-list">
                {searchResult.results.map((result) => (
                  <article key={result.id} className="research-result-card">
                    <button
                      type="button"
                      className="research-result-primary"
                      onClick={() => onOpenWebResult(result)}
                    >
                      <strong>{result.title}</strong>
                      <span className="research-result-url">{result.displayUrl}</span>
                      <p>{result.snippet || 'Open this source in the in-app browser.'}</p>
                    </button>
                    <div className="research-result-actions">
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => onOpenWebResultExternally(result)}
                      >
                        Open Externally
                      </button>
                      {result.url.toLowerCase().includes('.pdf') ? (
                        <span className="analysis-count-pill">PDF</span>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="analysis-block">
            <div className="sidebar-section-title">
              <h3>Video Suggestions</h3>
              <span>{searchResult.videos.length}</span>
            </div>
            {searchResult.videos.length === 0 ? (
              <div className="empty-state">
                No video suggestions were found for this query.
              </div>
            ) : (
              <div className="research-video-list">
                {searchResult.videos.map((video) => (
                  <button
                    key={video.id}
                    type="button"
                    className="research-video-card"
                    onClick={() => onOpenVideoResult(video)}
                  >
                    <img
                      src={video.thumbnailUrl}
                      alt=""
                      className="research-video-thumb"
                    />
                    <div className="research-video-copy">
                      <strong>{video.title}</strong>
                      <span>
                        {[video.channel, video.duration].filter(Boolean).join(' • ') ||
                          'Open on YouTube'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="empty-state">
          Search the web from the current division context, or use one of the
          suggested research queries from the latest grounded answer.
        </div>
      )}

      <section className="analysis-block">
        <div className="sidebar-section-title">
          <h3>In-App Browser</h3>
          <span>{browserState.visible ? 'Active' : 'Hidden'}</span>
        </div>

        <form className="research-browser-toolbar" onSubmit={handleBrowserSubmit}>
          <div className="research-browser-nav">
            <button
              type="button"
              className="ghost-button"
              onClick={onBackBrowser}
              disabled={!browserState.canGoBack}
            >
              Back
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={onForwardBrowser}
              disabled={!browserState.canGoForward}
            >
              Forward
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={onReloadBrowser}
              disabled={!browserState.visible}
            >
              Reload
            </button>
          </div>
          <input
            type="text"
            value={browserUrlInput}
            onChange={(event) => onBrowserUrlInputChange(event.target.value)}
            placeholder="https://..."
          />
          <div className="research-browser-actions">
            <button
              type="submit"
              disabled={browserUrlInput.trim().length === 0}
            >
              Open
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={onOpenBrowserExternally}
              disabled={!browserState.sourceUrl}
            >
              Open In Browser
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={jumpToResults}
              disabled={!searchResult}
            >
              Back To Results
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={onHideBrowser}
              disabled={!browserState.visible}
            >
              Hide
            </button>
          </div>
        </form>

        <div className="research-browser-meta">
          <span>
            {browserState.loading
              ? 'Loading page...'
              : browserState.errorMessage
                ? 'Page failed to load'
                : browserState.title || 'Ready'}
          </span>
          {browserState.contentKind === 'pdf' ? (
            <span className="research-browser-kind">PDF source</span>
          ) : null}
        </div>

        <div
          ref={browserHostRef}
          className={`research-browser-host${
            browserState.visible ? ' visible' : ''
          }`}
        >
          {browserState.loading ? (
            <div className="research-browser-overlay">
              Loading the selected source inside StudyBud...
            </div>
          ) : null}
          {browserState.errorMessage ? (
            <div className="research-browser-overlay error">
              <strong>{browserState.errorMessage}</strong>
              <p>
                {browserState.contentKind === 'pdf'
                  ? 'This PDF could not be embedded. Open it in your default browser instead.'
                  : 'Try opening this page externally if the site blocks embedding.'}
              </p>
              <div className="research-browser-overlay-actions">
                <button type="button" onClick={onOpenBrowserExternally}>
                  Open In Browser
                </button>
              </div>
            </div>
          ) : null}
          {!browserState.visible ? (
            <div className="research-browser-placeholder">
              Open a web result to read it inside StudyBud.
            </div>
          ) : null}
        </div>
      </section>
    </section>
  );
};
