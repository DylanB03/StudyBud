import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import type {
  FlashcardDeck,
  PracticeDifficulty,
} from '../../shared/ipc';
import {
  createStructuredResponse,
  type StructuredAiProviderConfig,
} from '../ai/provider';
import type {
  DatabaseService,
  FlashcardDeckRecord,
  SubjectChunkContextRow,
} from '../db/database';

const MAX_SOURCE_CHUNKS = 14;
const MAX_CHUNK_TEXT_LENGTH = 520;

const flashcardResponseSchema = z.object({
  cards: z
    .array(
      z.object({
        front: z.string().min(1).max(300),
        back: z.string().min(1).max(1200),
        difficulty: z.enum(['easy', 'medium', 'hard']),
      }),
    )
    .min(1)
    .max(24),
});

type FlashcardResponse = z.infer<typeof flashcardResponseSchema>;
type RawFlashcardResponse = {
  cards?: unknown;
};

const flashcardResponseSchemaDefinition: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['cards'],
  properties: {
    cards: {
      type: 'array',
      minItems: 1,
      maxItems: 24,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['front', 'back', 'difficulty'],
        properties: {
          front: { type: 'string' },
          back: { type: 'string' },
          difficulty: {
            type: 'string',
            enum: ['easy', 'medium', 'hard'],
          },
        },
      },
    },
  },
};

const flashcardSystemPrompt = [
  'You generate study flashcards for selected course units.',
  'Return a balanced mix of easy, medium, and hard cards unless the requested count is too small.',
  'Front text should be a concise prompt, definition cue, derivation cue, or conceptual question.',
  'Back text should be the answer, explanation, formula, or short worked result.',
  'Keep cards self-contained and grounded in the provided material.',
  'Avoid references to diagrams, images, or unseen figures.',
  'Use markdown when helpful, and use LaTeX-style math notation for equations.',
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

const normalizeField = (value: unknown, maxLength: number): string => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
};

const repairFlashcardResponse = (
  rawResponse: RawFlashcardResponse,
  requestedCount: number,
): FlashcardResponse => {
  const rawCards = Array.isArray(rawResponse.cards) ? rawResponse.cards : [];

  const repairedCards = rawCards
    .map((card) => {
      if (!card || typeof card !== 'object') {
        return null;
      }

      const front = normalizeField('front' in card ? card.front : '', 300);
      const back = normalizeField('back' in card ? card.back : '', 1200);
      const difficultyValue = 'difficulty' in card ? card.difficulty : null;
      const difficulty =
        difficultyValue === 'easy' ||
        difficultyValue === 'medium' ||
        difficultyValue === 'hard'
          ? difficultyValue
          : 'medium';

      if (!front || !back) {
        return null;
      }

      return {
        front,
        back,
        difficulty,
      };
    })
    .filter(
      (
        card,
      ): card is {
        front: string;
        back: string;
        difficulty: PracticeDifficulty;
      } => Boolean(card),
    )
    .slice(0, requestedCount);

  if (repairedCards.length === 0) {
    throw new Error(
      'Flashcard generation returned malformed content and no valid cards could be recovered.',
    );
  }

  return {
    cards: repairedCards,
  };
};

const buildFlashcardPrompt = (input: {
  title: string;
  count: number;
  units: Array<{
    title: string;
    summary: string;
    keyConcepts: string[];
  }>;
  retrievedChunks: SubjectChunkContextRow[];
}): string => {
  const groupedChunks = new Map<string, SubjectChunkContextRow[]>();
  for (const chunk of input.retrievedChunks) {
    const existing = groupedChunks.get(chunk.pageId) ?? [];
    existing.push(chunk);
    groupedChunks.set(chunk.pageId, existing);
  }

  const evidenceBlocks = [...groupedChunks.values()].slice(0, MAX_SOURCE_CHUNKS).map((group, index) => {
    const first = group[0];
    const combinedText = group
      .slice(0, 2)
      .map((chunk) => normalizeWhitespace(chunk.textContent).slice(0, MAX_CHUNK_TEXT_LENGTH))
      .filter(Boolean)
      .join('\n\n');

    return [
      `SOURCE_${String(index + 1).padStart(2, '0')}`,
      `document: ${first.documentName}`,
      `page_number: ${first.pageNumber}`,
      'evidence:',
      combinedText,
    ].join('\n');
  });

  return [
    `Deck title: ${input.title}`,
    `Requested card count: ${input.count}`,
    'Difficulty mix: mixed easy, medium, and hard',
    '',
    'Selected units:',
    input.units
      .map((unit, index) =>
        [
          `UNIT_${String(index + 1).padStart(2, '0')}`,
          `title: ${unit.title}`,
          `summary: ${unit.summary}`,
          `key_concepts: ${unit.keyConcepts.join(', ')}`,
        ].join('\n'),
      )
      .join('\n\n'),
    '',
    'Course material evidence:',
    evidenceBlocks.join('\n\n---\n\n'),
    '',
    'Create flashcards that test understanding, definitions, formulas, comparisons, and problem-solving cues across the selected units.',
    'Return only the requested number of cards.',
  ].join('\n');
};

const getDefaultDeckTitle = (unitTitles: string[]): string => {
  if (unitTitles.length === 1) {
    return `${unitTitles[0]} Flashcards`;
  }

  if (unitTitles.length > 1) {
    return `${unitTitles[0]} + ${unitTitles.length - 1} More`;
  }

  return 'Generated Flashcards';
};

const mapFlashcardDeckRecord = (
  record: FlashcardDeckRecord,
  database: DatabaseService,
): FlashcardDeck => {
  const divisions = database.getSubjectAnalysis(record.flashcardDeck.subjectId).divisions;
  const divisionTitleMap = new Map(
    divisions.map((division) => [division.division.id, division.division.title]),
  );

  return {
    id: record.flashcardDeck.id,
    subjectId: record.flashcardDeck.subjectId,
    title: record.flashcardDeck.title,
    creationMode: record.flashcardDeck.creationMode,
    difficultyMode: record.flashcardDeck.difficultyMode,
    cardCount: record.flashcardDeck.cardCount,
    createdAt: new Date(record.flashcardDeck.createdAt).toISOString(),
    updatedAt: new Date(record.flashcardDeck.updatedAt).toISOString(),
    unitIds: record.divisionIds,
    unitTitles: record.divisionIds
      .map((divisionId) => divisionTitleMap.get(divisionId))
      .filter((title): title is string => Boolean(title)),
    cards: record.cards.map((card) => ({
      id: card.id,
      cardIndex: card.cardIndex,
      front: card.front,
      back: card.back,
      difficulty: card.difficulty,
      createdAt: new Date(card.createdAt).toISOString(),
      updatedAt: new Date(card.updatedAt).toISOString(),
    })),
  };
};

export const mapPersistedFlashcardDecks = (
  records: FlashcardDeckRecord[],
  database: DatabaseService,
): FlashcardDeck[] => {
  return records.map((record) => mapFlashcardDeckRecord(record, database));
};

export const createManualFlashcardDeck = (input: {
  subjectId: string;
  title: string;
  divisionIds: string[];
  cards: Array<{
    front: string;
    back: string;
  }>;
  database: DatabaseService;
}): FlashcardDeck => {
  const record = input.database.insertFlashcardDeck({
    flashcardDeck: {
      id: randomUUID(),
      subjectId: input.subjectId,
      title: input.title.trim(),
      creationMode: 'manual',
      difficultyMode: 'manual',
      cardCount: input.cards.length,
    },
    divisionIds: input.divisionIds,
    cards: input.cards.map((card, index) => ({
      id: randomUUID(),
      cardIndex: index + 1,
      front: card.front.trim(),
      back: card.back.trim(),
      difficulty: null,
    })),
  });

  return mapFlashcardDeckRecord(record, input.database);
};

export const generateFlashcardDeck = async (input: {
  providerConfig: StructuredAiProviderConfig;
  subjectId: string;
  divisionIds: string[];
  count: number;
  title?: string;
  database: DatabaseService;
}): Promise<FlashcardDeck> => {
  const analysis = input.database.getSubjectAnalysis(input.subjectId);
  const uniqueDivisionIds = [...new Set(input.divisionIds)];
  const divisionRecordMap = new Map(
    analysis.divisions.map((division) => [division.division.id, division]),
  );
  const selectedUnits = uniqueDivisionIds
    .map((divisionId) => divisionRecordMap.get(divisionId) ?? null)
    .filter(
      (
        division,
      ): division is (typeof analysis.divisions)[number] => Boolean(division),
    );

  if (selectedUnits.length === 0) {
    throw new Error('Select at least one unit before generating flashcards.');
  }

  const sourcePageIds = new Set(
    selectedUnits.flatMap((division) => division.sourcePages.map((page) => page.pageId)),
  );
  const relevantChunks = input.database
    .getReadySubjectChunks(input.subjectId)
    .filter((chunk) => sourcePageIds.has(chunk.pageId));
  const queryText = selectedUnits
    .flatMap((division) => [
      division.division.title,
      division.division.summary,
      ...division.keyConcepts,
      ...division.problemTypes.map((problemType) => problemType.title),
    ])
    .join('\n');
  const retrievedChunks = pickRelevantChunks(relevantChunks, queryText);
  const deckTitle =
    input.title?.trim() ||
    getDefaultDeckTitle(selectedUnits.map((unit) => unit.division.title));

  const rawResponse = await createStructuredResponse<RawFlashcardResponse>({
    providerConfig: input.providerConfig,
    systemPrompt: flashcardSystemPrompt,
    userPrompt: buildFlashcardPrompt({
      title: deckTitle,
      count: input.count,
      units: selectedUnits.map((unit) => ({
        title: unit.division.title,
        summary: unit.division.summary,
        keyConcepts: unit.keyConcepts,
      })),
      retrievedChunks,
    }),
    schemaName: 'flashcard_generation',
    schema: flashcardResponseSchemaDefinition,
  });

  const parsed = (() => {
    const schemaResult = flashcardResponseSchema.safeParse(rawResponse);
    if (schemaResult.success) {
      return schemaResult.data;
    }

    return repairFlashcardResponse(rawResponse, input.count);
  })();

  const cards = parsed.cards.slice(0, input.count);
  const record = input.database.insertFlashcardDeck({
    flashcardDeck: {
      id: randomUUID(),
      subjectId: input.subjectId,
      title: deckTitle,
      creationMode: 'generated',
      difficultyMode: 'mixed',
      cardCount: cards.length,
    },
    divisionIds: selectedUnits.map((unit) => unit.division.id),
    cards: cards.map((card, index) => ({
      id: randomUUID(),
      cardIndex: index + 1,
      front: card.front.trim(),
      back: card.back.trim(),
      difficulty: card.difficulty,
    })),
  });

  return mapFlashcardDeckRecord(record, input.database);
};
