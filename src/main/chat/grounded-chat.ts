import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import type {
  CitationRef,
  DivisionChatMessage,
  GroundedAnswer,
  SelectionContext,
} from '../../shared/ipc';
import type {
  ChatMessageRow,
  DatabaseService,
  SubjectChunkContextRow,
  SubjectPageContextRow,
} from '../db/database';
import {
  createStructuredResponse,
  getResolvedProviderLabel,
  getResolvedProviderModel,
  type StructuredAiProviderConfig,
} from '../ai/provider';
import { extractCitationExcerpt } from '../analysis/citation-excerpts';

const MAX_HISTORY_MESSAGES = 6;
const MAX_RETRIEVED_CHUNKS = 8;
const MAX_CHUNK_TEXT_LENGTH = 600;

const groundedAnswerSchema = z.object({
  answerMarkdown: z.string().min(1).max(4000),
  citationPageRefs: z.array(z.string().min(1)).max(8),
  followups: z.array(z.string().min(1).max(160)).max(4),
  suggestedSearchQueries: z.array(z.string().min(1).max(160)).max(4),
  suggestedVideoQueries: z.array(z.string().min(1).max(160)).max(4),
});

type GroundedAnswerModel = z.infer<typeof groundedAnswerSchema>;

const groundedAnswerSchemaDefinition: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: [
    'answerMarkdown',
    'citationPageRefs',
    'followups',
    'suggestedSearchQueries',
    'suggestedVideoQueries',
  ],
  properties: {
    answerMarkdown: { type: 'string' },
    citationPageRefs: {
      type: 'array',
      maxItems: 8,
      items: { type: 'string' },
    },
    followups: {
      type: 'array',
      maxItems: 4,
      items: { type: 'string' },
    },
    suggestedSearchQueries: {
      type: 'array',
      maxItems: 4,
      items: { type: 'string' },
    },
    suggestedVideoQueries: {
      type: 'array',
      maxItems: 4,
      items: { type: 'string' },
    },
  },
};

const groundedChatSystemPrompt = [
  'You are an in-app study assistant answering questions about one division of a course.',
  'Use only the provided course material context and cite only the PAGE refs you were given.',
  'Answer directly, clearly, and in a study-friendly way.',
  'If the question goes beyond the provided material, say what is uncertain and stay grounded.',
  'Prefer concise explanations with concrete references to the cited material.',
  'Do not mention PAGE refs, citation ids, or source labels in the visible answer text.',
  'Keep all source attribution in citationPageRefs only so the UI can show grounding separately.',
  'Return 1 to 4 suggestedSearchQueries that would help the student read further on the web.',
  'Return 1 to 4 suggestedVideoQueries that would help the student find relevant explainer videos.',
  'Make search and video suggestions concrete, topic-specific, and aligned to the current division.',
  'When you write mathematics, format it as LaTeX using $...$ for inline math and $$...$$ for displayed equations.',
  'Use ASCII math notation inside LaTeX, such as N_1, x^2, \\frac{a}{b}, and \\times.',
  'Do not emit raw LaTeX commands outside math delimiters unless you are showing literal code.',
].join(' ');

const normalizeWhitespace = (value: string): string => {
  return value.replace(/\s+/g, ' ').trim();
};

const tokenize = (value: string): string[] => {
  return normalizeWhitespace(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length >= 3);
};

const scoreChunk = (
  chunk: SubjectChunkContextRow,
  queryTokens: string[],
): number => {
  const haystack = normalizeWhitespace(chunk.textContent).toLowerCase();
  if (!haystack) {
    return 0;
  }

  return queryTokens.reduce((score, token) => {
    return haystack.includes(token) ? score + 1 : score;
  }, 0);
};

const parseJsonArray = <T>(value: string, fallback: T[]): T[] => {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
};

const sanitizeVisibleAnswerText = (value: string): string => {
  return value
    .replace(/\s*\(?\[?PAGE_\d{3}\]?\)?/g, '')
    .replace(/\(\s*,/g, '(')
    .replace(/,\s*\)/g, ')')
    .replace(/\(\s*\)/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const mapChatMessageRow = (row: ChatMessageRow): DivisionChatMessage => {
  return {
    id: row.id,
    subjectId: row.subjectId,
    divisionId: row.divisionId,
    role: row.role === 'assistant' ? 'assistant' : 'user',
    content: row.content,
    citations: parseJsonArray<CitationRef>(row.citationsJson, []),
    followups: parseJsonArray<string>(row.followupsJson, []),
    suggestedSearchQueries: parseJsonArray<string>(
      row.suggestedSearchQueriesJson,
      [],
    ),
    suggestedVideoQueries: parseJsonArray<string>(
      row.suggestedVideoQueriesJson,
      [],
    ),
    selectionContext: row.selectionContextJson
      ? (JSON.parse(row.selectionContextJson) as SelectionContext)
      : null,
    createdAt: new Date(row.createdAt).toISOString(),
  };
};

const buildCitation = (
  page: SubjectPageContextRow,
  clueText: string[],
): CitationRef => {
  const excerpt = extractCitationExcerpt(page.textContent, clueText);

  return {
    pageId: page.pageId,
    documentId: page.documentId,
    documentName: page.documentName,
    documentKind: page.documentKind as CitationRef['documentKind'],
    pageNumber: page.pageNumber,
    excerptText: excerpt.excerptText,
    highlightText: excerpt.highlightText,
    thumbnailAssetPath: null,
    textBounds: null,
  };
};

const buildPrompt = (input: {
  division: {
    title: string;
    summary: string;
    keyConcepts: string[];
    sourcePages: SubjectPageContextRow[];
  };
  selectionContext: SelectionContext | null;
  prompt: string;
  conversationHistory: DivisionChatMessage[];
  retrievedChunks: SubjectChunkContextRow[];
  candidatePages: SubjectPageContextRow[];
  refToPage: Map<string, SubjectPageContextRow>;
}): string => {
  const historyBlock =
    input.conversationHistory.length === 0
      ? 'No earlier messages.'
      : input.conversationHistory
          .map((message) => {
            const prefix = message.role === 'assistant' ? 'assistant' : 'user';
            return `${prefix}: ${message.content}`;
          })
          .join('\n');

  const selectionBlock = input.selectionContext
    ? [
        'Selected text context:',
        `kind: ${input.selectionContext.kind}`,
        `selected_text: ${input.selectionContext.selectedText}`,
        `surrounding_text: ${input.selectionContext.surroundingText}`,
      ].join('\n')
    : 'Selected text context: none';

  const pageBlocks = input.candidatePages.map((page, index) => {
    const ref = `PAGE_${String(index + 1).padStart(3, '0')}`;
    input.refToPage.set(ref, page);

    const chunkText = input.retrievedChunks
      .filter((chunk) => chunk.pageId === page.pageId)
      .map((chunk) => normalizeWhitespace(chunk.textContent).slice(0, MAX_CHUNK_TEXT_LENGTH))
      .join('\n\n');

    return [
      `[${ref}]`,
      `document: ${page.documentName}`,
      `document_kind: ${page.documentKind}`,
      `page_number: ${page.pageNumber}`,
      'evidence:',
      chunkText || normalizeWhitespace(page.textContent).slice(0, MAX_CHUNK_TEXT_LENGTH),
    ].join('\n');
  });

  return [
    `Division title: ${input.division.title}`,
    `Division summary: ${input.division.summary}`,
    `Division key concepts: ${input.division.keyConcepts.join(', ')}`,
    '',
    selectionBlock,
    '',
    'Recent conversation:',
    historyBlock,
    '',
    `Current user question: ${input.prompt}`,
    '',
    'Course material evidence:',
    pageBlocks.join('\n\n---\n\n'),
    '',
    'Return a grounded answer.',
    'Use citationPageRefs only from the PAGE refs above.',
    'Do not include PAGE refs or source labels anywhere in answerMarkdown.',
  ].join('\n');
};

const pickRelevantChunks = (
  chunks: SubjectChunkContextRow[],
  queryText: string,
): SubjectChunkContextRow[] => {
  const queryTokens = tokenize(queryText);

  if (queryTokens.length === 0) {
    return chunks.slice(0, MAX_RETRIEVED_CHUNKS);
  }

  return [...chunks]
    .map((chunk) => ({
      chunk,
      score: scoreChunk(chunk, queryTokens),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.chunk.pageNumber - right.chunk.pageNumber;
    })
    .slice(0, MAX_RETRIEVED_CHUNKS)
    .map((entry) => entry.chunk);
};

export const answerDivisionChat = async (input: {
  providerConfig: StructuredAiProviderConfig;
  subjectId: string;
  divisionId: string;
  prompt: string;
  selectionContext: SelectionContext | null;
  database: DatabaseService;
}): Promise<{
  userMessage: DivisionChatMessage;
  assistantMessage: DivisionChatMessage;
  answer: GroundedAnswer;
}> => {
  const analysis = input.database.getSubjectAnalysis(input.subjectId);
  const divisionRecord = analysis.divisions.find(
    (division) => division.division.id === input.divisionId,
  );

  if (!divisionRecord) {
    throw new Error('Division not found for grounded chat.');
  }

  const division = {
    title: divisionRecord.division.title,
    summary: divisionRecord.division.summary,
    keyConcepts: divisionRecord.keyConcepts,
    sourcePages: divisionRecord.sourcePages,
  };

  const pageIds = new Set(division.sourcePages.map((page) => page.pageId));
  const divisionChunks = input.database
    .getReadySubjectChunks(input.subjectId)
    .filter((chunk) => pageIds.has(chunk.pageId));

  const questionText = [
    input.prompt,
    input.selectionContext?.selectedText ?? '',
    input.selectionContext?.surroundingText ?? '',
    division.title,
    division.summary,
    ...division.keyConcepts,
  ].join('\n');

  const retrievedChunks = pickRelevantChunks(divisionChunks, questionText);
  const candidatePages = division.sourcePages.filter((page) => {
    return retrievedChunks.some((chunk) => chunk.pageId === page.pageId);
  });
  const finalCandidatePages =
    candidatePages.length > 0 ? candidatePages : division.sourcePages.slice(0, 6);

  if (finalCandidatePages.length === 0) {
    throw new Error('No source pages were available for this division.');
  }

  const history = input.database
    .listChatMessagesBySubject(input.subjectId, input.divisionId)
    .map(mapChatMessageRow)
    .slice(-MAX_HISTORY_MESSAGES);

  const refToPage = new Map<string, SubjectPageContextRow>();
  const userPrompt = buildPrompt({
    division,
    selectionContext: input.selectionContext,
    prompt: input.prompt,
    conversationHistory: history,
    retrievedChunks,
    candidatePages: finalCandidatePages,
    refToPage,
  });

  const rawResponse = await createStructuredResponse<GroundedAnswerModel>({
    providerConfig: input.providerConfig,
    systemPrompt: groundedChatSystemPrompt,
    userPrompt,
    schemaName: 'grounded_division_chat',
    schema: groundedAnswerSchemaDefinition,
  });

  const parsed = groundedAnswerSchema.parse(rawResponse);
  const sanitizedAnswerMarkdown = sanitizeVisibleAnswerText(
    parsed.answerMarkdown.trim(),
  );
  const citationPages =
    parsed.citationPageRefs.length > 0
      ? parsed.citationPageRefs
          .map((ref) => refToPage.get(ref))
          .filter((page): page is SubjectPageContextRow => Boolean(page))
      : finalCandidatePages.slice(0, 1);

  const citations = citationPages.map((page) =>
    buildCitation(page, [
      input.prompt,
      input.selectionContext?.selectedText ?? '',
      division.title,
      division.summary,
      ...division.keyConcepts,
    ]),
  );

  const rows = input.database.insertChatMessages([
    {
      id: randomUUID(),
      subjectId: input.subjectId,
      divisionId: input.divisionId,
      role: 'user',
      content: input.prompt.trim(),
      citationsJson: JSON.stringify([]),
      followupsJson: JSON.stringify([]),
      suggestedSearchQueriesJson: JSON.stringify([]),
      suggestedVideoQueriesJson: JSON.stringify([]),
      selectionContextJson: input.selectionContext
        ? JSON.stringify(input.selectionContext)
        : null,
    },
    {
      id: randomUUID(),
      subjectId: input.subjectId,
      divisionId: input.divisionId,
      role: 'assistant',
      content: sanitizedAnswerMarkdown,
      citationsJson: JSON.stringify(citations),
      followupsJson: JSON.stringify(parsed.followups),
      suggestedSearchQueriesJson: JSON.stringify(parsed.suggestedSearchQueries),
      suggestedVideoQueriesJson: JSON.stringify(parsed.suggestedVideoQueries),
      selectionContextJson: input.selectionContext
        ? JSON.stringify(input.selectionContext)
        : null,
    },
  ]);

  const [userRow, assistantRow] = rows;
  if (!userRow || !assistantRow) {
    throw new Error('Grounded chat messages could not be stored.');
  }

  return {
    userMessage: mapChatMessageRow(userRow),
    assistantMessage: mapChatMessageRow(assistantRow),
    answer: {
      answerMarkdown: sanitizedAnswerMarkdown,
      citations,
      followups: parsed.followups,
      suggestedSearchQueries: parsed.suggestedSearchQueries,
      suggestedVideoQueries: parsed.suggestedVideoQueries,
    },
  };
};

export const mapPersistedDivisionChatMessages = (
  rows: ChatMessageRow[],
): DivisionChatMessage[] => {
  return rows.map(mapChatMessageRow);
};

export const getChatProviderSummary = (
  providerConfig: StructuredAiProviderConfig,
): {
  provider: string;
  model: string;
} => {
  return {
    provider: getResolvedProviderLabel(providerConfig),
    model: getResolvedProviderModel(providerConfig),
  };
};
