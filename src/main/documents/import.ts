import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

import type { DocumentKind, ImportFailure } from '../../shared/ipc';
import type {
  DatabaseService,
  JobRow,
  SourceDocumentRow,
} from '../db/database';
import { chunkPageText, extractPdfDocument } from '../pdf/extraction';

type ImportDocumentsDependencies = {
  dataDir: string;
  subjectsDir: string;
  database: DatabaseService;
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

export const importSubjectDocuments = async (
  dependencies: ImportDocumentsDependencies,
  input: ImportDocumentsInput,
): Promise<ImportDocumentsOutput> => {
  const { dataDir, subjectsDir, database } = dependencies;
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
    payload: JSON.stringify({
      subjectId,
      kind,
      selectedFiles,
      importedDocumentIds: [],
      failures: [],
    }),
  });

  const importedDocuments: SourceDocumentRow[] = [];
  const failures: ImportFailure[] = [];

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
        const pageEntries = extracted.pages.map((page) => ({
          id: randomUUID(),
          pageNumber: page.pageNumber,
          textContent: page.textContent,
        }));

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
            importStatus: 'ready',
            errorMessage: null,
          },
          pages: pageEntries,
          chunks: chunkEntries,
        });

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
      payload: JSON.stringify({
        subjectId,
        kind,
        selectedFiles,
        importedDocumentIds: importedDocuments
          .filter((document) => document.importStatus === 'ready')
          .map((document) => document.id),
        failures,
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
    message: createJobMessage(kind, importedCount, failedCount),
    payload: JSON.stringify({
      subjectId,
      kind,
      selectedFiles,
      importedDocumentIds: importedDocuments
        .filter((document) => document.importStatus === 'ready')
        .map((document) => document.id),
      failures,
    }),
  });

  return {
    job: completedJob,
    importedDocuments,
    failures,
  };
};
