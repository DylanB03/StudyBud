import type { StudyBudApi } from './ipc';

declare global {
  interface Window {
    studybud?: StudyBudApi;
  }
}

export {};
