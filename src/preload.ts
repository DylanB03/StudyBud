import { contextBridge, ipcRenderer } from 'electron';

import {
  type AnalyzeSubjectInput,
  IPC_CHANNELS,
  type CreateSubjectInput,
  type ImportDocumentsInput,
  type SaveSettingsInput,
  type StudyBudApi,
} from './shared/ipc';

const api: StudyBudApi = {
  getAppInfo: () => ipcRenderer.invoke(IPC_CHANNELS.APP_INFO),
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
  saveSettings: (input: SaveSettingsInput) =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SAVE, input),
  chooseDataPath: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_CHOOSE_DATA_PATH),
  resetDataPath: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_RESET_DATA_PATH),
  listSubjects: () => ipcRenderer.invoke(IPC_CHANNELS.SUBJECTS_LIST),
  createSubject: (input: CreateSubjectInput) =>
    ipcRenderer.invoke(IPC_CHANNELS.SUBJECTS_CREATE, input),
  getSubjectWorkspace: (subjectId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SUBJECTS_WORKSPACE, subjectId),
  importDocuments: (input: ImportDocumentsInput) =>
    ipcRenderer.invoke(IPC_CHANNELS.SUBJECTS_IMPORT, input),
  analyzeSubject: (input: AnalyzeSubjectInput) =>
    ipcRenderer.invoke(IPC_CHANNELS.SUBJECTS_ANALYZE, input),
  deleteDocument: (documentId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.DOCUMENTS_DELETE, documentId),
  getDocumentDetail: (documentId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.DOCUMENTS_DETAIL, documentId),
  readDocumentData: (documentId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.DOCUMENTS_DATA, documentId),
};

contextBridge.exposeInMainWorld('studybud', api);
