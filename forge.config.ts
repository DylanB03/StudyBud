import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    name: 'StudyBud',
    appBundleId: 'com.dylanb.studybud',
    appCategoryType: 'public.app-category.education',
    // Packager resolves the correct extension per platform (.icns on mac,
    // .ico on Windows, .png on Linux) when no extension is provided.
    icon: 'resources/branding/icon',
    // Distribution is unsigned ad-hoc per the macOS support plan.
    // `osxSign` / `osxNotarize` can be wired in via env vars here later.
    osxSign: undefined,
    osxNotarize: undefined,
    extraResource: ['resources/ocr', 'resources/ocr-runtime'],
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ['darwin']),
    new MakerDMG(
      {
        // ULFO is a modern LZFSE-backed DMG format; smaller and faster
        // than the legacy UDZO default, supported on macOS 10.11+.
        format: 'ULFO',
      },
      ['darwin'],
    ),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    // Ensures native `.node` addons (better-sqlite3, optionally @napi-rs/canvas)
    // are unpacked from asar so they can be dlopen'd at runtime on all
    // platforms. Without this, packaged macOS builds can fail to load native
    // modules even when rebuilt correctly.
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
        {
          entry: 'src/main/documents/import-worker.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
