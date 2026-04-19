# Bundled OCR Runtime

This directory is reserved for packaged OCR runtimes that ship with StudyBud.
The packaged Electron build prefers a bundled runtime here over the Python
fallback, and packaged builds refuse to fall back to Python at all — so every
supported OS must either bundle its own runtime or explicitly accept no OCR.

## Layouts

### Windows

```
windows-x64/ocr_runner.exe
windows-x64/tesseract/tesseract.exe
windows-x64/tesseract/tessdata/...
windows-x64/manifest.json
```

Build command: `npm run build:ocr:win` (must run on Windows).

### macOS

```
darwin-arm64/ocr_runner             # PyInstaller one-dir entry binary
darwin-arm64/_internal/...          # PyInstaller runtime (auto-generated)
darwin-arm64/tesseract/tesseract    # POSIX binary (no .exe)
darwin-arm64/tesseract/lib/*.dylib  # tesseract + leptonica dylibs
darwin-arm64/tesseract/tessdata/... # trained data files
darwin-arm64/manifest.json
```

`darwin-x64` has the same layout for Intel macs.

Build command: `npm run build:ocr:mac` (must run on macOS, builds for the
host architecture).

Why a `lib/` subdirectory? Homebrew's `tesseract` binary is linked against
absolute paths like `/opt/homebrew/opt/leptonica/lib/libleptonica.6.dylib`.
The build script copies each required dylib into `tesseract/lib/` and then
uses `install_name_tool` to rewrite the binary so it loads its libraries via
`@executable_path/lib/` instead. This makes the bundle self-contained and
survives being shipped to users that do not have Homebrew installed.

Build-script prerequisites on macOS:

- Xcode Command Line Tools (provides `install_name_tool` and `otool`).
- Homebrew `tesseract` and `leptonica` (`brew install tesseract`). The script
  auto-detects via `brew --prefix tesseract` when `STUDYBUD_TESSERACT_DIR`
  is not set and `resources/ocr/vendor/tesseract/darwin-<arch>/` is absent.
- A Python 3 environment (repo-local `.venv`, then `python3`) with
  `PyInstaller`, `PyMuPDF`, and `pytesseract` installed.

## Development behaviour

- In development (not packaged), StudyBud falls back to the Python runner at
  `resources/ocr/ocr_runner.py` when no bundled binary is available.
- It prefers a repo-local `.venv` first, then `python3` / `python` on PATH.
- That development path still requires Python 3, `resources/ocr/requirements.txt`
  installed, and a working `tesseract` on PATH (e.g. via Homebrew on macOS).

## Packaging goals

- Ship one StudyBud package per platform.
- Include the frozen OCR runtime and a relocatable Tesseract tree beside it.
- Avoid requiring users to install Python or Tesseract separately.

## Override paths

- `STUDYBUD_TESSERACT_DIR` — if set, its contents are used verbatim for the
  `tesseract/` subtree (both platforms).
- `STUDYBUD_SKIP_OCR_RUNTIME=1` — skip bundled-runtime preparation entirely.
- `STUDYBUD_REBUILD_OCR=1` — force a rebuild even if an output tree already
  exists under `resources/ocr-runtime/`.
