import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const ocrScriptPath = path.join(repoRoot, 'resources', 'ocr', 'ocr_runner.py');
const outputRoot = path.join(
  repoRoot,
  'resources',
  'ocr-runtime',
  `windows-${process.arch}`,
);
const tempRoot = path.join(repoRoot, '.tmp', 'ocr-runtime-build');
const distRoot = path.join(tempRoot, 'dist');
const workRoot = path.join(tempRoot, 'build');
const specRoot = path.join(tempRoot, 'spec');
const bundledTesseractRoot = path.join(
  repoRoot,
  'resources',
  'ocr',
  'vendor',
  'tesseract',
  `windows-${process.arch}`,
);

const pythonCandidates = [
  { command: 'py', prefixArgs: ['-3'] },
  { command: 'python', prefixArgs: [] },
  { command: 'python3', prefixArgs: [] },
];

const runCommand = (command, args, options = {}) => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'pipe',
      ...options,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.once('error', (error) => {
      reject(error);
    });

    child.once('close', (code) => {
      resolve({
        code,
        stdout,
        stderr,
      });
    });
  });
};

const ensureExists = (targetPath, message) => {
  if (!fs.existsSync(targetPath)) {
    throw new Error(message);
  }
};

const resolveTesseractSourceDir = () => {
  const envPath = process.env.STUDYBUD_TESSERACT_DIR?.trim();

  if (envPath && fs.existsSync(envPath)) {
    return envPath;
  }

  if (fs.existsSync(bundledTesseractRoot)) {
    return bundledTesseractRoot;
  }

  throw new Error(
    `Could not find a Windows Tesseract runtime. Set STUDYBUD_TESSERACT_DIR or place it in ${bundledTesseractRoot}.`,
  );
};

const resolvePython = async () => {
  for (const candidate of pythonCandidates) {
    try {
      const result = await runCommand(candidate.command, [
        ...candidate.prefixArgs,
        '-c',
        'import PyInstaller, fitz, pytesseract',
      ]);

      if (result.code === 0) {
        return candidate;
      }
    } catch {
      continue;
    }
  }

  throw new Error(
    'Could not find a Python environment with PyInstaller, PyMuPDF, and pytesseract installed.',
  );
};

const main = async () => {
  if (process.platform !== 'win32') {
    throw new Error('The bundled Windows OCR runtime can only be built on Windows.');
  }

  ensureExists(
    ocrScriptPath,
    `OCR runner script is missing at ${ocrScriptPath}.`,
  );

  const python = await resolvePython();
  const tesseractSourceDir = resolveTesseractSourceDir();

  fs.rmSync(tempRoot, { recursive: true, force: true });
  fs.rmSync(outputRoot, { recursive: true, force: true });
  fs.mkdirSync(distRoot, { recursive: true });
  fs.mkdirSync(workRoot, { recursive: true });
  fs.mkdirSync(specRoot, { recursive: true });
  fs.mkdirSync(outputRoot, { recursive: true });

  const pyInstallerArgs = [
    ...python.prefixArgs,
    '-m',
    'PyInstaller',
    '--noconfirm',
    '--clean',
    '--onedir',
    '--name',
    'ocr_runner',
    '--distpath',
    distRoot,
    '--workpath',
    workRoot,
    '--specpath',
    specRoot,
    ocrScriptPath,
  ];

  const buildResult = await runCommand(python.command, pyInstallerArgs, {
    cwd: repoRoot,
  });

  if (buildResult.code !== 0) {
    throw new Error(
      buildResult.stderr.trim() ||
        `PyInstaller failed with code ${buildResult.code}.`,
    );
  }

  const builtRuntimeDir = path.join(distRoot, 'ocr_runner');
  ensureExists(
    builtRuntimeDir,
    `PyInstaller did not produce the expected OCR runtime folder at ${builtRuntimeDir}.`,
  );

  fs.cpSync(builtRuntimeDir, outputRoot, {
    recursive: true,
    force: true,
  });

  fs.cpSync(tesseractSourceDir, path.join(outputRoot, 'tesseract'), {
    recursive: true,
    force: true,
  });

  fs.writeFileSync(
    path.join(outputRoot, 'manifest.json'),
    JSON.stringify(
      {
        engine: 'Bundled OCR Runtime',
        platform: 'win32',
        arch: process.arch,
        builtAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  console.log(`Built bundled OCR runtime at ${outputRoot}`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
