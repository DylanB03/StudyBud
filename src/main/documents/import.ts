import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

import type { DocumentKind, ImportFailure } from '../../shared/ipc';
import type {
  DatabaseService,
  DocumentPageRow,
  JobRow,
  SourceDocumentRow,
} from '../db/database';
import { chunkPageText, extractPdfDocument } from '../pdf/extraction';
import {
  assessPageForOcr,
  mergePreferredPageText,
} from './extraction-confidence';
import {
  detectOcrRuntime,
  runOcrForDocumentPages,
  type OcrDocumentRunResult,
} from '../ocr/runtime';

type PageImportResult = {
  id: string;
  pageNumber: number;
  textContent: string;
  textSource: DocumentPageRow['textSource'];
  ocrAttempted: boolean;
  ocrSucceeded: boolean;
  ocrConfidence: number | null;
  ocrWarning: string | null;
};

type ImportDocumentsDependencies = {
  dataDir: string;
  subjectsDir: string;
  database: DatabaseService;
  detectOcrRuntime?: typeof detectOcrRuntime;
  runOcrForDocumentPages?: typeof runOcrForDocumentPages;
};

type ImportDocumentsInput = {
  subjectId: string;
  kind: DocumentKind;
  filePaths: string[];
};

export type ImportDocumentsOutput = {
  job: JobRow;
  importedDocuments: SourceDocumentRow[];
  failures: ImportFailure[];
};

const buildImportPayload = (input: {
  subjectId: string;
  kind: DocumentKind;
  selectedFiles: string[];
  importedDocumentIds: string[];
  failures: ImportFailure[];
  ocrAttemptedCount: number;
  ocrImprovedCount: number;
  ocrFailedCount: number;
}): string => {
  return JSON.stringify(input);
};

const normalizeFilePaths = (filePaths: unknown[]): string[] => {
  return filePaths.filter((filePath): filePath is string => {
    return typeof filePath === 'string' && filePath.trim().length > 0;
  });
};

const sanitizeFileName = (fileName: string): string => {
  const normalized = fileName.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');
  return normalized.length > 0 ? normalized : 'document.pdf';
};

const createJobMessage = (
  kind: DocumentKind,
  importedCount: number,
  failedCount: number,
): string => {
  const label = kind === 'lecture' ? 'lecture' : 'homework';

  if (failedCount === 0) {
    return `Imported ${importedCount} ${label} PDF${importedCount === 1 ? '' : 's'}.`;
  }

  if (importedCount === 0) {
    return `No ${label} PDFs were imported successfully.`;
  }

  return `Imported ${importedCount} ${label} PDF${importedCount === 1 ? '' : 's'} with ${failedCount} failure${failedCount === 1 ? '' : 's'}.`;
};

const createOcrSuffix = (input: {
  attemptedCount: number;
  improvedCount: number;
  failedCount: number;
}): string => {
  if (input.attemptedCount === 0) {
    return '';
  }

  return ` OCR attempted on ${input.attemptedCount} page${
    input.attemptedCount === 1 ? '' : 's'
  }, improved ${input.improvedCount}, failed ${input.failedCount}.`;
};

const buildDocumentOcrState = (input: {
  candidateCount: number;
  runtimeAvailable: boolean;
  attemptedPages: number;
  succeededPages: number;
  improvedPages: number;
}): SourceDocumentRow['ocrState'] => {
  if (input.candidateCount === 0) {
    return 'not-needed';
  }

  if (!input.runtimeAvailable || input.attemptedPages === 0) {
    return 'unavailable';
  }

  if (input.succeededPages > 0 && input.improvedPages > 0) {
    return 'used';
  }

  return 'partial';
};

export const importSubjectDocuments = async (
  dependencies: ImportDocumentsDependencies,
  input: ImportDocumentsInput,
): Promise<ImportDocumentsOutput> => {
  const {
    dataDir,
    subjectsDir,
    database,
    detectOcrRuntime: detectOcrRuntimeDependency = detectOcrRuntime,
    runOcrForDocumentPages: runOcrForDocumentPagesDependency = runOcrForDocumentPages,
  } = dependencies;
  const { subjectId, kind } = input;
  const filePaths = normalizeFilePaths(input.filePaths as unknown[]);

  if (filePaths.length === 0) {
    throw new Error('No valid PDF file paths were provided for import.');
  }

  const subjectDocumentsDir = path.join(subjectsDir, subjectId, 'documents');
  const selectedFiles = filePaths.map((filePath) => path.basename(filePath));

  await fs.mkdir(subjectDocumentsDir, { recursive: true });

  const job = database.createImportJob({
    id: randomUUID(),
    subjectId,
    message: `Importing ${filePaths.length} PDF${filePaths.length === 1 ? '' : 's'}...`,
    payload: buildImportPayload({
      subjectId,
      kind,
      selectedFiles,
      importedDocumentIds: [],
      failures: [],
      ocrAttemptedCount: 0,
      ocrImprovedCount: 0,
      ocrFailedCount: 0,
    }),
  });

  const importedDocuments: SourceDocumentRow[] = [];
  const failures: ImportFailure[] = [];
  let totalOcrAttemptedCount = 0;
  let totalOcrImprovedCount = 0;
  let totalOcrFailedCount = 0;

  try {
    for (const filePath of filePaths) {
      const documentId = randomUUID();
      const originalFileName = path.basename(filePath);
      const safeFileName = sanitizeFileName(originalFileName);
      const storedFileName = `${documentId}-${safeFileName}`;
      const destinationPath = path.join(subjectDocumentsDir, storedFileName);

      try {
        await fs.copyFile(filePath, destinationPath);
        const pdfBytes = new Uint8Array(await fs.readFile(destinationPath));
        const extracted = await extractPdfDocument(pdfBytes);
        const relativePath = path.relative(dataDir, destinationPath);
        const pageEntries: PageImportResult[] = extracted.pages.map((page) => ({
          id: randomUUID(),
          pageNumber: page.pageNumber,
          textContent: page.textContent,
          textSource: 'native',
          ocrAttempted: false,
          ocrSucceeded: false,
          ocrConfidence: null,
          ocrWarning: null,
        }));

        const candidatePages = pageEntries.filter((page) =>
          assessPageForOcr(page.textContent).shouldAttemptOcr,
        );

        const runtimeStatus =
          candidatePages.length > 0
            ? await detectOcrRuntimeDependency()
            : {
                available: false,
                engine: null,
                message: '',
                pythonCommand: null,
                scriptPath: null,
              };

        let ocrResult: OcrDocumentRunResult | null = null;
        if (candidatePages.length > 0 && runtimeStatus.available) {
          ocrResult = await runOcrForDocumentPagesDependency({
            pdfPath: destinationPath,
            pages: candidatePages.map((page) => ({
              pageId: page.id,
              pageNumber: page.pageNumber,
            })),
          });
        }

        const ocrPageMap = new Map(
          (ocrResult?.pages ?? []).map((page) => [page.pageId, page]),
        );
        let documentOcrAttemptedPages = 0;
        let documentOcrSucceededPages = 0;
        let documentOcrImprovedPages = 0;
        let documentOcrFailedPages = 0;
        const ocrWarnings: string[] = [];

        for (const pageEntry of pageEntries) {
          const assessment = assessPageForOcr(pageEntry.textContent);
          if (!assessment.shouldAttemptOcr) {
            continue;
          }

          pageEntry.ocrAttempted = true;
          documentOcrAttemptedPages += 1;

          if (!runtimeStatus.available) {
            pageEntry.ocrWarning =
              runtimeStatus.message || 'OCR runtime unavailable for this page.';
            documentOcrFailedPages += 1;
            continue;
          }

          const ocrPage = ocrPageMap.get(pageEntry.id);
          if (!ocrPage || ocrPage.textContent.trim().length === 0) {
            pageEntry.ocrWarning =
              ocrPage?.warning || 'OCR did not produce usable text for this page.';
            pageEntry.ocrConfidence = ocrPage?.confidence ?? null;
            documentOcrFailedPages += 1;
            continue;
          }

          const merged = mergePreferredPageText(
            pageEntry.textContent,
            ocrPage.textContent,
          );
          pageEntry.textContent = merged.textContent;
          pageEntry.textSource = merged.textSource;
          pageEntry.ocrSucceeded = true;
          pageEntry.ocrConfidence = ocrPage.confidence;
          pageEntry.ocrWarning = ocrPage.warning;
          documentOcrSucceededPages += 1;
          if (merged.improved) {
            documentOcrImprovedPages += 1;
          }
        }

        if (candidatePages.length > 0 && !runtimeStatus.available) {
          ocrWarnings.push(runtimeStatus.message);
        }

        if (documentOcrFailedPages > 0 && runtimeStatus.available) {
          ocrWarnings.push(
            `OCR could not improve ${documentOcrFailedPages} page${
              documentOcrFailedPages === 1 ? '' : 's'
            }.`,
          );
        }

        const chunkEntries = pageEntries.flatMap((pageEntry) => {
          return chunkPageText(pageEntry.id, pageEntry.textContent).map((chunk) => ({
            id: randomUUID(),
            pageId: chunk.pageId,
            chunkIndex: chunk.chunkIndex,
            textContent: chunk.textContent,
          }));
        });

        const documentRow = database.insertImportedDocument({
          document: {
            id: documentId,
            subjectId,
            kind,
            originalFileName,
            storedFileName,
            relativePath,
            mimeType: 'application/pdf',
            pageCount: extracted.pageCount,
            ocrState: buildDocumentOcrState({
              candidateCount: candidatePages.length,
              runtimeAvailable: runtimeStatus.available,
              attemptedPages: documentOcrAttemptedPages,
              succeededPages: documentOcrSucceededPages,
              improvedPages: documentOcrImprovedPages,
            }),
            ocrAttemptedPages: documentOcrAttemptedPages,
            ocrSucceededPages: documentOcrSucceededPages,
            ocrImprovedPages: documentOcrImprovedPages,
            ocrWarning: ocrWarnings.join(' ').trim() || null,
            importStatus: 'ready',
            errorMessage: null,
          },
          pages: pageEntries,
          chunks: chunkEntries,
        });

        totalOcrAttemptedCount += documentOcrAttemptedPages;
        totalOcrImprovedCount += documentOcrImprovedPages;
        totalOcrFailedCount += documentOcrFailedPages;

        importedDocuments.push(documentRow);
      } catch (error) {
        await fs.rm(destinationPath, { force: true }).catch(() => undefined);
        const reason =
          error instanceof Error ? error.message : 'Unknown import error';

        failures.push({
          fileName: originalFileName,
          reason,
        });

        const failedDocument = database.insertFailedDocument({
          id: documentId,
          subjectId,
          kind,
          originalFileName,
          storedFileName: null,
          relativePath: null,
          mimeType: 'application/pdf',
          pageCount: 0,
          importStatus: 'failed',
          errorMessage: reason,
        });

        importedDocuments.push(failedDocument);
      }
    }
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : 'Unexpected import pipeline failure';

    database.updateJob(job.id, {
      status: 'failed',
      message: `Import pipeline failed before completion: ${reason}`,
      payload: buildImportPayload({
        subjectId,
        kind,
        selectedFiles,
        importedDocumentIds: importedDocuments
          .filter((document) => document.importStatus === 'ready')
          .map((document) => document.id),
        failures,
        ocrAttemptedCount: totalOcrAttemptedCount,
        ocrImprovedCount: totalOcrImprovedCount,
        ocrFailedCount: totalOcrFailedCount,
      }),
    });

    throw error;
  }

  const importedCount = importedDocuments.filter(
    (document) => document.importStatus === 'ready',
  ).length;
  const failedCount = failures.length;
  const status =
    failedCount === 0 ? 'completed' : importedCount === 0 ? 'failed' : 'partial';

  const completedJob = database.updateJob(job.id, {
    status,
    message:
      createJobMessage(kind, importedCount, failedCount) +
      createOcrSuffix({
        attemptedCount: totalOcrAttemptedCount,
        improvedCount: totalOcrImprovedCount,
        failedCount: totalOcrFailedCount,
      }),
    payload: buildImportPayload({
      subjectId,
      kind,
      selectedFiles,
      importedDocumentIds: importedDocuments
        .filter((document) => document.importStatus === 'ready')
        .map((document) => document.id),
      failures,
      ocrAttemptedCount: totalOcrAttemptedCount,
      ocrImprovedCount: totalOcrImprovedCount,
      ocrFailedCount: totalOcrFailedCount,
    }),
  });

  return {
    job: completedJob,
    importedDocuments,
    failures,
  };
};
