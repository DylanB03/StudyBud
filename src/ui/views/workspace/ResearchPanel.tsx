import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';

import type {
  ResearchVideoResult,
  ResearchWebResult,
} from '../../../shared/ipc';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { DismissibleBanner } from '../../components/DismissibleBanner';
import { Icon } from '../../components/Icon';
import { FieldLabel, Input } from '../../components/Input';
import { useWorkspace } from '../../state/WorkspaceState';
import { cn } from '../../theme/cn';

const getResultHostname = (result: ResearchWebResult): string | null => {
  try {
    return new URL(result.url).hostname;
  } catch {
    return null;
  }
};

const formatResultHost = (result: ResearchWebResult): string =>
  result.displayUrl || getResultHostname(result) || result.url;

const resultIsPdf = (result: ResearchWebResult): boolean =>
  result.url.toLowerCase().includes('.pdf');

type ResultFaviconProps = {
  result: ResearchWebResult;
  isPdf: boolean;
};

const ResultFavicon = ({ result, isPdf }: ResultFaviconProps) => {
  const [failed, setFailed] = useState(false);
  const hostname = getResultHostname(result);

  const wrapperClass = cn(
    'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-sm',
    isPdf
      ? 'bg-error/15 text-error'
      : 'bg-surface-container-high text-primary',
  );

  if (isPdf || !hostname || failed) {
    return (
      <span className={wrapperClass}>
        <Icon name={isPdf ? 'picture_as_pdf' : 'public'} size="xs" />
      </span>
    );
  }

  return (
    <span className={wrapperClass}>
      <img
        src={`https://icons.duckduckgo.com/ip3/${hostname}.ico`}
        alt=""
        aria-hidden
        width={20}
        height={20}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="h-4 w-4 object-contain"
      />
    </span>
  );
};

export const ResearchPanel = () => {
  const {
    workspace,
    researchQueryInput,
    setResearchQueryInput,
    researchVideoQueryInput,
    setResearchVideoQueryInput,
    researchBusy,
    researchError,
    researchResult,
    researchBrowserState,
    lastResearchRequest,
    runResearchSearch,
    retryResearch,
    navigateResearchBrowser,
    researchGoBack,
    researchGoForward,
    researchReload,
    researchHideBrowser,
    setResearchBrowserBounds,
    openExternalResearchLink,
  } = useWorkspace();

  const panelRef = useRef<HTMLDivElement | null>(null);
  const browserHostRef = useRef<HTMLDivElement | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const [urlInput, setUrlInput] = useState<string>(researchBrowserState.url);

  useEffect(() => {
    setUrlInput(researchBrowserState.url);
  }, [researchBrowserState.url]);

  const latestAssistantMessage = useMemo(() => {
    const messages = workspace?.chatMessages ?? [];
    for (let idx = messages.length - 1; idx >= 0; idx -= 1) {
      const msg = messages[idx];
      if (msg && msg.role === 'assistant') return msg;
    }
    return null;
  }, [workspace]);

  const suggestedSearchQueries =
    latestAssistantMessage?.suggestedSearchQueries ?? [];
  const suggestedVideoQueries =
    latestAssistantMessage?.suggestedVideoQueries ?? [];

  useEffect(() => {
    const host = browserHostRef.current;
    if (!host) return;
    if (!researchBrowserState.visible) {
      return;
    }

    const syncBounds = () => {
      const target = browserHostRef.current;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      void setResearchBrowserBounds({
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        visible: true,
      });
    };

    syncBounds();
    const resizeObserver = new ResizeObserver(syncBounds);
    resizeObserver.observe(host);
    const scrollContainer = panelRef.current;
    window.addEventListener('resize', syncBounds);
    window.addEventListener('scroll', syncBounds, true);
    scrollContainer?.addEventListener('scroll', syncBounds, { passive: true });

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', syncBounds);
      window.removeEventListener('scroll', syncBounds, true);
      scrollContainer?.removeEventListener('scroll', syncBounds);
    };
  }, [researchBrowserState.visible, setResearchBrowserBounds]);

  useEffect(() => {
    return () => {
      if (researchBrowserState.visible) {
        void researchHideBrowser();
      }
    };
  }, [researchBrowserState.visible, researchHideBrowser]);

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runResearchSearch();
  };

  const handleBrowserSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    void navigateResearchBrowser(trimmed);
  };

  const handleOpenWebResult = (result: ResearchWebResult) => {
    scrollToBrowser();
    void navigateResearchBrowser(result.url).then(() => {
      scrollToBrowser();
    });
  };

  const handleOpenExternally = (result: ResearchWebResult) => {
    void openExternalResearchLink(result.url);
  };

  const handleOpenVideo = (result: ResearchVideoResult) => {
    void openExternalResearchLink(result.url);
  };

  const handleCurrentBrowserOpenExternally = () => {
    const url =
      researchBrowserState.sourceUrl.trim() || urlInput.trim();
    if (!url) return;
    void openExternalResearchLink(url);
  };

  const scrollPanelTo = (target: HTMLElement | null, offset = 12) => {
    const panel = panelRef.current;
    if (!panel || !target) return;
    const panelRect = panel.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const nextTop = Math.max(
      0,
      panel.scrollTop + (targetRect.top - panelRect.top) - offset,
    );
    panel.scrollTo({ top: nextTop, behavior: 'smooth' });
  };

  const scrollToBrowser = () => {
    const host = browserHostRef.current;
    if (!host) return;
    requestAnimationFrame(() => scrollPanelTo(host, 12));
  };

  const jumpToResults = () => {
    scrollPanelTo(resultsRef.current, 12);
  };

  return (
    <div
      ref={panelRef}
      className="flex h-full flex-col overflow-y-auto overscroll-contain"
    >
      <div className="border-b border-outline-variant/20 px-6 py-4">
        <h3 className="font-display text-body-md font-bold text-on-surface">
          Web deep dive
        </h3>
        <p className="font-body text-body-xs text-on-surface-variant">
          Search across the web, surface vetted sources, and read them inside
          StudyBud without losing context.
        </p>
      </div>

      <form
        onSubmit={handleSearchSubmit}
        className="flex flex-col gap-3 border-b border-outline-variant/20 px-6 py-4"
      >
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Web query</FieldLabel>
          <div className="relative">
            <Input
              value={researchQueryInput}
              onChange={(event) => setResearchQueryInput(event.target.value)}
              placeholder="Search the web for more context..."
              disabled={researchBusy}
              className="pr-10"
            />
            <Icon
              name="search"
              size="sm"
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Video query (optional)</FieldLabel>
          <Input
            value={researchVideoQueryInput}
            onChange={(event) => setResearchVideoQueryInput(event.target.value)}
            placeholder="Optional YouTube query override"
            disabled={researchBusy}
          />
        </div>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          leadingIcon={<Icon name="travel_explore" size="sm" filled />}
          disabled={
            researchBusy ||
            (researchQueryInput.trim().length === 0 &&
              researchVideoQueryInput.trim().length === 0)
          }
          loading={researchBusy}
        >
          Search research
        </Button>
      </form>

      {suggestedSearchQueries.length > 0 ||
      suggestedVideoQueries.length > 0 ? (
        <section className="border-b border-outline-variant/20 px-6 py-4">
          <h4 className="mb-2 font-display text-body-xs font-bold uppercase tracking-widest text-on-surface-variant">
            Suggestions from latest answer
          </h4>
          {suggestedSearchQueries.length > 0 ? (
            <div className="mb-3">
              <p className="mb-1.5 font-body text-label-sm text-on-surface-variant">
                Web queries
              </p>
              <div className="flex flex-wrap gap-1.5">
                {suggestedSearchQueries.map((query) => (
                  <button
                    key={`web:${query}`}
                    type="button"
                    disabled={researchBusy}
                    onClick={() =>
                      void runResearchSearch({ query, videoQuery: '' })
                    }
                    className="rounded-md border border-outline-variant/30 bg-surface-container-lowest px-2 py-1 font-body text-body-xs text-on-surface-variant transition hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {query}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {suggestedVideoQueries.length > 0 ? (
            <div>
              <p className="mb-1.5 font-body text-label-sm text-on-surface-variant">
                Video queries
              </p>
              <div className="flex flex-wrap gap-1.5">
                {suggestedVideoQueries.map((query) => (
                  <button
                    key={`video:${query}`}
                    type="button"
                    disabled={researchBusy}
                    onClick={() =>
                      void runResearchSearch({
                        query: researchQueryInput || query,
                        videoQuery: query,
                      })
                    }
                    className="rounded-md border border-outline-variant/30 bg-surface-container-lowest px-2 py-1 font-body text-body-xs text-on-surface-variant transition hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {query}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {researchError ? (
        <div className="px-6 pt-4">
          <DismissibleBanner
            dismissKey={`research-error:${researchError}`}
            variant="error"
            action={
              lastResearchRequest ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void retryResearch()}
                  disabled={researchBusy}
                >
                  Retry
                </Button>
              ) : null
            }
          >
            {researchError}
          </DismissibleBanner>
        </div>
      ) : null}

      <div ref={resultsRef} className="flex flex-col gap-6 px-6 py-4">
        {researchResult ? (
          <>
            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h4 className="font-display text-body-xs font-bold uppercase tracking-widest text-on-surface-variant">
                  <Icon
                    name="article"
                    size="xs"
                    className="mr-1 align-middle"
                  />
                  Top articles
                </h4>
                <Chip tone="default" className="px-2 py-0.5 text-body-xs">
                  {researchResult.results.length}
                </Chip>
              </div>
              {researchResult.results.length === 0 ? (
                <p className="rounded-md border border-dashed border-outline-variant/40 px-4 py-6 text-center font-body text-body-sm text-on-surface-variant">
                  No web results were found for this query.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {researchResult.results.map((result) => (
                    <article
                      key={result.id}
                      className="group flex flex-col gap-2 rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-3 transition hover:border-primary/30"
                    >
                      <button
                        type="button"
                        onClick={() => handleOpenWebResult(result)}
                        className="flex items-start gap-2 text-left"
                      >
                        <ResultFavicon
                          result={result}
                          isPdf={resultIsPdf(result)}
                        />
                        <div className="flex min-w-0 flex-col">
                          <strong className="line-clamp-2 font-display text-body-xs font-bold text-on-surface transition group-hover:text-primary">
                            {result.title}
                          </strong>
                          <span className="truncate font-body text-body-xs text-primary/70">
                            {formatResultHost(result)}
                          </span>
                          <p className="mt-1 line-clamp-2 font-body text-body-xs text-on-surface-variant/80">
                            {result.snippet ||
                              'Open this source in the in-app browser.'}
                          </p>
                        </div>
                      </button>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenExternally(result)}
                          className="rounded-md bg-surface-container-low px-2 py-1 font-body text-body-xs font-semibold text-on-surface-variant transition hover:bg-surface-container"
                        >
                          Open externally
                        </button>
                        {resultIsPdf(result) ? (
                          <Chip
                            tone="warning"
                            className="px-2 py-0.5 text-body-xs"
                          >
                            PDF
                          </Chip>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h4 className="font-display text-body-xs font-bold uppercase tracking-widest text-on-surface-variant">
                  <Icon
                    name="play_circle"
                    size="xs"
                    className="mr-1 align-middle"
                  />
                  Top videos
                </h4>
                <Chip tone="default" className="px-2 py-0.5 text-body-xs">
                  {researchResult.videos.length}
                </Chip>
              </div>
              {researchResult.videos.length === 0 ? (
                <p className="rounded-md border border-dashed border-outline-variant/40 px-4 py-6 text-center font-body text-body-sm text-on-surface-variant">
                  No video suggestions were found for this query.
                </p>
              ) : (
                <div className="research-video-scroller -mx-2 flex gap-3 overflow-x-auto overflow-y-hidden px-2 pb-3">
                  {researchResult.videos.map((video) => (
                    <button
                      key={video.id}
                      type="button"
                      onClick={() => handleOpenVideo(video)}
                      className="group flex w-36 shrink-0 flex-col gap-1 text-left"
                    >
                      <div className="relative aspect-video overflow-hidden rounded-lg bg-surface-container-highest">
                        {video.thumbnailUrl ? (
                          <img
                            src={video.thumbnailUrl}
                            alt=""
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                            referrerPolicy="no-referrer"
                          />
                        ) : null}
                        <span className="absolute inset-0 flex items-center justify-center bg-black/20 text-white">
                          <Icon name="play_arrow" size="md" filled />
                        </span>
                      </div>
                      <h5 className="line-clamp-2 font-body text-body-xs font-medium text-on-surface">
                        {video.title}
                      </h5>
                      <span className="font-body text-body-xs text-on-surface-variant/70">
                        {[video.channel, video.duration]
                          .filter(Boolean)
                          .join(' • ') || 'Open on YouTube'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : !researchError ? (
          <p className="rounded-md border border-dashed border-outline-variant/40 px-4 py-8 text-center font-body text-body-sm text-on-surface-variant">
            Search the web from the current unit's context, or use one of the
            suggested research queries from the latest grounded answer.
          </p>
        ) : null}
      </div>

      <section className="flex flex-col gap-3 border-t border-outline-variant/20 bg-surface-container-lowest px-6 py-4">
        <div className="flex items-center justify-between">
          <h4 className="font-display text-body-xs font-bold uppercase tracking-widest text-on-surface-variant">
            <Icon name="dock_to_right" size="xs" className="mr-1 align-middle" />
            In-app browser
          </h4>
          <Chip
            tone={researchBrowserState.visible ? 'success' : 'default'}
            className="px-2 py-0.5 text-body-xs"
          >
            {researchBrowserState.visible ? 'Active' : 'Hidden'}
          </Chip>
        </div>

        <form
          onSubmit={handleBrowserSubmit}
          className="flex flex-col gap-2"
        >
          <div className="flex items-center gap-1">
            <BrowserNavButton
              icon="arrow_back"
              label="Back"
              onClick={() => void researchGoBack()}
              disabled={!researchBrowserState.canGoBack}
            />
            <BrowserNavButton
              icon="arrow_forward"
              label="Forward"
              onClick={() => void researchGoForward()}
              disabled={!researchBrowserState.canGoForward}
            />
            <BrowserNavButton
              icon="refresh"
              label="Reload"
              onClick={() => void researchReload()}
              disabled={!researchBrowserState.visible}
            />
          </div>
          <Input
            value={urlInput}
            onChange={(event) => setUrlInput(event.target.value)}
            placeholder="https://..."
            className="text-body-xs"
          />
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="submit"
              size="sm"
              variant="primary"
              disabled={urlInput.trim().length === 0}
            >
              Open
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleCurrentBrowserOpenExternally}
              disabled={!researchBrowserState.sourceUrl}
            >
              Open in browser
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={jumpToResults}
              disabled={!researchResult}
            >
              Back to results
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void researchHideBrowser()}
              disabled={!researchBrowserState.visible}
            >
              Hide
            </Button>
          </div>
        </form>

        <div className="flex items-center gap-2 rounded-md bg-surface-container-low px-3 py-2">
          {researchBrowserState.loading ? (
            <span className="inline-flex h-3 w-3 animate-pulse rounded-full bg-primary" />
          ) : researchBrowserState.errorMessage ? (
            <Icon name="error" size="xs" className="text-error" />
          ) : (
            <Icon name="globe" size="xs" className="text-on-surface-variant" />
          )}
          <span className="truncate font-body text-body-xs text-on-surface-variant">
            {researchBrowserState.loading
              ? 'Loading page...'
              : researchBrowserState.errorMessage
                ? 'Page failed to load'
                : researchBrowserState.title || 'Ready'}
          </span>
          {researchBrowserState.contentKind === 'pdf' ? (
            <Chip tone="warning" className="ml-auto px-2 py-0.5 text-body-xs">
              PDF source
            </Chip>
          ) : null}
        </div>

        <div
          ref={browserHostRef}
          className={cn(
            'relative flex min-h-[280px] items-center justify-center rounded-xl border border-outline-variant/20 bg-surface-container-high',
            researchBrowserState.visible && 'h-[420px]',
          )}
        >
          {researchBrowserState.loading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-surface-container-high/80 font-body text-body-sm text-on-surface-variant">
              Loading the selected source inside StudyBud...
            </div>
          ) : null}
          {researchBrowserState.errorMessage ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface-container-high/80 px-4 text-center">
              <strong className="font-display text-body-sm text-error">
                {researchBrowserState.errorMessage}
              </strong>
              <p className="font-body text-body-xs text-on-surface-variant">
                {researchBrowserState.contentKind === 'pdf'
                  ? 'This PDF could not be embedded. Open it in your default browser instead.'
                  : 'Try opening this page externally if the site blocks embedding.'}
              </p>
              <Button
                size="sm"
                variant="primary"
                onClick={handleCurrentBrowserOpenExternally}
              >
                Open in browser
              </Button>
            </div>
          ) : null}
          {!researchBrowserState.visible &&
          !researchBrowserState.loading &&
          !researchBrowserState.errorMessage ? (
            <p className="px-4 text-center font-body text-body-sm text-on-surface-variant">
              Open a web result to read it inside StudyBud.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
};

type BrowserNavButtonProps = {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

const BrowserNavButton = ({
  icon,
  label,
  onClick,
  disabled,
}: BrowserNavButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-surface-container-low text-on-surface-variant transition hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-40"
  >
    <Icon name={icon} size="sm" />
  </button>
);
