import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const ocrScriptPath = path.join(repoRoot, 'resources', 'ocr', 'ocr_runner.py');
const ocrRequirementsPath = path.join(
  repoRoot,
  'resources',
  'ocr',
  'requirements.txt',
);
const outputRoot = path.join(
  repoRoot,
  'resources',
  'ocr-runtime',
  `darwin-${process.arch}`,
);
const tempRoot = path.join(repoRoot, '.tmp', 'ocr-runtime-build');
const distRoot = path.join(tempRoot, 'dist');
const workRoot = path.join(tempRoot, 'build');
const specRoot = path.join(tempRoot, 'spec');
const vendorTesseractRoot = path.join(
  repoRoot,
  'resources',
  'ocr',
  'vendor',
  'tesseract',
  `darwin-${process.arch}`,
);

const venvPython = path.join(repoRoot, '.venv', 'bin', 'python');
const pythonCandidates = [
  { command: venvPython, prefixArgs: [] },
  { command: 'python3', prefixArgs: [] },
  { command: 'python', prefixArgs: [] },
];

const runCommand = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
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
      resolve({ code, stdout, stderr });
    });
  });

const runCaptured = async (command, args, options = {}) => {
  const result = await runCommand(command, args, options);
  if (result.code !== 0) {
    throw new Error(
      `Command failed (${command} ${args.join(' ')}):\n${
        result.stderr.trim() || result.stdout.trim()
      }`,
    );
  }
  return result.stdout;
};

const ensureExists = (targetPath, message) => {
  if (!fs.existsSync(targetPath)) {
    throw new Error(message);
  }
};

const resolvePython = async () => {
  for (const candidate of pythonCandidates) {
    if (
      candidate.command.startsWith('/') &&
      !fs.existsSync(candidate.command)
    ) {
      continue;
    }

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
    `Could not find a Python environment with PyInstaller, PyMuPDF, and pytesseract installed.\n` +
      `Install them in a venv, e.g.:\n` +
      `  python3 -m venv .venv && . .venv/bin/activate\n` +
      `  pip install -r ${path.relative(repoRoot, ocrRequirementsPath)} pyinstaller`,
  );
};

const resolveBrewPrefix = async (formula) => {
  try {
    const stdout = await runCaptured('brew', ['--prefix', formula]);
    const trimmed = stdout.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
};

const resolveTesseractSource = async () => {
  const envPath = process.env.STUDYBUD_TESSERACT_DIR?.trim();
  if (envPath && fs.existsSync(envPath)) {
    return { kind: 'prebuilt-tree', path: envPath };
  }

  if (fs.existsSync(vendorTesseractRoot)) {
    return { kind: 'prebuilt-tree', path: vendorTesseractRoot };
  }

  const tesseractPrefix = await resolveBrewPrefix('tesseract');
  if (!tesseractPrefix) {
    throw new Error(
      `Could not locate a macOS Tesseract install. Set STUDYBUD_TESSERACT_DIR, place a prebuilt tree in ${vendorTesseractRoot}, or install Homebrew and run: brew install tesseract`,
    );
  }

  return { kind: 'brew', tesseractPrefix };
};

const copyDir = (src, dest) => {
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true, force: true, dereference: false });
};

const listDylibsMatching = (dir, matchers) => {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((name) => matchers.some((matcher) => matcher.test(name)))
    .map((name) => path.join(dir, name));
};

const otoolList = async (binaryPath) => {
  const stdout = await runCaptured('otool', ['-L', binaryPath]);
  const lines = stdout.split('\n').slice(1);
  const entries = [];
  for (const line of lines) {
    const match = line.trim().match(/^(\S+)\s+\(/);
    if (match) {
      entries.push(match[1]);
    }
  }
  return entries;
};

const rewriteDylibsForRelocation = async (tesseractDestRoot) => {
  const binaryPath = path.join(tesseractDestRoot, 'tesseract');
  const libDir = path.join(tesseractDestRoot, 'lib');

  ensureExists(
    binaryPath,
    `Bundled tesseract binary missing at ${binaryPath}.`,
  );

  const dylibNames = fs.existsSync(libDir)
    ? fs
        .readdirSync(libDir)
        .filter((name) => name.endsWith('.dylib'))
    : [];

  // 1. Make each dylib identify itself relative to its loader, and rewrite
  //    its inter-dylib references to use @loader_path too. This lets any
  //    copy of the lib directory be loaded from any install location.
  for (const name of dylibNames) {
    const libPath = path.join(libDir, name);
    await runCaptured('chmod', ['u+w', libPath]);
    await runCaptured('install_name_tool', [
      '-id',
      `@loader_path/${name}`,
      libPath,
    ]);

    const deps = await otoolList(libPath);
    for (const dep of deps) {
      const depName = path.basename(dep);
      if (dep.startsWith('@')) continue;
      if (dep === libPath) continue;
      if (dylibNames.includes(depName)) {
        await runCaptured('install_name_tool', [
          '-change',
          dep,
          `@loader_path/${depName}`,
          libPath,
        ]);
      }
    }
  }

  // 2. Rewrite the tesseract binary's dylib search paths to point at our
  //    bundled lib directory (sibling of the binary).
  await runCaptured('chmod', ['u+w', binaryPath]);
  const binDeps = await otoolList(binaryPath);
  for (const dep of binDeps) {
    if (dep.startsWith('@')) continue;
    const depName = path.basename(dep);
    if (dylibNames.includes(depName)) {
      await runCaptured('install_name_tool', [
        '-change',
        dep,
        `@executable_path/lib/${depName}`,
        binaryPath,
      ]);
    }
  }

  // 3. Add an rpath so nested library lookups also succeed.
  try {
    await runCommand('install_name_tool', [
      '-add_rpath',
      '@executable_path/lib',
      binaryPath,
    ]);
  } catch {
    // adding an rpath that already exists is harmless
  }
};

const stageTesseractFromBrew = async (tesseractPrefix, destRoot) => {
  const tesseractBin = path.join(tesseractPrefix, 'bin', 'tesseract');
  ensureExists(
    tesseractBin,
    `Tesseract binary missing at ${tesseractBin}. Is Homebrew's tesseract installed?`,
  );

  const libDir = path.join(destRoot, 'lib');
  const tessdataDir = path.join(destRoot, 'tessdata');
  fs.mkdirSync(destRoot, { recursive: true });
  fs.mkdirSync(libDir, { recursive: true });

  fs.copyFileSync(tesseractBin, path.join(destRoot, 'tesseract'));
  fs.chmodSync(path.join(destRoot, 'tesseract'), 0o755);

  const tesseractLibDir = path.join(tesseractPrefix, 'lib');
  const tesseractDylibs = listDylibsMatching(tesseractLibDir, [
    /^libtesseract\..*\.dylib$/,
    /^libtesseract\.dylib$/,
  ]);
  for (const lib of tesseractDylibs) {
    fs.copyFileSync(lib, path.join(libDir, path.basename(lib)));
  }

  const leptonicaPrefix = await resolveBrewPrefix('leptonica');
  if (!leptonicaPrefix) {
    throw new Error(
      'Could not locate Homebrew leptonica (dependency of tesseract). Try: brew install leptonica',
    );
  }
  const leptonicaDylibs = listDylibsMatching(
    path.join(leptonicaPrefix, 'lib'),
    [/^libleptonica.*\.dylib$/, /^liblept.*\.dylib$/],
  );
  for (const lib of leptonicaDylibs) {
    fs.copyFileSync(lib, path.join(libDir, path.basename(lib)));
  }

  // tessdata can live under share/tessdata or under the prefix itself.
  const shareTessdata = path.join(tesseractPrefix, 'share', 'tessdata');
  const altTessdata = path.join(
    tesseractPrefix,
    'share',
    `tessdata_${path.basename(tesseractPrefix)}`,
  );
  const tessdataSource = fs.existsSync(shareTessdata)
    ? shareTessdata
    : fs.existsSync(altTessdata)
      ? altTessdata
      : null;
  if (!tessdataSource) {
    throw new Error(
      `Could not find tessdata under ${shareTessdata}. Install trained data (e.g. brew reinstall tesseract-lang or copy your tessdata dir to STUDYBUD_TESSERACT_DIR).`,
    );
  }
  copyDir(tessdataSource, tessdataDir);

  await rewriteDylibsForRelocation(destRoot);
};

const copyPreparedTesseractTree = (source, destRoot) => {
  copyDir(source, destRoot);
  const bin = path.join(destRoot, 'tesseract');
  if (fs.existsSync(bin)) {
    fs.chmodSync(bin, 0o755);
  }
};

const readTesseractVersion = async (destRoot) => {
  const binary = path.join(destRoot, 'tesseract');
  if (!fs.existsSync(binary)) return null;
  try {
    const result = await runCommand(binary, ['--version']);
    const firstLine = (result.stdout || result.stderr).split('\n')[0]?.trim();
    return firstLine || null;
  } catch {
    return null;
  }
};

const main = async () => {
  if (process.platform !== 'darwin') {
    throw new Error('The bundled macOS OCR runtime can only be built on macOS.');
  }

  ensureExists(
    ocrScriptPath,
    `OCR runner script is missing at ${ocrScriptPath}.`,
  );

  const python = await resolvePython();
  const tesseractSource = await resolveTesseractSource();

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

  console.log(`Running PyInstaller with ${python.command}...`);
  const buildResult = await runCommand(python.command, pyInstallerArgs, {
    cwd: repoRoot,
  });

  if (buildResult.code !== 0) {
    throw new Error(
      buildResult.stderr.trim() ||
        `PyInstaller failed with code ${buildResult.code}.`,
    );
  }

  // PyInstaller on macOS produces dist/ocr_runner/ (onedir) containing the
  // binary and a _internal/ subfolder. Copy the whole folder verbatim so the
  // runtime.ts resolver finds `<outputRoot>/ocr_runner` as a direct binary.
  const builtRuntimeDir = path.join(distRoot, 'ocr_runner');
  ensureExists(
    builtRuntimeDir,
    `PyInstaller did not produce the expected OCR runtime folder at ${builtRuntimeDir}.`,
  );

  fs.cpSync(builtRuntimeDir, outputRoot, {
    recursive: true,
    force: true,
    dereference: false,
  });

  const builtBinary = path.join(outputRoot, 'ocr_runner');
  ensureExists(
    builtBinary,
    `PyInstaller output is missing the ocr_runner binary at ${builtBinary}.`,
  );
  fs.chmodSync(builtBinary, 0o755);

  const tesseractDest = path.join(outputRoot, 'tesseract');
  if (tesseractSource.kind === 'brew') {
    console.log(
      `Staging Tesseract from Homebrew prefix ${tesseractSource.tesseractPrefix}...`,
    );
    await stageTesseractFromBrew(tesseractSource.tesseractPrefix, tesseractDest);
  } else {
    console.log(`Copying prepared Tesseract tree from ${tesseractSource.path}...`);
    copyPreparedTesseractTree(tesseractSource.path, tesseractDest);
  }

  const tesseractVersion = await readTesseractVersion(tesseractDest);

  fs.writeFileSync(
    path.join(outputRoot, 'manifest.json'),
    JSON.stringify(
      {
        engine: 'Bundled OCR Runtime',
        platform: 'darwin',
        arch: process.arch,
        tesseract: tesseractVersion,
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
