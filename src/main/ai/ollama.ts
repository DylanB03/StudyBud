import fs from 'node:fs';
import { URL } from 'node:url';

const DEFAULT_OLLAMA_HOST = 'http://localhost:11434';
const OLLAMA_CHAT_URL_PATH = '/api/chat';
const OLLAMA_TAGS_URL_PATH = '/api/tags';
const OLLAMA_HEALTHCHECK_TIMEOUT_MS = 4_000;
const OLLAMA_REQUEST_TIMEOUT_MS = 3 * 60 * 1000;

export const DEFAULT_OLLAMA_BASE_URL = DEFAULT_OLLAMA_HOST;
export const DEFAULT_OLLAMA_INGESTION_MODEL = 'qwen3:8b';

type CreateOllamaStructuredResponseInput = {
  baseUrl?: string;
  model?: string;
  systemPrompt: string;
  userPrompt: string;
  schema: Record<string, unknown>;
};

const normalizeBaseUrl = (value?: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return DEFAULT_OLLAMA_BASE_URL;
  }

  return value.trim().replace(/\/+$/, '');
};

const isWslRuntime = (): boolean => {
  try {
    const version = fs.readFileSync('/proc/version', 'utf8').toLowerCase();
    return version.includes('microsoft') || version.includes('wsl');
  } catch {
    return false;
  }
};

const getWindowsHostAddressFromWsl = (): string | null => {
  try {
    const resolvConf = fs.readFileSync('/etc/resolv.conf', 'utf8');
    const nameserverLine = resolvConf
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.startsWith('nameserver '));

    if (!nameserverLine) {
      return null;
    }

    const [, address] = nameserverLine.split(/\s+/, 2);
    return address || null;
  } catch {
    return null;
  }
};

const getReachabilityCandidates = (baseUrl: string): string[] => {
  const normalized = normalizeBaseUrl(baseUrl);
  const candidates = [normalized];

  try {
    const parsed = new URL(normalized);
    const hostname = parsed.hostname.toLowerCase();

    if (
      isWslRuntime() &&
      (hostname === 'localhost' || hostname === '127.0.0.1')
    ) {
      const windowsHostAddress = getWindowsHostAddressFromWsl();

      if (windowsHostAddress) {
        const fallback = new URL(normalized);
        fallback.hostname = windowsHostAddress;
        candidates.push(fallback.toString().replace(/\/+$/, ''));
      }
    }
  } catch {
    return candidates;
  }

  return [...new Set(candidates)];
};

const createTimeoutSignal = (timeoutMs: number): AbortSignal => {
  return AbortSignal.timeout(timeoutMs);
};

const getOllamaHelpSuffix = (baseUrl: string, attemptedUrls: string[]): string => {
  const attempted = attemptedUrls.join(', ');
  const wslHint =
    isWslRuntime() && attemptedUrls.some((url) => /localhost|127\.0\.0\.1/.test(url))
      ? ' This app is running inside WSL2, so a Windows-hosted Ollama server may need the Windows host IP instead of localhost.'
      : '';

  return `Confirm Ollama is running and reachable. Attempted: ${attempted}.${wslHint}`;
};

const verifyOllamaReachable = async (baseUrl: string): Promise<string> => {
  const candidates = getReachabilityCandidates(baseUrl);
  const failures: string[] = [];

  for (const candidate of candidates) {
    try {
      const response = await fetch(`${candidate}${OLLAMA_TAGS_URL_PATH}`, {
        method: 'GET',
        signal: createTimeoutSignal(OLLAMA_HEALTHCHECK_TIMEOUT_MS),
      });

      if (!response.ok) {
        failures.push(`${candidate} returned status ${response.status}`);
        continue;
      }

      return candidate;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        failures.push(`${candidate} timed out`);
        continue;
      }

      const message = error instanceof Error ? error.message : 'unknown error';
      failures.push(`${candidate} failed (${message})`);
    }
  }

  throw new Error(
    `Could not reach Ollama before starting analysis. ${getOllamaHelpSuffix(
      baseUrl,
      candidates,
    )} Last results: ${failures.join('; ')}`,
  );
};

export const createOllamaStructuredResponse = async <T>(
  input: CreateOllamaStructuredResponseInput,
): Promise<T> => {
  const normalizedBaseUrl = normalizeBaseUrl(input.baseUrl);
  const reachableBaseUrl = await verifyOllamaReachable(normalizedBaseUrl);

  let response: Response;

  try {
    response = await fetch(`${reachableBaseUrl}${OLLAMA_CHAT_URL_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: createTimeoutSignal(OLLAMA_REQUEST_TIMEOUT_MS),
      body: JSON.stringify({
        model: input.model ?? DEFAULT_OLLAMA_INGESTION_MODEL,
        stream: false,
        format: input.schema,
        messages: [
          {
            role: 'system',
            content: input.systemPrompt,
          },
          {
            role: 'user',
            content: input.userPrompt,
          },
        ],
        options: {
          temperature: 0.2,
        },
      }),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new Error(
        `Ollama analysis timed out after waiting several minutes for a response. ${getOllamaHelpSuffix(normalizedBaseUrl, getReachabilityCandidates(normalizedBaseUrl))}`,
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'unknown error';
    throw new Error(
      `Ollama request failed before a response was received. ${getOllamaHelpSuffix(normalizedBaseUrl, getReachabilityCandidates(normalizedBaseUrl))} Cause: ${errorMessage}`,
    );
  }

  const payload = (await response.json()) as unknown;

  if (!response.ok) {
    const errorMessage =
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      typeof payload.error === 'string'
        ? payload.error
        : `Ollama request failed with status ${response.status}.`;

    throw new Error(errorMessage);
  }

  if (
    !payload ||
    typeof payload !== 'object' ||
    !('message' in payload) ||
    !payload.message ||
    typeof payload.message !== 'object' ||
    !('content' in payload.message) ||
    typeof payload.message.content !== 'string'
  ) {
    throw new Error('Ollama response did not contain message content.');
  }

  try {
    return JSON.parse(payload.message.content) as T;
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Ollama returned invalid JSON: ${error.message}`
        : 'Ollama returned invalid JSON.',
    );
  }
};
