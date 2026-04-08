import type { MessagePort } from 'node:worker_threads';
import type { MessageEvent } from 'electron';

import { DatabaseService } from '../db/database';
import { importSubjectDocuments } from './import';
import type {
  ImportWorkerMessage,
  ImportWorkerRequest,
} from './import-worker-shared';

type UtilityProcessWithParentPort = NodeJS.Process & {
  parentPort?: MessagePort;
};

const parentPort = (process as UtilityProcessWithParentPort).parentPort;

const sendMessage = (message: ImportWorkerMessage): void => {
  if (!parentPort) {
    throw new Error('Import worker does not have a parent message port.');
  }

  parentPort.postMessage(message);
};

export const extractImportWorkerRequest = (
  messageEvent: MessageEvent | ImportWorkerRequest,
): ImportWorkerRequest => {
  if ('data' in messageEvent) {
    return messageEvent.data as ImportWorkerRequest;
  }

  return messageEvent;
};

const run = async (request: ImportWorkerRequest): Promise<void> => {
  const database = new DatabaseService(request.dbPath);

  try {
    const result = await importSubjectDocuments(
      {
        dataDir: request.dataDir,
        subjectsDir: request.subjectsDir,
        database,
      },
      {
        subjectId: request.subjectId,
        kind: request.kind,
        filePaths: request.filePaths,
      },
    );

    sendMessage({
      type: 'success',
      result,
    });
  } catch (error) {
    sendMessage({
      type: 'error',
      message:
        error instanceof Error ? error.message : 'Import worker failed unexpectedly.',
    });
  } finally {
    database.close();
  }
};

if (parentPort) {
  parentPort.on('message', (messageEvent: MessageEvent) => {
    const request = extractImportWorkerRequest(messageEvent);

    void run(request).finally(() => {
      process.exit(0);
    });
  });
}
