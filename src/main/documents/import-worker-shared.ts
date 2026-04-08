import type { DocumentKind, ImportFailure } from '../../shared/ipc';
import type { JobRow, SourceDocumentRow } from '../db/database';

export type ImportWorkerRequest = {
  dataDir: string;
  dbPath: string;
  subjectId: string;
  kind: DocumentKind;
  filePaths: string[];
  subjectsDir: string;
};

export type ImportWorkerSuccess = {
  type: 'success';
  result: {
    job: JobRow;
    importedDocuments: SourceDocumentRow[];
    failures: ImportFailure[];
  };
};

export type ImportWorkerFailure = {
  type: 'error';
  message: string;
};

export type ImportWorkerMessage = ImportWorkerSuccess | ImportWorkerFailure;
