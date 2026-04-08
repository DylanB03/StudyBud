import path from 'node:path';

import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig((configEnv) => {
  const forgeBuildConfig =
    configEnv.forgeConfigSelf && 'entry' in configEnv.forgeConfigSelf
      ? configEnv.forgeConfigSelf
      : null;
  const forgeEntry =
    typeof forgeBuildConfig?.entry === 'string'
      ? forgeBuildConfig.entry
      : 'src/main.ts';
  const outputName = path.basename(forgeEntry, path.extname(forgeEntry));
  const isExternalNativeDependency = (id: string): boolean => {
    return (
      id === 'better-sqlite3' ||
      id.startsWith('better-sqlite3/') ||
      id.includes('/node_modules/better-sqlite3/') ||
      id === 'bindings' ||
      id.startsWith('bindings/') ||
      id.includes('/node_modules/bindings/') ||
      id === 'file-uri-to-path' ||
      id.startsWith('file-uri-to-path/') ||
      id.includes('/node_modules/file-uri-to-path/') ||
      id === '@napi-rs/canvas' ||
      id.startsWith('@napi-rs/canvas/') ||
      id.startsWith('@napi-rs/canvas-') ||
      id.includes('/node_modules/@napi-rs/canvas/') ||
      id.includes('/node_modules/@napi-rs/canvas-')
    );
  };

  return {
    build: {
      lib: {
        entry: forgeEntry,
        fileName: () => `${outputName}.js`,
        formats: ['cjs'],
      },
      rollupOptions: {
        // Native addons must stay external so Electron can load their compiled
        // `.node` binaries at runtime instead of Vite trying to bundle them.
        external: isExternalNativeDependency,
      },
    },
  };
});
