import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { DatabaseService } from './database';

type TestContext = {
  database: DatabaseService;
  rootDir: string;
};

const activeContexts: TestContext[] = [];

const createContext = (): TestContext => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'studybud-db-'));
  const database = new DatabaseService(path.join(rootDir, 'studybud.db'));
  const context = { database, rootDir };
  activeContexts.push(context);
  return context;
};

afterEach(() => {
  while (activeContexts.length > 0) {
    const context = activeContexts.pop();
    if (!context) {
      continue;
    }

    context.database.close();
    fs.rmSync(context.rootDir, { recursive: true, force: true });
  }
});

describe('DatabaseService', () => {
  it('bootstraps settings storage and deletes settings cleanly', () => {
    const { database } = createContext();

    expect(database.getSetting('openai')).toBeNull();

    const saved = database.upsertSetting('openai', 'ciphertext', true);
    expect(saved.encrypted).toBe(true);
    expect(database.getSetting('openai')).toMatchObject({
      key: 'openai',
      value: 'ciphertext',
      encrypted: true,
    });

    database.deleteSetting('openai');
    expect(database.getSetting('openai')).toBeNull();
  });

  it('persists imported documents with pages and jobs', () => {
    const { database } = createContext();

    database.createSubjectWithId('Linear Algebra', 'subject-1');
    database.createImportJob({
      id: 'job-1',
      subjectId: 'subject-1',
      message: 'Importing 1 PDF...',
      payload: JSON.stringify({ selectedFiles: ['lecture-1.pdf'] }),
    });

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
      ],
    });

    const documents = database.listDocumentsBySubject('subject-1');
    expect(documents).toHaveLength(1);
    expect(documents[0]).toMatchObject({
      id: 'doc-1',
      pageCount: 2,
      importStatus: 'ready',
      ocrState: 'not-needed',
      ocrAttemptedPages: 0,
    });

    const pages = database.getPagesByDocument('doc-1');
    expect(pages).toHaveLength(2);
    expect(pages[0]).toMatchObject({
      pageNumber: 1,
      textContent: 'Vectors and span',
      textSource: 'native',
      ocrAttempted: false,
    });

    const jobs = database.listJobsBySubject('subject-1');
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      id: 'job-1',
      subjectId: 'subject-1',
      type: 'document-import',
      status: 'running',
    });
  });

  it('deletes a document together with its pages and chunks', () => {
    const { database } = createContext();

    database.createSubjectWithId('Linear Algebra', 'subject-delete');
    database.insertImportedDocument({
      document: {
        id: 'doc-delete',
        subjectId: 'subject-delete',
        kind: 'lecture',
        originalFileName: 'lecture-delete.pdf',
        storedFileName: 'doc-delete-lecture-delete.pdf',
        relativePath: 'subjects/subject-delete/documents/doc-delete-lecture-delete.pdf',
        mimeType: 'application/pdf',
        pageCount: 1,
        importStatus: 'ready',
        errorMessage: null,
      },
      pages: [
        {
          id: 'page-delete',
          pageNumber: 1,
          textContent: 'Deleting imported documents should remove dependent rows.',
        },
      ],
      chunks: [
        {
          id: 'chunk-delete',
          pageId: 'page-delete',
          chunkIndex: 0,
          textContent: 'Deleting imported documents should remove dependent rows.',
        },
      ],
    });

    const deleted = database.deleteDocument('doc-delete');

    expect(deleted?.id).toBe('doc-delete');
    expect(database.getDocumentById('doc-delete')).toBeNull();
    expect(database.getPagesByDocument('doc-delete')).toEqual([]);
  });

  it('deletes a subject together with its documents, analysis data, and jobs', () => {
    const { database } = createContext();

    database.createSubjectWithId('Mechanics', 'subject-remove');
    database.createImportJob({
      id: 'job-remove-import',
      subjectId: 'subject-remove',
      message: 'Importing subject files...',
      payload: JSON.stringify({ selectedFiles: ['mechanics.pdf'] }),
    });
    database.createSubjectIngestionJob({
      id: 'job-remove-analysis',
      subjectId: 'subject-remove',
      message: 'Analyzing subject...',
      payload: JSON.stringify({ provider: 'OpenAI', model: 'gpt-5.4-mini' }),
    });

    database.insertImportedDocument({
      document: {
        id: 'doc-remove',
        subjectId: 'subject-remove',
        kind: 'lecture',
        originalFileName: 'mechanics.pdf',
        storedFileName: 'doc-remove-mechanics.pdf',
        relativePath: 'subjects/subject-remove/documents/doc-remove-mechanics.pdf',
        mimeType: 'application/pdf',
        pageCount: 1,
        importStatus: 'ready',
        errorMessage: null,
      },
      pages: [
        {
          id: 'page-remove',
          pageNumber: 1,
          textContent: 'Newtonian mechanics overview',
        },
      ],
      chunks: [
        {
          id: 'chunk-remove',
          pageId: 'page-remove',
          chunkIndex: 0,
          textContent: 'Newtonian mechanics overview',
        },
      ],
    });

    database.replaceSubjectAnalysis('subject-remove', {
      divisions: [
        {
          division: {
            id: 'division-remove',
            title: 'Newtonian Mechanics',
            summary: 'Core laws of motion.',
            keyConceptsJson: JSON.stringify(['force', 'mass', 'acceleration']),
          },
          sourcePageIds: ['page-remove'],
          problemTypes: [
            {
              id: 'problem-remove',
              divisionId: 'division-remove',
              title: 'Apply F=ma',
              description: 'Solve direct force and acceleration problems.',
            },
          ],
        },
      ],
      unassignedPages: [],
    });

    const deletedSubject = database.deleteSubject('subject-remove');

    expect(deletedSubject?.id).toBe('subject-remove');
    expect(database.getSubjectById('subject-remove')).toBeNull();
    expect(database.listDocumentsBySubject('subject-remove')).toEqual([]);
    expect(database.listJobsBySubject('subject-remove')).toEqual([]);
    expect(database.getSubjectAnalysis('subject-remove')).toMatchObject({
      divisions: [],
      unassignedPages: [],
    });
  });

  it('reconciles interrupted import jobs', () => {
    const { database } = createContext();

    database.createSubjectWithId('Physics', 'subject-2');
    database.createImportJob({
      id: 'job-2',
      subjectId: 'subject-2',
      message: 'Importing 2 PDFs...',
      payload: JSON.stringify({ selectedFiles: ['lecture-2.pdf', 'hw-1.pdf'] }),
    });

    const updatedCount = database.reconcileInterruptedImportJobs();

    expect(updatedCount).toBe(1);
    expect(database.listJobsBySubject('subject-2')[0]).toMatchObject({
      id: 'job-2',
      status: 'failed',
      message:
        'Import was interrupted before it finished. You can retry the document import.',
    });
  });

  it('replaces and returns persisted subject analysis records', () => {
    const { database } = createContext();

    database.createSubjectWithId('Calculus', 'subject-analysis');
    database.insertImportedDocument({
      document: {
        id: 'doc-analysis',
        subjectId: 'subject-analysis',
        kind: 'lecture',
        originalFileName: 'calc-lecture.pdf',
        storedFileName: 'doc-analysis-calc-lecture.pdf',
        relativePath: 'subjects/subject-analysis/documents/doc-analysis-calc-lecture.pdf',
        mimeType: 'application/pdf',
        pageCount: 2,
        importStatus: 'ready',
        errorMessage: null,
      },
      pages: [
        {
          id: 'page-analysis-1',
          pageNumber: 1,
          textContent: 'Limits and continuity',
        },
        {
          id: 'page-analysis-2',
          pageNumber: 2,
          textContent: 'Derivative rules',
        },
      ],
      chunks: [
        {
          id: 'chunk-analysis-1',
          pageId: 'page-analysis-1',
          chunkIndex: 0,
          textContent: 'Limits and continuity',
        },
        {
          id: 'chunk-analysis-2',
          pageId: 'page-analysis-2',
          chunkIndex: 0,
          textContent: 'Derivative rules',
        },
      ],
    });

    database.replaceSubjectAnalysis('subject-analysis', {
      divisions: [
        {
          division: {
            id: 'division-1',
            title: 'Limits',
            summary: 'Introductory limit concepts.',
            keyConceptsJson: JSON.stringify(['limit', 'continuity']),
          },
          sourcePageIds: ['page-analysis-1'],
          problemTypes: [
            {
              id: 'problem-1',
              divisionId: 'division-1',
              title: 'Evaluate limits',
              description: 'Compute algebraic limits.',
            },
          ],
        },
      ],
      unassignedPages: [
        {
          id: 'unassigned-1',
          pageId: 'page-analysis-2',
          reason: 'Too brief to categorize confidently.',
        },
      ],
    });

    const analysis = database.getSubjectAnalysis('subject-analysis');

    expect(analysis.divisions).toHaveLength(1);
    expect(analysis.divisions[0]?.division.title).toBe('Limits');
    expect(analysis.divisions[0]?.keyConcepts).toEqual(['limit', 'continuity']);
    expect(analysis.divisions[0]?.sourcePages[0]?.pageId).toBe('page-analysis-1');
    expect(analysis.divisions[0]?.problemTypes[0]?.title).toBe('Evaluate limits');
    expect(analysis.unassignedPages).toHaveLength(1);
    expect(analysis.unassignedPages[0]?.page.pageId).toBe('page-analysis-2');
  });

  it('stores and returns division chat history in creation order', () => {
    const { database } = createContext();

    database.createSubjectWithId('Signals', 'subject-chat');
    const messages = database.insertChatMessages([
      {
        id: 'chat-user',
        subjectId: 'subject-chat',
        divisionId: 'division-chat',
        role: 'user',
        content: 'What does convolution mean here?',
        citationsJson: JSON.stringify([]),
        followupsJson: JSON.stringify([]),
        suggestedSearchQueriesJson: JSON.stringify([]),
        suggestedVideoQueriesJson: JSON.stringify([]),
        selectionContextJson: null,
      },
      {
        id: 'chat-assistant',
        subjectId: 'subject-chat',
        divisionId: 'division-chat',
        role: 'assistant',
        content: 'Convolution combines an input with a system response.',
        citationsJson: JSON.stringify([]),
        followupsJson: JSON.stringify(['Show me an example.']),
        suggestedSearchQueriesJson: JSON.stringify([
          'signal processing convolution intuitive explanation',
        ]),
        suggestedVideoQueriesJson: JSON.stringify([
          'convolution signal processing visual explanation',
        ]),
        selectionContextJson: null,
      },
    ]);

    expect(messages).toHaveLength(2);

    const persisted = database.listChatMessagesBySubject(
      'subject-chat',
      'division-chat',
    );
    expect(persisted).toHaveLength(2);
    expect(persisted[0]?.role).toBe('user');
    expect(persisted[1]?.role).toBe('assistant');
    expect(persisted[1]?.content).toContain('Convolution');
    expect(persisted[1]?.suggestedSearchQueriesJson).toContain('intuitive explanation');
  });

  it('persists practice sets and toggles answer visibility', () => {
    const { database } = createContext();

    database.createSubjectWithId('Statics', 'subject-practice');

    const inserted = database.insertPracticeSet({
      practiceSet: {
        id: 'practice-set-1',
        subjectId: 'subject-practice',
        divisionId: 'division-statics',
        problemTypeId: 'problem-free-body',
        problemTypeTitle: 'Free-body diagram setup',
        difficulty: 'medium',
        questionCount: 2,
      },
      sourcePageIds: [],
      questions: [
        {
          id: 'practice-question-1',
          questionIndex: 1,
          prompt: 'Draw a free-body diagram for a block on an incline.',
          answer: 'Include gravity, normal force, and friction if applicable.',
          revealed: false,
        },
        {
          id: 'practice-question-2',
          questionIndex: 2,
          prompt: 'Resolve the weight vector into incline-aligned components.',
          answer: 'Use mg sin(theta) parallel and mg cos(theta) perpendicular.',
          revealed: false,
        },
      ],
    });

    expect(inserted.questions).toHaveLength(2);

    const listed = database.listPracticeSetsBySubject('subject-practice');
    expect(listed).toHaveLength(1);
    expect(listed[0]?.questions[0]?.revealed).toBe(false);

    const revealed = database.togglePracticeQuestionReveal('practice-question-1');
    expect(revealed?.revealed).toBe(true);

    const refreshed = database.getPracticeSetByQuestionId('practice-question-1');
    expect(refreshed?.questions[0]?.revealed).toBe(true);
    expect(refreshed?.practiceSet.problemTypeTitle).toBe('Free-body diagram setup');

    const hiddenAgain = database.togglePracticeQuestionReveal('practice-question-1');
    expect(hiddenAgain?.revealed).toBe(false);

    const refreshedAgain = database.getPracticeSetByQuestionId('practice-question-1');
    expect(refreshedAgain?.questions[0]?.revealed).toBe(false);
  });

  it('deletes a practice set together with its questions', () => {
    const { database } = createContext();

    database.createSubjectWithId('Dynamics', 'subject-practice-delete');
    database.insertPracticeSet({
      practiceSet: {
        id: 'practice-set-delete',
        subjectId: 'subject-practice-delete',
        divisionId: 'division-dynamics',
        problemTypeId: 'problem-dynamics',
        problemTypeTitle: 'Acceleration analysis',
        difficulty: 'hard',
        questionCount: 1,
      },
      sourcePageIds: [],
      questions: [
        {
          id: 'practice-question-delete',
          questionIndex: 1,
          prompt: 'Determine tangential and normal acceleration components.',
          answer: 'Differentiate speed for tangential and use v^2 / r for normal.',
          revealed: false,
        },
      ],
    });

    const deleted = database.deletePracticeSet('practice-set-delete');

    expect(deleted?.id).toBe('practice-set-delete');
    expect(
      database.listPracticeSetsBySubject('subject-practice-delete'),
    ).toHaveLength(0);
    expect(database.getPracticeSetByQuestionId('practice-question-delete')).toBeNull();
  });
});
