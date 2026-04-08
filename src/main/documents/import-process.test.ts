import { describe, expect, it } from 'vitest';

import { getImportWorkerCandidatePaths } from './import-process';

describe('getImportWorkerCandidatePaths', () => {
  it('omits undefined runtime paths instead of throwing', () => {
    const candidatePaths = getImportWorkerCandidatePaths({
      bundleDir: '/tmp/studybud/.vite/build',
      appPath: '/tmp/studybud',
      resourcesPath: null,
    });

    expect(candidatePaths).toEqual([
      '/tmp/studybud/.vite/build/import-worker.js',
      '/tmp/studybud/.vite/build/import-worker.js',
    ]);
  });

  it('includes resources-based fallbacks when available', () => {
    const candidatePaths = getImportWorkerCandidatePaths({
      bundleDir: null,
      appPath: '/opt/studybud',
      resourcesPath: '/opt/studybud/resources',
    });

    expect(candidatePaths).toEqual([
      '/opt/studybud/.vite/build/import-worker.js',
      '/opt/studybud/resources/app.asar/.vite/build/import-worker.js',
      '/opt/studybud/resources/.vite/build/import-worker.js',
    ]);
  });
});
