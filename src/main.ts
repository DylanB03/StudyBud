import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';

import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  safeStorage,
  screen,
  session,
} from 'electron';
import started from 'electron-squirrel-startup';
import { z } from 'zod';

import {
  analyzeSubjectMaterials,
  getPersistedSubjectAnalysisSummary,
} from './main/analysis/subject-analysis';
import {
  answerDivisionChat,
  mapPersistedDivisionChatMessages,
} from './main/chat/grounded-chat';
import {
  generatePracticeSet,
  mapPersistedPracticeSets,
} from './main/practice/practice-generation';
import {
  createManualFlashcardDeck,
  generateFlashcardDeck,
  mapPersistedFlashcardDecks,
} from './main/flashcards/flashcard-generation';
import {
  type DocumentPageRow,
  type JobRow,
  DatabaseService,
  type SourceDocumentRow,
  type SubjectRow,
} from './main/db/database';
import { summarizeExtractionConfidence } from './main/documents/extraction-confidence';
import { runImportInUtilityProcess } from './main/documents/import-process';
import { installApplicationMenu } from './main/menu/app-menu';
import { detectOcrRuntime } from './main/ocr/runtime';
import { ResearchBrowserController } from './main/research/browser';
import { searchResearch } from './main/research/search';
import { applyContentSecurityPolicy } from './main/security/csp';
import { openExternalUrl } from './main/system/open-external';
import {
  type ChatAskInput,
  type ChatAskResult,
  type AnalyzeSubjectInput,
  type AnalyzeSubjectResult,
  type AiProvider,
  type CreateFlashcardDeckResult,
  type CreateFlashcardDeckInput,
  type DeleteFlashcardDeckInput,
  type GeneratePracticeInput,
  type GeneratePracticeResult,
  type GenerateFlashcardsInput,
  type GenerateFlashcardsResult,
  IPC_CHANNELS,
  type AppInfo,
  type CreateSubjectInput,
  type DocumentKind,
  type DocumentPageSummary,
  type ImportDocumentsInput,
  type ImportDocumentsResult,
  type ImportJobSummary,
  type ResearchBrowserBoundsInput,
  type ResearchExternalLinkInput,
  type ResearchBrowserNavigationInput,
  type ResearchBrowserState,
  type ResearchSearchInput,
  type ResearchSearchResult,
  type SubjectAnalysisJobSummary,
  type SaveSettingsInput,
  type SettingsState,
  type SelectionContext,
  type SourceDocumentDetail,
  type SourceDocumentSummary,
  type SubjectSummary,
  type SubjectWorkspace,
  type RevealPracticeAnswerInput,
  type RevealPracticeAnswerResult,
  type DeletePracticeSetInput,
} from './shared/ipc';
import {
  DEFAULT_OLLAMA_BASE_URL,
  DEFAULT_OLLAMA_INGESTION_MODEL,
} from './main/ai/ollama';
import { DEFAULT_OPENAI_INGESTION_MODEL } from './main/ai/openai';

if (started) {
  app.quit();
}

// This app is mostly standard DOM and canvas rendering, so disabling GPU
// acceleration is a good tradeoff to avoid black-window issues on flaky drivers.
app.disableHardwareAcceleration();

const OPENAI_KEY_SETTING = 'openai_api_key';
const AI_PROVIDER_SETTING = 'ai_provider';
const OLLAMA_BASE_URL_SETTING = 'ollama_base_url';
const OLLAMA_MODEL_SETTING = 'ollama_model';
const BRAVE_SEARCH_API_KEY_SETTING = 'brave_search_api_key';
const YOUTUBE_API_KEY_SETTING = 'youtube_api_key';
const RESEARCH_SAFETY_MODE_SETTING = 'research_safety_mode';
const BOOTSTRAP_CONFIG_FILE = 'bootstrap-settings.json';

type AppPaths = {
  dataDir: string;
  defaultDataDir: string;
  dbPath: string;
  subjectsDir: string;
};

type BootstrapConfig = {
  customDataPath?: string;
};

const saveSettingsSchema = z.object({
  aiProvider: z.enum(['openai', 'ollama']).optional(),
  openAiApiKey: z.string().max(500).optional(),
  ollamaBaseUrl: z.string().max(500).optional(),
  ollamaModel: z.string().max(200).optional(),
  braveSearchApiKey: z.string().max(500).optional(),
  youTubeApiKey: z.string().max(500).optional(),
  researchSafetyMode: z.enum(['balanced', 'education']).optional(),
});

const createSubjectSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

const importDocumentsSchema = z.object({
  subjectId: z.string().uuid(),
  kind: z.enum(['lecture', 'homework']),
});

const analyzeSubjectSchema = z.object({
  subjectId: z.string().uuid(),
});

const selectionContextSchema = z.object({
  kind: z.enum([
    'division-summary',
    'page-text',
    'chat-question',
    'chat-answer',
    'practice-question',
    'practice-answer',
  ]),
  subjectId: z.string().uuid(),
  divisionId: z.string().uuid(),
  selectedText: z.string().trim().min(1).max(4000),
  surroundingText: z.string().trim().min(1).max(12000),
  sourcePageIds: z.array(z.string()).max(32),
  pageId: z.string().optional().nullable(),
  documentId: z.string().optional().nullable(),
  documentName: z.string().optional().nullable(),
  documentKind: z.enum(['lecture', 'homework']).optional().nullable(),
  pageNumber: z.number().int().positive().optional().nullable(),
});

const chatAskSchema = z.object({
  subjectId: z.string().uuid(),
  divisionId: z.string().uuid(),
  prompt: z.string().trim().min(1).max(2000),
  selectionContext: selectionContextSchema.optional().nullable(),
});

const generatePracticeSchema = z.object({
  subjectId: z.string().uuid(),
  divisionId: z.string().uuid(),
  problemTypeId: z.string().uuid(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  count: z.number().int().min(1).max(8),
});

const revealPracticeAnswerSchema = z.object({
  questionId: z.string().uuid(),
});

const deletePracticeSetSchema = z.object({
  practiceSetId: z.string().uuid(),
});

const generateFlashcardsSchema = z.object({
  subjectId: z.string().uuid(),
  divisionIds: z.array(z.string().uuid()).min(1).max(12),
  count: z.number().int().min(1).max(24),
  title: z.string().trim().min(1).max(120).optional(),
});

const createFlashcardDeckSchema = z.object({
  subjectId: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
  divisionIds: z.array(z.string().uuid()).max(12),
  cards: z
    .array(
      z.object({
        front: z.string().trim().min(1).max(300),
        back: z.string().trim().min(1).max(1200),
      }),
    )
    .min(1)
    .max(60),
});

const deleteFlashcardDeckSchema = z.object({
  flashcardDeckId: z.string().uuid(),
});

const researchSearchSchema = z.object({
  query: z.string().trim().min(1).max(240),
  videoQuery: z.string().trim().min(1).max(240).optional().nullable(),
});

const researchBrowserNavigationSchema = z.object({
  url: z.string().trim().min(1).max(2000),
});

const researchBrowserBoundsSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().min(0),
  height: z.number().finite().min(0),
  visible: z.boolean(),
});

const researchExternalLinkSchema = z.object({
  url: z.string().trim().min(1).max(2000),
});

let appPaths: AppPaths | null = null;
let database: DatabaseService | null = null;
let mainWindow: BrowserWindow | null = null;
let contentSecurityPolicyRegistered = false;
let initializationPromise: Promise<void> | null = null;
let sessionOpenAiApiKey: string | null = null;
let sessionBraveSearchApiKey: string | null = null;
let sessionYouTubeApiKey: string | null = null;
let researchBrowser: ResearchBrowserController | null = null;

const isRunningInWsl = (): boolean => {
  if (process.platform !== 'linux') {
    return false;
  }

  const release = os.release().toLowerCase();
  return release.includes('microsoft') || release.includes('wsl');
};

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
}

const formatTimestamp = (value: number): string => {
  return new Date(value).toISOString();
};

const parseJsonObject = <T extends Record<string, unknown>>(
  raw: string,
  fallback: T,
): T => {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as T)
      : fallback;
  } catch {
    return fallback;
  }
};

const normalizeDialogFilePaths = (filePaths: unknown[]): string[] => {
  return filePaths.filter((filePath): filePath is string => {
    return typeof filePath === 'string' && filePath.trim().length > 0;
  });
};

const getResearchBrowserOrThrow = (): ResearchBrowserController => {
  if (!researchBrowser) {
    throw new Error('Research browser is not initialized');
  }

  return researchBrowser;
};

const getBootstrapConfigPath = (): string => {
  return path.join(app.getPath('userData'), BOOTSTRAP_CONFIG_FILE);
};

const readBootstrapConfig = (): BootstrapConfig => {
  const configPath = getBootstrapConfigPath();

  try {
    if (!fs.existsSync(configPath)) {
      return {};
    }

    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw) as BootstrapConfig;

    return typeof parsed.customDataPath === 'string'
      ? { customDataPath: parsed.customDataPath }
      : {};
  } catch {
    return {};
  }
};

const writeBootstrapConfig = (config: BootstrapConfig): void => {
  const configPath = getBootstrapConfigPath();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
};

const getDefaultDataDir = (): string => {
  return path.join(app.getPath('userData'), 'data');
};

const buildAppPaths = (dataDir: string): AppPaths => {
  const subjectsDir = path.join(dataDir, 'subjects');
  const dbPath = path.join(dataDir, 'studybud.db');

  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(subjectsDir, { recursive: true });

  return {
    dataDir,
    defaultDataDir: getDefaultDataDir(),
    dbPath,
    subjectsDir,
  };
};

const ensureAppPaths = (): AppPaths => {
  const bootstrapConfig = readBootstrapConfig();
  const resolvedDataDir =
    typeof bootstrapConfig.customDataPath === 'string' &&
    bootstrapConfig.customDataPath.trim().length > 0
      ? bootstrapConfig.customDataPath
      : getDefaultDataDir();

  appPaths = buildAppPaths(resolvedDataDir);

  return appPaths;
};

const getPathsOrThrow = (): AppPaths => {
  if (!appPaths) {
    throw new Error('Application paths are not initialized');
  }

  return appPaths;
};

const getDatabaseOrThrow = (): DatabaseService => {
  if (!database) {
    throw new Error('Database is not initialized');
  }

  return database;
};

const ensureInitialized = async (): Promise<void> => {
  if (database && appPaths) {
    return;
  }

  if (initializationPromise) {
    await initializationPromise;
    return;
  }

  initializationPromise = app.whenReady().then(() => {
    if (!database) {
      const paths = appPaths ?? ensureAppPaths();
      database = new DatabaseService(paths.dbPath);
      database.reconcileInterruptedImportJobs();
    }

    if (!contentSecurityPolicyRegistered) {
      registerContentSecurityPolicy();
      contentSecurityPolicyRegistered = true;
    }
  });

  try {
    await initializationPromise;
  } catch (error) {
    initializationPromise = null;
    throw error;
  }
};

const mapSubject = (subject: SubjectRow): SubjectSummary => {
  return {
    id: subject.id,
    name: subject.name,
    createdAt: formatTimestamp(subject.createdAt),
    updatedAt: formatTimestamp(subject.updatedAt),
  };
};

const mapDocument = (
  document: SourceDocumentRow,
  pages: DocumentPageRow[] = [],
): SourceDocumentSummary => {
  const extractionSummary = summarizeExtractionConfidence({
    importStatus: document.importStatus,
    pageCount: document.pageCount,
    pageTextLengths: pages.map((page) => page.textLength),
  });
  return {
    id: document.id,
    subjectId: document.subjectId,
    kind: document.kind as DocumentKind,
    originalFileName: document.originalFileName,
    storedFileName: document.storedFileName,
    relativePath: document.relativePath,
    mimeType: document.mimeType,
    pageCount: document.pageCount,
    extractedTextLength: extractionSummary.extractedTextLength,
    pagesWithExtractedText: extractionSummary.pagesWithExtractedText,
    extractionState: extractionSummary.extractionState,
    ocrState: document.ocrState,
    ocrAttemptedPages: document.ocrAttemptedPages,
    ocrSucceededPages: document.ocrSucceededPages,
    ocrImprovedPages: document.ocrImprovedPages,
    ocrWarning: document.ocrWarning,
    importStatus: document.importStatus as SourceDocumentSummary['importStatus'],
    errorMessage: document.errorMessage,
    createdAt: formatTimestamp(document.createdAt),
    updatedAt: formatTimestamp(document.updatedAt),
  };
};

const mapPage = (page: DocumentPageRow): DocumentPageSummary => {
  return {
    id: page.id,
    pageNumber: page.pageNumber,
    textLength: page.textLength,
    textContent: page.textContent,
    textSource: page.textSource,
    ocrAttempted: page.ocrAttempted,
    ocrSucceeded: page.ocrSucceeded,
    ocrConfidence: page.ocrConfidence,
    ocrWarning: page.ocrWarning,
    previewText:
      page.textContent.length > 180
        ? `${page.textContent.slice(0, 180).trim()}...`
        : page.textContent,
  };
};

const mapJob = (job: JobRow): ImportJobSummary => {
  const payload = parseJsonObject<{
    kind?: DocumentKind;
    selectedFiles?: string[];
    importedDocumentIds?: string[];
    failures?: Array<{ fileName: string; reason: string }>;
    ocrAttemptedCount?: number;
    ocrImprovedCount?: number;
    ocrFailedCount?: number;
  }>(job.payload, {});

  if (!job.subjectId) {
    throw new Error(`Job ${job.id} is missing subject context`);
  }

  return {
    id: job.id,
    subjectId: job.subjectId,
    type: 'document-import',
    status: job.status as ImportJobSummary['status'],
    message: job.message,
    kind: payload.kind ?? 'lecture',
    totalFiles: payload.selectedFiles?.length ?? 0,
    importedCount: payload.importedDocumentIds?.length ?? 0,
    failedCount: payload.failures?.length ?? 0,
    ocrAttemptedCount: payload.ocrAttemptedCount ?? 0,
    ocrImprovedCount: payload.ocrImprovedCount ?? 0,
    ocrFailedCount: payload.ocrFailedCount ?? 0,
    createdAt: formatTimestamp(job.createdAt),
    updatedAt: formatTimestamp(job.updatedAt),
  };
};

const mapAnalysisJob = (job: JobRow): SubjectAnalysisJobSummary => {
  const payload = parseJsonObject<{
    provider?: string;
    model?: string;
    divisionCount?: number;
    problemTypeCount?: number;
    unassignedPageCount?: number;
  }>(job.payload, {});

  if (!job.subjectId) {
    throw new Error(`Job ${job.id} is missing subject context`);
  }

  return {
    id: job.id,
    subjectId: job.subjectId,
    type: 'subject-ingestion',
    status: job.status as SubjectAnalysisJobSummary['status'],
    message: job.message,
    provider: payload.provider ?? 'Unknown',
    model: payload.model ?? 'Unknown',
    divisionCount: payload.divisionCount ?? 0,
    problemTypeCount: payload.problemTypeCount ?? 0,
    unassignedPageCount: payload.unassignedPageCount ?? 0,
    createdAt: formatTimestamp(job.createdAt),
    updatedAt: formatTimestamp(job.updatedAt),
  };
};

const getSubjectWorkspace = (subjectId: string): SubjectWorkspace => {
  const db = getDatabaseOrThrow();
  const subject = db.getSubjectById(subjectId);

  if (!subject) {
    throw new Error('Subject not found');
  }

  return {
    subject: mapSubject(subject),
    documents: db
      .listDocumentsBySubject(subjectId)
      .map((document) => mapDocument(document, db.getPagesByDocument(document.id))),
    jobs: db.listJobsBySubject(subjectId, 'document-import').map(mapJob),
    analysisJobs: db
      .listJobsBySubject(subjectId, 'subject-ingestion')
      .map(mapAnalysisJob),
    analysis: (() => {
      const persisted = getPersistedSubjectAnalysisSummary(db, subjectId);
      return persisted.divisions.length > 0 || persisted.unassignedPages.length > 0
        ? persisted
        : null;
    })(),
    chatMessages: mapPersistedDivisionChatMessages(
      db.listChatMessagesBySubject(subjectId),
    ),
    practiceSets: mapPersistedPracticeSets(db.listPracticeSetsBySubject(subjectId)),
    flashcardDecks: mapPersistedFlashcardDecks(
      db.listFlashcardDecksBySubject(subjectId),
      db,
    ),
  };
};

const getDocumentAbsolutePath = (documentId: string): string => {
  const db = getDatabaseOrThrow();
  const paths = getPathsOrThrow();
  const document = db.getDocumentById(documentId);

  if (!document) {
    throw new Error('Document not found');
  }

  if (!document.relativePath || document.importStatus !== 'ready') {
    throw new Error('Document file is unavailable for viewing');
  }

  return path.join(paths.dataDir, document.relativePath);
};

const getConfiguredSecret = (
  settingName: string,
  sessionValue: string | null,
): string | null => {
  if (sessionValue && sessionValue.trim().length > 0) {
    return sessionValue.trim();
  }

  const db = getDatabaseOrThrow();
  const raw = db.getSetting(settingName);

  if (!raw) {
    return null;
  }

  if (!raw.encrypted) {
    db.deleteSetting(settingName);
    return null;
  }

  if (!safeStorage.isEncryptionAvailable()) {
    return null;
  }

  try {
    const decrypted = safeStorage
      .decryptString(Buffer.from(raw.value, 'base64'))
      .trim();

    return decrypted.length > 0 ? decrypted : null;
  } catch {
    return null;
  }
};

const upsertSecretSetting = (
  settingName: string,
  nextValue: string | undefined,
  setSessionValue: (value: string | null) => void,
) => {
  if (typeof nextValue === 'undefined') {
    return;
  }

  const db = getDatabaseOrThrow();
  const trimmedValue = nextValue.trim();

  if (trimmedValue.length === 0) {
    setSessionValue(null);
    db.deleteSetting(settingName);
    return;
  }

  if (!safeStorage.isEncryptionAvailable()) {
    setSessionValue(trimmedValue);
    db.deleteSetting(settingName);
    return;
  }

  setSessionValue(null);
  const encrypted = safeStorage.encryptString(trimmedValue).toString('base64');
  db.upsertSetting(settingName, encrypted, true);
};

const getSettingsState = (): SettingsState => {
  const db = getDatabaseOrThrow();
  const paths = getPathsOrThrow();
  const providerRaw = db.getSetting(AI_PROVIDER_SETTING)?.value;
  const aiProvider: AiProvider =
    providerRaw === 'ollama' ? 'ollama' : 'openai';
  const ollamaBaseUrl =
    db.getSetting(OLLAMA_BASE_URL_SETTING)?.value.trim() ||
    DEFAULT_OLLAMA_BASE_URL;
  const ollamaModel =
    db.getSetting(OLLAMA_MODEL_SETTING)?.value.trim() ||
    DEFAULT_OLLAMA_INGESTION_MODEL;
  const researchSafetyMode =
    db.getSetting(RESEARCH_SAFETY_MODE_SETTING)?.value === 'education'
      ? 'education'
      : 'balanced';
  const encryptionAvailable = safeStorage.isEncryptionAvailable();

  return {
    aiProvider,
    openAiApiKeyConfigured: Boolean(
      getConfiguredSecret(OPENAI_KEY_SETTING, sessionOpenAiApiKey),
    ),
    encryptionAvailable,
    ollamaBaseUrl,
    ollamaModel,
    braveSearchApiKeyConfigured: Boolean(
      getConfiguredSecret(BRAVE_SEARCH_API_KEY_SETTING, sessionBraveSearchApiKey),
    ),
    youTubeApiKeyConfigured: Boolean(
      getConfiguredSecret(YOUTUBE_API_KEY_SETTING, sessionYouTubeApiKey),
    ),
    researchSafetyMode,
    dataPath: paths.dataDir,
    defaultDataPath: paths.defaultDataDir,
    usingCustomDataPath: paths.dataDir !== paths.defaultDataDir,
  };
};

const storeOpenAiKey = (input: SaveSettingsInput): SettingsState => {
  const db = getDatabaseOrThrow();
  const parsed = saveSettingsSchema.parse(input);

  upsertSecretSetting(OPENAI_KEY_SETTING, parsed.openAiApiKey, (value) => {
    sessionOpenAiApiKey = value;
  });

  upsertSecretSetting(BRAVE_SEARCH_API_KEY_SETTING, parsed.braveSearchApiKey, (value) => {
    sessionBraveSearchApiKey = value;
  });

  upsertSecretSetting(YOUTUBE_API_KEY_SETTING, parsed.youTubeApiKey, (value) => {
    sessionYouTubeApiKey = value;
  });

  if (typeof parsed.aiProvider !== 'undefined') {
    db.upsertSetting(AI_PROVIDER_SETTING, parsed.aiProvider, false);
  }

  if (typeof parsed.ollamaBaseUrl !== 'undefined') {
    const normalizedBaseUrl =
      parsed.ollamaBaseUrl.trim().replace(/\/+$/, '') || DEFAULT_OLLAMA_BASE_URL;
    db.upsertSetting(OLLAMA_BASE_URL_SETTING, normalizedBaseUrl, false);
  }

  if (typeof parsed.ollamaModel !== 'undefined') {
    const normalizedModel = parsed.ollamaModel.trim() || DEFAULT_OLLAMA_INGESTION_MODEL;
    db.upsertSetting(OLLAMA_MODEL_SETTING, normalizedModel, false);
  }

  if (typeof parsed.researchSafetyMode !== 'undefined') {
    db.upsertSetting(RESEARCH_SAFETY_MODE_SETTING, parsed.researchSafetyMode, false);
  }

  return getSettingsState();
};

const getStoredOpenAiKeyOrThrow = (): string => {
  const configured = getConfiguredSecret(OPENAI_KEY_SETTING, sessionOpenAiApiKey);

  if (!configured) {
    throw new Error('Configure an OpenAI API key in Settings before analyzing a subject.');
  }

  return configured;
};

const getAiProviderConfigOrThrow = (): {
  provider: 'openai';
  apiKey: string;
  model: string;
} | {
  provider: 'ollama';
  baseUrl: string;
  model: string;
} => {
  const settings = getSettingsState();

  if (settings.aiProvider === 'ollama') {
    return {
      provider: 'ollama',
      baseUrl: settings.ollamaBaseUrl || DEFAULT_OLLAMA_BASE_URL,
      model: settings.ollamaModel || DEFAULT_OLLAMA_INGESTION_MODEL,
    };
  }

  return {
    provider: 'openai',
    apiKey: getStoredOpenAiKeyOrThrow(),
    model: DEFAULT_OPENAI_INGESTION_MODEL,
  };
};

const getResearchProviderConfig = () => {
  const settings = getSettingsState();

  return {
    braveApiKey: getConfiguredSecret(
      BRAVE_SEARCH_API_KEY_SETTING,
      sessionBraveSearchApiKey,
    ),
    youTubeApiKey: getConfiguredSecret(
      YOUTUBE_API_KEY_SETTING,
      sessionYouTubeApiKey,
    ),
    safetyMode: settings.researchSafetyMode,
  };
};

const ensureTargetDataDirectoryHasContent = (
  currentDataDir: string,
  targetDataDir: string,
): void => {
  if (currentDataDir === targetDataDir) {
    return;
  }

  const targetExists = fs.existsSync(targetDataDir);
  const targetHasEntries =
    targetExists &&
    fs.existsSync(targetDataDir) &&
    fs.readdirSync(targetDataDir).length > 0;

  if (targetHasEntries || !fs.existsSync(currentDataDir)) {
    fs.mkdirSync(targetDataDir, { recursive: true });
    return;
  }

  fs.mkdirSync(targetDataDir, { recursive: true });
  fs.cpSync(currentDataDir, targetDataDir, {
    recursive: true,
    force: false,
    errorOnExist: false,
  });
};

const reopenDatabaseAtDataPath = (nextDataDir: string): SettingsState => {
  const currentDataDir = appPaths?.dataDir ?? getDefaultDataDir();
  ensureTargetDataDirectoryHasContent(currentDataDir, nextDataDir);

  database?.close();
  const nextPaths = buildAppPaths(nextDataDir);
  appPaths = nextPaths;
  database = new DatabaseService(nextPaths.dbPath);
  database.reconcileInterruptedImportJobs();
  initializationPromise = Promise.resolve();

  return getSettingsState();
};

const chooseDataPath = async (): Promise<SettingsState | null> => {
  await ensureInitialized();

  const selection = await dialog.showOpenDialog({
    title: 'Choose StudyBud data folder',
    properties: ['openDirectory', 'createDirectory'],
  });

  const nextPath = selection.filePaths[0];
  if (selection.canceled || typeof nextPath !== 'string' || nextPath.trim().length === 0) {
    return null;
  }

  writeBootstrapConfig({
    customDataPath: nextPath,
  });

  return reopenDatabaseAtDataPath(nextPath);
};

const resetDataPath = async (): Promise<SettingsState> => {
  await ensureInitialized();
  const defaultDataDir = getDefaultDataDir();
  writeBootstrapConfig({});
  return reopenDatabaseAtDataPath(defaultDataDir);
};

const registerContentSecurityPolicy = (): void => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: applyContentSecurityPolicy(
        app.isPackaged,
        details.responseHeaders,
      ),
    });
  });
};

const registerIpcHandlers = (): void => {
  for (const channel of Object.values(IPC_CHANNELS)) {
    ipcMain.removeHandler(channel);
  }

  ipcMain.handle(IPC_CHANNELS.APP_INFO, async (): Promise<AppInfo> => {
    await ensureInitialized();
    const paths = getPathsOrThrow();
    const ocrRuntime = await detectOcrRuntime({ forceRefresh: true });
    return {
      version: app.getVersion(),
      userDataPath: app.getPath('userData'),
      dataPath: paths.dataDir,
      encryptionAvailable: safeStorage.isEncryptionAvailable(),
      platform: process.platform,
      nodeVersion: process.versions.node,
      electronVersion: process.versions.electron,
      runningInWsl: isRunningInWsl(),
      nativeDatabaseReady: Boolean(database),
      ocrRuntimeAvailable: ocrRuntime.available,
      ocrEngine: ocrRuntime.engine,
      ocrRuntimeMessage: ocrRuntime.message,
      ocrRuntimeMode: ocrRuntime.mode,
      ocrRuntimePath: ocrRuntime.runtimePath,
    };
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async (): Promise<SettingsState> => {
    await ensureInitialized();
    return getSettingsState();
  });

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_SAVE,
    async (_event, input: SaveSettingsInput): Promise<SettingsState> => {
      await ensureInitialized();
      return storeOpenAiKey(input);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_CHOOSE_DATA_PATH,
    async (): Promise<SettingsState | null> => {
      return chooseDataPath();
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_RESET_DATA_PATH,
    async (): Promise<SettingsState> => {
      return resetDataPath();
    },
  );

  ipcMain.handle(IPC_CHANNELS.SUBJECTS_LIST, async (): Promise<SubjectSummary[]> => {
    await ensureInitialized();
    return getDatabaseOrThrow().listSubjects().map(mapSubject);
  });

  ipcMain.handle(
    IPC_CHANNELS.SUBJECTS_CREATE,
    async (_event, input: CreateSubjectInput): Promise<SubjectSummary> => {
      await ensureInitialized();
      const parsed = createSubjectSchema.parse(input);
      const db = getDatabaseOrThrow();
      const paths = getPathsOrThrow();
      const subjectId = randomUUID();
      const subjectDir = path.join(paths.subjectsDir, subjectId);

      fs.mkdirSync(subjectDir);

      try {
        const subject = db.createSubjectWithId(parsed.name, subjectId);
        return mapSubject(subject);
      } catch (error) {
        fs.rmSync(subjectDir, { recursive: true, force: true });
        throw error;
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.SUBJECTS_DELETE,
    async (_event, subjectId: string): Promise<void> => {
      await ensureInitialized();
      const db = getDatabaseOrThrow();
      const paths = getPathsOrThrow();
      const deletedSubject = db.deleteSubject(subjectId);

      if (!deletedSubject) {
        throw new Error('Subject not found');
      }

      const subjectDir = path.join(paths.subjectsDir, subjectId);
      await fs.promises.rm(subjectDir, {
        recursive: true,
        force: true,
      }).catch(() => undefined);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.SUBJECTS_WORKSPACE,
    async (_event, subjectId: string): Promise<SubjectWorkspace> => {
      await ensureInitialized();
      return getSubjectWorkspace(subjectId);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.SUBJECTS_IMPORT,
    async (
      _event,
      input: ImportDocumentsInput,
    ): Promise<ImportDocumentsResult> => {
      await ensureInitialized();
      const parsed = importDocumentsSchema.parse(input);
      const subject = getDatabaseOrThrow().getSubjectById(parsed.subjectId);

      if (!subject) {
        throw new Error('Subject not found');
      }

      const selection = await dialog.showOpenDialog({
        title:
          parsed.kind === 'lecture'
            ? 'Import lecture PDFs'
            : 'Import homework PDFs',
        properties: ['openFile', 'multiSelections'],
        filters: [
          {
            name: 'PDF documents',
            extensions: ['pdf'],
          },
        ],
      });

      const selectedFilePaths = normalizeDialogFilePaths(selection.filePaths);

      if (selection.canceled || selectedFilePaths.length === 0) {
        return {
          canceled: true,
          job: null,
          importedDocuments: [],
          failures: [],
        };
      }

      const paths = getPathsOrThrow();
      const result = await runImportInUtilityProcess(
        {
          dbPath: paths.dbPath,
          dataDir: paths.dataDir,
          subjectsDir: paths.subjectsDir,
          subjectId: parsed.subjectId,
          kind: parsed.kind,
          filePaths: selectedFilePaths,
        },
      );
      const db = getDatabaseOrThrow();

      return {
        canceled: false,
        job: mapJob(result.job),
        importedDocuments: result.importedDocuments.map((document) =>
          mapDocument(
            document,
            document.importStatus === 'ready'
              ? db.getPagesByDocument(document.id)
              : [],
          ),
        ),
        failures: result.failures,
      };
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.SUBJECTS_ANALYZE,
    async (_event, input: AnalyzeSubjectInput): Promise<AnalyzeSubjectResult> => {
      await ensureInitialized();
      const parsed = analyzeSubjectSchema.parse(input);
      const subject = getDatabaseOrThrow().getSubjectById(parsed.subjectId);

      if (!subject) {
        throw new Error('Subject not found');
      }

      const result = await analyzeSubjectMaterials({
        providerConfig: getAiProviderConfigOrThrow(),
        subjectId: parsed.subjectId,
        database: getDatabaseOrThrow(),
      });

      return {
        job: mapAnalysisJob(result.job),
        analysis: result.analysis,
      };
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.CHAT_ASK,
    async (_event, input: ChatAskInput): Promise<ChatAskResult> => {
      await ensureInitialized();
      const parsed = chatAskSchema.parse(input);
      const subject = getDatabaseOrThrow().getSubjectById(parsed.subjectId);

      if (!subject) {
        throw new Error('Subject not found');
      }

      if (
        parsed.selectionContext &&
        (parsed.selectionContext.subjectId !== parsed.subjectId ||
          parsed.selectionContext.divisionId !== parsed.divisionId)
      ) {
        throw new Error('Selection context does not match the active subject/division.');
      }

      const result = await answerDivisionChat({
        providerConfig: getAiProviderConfigOrThrow(),
        subjectId: parsed.subjectId,
        divisionId: parsed.divisionId,
        prompt: parsed.prompt,
        selectionContext: (parsed.selectionContext ?? null) as SelectionContext | null,
        database: getDatabaseOrThrow(),
      });

      return {
        userMessage: result.userMessage,
        assistantMessage: result.assistantMessage,
        answer: result.answer,
      };
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.PRACTICE_GENERATE,
    async (_event, input: GeneratePracticeInput): Promise<GeneratePracticeResult> => {
      await ensureInitialized();
      const parsed = generatePracticeSchema.parse(input);
      const db = getDatabaseOrThrow();
      const subject = db.getSubjectById(parsed.subjectId);

      if (!subject) {
        throw new Error('Subject not found');
      }

      const practiceSet = await generatePracticeSet({
        providerConfig: getAiProviderConfigOrThrow(),
        subjectId: parsed.subjectId,
        divisionId: parsed.divisionId,
        problemTypeId: parsed.problemTypeId,
        difficulty: parsed.difficulty,
        count: parsed.count,
        database: db,
      });

      return {
        practiceSet,
      };
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.PRACTICE_REVEAL,
    async (
      _event,
      input: RevealPracticeAnswerInput,
    ): Promise<RevealPracticeAnswerResult> => {
      await ensureInitialized();
      const parsed = revealPracticeAnswerSchema.parse(input);
      const db = getDatabaseOrThrow();
      const question = db.togglePracticeQuestionReveal(parsed.questionId);

      if (!question) {
        throw new Error('Practice question not found');
      }

      const practiceSetRecord = db.getPracticeSetByQuestionId(parsed.questionId);

      if (!practiceSetRecord) {
        throw new Error('Practice set not found for the requested question');
      }

      return {
        practiceSetId: practiceSetRecord.practiceSet.id,
        question: {
          id: question.id,
          questionIndex: question.questionIndex,
          prompt: question.prompt,
          answer: question.answer,
          revealed: question.revealed,
          createdAt: formatTimestamp(question.createdAt),
          updatedAt: formatTimestamp(question.updatedAt),
        },
      };
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.PRACTICE_DELETE,
    async (_event, input: DeletePracticeSetInput): Promise<void> => {
      await ensureInitialized();
      const parsed = deletePracticeSetSchema.parse(input);
      const deleted = getDatabaseOrThrow().deletePracticeSet(parsed.practiceSetId);

      if (!deleted) {
        throw new Error('Practice set not found');
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.FLASHCARDS_GENERATE,
    async (
      _event,
      input: GenerateFlashcardsInput,
    ): Promise<GenerateFlashcardsResult> => {
      await ensureInitialized();
      const parsed = generateFlashcardsSchema.parse(input);
      const db = getDatabaseOrThrow();
      const subject = db.getSubjectById(parsed.subjectId);

      if (!subject) {
        throw new Error('Subject not found');
      }

      const validDivisionIds = new Set(
        db.getSubjectAnalysis(parsed.subjectId).divisions.map(
          (division) => division.division.id,
        ),
      );

      if (!parsed.divisionIds.every((divisionId) => validDivisionIds.has(divisionId))) {
        throw new Error('One or more selected units do not belong to this subject.');
      }

      const flashcardDeck = await generateFlashcardDeck({
        providerConfig: getAiProviderConfigOrThrow(),
        subjectId: parsed.subjectId,
        divisionIds: parsed.divisionIds,
        count: parsed.count,
        title: parsed.title,
        database: db,
      });

      return {
        flashcardDeck,
      };
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.FLASHCARDS_CREATE,
    async (
      _event,
      input: CreateFlashcardDeckInput,
    ): Promise<CreateFlashcardDeckResult> => {
      await ensureInitialized();
      const parsed = createFlashcardDeckSchema.parse(input);
      const db = getDatabaseOrThrow();
      const subject = db.getSubjectById(parsed.subjectId);

      if (!subject) {
        throw new Error('Subject not found');
      }

      const validDivisionIds = new Set(
        db.getSubjectAnalysis(parsed.subjectId).divisions.map(
          (division) => division.division.id,
        ),
      );

      if (!parsed.divisionIds.every((divisionId) => validDivisionIds.has(divisionId))) {
        throw new Error('One or more selected units do not belong to this subject.');
      }

      const flashcardDeck = createManualFlashcardDeck({
        subjectId: parsed.subjectId,
        title: parsed.title,
        divisionIds: parsed.divisionIds,
        cards: parsed.cards,
        database: db,
      });

      return {
        flashcardDeck,
      };
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.FLASHCARDS_DELETE,
    async (_event, input: DeleteFlashcardDeckInput): Promise<void> => {
      await ensureInitialized();
      const parsed = deleteFlashcardDeckSchema.parse(input);
      const deleted = getDatabaseOrThrow().deleteFlashcardDeck(parsed.flashcardDeckId);

      if (!deleted) {
        throw new Error('Flashcard deck not found');
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.RESEARCH_SEARCH,
    async (_event, input: ResearchSearchInput): Promise<ResearchSearchResult> => {
      await ensureInitialized();
      const parsed = researchSearchSchema.parse(input);
      return searchResearch(
        {
          query: parsed.query,
          videoQuery: parsed.videoQuery ?? null,
        },
        getResearchProviderConfig(),
      );
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.RESEARCH_NAVIGATE,
    async (
      _event,
      input: ResearchBrowserNavigationInput,
    ): Promise<ResearchBrowserState> => {
      await ensureInitialized();
      const parsed = researchBrowserNavigationSchema.parse(input);
      return getResearchBrowserOrThrow().navigate(parsed);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.RESEARCH_BACK,
    async (): Promise<ResearchBrowserState> => {
      await ensureInitialized();
      return getResearchBrowserOrThrow().goBack();
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.RESEARCH_FORWARD,
    async (): Promise<ResearchBrowserState> => {
      await ensureInitialized();
      return getResearchBrowserOrThrow().goForward();
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.RESEARCH_RELOAD,
    async (): Promise<ResearchBrowserState> => {
      await ensureInitialized();
      return getResearchBrowserOrThrow().reload();
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.RESEARCH_SET_BOUNDS,
    async (
      _event,
      input: ResearchBrowserBoundsInput,
    ): Promise<ResearchBrowserState> => {
      await ensureInitialized();
      const parsed = researchBrowserBoundsSchema.parse(input);
      return getResearchBrowserOrThrow().setBounds(parsed);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.RESEARCH_HIDE_BROWSER,
    async (): Promise<ResearchBrowserState> => {
      await ensureInitialized();
      return getResearchBrowserOrThrow().hide();
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.RESEARCH_OPEN_EXTERNAL,
    async (_event, input: ResearchExternalLinkInput): Promise<void> => {
      await ensureInitialized();
      const parsed = researchExternalLinkSchema.parse(input);
      await openExternalUrl(parsed.url);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.DOCUMENTS_DELETE,
    async (_event, documentId: string): Promise<void> => {
      await ensureInitialized();
      const db = getDatabaseOrThrow();
      const paths = getPathsOrThrow();
      const deletedDocument = db.deleteDocument(documentId);

      if (!deletedDocument) {
        throw new Error('Document not found');
      }

      if (deletedDocument.relativePath) {
        const absolutePath = path.join(paths.dataDir, deletedDocument.relativePath);
        await fs.promises.rm(absolutePath, { force: true }).catch(() => undefined);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.DOCUMENTS_DETAIL,
    async (_event, documentId: string): Promise<SourceDocumentDetail> => {
      await ensureInitialized();
      const db = getDatabaseOrThrow();
      const document = db.getDocumentById(documentId);
      const pages = db.getPagesByDocument(documentId);

      if (!document) {
        throw new Error('Document not found');
      }

      return {
        ...mapDocument(document, pages),
        pages: pages.map(mapPage),
      };
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.DOCUMENTS_DATA,
    async (_event, documentId: string): Promise<Uint8Array> => {
      await ensureInitialized();
      const absolutePath = getDocumentAbsolutePath(documentId);
      const bytes = await fs.promises.readFile(absolutePath);
      return new Uint8Array(bytes);
    },
  );
};

const createWindow = () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.show();
    mainWindow.focus();
    return mainWindow;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const workArea = primaryDisplay.workArea;
  const width = Math.min(1360, Math.max(960, workArea.width - 80));
  const height = Math.min(900, Math.max(720, workArea.height - 80));
  const x = Math.round(workArea.x + (workArea.width - width) / 2);
  const y = Math.round(workArea.y + (workArea.height - height) / 2);

  const isMac = process.platform === 'darwin';

  mainWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    minWidth: 960,
    minHeight: 720,
    title: 'StudyBud',
    backgroundColor: '#0d1320',
    show: false,
    ...(isMac
      ? {
          titleBarStyle: 'hiddenInset' as const,
          trafficLightPosition: { x: 16, y: 16 },
        }
      : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  const showAndFocusWindow = () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    mainWindow.show();
    mainWindow.focus();
  };

  mainWindow.once('ready-to-show', () => {
    showAndFocusWindow();
  });

  mainWindow.webContents.once('did-finish-load', () => {
    showAndFocusWindow();
  });

  setTimeout(() => {
    showAndFocusWindow();
  }, 2500);

  mainWindow.webContents.on(
    'render-process-gone',
    (_event, details) => {
      console.error('Renderer process exited unexpectedly.', details);
    },
  );

  mainWindow.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame) {
        return;
      }

      console.error('Main window failed to load.', {
        errorCode,
        errorDescription,
        validatedURL,
      });
    },
  );

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void openExternalUrl(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    researchBrowser?.hide();
    mainWindow = null;
  });

  return mainWindow;
};

app.on('second-instance', () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.focus();
});

registerIpcHandlers();

app
  .whenReady()
  .then(async () => {
    await ensureInitialized();
    installApplicationMenu();
    researchBrowser = new ResearchBrowserController({
      windowProvider: () => mainWindow,
      emitState: (state) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(IPC_CHANNELS.RESEARCH_BROWSER_STATE, state);
        }
      },
    });
    createWindow();
  })
  .catch((error) => {
    console.error('StudyBud failed to initialize.', error);
  });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  if (database) {
    database.close();
  }
});
