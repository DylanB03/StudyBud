export const IPC_CHANNELS = {
  APP_INFO: 'app:get-info',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SAVE: 'settings:save',
  SUBJECTS_LIST: 'subjects:list',
  SUBJECTS_CREATE: 'subjects:create',
  SUBJECTS_WORKSPACE: 'subjects:workspace',
  SUBJECTS_IMPORT: 'subjects:import',
  SUBJECTS_ANALYZE: 'subjects:analyze',
  DOCUMENTS_DELETE: 'documents:delete',
  DOCUMENTS_DETAIL: 'documents:detail',
  DOCUMENTS_DATA: 'documents:data',
} as const;

export type AppInfo = {
  version: string;
  userDataPath: string;
  dataPath: string;
  encryptionAvailable: boolean;
};

export type SettingsState = {
  openAiApiKeyConfigured: boolean;
  encryptionAvailable: boolean;
};

export type SaveSettingsInput = {
  openAiApiKey?: string;
};

export type SubjectSummary = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateSubjectInput = {
  name: string;
};

export type DocumentKind = 'lecture' | 'homework';

export type DocumentImportStatus = 'ready' | 'failed';

export type JobStatus = 'running' | 'completed' | 'failed' | 'partial';

export type ImportFailure = {
  fileName: string;
  reason: string;
};

export type ImportJobSummary = {
  id: string;
  subjectId: string;
  type: 'document-import';
  status: JobStatus;
  message: string;
  kind: DocumentKind;
  totalFiles: number;
  importedCount: number;
  failedCount: number;
  createdAt: string;
  updatedAt: string;
};

export type SubjectAnalysisJobSummary = {
  id: string;
  subjectId: string;
  type: 'subject-ingestion';
  status: JobStatus;
  message: string;
  divisionCount: number;
  problemTypeCount: number;
  unassignedPageCount: number;
  createdAt: string;
  updatedAt: string;
};

export type SourceDocumentSummary = {
  id: string;
  subjectId: string;
  kind: DocumentKind;
  originalFileName: string;
  storedFileName: string | null;
  relativePath: string | null;
  mimeType: string;
  pageCount: number;
  importStatus: DocumentImportStatus;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DocumentPageSummary = {
  id: string;
  pageNumber: number;
  textLength: number;
  previewText: string;
};

export type SourceDocumentDetail = SourceDocumentSummary & {
  pages: DocumentPageSummary[];
};

export type SubjectWorkspace = {
  subject: SubjectSummary;
  documents: SourceDocumentSummary[];
  jobs: ImportJobSummary[];
  analysisJobs: SubjectAnalysisJobSummary[];
  analysis: SubjectAnalysisSummary | null;
};

export type ImportDocumentsInput = {
  subjectId: string;
  kind: DocumentKind;
};

export type ImportDocumentsResult = {
  canceled: boolean;
  job: ImportJobSummary | null;
  importedDocuments: SourceDocumentSummary[];
  failures: ImportFailure[];
};

export type SubjectAnalysisDivision = {
  id: string;
  title: string;
  summary: string;
  keyConcepts: string[];
  sourcePages: Array<{
    pageId: string;
    documentId: string;
    documentName: string;
    documentKind: DocumentKind;
    pageNumber: number;
  }>;
  problemTypes: Array<{
    id: string;
    title: string;
    description: string;
  }>;
};

export type SubjectAnalysisSummary = {
  divisions: SubjectAnalysisDivision[];
  unassignedPages: Array<{
    id: string;
    reason: string | null;
    pageId: string;
    documentId: string;
    documentName: string;
    documentKind: DocumentKind;
    pageNumber: number;
  }>;
};

export type AnalyzeSubjectInput = {
  subjectId: string;
};

export type AnalyzeSubjectResult = {
  job: SubjectAnalysisJobSummary;
  analysis: SubjectAnalysisSummary;
};

export interface StudyBudApi {
  getAppInfo: () => Promise<AppInfo>;
  getSettings: () => Promise<SettingsState>;
  saveSettings: (input: SaveSettingsInput) => Promise<SettingsState>;
  listSubjects: () => Promise<SubjectSummary[]>;
  createSubject: (input: CreateSubjectInput) => Promise<SubjectSummary>;
  getSubjectWorkspace: (subjectId: string) => Promise<SubjectWorkspace>;
  importDocuments: (input: ImportDocumentsInput) => Promise<ImportDocumentsResult>;
  analyzeSubject: (input: AnalyzeSubjectInput) => Promise<AnalyzeSubjectResult>;
  deleteDocument: (documentId: string) => Promise<void>;
  getDocumentDetail: (documentId: string) => Promise<SourceDocumentDetail>;
  readDocumentData: (documentId: string) => Promise<Uint8Array>;
}
