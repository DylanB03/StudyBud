import type {
  ResearchSearchInput,
  ResearchSearchResult,
  ResearchVideoResult,
  ResearchWebResult,
} from '../../shared/ipc';

export type ResearchProviderConfig = {
  braveApiKey: string | null;
  youTubeApiKey: string | null;
  safetyMode: 'balanced' | 'education';
};

const DEFAULT_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) StudyBud/1.0 Safari/537.36',
  accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9',
} as const;

const MAX_WEB_RESULTS = 6;
const MAX_VIDEO_RESULTS = 6;
const EDUCATIONAL_HOST_KEYWORDS = [
  '.edu',
  'khanacademy.org',
  'ocw.mit.edu',
  'openstax.org',
  'coursera.org',
  'edx.org',
  'brilliant.org',
  'physicsclassroom.com',
  'wikipedia.org',
  'britannica.com',
];
const EDUCATIONAL_VIDEO_KEYWORDS = [
  'lecture',
  'tutorial',
  'course',
  'lesson',
  'education',
  'explained',
  'university',
  'academy',
];

const COMMON_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

const stripTags = (value: string): string => {
  return value.replace(/<[^>]+>/g, ' ');
};

const decodeHtmlEntities = (value: string): string => {
  let decoded = value;

  for (const [entity, replacement] of Object.entries(COMMON_ENTITIES)) {
    decoded = decoded.split(entity).join(replacement);
  }

  decoded = decoded.replace(/&#(\d+);/g, (_match, codepoint) => {
    const numeric = Number(codepoint);
    return Number.isFinite(numeric) ? String.fromCodePoint(numeric) : '';
  });

  decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (_match, codepoint) => {
    const numeric = Number.parseInt(codepoint, 16);
    return Number.isFinite(numeric) ? String.fromCodePoint(numeric) : '';
  });

  return decoded;
};

const normalizeWhitespace = (value: string): string => {
  return decodeHtmlEntities(stripTags(value)).replace(/\s+/g, ' ').trim();
};

const resolveDuckDuckGoUrl = (rawUrl: string): string => {
  try {
    const url = new URL(rawUrl, 'https://duckduckgo.com');
    const redirected = url.searchParams.get('uddg');
    return redirected ? decodeURIComponent(redirected) : url.toString();
  } catch {
    return rawUrl;
  }
};

const toDisplayUrl = (value: string): string => {
  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname === '/' ? '' : url.pathname}`;
  } catch {
    return value;
  }
};

const isEducationalUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return EDUCATIONAL_HOST_KEYWORDS.some((keyword) =>
      url.hostname.toLowerCase().includes(keyword),
    );
  } catch {
    return false;
  }
};

const educationScoreText = (value: string): number => {
  const lowered = value.toLowerCase();
  return EDUCATIONAL_VIDEO_KEYWORDS.reduce((score, keyword) => {
    return lowered.includes(keyword) ? score + 1 : score;
  }, 0);
};

const parseDuckDuckGoResults = (html: string): ResearchWebResult[] => {
  const matches = [...html.matchAll(/<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];

  if (matches.length === 0) {
    return [];
  }

  const results: ResearchWebResult[] = [];
  const seenUrls = new Set<string>();

  for (const [index, match] of matches.entries()) {
    const nextMatchIndex = matches[index + 1]?.index ?? html.length;
    const sectionStart = match.index ?? 0;
    const section = html.slice(sectionStart, nextMatchIndex);
    const resolvedUrl = resolveDuckDuckGoUrl(match[1] ?? '');

    if (!resolvedUrl || seenUrls.has(resolvedUrl)) {
      continue;
    }

    const title = normalizeWhitespace(match[2] ?? '');
    if (!title) {
      continue;
    }

    const snippetMatch =
      section.match(
        /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i,
      ) ??
      section.match(
        /<div[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      );
    const snippet = normalizeWhitespace(snippetMatch?.[1] ?? '');

    results.push({
      id: `web:${results.length}:${resolvedUrl}`,
      title,
      url: resolvedUrl,
      displayUrl: toDisplayUrl(resolvedUrl),
      snippet,
      source: 'DuckDuckGo',
    });
    seenUrls.add(resolvedUrl);

    if (results.length >= MAX_WEB_RESULTS) {
      break;
    }
  }

  return results;
};

const extractJsonObjectAfterMarker = (
  html: string,
  marker: string,
): unknown | null => {
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) {
    return null;
  }

  const firstBraceIndex = html.indexOf('{', markerIndex);
  if (firstBraceIndex < 0) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let index = firstBraceIndex; index < html.length; index += 1) {
    const character = html[index];

    if (!character) {
      continue;
    }

    if (inString) {
      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (character === '\\') {
        escapeNext = true;
        continue;
      }

      if (character === '"') {
        inString = false;
      }

      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }

    if (character === '{') {
      depth += 1;
      continue;
    }

    if (character === '}') {
      depth -= 1;

      if (depth === 0) {
        const rawJson = html.slice(firstBraceIndex, index + 1);
        return JSON.parse(rawJson) as unknown;
      }
    }
  }

  return null;
};

const getTextFromRuns = (value: unknown): string => {
  if (!value || typeof value !== 'object') {
    return '';
  }

  if ('simpleText' in value && typeof value.simpleText === 'string') {
    return value.simpleText;
  }

  if ('runs' in value && Array.isArray(value.runs)) {
    return value.runs
      .map((run) =>
        run && typeof run === 'object' && 'text' in run && typeof run.text === 'string'
          ? run.text
          : '',
      )
      .join('')
      .trim();
  }

  return '';
};

const collectVideoRenderers = (value: unknown, output: unknown[] = []): unknown[] => {
  if (!value) {
    return output;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectVideoRenderers(item, output);
    }
    return output;
  }

  if (typeof value !== 'object') {
    return output;
  }

  if ('videoRenderer' in value) {
    output.push((value as { videoRenderer: unknown }).videoRenderer);
  }

  for (const child of Object.values(value)) {
    collectVideoRenderers(child, output);
  }

  return output;
};

const parseYouTubeVideos = (
  html: string,
  query: string,
): ResearchVideoResult[] => {
  const initialData =
    extractJsonObjectAfterMarker(html, 'var ytInitialData =') ??
    extractJsonObjectAfterMarker(html, 'window["ytInitialData"] =') ??
    extractJsonObjectAfterMarker(html, 'ytInitialData =');

  if (!initialData) {
    return [];
  }

  const renderers = collectVideoRenderers(initialData);
  const results: ResearchVideoResult[] = [];
  const seenVideoIds = new Set<string>();

  for (const renderer of renderers) {
    if (!renderer || typeof renderer !== 'object') {
      continue;
    }

    const videoId =
      'videoId' in renderer && typeof renderer.videoId === 'string'
        ? renderer.videoId
        : '';
    if (!videoId || seenVideoIds.has(videoId)) {
      continue;
    }

    const title =
      'title' in renderer ? getTextFromRuns(renderer.title) : '';
    if (!title) {
      continue;
    }

    const channel =
      'ownerText' in renderer ? getTextFromRuns(renderer.ownerText) || null : null;
    const duration =
      'lengthText' in renderer ? getTextFromRuns(renderer.lengthText) || null : null;

    const thumbnail =
      'thumbnail' in renderer &&
      renderer.thumbnail &&
      typeof renderer.thumbnail === 'object' &&
      'thumbnails' in renderer.thumbnail &&
      Array.isArray(renderer.thumbnail.thumbnails)
        ? renderer.thumbnail.thumbnails
            .map((entry) =>
              entry &&
              typeof entry === 'object' &&
              'url' in entry &&
              typeof entry.url === 'string'
                ? entry.url
                : '',
            )
            .filter(Boolean)
            .at(-1) ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
        : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    results.push({
      id: `video:${videoId}`,
      title,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      thumbnailUrl: thumbnail,
      channel,
      duration,
      query,
    });
    seenVideoIds.add(videoId);

    if (results.length >= MAX_VIDEO_RESULTS) {
      break;
    }
  }

  return results;
};

const fetchText = async (url: string): Promise<string> => {
  const response = await fetch(url, {
    headers: DEFAULT_HEADERS,
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.text();
};

const fetchJson = async <T>(
  url: string,
  headers: Record<string, string>,
): Promise<T> => {
  const response = await fetch(url, {
    headers,
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
};

const searchBraveWeb = async (
  query: string,
  apiKey: string,
): Promise<ResearchWebResult[]> => {
  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', String(MAX_WEB_RESULTS));
  url.searchParams.set('country', 'us');
  url.searchParams.set('search_lang', 'en');

  const payload = await fetchJson<{
    web?: {
      results?: Array<{
        url?: string;
        title?: string;
        description?: string;
        profile?: {
          long_name?: string;
        };
      }>;
    };
  }>(url.toString(), {
    Accept: 'application/json',
    'X-Subscription-Token': apiKey,
  });

  const results = payload.web?.results ?? [];

  return results
    .map((entry, index) => {
      const resultUrl = entry.url?.trim() ?? '';
      const title = entry.title?.trim() ?? '';

      if (!resultUrl || !title) {
        return null;
      }

      return {
        id: `web:${index}:${resultUrl}`,
        title,
        url: resultUrl,
        displayUrl: toDisplayUrl(resultUrl),
        snippet: entry.description?.trim() ?? '',
        source: entry.profile?.long_name?.trim() || 'Brave Search',
      } satisfies ResearchWebResult;
    })
    .filter((entry): entry is ResearchWebResult => Boolean(entry));
};

const searchYouTubeVideosApi = async (
  query: string,
  apiKey: string,
): Promise<ResearchVideoResult[]> => {
  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('type', 'video');
  url.searchParams.set('maxResults', String(MAX_VIDEO_RESULTS));
  url.searchParams.set('videoEmbeddable', 'true');
  url.searchParams.set('safeSearch', 'moderate');
  url.searchParams.set('q', query);
  url.searchParams.set('key', apiKey);

  const payload = await fetchJson<{
    items?: Array<{
      id?: {
        videoId?: string;
      };
      snippet?: {
        title?: string;
        channelTitle?: string;
        thumbnails?: {
          high?: { url?: string };
          medium?: { url?: string };
          default?: { url?: string };
        };
      };
    }>;
  }>(url.toString(), {
    Accept: 'application/json',
  });

  return (payload.items ?? [])
    .map<ResearchVideoResult | null>((item) => {
      const videoId = item.id?.videoId?.trim() ?? '';
      const title = item.snippet?.title?.trim() ?? '';

      if (!videoId || !title) {
        return null;
      }

      return {
        id: `video:${videoId}`,
        title,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        thumbnailUrl:
          item.snippet?.thumbnails?.high?.url ??
          item.snippet?.thumbnails?.medium?.url ??
          item.snippet?.thumbnails?.default?.url ??
          `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        channel: item.snippet?.channelTitle?.trim() ?? null,
        duration: null,
        query,
      };
    })
    .filter((item): item is ResearchVideoResult => Boolean(item));
};

const applySafetyModeToWebResults = (
  results: ResearchWebResult[],
  safetyMode: 'balanced' | 'education',
): ResearchWebResult[] => {
  if (safetyMode === 'balanced') {
    return results.slice(0, MAX_WEB_RESULTS);
  }

  return [...results]
    .sort((left, right) => {
      const leftScore =
        (isEducationalUrl(left.url) ? 3 : 0) +
        educationScoreText(`${left.title} ${left.snippet}`);
      const rightScore =
        (isEducationalUrl(right.url) ? 3 : 0) +
        educationScoreText(`${right.title} ${right.snippet}`);

      return rightScore - leftScore;
    })
    .slice(0, MAX_WEB_RESULTS);
};

const applySafetyModeToVideos = (
  results: ResearchVideoResult[],
  safetyMode: 'balanced' | 'education',
): ResearchVideoResult[] => {
  if (safetyMode === 'balanced') {
    return results.slice(0, MAX_VIDEO_RESULTS);
  }

  return [...results]
    .sort((left, right) => {
      const leftScore = educationScoreText(
        `${left.title} ${left.channel ?? ''} ${left.query}`,
      );
      const rightScore = educationScoreText(
        `${right.title} ${right.channel ?? ''} ${right.query}`,
      );

      return rightScore - leftScore;
    })
    .slice(0, MAX_VIDEO_RESULTS);
};

export const searchResearch = async (
  input: ResearchSearchInput,
  config: ResearchProviderConfig,
): Promise<ResearchSearchResult> => {
  const query = input.query.trim();
  const videoQuery = input.videoQuery?.trim() || query;

  if (!query) {
    throw new Error('Enter a search query to start research.');
  }

  const webPromise = config.braveApiKey
    ? searchBraveWeb(query, config.braveApiKey)
    : fetchText(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      ).then(parseDuckDuckGoResults);
  const videoPromise = config.youTubeApiKey
    ? searchYouTubeVideosApi(videoQuery, config.youTubeApiKey)
    : fetchText(
        `https://www.youtube.com/results?search_query=${encodeURIComponent(videoQuery)}`,
      ).then((html) => parseYouTubeVideos(html, videoQuery));

  const [webSettled, videoSettled] = await Promise.allSettled([
    webPromise,
    videoPromise,
  ]);

  const webResults =
    webSettled.status === 'fulfilled'
      ? applySafetyModeToWebResults(webSettled.value, config.safetyMode)
      : [];
  const videos =
    videoSettled.status === 'fulfilled'
      ? applySafetyModeToVideos(videoSettled.value, config.safetyMode)
      : [];

  if (webResults.length === 0 && videos.length === 0) {
    throw new Error(
      'Research search did not return any usable results. Please try a narrower query.',
    );
  }

  return {
    query,
    videoQuery,
    results: webResults,
    videos,
    provider: [
      config.braveApiKey ? 'Brave Search API' : 'DuckDuckGo fallback',
      config.youTubeApiKey ? 'YouTube Data API' : 'YouTube fallback',
    ].join(' + '),
    safetyMode: config.safetyMode,
  };
};

export const __testables__ = {
  applySafetyModeToVideos,
  applySafetyModeToWebResults,
  parseDuckDuckGoResults,
  parseYouTubeVideos,
};
