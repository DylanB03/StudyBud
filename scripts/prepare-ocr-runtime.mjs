import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const bundledRuntimePath = path.join(
  repoRoot,
  'resources',
  'ocr-runtime',
  `windows-${process.arch}`,
  'ocr_runner.exe',
);

const runNodeScript = (scriptPath) => {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: repoRoot,
      stdio: 'inherit',
      env: process.env,
    });

    child.once('error', (error) => {
      reject(error);
    });

    child.once('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Script exited with code ${code}.`));
    });
  });
};

const main = async () => {
  if (process.env.STUDYBUD_SKIP_OCR_RUNTIME === '1') {
    console.log('Skipping OCR runtime preparation because STUDYBUD_SKIP_OCR_RUNTIME=1.');
    return;
  }

  if (process.platform !== 'win32') {
    console.log('Skipping bundled OCR runtime preparation on non-Windows platform.');
    return;
  }

  if (
    fs.existsSync(bundledRuntimePath) &&
    process.env.STUDYBUD_REBUILD_OCR !== '1'
  ) {
    console.log(`Using existing bundled OCR runtime at ${bundledRuntimePath}`);
    return;
  }

  await runNodeScript(path.join(repoRoot, 'scripts', 'build-ocr-runtime-win.mjs'));
};

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : 'OCR runtime preparation failed.',
  );
  process.exit(1);
});
