import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';

import { DatabaseService } from '../db/database';
import { importSubjectDocuments } from './import';

type TestContext = {
  database: DatabaseService;
  rootDir: string;
  subjectsDir: string;
};

const activeContexts: TestContext[] = [];

const createContext = (): TestContext => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'studybud-import-'));
  const dataDir = path.join(rootDir, 'data');
  const subjectsDir = path.join(dataDir, 'subjects');

  fs.mkdirSync(subjectsDir, { recursive: true });

  const database = new DatabaseService(path.join(dataDir, 'studybud.db'));
  const context = { database, rootDir, subjectsDir };
  activeContexts.push(context);
  return context;
};

const createPdf = async (outputPath: string, title: string, body: string) => {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([600, 800]);

  page.drawText(title, {
    x: 48,
    y: 720,
    size: 22,
    font,
  });

  page.drawText(body, {
    x: 48,
    y: 680,
    size: 15,
    font,
  });

  const bytes = await pdf.save();
  fs.writeFileSync(outputPath, Buffer.from(bytes));
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

describe('importSubjectDocuments', () => {
  it('imports multiple PDFs in one pass', async () => {
    const context = createContext();
    const subjectId = 'subject-multi';
    const sourceDir = path.join(context.rootDir, 'source');
    const firstPdfPath = path.join(sourceDir, 'lecture-1.pdf');
    const secondPdfPath = path.join(sourceDir, 'lecture-2.pdf');

    fs.mkdirSync(sourceDir, { recursive: true });
    context.database.createSubjectWithId('Calculus', subjectId);
    fs.mkdirSync(path.join(context.subjectsDir, subjectId), { recursive: true });

    await createPdf(firstPdfPath, 'Limits', 'Finding limits graphically and algebraically.');
    await createPdf(secondPdfPath, 'Derivatives', 'Introductory derivative rules.');

    const result = await importSubjectDocuments(
      {
        dataDir: path.join(context.rootDir, 'data'),
        subjectsDir: context.subjectsDir,
        database: context.database,
      },
      {
        subjectId,
        kind: 'lecture',
        filePaths: [firstPdfPath, secondPdfPath],
      },
    );

    expect(result.failures).toEqual([]);
    expect(result.importedDocuments).toHaveLength(2);
    expect(result.importedDocuments.every((document) => document.importStatus === 'ready')).toBe(
      true,
    );
    expect(result.job.status).toBe('completed');

    const storedDocuments = context.database.listDocumentsBySubject(subjectId);
    expect(storedDocuments).toHaveLength(2);

    const importedNames = storedDocuments.map((document) => document.originalFileName).sort();
    expect(importedNames).toEqual(['lecture-1.pdf', 'lecture-2.pdf']);

    const pagesPerDocument = storedDocuments.map((document) =>
      context.database.getPagesByDocument(document.id).length,
    );
    expect(pagesPerDocument).toEqual([1, 1]);

    for (const document of storedDocuments) {
      expect(document.relativePath).not.toBeNull();
      const absolutePath = path.join(
        path.join(context.rootDir, 'data'),
        document.relativePath ?? '',
      );
      expect(fs.existsSync(absolutePath)).toBe(true);
    }
  });

  it('ignores invalid file path entries instead of crashing the import path logic', async () => {
    const context = createContext();
    const subjectId = 'subject-invalid-paths';
    const sourceDir = path.join(context.rootDir, 'source-invalid');
    const validPdfPath = path.join(sourceDir, 'lecture-1.pdf');

    fs.mkdirSync(sourceDir, { recursive: true });
    context.database.createSubjectWithId('Physics', subjectId);
    fs.mkdirSync(path.join(context.subjectsDir, subjectId), { recursive: true });

    await createPdf(validPdfPath, 'Kinematics', 'Velocity and acceleration.');

    const result = await importSubjectDocuments(
      {
        dataDir: path.join(context.rootDir, 'data'),
        subjectsDir: context.subjectsDir,
        database: context.database,
      },
      {
        subjectId,
        kind: 'lecture',
        filePaths: [validPdfPath, undefined, ''] as unknown as string[],
      },
    );

    expect(result.failures).toEqual([]);
    expect(result.importedDocuments).toHaveLength(1);
    expect(result.importedDocuments[0]?.originalFileName).toBe('lecture-1.pdf');
    expect(result.job.status).toBe('completed');
  });
});
