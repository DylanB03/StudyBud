# StudyBud Codex Context

## Purpose
This file is the practical handoff note for future implementation passes.

It tracks:
- what is actually implemented in the codebase now
- what changed recently
- which changes were part of the roadmap/plan versus reactive stabilization work
- the current risks, limitations, and likely next moves

It should stay grounded in the repo, not in aspirational product goals.

## Current Repo / Environment Notes
- Current repo path on this machine: `/home/dylan/Gitrepos/allrepos/StudyBud`
- The original working path used in older notes/tooling was `/home/dylan/projects/studybud`
- The project is often run inside `WSL2`, even though the product target is still Windows-first
- That matters for:
  - Electron runtime behavior
  - native module rebuilds
  - local Ollama access when Ollama is running on Windows instead of inside WSL

## Project Status
- Current implemented phases:
  - Phase 0: implemented
  - Phase 1: implemented
  - Phase 2: implemented with ongoing stability work
  - Phase 3: implemented
  - Phase 4: implemented
  - Phase 5: implemented with a follow-up improvement pass
- Not yet implemented:
  - Phase 6 onward in the roadmap (`research/browser`, `video suggestions`, release hardening)

## What The App Can Do Now
- Electron desktop app with `main`, `preload`, and `renderer` separation
- React renderer with typed IPC bridge
- local SQLite persistence
- subject creation and reopening
- lecture/homework PDF import into app-managed storage
- PDF text extraction and chunking
- PDF viewing and extracted page-text inspection
- failed/imported document deletion
- subject deletion from the library with confirmation
- subject analysis into:
  - divisions
  - key concepts
  - problem types
  - unassigned pages
- division-first workspace
- citation preview cards tied to source pages
- click-through from a division citation into the PDF viewer
- focused citation evidence panel with excerpt-aware source context
- citation-aware page targeting that preserves the intended page when switching documents
- citation-highlighted extracted page text and PDF focus banner
- division-scoped grounded chat
- selection-based clarification with contextual popup question entry
- right-side answer/chat rail inside the workspace
- persisted chat history per division
- generated practice sets per division/problem type/difficulty
- hidden answer keys with persisted reveal/hide state
- practice-question and practice-answer explanation flow through grounded chat
- saved practice history under each subject/division
- practice set source-page persistence for later explanations
- practice set collapse / regenerate / delete controls
- provider-based AI configuration:
  - OpenAI
  - local Ollama

## What Is Partially Implemented
- The AI layer is provider-aware for analysis, grounded chat, and practice generation
- The overall student-facing polish is still below the eventual product vision, even though the roadmap-defined Phase 4 scope is now in place

## General Structure
- Main process entry: [src/main.ts](/home/dylan/Gitrepos/allrepos/StudyBud/src/main.ts)
- Preload bridge: [src/preload.ts](/home/dylan/Gitrepos/allrepos/StudyBud/src/preload.ts)
- Shared IPC contracts: [src/shared/ipc.ts](/home/dylan/Gitrepos/allrepos/StudyBud/src/shared/ipc.ts)
- Shared browser-global typing: [src/shared/global.d.ts](/home/dylan/Gitrepos/allrepos/StudyBud/src/shared/global.d.ts)
- Main database layer: [src/main/db/database.ts](/home/dylan/Gitrepos/allrepos/StudyBud/src/main/db/database.ts)
- DB schema: [src/main/db/schema.ts](/home/dylan/Gitrepos/allrepos/StudyBud/src/main/db/schema.ts)
- Import pipeline:
  - worker launcher: [src/main/documents/import-process.ts](/home/dylan/Gitrepos/allrepos/StudyBud/src/main/documents/import-process.ts)
  - worker entry: [src/main/documents/import-worker.ts](/home/dylan/Gitrepos/allrepos/StudyBud/src/main/documents/import-worker.ts)
  - import logic: [src/main/documents/import.ts](/home/dylan/Gitrepos/allrepos/StudyBud/src/main/documents/import.ts)
- PDF extraction: [src/main/pdf/extraction.ts](/home/dylan/Gitrepos/allrepos/StudyBud/src/main/pdf/extraction.ts)
- AI provider layer:
  - provider switch: [src/main/ai/provider.ts](/home/dylan/Gitrepos/allrepos/StudyBud/src/main/ai/provider.ts)
  - OpenAI client: [src/main/ai/openai.ts](/home/dylan/Gitrepos/allrepos/StudyBud/src/main/ai/openai.ts)
  - Ollama client: [src/main/ai/ollama.ts](/home/dylan/Gitrepos/allrepos/StudyBud/src/main/ai/ollama.ts)
- Phase 2 analysis: [src/main/analysis/subject-analysis.ts](/home/dylan/Gitrepos/allrepos/StudyBud/src/main/analysis/subject-analysis.ts)
- Citation excerpt helper: [src/main/analysis/citation-excerpts.ts](/home/dylan/Gitrepos/allrepos/StudyBud/src/main/analysis/citation-excerpts.ts)
- Grounded chat service: [src/main/chat/grounded-chat.ts](/home/dylan/Gitrepos/allrepos/StudyBud/src/main/chat/grounded-chat.ts)
- Practice generation service: [src/main/practice/practice-generation.ts](/home/dylan/Gitrepos/allrepos/StudyBud/src/main/practice/practice-generation.ts)
- AI JSON repair helper: [src/main/ai/json-repair.ts](/home/dylan/Gitrepos/allrepos/StudyBud/src/main/ai/json-repair.ts)
- Renderer root: [src/renderer.tsx](/home/dylan/Gitrepos/allrepos/StudyBud/src/renderer.tsx)
- Main UI: [src/ui/App.tsx](/home/dylan/Gitrepos/allrepos/StudyBud/src/ui/App.tsx)
- PDF viewer UI: [src/ui/PdfViewer.tsx](/home/dylan/Gitrepos/allrepos/StudyBud/src/ui/PdfViewer.tsx)
- Citation preview UI: [src/ui/CitationPreviewCard.tsx](/home/dylan/Gitrepos/allrepos/StudyBud/src/ui/CitationPreviewCard.tsx)
- Division chat UI: [src/ui/DivisionChatPanel.tsx](/home/dylan/Gitrepos/allrepos/StudyBud/src/ui/DivisionChatPanel.tsx)
- Practice UI: [src/ui/PracticePanel.tsx](/home/dylan/Gitrepos/allrepos/StudyBud/src/ui/PracticePanel.tsx)
- Rich chat markdown/math renderer: [src/ui/RichMessageContent.tsx](/home/dylan/Gitrepos/allrepos/StudyBud/src/ui/RichMessageContent.tsx)
- Selection popup UI: [src/ui/SelectionQuestionPopup.tsx](/home/dylan/Gitrepos/allrepos/StudyBud/src/ui/SelectionQuestionPopup.tsx)
- Selection chip UI: [src/ui/SelectionAskChip.tsx](/home/dylan/Gitrepos/allrepos/StudyBud/src/ui/SelectionAskChip.tsx)
- Styling: [src/index.css](/home/dylan/Gitrepos/allrepos/StudyBud/src/index.css)
- Build config:
  - [forge.config.ts](/home/dylan/Gitrepos/allrepos/StudyBud/forge.config.ts)
  - [vite.main.config.ts](/home/dylan/Gitrepos/allrepos/StudyBud/vite.main.config.ts)
  - [vite.preload.config.ts](/home/dylan/Gitrepos/allrepos/StudyBud/vite.preload.config.ts)
  - [vite.renderer.config.ts](/home/dylan/Gitrepos/allrepos/StudyBud/vite.renderer.config.ts)

## Implemented By Roadmap Phase

### Phase 0
- Electron app shell with `main`, `preload`, and `renderer` split
- `contextIsolation`, `sandbox`, preload-only renderer access
- SQLite bootstrap and migrations
- settings storage
- subject library / settings shell
- typed IPC
- single-instance behavior

### Phase 1
- subject workspace
- multi-PDF import for lectures/homework
- copy imported PDFs into app-managed storage
- page text extraction and chunking
- persist source documents, pages, chunks, and import jobs
- PDF viewer and extracted page-text inspection
- delete documents from workspace

### Phase 2
- persisted divisions, problem types, and unassigned pages
- subject analysis job flow
- subject analysis pane in workspace
- source-page linking from analysis results back into the PDF viewer
- OpenAI-backed analysis path
- Ollama-backed analysis path

### Phase 3
- division navigator in the workspace
- selected-division detail view
- citation preview cards for referenced source pages
- click-to-open citation navigation into the existing PDF viewer
- renderer-side PDF byte reuse/caching for cited documents
- excerpt-aware citation evidence generation from stored page text
- active citation focus state in the workspace
- citation-linked page-text highlighting and viewer focus banner

### Phase 4
- division-scoped chat history and grounded assistant answers
- `chat.ask` IPC flow backed by persistent SQLite chat messages
- selected-text clarification from analysis-derived text and extracted page text
- right-side chat/answer rail in the workspace
- contextual selection UI:
  - lightweight `Ask about this` chip on text selection
  - popup question composer near the selection
  - answers still land in the persistent chat rail

### Phase 5
- generated practice sets by division problem type and difficulty
- persisted practice sets and questions in SQLite
- hidden answer keys with persisted reveal/hide state
- practice question / answer explanation through the same grounded chat system
- practice set source-page persistence so explanations can use the actual generation evidence
- practice set management in the workspace:
  - collapse
  - regenerate
  - delete
- malformed-output recovery for practice generation on imperfect model responses

## Major Changes Added Outside The Original Roadmap / Plan
These are important because they are real codebase commitments, even though they were not originally the “next planned feature.”

### Provider Abstraction
Off-plan relative to the original architecture document, which assumed OpenAI-only MVP.

Implemented:
- provider setting: `openai | ollama`
- persistent Ollama config:
  - base URL
  - model name
- provider-specific request routing in the main process

Why it exists:
- local testing and lower-cost development
- explicit user request to support local Ollama

### Session-Only OpenAI Key Mode
Off-plan relative to the original secure-storage assumption.

Implemented:
- if `safeStorage` is unavailable, OpenAI keys can still be used for the current app session
- key is kept in memory only and not written to disk

Why it exists:
- otherwise the OpenAI settings flow could be effectively blocked on some environments

### Configurable Data Path
Off-plan relative to the original simple app-data assumption.

Implemented:
- custom data directory selection
- reset-to-default
- bootstrap config outside the main DB so startup can locate the DB before opening it
- copy current data into an empty new target directory when switching

Why it exists:
- user-requested
- useful for multi-drive storage and machine migration

### Analyze Progress / Diagnostics UX
Not a dedicated roadmap item, but necessary stabilization for the current Phase 2 implementation.

Implemented:
- live in-app analysis-running banner
- provider/model display for analysis jobs
- elapsed timer while analysis is running
- clearer Ollama timeout/reachability errors

Why it exists:
- without this, analyze felt like a hang with no observability

### Subject Deletion From Library
Not explicitly called out in the roadmap, but consistent with the product direction and needed for real subject management.

Implemented:
- delete action from the library
- confirmation prompt before deletion
- DB cleanup for subject-owned records
- filesystem cleanup for subject storage directory

Why it exists:
- user-requested
- necessary once subjects become persistent saved classes

### Workspace-Focused Layout Mode
Not explicitly called out in the roadmap, but strongly aligned with the product’s study-first usage.

Implemented:
- global left app sidebar disappears while inside a subject workspace
- workspace becomes a focused three-column study layout
- right-side chat/answer rail replaces the older bottom-stacked answer area

Why it exists:
- user-requested
- better matches the intended “inside a subject” study mode

### Rich Chat Rendering
Not explicitly called out in the roadmap, but important for making the study/chat flow readable.

Implemented:
- markdown rendering in division chat
- KaTeX-backed math rendering
- fallback superscript/subscript handling for plain-text model output
- grounding collapsed by default behind an expandable row
- chat-message text is now selectable and can feed into the same question popup flow

Why it exists:
- user-requested
- raw markdown/math output was too literal and hard to study from

### Resizable Workspace Split
Not explicitly called out in the roadmap.

Implemented:
- draggable splitter between the main workspace and the right-side chat rail
- persisted width in local storage
- responsive fallback that hides the splitter on narrow layouts

Why it exists:
- user-requested
- makes the study/chat balance more usable in a desktop context

### Practice Workflow Hardening
Partly roadmap-aligned, partly iterative utility work after the initial Phase 5 implementation.

Implemented:
- answer reveal can be toggled back off
- malformed-output recovery for practice generation
- source-page refs persisted with each practice set
- delete and regenerate for practice sets
- lightweight renderer coverage for the Practice Studio

Why it exists:
- Phase 5 was functionally complete but still too brittle and too append-only for real use

### WSL-Aware Ollama Fallback
Not in the roadmap.

Implemented:
- Ollama client can detect WSL
- if configured with `localhost`, it can also try the Windows host IP derived from WSL DNS config
- error messages now include attempted URLs and probable WSL explanation

Why it exists:
- current dev/runtime environment often runs Electron in WSL while Ollama may be hosted on Windows

## Important Fixes Already Made

### Main Process / Startup
- fixed missing-preload / browser-open behavior so the app fails gracefully outside Electron
- removed stray extra dev window behavior
- added single-instance focusing
- registered IPC handlers immediately and made handlers wait for initialization
- improved startup sequencing to avoid `No handler registered` races
- hardened IPC registration to clear and re-register handlers on startup/reload instead of assuming a clean dev main-process lifecycle

### Native Module / Build Stability
- fixed `better-sqlite3` bundling by keeping native loading on the runtime side
- added rebuild script handling for Electron and Node test contexts
- fixed worker bundle emission for the import worker

### Import / Background Work
- import runs in an Electron utility process instead of blocking the main thread
- worker message parsing fixed so selected files actually reach the import logic
- worker path resolution fixed
- interrupted jobs reconciled on startup

### PDF Extraction
- reworked PDF.js in Node/Electron import runtime
- fixed `DOMMatrix is not defined`
- fixed `No "GlobalWorkerOptions.workerSrc" specified`
- added page/task cleanup after extraction

### UI / Shell Cleanup
- removed `Recent Imports`
- tightened document cards and page navigation sizing
- fixed overlap between document info, document navigation, PDF viewer, and extracted-text panel
- moved version under the main `StudyBud` title
- removed top-level data-path display from the main shell after it proved unnecessary
- added subject delete controls in the library with confirmation
- moved the workspace from an analysis-list layout toward a division-first layout
- hid the global app sidebar while inside a subject workspace
- moved chat/answers into a dedicated right-side workspace rail
- broadened selection-based clarification across analysis-derived text surfaces instead of limiting it to the main summary
- changed selection clarification from a stagnant bottom state into a contextual popup flow

### AI / Analysis-Specific Fixes
- fixed provider gating so `Analyze Subject` works in Ollama mode without requiring an OpenAI key
- fixed OpenAI structured-output schema mismatch for `unassignedRefs.reason`
- analysis jobs now persist provider/model metadata
- improved Ollama failures from generic hangs to specific timeout/reachability errors
- fixed detached `ArrayBuffer` errors during homework analysis / citation preview rendering by cloning PDF bytes before passing them to PDF.js consumers
- citation previews previously falling back to `Preview unavailable` are now able to render from the same cached documents as the viewer
- citation summaries now derive stronger page-level excerpts and highlight text from stored page content instead of using only blunt page truncation
- fixed a citation-navigation state bug where switching documents from a citation could snap the viewer back to page 1 during document load
- added grounded division chat with citation-backed answers and persisted message history
- added selection-context clarification on analysis text and extracted page text
- changed grounded chat prompting and sanitization so PAGE refs stay out of visible answer text while grounding still appears separately
- added markdown + math rendering in chat so assistant answers read as study content instead of raw markdown
- added math-friendly fallback rendering for plain-text model output such as `x^2`, `N_1`, and near-LaTeX fragments
- made division chat message text itself highlightable for follow-up questions

### Practice / Phase 5 Fixes And Improvements
- initial Phase 5 implementation added persisted practice generation, hidden answers, and explanation hooks
- answer reveal state is now toggleable, not one-way
- practice generation now recovers from fenced/partially malformed JSON instead of failing as eagerly
- practice sets persist their own source-page refs rather than relying only on the division-level source set
- practice sets can now be collapsed, regenerated, and deleted
- practice explanations now prefer the practice set’s persisted source pages when available

## Current Data Model Shape
Persisted entities now effectively include:
- `settings`
- `subjects`
- `jobs`
- `source_documents`
- `document_pages`
- `document_chunks`
- `divisions`
- `division_source_pages`
- `problem_types`
- `unassigned_pages`
- `chat_messages`
- `practice_sets`
- `practice_questions`
- `practice_set_source_pages`

This is enough for the current Phase 5 implementation, but not yet for Phase 6 research/browser flows.

## Current IPC Surface
Implemented channels in [src/shared/ipc.ts](/home/dylan/Gitrepos/allrepos/StudyBud/src/shared/ipc.ts):
- `app:get-info`
- `settings:get`
- `settings:save`
- `settings:choose-data-path`
- `settings:reset-data-path`
- `subjects:list`
- `subjects:create`
- `subjects:delete`
- `subjects:workspace`
- `subjects:import`
- `subjects:analyze`
- `chat:ask`
- `practice:generate`
- `practice:reveal`
- `practice:delete`
- `documents:delete`
- `documents:detail`
- `documents:data`

## Current UX Notes
- The app is now beyond a pure import/viewer scaffold, and the workspace matches the intended Phase 4 study structure
- The app is now beyond a pure import/viewer scaffold, and the workspace matches the intended Phase 5 study structure
- The subject workspace is now a focused mode:
  - left workspace column for divisions/documents
  - center study content and PDF work area
  - right-side chat/answer rail
- The workspace/main vs chat rail split is now resizable by dragging the divider
- Selection-based clarification now starts from a lightweight inline chip and popup instead of a stagnant bottom composer state
- Citation preview cards, focused evidence, grounded chat answers, and Practice Studio are present, but the overall experience is still an engineering MVP rather than a polished study product
- The app currently feels like an internal MVP / engineering build rather than a polished learning product
- The settings UI is now more complex because it includes:
  - provider choice
  - OpenAI key handling
  - Ollama host/model handling
  - data-path controls

## Known Limitations
- No OCR support
- No embeddings/retrieval yet
- No web-search/browser/video workflow yet
- Current Ollama analysis path still uses a fairly heavy single-pass structured extraction prompt
  - this is likely too demanding for weaker local models on large subjects
- Grounded chat currently uses a relatively simple retrieval strategy over division source pages/chunks rather than a stronger embedding-backed retriever
- Practice generation is provider-aware now, but still uses a single-pass generation approach and would likely benefit from stronger provider-specific prompting/templates for weaker local models
- Streaming is not implemented yet
  - progress visibility exists
  - token-by-token/partial-response UX does not
- Analysis currently sends parsed page/chunk text, not PDF files
- WSL/Windows hybrid dev environments can still create edge cases around local services and native dependencies

## Current Validation Status
Recent verification commonly succeeded with:
- `npm run lint`
- `npm run typecheck`
- `npm test`

Historically there are automated tests for:
- DB bootstrap and document deletion
- subject deletion
- import worker request handling
- import worker path resolution
- multi-file PDF import
- invalid import path filtering
- PDF extraction
- PDF.js worker configuration
- CSP handling
- subject analysis persistence
- citation excerpt selection
- grounded chat persistence and answer flow
- AI JSON repair
- practice generation persistence
- practice generation malformed-output recovery
- practice set deletion
- Practice Studio renderer output

Latest full verification completed with:
- `npm run lint`
- `npm run typecheck`
- `npm test` with 30 passing tests
- `npm run package`

Important caveat:
- `npm test` has been environment-sensitive because `better-sqlite3` rebuild state can diverge between Node and Electron contexts on different machines
- treat failing tests on a fresh machine as potentially native-build related until proven otherwise

## Recommended Next Steps
1. Start Phase 6 with the research/browser workflow.
   - right-side research drawer
   - search suggestions
   - in-app browser host
   - outbound video suggestions
2. Strengthen the current grounded-chat retrieval path.
   - better relevance ranking
   - stronger citation selection
   - eventual embedding-backed retrieval
3. Stabilize local-model use by designing an Ollama-friendly analysis path.
   - smaller prompts
   - fewer pages per call
   - likely multi-pass analysis instead of one heavy structured pass
4. Add an in-app `Test Ollama` action in Settings.
   - quick health check
   - tiny chat test
   - clear success/failure messaging
5. Continue improving practice quality and control:
   - provider-specific practice prompting/templates
   - optional practice-set export / print flow
   - stronger per-question source grounding
6. Continue to treat native rebuild issues on fresh environments as a standing maintenance concern.

## Practical Dev Notes
- Run the desktop app with `npm run dev`, not by opening the Vite page directly in a browser
- Fully restart Electron after main-process, preload, worker, or AI client changes
- If a new IPC channel appears to exist in code but not at runtime, suspect a stale Electron main process first and fully restart `npm run dev`
- Native rebuild direction still matters:
  - Electron runtime: `npm run rebuild:native:electron`
  - Vitest runtime: `npm run rebuild:native:node`
- If local Ollama works from shell but not in-app, compare:
  - the runtime environment where Electron is actually running
  - the configured base URL in Settings
  - whether the app is in WSL while Ollama is hosted on Windows

## Relationship To Planning Docs
- Product architecture plan: [studybud-plan.md](/home/dylan/Gitrepos/allrepos/StudyBud/studybud-plan.md)
- Phase-by-phase roadmap: [roadmap.md](/home/dylan/Gitrepos/allrepos/StudyBud/roadmap.md)

## Summary Judgment
The codebase has moved beyond the original “Phase 0 + Phase 1 scaffold” state.

The most accurate description now is:
- solid Phase 0
- solid Phase 1
- real but still maturing Phase 2
- solid Phase 3
- solid Phase 4
- solid Phase 5
- multiple user-driven stabilizations and environment-driven fixes layered on top

Future work should treat the current provider abstraction, data-path configuration, analysis diagnostics, division-first workspace, citation-focus flow, grounded chat flow, Practice Studio, selection popup UX, resizable workspace split, and subject/practice deletion flows as established parts of the app, even though they were not all part of the original MVP assumptions.
