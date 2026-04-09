import type { AiProvider } from '../../shared/ipc';
import {
  createOllamaStructuredResponse,
  DEFAULT_OLLAMA_BASE_URL,
  DEFAULT_OLLAMA_INGESTION_MODEL,
} from './ollama';
import {
  createOpenAiStructuredResponse,
  DEFAULT_OPENAI_INGESTION_MODEL,
} from './openai';

export const getDefaultModelForProvider = (provider: AiProvider): string => {
  return provider === 'ollama'
    ? DEFAULT_OLLAMA_INGESTION_MODEL
    : DEFAULT_OPENAI_INGESTION_MODEL;
};

export type StructuredAiProviderConfig =
  | {
      provider: 'openai';
      apiKey: string;
      model?: string;
    }
  | {
      provider: 'ollama';
      baseUrl?: string;
      model?: string;
    };

type CreateStructuredResponseInput = {
  providerConfig: StructuredAiProviderConfig;
  systemPrompt: string;
  userPrompt: string;
  schemaName: string;
  schema: Record<string, unknown>;
};

export const getResolvedProviderLabel = (
  providerConfig: StructuredAiProviderConfig,
): string => {
  if (providerConfig.provider === 'ollama') {
    return `Ollama (${providerConfig.baseUrl ?? DEFAULT_OLLAMA_BASE_URL})`;
  }

  return 'OpenAI';
};

export const getResolvedProviderModel = (
  providerConfig: StructuredAiProviderConfig,
): string => {
  return providerConfig.model ?? getDefaultModelForProvider(providerConfig.provider);
};

export const createStructuredResponse = async <T>(
  input: CreateStructuredResponseInput,
): Promise<T> => {
  if (input.providerConfig.provider === 'ollama') {
    return createOllamaStructuredResponse<T>({
      baseUrl: input.providerConfig.baseUrl,
      model: getResolvedProviderModel(input.providerConfig),
      systemPrompt: input.systemPrompt,
      userPrompt: input.userPrompt,
      schema: input.schema,
    });
  }

  return createOpenAiStructuredResponse<T>({
    apiKey: input.providerConfig.apiKey,
    model: getResolvedProviderModel(input.providerConfig),
    systemPrompt: input.systemPrompt,
    userPrompt: input.userPrompt,
    schemaName: input.schemaName,
    schema: input.schema,
  });
};
