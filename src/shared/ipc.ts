export const IPC_CHANNELS = {
  APP_INFO: 'app:get-info',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SAVE: 'settings:save',
  SUBJECTS_LIST: 'subjects:list',
  SUBJECTS_CREATE: 'subjects:create',
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

export interface StudyBudApi {
  getAppInfo: () => Promise<AppInfo>;
  getSettings: () => Promise<SettingsState>;
  saveSettings: (input: SaveSettingsInput) => Promise<SettingsState>;
  listSubjects: () => Promise<SubjectSummary[]>;
  createSubject: (input: CreateSubjectInput) => Promise<SubjectSummary>;
}
