import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import type { PracticeSet, PracticeDifficulty } from '../../shared/ipc';
import {
  createStructuredResponse,
  type StructuredAiProviderConfig,
} from '../ai/provider';
import type {
  DatabaseService,
  PracticeSetRecord,
  SubjectChunkContextRow,
  SubjectPageContextRow,
} from '../db/database';
import { extractCitationExcerpt } from '../analysis/citation-excerpts';

const MAX_SOURCE_PAGES = 6;
const MAX_SOURCE_CHUNKS = 10;
const MAX_CHUNK_TEXT_LENGTH = 500;

const practiceResponseSchema = z.object({
  questions: z
    .array(
      z.object({
        prompt: z.string().min(1).max(1600),
        answer: z.string().min(1).max(1800),
      }),
    )
    .min(1)
    .max(8),
});

type PracticeResponse = z.infer<typeof practiceResponseSchema>;
type RawPracticeResponse = {
  questions?: unknown;
};

const practiceResponseSchemaDefinition: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['questions'],
  properties: {
    questions: {
      type: 'array',
      minItems: 1,
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['prompt', 'answer'],
        properties: {
          prompt: { type: 'string' },
          answer: { type: 'string' },
        },
      },
    },
  },
};

const practiceSystemPrompt = [
  'You generate study practice problems for one course division.',
  'Create original, self-contained questions inspired by the provided course material and problem type.',
  'Match the requested difficulty and avoid copying the source text verbatim.',
  'Each answer should be a concise answer key or worked result that helps the student check their work.',
  'Do not reference missing diagrams, images, or external tools.',
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

const scoreChunk = (chunk: SubjectChunkContextRow, queryTokens: string[]): number => {
  const haystack = normalizeWhitespace(chunk.textContent).toLowerCase();
  if (!haystack) {
    return 0;
  }

  return queryTokens.reduce((score, token) => {
    return haystack.includes(token) ? score + 1 : score;
  }, 0);
};

const pickRelevantChunks = (
  chunks: SubjectChunkContextRow[],
  queryText: string,
): SubjectChunkContextRow[] => {
  const queryTokens = tokenize(queryText);

  if (queryTokens.length === 0) {
    return chunks.slice(0, MAX_SOURCE_CHUNKS);
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

      if (left.chunk.pageNumber !== right.chunk.pageNumber) {
        return left.chunk.pageNumber - right.chunk.pageNumber;
      }

      return left.chunk.chunkIndex - right.chunk.chunkIndex;
    })
    .slice(0, MAX_SOURCE_CHUNKS)
    .map((entry) => entry.chunk);
};

const mapPracticeSetRecord = (record: PracticeSetRecord): PracticeSet => {
  const clueText = [
    record.practiceSet.problemTypeTitle,
    record.practiceSet.difficulty,
    ...record.questions.map((question) => question.prompt),
  ];

  return {
    id: record.practiceSet.id,
    subjectId: record.practiceSet.subjectId,
    divisionId: record.practiceSet.divisionId,
    problemTypeId: record.practiceSet.problemTypeId,
    problemTypeTitle: record.practiceSet.problemTypeTitle,
    difficulty: record.practiceSet.difficulty as PracticeDifficulty,
    questionCount: record.practiceSet.questionCount,
    createdAt: new Date(record.practiceSet.createdAt).toISOString(),
    updatedAt: new Date(record.practiceSet.updatedAt).toISOString(),
    sourcePages: record.sourcePages.map((page) => {
      const excerpt = extractCitationExcerpt(page.textContent, clueText);

      return {
        pageId: page.pageId,
        documentId: page.documentId,
        documentName: page.documentName,
        documentKind: page.documentKind as 'lecture' | 'homework',
        pageNumber: page.pageNumber,
        excerptText: excerpt.excerptText,
        highlightText: excerpt.highlightText,
        thumbnailAssetPath: null,
        textBounds: null,
      };
    }),
    questions: record.questions.map((question) => ({
      id: question.id,
      questionIndex: question.questionIndex,
      prompt: question.prompt,
      answer: question.answer,
      revealed: question.revealed,
      createdAt: new Date(question.createdAt).toISOString(),
      updatedAt: new Date(question.updatedAt).toISOString(),
    })),
  };
};

const normalizeQuestionField = (value: unknown, maxLength: number): string => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
};

const repairPracticeResponse = (
  rawResponse: RawPracticeResponse,
  requestedCount: number,
): PracticeResponse => {
  const rawQuestions = Array.isArray(rawResponse.questions)
    ? rawResponse.questions
    : [];

  const repairedQuestions = rawQuestions
    .map((question) => {
      if (!question || typeof question !== 'object') {
        return null;
      }

      const prompt = normalizeQuestionField(
        'prompt' in question ? question.prompt : '',
        1600,
      );
      const answer = normalizeQuestionField(
        'answer' in question ? question.answer : '',
        1800,
      );

      if (!prompt || !answer) {
        return null;
      }

      return { prompt, answer };
    })
    .filter((question): question is { prompt: string; answer: string } => Boolean(question))
    .slice(0, requestedCount);

  if (repairedQuestions.length === 0) {
    throw new Error(
      'Practice generation returned malformed content and no valid questions could be recovered.',
    );
  }

  return {
    questions: repairedQuestions,
  };
};

const buildPracticePrompt = (input: {
  division: {
    title: string;
    summary: string;
    keyConcepts: string[];
    sourcePages: SubjectPageContextRow[];
  };
  problemType: {
    id: string;
    title: string;
    description: string;
  };
  difficulty: PracticeDifficulty;
  count: number;
  retrievedChunks: SubjectChunkContextRow[];
}): string => {
  const chunkGroups = new Map<string, SubjectChunkContextRow[]>();
  for (const chunk of input.retrievedChunks) {
    const existing = chunkGroups.get(chunk.pageId) ?? [];
    existing.push(chunk);
    chunkGroups.set(chunk.pageId, existing);
  }

  const sourcePages = input.division.sourcePages
    .filter((page) => {
      return chunkGroups.has(page.pageId);
    })
    .slice(0, MAX_SOURCE_PAGES);

  const evidenceBlocks = sourcePages.map((page, index) => {
    const chunkText = (chunkGroups.get(page.pageId) ?? [])
      .slice(0, 2)
      .map((chunk) => normalizeWhitespace(chunk.textContent).slice(0, MAX_CHUNK_TEXT_LENGTH))
      .filter(Boolean)
      .join('\n\n');

    const fallbackText = normalizeWhitespace(page.textContent).slice(0, MAX_CHUNK_TEXT_LENGTH);

    return [
      `SOURCE_${String(index + 1).padStart(2, '0')}`,
      `document: ${page.documentName}`,
      `page_number: ${page.pageNumber}`,
      'evidence:',
      chunkText || fallbackText,
    ].join('\n');
  });

  return [
    `Division title: ${input.division.title}`,
    `Division summary: ${input.division.summary}`,
    `Division key concepts: ${input.division.keyConcepts.join(', ')}`,
    `Problem type: ${input.problemType.title}`,
    `Problem type description: ${input.problemType.description}`,
    `Requested difficulty: ${input.difficulty}`,
    `Requested question count: ${input.count}`,
    '',
    'Course material evidence:',
    evidenceBlocks.join('\n\n---\n\n'),
    '',
    'Return only the requested number of original practice questions.',
    'Questions should be answerable using the concepts in the evidence above.',
    'Answers should be concise but specific enough to serve as an answer key.',
  ].join('\n');
};

export const mapPersistedPracticeSets = (records: PracticeSetRecord[]): PracticeSet[] => {
  return records.map(mapPracticeSetRecord);
};

export const generatePracticeSet = async (input: {
  providerConfig: StructuredAiProviderConfig;
  subjectId: string;
  divisionId: string;
  problemTypeId: string;
  difficulty: PracticeDifficulty;
  count: number;
  database: DatabaseService;
}): Promise<PracticeSet> => {
  const analysis = input.database.getSubjectAnalysis(input.subjectId);
  const divisionRecord = analysis.divisions.find(
    (division) => division.division.id === input.divisionId,
  );

  if (!divisionRecord) {
    throw new Error('Division not found for practice generation.');
  }

  const problemType = divisionRecord.problemTypes.find(
    (entry) => entry.id === input.problemTypeId,
  );

  if (!problemType) {
    throw new Error('Problem type not found for the selected division.');
  }

  const sourcePageIds = new Set(divisionRecord.sourcePages.map((page) => page.pageId));
  const relevantChunks = input.database
    .getReadySubjectChunks(input.subjectId)
    .filter((chunk) => sourcePageIds.has(chunk.pageId));
  const retrievedChunks = pickRelevantChunks(
    relevantChunks,
    [
      divisionRecord.division.title,
      divisionRecord.division.summary,
      ...divisionRecord.keyConcepts,
      problemType.title,
      problemType.description,
      input.difficulty,
    ].join('\n'),
  );

  const userPrompt = buildPracticePrompt({
    division: {
      title: divisionRecord.division.title,
      summary: divisionRecord.division.summary,
      keyConcepts: divisionRecord.keyConcepts,
      sourcePages: divisionRecord.sourcePages,
    },
    problemType: {
      id: problemType.id,
      title: problemType.title,
      description: problemType.description,
    },
    difficulty: input.difficulty,
    count: input.count,
    retrievedChunks,
  });

  const rawResponse = await createStructuredResponse<RawPracticeResponse>({
    providerConfig: input.providerConfig,
    systemPrompt: practiceSystemPrompt,
    userPrompt,
    schemaName: 'practice_problem_generation',
    schema: practiceResponseSchemaDefinition,
  });

  const parsed = (() => {
    const schemaResult = practiceResponseSchema.safeParse(rawResponse);
    if (schemaResult.success) {
      return schemaResult.data;
    }

    return repairPracticeResponse(rawResponse, input.count);
  })();
  const questionCount = Math.min(input.count, parsed.questions.length);
  const practiceSetId = randomUUID();
  const persistedSourcePageIds = (() => {
    const sourcePageIds = divisionRecord.sourcePages
      .filter((page) => {
        return retrievedChunks.some((chunk) => chunk.pageId === page.pageId);
      })
      .slice(0, MAX_SOURCE_PAGES)
      .map((page) => page.pageId);

    if (sourcePageIds.length > 0) {
      return sourcePageIds;
    }

    return divisionRecord.sourcePages
      .slice(0, MAX_SOURCE_PAGES)
      .map((page) => page.pageId);
  })();
  const record = input.database.insertPracticeSet({
    practiceSet: {
      id: practiceSetId,
      subjectId: input.subjectId,
      divisionId: input.divisionId,
      problemTypeId: problemType.id,
      problemTypeTitle: problemType.title,
      difficulty: input.difficulty,
      questionCount,
    },
    sourcePageIds: persistedSourcePageIds,
    questions: parsed.questions.slice(0, questionCount).map((question, index) => ({
      id: randomUUID(),
      questionIndex: index + 1,
      prompt: question.prompt.trim(),
      answer: question.answer.trim(),
      revealed: false,
    })),
  });

  return mapPracticeSetRecord(record);
};
