import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { DatabaseService } from '../db/database';
import { answerDivisionChat } from './grounded-chat';

type TestContext = {
  database: DatabaseService;
  rootDir: string;
};

const activeContexts: TestContext[] = [];

const createContext = (): TestContext => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'studybud-chat-'));
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

describe('answerDivisionChat', () => {
  it('returns grounded assistant messages with citations and persists them', async () => {
    const { database } = createContext();

    database.createSubjectWithId('Probability', 'subject-chat');
    database.insertImportedDocument({
      document: {
        id: 'doc-chat',
        subjectId: 'subject-chat',
        kind: 'lecture',
        originalFileName: 'probability.pdf',
        storedFileName: 'doc-chat-probability.pdf',
        relativePath: 'subjects/subject-chat/documents/doc-chat-probability.pdf',
        mimeType: 'application/pdf',
        pageCount: 2,
        importStatus: 'ready',
        errorMessage: null,
      },
      pages: [
        {
          id: 'page-chat-1',
          pageNumber: 1,
          textContent: 'Conditional probability updates the sample space after observing an event.',
        },
        {
          id: 'page-chat-2',
          pageNumber: 2,
          textContent: 'Bayes theorem rewrites conditional probability in terms of prior and likelihood.',
        },
      ],
      chunks: [
        {
          id: 'chunk-chat-1',
          pageId: 'page-chat-1',
          chunkIndex: 0,
          textContent: 'Conditional probability updates the sample space after observing an event.',
        },
        {
          id: 'chunk-chat-2',
          pageId: 'page-chat-2',
          chunkIndex: 0,
          textContent: 'Bayes theorem rewrites conditional probability in terms of prior and likelihood.',
        },
      ],
    });

    database.replaceSubjectAnalysis('subject-chat', {
      divisions: [
        {
          division: {
            id: 'division-chat',
            title: 'Conditional Probability',
            summary: 'Reasoning about conditional events and Bayes theorem.',
            keyConceptsJson: JSON.stringify([
              'conditional probability',
              'bayes theorem',
            ]),
          },
          sourcePageIds: ['page-chat-1', 'page-chat-2'],
          problemTypes: [],
        },
      ],
      unassignedPages: [],
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: JSON.stringify({
          answerMarkdown:
            'Conditional probability focuses on the reduced sample space after the condition is observed.',
          citationPageRefs: ['PAGE_001', 'PAGE_002'],
          followups: ['Can you show a Bayes theorem example?'],
        }),
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const result = await answerDivisionChat({
      providerConfig: {
        provider: 'openai',
        apiKey: 'test-key',
      },
      subjectId: 'subject-chat',
      divisionId: 'division-chat',
      prompt: 'What is conditional probability doing conceptually?',
      selectionContext: null,
      database,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.answer.citations).toHaveLength(2);
    expect(result.assistantMessage.citations[0]?.excerptText.toLowerCase()).toContain(
      'conditional probability',
    );
    expect(result.assistantMessage.followups[0]).toBe(
      'Can you show a Bayes theorem example?',
    );

    const persisted = database.listChatMessagesBySubject(
      'subject-chat',
      'division-chat',
    );
    expect(persisted).toHaveLength(2);
    expect(persisted[0]?.role).toBe('user');
    expect(persisted[1]?.role).toBe('assistant');
  });
});
