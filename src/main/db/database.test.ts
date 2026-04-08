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
    });

    const pages = database.getPagesByDocument('doc-1');
    expect(pages).toHaveLength(2);
    expect(pages[0]).toMatchObject({
      pageNumber: 1,
      textContent: 'Vectors and span',
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
});
