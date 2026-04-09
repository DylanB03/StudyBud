const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

export const DEFAULT_OPENAI_INGESTION_MODEL = 'gpt-5.4-mini';

type CreateOpenAiStructuredResponseInput = {
  apiKey: string;
  model?: string;
  systemPrompt: string;
  userPrompt: string;
  schemaName: string;
  schema: Record<string, unknown>;
};

const extractOutputText = (responsePayload: unknown): string => {
  if (
    responsePayload &&
    typeof responsePayload === 'object' &&
    'output_text' in responsePayload &&
    typeof responsePayload.output_text === 'string'
  ) {
    return responsePayload.output_text;
  }

  if (
    !responsePayload ||
    typeof responsePayload !== 'object' ||
    !('output' in responsePayload) ||
    !Array.isArray(responsePayload.output)
  ) {
    throw new Error('OpenAI response did not include structured output text.');
  }

  const textParts = responsePayload.output.flatMap((item) => {
    if (
      !item ||
      typeof item !== 'object' ||
      !('type' in item) ||
      item.type !== 'message' ||
      !('content' in item) ||
      !Array.isArray(item.content)
    ) {
      return [];
    }

    return item.content.flatMap((contentItem: unknown) => {
      if (
        contentItem &&
        typeof contentItem === 'object' &&
        'type' in contentItem &&
        contentItem.type === 'output_text' &&
        'text' in contentItem &&
        typeof contentItem.text === 'string'
      ) {
        return [contentItem.text];
      }

      return [];
    });
  });

  if (textParts.length === 0) {
    throw new Error('OpenAI response did not contain any output text.');
  }

  return textParts.join('\n');
};

export const createOpenAiStructuredResponse = async <T>(
  input: CreateOpenAiStructuredResponseInput,
): Promise<T> => {
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: input.model ?? DEFAULT_OPENAI_INGESTION_MODEL,
      reasoning: {
        effort: 'low',
      },
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: input.systemPrompt,
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: input.userPrompt,
            },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: input.schemaName,
          strict: true,
          schema: input.schema,
        },
      },
    }),
  });

  const payload = (await response.json()) as unknown;

  if (!response.ok) {
    const errorMessage =
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      payload.error &&
      typeof payload.error === 'object' &&
      'message' in payload.error &&
      typeof payload.error.message === 'string'
        ? payload.error.message
        : `OpenAI request failed with status ${response.status}.`;

    throw new Error(errorMessage);
  }

  const outputText = extractOutputText(payload);

  try {
    return JSON.parse(outputText) as T;
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `OpenAI returned invalid JSON: ${error.message}`
        : 'OpenAI returned invalid JSON.',
    );
  }
};
