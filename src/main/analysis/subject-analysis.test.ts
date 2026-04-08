import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { DatabaseService } from '../db/database';
import { analyzeSubjectMaterials } from './subject-analysis';

type TestContext = {
  database: DatabaseService;
  rootDir: string;
};

const activeContexts: TestContext[] = [];

const createContext = (): TestContext => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'studybud-analysis-'));
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

describe('analyzeSubjectMaterials', () => {
  it('persists divisions and problem types from a structured OpenAI response', async () => {
    const { database } = createContext();

    database.createSubjectWithId('Linear Algebra', 'subject-1');
    database.insertImportedDocument({
      document: {
        id: 'doc-1',
        subjectId: 'subject-1',
        kind: 'lecture',
        originalFileName: 'lecture-1.pdf',
        storedFileName: 'doc-1-lecture-1.pdf',
        relativePath: 'subjects/subject-1/documents/doc-1-lecture-1.pdf',
        mimeType: 'application/pdf',
        pageCount: 2,
        importStatus: 'ready',
        errorMessage: null,
      },
      pages: [
        {
          id: 'page-1',
          pageNumber: 1,
          textContent: 'Vectors and span',
        },
        {
          id: 'page-2',
          pageNumber: 2,
          textContent: 'Basis and dimension',
        },
      ],
      chunks: [
        {
          id: 'chunk-1',
          pageId: 'page-1',
          chunkIndex: 0,
          textContent: 'Vectors and span',
        },
        {
          id: 'chunk-2',
          pageId: 'page-2',
          chunkIndex: 0,
          textContent: 'Basis and dimension',
        },
      ],
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: JSON.stringify({
          divisions: [
            {
              title: 'Vector Spaces',
              summary: 'Core ideas about vectors, span, basis, and dimension.',
              keyConcepts: ['vectors', 'span', 'basis', 'dimension'],
              sourceRefs: ['PAGE_001', 'PAGE_002'],
              problemTypes: [
                {
                  title: 'Determine span',
                  description: 'Decide whether vectors span a target space.',
                },
              ],
            },
          ],
          unassignedRefs: [],
        }),
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const result = await analyzeSubjectMaterials({
      apiKey: 'test-key',
      subjectId: 'subject-1',
      database,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.analysis.divisions).toHaveLength(1);
    expect(result.analysis.divisions[0]?.title).toBe('Vector Spaces');
    expect(result.analysis.divisions[0]?.sourcePages).toHaveLength(2);
    expect(result.analysis.divisions[0]?.problemTypes[0]?.title).toBe('Determine span');
    expect(result.job.status).toBe('completed');
  });
});
