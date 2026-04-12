export const IPC_CHANNELS = {
  APP_INFO: 'app:get-info',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SAVE: 'settings:save',
  SETTINGS_CHOOSE_DATA_PATH: 'settings:choose-data-path',
  SETTINGS_RESET_DATA_PATH: 'settings:reset-data-path',
  SUBJECTS_LIST: 'subjects:list',
  SUBJECTS_CREATE: 'subjects:create',
  SUBJECTS_DELETE: 'subjects:delete',
  SUBJECTS_WORKSPACE: 'subjects:workspace',
  SUBJECTS_IMPORT: 'subjects:import',
  SUBJECTS_ANALYZE: 'subjects:analyze',
  CHAT_ASK: 'chat:ask',
  PRACTICE_GENERATE: 'practice:generate',
  PRACTICE_REVEAL: 'practice:reveal',
  PRACTICE_DELETE: 'practice:delete',
  RESEARCH_SEARCH: 'research:search',
  RESEARCH_NAVIGATE: 'research:navigate',
  RESEARCH_BACK: 'research:back',
  RESEARCH_FORWARD: 'research:forward',
  RESEARCH_RELOAD: 'research:reload',
  RESEARCH_SET_BOUNDS: 'research:set-bounds',
  RESEARCH_HIDE_BROWSER: 'research:hide-browser',
  RESEARCH_OPEN_EXTERNAL: 'research:open-external',
  RESEARCH_BROWSER_STATE: 'research:browser-state',
  DOCUMENTS_DELETE: 'documents:delete',
  DOCUMENTS_DETAIL: 'documents:detail',
  DOCUMENTS_DATA: 'documents:data',
} as const;

export type AppInfo = {
  version: string;
  userDataPath: string;
  dataPath: string;
  encryptionAvailable: boolean;
  platform: string;
  nodeVersion: string;
  electronVersion: string;
  runningInWsl: boolean;
  nativeDatabaseReady: boolean;
};

export type AiProvider = 'openai' | 'ollama';

export type SettingsState = {
  aiProvider: AiProvider;
  openAiApiKeyConfigured: boolean;
  encryptionAvailable: boolean;
  ollamaBaseUrl: string;
  ollamaModel: string;
  braveSearchApiKeyConfigured: boolean;
  youTubeApiKeyConfigured: boolean;
  researchSafetyMode: 'balanced' | 'education';
  dataPath: string;
  defaultDataPath: string;
  usingCustomDataPath: boolean;
};

export type SaveSettingsInput = {
  aiProvider?: AiProvider;
  openAiApiKey?: string;
  ollamaBaseUrl?: string;
  ollamaModel?: string;
  braveSearchApiKey?: string;
  youTubeApiKey?: string;
  researchSafetyMode?: 'balanced' | 'education';
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
  provider: string;
  model: string;
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
  extractedTextLength: number;
  pagesWithExtractedText: number;
  extractionState: 'normal' | 'limited' | 'image-only';
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
  textContent: string;
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
  chatMessages: DivisionChatMessage[];
  practiceSets: PracticeSet[];
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

export type CitationRef = {
  pageId: string;
  documentId: string;
  documentName: string;
  documentKind: DocumentKind;
  pageNumber: number;
  excerptText: string;
  highlightText: string | null;
  thumbnailAssetPath?: string | null;
  textBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
};

export type SubjectAnalysisDivision = {
  id: string;
  title: string;
  summary: string;
  keyConcepts: string[];
  sourcePages: CitationRef[];
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

export type SelectionContext = {
  kind:
    | 'division-summary'
    | 'page-text'
    | 'chat-question'
    | 'chat-answer'
    | 'practice-question'
    | 'practice-answer';
  subjectId: string;
  divisionId: string;
  selectedText: string;
  surroundingText: string;
  sourcePageIds: string[];
  pageId?: string | null;
  documentId?: string | null;
  documentName?: string | null;
  documentKind?: DocumentKind | null;
  pageNumber?: number | null;
};

export type GroundedAnswer = {
  answerMarkdown: string;
  citations: CitationRef[];
  followups: string[];
  suggestedSearchQueries: string[];
  suggestedVideoQueries: string[];
};

export type DivisionChatMessage = {
  id: string;
  subjectId: string;
  divisionId: string;
  role: 'user' | 'assistant';
  content: string;
  citations: CitationRef[];
  followups: string[];
  suggestedSearchQueries: string[];
  suggestedVideoQueries: string[];
  selectionContext: SelectionContext | null;
  createdAt: string;
};

export type ChatAskInput = {
  subjectId: string;
  divisionId: string;
  prompt: string;
  selectionContext?: SelectionContext | null;
};

export type ChatAskResult = {
  userMessage: DivisionChatMessage;
  assistantMessage: DivisionChatMessage;
  answer: GroundedAnswer;
};

export type PracticeDifficulty = 'easy' | 'medium' | 'hard';

export type PracticeQuestion = {
  id: string;
  questionIndex: number;
  prompt: string;
  answer: string;
  revealed: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PracticeSet = {
  id: string;
  subjectId: string;
  divisionId: string;
  problemTypeId: string;
  problemTypeTitle: string;
  difficulty: PracticeDifficulty;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
  sourcePages: CitationRef[];
  questions: PracticeQuestion[];
};

export type GeneratePracticeInput = {
  subjectId: string;
  divisionId: string;
  problemTypeId: string;
  difficulty: PracticeDifficulty;
  count: number;
};

export type GeneratePracticeResult = {
  practiceSet: PracticeSet;
};

export type RevealPracticeAnswerInput = {
  questionId: string;
};

export type RevealPracticeAnswerResult = {
  practiceSetId: string;
  question: PracticeQuestion;
};

export type DeletePracticeSetInput = {
  practiceSetId: string;
};

export type ResearchWebResult = {
  id: string;
  title: string;
  url: string;
  displayUrl: string;
  snippet: string;
  source: string;
};

export type ResearchVideoResult = {
  id: string;
  title: string;
  url: string;
  thumbnailUrl: string;
  channel: string | null;
  duration: string | null;
  query: string;
};

export type ResearchSearchInput = {
  query: string;
  videoQuery?: string | null;
};

export type ResearchSearchResult = {
  query: string;
  videoQuery: string;
  results: ResearchWebResult[];
  videos: ResearchVideoResult[];
  provider: string;
  safetyMode: 'balanced' | 'education';
};

export type ResearchBrowserBoundsInput = {
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
};

export type ResearchBrowserNavigationInput = {
  url: string;
};

export type ResearchExternalLinkInput = {
  url: string;
};

export type ResearchBrowserState = {
  visible: boolean;
  url: string;
  sourceUrl: string;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
  loading: boolean;
  errorMessage: string | null;
  contentKind: 'web' | 'pdf';
};

export interface StudyBudApi {
  getAppInfo: () => Promise<AppInfo>;
  getSettings: () => Promise<SettingsState>;
  saveSettings: (input: SaveSettingsInput) => Promise<SettingsState>;
  chooseDataPath: () => Promise<SettingsState | null>;
  resetDataPath: () => Promise<SettingsState>;
  listSubjects: () => Promise<SubjectSummary[]>;
  createSubject: (input: CreateSubjectInput) => Promise<SubjectSummary>;
  deleteSubject: (subjectId: string) => Promise<void>;
  getSubjectWorkspace: (subjectId: string) => Promise<SubjectWorkspace>;
  importDocuments: (input: ImportDocumentsInput) => Promise<ImportDocumentsResult>;
  analyzeSubject: (input: AnalyzeSubjectInput) => Promise<AnalyzeSubjectResult>;
  askChat: (input: ChatAskInput) => Promise<ChatAskResult>;
  generatePractice: (input: GeneratePracticeInput) => Promise<GeneratePracticeResult>;
  revealPracticeAnswer: (
    input: RevealPracticeAnswerInput,
  ) => Promise<RevealPracticeAnswerResult>;
  deletePracticeSet: (input: DeletePracticeSetInput) => Promise<void>;
  searchResearch: (input: ResearchSearchInput) => Promise<ResearchSearchResult>;
  navigateResearchBrowser: (
    input: ResearchBrowserNavigationInput,
  ) => Promise<ResearchBrowserState>;
  goBackResearchBrowser: () => Promise<ResearchBrowserState>;
  goForwardResearchBrowser: () => Promise<ResearchBrowserState>;
  reloadResearchBrowser: () => Promise<ResearchBrowserState>;
  setResearchBrowserBounds: (
    input: ResearchBrowserBoundsInput,
  ) => Promise<ResearchBrowserState>;
  hideResearchBrowser: () => Promise<ResearchBrowserState>;
  openExternalResearchLink: (
    input: ResearchExternalLinkInput,
  ) => Promise<void>;
  onResearchBrowserState: (
    listener: (state: ResearchBrowserState) => void,
  ) => () => void;
  deleteDocument: (documentId: string) => Promise<void>;
  getDocumentDetail: (documentId: string) => Promise<SourceDocumentDetail>;
  readDocumentData: (documentId: string) => Promise<Uint8Array>;
}
