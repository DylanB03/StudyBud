# Bundled OCR Runtime

This directory is reserved for packaged OCR runtimes that ship with StudyBud.

Expected Windows layout:
- `windows-x64/ocr_runner.exe`
- `windows-x64/tesseract/...`

The packaged Electron build uses this runtime in preference to the Python OCR fallback.

Development behavior is different:
- in development, StudyBud can use the Python OCR fallback from `resources/ocr/ocr_runner.py`
- it prefers a repo-local `.venv` first
- that development path still requires:
  - Python 3
  - packages from `resources/ocr/requirements.txt`
  - a working `tesseract` binary on PATH

Windows packaged-build goal:
- ship one StudyBud package
- include the frozen OCR runtime
- include bundled Tesseract assets beside it
- avoid requiring users to install Python or Tesseract separately

Build command for the Windows OCR runtime:
- `npm run build:ocr:win`
