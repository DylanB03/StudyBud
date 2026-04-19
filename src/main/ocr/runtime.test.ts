import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  getBundledOcrExecutableCandidatePaths,
  resolveOcrRuntimeDescriptor,
} from './runtime';

describe('getBundledOcrExecutableCandidatePaths', () => {
  it('returns packaged and dev executable candidates for Windows', () => {
    const candidates = getBundledOcrExecutableCandidatePaths({
      cwd: '/repo',
      resourcesPath: '/packaged/resources',
      platform: 'win32',
      arch: 'x64',
    });

    expect(candidates).toEqual([
      path.join('/packaged/resources', 'ocr-runtime', 'windows-x64', 'ocr_runner.exe'),
      path.join('/repo', 'resources', 'ocr-runtime', 'windows-x64', 'ocr_runner.exe'),
    ]);
  });

  it('returns packaged and dev executable candidates for macOS arm64', () => {
    const candidates = getBundledOcrExecutableCandidatePaths({
      cwd: '/repo',
      resourcesPath: '/packaged/resources',
      platform: 'darwin',
      arch: 'arm64',
    });

    expect(candidates).toEqual([
      path.join('/packaged/resources', 'ocr-runtime', 'darwin-arm64', 'ocr_runner'),
      path.join('/repo', 'resources', 'ocr-runtime', 'darwin-arm64', 'ocr_runner'),
    ]);
  });

  it('returns packaged and dev executable candidates for macOS x64', () => {
    const candidates = getBundledOcrExecutableCandidatePaths({
      cwd: '/repo',
      resourcesPath: '/packaged/resources',
      platform: 'darwin',
      arch: 'x64',
    });

    expect(candidates).toEqual([
      path.join('/packaged/resources', 'ocr-runtime', 'darwin-x64', 'ocr_runner'),
      path.join('/repo', 'resources', 'ocr-runtime', 'darwin-x64', 'ocr_runner'),
    ]);
  });

  it('returns no candidates for unsupported platforms (Linux)', () => {
    const candidates = getBundledOcrExecutableCandidatePaths({
      cwd: '/repo',
      resourcesPath: '/packaged/resources',
      platform: 'linux',
      arch: 'x64',
    });

    expect(candidates).toEqual([]);
  });
});

describe('resolveOcrRuntimeDescriptor', () => {
  it('prefers a bundled runtime for packaged Windows builds', () => {
    const bundledPath = path.join(
      'C:\\app\\resources',
      'ocr-runtime',
      'windows-x64',
      'ocr_runner.exe',
    );

    const descriptor = resolveOcrRuntimeDescriptor({
      isPackaged: true,
      cwd: 'C:\\repo',
      resourcesPath: 'C:\\app\\resources',
      platform: 'win32',
      arch: 'x64',
      existsSync: (candidate) => candidate === bundledPath,
    });

    expect(descriptor).toEqual({
      mode: 'bundled',
      executablePath: bundledPath,
      runtimePath: bundledPath,
      message: 'Using bundled OCR runtime.',
    });
  });

  it('prefers a dev-local bundled executable before python fallback', () => {
    const devExecutable = path.join(
      '/repo',
      'resources',
      'ocr-runtime',
      'windows-x64',
      'ocr_runner.exe',
    );

    const descriptor = resolveOcrRuntimeDescriptor({
      isPackaged: false,
      cwd: '/repo',
      resourcesPath: null,
      platform: 'win32',
      arch: 'x64',
      existsSync: (candidate) => candidate === devExecutable,
    });

    expect(descriptor).toEqual({
      mode: 'bundled',
      executablePath: devExecutable,
      runtimePath: devExecutable,
      message: 'Using local bundled OCR runtime.',
    });
  });

  it('uses python fallback in development when only the script exists', () => {
    const scriptPath = path.join('/repo', 'resources', 'ocr', 'ocr_runner.py');

    const descriptor = resolveOcrRuntimeDescriptor({
      isPackaged: false,
      cwd: '/repo',
      resourcesPath: null,
      platform: 'linux',
      arch: 'x64',
      existsSync: (candidate) => candidate === scriptPath,
    });

    expect(descriptor.mode).toBe('python-fallback');
    if (descriptor.mode !== 'python-fallback') {
      throw new Error('Expected python fallback descriptor');
    }
    expect(descriptor.scriptPath).toBe(scriptPath);
    expect(descriptor.runtimePath).toBe(scriptPath);
    expect(descriptor.message).toBe('Using Python OCR fallback.');
  });

  it('does not fall back to python in packaged mode when the bundled runtime is missing', () => {
    const descriptor = resolveOcrRuntimeDescriptor({
      isPackaged: true,
      cwd: '/repo',
      resourcesPath: '/packaged/resources',
      platform: 'win32',
      arch: 'x64',
      existsSync: () => false,
    });

    expect(descriptor.mode).toBe('unavailable');
    expect(descriptor.runtimePath).toBeNull();
    expect(descriptor.message).toContain(
      'Bundled OCR runtime was not found in the packaged app resources.',
    );
    expect(descriptor.message).toContain('windows-x64');
  });

  it('prefers the bundled runtime for packaged macOS builds', () => {
    const bundledPath = path.join(
      '/Applications/StudyBud.app/Contents/Resources',
      'ocr-runtime',
      'darwin-arm64',
      'ocr_runner',
    );

    const descriptor = resolveOcrRuntimeDescriptor({
      isPackaged: true,
      cwd: '/repo',
      resourcesPath: '/Applications/StudyBud.app/Contents/Resources',
      platform: 'darwin',
      arch: 'arm64',
      existsSync: (candidate) => candidate === bundledPath,
    });

    expect(descriptor).toEqual({
      mode: 'bundled',
      executablePath: bundledPath,
      runtimePath: bundledPath,
      message: 'Using bundled OCR runtime.',
    });
  });

  it('reports macOS-specific unavailable message when packaged bundled runtime is missing', () => {
    const descriptor = resolveOcrRuntimeDescriptor({
      isPackaged: true,
      cwd: '/repo',
      resourcesPath: '/Applications/StudyBud.app/Contents/Resources',
      platform: 'darwin',
      arch: 'arm64',
      existsSync: () => false,
    });

    expect(descriptor.mode).toBe('unavailable');
    expect(descriptor.runtimePath).toBeNull();
    expect(descriptor.message).toContain('darwin-arm64');
  });

  it('uses python fallback in macOS development when only the script exists', () => {
    const scriptPath = path.join('/repo', 'resources', 'ocr', 'ocr_runner.py');

    const descriptor = resolveOcrRuntimeDescriptor({
      isPackaged: false,
      cwd: '/repo',
      resourcesPath: null,
      platform: 'darwin',
      arch: 'arm64',
      existsSync: (candidate) => candidate === scriptPath,
    });

    expect(descriptor.mode).toBe('python-fallback');
    if (descriptor.mode !== 'python-fallback') {
      throw new Error('Expected python fallback descriptor');
    }
    expect(descriptor.scriptPath).toBe(scriptPath);
  });
});
