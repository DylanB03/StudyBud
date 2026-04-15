import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { DatabaseService } from '../db/database';
import { generateFlashcardDeck } from './flashcard-generation';

type TestContext = {
  database: DatabaseService;
  rootDir: string;
};

const activeContexts: TestContext[] = [];

const createContext = (): TestContext => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'studybud-flashcards-'));
  const database = new DatabaseService(path.join(rootDir, 'studybud.db'));
  const context = { database, rootDir };
  activeContexts.push(context);
  return context;
};

afterEach(() => {
  vi.restoreAllMocks();

  while (activeContexts.length > 0) {
    const context = activeContexts.pop();
    if (!context) {
      continue;
    }

    context.database.close();
    fs.rmSync(context.rootDir, { recursive: true, force: true });
  }
});

describe('generateFlashcardDeck', () => {
  it('creates and persists a mixed deck from selected units', async () => {
    const { database } = createContext();

    database.createSubjectWithId('Linear Algebra', 'subject-flashcards');
    database.insertImportedDocument({
      document: {
        id: 'doc-flashcards',
        subjectId: 'subject-flashcards',
        kind: 'lecture',
        originalFileName: 'linear-transformations.pdf',
        storedFileName: 'doc-flashcards-linear-transformations.pdf',
        relativePath:
          'subjects/subject-flashcards/documents/doc-flashcards-linear-transformations.pdf',
        mimeType: 'application/pdf',
        pageCount: 2,
        importStatus: 'ready',
        errorMessage: null,
      },
      pages: [
        {
          id: 'page-flashcards-1',
          pageNumber: 1,
          textContent:
            'A linear transformation preserves vector addition and scalar multiplication.',
        },
        {
          id: 'page-flashcards-2',
          pageNumber: 2,
          textContent:
            'The kernel of a linear transformation contains vectors sent to the zero vector.',
        },
      ],
      chunks: [
        {
          id: 'chunk-flashcards-1',
          pageId: 'page-flashcards-1',
          chunkIndex: 0,
          textContent:
            'A linear transformation preserves vector addition and scalar multiplication.',
        },
        {
          id: 'chunk-flashcards-2',
          pageId: 'page-flashcards-2',
          chunkIndex: 0,
          textContent:
            'The kernel of a linear transformation contains vectors sent to the zero vector.',
        },
      ],
    });

    database.replaceSubjectAnalysis('subject-flashcards', {
      divisions: [
        {
          division: {
            id: 'division-linear-maps',
            title: 'Linear Transformations',
            summary: 'Study the defining properties of linear maps.',
            keyConceptsJson: JSON.stringify(['linearity', 'matrix map']),
          },
          sourcePageIds: ['page-flashcards-1'],
          problemTypes: [],
        },
        {
          division: {
            id: 'division-kernel-range',
            title: 'Kernel And Range',
            summary: 'Analyze null spaces and image spaces of linear maps.',
            keyConceptsJson: JSON.stringify(['kernel', 'range']),
          },
          sourcePageIds: ['page-flashcards-2'],
          problemTypes: [],
        },
      ],
      unassignedPages: [],
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: JSON.stringify({
          cards: [
            {
              front: 'What two properties define a linear transformation?',
              back: 'It must preserve vector addition and scalar multiplication.',
              difficulty: 'easy',
            },
            {
              front: 'What does the kernel of a linear transformation contain?',
              back: 'All input vectors that map to the zero vector.',
              difficulty: 'medium',
            },
            {
              front: 'Why does a nontrivial kernel matter for injectivity?',
              back: 'A nontrivial kernel means different inputs can map to the same output, so the map is not injective.',
              difficulty: 'hard',
            },
          ],
        }),
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const result = await generateFlashcardDeck({
      providerConfig: {
        provider: 'openai',
        apiKey: 'test-key',
      },
      subjectId: 'subject-flashcards',
      divisionIds: ['division-linear-maps', 'division-kernel-range'],
      count: 3,
      title: 'Linear Algebra Review',
      database,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.title).toBe('Linear Algebra Review');
    expect(result.creationMode).toBe('generated');
    expect(result.difficultyMode).toBe('mixed');
    expect(result.cards).toHaveLength(3);
    expect(result.unitTitles).toEqual([
      'Linear Transformations',
      'Kernel And Range',
    ]);

    const persisted = database.listFlashcardDecksBySubject('subject-flashcards');
    expect(persisted).toHaveLength(1);
    expect(persisted[0]?.cards[2]?.difficulty).toBe('hard');
    expect(persisted[0]?.divisionIds).toEqual([
      'division-linear-maps',
      'division-kernel-range',
    ]);
  });
});
