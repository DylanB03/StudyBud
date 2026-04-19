import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

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

const platformConfigs = {
  win32: {
    folderName: `windows-${process.arch}`,
    executableName: 'ocr_runner.exe',
    builderScript: 'build-ocr-runtime-win.mjs',
  },
  darwin: {
    folderName: `darwin-${process.arch}`,
    executableName: 'ocr_runner',
    builderScript: 'build-ocr-runtime-mac.mjs',
  },
};

const main = async () => {
  if (process.env.STUDYBUD_SKIP_OCR_RUNTIME === '1') {
    console.log('Skipping OCR runtime preparation because STUDYBUD_SKIP_OCR_RUNTIME=1.');
    return;
  }

  const config = platformConfigs[process.platform];
  if (!config) {
    console.log(
      `Skipping bundled OCR runtime preparation on ${process.platform} (not yet supported).`,
    );
    return;
  }

  const bundledRuntimePath = path.join(
    repoRoot,
    'resources',
    'ocr-runtime',
    config.folderName,
    config.executableName,
  );

  if (
    fs.existsSync(bundledRuntimePath) &&
    process.env.STUDYBUD_REBUILD_OCR !== '1'
  ) {
    console.log(`Using existing bundled OCR runtime at ${bundledRuntimePath}`);
    return;
  }

  await runNodeScript(path.join(repoRoot, 'scripts', config.builderScript));
};

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : 'OCR runtime preparation failed.',
  );
  process.exit(1);
});
