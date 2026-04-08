# StudyBud Codex Context

## Purpose
This file is a working handoff note for future implementation passes. It captures the current project state, the structure of the codebase, what has already been built, what was fixed during Phase 0 and Phase 1, and where the likely next work should go.

It is intentionally practical rather than aspirational.

## Project Status
- Current implemented phases: Phase 0 and Phase 1, with several stabilization passes.
- Not yet implemented: Phase 2 onward (`AI ingestion`, `division extraction`, `chat`, `practice generation`, `research browser`, `video suggestions`).
- Current app state:
  - desktop Electron app
  - React renderer
  - local SQLite storage
  - subject creation
  - PDF import into app-managed storage
  - PDF text extraction and chunking
  - basic PDF viewing and extracted-text inspection
  - document deletion

## General Structure
- Main process entry: [src/main.ts](/home/dylan/projects/studybud/src/main.ts)
- Preload bridge: [src/preload.ts](/home/dylan/projects/studybud/src/preload.ts)
- Shared IPC contracts: [src/shared/ipc.ts](/home/dylan/projects/studybud/src/shared/ipc.ts)
- Main database layer: [src/main/db/database.ts](/home/dylan/projects/studybud/src/main/db/database.ts)
- DB schema: [src/main/db/schema.ts](/home/dylan/projects/studybud/src/main/db/schema.ts)
- Import pipeline:
  - worker launcher: [src/main/documents/import-process.ts](/home/dylan/projects/studybud/src/main/documents/import-process.ts)
  - worker entry: [src/main/documents/import-worker.ts](/home/dylan/projects/studybud/src/main/documents/import-worker.ts)
  - import logic: [src/main/documents/import.ts](/home/dylan/projects/studybud/src/main/documents/import.ts)
- PDF extraction: [src/main/pdf/extraction.ts](/home/dylan/projects/studybud/src/main/pdf/extraction.ts)
- Renderer root: [src/renderer.tsx](/home/dylan/projects/studybud/src/renderer.tsx)
- Main UI: [src/ui/App.tsx](/home/dylan/projects/studybud/src/ui/App.tsx)
- PDF viewer UI: [src/ui/PdfViewer.tsx](/home/dylan/projects/studybud/src/ui/PdfViewer.tsx)
- Styling: [src/index.css](/home/dylan/projects/studybud/src/index.css)
- Electron/Vite build config:
  - [forge.config.ts](/home/dylan/projects/studybud/forge.config.ts)
  - [vite.main.config.ts](/home/dylan/projects/studybud/vite.main.config.ts)
  - [vite.preload.config.ts](/home/dylan/projects/studybud/vite.preload.config.ts)
  - [vite.renderer.config.ts](/home/dylan/projects/studybud/vite.renderer.config.ts)

## Implemented Features

### Phase 0
- Electron app shell with `main`, `preload`, and `renderer` split.
- `contextIsolation`, `sandbox`, and preload-only renderer access.
- Local settings persistence.
- `safeStorage` support for encrypted API-key storage.
- Subject library and settings UI.
- SQLite bootstrap and migrations.
- Strict typed IPC surface between renderer and main process.
- Single-instance app behavior.

### Phase 1
- Subject workspace UI.
- Import lecture and homework PDFs.
- Copy PDFs into app-managed subject storage.
- Extract page text using PDF.js.
- Chunk extracted page text for later retrieval.
- Persist source documents, pages, chunks, and import jobs.
- View imported PDFs and extracted page summaries.
- Select imported documents from the workspace.
- Delete imported or failed documents from the workspace.

## Important Fixes Already Made
These are worth knowing because they explain some of the current design choices.

### Main-process / Electron startup
- Fixed missing-preload behavior so the app fails gracefully if opened as a browser page.
- Removed stray extra dev window behavior.
- Added single-instance focus behavior.
- Changed startup so IPC handlers are registered immediately and each handler waits for initialization.
  - This prevents `No handler registered` races during dev restarts.

### Native module / build issues
- Fixed `better-sqlite3` bundling issues by:
  - externalizing native-related module paths in [vite.main.config.ts](/home/dylan/projects/studybud/vite.main.config.ts)
  - loading `better-sqlite3` and `drizzle-orm/better-sqlite3` via runtime `createRequire(...)` in [src/main/db/database.ts](/home/dylan/projects/studybud/src/main/db/database.ts)
- Fixed missing import worker bundle emission.

### Import worker / background processing
- Import now runs in an Electron utility process instead of blocking the main thread.
- Fixed worker message parsing so selected files actually reach the worker payload.
- Fixed worker path resolution to avoid undefined path failures.
- Added interrupted-job reconciliation.

### PDF extraction issues
- Reworked Node/Electron PDF.js setup in [src/main/pdf/extraction.ts](/home/dylan/projects/studybud/src/main/pdf/extraction.ts).
- Added minimal DOM polyfills required by PDF.js in non-browser contexts.
- Fixed `DOMMatrix is not defined`.
- Fixed `No "GlobalWorkerOptions.workerSrc" specified.` by explicitly wiring PDF.js worker resolution for the import environment.
- Added page/task cleanup after extraction.

### UI cleanup
- Removed the `Recent Imports` section from the workspace.
- Reduced the size of the PDF page navigation thumbnails.
- Tightened document cards.
- Fixed layout collisions between:
  - document info
  - document navigation
  - PDF viewer
  - extracted page text cards

## Current Data Model Shape
Current persisted entities effectively include:
- `settings`
- `subjects`
- `jobs`
- `source_documents`
- `document_pages`
- `document_chunks`

This is enough for the next phase of AI ingestion.

## Current IPC Surface
Implemented or partially implemented channels in [src/shared/ipc.ts](/home/dylan/projects/studybud/src/shared/ipc.ts):
- `app:get-info`
- `settings:get`
- `settings:save`
- `subjects:list`
- `subjects:create`
- `subjects:workspace`
- `subjects:import`
- `documents:delete`
- `documents:detail`
- `documents:data`

## Validation Status
Recent verification passes succeeded with:
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run package`

There are automated tests for:
- DB bootstrap and document deletion
- import worker request handling
- import worker path resolution
- multi-file PDF import
- invalid import path filtering
- PDF extraction
- PDF.js worker configuration
- CSP handling

## Current UX Notes
- The workspace is still clearly an internal Phase 1 tool, not a polished student-facing product yet.
- It is functional for import/view/delete flows, but not yet aligned with the final study experience described in the roadmap.
- The current document and page browsing UI is useful scaffolding, not final product design.

## Known Limitations
- No OCR support.
- No AI model calls are wired yet.
- No division extraction, summaries, chat, or problem generation.
- No embeddings or retrieval layer yet.
- No citation-preview AI workflow yet.
- UI still needs another design pass before it feels like the intended study product.
- Most validation has been code-level and packaging-level; manual UX smoke testing should continue as features are added.

## Recommended Next Steps
1. Start Phase 2 by defining ingestion contracts and persistence for divisions/problem types.
2. Add AI provider wiring and background ingestion jobs over `document_chunks`.
3. Persist division-to-source-page links early, before chat and summarization UI.
4. Keep strengthening renderer/main-process error reporting as new async jobs are introduced.
5. Do not add OCR yet; keep the pipeline stable for digital PDFs first.

## Practical Dev Notes
- Run the desktop app with `npm run dev`, not by opening the Vite page in a browser.
- After main-process or worker changes, fully restart Electron; hot reload is not enough for every main/utility-process change.
- Native module rebuild direction matters:
  - Electron runtime: `npm run rebuild:native:electron`
  - Vitest runtime: `npm run rebuild:native:node`
- The repo is in an actively modified state; check `git status` before large edits.

## Relationship To Planning Docs
- High-level product architecture: [studybud-plan.md](/home/dylan/projects/studybud/studybud-plan.md)
- Phase-by-phase roadmap: [roadmap.md](/home/dylan/projects/studybud/roadmap.md)

This file should stay focused on what is true in the codebase now.
