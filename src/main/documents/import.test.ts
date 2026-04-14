import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';
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

const createPdf = async (
  outputPath: string,
  title: string,
  body: string,
  includeTitle = true,
  includeBody = true,
) => {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([600, 800]);

  if (includeTitle) {
    page.drawText(title, {
      x: 48,
      y: 720,
      size: 22,
      font,
    });
  }

  if (includeBody) {
    page.drawText(body, {
      x: 48,
      y: 680,
      size: 15,
      font,
    });
  }

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

  it('does not run OCR for strong native-text PDFs', async () => {
    const context = createContext();
    const subjectId = 'subject-no-ocr';
    const sourceDir = path.join(context.rootDir, 'source-no-ocr');
    const pdfPath = path.join(sourceDir, 'lecture.pdf');
    const detectOcrRuntime = vi.fn(async () => ({
      available: true,
      engine: 'Mock OCR',
      message: 'ready',
      mode: 'python-fallback' as const,
      runtimePath: '/tmp/mock.py',
      pythonCommand: 'python3',
      scriptPath: '/tmp/mock.py',
      executablePath: null,
    }));
    const runOcrForDocumentPages = vi.fn();

    fs.mkdirSync(sourceDir, { recursive: true });
    context.database.createSubjectWithId('Algebra', subjectId);
    fs.mkdirSync(path.join(context.subjectsDir, subjectId), { recursive: true });

    await createPdf(
      pdfPath,
      'Vector spaces',
      'Vector spaces contain vectors, scalars, and linear combinations.',
    );

    const result = await importSubjectDocuments(
      {
        dataDir: path.join(context.rootDir, 'data'),
        subjectsDir: context.subjectsDir,
        database: context.database,
        detectOcrRuntime,
        runOcrForDocumentPages,
      },
      {
        subjectId,
        kind: 'lecture',
        filePaths: [pdfPath],
      },
    );

    expect(result.importedDocuments[0]?.ocrAttemptedPages).toBe(0);
    expect(runOcrForDocumentPages).not.toHaveBeenCalled();
    expect(detectOcrRuntime).not.toHaveBeenCalled();
  });

  it('runs OCR only on weak pages and persists OCR-improved text', async () => {
    const context = createContext();
    const subjectId = 'subject-ocr-mixed';
    const sourceDir = path.join(context.rootDir, 'source-ocr-mixed');
    const pdfPath = path.join(sourceDir, 'scanned-homework.pdf');
    const detectOcrRuntime = vi.fn(async () => ({
      available: true,
      engine: 'Mock OCR',
      message: 'ready',
      mode: 'bundled' as const,
      runtimePath: 'C:\\ocr\\ocr_runner.exe',
      pythonCommand: 'python3',
      scriptPath: '/tmp/mock.py',
      executablePath: 'C:\\ocr\\ocr_runner.exe',
    }));
    const runOcrForDocumentPages = vi.fn(async (input: { pages: Array<{ pageId: string }> }) => ({
      runtime: {
        available: true,
        engine: 'Mock OCR',
        message: 'ready',
        mode: 'bundled' as const,
        runtimePath: 'C:\\ocr\\ocr_runner.exe',
        pythonCommand: 'python3',
        scriptPath: '/tmp/mock.py',
        executablePath: 'C:\\ocr\\ocr_runner.exe',
      },
      pages: input.pages.map((page) => ({
        pageId: page.pageId,
        textContent: 'Scanned problem statement with integral notation.',
        confidence: 87,
        warning: null,
      })),
    }));

    fs.mkdirSync(sourceDir, { recursive: true });
    context.database.createSubjectWithId('Calculus', subjectId);
    fs.mkdirSync(path.join(context.subjectsDir, subjectId), { recursive: true });

    await createPdf(pdfPath, 'Homework 4', '', false, false);

    const result = await importSubjectDocuments(
      {
        dataDir: path.join(context.rootDir, 'data'),
        subjectsDir: context.subjectsDir,
        database: context.database,
        detectOcrRuntime,
        runOcrForDocumentPages,
      },
      {
        subjectId,
        kind: 'homework',
        filePaths: [pdfPath],
      },
    );

    expect(result.importedDocuments[0]?.ocrAttemptedPages).toBe(1);
    expect(result.importedDocuments[0]?.ocrImprovedPages).toBe(1);
    expect(result.importedDocuments[0]?.ocrState).toBe('used');
    expect(runOcrForDocumentPages).toHaveBeenCalledTimes(1);

    const importedDocumentId = result.importedDocuments[0]?.id;
    expect(importedDocumentId).toBeTruthy();
    const pages = context.database.getPagesByDocument(importedDocumentId ?? '');
    expect(pages[0]?.textSource).toBe('ocr');
    expect(pages[0]?.textContent).toContain('integral notation');
  });

  it('keeps import successful when OCR runtime is unavailable', async () => {
    const context = createContext();
    const subjectId = 'subject-ocr-unavailable';
    const sourceDir = path.join(context.rootDir, 'source-ocr-unavailable');
    const pdfPath = path.join(sourceDir, 'scan.pdf');
    const detectOcrRuntime = vi.fn(async () => ({
      available: false,
      engine: null,
      message: 'PyMuPDF is unavailable.',
      mode: 'unavailable' as const,
      runtimePath: null,
      pythonCommand: null,
      scriptPath: null,
      executablePath: null,
    }));
    const runOcrForDocumentPages = vi.fn();

    fs.mkdirSync(sourceDir, { recursive: true });
    context.database.createSubjectWithId('Statics', subjectId);
    fs.mkdirSync(path.join(context.subjectsDir, subjectId), { recursive: true });

    await createPdf(pdfPath, 'Statics sheet', '', false, false);

    const result = await importSubjectDocuments(
      {
        dataDir: path.join(context.rootDir, 'data'),
        subjectsDir: context.subjectsDir,
        database: context.database,
        detectOcrRuntime,
        runOcrForDocumentPages,
      },
      {
        subjectId,
        kind: 'lecture',
        filePaths: [pdfPath],
      },
    );

    expect(result.job.status).toBe('completed');
    expect(result.importedDocuments[0]?.ocrState).toBe('unavailable');
    expect(result.importedDocuments[0]?.ocrWarning).toContain('PyMuPDF is unavailable');
    expect(runOcrForDocumentPages).not.toHaveBeenCalled();
  });
});
