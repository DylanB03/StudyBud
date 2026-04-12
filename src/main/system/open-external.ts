import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { shell } from 'electron';

const execFileAsync = promisify(execFile);

const isWslRuntime = (): boolean => {
  try {
    const version = fs.readFileSync('/proc/version', 'utf8').toLowerCase();
    return version.includes('microsoft') || version.includes('wsl');
  } catch {
    return false;
  }
};

const WINDOWS_CMD_PATH = '/mnt/c/Windows/System32/cmd.exe';
const WINDOWS_POWERSHELL_PATH =
  '/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';

const hasExecutable = (targetPath: string): boolean => {
  try {
    fs.accessSync(targetPath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

const openExternalWithWindowsLauncher = async (url: string): Promise<boolean> => {
  if (!isWslRuntime()) {
    return false;
  }

  if (hasExecutable(WINDOWS_CMD_PATH)) {
    await execFileAsync(WINDOWS_CMD_PATH, ['/c', 'start', '', url]);
    return true;
  }

  if (hasExecutable(WINDOWS_POWERSHELL_PATH)) {
    await execFileAsync(WINDOWS_POWERSHELL_PATH, [
      '-NoProfile',
      '-Command',
      'Start-Process',
      url,
    ]);
    return true;
  }

  return false;
};

export const openExternalUrl = async (url: string): Promise<void> => {
  if (await openExternalWithWindowsLauncher(url)) {
    return;
  }

  await shell.openExternal(url);
};
