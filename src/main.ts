import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  safeStorage,
  session,
  shell,
} from 'electron';
import started from 'electron-squirrel-startup';
import { z } from 'zod';

import {
  analyzeSubjectMaterials,
  getPersistedSubjectAnalysisSummary,
} from './main/analysis/subject-analysis';
import {
  type DocumentPageRow,
  type JobRow,
  DatabaseService,
  type SourceDocumentRow,
  type SubjectRow,
} from './main/db/database';
import { runImportInUtilityProcess } from './main/documents/import-process';
import { applyContentSecurityPolicy } from './main/security/csp';
import {
  type AnalyzeSubjectInput,
  type AnalyzeSubjectResult,
  IPC_CHANNELS,
  type AppInfo,
  type CreateSubjectInput,
  type DocumentKind,
  type DocumentPageSummary,
  type ImportDocumentsInput,
  type ImportDocumentsResult,
  type ImportJobSummary,
  type SubjectAnalysisJobSummary,
  type SaveSettingsInput,
  type SettingsState,
  type SourceDocumentDetail,
  type SourceDocumentSummary,
  type SubjectSummary,
  type SubjectWorkspace,
} from './shared/ipc';

if (started) {
  app.quit();
}

// This app is mostly standard DOM and canvas rendering, so disabling GPU
// acceleration is a good tradeoff to avoid black-window issues on flaky drivers.
app.disableHardwareAcceleration();

const OPENAI_KEY_SETTING = 'openai_api_key';

type AppPaths = {
  dataDir: string;
  dbPath: string;
  subjectsDir: string;
};

const saveSettingsSchema = z.object({
  openAiApiKey: z.string().max(500).optional(),
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

let appPaths: AppPaths | null = null;
let database: DatabaseService | null = null;
let mainWindow: BrowserWindow | null = null;
let ipcHandlersRegistered = false;
let contentSecurityPolicyRegistered = false;
let initializationPromise: Promise<void> | null = null;

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
}

const formatTimestamp = (value: number): string => {
  return new Date(value).toISOString();
};

const normalizeDialogFilePaths = (filePaths: unknown[]): string[] => {
  return filePaths.filter((filePath): filePath is string => {
    return typeof filePath === 'string' && filePath.trim().length > 0;
  });
};

const ensureAppPaths = (): AppPaths => {
  const userData = app.getPath('userData');
  const dataDir = path.join(userData, 'data');
  const subjectsDir = path.join(dataDir, 'subjects');
  const dbPath = path.join(dataDir, 'studybud.db');

  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(subjectsDir, { recursive: true });

  appPaths = {
    dataDir,
    dbPath,
    subjectsDir,
  };

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

const mapDocument = (document: SourceDocumentRow): SourceDocumentSummary => {
  return {
    id: document.id,
    subjectId: document.subjectId,
    kind: document.kind as DocumentKind,
    originalFileName: document.originalFileName,
    storedFileName: document.storedFileName,
    relativePath: document.relativePath,
    mimeType: document.mimeType,
    pageCount: document.pageCount,
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
    previewText:
      page.textContent.length > 180
        ? `${page.textContent.slice(0, 180).trim()}...`
        : page.textContent,
  };
};

const mapJob = (job: JobRow): ImportJobSummary => {
  const payload = JSON.parse(job.payload) as {
    kind?: DocumentKind;
    selectedFiles?: string[];
    importedDocumentIds?: string[];
    failures?: Array<{ fileName: string; reason: string }>;
  };

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
    createdAt: formatTimestamp(job.createdAt),
    updatedAt: formatTimestamp(job.updatedAt),
  };
};

const mapAnalysisJob = (job: JobRow): SubjectAnalysisJobSummary => {
  const payload = JSON.parse(job.payload) as {
    divisionCount?: number;
    problemTypeCount?: number;
    unassignedPageCount?: number;
  };

  if (!job.subjectId) {
    throw new Error(`Job ${job.id} is missing subject context`);
  }

  return {
    id: job.id,
    subjectId: job.subjectId,
    type: 'subject-ingestion',
    status: job.status as SubjectAnalysisJobSummary['status'],
    message: job.message,
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
    documents: db.listDocumentsBySubject(subjectId).map(mapDocument),
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

const getSettingsState = (): SettingsState => {
  const db = getDatabaseOrThrow();
  const raw = db.getSetting(OPENAI_KEY_SETTING);
  const encryptionAvailable = safeStorage.isEncryptionAvailable();

  if (!raw) {
    return {
      openAiApiKeyConfigured: false,
      encryptionAvailable,
    };
  }

  if (!raw.encrypted) {
    db.deleteSetting(OPENAI_KEY_SETTING);
    return {
      openAiApiKeyConfigured: false,
      encryptionAvailable,
    };
  }

  try {
    const encryptedBuffer = Buffer.from(raw.value, 'base64');
    const decrypted = safeStorage.decryptString(encryptedBuffer);
    return {
      openAiApiKeyConfigured: decrypted.trim().length > 0,
      encryptionAvailable,
    };
  } catch {
    return {
      openAiApiKeyConfigured: false,
      encryptionAvailable,
    };
  }
};

const storeOpenAiKey = (input: SaveSettingsInput): SettingsState => {
  const db = getDatabaseOrThrow();
  const parsed = saveSettingsSchema.parse(input);

  if (typeof parsed.openAiApiKey !== 'undefined') {
    const trimmedKey = parsed.openAiApiKey.trim();
    const encryptionAvailable = safeStorage.isEncryptionAvailable();

    if (trimmedKey.length === 0) {
      db.deleteSetting(OPENAI_KEY_SETTING);
    } else {
      if (!encryptionAvailable) {
        throw new Error(
          'Secure OS key storage is unavailable, so StudyBud cannot save the API key on this device yet.',
        );
      }

      const encrypted = safeStorage.encryptString(trimmedKey).toString('base64');
      db.upsertSetting(OPENAI_KEY_SETTING, encrypted, true);
    }
  }

  return getSettingsState();
};

const getStoredOpenAiKeyOrThrow = (): string => {
  const db = getDatabaseOrThrow();
  const raw = db.getSetting(OPENAI_KEY_SETTING);

  if (!raw || !raw.encrypted) {
    throw new Error('Configure an OpenAI API key in Settings before analyzing a subject.');
  }

  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Secure storage is unavailable, so the API key cannot be loaded.');
  }

  try {
    return safeStorage.decryptString(Buffer.from(raw.value, 'base64')).trim();
  } catch {
    throw new Error('Stored OpenAI API key could not be decrypted.');
  }
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
  if (ipcHandlersRegistered) {
    return;
  }

  ipcHandlersRegistered = true;

  ipcMain.handle(IPC_CHANNELS.APP_INFO, async (): Promise<AppInfo> => {
    await ensureInitialized();
    const paths = getPathsOrThrow();
    return {
      version: app.getVersion(),
      userDataPath: app.getPath('userData'),
      dataPath: paths.dataDir,
      encryptionAvailable: safeStorage.isEncryptionAvailable(),
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

      return {
        canceled: false,
        job: mapJob(result.job),
        importedDocuments: result.importedDocuments.map(mapDocument),
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
        apiKey: getStoredOpenAiKeyOrThrow(),
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

      if (!document) {
        throw new Error('Document not found');
      }

      return {
        ...mapDocument(document),
        pages: db.getPagesByDocument(documentId).map(mapPage),
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

    mainWindow.focus();
    return mainWindow;
  }

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1120,
    minHeight: 720,
    title: 'StudyBud',
    backgroundColor: '#0d1320',
    show: false,
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

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

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
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
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
