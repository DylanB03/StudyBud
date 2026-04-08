import type { MessageEvent } from 'electron';
import { describe, expect, it } from 'vitest';

import { extractImportWorkerRequest } from './import-worker';

describe('extractImportWorkerRequest', () => {
  it('unwraps the payload from the Electron message event', () => {
    const request = {
      dataDir: '/tmp/data',
      dbPath: '/tmp/data/studybud.db',
      subjectId: 'subject-1',
      kind: 'lecture' as const,
      filePaths: ['/tmp/lecture-1.pdf'],
      subjectsDir: '/tmp/data/subjects',
    };

    const messageEvent = {
      data: request,
    } as MessageEvent;

    expect(extractImportWorkerRequest(messageEvent)).toEqual(request);
  });
});
