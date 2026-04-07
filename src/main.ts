import fs from 'node:fs';
import path from 'node:path';

import { app, BrowserWindow, ipcMain, safeStorage, shell } from 'electron';
import started from 'electron-squirrel-startup';
import { z } from 'zod';

import { DatabaseService } from './main/db/database';
import {
  IPC_CHANNELS,
  type AppInfo,
  type CreateSubjectInput,
  type SaveSettingsInput,
  type SettingsState,
  type SubjectSummary,
} from './shared/ipc';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

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

let appPaths: AppPaths | null = null;
let database: DatabaseService | null = null;

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

const mapSubject = (subject: {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}): SubjectSummary => {
  return {
    id: subject.id,
    name: subject.name,
    createdAt: new Date(subject.createdAt).toISOString(),
    updatedAt: new Date(subject.updatedAt).toISOString(),
  };
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
    return {
      openAiApiKeyConfigured: raw.value.trim().length > 0,
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

    if (trimmedKey.length === 0) {
      db.deleteSetting(OPENAI_KEY_SETTING);
    } else {
      const encryptionAvailable = safeStorage.isEncryptionAvailable();

      if (encryptionAvailable) {
        const encrypted = safeStorage.encryptString(trimmedKey).toString('base64');
        db.upsertSetting(OPENAI_KEY_SETTING, encrypted, true);
      } else {
        db.upsertSetting(OPENAI_KEY_SETTING, trimmedKey, false);
      }
    }
  }

  return getSettingsState();
};

const registerIpcHandlers = (): void => {
  ipcMain.handle(IPC_CHANNELS.APP_INFO, (): AppInfo => {
    const paths = getPathsOrThrow();
    return {
      version: app.getVersion(),
      userDataPath: app.getPath('userData'),
      dataPath: paths.dataDir,
      encryptionAvailable: safeStorage.isEncryptionAvailable(),
    };
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, (): SettingsState => {
    return getSettingsState();
  });

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_SAVE,
    (_event, input: SaveSettingsInput): SettingsState => {
      return storeOpenAiKey(input);
    },
  );

  ipcMain.handle(IPC_CHANNELS.SUBJECTS_LIST, (): SubjectSummary[] => {
    const db = getDatabaseOrThrow();
    return db.listSubjects().map(mapSubject);
  });

  ipcMain.handle(
    IPC_CHANNELS.SUBJECTS_CREATE,
    (_event, input: CreateSubjectInput): SubjectSummary => {
      const parsed = createSubjectSchema.parse(input);
      const db = getDatabaseOrThrow();
      const paths = getPathsOrThrow();
      const subject = db.createSubject(parsed.name);
      fs.mkdirSync(path.join(paths.subjectsDir, subject.id), { recursive: true });
      return mapSubject(subject);
    },
  );
};

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1080,
    minHeight: 700,
    title: 'StudyBud',
    backgroundColor: '#0d1320',
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

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });
};

app.whenReady().then(() => {
  const paths = ensureAppPaths();
  database = new DatabaseService(paths.dbPath);
  registerIpcHandlers();
  createWindow();
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
