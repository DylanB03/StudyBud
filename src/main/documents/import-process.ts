import fs from 'node:fs';
import path from 'node:path';

import { app, utilityProcess } from 'electron';

import type { ImportDocumentsOutput } from './import';
import type {
  ImportWorkerMessage,
  ImportWorkerRequest,
} from './import-worker-shared';

const toImportWorkerPath = (basePath: string | null): string | null => {
  if (typeof basePath !== 'string' || basePath.length === 0) {
    return null;
  }

  return path.join(basePath, 'import-worker.js');
};

export const getImportWorkerCandidatePaths = (input: {
  bundleDir: string | null;
  appPath: string | null;
  resourcesPath: string | null;
}): string[] => {
  return [
    toImportWorkerPath(input.bundleDir),
    input.appPath
      ? path.join(input.appPath, '.vite', 'build', 'import-worker.js')
      : null,
    input.resourcesPath
      ? path.join(
          input.resourcesPath,
          'app.asar',
          '.vite',
          'build',
          'import-worker.js',
        )
      : null,
    input.resourcesPath
      ? path.join(input.resourcesPath, '.vite', 'build', 'import-worker.js')
      : null,
  ].filter((candidate): candidate is string => typeof candidate === 'string');
};

const resolveImportWorkerPath = (): string => {
  const bundleDir =
    typeof __dirname === 'string' && __dirname.length > 0 ? __dirname : null;
  const appPath = app.getAppPath();
  const resourcesPath =
    typeof process.resourcesPath === 'string' && process.resourcesPath.length > 0
      ? process.resourcesPath
      : null;
  const candidatePaths = getImportWorkerCandidatePaths({
    bundleDir,
    appPath,
    resourcesPath,
  });

  const workerPath = candidatePaths.find((candidate) => fs.existsSync(candidate));

  if (!workerPath) {
    throw new Error(
      `Could not locate the import worker bundle. Checked: ${candidatePaths.join(', ')}`,
    );
  }

  return workerPath;
};

export const runImportInUtilityProcess = (
  input: ImportWorkerRequest,
): Promise<ImportDocumentsOutput> => {
  return new Promise((resolve, reject) => {
    const workerPath = resolveImportWorkerPath();
    const utility = utilityProcess.fork(workerPath, [], {
      stdio: 'pipe',
    });

    let settled = false;
    let stderrOutput = '';

    utility.stderr?.on('data', (chunk: Buffer | string) => {
      stderrOutput += chunk.toString();
    });

    utility.once('message', (message: ImportWorkerMessage) => {
      settled = true;

      if (message.type === 'success') {
        resolve(message.result);
        return;
      }

      reject(new Error(message.message));
    });

    utility.once('error', (_type, location, report) => {
      if (settled) {
        return;
      }

      settled = true;
      reject(
        new Error(
          `Background import worker crashed${location ? ` at ${location}` : ''}.${
            report ? ' A diagnostic report was emitted.' : ''
          }`,
        ),
      );
    });

    utility.once('exit', (code) => {
      if (settled || code === 0) {
        return;
      }

      settled = true;
      const message = stderrOutput.trim();
      reject(
        new Error(
          message.length > 0
            ? `Background import worker exited with code ${code}: ${message}`
            : `Background import worker exited with code ${code}.`,
        ),
      );
    });

    utility.postMessage(input);
  });
};
