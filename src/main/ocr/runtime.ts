import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

export type OcrRuntimeMode = 'bundled' | 'python-fallback' | 'unavailable';

export type OcrRuntimeStatus = {
  available: boolean;
  engine: string | null;
  message: string;
  mode: OcrRuntimeMode;
  runtimePath: string | null;
  pythonCommand: string | null;
  scriptPath: string | null;
  executablePath: string | null;
};

export type OcrPageRequest = {
  pageId: string;
  pageNumber: number;
};

export type OcrPageResult = {
  pageId: string;
  textContent: string;
  confidence: number | null;
  warning: string | null;
};

export type OcrDocumentRunResult = {
  runtime: OcrRuntimeStatus;
  pages: OcrPageResult[];
};

type JsonCommandResult = {
  stdout: string;
  stderr: string;
  code: number | null;
};

type OcrStatusPayload = {
  available?: boolean;
  engine?: string | null;
  message?: string | null;
};

type OcrRunPayload = {
  pages?: Array<{
    page_id?: string;
    text?: string;
    confidence?: number | null;
    warning?: string | null;
  }>;
};

type OcrRuntimeDescriptor =
  | {
      mode: 'bundled';
      executablePath: string;
      runtimePath: string;
      message: string;
    }
  | {
      mode: 'python-fallback';
      runtimePath: string;
      scriptPath: string;
      pythonCommandCandidates: string[];
      message: string;
    }
  | {
      mode: 'unavailable';
      runtimePath: null;
      message: string;
    };

type ResolveOcrRuntimeDescriptorInput = {
  isPackaged: boolean;
  cwd: string;
  resourcesPath: string | null;
  platform: NodeJS.Platform;
  arch: string;
  existsSync?: (targetPath: string) => boolean;
};

const SYSTEM_PYTHON_COMMAND_CANDIDATES =
  process.platform === 'win32' ? ['python', 'py', 'python3'] : ['python3', 'python'];

let cachedRuntimeStatus: OcrRuntimeStatus | null = null;

const runJsonCommand = (
  command: string,
  args: string[],
  input: Record<string, unknown> | null,
): Promise<JsonCommandResult> => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'pipe',
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.once('error', (error) => {
      reject(error);
    });

    child.once('close', (code) => {
      resolve({
        stdout,
        stderr,
        code,
      });
    });

    if (input) {
      child.stdin.write(JSON.stringify(input));
    }

    child.stdin.end();
  });
};

const toWindowsBundleFolderName = (arch: string): string => {
  return `windows-${arch}`;
};

export const getBundledOcrExecutableCandidatePaths = (input: {
  cwd: string;
  resourcesPath: string | null;
  platform: NodeJS.Platform;
  arch: string;
}): string[] => {
  if (input.platform !== 'win32') {
    return [];
  }

  const folderName = toWindowsBundleFolderName(input.arch);

  return [
    input.resourcesPath
      ? path.join(input.resourcesPath, 'ocr-runtime', folderName, 'ocr_runner.exe')
      : null,
    path.join(input.cwd, 'resources', 'ocr-runtime', folderName, 'ocr_runner.exe'),
  ].filter((candidate): candidate is string => typeof candidate === 'string');
};

const getPythonCommandCandidates = (
  cwd: string,
  platform: NodeJS.Platform,
): string[] => {
  const venvCandidate =
    platform === 'win32'
      ? path.join(cwd, '.venv', 'Scripts', 'python.exe')
      : path.join(cwd, '.venv', 'bin', 'python');

  return [venvCandidate, ...SYSTEM_PYTHON_COMMAND_CANDIDATES];
};

const resolveOcrScriptPath = (input: {
  cwd: string;
  resourcesPath: string | null;
  existsSync: (targetPath: string) => boolean;
}): string | null => {
  const candidatePaths = [
    path.join(input.cwd, 'resources', 'ocr', 'ocr_runner.py'),
    input.resourcesPath
      ? path.join(input.resourcesPath, 'ocr', 'ocr_runner.py')
      : null,
  ].filter((candidate): candidate is string => typeof candidate === 'string');

  return candidatePaths.find((candidate) => input.existsSync(candidate)) ?? null;
};

export const resolveOcrRuntimeDescriptor = (
  input: ResolveOcrRuntimeDescriptorInput,
): OcrRuntimeDescriptor => {
  const existsSync = input.existsSync ?? fs.existsSync;
  const bundledCandidates = getBundledOcrExecutableCandidatePaths({
    cwd: input.cwd,
    resourcesPath: input.resourcesPath,
    platform: input.platform,
    arch: input.arch,
  });
  const bundledRuntime = bundledCandidates.find((candidate) => existsSync(candidate));

  if (bundledRuntime) {
    return {
      mode: 'bundled',
      executablePath: bundledRuntime,
      runtimePath: bundledRuntime,
      message: input.isPackaged
        ? 'Using bundled OCR runtime.'
        : 'Using local bundled OCR runtime.',
    };
  }

  if (input.isPackaged) {
    return {
      mode: 'unavailable',
      runtimePath: null,
      message:
        'Bundled OCR runtime was not found in the packaged app resources.',
    };
  }

  const scriptPath = resolveOcrScriptPath({
    cwd: input.cwd,
    resourcesPath: input.resourcesPath,
    existsSync,
  });

  if (!scriptPath) {
    return {
      mode: 'unavailable',
      runtimePath: null,
      message: 'OCR helper script is missing from the development resources.',
    };
  }

  return {
    mode: 'python-fallback',
    runtimePath: scriptPath,
    scriptPath,
    pythonCommandCandidates: getPythonCommandCandidates(input.cwd, input.platform),
    message: 'Using Python OCR fallback.',
  };
};

const probeBundledRuntimeStatus = async (
  executablePath: string,
  message: string,
): Promise<OcrRuntimeStatus> => {
  const result = await runJsonCommand(executablePath, ['--status'], null);

  if (result.code !== 0) {
    return {
      available: false,
      engine: null,
      message:
        result.stderr.trim() ||
        `Bundled OCR runtime exited with code ${result.code}.`,
      mode: 'bundled',
      runtimePath: executablePath,
      pythonCommand: null,
      scriptPath: null,
      executablePath,
    };
  }

  try {
    const payload = JSON.parse(result.stdout) as OcrStatusPayload;
    return {
      available: Boolean(payload.available),
      engine: payload.engine ?? null,
      message: payload.message?.trim() || message,
      mode: 'bundled',
      runtimePath: executablePath,
      pythonCommand: null,
      scriptPath: null,
      executablePath,
    };
  } catch {
    return {
      available: false,
      engine: null,
      message: 'Bundled OCR runtime returned an unreadable status payload.',
      mode: 'bundled',
      runtimePath: executablePath,
      pythonCommand: null,
      scriptPath: null,
      executablePath,
    };
  }
};

const probePythonFallbackStatus = async (
  pythonCommand: string,
  scriptPath: string,
): Promise<OcrRuntimeStatus> => {
  const result = await runJsonCommand(pythonCommand, [scriptPath, '--status'], null);

  if (result.code !== 0) {
    return {
      available: false,
      engine: null,
      message: result.stderr.trim() || `OCR runtime exited with code ${result.code}.`,
      mode: 'python-fallback',
      runtimePath: scriptPath,
      pythonCommand,
      scriptPath,
      executablePath: null,
    };
  }

  try {
    const payload = JSON.parse(result.stdout) as OcrStatusPayload;
    return {
      available: Boolean(payload.available),
      engine: payload.engine ?? null,
      message: payload.message?.trim() || 'OCR runtime status unavailable.',
      mode: 'python-fallback',
      runtimePath: scriptPath,
      pythonCommand,
      scriptPath,
      executablePath: null,
    };
  } catch {
    return {
      available: false,
      engine: null,
      message: 'OCR runtime returned an unreadable status payload.',
      mode: 'python-fallback',
      runtimePath: scriptPath,
      pythonCommand,
      scriptPath,
      executablePath: null,
    };
  }
};

export const detectOcrRuntime = async (
  options?: {
    forceRefresh?: boolean;
  },
): Promise<OcrRuntimeStatus> => {
  if (!options?.forceRefresh && cachedRuntimeStatus) {
    return cachedRuntimeStatus;
  }

  const descriptor = resolveOcrRuntimeDescriptor({
    isPackaged:
      typeof process.defaultApp === 'undefined'
        ? process.env.NODE_ENV === 'production'
        : !process.defaultApp,
    cwd: process.cwd(),
    resourcesPath:
      typeof process.resourcesPath === 'string' && process.resourcesPath.length > 0
        ? process.resourcesPath
        : null,
    platform: process.platform,
    arch: process.arch,
  });

  if (descriptor.mode === 'bundled') {
    cachedRuntimeStatus = await probeBundledRuntimeStatus(
      descriptor.executablePath,
      descriptor.message,
    );
    return cachedRuntimeStatus;
  }

  if (descriptor.mode === 'python-fallback') {
    for (const pythonCommand of descriptor.pythonCommandCandidates) {
      try {
        const status = await probePythonFallbackStatus(
          pythonCommand,
          descriptor.scriptPath,
        );
        if (status.available) {
          cachedRuntimeStatus = status;
          return status;
        }

        if (!cachedRuntimeStatus) {
          cachedRuntimeStatus = status;
        }
      } catch {
        continue;
      }
    }

    return (
      cachedRuntimeStatus ?? {
        available: false,
        engine: null,
        message: 'Python was not found for the OCR fallback runtime.',
        mode: 'python-fallback',
        runtimePath: descriptor.scriptPath,
        pythonCommand: null,
        scriptPath: descriptor.scriptPath,
        executablePath: null,
      }
    );
  }

  cachedRuntimeStatus = {
    available: false,
    engine: null,
    message: descriptor.message,
    mode: 'unavailable',
    runtimePath: null,
    pythonCommand: null,
    scriptPath: null,
    executablePath: null,
  };
  return cachedRuntimeStatus;
};

export const resetCachedOcrRuntimeStatus = (): void => {
  cachedRuntimeStatus = null;
};

export const runOcrForDocumentPages = async (input: {
  pdfPath: string;
  pages: OcrPageRequest[];
}): Promise<OcrDocumentRunResult> => {
  let runtime = await detectOcrRuntime();

  if (!runtime.available) {
    runtime = await detectOcrRuntime({ forceRefresh: true });
  }

  if (
    !runtime.available ||
    (!runtime.executablePath && (!runtime.pythonCommand || !runtime.scriptPath))
  ) {
    return {
      runtime,
      pages: [],
    };
  }

  const command = runtime.executablePath ?? runtime.pythonCommand;
  const args = runtime.executablePath ? [] : runtime.scriptPath ? [runtime.scriptPath] : [];

  if (!command) {
    return {
      runtime: {
        ...runtime,
        available: false,
        message: 'OCR runtime resolved without an executable command.',
      },
      pages: [],
    };
  }

  const result = await runJsonCommand(command, args, {
    pdf_path: input.pdfPath,
    pages: input.pages.map((page) => ({
      page_id: page.pageId,
      page_number: page.pageNumber,
    })),
    temp_dir: path.join(os.tmpdir(), 'studybud-ocr'),
  });

  if (result.code !== 0) {
    return {
      runtime: {
        ...runtime,
        available: false,
        message:
          result.stderr.trim() ||
          `OCR process exited with code ${result.code ?? 'unknown'}.`,
      },
      pages: [],
    };
  }

  try {
    const payload = JSON.parse(result.stdout) as OcrRunPayload;
    return {
      runtime,
      pages: (payload.pages ?? []).map((page) => ({
        pageId: page.page_id ?? '',
        textContent: page.text?.trim() ?? '',
        confidence:
          typeof page.confidence === 'number' ? page.confidence : null,
        warning: page.warning?.trim() || null,
      })),
    };
  } catch {
    return {
      runtime: {
        ...runtime,
        available: false,
        message: 'OCR runtime returned unreadable page results.',
      },
      pages: [],
    };
  }
};
