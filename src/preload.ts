import { contextBridge, ipcRenderer } from 'electron';

import {
  IPC_CHANNELS,
  type CreateSubjectInput,
  type SaveSettingsInput,
  type StudyBudApi,
} from './shared/ipc';

const api: StudyBudApi = {
  getAppInfo: () => ipcRenderer.invoke(IPC_CHANNELS.APP_INFO),
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
  saveSettings: (input: SaveSettingsInput) =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SAVE, input),
  listSubjects: () => ipcRenderer.invoke(IPC_CHANNELS.SUBJECTS_LIST),
  createSubject: (input: CreateSubjectInput) =>
    ipcRenderer.invoke(IPC_CHANNELS.SUBJECTS_CREATE, input),
};

contextBridge.exposeInMainWorld('studybud', api);
