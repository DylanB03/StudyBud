import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { DatabaseService } from '../db/database';
import { generatePracticeSet } from './practice-generation';

type TestContext = {
  database: DatabaseService;
  rootDir: string;
};

const activeContexts: TestContext[] = [];

const createContext = (): TestContext => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'studybud-practice-'));
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

describe('generatePracticeSet', () => {
  it('creates and persists a practice set for a division problem type', async () => {
    const { database } = createContext();

    database.createSubjectWithId('Calculus II', 'subject-practice');
    database.insertImportedDocument({
      document: {
        id: 'doc-practice',
        subjectId: 'subject-practice',
        kind: 'lecture',
        originalFileName: 'integrals.pdf',
        storedFileName: 'doc-practice-integrals.pdf',
        relativePath: 'subjects/subject-practice/documents/doc-practice-integrals.pdf',
        mimeType: 'application/pdf',
        pageCount: 2,
        importStatus: 'ready',
        errorMessage: null,
      },
      pages: [
        {
          id: 'page-practice-1',
          pageNumber: 1,
          textContent: 'Substitution integrates compositions by reversing the chain rule.',
        },
        {
          id: 'page-practice-2',
          pageNumber: 2,
          textContent: 'Choose u so the derivative appears elsewhere in the integrand.',
        },
      ],
      chunks: [
        {
          id: 'chunk-practice-1',
          pageId: 'page-practice-1',
          chunkIndex: 0,
          textContent: 'Substitution integrates compositions by reversing the chain rule.',
        },
        {
          id: 'chunk-practice-2',
          pageId: 'page-practice-2',
          chunkIndex: 0,
          textContent: 'Choose u so the derivative appears elsewhere in the integrand.',
        },
      ],
    });

    database.replaceSubjectAnalysis('subject-practice', {
      divisions: [
        {
          division: {
            id: 'division-practice',
            title: 'Integration By Substitution',
            summary: 'Choose a substitution that simplifies the integral.',
            keyConceptsJson: JSON.stringify(['u-substitution', 'chain rule']),
          },
          sourcePageIds: ['page-practice-1', 'page-practice-2'],
          problemTypes: [
            {
              id: 'problem-practice-1',
              divisionId: 'division-practice',
              title: 'Basic substitution integrals',
              description: 'Select an appropriate u and rewrite the integral.',
            },
          ],
        },
      ],
      unassignedPages: [],
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: JSON.stringify({
          questions: [
            {
              prompt: 'Evaluate the integral of 2x cos(x^2) dx using substitution.',
              answer: 'Let u = x^2, so du = 2x dx and the result is sin(x^2) + C.',
            },
            {
              prompt: 'Evaluate the integral of 3x^2 e^(x^3) dx using substitution.',
              answer: 'Let u = x^3, so du = 3x^2 dx and the result is e^(x^3) + C.',
            },
          ],
        }),
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const result = await generatePracticeSet({
      providerConfig: {
        provider: 'openai',
        apiKey: 'test-key',
      },
      subjectId: 'subject-practice',
      divisionId: 'division-practice',
      problemTypeId: 'problem-practice-1',
      difficulty: 'easy',
      count: 2,
      database,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.problemTypeTitle).toBe('Basic substitution integrals');
    expect(result.questions).toHaveLength(2);
    expect(result.questions[0]?.revealed).toBe(false);
    expect(result.sourcePages).toHaveLength(2);
    expect(result.sourcePages[0]?.pageId).toBe('page-practice-1');

    const persisted = database.listPracticeSetsBySubject(
      'subject-practice',
      'division-practice',
    );
    expect(persisted).toHaveLength(1);
    expect(persisted[0]?.questions[1]?.prompt).toContain('3x^2');
    expect(persisted[0]?.sourcePages[0]?.pageId).toBe('page-practice-1');
  });

  it('recovers usable questions from slightly malformed model output', async () => {
    const { database } = createContext();

    database.createSubjectWithId('Calculus II', 'subject-practice-repair');
    database.insertImportedDocument({
      document: {
        id: 'doc-practice-repair',
        subjectId: 'subject-practice-repair',
        kind: 'lecture',
        originalFileName: 'integrals.pdf',
        storedFileName: 'doc-practice-repair-integrals.pdf',
        relativePath:
          'subjects/subject-practice-repair/documents/doc-practice-repair-integrals.pdf',
        mimeType: 'application/pdf',
        pageCount: 1,
        importStatus: 'ready',
        errorMessage: null,
      },
      pages: [
        {
          id: 'page-practice-repair-1',
          pageNumber: 1,
          textContent: 'Substitution rewrites an integral in terms of a better variable.',
        },
      ],
      chunks: [
        {
          id: 'chunk-practice-repair-1',
          pageId: 'page-practice-repair-1',
          chunkIndex: 0,
          textContent: 'Substitution rewrites an integral in terms of a better variable.',
        },
      ],
    });

    database.replaceSubjectAnalysis('subject-practice-repair', {
      divisions: [
        {
          division: {
            id: 'division-practice-repair',
            title: 'Integration By Substitution',
            summary: 'Choose a substitution that simplifies the integral.',
            keyConceptsJson: JSON.stringify(['u-substitution', 'chain rule']),
          },
          sourcePageIds: ['page-practice-repair-1'],
          problemTypes: [
            {
              id: 'problem-practice-repair-1',
              divisionId: 'division-practice-repair',
              title: 'Basic substitution integrals',
              description: 'Select an appropriate u and rewrite the integral.',
            },
          ],
        },
      ],
      unassignedPages: [],
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: `Here is the repaired result:
\`\`\`json
{
  "questions": [
    {
      "prompt": "Evaluate the integral of 4x e^(x^2) dx using substitution.",
      "answer": "Let u = x^2, so du = 4x dx and the result is 2e^(x^2) + C."
    },
    {
      "prompt": "This question is malformed because it has no answer field."
    }
  ]
}
\`\`\``,
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const result = await generatePracticeSet({
      providerConfig: {
        provider: 'openai',
        apiKey: 'test-key',
      },
      subjectId: 'subject-practice-repair',
      divisionId: 'division-practice-repair',
      problemTypeId: 'problem-practice-repair-1',
      difficulty: 'medium',
      count: 2,
      database,
    });

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0]?.prompt).toContain('4x e^(x^2)');
    expect(result.sourcePages).toHaveLength(1);

    const persisted = database.listPracticeSetsBySubject(
      'subject-practice-repair',
      'division-practice-repair',
    );
    expect(persisted[0]?.questions).toHaveLength(1);
  });
});
