import { contextBridge, ipcRenderer } from 'electron';

import {
  type ChatAskInput,
  type AnalyzeSubjectInput,
  type DeletePracticeSetInput,
  type GeneratePracticeInput,
  IPC_CHANNELS,
  type CreateSubjectInput,
  type ImportDocumentsInput,
  type ResearchBrowserBoundsInput,
  type ResearchBrowserNavigationInput,
  type ResearchBrowserState,
  type ResearchSearchInput,
  type RevealPracticeAnswerInput,
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
  deleteSubject: (subjectId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SUBJECTS_DELETE, subjectId),
  getSubjectWorkspace: (subjectId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SUBJECTS_WORKSPACE, subjectId),
  importDocuments: (input: ImportDocumentsInput) =>
    ipcRenderer.invoke(IPC_CHANNELS.SUBJECTS_IMPORT, input),
  analyzeSubject: (input: AnalyzeSubjectInput) =>
    ipcRenderer.invoke(IPC_CHANNELS.SUBJECTS_ANALYZE, input),
  askChat: (input: ChatAskInput) =>
    ipcRenderer.invoke(IPC_CHANNELS.CHAT_ASK, input),
  generatePractice: (input: GeneratePracticeInput) =>
    ipcRenderer.invoke(IPC_CHANNELS.PRACTICE_GENERATE, input),
  revealPracticeAnswer: (input: RevealPracticeAnswerInput) =>
    ipcRenderer.invoke(IPC_CHANNELS.PRACTICE_REVEAL, input),
  deletePracticeSet: (input: DeletePracticeSetInput) =>
    ipcRenderer.invoke(IPC_CHANNELS.PRACTICE_DELETE, input),
  searchResearch: (input: ResearchSearchInput) =>
    ipcRenderer.invoke(IPC_CHANNELS.RESEARCH_SEARCH, input),
  navigateResearchBrowser: (input: ResearchBrowserNavigationInput) =>
    ipcRenderer.invoke(IPC_CHANNELS.RESEARCH_NAVIGATE, input),
  goBackResearchBrowser: () => ipcRenderer.invoke(IPC_CHANNELS.RESEARCH_BACK),
  goForwardResearchBrowser: () =>
    ipcRenderer.invoke(IPC_CHANNELS.RESEARCH_FORWARD),
  reloadResearchBrowser: () => ipcRenderer.invoke(IPC_CHANNELS.RESEARCH_RELOAD),
  setResearchBrowserBounds: (input: ResearchBrowserBoundsInput) =>
    ipcRenderer.invoke(IPC_CHANNELS.RESEARCH_SET_BOUNDS, input),
  hideResearchBrowser: () =>
    ipcRenderer.invoke(IPC_CHANNELS.RESEARCH_HIDE_BROWSER),
  onResearchBrowserState: (
    listener: (state: ResearchBrowserState) => void,
  ) => {
    const wrapped = (_event: Electron.IpcRendererEvent, state: ResearchBrowserState) => {
      listener(state);
    };

    ipcRenderer.on(IPC_CHANNELS.RESEARCH_BROWSER_STATE, wrapped);

    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.RESEARCH_BROWSER_STATE, wrapped);
    };
  },
  deleteDocument: (documentId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.DOCUMENTS_DELETE, documentId),
  getDocumentDetail: (documentId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.DOCUMENTS_DETAIL, documentId),
  readDocumentData: (documentId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.DOCUMENTS_DATA, documentId),
};

contextBridge.exposeInMainWorld('studybud', api);
